import { Pool } from 'pg';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { OutboxRepository } from '../../../../infrastructure/outbox/outbox-repository';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import type { InventoryVersionPort } from '../../application/inventory-ports';
import { EndpointCredentials } from '../../application/endpoint-credentials';
import { CredentialRepository } from './credential-repository';
export class EndpointCredentialRuntime {
  readonly service: EndpointCredentials;
  readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  constructor(
    url: string,
    authority: TransactionAuthority,
    inventory: InventoryVersionPort,
    logger = new SafeLogger('http'),
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000,
      lock_timeout: 2000,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('connect', (c) => c.on('error', () => {}));
    this.pool.on('error', () => {});
    this.database = new SnapshotDatabase(url);
    this.service = new EndpointCredentials(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'endpoint.credentials',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      inventory,
      new CredentialRepository(),
      new OutboxRepository(),
      new AuditRepository(),
    );
  }
  async onApplicationShutdown() {
    await Promise.all([this.pool.end(), this.database.close()]);
  }
}
