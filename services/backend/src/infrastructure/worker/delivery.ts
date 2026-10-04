import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import PgBoss from 'pg-boss';
import { parseWorkerConfig } from '@myims/config';
import { executionContext, safeData, reference } from '../execution/context';
import { SafeLogger } from '../execution/logging';
import { QUEUE } from './queue';
export const sampleContract = {
  type: 'sample.deliver',
  version: 1,
  fields: {
    mode: {
      kind: 'enum' as const,
      values: ['once', 'transient', 'permanent', 'exhaust'],
    },
  },
};
// Explicit code-owned registration; serialized work never names an arbitrary function.
const registeredContracts = new Map([[sampleContract.type, sampleContract]]);
interface Work {
  id: string;
  work_type: string;
  schema_version: number;
  idempotency_key: string;
  actor_kind: string;
  actor_reference: string;
  identity_plane: string;
  actor_tenant_id: string | null;
  system_reason: string | null;
  target_type: string;
  target_reference: string;
  tenant_id: string | null;
  correlation_id: string;
  payload: unknown;
}
// Injectable process barriers belong to the disposable acceptance harness, not env switches.
export interface DeliveryHooks {
  barrier?: (
    stage: 'before_enqueue' | 'after_enqueue' | 'before_sink' | 'after_sink',
    workId: string,
  ) => Promise<void>;
}
export class DeliveryWorker {
  readonly pool: Pool;
  readonly boss: PgBoss;
  private stopping = false;
  private loop?: Promise<void>;
  private readonly wakeups = new Set<() => void>();
  private consumers: Promise<void>[] = [];
  private readonly logger = new SafeLogger('worker');
  constructor(
    url: string,
    readonly settings: ReturnType<typeof parseWorkerConfig>,
    private readonly hooks: DeliveryHooks = {},
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: settings.concurrency + 2,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: settings.timeoutSeconds * 1000,
    });
    // Checked-out clients also emit socket errors; an outage must not become an
    // unhandled EventEmitter error before the query can reject safely.
    this.pool.on('connect', (client) => {
      client.on('error', () => this.state('degraded', 'connection'));
    });
    this.pool.on('error', () => this.state('degraded', 'connection'));
    this.boss = new PgBoss({
      db: {
        executeSql: async (sql, values) => {
          const client = await this.pool.connect();
          let discard = false;
          try {
            return await client.query(sql, values);
          } catch (error) {
            discard = true;
            throw error;
          } finally {
            client.release(discard);
          }
        },
      },
      migrate: false,
      supervise: false,
      schedule: false,
    });
    this.boss.on('error', () => this.state('degraded', 'queue'));
  }
  private state(
    state: 'ready' | 'degraded' | 'failed' | 'stopped',
    component = 'lifecycle',
  ) {
    console.log(
      JSON.stringify({
        entrypoint: 'worker',
        state,
        component,
        timestamp: new Date().toISOString(),
        ...(state === 'degraded'
          ? {
              failureCode:
                component === 'dispatch'
                  ? 'dispatch_unavailable'
                  : 'dependency_unavailable',
            }
          : {}),
      }),
    );
  }
  async start() {
    try {
      await this.boss.start();
      if (!(await this.boss.getQueue(QUEUE))) throw new Error('queue_missing');
      const capability = await this.pool.query<{ capable: boolean }>(
        `SELECT bool_and(has_table_privilege(current_user,'pgboss.job',privilege)) AS capable
         FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS permissions(privilege)`,
      );
      if (!capability.rows[0]?.capable)
        throw new Error('queue_permission_missing');
      this.state('ready');
      this.loop = this.dispatchLoop();
      this.consumers = Array.from({ length: this.settings.concurrency }, () =>
        this.consumeLoop(),
      );
    } catch {
      this.state('failed');
      await this.boss.stop({ graceful: false });
      await this.pool.end();
      throw new Error('worker_startup_failed');
    }
  }
  private async dispatchLoop() {
    let failures = 0;
    while (!this.stopping) {
      try {
        await this.boss.expire(); // pg-boss owns retry eligibility and expiration.
        await this.reconcile();
        await this.dispatch();
        if (failures) this.state('ready', 'dispatch');
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 5);
        this.state('degraded', 'dispatch');
      }
      if (!this.stopping)
        await this.pause(Math.min(30000, this.settings.pollMs * 2 ** failures));
    }
  }
  private pause(milliseconds: number) {
    return new Promise<void>((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.wakeups.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, milliseconds);
      this.wakeups.add(wake);
    });
  }
  private async consumeLoop() {
    let failures = 0;
    while (!this.stopping) {
      try {
        // In pg-boss 10.4.2 work() does not await complete()/fail(). Use its
        // public pull API so dependency failures and shutdown are fully awaited.
        const [job] = await this.boss.fetch<{ workId: string }>(QUEUE, {
          includeMetadata: true,
          batchSize: 1,
        });
        if (this.stopping) break; // Any fetched claim remains recoverable by expiry.
        if (job) {
          try {
            await this.execute(job);
          } catch {
            await this.boss.fail(QUEUE, job.id, {
              failureCode: 'delivery_unavailable',
            });
            continue;
          }
          await this.boss.complete(QUEUE, job.id);
        }
        if (failures) this.state('ready', 'queue');
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 5);
        this.state('degraded', 'queue');
      }
      if (!this.stopping)
        await this.pause(
          Math.min(30000, Math.max(500, this.settings.pollMs) * 2 ** failures),
        );
    }
  }
  async dispatch() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const work = await client.query<Work>(
        `SELECT * FROM public.outbox_work WHERE handoff_status='pending' ORDER BY created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [this.settings.batch],
      );
      const delivered: Work[] = [];
      for (const item of work.rows) {
        if (this.stopping) break;
        await this.hooks.barrier?.('before_enqueue', item.id);
        const accepted = await this.boss.send(
          QUEUE,
          {
            workId: item.id,
            correlationId: item.correlation_id,
            tenantId: item.tenant_id,
            targetType: item.target_type,
            targetReference: item.target_reference,
            actorKind: item.actor_kind,
            actorReference: item.actor_reference,
          },
          {
            id: item.id,
            retryLimit: this.settings.attempts - 1,
            retryDelay: this.settings.retrySeconds,
            retryBackoff: true,
            expireInSeconds: this.settings.timeoutSeconds,
            db: { executeSql: (sql, values) => client.query(sql, values) },
          },
        );
        if (!accepted) throw new Error('queue_not_accepted');
        await this.hooks.barrier?.('after_enqueue', item.id);
        await client.query(
          "UPDATE public.outbox_work SET handoff_status='accepted',accepted_at=clock_timestamp() WHERE id=$1",
          [item.id],
        );
        delivered.push(item);
      }
      await client.query('COMMIT');
      for (const item of delivered) {
        this.logger.write({
          operation: 'work.dispatch',
          correlationId: item.correlation_id,
          workId: item.id,
          jobId: item.id,
          actorReference: item.actor_reference,
          actorKind: item.actor_kind,
          targetReference: item.target_reference,
          tenantId: item.tenant_id ?? undefined,
          outcome: 'committed',
        });
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  private async reconcile() {
    // Transport exhaustion from hard crashes/timeouts can happen without a live handler.
    await this.pool.query(
      `INSERT INTO public.work_results(work_id,handler,attempts,outcome,failure_code,first_attempt_at,last_attempt_at,finished_at)
      SELECT DISTINCT ON (w.id) w.id,'sample.deliver',j.retry_count+1,'failed','queue_exhausted',j.started_on,j.started_on,clock_timestamp()
      FROM pgboss.job j JOIN public.outbox_work w ON w.id::text=j.data->>'workId'
      WHERE j.name=$1 AND j.state='failed'
      AND NOT EXISTS (SELECT 1 FROM pgboss.job live WHERE live.name=$1 AND live.data->>'workId'=w.id::text AND live.state<'completed')
      AND NOT EXISTS (SELECT 1 FROM public.work_results r WHERE r.work_id=w.id AND r.outcome<>'pending')
      ORDER BY w.id,j.retry_count DESC,j.started_on DESC LIMIT $2
      ON CONFLICT(work_id) DO UPDATE SET outcome='failed',failure_code='queue_exhausted',attempts=GREATEST(work_results.attempts,EXCLUDED.attempts),last_attempt_at=EXCLUDED.last_attempt_at,finished_at=clock_timestamp()
      WHERE work_results.outcome='pending'`,
      [QUEUE, this.settings.batch],
    );
  }
  private log(
    work: Work,
    job: PgBoss.JobWithMetadata<{ workId: string }>,
    attempt: number,
    outcome: 'committed' | 'failed',
    failureCode?:
      | 'invalid_work'
      | 'permanent_failure'
      | 'retry_exhausted'
      | 'retryable_delivery',
  ) {
    this.logger.write({
      operation: 'work.execute',
      failureCode,
      correlationId: work.correlation_id,
      workId: work.id,
      jobId: job.id,
      attemptId: randomUUID(),
      actorReference: work.actor_reference,
      actorKind: work.actor_kind,
      targetReference: work.target_reference,
      tenantId: work.tenant_id ?? undefined,
      attempt,
      outcome,
    });
  }
  private async execute(job: PgBoss.JobWithMetadata<{ workId: string }>) {
    // Queue input contains only a stable ID; canonical immutable intent supplies trusted context.
    let id: string;
    try {
      id = reference(job.data.workId);
      if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error();
    } catch {
      await this.pool.query(
        'UPDATE pgboss.job SET retry_limit=retry_count WHERE name=$1 AND id=$2',
        [QUEUE, job.id],
      );
      throw new Error('invalid_job');
    }
    const client = await this.pool.connect();
    let work: Work | undefined;
    let retry = false;
    try {
      await client.query('BEGIN');
      // Transaction-scoped serialization prevents concurrent duplicates and recovers on death.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [id],
      );
      work = (
        await client.query<Work>(
          'SELECT * FROM public.outbox_work WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!work) throw new Error('invalid_job');
      await client.query(
        `INSERT INTO public.work_results(work_id,handler) VALUES($1,'sample.deliver') ON CONFLICT DO NOTHING`,
        [id],
      );
      const prior = (
        await client.query<{ outcome: string; attempts: number }>(
          'SELECT outcome,attempts FROM public.work_results WHERE work_id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0]!;
      if (prior.outcome !== 'pending') {
        await client.query('COMMIT');
        return;
      }
      const attempt = Math.max(prior.attempts + 1, job.retryCount + 1);
      await client.query(
        `UPDATE public.work_results SET attempts=$2,first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),last_attempt_at=clock_timestamp() WHERE work_id=$1`,
        [id, attempt],
      );
      let failure:
        'invalid_work' | 'permanent_failure' | 'retry_exhausted' | undefined;
      let mode: unknown;
      try {
        executionContext({
          actor: {
            kind: work.actor_kind,
            reference: work.actor_reference,
            plane: work.identity_plane,
            tenantId: work.actor_tenant_id,
            ...(work.actor_kind === 'system'
              ? { reason: work.system_reason }
              : {}),
          },
          target: {
            type: work.target_type,
            reference: work.target_reference,
            tenantId: work.tenant_id,
          },
          correlationId: work.correlation_id,
        });
        const contract = registeredContracts.get(work.work_type);
        if (!contract || work.schema_version !== contract.version)
          throw new Error();
        mode = safeData(contract, work.payload).mode;
      } catch {
        failure = 'invalid_work';
      }
      if (mode === 'permanent') failure = 'permanent_failure';
      if (mode === 'exhaust' || (mode === 'transient' && attempt === 1)) {
        if (
          attempt >= this.settings.attempts ||
          job.retryCount >= job.retryLimit
        )
          failure = 'retry_exhausted';
        else retry = true;
      }
      if (failure) {
        await client.query(
          `UPDATE public.work_results SET outcome='failed',failure_code=$2,finished_at=clock_timestamp() WHERE work_id=$1`,
          [id, failure],
        );
      } else if (!retry) {
        await this.hooks.barrier?.('before_sink', id);
        await this.acceptSink(work);
        await this.hooks.barrier?.('after_sink', id);
        // Receipt and local acknowledgement share the transaction; destination dedup handles its separate commit.
        await client.query(
          `INSERT INTO public.work_receipts(work_id,handler) VALUES($1,'sample.deliver') ON CONFLICT DO NOTHING`,
          [id],
        );
        await client.query(
          `UPDATE public.work_results SET outcome='succeeded',finished_at=clock_timestamp() WHERE work_id=$1`,
          [id],
        );
      }
      await client.query('COMMIT');
      this.log(
        work,
        job,
        attempt,
        failure || retry ? 'failed' : 'committed',
        failure ?? (retry ? 'retryable_delivery' : undefined),
      );
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('delivery_unavailable'); // Safe bounded queue output, never raw error serialization.
    } finally {
      client.release();
    }
    if (retry) throw new Error('retryable_delivery');
  }
  private async acceptSink(work: Work) {
    // This destination transaction is deliberately independent of the caller's acknowledgement.
    await this.pool.query(
      `INSERT INTO public.sample_delivery_sink(work_id,handler,tenant_scope,idempotency_key)
      VALUES($1,'sample.deliver',$2,$3) ON CONFLICT(work_id) DO NOTHING`,
      [
        work.id,
        work.tenant_id === null ? 'platform' : `tenant:${work.tenant_id}`,
        work.idempotency_key,
      ],
    );
  }
  async stop() {
    this.stopping = true;
    for (const wake of this.wakeups) wake();
    await Promise.all([this.loop, ...this.consumers]);
    await this.boss.stop({
      graceful: true,
      timeout: this.settings.shutdownMs,
      wait: true,
    });
    await this.pool.end();
    this.state('stopped');
  }
}
