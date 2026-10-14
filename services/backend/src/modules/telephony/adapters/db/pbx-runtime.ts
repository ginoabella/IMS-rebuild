import { Pool } from 'pg';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { PbxNodes } from '../../application/pbx-nodes';
import {
  ObservationNotInstalled,
  type PbxDesiredChangePort,
} from '../../application/pbx-ports';
import { FilePbxCatalog } from '../connectivity/catalog';
import { PbxRepository } from './pbx-repository';
import { PbxReceiptRepository } from './pbx-receipts';
export class PbxRuntime {
  readonly service: PbxNodes;
  private readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  constructor(
    url: string,
    authority: TransactionAuthority,
    catalogFile?: string,
    changes: PbxDesiredChangePort = new ObservationNotInstalled(),
    logger: SafeLogger = new SafeLogger('http'),
  ) {
    const catalog = new FilePbxCatalog(catalogFile);
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
    this.service = new PbxNodes(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.pbx-registry',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      catalog,
      new PbxRepository(),
      new PbxReceiptRepository(),
      new AuditRepository(),
      changes,
    );
  }
  async onApplicationShutdown() {
    await Promise.all([this.pool.end(), this.database.close()]);
  }
}
