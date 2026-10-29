import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkTenantVoiceBrowser({
  page,
  config,
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
  await redis.del('myims:limiter:v1:platform.protected');
  const id = await create(`voice-${randomUUID().slice(0, 8)}`),
    path = `/platform/tenants/${id}/configuration`;
  const region = page.getByRole('region', {
    name: 'Voice preference',
    exact: true,
  });
  const choice = region.getByLabel(/^Voice preference/);
  const save = region.getByRole('button', { name: 'Save voice', exact: true });
  await expect(choice).toHaveValue('not_configured');
  const original = (await request(`/platform/tenants/${id}`)).data;
  for (const values of [
    {},
    { voicePreference: 'unknown' },
    { voicePreference: 'enabled', readiness: true },
    { voicePreference: 'disabled', pbxBinding: {} },
  ]) {
    assert.equal(
      (
        await request(path, 'POST', {
          requestId: randomUUID(),
          expectedVersion: original.tenant.version,
          expectedAuthorityVersion: original.tenant.authorityVersion,
          section: 'voice',
          values,
        })
      ).status,
      400,
    );
  }

  await choice.focus();
  await page.keyboard.press('ArrowDown');
  await expect(choice).toHaveValue('enabled');
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(region.getByText(/^Saved at version/)).toBeVisible();
  select(b);
  await page.reload();
  await expect(choice).toHaveValue('enabled');
  await page
    .getByLabel('Contact name (optional)', { exact: true })
    .fill('Unsaved voice neighbor');
  await choice.selectOption('disabled');
  await save.click();
  await expect(region.getByText(/^Saved at version/)).toBeVisible();
  await expect(
    page.getByLabel('Contact name (optional)', { exact: true }),
  ).toHaveValue('Unsaved voice neighbor');
  let detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(detail.tenant.voicePreference, 'disabled');
  assert.equal(detail.tenant.status, 'draft');
  await review('voice');
  // Preserve proposed choice and its old version after another replica changes the row.
  await choice.selectOption('enabled');
  assert.equal(
    (
      await request(path, 'POST', {
        requestId: randomUUID(),
        expectedVersion: detail.tenant.version,
        expectedAuthorityVersion: detail.tenant.authorityVersion,
        section: 'name',
        values: { displayName: 'Concurrent voice name' },
      })
    ).status,
    200,
  );
  await save.click();
  await expect(region.getByText(/^Conflict: your input/)).toBeVisible();
  await expect(page.locator('#edit-voice-feedback')).toBeFocused();
  await expect(choice).toHaveValue('enabled');
  await page
    .getByRole('button', { name: 'Reload detail', exact: true })
    .click();
  await expect(
    region.getByRole('button', {
      name: 'Discard voice changes and use loaded detail',
      exact: true,
    }),
  ).toBeEnabled();
  await region
    .getByRole('button', {
      name: 'Discard voice changes and use loaded detail',
      exact: true,
    })
    .click();
  await expect(choice).toHaveValue('disabled');
  const held = holdResponse('POST', path);
  await choice.selectOption('enabled');
  await save.click();
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
  held.release();
  select(a);
  await login();
  await expect(
    region.getByRole('button', {
      name: 'Retry original voice save',
      exact: true,
    }),
  ).toBeVisible();
  await region
    .getByRole('button', { name: 'Retry original voice save', exact: true })
    .click();
  await expect(region.getByText(/^Original save confirmed/)).toBeVisible();
  await expect(choice).toHaveValue('enabled');
  await choice.selectOption('disabled');
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
  await expect(choice).toHaveValue('disabled');
  await expect(
    region.getByText('Unsaved changes', { exact: true }),
  ).toBeVisible();
  detail = (await request(`/platform/tenants/${id}`)).data;
  assert.equal(detail.tenant.voicePreference, 'enabled');
  // A changed owner cannot recover staged voice input or a prior attempt.
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
  await expect(choice).toHaveValue('enabled');
  const targetHeld = holdResponse('POST', path);
  await choice.selectOption('disabled');
  await save.click();
  assert.equal(await targetHeld.reached, 200);
  const other = await create(`voice-other-${randomUUID().slice(0, 8)}`);
  assert.notEqual(other, id);
  targetHeld.release();
  await expect(choice).toHaveValue('not_configured');
  await expect(
    region.getByRole('button', {
      name: 'Retry original voice save',
      exact: true,
    }),
  ).not.toBeVisible();
  console.log(
    'PASS voice HTTPS: explicit keyboard choice, replica reload, independent unsaved edits, conflict/discard, lost-response original retry, same-owner recovery and 320–1440px/axe',
  );
  await page.goto(`${config.origin}/tenants`);
}
