// Extends the real production Next/HTTPS/Nest fixture; no synthetic API success.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkDraftTenantBrowser({
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
  holdResponse,
}) {
  const suffix = randomUUID().slice(0, 8),
    code = `browser-${suffix}`;
  let writes = 0;
  const submitted = [];
  const observe = (req) => {
    if (
      new URL(req.url()).pathname === '/platform/tenants' &&
      req.method() === 'POST'
    ) {
      writes++;
      submitted.push(req.postDataJSON());
    }
  };
  page.on('request', observe);
  const createButton = () =>
    page.getByRole('button', { name: 'Create draft tenant', exact: true });
  async function fill(tenantCode, name = 'Browser organization') {
    await page.getByLabel(/^Tenant code/).fill(tenantCode);
    await page.getByLabel(/^Organization name/).fill(name);
    await page.getByLabel(/^Administrator username/).fill(' Shared.Admin ');
  }
  async function create(tenantCode) {
    await page.goto(`${config.origin}/tenants/create`);
    await fill(tenantCode);
    await createButton().click();
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    return new URL(page.url()).pathname.split('/').at(-1);
  }
  async function request(path, method = 'GET', body, extra = {}) {
    return page.evaluate(
      async ({ path, method, body, extra }) => {
        const session = await (await fetch('/platform/auth/session')).json();
        const response = await fetch(path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Platform-CSRF': session.proof,
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
      assert.equal(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `.local/ui-review/draft-${screen}-${width}.png`,
        fullPage: true,
      });
    }
    await page.evaluate(() => {
      globalThis.document.documentElement.style.zoom = '2';
    });
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
    );
    await page.evaluate(() => {
      globalThis.document.documentElement.style.zoom = '';
    });
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  try {
    console.log('CHECK draft browser: navigation and first create');
    await page
      .getByRole('navigation', { name: 'Platform console navigation' })
      .getByRole('link', { name: 'Tenants', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Tenants', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Create tenant', exact: true })
      .first()
      .click();
    await fill('_invalid', '');
    await createButton().click();
    await expect(page.getByLabel(/^Tenant code/)).toBeFocused();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue('_invalid');
    assert.equal(writes, 0);
    await fill('a'.repeat(65));
    await createButton().click();
    assert.equal(writes, 0);
    await fill(` ${code.toUpperCase()} `);
    await createButton().focus();
    const firstResponse = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/platform/tenants' &&
        r.request().method() === 'POST',
    );
    await page.keyboard.press('Enter');
    const response = await firstResponse;
    const firstPayload = await response.json();
    console.log(
      'CHECK draft first response',
      response.status(),
      Object.keys(submitted.at(-1)),
      Object.keys(firstPayload.fieldErrors ?? {}),
      [
        'Invalid request',
        'Invalid credentials',
        'Invalid tenant request',
      ].includes(firstPayload.message)
        ? firstPayload.message
        : 'safe result',
    );
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    const id = new URL(page.url()).pathname.split('/').at(-1);
    const canonical = (
      await owner.query(
        'SELECT t.status,t.normalized_code,s.tenant_id,s.roles,s.status AS account,s.credential_state,s.password_hash,s.credential_changed_at,r.operator_id FROM public.tenants t JOIN public.draft_tenant_receipts r ON r.tenant_id=t.id JOIN public.staff_users s ON s.id=r.staff_id WHERE t.id=$1',
        [id],
      )
    ).rows[0];
    assert.equal(canonical.normalized_code, code);
    assert.equal(canonical.status, 'draft');
    assert.equal(canonical.tenant_id, id);
    assert.deepEqual(canonical.roles, ['tenant_admin']);
    assert.equal(canonical.account, 'active');
    assert.equal(canonical.credential_state, 'unset');
    assert.equal(canonical.password_hash, null);
    assert.equal(canonical.credential_changed_at, null);
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.audit_events WHERE actor_reference=$1 AND target_reference IN ($2::text,(SELECT staff_id::text FROM public.draft_tenant_receipts WHERE tenant_id=$2::uuid))',
          [canonical.operator_id, id],
        )
      ).rows[0].n,
      2,
    );
    await review('detail');
    select(b);
    await page.reload();
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to tenants' }).click();
    await expect(page.getByRole('table')).toContainText(code);
    await review('list');
    select(a);
    const id2 = await create(`${code}-second`);
    const admins = (
      await owner.query(
        'SELECT id,tenant_id,normalized_username FROM public.staff_users WHERE tenant_id=ANY($1::uuid[])',
        [[id, id2]],
      )
    ).rows;
    assert.equal(admins.length, 2);
    assert.equal(admins[0].normalized_username, admins[1].normalized_username);
    assert.notEqual(admins[0].id, admins[1].id);
    // Valid maximum identifiers/name must also reflow without clipping.
    await page.goto(`${config.origin}/tenants/create`);
    await fill(`${code}-maximum`.padEnd(64, 'x'), 'N'.repeat(200));
    await page.getByLabel(/^Administrator username/).fill('A'.repeat(128));
    await createButton().click();
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'N'.repeat(200), exact: true }),
    ).toBeVisible();
    await review('maximum-detail');

    await page.goto(`${config.origin}/tenants/create`);
    await fill(code);
    await createButton().click();
    await expect(
      page.getByText(
        'This tenant code is already in use. Choose another code.',
      ),
    ).toBeVisible();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue(code);
    // Force a real backend field rejection after otherwise valid local validation.
    await fill(`${code}-field-error`);
    const invalidField = async (route) => {
      await route.continue({
        postData: JSON.stringify({
          ...route.request().postDataJSON(),
          administratorUsername: 'invalid username',
        }),
      });
    };
    await page.route('**/platform/tenants', invalidField);
    await createButton().click();
    await expect(page.getByLabel(/^Administrator username/)).toBeFocused();
    await expect(page.getByLabel(/^Administrator username/)).toHaveValue(
      ' Shared.Admin ',
    );
    await expect(
      page.getByText('Invalid administrator username.', { exact: true }),
    ).toBeVisible();
    await page.unroute('**/platform/tenants', invalidField);
    const dto = {
      requestId: randomUUID(),
      tenantCode: `${code}-unknown`,
      displayName: 'Safe',
      administratorUsername: 'admin',
    };
    for (const extra of [
      { actorId: canonical.operator_id },
      { roles: ['tenant_admin'] },
      { status: 'active' },
      { tenantId: id },
      { password: 'forbidden' },
    ])
      assert.equal(
        (await request('/platform/tenants', 'POST', { ...dto, ...extra }))
          .status,
        400,
      );
    for (const path of [
      '/platform/tenants?limit=101',
      '/platform/tenants?after=bad',
      '/platform/tenants?limit=1&limit=2',
      '/platform/tenants?destination=https://foreign.invalid',
      '/platform/tenants/not-a-uuid',
    ])
      assert.equal((await request(path)).status, 400);
    assert.equal(
      (
        await request('/platform/tenants', 'POST', dto, {
          'X-Platform-CSRF': 'invalid',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await context.request.post(`${config.origin}/platform/tenants`, {
          headers: { Origin: 'https://foreign.invalid' },
          data: dto,
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await request('/platform/tenants', 'GET', undefined, {
          Authorization: 'Bearer invalid',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request('/platform/tenants', 'POST', {
          ...dto,
          tenantCode: 'bad code',
        })
      ).status,
      400,
    );
    const bounds = await request('/platform/tenants?limit=100');
    assert.equal(bounds.status, 200);
    assert.equal(bounds.cache, 'no-store');
    assert.ok(bounds.data.items.length <= 100);
    console.log(
      'CHECK draft browser: canonical creation/validation confirmed; checking lost response',
    );
    // Actual committed response loss, with browser pending lock and retained original DTO.
    await fill(`${code}-lost`);
    ingress.drop('/platform/tenants');
    const beforeLost = writes;
    await page.evaluate(() => {
      const form = globalThis.document.querySelector('form');
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    assert.equal(writes, beforeLost + 1);
    const lost = submitted.at(-1);
    const committed = (
      await owner.query(
        'SELECT tenant_id FROM public.draft_tenant_receipts WHERE operator_id=$1 AND request_id=$2',
        [canonical.operator_id, lost.requestId],
      )
    ).rows[0];
    assert.ok(committed);
    await delay(1100);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Retry original submission' }),
    ).toBeVisible();
    await page.getByLabel(/^Tenant code/).fill(`${code}-edited`);
    assert.equal(await createButton().isDisabled(), true);
    await page.getByRole('link', { name: 'Back to tenants' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await page
      .getByRole('link', { name: 'Create tenant', exact: true })
      .first()
      .click();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue(`${code}-edited`);
    await expect(
      page.getByRole('button', { name: 'Retry original submission' }),
    ).toBeVisible();
    await expire('idle');
    // Passive polling may already have hidden the expired workspace.
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await login();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue(`${code}-edited`);
    await expect(page.getByText(`${code}-lost`, { exact: true })).toBeVisible();
    await delay(250);
    assert.equal(writes, beforeLost + 1);
    select(b);
    await page
      .getByRole('button', { name: 'Retry original submission' })
      .click();
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    assert.equal(
      new URL(page.url()).pathname,
      `/tenants/${committed.tenant_id}`,
    );
    assert.deepEqual(submitted.at(-1), lost);
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.draft_tenant_receipts WHERE operator_id=$1 AND request_id=$2',
          [canonical.operator_id, lost.requestId],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.audit_events WHERE target_reference IN ($1::text,(SELECT staff_id::text FROM public.draft_tenant_receipts WHERE tenant_id=$1::uuid))',
          [committed.tenant_id],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM public.tenants WHERE normalized_code=$1',
          [`${code}-edited`],
        )
      ).rows[0].n,
      0,
    );
    console.log(
      'CHECK draft browser: explicit replay confirmed; checking session recovery',
    );
    // Interrupt the actual connected session Redis long enough to cross its timeout.
    await page.goto(`${config.origin}/tenants/create`);
    await fill(`${code}-redis`);
    await redis.sendCommand(['CLIENT', 'PAUSE', '2500', 'ALL']);
    await createButton().click();
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Tenant code/)).not.toBeVisible();
    await delay(3000);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue(`${code}-redis`);
    // Owner-bound unfinished values, actual dependency outage, and explicit continuation.
    await page.goto(`${config.origin}/tenants/create`);
    await fill(`${code}-retained`);
    select({ url: 'http://127.0.0.1:1' });
    await createButton().click();
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Tenant code/)).not.toBeVisible();
    select(a);
    await delay(1100);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue(
      `${code}-retained`,
    );
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await login(page, `${username}.second`);
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue('');
    await delay(250);
    // No late old-owner success may navigate a switched owner. The write is real;
    // The HTTP proxy delays delivery only after upstream commit, then releases it.
    await fill(`${code}-late`);
    const delayedWrite = holdResponse('POST', '/platform/tenants');
    await page.evaluate(() =>
      globalThis.document.querySelector('form').requestSubmit(),
    );
    assert.equal(
      await Promise.race([
        delayedWrite.reached,
        delay(15000).then(() => {
          throw new Error('Delayed write boundary timeout');
        }),
      ]),
      201,
    );
    await expect(
      page.getByRole('button', { name: 'Creating draft…', exact: true }),
    ).toBeDisabled();
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await login();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue('');
    delayedWrite.release();
    await delay(300);
    assert.equal(new URL(page.url()).pathname, '/tenants/create');
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue('');
    // Delay a real old-owner read, then require a fresh canonical read for the new owner.
    const delayedRead = holdResponse('GET', `/platform/tenants/${id}`);
    await page.goto(`${config.origin}/tenants/${id}`);
    assert.equal(
      await Promise.race([
        delayedRead.reached,
        delay(15000).then(() => {
          throw new Error('Delayed read boundary timeout');
        }),
      ]),
      200,
    );
    await owner.query(
      'UPDATE public.tenants SET display_name=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1',
      [id, 'Updated canonical organization'],
    );
    await expire('idle');
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await login(page, `${username}.second`);
    await expect(
      page.getByRole('heading', {
        name: 'Updated canonical organization',
        exact: true,
      }),
    ).toBeVisible();
    delayedRead.release();
    await delay(250);
    await expect(
      page.getByRole('heading', {
        name: 'Updated canonical organization',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Browser organization', exact: true }),
    ).not.toBeVisible();
    // Missing detail and unavailable creation provenance are separate canonical states.
    await page.goto(`${config.origin}/tenants/${randomUUID()}`);
    await expect(
      page.getByText('Tenant not found.', { exact: true }),
    ).toBeVisible();
    const unlinked = randomUUID();
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Unlinked organization','draft')",
      [unlinked, `${code}-unlinked`],
    );
    await page.goto(`${config.origin}/tenants/${unlinked}`);
    await expect(
      page.getByText('Initial administrator provenance unavailable', {
        exact: true,
      }),
    ).toBeVisible();
    await owner.query(`REVOKE SELECT ON public.tenants FROM myims_runtime`);
    try {
      await page.getByRole('button', { name: 'Reload detail' }).click();
      await expect(
        page.getByRole('button', { name: 'Retry access', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('Unlinked organization', { exact: true }),
      ).not.toBeVisible();
    } finally {
      await owner.query(`GRANT SELECT ON public.tenants TO myims_runtime`);
    }
    await delay(1100);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(
      page.getByText('Unlinked organization', { exact: true }),
    ).toBeVisible();
    // Seed enough canonical rows for the actual 25-row browser pagination.
    const paginationIds = [];
    for (let i = 0; i < 26; i++)
      await owner.query(
        "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,$3,'draft')",
        [
          (() => {
            const id = `ffffffff-ffff-ffff-ffff-${i.toString(16).padStart(12, '0')}`;
            paginationIds.push(id);
            return id;
          })(),
          `${code}-page-${i}`,
          `Pagination ${i}`,
        ],
      );
    await page.goto(`${config.origin}/tenants`);
    await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
    const firstPage = await page.getByRole('table').textContent();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(
      page.getByRole('button', { name: 'Previous page' }),
    ).toBeEnabled();
    await expect(page.getByRole('table')).not.toHaveText(firstPage);
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.getByRole('table')).toHaveText(firstPage);
    const pageContract = await request('/platform/tenants?limit=25');
    assert.ok(pageContract.data.nextCursor);
    const removed = paginationIds.filter(
      (id) => id > pageContract.data.nextCursor,
    );
    assert.ok(removed.length);
    await owner.query('DELETE FROM public.tenants WHERE id=ANY($1::uuid[])', [
      removed,
    ]);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(
      page.getByText('No tenants on this page', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Create tenant', exact: true }).last(),
    ).toBeVisible();

    await page.goto(`${config.origin}/tenants/create`);
    await review('form');
    await fill(`${code}-logout`);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await page.goto(`${config.origin}/tenants/create`);
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    assert.equal(
      new URL(page.url()).searchParams.get('returnTo'),
      '/tenants/create',
    );
    await login();
    await expect(page.getByLabel(/^Tenant code/)).toHaveValue('');
    assert.deepEqual(
      await page.evaluate(() => ({
        local: Object.keys(globalThis.localStorage),
        session: Object.keys(globalThis.sessionStorage),
      })),
      { local: [], session: [] },
    );
    console.log(
      'PASS draft browser B-01–07: real HTTPS canonical creation/audit, validation/conflict, committed response loss/explicit replay, owner isolation/late results, bounded reads/provenance/failure, keyboard/reflow/accessibility and logout',
    );
    await page.goto(`${config.origin}/ui-preview`);
    await expect(page.getByLabel('Unfinished notes')).toBeVisible();
  } finally {
    page.off('request', observe);
    select(a);
  }
}
