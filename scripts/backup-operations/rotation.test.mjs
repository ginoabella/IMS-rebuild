import assert from 'node:assert/strict';
import test from 'node:test';
import { issueReplacement, retirePrevious } from './rotation.mjs';

const roleId = '11111111-1111-4111-8111-111111111111';
const old = { roleId, secretId: '22222222-2222-4222-8222-222222222222' };
const secret = '33333333-3333-4333-8333-333333333333';
const accessor = '44444444-4444-4444-8444-444444444444';
const base = 'auth/platform-backup/role/platform-raft-snapshot-reader';

function fixture(fault) {
  const calls = [],
    revoked = new Set();
  let retired = false,
    persisted;
  const human = 'human-session-token-123456789';
  const workload = 'workload-session-token-123456789';
  const call = async (path, body, token) => {
    calls.push({ path, body, token });
    if (path === 'auth/platform-custodian/login/platform-backup-maintainer')
      return {
        status: 200,
        value: {
          auth: {
            client_token: human,
            policies: ['platform-backup-rotation'],
            lease_duration: 900,
          },
        },
      };
    if (path === 'auth/platform-backup/login') {
      if (body.secret_id === old.secretId && retired)
        return { status: 400, value: { errors: ['invalid'] } };
      return {
        status: 200,
        value: {
          auth: {
            client_token: workload,
            policies: ['platform-raft-snapshot-reader'],
            lease_duration: 300,
          },
        },
      };
    }
    if (path === 'auth/token/revoke-self') {
      if (fault === 'revoke-uncertain') throw new Error('lost reply');
      revoked.add(token);
      return { status: 204, value: {} };
    }
    if (path === 'auth/token/lookup-self') {
      if (revoked.has(token)) return { status: 403, value: {} };
      const isHuman = token === human;
      return {
        status: 200,
        value: {
          data: {
            id: token,
            policies: [
              isHuman
                ? 'platform-backup-rotation'
                : 'platform-raft-snapshot-reader',
            ],
            explicit_max_ttl: isHuman
              ? 900
              : fault === 'workload-too-broad'
                ? 901
                : 300,
            ttl: isHuman ? 900 : 300,
            creation_ttl: isHuman ? 900 : 300,
            type: 'service',
            path: isHuman
              ? 'auth/platform-custodian/login/platform-backup-maintainer'
              : 'auth/platform-backup/login',
          },
        },
      };
    }
    if (path === 'sys/capabilities-self')
      return {
        status: 200,
        value: Object.fromEntries(
          body.paths.map((p) => [
            p,
            token === human
              ? p === base + '/role-id'
                ? ['read']
                : p.startsWith(base + '/secret-id')
                  ? ['update']
                  : ['deny']
              : p === 'sys/storage/raft/snapshot'
                ? ['read']
                : ['deny'],
          ]),
        ),
      };
    if (path === base + '/role-id')
      return { status: 200, value: { data: { role_id: roleId } } };
    if (path === base + '/secret-id') {
      if (fault === 'lost-issuance-reply')
        throw new Error('committed but lost');
      return {
        status: 200,
        value: { data: { secret_id: secret, secret_id_accessor: accessor } },
      };
    }
    if (path === base + '/secret-id-accessor/lookup')
      return retired
        ? { status: 404, value: {} }
        : {
            status: 200,
            value: {
              data: { secret_id_ttl: 2592000, secret_id_num_uses: 1000 },
            },
          };
    if (path === base + '/secret-id-accessor/destroy') {
      retired = true;
      return { status: 204, value: {} };
    }
    throw new Error('unexpected request');
  };
  return {
    call,
    calls,
    revoked,
    persist: async (v) => {
      persisted = v;
    },
    get persisted() {
      return persisted;
    },
    mark: async () => {},
    password: 'synthetic',
    old,
  };
}

test('replacement uses exact single issuance, verifies workload, revokes both sessions', async () => {
  const f = fixture();
  const result = await issueReplacement(f);
  assert.equal(result.status, 'replacement-verified');
  assert.equal(f.persisted.secretId, secret);
  assert.deepEqual(
    f.calls.filter((c) => c.path === base + '/secret-id').map((c) => c.body),
    [{ ttl: '720h', num_uses: '1000' }],
  );
  assert.equal(f.revoked.size, 2);
  assert.equal(
    f.calls.some((c) => c.path === base + '/secret-id-accessor/destroy'),
    false,
  );
});
test('lost issuance response sends once and revokes human without retirement', async () => {
  const f = fixture('lost-issuance-reply');
  await assert.rejects(issueReplacement(f));
  assert.equal(f.calls.filter((c) => c.path === base + '/secret-id').length, 1);
  assert.equal(f.persisted, undefined);
  assert.equal(f.revoked.size, 1);
  assert.equal(
    f.calls.some((c) => c.path.endsWith('/destroy')),
    false,
  );
});
test('invalid workload bounds fail and revoke both owned sessions', async () => {
  const f = fixture('workload-too-broad');
  await assert.rejects(issueReplacement(f));
  assert.equal(f.revoked.size, 2);
  assert.ok(f.persisted);
});
test('unconfirmed cleanup cannot report a verified replacement', async () => {
  const f = fixture('revoke-uncertain');
  await assert.rejects(issueReplacement(f));
  assert.equal(
    f.calls.filter((c) => c.path === 'auth/token/revoke-self').length,
    2,
  );
  assert.equal(
    f.calls.filter((c) => c.path === 'auth/token/lookup-self').length,
    4,
  );
});
test('old accessor retirement verifies absence, old login denial and human revoke', async () => {
  const f = fixture();
  const result = await retirePrevious({ ...f, accessor });
  assert.equal(result.oldLoginDenied, true);
  assert.equal(f.revoked.size, 1);
  assert.equal(
    f.calls.filter((c) => c.path === base + '/secret-id-accessor/destroy')
      .length,
    1,
  );
  assert.equal(
    f.calls.some((c) => c.path === base + '/secret-id'),
    false,
  );
});
test('invalid input refuses before any login', async () => {
  const f = fixture();
  await assert.rejects(
    issueReplacement({ ...f, old: { ...old, roleId: 'bad' } }),
  );
  assert.equal(f.calls.length, 0);
});
