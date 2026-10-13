import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTimeout as delay } from 'node:timers/promises';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkStaffBrowser({
  progress = () => {},
  nativeRequest,
  owner,
  redis,
  key,
  secrets,
  password,
  hash,
  form,
  recipient,
  staff,
  exchange,
  calls,
  select,
  drop,
  gate,
}) {
  await owner.query(
    'CREATE SCHEMA IF NOT EXISTS guard_fixture; CREATE TABLE IF NOT EXISTS guard_fixture.writes(tenant_id uuid,actor_id uuid); GRANT USAGE ON SCHEMA guard_fixture TO myims_runtime; GRANT SELECT,INSERT ON guard_fixture.writes TO myims_runtime',
  );
  const tenantId = randomUUID(),
    secondTenant = randomUUID(),
    adminId = randomUUID(),
    otherId = randomUUID(),
    targetId = randomUUID(),
    callerId = randomUUID();
  const code = `staff-browser-${tenantId.slice(0, 8)}`,
    secondCode = `staff-browser-${secondTenant.slice(0, 8)}`;
  await owner.query(
    "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Staff browser fixture','active'),($3,$4,'Staff browser fixture two','active')",
    [tenantId, code, secondTenant, secondCode],
  );
  await owner.query(
    "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'issuer','active','ready',$3,clock_timestamp(),ARRAY['tenant_admin']),($4,$5,'issuer','active','ready',$3,clock_timestamp(),ARRAY['tenant_admin']),($6,$2,'recipient','active','unset',NULL,NULL,ARRAY['call_taker']),($7,$2,'caller','active','ready',$3,clock_timestamp(),ARRAY['call_taker'])",
    [adminId, tenantId, hash, otherId, secondTenant, targetId, callerId],
  );
  const login = async (tenant = code, username = 'issuer') => {
    await form.getByLabel(/^Tenant code/).fill(tenant);
    await form.getByLabel(/^Username/).fill(username);
    await form.getByLabel(/^Password/).fill(password);
    await form.getByRole('button', { name: 'Sign in', exact: true }).focus();
    await form.keyboard.press('Enter');
    try {
      await expect(
        form.getByRole('button', {
          name: 'Sign out',
          exact: true,
          includeHidden: true,
        }),
      ).toBeVisible();
    } catch {
      const text = await form.getByRole('alert').allTextContents();
      const outcome =
        [
          'Invalid credentials',
          'Access denied',
          'Service unavailable',
          'Too many requests',
          'Wait for the retry',
        ].find((prefix) => text.some((value) => value.startsWith(prefix))) ??
        'no recognized error';
      throw new Error(`Credential browser staff login outcome: ${outcome}`);
    }
    await form.waitForLoadState('networkidle');
    const cookie = (await recipient.cookies()).find(
      (c) => c.name === '__Host-myims-staff',
    );
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    secrets.push(cookie.value);
    return cookie;
  };
  const metadata = () =>
    form.evaluate(async () => {
      const r = await fetch('/staff/auth/browser/session');
      return {
        status: r.status,
        cache: r.headers.get('cache-control'),
        data: await r.json(),
      };
    });
  const invalidate = async () => {
    const cookie = (await recipient.cookies()).find(
      (c) => c.name === '__Host-myims-staff',
    );
    await redis.del(key(cookie.value));
    await form.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      form.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
  };
  progress('sign-in and issuer');
  await form.goto(`${staff.origin}/sign-in?returnTo=%2Fcredential-issuer`);
  assert.equal(await form.locator('input').count(), 3);
  select(calls[0]);
  const firstCookie = await login();
  select(calls[1]);
  const first = await metadata();
  assert.equal(first.status, 200);
  assert.equal(first.cache, 'no-store');
  assert.equal(first.data.tenantId, tenantId);
  assert.equal(first.data.staffId, adminId);
  secrets.push(first.data.proof);
  await expect(
    form.getByLabel('Target staff ID', { exact: true }),
  ).toBeVisible();
  await form.getByLabel('Target staff ID', { exact: true }).fill(targetId);
  await form.getByRole('checkbox').check();
  await form
    .getByRole('button', { name: 'Issue staff code', exact: true })
    .click();
  await expect(form.getByLabel('One-time handoff code')).toBeVisible();
  const capability = await form
    .getByLabel('One-time handoff code')
    .textContent();
  secrets.push(capability);
  await form.getByRole('button', { name: 'Hide code', exact: true }).click();
  assert.deepEqual(
    (await new AxeBuilder({ page: form }).analyze()).violations,
    [],
  );
  await invalidate();
  await expect(
    form.getByLabel('Target staff ID', { exact: true }),
  ).toBeHidden();
  await login();
  await expect(form.getByLabel('Target staff ID', { exact: true })).toHaveValue(
    targetId,
  );
  progress('shipping native HTTPS ingress separation');
  const native = await nativeRequest('sign-in', {
    tenantCode: code,
    username: 'issuer',
    password,
  });
  assert.equal(native.status, 201);
  secrets.push(native.data.token);
  select(calls[1]);
  const nativeSession = await nativeRequest(
    'session',
    undefined,
    native.data.token,
  );
  assert.equal(nativeSession.status, 200);
  assert.equal(nativeSession.data.tenantId, tenantId);
  assert.equal(nativeSession.data.staffId, adminId);
  assert.equal(nativeSession.headers['cache-control'], 'no-store');
  for (const headers of [
    { Origin: staff.origin },
    { Cookie: '__Host-myims-staff=invalid' },
    { 'Sec-Fetch-Site': 'same-origin' },
    { 'X-Staff-Proxy': 'a'.repeat(64) },
  ])
    assert.equal(
      (await nativeRequest('session', undefined, native.data.token, headers))
        .status,
      403,
    );
  assert.equal(
    (
      await nativeRequest(
        'session',
        undefined,
        (await recipient.cookies()).find((c) => c.name === '__Host-myims-staff')
          .value,
      )
    ).status,
    403,
  );
  const nativeLogout = await nativeRequest(
    'logout',
    undefined,
    native.data.token,
  );
  assert.equal(
    nativeLogout.status,
    201,
    `Credential browser native logout returned ${nativeLogout.status}`,
  );
  select(calls[0]);
  assert.equal(
    (await nativeRequest('session', undefined, native.data.token)).status,
    401,
  );
  // Native logout preserves browser authority on the other device.
  assert.equal((await metadata()).status, 200);
  progress('real staff issuer recipient exchange');
  // Actual recipient exchange from the real logged-in issuer.
  const exchangeContext = await recipient
    .browser()
    .newContext({ ignoreHTTPSErrors: true });
  const exchangePage = await exchangeContext.newPage();
  await exchangePage.goto(`${exchange.origin}/credentials`);
  await exchangePage
    .getByLabel('Handoff code', { exact: true })
    .fill(capability);
  await exchangePage.getByLabel('New password', { exact: true }).fill(password);
  await exchangePage
    .getByLabel('Confirm password', { exact: true })
    .fill(password);
  await exchangePage
    .getByRole('button', { name: 'Set credentials', exact: true })
    .click();
  try {
    await expect(exchangePage.getByRole('status')).toContainText(
      'Credentials set.',
    );
  } catch {
    const text = await exchangePage.getByRole('status').allTextContents();
    const outcome =
      [
        'Invalid capability',
        'Outcome uncertain',
        'Credential service unavailable',
        'Enter the handoff code',
        'Too many attempts',
        'Check your password',
        'Credentials set.',
      ].find((prefix) => text.some((value) => value.startsWith(prefix))) ??
      'unrecognized status';
    throw new Error(
      `Credential browser recipient outcome: ${outcome}; status landmarks: ${text.length}`,
    );
  }
  await exchangeContext.close();
  progress('administrator incident grant denial');
  // Admin's ordinary role supplies no incident-create grant.
  await form.goto(`${staff.origin}/`);
  await form.waitForLoadState('networkidle');
  await form.getByLabel(/^Unfinished notes/).fill('mounted incident notes');
  const rejected = form.waitForResponse(
    (r) => new URL(r.url()).pathname === '/staff/auth/work-fixture',
  );
  await form
    .getByRole('button', { name: 'Submit retained work', exact: true })
    .click();
  assert.equal((await rejected).status(), 403);
  await expect(
    form.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible();
  await form.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(form.getByLabel(/^Unfinished notes/)).toHaveValue(
    'mounted incident notes',
  );
  await form.getByRole('button', { name: 'Open protected dialog' }).click();
  await expect(
    form.getByRole('dialog', { name: 'Protected unfinished work' }),
  ).toBeVisible();
  await invalidate();
  await expect(
    form.getByRole('dialog', { name: 'Protected unfinished work' }),
  ).toBeHidden();
  await expect(form.getByLabel('Unfinished notes')).toBeHidden();
  await login();
  await expect(form.getByLabel('Unfinished notes')).toHaveValue(
    'mounted incident notes',
  );
  await form.getByRole('button', { name: 'Close', exact: true }).click();
  progress('foreign tenant isolation');
  // Same username in a different tenant clears all retained values.
  await invalidate();
  await login(secondCode);
  const foreign = await metadata();
  assert.equal(foreign.data.tenantId, secondTenant);
  assert.equal(foreign.data.staffId, otherId);
  secrets.push(foreign.data.proof);
  await expect(form.getByLabel('Unfinished notes')).toHaveValue('');
  progress('uncertain logout retry');
  // Explicit logout has a real lost response; original session is durably revoked.
  await form.getByLabel('Unfinished notes').fill('clear on sign out');
  drop('/staff/auth/browser/logout');
  await form.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    form.getByRole('button', { name: 'Retry sign out', exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel('Unfinished notes')).toBeHidden();
  await expect(
    form.getByRole('button', { name: 'Retry sign out', exact: true }),
  ).toBeEnabled();
  await delay(1100);
  await form
    .getByRole('button', { name: 'Retry sign out', exact: true })
    .click();
  await expect(
    form.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await login(code, 'caller');
  const caller = await metadata();
  assert.equal(caller.data.staffId, callerId);
  secrets.push(caller.data.proof);
  await expect(form.getByLabel('Unfinished notes')).toHaveValue('');
  await expect(
    form.getByRole('link', { name: 'Credential setup and reset' }),
  ).toHaveCount(0);
  await form.getByLabel('Unfinished notes').fill('caller mounted notes');
  await form
    .getByRole('button', { name: 'Submit retained work', exact: true })
    .click();
  await expect(
    form.getByText('Explicit submissions: 1', { exact: true }),
  ).toBeVisible();
  progress('delayed write callback');
  // Delayed successful write callback cannot resurrect UI or run a second write.
  let arrived, release;
  const reached = new Promise((r) => {
      arrived = r;
    }),
    released = new Promise((r) => {
      release = r;
    });
  gate({ path: '/fixture/staff-write', arrived, released, release });
  await form
    .getByRole('button', { name: 'Submit retained work', exact: true })
    .click();
  await reached;
  await invalidate();
  release();
  await login(code, 'caller');
  await expect(form.getByLabel('Unfinished notes')).toHaveValue(
    'caller mounted notes',
  );
  await expect(
    form.getByText('Explicit submissions: 1', { exact: true }),
  ).toBeVisible();
  progress('expired direct submission');
  progress('passive canonical checks and actual browser deadline');
  const timerCookie = (await recipient.cookies()).find(
    (c) => c.name === '__Host-myims-staff',
  );
  const timerRecord = JSON.parse(await redis.get(key(timerCookie.value)));
  const shortDeadline = Date.now() + 6000;
  timerRecord.idleExpiresAt = shortDeadline;
  await redis.set(key(timerCookie.value), JSON.stringify(timerRecord), {
    PX: 6000,
  });
  await form.evaluate(() =>
    globalThis.dispatchEvent(
      new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(
    form.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel('Unfinished notes')).toBeHidden();
  await login(code, 'caller');
  await expect(form.getByLabel('Unfinished notes')).toHaveValue(
    'caller mounted notes',
  );
  progress('credential reset and same-owner recovery');
  const adminContext = await recipient
    .browser()
    .newContext({ ignoreHTTPSErrors: true });
  const adminPage = await adminContext.newPage();
  try {
    await adminPage.goto(`${staff.origin}/credential-issuer`);
    await adminPage.getByLabel(/^Tenant code/).fill(code);
    await adminPage.getByLabel(/^Username/).fill('issuer');
    await adminPage.getByLabel(/^Password/).fill(password);
    await adminPage
      .getByRole('button', { name: 'Sign in', exact: true })
      .click();
    await expect(
      adminPage.getByLabel('Target staff ID', { exact: true }),
    ).toBeVisible();
    const adminCookie = (await adminContext.cookies()).find(
      (c) => c.name === '__Host-myims-staff',
    );
    secrets.push(adminCookie.value);
    await adminPage
      .getByLabel('Target staff ID', { exact: true })
      .fill(callerId);
    await adminPage
      .getByLabel('Credential action', { exact: true })
      .selectOption('reset');
    await adminPage.getByRole('checkbox').check();
    await adminPage
      .getByRole('button', { name: 'Issue staff code', exact: true })
      .click();
    await expect(adminPage.getByLabel('One-time handoff code')).toBeVisible();
    const resetCode = await adminPage
      .getByLabel('One-time handoff code')
      .textContent();
    secrets.push(resetCode);
    const resetContext = await recipient
      .browser()
      .newContext({ ignoreHTTPSErrors: true });
    const resetPage = await resetContext.newPage();
    await resetPage.goto(`${exchange.origin}/credentials`);
    await resetPage.getByLabel('Handoff code', { exact: true }).fill(resetCode);
    await resetPage.getByLabel('New password', { exact: true }).fill(password);
    await resetPage
      .getByLabel('Confirm password', { exact: true })
      .fill(password);
    await resetPage
      .getByRole('button', { name: 'Set credentials', exact: true })
      .click();
    await expect(resetPage.getByRole('status')).toContainText(
      'Credentials set.',
    );
    await resetContext.close();
    const stale = await metadata();
    assert.equal(stale.status, 401);
    await form.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      form.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await expect(form.getByLabel('Unfinished notes')).toBeHidden();
    await login(code, 'caller');
    await expect(form.getByLabel('Unfinished notes')).toHaveValue(
      'caller mounted notes',
    );
  } finally {
    await adminContext.close();
  }
  // Current cookie expired after mounting: direct submission still denies server-side.
  const liveCookie = (await recipient.cookies()).find(
    (c) => c.name === '__Host-myims-staff',
  );
  const live = await metadata();
  secrets.push(live.data.proof);
  await redis.del(key(liveCookie.value));
  const expiredWrite = await form.evaluate(
    async (proof) =>
      (
        await fetch('/staff/auth/work-fixture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Staff-CSRF': proof,
          },
          body: '{}',
        })
      ).status,
    live.data.proof,
  );
  assert.equal(expiredWrite, 401);
  await form.evaluate(() =>
    globalThis.dispatchEvent(
      new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(
    form.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await login(code, 'caller');
  assert.deepEqual(
    (await new AxeBuilder({ page: form }).analyze()).violations,
    [],
  );
  for (const width of [1440, 768, 390, 320]) {
    await form.setViewportSize({ width, height: 900 });
    assert.equal(
      await form.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
    );
  }
  progress('csrf source and safe returns');
  const boundary = await form.evaluate(async () => ({
    bearer: (
      await fetch('/staff/auth/browser/session', {
        headers: { Authorization: 'Bearer invalid' },
      })
    ).status,
    csrf: (await fetch('/staff/auth/browser/logout', { method: 'POST' }))
      .status,
    oldProof: (
      await fetch('/staff/auth/browser/logout', {
        method: 'POST',
        headers: { 'X-Staff-CSRF': 'a'.repeat(43) },
      })
    ).status,
    query: (await fetch('/staff/auth/browser/session?target=other')).status,
  }));
  assert.deepEqual(boundary, {
    bearer: 403,
    csrf: 403,
    oldProof: 403,
    query: 403,
  });
  // A revoked credential from the earlier device cannot be resurrected.
  assert.equal(await redis.get(key(firstCookie.value)), null);
  await form.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    form.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await form.goBack();
  await expect(
    form.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel('Unfinished notes')).toBeHidden();
  await form.goto(
    `${staff.origin}/sign-in?returnTo=https%3A%2F%2Fevil.invalid`,
  );
  await login(code, 'caller');
  assert.equal(new URL(form.url()).pathname, '/');
  await expect(form.getByLabel('Unfinished notes')).toHaveValue('');
  await form.goto(`${staff.origin}/credential-issuer`);
  await expect(form.getByText('Access denied.', { exact: true })).toBeVisible();
  console.log(
    'PASS staff browser C-01–04/08: actual qualified login/issuer/exchange, draft denial, A/B cookies, owner-isolated mounted recovery, server write denial, late callback fencing, uncertain logout retry, safe returns, keyboard/axe/reflow',
  );
}
