import { checkPlatformAuth } from './check-platform-auth.mjs';
import { checkDistributedLimits } from './check-session-limits.mjs';
import { checkHttpAuthority } from './check-session-authority.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 &&
      ['--lifecycle', '--authority', '--limits', '--platform-auth'].includes(
        selection[0],
      )),
  'Supported selections: --lifecycle, --authority, --limits (default: all)',
);
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = backend('pg');
const { createClient } = backend('redis');
const { loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { parseSessionConfig } = backend('@myims/config');
const { record: validRecord } = backend(
  './dist/modules/identity/domain/session.js',
);
const { PostgresSessionFences } = backend(
  './dist/modules/identity/adapters/db/session-fences.js',
);
const { SafeLogger } = backend('./dist/infrastructure/execution/logging.js');
const { redisUrl } = JSON.parse(readFileSync(0, 'utf8'));
const settings = parseSessionConfig({
  SESSION_TIMEOUT_MS: '200',
  SESSION_WEB_IDLE_SECONDS: '60',
  SESSION_WEB_ABSOLUTE_SECONDS: '120',
});
const defaults = parseSessionConfig({});
assert.deepEqual(defaults.web, { idleMs: 3600000, absoluteMs: 43200000 });
assert.deepEqual(defaults.mobile, { idleMs: 86400000, absoluteMs: 604800000 });
for (const key of [
  'SESSION_WEB_IDLE_SECONDS',
  'SESSION_MOBILE_ABSOLUTE_SECONDS',
  'SESSION_TIMEOUT_MS',
  'SESSION_CONCURRENCY',
])
  for (const value of [
    '0',
    'Infinity',
    '-1',
    '1.5',
    'secret-sentinel',
    '999999999',
  ]) {
    assert.throws(
      () => parseSessionConfig({ [key]: value }),
      (error) => !error.message.includes('secret-sentinel'),
    );
  }
assert.throws(() => parseSessionConfig({ SESSION_WEB_ABSOLUTE_SECONDS: '1' }));
const { adminUrl, runtimeUrl } = loadMigrationConfig();
const name = `myims_session_${randomBytes(6).toString('hex')}`;
const trusted = new URL(adminUrl),
  app = new URL(runtimeUrl);
trusted.pathname = app.pathname = `/${name}`;
const admin = new Client({ connectionString: adminUrl });
const owner = new Client({ connectionString: trusted.href });
const runtime = new Client({ connectionString: app.href });
for (const c of [admin, owner, runtime]) c.on('error', () => {});
const redis = createClient({
  url: redisUrl,
  socket: { reconnectStrategy: false },
});
redis.on('error', () => {});
const children = [],
  captured = [],
  secrets = [],
  proxies = [];
let created = false,
  connected = false;
const key = (token) =>
  `myims:session:v1:${createHash('sha256').update(token).digest('hex')}`;
const ref = (s) => ({
  lifecycleId: s.record.lifecycleId,
  generation: s.record.generation,
});
async function deploy() {
  const child = spawn(
    process.execPath,
    ['services/backend/dist/entrypoints/deployment/main.js', 'migrate'],
    {
      env: {
        ...process.env,
        DATABASE_URL: app.href,
        DATABASE_PASSWORD_FILE: undefined,
        MIGRATION_DATABASE_URL: trusted.href,
        MIGRATION_DATABASE_PASSWORD_FILE: undefined,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  assert.equal(code, 0, output);
}
async function worker(override = {}) {
  const child = fork(new URL('./session-fixture.mjs', import.meta.url), [], {
    silent: true,
  });
  children.push(child);
  child.stdout.on('data', (d) => captured.push(d.toString()));
  child.stderr.on('data', (d) => captured.push(d.toString()));
  let sequence = 0;
  const pending = new Map();
  child.on('message', (m) => {
    pending.get(m.id)?.resolve(m);
    pending.delete(m.id);
  });
  child.on('exit', () => {
    for (const entry of pending.values()) entry.reject();
    pending.clear();
  });
  const call = (operation, ...args) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Session fixture deadline: ${operation}`));
      }, 15000);
      pending.set(id, {
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m.result ?? m);
        },
        reject: () => {
          clearTimeout(timer);
          reject(new Error('Session fixture interrupted'));
        },
      });
      child.send(
        operation === 'init'
          ? {
              id,
              operation,
              runtimeUrl: app.href,
              redisUrl,
              config: settings,
              ...override,
            }
          : { id, operation, args },
      );
    });
  const initialized = await call('init');
  assert.equal(initialized.ready, true);
  call.url = initialized.url;
  call.child = child;
  return call;
}
async function issue(call, facts = platform, consumer = 'web') {
  const s = await call('issue', facts, consumer);
  assert.equal(s.kind, 'issued');
  secrets.push(s.token, key(s.token).split(':').at(-1));
  return s;
}
async function state(call, token, kind) {
  assert.equal((await call('lookup', token)).kind, kind);
}
// Real TCP response-loss proxy: lets Redis execute mutations, drops the response.
async function proxy(mode = 'drop') {
  const target = new URL(redisUrl);
  const sockets = new Set();
  let armed = false,
    seen = false;
  const server = createServer((client) => {
    const upstream = connect({
      host: target.hostname,
      port: Number(target.port),
    });
    sockets.add(client);
    sockets.add(upstream);
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.on('data', (bytes) => {
      const mutating = /\r\n(?:EVAL|DEL)\r\n/i.test(bytes.toString());
      if (armed && mutating) {
        seen = true;
        if (mode === 'pause') {
          return;
        }
        upstream.write(bytes);
      } else upstream.write(bytes);
    });
    upstream.on('data', (bytes) => {
      if (seen && mode === 'drop') {
        client.destroy();
        upstream.destroy();
      } else client.write(bytes);
    });
    client.on('close', () => {
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(redisUrl);
  url.hostname = '127.0.0.1';
  url.port = String(server.address().port);
  const p = {
    url: url.href,
    arm: () => {
      armed = true;
    },
    seen: () => seen,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
  proxies.push(p);
  return p;
}
// Suppress a real PostgreSQL CommandComplete(COMMIT) only after a fence mutation.
async function commitProxy() {
  const sockets = new Set();
  let dropped = false;
  const server = createServer((downstream) => {
    const upstream = connect({
      host: app.hostname,
      port: Number(app.port || 5432),
    });
    for (const socket of [downstream, upstream]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    }
    let mutation = false,
      tail = '',
      received = Buffer.alloc(0);
    downstream.on('data', (bytes) => {
      tail = (tail + bytes.toString()).slice(-8192);
      if (/(?:INSERT INTO|UPDATE) public\.session_fences/.test(tail))
        mutation = true;
      upstream.write(bytes);
    });
    upstream.on('data', (bytes) => {
      received = Buffer.concat([received, bytes]);
      while (received.length >= 5) {
        const size = received.readUInt32BE(1) + 1;
        if (size < 5 || size > 1048576) {
          downstream.destroy();
          upstream.destroy();
          return;
        }
        if (received.length < size) break;
        const frame = received.subarray(0, size);
        received = received.subarray(size);
        if (
          mutation &&
          frame[0] === 67 &&
          frame.subarray(5).toString() === 'COMMIT\0'
        ) {
          dropped = true;
          downstream.destroy();
          upstream.destroy();
          return;
        }
        downstream.write(frame);
      }
    });
    downstream.on('close', () => upstream.destroy());
    upstream.on('close', () => downstream.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(app);
  url.hostname = '127.0.0.1';
  url.port = String(server.address().port);
  url.searchParams.delete('sslmode');
  const p = {
    url: url.href,
    dropped: () => dropped,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
  proxies.push(p);
  return p;
}
const platform = {
  plane: 'platform',
  identityId: randomUUID(),
  authenticationVersion: 1,
};
const tenantId = randomUUID(),
  staffId = randomUUID();
const staff = {
  plane: 'tenant',
  identityId: staffId,
  tenantId,
  authenticationVersion: 1,
  tenantAuthorityVersion: 1,
};
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  await deploy();
  await deploy();
  await owner.connect();
  await runtime.connect();
  connected = true;
  for (let i = 0; i < 60; i++) {
    try {
      await redis.connect();
      break;
    } catch {
      if (i === 59) throw new Error('Fixture Redis unavailable');
      await delay(50);
    }
  }
  await owner.query(
    "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,'session.operator','active','ready','credential-sentinel',clock_timestamp())",
    [platform.identityId],
  );
  await owner.query(
    "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,'session.tenant','Fixture','active')",
    [tenantId],
  );
  await owner.query(
    "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'session.staff','active','ready','credential-sentinel',clock_timestamp(),ARRAY['call_taker'])",
    [staffId, tenantId],
  );
  if (selection[0] !== '--lifecycle')
    await checkHttpAuthority({
      owner,
      runtime,
      worker,
      redis,
      issue,
      key,
      ref,
      secrets,
      appUrl: app.href,
    });
  if (selection.length === 0 || selection[0] === '--platform-auth')
    await checkPlatformAuth({
      owner,
      runtime,
      worker,
      redis,
      issue,
      key,
      ref,
      secrets,
      appUrl: app.href,
      proxy,
      commitProxy,
    });
  if (selection.length === 0 || selection[0] === '--limits')
    await checkDistributedLimits({
      owner,
      worker,
      redis,
      issue,
      key,
      ref,
      secrets,
      appUrl: app.href,
      proxy,
    });
  const a = await worker(),
    b = await worker();
  const s = await issue(a),
    other = await issue(b),
    t = await issue(a, staff),
    mobile = await issue(a, staff, 'mobile');
  assert.notEqual(s.token, other.token);
  assert.match(s.token, /^[A-Za-z0-9_-]{43}$/);
  await state(b, s.token, 'found');
  await state(b, t.token, 'found');
  await state(a, mobile.token, 'found');
  const raw = await redis.get(key(s.token));
  assert.ok(!raw.includes(s.token));
  assert.ok(!raw.includes('session.operator'));
  assert.ok(!raw.includes('credential-sentinel'));
  const allKeys = await redis.keys('*');
  assert.ok(
    allKeys.every(
      (k) =>
        /^myims:session:v1:[a-f0-9]{64}$/.test(k) ||
        /^myims:limiter:v1:(platform|tenant)\.(sign-in|protected)$/.test(k),
    ),
  );
  for (const value of [
    null,
    '',
    s.token + 'x',
    'x'.repeat(10000),
    s.token.slice(0, -1) + 'B',
  ])
    await state(a, value, 'invalid');
  for (const r of [
    { ...s.record, schema: 2 },
    { ...s.record, tenantId },
    { ...s.record, authenticationVersion: 0 },
    { ...t.record, tenantAuthorityVersion: NaN },
    { ...s.record, idleExpiresAt: 0 },
    { ...s.record, roles: ['administrator'] },
    { ...s.record, plane: 'other' },
  ]) {
    assert.equal(validRecord(r), false);
    await redis.set(key(s.token), JSON.stringify(r));
    await state(b, s.token, 'invalid');
  }
  await redis.set(key(s.token), 'x'.repeat(100000));
  await state(b, s.token, 'invalid');
  await redis.set(key(s.token), raw, { PX: 60000 });
  assert.equal(
    (await a('issue', { ...platform, authenticationVersion: 2 }, 'web')).kind,
    'conflict',
  );
  assert.equal(
    (await a('issue', { ...platform, tenantId }, 'web')).kind,
    'invalid',
  );
  // Required fence audit writes must roll back together, before any Redis change.
  for (const operation of ['created', 'rotated', 'revoked']) {
    const session = operation === 'created' ? null : await issue(a);
    const beforeCount = Number(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.session_fences',
        )
      ).rows[0].n,
    );
    await owner.query(
      `ALTER TABLE public.audit_events ADD CONSTRAINT session_fixture_audit CHECK (event_type <> 'identity.session-fence' OR metadata->>'operation' <> '${operation}') NOT VALID`,
    );
    const outcome = await a(
      operation === 'created'
        ? 'issue'
        : operation === 'rotated'
          ? 'rotate'
          : 'revoke',
      ...(session ? [session.token, ref(session)] : [platform, 'web']),
    );
    assert.equal(outcome.kind, 'unavailable');
    assert.equal(
      Number(
        (
          await owner.query(
            'SELECT count(*)::int AS n FROM public.session_fences',
          )
        ).rows[0].n,
      ),
      beforeCount,
    );
    if (session) await state(b, session.token, 'found');
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT session_fixture_audit',
    );
  }
  const interrupted = await worker();
  const beforeInterrupt = Number(
    (await owner.query('SELECT count(*)::int AS n FROM public.session_fences'))
      .rows[0].n,
  );
  await owner.query('BEGIN');
  await owner.query('LOCK TABLE public.audit_events IN SHARE MODE');
  const issuing = interrupted('issue', platform, 'web');
  // Install the rejection handler before killing the independent OS process.
  const rejection = assert.rejects(issuing, /interrupted/);
  try {
    for (let i = 0; i < 50; i++) {
      await owner.query('SELECT pg_stat_clear_snapshot()');
      const { rows } = await owner.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE 'INSERT INTO public.audit_events%'",
        [name],
      );
      if (rows[0].n > 0) break;
      if (i === 49)
        throw new Error('Session audit interruption barrier failed');
      await delay(5);
    }
    interrupted.child.kill('SIGKILL');
    await rejection;
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal(
    Number(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.session_fences',
        )
      ).rows[0].n,
    ),
    beforeInterrupt,
  );
  console.log(
    'PASS: required audit failures and independent precommit process interruption roll back fence metadata',
  );
  console.log(
    'PASS A-01/02: approved bounded policy, canonical issuance, independent plane records, random/hash-only tokens and malformed input denial',
  );

  const ttl = await redis.pTTL(key(other.token));
  assert.ok(ttl > 0 && ttl <= other.record.idleExpiresAt - Date.now());
  for (const activity of ['denied', 'failed', 'unavailable', 'passive']) {
    const before = await redis.get(key(other.token));
    await a('renew', other.token, ref(other), activity);
    assert.equal(await redis.get(key(other.token)), before);
  }
  const renewed = await a(
    'renew',
    other.token,
    ref(other),
    'successful-operational',
  );
  assert.equal(renewed.kind, 'found');
  assert.equal(
    renewed.record.absoluteExpiresAt,
    other.record.absoluteExpiresAt,
  );
  assert.equal(renewed.record.createdAt, other.record.createdAt);
  for (const boundary of ['idle', 'absolute']) {
    const expired = await issue(a);
    const now = Number(
      (
        await owner.query(
          'SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now',
        )
      ).rows[0].now,
    );
    const r = {
      ...expired.record,
      createdAt: now - 1000,
      lastActivityAt: now - 500,
      idleExpiresAt: now,
      ...(boundary === 'absolute' ? { absoluteExpiresAt: now } : {}),
    };
    if (boundary === 'absolute') {
      await owner.query(
        'ALTER TABLE public.session_fences DISABLE TRIGGER session_fence_protection',
      );
      await owner.query(
        'UPDATE public.session_fences SET absolute_expires_at=$2 WHERE id=$1',
        [r.lifecycleId, now],
      );
      await owner.query(
        'ALTER TABLE public.session_fences ENABLE TRIGGER session_fence_protection',
      );
    }
    await redis.set(key(expired.token), JSON.stringify(r));
    assert.equal(await redis.pTTL(key(expired.token)), -1);
    await state(b, expired.token, 'invalid');
    assert.equal(
      (await a('renew', expired.token, ref(expired), 'successful-operational'))
        .kind,
      'invalid',
    );
  }
  const capped = await issue(a);
  const near = {
    ...capped.record,
    createdAt: capped.record.createdAt - 119000,
    lastActivityAt: capped.record.createdAt,
    idleExpiresAt: capped.record.absoluteExpiresAt - 119000,
    absoluteExpiresAt: capped.record.absoluteExpiresAt - 119000,
  };
  // Explicit fixture deadline changes require owner-only trigger bypass; runtime cannot.
  await owner.query(
    'ALTER TABLE public.session_fences DISABLE TRIGGER session_fence_protection',
  );
  await owner.query(
    'UPDATE public.session_fences SET absolute_expires_at=$2 WHERE id=$1',
    [near.lifecycleId, near.absoluteExpiresAt],
  );
  await owner.query(
    'ALTER TABLE public.session_fences ENABLE TRIGGER session_fence_protection',
  );
  await redis.set(key(capped.token), JSON.stringify(near));
  const cappedResult = await a(
    'renew',
    capped.token,
    ref(capped),
    'successful-operational',
  );
  assert.equal(cappedResult.kind, 'found');
  assert.equal(cappedResult.record.idleExpiresAt, near.absoluteExpiresAt);
  const missing = await issue(a);
  await redis.del(key(missing.token));
  await state(b, missing.token, 'invalid');
  assert.equal(
    (await a('renew', missing.token, ref(missing), 'successful-operational'))
      .kind,
    'invalid',
  );
  // Exercise actual Redis TTL expiry with a bounded short fixture, not a retained key.
  const short = await worker({
    config: parseSessionConfig({
      SESSION_TIMEOUT_MS: '200',
      SESSION_WEB_IDLE_SECONDS: '1',
      SESSION_WEB_ABSOLUTE_SECONDS: '3',
    }),
  });
  const physical = await issue(short);
  const physicalTtl = await redis.pTTL(key(physical.token));
  assert.ok(physicalTtl > 0 && physicalTtl <= 1000);
  for (let i = 0; i < 100 && (await redis.exists(key(physical.token))); i++)
    await delay(20);
  assert.equal(await redis.pTTL(key(physical.token)), -2);
  await state(b, physical.token, 'invalid');
  assert.equal(
    (await a('renew', physical.token, ref(physical), 'successful-operational'))
      .kind,
    'invalid',
  );
  await short('close');
  console.log(
    'PASS A-03: idle/absolute retained-key boundaries, TTL bounds, qualifying activity, fixed absolute cap and missing-record denial',
  );

  // Hold the same advisory lock and observe both independent processes waiting.
  async function race(s, first, second) {
    await owner.query('SELECT pg_advisory_lock(hashtextextended($1,60206))', [
      s.record.lifecycleId,
    ]);
    const work = [first(), second()];
    try {
      for (let i = 0; i < 100; i++) {
        const { rows } = await owner.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event='advisory'",
          [name],
        );
        if (rows[0].n >= 2) break;
        if (i === 99)
          throw new Error('Independent lifecycle lock barrier failed');
        await delay(10);
      }
    } finally {
      await owner.query(
        'SELECT pg_advisory_unlock(hashtextextended($1,60206))',
        [s.record.lifecycleId],
      );
    }
    return Promise.all(work);
  }
  const raced = await issue(a);
  const capturedOld = await redis.get(key(raced.token));
  const rotation = await race(
    raced,
    () => a('rotate', raced.token, ref(raced)),
    () => b('rotate', raced.token, ref(raced)),
  );
  assert.equal(rotation.filter((r) => r.kind === 'rotated').length, 1);
  assert.equal(rotation.filter((r) => r.kind === 'conflict').length, 1);
  assert.ok(
    rotation.filter((r) => r.kind !== 'rotated').every((r) => !('token' in r)),
  );
  const winner = rotation.find((r) => r.kind === 'rotated');
  secrets.push(winner.token);
  assert.equal(winner.record.createdAt, raced.record.createdAt);
  assert.equal(winner.record.absoluteExpiresAt, raced.record.absoluteExpiresAt);
  await state(a, raced.token, 'invalid');
  await state(b, winner.token, 'found');
  await redis.set(key(raced.token), capturedOld);
  await state(a, raced.token, 'invalid');
  await state(b, raced.token, 'invalid');
  const revoked = await issue(a);
  const revokedRaw = await redis.get(key(revoked.token));
  const results = await race(
    revoked,
    () => a('renew', revoked.token, ref(revoked), 'successful-operational'),
    () => b('revoke', revoked.token, ref(revoked)),
  );
  assert.ok(results.some((r) => r.kind === 'revoked'));
  await state(a, revoked.token, 'invalid');
  assert.equal(
    (await a('renew', revoked.token, ref(revoked), 'successful-operational'))
      .kind,
    'invalid',
  );
  assert.equal(
    (await b('revoke', revoked.token, ref(revoked))).kind,
    'revoked',
  );
  await redis.set(key(revoked.token), revokedRaw);
  await state(a, revoked.token, 'invalid');
  await state(b, revoked.token, 'invalid');
  assert.equal(
    (await a('rotate', revoked.token, ref(revoked))).kind,
    'conflict',
  );
  // Missing fences and stale/mismatched generations fail even for live restored records.
  const noFence = await issue(a);
  await owner.query(
    'ALTER TABLE public.session_fences DISABLE TRIGGER session_fence_protection',
  );
  await owner.query('DELETE FROM public.session_fences WHERE id=$1', [
    noFence.record.lifecycleId,
  ]);
  await owner.query(
    'ALTER TABLE public.session_fences ENABLE TRIGGER session_fence_protection',
  );
  await state(b, noFence.token, 'invalid');
  await state(b, other.token, 'found');
  console.log(
    'PASS A-04/06: independent process barriers, one rotation winner, revoke/renew ordering, restored actual old records and unaffected devices',
  );

  await owner.query(
    'UPDATE public.platform_operators SET authentication_version=authentication_version+1,version=version+1 WHERE id=$1',
    [platform.identityId],
  );
  const before = await redis.get(key(other.token));
  assert.equal(
    (await a('renew', other.token, ref(other), 'successful-operational')).kind,
    'invalid',
  );
  assert.equal((await a('rotate', other.token, ref(other))).kind, 'invalid');
  assert.equal(await redis.get(key(other.token)), before);
  platform.authenticationVersion++;
  const pgDown = await worker({
    runtimeUrl:
      'postgresql://myims_runtime:credential-sentinel@127.0.0.1:1/missing',
  });
  assert.equal((await pgDown('lookup', t.token)).kind, 'unavailable');
  assert.equal((await pgDown('issue', staff, 'web')).kind, 'unavailable');
  assert.equal(
    (await pgDown('renew', t.token, ref(t), 'successful-operational')).kind,
    'unavailable',
  );
  const lostRecord = await issue(a);
  await redis.del(key(lostRecord.token));
  assert.equal(
    (await b('revoke', lostRecord.token, ref(lostRecord))).kind,
    'revoked',
  );
  await redis.set(key(lostRecord.token), JSON.stringify(lostRecord.record));
  await state(a, lostRecord.token, 'invalid');
  await assert.rejects(
    runtime.query('DELETE FROM public.session_fences WHERE id=$1', [
      other.record.lifecycleId,
    ]),
    (e) => e.code === '23514',
  );
  await assert.rejects(
    runtime.query('TRUNCATE public.session_fences'),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    runtime.query(
      'UPDATE public.session_fences SET revoked=false WHERE id=$1',
      [revoked.record.lifecycleId],
    ),
    (e) => e.code === '23514',
  );
  const cleanup = new PostgresSessionFences(
    app.href,
    settings,
    new SafeLogger('http', (line) => captured.push(line)),
  );
  assert.ok((await cleanup.cleanup(1)) <= 1);
  await cleanup.close();
  assert.equal((await a('cleanupExpired', 101)).kind, 'invalid');
  const clean = await a('cleanupExpired', 1);
  assert.equal(clean.kind, 'cleaned');
  assert.ok(clean.count <= 1);
  assert.equal(
    (
      await a(
        'cleanupInvalidated',
        Array.from({ length: 101 }, () => ({
          token: t.token,
          reference: ref(t),
        })),
      )
    ).kind,
    'invalid',
  );
  console.log(
    'PASS: canonical version mismatch/outage never renews, lost-key durable revocation, runtime retention/grants and bounded cleanup',
  );

  for (const operation of ['issue', 'rotate', 'revoke']) {
    const p = await commitProxy();
    // Give the real COMMIT time to occur before deliberately dropping its response.
    // Keep the strict dropped-frame/durable-write assertions; this uses the approved
    // production command timeout rather than the 200ms fast expiry fixture.
    const c = await worker({
      runtimeUrl: p.url,
      config: { ...settings, timeoutMs: 2000 },
    });
    const session = operation === 'issue' ? null : await issue(a);
    const beforeFences = Number(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.session_fences',
        )
      ).rows[0].n,
    );
    const result = await c(
      operation,
      ...(session ? [session.token, ref(session)] : [platform, 'web']),
    );
    assert.equal(result.kind, 'unavailable');
    assert.ok(!('token' in result));
    assert.equal(p.dropped(), true);
    if (session) {
      assert.ok(await redis.get(key(session.token)));
      const durable = (
        await owner.query(
          'SELECT generation,revoked FROM public.session_fences WHERE id=$1',
          [session.record.lifecycleId],
        )
      ).rows[0];
      if (operation === 'rotate')
        assert.equal(durable.generation, session.record.generation + 1);
      else assert.equal(durable.revoked, true);
      await state(b, session.token, 'invalid');
    } else
      assert.equal(
        Number(
          (
            await owner.query(
              'SELECT count(*)::int AS n FROM public.session_fences',
            )
          ).rows[0].n,
        ),
        beforeFences + 1,
      );
  }
  console.log(
    'PASS A-05: real durable fence COMMIT-response loss returns unavailable, preserves committed audit/fences and never falls back to retained Redis authority',
  );

  // Lost responses prove writes actually reached Redis; no fake adapter failures.
  for (const operation of ['issue', 'rotate', 'revoke']) {
    console.log(`CHECK: real lost-response ${operation}`);
    const p = await proxy();
    const c = await worker({ redisUrl: p.url });
    const session = operation === 'issue' ? null : await issue(a);
    const keysBefore = await redis.keys('*');
    p.arm();
    const result = await c(
      operation,
      ...(operation === 'issue'
        ? [platform, 'web']
        : [session.token, ref(session)]),
    );
    assert.equal(result.kind, 'unavailable');
    assert.ok(!('token' in result));
    assert.equal(p.seen(), true);
    if (operation === 'issue') {
      // Earlier fixture records may expire naturally during the combined suite.
      // Prove this ambiguous write created exactly one new record, independently
      // of unrelated TTL deletions, rather than comparing total database size.
      const newKeys = (await redis.keys('myims:session:v1:*')).filter(
        (k) => !keysBefore.includes(k),
      );
      assert.equal(newKeys.length, 1);
      const persisted = JSON.parse(await redis.get(newKeys[0]));
      assert.equal(persisted.identityId, platform.identityId);
      assert.equal(persisted.plane, 'platform');
    }
    if (operation === 'rotate') {
      assert.equal(await redis.get(key(session.token)), null);
      assert.ok((await redis.keys('*')).some((k) => !keysBefore.includes(k)));
    }
    if (operation === 'revoke')
      assert.equal(await redis.get(key(session.token)), null);
    if (session) {
      await state(b, session.token, 'invalid');
      if (operation === 'rotate') {
        await redis.set(key(session.token), JSON.stringify(session.record));
        await state(b, session.token, 'invalid');
      }
    }
  }
  const p = await proxy('pause');
  const c = await worker({ redisUrl: p.url });
  p.arm();
  const start = Date.now();
  assert.equal((await c('issue', platform, 'web')).kind, 'unavailable');
  assert.ok(Date.now() - start < 2000);
  const capacitySession = await issue(a);
  await redis.configSet('maxmemory', '1');
  const capacity = await a('issue', platform, 'web');
  assert.equal(capacity.kind, 'unavailable');
  assert.ok(!('token' in capacity));
  assert.equal(
    (
      await a(
        'renew',
        capacitySession.token,
        ref(capacitySession),
        'successful-operational',
      )
    ).kind,
    'unavailable',
  );
  assert.equal(
    (await a('rotate', capacitySession.token, ref(capacitySession))).kind,
    'unavailable',
  );
  await redis.configSet('maxmemory', '134217728');
  await state(b, capacitySession.token, 'invalid');
  // Authentication fails without disclosing the password or connection URL.
  const bad = new URL(redisUrl);
  bad.password = 'authentication-sentinel';
  const authChild = fork(
    new URL('./session-fixture.mjs', import.meta.url),
    [],
    { silent: true },
  );
  children.push(authChild);
  authChild.stdout.on('data', (d) => captured.push(d.toString()));
  authChild.stderr.on('data', (d) => captured.push(d.toString()));
  const authMessage = once(authChild, 'message');
  authChild.send({
    id: 1,
    operation: 'init',
    runtimeUrl: app.href,
    redisUrl: bad.href,
    config: settings,
  });
  assert.equal((await authMessage)[0].result.kind, 'unavailable');
  authChild.kill('SIGKILL');
  console.log(
    'PASS A-05: real write-response loss, bounded command timeout, noeviction OOM and authenticated Redis rejection return unavailable',
  );

  const retained = await issue(a, staff, 'mobile');
  const absent = await issue(a, staff, 'mobile');
  await redis.del(key(absent.token));
  // The trusted host launcher handles this fixed marker; no credential is printed.
  try {
    await redis.sendCommand(['SHUTDOWN', 'SAVE']);
  } catch {
    /* Expected disconnect. */
  }
  process.stdout.write('SESSION_FIXTURE_RESTART\n');
  const recovered = createClient({
    url: redisUrl,
    socket: { reconnectStrategy: false },
  });
  recovered.on('error', () => {});
  for (let i = 0; i < 80; i++) {
    try {
      await recovered.connect();
      break;
    } catch {
      if (i === 79) throw new Error('Session Redis restart deadline');
      await delay(50);
    }
  }
  assert.ok(await recovered.get(key(retained.token)));
  assert.equal(await recovered.get(key(absent.token)), null);
  const afterRestart = await worker();
  await state(afterRestart, retained.token, 'found');
  await state(afterRestart, absent.token, 'invalid');
  await state(afterRestart, revoked.token, 'invalid');
  await state(afterRestart, raced.token, 'invalid');
  // Recovery cannot serve retained records if primary fence authority is interrupted.
  await state(pgDown, retained.token, 'unavailable');
  await afterRestart('close');
  recovered.destroy();
  console.log(
    'PASS A-05/06: actual Redis shutdown/restart retains valid records, missing records stay absent, restored predecessors remain fenced and unavailable primary gates recovery',
  );

  const audit = (
    await owner.query(
      "SELECT metadata,actor_reference,system_reason FROM public.audit_events WHERE event_type='identity.session-fence'",
    )
  ).rows;
  assert.ok(audit.length > 0);
  assert.ok(
    audit.every(
      (r) =>
        Object.keys(r.metadata).length === 1 &&
        r.actor_reference === 'identity.session-fence' &&
        r.system_reason === 'recovery-fencing',
    ),
  );
  secrets.push(
    'credential-sentinel',
    'authentication-sentinel',
    new URL(redisUrl).password,
  );
  const diagnostics = captured.join('') + JSON.stringify(audit);
  for (const secret of secrets)
    assert.ok(
      !diagnostics.includes(secret),
      'Sensitive session sentinel leaked',
    );
  for (const call of [a, b, pgDown]) await call('close');
  console.log(
    'PASS A-07 scoped: audit/safe diagnostics, no fixture HTTP issuer, fresh/rerun migrations and owned fixture cleanup',
  );
} finally {
  for (const child of children)
    if (child.exitCode === null) child.kill('SIGKILL');
  for (const p of proxies) await p.close();
  if (redis.isOpen) redis.destroy();
  if (connected) {
    await runtime.end();
    await owner.end();
  }
  if (created) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',
      [name],
    );
    await admin.query(`DROP DATABASE ${name}`);
  }
  await admin.end();
}
