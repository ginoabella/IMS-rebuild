// Real command + real isolated PostgreSQL with a TLS provider simulator.
// These fault checks do NOT establish acceptance against retained OpenBao.
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export async function checkSimpleTrunkCommand(owner, installationId) {
  const dir = mkdtempSync(join(tmpdir(), 'simple-trunk-'));
  const sentinel = `OWNED_SECRET_${randomUUID()}`;
  const credentialId = randomUUID(),
    versions = [];
  let denyWrite = false,
    deny = false,
    loseResponse = false,
    denyRead = false,
    writes = 0;
  const key = join(dir, 'key'),
    cert = join(dir, 'cert');
  const generated = spawnSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    key,
    '-out',
    cert,
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost',
  ]);
  assert.equal(generated.status, 0, 'TLS fixture certificate generation');
  const server = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    async (req, res) => {
      let body = '';
      for await (const b of req) body += b;
      const reply = (status, value = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (deny) return reply(403);
      if (req.url === '/v1/auth/token/lookup-self')
        return reply(200, { data: { ttl: 7200, policies: ['fixture-setup'] } });
      if (req.url.includes('/metadata/'))
        return reply(req.method === 'POST' ? 204 : 200, {
          data: {
            max_versions: 2147483647,
            cas_required: true,
            delete_version_after: '0s',
          },
        });
      if (req.method === 'POST') {
        if (denyWrite) return reply(403);
        const input = JSON.parse(body);
        if (input.options.cas !== versions.length) return reply(400);
        versions.push(input.data);
        writes++;
        if (loseResponse) {
          loseResponse = false;
          denyRead = true;
          req.socket.destroy();
          return;
        }
        return reply(200, { data: { version: versions.length } });
      }
      if (denyRead) return reply(503);
      const target = Number(
        new URL(req.url, 'https://localhost').searchParams.get('version') ||
          versions.length,
      );
      if (!target || !versions[target - 1]) return reply(404);
      reply(200, {
        data: {
          data: versions[target - 1],
          metadata: { version: target, destroyed: false, deletion_time: '' },
        },
      });
    },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  // Use a trusted fixture database password file, never argv or printed URLs.
  const dbUrl = new URL(process.env.MIGRATION_DATABASE_URL);
  dbUrl.pathname = `/${owner.connectionParameters.database}`;
  const config = {
    installationId,
    credentialId,
    label: 'Command fixture',
    operationId: randomUUID(),
    expectedVersion: 0,
    endpoint: `https://localhost:${server.address().port}`,
    caFile: cert,
    tokenFile: join(dir, 'token'),
  };
  writeFileSync(config.tokenFile, 'fixture-token-0123456789', { mode: 0o600 });
  const material = join(dir, 'material'),
    cfg = join(dir, 'config');
  writeFileSync(
    material,
    JSON.stringify({
      username: 'owned',
      password: sentinel,
      realm: 'synthetic.invalid',
    }),
    { mode: 0o600 },
  );
  const captured = [];
  async function run(more = {}) {
    writeFileSync(cfg, JSON.stringify({ ...config, ...more }), { mode: 0o600 });
    const child = spawn(
      process.execPath,
      [
        'services/backend/dist/entrypoints/deployment/main.js',
        'trunk-credentials',
        cfg,
        material,
      ],
      {
        env: { ...process.env, MIGRATION_DATABASE_URL: dbUrl.href },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (b) => (output += b));
    child.stderr.on('data', (b) => (output += b));
    const [code] = await once(child, 'exit');
    captured.push(output);
    assert.ok(!output.includes(sentinel));
    return { code, output };
  }
  try {
    deny = true;
    assert.equal((await run()).code, 1);
    assert.equal(
      (
        await owner.query(
          'SELECT * FROM public.sip_credential_imports WHERE credential_id=$1',
          [credentialId],
        )
      ).rows.length,
      0,
    );
    deny = false;
    denyWrite = true;
    assert.equal((await run()).code, 1);
    assert.equal(
      (
        await owner.query(
          'SELECT * FROM public.sip_credential_imports WHERE credential_id=$1',
          [credentialId],
        )
      ).rows.length,
      0,
      'definite write denial does not leave an uncertainty fence',
    );
    denyWrite = false;
    loseResponse = true;
    assert.equal((await run()).code, 1);
    assert.equal(writes, 1);
    assert.equal(
      (
        await owner.query(
          'SELECT * FROM public.sip_credential_versions WHERE credential_id=$1',
          [credentialId],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await run({ operationId: randomUUID() })).code,
      1,
      'uncertain operation blocks different writer',
    );
    denyRead = false;
    assert.equal((await run()).code, 0);
    assert.equal(writes, 1, 'response loss reconciled without another write');
    assert.equal((await run()).code, 0, 'exact retry is idempotent');
    const replacement = { operationId: randomUUID(), expectedVersion: 1 };
    assert.equal((await run(replacement)).code, 0);
    assert.equal(writes, 2);
    assert.equal(
      (await run()).code,
      0,
      'old operation reconciles its exact retained version',
    );
    assert.equal(writes, 2);
    assert.equal(
      (await run({ operationId: randomUUID() })).code,
      1,
      'stale expected version',
    );
    assert.deepEqual(
      (
        await owner.query(
          'SELECT material_version FROM public.sip_credential_versions WHERE credential_id=$1 ORDER BY material_version',
          [credentialId],
        )
      ).rows.map((r) => r.material_version),
      [1, 2],
    );
    const safe = (
      await owner.query(
        'SELECT row_to_json(c) FROM public.sip_credentials c WHERE id=$1',
        [credentialId],
      )
    ).rows;
    assert.ok(!JSON.stringify(safe).includes(sentinel));
    console.log(
      'PASS real trusted command + PostgreSQL/TLS simulator: denial recoverable, interrupted write publishes no selection, exact reconciliation, competing operation fence, replacement/idempotency/retained old versions, redacted diagnostics. Real OpenBao remains a separate gate.',
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}
