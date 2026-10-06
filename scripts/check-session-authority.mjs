import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { Pool } = backend('pg');
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { StaffAuthorityMutations } = load(
  'modules/identity/adapters/db/authority-mutations',
);
const { OperatorAuthorityMutations } = load(
  'modules/platform/adapters/db/authority-mutations',
);
const { TenantAuthorityMutations } = load(
  'modules/tenancy/adapters/db/authority-mutations',
);
async function relay(targetUrl) {
  const target = new URL(targetUrl),
    sockets = new Set();
  let down = false;
  const server = createServer((client) => {
    if (down) return client.destroy();
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
    down() {
      down = true;
      for (const s of sockets) s.destroy();
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
export async function checkHttpAuthority({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  ref,
  secrets,
  appUrl,
}) {
  const tenantId = randomUUID(),
    otherTenant = randomUUID(),
    staffId = randomUUID(),
    otherStaff = randomUUID(),
    operatorId = randomUUID();
  const pool = new Pool({ connectionString: appUrl, max: 4 });
  pool.on('error', () => {});
  const calls = [],
    proxies = [];
  const hash = 'HTTP_GUARD_CREDENTIAL_SENTINEL';
  secrets.push(hash, hash + '.replacement');
  const run = (type, id, tenant, action) =>
    Transaction.run(
      pool,
      {
        actor: {
          kind: 'system',
          plane: 'system',
          tenantId: null,
          reference: 'http-fixture',
          reason: 'verification',
        },
        target: { type, reference: id, tenantId: tenant },
        correlationId: randomUUID(),
      },
      'http-fixture.mutation',
      new SafeLogger('http', () => {}),
      action,
    );
  const row = async (table, id) =>
    (await runtime.query(`SELECT * FROM public.${table} WHERE id=$1`, [id]))
      .rows[0];
  async function changeStaff(change) {
    const s = await row('staff_users', staffId);
    const r = await run('staff', staffId, tenantId, (tx) =>
      new StaffAuthorityMutations().change(
        tx,
        { plane: 'tenant', tenantId, staffId },
        s.version,
        change,
      ),
    );
    assert.equal(r.kind, 'found');
    return r;
  }
  async function changeOperator(change) {
    const s = await row('platform_operators', operatorId);
    assert.equal(
      (
        await run('operator', operatorId, null, (tx) =>
          new OperatorAuthorityMutations().change(
            tx,
            { plane: 'platform', operatorId },
            s.version,
            change,
          ),
        )
      ).kind,
      'found',
    );
  }
  async function changeTenant(status) {
    const t = await row('tenants', tenantId);
    assert.equal(
      (
        await run('tenant', tenantId, null, (tx) =>
          new TenantAuthorityMutations().status(
            tx,
            { tenantId },
            t.version,
            status,
          ),
        )
      ).kind,
      'found',
    );
  }
  async function facts(plane = 'tenant', tenant = tenantId, id = staffId) {
    const s = await row(
      plane === 'tenant' ? 'staff_users' : 'platform_operators',
      plane === 'tenant' ? id : operatorId,
    );
    return {
      plane,
      identityId: s.id,
      authenticationVersion: s.authentication_version,
      ...(plane === 'tenant'
        ? {
            tenantId: tenant,
            tenantAuthorityVersion: (await row('tenants', tenant))
              .authority_version,
          }
        : {}),
    };
  }
  async function http(call, path, token, status = 200, options = {}) {
    const response = await fetch(`${call.url}/${path}`, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `HTTP ${path}: expected ${status}, got ${response.status}: ${JSON.stringify(data)}`,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (status === 503) assert.equal(response.headers.get('retry-after'), '1');
    const text = JSON.stringify(data);
    for (const secret of secrets)
      assert.ok(!text.includes(secret), 'HTTP secret leakage');
    return data;
  }
  async function both(s, status = 401, path = `staff/${tenantId}`) {
    for (const c of [a, b]) await http(c, path, s.token, status);
  }
  async function issued(call = a, plane = 'tenant') {
    return issue(call, await facts(plane));
  }
  let a, b;
  try {
    await owner.query(
      'CREATE SCHEMA guard_fixture; CREATE TABLE guard_fixture.writes(tenant_id uuid,actor_id uuid); GRANT USAGE ON SCHEMA guard_fixture TO myims_runtime; GRANT SELECT,INSERT ON guard_fixture.writes TO myims_runtime',
    );
    for (const [id, code] of [
      [tenantId, 'guard.one'],
      [otherTenant, 'guard.two'],
    ])
      await owner.query(
        "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'HTTP Fixture','active')",
        [id, code],
      );
    for (const [id, tenant] of [
      [staffId, tenantId],
      [otherStaff, otherTenant],
    ])
      await owner.query(
        "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'same.name','active','ready',$3,clock_timestamp(),ARRAY['call_taker'])",
        [id, tenant, hash],
      );
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,'same.name','active','ready',$2,clock_timestamp())",
      [operatorId, hash],
    );
    a = await worker({ http: true });
    b = await worker({ http: true });
    calls.push(a, b);
    assert.notEqual(a.child.pid, b.child.pid);
    assert.notEqual(a.url, b.url);
    const s = await issued(),
      p = await issued(a, 'platform'),
      other = await issue(a, await facts('tenant', otherTenant, otherStaff));
    const first = await http(a, `staff/${tenantId}`, s.token);
    assert.deepEqual(first, await http(b, `staff/${tenantId}`, s.token));
    assert.equal(first.principal.staffId, staffId);
    assert.equal(first.actor.reference, staffId);
    assert.equal(first.actor.tenantId, tenantId);
    await http(
      b,
      `staff/${tenantId}?tenantId=${otherTenant}&roles=tenant_admin&identityId=${otherStaff}`,
      s.token,
      200,
      {
        headers: {
          'x-tenant-id': otherTenant,
          'x-role': 'tenant_admin',
          'x-identity-id': operatorId,
        },
      },
    );
    await http(b, `staff/${otherTenant}`, other.token);
    await http(a, `staff/${otherTenant}`, s.token, 403);
    await http(b, `staff/${tenantId}`, other.token, 403);
    await both(p, 403);
    await both(s, 403, 'platform');
    await both(p, 200, 'platform');
    await http(a, 'health/live');
    await http(b, 'health/live');
    await http(a, 'unclassified', s.token, 403);
    for (const c of [a, b]) {
      await http(c, `staff/${tenantId}`, undefined, 401);
      await http(c, `staff/${tenantId}`, 'malformed', 401);
      await http(c, `staff/${tenantId}`, s.token, 401, {
        headers: { Cookie: `session=${p.token}` },
      });
    }
    const raw = await redis.get(key(s.token));
    await both(s, 403, `manage/${tenantId}`);
    await http(a, 'fail', s.token, 409, { method: 'POST' });
    await http(a, `staff/${otherTenant}/write`, s.token, 403, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        staffId: otherStaff,
        roles: ['tenant_admin'],
      }),
    });
    assert.equal(await redis.get(key(s.token)), raw);
    await delay(10);
    await http(b, `staff/${tenantId}/write`, s.token, 201, { method: 'POST' });
    assert.ok(
      JSON.parse(await redis.get(key(s.token))).lastActivityAt >
        JSON.parse(raw).lastActivityAt,
    );
    const audit = (
      await owner.query(
        "SELECT actor_reference,actor_tenant_id,identity_plane FROM public.audit_events WHERE event_type='guard-fixture.write'",
      )
    ).rows;
    assert.deepEqual(audit, [
      {
        actor_reference: staffId,
        actor_tenant_id: tenantId,
        identity_plane: 'tenant',
      },
    ]);
    console.log(
      'PASS B-02/04: independent HTTP replicas share canonical principals; plane, permissions, ownership, hostile fields, explicit policies and canonical audit',
    );

    // Real owner mutations, stale raw Redis restores, and same-fact restorations.
    for (const [remove, restore] of [
      [
        { kind: 'roles', roles: ['responder'] },
        { kind: 'roles', roles: ['call_taker'] },
      ],
      [
        { kind: 'status', status: 'disabled' },
        { kind: 'status', status: 'active' },
      ],
      [
        {
          kind: 'credential',
          credentialState: 'unset',
          passwordHash: null,
          credentialChangedAt: null,
        },
        {
          kind: 'credential',
          credentialState: 'ready',
          passwordHash: hash,
          credentialChangedAt: new Date(),
        },
      ],
      [
        {
          kind: 'credential',
          credentialState: 'ready',
          passwordHash: hash + '.replacement',
          credentialChangedAt: new Date(),
        },
        {
          kind: 'credential',
          credentialState: 'ready',
          passwordHash: hash,
          credentialChangedAt: new Date(),
        },
      ],
    ]) {
      const old = await issued(),
        snapshot = await redis.get(key(old.token));
      await changeStaff(remove);
      await both(old);
      await redis.set(key(old.token), snapshot, { PX: 60000 });
      await both(old);
      await changeStaff(restore);
      await redis.set(key(old.token), snapshot, { PX: 60000 });
      await both(old);
      await both(await issued(), 200);
    }
    for (const state of ['draft', 'suspended', 'retired']) {
      const old = await issued(),
        snapshot = await redis.get(key(old.token));
      await changeTenant(state);
      await both(old);
      await changeTenant('active');
      await redis.set(key(old.token), snapshot, { PX: 60000 });
      await both(old);
      await both(await issued(), 200);
    }
    for (const [remove, restore] of [
      [
        { kind: 'status', status: 'disabled' },
        { kind: 'status', status: 'active' },
      ],
      [
        {
          kind: 'credential',
          credentialState: 'unset',
          passwordHash: null,
          credentialChangedAt: null,
        },
        {
          kind: 'credential',
          credentialState: 'ready',
          passwordHash: hash,
          credentialChangedAt: new Date(),
        },
      ],
    ]) {
      const old = await issued(a, 'platform'),
        snapshot = await redis.get(key(old.token));
      await changeOperator(remove);
      await both(old, 401, 'platform');
      await changeOperator(restore);
      await redis.set(key(old.token), snapshot, { PX: 60000 });
      await both(old, 401, 'platform');
    }
    // Unknown/malformed canonical authority must deny even with matching versions.
    const malformed = await issued();
    await owner.query('ALTER TABLE public.staff_users DISABLE TRIGGER USER');
    const constraints = (
      await owner.query(
        "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.staff_users'::regclass AND pg_get_constraintdef(oid) LIKE '%roles%'",
      )
    ).rows;
    for (const c of constraints)
      await owner.query(
        `ALTER TABLE public.staff_users DROP CONSTRAINT ${c.conname}`,
      );
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['unknown'] WHERE id=$1",
      [staffId],
    );
    await both(malformed);
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['call_taker'] WHERE id=$1",
      [staffId],
    );
    for (const c of constraints)
      await owner.query(
        `ALTER TABLE public.staff_users ADD CONSTRAINT ${c.conname} ${c.definition}`,
      );
    await owner.query('ALTER TABLE public.staff_users ENABLE TRIGGER USER');
    console.log(
      'PASS B-03/06: audited role/account/credential/tenant changes and restored canonical facts never revive stale Redis sessions; unknown roles deny',
    );

    // Barrier before transaction: a changed expected version rejects without writing.
    let active = await issued();
    await a('prepare', 'before-lock');
    let pending = http(a, `staff/${tenantId}/write`, active.token, 401, {
      method: 'POST',
    });
    for (let i = 0; !(await a('barrier')).entered; i++) {
      assert.ok(i < 200);
      await delay(10);
    }
    const count = async () =>
      (await owner.query('SELECT count(*)::int AS n FROM guard_fixture.writes'))
        .rows[0].n;
    const before = await count();
    const beforeRaw = await redis.get(key(active.token));
    await changeStaff({ kind: 'roles', roles: ['responder'] });
    await a('release');
    await pending;
    assert.equal(await count(), before);
    assert.equal(await redis.get(key(active.token)), beforeRaw);
    await changeStaff({ kind: 'roles', roles: ['call_taker'] });
    // Lock acquired first: owner mutation blocks behind the sensitive transaction.
    active = await issued();
    await a('prepare', 'after-lock');
    pending = http(a, `staff/${tenantId}/write`, active.token, [201, 401], {
      method: 'POST',
    });
    for (let i = 0; !(await a('barrier')).entered; i++) {
      assert.ok(i < 200);
      await delay(10);
    }
    const mutation = changeTenant('suspended');
    let blocked = false;
    for (let i = 0; i < 200; i++) {
      blocked = (
        await owner.query(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%public.tenants%FOR UPDATE%') AS blocked",
        )
      ).rows[0].blocked;
      if (blocked) break;
      await delay(10);
    }
    assert.ok(blocked, 'Canonical mutation must be lock blocked');
    await a('release');
    await mutation;
    await pending;
    assert.equal(await count(), before + 1);
    await changeTenant('active');
    // Request authorized before revocation cannot recreate the session on late renewal.
    active = await issued();
    await a('prepare', 'activity');
    pending = http(a, 'activity', active.token, 401, { method: 'POST' });
    for (let i = 0; !(await a('barrier')).entered; i++) {
      assert.ok(i < 200);
      await delay(10);
    }
    const snapshot = await redis.get(key(active.token));
    assert.equal(
      (await b('revoke', active.token, ref(active))).kind,
      'revoked',
    );
    await a('release');
    await pending;
    assert.equal(await redis.get(key(active.token)), null);
    await redis.set(key(active.token), snapshot, { PX: 60000 });
    await both(active);
    const expired = await issued();
    await redis.set(
      key(expired.token),
      JSON.stringify({
        ...expired.record,
        idleExpiresAt: expired.record.createdAt + 1,
      }),
      { PX: 60000 },
    );
    await both(expired);
    console.log(
      'PASS B-05/06: barrier-controlled expected-version rejection, serialized tenant mutation, late revocation renewal and restored recovery fence',
    );

    // Real transport outages with runtime grants: canonical failure is not missing.
    const dbProxy = await relay(appUrl);
    proxies.push(dbProxy);
    const dbDownA = await worker({ http: true, canonicalUrl: dbProxy.url }),
      dbDownB = await worker({ http: true, canonicalUrl: dbProxy.url });
    calls.push(dbDownA, dbDownB);
    active = await issued();
    await http(dbDownA, `staff/${tenantId}`, active.token);
    dbProxy.down();
    const stable = await redis.get(key(active.token)),
      stableCount = await count();
    for (const c of [dbDownA, dbDownB]) {
      await http(c, `staff/${tenantId}/write`, active.token, 503, {
        method: 'POST',
      });
      await http(c, 'health/live');
    }
    assert.equal(await redis.get(key(active.token)), stable);
    assert.equal(await count(), stableCount);
    const renewalProxy = await relay(redis.options.url);
    proxies.push(renewalProxy);
    const renewalReplica = await worker({
      http: true,
      redisUrl: renewalProxy.url,
    });
    calls.push(renewalReplica);
    await renewalReplica('prepare', 'activity');
    const renewalPending = http(renewalReplica, 'activity', active.token, 503, {
      method: 'POST',
    });
    for (let i = 0; !(await renewalReplica('barrier')).entered; i++) {
      assert.ok(i < 200);
      await delay(10);
    }
    renewalProxy.down();
    await renewalReplica('release');
    await renewalPending;
    assert.equal(await redis.get(key(active.token)), stable);
    const redisUrl = redis.options.url;
    const redisProxy = await relay(redisUrl);
    proxies.push(redisProxy);
    const redisDownA = await worker({ http: true, redisUrl: redisProxy.url }),
      redisDownB = await worker({ http: true, redisUrl: redisProxy.url });
    calls.push(redisDownA, redisDownB);
    await http(redisDownA, `staff/${tenantId}`, active.token);
    redisProxy.down();
    for (const c of [redisDownA, redisDownB]) {
      await http(c, `staff/${tenantId}/write`, active.token, 503, {
        method: 'POST',
      });
      await http(c, 'health/live');
    }
    assert.equal(await redis.get(key(active.token)), stable);
    assert.equal(await count(), stableCount);
    console.log(
      'PASS B-03/05/07: actual canonical PostgreSQL and Redis connection outages yield retryable HTTP 503 with no protected write/renewal and public health alive',
    );
  } finally {
    for (const c of calls) await c('close');
    for (const p of proxies) await p.close();
    await pool.end();
  }
}
