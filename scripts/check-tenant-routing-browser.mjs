/* global document, innerWidth */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareTenantRoutingFixture } from './prepare-tenant-routing-fixture.mjs';
const expect = baseExpect.configure({ timeout: 30000 });
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
export async function checkTenantRoutingBrowser(input) {
  try {
    await runTenantRoutingBrowser(input);
  } catch (error) {
    mkdirSync('.local/verification/p4-u2c', { recursive: true, mode: 0o700 });
    await input.page
      .screenshot({
        path: '.local/verification/p4-u2c/last-failure.png',
        fullPage: true,
      })
      .catch(() => {});
    console.error(
      'Tenant routing browser failure',
      JSON.stringify({
        location: error?.stack
          ?.split('\n')
          .find((line) => /check-tenant-routing-browser\.mjs:\d+/.test(line))
          ?.trim(),
      }),
    );
    throw error;
  }
}
async function runTenantRoutingBrowser({
  page,
  config,
  owner,
  direct,
  request,
  a,
  b,
  nodeId,
  installationId,
  baseline,
  operatorId,
  staffCookie,
  holdResponse,
  expire,
  login,
}) {
  const database = (await owner.query('SELECT current_database() AS name'))
    .rows[0].name;
  const runtime = new URL(
    load('./dist/infrastructure/configuration.js').loadMigrationConfig()
      .runtimeUrl,
  );
  runtime.pathname = '/' + database;
  const metadata = await prepareTenantRoutingFixture(
    owner,
    { database, nodeId, installationId, operatorId },
    runtime.href,
  );
  const screenshots = `.local/verification/p4-u2c/${nodeId}`;
  mkdirSync(screenshots, { recursive: true, mode: 0o700 });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const root = `/platform/pbx-nodes/${nodeId}/revisions`,
    live = root + '/live';
  await page.goto(config.origin + `/pbx-nodes/${nodeId}/revisions`);
  await expect(page.getByText('Loading history…', { exact: true })).toHaveCount(
    0,
  );
  await page.waitForLoadState('networkidle');
  await button('Capture desired state').click();
  await expect(button('Validate offline')).toBeEnabled();
  await button('Validate offline').click();
  await expect(page.getByText(/Local validation: passed/)).toBeVisible();
  await page
    .getByRole('checkbox', { name: /I reviewed the runtime comparison/ })
    .check();
  await button('Apply reviewed revision').click();
  await expect(page.getByText(/^Operation .*: verified\./)).toBeVisible({
    timeout: 90000,
  });
  const applied = (await direct(b, live)).data.verifiedId;
  assert.notEqual(applied, baseline);
  console.log('CHECK tenant routing HTTPS: actual tenant-aware apply verified');
  for (const tenant of metadata.tenants) {
    const path = `/platform/tenants/${tenant.id}/telephony/${nodeId}`;
    assert.equal(
      (await direct(a, path, 'GET', undefined, staffCookie)).status,
      403,
    );
    for (const injected of [
      { command: 'reload' },
      { path: '/etc/asterisk' },
      { secret: 'opaque' },
      { lifetimeSeconds: 1801 },
    ])
      assert.equal(
        (
          await direct(a, path + '/grant', 'POST', {
            requestId: randomUUID(),
            artifactId: applied,
            caseIds: metadata.cases
              .filter((c) => c.tenantId === tenant.id)
              .map((c) => c.id),
            ...injected,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request(
          path + '/grant',
          'POST',
          {
            requestId: randomUUID(),
            artifactId: applied,
            caseIds: [metadata.cases[0].id],
          },
          { 'X-Platform-CSRF': 'invalid' },
        )
      ).status,
      403,
    );
    await page.goto(config.origin + `/tenants/${tenant.id}`);
    const toggle = page.getByRole('button', {
      name: 'Expand Tenant route bindings',
      exact: true,
    });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.getByLabel(/^Routing PBX node/).selectOption(nodeId);
    await expect(button('Grant verification')).toBeEnabled();
    console.log('CHECK tenant routing HTTPS: grant and exact mounted recovery');
    if (tenant.id === metadata.tenants[0].id) {
      const gate = holdResponse('POST', path + '/grant');
      await button('Grant verification').click();
      await gate.reached;
      await expect(button('Retry access')).toBeEnabled({
        timeout: 15000,
      });
      gate.release();
      await expire('idle');
      await delay(1100); // Honor the shared unavailable-response retry interval.
      await button('Retry access').click();
      await expect(
        page.getByRole('heading', {
          name: 'Platform console sign-in',
          exact: true,
        }),
      ).toBeVisible();
      await login();
      await expect(button('Recover exact verification intent')).toBeEnabled();
      await button('Recover exact verification intent').click();
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::integer AS n FROM public.tenant_verification_grants WHERE tenant_id=$1 AND node_id=$2',
            [tenant.id, nodeId],
          )
        ).rows[0].n,
        1,
      );
    } else await button('Grant verification').click();
    await expect(
      page.getByText('Intent recorded. Reload for the current outcome.', {
        exact: true,
      }),
    ).toBeVisible();
    let view = (await direct(a, path)).data;
    assert.ok(view.grants[0]?.active);
    await page
      .getByLabel(/^Draft verification grant/)
      .selectOption(view.grants[0].id);
    for (const c of metadata.cases.filter((c) => c.tenantId === tenant.id)) {
      await page.getByLabel(/^Controlled call case/).selectOption(c.id);
      await button('Run controlled call test').click();
      const until = Date.now() + 30000;
      let result;
      while (Date.now() < until) {
        view = (await direct(b, path)).data;
        result = view.tests?.find((t) => t.caseId === c.id);
        if (result?.outcome) break;
        await delay(150);
      }
      assert.equal(
        result?.outcome,
        c.expected,
        JSON.stringify({ caseId: c.id, result }),
      );
      await button('Reload evidence').click();
      await expect(
        page
          .getByText(
            `${c.direction}: ${c.expected === 'permitted' ? 'passed' : 'denied'}`,
            { exact: true },
          )
          .first(),
      ).toBeVisible();
    }
    assert.equal(view.readiness.state, 'ready', JSON.stringify(view.readiness));
    await button('Reload evidence').click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      if (tenant.id === metadata.tenants[0].id && width !== 768)
        await page
          .getByRole('region', { name: 'Verified tenant routing', exact: true })
          .screenshot({ path: `${screenshots}/routing-${width}.png` });
    }
    await button('Revoke selected grant').click();
    await expect(page.getByText('Incomplete', { exact: true })).toBeVisible();
    assert.equal((await direct(b, path)).data.readiness.state, 'incomplete');
  }
  // Test-only stopped preparation in the exact disposable browser database.
  assert.match(database, /^myims_session_[a-f0-9]{12}$/);
  const unavailableCase = metadata.cases
    .filter((c) => c.tenantId === metadata.tenants[1].id)
    .at(-1);
  const preparationId = randomUUID();
  await owner.query(
    'INSERT INTO public.tenant_call_preparations(id,node_id,installation_id,operator_id,authentication_version,fingerprint,definition) SELECT $1,$2,$3,id,authentication_version,$4,$5 FROM public.platform_operators WHERE id=$6',
    [
      preparationId,
      nodeId,
      installationId,
      '0'.repeat(64),
      { fixture: 'stopped-browser-preparation' },
      operatorId,
    ],
  );
  await owner.query(
    'INSERT INTO public.tenant_call_preparation_cases(preparation_id,case_id) VALUES($1,$2)',
    [preparationId, unavailableCase.id],
  );
  const grantTimes = (
    await owner.query(
      'SELECT id,created_at,expires_at FROM public.tenant_verification_grants WHERE node_id=$1 ORDER BY id',
      [nodeId],
    )
  ).rows;
  await button('Reload evidence').click();
  await expect(
    page.getByText(/Some controlled cases are unavailable:/),
  ).toBeVisible();
  const casesControl = page.getByLabel(/^Controlled call case/);
  await expect(casesControl).toHaveValue(unavailableCase.id);
  await expect(
    casesControl.locator(`option[value="${unavailableCase.id}"]`),
  ).toBeDisabled();
  await expect(button('Reload evidence')).toBeEnabled();
  await expect(button('Run controlled call test')).toBeDisabled();
  const unavailablePath = `/platform/tenants/${metadata.tenants[1].id}/telephony/${nodeId}`;
  const unavailableView = await direct(b, unavailablePath);
  assert.equal(unavailableView.status, 200);
  assert.equal(
    unavailableView.data.cases.find((c) => c.id === unavailableCase.id)
      .available,
    false,
  );
  assert.equal(
    (
      await direct(a, unavailablePath + '/grant', 'POST', {
        requestId: randomUUID(),
        artifactId: applied,
        caseIds: [unavailableCase.id],
      })
    ).status,
    409,
  );
  await casesControl.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(casesControl).toBeFocused();
  assert.notEqual(await casesControl.inputValue(), unavailableCase.id);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width !== 768)
      await page
        .getByRole('region', { name: 'Verified tenant routing', exact: true })
        .screenshot({
          path: `${screenshots}/preparation-unavailable-${width}.png`,
        });
  }
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  assert.deepEqual(
    (
      await owner.query(
        'SELECT id,created_at,expires_at FROM public.tenant_verification_grants WHERE node_id=$1 ORDER BY id',
        [nodeId],
      )
    ).rows,
    grantTimes,
  );
  console.log(
    'PASS persistent preparation actual HTTPS: unavailable case remains visible with truthful blocker, selected intent survives read, disabled option/action, backend grant denial, keyboard, axe and 320/768/1440 reflow; reads renew no grants',
  );
  const disabledCaseId = await casesControl.inputValue();
  assert.ok(disabledCaseId && disabledCaseId !== unavailableCase.id);
  await owner.query(
    'INSERT INTO public.tenant_call_preparation_cases(preparation_id,case_id) VALUES($1,$2)',
    [preparationId, disabledCaseId],
  );
  await owner.query(
    'INSERT INTO public.tenant_route_case_disables(case_id,request_id,preparation_id) VALUES($1,$2,$3)',
    [disabledCaseId, randomUUID(), preparationId],
  );
  await button('Reload evidence').click();
  await expect(
    casesControl.locator(`option[value="${disabledCaseId}"]`),
  ).toHaveCount(0);
  await expect(button('Reload evidence')).toBeEnabled();
  await expect(casesControl).toBeVisible();
  await expect(
    casesControl.locator(`option[value="${unavailableCase.id}"]`),
  ).toHaveCount(1);
  await expect(button('Run controlled call test')).toBeDisabled();
  assert.ok(
    !(await direct(b, unavailablePath)).data.cases.some(
      (c) => c.id === disabledCaseId,
    ),
  );
  assert.deepEqual(
    (
      await owner.query(
        'SELECT id,created_at,expires_at FROM public.tenant_verification_grants WHERE node_id=$1 ORDER BY id',
        [nodeId],
      )
    ).rows,
    grantTimes,
  );
  console.log(
    'PASS terminal case disable HTTPS: selected case disappears, retained selection cannot enable another call and reads renew no grant',
  );
  const disabled = await direct(
    a,
    `/platform/pbx-nodes/${nodeId}/extensions/${metadata.extensions[0].id}/status`,
    'PATCH',
    {
      expectedVersion: metadata.extensions[0].version,
      administrativeStatus: 'disabled',
    },
  );
  assert.equal(disabled.status, 200, JSON.stringify(disabled));
  await page.goto(config.origin + `/pbx-nodes/${nodeId}/revisions`);
  await expect(page.getByText('Loading history…', { exact: true })).toHaveCount(
    0,
  );
  await page.waitForLoadState('networkidle');
  await button('Capture desired state').click();
  await expect(button('Validate offline')).toBeEnabled();
  await button('Validate offline').click();
  await expect(page.getByText(/Local validation: passed/)).toBeVisible();
  await page
    .getByRole('checkbox', { name: /I reviewed the runtime comparison/ })
    .check();
  await button('Apply reviewed revision').click();
  await expect(page.getByText(/^Operation .*: verified\./)).toBeVisible({
    timeout: 90000,
  });
  const replacement = (await direct(b, live)).data.verifiedId;
  assert.notEqual(replacement, applied);
  await button('Reload retirement and runtime').click();
  await page
    .getByRole('combobox', { name: /^Superseded artifact/ })
    .selectOption(applied);
  await page
    .getByRole('combobox', { name: /^Extension removed from runtime/ })
    .selectOption(metadata.extensions[0].id);
  await expect(button('Request exact artifact retirement')).toBeDisabled();
  await page
    .getByRole('checkbox', { name: /I reviewed the replacement artifact/ })
    .check();
  const retirePath = `/platform/pbx-nodes/${nodeId}/artifact-retirements`;
  const retirementGate = holdResponse('POST', retirePath);
  await button('Request exact artifact retirement').click();
  await retirementGate.reached;
  await expect(button('Retry access')).toBeEnabled({
    timeout: 15000,
  });
  retirementGate.release();
  await delay(1100);
  await button('Retry access').click();
  await expect(button('Recover exact retirement intent')).toBeEnabled();
  await button('Recover exact retirement intent').click();
  const retirementRegion = page.getByRole('region', {
    name: 'Superseded artifact retirement',
    exact: true,
  });
  const retirementDeadline = Date.now() + 30000;
  let retired = false;
  while (Date.now() < retirementDeadline) {
    const value = (await direct(b, retirePath)).data;
    if (
      value.items?.some(
        (i) => i.artifactId === applied && i.state === 'retired',
      )
    ) {
      retired = true;
      break;
    }
    await delay(150);
  }
  assert.ok(
    retired,
    'Actual native retirement must finish before release UI is claimed',
  );
  await button('Reload retirement and runtime').click();
  await expect(
    retirementRegion.getByText('retired', { exact: true }),
  ).toBeVisible();
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::integer AS n FROM public.pbx_artifact_retirement_intents WHERE node_id=$1 AND artifact_id=$2',
        [nodeId, applied],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await direct(a, live + '/recover', 'POST', {
        requestId: randomUUID(),
        targetId: applied,
        expectedBaselineId: replacement,
      })
    ).status,
    409,
  );
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  await page.setViewportSize({ width: 320, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await retirementRegion.screenshot({
    path: `${screenshots}/retirement-320.png`,
  });
  await page.getByLabel('Verified recovery target').selectOption(baseline);
  await button('Recover selected artifact').click();
  await expect(page.getByText(/^Operation .*: recovered\./)).toBeVisible({
    timeout: 90000,
  });
  assert.equal((await direct(b, live)).data.verifiedId, baseline);
  console.log(
    'PASS tenant-routing actual HTTPS: reviewed tenant-aware capture/validation/apply; two draft tenants, explicit grants and actual inbound/outbound plus forbidden SIP calls through mounted UI; exact provenance/readiness/revocation, wrong plane/CSRF/opaque-input rejection, axe/reflow and reviewed initial-baseline recovery; synthetic endpoint material only ' +
      JSON.stringify({
        nodeId,
        installationId,
        artifactId: applied,
        tenants: metadata.tenants.map((t) => t.id),
      }),
  );
}
