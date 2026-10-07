import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  executionContext,
  reference,
  type ExecutionContext,
} from '../execution/context';
import { SafeLogger } from '../execution/logging';
const clients = new WeakMap<Transaction, PoolClient>();
interface TransactionState {
  failed: boolean;
  active: boolean;
  scopes: number;
  children: Set<Transaction>;
}
const failures = new WeakMap<Transaction, TransactionState>();
export class Transaction {
  private constructor(readonly context: Readonly<ExecutionContext>) {}
  static async run<T>(
    pool: Pool,
    context: unknown,
    operation: string,
    logger: SafeLogger,
    action: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    executionContext(context);
    reference(operation);
    const client = await pool.connect();
    return this.execute(client, context, operation, logger, action, true);
  }
  // Reuse an adapter-owned connection while a session advisory lock spans commits.
  static async runWithClient<T>(
    client: PoolClient,
    context: unknown,
    operation: string,
    logger: SafeLogger,
    action: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.execute(client, context, operation, logger, action, false);
  }
  private static async execute<T>(
    client: PoolClient,
    context: unknown,
    operation: string,
    logger: SafeLogger,
    action: (transaction: Transaction) => Promise<T>,
    release: boolean,
  ): Promise<T> {
    const trusted = executionContext(context);
    reference(operation);
    const transaction = new Transaction(trusted);
    const failure: TransactionState = {
      failed: false,
      active: true,
      scopes: 0,
      children: new Set(),
    };
    failures.set(transaction, failure);
    let discard = false;
    let commitAttempted = false;
    try {
      await client.query('BEGIN');
      clients.set(transaction, client);
      const result = await action(transaction);
      if (failure.failed || failure.scopes !== 0)
        throw new Error('Required transaction write failed');
      commitAttempted = true;
      const commit = await client.query('COMMIT');
      if (commit.command !== 'COMMIT')
        throw new Error('Transaction did not commit');
      // Logging must never turn a committed result into an apparent rollback.
      try {
        logger.write({
          operation,
          correlationId: trusted.correlationId,
          outcome: 'committed',
        });
      } catch {
        /* Sink failure does not undo a commit. */
      }
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      try {
        logger.write({
          operation,
          correlationId: trusted.correlationId,
          outcome: discard || commitAttempted ? 'failed' : 'rolled_back',
          error,
        });
      } catch {
        /* Preserve the original failure. */
      }
      throw error;
    } finally {
      failure.active = false;
      for (const child of failure.children) {
        clients.delete(child);
        failures.delete(child);
      }
      clients.delete(transaction);
      failures.delete(transaction);
      if (release) client.release(discard);
    }
  }
  // Backend-only scope for atomic tenant + first-staff creation. Never changes
  // the root context; a scoped handle shares the connection and poison state.
  async withStaffCreationTarget<T>(
    staffId: string,
    action: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.required(async () => {
      const { actor, target, correlationId } = this.context;
      const validUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        );
      const client = clients.get(this);
      const failure = failures.get(this);
      if (
        !client ||
        !failure ||
        actor.kind !== 'platform_operator' ||
        target.type !== 'tenant' ||
        target.tenantId !== null ||
        !validUuid(target.reference) ||
        !validUuid(staffId)
      )
        throw new Error('Invalid staff creation scope');
      failure.scopes++;
      try {
        const tenant = await this.query(
          'SELECT id FROM public.tenants WHERE id=$1 FOR KEY SHARE',
          [target.reference],
        );
        if (!failure.active || !clients.has(this) || !tenant.rows[0])
          throw new Error('Missing staff creation tenant');
        const scoped = new Transaction(
          executionContext({
            actor,
            correlationId,
            target: {
              type: 'staff',
              reference: staffId,
              tenantId: target.reference,
            },
          }),
        );
        failure.children.add(scoped);
        clients.set(scoped, client);
        failures.set(scoped, failure);
        try {
          return await scoped.required(() => action(scoped));
        } finally {
          clients.delete(scoped);
          failures.delete(scoped);
          failure.children.delete(scoped);
        }
      } finally {
        failure.scopes--;
      }
    });
  }
  async required<T>(action: () => Promise<T>): Promise<T> {
    if (!clients.has(this)) throw new Error('Transaction is no longer active');
    try {
      return await action();
    } catch (error) {
      const failure = failures.get(this);
      if (failure) failure.failed = true;
      throw error;
    }
  }
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ) {
    const client = clients.get(this);
    if (!client) throw new Error('Transaction is no longer active');
    return this.required(() => client.query<T>(sql, values));
  }
}
