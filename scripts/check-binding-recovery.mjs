import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import { expandTenantCards } from './tenant-card-browser.mjs';
const expect = baseExpect.configure({ timeout: 20000 });
export async function checkBindingRecovery({
  page,
  config,
  one,
  two,
  nodeId,
  otherNode,
  dids,
  path,
  expire,
  login,
  ingress,
  holdResponse,
  username,
  request,
}) {
  assert.equal(
    typeof username,
    'string',
    'The recovery fixture must supply its canonical operator name',
  );
  const panel = () =>
    page.getByRole('region', { name: 'inbound tenant route configuration' });
  async function target(t = one) {
    await page.goto(`${config.origin}/tenants/${t.id}`);
    await expandTenantCards(page);
    await page.locator('#route-binding-node').selectOption(nodeId);
    await expect(panel().locator('#binding-inbound-resource')).toBeEnabled();
  }
  async function preview() {
    await panel().locator('#binding-inbound-resource').selectOption(dids[0].id);
    await panel()
      .getByRole('button', { name: 'Preview inbound authorization' })
      .click();
    await expect(
      panel().getByRole('button', { name: 'Save inbound authorization' }),
    ).toBeEnabled();
  }
  await target();
  await panel().locator('#binding-inbound-resource').selectOption(dids[0].id);
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
  await expect(panel().locator('#binding-inbound-resource')).toHaveValue(
    dids[0].id,
  );
  await expect(panel().locator('#binding-inbound-resource')).toBeEnabled();
  await preview();
  ingress.drop(path(one));
  await panel()
    .getByRole('button', { name: 'Save inbound authorization' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible();
  await delay(1100);
  await page.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(
    panel().getByRole('button', { name: 'Retry original inbound request' }),
  ).toBeEnabled();
  await panel()
    .getByRole('button', { name: 'Retry original inbound request' })
    .click();
  await expect(panel().getByRole('status')).toContainText(
    'Original outcome recovered',
  );
  await preview();
  const gate = holdResponse('POST', path(one));
  await panel()
    .getByRole('button', { name: 'Save inbound authorization' })
    .click();
  assert.equal(await gate.reached, 200);
  await page.locator('#route-binding-node').selectOption(otherNode);
  gate.release();
  await expect(panel().locator('#binding-inbound-resource')).toHaveValue('');
  await expect(
    panel().getByRole('button', { name: 'Retry original inbound request' }),
  ).not.toBeVisible();
  await target();
  await preview();
  const ownerGate = holdResponse('POST', path(one));
  await panel()
    .getByRole('button', { name: 'Save inbound authorization' })
    .click();
  assert.equal(await ownerGate.reached, 200);
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
  await expandTenantCards(page);
  await page.locator('#route-binding-node').selectOption(nodeId);
  ownerGate.release();
  await expect(panel().locator('#binding-inbound-resource')).toHaveValue('');
  await expect(
    panel().getByRole('button', { name: 'Retry original inbound request' }),
  ).not.toBeVisible();
  await page.goto(`${config.origin}/tenants/${two.id}`);
  await expandTenantCards(page);
  await page.locator('#route-binding-node').selectOption(nodeId);
  await expect(panel().locator('#binding-inbound-resource')).toHaveValue('');
  const saved = await request(path(one));
  assert.equal(saved.status, 200);
  assert.equal(
    saved.data.items.filter(
      (a) =>
        a.kind === 'dids' &&
        a.resourceId === dids[0].id &&
        a.state === 'active',
    ).length,
    1,
  );
  // Return the shared browser harness to its original canonical operator.
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
  await expect(
    page.getByRole('heading', { name: 'Tenant details', exact: true }),
  ).toBeVisible();
  console.log(
    'PASS binding actual HTTPS same-owner/lost-response recovery and late node/operator/tenant isolation',
  );
}
