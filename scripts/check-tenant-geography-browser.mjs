import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkTenantGeographyBrowser({
  page,
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
  // This group owns the isolated acceptance Redis; preserve production limits
  // while separating its many successful reauthentications from adjacent groups.
  await redis.del([
    'myims:limiter:v1:platform.protected',
    'myims:limiter:v1:platform.sign-in',
  ]);
  const id = await create(`geography-${randomUUID().slice(0, 8)}`),
    path = `/platform/tenants/${id}/configuration`;
  const region = page.getByRole('region', {
    name: 'Service area and default intake coordinates',
    exact: true,
  });
  const longitude = () =>
    page.getByLabel('Default intake longitude (optional)', { exact: true });
  const latitude = () =>
    page.getByLabel('Default intake latitude (optional)', { exact: true });
  const save = () =>
    page.getByRole('button', { name: 'Save geography', exact: true });
  const confirm = () => region.getByRole('checkbox');
  const upload = async () => {
    await page
      .getByLabel('Administrative boundary file (optional)', { exact: true })
      .setInputFiles(
        fileURLToPath(
          new URL(
            '../reference/map/naga_admin_ADM_ADM_3.json',
            import.meta.url,
          ),
        ),
      );
    await expect(confirm()).toBeVisible();
    await page
      .getByLabel('Barangay boundary file (optional)', { exact: true })
      .setInputFiles(
        fileURLToPath(
          new URL('../reference/map/naga_brgy_ADM_ADM_3.json', import.meta.url),
        ),
      );
    await expect(
      region.getByText('Barangays: 27 (uploaded)', { exact: true }),
    ).toBeVisible();
  };
  await expect(longitude()).toHaveValue('');
  await expect(
    region.getByText('Configured service area: not configured.', {
      exact: true,
    }),
  ).toBeVisible();
  await upload();
  await expect(
    region.getByText('Municipality: Naga City', { exact: true }),
  ).toBeVisible();
  await expect(confirm()).not.toBeChecked();
  await save().click();
  await expect(
    region.getByText(
      'Confirm that the uploaded boundaries belong to this tenant.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('#geography-feedback')).toBeFocused();
  await expect(confirm()).toBeEnabled();
  await confirm().press('Space');
  await expect(confirm()).toBeChecked();
  await longitude().fill('123.19');
  await latitude().fill('13.62');
  await latitude().press('Tab');
  await expect(confirm()).toBeChecked();
  await save().click();
  await expect(region.getByText(/^Geography saved at version/)).toBeVisible();
  let detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(detail.tenant.geography.barangays.length, 27);
  assert.deepEqual(detail.tenant.geography.defaults, [123.19, 13.62]);
  select(b);
  await page.reload();
  await expect(longitude()).toHaveValue('123.19');
  await expect(
    region.getByText('Saved barangays: 27', { exact: true }),
  ).toBeVisible();
  await review('geography');
  // Invalid file / malformed pair preserve previous staged values and focus the error.
  await page
    .getByLabel('Administrative boundary file (optional)', { exact: true })
    .setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{bad'),
    });
  await expect(
    region.getByText(/^Administrative file: Invalid UTF-8 JSON file/),
  ).toBeVisible();
  await expect(longitude()).toHaveValue('123.19');
  await page
    .getByLabel('Administrative boundary file (optional)', { exact: true })
    .setInputFiles({
      name: 'oversized.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 32),
    });
  await expect(
    region.getByText(/^Administrative file: Maximum 4 MiB/),
  ).toBeVisible();
  assert.equal(
    (await request(path, 'POST', 'x'.repeat(10 * 1024 * 1024))).status,
    400,
  );
  await expect(longitude()).toHaveValue('123.19');
  await latitude().fill('');
  await save().click();
  await expect(
    region.getByText('Enter both longitude and latitude, or clear both.', {
      exact: true,
    }),
  ).toBeVisible();
  await latitude().fill('13.62');
  // Outside point rejects in real PostGIS and keeps the entered values.
  await longitude().fill('0');
  await latitude().fill('0');
  await save().click();
  await expect(
    region.getByText(
      'Default intake coordinates must be inside or on the service area boundary.',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(longitude()).toHaveValue('0');
  await page
    .getByRole('button', {
      name: 'Discard geography changes and use loaded detail',
      exact: true,
    })
    .click();
  // Exact uncertain attempt must recover the current canonical values after a later save.
  await longitude().fill('123.20');
  const held = holdResponse('POST', path);
  await save().click();
  assert.equal(await held.reached, 200);
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
  held.release();
  await expect(
    page.getByRole('button', {
      name: 'Retry original geography save',
      exact: true,
    }),
  ).toBeVisible();
  detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(
    (
      await request(path, 'POST', {
        requestId: randomUUID(),
        expectedVersion: detail.tenant.version,
        expectedAuthorityVersion: detail.tenant.authorityVersion,
        section: 'geography',
        expectedGeographyVersion: detail.tenant.geography.version,
        ownershipConfirmed: false,
        values: {
          area: detail.tenant.geography.area,
          barangays: detail.tenant.geography.barangays,
          defaults: [123.21, 13.62],
        },
      })
    ).status,
    200,
  );
  await page
    .getByRole('button', { name: 'Retry original geography save', exact: true })
    .click();
  await expect(longitude()).toHaveValue('123.21');
  await expect(
    region.getByText(/^Original geography save confirmed/),
  ).toBeVisible();
  // Upload confirmation is reset when a canonical section/version changes.
  await upload();
  await confirm().check();
  detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(
    (
      await request(path, 'POST', {
        requestId: randomUUID(),
        expectedVersion: detail.tenant.version,
        expectedAuthorityVersion: detail.tenant.authorityVersion,
        section: 'name',
        values: { displayName: 'Geography renamed tenant' },
      })
    ).status,
    200,
  );
  await page
    .getByRole('button', { name: 'Reload detail', exact: true })
    .click();
  await expect(
    region.getByText('Geography renamed tenant', { exact: true }),
  ).toBeVisible();
  await expect(confirm()).not.toBeChecked();
  await expect(
    region.getByText('Barangays: 27 (uploaded)', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Discard geography changes and use loaded detail',
      exact: true,
    })
    .click();
  // Actual isolated Redis outage hides geography and preserves same-owner staged work.
  await upload();
  await confirm().check();
  await redis.sendCommand(['CLIENT', 'PAUSE', '2500', 'ALL']);
  await page.evaluate(() =>
    globalThis.dispatchEvent(
      new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(
    page.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible();
  await expect(confirm()).not.toBeVisible();
  await delay(3000);
  await page.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(confirm()).toBeChecked();
  await expect(
    region.getByText('Barangays: 27 (uploaded)', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Discard geography changes and use loaded detail',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Clear service area and barangays',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Clear default coordinates', exact: true })
    .click();
  await save().click();
  await expect(region.getByText(/^Geography saved at version/)).toBeVisible();
  select(a);
  await page.reload();
  await expect(longitude()).toHaveValue('');
  await expect(
    region.getByText('Configured service area: not configured.', {
      exact: true,
    }),
  ).toBeVisible();
  // Staged file work is owner-bound; changing owner or target cannot restore it.
  await upload();
  await confirm().check();
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
  await expect(confirm()).not.toBeVisible();
  await expect(
    region.getByText('Configured service area: not configured.', {
      exact: true,
    }),
  ).toBeVisible();
  await upload();
  const otherCode = `geography-other-${randomUUID().slice(0, 8)}`;
  const other = await create(otherCode);
  assert.notEqual(id, other);
  await expect(confirm()).not.toBeVisible();
  await expect(longitude()).toHaveValue('');
  // Hold a real committed response across client navigation to another tenant.
  await page.goto(`${new URL(page.url()).origin}/tenants/${id}`);
  await expect(longitude()).toHaveValue('');
  await upload();
  await confirm().check();
  const delayedTarget = holdResponse('POST', path);
  await save().click();
  assert.equal(await delayedTarget.reached, 200);
  await page
    .getByRole('link', { name: 'Back to tenants', exact: true })
    .click();
  await page
    .getByLabel('Search code or name (optional)', { exact: true })
    .fill(otherCode);
  await page
    .getByRole('button', { name: 'Search tenants', exact: true })
    .click();
  await page.locator(`a[href="/tenants/${other}"]`).click();
  await expect(longitude()).toHaveValue('');
  delayedTarget.release();
  await delay(150);
  await expect(confirm()).not.toBeVisible();
  await expect(
    region.getByText('Configured service area: not configured.', {
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    (
      await owner.query(
        'SELECT ST_NumGeometries(barangays) n FROM public.tenant_geography WHERE tenant_id=$1',
        [id],
      )
    ).rows[0].n,
    27,
  );
  await redis.del([
    'myims:limiter:v1:platform.protected',
    'myims:limiter:v1:platform.sign-in',
  ]);
  console.log(
    'PASS geography HTTPS browser: Naga upload/review/confirmation, actual saved reload across replicas, coordinate errors/focus, reflow/axe, exact uncertain recovery versus later data, version-reset confirmation, clearing, reauthentication, real Redis outage recovery and delayed owner/target isolation',
  );
}
