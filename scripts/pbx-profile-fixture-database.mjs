// Owned isolated copy only. Never mutate the ordinary database in this coordinator.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const [action, name, nodeId] = process.argv.slice(2);
if (
  !['create', 'initialize', 'cleanup', 'state', 'bump-version'].includes(
    action,
  ) ||
  !/^myims_session_[a-f0-9]{12}$/.test(name ?? '')
)
  throw new Error('Owned profile fixture database required');
const url = new URL(process.env.MIGRATION_DATABASE_URL);
url.password = readFileSync(
  process.env.MIGRATION_DATABASE_PASSWORD_FILE,
  'utf8',
).trim();
if (action !== 'create' && action !== 'cleanup') url.pathname = '/' + name;
const client = new Client({
  connectionString: url.href,
  connectionTimeoutMillis: 3000,
});
await client.connect();
try {
  if (action === 'create') await client.query(`CREATE DATABASE "${name}"`);
  else if (action === 'cleanup') {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS "${name}"`);
  } else if (action === 'initialize') {
    if (!/^[a-f0-9-]{36}$/.test(nodeId ?? ''))
      throw new Error('Exact copied node required');
    const present = (
      await client.query(
        "SELECT to_regclass('public.pbx_profile_operations') AS table",
      )
    ).rows[0].table;
    if (!present)
      await client.query(
        readFileSync(
          new URL(
            '../infra/database/migrations/20261107000000_pbx_static_profile_transitions/migration.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
    await client.query(
      "UPDATE public.pbx_ownership SET incarnation=NULL,expires_at='-infinity' WHERE node_id=$1",
      [nodeId],
    );
  } else if (action === 'bump-version') {
    const row = (
      await client.query(
        'UPDATE public.pbx_nodes SET version=version+1 WHERE id=$1 RETURNING version',
        [nodeId],
      )
    ).rows[0];
    if (!row) throw new Error('Copied node unavailable');
    console.log(JSON.stringify({ nodeVersion: row.version }));
  } else {
    const row = (
      await client.query(
        `SELECT r.runtime_state,r.installed_id,r.verified_id,r.known_good_id,r.active_operation_id,r.active_retirement_id,r.active_profile_operation_id,r.boundary_epoch::text,r.routing_generation,n.version AS node_version,o.epoch::text AS canonical_epoch,(o.expires_at>clock_timestamp() AND o.desired_version=n.version) AS owner_current,r.executor_seen_at>clock_timestamp()-interval '15 seconds' AS executor_current,(SELECT count(*)::int FROM public.audit_events a WHERE a.event_type='telephony.profile.transition' AND a.metadata->>'nodeId'=r.node_id::text AND a.metadata->>'action'='restart_dispatched') AS profile_dispatches FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id JOIN public.pbx_nodes n ON n.id=r.node_id WHERE r.node_id=$1`,
        [nodeId],
      )
    ).rows[0];
    console.log(JSON.stringify(row));
  }
} finally {
  await client.end();
}
