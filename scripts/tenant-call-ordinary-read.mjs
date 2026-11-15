/* global document, innerWidth */
// Actual ordinary console read/accessibility proof; no telephony writer.
import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 30000 });
export async function checkOrdinaryRead({
  page,
  p,
  tenants,
  approvedCases,
  get,
  button,
  openTenant,
  journal,
  save,
}) {
  journal.reads = [];
  for (const tenant of tenants) {
    await openTenant(tenant);
    const path = `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`;
    const before = await get(path);
    assert.deepEqual(
      before.cases.map((c) => c.id).sort(),
      approvedCases
        .filter((c) => c.tenantId === tenant.id)
        .map((c) => c.id)
        .sort(),
    );
    assert.ok(before.cases.length > 0 && before.cases.length <= 16);
    assert.equal(before.grants.filter((g) => g.active).length, 0);
    assert.notEqual(before.readiness.state, 'ready');
    await expect(button('Grant verification')).toBeDisabled();
    await expect(button('Run controlled call test')).toBeDisabled();
    const control = page.getByLabel(/^Controlled call case/);
    await control.focus();
    await page.keyboard.press('ArrowDown');
    await expect(control).toBeFocused();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    const after = await get(path);
    assert.deepEqual(after.grants, before.grants);
    assert.deepEqual(after.tests, before.tests);
    assert.deepEqual(after.cases, before.cases);
    journal.reads.push({
      tenantId: tenant.id,
      readiness: after.readiness,
      cases: after.cases.map((c) => ({ id: c.id, available: c.available })),
      grantCount: after.grants.length,
      testCount: after.tests.length,
    });
    save();
  }
  assert.equal(journal.requests.length, 0);
}
