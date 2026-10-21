// Synthetic lifecycle/fault contracts only; the native TLS fixture proves provider behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { captureSnapshot } from './snapshot.mjs';
process.umask(0o077);
const policy = 'platform-raft-snapshot-reader',
  token = 's.syntheticToken000000000000001';
async function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'myims-snapshot-test-'));
  const credentials = join(root, 'credentials'),
    output = join(root, 'output'),
    state = join(root, 'state'),
    bundle = join(root, 'bundle');
  for (const path of [credentials, output, state, bundle])
    mkdirSync(path, { mode: 0o700 });
  const auth = {
    roleId: '00000000-0000-4000-8000-000000000001',
    secretId: '00000000-0000-4000-8000-000000000002',
  };
  writeFileSync(join(credentials, 'approle.json'), JSON.stringify(auth));
  const files = {
    'meta.json': Buffer.from('{"Index":1,"Term":1}'),
    'state.bin': Buffer.from('synthetic-fixture-state'),
  };
  for (const [name, bytes] of Object.entries(files))
    writeFileSync(join(bundle, name), bytes);
  writeFileSync(
    join(bundle, 'SHA256SUMS'),
    Object.entries(files)
      .map(
        ([name, bytes]) =>
          createHash('sha256').update(bytes).digest('hex') + '  ' + name,
      )
      .join('\n') + '\n',
  );
  writeFileSync(
    join(bundle, 'SHA256SUMS.sealed'),
    'synthetic-sealed-presence-only',
  );
  const snapshot = execFileSync('tar', [
    '--format=ustar',
    '-czf',
    '-',
    '-C',
    bundle,
    'meta.json',
    'state.bin',
    'SHA256SUMS',
    'SHA256SUMS.sealed',
  ]);
  try {
    return await action({ credentials, output, state, auth, snapshot });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function provider(snapshot, fault) {
  const calls = [];
  let revoked = false;
  const call = async (path, suppliedToken, body) => {
    calls.push(path);
    if (path === 'auth/platform-backup/login') {
      if (fault === 'lost-login') throw new Error('Synthetic lost response');
      if (fault === 'denied-login') return { status: 403, value: {} };
      if (fault === 'malformed-denial')
        return { status: 401, value: { auth: { client_token: 123 } } };
      return {
        status: fault === 'denied-with-token' ? 401 : 200,
        value: {
          auth: {
            client_token: token,
            policies: fault === 'extra-policy' ? [policy, 'default'] : [policy],
            lease_duration: 300,
          },
        },
      };
    }
    assert.equal(suppliedToken, token);
    if (path === 'auth/token/revoke-self') {
      if (fault === 'lost-revoke') throw new Error('Synthetic lost cleanup');
      revoked = true;
      return { status: 204, value: {} };
    }
    if (path === 'auth/token/lookup-self')
      return revoked
        ? { status: fault === 'live-after-revoke' ? 200 : 403, value: {} }
        : {
            status: 200,
            value: {
              data: {
                id: token,
                policies: [policy],
                identity_policies: fault === 'malformed-identity' ? '' : [],
                type: 'service',
                explicit_max_ttl: fault === 'wrong-maximum' ? 86400 : 300,
                ttl: 299,
                creation_ttl: 300,
                period: 0,
                path: 'auth/platform-backup/login',
                meta: { role_name: policy },
              },
            },
          };
    if (path === 'sys/capabilities-self')
      return {
        status: 200,
        value: Object.fromEntries(
          body.paths.map((p) => [
            p,
            p === 'sys/storage/raft/snapshot'
              ? fault === 'extra-capability'
                ? ['read', 'update']
                : ['read']
              : ['deny'],
          ]),
        ),
      };
    if (path === 'sys/storage/raft/snapshot') {
      if (fault === 'snapshot-failure') throw new Error('Synthetic outage');
      return {
        status: 200,
        value: fault === 'corrupt-snapshot' ? Buffer.from('corrupt') : snapshot,
      };
    }
    throw new Error('Unexpected path');
  };
  return { call, calls };
}
test('bounded source capture cleans token before releasing snapshot and journals no credentials', () =>
  fixture(async (f) => {
    const p = provider(f.snapshot);
    const id = await captureSnapshot(f.credentials, f.output, f.state, p.call);
    assert.deepEqual(readFileSync(join(f.output, id + '.snap')), f.snapshot);
    assert.equal(
      JSON.parse(readFileSync(join(f.output, id + '.json')))
        .tokenCleanupConfirmed,
      true,
    );
    assert.deepEqual(p.calls.slice(-2), [
      'auth/token/revoke-self',
      'auth/token/lookup-self',
    ]);
    const text = readdirSync(f.state)
      .map((n) => readFileSync(join(f.state, n), 'utf8'))
      .join('');
    assert.ok(!text.includes(token) && !text.includes(f.auth.secretId));
  }));
for (const fault of [
  'denied-with-token',
  'extra-policy',
  'malformed-identity',
  'wrong-maximum',
  'extra-capability',
  'snapshot-failure',
  'corrupt-snapshot',
]) {
  test('known token is revoked and no snapshot released on ' + fault, () =>
    fixture(async (f) => {
      const p = provider(f.snapshot, fault);
      await assert.rejects(() =>
        captureSnapshot(f.credentials, f.output, f.state, p.call),
      );
      assert.equal(
        p.calls.filter((n) => n === 'auth/platform-backup/login').length,
        1,
      );
      assert.ok(p.calls.includes('auth/token/revoke-self'));
      assert.equal(readdirSync(f.output).length, 0);
      const result = readdirSync(f.state).find((n) => n.startsWith('result-'));
      assert.equal(
        JSON.parse(readFileSync(join(f.state, result))).cleanupConfirmed,
        true,
      );
    }),
  );
}
for (const fault of [
  'malformed-denial',
  'lost-login',
  'lost-revoke',
  'live-after-revoke',
]) {
  test(
    'uncertain ' + fault + ' fences subsequent login without snapshot release',
    () =>
      fixture(async (f) => {
        const p = provider(f.snapshot, fault);
        await assert.rejects(() =>
          captureSnapshot(f.credentials, f.output, f.state, p.call),
        );
        assert.equal(readdirSync(f.output).length, 0);
        const count = p.calls.length;
        await assert.rejects(() =>
          captureSnapshot(f.credentials, f.output, f.state, p.call),
        );
        assert.equal(p.calls.length, count);
      }),
  );
}
test('acknowledged denied login journals clean failure without a second login', () =>
  fixture(async (f) => {
    const p = provider(f.snapshot, 'denied-login');
    await assert.rejects(() =>
      captureSnapshot(f.credentials, f.output, f.state, p.call),
    );
    assert.deepEqual(p.calls, ['auth/platform-backup/login']);
    assert.equal(readdirSync(f.output).length, 0);
    assert.equal(
      readdirSync(f.state).filter((n) => n.startsWith('result-')).length,
      1,
    );
  }));
test('exclusive operation lock and invalid auth fail before login', () =>
  fixture(async (f) => {
    const p = provider(f.snapshot);
    mkdirSync(join(f.state, 'capture.lock'));
    await assert.rejects(() =>
      captureSnapshot(f.credentials, f.output, f.state, p.call),
    );
    assert.equal(p.calls.length, 0);
    rmSync(join(f.state, 'capture.lock'), { recursive: true });
    writeFileSync(
      join(f.credentials, 'approle.json'),
      '{"roleId":"bad","secretId":"bad"}',
    );
    await assert.rejects(() =>
      captureSnapshot(f.credentials, f.output, f.state, p.call),
    );
    assert.equal(p.calls.length, 0);
  }));

test('output failure follows cleanup and releases operation lock without a successful receipt', () =>
  fixture(async (f) => {
    const p = provider(f.snapshot);
    chmodSync(f.output, 0o500);
    await assert.rejects(() =>
      captureSnapshot(f.credentials, f.output, f.state, p.call),
    );
    assert.deepEqual(p.calls.slice(-2), [
      'auth/token/revoke-self',
      'auth/token/lookup-self',
    ]);
    assert.ok(!readdirSync(f.state).includes('capture.lock'));
    assert.equal(readdirSync(f.output).length, 0);
    chmodSync(f.output, 0o700);
  }));
