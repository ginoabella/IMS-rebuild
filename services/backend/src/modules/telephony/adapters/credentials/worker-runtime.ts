import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { TransactionAuthority } from '../../../identity/application/transaction-authority';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { InventoryRuntime } from '../db/inventory-runtime';
import { CredentialHandler } from '../jobs/credential-handler';
import { OpenBaoEndpointProvider, openBaoSettings } from './openbao';
import type { Pool } from 'pg';
/** Constructed only by the designated worker/deployment entry point, never HTTP. */
export function credentialWorkerRuntime(url: string, pool: Pool) {
  const database = new SnapshotDatabase(url);
  const platform = new PlatformAuthorityRepository(database);
  const authority = new TransactionAuthority(
    { lockedById: async () => ({ kind: 'denied' }) },
    platform,
  );
  const inventory = new InventoryRuntime(
    url,
    authority,
    new SafeLogger('worker'),
  );
  const settings = openBaoSettings(process.env);
  const provider = new OpenBaoEndpointProvider(settings);
  const handler = new CredentialHandler(
    pool,
    authority,
    inventory.service,
    new AuditRepository(),
    provider,
  );
  let nextRenewal = 0;
  return {
    installationId: settings.installationId,
    handler,
    provider,
    execute: (operation: string, work: string, attempt: number) =>
      handler.execute(operation, work, attempt),
    reconcileExhausted: async () => {
      if (Date.now() >= nextRenewal) {
        await provider.renew();
        nextRenewal = Date.now() + 20 * 60 * 1000;
      }
      await handler.reconcileExhausted(settings.installationId);
    },
    close: () =>
      Promise.all([database.close(), inventory.onApplicationShutdown()]),
  };
}
