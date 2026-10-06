import { createClient } from 'redis';
import type { SessionConfig } from '@myims/config';
import type { SessionRecords } from '../../application/session-ports';
import type { SessionRecord } from '../../domain/session';
// PostgreSQL supplies authoritative time. Redis TIME additionally caps absolute
// expiry. Ahead clocks lose access early; behind clocks cannot extend the DB cap.
// A full command-timeout budget is reserved for transit before setting any TTL.
const ttl = `
local t=redis.call('TIME')
local redisNow=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local deadline=math.min(tonumber(ARGV[3]),tonumber(ARGV[4]))
local duration=math.floor(math.min(deadline-tonumber(ARGV[5])-tonumber(ARGV[6]),deadline-redisNow))
if duration <= 0 then return 0 end
`;
const create =
  ttl +
  `return redis.call('SET',KEYS[1],ARGV[2],'PX',duration,'NX') and 1 or 0`;
const renew =
  ttl +
  `
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'PX',duration,'XX')
return 1`;
const rotate =
  ttl +
  `
if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('EXISTS',KEYS[2]) ~= 0 then return 0 end
-- SET precedes DEL: OOM cannot delete the predecessor before failing to write.
redis.call('SET',KEYS[2],ARGV[2],'PX',duration,'NX')
redis.call('DEL',KEYS[1])
return 1`;
export class RedisSessionRecords implements SessionRecords {
  private readonly client;
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
    this.client.on('error', () => {});
  }
  async connect() {
    await this.bounded(this.client.connect());
    try {
      const settings = await this.bounded(
        this.command().configGet(['maxmemory', 'maxmemory-policy']),
      );
      if (
        settings['maxmemory-policy'] !== 'noeviction' ||
        !Number.isSafeInteger(Number(settings.maxmemory)) ||
        Number(settings.maxmemory) < 1
      )
        throw new Error('Session capacity configuration unavailable');
    } catch {
      this.close();
      throw new Error('Session capacity configuration unavailable');
    }
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
  private command() {
    if (!this.client.isReady) throw new Error('Session store unavailable');
    return this.client.withCommandOptions({
      abortSignal: AbortSignal.timeout(this.config.timeoutMs),
    });
  }
  async get(key: string) {
    // GETRANGE bounds memory even for attacker/malformed oversized stored values.
    const bytes = await this.bounded(this.command().getRange(key, 0, 2048));
    if (bytes === null || bytes === '') return null;
    if (Buffer.byteLength(bytes) > 2048) return 'invalid';
    return bytes;
  }
  private async write(
    script: string,
    keys: string[],
    previous: string,
    next: SessionRecord,
    now: number,
  ) {
    const result = await this.bounded(
      this.command().eval(script, {
        keys,
        arguments: [
          previous,
          JSON.stringify(next),
          String(next.idleExpiresAt),
          String(next.absoluteExpiresAt),
          String(now),
          String(this.config.timeoutMs),
        ],
      }),
    );
    return result === 1;
  }
  create(key: string, next: SessionRecord, now: number) {
    return this.write(create, [key], '', next, now);
  }
  renew(key: string, previous: string, next: SessionRecord, now: number) {
    return this.write(renew, [key], previous, next, now);
  }
  rotate(
    oldKey: string,
    newKey: string,
    previous: string,
    next: SessionRecord,
    now: number,
  ) {
    return this.write(rotate, [oldKey, newKey], previous, next, now);
  }
  async delete(key: string) {
    await this.bounded(this.command().del(key));
  }
  close() {
    if (this.client.isOpen) this.client.destroy();
  }
}
