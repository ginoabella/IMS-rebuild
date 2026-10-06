import { createClient } from 'redis';
import type { SessionConfig } from '@myims/config';
// Reconnect only before a new operation. Never retry or queue an ambiguous write.
export class SessionRedisConnection {
  private readonly client;
  private connecting?: Promise<void>;
  private validated = false;
  private busy = 0;
  constructor(
    url: string,
    private readonly config: SessionConfig,
  ) {
    const parsed = new URL(url);
    if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.password)
      throw new Error('Authenticated session Redis required');
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: config.timeoutMs, reconnectStrategy: false },
    });
    this.client.on('error', () => {
      this.validated = false;
    });
  }
  private async bounded<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.close();
            reject(new Error('Session store unavailable'));
          }, this.config.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async connect(): Promise<void> {
    if (this.client.isReady && this.validated) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      try {
        this.close();
        await this.bounded(this.client.connect());
        const settings = await this.bounded(
          this.client.configGet(['maxmemory', 'maxmemory-policy']),
        );
        if (
          settings['maxmemory-policy'] !== 'noeviction' ||
          !Number.isSafeInteger(Number(settings.maxmemory)) ||
          Number(settings.maxmemory) < 1
        )
          throw new Error('Session capacity configuration unavailable');
        this.validated = true;
      } catch {
        this.close();
        throw new Error('Session dependencies unavailable');
      }
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }
  async run<T>(work: (client: typeof this.client) => Promise<T>): Promise<T> {
    if (this.busy >= this.config.concurrency)
      throw new Error('Session capacity unavailable');
    this.busy++;
    try {
      await this.connect();
      return await this.bounded(work(this.client));
    } catch {
      // ACL/OOM failures remain failed writes; a later new request may reconnect.
      this.close();
      throw new Error('Session store unavailable');
    } finally {
      this.busy--;
    }
  }
  close() {
    this.validated = false;
    if (this.client.isOpen) this.client.destroy();
  }
}
