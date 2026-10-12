// Real PostgreSQL/runtime grants, isolated shared Redis and independent Nest replicas.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest, createServer } from 'node:https';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { parseSessionConfig, parseLimiterConfig } = backend('@myims/config');
const { hashPassword } = load('infrastructure/password/scrypt');
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { Pool } = backend('pg');
const { StaffAuthorityMutations } = load(
  'modules/identity/adapters/db/authority-mutations',
);
const { TenantAuthorityMutations } = load(
  'modules/tenancy/adapters/db/authority-mutations',
);
const { CredentialRuntime } = load(
  'modules/identity/adapters/db/credential-runtime',
);
const { staffSignInInput } = load('modules/identity/application/sign-in');
const { StaffIssuerBrowser } = load(
  'modules/identity/adapters/http/credential-browser',
);
const cookieName = '__Host-myims-staff';
const jar = (headers) =>
  (headers ?? [])
    .map((v) => v.split(';')[0])
    .filter((v) => !v.endsWith('='))
    .join('; ');
export async function checkStaffHttp({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  ref,
  secrets,
  appUrl,
  proxy,
  commitProxy,
}) {
  const password = ' Exact Staff Åe\u0301 password 2026 ';
  const hash = await hashPassword(Buffer.from(password));
  const settings = parseSessionConfig({ SESSION_TIMEOUT_MS: '1000' });
  const config = {
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  };
  const limiter = parseLimiterConfig({ LIMITER_TRUSTED_PROXIES: '127.0.0.1' });
  const pool = new Pool({ connectionString: appUrl, max: 2 });
  pool.on('error', () => {});
  const credentials = new CredentialRuntime({
    database: { url: appUrl },
    sessionRedis: { url: redis.options.url },
    sessions: settings,
  });
  const calls = [],
    tokens = [];
  let server, browser, selected;
  const directory = mkdtempSync(join(tmpdir(), 'myims-staff-http-'));
  secrets.push(password, hash, config.proxySecret, config.csrfSecret);
  let address = 1;
  const source = () => `192.0.2.${(address++ % 240) + 1}`;
  async function replica(overrides = {}) {
    const call = await worker({
      http: true,
      staffIssuerConfig: config,
      limiterConfig: limiter,
      config: settings,
      ...overrides,
    });
    calls.push(call);
    return call;
  }
  function request(
    call,
    path,
    {
      method = 'GET',
      cookie,
      proof,
      token,
      body,
      mobile = false,
      headers = {},
      from = source(),
    } = {},
  ) {
    return new Promise((resolve, reject) => {
      if (headers['cache-control'] === 'no-store') headers = {};
      const payload =
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body);
      const req = httpRequest(
        `${call.url}${path}`,
        {
          method,
          headers: {
            ...(mobile
              ? { 'x-staff-mobile-proxy': config.proxySecret }
              : { origin: config.origin, 'x-staff-proxy': config.proxySecret }),
            'x-forwarded-for': from,
            ...(cookie ? { cookie } : {}),
            ...(proof ? { 'x-staff-csrf': proof } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(payload === undefined
              ? {}
              : { 'content-type': 'application/json' }),
            ...headers,
          },
        },
        (res) => {
          let text = '';
          res.on('data', (b) => (text += b));
          res.on('end', () => {
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              data = null;
            }
            assert.equal(res.headers['cache-control'], 'no-store');
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text,
              data,
            });
          });
        },
      );
      req.setTimeout(15000, () =>
        req.destroy(new Error(`Staff HTTP deadline: ${path}`)),
      );
      req.on('error', reject);
      req.end(payload);
    });
  }
  async function csrf(call, cookie) {
    const r = await request(call, '/staff/auth/browser/csrf', { cookie });
    assert.equal(r.status, 200);
    secrets.push(r.data.proof);
    return {
      cookie: [cookie, jar(r.headers['set-cookie'])].filter(Boolean).join('; '),
      proof: r.data.proof,
    };
  }
  async function login(
    call,
    tenantCode,
    username = 'same.staff',
    supplied = password,
    options = {},
  ) {
    const context = options.mobile ? {} : await csrf(call, options.cookie);
    const r = await request(
      call,
      `/staff/auth/${options.mobile ? 'mobile' : 'browser'}/sign-in`,
      {
        ...context,
        method: 'POST',
        body: { tenantCode, username, password: supplied },
        ...options,
      },
    );
    if (r.status === 201) {
      r.cookie = jar(r.headers['set-cookie']);
      r.sessionToken = r.data.token ?? r.cookie.split('=')[1];
      r.proof = r.data.proof;
      secrets.push(
        r.sessionToken,
        r.proof,
        key(r.sessionToken).split(':').at(-1),
      );
      tokens.push(r.sessionToken);
      assert.equal(r.data.consumer, options.mobile ? 'mobile' : 'web');
      assert.equal(
        r.data.absoluteExpiresAt -
          JSON.parse(await redis.get(key(r.sessionToken))).createdAt,
        options.mobile ? 604800000 : 43200000,
      );
      if (!options.mobile) assert.ok(!r.text.includes(r.sessionToken));
      else assert.equal(r.headers['set-cookie'], undefined);
    }
    return r;
  }
  async function barrier(call) {
    for (let i = 0; i < 300; i++) {
      if ((await call('barrier')).entered) return;
      await delay(10);
    }
    throw new Error('Staff barrier deadline');
  }
  async function change(tenantId, staffId, mutation) {
    const current = (
      await runtime.query(
        'SELECT version FROM public.staff_users WHERE id=$1 AND tenant_id=$2',
        [staffId, tenantId],
      )
    ).rows[0];
    const result = await Transaction.run(
      pool,
      {
        actor: {
          kind: 'system',
          plane: 'system',
          tenantId: null,
          reference: 'staff-http-fixture',
          reason: 'verification',
        },
        target: { type: 'staff', reference: staffId, tenantId },
        correlationId: randomUUID(),
      },
      'staff-http-fixture.change',
      new SafeLogger('http', () => {}),
      (tx) =>
        new StaffAuthorityMutations().change(
          tx,
          { plane: 'tenant', tenantId, staffId },
          current.version,
          mutation,
        ),
    );
    assert.equal(result.kind, 'found');
  }
  async function status(tenantId, value) {
    const current = (
      await runtime.query('SELECT version FROM public.tenants WHERE id=$1', [
        tenantId,
      ])
    ).rows[0];
    const result = await Transaction.run(
      pool,
      {
        actor: {
          kind: 'system',
          plane: 'system',
          tenantId: null,
          reference: 'staff-http-fixture',
          reason: 'verification',
        },
        target: { type: 'tenant', reference: tenantId, tenantId: null },
        correlationId: randomUUID(),
      },
      'staff-http-fixture.tenant',
      new SafeLogger('http', () => {}),
      (tx) =>
        new TenantAuthorityMutations().status(
          tx,
          { tenantId },
          current.version,
          value,
        ),
    );
    assert.equal(result.kind, 'found');
  }
  const tenants = [];
  async function tenant(tenantStatus = 'active') {
    const id = randomUUID(),
      staffId = randomUUID(),
      adminId = randomUUID(),
      code = `staff-${randomBytes(5).toString('hex')}`;
    secrets.push(code);
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Staff transport fixture',$3)",
      [id, code, tenantStatus],
    );
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'fixture.admin','active','ready',$3,clock_timestamp(),ARRAY['tenant_admin'])",
      [adminId, id, hash],
    );
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,roles) VALUES($1,$2,'same.staff','active','unset',ARRAY['call_taker'])",
      [staffId, id],
    );
    const t = { id, staffId, adminId, code };
    tenants.push(t);
    return t;
  }
  async function setup(t, purpose = 'setup', supplied = password) {
    const p = {
      plane: 'tenant',
      tenantId: t.id,
      staffId: t.adminId,
      authenticationVersion: 1,
      tenantAuthorityVersion: (
        await runtime.query(
          'SELECT authority_version FROM public.tenants WHERE id=$1',
          [t.id],
        )
      ).rows[0].authority_version,
      roles: ['tenant_admin'],
      grants: [
        'tenant.manage',
        'incident.own.close',
        'responder.availability.manage',
      ],
    };
    const action = await credentials.service.issue(
      p,
      t.id,
      {
        tenantId: t.id,
        staffId: t.staffId,
        operation: 'issue',
        purpose,
        verificationMethod: 'in_person',
      },
      source(),
      t.staffId,
    );
    assert.equal(action.kind, 'issued');
    secrets.push(action.capability);
    assert.equal(
      (
        await credentials.service.exchange(
          { capability: action.capability, password: supplied },
          source(),
        )
      ).kind,
      'completed',
    );
  }
  try {
    await owner.query(
      'CREATE SCHEMA IF NOT EXISTS guard_fixture; CREATE TABLE IF NOT EXISTS guard_fixture.writes(tenant_id uuid,actor_id uuid); GRANT USAGE ON SCHEMA guard_fixture TO myims_runtime; GRANT SELECT,INSERT ON guard_fixture.writes TO myims_runtime',
    );
    const one = await tenant(),
      two = await tenant();
    await setup(one);
    await setup(two);
    const a = await replica(),
      b = await replica();
    for (const value of [
      {
        tenantCode: one.code,
        username: 'same.staff',
        password,
        role: 'tenant_admin',
      },
      {
        tenantCode: one.code,
        username: 'same.staff',
        password: '\ud800'.repeat(16),
      },
      { tenantCode: 'bad\ud800', username: 'same.staff', password },
      {
        tenantCode: one.code,
        username: 'same.staff',
        password: 'x'.repeat(129),
      },
    ])
      assert.equal(staffSignInInput(value), null);
    const first = await login(a, ` ${one.code.toUpperCase()} `, ' SAME.STAFF ');
    assert.equal(first.status, 201);
    assert.equal(first.data.staffId, one.staffId);
    const second = await login(b, two.code);
    assert.equal(second.status, 201);
    assert.notEqual(first.data.tenantId, second.data.tenantId);
    const native = await login(a, one.code, 'same.staff', password, {
      mobile: true,
    });
    assert.equal(native.status, 201);
    const another = await login(b, one.code);
    assert.equal(another.status, 201);
    for (const call of [a, b]) {
      assert.equal(
        (await request(call, '/staff/auth/browser/session', first)).status,
        200,
      );
      assert.equal(
        (
          await request(call, '/staff/auth/mobile/session', {
            mobile: true,
            token: native.sessionToken,
          })
        ).status,
        200,
      );
    }
    for (const supplied of [
      password.trim(),
      password.toLowerCase(),
      password.normalize('NFC'),
    ])
      assert.equal(
        (await login(a, one.code, 'same.staff', supplied)).status,
        401,
      );
    for (const [code, name] of [
      [`${one.code}.missing`, 'same.staff'],
      [one.code, 'missing'],
      [two.code, 'fixture.missing'],
    ]) {
      const r = await login(a, code, name);
      assert.equal(r.status, 401);
      assert.equal(r.data.message, 'Invalid credentials');
    }
    for (const [name, state, account, material] of [
      ['disabled', 'ready', 'disabled', hash],
      ['unset', 'unset', 'active', null],
      ['malformed', 'ready', 'active', 'bad-hash'],
    ]) {
      await owner.query(
        "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,$3,$4,$5,$6,$7,ARRAY['call_taker'])",
        [
          randomUUID(),
          one.id,
          name,
          account,
          state,
          material,
          state === 'ready' ? new Date() : null,
        ],
      );
      const before = (await a('stats')).hashes;
      assert.equal((await login(a, one.code, name)).status, 401);
      assert.equal((await a('stats')).hashes, before + 1);
    }
    for (const state of ['draft', 'suspended', 'retired']) {
      const t = await tenant(state);
      await owner.query(
        "UPDATE public.staff_users SET credential_state='ready',password_hash=$1,credential_changed_at=clock_timestamp() WHERE id=$2",
        [hash, t.staffId],
      );
      assert.equal((await login(b, t.code)).status, 401);
    }
    const pre = await csrf(a);
    const browserBoundary = new StaffIssuerBrowser(config);
    const expiredRequest = {
      socket: { remoteAddress: '127.0.0.1' },
      rawHeaders: [
        'Origin',
        config.origin,
        'X-Staff-Proxy',
        config.proxySecret,
      ],
      headers: { origin: config.origin, 'x-staff-proxy': config.proxySecret },
    };
    let expiredCookie;
    const actualNow = Date.now;
    let expired;
    try {
      Date.now = () => actualNow() - 700000;
      expired = browserBoundary.bootstrap(expiredRequest, {
        setHeader: (_name, value) => {
          expiredCookie = value.split(';')[0];
        },
      });
    } finally {
      Date.now = actualNow;
    }
    secrets.push(expired.proof, expiredCookie);
    assert.equal(
      (
        await request(a, '/staff/auth/browser/sign-in', {
          cookie: expiredCookie,
          proof: expired.proof,
          method: 'POST',
          body: { tenantCode: two.code, username: 'same.staff', password },
        })
      ).status,
      403,
    );

    for (const headers of [
      { origin: 'https://foreign.invalid' },
      { origin: '' },
      { 'x-staff-proxy': '' },
      { 'x-forwarded-for': 'spoofed' },
    ]) {
      const before = await a('stats');
      const r = await request(a, '/staff/auth/browser/sign-in', {
        ...pre,
        method: 'POST',
        body: { tenantCode: two.code, username: 'same.staff', password },
        headers,
      });
      assert.ok([400, 403].includes(r.status));
      assert.equal((await a('stats')).hashes, before.hashes);
    }
    assert.equal(
      (
        await request(a, '/staff/auth/browser/sign-in', {
          ...pre,
          method: 'POST',
          body: '{bad',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/sign-in', {
          ...pre,
          method: 'POST',
          body: 'x'.repeat(5000),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/sign-in', {
          ...pre,
          method: 'POST',
          body: {
            tenantCode: two.code,
            username: 'same.staff',
            password,
            tenantId: two.id,
          },
        })
      ).status,
      400,
    );
    for (const headers of [
      { origin: config.origin },
      { cookie: first.cookie },
      { 'sec-fetch-site': 'same-origin' },
      { 'x-staff-proxy': config.proxySecret },
      { 'x-staff-mobile-proxy': '' },
    ])
      assert.equal(
        (
          await request(a, '/staff/auth/mobile/sign-in', {
            mobile: true,
            method: 'POST',
            headers,
            body: { tenantCode: two.code, username: 'same.staff', password },
          })
        ).status,
        403,
      );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/session', {
          ...first,
          headers: { 'x-staff-mobile-proxy': config.proxySecret },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/session', {
          cookie: first.cookie,
          token: native.sessionToken,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/session', {
          cookie: `${first.cookie}; ${first.cookie}`,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/session', {
          cookie: `${first.cookie}; __Host-myims-platform=${native.sessionToken}`,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/session', {
          mobile: true,
          token: first.sessionToken,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/session', {
          cookie: `${cookieName}=${native.sessionToken}`,
        })
      ).status,
      403,
    );
    const platform = await issue(a, {
      plane: 'platform',
      identityId: (
        await runtime.query(
          "SELECT id FROM public.platform_operators WHERE normalized_username='session.operator'",
        )
      ).rows[0].id,
      authenticationVersion: 1,
    });
    tokens.push(platform.token);
    secrets.push(platform.token);
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/session', {
          mobile: true,
          token: platform.token,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/logout', {
          mobile: true,
          token: platform.token,
          method: 'POST',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/logout', {
          mobile: true,
          token: first.sessionToken,
          method: 'POST',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/fixture/staff-write', {
          ...first,
          method: 'POST',
          proof: pre.proof,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/logout', {
          ...first,
          method: 'POST',
          proof: pre.proof,
        })
      ).status,
      403,
    );
    const livePre = await csrf(a, another.cookie);
    assert.equal(
      (
        await request(a, '/staff/auth/browser/logout', {
          ...livePre,
          method: 'POST',
        })
      ).status,
      403,
    );
    const old = await redis.get(key(first.sessionToken));
    assert.equal(
      (
        await request(b, '/staff/auth/browser/logout', {
          ...first,
          method: 'POST',
        })
      ).status,
      201,
    );
    assert.equal(
      (await request(a, '/staff/auth/browser/session', first)).status,
      401,
    );
    await redis.set(key(first.sessionToken), old);
    assert.equal(
      (await request(b, '/staff/auth/browser/session', first)).status,
      401,
    );
    assert.equal(
      (await request(a, '/staff/auth/browser/session', another)).status,
      200,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/browser/logout', {
          ...first,
          method: 'POST',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(b, '/staff/auth/browser/logout', {
          ...(await csrf(b)),
          method: 'POST',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(b, '/staff/auth/mobile/logout', {
          mobile: true,
          token: native.sessionToken,
          method: 'POST',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/session', {
          mobile: true,
          token: native.sessionToken,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/logout', {
          mobile: true,
          token: native.sessionToken,
          method: 'POST',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/logout', {
          mobile: true,
          method: 'POST',
        })
      ).status,
      201,
    );
    console.log(
      'PASS staff B-01/02/05/06/07: real qualified setup, exact credentials, channel/CSRF denial and durable cross-replica logout',
    );
    // Barrier-controlled proof must remain bound across every authority mutation.
    for (const stage of ['credential-read', 'verified-issuance']) {
      for (const mutation of ['credential', 'roles', 'status', 'tenant']) {
        const t = await tenant();
        await owner.query(
          "UPDATE public.staff_users SET credential_state='ready',password_hash=$1,credential_changed_at=clock_timestamp() WHERE id=$2",
          [hash, t.staffId],
        );
        await a('prepare', stage);
        const pending = login(a, t.code);
        await barrier(a);
        if (mutation === 'tenant') await status(t.id, 'suspended');
        else
          await change(
            t.id,
            t.staffId,
            mutation === 'credential'
              ? {
                  kind: 'credential',
                  credentialState: 'ready',
                  passwordHash: hash,
                  credentialChangedAt: new Date(),
                }
              : mutation === 'roles'
                ? { kind: 'roles', roles: ['dispatcher'] }
                : { kind: 'status', status: 'disabled' },
          );
        await a('release');
        assert.equal((await pending).status, 401);
      }
    }
    const retained = await redis.get(key(another.sessionToken));
    const oldMobile = await login(b, two.code, 'same.staff', password, {
      mobile: true,
    });
    assert.equal(oldMobile.status, 201);
    const oldWeb = await login(a, two.code);
    assert.equal(oldWeb.status, 201);
    const retainedMobile = await redis.get(key(oldMobile.sessionToken));
    const replacementPassword = ' Replaced Staff Åe\u0301 password 2026 ';
    secrets.push(replacementPassword);
    await setup(two, 'reset', replacementPassword);
    for (const call of [a, b]) {
      assert.equal(
        (await request(call, '/staff/auth/browser/session', oldWeb)).status,
        401,
      );
      assert.equal(
        (
          await request(call, '/staff/auth/mobile/session', {
            mobile: true,
            token: oldMobile.sessionToken,
          })
        ).status,
        401,
      );
    }
    await redis.set(key(oldMobile.sessionToken), retainedMobile);
    assert.equal(
      (
        await request(a, '/staff/auth/mobile/session', {
          mobile: true,
          token: oldMobile.sessionToken,
        })
      ).status,
      401,
    );
    assert.equal((await login(a, two.code)).status, 401);
    assert.equal(
      (await login(b, two.code, 'same.staff', replacementPassword)).status,
      201,
    );
    // Keep fixed-window allowance assertions in one actual Redis window.
    const redisTime = await redis.sendCommand(['TIME']);
    const remainingWindow = 900 - (Number(redisTime[0]) % 900);
    if (remainingWindow < 150) {
      console.log(
        'CHECK: align staff budget fixture with the next fixed window',
      );
      await delay((remainingWindow + 1) * 1000);
    }
    // Shared identity/source counters deny before candidate/hash work, no refund.
    const limitedCode = `limit-${randomBytes(5).toString('hex')}`;
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await login(i % 2 ? a : b, limitedCode, 'same.staff')).status,
        401,
      );
    const beforeLimit = await a('stats');
    const limited = await login(a, limitedCode);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers['retry-after']) <= 900);
    assert.deepEqual(await a('stats'), beforeLimit);
    assert.equal((await login(b, `${limitedCode}.other`)).status, 401);
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await login(
            i % 2 ? a : b,
            `${limitedCode}.source.${i}`,
            'same.staff',
            password,
            { from: '203.0.113.180' },
          )
        ).status,
        401,
      );
    const beforeSource = await b('stats');
    assert.equal(
      (
        await login(b, `${limitedCode}.source.extra`, 'same.staff', password, {
          from: '203.0.113.180',
        })
      ).status,
      429,
    );
    assert.deepEqual(await b('stats'), beforeSource);
    secrets.push('HASH_INTERNAL_FAILURE_SENTINEL');
    await a('hash-failure', true);
    assert.equal((await login(a, `${limitedCode}.internal`)).status, 503);
    await a('hash-failure', false);
    const busy = await Promise.all([
      login(a, `${limitedCode}.busy.one`),
      login(a, `${limitedCode}.busy.two`),
    ]);
    assert.deepEqual(busy.map((r) => r.status).sort(), [401, 503]);
    const unavailable = await replica({
      canonicalUrl: 'postgresql://myims_runtime:unavailable@127.0.0.1:1/absent',
    });
    assert.equal((await login(unavailable, one.code)).status, 503);
    const lostLimit = await proxy(),
      uncertainLimit = await replica({ limiterUrl: lostLimit.url });
    lostLimit.arm();
    assert.equal(
      (await login(uncertainLimit, `${limitedCode}.loss`)).status,
      503,
    );
    const fault = await tenant();
    await setup(fault);
    const loseIssue = await commitProxy(),
      uncertainIssue = await replica({ runtimeUrl: loseIssue.url });
    const failedIssue = await login(uncertainIssue, fault.code);
    assert.equal(failedIssue.status, 503);
    assert.equal(failedIssue.headers['set-cookie'], undefined);
    assert.ok(loseIssue.dropped());
    const loseRedis = await proxy(),
      uncertainRedis = await replica({
        redisUrl: loseRedis.url,
        limiterUrl: redis.options.url,
      });
    loseRedis.arm();
    const failedRedis = await login(uncertainRedis, fault.code);
    assert.equal(failedRedis.status, 503);
    assert.equal(failedRedis.headers['set-cookie'], undefined);
    await owner.query(
      "ALTER TABLE public.audit_events ADD CONSTRAINT staff_http_issue_reject CHECK (NOT (event_type='identity.session-fence' AND metadata->>'operation'='created')) NOT VALID",
    );
    const rejectedIssue = await login(b, fault.code);
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT staff_http_issue_reject',
    );
    assert.equal(rejectedIssue.status, 503);
    assert.equal(rejectedIssue.headers['set-cookie'], undefined);
    const valid = await login(b, fault.code);
    assert.equal(valid.status, 201);
    await owner.query(
      "ALTER TABLE public.audit_events ADD CONSTRAINT staff_http_reject CHECK (NOT (event_type='identity.session-fence' AND metadata->>'operation'='revoked')) NOT VALID",
    );
    const rejected = await request(a, '/staff/auth/browser/logout', {
      ...valid,
      method: 'POST',
    });
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT staff_http_reject',
    );
    assert.equal(rejected.status, 503);
    assert.equal(rejected.headers['set-cookie'], undefined);
    assert.equal(
      (await request(b, '/staff/auth/browser/session', valid)).status,
      200,
    );
    const loseRevoke = await commitProxy(),
      uncertainRevoke = await replica({ runtimeUrl: loseRevoke.url });
    const failedRevoke = await request(
      uncertainRevoke,
      '/staff/auth/browser/logout',
      { ...valid, method: 'POST' },
    );
    assert.equal(failedRevoke.status, 503);
    assert.equal(failedRevoke.headers['set-cookie'], undefined);
    assert.ok(loseRevoke.dropped());
    for (const call of [a, b])
      assert.equal(
        (await request(call, '/staff/auth/browser/session', valid)).status,
        401,
      );
    assert.equal(
      (
        await request(b, '/staff/auth/browser/logout', {
          ...valid,
          method: 'POST',
        })
      ).status,
      201,
    );
    // Canonical transaction revalidation prevents stale writes; renew/revoke cannot recreate.
    const operational = await login(b, fault.code);
    assert.equal(operational.status, 201);
    const writes = () =>
      runtime
        .query('SELECT count(*)::int AS n FROM guard_fixture.writes')
        .then((r) => r.rows[0].n);
    const count = await writes();
    await a('prepare', 'before-lock');
    const write = request(a, '/fixture/staff-write', {
      ...operational,
      method: 'POST',
    });
    await barrier(a);
    await change(fault.id, fault.staffId, {
      kind: 'status',
      status: 'disabled',
    });
    await a('release');
    assert.equal((await write).status, 401);
    assert.equal(await writes(), count);
    await change(fault.id, fault.staffId, { kind: 'status', status: 'active' });
    const race = await login(b, fault.code);
    assert.equal(race.status, 201);
    const raceRecord = await redis.get(key(race.sessionToken));
    await a('prepare', 'after-lock');
    const renewing = request(a, '/fixture/staff-write', {
      ...race,
      method: 'POST',
    });
    await barrier(a);
    assert.equal(
      (
        await request(b, '/staff/auth/browser/logout', {
          ...race,
          method: 'POST',
        })
      ).status,
      201,
    );
    await a('release');
    assert.equal((await renewing).status, 401);
    await redis.set(key(race.sessionToken), raceRecord);
    assert.equal(
      (await request(a, '/staff/auth/browser/session', race)).status,
      401,
    );
    // Clock policy is accelerated only by fixture settings, no shipping clock endpoint.
    const short = await replica({
      config: parseSessionConfig({
        SESSION_TIMEOUT_MS: '1000',
        SESSION_WEB_IDLE_SECONDS: '4',
        SESSION_WEB_ABSOLUTE_SECONDS: '8',
        SESSION_MOBILE_IDLE_SECONDS: '4',
        SESSION_MOBILE_ABSOLUTE_SECONDS: '8',
      }),
    });
    for (const mobile of [false, true]) {
      const c = mobile ? {} : await csrf(short);
      const r = await request(
        short,
        `/staff/auth/${mobile ? 'mobile' : 'browser'}/sign-in`,
        {
          ...c,
          mobile,
          method: 'POST',
          body: { tenantCode: one.code, username: 'fixture.admin', password },
        },
      );
      assert.equal(r.status, 201);
      const token = r.data.token ?? jar(r.headers['set-cookie']).split('=')[1];
      secrets.push(token, r.data.proof);
      tokens.push(token);
      const auth = mobile
        ? { mobile: true, token }
        : { cookie: jar(r.headers['set-cookie']), proof: r.data.proof };
      const before = JSON.parse(await redis.get(key(token)));
      await delay(400);
      assert.equal(
        (
          await request(
            short,
            `/staff/auth/${mobile ? 'mobile' : 'browser'}/session`,
            auth,
          )
        ).status,
        200,
      );
      assert.equal(
        JSON.parse(await redis.get(key(token))).idleExpiresAt,
        before.idleExpiresAt,
      );
      const rotated = await short('rotate', token, ref({ record: before }));
      assert.equal(rotated.kind, 'rotated');
      tokens.push(rotated.token);
      secrets.push(rotated.token);
      assert.equal(rotated.record.createdAt, before.createdAt);
      if (!mobile) {
        assert.equal(
          (
            await request(short, '/fixture/staff-write', {
              cookie: `${cookieName}=${rotated.token}`,
              proof: r.data.proof,
              method: 'POST',
            })
          ).status,
          403,
        );
        const newProof = browserBoundary.sessionProof(rotated.token);
        secrets.push(newProof);
        assert.equal(
          (
            await request(short, '/staff/auth/browser/session', {
              cookie: `${cookieName}=${rotated.token}`,
            })
          ).status,
          200,
        );
      }

      assert.equal(rotated.record.absoluteExpiresAt, before.absoluteExpiresAt);
      await delay(Math.max(0, rotated.record.idleExpiresAt - Date.now()) + 150);
      assert.equal(
        (
          await request(
            short,
            `/staff/auth/${mobile ? 'mobile' : 'browser'}/session`,
            mobile
              ? { mobile: true, token: rotated.token }
              : { cookie: `${cookieName}=${rotated.token}` },
          )
        ).status,
        401,
      );
    }
    const renewalTenant = await tenant();
    await setup(renewalTenant);
    const renewal = await login(b, renewalTenant.code);
    assert.equal(renewal.status, 201);
    const renewalBefore = JSON.parse(
      await redis.get(key(renewal.sessionToken)),
    );
    await delay(20);
    assert.equal(
      (await request(a, '/fixture/staff-write', { ...renewal, method: 'POST' }))
        .status,
      201,
    );
    const after = JSON.parse(await redis.get(key(renewal.sessionToken)));
    assert.ok(after.idleExpiresAt > renewalBefore.idleExpiresAt);
    assert.equal(after.absoluteExpiresAt, renewalBefore.absoluteExpiresAt);
    // Absolute expiry holds even after operational activity (bounded fixture clock).
    const absolute = await replica({
      config: parseSessionConfig({
        SESSION_TIMEOUT_MS: '1000',
        SESSION_WEB_IDLE_SECONDS: '6',
        SESSION_WEB_ABSOLUTE_SECONDS: '8',
        SESSION_MOBILE_IDLE_SECONDS: '6',
        SESSION_MOBILE_ABSOLUTE_SECONDS: '8',
      }),
    });
    for (const mobile of [false, true]) {
      const ctx = mobile ? {} : await csrf(absolute);
      const r = await request(
        absolute,
        `/staff/auth/${mobile ? 'mobile' : 'browser'}/sign-in`,
        {
          ...ctx,
          mobile,
          method: 'POST',
          body: {
            tenantCode: renewalTenant.code,
            username: 'same.staff',
            password,
          },
        },
      );
      assert.equal(r.status, 201);
      const token = r.data.token ?? jar(r.headers['set-cookie']).split('=')[1];
      tokens.push(token);
      secrets.push(token, r.data.proof);
      const auth = mobile
        ? { mobile: true, token }
        : { cookie: jar(r.headers['set-cookie']), proof: r.data.proof };
      const record = JSON.parse(await redis.get(key(token)));
      await delay(2000);
      assert.equal(
        (
          await request(
            absolute,
            mobile ? '/fixture/staff-mobile-write' : '/fixture/staff-write',
            { ...auth, method: 'POST' },
          )
        ).status,
        201,
        `Authorized ${mobile ? 'mobile' : 'browser'} activity before idle expiry`,
      );
      const renewed = JSON.parse(await redis.get(key(token)));
      assert.equal(renewed.idleExpiresAt, record.absoluteExpiresAt);
      await delay(Math.max(0, record.absoluteExpiresAt - Date.now()) + 150);
      assert.equal(
        (
          await request(
            absolute,
            `/staff/auth/${mobile ? 'mobile' : 'browser'}/session`,
            auth,
          )
        ).status,
        401,
      );
    }
    await redis.set(key(another.sessionToken), retained);
    await status(one.id, 'suspended');
    assert.equal(
      (await request(b, '/staff/auth/browser/session', another)).status,
      401,
    );
    console.log(
      'PASS staff B-03/04/07/08: shared budgets, proof races, reset/stale restore, real response loss, transaction renewal, idle/absolute expiry',
    );
    // Actual TLS ingress probes shipping Nest adapters. c owns the Next/native applications.
    assert.equal(
      spawnSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          join(directory, 'key.pem'),
          '-out',
          join(directory, 'cert.pem'),
          '-days',
          '1',
          '-subj',
          '/CN=localhost',
          '-addext',
          'subjectAltName=DNS:localhost',
        ],
        { stdio: 'ignore' },
      ).status,
      0,
    );
    server = createServer(
      {
        key: readFileSync(join(directory, 'key.pem')),
        cert: readFileSync(join(directory, 'cert.pem')),
      },
      (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.url === '/' && req.method === 'GET') {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><title>Staff HTTPS transport probe</title>');
          return;
        }
        const native = /^\/staff\/auth\/mobile\/(sign-in|session|logout)$/.test(
          req.url,
        );
        const browserRoute =
          /^\/staff\/auth\/browser\/(csrf|sign-in|session|logout)$/.test(
            req.url,
          );
        const allowedMethod = /\/(csrf|session)$/.test(req.url)
          ? 'GET'
          : 'POST';
        if (
          (!native && !browserRoute) ||
          req.method !== allowedMethod ||
          req.headers.host !== new URL(config.origin).host ||
          (native
            ? [
                'origin',
                'cookie',
                'sec-fetch-site',
                'sec-fetch-mode',
                'sec-fetch-dest',
                'x-staff-proxy',
                'x-staff-csrf',
              ].some((h) => req.headers[h] !== undefined)
            : req.headers.authorization !== undefined ||
              (req.method === 'POST'
                ? req.headers.origin !== config.origin
                : !['same-origin', 'none'].includes(
                    req.headers['sec-fetch-site'],
                  )))
        ) {
          res.writeHead(403).end();
          return;
        }
        const headers = {
          'x-forwarded-for': req.socket.remoteAddress,
          ...(req.headers['content-type']
            ? { 'content-type': req.headers['content-type'] }
            : {}),
        };
        if (native) {
          headers['x-staff-mobile-proxy'] = config.proxySecret;
          if (req.headers.authorization)
            headers.authorization = req.headers.authorization;
        } else {
          headers.origin = config.origin;
          headers['x-staff-proxy'] = config.proxySecret;
          for (const h of ['cookie', 'x-staff-csrf'])
            if (req.headers[h]) headers[h] = req.headers[h];
        }
        const upstream = httpRequest(
          `${selected.url}${req.url}`,
          { method: req.method, headers },
          (incoming) => {
            res.writeHead(incoming.statusCode, incoming.headers);
            incoming.pipe(res);
          },
        );
        upstream.on('error', () => {
          res.writeHead(503).end();
        });
        req.pipe(upstream);
      },
    );
    // Keep the actual browser/native source (::1) distinct from the trusted
    // private backend forwarding peer (127.0.0.1), as in the platform probe.
    server.listen(0, '::1');
    await once(server, 'listening');
    config.origin = `https://localhost:${server.address().port}`;
    const platformConfig = {
      ...config,
      proxySecret: randomBytes(32).toString('hex'),
      csrfSecret: randomBytes(32).toString('hex'),
    };
    const exchangeConfig = {
      ...config,
      proxySecret: randomBytes(32).toString('hex'),
      csrfSecret: randomBytes(32).toString('hex'),
    };
    secrets.push(
      platformConfig.proxySecret,
      platformConfig.csrfSecret,
      exchangeConfig.proxySecret,
      exchangeConfig.csrfSecret,
    );
    const pa = await replica({
        productionHttp: true,
        browserConfig: platformConfig,
        exchangeConfig,
      }),
      pb = await replica({
        productionHttp: true,
        browserConfig: platformConfig,
        exchangeConfig,
      });
    // Genuine a receipt-linked draft setup through production HTTP still grants no ordinary login.
    const operator = await issue(pa, {
      plane: 'platform',
      identityId: platform.record.identityId,
      authenticationVersion: 1,
    });
    secrets.push(operator.token);
    tokens.push(operator.token);
    const operatorProof = new (load(
      'modules/identity/adapters/http/platform-browser',
    ).PlatformBrowser)(platformConfig).sessionProof(operator.token);
    secrets.push(operatorProof);
    const platformAuth = {
      cookie: `__Host-myims-platform=${operator.token}`,
      headers: {
        'x-platform-proxy': platformConfig.proxySecret,
        'x-platform-csrf': operatorProof,
      },
    };
    const draftCode = `draft-${randomBytes(5).toString('hex')}`;
    secrets.push(draftCode);
    const draft = await request(pa, '/platform/tenants', {
      ...platformAuth,
      method: 'POST',
      body: {
        requestId: randomUUID(),
        tenantCode: draftCode,
        displayName: 'Staff draft denial fixture',
        administratorUsername: 'initial.admin',
      },
    });
    assert.equal(draft.status, 201);
    const action = await request(
      pb,
      `/platform/tenants/${draft.data.tenant.id}/administrator/credential-actions`,
      {
        ...platformAuth,
        method: 'POST',
        body: {
          purpose: 'setup',
          operation: 'issue',
          verificationMethod: 'in_person',
        },
      },
    );
    assert.equal(action.status, 201);
    secrets.push(action.data.capability);
    const exchangeContext = await request(pa, '/credential-actions/csrf', {
      headers: { 'x-credential-proxy': exchangeConfig.proxySecret },
    });
    assert.equal(exchangeContext.status, 200);
    secrets.push(exchangeContext.data.proof);
    const completed = await request(pb, '/credential-actions/exchange', {
      cookie: jar(exchangeContext.headers['set-cookie']),
      method: 'POST',
      headers: {
        'x-credential-proxy': exchangeConfig.proxySecret,
        'x-credential-csrf': exchangeContext.data.proof,
      },
      body: { capability: action.data.capability, password },
    });
    assert.equal(completed.status, 201);
    assert.equal((await login(pa, draftCode, 'initial.admin')).status, 401);
    assert.equal(
      (await login(pb, draftCode, 'initial.admin', password, { mobile: true }))
        .status,
      401,
    );
    selected = pa;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(config.origin);
    const browserLogin = await page.evaluate(
      async ({ tenantCode, username, password }) => {
        const c = await fetch('/staff/auth/browser/csrf');
        if (c.status !== 200)
          return { status: c.status, bootstrapFailed: true };
        const { proof } = await c.json();
        const r = await fetch('/staff/auth/browser/sign-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Staff-CSRF': proof,
          },
          body: JSON.stringify({ tenantCode, username, password }),
        });
        return {
          status: r.status,
          data: await r.json(),
          visible: globalThis.document.cookie,
          secure: globalThis.isSecureContext,
          local: globalThis.localStorage.length,
          session: globalThis.sessionStorage.length,
        };
      },
      { tenantCode: renewalTenant.code, username: 'same.staff', password },
    );
    assert.equal(browserLogin.status, 201);
    assert.equal(browserLogin.secure, true);
    assert.equal(browserLogin.visible, '');
    assert.equal(browserLogin.local, 0);
    assert.equal(browserLogin.session, 0);
    const accepted = (await context.cookies()).find(
      (c) => c.name === cookieName,
    );
    assert.ok(
      accepted?.secure &&
        accepted.httpOnly &&
        accepted.sameSite === 'Lax' &&
        accepted.domain === 'localhost' &&
        accepted.path === '/',
    );
    assert.ok(accepted.expires * 1000 <= browserLogin.data.absoluteExpiresAt);
    tokens.push(accepted.value);
    secrets.push(accepted.value, browserLogin.data.proof);
    assert.ok(!JSON.stringify(browserLogin.data).includes(accepted.value));
    selected = pb;
    assert.equal(
      await page.evaluate(
        async () =>
          (
            await fetch('/staff/auth/browser/session', {
              headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
            })
          ).status,
      ),
      403,
    );
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/staff/auth/browser/session')).status,
      ),
      200,
    );
    assert.equal(
      await page.evaluate(
        async () =>
          (
            await fetch('/staff/auth/mobile/sign-in', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).status,
      ),
      403,
    );
    assert.equal(
      await page.evaluate(
        async (proof) =>
          (
            await fetch('/staff/auth/browser/logout', {
              method: 'POST',
              headers: { 'X-Staff-CSRF': proof },
            })
          ).status,
        browserLogin.data.proof,
      ),
      201,
    );
    selected = pa;
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/staff/auth/browser/session')).status,
      ),
      401,
    );
    assert.ok(!(await context.cookies()).some((c) => c.name === cookieName));
    await context.close();
    const tls = (path, body, token) =>
      new Promise((resolve, reject) => {
        const r = httpsRequest(
          `${config.origin}${path}`,
          {
            rejectUnauthorized: false,
            family: 6,
            method: body ? 'POST' : 'GET',
            headers: {
              ...(body ? { 'Content-Type': 'application/json' } : {}),
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
          },
          (res) => {
            let text = '';
            res.on('data', (b) => (text += b));
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                data: JSON.parse(text),
                headers: res.headers,
              }),
            );
          },
        );
        r.on('error', reject);
        r.end(body ? JSON.stringify(body) : undefined);
      });
    const tlsMobile = await tls('/staff/auth/mobile/sign-in', {
      tenantCode: renewalTenant.code,
      username: 'fixture.admin',
      password,
    });
    assert.equal(tlsMobile.status, 201);
    tokens.push(tlsMobile.data.token);
    secrets.push(tlsMobile.data.token);
    assert.equal(tlsMobile.headers['set-cookie'], undefined);
    assert.equal(tlsMobile.headers['cache-control'], 'no-store');
    selected = pb;
    assert.equal(
      (await tls('/staff/auth/mobile/session', null, tlsMobile.data.token))
        .status,
      200,
    );
    assert.equal(
      (
        await request(pa, '/staff/auth/mobile/session', {
          mobile: true,
          token: tlsMobile.data.token,
          headers: { 'x-staff-mobile-proxy': '' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await tls('/staff/auth/mobile/logout', {}, tlsMobile.data.token)).status,
      201,
    );
    selected = pa;
    assert.equal(
      (await tls('/staff/auth/mobile/session', null, tlsMobile.data.token))
        .status,
      401,
    );
    console.log(
      'PASS staff B-05/06/09: production A/B HTTPS Chromium cookie acceptance and native HTTPS bearer transport',
    );
  } finally {
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS staff_http_reject, DROP CONSTRAINT IF EXISTS staff_http_issue_reject',
    );
    if (browser) await browser.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    for (const call of calls) {
      await call('release');
      await call('close');
    }
    for (const token of tokens) await redis.del(key(token));
    await credentials.onApplicationShutdown();
    await pool.end();
    rmSync(directory, { recursive: true, force: true });
  }
}
