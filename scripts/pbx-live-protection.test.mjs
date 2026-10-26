import { observedBaselineEndpoints } from './pbx-observed-baseline.mjs';
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  statSync,
  chmodSync,
  symlinkSync,
  linkSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { ProtectedArtifactStore } = backend(
  './dist/modules/telephony/adapters/live/artifact-store.js',
);
const { ExactLiveMaterialConsumer } = backend(
  './dist/modules/telephony/adapters/live/exact-material.js',
);
const directories = [];
const directory = () => {
  const d = mkdtempSync(join(tmpdir(), 'pbx-live-protection-'));
  directories.push(d);
  return d;
};
const exact = () => ({
  installationId: randomUUID(),
  nodeId: randomUUID(),
  revisionId: randomUUID(),
  sequence: 1,
  compilerVersion: 'live-1',
  policyVersion: 'deny-unbound-1',
  sourceDigest: 'a'.repeat(64),
});
const artifacts = () => ({
  pjsip: Buffer.from('; protected password fixture\n'),
  dialplan: Buffer.from('[default]\nexten => _X.,1,Hangup()\n'),
});
const failure = (code) => (e) =>
  e.code === code && !e.message.includes('fixture-secret');
after(() => {
  for (const d of directories) rmSync(d, { recursive: true, force: true });
});
test('complete immutable staging is owner-only, exact, bounded, and has no activation capability', () => {
  const root = directory(),
    ref = exact(),
    files = artifacts(),
    store = new ProtectedArtifactStore(root, ref.installationId, ref.nodeId);
  assert.deepEqual(store.stage(ref, files), ref);
  assert.deepEqual(store.load(ref), files);
  assert.deepEqual(store.stage(ref, files), ref);
  assert.equal(typeof store.activate, 'undefined');
  for (const name of ['pjsip.conf', 'extensions.conf', 'provenance.json'])
    assert.equal(
      statSync(join(root, ref.revisionId, name)).mode & 0o777,
      0o600,
    );
  assert.equal(statSync(join(root, ref.revisionId)).mode & 0o777, 0o700);
  assert.throws(
    () => store.stage(ref, { ...files, dialplan: Buffer.from('changed') }),
    failure('artifact_conflict'),
  );
  assert.throws(
    () => store.load({ ...ref, sequence: 2 }),
    failure('artifact_conflict'),
  );
  assert.throws(
    () => store.stage({ ...ref, revisionId: '../../outside' }, files),
    failure('artifact_invalid'),
  );
  assert.throws(
    () => store.stage({ ...ref, installationId: randomUUID() }, files),
    failure('artifact_invalid'),
  );
  assert.throws(
    () =>
      store.stage(
        { ...ref, revisionId: randomUUID() },
        { ...files, pjsip: Buffer.alloc(4 * 1024 * 1024) },
      ),
    failure('artifact_invalid'),
  );
});
test('staging detects tampered, incomplete, symlinked, hardlinked and permissive artifacts', () => {
  for (const attack of [
    'tamper',
    'missing',
    'symlink',
    'hardlink',
    'mode',
    'extra',
  ]) {
    const root = directory(),
      ref = exact(),
      files = artifacts(),
      store = new ProtectedArtifactStore(root, ref.installationId, ref.nodeId);
    store.stage(ref, files);
    const path = join(root, ref.revisionId, 'pjsip.conf');
    if (attack === 'tamper') writeFileSync(path, 'fixture-secret');
    if (attack === 'missing') unlinkSync(path);
    if (attack === 'symlink') {
      const other = join(root, 'private');
      writeFileSync(other, files.pjsip, { mode: 0o600 });
      unlinkSync(path);
      symlinkSync(other, path);
    }
    if (attack === 'hardlink') linkSync(path, join(root, 'second-link'));
    if (attack === 'mode') chmodSync(path, 0o644);
    if (attack === 'extra')
      writeFileSync(join(root, ref.revisionId, 'extra.conf'), '');
    assert.throws(() => store.load(ref));
    assert.throws(() => store.stage(ref, files));
  }
  const root = directory(),
    ref = exact(),
    link = join(root, 'link');
  symlinkSync(root, link);
  assert.throws(
    () => new ProtectedArtifactStore(link, ref.installationId, ref.nodeId),
  );
  chmodSync(root, 0o755);
  assert.throws(
    () => new ProtectedArtifactStore(root, ref.installationId, ref.nodeId),
  );
});
let server, configuration, binding, trunk, requests, respond, cert, root;
before(async () => {
  root = directory();
  const key = join(root, 'key.pem');
  cert = join(root, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-days',
      '1',
    ],
    { stdio: 'ignore' },
  );
  requests = [];
  server = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    (req, res) => {
      requests.push({ method: req.method, path: req.url });
      assert.equal(req.headers['x-vault-token'], 'fixture-token-for-read-only');
      respond(req, res);
    },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const tokenFile = join(root, 'token');
  writeFileSync(tokenFile, 'fixture-token-for-read-only', { mode: 0o600 });
  configuration = {
    installationId: randomUUID(),
    endpoint: `https://127.0.0.1:${server.address().port}`,
    caFile: cert,
    tokenFile,
  };
  binding = {
    installationId: configuration.installationId,
    extensionId: randomUUID(),
    operationId: randomUUID(),
    generationId: randomUUID(),
  };
  trunk = {
    installationId: configuration.installationId,
    credentialId: randomUUID(),
    operationId: randomUUID(),
    version: 7,
    realm: 'synthetic.invalid',
  };
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
const endpointEnvelope = () => ({
  data: {
    metadata: { version: 1, destroyed: false, deletion_time: '' },
    data: { ...binding, password: 'b'.repeat(64) },
  },
});
const trunkEnvelope = () => ({
  data: {
    metadata: { version: 7, destroyed: false, deletion_time: '' },
    data: {
      installationId: trunk.installationId,
      credentialId: trunk.credentialId,
      operationId: trunk.operationId,
      purpose: 'outbound-digest',
      realm: trunk.realm,
      username: 'synthetic',
      password: 'fixture-secret',
    },
  },
});
const reply = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};
test('verified TLS consumer uses only GET and exact endpoint/trunk versions with no latest fallback', async () => {
  requests.length = 0;
  respond = (req, res) =>
    reply(
      res,
      200,
      req.url.includes('myims-endpoint') ? endpointEnvelope() : trunkEnvelope(),
    );
  const c = new ExactLiveMaterialConsumer(configuration);
  assert.deepEqual(await c.endpoint(binding), { password: 'b'.repeat(64) });
  assert.deepEqual(await c.trunk(trunk), {
    username: 'synthetic',
    password: 'fixture-secret',
    realm: trunk.realm,
  });
  assert.deepEqual(requests, [
    {
      method: 'GET',
      path: `/v1/myims-endpoint/data/installations/${binding.installationId}/extensions/${binding.extensionId}/operations/${binding.operationId}?version=1`,
    },
    {
      method: 'GET',
      path: `/v1/myims-trunk/data/installations/${trunk.installationId}/bindings/${trunk.credentialId}/generations/${trunk.credentialId}?version=7`,
    },
  ]);
  for (const method of ['prepare', 'destroy', 'renew', 'call', 'list'])
    assert.equal(typeof c[method], 'undefined');
  const before = requests.length;
  await assert.rejects(
    c.endpoint({ ...binding, installationId: randomUUID() }),
    failure('material_invalid'),
  );
  await assert.rejects(
    c.trunk({ ...trunk, version: 0 }),
    failure('material_invalid'),
  );
  await assert.rejects(
    c.endpoint({ ...binding, operationId: '../latest' }),
    failure('material_invalid'),
  );
  assert.equal(requests.length, before);
  assert.equal(JSON.stringify(c), '{}');
});
test('exact reads reject mismatched, destroyed, deleted or malformed material without fallback', async () => {
  const c = new ExactLiveMaterialConsumer(configuration);
  for (const alter of [
    (e) => (e.data.metadata.version = 8),
    (e) => (e.data.metadata.destroyed = true),
    (e) => (e.data.metadata.deletion_time = 'later'),
    (e) => (e.data.data.operationId = randomUUID()),
    (e) => (e.data.data.realm = 'other.invalid'),
    (e) => (e.data.data.extra = 'unexpected'),
  ]) {
    const value = trunkEnvelope();
    alter(value);
    const n = requests.length;
    respond = (_req, res) => reply(res, 200, value);
    await assert.rejects(c.trunk(trunk), failure('material_invalid'));
    assert.equal(requests.length, n + 1);
  }
  for (const alter of [
    (e) => (e.data.data.generationId = randomUUID()),
    (e) => (e.data.data.password = 'invalid'),
    (e) => (e.data.data.extra = 'unexpected'),
  ]) {
    const value = endpointEnvelope();
    alter(value);
    respond = (_req, res) => reply(res, 200, value);
    await assert.rejects(c.endpoint(binding), failure('material_invalid'));
  }
  for (const [status, code] of [
    [404, 'material_missing'],
    [403, 'material_denied'],
    [503, 'material_unavailable'],
    [302, 'material_unavailable'],
  ]) {
    const n = requests.length;
    respond = (_req, res) => reply(res, status, { password: 'fixture-secret' });
    await assert.rejects(c.trunk(trunk), failure(code));
    assert.equal(requests.length, n + 1);
  }
});
test('consumer rejects unsafe token files, untrusted TLS and oversized replies', async () => {
  const tokenLink = join(root, 'token-link');
  symlinkSync(configuration.tokenFile, tokenLink);
  assert.throws(
    () =>
      new ExactLiveMaterialConsumer({ ...configuration, tokenFile: tokenLink }),
    failure('material_invalid'),
  );
  const tokenOther = join(root, 'token-other');
  writeFileSync(tokenOther, 'fixture-token-for-read-only', { mode: 0o644 });
  assert.throws(
    () =>
      new ExactLiveMaterialConsumer({
        ...configuration,
        tokenFile: tokenOther,
      }),
    failure('material_invalid'),
  );
  const emptyCA = join(root, 'empty-ca');
  writeFileSync(emptyCA, '');
  await assert.rejects(
    new ExactLiveMaterialConsumer({
      ...configuration,
      caFile: emptyCA,
    }).endpoint(binding),
    failure('material_unavailable'),
  );
  respond = (_req, res) => reply(res, 200, { data: 'x'.repeat(32769) });
  await assert.rejects(
    new ExactLiveMaterialConsumer(configuration).endpoint(binding),
    failure('material_unavailable'),
  );
});

