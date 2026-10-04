import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { ConfigurationError } from '@myims/config';
import { loadMigrationConfig } from '../configuration';
const execute = promisify(execFile);
const DEPLOYMENT_LOCK = 846258113;
export class DeploymentError extends Error {}
function failure(error: unknown, operation: string): DeploymentError {
  let code = '';
  if (
    error instanceof Error &&
    'stderr' in error &&
    typeof error.stderr === 'string'
  )
    code = error.stderr.match(/\bP\d{4}\b/)?.[0] ?? '';
  if (
    !code &&
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9]{5}$/.test(error.code)
  )
    code = error.code;
  return new DeploymentError(
    `${operation} failed${code ? ` (${code})` : ''}; verify database access and migration history`,
  );
}
export async function migrate() {
  const { adminUrl, runtimeUrl } = loadMigrationConfig();
  const runtime = new URL(runtimeUrl);
  const admin = new URL(adminUrl);
  if (
    admin.hostname !== runtime.hostname ||
    (admin.port || '5432') !== (runtime.port || '5432') ||
    admin.pathname !== runtime.pathname
  )
    throw new ConfigurationError(
      'Runtime and migration database URLs must target the same database',
    );
  if (decodeURIComponent(runtime.username) !== 'myims_runtime')
    throw new ConfigurationError(
      'DATABASE_URL must use the myims_runtime application role',
    );
  const client = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 2000,
    statement_timeout: 10000,
    query_timeout: 12000,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    // Serialize the full deployment, including cluster-wide runtime credential provisioning.
    // Session locks are released by PostgreSQL if this trusted process loses its connection.
    const deadline = Date.now() + 20000;
    while (true) {
      const result = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [DEPLOYMENT_LOCK],
      );
      if (result.rows[0]?.locked) break;
      if (Date.now() >= deadline)
        throw new DeploymentError(
          'Another deployment holds the migration lock; retry after it finishes',
        );
      await delay(100);
    }
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: adminUrl };
    delete env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK;
    try {
      await execute(
        process.execPath,
        [
          require.resolve('prisma/build/index.js'),
          'migrate',
          'deploy',
          '--config',
          resolve(__dirname, '../../../prisma.config.ts'),
        ],
        { env, timeout: 60000, maxBuffer: 1024 * 1024 },
      );
    } catch (error) {
      throw failure(error, 'Baseline migration');
    }
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('myims.runtime_password', $1, true)",
      [decodeURIComponent(runtime.password)],
    );
    await client.query(
      `DO $block$ BEGIN EXECUTE format('ALTER ROLE myims_runtime PASSWORD %L', current_setting('myims.runtime_password')); END $block$;`,
    );
    await client.query('COMMIT');
  } catch (error) {
    if (error instanceof DeploymentError) throw error;
    throw failure(error, 'Deployment/runtime credential provisioning');
  } finally {
    await client.end();
  }
}
