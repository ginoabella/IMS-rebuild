// Actual tenant page; fixture data/validation responses, no tenant or credential writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkTenantCardPresentation({ page, origin }) {
  const id = randomUUID(),
    adminId = randomUUID(),
    timestamp = new Date().toISOString();
  let reads = 0,
    attemptedSaves = 0;
  const detail = {
    tenant: {
      id,
      tenantCode: 'card-fixture',
      displayName: 'Card demonstration organization',
      status: 'draft',
      version: 1,
      authorityVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      voicePreference: 'enabled',
      contacts: {
        name: 'Operations desk',
        email: 'desk@example.org',
        phone: '+63 1234567',
      },
      geography: {
        version: 0,
        srid: 4326,
        area: null,
        barangays: [],
        defaults: [123.19, 13.62],
      },
    },
    administrator: {
      kind: 'available',
      id: adminId,
      tenantId: id,
      username: 'card.admin',
      roles: ['tenant_admin'],
      status: 'active',
      credentialState: 'unset',
    },
  };
  const path = `${origin}/platform/tenants/${id}`;
  const nodes = (url) => url.pathname === '/platform/pbx-nodes';
  const credentials = `${path}/administrator/credential-actions`;
  const configuration = `${path}/configuration`;
  await page.route(path, (route) => {
    reads++;
    return route.fulfill({ json: detail });
  });
  await page.route(nodes, (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route(credentials, (route) => {
    assert.equal(route.request().method(), 'GET');
    return route.fulfill({ json: { credentialState: 'unset', action: null } });
  });
  await page.route(configuration, (route) => {
    assert.equal(route.request().method(), 'POST');
    attemptedSaves++;
    return route.fulfill({
      status: 400,
      json: {
        statusCode: 400,
        fieldErrors: { displayName: 'Invalid organization name.' },
      },
    });
  });
  try {
    await page.goto(`${origin}/tenants/${id}`);
    const toggles = page.locator('[data-disclosure-toggle]:visible');
    await expect(toggles).toHaveCount(9);
    await expect(
      page.locator('[data-disclosure-toggle][aria-expanded="true"]'),
    ).toHaveCount(0);
    const card = (name) => page.getByRole('region', { name, exact: true });
    const overview = (name) => card(name).locator('[data-disclosure-summary]');
    await expect(overview('Organization name')).toHaveText(
      detail.tenant.displayName,
    );
    await expect(overview('Initial administrator')).toContainText('card.admin');
    await expect(overview('Organizational contact')).toHaveText(
      'Operations desk',
    );
    await expect(overview('Voice preference')).toHaveText('Voice enabled');
    await expect(
      overview('Service area and default intake coordinates'),
    ).toContainText('123.19, 13.62');
    await expect(overview('Tenant extension allocation')).toContainText(
      'No PBX selected',
    );
    await expect(overview('Tenant route bindings')).toContainText(
      'pending live verification',
    );
    await expect(overview('Administrator credentials')).toContainText(
      'Setup required',
    );
    const input = page.getByRole('textbox', { name: /^Organization name/ });
    await expect(input).not.toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      );
      for (const toggle of await toggles.all()) {
        const bounds = await toggle.boundingBox();
        assert.ok(bounds.width >= 44 && bounds.height >= 44);
      }
      if (width === 1440 || width === 320)
        await page.screenshot({
          path: `/tmp/tenant-cards-collapsed-${width}.png`,
          fullPage: true,
        });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    const nameCard = card('Organization name'),
      contactCard = card('Organizational contact');
    await nameCard
      .getByRole('button', { name: 'Expand Organization name', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(input).toBeVisible();
    await input.fill('Retained organization draft');
    await input.evaluate((element) => {
      element.dataset.retentionMarker = 'same-input';
    });
    await nameCard
      .getByRole('button', { name: 'Collapse Organization name', exact: true })
      .click();
    await expect(overview('Organization name')).toHaveText(
      'Retained organization draft',
    );
    await expect(
      nameCard.getByText('Unsaved changes', { exact: true }),
    ).toBeVisible();
    await contactCard
      .getByRole('button', {
        name: 'Expand Organizational contact',
        exact: true,
      })
      .click();
    const contact = page.getByLabel('Contact name (optional)', { exact: true });
    await contact.fill('Retained contact draft');
    for (const event of ['focus', 'pageshow']) {
      const before = reads;
      await page.evaluate(
        (type) =>
          globalThis.dispatchEvent(
            type === 'pageshow'
              ? new globalThis.PageTransitionEvent(type, { persisted: true })
              : new globalThis.Event(type),
          ),
        event,
      );
      await expect.poll(() => reads).toBeGreaterThan(before);
      await expect(
        contactCard.getByRole('button', {
          name: 'Collapse Organizational contact',
          exact: true,
        }),
      ).toHaveAttribute('aria-expanded', 'true');
      await expect(
        nameCard.getByRole('button', {
          name: 'Expand Organization name',
          exact: true,
        }),
      ).toHaveAttribute('aria-expanded', 'false');
      await expect(contact).toHaveValue('Retained contact draft');
    }
    const tab = await page.context().newPage();
    try {
      await tab.bringToFront();
      await page.bringToFront();
      // Headless Chromium may omit native focus events; invoke the restoration listener too.
      const before = reads;
      await page.evaluate(() =>
        globalThis.dispatchEvent(new globalThis.Event('focus')),
      );
      await expect.poll(() => reads).toBeGreaterThan(before);
      await expect(contact).toHaveValue('Retained contact draft');
    } finally {
      await tab.close();
    }
    await nameCard
      .getByRole('button', { name: 'Expand Organization name', exact: true })
      .focus();
    await page.keyboard.press('Space');
    await expect(input).toHaveValue('Retained organization draft');
    assert.equal(
      await input.getAttribute('data-retention-marker'),
      'same-input',
    );
    await nameCard
      .getByRole('button', { name: 'Save name', exact: true })
      .click();
    await expect(
      nameCard.getByText('Save failed', { exact: true }),
    ).toBeVisible();
    assert.equal(attemptedSaves, 1);
    await nameCard
      .getByRole('button', { name: 'Collapse Organization name', exact: true })
      .click();
    await expect(
      nameCard.getByText('Save failed', { exact: true }),
    ).toBeVisible();
    await expect(
      nameCard.getByText('Save failed. Review the fields; input is retained.', {
        exact: true,
      }),
    ).toBeVisible();
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await page.reload();
    await expect(toggles).toHaveCount(9);
    await expect(
      page.locator('[data-disclosure-toggle][aria-expanded="true"]'),
    ).toHaveCount(0);
    await expect(overview('Organization name')).toHaveText(
      detail.tenant.displayName,
    );
    console.log(
      'PASS tenant cards: all nine collapsed on load with useful summaries, 44px arrow controls/keyboard, mounted input retention, open/closed choices and drafts across focus/pageshow/tab return, visible collapsed errors, document reset, 320–1440px reflow and axe (fixture reads/validation only)',
    );
  } finally {
    await page.unroute(path);
    await page.unroute(nodes);
    await page.unroute(credentials);
    await page.unroute(configuration);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/ui-preview`);
  }
}
