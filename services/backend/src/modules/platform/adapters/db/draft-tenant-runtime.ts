import { Pool } from 'pg';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import { FirstAdministratorRepository } from '../../../identity/adapters/db/first-administrator';
import { TenantRepository } from '../../../tenancy/adapters/db/tenant-repository';
import { DraftTenants } from '../../application/draft-tenants';
import { DraftCreationReceiptRepository } from './draft-creation-receipts';
export class DraftTenantRuntime {
  readonly service: DraftTenants;
  private readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  constructor(url: string, authority: TransactionAuthority) {
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
    this.service = new DraftTenants(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'platform.draft-tenant',
            new SafeLogger('http'),
            action,
          ),
      },
      this.database,
      authority,
      new TenantRepository(),
      new FirstAdministratorRepository(),
      new DraftCreationReceiptRepository(),
    );
  }
  async onApplicationShutdown() {
    await Promise.all([this.pool.end(), this.database.close()]);
  }
}
