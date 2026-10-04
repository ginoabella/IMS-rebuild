import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  executionContext,
  reference,
  type ExecutionContext,
} from '../execution/context';
import { SafeLogger } from '../execution/logging';
const clients = new WeakMap<Transaction, PoolClient>();
export class Transaction {
  private failed = false;
  private constructor(readonly context: Readonly<ExecutionContext>) {}
  static async run<T>(
    pool: Pool,
    context: unknown,
    operation: string,
    logger: SafeLogger,
    action: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    const trusted = executionContext(context);
    reference(operation);
    const client = await pool.connect();
    const transaction = new Transaction(trusted);
    let discard = false;
    try {
      await client.query('BEGIN');
      clients.set(transaction, client);
      const result = await action(transaction);
      if (transaction.failed)
        throw new Error('Required transaction write failed');
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
          outcome: discard ? 'failed' : 'rolled_back',
          error,
        });
      } catch {
        /* Preserve the original failure. */
      }
      throw error;
    } finally {
      clients.delete(transaction);
      client.release(discard);
    }
  }
  async required<T>(action: () => Promise<T>): Promise<T> {
    if (!clients.has(this)) throw new Error('Transaction is no longer active');
    try {
      return await action();
    } catch (error) {
      this.failed = true;
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
