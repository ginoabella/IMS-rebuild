import { Pool } from 'pg';
import { loadMigrationConfig } from '../../infrastructure/configuration';
import { CredentialMaintenance } from '../../modules/telephony/adapters/credentials/maintenance';
import {
  OpenBaoEndpointProvider,
  openBaoSettings,
} from '../../modules/telephony/adapters/credentials/openbao';
import { credentialWorkerRuntime } from '../../modules/telephony/adapters/credentials/worker-runtime';
export async function maintainEndpointCredentials(args: string[]) {
  const [action, installation, ...ids] = args;
  if (
    !installation ||
    !['cleanup', 'cleanup-retry', 'requeue', 'verify'].includes(action ?? '')
  )
    throw new Error('Explicit maintenance scope required');
  const pool = new Pool({
    connectionString: loadMigrationConfig().runtimeUrl,
    max: 2,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
  pool.on('connect', (client) => client.on('error', () => {}));
  pool.on('error', () => {});
  try {
    if (action === 'verify') {
      const runtime = credentialWorkerRuntime(
        loadMigrationConfig().runtimeUrl,
        pool,
      );
      try {
        for (const id of ids) {
          const r = await pool.query(
            'SELECT id FROM public.endpoint_credential_operations WHERE id=$1 AND installation_id=$2',
            [id, installation],
          );
          if (!r.rows.length) throw new Error('Invalid verification target');
          await runtime.handler.verify(id);
        }
      } finally {
        await runtime.close();
      }
    } else {
      const provider =
        action === 'cleanup'
          ? new OpenBaoEndpointProvider(openBaoSettings(process.env))
          : undefined;
      // b exposes no associated generation to any revision consumer. Maintenance
      // independently proves never-association in canonical history before this port.
      const maintenance = new CredentialMaintenance(pool, provider, {
        neverAssociatedMayDestroy: async () => true,
      });
      const results = await maintenance.run(
        action as 'cleanup' | 'requeue' | 'cleanup-retry',
        installation,
        ids,
      );
      console.log(JSON.stringify({ entrypoint: 'deployment', results }));
    }
  } finally {
    await pool.end();
  }
}
