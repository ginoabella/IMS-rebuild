import { createHash } from 'node:crypto';
import type { SessionConfig } from '@myims/config';
import type { CredentialBudgets } from '../../application/credential-actions';
import { SessionRedisConnection } from './connection';
const script = `
local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local deadline=(math.floor(now/900000)+1)*900000
local n=tonumber(ARGV[1])
if not redis.acl_check_cmd('HSET',KEYS[1],'__policy','v1') or not redis.acl_check_cmd('PEXPIREAT',KEYS[1],tostring(deadline)) then return {-1,0} end
local policy=redis.call('HGET',KEYS[1],'__policy')
if policy and (policy~='v1' or redis.call('PTTL',KEYS[1])<=0) then return {-1,0} end
local additional=0
local counts={}
local limited=false
for i=1,n do
 local key=ARGV[2*i]
 local bound=tonumber(ARGV[2*i+1])
 local v=redis.call('HGET',KEYS[1],key)
 if not v then additional=additional+1 end
 local count=v and tonumber(v) or 0
 if not count or count<0 or count>bound then return {-1,0} end
 counts[i]=count
 if count>=bound then limited=true end
end
if redis.call('HLEN',KEYS[1])-(policy and 1 or 0)+additional>8192 then return {-1,0} end
if not policy then redis.call('HSET',KEYS[1],'__policy','v1');redis.call('PEXPIREAT',KEYS[1],deadline) end
for i=1,n do redis.call('HSET',KEYS[1],ARGV[2*i],math.min(counts[i]+1,tonumber(ARGV[2*i+1]))) end
return {limited and 0 or 1,math.max(1,math.ceil((deadline-now)/1000))}
`;
export class RedisCredentialBudgets implements CredentialBudgets {
  private readonly connection: SessionRedisConnection;
  constructor(url: string, settings: SessionConfig) {
    this.connection = new SessionRedisConnection(url, settings);
  }
  close() {
    this.connection.close();
  }
  async consume(
    operation: 'issue' | 'cancel' | 'exchange',
    source: string | null,
    issuer: string | null,
    target: string,
  ) {
    if (
      !source ||
      source.length > 64 ||
      target.length > 256 ||
      !['issue', 'cancel', 'exchange'].includes(operation) ||
      (operation !== 'exchange' && !issuer)
    )
      return { kind: 'invalid' } as const;
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const dimensions = [
      ['source', source, 60],
      ...(issuer ? [['issuer', issuer, 20]] : []),
      ['target', target, operation === 'issue' ? 5 : 10],
    ] as const;
    try {
      const result = await this.connection.run((client) =>
        client.eval(script, {
          keys: [`myims:credential-budget:v1:${operation}`],
          arguments: [
            String(dimensions.length),
            ...dimensions.flatMap(([name, value, bound]) => [
              `${name}:${hash(String(value))}`,
              String(bound),
            ]),
          ],
        }),
      );
      if (!Array.isArray(result) || result.length !== 2)
        return { kind: 'unavailable' } as const;
      if (result[0] === 1) return { kind: 'admitted' } as const;
      if (
        result[0] === 0 &&
        typeof result[1] === 'number' &&
        Number.isInteger(result[1]) &&
        result[1] >= 1 &&
        result[1] <= 900
      )
        return { kind: 'limited', retrySeconds: result[1] } as const;
      return { kind: 'unavailable' } as const;
    } catch {
      return { kind: 'unavailable' } as const;
    }
  }
}
