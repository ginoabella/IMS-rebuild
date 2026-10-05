import { Pool, type QueryResultRow } from 'pg';
export interface ReadSnapshot {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
// Construct with the primary runtime connection string, never a read replica.
// No execution/audit actor is invented for a private canonical read.
export class SnapshotDatabase {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 4,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('connect', (client) => client.on('error', () => {}));
    this.pool.on('error', () => {});
  }
  async read<T>(action: (snapshot: ReadSnapshot) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let discard = false;
    let active = true;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot: ReadSnapshot = {
        query: async <R extends QueryResultRow>(
          sql: string,
          values: unknown[] = [],
        ) => {
          if (!active) throw new Error('Read snapshot is no longer active');
          return client.query<R>(sql, values);
        },
      };
      const result = await action(snapshot);
      const committed = await client.query('COMMIT');
      if (committed.command !== 'COMMIT')
        throw new Error('Read snapshot did not commit');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      active = false;
      client.release(discard);
    }
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}
