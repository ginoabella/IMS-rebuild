import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { SessionConfig } from '@myims/config';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import type {
  SessionFences,
  LockedFence,
  DurableFence,
} from '../../application/session-ports';
import { uuid } from '../../domain/storage';
import { version } from '../../domain/session';
export class PostgresSessionFences implements SessionFences {
  private readonly pool: Pool;
  constructor(
    url: string,
    config: SessionConfig,
    private readonly logger = new SafeLogger('http'),
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: config.concurrency,
      connectionTimeoutMillis: config.timeoutMs,
      statement_timeout: config.timeoutMs,
      query_timeout: config.timeoutMs + 100,
      lock_timeout: config.timeoutMs,
      idle_in_transaction_session_timeout: config.timeoutMs * 2,
    });
    this.pool.on('connect', (client) => client.on('error', () => {}));
    this.pool.on('error', () => {});
  }
  async lock<T>(
    id: string,
    action: (fence: LockedFence) => Promise<T>,
  ): Promise<T> {
    if (!uuid(id)) throw new Error('Invalid session reference');
    const client = await this.pool.connect();
    let discard = false;
    try {
      // Session advisory locks span durable COMMIT and Redis, unlike row/xact locks.
      await client.query(
        'SELECT pg_advisory_lock(hashtextextended($1, 60206))',
        [id],
      );
      const fence: LockedFence = {
        now: async () => {
          const { rows } = await client.query<{ now: string }>(
            'SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now',
          );
          const now = Number(rows[0]?.now);
          if (!Number.isSafeInteger(now) || now < 1)
            throw new Error('Session time unavailable');
          return now;
        },
        read: async () => {
          const { rows } = await client.query<{
            generation: number;
            revoked: boolean;
            absolute_expires_at: string;
          }>(
            'SELECT generation,revoked,absolute_expires_at FROM public.session_fences WHERE id=$1',
            [id],
          );
          const r = rows[0];
          if (!r) return null;
          const absoluteExpiresAt = Number(r.absolute_expires_at);
          if (
            !version(r.generation) ||
            typeof r.revoked !== 'boolean' ||
            !Number.isSafeInteger(absoluteExpiresAt)
          )
            throw new Error('Session fence unavailable');
          return {
            generation: r.generation,
            revoked: r.revoked,
            absoluteExpiresAt,
          } satisfies DurableFence;
        },
        create: async (deadline) => {
          await this.write(client, id, 'created', async (tx) => {
            await tx.query(
              'INSERT INTO public.session_fences(id,generation,revoked,absolute_expires_at) VALUES($1,1,false,$2)',
              [id, deadline],
            );
            return true;
          });
        },
        advance: async (expected) =>
          this.write(client, id, 'rotated', async (tx) => {
            const result = await tx.query(
              'UPDATE public.session_fences SET generation=generation+1 WHERE id=$1 AND generation=$2 AND NOT revoked AND generation<2147483647 RETURNING id',
              [id, expected],
            );
            return result.rows.length === 1;
          }),
        revoke: async () => {
          await this.write(client, id, 'revoked', async (tx) => {
            const r = await tx.query(
              'UPDATE public.session_fences SET revoked=true WHERE id=$1 AND NOT revoked RETURNING id',
              [id],
            );
            return r.rows.length === 1;
          });
        },
      };
      return await action(fence);
    } catch (error) {
      // Any uncertain response discards the connection and releases server locks.
      discard = true;
      throw error;
    } finally {
      if (!discard) {
        try {
          await client.query(
            'SELECT pg_advisory_unlock(hashtextextended($1, 60206))',
            [id],
          );
        } catch {
          discard = true;
        }
      }
      client.release(discard);
    }
  }
  private write(
    client: PoolClient,
    id: string,
    operation: 'created' | 'rotated' | 'revoked',
    action: (tx: Transaction) => Promise<boolean>,
  ) {
    return Transaction.runWithClient(
      client,
      {
        actor: {
          kind: 'system',
          reference: 'identity.session-fence',
          plane: 'system',
          tenantId: null,
          reason: 'recovery-fencing',
        },
        target: { type: 'session', reference: id, tenantId: null },
        correlationId: randomUUID(),
      },
      `session.${operation}`,
      this.logger,
      async (tx) => {
        const changed = await action(tx);
        if (changed)
          await new AuditRepository().append(
            tx,
            {
              type: 'identity.session-fence',
              version: 1,
              fields: {
                operation: {
                  kind: 'enum',
                  values: ['created', 'rotated', 'revoked'],
                },
              },
            },
            { operation },
          );
        return changed;
      },
    );
  }
  async cleanup(limit: number): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Invalid cleanup bound');
    const id = randomUUID();
    return Transaction.run(
      this.pool,
      {
        actor: {
          kind: 'system',
          reference: 'identity.session-fence',
          plane: 'system',
          tenantId: null,
          reason: 'expired-session-retention',
        },
        target: { type: 'session-retention', reference: id, tenantId: null },
        correlationId: randomUUID(),
      },
      'session.cleanup',
      this.logger,
      async (tx) => {
        const result = await tx.query(
          `DELETE FROM public.session_fences WHERE id IN (SELECT id FROM public.session_fences WHERE absolute_expires_at <= floor(extract(epoch FROM clock_timestamp())*1000) ORDER BY absolute_expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING id`,
          [limit],
        );
        const count = result.rows.length;
        if (count > 0)
          await new AuditRepository().append(
            tx,
            {
              type: 'identity.session-fence-cleanup',
              version: 1,
              fields: { count: { kind: 'integer', min: 1, max: 100 } },
            },
            { count },
          );
        return count;
      },
    );
  }
  async close() {
    await this.pool.end();
  }
}
