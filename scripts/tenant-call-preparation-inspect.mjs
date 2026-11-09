// Trusted passive deployment inventory. No setup, provider, native or call path.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function inspectionTarget(args) {
  if (args.length !== 2 || args.some((v) => !uuid.test(v)))
    throw new Error('Exact node and installation UUIDs required');
  return { nodeId: args[0], installationId: args[1] };
}

/** One bounded primary snapshot; READ ONLY is enforced by PostgreSQL. */
export async function inspectPreparation(client, target) {
  inspectionTarget([target.nodeId, target.installationId]);
  const report = {
    mode: 'inspect',
    observedAt: new Date().toISOString(),
    ...target,
    effectAuthorization: false,
    materialVerified: false,
    dispatchAvailability: 'unestablished',
    blockers: [],
  };
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const node = (
      await client.query(
        'SELECT id,installation_id,version FROM public.pbx_nodes WHERE id=$1 AND installation_id=$2',
        [target.nodeId, target.installationId],
      )
    ).rows[0];
    if (!node) {
      report.blockers.push('wrong_target');
    } else {
      report.nodeVersion = node.version;
      const bounded = async (name, sql, params = [target.nodeId]) => {
        const rows = (await client.query(sql + ' LIMIT 257', params)).rows;
        if (rows.length > 256) {
          report.blockers.push('inventory_limit');
          // An incomplete inventory must never appear usable for planning.
          throw new Error('Inventory exceeds inspection limit');
        }
        report[name] = rows;
      };
      await bounded(
        'tenants',
        `SELECT id,status,version,authority_version,voice_preference FROM public.tenants ORDER BY id`,
        [],
      );
      await bounded(
        'claims',
        `SELECT id,tenant_id,extension_id,state,version FROM public.tenant_inventory_claims WHERE node_id=$1 ORDER BY id`,
      );
      await bounded(
        'extensions',
        `SELECT e.id,e.number,e.kind,e.version,e.administrative_status,e.profile_id,e.profile_version,e.credential_generation_id,c.id AS credential_operation_id,c.state AS credential_state,c.material_health,c.verified_at FROM public.extensions e LEFT JOIN public.endpoint_credential_operations c ON c.extension_id=e.id AND c.generation_id=e.credential_generation_id WHERE e.node_id=$1 ORDER BY e.id`,
      );
      await bounded(
        'profiles',
        `SELECT id,kind,head_version FROM public.endpoint_profiles WHERE node_id=$1 ORDER BY id`,
      );
      await bounded(
        'authorizations',
        `SELECT id,tenant_id,kind,resource_id,scope,state,version FROM public.tenant_route_authorizations WHERE node_id=$1 ORDER BY id`,
      );
      await bounded(
        'cases',
        `SELECT id,tenant_id,direction,route_id,source_id,expected_destination_id,expected_outcome,readiness_required,test_kind,enabled FROM public.tenant_route_test_cases WHERE node_id=$1 ORDER BY id`,
      );
      await bounded(
        'trunks',
        `SELECT id,version,enabled,(settings->>'host'='127.0.0.4' AND (settings->>'port')::integer BETWEEN 20000 AND 20100) AS uses_controlled_sink,(CASE WHEN settings->>'host'='127.0.0.4' THEN (settings->>'port')::integer ELSE NULL END) AS controlled_sink_port FROM public.sip_trunks WHERE node_id=$1 AND removed_at IS NULL ORDER BY id`,
      );
      await bounded(
        'gateways',
        `SELECT g.id,g.version,g.enabled,EXISTS(SELECT 1 FROM public.sip_gateway_sources s WHERE s.gateway_id=g.id AND s.removed_at IS NULL AND s.address IN ('127.0.0.2'::inet,'127.0.0.3'::inet,'127.0.0.4'::inet)) AS uses_controlled_source FROM public.sip_gateways g WHERE g.node_id=$1 AND g.removed_at IS NULL ORDER BY g.id`,
      );
      await bounded(
        'work',
        `SELECT intent_id,state FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') ORDER BY intent_id`,
      );
      await bounded(
        'runtime',
        `SELECT installed_id,verified_id,known_good_id,runtime_state,boundary_epoch::text,routing_generation,active_operation_id,active_retirement_id,active_profile_operation_id FROM public.pbx_live_runtime WHERE node_id=$1`,
      );
      if (report.gateways.some((g) => g.uses_controlled_source))
        report.blockers.push('controlled_source_in_use');
      if (report.work.length) report.blockers.push('unresolved_test_work');
    }
    await client.query('COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let client;
  try {
    const target = inspectionTarget(process.argv.slice(2));
    const load = createRequire(
      new URL('../services/backend/package.json', import.meta.url),
    );
    const { Client } = load('pg');
    const { loadMigrationConfig } = load(
      './dist/infrastructure/configuration.js',
    );
    client = new Client({
      connectionString: loadMigrationConfig().runtimeUrl,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: 15000,
    });
    client.on('error', () => {});
    await client.connect();
    const report = await inspectPreparation(client, target);
    console.log(JSON.stringify(report, null, 2));
    if (report.blockers.includes('wrong_target')) process.exitCode = 2;
  } catch {
    // Never expose driver errors, environment, SQL, labels or secret material.
    console.error(
      'Preparation inspection unavailable; use exact node and installation UUIDs with the built Docker workspace.',
    );
    process.exitCode = 2;
  } finally {
    await client?.end();
  }
}
