// Designated endpoint credential boundary only. No listener/native/SIP access.
import { createRequire } from 'node:module';
const load = createRequire('/workspace/services/backend/package.json');
const { Pool } = load('pg');
const { resolveConnection } = load('./dist/infrastructure/configuration.js');
const { parseDatabaseConfig } = load('@myims/config');
const { credentialWorkerRuntime } = load(
  './dist/modules/telephony/adapters/credentials/worker-runtime.js',
);
const requestId = process.argv[2],
  installation = process.env.ENDPOINT_PROVIDER_INSTALLATION_ID;
if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId ?? ''))
  throw new Error('Exact preparation required');
const url = resolveConnection(parseDatabaseConfig(process.env), 'DATABASE');
const pool = new Pool({
  connectionString: url,
  max: 2,
  statement_timeout: 5000,
});
let runtime;
try {
  const operations = (
    await pool.query(
      `SELECT o.id,o.work_id FROM public.tenant_call_preparations p JOIN public.tenant_call_preparation_steps s ON s.preparation_id=p.id AND s.step IN ('credential-0','credential-1','credential-2') AND s.phase='outcome' JOIN public.endpoint_credential_operations o ON o.id=(s.result->>'operationId')::uuid AND o.node_id=p.node_id AND o.installation_id=p.installation_id AND o.operator_id=p.operator_id AND o.authentication_version=p.authentication_version WHERE p.id=$1 AND p.installation_id=$2 ORDER BY o.created_at`,
      [requestId, installation],
    )
  ).rows;
  if (!operations.length || operations.length > 3)
    throw new Error('Exact prepared operations unavailable');
  runtime = credentialWorkerRuntime(url, pool);
  for (const operation of operations) {
    if (!operation.work_id)
      throw new Error('Committed credential work unavailable');
    await runtime.execute(operation.id, operation.work_id, 1);
    const row = (
      await pool.query(
        'SELECT state FROM public.endpoint_credential_operations WHERE id=$1',
        [operation.id],
      )
    ).rows[0];
    if (row?.state === 'associated') await runtime.handler.verify(operation.id);
  }
  const results = (
    await pool.query(
      'SELECT id,state,material_health FROM public.endpoint_credential_operations WHERE id=ANY($1::uuid[])',
      [operations.map((o) => o.id)],
    )
  ).rows;
  console.log(JSON.stringify({ requestId, results }));
  if (
    results.some(
      (r) => r.state !== 'associated' || r.material_health !== 'verified',
    )
  )
    process.exitCode = 2;
} catch {
  console.error(
    'Exact preparation credentials blocked; inspect canonical operation and protected access before reconciliation.',
  );
  process.exitCode = 2;
} finally {
  await runtime?.close();
  await pool.end();
}
