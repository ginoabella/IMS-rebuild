import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Pool } = backend('pg');
const { parseDatabaseConfig } = backend('@myims/config');
const { resolveConnection } = backend('./dist/infrastructure/configuration.js');
const pool = new Pool({
  connectionString: resolveConnection(
    parseDatabaseConfig(process.env),
    'DATABASE',
  ),
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
});
try {
  const [outbox, queue, results] = await Promise.all([
    pool.query(
      'SELECT handoff_status,count(*)::int count FROM public.outbox_work GROUP BY handoff_status',
    ),
    pool.query(
      'SELECT state,count(*)::int count FROM pgboss.job GROUP BY state',
    ),
    pool.query(
      'SELECT outcome,failure_code,count(*)::int count FROM public.work_results GROUP BY outcome,failure_code',
    ),
  ]);
  console.log(
    JSON.stringify({
      outbox: outbox.rows,
      queue: queue.rows,
      results: results.rows,
    }),
  );
} catch {
  console.error('Worker status unavailable');
  process.exitCode = 1;
} finally {
  await pool.end();
}
