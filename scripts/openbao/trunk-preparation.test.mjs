import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  chmodSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
import { provisioningPlan } from './provisioning-plan.mjs';
import { protectedFile } from './protected-client.mjs';
import {
  recoveryContainerIds,
  recoveryDeadline,
} from './recovery-deadline.mjs';
const backend = createRequire(
  new URL('../../services/backend/package.json', import.meta.url),
);
const { OpenBaoEndpointProvider } = backend(
  './dist/modules/telephony/adapters/credentials/openbao.js',
);
const { OpenBaoTrunkProvider } = backend(
  './dist/modules/telephony/adapters/credentials/trunk-openbao.js',
);
const { trunkImportMaterial, trunkMaterialIdentity, sameTrunkMaterial } =
  backend('./dist/modules/telephony/domain/trunk-material.js');
const installation = randomUUID(),
  otherInstallation = randomUUID();
test('restricted manifest rejects ambiguous scope and keeps exact lifecycle grants', () => {
  for (const manifest of [
    null,
    {},
    { version: 1, installations: [] },
    { version: 1, installations: [installation, installation] },
    { version: 1, installations: ['*'] },
    { version: 1, installations: [installation], extra: true },
  ])
    assert.throws(() => provisioningPlan(manifest));
  const p = provisioningPlan({
    version: 1,
    installations: [installation, otherInstallation],
  });
  const verifier = p.policies.find(
    (x) => x.name === `trunk-verifier-${installation}`,
  ).policy;
  assert.ok(
    verifier.includes(
      `myims-trunk/data/installations/${installation}/bindings/+/generations/+`,
    ),
  );
  assert.ok(
    !verifier.includes(otherInstallation) &&
      !verifier.includes('myims-endpoint') &&
      !verifier.includes('"update" ]'),
  );
  assert.equal(
    p.roles.find((x) => x.name === `trunk-verifier-${installation}`)
      .configuration.token_explicit_max_ttl,
    86400,
  );
  for (const role of p.roles) {
    assert.deepEqual(role.configuration.allowed_policies, [
      role.name.replace('worker-expiring', 'worker'),
    ]);
    assert.equal(role.configuration.orphan, true);
    assert.equal(role.request.no_default_policy, true);
  }
  for (const lifecycle of ['trunk', 'endpoint']) {
    const issuer = p.policies.find(
      (x) => x.name === `${lifecycle}-restricted-issuer`,
    ).policy;
    assert.ok(
      !issuer.includes('sys/policies') &&
        !issuer.includes('auth/token/roles') &&
        !issuer.includes('sudo'),
    );
    assert.ok(
      !issuer.includes('path "auth/token/create"') && !issuer.includes('*'),
    );
    assert.ok(
      !issuer.includes(
        `auth/token/create/${lifecycle === 'trunk' ? 'endpoint' : 'trunk'}-`,
      ),
    );
  }
  const endpoint = p.policies.find(
    (x) => x.name === `endpoint-worker-${installation}`,
  ).policy;
  assert.ok(
    endpoint.includes('capabilities = ["create", "read"]') &&
      !endpoint.includes('myims-trunk'),
  );
});
test('protected files reject broad permissions and symlinks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trunk-file-'));
  try {
    const path = join(dir, 'input');
    writeFileSync(path, randomBytes(32), { mode: 0o600 });
    assert.equal(protectedFile(path).length, 32);
    chmodSync(path, 0o644);
    assert.throws(() => protectedFile(path));
    chmodSync(path, 0o600);
    symlinkSync(path, join(dir, 'link'));
    assert.throws(() => protectedFile(join(dir, 'link')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('material grammar preserves exact printable password and rejects injected identity', () => {
  const input = {
    username: 'fixture+account',
    password: randomBytes(24).toString('hex') + ' ',
    realm: 'trunk.fixture.invalid',
  };
  assert.ok(sameTrunkMaterial(trunkImportMaterial(input, input.realm), input));
  for (const change of [
    { password: 'bad\nvalue' },
    { username: 'x;directive' },
    { realm: '*' },
    { realm: 'foreign.invalid' },
    { providerPath: 'forbidden' },
  ])
    assert.throws(
      () => trunkImportMaterial({ ...input, ...change }, input.realm),
      (e) => e.code === 'material_invalid',
    );
  const identity = {
    installationId: installation,
    bindingId: randomUUID(),
    peerId: randomUUID(),
    generationId: randomUUID(),
    operationId: randomUUID(),
    generationOrdinal: 1,
    materialVersion: 1,
    purposes: ['outbound-request'],
  };
  assert.throws(
    () => trunkMaterialIdentity(identity, otherInstallation),
    (e) => e.code === 'material_invalid',
  );
});
test('protected HTTPS adapter pins CAS/version/identity and distinguishes denied/missing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trunk-provider-'));
  let server;
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(dir, 'key.pem'),
        '-out',
        join(dir, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
      ],
      { stdio: 'pipe' },
    );
    const token = randomBytes(32).toString('hex');
    const tokenFile = join(dir, 'token');
    writeFileSync(tokenFile, token, { mode: 0o600 });
    const b = {
      installationId: installation,
      bindingId: randomUUID(),
      peerId: randomUUID(),
      generationId: randomUUID(),
      operationId: randomUUID(),
      generationOrdinal: 1,
      materialVersion: 1,
      purposes: ['outbound-request'],
    };
    const material = {
      username: 'fixture.account',
      password: randomBytes(32).toString('hex'),
      realm: 'trunk.fixture.invalid',
    };
    let stored = null,
      override = null,
      mutation = null,
      writes = 0,
      loseAck = false,
      lease = 3600,
      renewStatus = 200,
      renewBody,
      loseRenewal = false;
    const paths = [];
    server = createServer(
      {
        key: readFileSync(join(dir, 'key.pem')),
        cert: readFileSync(join(dir, 'cert.pem')),
      },
      async (req, res) => {
        req.on('error', () => {});
        let bytes = '';
        for await (const chunk of req) bytes += chunk;
        paths.push(req.url);
        res.setHeader('Content-Type', 'application/json');
        if (req.headers['x-vault-token'] !== token) {
          res.writeHead(403);
          res.end('{}');
          return;
        }
        if (req.url === '/v1/auth/token/renew-self') {
          if (loseRenewal) {
            res.destroy();
            return;
          }
          res.writeHead(renewStatus);
          res.end(
            JSON.stringify({
              ...(renewBody ?? {
                auth: { lease_duration: lease, renewable: true },
              }),
            }),
          );
          return;
        }
        if (override) {
          res.writeHead(override);
          res.end('{}');
          return;
        }
        if (req.method === 'POST') {
          const data = JSON.parse(bytes);
          writes++;
          if (data.options?.cas !== 0 || stored) {
            res.writeHead(400);
            res.end('{}');
            return;
          }
          stored = data.data;
          if (loseAck) {
            loseAck = false;
            res.destroy();
            return;
          }
          res.end('{}');
          return;
        }
        if (!stored) {
          res.writeHead(404);
          res.end('{}');
          return;
        }
        const envelope = {
          data: {
            metadata: { version: 1, destroyed: false, deletion_time: '' },
            data: stored,
          },
        };
        mutation?.(envelope);
        res.end(JSON.stringify(envelope));
      },
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const provider = new OpenBaoTrunkProvider({
      endpoint: `https://127.0.0.1:${server.address().port}`,
      caFile: join(dir, 'cert.pem'),
      tokenFile,
      installationId: installation,
      exactRealm: material.realm,
    });
    assert.equal(JSON.stringify(provider), '{}');
    assert.equal(await provider.verify(b), 'missing');
    override = 403;
    await assert.rejects(provider.verify(b), (e) => e.code === 'access_denied');
    override = null;
    await provider.import(b, material);
    assert.equal(writes, 1);
    assert.equal(await provider.verify(b), 'verified');
    await provider.import(b, material);
    assert.equal(writes, 1);
    await assert.rejects(
      provider.import(b, {
        ...material,
        password: randomBytes(32).toString('hex'),
      }),
      (e) => e.code === 'import_conflict',
    );
    assert.equal(writes, 1);
    assert.ok(
      paths
        .filter((x) => !x.endsWith('renew-self'))
        .every(
          (x) =>
            x ===
              `/v1/myims-trunk/data/installations/${installation}/bindings/${b.bindingId}/generations/${b.generationId}` ||
            x.endsWith('?version=1'),
        ),
    );
    for (const mutate of [
      (e) => (e.data.metadata.version = 2),
      (e) => (e.data.metadata.destroyed = true),
      (e) => (e.data.data = { ...stored, peerId: randomUUID() }),
      (e) => (e.data.data = { ...stored, purposes: 42 }),
      (e) => (e.data.data = { ...stored, unknown: 'forbidden' }),
    ]) {
      mutation = mutate;
      await assert.rejects(
        provider.verify(b),
        (e) => e.code === 'material_invalid',
      );
    }
    mutation = null;
    assert.equal(await provider.renew(), 3600);
    lease = 30;
    await assert.rejects(
      provider.renew(),
      (e) => e.code === 'token_reprovision_required',
    );
    const endpointProvider = new OpenBaoEndpointProvider({
      endpoint: `https://127.0.0.1:${server.address().port}`,
      caFile: join(dir, 'cert.pem'),
      tokenFile,
      installationId: installation,
    });
    lease = 3600;
    await endpointProvider.renew();
    for (const scenario of [
      { status: 500, body: { errors: ['past the max TTL, cannot renew'] } },
      { status: 403, body: {} },
      { status: 200, body: {} },
      ...[null, 0, 30, 3601, 1.5, '3600'].map((lease_duration) => ({
        status: 200,
        body: { auth: { lease_duration, renewable: true } },
      })),
      {
        status: 200,
        body: { auth: { lease_duration: 3600, renewable: false } },
      },
    ]) {
      renewStatus = scenario.status;
      renewBody = scenario.body;
      await assert.rejects(provider.renew(), (e) =>
        [
          'provider_unavailable',
          'access_denied',
          'token_reprovision_required',
        ].includes(e.code),
      );
      await assert.rejects(endpointProvider.renew(), (e) =>
        ['provider_unavailable', 'provider_access_denied'].includes(e.code),
      );
    }
    renewStatus = 200;
    renewBody = undefined;
    loseRenewal = true;
    await assert.rejects(
      provider.renew(),
      (e) => e.code === 'provider_unavailable',
    );
    await assert.rejects(
      endpointProvider.renew(),
      (e) => e.code === 'provider_unavailable',
    );
    loseRenewal = false;
    stored = null;
    loseAck = true;
    const writesBeforeLoss = writes;
    await assert.rejects(
      provider.import(b, material),
      (e) => e.code === 'provider_unavailable',
    );
    await provider.import(b, material);
    assert.equal(writes, writesBeforeLoss + 1);
    assert.equal(await provider.verify(b), 'verified');
    const before = paths.length;
    await assert.rejects(
      provider.verify({ ...b, installationId: otherInstallation }),
      (e) => e.code === 'material_invalid',
    );
    assert.equal(paths.length, before);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('manual recovery refuses to run without the separate staged confirmation', () => {
  let failed = false;
  try {
    execFileSync(
      process.execPath,
      ['scripts/openbao/recover-custodian.mjs', randomUUID()],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  } catch (error) {
    failed = true;
    assert.ok(error.stderr.includes('recovery_incomplete_do_not_resume'));
    assert.ok(
      !error.stderr.includes('seal.json') && !error.stderr.includes('Error:'),
    );
  }
  assert.equal(failed, true);
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ['scripts/openbao/finish-recovery.mjs', randomUUID()],
      { stdio: 'pipe' },
    ),
  );
});

test('recovery config preparation never changes the protected normal config or overwrites a file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trunk-recovery-config-'));
  const normal = readFileSync('infra/openbao/server.hcl', 'utf8');
  const destination = join(directory, 'review.hcl');
  try {
    execFileSync(
      process.execPath,
      ['scripts/openbao/prepare-recovery-config.mjs', destination],
      { stdio: 'pipe' },
    );
    const prepared = readFileSync(destination, 'utf8');
    assert.equal(
      prepared.replace(
        'disable_unauthed_generate_root_endpoints = false',
        'disable_unauthed_generate_root_endpoints = true',
      ),
      normal,
    );
    assert.equal(readFileSync('infra/openbao/server.hcl', 'utf8'), normal);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ['scripts/openbao/prepare-recovery-config.mjs', destination],
        { stdio: 'pipe' },
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('recovery deadline bounds and exclusive container ownership fail closed', () => {
  const now = Date.now();
  assert.equal(
    recoveryDeadline(new Date(now + 900000).toISOString(), now),
    now + 900000,
  );
  for (const value of [
    'invalid',
    new Date(now - 1).toISOString(),
    new Date(now + 29999).toISOString(),
    new Date(now + 900001).toISOString(),
  ])
    assert.throws(() => recoveryDeadline(value, now));
  assert.deepEqual(recoveryContainerIds(''), []);
  const id = 'a'.repeat(64);
  assert.deepEqual(recoveryContainerIds(id + '\n'), [id]);
  for (const value of ['name', 'a'.repeat(12), id + '\n' + 'b'.repeat(64)])
    assert.throws(() => recoveryContainerIds(value));
});
