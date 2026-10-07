import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (path) => backend(`./dist/${path}.js`);
const { parseLimiterConfig, parseSessionConfig } = backend('@myims/config');
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
const { StaffAuthorityRepository } = load(
  'modules/identity/adapters/db/authority-read',
);
const { TenantAdmissionRepository } = load(
  'modules/tenancy/adapters/db/admission-read',
);
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { Pool } = backend('pg');
const { TenantRepository } = load(
  'modules/tenancy/adapters/db/tenant-repository',
);
const { FirstAdministratorRepository } = load(
  'modules/identity/adapters/db/first-administrator',
);
const { draftTenantInput } = load(
  'modules/platform/application/draft-tenant-input',
);
export async function checkDraftTenants({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  secrets,
  appUrl,
  commitProxy,
  proxy,
}) {
  const config = {
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  };
  secrets.push(
    config.proxySecret,
    config.csrfSecret,
    'draft-verifier-sentinel',
  );
  const calls = [],
    sessions = [],
    output = [];
  const limiterConfig = parseLimiterConfig({
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  });
  async function replica(override = {}) {
    const call = await worker({
      http: true,
      productionHttp: true,
      config: parseSessionConfig({ SESSION_TIMEOUT_MS: '1000' }),
      browserConfig: config,
      limiterConfig,
      ...override,
    });
    calls.push(call);
    return call;
  }
  async function operator(call) {
    const id = randomUUID();
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','draft-verifier-sentinel',clock_timestamp())",
      [id, `draft.${id}`],
    );
    const session = await issue(call, {
      plane: 'platform',
      identityId: id,
      authenticationVersion: 1,
    });
    sessions.push(session);
    return session;
  }
  const browser = new PlatformBrowser(config);
  function request(
    call,
    path,
    { method = 'GET', session, body, headers = {}, drop = false } = {},
  ) {
    return new Promise((resolve, reject) => {
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
            origin: config.origin,
            'x-platform-proxy': config.proxySecret,
            'x-forwarded-for': '192.0.2.111',
            ...(session
              ? {
                  cookie: `__Host-myims-platform=${session.token}`,
                  'x-platform-csrf': browser.sessionProof(session.token),
                }
              : {}),
            ...(payload === undefined
              ? {}
              : { 'content-type': 'application/json' }),
            ...headers,
          },
        },
        (res) => {
          if (drop) {
            res.destroy();
            req.destroy();
            resolve({ lost: true });
            return;
          }
          let text = '';
          res.on('data', (bytes) => (text += bytes));
          res.on('end', () => {
            const data = JSON.parse(text);
            output.push(text);
            resolve({ status: res.statusCode, data, headers: res.headers });
          });
          res.on('error', reject);
        },
      );
      req.setTimeout(15000, () => req.destroy(new Error('Draft API deadline')));
      req.on('error', reject);
      req.end(payload);
    });
  }
  const post = (call, session, body, extra = {}) =>
    request(call, '/platform/tenants', {
      method: 'POST',
      session,
      body,
      ...extra,
    });
  const data = (code = `draft.${randomUUID()}`) => ({
    requestId: randomUUID(),
    tenantCode: code,
    displayName: ' Draft Organization ',
    administratorUsername: ' ADMIN.One ',
  });
  async function counts() {
    return (
      await owner.query(
        `SELECT (SELECT count(*)::int FROM public.tenants) AS tenants,(SELECT count(*)::int FROM public.staff_users) AS staff,(SELECT count(*)::int FROM public.draft_tenant_receipts) AS receipts,(SELECT count(*)::int FROM public.audit_events WHERE event_type='identity.storage.changed') AS audit`,
      )
    ).rows[0];
  }
  async function barrier(pattern, n = 1) {
    for (let i = 0; i < 160; i++) {
      await owner.query('SELECT pg_stat_clear_snapshot()');
      const row = (
        await owner.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
          [pattern],
        )
      ).rows[0];
      if (row.n >= n) return;
      await delay(5);
    }
    throw new Error('Draft database barrier not reached');
  }
  const database = new SnapshotDatabase(appUrl);
  const pool = new Pool({
    connectionString: appUrl,
    max: 2,
    statement_timeout: 2000,
    connectionTimeoutMillis: 2000,
  });
  pool.on('error', () => {});
  try {
    const a = await replica(),
      b = await replica();
    const s = await operator(a),
      foreign = await operator(b);
    const attempt = data(` DRAFT.${randomUUID().toUpperCase()} `);
    const before = await counts();
    const created = await post(a, s, attempt);
    assert.equal(created.status, 201);
    const dto = created.data,
      tenantId = dto.tenant.id,
      staffId = dto.administrator.id;
    assert.equal(
      dto.tenant.tenantCode,
      attempt.tenantCode.trim().toLowerCase(),
    );
    assert.equal(dto.tenant.displayName, 'Draft Organization');
    assert.equal(dto.tenant.status, 'draft');
    assert.equal(dto.tenant.version, 1);
    assert.equal(dto.tenant.authorityVersion, 1);
    assert.deepEqual(dto.administrator, {
      kind: 'available',
      id: staffId,
      tenantId,
      username: 'admin.one',
      roles: ['tenant_admin'],
      status: 'active',
      credentialState: 'unset',
    });
    assert.deepEqual(await counts(), {
      tenants: before.tenants + 1,
      staff: before.staff + 1,
      receipts: before.receipts + 1,
      audit: before.audit + 2,
    });
    const row = (
      await runtime.query('SELECT * FROM public.staff_users WHERE id=$1', [
        staffId,
      ])
    ).rows[0];
    assert.equal(row.password_hash, null);
    assert.equal(row.credential_changed_at, null);
    assert.equal(row.authentication_version, 1);
    assert.equal(row.version, 1);
    const audits = (
      await runtime.query(
        'SELECT * FROM public.audit_events WHERE target_reference IN ($1,$2)',
        [tenantId, staffId],
      )
    ).rows;
    assert.equal(audits.length, 2);
    assert.ok(
      audits.every(
        (row) =>
          row.actor_reference === s.record.identityId &&
          row.actor_kind === 'platform_operator' &&
          row.identity_plane === 'platform',
      ),
    );
    assert.equal(audits[0].correlation_id, audits[1].correlation_id);
    assert.ok(
      audits.some(
        (row) =>
          row.target_type === 'tenant' &&
          row.target_reference === tenantId &&
          row.tenant_id === null &&
          row.metadata.change === 'tenant_created',
      ),
    );
    assert.ok(
      audits.some(
        (row) =>
          row.target_type === 'staff' &&
          row.target_reference === staffId &&
          row.tenant_id === tenantId &&
          row.metadata.change === 'staff_created',
      ),
    );
    const receipt = (
      await runtime.query(
        'SELECT * FROM public.draft_tenant_receipts WHERE tenant_id=$1',
        [tenantId],
      )
    ).rows[0];
    secrets.push(receipt.fingerprint);
    assert.equal(receipt.operator_id, s.record.identityId);
    assert.equal(receipt.staff_id, staffId);
    assert.equal(receipt.correlation_id, audits[0].correlation_id);
    const detail = await request(b, `/platform/tenants/${tenantId}`, {
      session: s,
    });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.data, dto);
    assert.equal(detail.headers['cache-control'], 'no-store');
    const passiveBefore = await redis.get(key(s.token));
    assert.equal(
      (await request(a, '/platform/tenants', { session: s })).status,
      200,
    );
    assert.equal(await redis.get(key(s.token)), passiveBefore);
    assert.equal(
      (
        await post(b, s, {
          ...attempt,
          tenantCode: attempt.tenantCode.trim().toLowerCase(),
          administratorUsername: 'admin.one',
          displayName: 'Draft Organization',
        })
      ).status,
      200,
    );
    assert.deepEqual(await counts(), {
      tenants: before.tenants + 1,
      staff: before.staff + 1,
      receipts: before.receipts + 1,
      audit: before.audit + 2,
    });
    console.log(
      'PASS draft A-01: protected create/read, canonical states/versions, qualified receipt and both attributed creation audits',
    );

    const invalids = [
      null,
      [],
      {},
      { ...data(), roles: ['tenant_admin'] },
      { ...data(), actorId: s.record.identityId },
      { ...data(), status: 'active' },
      { ...data(), tenantId },
      { ...data(), password: 'x' },
      { ...data(), requestId: 'bad' },
      { ...data(), tenantCode: 'x'.repeat(65) },
      { ...data(), administratorUsername: 'x'.repeat(129) },
      { ...data(), displayName: '😀'.repeat(101) },
      { ...data(), displayName: '\ud800' },
      { ...data(), displayName: 'x\n' },
      { ...data(), tenantCode: 'a\t' },
      { ...data(), administratorUsername: 'İname' },
      { ...data(), tenantCode: ' '.repeat(257) + 'a' },
    ];
    const beforeInvalid = await counts();
    for (const invalid of invalids)
      assert.equal((await post(a, s, invalid)).status, 400);
    assert.deepEqual(await counts(), beforeInvalid);
    assert.equal((await post(a, s, '{bad')).status, 400);
    assert.equal((await post(a, s, ' '.repeat(5000))).status, 400);
    assert.equal(
      draftTenantInput({
        ...data(),
        tenantCode: 'a'.repeat(64),
        administratorUsername: 'u'.repeat(128),
        displayName: '😀'.repeat(100),
      }).kind,
      'valid',
    );
    const max = await post(a, s, {
      ...data('a'.repeat(64)),
      administratorUsername: 'u'.repeat(128),
      displayName: '😀'.repeat(100),
    });
    assert.equal(max.status, 201);
    const shared = await post(b, s, data());
    assert.equal(shared.status, 201);
    assert.equal(shared.data.administrator.username, 'admin.one');
    assert.notEqual(shared.data.administrator.id, staffId);
    for (const status of ['draft', 'active', 'suspended', 'retired']) {
      const id = randomUUID(),
        code = `collision.${id}`;
      await owner.query(
        'INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,$3,$4)',
        [id, code, 'Other', status],
      );
      const collision = await post(a, s, data(code.toUpperCase()));
      assert.equal(collision.status, 409);
      assert.equal(collision.data.reason, 'tenant_code_conflict');
    }
    await assert.rejects(
      runtime.query(
        'UPDATE public.tenants SET normalized_code=$2 WHERE id=$1',
        [tenantId, 'other'],
      ),
      (error) => ['42501', '23514'].includes(error.code),
    );
    await assert.rejects(
      runtime.query('UPDATE public.staff_users SET tenant_id=$2 WHERE id=$1', [
        staffId,
        shared.data.tenant.id,
      ]),
      (error) => ['42501', '23514'].includes(error.code),
    );
    await assert.rejects(
      owner.query('UPDATE public.tenants SET normalized_code=$2 WHERE id=$1', [
        tenantId,
        'other',
      ]),
      (error) => error.code === '23514',
    );
    await assert.rejects(
      owner.query('UPDATE public.staff_users SET tenant_id=$2 WHERE id=$1', [
        staffId,
        shared.data.tenant.id,
      ]),
      (error) => error.code === '23514',
    );
    await assert.rejects(
      runtime.query(
        'UPDATE public.draft_tenant_receipts SET request_id=$2 WHERE tenant_id=$1',
        [tenantId, randomUUID()],
      ),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      runtime.query(
        'DELETE FROM public.draft_tenant_receipts WHERE tenant_id=$1',
        [tenantId],
      ),
      (error) => error.code === '42501',
    );
    const unlinked = (
      await runtime.query(
        "SELECT id FROM public.tenants WHERE normalized_code='session.tenant'",
      )
    ).rows[0].id;
    await assert.rejects(
      runtime.query(
        'INSERT INTO public.draft_tenant_receipts(operator_id,request_id,fingerprint,tenant_id,staff_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          foreign.record.identityId,
          randomUUID(),
          'a'.repeat(64),
          unlinked,
          staffId,
          randomUUID(),
        ],
      ),
      (error) => error.code === '23503',
    );
    console.log(
      'PASS draft A-02: bounded normalization, malformed/forged input, all-status collision, immutable ownership and shared usernames',
    );

    for (const [table, condition] of [
      ['staff_users', "credential_state <> 'unset'"],
      ['draft_tenant_receipts', 'false'],
      [
        'audit_events',
        "event_type <> 'identity.storage.changed' OR metadata->>'change' <> 'staff_created'",
      ],
    ]) {
      const count = await counts();
      const body = data();
      await owner.query(
        `ALTER TABLE public.${table} ADD CONSTRAINT draft_fault CHECK (${condition}) NOT VALID`,
      );
      try {
        assert.equal((await post(a, s, body)).status, 503);
        assert.deepEqual(await counts(), count);
      } finally {
        await owner.query(
          `ALTER TABLE public.${table} DROP CONSTRAINT draft_fault`,
        );
      }
      assert.equal((await post(b, s, body)).status, 201);
    }
    // A unique failure in required audit is an outage, never a code conflict.
    const auditUniqueCount = await counts();
    const auditUniqueAttempt = data();
    await owner.query(
      "CREATE FUNCTION public.draft_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='identity.storage.changed' AND NEW.metadata->>'change'='tenant_created' THEN RAISE EXCEPTION 'Fixture failure' USING ERRCODE='23505', CONSTRAINT='draft_audit_unique_fixture'; END IF; RETURN NEW; END $$",
    );
    await owner.query(
      'CREATE TRIGGER draft_audit_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.draft_audit_fault()',
    );
    try {
      assert.equal((await post(a, s, auditUniqueAttempt)).status, 503);
      assert.deepEqual(await counts(), auditUniqueCount);
    } finally {
      await owner.query(
        'DROP TRIGGER draft_audit_fault ON public.audit_events',
      );
      await owner.query('DROP FUNCTION public.draft_audit_fault()');
    }
    assert.equal((await post(b, s, auditUniqueAttempt)).status, 201);
    // Scoped handles share backend PID and poison even when the callback catches
    // a required failure. Root/child targets are independent and child expires.
    let escaped;
    const rootId = randomUUID(),
      childId = randomUUID();
    const context = {
      actor: {
        kind: 'platform_operator',
        reference: s.record.identityId,
        plane: 'platform',
        tenantId: null,
      },
      target: { type: 'tenant', reference: rootId, tenantId: null },
      correlationId: randomUUID(),
    };
    const count = await counts();
    await assert.rejects(
      Transaction.run(
        pool,
        context,
        'draft.fixture',
        new SafeLogger('http', () => {}),
        async (tx) => {
          assert.equal(
            (
              await new TenantRepository().create(tx, {
                id: rootId,
                code: `scope.${rootId}`,
                displayName: 'Scope',
                status: 'draft',
              })
            ).kind,
            'found',
          );
          const pid = (await tx.query('SELECT pg_backend_pid() AS pid')).rows[0]
            .pid;
          await tx.withStaffCreationTarget(childId, async (scoped) => {
            escaped = scoped;
            assert.equal(
              (await scoped.query('SELECT pg_backend_pid() AS pid')).rows[0]
                .pid,
              pid,
            );
            assert.equal(
              scoped.context.actor.reference,
              tx.context.actor.reference,
            );
            assert.equal(
              scoped.context.correlationId,
              tx.context.correlationId,
            );
            assert.equal(
              (
                await new FirstAdministratorRepository().create(scoped, {
                  id: childId,
                  tenantId: rootId,
                  username: 'admin',
                })
              ).kind,
              'found',
            );
            assert.equal(
              (
                await new FirstAdministratorRepository().create(scoped, {
                  id: randomUUID(),
                  tenantId: rootId,
                  username: 'other',
                })
              ).kind,
              'invalid',
            );
            try {
              await scoped.required(async () => {
                throw new Error('forced');
              });
            } catch {
              /* verify poison survives a caught failure */
            }
          });
          assert.equal(tx.context.target.reference, rootId);
        },
      ),
    );
    await assert.rejects(async () => escaped.query('SELECT 1'));
    assert.throws(() => escaped.query('SELECT 1'));
    assert.deepEqual(await counts(), count);
    await assert.rejects(
      Transaction.run(
        pool,
        {
          ...context,
          target: { type: 'tenant', reference: randomUUID(), tenantId: null },
        },
        'draft.fixture',
        new SafeLogger('http', () => {}),
        (tx) => tx.withStaffCreationTarget(randomUUID(), async () => {}),
      ),
    );
    // An unawaited target callback cannot remain usable after outer rollback.
    let releaseScope, lateScope, scopeStarted;
    const started = new Promise((resolve) => {
      scopeStarted = resolve;
    });
    const pendingId = randomUUID();
    let pendingScope;
    await assert.rejects(
      Transaction.run(
        pool,
        {
          ...context,
          target: { type: 'tenant', reference: pendingId, tenantId: null },
        },
        'draft.fixture',
        new SafeLogger('http', () => {}),
        async (tx) => {
          assert.equal(
            (
              await new TenantRepository().create(tx, {
                id: pendingId,
                code: `scope.${pendingId}`,
                displayName: 'Pending scope',
                status: 'draft',
              })
            ).kind,
            'found',
          );
          pendingScope = tx.withStaffCreationTarget(
            randomUUID(),
            async (scoped) => {
              lateScope = scoped;
              scopeStarted();
              await new Promise((resolve) => {
                releaseScope = resolve;
              });
              return scoped.query('SELECT 1');
            },
          );
          await started;
        },
      ),
    );
    assert.throws(() => lateScope.query('SELECT 1'));
    const scopeRejected = assert.rejects(pendingScope);
    releaseScope();
    await scopeRejected;
    assert.deepEqual(await counts(), count);
    console.log(
      'PASS draft A-03: staff/receipt/audit total rollback, runtime grants, same connection, isolated targets and required-write poison',
    );

    async function race(left, right) {
      const before = await counts();
      await owner.query('BEGIN');
      await owner.query(
        'LOCK TABLE public.draft_tenant_receipts IN SHARE MODE',
      );
      const first = post(a, s, left),
        second = post(b, s, right);
      try {
        await barrier('INSERT INTO public.draft_tenant_receipts%');
        await barrier('%', 2);
      } finally {
        await owner.query('COMMIT');
      }
      const results = await Promise.all([first, second]);
      assert.deepEqual(await counts(), {
        tenants: before.tenants + 1,
        staff: before.staff + 1,
        receipts: before.receipts + 1,
        audit: before.audit + 2,
      });
      return results;
    }
    const identical = data();
    const identicalRace = await race(identical, { ...identical });
    assert.deepEqual(identicalRace.map((r) => r.status).sort(), [200, 201]);
    assert.deepEqual(identicalRace[0].data, identicalRace[1].data);
    const changed = await post(b, s, { ...identical, displayName: 'Changed' });
    assert.equal(changed.status, 409);
    assert.equal(changed.data.reason, 'request_conflict');
    const changedAttempt = data();
    const changedRace = await race(changedAttempt, {
      ...changedAttempt,
      displayName: 'Other canonical name',
    });
    assert.deepEqual(
      changedRace.map((result) => result.status).sort(),
      [201, 409],
    );
    assert.equal(
      changedRace.find((result) => result.status === 409).data.reason,
      'request_conflict',
    );
    const sameCode = data();
    const codeRace = await race(sameCode, {
      ...sameCode,
      requestId: randomUUID(),
    });
    assert.deepEqual(codeRace.map((r) => r.status).sort(), [201, 409]);
    const foreignReplay = await post(b, foreign, identical);
    assert.equal(foreignReplay.status, 409);
    assert.equal(foreignReplay.data.reason, 'tenant_code_conflict');
    assert.equal(
      (
        await runtime.query(
          'SELECT count(*)::int AS n FROM public.draft_tenant_receipts WHERE operator_id=$1 AND request_id=$2',
          [foreign.record.identityId, identical.requestId],
        )
      ).rows[0].n,
      0,
    );
    console.log(
      'PASS draft A-04: barrier-controlled independent HTTP races, exact replay IDs and foreign-operator non-adoption',
    );

    const lost = data();
    const lostCount = await counts();
    assert.equal((await post(a, s, lost, { drop: true })).lost, true);
    assert.equal((await counts()).receipts, lostCount.receipts + 1);
    const restart = await replica();
    const retry = await post(restart, s, lost);
    assert.equal(retry.status, 200);
    const uncertainProxy = await commitProxy(
      /INSERT INTO public\.draft_tenant_receipts/,
    );
    const uncertainReplica = await replica({ runtimeUrl: uncertainProxy.url });
    const uncertain = data();
    const uncertainCount = await counts();
    const unavailable = await post(uncertainReplica, s, uncertain);
    assert.equal(unavailable.status, 503);
    assert.equal(uncertainProxy.dropped(), true);
    assert.equal((await counts()).receipts, uncertainCount.receipts + 1);
    await uncertainReplica('close');
    await a('close');
    const afterRestart = await replica();
    const resolved = await post(afterRestart, s, uncertain);
    assert.equal(resolved.status, 200);
    assert.equal((await counts()).receipts, uncertainCount.receipts + 1);
    assert.equal((await post(b, s, lost)).data.tenant.id, retry.data.tenant.id);
    console.log(
      'PASS draft A-05: actual committed HTTP response loss, PostgreSQL COMMIT acknowledgment loss and explicit retry after process replacement',
    );

    // Refresh the session to keep this API matrix independent of fixture idle time.
    const active = await operator(b);
    for (const path of ['/platform/tenants', `/platform/tenants/${tenantId}`])
      assert.equal((await request(b, path)).status, 401);
    assert.equal(
      (
        await post(b, active, data(), {
          headers: { origin: 'https://evil.invalid' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post(b, active, data(), {
          headers: { 'x-platform-proxy': 'bad' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await post(b, active, data(), { headers: { 'x-platform-csrf': 'bad' } }))
        .status,
      403,
    );
    assert.equal(
      (await post(b, active, data(), { headers: { 'x-forwarded-for': 'bad' } }))
        .status,
      403,
    );
    const expired = await operator(b);
    const expiredRecord = {
      ...expired.record,
      idleExpiresAt: Date.now() - 1,
      lastActivityAt: Date.now() - 2,
    };
    await redis.set(key(expired.token), JSON.stringify(expiredRecord));
    assert.equal((await post(b, expired, data())).status, 401);
    const staff = (
      await owner.query(
        "SELECT id,tenant_id FROM public.staff_users WHERE normalized_username='session.staff'",
      )
    ).rows[0];
    const staffSession = await issue(b, {
      plane: 'tenant',
      identityId: staff.id,
      tenantId: staff.tenant_id,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    sessions.push(staffSession);
    assert.equal((await post(b, staffSession, data())).status, 403);
    assert.equal(
      (await request(b, '/platform/tenants', { session: staffSession })).status,
      403,
    );
    const low = await replica({
      limiterConfig: parseLimiterConfig({
        LIMITER_TRUSTED_PROXIES: '127.0.0.1',
        LIMITER_PLATFORM_PROTECTED_IDENTITY: '1',
      }),
    });
    const limitedSession = await operator(low);
    // Mixed policies fail closed in the shared registry; use the isolated
    // fixture-owned key to start a fresh consistent-policy saturation check.
    assert.equal(
      (await request(low, '/platform/tenants', { session: limitedSession }))
        .status,
      503,
    );
    await redis.del('myims:limiter:v1:platform.protected');
    assert.equal(
      (await request(low, '/platform/tenants', { session: limitedSession }))
        .status,
      200,
    );
    const limited = await post(low, limitedSession, data());
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers['retry-after']) >= 1);
    await low('close');
    await redis.del('myims:limiter:v1:platform.protected');
    const redisFault = await proxy('pause');
    const down = await replica({ redisUrl: redisFault.url });
    redisFault.arm();
    assert.equal((await post(down, active, data())).status, 503);
    const pgDown = await replica({
      runtimeUrl: appUrl.replace(/@[^/]+\//, '@127.0.0.1:1/'),
    });
    assert.equal(
      (await request(pgDown, '/platform/tenants', { session: active })).status,
      503,
    );
    // Operator disabled after HTTP read but before held canonical validation lock.
    const stale = await operator(b),
      staleCount = await counts();
    await owner.query('BEGIN');
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [stale.record.identityId],
    );
    const pending = post(b, stale, data());
    try {
      await barrier('%public.platform_operators%FOR SHARE');
    } finally {
      await owner.query('COMMIT');
    }
    assert.equal((await pending).status, 403);
    assert.deepEqual(await counts(), staleCount);
    // Authority acquired first: a disabling update waits for the creation commit.
    const locked = await operator(b),
      lockedBody = data();
    await owner.query('BEGIN');
    await owner.query('LOCK TABLE public.draft_tenant_receipts IN SHARE MODE');
    const held = post(b, locked, lockedBody);
    await barrier('INSERT INTO public.draft_tenant_receipts%');
    const disabling = runtime.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [locked.record.identityId],
    );
    try {
      await barrier('UPDATE public.platform_operators%');
    } finally {
      await owner.query('COMMIT');
    }
    await disabling;
    assert.ok([201, 401].includes((await held).status));
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.draft_tenant_receipts WHERE request_id=$1',
          [lockedBody.requestId],
        )
      ).rows[0].n,
      1,
    );
    console.log(
      'PASS draft A-06: real protected plane/CSRF/Origin/proxy/session/limit/outage denial and operator lock races',
    );

    const current = await operator(b);
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1.5',
      'after=bad',
      'unknown=x',
      'limit=1&limit=2',
    ])
      assert.equal(
        (await request(b, `/platform/tenants?${query}`, { session: current }))
          .status,
        400,
      );
    assert.equal(
      (await request(b, '/platform/tenants/bad', { session: current })).status,
      400,
    );
    assert.equal(
      (
        await request(b, `/platform/tenants/${randomUUID()}`, {
          session: current,
        })
      ).status,
      404,
    );
    const pagePrefix = `page.${randomUUID()}`;
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) SELECT gen_random_uuid(),$1 || '.' || n,'Page fixture','draft' FROM generate_series(1,35) AS n",
      [pagePrefix],
    );
    const defaultPage = await request(b, '/platform/tenants', {
      session: current,
    });
    assert.equal(defaultPage.data.items.length, 25);
    assert.ok(defaultPage.data.nextCursor);
    const maximumPage = await request(b, '/platform/tenants?limit=100', {
      session: current,
    });
    assert.equal(maximumPage.status, 200);
    assert.ok(maximumPage.data.items.length <= 100);
    const canonical = (
      await runtime.query('SELECT id FROM public.tenants ORDER BY id')
    ).rows.map((row) => row.id);
    const seen = [];
    let cursor = null;
    do {
      const page = await request(
        b,
        `/platform/tenants?limit=3${cursor ? `&after=${cursor}` : ''}`,
        { session: current },
      );
      assert.equal(page.status, 200);
      assert.ok(page.data.items.length <= 3);
      seen.push(...page.data.items.map((row) => row.id));
      cursor = page.data.nextCursor;
    } while (cursor);
    assert.deepEqual(seen, canonical);
    const plain = (
      await runtime.query(
        "SELECT id FROM public.tenants WHERE normalized_code='session.tenant'",
      )
    ).rows[0].id;
    assert.deepEqual(
      (await request(b, `/platform/tenants/${plain}`, { session: current }))
        .data.administrator,
      { kind: 'unavailable' },
    );
    await owner.query(
      'UPDATE public.tenants SET display_name=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1',
      [tenantId, 'Live Name'],
    );
    await owner.query(
      "UPDATE public.staff_users SET normalized_username='live.admin',roles=ARRAY['call_taker'],status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [staffId],
    );
    const live = await request(b, `/platform/tenants/${tenantId}`, {
      session: current,
    });
    assert.equal(live.data.tenant.displayName, 'Live Name');
    assert.equal(live.data.administrator.username, 'live.admin');
    assert.deepEqual(live.data.administrator.roles, ['call_taker']);
    assert.equal(live.data.administrator.status, 'disabled');
    const replay = await post(b, s, attempt);
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.data, live.data);
    // Owner-only SELECT revocation proves failed reads never look empty/missing.
    await owner.query(
      'REVOKE SELECT ON public.draft_tenant_receipts FROM myims_runtime',
    );
    try {
      assert.equal(
        (
          await request(b, `/platform/tenants/${tenantId}`, {
            session: current,
          })
        ).status,
        503,
      );
    } finally {
      await owner.query(
        'GRANT SELECT ON public.draft_tenant_receipts TO myims_runtime',
      );
    }
    await owner.query('REVOKE SELECT ON public.tenants FROM myims_runtime');
    try {
      assert.equal(
        (await request(b, '/platform/tenants', { session: current })).status,
        503,
      );
    } finally {
      await owner.query('GRANT SELECT ON public.tenants TO myims_runtime');
    }
    const safe = output.join('') + JSON.stringify(audits);
    for (const sentinel of [
      'draft-verifier-sentinel',
      'password_hash',
      'credential_changed_at',
      'fingerprint',
      config.proxySecret,
      config.csrfSecret,
    ])
      assert.ok(
        !safe.includes(sentinel),
        'Private material leaked from draft DTO/audit',
      );
    secrets.push(
      attempt.displayName,
      attempt.administratorUsername,
      'admin.one',
      'live.admin',
    );
    console.log(
      'PASS draft A-07: indexed stable pagination, safe canonical live reads, missing/provenance distinction and read failure denial',
    );

    const tenants = new TenantAdmissionRepository();
    const admission = new StaffAuthorityRepository(database, tenants, tenants);
    const newAdmin = shared.data.administrator;
    assert.equal(
      (
        await admission.byId({
          plane: 'tenant',
          tenantId: newAdmin.tenantId,
          staffId: newAdmin.id,
        })
      ).kind,
      'denied',
    );
    const fencesBefore = (
      await runtime.query(
        'SELECT count(*)::int AS n FROM public.session_fences',
      )
    ).rows[0].n;
    assert.equal(
      (
        await b(
          'issue',
          {
            plane: 'tenant',
            identityId: newAdmin.id,
            tenantId: newAdmin.tenantId,
            authenticationVersion: 1,
            tenantAuthorityVersion: 1,
          },
          'web',
        )
      ).kind,
      'conflict',
    );
    assert.equal(
      (
        await runtime.query(
          'SELECT count(*)::int AS n FROM public.session_fences',
        )
      ).rows[0].n,
      fencesBefore,
    );
    assert.equal(
      (await runtime.query('SELECT count(*)::int AS n FROM public.outbox_work'))
        .rows[0].n,
      0,
    );
    console.log(
      'PASS draft A-08: canonical admission denial, unset credentials, no staff session/outbox and tenant-qualified handoff',
    );
  } finally {
    // Receipts are deliberately retained; the owning outer harness drops this
    // exact isolated database. Never disable receipt protection to clean runtime.
    try {
      await owner.query('ROLLBACK');
    } catch {
      /* harness teardown owns connection recovery */
    }
    for (const call of calls) if (call.child.connected) await call('close');
    for (const session of sessions) await redis.del(key(session.token));
    await Promise.all([database.close(), pool.end()]);
  }
}
