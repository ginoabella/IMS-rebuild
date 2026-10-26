/* global document, innerWidth */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect, chromium } from '@playwright/test';
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
  issue,
  staffFacts,
  select,
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
    const staff = await issue(a, staffFacts);
    const staffCookie = `__Host-myims-platform=${staff.token}`;
    assert.equal(
      (await direct(b, live, 'GET', undefined, staffCookie)).status,
      403,
    );
    for (const action of ['apply', 'recover', 'reconcile'])
      assert.equal(
        (
          await direct(
            a,
            live + '/' + action,
            'POST',
            {
              requestId: randomUUID(),
              expectedBaselineId: baseline,
              ...(action === 'apply'
                ? { revisionId: randomUUID() }
                : { targetId: baseline }),
            },
            staffCookie,
          )
        ).status,
        403,
      );

    // Deployment-only capability facts; every desired save uses the actual HTTPS UI.
    await owner.query(
      "INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])",
      [installationId],
    );
    const button = (name) => page.getByRole('button', { name, exact: true });
    await page.goto(`${config.origin}/pbx-nodes/${nodeId}/inventory`);
    await page.locator('#profile-name').fill('Integrated live profile');
    await button('Create endpoint profile').click();
    await expect(page.getByText(/Saved desired result:/)).toBeVisible();
    await button('Reload list for explicit review').click();
    const profile = (
      await direct(a, `/platform/pbx-nodes/${nodeId}/endpoint-profiles`)
    ).data.items[0];
    await page.locator('#inventory-profile').selectOption(profile.id);
    await page.locator('#inventory-number').fill('6101');
    await button('Create individual extension').click();
    await expect(page.getByText(/Saved desired result:/)).toBeVisible();
    await page.goto(`${config.origin}/pbx-nodes/${nodeId}/peers`);
    await button('Create trunk').click();
    await page.getByLabel(/^Name/).fill('Integrated live trunk');
    await page.getByLabel('Remote host or IP').fill('integrated-live.invalid');
    await button('Save trunk').click();
    await expect(
      page.getByRole('region', { name: 'Resource detail', exact: true }),
    ).toContainText('Integrated live trunk');
    await page.goto(`${config.origin}/pbx-nodes/${nodeId}/routing`);
    await button('Reserved numbers').click();
    await button('Create reservation').click();
    await page.getByLabel(/^Name/).fill('Integrated live protection');
    await page
      .getByLabel(/^Purpose/)
      .fill('Private development interruption acceptance');
    await page.getByLabel('ASCII digits').fill('68001');
    await button('Save reservation').click();
    await expect(
      page.getByRole('region', { name: 'Resource detail', exact: true }),
    ).toContainText('Integrated live protection');
    const passive = (await direct(b, live)).data;
    assert.equal(passive.verifiedId, baseline);
    assert.equal(
      passive.operations.length,
      0,
      'desired saves must cause no external operation',
    );
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
    const observerBrowser = await chromium.launch({ headless: true });
    try {
      const observerContext = await observerBrowser.newContext({
        ignoreHTTPSErrors: true,
      });
      await observerContext.addCookies(await page.context().cookies());
      const observer = await observerContext.newPage();
      select(b);
      await observer.goto(config.origin + `/pbx-nodes/${nodeId}/revisions`);
      await observer
        .getByRole('button', { name: /^apply #\d+: verified$/ })
        .click();
      await expect(
        observer.getByText(/^Operation .*: verified\./),
      ).toBeVisible();
      assert.ok(
        (await observer.locator('body').innerText()).includes(revision),
      );
    } finally {
      select(a);
      await observerBrowser.close();
      await page.bringToFront();
    }
    const recoverGate = holdResponse('POST', live + '/recover');
    await page.getByLabel('Verified recovery target').selectOption(baseline);
    await page
      .getByRole('button', { name: 'Recover selected artifact', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await recoverGate.reached;
    await expect(button('Recover operation receipt')).toBeEnabled({
      timeout: 15000,
    });
    recoverGate.release();
    await button('Recover operation receipt').click();
    await expect(page.getByText(/^Operation .*: recovered\./)).toBeVisible();
    const restored = await direct(a, live);
    assert.equal(restored.data.verifiedId, baseline);
    assert.equal(restored.data.knownGoodId, baseline);
    assert.equal(restored.data.activeOperationId, null);
    // Private file controls are test-only; the public request carries no fault/command data.
    const fault = `.local/pbx-live/acceptance/${nodeId}/fault`;
    async function applyFresh() {
      await button('Capture desired state').click();
      await expect(button('Validate offline')).toBeEnabled();
      await button('Validate offline').click();
      await expect(page.getByText(/Local validation: passed/)).toBeVisible();
      await page
        .getByRole('checkbox', { name: /I reviewed the runtime comparison/ })
        .check();
      await button('Apply reviewed revision').click();
    }
    writeFileSync(fault, 'candidate');
    await applyFresh();
    await expect(page.getByText(/^Operation .*: recovered\./)).toBeVisible();
    await expect(
      page.getByText(/Independent verification: failed\. Recovery: passed/),
    ).toBeVisible();
    assert.equal((await direct(b, live)).data.verifiedId, baseline);
    writeFileSync(fault, 'all');
    await applyFresh();
    await expect(page.getByText(/^Operation .*: unknown\./)).toBeVisible();
    await expect(page.getByText(/Unknown execution retains/)).toBeVisible();
    await expect(button('Apply reviewed revision')).toBeDisabled();
    const unknown = (await direct(b, live)).data;
    assert.equal(unknown.runtime, 'unknown');
    assert.ok(unknown.activeOperationId);
    writeFileSync(fault, 'none');
    await button('Reconcile to known good').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Operation .*: recovered\./)).toBeVisible();
    const reconciled = (await direct(b, live)).data;
    assert.equal(reconciled.verifiedId, baseline);
    assert.equal(reconciled.activeOperationId, null);
    assert.ok(
      !/password|secret_id|BEGIN PRIVATE|\/var\/lib\//i.test(
        await page.locator('body').innerText(),
      ),
    );
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
      'PASS live HTTPS: inventory/resource/routing desired saves are passive; second browser canonical result; actual runtime drift automatic recovery, failed probe/recovery with unknown state and keyboard audited reconciliation, lost recovery reply; explicit exact-runtime review -> durable lost-response apply -> same-operator reauthentication/receipt -> actual native verification -> keyboard explicit recovery; two-replica canonical state, stale baseline/CSRF/raw-command denial, axe/reflow; isolated disabled/unbound desired stock, no provider token in PBX',
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
