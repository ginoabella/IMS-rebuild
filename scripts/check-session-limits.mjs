import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { parseLimiterConfig, limiterOperations } = backend('@myims/config');
const { TrustedSource, canonicalAddress } = backend(
  './dist/modules/identity/adapters/http/trusted-source',
);
const { identifyingHash } = backend(
  './dist/modules/identity/application/admission',
);
const limiterKey = (operation) => `myims:limiter:v1:${operation}`;
// Controlled private relay can interrupt and later restore primary access without
// stopping a shared development PostgreSQL server or changing its databases.
async function relay(targetUrl) {
  const target = new URL(targetUrl),
    sockets = new Set();
  let available = true;
  const server = createServer((client) => {
    if (!available) return client.destroy();
    const upstream = connect({
      host: target.hostname,
      port: Number(target.port || 5432),
    });
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on('error', () => {});
      s.on('close', () => sockets.delete(s));
    }
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(target);
  url.hostname = '127.0.0.1';
  url.port = String(server.address().port);
  return {
    url: url.href,
    set(value) {
      available = value;
      if (!value) for (const s of sockets) s.destroy();
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
export async function checkDistributedLimits({
  owner,
  worker,
  redis,
  issue,
  key,
  ref,
  secrets,
  appUrl,
  proxy,
}) {
  const calls = [],
    relays = [],
    users = [];
  const defaults = parseLimiterConfig({});
  assert.deepEqual(defaults.policies['tenant.sign-in'], {
    source: 60,
    identity: 10,
    windowMs: 900000,
  });
  assert.deepEqual(defaults.policies['platform.protected'], {
    source: 600,
    identity: 120,
    windowMs: 60000,
  });
  assert.equal(defaults.capacity, 8192);
  for (const name of [
    'LIMITER_PLATFORM_SIGN_IN_SOURCE',
    'LIMITER_TENANT_PROTECTED_IDENTITY',
    'LIMITER_CAPACITY',
  ])
    for (const value of [
      '0',
      '-1',
      'Infinity',
      '1.5',
      '999999999',
      'secret-sentinel',
    ])
      assert.throws(
        () => parseLimiterConfig({ [name]: value }),
        (e) => !e.message.includes('secret-sentinel'),
      );
  for (const value of [
    'hostname',
    '0.0.0.0/33',
    '::/129',
    '127.0.0.1,',
    '127.0.0.1/',
    '1'.repeat(2049),
  ])
    assert.throws(() => parseLimiterConfig({ LIMITER_TRUSTED_PROXIES: value }));
  const request = (
    peer,
    forwarded,
    rawHeaders = ['X-Forwarded-For', forwarded],
  ) => ({
    socket: { remoteAddress: peer },
    headers: { 'x-forwarded-for': forwarded },
    rawHeaders,
  });
  const trusted = new TrustedSource(['127.0.0.1', '10.0.0.0/8']);
  assert.equal(
    trusted.extract(request('127.0.0.1', '203.0.113.1, 10.1.2.3')),
    '203.0.113.1',
  );
  assert.equal(
    trusted.extract(request('127.0.0.1', '198.51.100.1, 203.0.113.1')),
    '203.0.113.1',
  );
  assert.equal(
    new TrustedSource([]).extract(request('127.0.0.1', 'spoof')),
    '127.0.0.1',
  );
  for (const forwarded of [
    undefined,
    '',
    'bad',
    '10.1.2.3',
    Array(17).fill('203.0.113.1').join(','),
    'x'.repeat(1025),
  ])
    assert.equal(trusted.extract(request('127.0.0.1', forwarded)), null);
  assert.equal(
    trusted.extract(
      request('127.0.0.1', '203.0.113.1', [
        'X-Forwarded-For',
        '203.0.113.1',
        'X-Forwarded-For',
        '203.0.113.2',
      ]),
    ),
    null,
  );
  assert.equal(trusted.extract(request(undefined, '203.0.113.1')), null);
  assert.equal(canonicalAddress('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(canonicalAddress('2001:0DB8:0:0:0:0:0:1'), '2001:db8::1');
  const reset = async () => redis.del(limiterOperations.map(limiterKey));
  async function replica(limiterConfig = defaults, extra = {}) {
    const c = await worker({ http: true, limiterConfig, ...extra });
    calls.push(c);
    return c;
  }
  async function http(c, path, token, status = 200, body, headers = {}) {
    const r = await fetch(`${c.url}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    if (status !== null)
      assert.equal(
        r.status,
        status,
        `Integrated HTTP ${path}: expected ${status}, got ${r.status}`,
      );
    else
      assert.ok(
        [200, 201, 429].includes(r.status),
        `Concurrent ${path} returned ${r.status}`,
      );
    assert.equal(r.headers.get('cache-control'), 'no-store');
    if (status === 503) assert.equal(r.headers.get('retry-after'), '1');
    if (status === 429)
      assert.ok(
        Number(r.headers.get('retry-after')) >= 1 &&
          Number(r.headers.get('retry-after')) <= 900,
      );
    for (const secret of secrets)
      assert.ok(
        !JSON.stringify(data).includes(secret),
        'Integrated HTTP secret leakage',
      );
    return {
      data,
      status: r.status,
      retry: Number(r.headers.get('retry-after')),
    };
  }
  const login = (
    c,
    username = 'session.operator',
    status = 201,
    plane = 'platform',
    tenantCode = 'session.tenant',
    headers = {},
  ) =>
    http(
      c,
      `fixture/sign-in/${plane}`,
      null,
      status,
      { username, tenantCode },
      headers,
    );
  async function aligned(windowMs) {
    const t = await redis.sendCommand(['TIME']);
    const now = Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000);
    const remaining = windowMs - (now % windowMs);
    if (remaining < windowMs * 0.8) await delay(remaining + 20);
  }
  async function concurrent(a, b, stage, work) {
    await a('prepare', stage);
    await b('prepare', stage);
    const jobs = work();
    const results = Promise.allSettled(jobs);
    // Every independent request must reach the barrier before either process releases.
    for (let i = 0; i < 300; i++) {
      const counts = await Promise.all([a('barrier'), b('barrier')]);
      if (counts.reduce((sum, v) => sum + v.count, 0) === jobs.length) break;
      assert.ok(i < 299, 'HTTP concurrency barrier deadline');
      await delay(5);
    }
    await a('release');
    await b('release');
    const settled = await results;
    for (const result of settled)
      if (result.status === 'rejected') throw result.reason;
    return settled.map((result) => result.value);
  }
  const operatorId = randomUUID(),
    tenantId = randomUUID(),
    staffId = randomUUID();
  await owner.query(
    "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,'limit.operator','active','ready','limiter-credential-sentinel',clock_timestamp())",
    [operatorId],
  );
  await owner.query(
    "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,'limit.tenant','Limiter Fixture','active')",
    [tenantId],
  );
  await owner.query(
    "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'limit.staff','active','ready','limiter-credential-sentinel',clock_timestamp(),ARRAY['call_taker'])",
    [staffId, tenantId],
  );
  secrets.push('limiter-credential-sentinel');
  const facts = {
    plane: 'platform',
    identityId: operatorId,
    authenticationVersion: 1,
  };
  const staffFacts = {
    plane: 'tenant',
    identityId: staffId,
    tenantId,
    authenticationVersion: 1,
    tenantAuthorityVersion: 1,
  };
  try {
    await reset();
    const config = parseLimiterConfig({
      LIMITER_PLATFORM_SIGN_IN_SOURCE: '8',
      LIMITER_PLATFORM_SIGN_IN_IDENTITY: '3',
      LIMITER_PLATFORM_SIGN_IN_WINDOW_SECONDS: '4',
      LIMITER_PLATFORM_PROTECTED_SOURCE: '8',
      LIMITER_PLATFORM_PROTECTED_IDENTITY: '3',
      LIMITER_PLATFORM_PROTECTED_WINDOW_SECONDS: '4',
    });
    const a = await replica(config, {
        config: {
          web: { idleMs: 60000, absoluteMs: 120000 },
          mobile: { idleMs: 86400000, absoluteMs: 604800000 },
          timeoutMs: 1000,
          concurrency: 16,
        },
      }),
      b = await replica(config, {
        config: {
          web: { idleMs: 60000, absoluteMs: 120000 },
          mobile: { idleMs: 86400000, absoluteMs: 604800000 },
          timeoutMs: 1000,
          concurrency: 16,
        },
      });
    const s = await issue(a, facts);
    await aligned(4000);
    const admitted = await concurrent(a, b, 'sign-in', () =>
      Array.from({ length: 8 }, (_, i) =>
        login(
          i % 2 ? a : b,
          i % 2 ? 'SESSION.OPERATOR' : ' session.operator ',
          null,
        ),
      ),
    );
    // Status assertions for concurrent races must use observable winners, not ordering.
    assert.equal(admitted.filter((v) => v.status === 201).length, 3);
    assert.equal(admitted.filter((v) => v.status === 429).length, 5);
    assert.equal(
      (await a('stats')).verification + (await b('stats')).verification,
      3,
    );
    const metrics = [...(await a('metrics')), ...(await b('metrics'))];
    assert.equal(
      metrics
        .filter(
          (v) => v.operation === 'platform.sign-in' && v.outcome === 'admitted',
        )
        .reduce((sum, v) => sum + v.count, 0),
      3,
    );
    assert.equal(
      metrics
        .filter(
          (v) => v.operation === 'platform.sign-in' && v.outcome === 'limited',
        )
        .reduce((sum, v) => sum + v.count, 0),
      5,
    );
    assert.ok(
      metrics.every(
        (v) => Object.keys(v).sort().join(',') === 'count,operation,outcome',
      ),
    );
    await login(a, 'unknown.user', 429);
    const counters = await redis.hGetAll(limiterKey('platform.sign-in'));
    assert.equal(counters[`s:${identifyingHash(['127.0.0.1'])}`], '8');
    assert.equal(counters[`i:${identifyingHash(['session.operator'])}`], '3');
    await delay((await redis.pTTL(limiterKey('platform.sign-in'))) + 25);
    await login(b, 'unknown.user');
    assert.ok((await redis.pTTL(limiterKey('platform.sign-in'))) <= 4000);
    await reset();
    await aligned(4000);
    const protectedResults = await concurrent(a, b, 'admission', () =>
      Array.from({ length: 8 }, (_, i) =>
        http(i % 2 ? a : b, 'platform', s.token, null),
      ),
    );
    assert.equal(protectedResults.filter((v) => v.status === 200).length, 3);
    assert.equal(protectedResults.filter((v) => v.status === 429).length, 5);
    assert.equal(
      (await a('stats')).protected + (await b('stats')).protected,
      3,
    );
    const snapshot = await redis.get(key(s.token));
    await http(a, 'platform/activity', s.token, 429, {});
    assert.equal(await redis.get(key(s.token)), snapshot);
    console.log(
      'PASS C-01/02: approved config, real A/B barrier concurrency, shared source/identity saturation, fixed-window expiry and zero verification/protected work after 429',
    );

    // Trusted ingress, independent identity budget across sources, tenant/plane separation.
    await reset();
    const ingress = parseLimiterConfig({
      LIMITER_TRUSTED_PROXIES: '127.0.0.1',
      LIMITER_TENANT_SIGN_IN_IDENTITY: '2',
    });
    const ia = await replica(ingress),
      ib = await replica(ingress);
    await login(ia, 'same.name', 201, 'tenant', ' ONE ', {
      'X-Forwarded-For': '203.0.113.1',
    });
    await login(ib, 'SAME.NAME', 201, 'tenant', 'one', {
      'X-Forwarded-For': '203.0.113.2',
    });
    await login(ia, 'same.name', 429, 'tenant', 'one', {
      'X-Forwarded-For': '203.0.113.3',
    });
    await login(ib, 'same.name', 201, 'tenant', 'two', {
      'X-Forwarded-For': '203.0.113.3',
    });
    await login(ia, 'same.name', 201, 'platform', 'one', {
      'X-Forwarded-For': '203.0.113.3',
    });
    await login(ia, 'unknown.name', 201, 'tenant', 'one', {
      'X-Forwarded-For': '203.0.113.4',
    });
    for (const input of [undefined, 'bad', '127.0.0.1'])
      await login(
        ia,
        'same.name',
        400,
        'tenant',
        'one',
        input ? { 'X-Forwarded-For': input } : {},
      );
    await reset();
    for (let i = 0; i < 3; i++)
      await login(a, 'spoof.target', 201, 'platform', 'unused', {
        'X-Forwarded-For': `203.0.113.${i + 1}`,
      });
    await login(b, 'spoof.target', 429, 'platform', 'unused', {
      'X-Forwarded-For': '203.0.113.99',
      'X-Real-IP': '203.0.113.99',
      Forwarded: 'for=203.0.113.99',
    });
    const beforeInvalid = await redis.hLen(limiterKey('platform.sign-in'));
    for (const input of ['x'.repeat(257), '', '☃', {}, null])
      await login(a, input, 400);
    assert.equal(
      await redis.hLen(limiterKey('platform.sign-in')),
      beforeInvalid,
    );
    console.log(
      'PASS C-02: independent source and tenant-qualified identity dimensions, known/unknown path, plane separation, trusted chain and hostile forwarding/identity bounds',
    );

    await reset();
    const small = await replica(parseLimiterConfig({ LIMITER_CAPACITY: '6' }));
    for (let i = 0; i < 5; i++) await login(small, `hostile.${i}`);
    await login(small, 'hostile.overflow', 503);
    assert.equal(await redis.hLen(limiterKey('platform.sign-in')), 7);
    await reset();
    // Fill the exact approved-size registry to measure its actual Redis representation.
    const fields = { __policy: '60:10:900000:8192' };
    for (let i = 0; i < 8192; i++)
      fields[`i:${identifyingHash([String(i)])}`] = '1';
    await redis.hSet(limiterKey('platform.sign-in'), fields);
    await redis.pExpire(limiterKey('platform.sign-in'), 10000);
    const memory = await redis.sendCommand([
      'MEMORY',
      'USAGE',
      limiterKey('platform.sign-in'),
    ]);
    assert.ok(Number(memory) > 0 && Number(memory) < 2 * 1024 * 1024);
    const normal = await replica();
    await login(normal, 'capacity.overflow', 503);
    assert.equal(await redis.hLen(limiterKey('platform.sign-in')), 8193);
    console.log(
      `PASS C-02 capacity: hostile allocation stopped at cap; full 8,192-counter Redis registry uses ${memory} bytes (<2 MiB per operation)`,
    );

    await reset();
    for (const mode of ['drop', 'pause']) {
      const p = await proxy(mode),
        c = await replica(defaults, { limiterUrl: p.url });
      p.arm();
      const start = Date.now();
      await login(c, `failure.${mode}`, 503);
      assert.ok(Date.now() - start < 2000);
      assert.equal(p.seen(), true);
      assert.equal((await c('stats')).verification, 0);
      if (mode === 'drop')
        assert.ok(
          await redis.hGet(
            limiterKey('platform.sign-in'),
            `i:${identifyingHash([`failure.${mode}`])}`,
          ),
        );
    }
    const user = `limit_${randomBytes(5).toString('hex')}`,
      password = randomBytes(24).toString('hex');
    users.push(user);
    secrets.push(password);
    await redis.sendCommand([
      'ACL',
      'SETUSER',
      user,
      'on',
      `>${password}`,
      '~myims:limiter:*',
      '+hello',
      '+client',
      '+ping',
      '+config|get',
      '+eval',
      '+time',
      '+hget',
      '+hlen',
      '+pttl',
      '+hset',
    ]);
    const aclUrl = new URL(redis.options.url);
    aclUrl.username = user;
    aclUrl.password = password;
    const acl = await replica(defaults, { limiterUrl: aclUrl.href });
    await login(acl, 'acl.failure', 503);
    assert.equal(await redis.exists(limiterKey('platform.sign-in')), 1); // Earlier drop retained state, but ACL cannot create a new counter.
    assert.equal(
      await redis.hGet(
        limiterKey('platform.sign-in'),
        `i:${identifyingHash(['acl.failure'])}`,
      ),
      null,
    );
    await redis.sendCommand(['ACL', 'SETUSER', user, '-eval']);
    await http(acl, 'platform', s.token, 503);
    assert.equal((await acl('stats')).protected, 0);
    await reset();
    const live = await issue(normal, facts),
      raw = await redis.get(key(live.token));
    await redis.configSet('maxmemory', '1');
    try {
      assert.equal(await redis.get(key(live.token)), raw);
      await http(normal, 'platform', live.token, 503);
      await login(normal, 'oom.failure', 503);
      for (const operation of ['issue', 'renew', 'revoke']) {
        const result = await normal(
          operation,
          ...(operation === 'issue'
            ? [facts, 'web']
            : operation === 'renew'
              ? [live.token, ref(live), 'successful-operational']
              : [live.token, ref(live)]),
        );
        // DEL can succeed under OOM, but a required durable write cannot be claimed without confirmation.
        if (operation === 'revoke')
          assert.ok(['revoked', 'unavailable'].includes(result.kind));
        else assert.equal(result.kind, 'unavailable');
      }
      assert.equal((await normal('stats')).protected, 0);
    } finally {
      await redis.configSet('maxmemory', '134217728');
    }
    console.log(
      'PASS C-03: real ambiguous limiter write/timeout, ACL denial and noeviction OOM retain readable records but deny verification/protected admission; lifecycle write failures remain explicit',
    );

    await reset();
    const retained = await issue(normal, facts),
      absent = await issue(normal, facts),
      revoked = await issue(normal, staffFacts),
      rotated = await issue(normal, staffFacts),
      stale = await issue(normal, facts);
    const captures = await Promise.all(
      [revoked, rotated, stale].map((v) => redis.get(key(v.token))),
    );
    await redis.del(key(absent.token));
    assert.equal(
      (await normal('revoke', revoked.token, ref(revoked))).kind,
      'revoked',
    );
    assert.equal(
      (await normal('rotate', rotated.token, ref(rotated))).kind,
      'rotated',
    );
    // Preserve a valid independent tenant session while canonical platform versions change.
    const tenantSession = await issue(normal, {
      plane: 'tenant',
      identityId: staffId,
      tenantId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    await owner.query(
      'UPDATE public.platform_operators SET authentication_version=authentication_version+1,version=version+1 WHERE id=$1',
      [operatorId],
    );
    for (let i = 0; i < captures.length; i++)
      await redis.set(key([revoked, rotated, stale][i].token), captures[i], {
        PX: 60000,
      });
    const pg = await relay(appUrl);
    relays.push(pg);
    const ga = await replica(defaults, {
        runtimeUrl: pg.url,
        canonicalUrl: pg.url,
      }),
      gb = await replica(defaults, {
        runtimeUrl: pg.url,
        canonicalUrl: pg.url,
      });
    pg.set(false);
    for (const c of [ga, gb]) {
      await http(c, `staff/${tenantId}`, tenantSession.token, 503);
      await http(c, 'health/live');
    }
    for (const c of [normal, ga, gb]) await c('prepare', 'admission');
    // Actual fixture-owned Redis shutdown; current PostgreSQL stays durable.
    try {
      await redis.sendCommand(['SHUTDOWN', 'SAVE']);
    } catch {
      /* Expected EOF. */
    }
    for (const c of [normal, ga, gb]) {
      await http(c, 'platform', stale.token, 503);
      await http(c, 'health/live');
    }
    process.stdout.write('SESSION_FIXTURE_RESTART\n');
    if (redis.isOpen) redis.destroy();
    for (let i = 0; i < 100; i++) {
      try {
        await redis.connect();
        break;
      } catch {
        assert.ok(i < 99, 'Integrated Redis restart deadline');
        await delay(50);
      }
    }
    // Recovery interrupted at the primary dependency keeps both gates unavailable.
    for (const c of [ga, gb])
      await http(c, `staff/${tenantId}`, tenantSession.token, 503);
    pg.set(true);
    for (const c of [normal, ga, gb]) await c('release');
    for (const c of [ga, gb]) {
      await http(c, `staff/${tenantId}`, tenantSession.token);
      for (const old of [retained, absent, revoked, rotated, stale])
        await http(
          c,
          old.record.plane === 'tenant' ? `staff/${tenantId}` : 'platform',
          old.token,
          401,
        );
    }
    assert.equal(await redis.get(key(absent.token)), null);
    // Actual lost key on otherwise-current authority stays lost after recovery.
    const lostTenant = await issue(normal, {
      plane: 'tenant',
      identityId: staffId,
      tenantId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    await redis.del(key(lostTenant.token));
    for (const c of [ga, gb])
      await http(c, `staff/${tenantId}`, lostTenant.token, 401);
    console.log(
      'PASS C-04/05: actual stale-record restore/restart and interrupted primary recovery on both HTTP replicas, selective retained authority, durable revoked/rotated/canonical denial and lost-session sign-in requirement',
    );
  } finally {
    await redis.configSet('maxmemory', '134217728');
    for (const user of users) await redis.sendCommand(['ACL', 'DELUSER', user]);
    await reset();
    for (const c of calls) await c('close');
    for (const p of relays) await p.close();
  }
}
