import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { checkCredentialBrowser } from './check-credential-browser.mjs';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { StaffIssuerBrowser } = load(
  'modules/identity/adapters/http/credential-browser',
);
const { hashPassword, verifyPasswordOutcome } = load(
  'infrastructure/password/scrypt',
);
const { CredentialRuntime } = load(
  'modules/identity/adapters/db/credential-runtime',
);
const { parseLimiterConfig, parseSessionConfig } = backend('@myims/config');
export async function checkCredentialActions({
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
  browserChecks = true,
}) {
  const cfg = () => ({
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  });
  const platform = cfg(),
    exchange = cfg(),
    staff = cfg();
  const limiter = parseLimiterConfig({ LIMITER_TRUSTED_PROXIES: '127.0.0.1' }),
    settings = parseSessionConfig({ SESSION_TIMEOUT_MS: '1000' });
  const calls = [],
    sessions = [],
    capabilities = [];
  let sourceCounter = 1;
  const source = () => `198.51.100.${(sourceCounter++ % 240) + 1}`;
  const registry = (op) => `myims:credential-budget:v1:${op}`;
  async function resetBudgets() {
    await redis.del(['issue', 'cancel', 'exchange'].map(registry));
  }
  async function replica(overrides = {}) {
    const call = await worker({
      http: true,
      productionHttp: true,
      browserConfig: platform,
      exchangeConfig: exchange,
      staffIssuerConfig: staff,
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
      session,
      body,
      mode = 'platform',
      headers = {},
      drop = false,
      address = source(),
    } = {},
  ) {
    const config =
      mode === 'exchange' ? exchange : mode === 'staff' ? staff : platform;
    const prefix =
      mode === 'exchange'
        ? 'credential'
        : mode === 'staff'
          ? 'staff'
          : 'platform';
    const browser =
      mode === 'staff'
        ? new StaffIssuerBrowser(config)
        : new PlatformBrowser(config);
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpRequest(
        `${call.url}${path}`,
        {
          method,
          headers: {
            origin: config.origin,
            [`x-${prefix}-proxy`]: config.proxySecret,
            'x-forwarded-for': address,
            ...(session
              ? {
                  cookie: `__Host-myims-${prefix}=${session.token}`,
                  [`x-${prefix}-csrf`]: browser.sessionProof(session.token),
                }
              : {}),
            ...(payload ? { 'Content-Type': 'application/json' } : {}),
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
          res.on('data', (b) => {
            text += b;
          });
          res.on('end', () => {
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              data = null;
            }
            resolve({
              status: res.statusCode,
              data,
              headers: res.headers,
              text,
            });
          });
          res.on('error', reject);
        },
      );
      req.setTimeout(15000, () =>
        req.destroy(new Error('Credential HTTP deadline')),
      );
      req.on('error', reject);
      req.end(payload);
    });
  }
  async function exchangeRequest(
    call,
    capability,
    password,
    headers = {},
    drop = false,
  ) {
    const bootstrap = await request(call, '/credential-actions/csrf', {
      mode: 'exchange',
    });
    assert.equal(bootstrap.status, 200);
    return request(call, '/credential-actions/exchange', {
      method: 'POST',
      mode: 'exchange',
      body: { capability, password },
      headers: {
        cookie: bootstrap.headers['set-cookie'][0].split(';')[0],
        'x-credential-csrf': bootstrap.data.proof,
        ...headers,
      },
      drop,
    });
  }
  const issueBody = (purpose = 'setup', operation = 'issue') => ({
    purpose,
    operation,
    verificationMethod: 'in_person',
  });
  let a, b, issuer;
  async function draft() {
    const r = await request(a, '/platform/tenants', {
      method: 'POST',
      session: issuer,
      body: {
        requestId: randomUUID(),
        tenantCode: `credential-${randomUUID().slice(0, 8)}`,
        displayName: 'Credential fixture',
        administratorUsername: 'initial.admin',
      },
    });
    assert.equal(r.status, 201);
    return { tenantId: r.data.tenant.id, staffId: r.data.administrator.id };
  }
  const path = (t) =>
    `/platform/tenants/${t.tenantId}/administrator/credential-actions`;
  async function issueAction(
    t,
    purpose = 'setup',
    operation = 'issue',
    call = a,
  ) {
    const r = await request(call, path(t), {
      method: 'POST',
      session: issuer,
      body: issueBody(purpose, operation),
    });
    assert.equal(r.status, 201, 'Qualified action should issue');
    capabilities.push(r.data.capability);
    secrets.push(
      r.data.capability,
      createHash('sha256').update(r.data.capability).digest('hex'),
    );
    return r.data;
  }
  async function row(t) {
    return (
      await owner.query(
        'SELECT credential_state,password_hash,credential_changed_at,version,authentication_version FROM public.staff_users WHERE tenant_id=$1 AND id=$2',
        [t.tenantId, t.staffId],
      )
    ).rows[0];
  }
  async function barrier(call) {
    for (let i = 0; i < 500; i++) {
      if ((await call('barrier')).entered) return;
      await delay(20);
    }
    throw new Error('Credential barrier deadline');
  }
  const password = ' Exact staff password Åe\u0301 2026 ';
  secrets.push(password);
  try {
    a = await replica();
    b = await replica();
    const operatorId = randomUUID();
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','credential-lifecycle-sentinel',clock_timestamp())",
      [operatorId, `lifecycle.${operatorId}`],
    );
    issuer = await issue(a, {
      plane: 'platform',
      identityId: operatorId,
      authenticationVersion: 1,
    });
    sessions.push(issuer);
    const t = await draft(),
      issued = await issueAction(t);
    assert.equal((await request(b, path(t), { session: issuer })).status, 200);
    assert.ok(
      !(await request(b, path(t), { session: issuer })).text.includes(
        issued.capability,
      ),
    );
    assert.equal(
      (
        await request(b, path(t), {
          method: 'POST',
          session: issuer,
          body: issueBody(),
        })
      ).status,
      409,
    );
    assert.equal(
      (await exchangeRequest(b, issued.capability, 'short')).status,
      400,
    );
    for (const invalidPassword of [
      'x'.repeat(14),
      'x'.repeat(129),
      '😀'.repeat(129),
      'valid password text\0',
      'valid password text\n',
      'valid password text\u2028',
    ]) {
      const before = await b('stats');
      assert.equal(
        (await exchangeRequest(b, issued.capability, invalidPassword)).status,
        400,
      );
      const after = await b('stats');
      assert.equal(after.hashes, before.hashes);
      assert.equal(after.lookups, before.lookups);
    }
    assert.equal(
      (await exchangeRequest(b, issued.capability, 'x'.repeat(15) + '\ud800'))
        .status,
      400,
    );
    assert.equal(
      (
        await exchangeRequest(b, issued.capability, password, {
          origin: 'https://foreign.invalid',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await exchangeRequest(b, issued.capability, password, {
          'x-credential-csrf': 'a'.repeat(43),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(b, '/credential-actions/exchange', {
          method: 'POST',
          mode: 'exchange',
          body: { capability: issued.capability, password },
        })
      ).status,
      403,
    );
    assert.equal(
      (await exchangeRequest(b, issued.capability, password)).status,
      201,
    );
    const ready = await row(t);
    assert.equal(ready.credential_state, 'ready');
    assert.equal(ready.authentication_version, 2);
    assert.ok(ready.credential_changed_at instanceof Date);
    assert.equal(
      (await verifyPasswordOutcome(Buffer.from(password), ready.password_hash))
        .kind,
      'match',
    );
    assert.equal(
      (
        await verifyPasswordOutcome(
          Buffer.from(password.trim()),
          ready.password_hash,
        )
      ).kind,
      'mismatch',
    );
    assert.equal(
      (
        await owner.query('SELECT status FROM public.tenants WHERE id=$1', [
          t.tenantId,
        ])
      ).rows[0].status,
      'draft',
    );
    assert.equal(
      (await exchangeRequest(a, issued.capability, password)).status,
      401,
    );
    assert.equal(
      (
        await a(
          'issue',
          {
            plane: 'tenant',
            tenantId: t.tenantId,
            identityId: t.staffId,
            authenticationVersion: 2,
            tenantAuthorityVersion: 1,
          },
          'web',
        )
      ).kind,
      'conflict',
    );
    const audit = (
      await owner.query(
        "SELECT actor_kind,actor_reference,metadata FROM public.audit_events WHERE event_type='identity.credential-action' AND metadata->>'operation'='consumed' AND tenant_id=$1",
        [t.tenantId],
      )
    ).rows[0];
    assert.equal(audit.actor_kind, 'system');
    assert.equal(audit.actor_reference, 'identity.credential-exchange');
    assert.equal(audit.metadata.issuerId, operatorId);
    assert.equal(audit.metadata.actionId, issued.action.id);
    console.log(
      'PASS credential A-02: real draft create/linked setup/exchange, coherent exact-byte hash/version/audit, no activation/session and canonical draft admission denial',
    );
    for (const boundaryPassword of [' '.repeat(15), '😀'.repeat(128)]) {
      secrets.push(boundaryPassword);
      const boundary = await draft(),
        code = await issueAction(boundary);
      assert.equal(
        (await exchangeRequest(b, code.capability, boundaryPassword)).status,
        201,
      );
      assert.equal(
        (
          await verifyPasswordOutcome(
            Buffer.from(boundaryPassword),
            (await row(boundary)).password_hash,
          )
        ).kind,
        'match',
      );
    }
    await resetBudgets();
    const old = await issueAction(t, 'reset'),
      newAction = await issueAction(t, 'reset', 'reissue', b);
    assert.equal(
      (await exchangeRequest(a, old.capability, password)).status,
      401,
    );
    assert.equal(
      (
        await request(a, `${path(t)}/${newAction.action.id}/cancel`, {
          method: 'POST',
          session: issuer,
          body: {},
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(b, `${path(t)}/${newAction.action.id}/cancel`, {
          method: 'POST',
          session: issuer,
          body: {},
        })
      ).status,
      201,
    );
    assert.equal(
      (await exchangeRequest(b, newAction.capability, password)).status,
      401,
    );
    const exp = await issueAction(t, 'reset');
    await owner.query(
      'ALTER TABLE public.credential_actions DISABLE TRIGGER credential_action_immutable',
    );
    await owner.query(
      "UPDATE public.credential_actions SET issued_at=statement_timestamp()-interval '31 minutes',expires_at=statement_timestamp()-interval '1 minute' WHERE id=$1",
      [exp.action.id],
    );
    await owner.query(
      'ALTER TABLE public.credential_actions ENABLE TRIGGER credential_action_immutable',
    );
    assert.equal(
      (await exchangeRequest(a, exp.capability, password)).status,
      401,
    );
    await assert.rejects(
      runtime.query('DELETE FROM public.credential_actions WHERE id=$1', [
        exp.action.id,
      ]),
    );
    await assert.rejects(
      runtime.query(
        'UPDATE public.credential_actions SET lookup_hash=$2 WHERE id=$1',
        [exp.action.id, 'a'.repeat(64)],
      ),
    );
    for (const bad of [
      { ...issueBody('reset'), operation: ['reissue'] },
      { ...issueBody('reset'), purpose: ['reset'] },
      { ...issueBody('reset'), verificationMethod: ['in_person'] },
    ])
      assert.equal(
        (
          await request(a, path(t), {
            method: 'POST',
            session: issuer,
            body: bad,
          })
        ).status,
        400,
      );
    const fake = await request(a, path(t), {
      method: 'POST',
      session: issuer,
      body: { ...issueBody('reset'), staffId: randomUUID() },
    });
    assert.equal(fake.status, 400);
    assert.equal(
      (
        await request(a, path(t), {
          method: 'POST',
          session: issuer,
          body: issueBody('reset'),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(b, path(t), {
          method: 'POST',
          session: issuer,
          body: issueBody('reset'),
        })
      ).status,
      409,
    );
    const limited = await request(a, path(t), {
      method: 'POST',
      session: issuer,
      body: issueBody('reset'),
    });
    assert.equal(limited.status, 429);
    assert.equal(
      (
        await request(b, path({ tenantId: t.tenantId.toUpperCase() }), {
          method: 'POST',
          session: issuer,
          body: issueBody('reset'),
        })
      ).status,
      429,
    );

    console.log(
      'PASS credential A-03/04: bounded inputs, immutable secrets, reissue/cancel/expiry, retained audit and shared target limits',
    );
    await resetBudgets();
    const raced = await issueAction(t, 'reset', 'reissue');
    await a('prepare', 'after-hash');
    const consumption = exchangeRequest(a, raced.capability, password);
    await barrier(a);
    assert.equal(
      (
        await request(b, `${path(t)}/${raced.action.id}/cancel`, {
          method: 'POST',
          session: issuer,
          body: {},
        })
      ).status,
      201,
    );
    await a('release');
    assert.equal((await consumption).status, 401);
    assert.equal((await row(t)).authentication_version, 2);
    const raceTwo = await issueAction(t, 'reset');
    const results = await Promise.all([
      exchangeRequest(a, raceTwo.capability, password),
      exchangeRequest(b, raceTwo.capability, password),
    ]);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 401).length, 1);
    await resetBudgets();
    const reissueRace = await issueAction(t, 'reset');
    await a('prepare', 'after-hash');
    const oldExchange = exchangeRequest(a, reissueRace.capability, password);
    await barrier(a);
    await issueAction(t, 'reset', 'reissue', b);
    await a('release');
    assert.equal((await oldExchange).status, 401);
    const failedTarget = await draft(),
      failedAction = await issueAction(failedTarget);
    await owner.query(
      "CREATE FUNCTION public.credential_fixture_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='identity.credential-action' AND NEW.metadata->>'operation'='consumed' THEN RAISE EXCEPTION 'Fixture audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER credential_fixture_audit_failure BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.credential_fixture_audit_failure()",
    );
    assert.equal(
      (await exchangeRequest(a, failedAction.capability, password)).status,
      503,
    );
    assert.equal((await row(failedTarget)).credential_state, 'unset');
    assert.equal(
      (
        await owner.query(
          'SELECT state FROM public.credential_actions WHERE id=$1',
          [failedAction.action.id],
        )
      ).rows[0].state,
      'pending',
    );
    await owner.query(
      'DROP TRIGGER credential_fixture_audit_failure ON public.audit_events; DROP FUNCTION public.credential_fixture_audit_failure()',
    );
    await a('hash-failure', true);
    assert.equal(
      (await exchangeRequest(a, failedAction.capability, password)).status,
      503,
    );
    await a('hash-failure', false);
    await a('prepare', 'before-hash');
    const slow = exchangeRequest(a, failedAction.capability, password);
    await barrier(a);
    await owner.query(
      "UPDATE public.tenants SET status='suspended',version=version+1,authority_version=authority_version+1 WHERE id=$1",
      [failedTarget.tenantId],
    );
    await a('release');
    assert.equal((await slow).status, 401);
    assert.equal((await row(failedTarget)).credential_state, 'unset');
    console.log(
      'PASS credential A-05: independent A/B consumption/cancel/reissue races, suspension during hashing and required audit/hash rollback',
    );
    await resetBudgets();
    const active = await draft(),
      setup = await issueAction(active);
    assert.equal(
      (await exchangeRequest(a, setup.capability, password)).status,
      201,
    );
    await owner.query(
      "UPDATE public.tenants SET status='active',version=version+1,authority_version=authority_version+1 WHERE id=$1",
      [active.tenantId],
    );
    const facts = {
      plane: 'tenant',
      tenantId: active.tenantId,
      identityId: active.staffId,
      authenticationVersion: 2,
      tenantAuthorityVersion: 2,
    };
    const web = await issue(a, facts, 'web'),
      mobile = await issue(b, facts, 'mobile');
    sessions.push(web, mobile);
    const webRaw = await redis.get(key(web.token)),
      mobileRaw = await redis.get(key(mobile.token));
    const secondAdmin = randomUUID();
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'second.admin','active','ready','coherent-fixture',clock_timestamp(),ARRAY['tenant_admin'])",
      [secondAdmin, active.tenantId],
    );
    assert.equal(
      (
        await request(a, path(active), {
          method: 'POST',
          session: issuer,
          body: issueBody('reset'),
        })
      ).status,
      403,
    );
    await owner.query(
      "UPDATE public.staff_users SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
      [secondAdmin],
    );
    const reset = await issueAction(active, 'reset');
    await owner.query(
      'REVOKE UPDATE(state,terminal_at) ON public.credential_actions FROM myims_runtime',
    );
    assert.equal(
      (await exchangeRequest(a, reset.capability, password + ' changed'))
        .status,
      503,
    );
    assert.equal((await row(active)).authentication_version, 2);
    assert.equal(
      (
        await owner.query(
          'SELECT state FROM public.credential_actions WHERE id=$1',
          [reset.action.id],
        )
      ).rows[0].state,
      'pending',
    );
    assert.equal(
      (
        await request(b, '/staff/credential-actions/session', {
          session: web,
          mode: 'staff',
        })
      ).status,
      200,
    );
    await owner.query(
      'GRANT UPDATE(state,terminal_at) ON public.credential_actions TO myims_runtime',
    );

    assert.equal(
      (
        await request(a, '/staff/credential-actions/session', {
          session: web,
          mode: 'staff',
        })
      ).status,
      200,
    );
    assert.equal(
      (await exchangeRequest(b, reset.capability, password + ' changed'))
        .status,
      201,
    );
    for (const call of [a, b])
      assert.equal(
        (
          await request(call, '/staff/credential-actions/session', {
            session: web,
            mode: 'staff',
          })
        ).status,
        401,
      );
    await redis.set(key(web.token), webRaw, { PX: 60000 });
    await redis.set(key(mobile.token), mobileRaw, { PX: 60000 });
    for (const call of [a, b])
      for (const s of [web, mobile])
        assert.equal(
          (
            await request(call, '/staff/credential-actions/session', {
              session: s,
              mode: 'staff',
            })
          ).status,
          401,
        );
    const newFacts = { ...facts, authenticationVersion: 3 };
    const adminSession = await issue(a, newFacts);
    sessions.push(adminSession);
    const staffTarget = randomUUID();
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'other.staff','active','unset',NULL,NULL,ARRAY['call_taker'])",
      [staffTarget, active.tenantId],
    );
    const staffIssue = await request(a, '/staff/credential-actions', {
      method: 'POST',
      mode: 'staff',
      session: adminSession,
      body: { ...issueBody(), tenantId: active.tenantId, staffId: staffTarget },
    });
    assert.equal(staffIssue.status, 201);
    await resetBudgets();
    const cancelLookups = (await b('stats')).lookups;
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await request(b, `/staff/credential-actions/${randomUUID()}/cancel`, {
            method: 'POST',
            mode: 'staff',
            session: adminSession,
            body: {},
          })
        ).status,
        404,
      );
    assert.equal(
      (
        await request(a, `/staff/credential-actions/${randomUUID()}/cancel`, {
          method: 'POST',
          mode: 'staff',
          session: adminSession,
          body: {},
        })
      ).status,
      429,
    );
    assert.equal((await b('stats')).lookups, cancelLookups);
    await resetBudgets();
    capabilities.push(staffIssue.data.capability);
    secrets.push(
      staffIssue.data.capability,
      createHash('sha256').update(staffIssue.data.capability).digest('hex'),
    );
    assert.equal(
      (
        await request(b, '/staff/credential-actions', {
          method: 'POST',
          mode: 'staff',
          session: adminSession,
          body: {
            ...issueBody('reset'),
            tenantId: active.tenantId.toUpperCase(),
            staffId: active.staffId.toUpperCase(),
          },
        })
      ).status,
      403,
    );

    assert.equal(
      (
        await request(b, '/staff/credential-actions', {
          method: 'POST',
          mode: 'staff',
          session: adminSession,
          body: {
            ...issueBody('reset'),
            tenantId: active.tenantId,
            staffId: active.staffId,
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(b, '/staff/credential-actions', {
          method: 'POST',
          mode: 'staff',
          session: adminSession,
          body: { ...issueBody(), tenantId: t.tenantId, staffId: t.staffId },
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(b, path(active), { session: adminSession, mode: 'staff' }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(b, '/staff/credential-actions/session', {
          session: issuer,
        })
      ).status,
      403,
    );
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['call_taker'],version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
      [active.staffId],
    );
    assert.equal(
      (await exchangeRequest(b, staffIssue.data.capability, password)).status,
      401,
    );
    console.log(
      'PASS credential A-03/06: approved staff issuer/self/foreign/plane qualification, issuer-role invalidation and web/mobile A/B stale Redis restoration denial',
    );
    await resetBudgets();
    const interrupted = await draft(),
      interruptedAction = await issueAction(interrupted),
      interruptedReplica = await replica();
    await interruptedReplica('prepare', 'before-terminal');
    const interruptedExchange = exchangeRequest(
      interruptedReplica,
      interruptedAction.capability,
      password,
    ).catch(() => ({ lost: true }));
    await barrier(interruptedReplica);
    const exited = once(interruptedReplica.child, 'exit');
    interruptedReplica.child.kill('SIGKILL');
    await exited;
    await interruptedExchange;
    assert.equal((await row(interrupted)).credential_state, 'unset');
    assert.equal(
      (
        await owner.query(
          'SELECT state FROM public.credential_actions WHERE id=$1',
          [interruptedAction.action.id],
        )
      ).rows[0].state,
      'pending',
    );
    assert.equal(
      (await exchangeRequest(b, interruptedAction.capability, password)).status,
      201,
    );
    console.log(
      'PASS credential A-05/06: physical precommit process interruption and required SQL rollback preserve pending actions, old credentials and prior sessions',
    );
    await resetBudgets();
    const capacityOne = await draft(),
      capacityTwo = await draft();
    const codeOne = await issueAction(capacityOne),
      codeTwo = await issueAction(capacityTwo);
    const countBefore = (await a('stats')).hashes;
    await a('prepare', 'before-hash');
    const capacityFirst = exchangeRequest(a, codeOne.capability, password),
      capacitySecond = exchangeRequest(a, codeTwo.capability, password);
    for (let i = 0; i < 500; i++) {
      if ((await a('stats')).hashes >= countBefore + 2) break;
      if (i === 499) throw new Error('Hash capacity barrier deadline');
      await delay(20);
    }
    await a('release');
    const capacityResults = await Promise.all([capacityFirst, capacitySecond]);
    assert.equal(capacityResults.filter((r) => r.status === 201).length, 1);
    assert.equal(capacityResults.filter((r) => r.status === 503).length, 1);
    const rejected =
      capacityResults[0].status === 503 ? capacityOne : capacityTwo;
    assert.equal((await row(rejected)).credential_state, 'unset');
    await resetBudgets();
    const unknown = randomBytes(32).toString('base64url');
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await exchangeRequest(i % 2 ? a : b, unknown, password)).status,
        401,
      );
    const lookupBefore =
      (await a('stats')).lookups + (await b('stats')).lookups;
    assert.equal((await exchangeRequest(b, unknown, password)).status, 429);
    assert.equal(
      (await a('stats')).lookups + (await b('stats')).lookups,
      lookupBefore,
    );
    await resetBudgets();
    const { RedisCredentialBudgets } = load(
      'modules/identity/adapters/redis/credential-budgets',
    );
    const budgetsA = new RedisCredentialBudgets(redis.options.url, settings),
      budgetsB = new RedisCredentialBudgets(redis.options.url, settings);
    for (let i = 0; i < 20; i++)
      assert.equal(
        (
          await (i % 2 ? budgetsA : budgetsB).consume(
            'issue',
            `203.0.113.${i + 1}`,
            'shared-issuer',
            `target-${i}`,
          )
        ).kind,
        'admitted',
      );
    assert.equal(
      (
        await budgetsB.consume(
          'issue',
          '203.0.113.90',
          'shared-issuer',
          'target-final',
        )
      ).kind,
      'limited',
    );
    await resetBudgets();
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await (i % 2 ? budgetsA : budgetsB).consume(
            'exchange',
            '203.0.113.200',
            null,
            `token-${i}`,
          )
        ).kind,
        'admitted',
      );
    assert.equal(
      (await budgetsA.consume('exchange', '203.0.113.200', null, 'token-final'))
        .kind,
      'limited',
    );
    await resetBudgets();
    const allocation = { __policy: 'v1' };
    for (let i = 0; i < 8192; i++) allocation[`fixture:${i}`] = '0';
    await redis.hSet(registry('exchange'), allocation);
    await redis.pExpire(registry('exchange'), 900000);
    assert.equal(
      (
        await exchangeRequest(
          b,
          randomBytes(32).toString('base64url'),
          password,
        )
      ).status,
      503,
    );
    budgetsA.close();
    budgetsB.close();
    await resetBudgets();
    const redisFault = await proxy(),
      faultReplica = await replica({ redisUrl: redisFault.url });
    redisFault.arm();
    assert.equal(
      (
        await exchangeRequest(
          faultReplica,
          randomBytes(32).toString('base64url'),
          password,
        )
      ).status,
      503,
    );
    assert.equal(redisFault.seen(), true);
    console.log(
      'PASS credential A-04: real bounded hasher exhaustion, source/issuer/capability counters shared before lookup, hostile allocation capacity and Redis write-response loss',
    );
    await resetBudgets();
    const lost = await draft(),
      lossProxy = await commitProxy(/INSERT INTO public\.credential_actions/),
      lossReplica = await replica({ runtimeUrl: lossProxy.url });
    assert.equal(
      (
        await request(lossReplica, path(lost), {
          method: 'POST',
          session: issuer,
          body: issueBody(),
        })
      ).status,
      503,
    );
    assert.equal(lossProxy.dropped(), true);
    const status = await request(b, path(lost), { session: issuer });
    assert.equal(status.status, 200);
    assert.equal(status.data.action.state, 'pending');
    assert.ok(!status.text.includes('capability'));
    const replacement = await issueAction(lost, 'setup', 'reissue');
    const exchangeProxy = await commitProxy(/UPDATE public\.staff_users/),
      exchangeReplica = await replica({ runtimeUrl: exchangeProxy.url });
    assert.equal(
      (await exchangeRequest(exchangeReplica, replacement.capability, password))
        .status,
      503,
    );
    assert.equal(exchangeProxy.dropped(), true);
    assert.equal((await row(lost)).credential_state, 'ready');
    assert.equal(
      (await exchangeRequest(b, replacement.capability, password)).status,
      401,
    );
    const unavailableProxy = await commitProxy(/SELECT /);
    const unavailable = await replica({ runtimeUrl: unavailableProxy.url });
    assert.equal(
      (
        await request(unavailable, path(lost), {
          method: 'POST',
          session: issuer,
          body: issueBody('reset'),
        })
      ).status,
      503,
    );
    await resetBudgets();
    const retention = await draft(),
      retain = await issueAction(retention);
    await owner.query(
      'ALTER TABLE public.credential_actions DISABLE TRIGGER credential_action_immutable',
    );
    await owner.query(
      "UPDATE public.credential_actions SET issued_at=statement_timestamp()-interval '32 days',expires_at=statement_timestamp()-interval '31 days' WHERE id=$1",
      [retain.action.id],
    );
    await owner.query(
      'ALTER TABLE public.credential_actions ENABLE TRIGGER credential_action_immutable',
    );
    const base = load('infrastructure/configuration').loadBackendConfig();
    const cleanup = new CredentialRuntime({
      ...base,
      database: { url: appUrl },
      sessionRedis: { url: redis.options.url },
      sessions: settings,
    });
    assert.equal((await cleanup.service.cleanup(101)).kind, 'invalid');
    assert.equal((await cleanup.service.cleanup(1)).count, 1);
    await cleanup.onApplicationShutdown();
    assert.equal(
      (await exchangeRequest(b, retain.capability, password)).status,
      401,
    );
    console.log(
      'PASS credential A-04/05/08: actual COMMIT response loss, explicit reissue/reconciliation, unavailable primary and bounded audited retention',
    );
    if (browserChecks)
      await checkCredentialBrowser({
        owner,
        worker,
        redis,
        issue,
        key,
        secrets,
        settings,
        limiter,
        password,
        hashPassword,
      });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Credential HTTPS browser acceptance failed')
    )
      throw error;
    const location =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .find((line) => /check-credential-actions\.mjs:\d+/.test(line))
            ?.trim()
        : '';
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      /^[A-Z0-9_]+$/.test(String(error.code))
        ? String(error.code)
        : 'acceptance';
    // eslint-disable-next-line preserve-caught-error -- SQL/HTTP assertions may contain capability hashes or passwords.
    throw new Error(
      `Credential lifecycle ${code} failed${location ? ` (${location})` : ''}`,
    );
  } finally {
    for (const call of calls)
      if (call.child.connected) await call('close').catch(() => {});
    for (const s of sessions) await redis.del(key(s.token));
    await resetBudgets();
  }
}
