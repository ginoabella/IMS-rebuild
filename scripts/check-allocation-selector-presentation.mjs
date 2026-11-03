// Actual tenant-details UI with fixture stock reads/preview; no ownership/PBX writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkAllocationSelectorPresentation({ page, origin }) {
  const tenantId = randomUUID(),
    nodeId = randomUUID(),
    actor = randomUUID();
  const timestamp = new Date().toISOString();
  const tenant = {
    id: tenantId,
    status: 'draft',
    version: 1,
    authorityVersion: 1,
  };
  const all = [
    ...Array.from({ length: 300 }, (_, i) => String(1000 + i)),
    '9999',
    '10000',
  ].map((number) => ({
    id: randomUUID(),
    number,
    kind: 'sip',
    version: 1,
    administrativeStatus: 'disabled',
    claim: null,
    credentialPending: number === '1002',
    assignment: 'none',
    verification: 'not_established',
  }));
  all[1].claim = {
    id: randomUUID(),
    tenantId: randomUUID(),
    nodeId,
    installationId: randomUUID(),
    extensionId: all[1].id,
    state: 'reserved',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor,
    updatedBy: actor,
  };
  const allocationBase = `${origin}/platform/tenants/${tenantId}/allocations/${nodeId}`;
  // Exercise the real strict Next forwarding contract before installing presentation reads.
  const statuses = await page.evaluate(async (base) => {
    const result = [];
    for (const query of [
      'numberPrefix=12',
      'numberPrefix=%25',
      'numberPrefix=12&numberPrefix=13',
    ])
      result.push((await fetch(base + '/stock?' + query)).status);
    return result;
  }, allocationBase);
  assert.deepEqual(statuses, [404, 400, 400]);
  const tenantPattern = `${origin}/platform/tenants/${tenantId}`;
  const nodesPattern = (url) => url.pathname === '/platform/pbx-nodes';
  const allocationPattern = `${allocationBase}**`;
  const queries = [],
    previews = [];
  await page.route(tenantPattern, (route) =>
    route.fulfill({
      json: {
        tenant: {
          ...tenant,
          tenantCode: 'selector-fixture',
          displayName: 'Selector fixture tenant',
          createdAt: timestamp,
          updatedAt: timestamp,
          voicePreference: 'not_configured',
          contacts: { name: null, email: null, phone: null },
          geography: {
            version: 0,
            srid: 4326,
            area: null,
            barangays: [],
            defaults: null,
          },
        },
        administrator: { kind: 'unavailable' },
      },
    }),
  );
  await page.route(nodesPattern, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: nodeId,
            installationId: randomUUID(),
            displayName: 'Selector fixture PBX',
            management: {
              targetAlias: 'fixture',
              transport: 'ami-tls',
              port: 5039,
              host: 'fixture.invalid',
              tlsServerName: 'fixture.invalid',
            },
            credentialAlias: 'fixture',
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: actor,
            updatedBy: actor,
            observation: { kind: 'not_available' },
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route(allocationPattern, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith('/preview')) {
      assert.equal(request.method(), 'POST');
      const ids = request.postDataJSON().selection.extensionIds;
      assert.ok(ids.length >= 1 && ids.length <= 50);
      previews.push(ids);
      await route.fulfill({
        json: {
          tenant,
          canSave: true,
          items: ids.map((id) => ({
            ...all.find((item) => item.id === id),
            missing: false,
          })),
        },
      });
      return;
    }
    assert.equal(request.method(), 'GET');
    if (url.pathname.endsWith('/stock')) {
      const prefix = url.searchParams.get('numberPrefix') ?? '';
      const after = url.searchParams.get('after');
      queries.push({ prefix, after });
      const filtered = all.filter((item) => item.number.startsWith(prefix));
      const offset = after
        ? filtered.findIndex((item) => item.id === after) + 1
        : 0;
      const items = filtered.slice(offset, offset + 25);
      await route.fulfill({
        json: {
          tenant,
          items,
          nextCursor: filtered.length > offset + 25 ? items.at(-1).id : null,
        },
      });
    } else {
      await route.fulfill({
        json: {
          tenant,
          items: [],
          nextCursor: null,
          capacity: {
            available: 301,
            reserved: 0,
            allocated: 0,
            disabled: 302,
          },
        },
      });
    }
  });
  try {
    await page.goto(`${origin}/tenants/${tenantId}`);
    const card = page.getByRole('region', {
      name: 'Tenant extension allocation',
      exact: true,
    });
    await card
      .getByRole('button', { name: 'Expand Extension allocation', exact: true })
      .click();
    await card.getByLabel('PBX node').selectOption(nodeId);
    const choices = card.getByRole('region', {
      name: 'Extension choices',
      exact: true,
    });
    const checkbox = (number) =>
      choices.getByRole('checkbox', {
        name: new RegExp(`^Extension ${number} `),
      });
    const more = card.getByRole('button', { name: 'More stock', exact: true });
    async function search(prefix) {
      await card.getByLabel('Extension number', { exact: false }).fill(prefix);
      await card
        .getByRole('button', { name: 'Find extensions', exact: true })
        .click();
      await expect(
        card.getByText('Loading extensions…', { exact: true }),
      ).toHaveCount(0);
      assert.equal(queries.at(-1).prefix, prefix);
      assert.equal(queries.at(-1).after, null);
    }
    await expect(choices.getByRole('checkbox')).toHaveCount(25);
    assert.deepEqual(
      await choices
        .getByRole('checkbox')
        .evaluateAll((elements) =>
          elements.map((element) =>
            Number(element.getAttribute('aria-label').split(' ')[1]),
          ),
        ),
      Array.from({ length: 25 }, (_, i) => 1000 + i),
    );
    await expect(checkbox('1001')).toBeDisabled();
    await expect(checkbox('1002')).toBeDisabled();
    await checkbox('1000').check();
    await more.click();
    await expect(checkbox('1025')).toBeVisible();
    await checkbox('1025').check();
    await search('1199');
    await expect(choices.getByRole('checkbox')).toHaveCount(1);
    await checkbox('1199').check();
    await expect(card.getByText(/^3 selected/)).toBeVisible();
    await search('888888');
    await expect(
      card.getByText('No extensions match 888888.', { exact: true }),
    ).toBeVisible();
    await expect(card.getByText(/^3 selected/)).toBeVisible();
    await search('11');
    await expect(choices.getByRole('checkbox')).toHaveCount(25);
    await expect(checkbox('1100')).toBeVisible();
    await more.click();
    await expect(checkbox('1125')).toBeVisible();
    assert.equal(queries.at(-1).prefix, '11');
    await card
      .getByRole('button', { name: 'Show all extensions', exact: true })
      .click();
    await expect(checkbox('1000')).toBeChecked();
    await card
      .getByRole('button', { name: 'Preview selection', exact: true })
      .click();
    await expect(
      card.getByRole('button', { name: 'Save reservation', exact: true }),
    ).toBeEnabled();
    assert.deepEqual(
      previews
        .at(-1)
        .map((id) => all.find((item) => item.id === id).number)
        .sort(),
      ['1000', '1025', '1199'],
    );
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      );
      assert.ok(
        await choices.evaluate(
          (element) => element.getBoundingClientRect().height <= 290,
        ),
      );
      const target = await choices.locator('label').first().boundingBox();
      assert.ok(target.height >= 44);
      if (width === 1440 || width === 320)
        await card.screenshot({
          path: `/tmp/allocation-selector-${width}.png`,
        });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await card
      .getByRole('button', { name: 'Clear individual selection', exact: true })
      .click();
    await expect(card.getByText(/^0 selected/)).toBeVisible();
    // The existing 50-item cap still applies when selecting across pages.
    for (let batch = 0; batch < 2; batch++) {
      for (const input of await choices
        .getByRole('checkbox', { disabled: false })
        .all())
        await input.check();
      await more.click();
      await expect(checkbox(String(1000 + (batch + 1) * 25))).toBeVisible();
    }
    await checkbox('1050').check();
    await checkbox('1051').check();
    await expect(card.getByText(/^50 selected/)).toBeVisible();
    await expect(
      choices.locator('input:not(:checked):not(:disabled)'),
    ).toHaveCount(0);
    await card
      .getByRole('button', { name: 'Clear individual selection', exact: true })
      .click();
    await expect(checkbox('1052')).toBeEnabled();
    console.log(
      'PASS allocation selector presentation: 302-stock fixture, numeric compact/bounded grid, full-stock search/paging, off-page choices and preview, blockers, 50 cap, clearing, 320–1440px reflow/targets and axe; real Next prefix allowlist (no ownership/PBX writes)',
    );
  } finally {
    await page.unroute(tenantPattern);
    await page.unroute(nodesPattern);
    await page.unroute(allocationPattern);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/ui-preview`);
  }
}
