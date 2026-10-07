import { Pool } from 'pg';
import type { BackendConfig } from '@myims/config';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { CredentialActions } from '../../application/credential-actions';
import { CredentialActionRepository } from './credential-actions';
import { CredentialTenancyRepository } from '../../../tenancy/adapters/db/credential-tenancy';
import { CredentialProvenanceRepository } from '../../../platform/adapters/db/credential-provenance';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { RedisCredentialBudgets } from '../redis/credential-budgets';
export class CredentialRuntime {
  readonly service: CredentialActions;
  private readonly pool: Pool;
  private readonly database: SnapshotDatabase;
  private readonly budgets: RedisCredentialBudgets;
  constructor(config: BackendConfig) {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 4,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      lock_timeout: 2000,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('connect', (client) => client.on('error', () => {}));
    this.pool.on('error', () => {});
    this.database = new SnapshotDatabase(config.database.url);
    this.budgets = new RedisCredentialBudgets(
      config.sessionRedis.url,
      config.sessions,
    );
    this.service = new CredentialActions(
      {
        run: (context, action) =>
          Transaction.run(
            this.pool,
            context,
            'identity.credential-action',
            new SafeLogger('http'),
            action,
          ),
      },
      new CredentialActionRepository(
        new CredentialTenancyRepository(),
        new CredentialProvenanceRepository(),
        new PlatformAuthorityRepository(this.database),
      ),
      this.budgets,
    );
  }
  async onApplicationShutdown() {
    this.budgets.close();
    await Promise.all([this.pool.end(), this.database.close()]);
  }
}
