// Actual console UI with fixture inventory reads; no PBX or credential operations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkInventoryPresentation({ page, origin }) {
  const nodeId = randomUUID();
  const items = ['1000', '1004', '1013', '1018', '9999', '10000'].map(
    (number) => ({
      id: randomUUID(),
      nodeId,
      number,
      kind: 'sip',
      profile: { id: randomUUID(), version: 1 },
      availability: 'available',
      administrativeStatus: 'disabled',
      credentials: { kind: 'unset' },
      readiness: { kind: 'not_established' },
      observation: { kind: 'not_available' },
      eligibility: { eligible: false, reasons: ['unallocated', 'disabled'] },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: randomUUID(),
      updatedBy: randomUUID(),
    }),
  );
  let inventoryReads = 0;
  const pattern = `${origin}/platform/pbx-nodes/${nodeId}/**`;
  await page.route(pattern, async (route) => {
    assert.equal(route.request().method(), 'GET');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/extensions')) inventoryReads++;
    const extension = items.find((item) => path.endsWith(`/${item.id}`));
    const value = path.endsWith('/endpoint-profiles')
      ? { items: [], nextCursor: null, nodeVersion: 1, capability: null }
      : extension
        ? { extension }
        : { items, nextCursor: null };
    await route.fulfill({ json: value });
  });
  try {
    await page.goto(`${origin}/pbx-nodes/${nodeId}/inventory`);
    const inventory = page.getByRole('region', {
      name: 'Canonical extension inventory',
      exact: true,
    });
    const rows = inventory.locator('details');
    await expect(rows).toHaveCount(items.length);
    await expect(inventory.locator('details[open]')).toHaveCount(0);
    assert.deepEqual(
      await inventory
        .locator('summary')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('aria-label')),
        ),
      items.map((item) => `Extension ${item.number}`),
    );
    const first = rows.first();
    const summary = first.locator('summary');
    await expect(first.getByText(/Profile/)).not.toBeVisible();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(first.getByText(/Profile/)).toBeVisible();
    await expect(first.getByText(/Registration unknown/)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(first.getByText(/Profile/)).not.toBeVisible();
    await page.keyboard.press('Space');
    await expect(
      first.getByRole('button', {
        name: 'Inspect extension 1000',
        exact: true,
      }),
    ).toBeVisible();
    // Access restoration refetches and remounts rows; disclosure choices must survive.
    await rows.nth(2).locator('summary').click();
    async function retainedChoices() {
      await expect(rows).toHaveCount(items.length);
      await expect(first).toHaveAttribute('open', '');
      await expect(rows.nth(2)).toHaveAttribute('open', '');
      await expect(rows.nth(1)).not.toHaveAttribute('open');
    }
    for (const event of ['focus', 'pageshow']) {
      const before = inventoryReads;
      await page.evaluate((event) => {
        globalThis.dispatchEvent(
          event === 'pageshow'
            ? new globalThis.PageTransitionEvent(event, { persisted: true })
            : new globalThis.Event(event),
        );
      }, event);
      await expect.poll(() => inventoryReads).toBeGreaterThan(before);
      await retainedChoices();
    }
    await page.evaluate(() => {
      Object.defineProperty(globalThis.document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      globalThis.document.dispatchEvent(
        new globalThis.Event('visibilitychange'),
      );
    });
    await expect(inventory).not.toBeVisible();
    const beforeVisible = inventoryReads;
    await page.evaluate(() => {
      Object.defineProperty(globalThis.document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      globalThis.document.dispatchEvent(
        new globalThis.Event('visibilitychange'),
      );
    });
    await expect.poll(() => inventoryReads).toBeGreaterThan(beforeVisible);
    await retainedChoices();
    await page.evaluate(() => {
      delete globalThis.document.visibilityState;
    });
    const otherTab = await page.context().newPage();
    try {
      await otherTab.bringToFront();
      await page.bringToFront();
      // Headless Chromium may omit native tab focus events; exercise the listener too.
      const beforeReturn = inventoryReads;
      await page.evaluate(() =>
        globalThis.dispatchEvent(new globalThis.Event('focus')),
      );
      await expect.poll(() => inventoryReads).toBeGreaterThan(beforeReturn);
      await retainedChoices();
    } finally {
      await otherTab.close();
    }
    await expect(inventory).toBeVisible();
    await summary.click();
    await expect(first).not.toHaveAttribute('open');
    const beforeReload = inventoryReads;
    await page
      .getByRole('button', { name: 'Reload inventory', exact: true })
      .click();
    await expect.poll(() => inventoryReads).toBeGreaterThan(beforeReload);
    await expect(rows).toHaveCount(items.length);
    await expect(first).not.toHaveAttribute('open');
    await expect(rows.nth(2)).toHaveAttribute('open', '');
    await summary.click();
    await rows.nth(2).locator('summary').click();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      );
      const collapsedHeight = await rows
        .nth(1)
        .evaluate((element) => element.getBoundingClientRect().height);
      assert.ok(collapsedHeight >= 44);
    }
    await page.screenshot({
      path: '/tmp/inventory-compact-mobile.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await first
      .getByRole('button', { name: 'Inspect extension 1000', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Extension 1000 details', exact: true }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(results.violations, []);
    await page.screenshot({
      path: '/tmp/inventory-compact-desktop.png',
      fullPage: true,
    });
    // Changing the node starts a separate inventory workspace, even with the same IDs.
    const otherNodeId = randomUUID();
    const otherPattern = `${origin}/platform/pbx-nodes/${otherNodeId}/**`;
    await page.route(otherPattern, async (route) => {
      assert.equal(route.request().method(), 'GET');
      const profiles = new URL(route.request().url()).pathname.endsWith(
        '/endpoint-profiles',
      );
      await route.fulfill({
        json: profiles
          ? { items: [], nextCursor: null, nodeVersion: 1, capability: null }
          : {
              items: items.map((item) => ({ ...item, nodeId: otherNodeId })),
              nextCursor: null,
            },
      });
    });
    try {
      await page.goto(`${origin}/pbx-nodes/${otherNodeId}/inventory`);
      await expect(rows).toHaveCount(items.length);
      await expect(inventory.locator('details[open]')).toHaveCount(0);
    } finally {
      await page.unroute(otherPattern);
    }
    await page.goto(`${origin}/pbx-nodes/${nodeId}/inventory`);
    await expect(rows).toHaveCount(items.length);
    await expect(inventory.locator('details[open]')).toHaveCount(0);
    console.log(
      'PASS inventory disclosure retention: multiple open/closed rows survive focus, visibility, persisted pageshow, tab return and explicit reload; node switch clears choices (fixture reads; restoration events also dispatched for headless Chromium)',
    );
    console.log(
      'PASS inventory presentation: collapsed rows, numeric API order preserved, Enter/Space disclosure, Inspect, 320–1440px reflow and axe (fixture reads only)',
    );
  } finally {
    await page.unroute(pattern);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/ui-preview`);
  }
}
