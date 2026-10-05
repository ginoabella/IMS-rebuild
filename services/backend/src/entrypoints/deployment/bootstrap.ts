import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadMigrationConfig } from '../../infrastructure/configuration';
import {
  bootstrapOperator,
  BootstrapUncertain,
} from '../../modules/platform/application/bootstrap-operator';
import { BootstrapConflict } from '../../modules/platform/adapters/db/bootstrap-repository';
import { PasswordInputError } from '../../infrastructure/password/scrypt';
import { readBootstrapInput } from './bootstrap-input';
export async function bootstrap(args: string[]): Promise<void> {
  const correlationId = randomUUID();
  let pool: Pool | undefined;
  let password: Buffer | undefined;
  try {
    const { adminUrl, runtimeUrl } = loadMigrationConfig();
    const admin = new URL(adminUrl);
    const runtime = new URL(runtimeUrl);
    if (
      admin.hostname !== runtime.hostname ||
      (admin.port || '5432') !== (runtime.port || '5432') ||
      admin.pathname !== runtime.pathname ||
      decodeURIComponent(runtime.username) !== 'myims_runtime' ||
      decodeURIComponent(admin.username) === 'myims_runtime'
    )
      throw new Error('Invalid bootstrap deployment settings');
    pool = new Pool({
      connectionString: adminUrl,
      max: 1,
      connectionTimeoutMillis: 2000,
      statement_timeout: 15000,
      query_timeout: 17000,
      application_name: 'myims-bootstrap-operator',
    });
    pool.on('connect', (client) => client.on('error', () => {}));
    pool.on('error', () => {});
    // Verify the required schema and actual authority before reading/hash processing.
    const schema = await pool.query(`SELECT
      has_table_privilege(current_user,'public.platform_operators','INSERT') AS operator_write,
      has_table_privilege(current_user,'public.operator_bootstrap_provenance','INSERT') AS provenance_write,
      EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='20261005010000_canonical_authority' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrated`);
    if (
      !schema.rows[0]?.operator_write ||
      !schema.rows[0]?.provenance_write ||
      !schema.rows[0]?.migrated
    )
      throw new Error('Bootstrap schema or privileges unavailable');
    await pool.query(
      'SELECT id,status,credential_state,password_hash,credential_changed_at,version,authentication_version FROM public.platform_operators LIMIT 0',
    );
    const value = await readBootstrapInput(args);
    password = value.password;
    const state = await bootstrapOperator(
      pool,
      value.username,
      password,
      correlationId,
    );
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        command: 'bootstrap-operator',
        state,
        correlationId,
      }),
    );
  } catch (error) {
    const state =
      error instanceof PasswordInputError
        ? 'invalid-input'
        : error instanceof BootstrapConflict
          ? 'conflict'
          : error instanceof BootstrapUncertain
            ? 'uncertain'
            : 'failed';
    console.error(
      JSON.stringify({
        entrypoint: 'deployment',
        command: 'bootstrap-operator',
        state,
        correlationId,
      }),
    );
    process.exitCode = 1;
  } finally {
    password?.fill(0);
    await pool?.end();
  }
}
