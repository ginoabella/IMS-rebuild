import { PbxLive } from '../../application/pbx-live';
import { PbxRevisions } from '../../application/pbx-revisions';
import { Routing } from '../../application/routing';
import { RoutingRepository } from './routing-repository';
import { Pool } from 'pg';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { ExtensionInventory } from '../../application/extension-inventory';
import { PeerRepository } from './peer-repository';
import { Peers } from '../../application/peers';
import { InventoryRepository } from './inventory-repository';
export class InventoryRuntime {
  readonly service: ExtensionInventory;
  readonly peers: Peers;
  readonly routing: Routing;
  readonly revisions: PbxRevisions;
  readonly live: PbxLive;
  private readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  constructor(
    url: string,
    authority: TransactionAuthority,
    logger = new SafeLogger('http'),
    reserved: (installationId: string) => readonly string[] = () => [],
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
    this.live = new PbxLive(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.live-revision',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      new AuditRepository(),
    );
    this.revisions = new PbxRevisions(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.revisions',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      new AuditRepository(),
    );
    this.routing = new Routing(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.routing',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      new RoutingRepository(),
      new AuditRepository(),
    );
    this.peers = new Peers(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'telephony.sip-peer',
            logger,
            action,
          ),
      },
      this.database,
      authority,
      new PeerRepository(),
      new AuditRepository(),
      reserved,
    );
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
