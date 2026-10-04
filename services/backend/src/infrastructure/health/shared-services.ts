import type { DependencyState, ReadinessResponse } from '@myims/contracts';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { createClient } from 'redis';
import type { BackendConfig } from '@myims/config';
export const BACKEND_CONFIG = Symbol('BACKEND_CONFIG');
export const BASELINE_MIGRATION = '20261004000000_foundation';
type Dependency = 'database' | 'sessionRedis' | 'realtimeRedis';
type State = DependencyState;
@Injectable()
export class SharedServices implements OnApplicationShutdown {
  private readonly database: Pool;
  private readonly session;
  private readonly realtime;
  private readonly states = new Map<Dependency, State>();
  constructor(@Inject(BACKEND_CONFIG) private readonly config: BackendConfig) {
    this.database = new Pool({
      connectionString: config.database.url,
      max: config.databasePoolMax,
      connectionTimeoutMillis: config.dependencyTimeoutMs,
      statement_timeout: config.dependencyTimeoutMs,
      query_timeout: config.dependencyTimeoutMs,
      idleTimeoutMillis: 10000,
    });
    this.database.on('error', () => this.record('database', 'down'));
    this.session = this.redis(config.sessionRedis.url, 'sessionRedis');
    this.realtime = this.redis(config.realtimeRedis.url, 'realtimeRedis');
  }
  private redis(url: string, name: Dependency) {
    const client = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: this.config.dependencyTimeoutMs,
        reconnectStrategy: (retries) =>
          Math.min(100 * 2 ** Math.min(retries, 4), 2000),
      },
    });
    client.on('error', () => this.record(name, 'down'));
    void client.connect().catch(() => this.record(name, 'down'));
    return client;
  }
  private record(name: Dependency, state: State, code?: string): State {
    if (this.states.get(name) !== state) {
      this.states.set(name, state);
      console.log(
        JSON.stringify({
          event: 'dependency_status',
          dependency: name,
          status: state,
          ...(code ? { code } : {}),
        }),
      );
    }
    return state;
  }
  private async checkDatabase(): Promise<State> {
    try {
      const result = await this.database.query<{
        postgis: string;
        migrated: boolean;
      }>(
        `SELECT postgis_version() AS postgis, EXISTS (SELECT 1 FROM public._prisma_migrations
         WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrated`,
        [BASELINE_MIGRATION],
      );
      const row = result.rows[0];
      return this.record(
        'database',
        row?.postgis.startsWith('3.') && row.migrated ? 'up' : 'down',
      );
    } catch (error) {
      const code =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Z0-9]{5}$/.test(error.code)
          ? error.code
          : undefined;
      return this.record('database', 'down', code);
    }
  }
  private async checkRedis(
    client: ReturnType<SharedServices['redis']>,
    name: Dependency,
  ): Promise<State> {
    if (!client.isReady) return this.record(name, 'down');
    try {
      const pong = await client
        .withCommandOptions({
          abortSignal: AbortSignal.timeout(this.config.dependencyTimeoutMs),
        })
        .ping();
      return this.record(name, pong === 'PONG' ? 'up' : 'down');
    } catch {
      return this.record(name, 'down');
    }
  }
  async readiness(): Promise<ReadinessResponse> {
    const [database, sessionRedis, realtimeRedis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(this.session, 'sessionRedis'),
      this.checkRedis(this.realtime, 'realtimeRedis'),
    ]);
    const checks = { database, sessionRedis, realtimeRedis };
    return {
      status: Object.values(checks).every((state) => state === 'up')
        ? 'ready'
        : 'not_ready',
      checks,
    };
  }
  async onApplicationShutdown() {
    for (const client of [this.session, this.realtime])
      if (client.isOpen) client.destroy();
    await this.database.end();
  }
}
