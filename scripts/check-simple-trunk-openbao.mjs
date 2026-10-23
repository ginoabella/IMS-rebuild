// Explicitly invoked trusted acceptance against retained OpenBao and PostgreSQL.
// Own synthetic keys are retained; no endpoint, PBX or backup operations occur.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import {
  createReadStream,
  mkdtempSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = backend('pg');
const { loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { SimpleTrunkProvider } = backend(
  './dist/modules/telephony/adapters/credentials/simple-trunk-provider.js',
);
const installationId = process.argv[2];
assert.match(
  installationId ?? '',
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,
);
const dir = mkdtempSync(join(tmpdir(), 'trunk-openbao-'));
const credentialId =
    process.env.MYIMS_TRUNK_FIXTURE_CREDENTIAL_ID || randomUUID(),
  operationId = randomUUID();
const config = {
  installationId,
  credentialId,
  operationId,
  label: `Owned acceptance ${credentialId.slice(0, 8)}`,
  expectedVersion: 0,
  endpoint: 'https://endpoint-secrets:8200',
  caFile: '/trust/ca.crt',
  tokenFile: `/setup/setup-${installationId}.token`,
};
const first = {
  username: 'owned-acceptance',
  password: `OWNED_FIRST_${randomUUID()}`,
  realm: 'synthetic.invalid',
};
const second = { ...first, password: `OWNED_REPLACEMENT_${randomUUID()}` };
const sentinels = [first.password, second.password];
const db = new Client({ connectionString: loadMigrationConfig().adminUrl });
db.on('error', () => {});
await db.connect();
const bao = new SimpleTrunkProvider(
  config.endpoint,
  config.caFile,
  config.tokenFile,
);
const path = `myims-trunk/data/installations/${installationId}/bindings/${credentialId}/generations/${credentialId}`;
const preload = join(dir, 'lose-response.cjs');
writeFileSync(
  preload,
  `
const https=require('node:https');
const original=https.request;
https.request=function(url,options,callback) {
  const req=original.call(this,url,options,(res)=>{
    if(options.method==='POST' && String(url).includes('/data/') && res.statusCode===200) {
      process.stderr.write('OWNED_WRITE_RESPONSE_DROPPED\\n');
      req.destroy(new Error('Owned response loss'));
    } else callback(res);
  });
  return req;
};
`,
  { mode: 0o600 },
);
async function run(overrides = {}, material = first, fault = false) {
  const cfg = join(dir, 'config'),
    input = join(dir, 'material');
  writeFileSync(cfg, JSON.stringify({ ...config, ...overrides }), {
    mode: 0o600,
  });
  writeFileSync(input, JSON.stringify(material), { mode: 0o600 });
  const child = spawn(
    process.execPath,
    [
      ...(fault ? ['--require', preload] : []),
      'services/backend/dist/entrypoints/deployment/main.js',
      'trunk-credentials',
      cfg,
      input,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (output += b));
  const [code] = await once(child, 'exit');
  for (const secret of sentinels)
    assert.ok(!output.includes(secret), 'command output excludes material');
  return { code, output };
}
async function versions() {
  return (
    await db.query(
      'SELECT material_version FROM public.sip_credential_versions WHERE credential_id=$1 ORDER BY material_version',
      [credentialId],
    )
  ).rows.map((r) => r.material_version);
}
let verified = false;
try {
  const ttl = await bao.lifetime();
  assert.ok(ttl >= 3600 && ttl <= 86400);
  const missing = await run({ tokenFile: join(dir, 'missing') });
  assert.equal(missing.code, 1);
  const deniedFile = join(dir, 'denied');
  writeFileSync(deniedFile, 'invalid-owned-token-0123456789', { mode: 0o600 });
  const denied = await run({ tokenFile: deniedFile });
  assert.equal(denied.code, 1);
  assert.match(denied.output, /expired|denied/i);
  const expired = await run({ tokenFile: '/expired/issuer.token' });
  assert.equal(expired.code, 1);
  assert.match(expired.output, /expired|denied/i);
  const unavailable = await run({ endpoint: 'https://127.0.0.1:1' });
  assert.equal(unavailable.code, 1);
  assert.match(unavailable.output, /unavailable/i);
  assert.deepEqual(await versions(), []);
  const lost = await run({}, first, true);
  assert.equal(lost.code, 1);
  assert.match(lost.output, /OWNED_WRITE_RESPONSE_DROPPED/);
  assert.deepEqual(
    await versions(),
    [],
    'stored but unconfirmed write must not become selectable',
  );
  assert.equal((await bao.call(path)).value.data.metadata.version, 1);
  const competing = await run({ operationId: randomUUID() });
  assert.equal(competing.code, 1);
  assert.match(competing.output, /uncertain import/);
  const confirmed = await run();
  assert.equal(confirmed.code, 0, confirmed.output);
  assert.equal(JSON.parse(confirmed.output).version, 1);
  assert.deepEqual(await versions(), [1]);
  const replacement = { expectedVersion: 1, operationId: randomUUID() };
  const replaced = await run(replacement, second);
  assert.equal(replaced.code, 0, replaced.output);
  assert.equal(JSON.parse(replaced.output).version, 2);
  const retry = await run();
  assert.equal(retry.code, 0, retry.output);
  assert.equal(JSON.parse(retry.output).version, 1);
  assert.deepEqual(await versions(), [1, 2]);
  for (const [version, material] of [
    [1, first],
    [2, second],
  ]) {
    const stored = await bao.call(`${path}?version=${version}`);
    assert.equal(stored.value.data.metadata.version, version);
    assert.ok(
      stored.value.data.data.password === material.password,
      'exact retained material matches',
    );
  }
  const safe = await db.query(
    'SELECT row_to_json(c) AS metadata FROM public.sip_credentials c WHERE id=$1',
    [credentialId],
  );
  for (const secret of sentinels)
    assert.ok(!JSON.stringify(safe.rows).includes(secret));
  const auditFiles = readdirSync('/provider-audit', {
    withFileTypes: true,
  }).filter((f) => f.isFile());
  assert.ok(auditFiles.length > 0, 'real provider audit must be present');
  for (const file of auditFiles) {
    let tail = '';
    for await (const bytes of createReadStream(
      `/provider-audit/${file.name}`,
    )) {
      const value = tail + bytes.toString('utf8');
      for (const secret of sentinels)
        assert.ok(
          !value.includes(secret),
          'provider audit excludes material sentinel',
        );
      tail = value.slice(-256);
    }
  }
  for (const table of ['audit_events', 'sip_peer_receipts']) {
    const rows = await db.query(`SELECT row_to_json(t) FROM public.${table} t`);
    for (const secret of sentinels)
      assert.ok(
        !JSON.stringify(rows.rows).includes(secret),
        'ordinary audit/receipts exclude material',
      );
  }
  verified = true;
  console.log(
    JSON.stringify({
      state: 'real_openbao_acceptance_passed',
      installationId,
      credentialId,
      label: config.label,
      versions: [1, 2],
      actualTokenRemainingSeconds: ttl,
      responseLossReconciled: true,
      competingWriteFenced: true,
      oldVersionRetained: true,
      missingDeniedUnavailableRecoverable: true,
    }),
  );
} finally {
  await db.query('SELECT pg_notify($1,$2)', [
    'myims_trunk_fixture',
    `${verified ? 'ready' : 'failed'}:${credentialId}`,
  ]);
  await db.end();
  rmSync(dir, { recursive: true, force: true });
}
