// Exact original-row preservation with explicitly declared additive setup effects.
// PostgreSQL computes hashes; no raw row, credential hash or material is exported.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { manifest, uuid } from './tenant-call-preparation-store.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const { loadMigrationConfig } = load('./dist/infrastructure/configuration.js');
const [mode, input, second, output] = process.argv.slice(2);
const volatile = [
  '_prisma_migrations',
  'pbx_observations',
  'pbx_ownership',
  'pbx_live_runtime',
  'tenant_runtime_proofs',
  'tenant_call_custody_proofs',
  'tenant_call_participant_instances',
];
const newTables = [
  'tenant_call_preparations',
  'tenant_call_preparation_steps',
  'tenant_call_preparation_cases',
  'tenant_call_preparation_facts',
  'tenant_call_preparation_events',
  'tenant_call_participant_instances',
  'tenant_route_case_disables',
  'tenant_call_custody_proofs',
];
let client;
try {
  if (!['before', 'after'].includes(mode) || process.argv.length !== 6)
    throw new Error();
  const before =
    mode === 'after' ? JSON.parse(readFileSync(input, 'utf8')) : null;
  const approved =
    mode === 'after'
      ? manifest(JSON.parse(readFileSync(second, 'utf8')))
      : null;
  const nodeId = before?.nodeId ?? input,
    installationId = before?.installationId ?? second;
  if (
    !uuid(nodeId) ||
    !uuid(installationId) ||
    (approved &&
      (approved.nodeId !== nodeId ||
        approved.installationId !== installationId))
  )
    throw new Error();
  client = new Client({
    connectionString: loadMigrationConfig().adminUrl,
    connectionTimeoutMillis: 2000,
    statement_timeout: 15000,
  });
  client.on('error', () => {});
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  if (
    !(
      await client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 AND installation_id=$2',
        [nodeId, installationId],
      )
    ).rows.length
  )
    throw new Error();
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename);
  const rows = {};
  for (const table of tables) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error();
    if (volatile.includes(table)) continue;
    const expression =
      table === 'endpoint_capabilities'
        ? "CASE WHEN t.installation_id=$1 THEN to_jsonb(t)-ARRAY['revision','credential_auth_max','credential_hex_max'] ELSE to_jsonb(t) END"
        : 'to_jsonb(t)';
    rows[table] = (
      await client.query(
        `SELECT encode(sha256(convert_to((${expression})::text,'UTF8')),'hex') AS hash FROM public."${table}" t ORDER BY 1 LIMIT 50001`,
        table === 'endpoint_capabilities' ? [installationId] : [],
      )
    ).rows.map((r) => r.hash);
    if (rows[table].length > 50000) throw new Error();
  }
  const capability = (
    await client.query(
      'SELECT revision,credential_auth_max,credential_hex_max FROM public.endpoint_capabilities WHERE installation_id=$1',
      [installationId],
    )
  ).rows[0];
  await client.query('COMMIT');
  const observed = {
    nodeId,
    installationId,
    observedAt: new Date().toISOString(),
    volatile,
    rows,
    capability,
  };
  if (mode === 'before') {
    writeFileSync(output, JSON.stringify(observed, null, 2), {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        state: 'preservation_captured',
        tables: Object.keys(rows).length,
        nodeId,
        installationId,
      }),
    );
  } else {
    const failures = [];
    for (const [table, hashes] of Object.entries(before.rows)) {
      const after = new Set(rows[table] ?? []);
      if (hashes.some((hash) => !after.has(hash)))
        failures.push('original_rows_changed:' + table);
    }
    for (const table of Object.keys(rows))
      if (!before.rows[table] && !newTables.includes(table))
        failures.push('unexpected_table:' + table);
    const additions = {
      tenants: 2,
      staff_users: 2,
      endpoint_profiles: 1,
      endpoint_profile_versions: 1,
      extensions: 3,
      endpoint_credential_operations: 3,
      sip_trunks: 1,
      sip_gateways: 1,
      sip_gateway_sources: 1,
      sip_dids: 2,
      inbound_rules: 2,
      outbound_rules: 2,
      tenant_inventory_claims: 2,
      tenant_inventory_history: 2,
      telephony_number_claims: 3,
      tenant_route_test_cases: 11,
      ring_groups: 0,
      ring_group_members: 0,
      number_reservations: 0,
      tenant_route_authorizations: 0,
      pbx_revisions: 0,
      pbx_live_artifacts: 0,
      pbx_live_pins: 0,
      tenant_verification_grants: 0,
      tenant_route_test_intents: 0,
      tenant_route_test_results: 0,
      sip_credentials: 0,
      sip_credential_versions: 0,
    };
    for (const [table, count] of Object.entries(additions))
      if (
        (rows[table]?.length ?? 0) - (before.rows[table]?.length ?? 0) !==
        count
      )
        failures.push('unexpected_additions:' + table);
    if (
      capability.revision !== approved.expectedCapabilityRevision ||
      capability.credential_auth_max !== 71 ||
      capability.credential_hex_max !== 64
    )
      failures.push('unexpected_capability_declaration');
    const report = {
      nodeId,
      installationId,
      requestId: approved.requestId,
      observedAt: observed.observedAt,
      state: failures.length ? 'failed' : 'passed',
      originalRowsPreserved: !failures.some((f) =>
        f.startsWith('original_rows_changed'),
      ),
      tables: Object.fromEntries(
        Object.keys(rows).map((table) => [
          table,
          {
            before: before.rows[table]?.length ?? 0,
            after: rows[table].length,
          },
        ]),
      ),
      declaredDesiredAdditions: additions,
      capability,
      excludedVolatileTables: volatile,
      failures,
    };
    writeFileSync(output, JSON.stringify(report, null, 2), {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        state: report.state,
        originalRowsPreserved: report.originalRowsPreserved,
        failures,
      }),
    );
    if (failures.length) process.exitCode = 2;
  }
} catch {
  console.error(
    'Exact preparation preservation proof unavailable; inspect before proceeding.',
  );
  process.exitCode = 2;
} finally {
  await client?.end();
}
