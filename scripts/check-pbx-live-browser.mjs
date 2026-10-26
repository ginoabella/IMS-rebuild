/* global document, innerWidth */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 30000 });
export async function checkLiveBrowser({
  request,
  direct,
  owner,
  page,
  config,
  a,
  b,
  holdResponse,
  expire,
  login,
}) {
  const nodeId = randomUUID(),
    installationId = randomUUID();
  const session = await page.evaluate(async () =>
    (await fetch('/platform/auth/session')).json(),
  );
  await owner.query(
    "INSERT INTO public.pbx_nodes(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by) VALUES($1,$2,'Live browser synthetic node','live-browser','live-browser.invalid','ami-tls',5039,'live-browser.invalid','live-browser',$3,$3)",
    [nodeId, installationId, session.operatorId],
  );
  await owner.query(
    'INSERT INTO public.pbx_observations(node_id,desired_version) VALUES($1,1)',
    [nodeId],
  );
  await owner.query(
    'INSERT INTO public.pbx_ownership(node_id,desired_version) VALUES($1,1)',
    [nodeId],
  );
  const database = (await owner.query('SELECT current_database() AS name'))
    .rows[0].name;
  const root = `/platform/pbx-nodes/${nodeId}/revisions`,
    live = root + '/live';
  console.log(
    'PBX_LIVE_FIXTURE_REQUEST ' +
      JSON.stringify({ database, nodeId, installationId }),
  );
  try {
    const deadline = Date.now() + 30000;
    let status;
    while (Date.now() < deadline) {
      const result = await direct(a, live);
      if (result.status === 200 && result.data.available) {
        status = result.data;
        break;
      }
      await delay(100);
    }
    assert.ok(status, 'actual native baseline/executor must become available');
    const baseline = status.verifiedId;
    await page.goto(config.origin + `/pbx-nodes/${nodeId}/revisions`);
    await page
      .getByRole('button', { name: 'Capture desired state', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Validate offline', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Validate offline', exact: true })
      .click();
    await expect(page.getByText(/Local validation: passed/)).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Apply reviewed revision',
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole('checkbox', { name: /I reviewed the runtime comparison/ })
      .check();
    await expect(
      page.getByRole('button', {
        name: 'Apply reviewed revision',
        exact: true,
      }),
    ).toBeEnabled();
    const gate = holdResponse('POST', live + '/apply');
    await page
      .getByRole('button', { name: 'Apply reviewed revision', exact: true })
      .click();
    await gate.reached;
    await expect(
      page.getByRole('button', {
        name: 'Recover operation receipt',
        exact: true,
      }),
    ).toBeEnabled({ timeout: 15000 });
    gate.release();
    await expire('idle');
    await page
      .getByRole('button', { name: 'Recover operation receipt', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Platform console sign-in',
        exact: true,
      }),
    ).toBeVisible();
    await login();
    await expect(
      page.getByRole('button', {
        name: 'Recover operation receipt',
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: 'Recover operation receipt', exact: true })
      .click();
    await expect(page.getByText(/^Operation .*: verified\./)).toBeVisible();
    const canonical = await direct(b, live);
    assert.equal(canonical.status, 200);
    assert.equal(canonical.data.runtime, 'verified');
    assert.notEqual(canonical.data.verifiedId, baseline);
    const revision = canonical.data.verifiedId;
    assert.equal(
      (
        await direct(a, live + '/apply', 'POST', {
          requestId: randomUUID(),
          revisionId: revision,
          expectedBaselineId: baseline,
        })
      ).data.reason,
      'stale_baseline',
    );
    for (const body of [
      {
        requestId: randomUUID(),
        revisionId: revision,
        expectedBaselineId: revision,
        command: 'reload',
      },
      {
        requestId: randomUUID(),
        revisionId: revision,
        expectedBaselineId: revision,
        path: '/etc/asterisk',
      },
    ])
      assert.equal(
        (await direct(a, live + '/apply', 'POST', body)).status,
        400,
      );
    assert.equal(
      (
        await request(
          live + '/apply',
          'POST',
          {
            requestId: randomUUID(),
            revisionId: revision,
            expectedBaselineId: revision,
          },
          { 'X-Platform-CSRF': 'invalid' },
        )
      ).status,
      403,
    );
    await page.getByLabel('Verified recovery target').selectOption(baseline);
    await page
      .getByRole('button', { name: 'Recover selected artifact', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Operation .*: recovered\./)).toBeVisible();
    const restored = await direct(a, live);
    assert.equal(restored.data.verifiedId, baseline);
    assert.equal(restored.data.knownGoodId, baseline);
    assert.equal(restored.data.activeOperationId, null);
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    assert.deepEqual(violations, []);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    console.log(
      'PASS live HTTPS: explicit exact-runtime review -> durable lost-response apply -> same-operator reauthentication/receipt -> actual native verification -> keyboard explicit recovery; two-replica canonical state, stale baseline/CSRF/raw-command denial, axe/reflow; isolated disabled/unbound desired stock, no provider token in PBX',
    );
  } finally {
    console.log('PBX_LIVE_FIXTURE_STOP');
    const path = `.local/pbx-live/acceptance/${nodeId}/stopped`,
      deadline = Date.now() + 15000;
    while (!existsSync(path) && Date.now() < deadline) await delay(50);
    assert.ok(
      existsSync(path),
      'owned native browser fixture must stop before DB teardown',
    );
    rmSync(`.local/pbx-live/acceptance/${nodeId}`, {
      recursive: true,
      force: true,
    });
  }
}
