// Deployment read-only preservation fingerprints; row contents never leave memory.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const { loadMigrationConfig } = load('./dist/infrastructure/configuration.js');
const mode = process.argv[2];
assert.ok(['before', 'after'].includes(mode) && process.argv.length === 3);
const client = new Client({ connectionString: loadMigrationConfig().adminUrl });
client.on('error', () => {});
const tables = [
  'tenants',
  'staff_users',
  'platform_operators',
  'extensions',
  'endpoint_profiles',
  'endpoint_profile_versions',
  'sip_trunks',
  'sip_gateways',
  'sip_dids',
  'ring_groups',
  'inbound_rules',
  'outbound_rules',
  'tenant_inventory_claims',
  'tenant_route_authorizations',
  'pbx_revisions',
  'pbx_live_artifacts',
  'pbx_live_pins',
];
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const result = {};
  for (const table of tables) {
    const rows = (
      await client.query(
        `SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::text`,
      )
    ).rows.map((r) => r.row);
    // The migration adds a nullable native receipt column without changing pin facts.
    if (table === 'pbx_live_pins')
      for (const row of rows) delete row.release_retirement_id;
    result[table] = {
      count: rows.length,
      sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    };
  }
  await client.query('COMMIT');
  const path = '.local/p4-u2c/preservation-before.json';
  if (mode === 'before') {
    mkdirSync('.local/p4-u2c', { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(result), { flag: 'wx', mode: 0o600 });
  } else assert.deepEqual(result, JSON.parse(readFileSync(path, 'utf8')));
  console.log(
    JSON.stringify({
      check: 'tenant-routing-ordinary-preservation',
      mode,
      state: 'passed',
      tables: result,
    }),
  );
} finally {
  await client.end();
}
