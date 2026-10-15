// Real secure console, platform credential sign-in, independent HTTP/telephony,
// PostgreSQL/Redis and controlled Asterisk. Fault injection is labeled explicitly.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
export async function checkPbxBrowser({
  page,
  context,
  config,
  owner,
  login,
  expire,
  ingress,
  select,
  a,
  b,
  username,
  redis,
  key,
  holdResponse,
  fixture,
}) {
  const profile = fixture.catalog[0],
    submitted = [];
  const observe = (req) => {
    if (
      new URL(req.url()).pathname.startsWith('/platform/pbx-nodes') &&
      ['POST', 'PATCH'].includes(req.method())
    )
      submitted.push({ method: req.method(), body: req.postDataJSON() });
  };
  page.on('request', observe);
  let registered = false;
  async function ready() {
    await expect(page.getByLabel(/^PBX name/)).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  async function fill(
    target = profile.targetAlias,
    name = 'Controlled browser PBX',
  ) {
    await page.getByLabel(/^PBX name/).fill(name);
    await page.getByLabel(/^Approved target alias/).fill(target);
    await page.getByLabel(/^Management transport/).fill(profile.transport);
    await page.getByLabel(/^Management port/).fill(String(profile.port));
    await page
      .getByLabel(/^Opaque credential alias/)
      .fill('local-asterisk-observer');
  }
  const create = () =>
    page.getByRole('button', { name: 'Register PBX node', exact: true });
  const save = () =>
    page.getByRole('button', {
      name: 'Save desired connectivity',
      exact: true,
    });
  async function request(path, method = 'GET', body, extra = {}) {
    return page.evaluate(
      async ({ path, method, body, extra }) => {
        const session =
          method === 'GET'
            ? null
            : await (await fetch('/platform/auth/session')).json();
        const response = await fetch(path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { 'X-Platform-CSRF': session.proof } : {}),
            ...extra,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return {
          status: response.status,
          cache: response.headers.get('cache-control'),
          data: await response.json(),
        };
      },
      { path, method, body, extra },
    );
  }
  async function review(screen) {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [320, 900],
    ]) {
      await page.setViewportSize({ width, height });
      assert.ok(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        `PBX ${screen} reflow`,
      );
      await page.screenshot({
        path: `.local/ui-review/pbx-${screen}-${width}.png`,
        fullPage: true,
      });
    }
    const axe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      axe.violations.map((v) => v.id),
      [],
      `PBX ${screen} accessibility`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  async function until(predicate, description, timeout = 30000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await predicate()) return;
      await delay(2500);
    }
    throw new Error(`PBX browser deadline: ${description}`);
  }
  async function restore() {
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await ready();
  }
  try {
    console.log('CHECK PBX browser: register/validation/lost create');
    await page.goto(`${config.origin}/pbx-nodes/register`);
    await ready();
    await create().click();
    await expect(page.getByLabel(/^PBX name/)).toBeFocused();
    assert.equal(submitted.length, 0);
    await fill('not-approved');
    await create().click();
    await expect(page.getByLabel(/^Approved target alias/)).toBeFocused();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue(
      'Controlled browser PBX',
    );
    await fill();
    await review('register');
    // Inject lost successful response, after the real backend commits.
    ingress.drop('/platform/pbx-nodes');
    const before = submitted.length;
    await create().focus();
    await page.keyboard.press('Enter');
    await create().evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    assert.equal(submitted.length, before + 1);
    const original = submitted.at(-1).body;
    assert.equal(
      (await owner.query('SELECT count(*)::int AS n FROM public.pbx_nodes'))
        .rows[0].n,
      1,
    );
    await delay(1100);
    await restore();
    await expect(
      page.getByRole('button', { name: 'Retry original create' }),
    ).toBeVisible();
    assert.equal(
      submitted.length,
      before + 1,
      'No write replay after access restore',
    );
    await page.getByRole('button', { name: 'Retry original create' }).click();
    await expect(
      page.getByRole('heading', { name: 'PBX details' }),
    ).toBeVisible();
    await ready();
    assert.deepEqual(submitted.at(-1).body, original);
    const id = new URL(page.url()).pathname.split('/').at(-1);
    const nodeCount = async () =>
      (await owner.query('SELECT count(*)::int AS n FROM public.pbx_nodes'))
        .rows[0].n;
    assert.equal(await nodeCount(), 1);
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM public.audit_events WHERE event_type='telephony.pbx.desired-changed' AND target_reference=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    await expect(
      page.getByText('Saved · Not yet observed.', { exact: false }),
    ).toBeVisible();
    console.log('CHECK PBX browser: live observation/registration/freshness');
    const observerA = await fixture.start(),
      observerB = await fixture.start();
    await observerA.call('start');
    await observerB.call('start');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'current',
      'live AMI observation',
    );
    await expect(
      page.getByText('0 — successful empty registration result', {
        exact: true,
      }),
    ).toBeVisible();
    await review('detail');
    // Controlled no-call registration uses the already approved trusted fixture.
    console.log('PBX_FIXTURE_INSTALL');
    await delay(2500);
    const { sipRegistration } = await import('./check-pbx-observation.mjs');
    await sipRegistration(fixture.access, 120);
    registered = true;
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .registeredEndpoints === 1,
      'real SIP registration',
    );
    await expect(
      page.getByText('Observed registered endpoints', { exact: true }),
    ).toBeVisible();
    await sipRegistration(fixture.access, 0);
    registered = false;
    console.log('PBX_FIXTURE_REMOVE');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .registeredEndpoints === 0,
      'remove obsolete real registration',
    );
    console.log('PBX_FIXTURE_STOP');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .connection === 'disconnected',
      'real controlled PBX disconnect',
    );
    await expect(
      page.getByText('Last connection: disconnected', { exact: true }),
    ).toBeVisible();
    console.log('PBX_FIXTURE_START');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'current',
      'real controlled PBX reconnect',
    );
    const epochBefore = (await request(`/platform/pbx-nodes/${id}`)).data.node
      .observation.epoch;
    await observerA.call('stop');
    await observerB.call('stop');
    await page
      .getByRole('button', { name: 'Reload PBX detail', exact: true })
      .click();
    await ready();
    await expect(
      page.getByText('Last-known registered endpoints', { exact: true }),
    ).toBeVisible();
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'stale',
      'actual 30-second freshness expiry',
      40000,
    );
    await expect(page.getByText('stale', { exact: true })).toBeVisible();
    await observerB.call('start');
    await until(async () => {
      const o = (await request(`/platform/pbx-nodes/${id}`)).data.node
        .observation;
      return o.freshness === 'current' && BigInt(o.epoch) > BigInt(epochBefore);
    }, 'independent owner recovery');
    select(a);
    select(b);
    await page.reload();
    await ready();
    const result = await request(`/platform/pbx-nodes/${id}`);
    assert.equal(result.status, 200);
    assert.equal(result.cache, 'no-store');
    const token = (await context.cookies()).find(
        (c) => c.name === '__Host-myims-platform',
      ).value,
      passive = await redis.get(key(token));
    await delay(6000);
    assert.equal(
      await redis.get(key(token)),
      passive,
      'Passive PBX refresh cannot renew session',
    );
    console.log(
      'CHECK PBX browser: forwarding authority/versioned edit recovery',
    );
    const desired = {
      displayName: 'Updated browser PBX',
      management: {
        targetAlias: profile.targetAlias,
        transport: profile.transport,
        port: profile.port,
      },
      credentialAlias: 'local-asterisk-observer',
    };
    for (const path of [
      '/platform/pbx-nodes?limit=101',
      '/platform/pbx-nodes?limit=1&limit=2',
      '/platform/pbx-nodes?destination=x',
      '/platform/pbx-nodes/bad',
    ])
      assert.equal((await request(path)).status, 400);
    for (const extra of [
      { Authorization: 'Bearer forged' },
      { 'X-Platform-CSRF': 'bad' },
    ])
      assert.equal(
        (
          await request(
            `/platform/pbx-nodes/${id}`,
            'PATCH',
            { ...desired, expectedVersion: 1 },
            extra,
          )
        ).status,
        403,
      );
    for (const body of [
      { ...desired, requestId: randomUUID(), role: 'platform_operator' },
      { ...desired, requestId: randomUUID(), password: 'PBX_SECRET_SENTINEL' },
    ])
      assert.equal(
        (await request('/platform/pbx-nodes', 'POST', body)).status,
        400,
      );
    const unauthorized = await context
      .browser()
      .newContext({ ignoreHTTPSErrors: true });
    try {
      assert.equal(
        (
          await unauthorized.request.get(
            `${config.origin}/platform/pbx-nodes`,
            { headers: { 'Sec-Fetch-Site': 'same-origin' } },
          )
        ).status(),
        401,
      );
      const deep = await unauthorized.newPage();
      await deep.goto(`${config.origin}/pbx-nodes/${id}`);
      await expect(
        deep.getByRole('heading', { name: 'Platform console sign-in' }),
      ).toBeVisible();
    } finally {
      await unauthorized.close();
    }
    await page.getByLabel(/^PBX name/).fill('Preserved version conflict input');
    assert.equal(
      (
        await request(`/platform/pbx-nodes/${id}`, 'PATCH', {
          ...desired,
          expectedVersion: 1,
        })
      ).status,
      200,
    );
    await save().click();
    await expect(
      page.getByText('A newer version is saved.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue(
      'Preserved version conflict input',
    );
    await page
      .getByRole('button', { name: 'Reload saved version for review' })
      .click();
    await ready();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue(
      'Preserved version conflict input',
    );
    await page.getByLabel(/^Opaque credential alias/).fill('fixture-rotated');
    // Response loss for a real committed versioned edit: no automatic PATCH retry.
    ingress.drop(`/platform/pbx-nodes/${id}`, 'PATCH');
    await save().click();
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    const editCount = submitted.length;
    await delay(1100);
    await restore();
    assert.equal(submitted.length, editCount);
    await expect(save()).toBeDisabled();
    await page
      .getByRole('button', { name: 'Reload saved version for review' })
      .click();
    await ready();
    await expect(save()).toBeEnabled();
    await page.getByLabel(/^Opaque credential alias/).fill('fixture-missing');
    await save().click();
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .failure === 'secret_missing',
      'sanitized secret failure',
    );
    await expect(
      page.getByText('Observation failure: secret missing.', { exact: false }),
    ).toBeVisible();
    await page
      .getByLabel(/^Opaque credential alias/)
      .fill('local-asterisk-observer');
    await save().click();
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'current',
      'credential-reference recovery',
    );
    await observerB.call('stop');
    await observerB.call('credentials', fixture.access.rotatedCredentials);
    await observerB.call('start');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .failure === 'auth_failed',
      'real invalid AMI authentication',
    );
    await expect(
      page.getByText('Observation failure: auth failed.', { exact: false }),
    ).toBeVisible();
    await observerB.call('stop');
    await observerB.call('credentials', fixture.access.credentials);
    await observerB.call('start');
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'current',
      'real authentication recovery',
    );
    await page.getByLabel(/^Approved target alias/).fill('browser-unavailable');
    await save().click();
    await until(async () => {
      const n = (await request(`/platform/pbx-nodes/${id}`)).data.node;
      return (
        n.management.targetAlias === 'browser-unavailable' &&
        n.observation.freshness !== 'current'
      );
    }, 'target edit invalidates old health');
    await page.getByLabel(/^Approved target alias/).fill(profile.targetAlias);
    await save().click();
    await until(
      async () =>
        (await request(`/platform/pbx-nodes/${id}`)).data.node.observation
          .freshness === 'current',
      'target edit reconciles original PBX',
    );
    console.log(
      'PASS PBX C-02/03/05 live: real console create/replay/edit, real AMI/SIP empty/registered/removed, freshness expiry, owner recovery and safe secret failure; response losses injected',
    );
    console.log('CHECK PBX browser: node isolation/mounted owner recovery');
    // Independent unavailable target remains a node failure; healthy live node stays inspectable.
    await page.goto(`${config.origin}/pbx-nodes/register`);
    await ready();
    await fill('browser-unavailable', 'Unavailable synthetic target');
    await create().click();
    await ready();
    await page.goto(`${config.origin}/pbx-nodes`);
    await expect(
      page.getByRole('link', {
        name: 'Inspect Preserved version conflict input',
      }),
    ).toBeVisible();
    await review('list');
    // Hold a real committed PATCH across canonical identity replacement.
    await page.goto(`${config.origin}/pbx-nodes/${id}`);
    await ready();
    await page.getByLabel(/^PBX name/).fill('Late original owner edit');
    const mutationGate = holdResponse('PATCH', `/platform/pbx-nodes/${id}`);
    await save().click();
    await mutationGate.reached;
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await login(page, `${username}.second`);
    await ready();
    await page
      .getByLabel(/^PBX name/)
      .fill('Replacement operator unfinished input');
    mutationGate.release();
    await delay(1100);
    await expect(page.getByLabel(/^PBX name/)).toHaveValue(
      'Replacement operator unfinished input',
    );
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await login();
    await expect(
      page.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await page.goto(`${config.origin}/pbx-nodes/register`);
    await ready();
    await fill();
    await create().click();
    await expect(
      page.getByText('This installation is already registered.', {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByLabel(/^PBX name/).fill('Same operator retained PBX draft');
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^PBX name/)).toBeHidden();
    const count = submitted.length;
    await login();
    await ready();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue(
      'Same operator retained PBX draft',
    );
    assert.equal(submitted.length, count);
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await login(page, `${username}.second`);
    await ready();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue('');
    await fill('not-approved', 'Clear on logout');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    await login();
    await expect(
      page.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await page.goto(`${config.origin}/pbx-nodes/register`);
    await ready();
    await expect(page.getByLabel(/^PBX name/)).toHaveValue('');
    // Delayed target read cannot replace the newly navigated resource.
    const gate = holdResponse('GET', `/platform/pbx-nodes/${id}`);
    await page.goto(`${config.origin}/pbx-nodes/${id}`);
    await gate.reached;
    await page.getByRole('link', { name: 'Back to PBX nodes' }).click();
    gate.release();
    await expect(
      page.getByRole('heading', { name: 'PBX nodes', exact: true }),
    ).toBeVisible();
    await page.goto(`${config.origin}/pbx-nodes/${id}`);
    await ready();
    const maximumName = 'N'.repeat(200);
    await page.getByLabel(/^PBX name/).fill(maximumName);
    await save().focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: maximumName, exact: true }),
    ).toBeVisible();
    await review('maximum-detail');
    await page.goto(`${config.origin}/pbx-nodes`);
    await expect(
      page.getByRole('link', { name: `Inspect ${maximumName}` }),
    ).toBeVisible();
    await review('maximum-list');
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.localStorage.length === 0 &&
          globalThis.sessionStorage.length === 0,
      ),
    );
    for (const secret of [
      fixture.access.credentials.password,
      fixture.access.fixturePassword,
      'PBX_SECRET_SENTINEL',
    ])
      assert.ok(!(await page.content()).includes(secret));
    console.log(
      'PASS PBX C-01/04/06 browser: named no-store/authority/CSRF/channel validation, owner retention/replacement/logout, no automatic replay, late target read, axe and 1440/768/390/320 reflow',
    );
    await page.goto(config.origin + '/ui-preview');
    await expect(page.getByLabel('Unfinished notes')).toBeVisible();
  } finally {
    page.off('request', observe);
    if (registered) {
      const { sipRegistration } = await import('./check-pbx-observation.mjs');
      await sipRegistration(fixture.access, 0);
    }
    console.log('PBX_FIXTURE_REMOVE');
  }
}
