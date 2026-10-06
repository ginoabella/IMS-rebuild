import {
  limiterOperations,
  type LimiterConfig,
  type LimiterOperation,
  type SessionConfig,
} from '@myims/config';
import type {
  AdmissionResult,
  DistributedLimiter,
} from '../../application/admission';
import { SessionRedisConnection } from './connection';
// One expiring bounded hash per operation. The hash itself is the allocation
// registry, eliminating independent attacker-created counter keys and cleanup scans.
const consume = `
local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local window=tonumber(ARGV[3])
local deadline=(math.floor(now/window)+1)*window
local policy=ARGV[1]..':'..ARGV[2]..':'..ARGV[3]..':'..ARGV[4]
local source='s:'..ARGV[5]
local identity='i:'..ARGV[6]
-- Scripts do not roll back partial writes. Check all write permissions first.
if not redis.acl_check_cmd('HSET',KEYS[1],'__policy',policy) or
   not redis.acl_check_cmd('PEXPIREAT',KEYS[1],tostring(deadline)) then
  return {-1,0}
end
local existing=redis.call('HGET',KEYS[1],'__policy')
if existing and (existing ~= policy or redis.call('PTTL',KEYS[1]) <= 0) then return {-1,0} end
local a=redis.call('HGET',KEYS[1],source)
local b=redis.call('HGET',KEYS[1],identity)
local allocated=redis.call('HLEN',KEYS[1])-(existing and 1 or 0)
local additional=(a and 0 or 1)+(b and 0 or 1)
if allocated+additional > tonumber(ARGV[4]) then return {-1,0} end
local av=a and tonumber(a) or 0
local bv=b and tonumber(b) or 0
if not av or not bv or av < 0 or bv < 0 or av > tonumber(ARGV[1]) or bv > tonumber(ARGV[2]) then return {-1,0} end
if not existing then
  redis.call('HSET',KEYS[1],'__policy',policy)
  -- Establish expiry before allocating any identifying counters.
  redis.call('PEXPIREAT',KEYS[1],deadline)
end
local limited=(av >= tonumber(ARGV[1]) or bv >= tonumber(ARGV[2]))
redis.call('HSET',KEYS[1],source,math.min(av+1,tonumber(ARGV[1])),identity,math.min(bv+1,tonumber(ARGV[2])))
return {limited and 0 or 1,math.max(1,math.ceil((deadline-now)/1000))}
`;
export class RedisDistributedLimiter implements DistributedLimiter {
  private readonly connection: SessionRedisConnection;
  constructor(
    url: string,
    settings: SessionConfig,
    private readonly config: LimiterConfig,
    private readonly metric: (
      operation: LimiterOperation,
      outcome: AdmissionResult['kind'],
    ) => void = () => {},
  ) {
    this.connection = new SessionRedisConnection(url, settings);
  }
  connect() {
    return this.connection.connect();
  }
  close() {
    this.connection.close();
  }
  async consume(
    operation: LimiterOperation,
    sourceHash: string,
    identityHash: string,
  ): Promise<AdmissionResult> {
    let result: AdmissionResult;
    if (
      !limiterOperations.includes(operation) ||
      !/^[a-f0-9]{64}$/.test(sourceHash) ||
      !/^[a-f0-9]{64}$/.test(identityHash)
    )
      return { kind: 'invalid' };
    try {
      const p = this.config.policies[operation];
      const raw = await this.connection.run((client) =>
        client.eval(consume, {
          keys: [`myims:limiter:v1:${operation}`],
          arguments: [
            String(p.source),
            String(p.identity),
            String(p.windowMs),
            String(this.config.capacity),
            sourceHash,
            identityHash,
          ],
        }),
      );
      if (
        !Array.isArray(raw) ||
        raw.length !== 2 ||
        !Number.isSafeInteger(raw[0]) ||
        !Number.isSafeInteger(raw[1])
      )
        throw new Error('Invalid limiter response');
      if (raw[0] === 1) result = { kind: 'admitted' };
      else if (
        raw[0] === 0 &&
        typeof raw[1] === 'number' &&
        raw[1] >= 1 &&
        raw[1] <= Math.ceil(p.windowMs / 1000)
      )
        result = { kind: 'limited', retrySeconds: raw[1] };
      else result = { kind: 'unavailable' };
    } catch {
      result = { kind: 'unavailable' };
    }
    this.metric(operation, result.kind);
    return result;
  }
}
