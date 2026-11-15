/* global document, innerWidth */
// Independent ordinary HTTPS read proof. No fixture server or credential login.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { manifest } from './tenant-call-preparation-store.mjs';
import { withOrdinaryConsole } from './tenant-call-ordinary-console.mjs';
const p = manifest(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(process.argv.length, 3);
const output = '.local/verification/p4-u2-dev-b/ordinary-console';
mkdirSync(output, { recursive: true, mode: 0o700 });
try {
  await withOrdinaryConsole(p, async ({ page, db, origin: browserOrigin }) => {
    const summary = [];
    for (const tenant of p.tenants) {
      const result = await db.read(async (snapshot) =>
        snapshot.query(
          'SELECT id FROM public.tenants WHERE normalized_code=$1',
          [tenant.tenantCode],
        ),
      );
      const tenantId = result.rows[0]?.id;
      assert.ok(tenantId);
      await page.goto(`${browserOrigin}/tenants/${tenantId}`);
      await page
        .getByRole('button', {
          name: 'Expand Tenant route bindings',
          exact: true,
        })
        .click();
      await page.getByLabel(/^Routing PBX node/).selectOption(p.nodeId);
      const control = page.getByLabel(/^Controlled call case/);
      await expect(control).toBeVisible();
      const response = await page.evaluate(async (path) => {
        const r = await fetch(path, { cache: 'no-store' });
        return {
          status: r.status,
          cacheControl: r.headers.get('cache-control'),
          view: await r.json(),
        };
      }, `/platform/tenants/${tenantId}/telephony/${p.nodeId}`);
      assert.equal(response.status, 200);
      assert.match(response.cacheControl, /no-store/);
      const view = response.view;
      assert.equal(view.cases.length, tenant.tenantCode === 'p4-dev-a' ? 8 : 3);
      assert.ok(view.cases.every((c) => c.available === true));
      assert.equal(view.grants.length, 0);
      assert.equal(view.tests.length, 0);
      assert.notEqual(view.readiness.state, 'ready');
      await expect(
        page.getByRole('button', {
          name: 'Run controlled call test',
          exact: true,
        }),
      ).toBeDisabled();
      await control.focus();
      await page.keyboard.press('ArrowDown');
      await expect(control).toBeFocused();
      const selectedCase = await control.inputValue();
      assert.ok(view.cases.some((c) => c.id === selectedCase));
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        if (width !== 768)
          await page
            .getByRole('region', {
              name: 'Verified tenant routing',
              exact: true,
            })
            .screenshot({
              path: `${output}/${tenant.tenantCode}-${width}.png`,
            });
      }
      assert.deepEqual(
        (await new AxeBuilder({ page }).analyze()).violations,
        [],
      );
      const after = await page.evaluate(async (path) => {
        const r = await fetch(path, { cache: 'no-store' });
        return { status: r.status, view: await r.json() };
      }, `/platform/tenants/${tenantId}/telephony/${p.nodeId}`);
      assert.equal(after.status, 200);
      assert.deepEqual(after.view.grants, view.grants);
      assert.deepEqual(after.view.tests, view.tests);
      assert.deepEqual(
        after.view.cases.map((c) => c.id),
        view.cases.map((c) => c.id),
      );
      assert.ok(after.view.cases.every((c) => c.available === true));
      summary.push({
        tenantId,
        caseIds: view.cases.map((c) => c.id),
        readiness: view.readiness,
      });
    }
    console.log(
      JSON.stringify({
        state: 'ordinary_console_read_passed',
        nodeId: p.nodeId,
        installationId: p.installationId,
        temporaryCanonicalSession: true,
        manualPasswordSignInClaimed: false,
        tenants: summary,
        screenshots: output,
      }),
    );
  });
} catch {
  console.error(
    'Ordinary controlled preparation console read failed; no session or credential data logged.',
  );
  process.exitCode = 1;
}