test('an actively streaming provider cannot extend the absolute five-second read deadline', async () => {
  respond = (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{');
    const interval = setInterval(() => res.write(' '), 100);
    res.once('close', () => clearInterval(interval));
  };
  const started = Date.now();
  await assert.rejects(
    new ExactLiveMaterialConsumer(configuration).endpoint(binding),
    failure('material_unavailable'),
  );
  assert.ok(Date.now() - started >= 4900);
  assert.ok(Date.now() - started < 7000);
});

test('retained baseline uses full AMI identities after unique CLI qualification and rejects omissions, extras and ambiguous truncation', () => {
  const long = 'ims-t-' + 'a'.repeat(32) + '-' + 'b'.repeat(32);
  const short = long.slice(0, 51);
  const facts = [{ endpoint: long }, { endpoint: 'marker' }];
  assert.deepEqual(
    observedBaselineEndpoints(facts, [short, 'marker']),
    [long, 'marker'].sort(),
  );
  assert.deepEqual(observedBaselineEndpoints([], []), []);
  assert.deepEqual(
    observedBaselineEndpoints(
      [{ endpoint: 'a' }, { endpoint: 'ab' }],
      ['a', 'ab'],
    ),
    ['a', 'ab'],
  );
  assert.throws(() => observedBaselineEndpoints(facts, ['marker']));
  assert.throws(() => observedBaselineEndpoints(facts, ['wrong', 'marker']));
  assert.throws(() =>
    observedBaselineEndpoints(
      [{ endpoint: long }, { endpoint: long + 'c' }],
      [short, short],
    ),
  );
  assert.throws(() =>
    observedBaselineEndpoints(
      [{ endpoint: 'marker' }, { endpoint: 'marker' }],
      ['marker', 'marker'],
    ),
  );
});
