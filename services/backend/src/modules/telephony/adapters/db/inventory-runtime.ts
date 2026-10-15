import { Pool } from 'pg';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { ExtensionInventory } from '../../application/extension-inventory';
import { InventoryRepository } from './inventory-repository';
export class InventoryRuntime {
  readonly service: ExtensionInventory;
  private readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  constructor(
    url: string,
    authority: TransactionAuthority,
    logger = new SafeLogger('http'),
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      lock_timeout: 2000,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('connect', (client) => client.on('error', () => {}));
    this.pool.on('error', () => {});
    this.database = new SnapshotDatabase(url);
    this.service = new ExtensionInventory(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.inventory',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      new InventoryRepository(),
      new AuditRepository(),
    );
  }
  async onApplicationShutdown() {
    await Promise.all([this.pool.end(), this.database.close()]);
  }
}
