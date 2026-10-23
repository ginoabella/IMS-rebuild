// Execute the actual admission Lua on isolated real Redis. Only PTTL is replaced
// for one call so the valid zero-ms boundary is deterministic, without sleeps.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { limiterScript } = backend(
  './dist/modules/identity/adapters/redis/limiter.js',
);
export async function checkLimiterExpiry(redis) {
  const key = `myims:limiter:test:expiry:${randomUUID()}`;
  const args = ['3', '2', '60000', '16', 'a'.repeat(64), 'b'.repeat(64)];
  async function boundary(ttl, badPolicy = false) {
    const script = limiterScript.replace(
      "redis.call('PTTL',KEYS[1])",
      String(ttl),
    );
    assert.notEqual(
      script,
      limiterScript,
      'PTTL fault injection must remain active',
    );
    const result = await redis.eval(
      `
      redis.call('HSET',KEYS[1],'__policy',${badPolicy ? "'wrong-policy'" : "ARGV[1]..':'..ARGV[2]..':'..ARGV[3]..':'..ARGV[4]"},'s:'..ARGV[5],ARGV[1],'i:'..ARGV[6],ARGV[2],'s:previous',1)
      redis.call('PEXPIRE',KEYS[1],60000)
      local function consume()
        ${script}
      end
      local result=consume()
      return {result[1],redis.call('HGET',KEYS[1],'s:'..ARGV[5]) or 0,redis.call('HGET',KEYS[1],'i:'..ARGV[6]) or 0,redis.call('HLEN',KEYS[1]),redis.call('PTTL',KEYS[1])}
    `,
      { keys: [key], arguments: args },
    );
    const expiry = result.pop();
    if (result[0] === 1)
      assert.ok(expiry > 0, 'admitted counters retain a future expiry');
    return result;
  }
  try {
    assert.deepEqual(
      await boundary(0),
      [1, '1', '1', 3],
      'expired boundary must start fresh counters, without a false unavailable result',
    );
    assert.deepEqual(
      await boundary(-1),
      [-1, '3', '2', 4],
      'a missing expiry remains unavailable',
    );
    assert.deepEqual(
      await boundary(0, true),
      [-1, '3', '2', 4],
      'policy drift must not be reset into eligibility',
    );
    assert.deepEqual(
      await boundary(1000),
      [0, '3', '2', 4],
      'an active exhausted window remains limited',
    );
    console.log(
      'PASS real Redis admission expiry: controlled zero-ms rollover resets counters atomically; missing expiry/policy drift fail closed; active limits stay enforced.',
    );
  } finally {
    await redis.del(key);
  }
}
