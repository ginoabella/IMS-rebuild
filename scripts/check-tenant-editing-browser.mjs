import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkTenantEditingBrowser({
  page,
  config,
  owner,
  create,
  request,
  review,
  select,
  a,
  b,
  holdResponse,
  expire,
  login,
  switchOwner,
  redis,
}) {
  // This fixture owns its disposable Redis. Isolate independent acceptance groups
  // from earlier automated navigation; every request still uses real admission.
  await redis.del('myims:limiter:v1:platform.protected');
  const code = `editing-${randomUUID().slice(0, 8)}`;
  console.log('CHECK onboarding browser: saved sections and validation');
  const id = await create(code),
    path = `/platform/tenants/${id}/configuration`;
  const name = () => page.getByRole('textbox', { name: /^Organization name/ });
  const contact = () =>
    page.getByLabel('Contact name (optional)', { exact: true });
  const save = (section) =>
    page.getByRole('button', { name: `Save ${section}`, exact: true });
  await expect(name()).toHaveValue('Browser organization');
  await name().fill('Edited organization É %_');
  await name().press('Tab');
  await save('name').click();
  await expect(
    page.getByRole('heading', {
      name: 'Edited organization É %_',
      exact: true,
    }),
  ).toBeVisible();
  // Dispatch adjacent field edits in one task to exercise React's batched render boundary.
  await expect(contact()).toBeEnabled();
  await page.evaluate(() => {
    const setter = Object.getOwnPropertyDescriptor(
      globalThis.HTMLInputElement.prototype,
      'value',
    ).set;
    for (const [id, value] of [
      ['edit-contacts-name', 'Operations desk'],
      ['edit-contacts-email', 'bad email'],
    ]) {
      const input = globalThis.document.getElementById(id);
      setter.call(input, value);
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    }
  });
  await expect(contact()).toHaveValue('Operations desk');
  await expect(
    page.getByLabel('Contact email (optional)', { exact: true }),
  ).toHaveValue('bad email');
  await save('contacts').click();
  await expect(
    page.getByLabel('Contact email (optional)', { exact: true }),
  ).toBeFocused();
  await expect(contact()).toHaveValue('Operations desk');
  await page
    .getByLabel('Contact email (optional)', { exact: true })
    .fill('desk@example.org');
  await page
    .getByLabel('Contact phone (optional)', { exact: true })
    .fill('+63 (2) 123-4567');
  await save('contacts').click();
  await expect(
    page
      .getByRole('region', { name: 'Organizational contact', exact: true })
      .getByText(/^Saved at version/),
  ).toBeVisible();
  select(b);
  await page.goto(`${config.origin}/tenants/${id.toUpperCase()}`);
  await expect(contact()).toHaveValue('Operations desk');
  assert.equal(
    (await request(`/platform/tenants/${id}`)).data.tenant.contacts.email,
    'desk@example.org',
  );
  await review('editing');
  console.log('CHECK onboarding browser: stale sections and field protection');
  // Another writer advances the shared row; browser conflict retains the typed section.
  await name().fill('Retained conflict input');
  let detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(
    (
      await request(path, 'POST', {
        requestId: randomUUID(),
        expectedVersion: detail.tenant.version,
        expectedAuthorityVersion: detail.tenant.authorityVersion,
        section: 'contacts',
        values: { phone: null },
      })
    ).status,
    200,
  );
  await save('name').click();
  await expect(
    page.getByText(/^Conflict: your input is retained/),
  ).toBeVisible();
  await expect(name()).toHaveValue('Retained conflict input');
  await page
    .getByRole('button', { name: 'Reload detail', exact: true })
    .click();
  await expect(name()).toHaveValue('Retained conflict input');
  await page
    .getByRole('button', {
      name: 'Discard name changes and use loaded detail',
      exact: true,
    })
    .click();
  await expect(name()).toHaveValue('Edited organization É %_');
  for (const forged of [
    { tenantCode: 'forged' },
    { status: 'active' },
    { administratorId: randomUUID() },
  ]) {
    detail = (await request(`/platform/tenants/${id}`)).data;
    assert.equal(
      (
        await request(path, 'POST', {
          requestId: randomUUID(),
          expectedVersion: detail.tenant.version,
          expectedAuthorityVersion: detail.tenant.authorityVersion,
          section: 'name',
          values: { displayName: 'Denied' },
          ...forged,
        })
      ).status,
      400,
    );
  }
  console.log('CHECK onboarding browser: uncertain original recovery');
  // Delayed committed response crosses reauthentication; original retry stays explicit.
  await contact().fill('Uncertain desk');
  const gate = holdResponse('POST', path);
  await save('contacts').click();
  assert.equal(await gate.reached, 200);
  await expire('idle');
  await page.evaluate(() =>
    globalThis.dispatchEvent(
      new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(
    page.getByRole('heading', { name: 'Platform console sign-in' }),
  ).toBeVisible();
  gate.release();
  await login();
  await expect(contact()).toHaveValue('Uncertain desk');
  await expect(
    page.getByRole('button', {
      name: 'Retry original contacts save',
      exact: true,
    }),
  ).toBeVisible();
  detail = (await request(`/platform/tenants/${id}`)).data;
  const later = await request(path, 'POST', {
    requestId: randomUUID(),
    expectedVersion: detail.tenant.version,
    expectedAuthorityVersion: detail.tenant.authorityVersion,
    section: 'contacts',
    values: { name: 'Later canonical desk' },
  });
  assert.equal(later.status, 200);
  await page
    .getByRole('button', { name: 'Retry original contacts save', exact: true })
    .click();
  await expect(contact()).toHaveValue('Later canonical desk');
  await expect(
    page.getByText(/^Original save confirmed at version/),
  ).toBeVisible();
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int n FROM public.tenant_edit_receipts WHERE tenant_id=$1',
        [id],
      )
    ).rows[0].n,
    5,
  );
  await redis.del('myims:limiter:v1:platform.protected');
  console.log('CHECK onboarding browser: target isolation and search');
  // A target switch cannot receive a delayed prior target's result or values.
  await name().fill('Prior target late');
  const delayed = holdResponse('POST', path);
  await save('name').click();
  assert.equal(await delayed.reached, 200);
  const other = await create(`${code}-other`);
  assert.notEqual(other, id);
  delayed.release();
  await delay(200);
  await expect(name()).toHaveValue('Browser organization');
  await expect(contact()).toHaveValue('');
  await contact().fill('Partial desk');
  await save('contacts').click();
  await expect(
    page
      .getByRole('region', { name: 'Organizational contact', exact: true })
      .getByText(/^Saved at version/),
  ).toBeVisible();
  assert.deepEqual(
    (await request(`/platform/tenants/${other}`)).data.tenant.contacts,
    { name: 'Partial desk', email: null, phone: null },
  );
  await expect(page.getByText(/Contact incomplete/)).toBeVisible();
  await contact().fill('');
  await save('contacts').click();
  await expect(
    page
      .getByRole('region', { name: 'Organizational contact', exact: true })
      .getByText(/^Saved at version/),
  ).toBeVisible();
  assert.deepEqual(
    (await request(`/platform/tenants/${other}`)).data.tenant.contacts,
    { name: null, email: null, phone: null },
  );
  await name().fill('Refresh discards unsent edits');
  await page.reload();
  await expect(name()).toHaveValue('Browser organization');
  // Real search/filter selection, literal matching, cursor reset and delayed old criteria.
  await page.goto(`${config.origin}/tenants`);
  if (
    await page
      .getByRole('button', { name: 'Next page', exact: true })
      .isEnabled()
  ) {
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Previous page', exact: true }),
    ).toBeEnabled();
  }
  await page.getByLabel('Search code or name').fill('É %_');
  await page
    .getByRole('button', { name: 'Search tenants', exact: true })
    .click();
  await expect(
    page.getByText('No tenants on this page', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Previous page', exact: true }),
  ).toBeDisabled(); // prior target name has since changed
  await page.getByLabel('Search code or name').fill(code);
  await page
    .getByRole('button', { name: 'Search tenants', exact: true })
    .click();
  await expect(page.getByRole('table')).toContainText(code);
  const held = holdResponse(
    'GET',
    `/platform/tenants?limit=25&search=${encodeURIComponent(code)}&status=draft`,
  );
  await page.getByLabel('Lifecycle filter').selectOption('draft');
  assert.equal(await held.reached, 200);
  await page.getByLabel('Search code or name').fill('no-match-' + randomUUID());
  await page
    .getByRole('button', { name: 'Search tenants', exact: true })
    .click();
  await expect(
    page.getByText('No tenants on this page', { exact: true }),
  ).toBeVisible();
  held.release();
  await delay(200);
  await expect(
    page.getByText('No tenants on this page', { exact: true }),
  ).toBeVisible();
  for (const status of ['active', 'suspended', 'retired', '']) {
    await page.getByLabel('Lifecycle filter').selectOption(status);
    await expect(
      page.getByText('No tenants on this page', { exact: true }),
    ).toBeVisible();
  }
  for (const query of [
    'status=all',
    'search=' + 'x'.repeat(201),
    'search=a&search=b',
    'limit=101',
  ])
    assert.equal((await request(`/platform/tenants?${query}`)).status, 400);
  await page.goto(`${config.origin}/tenants/${other}`);
  await expect(contact()).toHaveValue('');
  await contact().fill('Old owner pending');
  const oldOwner = holdResponse(
    'POST',
    `/platform/tenants/${other}/configuration`,
  );
  await save('contacts').click();
  assert.equal(await oldOwner.reached, 200);
  await expire('idle');
  await page.evaluate(() =>
    globalThis.dispatchEvent(
      new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(
    page.getByRole('heading', { name: 'Platform console sign-in' }),
  ).toBeVisible();
  await switchOwner();
  await expect(contact()).toHaveValue('Old owner pending');
  await expect(
    page.getByRole('button', {
      name: 'Retry original contacts save',
      exact: true,
    }),
  ).not.toBeVisible();
  await contact().fill('New owner unsent');
  oldOwner.release();
  await delay(200);
  await expect(contact()).toHaveValue('New owner unsent');
  await redis.del('myims:limiter:v1:platform.protected');
  select(a);
  console.log(
    'PASS onboarding browser: HTTPS name/contact edits and replica reload, validation/focus, conflicts/input retention, immutable fields, uncertain original retry versus later state, target isolation, refresh, search/status and stale criteria',
  );
}
