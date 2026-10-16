// Actual production HTTPS browser + HTTP A/B + PostgreSQL/Redis/provider + private Asterisk.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, readdir, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sipRegistration } from './check-pbx-observation.mjs';
const expect = baseExpect.configure({ timeout: 20000 });
export async function checkInventoryBrowser({
  page,
  context,
  config,
  owner,
  login,
  expire,
  select,
  a,
  b,
  username,
  redis,
  key,
  holdResponse,
  issue,
  staffFacts,
  fixture,
}) {
  const requests = [],
    urls = [];
  const outputs = [];
  console.log('CHECK P3-U2c browser: inventory/profile/bulk journeys');
  page.on('request', (r) => {
    urls.push(r.url());
    if (
      r.method() !== 'GET' &&
      new URL(r.url()).pathname.includes('/extensions')
    )
      requests.push({
        path: new URL(r.url()).pathname,
        body: r.postDataJSON(),
      });
  });
  async function request(path, method = 'GET', body, extra = {}) {
    const result = await page.evaluate(
      async ({ path, method, body, extra }) => {
        const session =
          method === 'GET'
            ? null
            : await (await fetch('/platform/auth/session')).json();
        const r = await fetch(path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { 'X-Platform-CSRF': session.proof } : {}),
            ...extra,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return {
          status: r.status,
          cache: r.headers.get('cache-control'),
          data: await r.json(),
        };
      },
      { path, method, body, extra },
    );
    outputs.push(JSON.stringify(result));
    return result;
  }
  async function until(action, label, ms = 40000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await action()) return;
      await delay(500);
    }
    throw new Error(`Inventory deadline: ${label}`);
  }
  async function review() {
    const button = page.getByRole('button', {
      name: 'Reload list for explicit review',
      exact: true,
    });
    if (await button.count()) {
      await button.click();
      await expect(button).toHaveCount(0);
    }
  }
  const root = '/platform/pbx-nodes';
  const target = fixture.catalog[0];
  const createNode = await request(root, 'POST', {
    requestId: randomUUID(),
    displayName: 'Inventory acceptance PBX',
    management: {
      targetAlias: target.targetAlias,
      transport: target.transport,
      port: target.port,
    },
    credentialAlias: target.credentialAliases[0],
  });
  assert.equal(createNode.status, 201, JSON.stringify(createNode));
  const node = createNode.data.node,
    base = `${root}/${node.id}`;
  console.log(
    JSON.stringify({
      check: 'p3-u2c-target',
      nodeId: node.id,
      installationId: node.installationId,
      targetAlias: target.targetAlias,
    }),
  );
  // Trusted fixture declaration, not inferred Asterisk profile capability or deployment proof.
  await owner.query(
    "INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media,credential_auth_max,credential_hex_max) VALUES($1,1,ARRAY['sip','webrtc'],ARRAY['udp','wss'],ARRAY['opus','ulaw','alaw'],ARRAY['none','dtls-srtp'],71,64)",
    [node.installationId],
  );
  await page.goto(`${config.origin}/pbx-nodes/${node.id}/inventory`);
  await expect(
    page.getByText('No extensions on this page', { exact: true }),
  ).toBeVisible();
  await page.locator('#profile-name').fill('SIP acceptance profile');
  await page
    .getByRole('button', { name: 'Create endpoint profile', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  await page.getByRole('button', { name: 'New profile', exact: true }).click();
  await page.locator('#profile-template').selectOption('webrtc-basic');
  await page.locator('#profile-name').fill('WebRTC acceptance profile');
  await page
    .getByRole('button', { name: 'Create endpoint profile', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  const profiles = (await request(`${base}/endpoint-profiles`)).data.items;
  const sip = profiles.find((p) => p.kind === 'sip'),
    web = profiles.find((p) => p.kind === 'webrtc');
  assert.ok(sip && web);
  async function single(number, profile) {
    await review();
    await page.locator('#inventory-profile').selectOption(profile.id);
    await page.locator('#inventory-number').fill(number);
    await page
      .getByRole('button', { name: 'Create individual extension', exact: true })
      .click();
    await expect(page.getByText(/Saved desired result:/)).toBeVisible();
    await review();
  }
  await single('6101', sip);
  await single('6102', web);
  await page.locator('#inventory-profile').selectOption(sip.id);
  await page.locator('#bulk-numbers').fill('6104, 6103');
  await page
    .getByRole('button', { name: 'Preview bulk creation', exact: true })
    .click();
  await expect(
    page.getByText('Canonical numbers: 6103, 6104', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Commit reviewed bulk intent', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  // Real collision rejection retains input and commits no partial rows.
  await page.locator('#bulk-numbers').fill('6101,6105');
  await page
    .getByRole('button', { name: 'Preview bulk creation', exact: true })
    .click();
  await expect(page.getByText(/number_conflict/)).toBeVisible();
  await expect(page.locator('#bulk-numbers')).toHaveValue('6101,6105');
  assert.equal((await request(`${base}/extensions`)).data.items.length, 4);
  // Real range review and lost bulk-commit response resolve to one immutable receipt.
  await page.locator('#bulk-mode').selectOption('range');
  await page.locator('#range-start').fill('6106');
  await page.locator('#range-end').fill('6107');
  await page
    .getByRole('button', { name: 'Preview bulk creation', exact: true })
    .click();
  await expect(
    page.getByText('Canonical numbers: 6106, 6107', { exact: true }),
  ).toBeVisible();
  const bulkPath = `${base}/extensions/bulk`,
    bulkGate = holdResponse('POST', bulkPath);
  await page
    .getByRole('button', { name: 'Commit reviewed bulk intent', exact: true })
    .click();
  assert.equal(await bulkGate.reached, 201);
  await expect(
    page.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible();
  bulkGate.release();
  await delay(1100);
  await page.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Retry same inventory intent',
      exact: true,
    }),
  ).toBeVisible();
  const beforeBulkRetry = requests.length;
  await delay(200);
  assert.equal(requests.length, beforeBulkRetry);
  select(b);
  await page
    .getByRole('button', { name: 'Retry same inventory intent', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  const bulkAttempts = requests.filter((r) => r.path === bulkPath);
  assert.deepEqual(bulkAttempts.at(-1).body, bulkAttempts.at(-2).body);
  const changed = await request(bulkPath, 'POST', {
    ...bulkAttempts.at(-1).body,
    numbers: ['6106', '6108'],
  });
  assert.equal(changed.status, 409);
  assert.equal(changed.data.reason, 'request_conflict');
  await review();
  // A valid preview is advisory: another real API write wins before commit.
  await page.locator('#range-start').fill('6110');
  await page.locator('#range-end').fill('6111');
  await page
    .getByRole('button', { name: 'Preview bulk creation', exact: true })
    .click();
  await expect(
    page.getByText('Canonical numbers: 6110, 6111', { exact: true }),
  ).toBeVisible();
  const previewDependencies = {
    profileId: sip.id,
    profileVersion: sip.version,
    expectedProfileHead: sip.headVersion,
    expectedNodeVersion: node.version,
    expectedCapabilityRevision: 1,
    kind: 'sip',
  };
  assert.equal(
    (
      await request(`${base}/extensions`, 'POST', {
        ...previewDependencies,
        number: '6110',
        requestId: randomUUID(),
      })
    ).status,
    201,
  );
  await page
    .getByRole('button', { name: 'Commit reviewed bulk intent', exact: true })
    .click();
  await expect(page.getByText(/number conflict/)).toBeVisible();
  await expect(page.locator('#range-start')).toHaveValue('6110');
  await expect(page.locator('#range-end')).toHaveValue('6111');
  assert.ok(
    !(await request(`${base}/extensions`)).data.items.some(
      (r) => r.number === '6111',
    ),
    'Bulk conflict must not commit a noncolliding subset',
  );
  await review();
  await page
    .getByRole('button', {
      name: 'Review profile SIP acceptance profile',
      exact: true,
    })
    .click();
  await page.locator('#profile-contacts').fill('2');
  await page
    .getByRole('button', { name: 'Save new profile version', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  let extensions = (await request(`${base}/extensions`)).data.items;
  assert.ok(
    extensions.every((e) => e.profile.version === 1),
    'Profile versioning must not change existing selections',
  );
  const e = extensions.find((e) => e.number === '6101');
  await page
    .getByRole('button', { name: 'Inspect extension 6101', exact: true })
    .click();
  const detail = page.getByRole('region', {
    name: 'Extension 6101 details',
    exact: true,
  });
  await expect(detail).toBeVisible();
  await page.locator('#adoption-profile').selectOption(sip.id);
  await page
    .getByRole('button', {
      name: 'Adopt selected profile version',
      exact: true,
    })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  await expect(
    detail.getByText(`${sip.id} / 2`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Re-enable desired extension', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Disable desired extension', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  // Real stale edit: another API action advances the canonical version first.
  await page.waitForLoadState('networkidle');
  await page.locator('#inventory-number').fill('6189');
  const beforeStale = (await request(`${base}/extensions/${e.id}`)).data
    .extension;
  assert.equal(
    (
      await request(`${base}/extensions/${e.id}/status`, 'PATCH', {
        expectedVersion: beforeStale.version,
        administrativeStatus: 'enabled',
      })
    ).status,
    200,
  );
  await page
    .getByRole('button', { name: 'Re-enable desired extension', exact: true })
    .click();
  await expect(page.getByText(/stale version/)).toBeVisible();
  await expect(page.locator('#inventory-number')).toHaveValue('6189');
  await review();
  await page
    .getByRole('button', { name: 'Disable desired extension', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  console.log('CHECK P3-U2c browser: real credential lifecycle');
  async function executeProvider(action = 'queue', extra = {}) {
    let operation = (await request(`${base}/extensions/${e.id}/credentials`))
      .data.activeOperation;
    if (!operation && action === 'scan') {
      const row = (
        await owner.query(
          'SELECT id FROM public.endpoint_credential_operations WHERE extension_id=$1 ORDER BY created_at LIMIT 1',
          [e.id],
        )
      ).rows[0];
      operation = { operationId: row.id };
    }
    assert.ok(operation);
    const controlId = randomUUID(),
      directory = '/tmp/myims-endpoint-responses',
      file = `${directory}/${controlId}.json`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const database = (await owner.query('SELECT current_database() AS name'))
      .rows[0].name;
    console.log(
      `ENDPOINT_FIXTURE_REQUEST ${JSON.stringify({ database, operationId: operation.operationId, action, controlId, ...extra })}`,
    );
    let result;
    await until(
      async () => {
        try {
          result = JSON.parse(await readFile(file, 'utf8'));
          return true;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          return false;
        }
      },
      'real provider worker',
      65000,
    );
    await rm(file);
    if (action !== 'scan')
      assert.equal(result.state, 'associated', JSON.stringify(result));
    return action === 'scan' ? result : operation;
  }
  await page
    .getByRole('button', { name: 'Set up desired credentials', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  await executeProvider();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Reload safe credential status', exact: true })
    .click();
  await expect(
    page.getByText(/Desired credential status: configured/),
  ).toBeVisible();
  // Controlled lost reply after real backend acceptance; retry keeps exact body/intent.
  const resetPath = `${base}/extensions/${e.id}/credentials/reset`;
  const gate = holdResponse('POST', resetPath);
  await page
    .getByRole('button', { name: 'Reset desired credentials', exact: true })
    .click();
  assert.equal(await gate.reached, 202);
  await expect(
    page.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  gate.release();
  await delay(1100); // Honor the established one-second Retry-After boundary.
  await page.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Retry same inventory intent',
      exact: true,
    }),
  ).toBeVisible();
  const beforeReset = requests.filter((r) => r.path === resetPath).length;
  await delay(500);
  assert.equal(
    requests.filter((r) => r.path === resetPath).length,
    beforeReset,
  );
  select(b);
  await page
    .getByRole('button', { name: 'Retry same inventory intent', exact: true })
    .click();
  await expect(page.getByText(/Saved desired result:/)).toBeVisible();
  const resetRequests = requests.filter((r) => r.path === resetPath);
  assert.deepEqual(resetRequests.at(-1).body, resetRequests.at(-2).body);
  await executeProvider();
  await review();
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  await page.waitForLoadState('networkidle');
  // Deterministic delayed-detail regression: a passive read must preserve newer input.
  const detailGate = holdResponse('GET', `${base}/extensions/${e.id}`);
  await page
    .getByRole('button', {
      name: 'Reload and review selected extension',
      exact: true,
    })
    .click();
  assert.equal(await detailGate.reached, 200);
  await page.locator('#inventory-number').fill('6199');
  detailGate.release();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Loaded extension 6101, version/)).toBeVisible();
  await expect(page.locator('#inventory-number')).toHaveValue('6199');
  // Same operator mounted expiry recovery; no mutation replay and no durable browser work.
  const beforeExpiry = requests.length;
  await expire('idle');
  await page
    .getByRole('button', { name: 'Reload inventory', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await login(page, username);
  await expect(page.locator('#inventory-number')).toBeVisible();
  await expect(page.locator('#inventory-number')).toHaveValue('6199');
  assert.equal(requests.length, beforeExpiry);
  assert.equal(
    await page.evaluate(
      () => globalThis.localStorage.length + globalThis.sessionStorage.length,
    ),
    0,
  );
  await expire('absolute');
  await page
    .getByRole('button', { name: 'Reload inventory', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await login(page, `${username}.second`);
  await expect(page.locator('#inventory-number')).toBeVisible();
  await expect(page.locator('#inventory-number')).toHaveValue('');
  assert.equal(
    requests.length,
    beforeExpiry,
    'Foreign recovery must not replay prior inventory work',
  );
  await page.locator('#inventory-number').fill('6188');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await login(page, username);
  await expect(
    page.getByRole('heading', { name: 'Platform console', exact: true }),
  ).toBeVisible();
  await page.goto(`${config.origin}/pbx-nodes/${node.id}/inventory`);
  await expect(page.locator('#inventory-number')).toHaveValue('');
  console.log(
    'PASS P3-U2c actual mounted recovery: idle same owner retains input, absolute expiry foreign owner clears input, confirmed logout clears work; no automatic mutation replay or browser storage.',
  );
  console.log('CHECK P3-U2c browser: real controlled Asterisk observation');
  // Actual live observations, installed only after all desired-save boundary checks.
  const observer = await fixture.start();
  await observer.call('start');
  let registered = false,
    stopped = false;
  const rows = [e, extensions.find((row) => row.number === '6103')];
  const suffix = (id) =>
    `${node.installationId.replaceAll('-', '')}-${id.replaceAll('-', '')}`;
  const access = {
    ...fixture.access,
    fixtureName: `ims-e-${suffix(e.id)}`,
    fixtureAor: `ims-r-${suffix(e.id)}`,
  };
  try {
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return (
        r.data.extension.observation.kind === 'observed' &&
        r.data.extension.observation.registration === 'endpoint_absent'
      );
    }, 'fresh covered saved endpoint absence');
    console.log(
      `INVENTORY_PBX_INSTALL ${JSON.stringify(rows.map((r) => ({ id: r.id })))}`,
    );
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return r.data.extension.observation.registration === 'unregistered';
    }, 'real endpoint-present unregistered');
    await sipRegistration(access, 120);
    registered = true;
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return r.data.extension.observation.registration === 'registered';
    }, 'actual SIP REGISTER exact mapping');
    await page
      .getByRole('button', { name: 'Reload inventory', exact: true })
      .click();
    await expect(
      page.getByText('Registration: registered', { exact: true }),
    ).toBeVisible();
    const observed = await request(`${base}/extensions`);
    const mapped = observed.data.items.find((row) => row.id === e.id);
    assert.equal(mapped.administrativeStatus, 'disabled');
    assert.equal(mapped.eligibility.eligible, false);
    assert.ok(mapped.eligibility.reasons.includes('unallocated'));
    assert.equal(mapped.readiness.kind, 'not_established');
    assert.equal(mapped.credentials.kind, 'configured');
    assert.ok(
      !JSON.stringify(observed).includes('ims-e-'),
      'Generated keys excluded from inventory transport',
    );
    assert.equal(
      observed.data.items.find((r) => r.number === '6102').observation
        .registration,
      'endpoint_absent',
    );
    await sipRegistration(access, 0);
    registered = false;
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return (
        r.data.extension.observation.registration === 'unregistered' &&
        r.data.extension.observation.contacts === 0
      );
    }, 'actual expiry-zero empty dynamic contacts');
    console.log(
      'PASS P3-U2c actual Asterisk: exact node/installation SIP dynamic REGISTER, expiry-zero, endpoint presence/absence and unmanaged exclusion. No profile/credential installation, WebRTC media or calling claim.',
    );
    console.log('INVENTORY_PBX_STOP');
    stopped = true;
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return r.data.extension.observation.connection === 'disconnected';
    }, 'real controlled PBX outage');
    await page
      .getByRole('button', { name: 'New profile', exact: true })
      .click();
    await page.locator('#profile-name').fill('PBX outage desired profile');
    await page
      .getByRole('button', { name: 'Create endpoint profile', exact: true })
      .click();
    await expect(page.getByText(/Saved desired result:/)).toBeVisible();
    await review();
    console.log('INVENTORY_PBX_START');
    stopped = false;
    await until(async () => {
      const r = await request(`${base}/extensions/${e.id}`);
      return r.data.extension.observation.freshness === 'current';
    }, 'real restart reconciliation');
    // Injected projection faults on disposable DB, never represented as live Asterisk observations.
    const fresh = (
      await owner.query(
        'SELECT * FROM public.pbx_observations WHERE node_id=$1',
        [node.id],
      )
    ).rows[0];
    await observer.call('stop');
    const injectedOwner = await owner.query(
      "UPDATE public.pbx_ownership SET incarnation=$2,epoch=epoch+1,desired_version=$3,expires_at=clock_timestamp()+interval '120 seconds' WHERE node_id=$1 RETURNING epoch",
      [node.id, randomUUID(), fresh.desired_version],
    );
    fresh.epoch = injectedOwner.rows[0].epoch;
    for (const sql of [
      "coverage='unknown'",
      "last_success_at=clock_timestamp()-interval '31 seconds'",
      'desired_version=desired_version+1',
      'epoch=epoch-1',
      "reconciliation='reconciling'",
      "connection='disconnected'",
    ]) {
      await owner.query(
        'UPDATE public.pbx_observations SET coverage=$2,last_success_at=$3,desired_version=$4,reconciliation=$5,connection=$6,epoch=$7,failure=NULL WHERE node_id=$1',
        [
          node.id,
          fresh.coverage,
          new Date(),
          fresh.desired_version,
          fresh.reconciliation,
          fresh.connection,
          fresh.epoch,
        ],
      );
      assert.equal(
        (await request(`${base}/extensions/${e.id}`)).data.extension.observation
          .registration,
        'unregistered',
        'Injected baseline must qualify before each isolated fault',
      );
      await owner.query(
        `UPDATE public.pbx_observations SET ${sql} WHERE node_id=$1`,
        [node.id],
      );
      assert.equal(
        (await request(`${base}/extensions/${e.id}`)).data.extension.observation
          .registration,
        'unknown',
      );
    }
    await owner.query(
      "UPDATE public.pbx_ownership SET incarnation=NULL,expires_at='-infinity' WHERE node_id=$1",
      [node.id],
    );
    console.log(
      'PASS P3-U2c injected projection faults: unsupported coverage, stale age, old desired version, reconciling and disconnected remain unknown.',
    );
    await page
      .getByRole('button', { name: 'Reload inventory', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Inspect extension 6101', exact: true })
      .click();
    for (const [width, height] of [
      [1440, 1000],
      [768, 1024],
      [390, 844],
      [320, 900],
    ]) {
      await page.setViewportSize({ width, height });
      assert.ok(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        `Inventory reflow ${width}`,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => v.id),
        [],
        `Inventory accessibility ${width}`,
      );
    }
    await page.evaluate(() => {
      globalThis.document.documentElement.style.zoom = '2';
    });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      'Inventory 200% CSS zoom reflow',
    );
    await page.evaluate(() => {
      globalThis.document.documentElement.style.zoom = '';
    });
    await page.locator('#inventory-profile').selectOption(sip.id);
    await page.locator('#inventory-number').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => globalThis.document.activeElement?.tagName),
      'BUTTON',
    );
    for (const replica of [a, b]) {
      select(replica);
      assert.equal((await request(`${base}/extensions`)).status, 200);
      assert.equal((await request(`${base}/extensions`)).cache, 'no-store');
    }
    const token = (await context.cookies()).find(
      (c) => c.name === '__Host-myims-platform',
    ).value;
    const passive = await redis.get(key(token));
    await request(`${base}/extensions`);
    await request(`${base}/endpoint-profiles`);
    assert.equal(await redis.get(key(token)), passive);
    assert.equal(
      (
        await request(`${base}/extensions`, 'POST', {
          requestId: randomUUID(),
          tenantId: randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(`${base}/extensions?tenantId=forged`)).status,
      400,
    );
    const currentExtension = (await request(`${base}/extensions/${e.id}`)).data
      .extension;
    assert.equal(
      (
        await request(
          `${base}/extensions/${e.id}/status`,
          'PATCH',
          {
            expectedVersion: currentExtension.version,
            administrativeStatus: 'enabled',
          },
          { 'X-Platform-CSRF': '' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(`${base}/extensions`, 'GET', undefined, {
          Authorization: 'Bearer forged',
        })
      ).status,
      403,
    );
    // Real authority on both independent backend graphs, including tenant-cookie denial.
    const staffSession = await issue(a, staffFacts);
    for (const replica of [a, b]) {
      const headers = {
        Origin: config.origin,
        'X-Platform-Proxy': config.proxySecret,
        'X-Forwarded-For': '::1',
        'Sec-Fetch-Site': 'same-origin',
      };
      const anonymous = await context.request.get(
        `${replica.url}${base}/extensions`,
        { headers: { ...headers, Cookie: '' } },
      );
      assert.equal(anonymous.status(), 401);
      const staff = await context.request.get(
        `${replica.url}${base}/extensions`,
        {
          headers: {
            ...headers,
            Cookie: `__Host-myims-platform=${staffSession.token}`,
          },
        },
      );
      assert.equal(staff.status(), 403);
      const forged = await context.request.get(
        `${replica.url}${base}/extensions`,
        {
          headers: {
            ...headers,
            Cookie: '',
            Authorization: `Bearer ${staffSession.token}`,
          },
        },
      );
      assert.equal(forged.status(), 401);
    }
    // Real isolated shared-session Redis outage: both HTTP replicas fail closed.
    const auth = (await request('/platform/auth/session')).data;
    const cookie = (await context.cookies()).find(
      (c) => c.name === '__Host-myims-platform',
    ).value;
    const protectedHeaders = {
      Origin: config.origin,
      'X-Platform-Proxy': config.proxySecret,
      'X-Forwarded-For': '::1',
      'X-Platform-CSRF': auth.proof,
      Cookie: `__Host-myims-platform=${cookie}`,
    };
    const countBeforeOutage = requests.length;
    console.log('INVENTORY_SESSION_STOP');
    try {
      await until(
        async () =>
          (
            await context.request.get(`${a.url}${base}/extensions`, {
              headers: protectedHeaders,
            })
          ).status() === 503,
        'real shared Redis unavailable',
      );
      for (const replica of [a, b]) {
        assert.equal(
          (
            await context.request.get(`${replica.url}${base}/extensions`, {
              headers: protectedHeaders,
            })
          ).status(),
          503,
        );
        assert.equal(
          (
            await context.request.patch(
              `${replica.url}${base}/extensions/${e.id}/status`,
              {
                headers: protectedHeaders,
                data: {
                  expectedVersion: currentExtension.version,
                  administrativeStatus: 'enabled',
                },
              },
            )
          ).status(),
          503,
        );
      }
      select(a);
      await page
        .getByRole('button', { name: 'Reload inventory', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Retry access', exact: true }),
      ).toBeVisible();
      await expect(page.locator('#inventory-number')).not.toBeVisible();
    } finally {
      console.log('INVENTORY_SESSION_START');
    }
    await until(
      async () =>
        (
          await context.request.get(`${a.url}/platform/auth/session`, {
            headers: protectedHeaders,
          })
        ).status() === 200,
      'shared Redis restored',
    );
    if (!redis.isOpen) await redis.connect();
    await redis.ping(); // Reconnect only the non-shipping fixture inspection client.
    await delay(1100);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(page.locator('#inventory-number')).toBeVisible();
    assert.equal(requests.length, countBeforeOutage);
    console.log(
      'PASS P3-U2c real isolated shared-session Redis stop/start: HTTP A/B protected reads/writes fail closed; browser hides values and restores without replay.',
    );
    const staticRoot =
      'apps/platform-console-web/.local/platform-auth-next/static';
    const bundleParts = [];
    for (const name of await readdir(staticRoot, { recursive: true })) {
      const file = `${staticRoot}/${name}`;
      if ((await stat(file)).isFile())
        bundleParts.push(await readFile(file, 'utf8'));
    }
    const scan = await executeProvider('scan', {
      httpOutput:
        bundleParts.join('') +
        JSON.stringify(urls) +
        outputs.join('') +
        (await page.content()) +
        JSON.stringify(requests) +
        JSON.stringify(
          await page.evaluate(() => ({
            local: globalThis.localStorage,
            session: globalThis.sessionStorage,
          })),
        ),
    });
    assert.equal(scan.materialExcluded, true);
    assert.equal(scan.scanned, 2);
    // Injected canonical fixture revocation, observed through actual HTTP A/B.
    const operator = (await request('/platform/auth/session')).data.operatorId;
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [operator],
    );
    for (const replica of [a, b])
      assert.ok(
        [401, 403].includes(
          (
            await context.request.get(`${replica.url}${base}/extensions`, {
              headers: protectedHeaders,
            })
          ).status(),
        ),
      );
    await page
      .getByRole('button', { name: 'Reload inventory', exact: true })
      .click();
    await expect(page.locator('#inventory-number')).not.toBeVisible();
    console.log(
      'PASS P3-U2c injected canonical operator disable/version change: actual HTTP A/B deny retained cookie and browser hides protected inventory.',
    );
    console.log(
      'PASS P3-U2c real HTTPS browser: SIP/WebRTC creation, bulk review/atomic commit/collision, profile version/adoption, desired edits/disable/re-enable, real provider setup/reset and explicit same-intent lost-response retry, mounted same-owner expiry, passive A/B reads, responsive 1440/768/390/320 and axe/keyboard checks.',
    );
  } finally {
    if (stopped) console.log('INVENTORY_PBX_START');
    if (registered) await sipRegistration(access, 0);
    await observer.call('stop');
  }
}
