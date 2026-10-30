import { setTimeout as delay } from 'node:timers/promises';
import { checkAllocationBounds } from './check-allocation-bounds.mjs';
import { checkAllocationRaces } from './check-allocation-races.mjs';
// Real PostgreSQL/runtime grants, shared Redis, two Nest replicas and production HTTPS.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
async function runTenantAllocation({
  username,
  allocationDependencies,
  expire,
  login,
  holdResponse,
  issue,
  staffFacts,
  request,
  direct,
  nodeId,
  otherNode,
  installation,
  owner,
  session,
  page,
  config,
  a,
  b,
  ingress,
  select,
}) {
  const root = `/platform/pbx-nodes/${nodeId}`;
  const created = [];
  async function tenant(status = 'draft') {
    const r = await request('/platform/tenants', 'POST', {
      requestId: randomUUID(),
      tenantCode: 'alloc-' + randomUUID().slice(0, 8),
      displayName: 'Allocation fixture ' + status,
      administratorUsername: 'admin',
    });
    assert.equal(r.status, 201, JSON.stringify(r));
    const t = r.data.tenant;
    created.push(t.id);
    if (status !== 'draft')
      await owner.query(
        'UPDATE public.tenants SET status=$2,version=version+1,authority_version=authority_version+1,updated_at=clock_timestamp() WHERE id=$1',
        [t.id, status],
      );
    return (await request(`/platform/tenants/${t.id}`)).data.tenant;
  }
  const one = await tenant(),
    two = await tenant('active'),
    suspended = await tenant('suspended'),
    retired = await tenant('retired');
  const path = (t = one, n = nodeId, suffix = '') =>
    `/platform/tenants/${t.id}/allocations/${n}${suffix ? '/' + suffix : ''}`;
  await owner.query(
    `INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])`,
    [installation],
  );
  const profile = await request(root + '/endpoint-profiles', 'POST', {
    requestId: randomUUID(),
    name: 'Allocation stock',
    template: 'sip-basic',
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  assert.equal(profile.status, 201, JSON.stringify(profile));
  const deps = {
    profileId: profile.data.profile.id,
    profileVersion: 1,
    expectedProfileHead: 1,
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  };
  const bulk = await request(root + '/extensions/bulk', 'POST', {
    requestId: randomUUID(),
    kind: 'sip',
    range: { start: '6100', end: '6149' },
    ...deps,
  });
  assert.equal(bulk.status, 201, JSON.stringify(bulk));
  const extras = await request(root + '/extensions/bulk', 'POST', {
    requestId: randomUUID(),
    kind: 'sip',
    range: { start: '6200', end: '6249' },
    ...deps,
  });
  assert.equal(extras.status, 201, JSON.stringify(extras));
  const all = [...bulk.data.items, ...extras.data.items];
  const ext = (number) => all.find((e) => e.number === number);
  const preview = async (t, start, end = start) => {
    const r = await request(path(t, nodeId, 'preview'), 'POST', {
      selection: { range: { start, end } },
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data;
  };
  const save = (t, stock, state = 'reserved') => ({
    requestId: randomUUID(),
    expectedTenantVersion: t.version,
    expectedAuthorityVersion: t.authorityVersion,
    state,
    items: stock.map((e) => ({
      extensionId: e.id,
      expectedVersion: e.version,
    })),
  });
  const change = (t, c) => ({
    requestId: randomUUID(),
    expectedTenantVersion: t.version,
    expectedAuthorityVersion: t.authorityVersion,
    expectedVersion: c.version,
  });
  console.log(
    'CHECK allocation: exact bounded stock, gaps, disabled, malformed/authority and active expansion',
  );
  assert.equal((await preview(one, '6100', '6149')).items.length, 50);
  const gap = await preview(one, '6099', '6101');
  assert.equal(gap.items[0].missing, true);
  assert.equal(gap.canSave, false);
  for (const selection of [
    { range: { start: '6100', end: '6150' } },
    { range: { start: '01000', end: '01001' } },
    { extensionIds: [ext('6100').id, ext('6100').id] },
    { range: { start: '6101', end: '6100' } },
    { range: { start: '6100', end: '6101' }, extensionIds: [] },
    { extensionIds: [] },
    { extensionIds: [randomUUID()] },
  ]) {
    const r = await request(path(one, nodeId, 'preview'), 'POST', {
      selection,
    });
    assert.ok([400, 409].includes(r.status), JSON.stringify(r));
  }
  assert.equal(
    (
      await request(path(one, nodeId, 'preview'), 'POST', {
        selection: { range: { start: '6100', end: '6101' } },
        tenantId: two.id,
      })
    ).status,
    400,
  );
  for (const t of [suspended, retired])
    assert.equal(
      (await request(path(t), 'POST', save(t, [ext('6100')]))).status,
      409,
    );
  assert.equal(
    (await direct(a, path(one), 'POST', save(one, [ext('6100')]), '')).status,
    401,
  );
  assert.equal(
    (
      await request(path(one), 'POST', save(one, [ext('6100')]), {
        'X-Platform-CSRF': 'forged',
      })
    ).status,
    403,
  );
  const staffToken = (await issue(a, staffFacts)).token;
  for (const method of ['GET', 'POST'])
    assert.equal(
      (
        await direct(
          b,
          path(one),
          method,
          method === 'POST' ? save(one, [ext('6100')]) : undefined,
          `__Host-myims-platform=${staffToken}`,
        )
      ).status,
      403,
    );
  for (const suffix of ['?limit=101', '?limit=1&limit=2', '?forged=1'])
    assert.equal((await request(path(one) + suffix)).status, 400);
  for (const extra of [
    { origin: 'https://foreign.invalid' },
    { origin: '' },
    { authorization: 'Bearer forged' },
    { 'x-platform-proxy': 'forged' },
  ])
    assert.ok(
      [401, 403].includes(
        (
          await direct(
            a,
            path(one),
            'POST',
            save(one, [ext('6100')]),
            undefined,
            extra,
          )
        ).status,
      ),
    );
  const foreign = await request(
    path(one, otherNode),
    'POST',
    save(one, [ext('6100')]),
  );
  assert.equal(foreign.status, 409);
  const firstBody = save(one, [ext('6100'), ext('6101')]);
  const first = await direct(a, path(one), 'POST', firstBody);
  assert.equal(first.status, 201, JSON.stringify(first));
  const reloadB = await direct(b, path(one));
  assert.equal(reloadB.status, 200, JSON.stringify(reloadB));
  assert.equal(reloadB.data.capacity.reserved, 2);
  assert.equal(reloadB.data.capacity.disabled, 2);
  const expanding = await direct(
    b,
    path(two),
    'POST',
    save(two, [ext('6102')], 'allocated'),
  );
  assert.equal(expanding.status, 201, JSON.stringify(expanding));
  assert.equal(
    (await request(path(two), 'POST', save(two, [ext('6101'), ext('6103')])))
      .status,
    409,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM public.tenant_inventory_claims WHERE extension_id=$1',
        [ext('6103').id],
      )
    ).rows[0].n,
    0,
  );
  console.log(
    'CHECK allocation: A/B overlap races, concurrent exact replay, changed intent and stale versions',
  );
  let raceIndex = 0;
  async function reviewed(t, numbers, range) {
    const r = await request(path(t, nodeId, 'preview'), 'POST', {
      selection: range
        ? { range: { start: numbers[0], end: numbers.at(-1) } }
        : { extensionIds: numbers.map((n) => ext(n).id) },
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.canSave, true);
    return r.data.items;
  }
  for (const [left, right] of [
    [
      ['6104', '6105'],
      ['6105', '6106'],
    ],
    [['6107', '6108'], ['6108']],
    [['6109'], ['6109']],
  ]) {
    const intent1 = save(one, await reviewed(one, left, raceIndex < 2)),
      intent2 = save(two, await reviewed(two, right, raceIndex === 0));
    raceIndex++;
    const results = await Promise.all([
      direct(a, path(one), 'POST', intent1),
      direct(b, path(two), 'POST', intent2),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  }
  const exact = save(one, [ext('6110')]);
  const exactResults = await Promise.all([
    direct(a, path(one), 'POST', exact),
    direct(b, path(one), 'POST', exact),
  ]);
  assert.deepEqual(exactResults.map((r) => r.status).sort(), [200, 201]);
  assert.deepEqual(exactResults[0].data.items, exactResults[1].data.items);
  assert.equal(
    (await request(path(one), 'POST', { ...exact, state: 'allocated' })).data
      .reason,
    'request_conflict',
  );
  assert.equal(
    (
      await request(path(one), 'POST', {
        ...save(one, [ext('6111')]),
        expectedTenantVersion: 999,
      })
    ).data.reason,
    'stale_version',
  );
  assert.equal(
    (
      await request(path(one), 'POST', {
        ...save(one, [ext('6111')]),
        items: [{ extensionId: ext('6111').id, expectedVersion: 999 }],
      })
    ).data.reason,
    'stale_version',
  );
  const c = first.data.items.find((c) => c.extensionId === ext('6100').id),
    promoted = await request(
      path(one, nodeId, c.id + '/promote'),
      'POST',
      change(one, c),
    );
  assert.equal(promoted.status, 200, JSON.stringify(promoted));
  assert.equal(promoted.data.items[0].state, 'allocated');
  assert.equal(
    (
      await request(
        path(one, nodeId, c.id + '/release'),
        'POST',
        change(one, c),
      )
    ).data.reason,
    'stale_version',
  );
  assert.deepEqual(
    (await request(path(one), 'POST', firstBody)).data.items,
    first.data.items,
  );
  // Direct SQL exercises the constraint under actual runtime grants.
  const { runtime } = allocationDependencies;
  await assert.rejects(
    () =>
      runtime.query(
        `INSERT INTO public.tenant_inventory_claims(id,tenant_id,node_id,installation_id,extension_id,state,created_by,updated_by) VALUES($1,$2,$3,$4,$5,'allocated',$6,$6)`,
        [
          randomUUID(),
          two.id,
          nodeId,
          installation,
          c.extensionId,
          session.operatorId,
        ],
      ),
    (e) => e.code === '23505',
  );
  await assert.rejects(
    () =>
      owner.query(
        'UPDATE public.tenant_inventory_claims SET tenant_id=$2,version=version+1 WHERE id=$1',
        [c.id, two.id],
      ),
    (e) => e.code === '23514',
  );
  await assert.rejects(
    () =>
      runtime.query(
        'UPDATE public.tenant_inventory_claims SET tenant_id=$2 WHERE id=$1',
        [c.id, two.id],
      ),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    () =>
      runtime.query(
        'DELETE FROM public.tenant_inventory_history WHERE claim_id=$1',
        [c.id],
      ),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    () =>
      owner.query('DELETE FROM public.extensions WHERE id=$1', [c.extensionId]),
    (e) => e.code === '23514',
  );
  const expiringBody = save(one, [ext('6115')]);
  assert.equal((await request(path(one), 'POST', expiringBody)).status, 201);
  await owner.query(
    'ALTER TABLE public.tenant_inventory_receipts DISABLE TRIGGER tenant_inventory_receipt_immutable',
  );
  try {
    await owner.query(
      "UPDATE public.tenant_inventory_receipts SET created_at=clock_timestamp()-interval '31 days' WHERE operator_id=$1 AND request_id=$2",
      [session.operatorId, expiringBody.requestId],
    );
  } finally {
    await owner.query(
      'ALTER TABLE public.tenant_inventory_receipts ENABLE TRIGGER tenant_inventory_receipt_immutable',
    );
  }
  assert.equal(
    (await request(path(one), 'POST', expiringBody)).data.reason,
    'intent_expired',
  );
  console.log(
    'CHECK allocation: actual lost COMMIT acknowledgment and database failure denial',
  );
  const { replica, commitProxy, proxy } = allocationDependencies;
  const loss = await commitProxy(
    /INSERT INTO public\.tenant_inventory_receipts/,
  );
  const uncertainReplica = await replica({
    productionHttp: true,
    runtimeUrl: loss.url,
  });
  const original = save(one, [ext('6218')]);
  assert.equal(
    (await direct(uncertainReplica, path(one), 'POST', original)).status,
    503,
  );
  assert.equal(loss.dropped(), true);
  const recovered = await direct(b, path(one), 'POST', original);
  assert.equal(recovered.status, 200, JSON.stringify(recovered));
  assert.equal(recovered.data.replayed, true);
  const unavailable = await replica({
    productionHttp: true,
    runtimeUrl: 'postgresql://myims_runtime:unavailable@127.0.0.1:1/absent',
  });
  assert.equal(
    (await direct(unavailable, path(one), 'POST', save(one, [ext('6219')])))
      .status,
    503,
  );
  const redisLoss = await proxy('pause');
  const redisUnavailable = await replica({
    productionHttp: true,
    redisUrl: redisLoss.url,
  });
  redisLoss.arm();
  assert.equal(
    (
      await direct(
        redisUnavailable,
        path(one),
        'POST',
        save(one, [ext('6219')]),
      )
    ).status,
    503,
  );
  await checkAllocationRaces({
    owner,
    runtime,
    request,
    direct,
    issue,
    session,
    a,
    b,
    path,
    one,
    two,
    ext,
    save,
    root,
    deps,
  });
  console.log(
    'CHECK allocation: real rollback of claim/history/audit/receipt with runtime grants',
  );
  for (const table of ['audit_events', 'tenant_inventory_receipts']) {
    const body = save(one, [ext('6112')]);
    if (table !== 'audit_events')
      await owner.query(`REVOKE INSERT ON public.${table} FROM myims_runtime`);
    // Audit uses column-level INSERT grants, so inject its exact actual table trigger.
    if (table === 'audit_events') {
      await owner.query(
        "CREATE FUNCTION public.allocation_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.allocation.changed' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$",
      );
      await owner.query(
        'CREATE TRIGGER allocation_test_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.allocation_test_audit_failure()',
      );
    }
    try {
      assert.equal((await request(path(one), 'POST', body)).status, 503);
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::int AS n FROM public.tenant_inventory_claims WHERE extension_id=$1',
            [ext('6112').id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::int AS n FROM public.tenant_inventory_receipts WHERE request_id=$1',
            [body.requestId],
          )
        ).rows[0].n,
        0,
      );
    } finally {
      if (table === 'audit_events') {
        await owner.query(
          'DROP TRIGGER allocation_test_audit ON public.audit_events',
        );
        await owner.query(
          'DROP FUNCTION public.allocation_test_audit_failure()',
        );
      } else
        await owner.query(
          'GRANT INSERT ON public.tenant_inventory_receipts TO myims_runtime',
        );
    }
  }
  await checkAllocationBounds({
    request,
    owner,
    root,
    path,
    one,
    nodeId,
    otherNode,
    deps,
    save,
  });
  console.log(
    'CHECK allocation: actual inventory disable/profile boundary and safe desired-only release',
  );
  const ownedExt = c.extensionId;
  let current = (await request(root + '/extensions/' + ownedExt)).data
    .extension;
  const enable = await request(
    root + '/extensions/' + ownedExt + '/status',
    'PATCH',
    { expectedVersion: current.version, administrativeStatus: 'enabled' },
  );
  assert.equal(enable.status, 200, JSON.stringify(enable));
  current = enable.data.extension;
  const credential = await request(
    root + '/extensions/' + ownedExt + '/credentials/setup',
    'POST',
    {
      operationId: randomUUID(),
      expectedVersion: current.version,
      expectedGenerationId: null,
    },
  );
  assert.equal(credential.status, 409, JSON.stringify(credential));
  const edit = await request(root + '/extensions/' + ownedExt, 'PATCH', {
    expectedVersion: current.version,
    ...deps,
  });
  assert.equal(edit.status, 409, JSON.stringify(edit));
  const disable = await request(
    root + '/extensions/' + ownedExt + '/status',
    'PATCH',
    { expectedVersion: current.version, administrativeStatus: 'disabled' },
  );
  assert.equal(disable.status, 200, JSON.stringify(disable));
  assert.equal(
    (
      await owner.query(
        "SELECT count(*)::int AS n FROM public.tenant_inventory_claims WHERE extension_id=$1 AND state<>'released'",
        [ownedExt],
      )
    ).rows[0].n,
    1,
  );
  const releaseBody = change(one, promoted.data.items[0]);
  await owner.query('REVOKE SELECT ON public.pbx_live_pins FROM myims_runtime');
  try {
    assert.equal(
      (await request(path(one, nodeId, c.id + '/release'), 'POST', releaseBody))
        .status,
      503,
    );
  } finally {
    await owner.query('GRANT SELECT ON public.pbx_live_pins TO myims_runtime');
  }
  const released = await request(
    path(one, nodeId, c.id + '/release'),
    'POST',
    releaseBody,
  );
  assert.equal(released.status, 200, JSON.stringify(released));
  assert.equal(released.data.items[0].state, 'released');
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM public.tenant_inventory_history WHERE claim_id=$1',
        [c.id],
      )
    ).rows[0].n,
    3,
  );
  const group = await request(root + '/routing/groups', 'POST', {
    requestId: randomUUID(),
    name: 'Allocation release dependency',
    number: null,
    memberIds: [ext('6110').id],
    strategy: 'simultaneous',
    timeout: 10,
    fallback: { kind: 'hangup' },
  });
  assert.equal(group.status, 201, JSON.stringify(group));
  const groupClaim = exactResults[0].data.items[0];
  const blocked = await request(
    path(one, nodeId, groupClaim.id + '/release'),
    'POST',
    change(one, groupClaim),
  );
  assert.equal(blocked.data.reason, 'referenced', JSON.stringify(blocked));
  assert.ok(blocked.data.blockers.some((x) => x.id === group.data.resource.id));
  // Real retained dependency pin, existing port, no live Asterisk or active-call proof.
  const capture = await request(root + '/revisions', 'POST', {
    requestId: randomUUID(),
  });
  assert.equal(capture.status, 201, JSON.stringify(capture));
  const rev = capture.data.revision.id;
  await owner.query(
    "INSERT INTO public.pbx_live_pins(revision_id,node_id,kind,resource_id,version) VALUES($1,$2,'extensions',$3,1)",
    [rev, nodeId, ext('6101').id],
  );
  const pinClaim = first.data.items.find(
    (c) => c.extensionId === ext('6101').id,
  );
  const pinned = await request(
    path(one, nodeId, pinClaim.id + '/release'),
    'POST',
    change(one, pinClaim),
  );
  assert.equal(pinned.data.reason, 'referenced', JSON.stringify(pinned));
  assert.ok(pinned.data.blockers.some((x) => x.name.includes('Retained')));
  await owner.query(
    "INSERT INTO public.pbx_live_runtime(node_id,runtime_state) VALUES($1,'unknown')",
    [nodeId],
  );
  try {
    const blocked = await request(
      path(two, nodeId, expanding.data.items[0].id + '/release'),
      'POST',
      change(two, expanding.data.items[0]),
    );
    assert.equal(blocked.data.reason, 'referenced');
    assert.ok(blocked.data.blockers.some((b) => b.name.includes('unknown')));
  } finally {
    await owner.query(
      'DELETE FROM public.pbx_live_runtime WHERE node_id=$1 AND active_operation_id IS NULL',
      [nodeId],
    );
  }

  // The initial baseline is not a revision snapshot: pre-baseline stock stays
  // blocked even without a later live intent or resource pin.
  const initialId = randomUUID();
  await owner.query(
    'INSERT INTO public.pbx_live_artifacts(id,node_id,initial_baseline,verified_at) VALUES($1,$2,true,clock_timestamp())',
    [initialId, otherNode],
  );
  await owner.query(
    "INSERT INTO public.pbx_live_runtime(node_id,installed_id,verified_id,known_good_id,runtime_state,baseline_verified_at) VALUES($1,$2,$2,$2,'verified',clock_timestamp())",
    [otherNode, initialId],
  );
  const older = (await request(path(one, otherNode))).data.items[0];
  const baselineBlocked = await request(
    path(one, otherNode, older.id + '/release'),
    'POST',
    change(one, older),
  );
  assert.equal(baselineBlocked.data.reason, 'referenced');
  assert.ok(
    baselineBlocked.data.blockers.some((b) =>
      b.name.includes('Initial runtime baseline'),
    ),
  );
  console.log(
    'CHECK allocation: production HTTPS browser preview/save/reload/recovery and responsive accessibility',
  );
  select(a);
  await page.goto(`${config.origin}/tenants/${two.id}`);
  await page.waitForLoadState('networkidle');
  // Panel uses a section with an accessible name.
  await expect(page.getByLabel(/^PBX node/)).toBeVisible();
  await page.getByLabel(/^PBX node/).selectOption(nodeId);
  await expect(
    page.getByRole('button', { name: 'Reload saved ownership', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Selection method').selectOption('range');
  await page.getByLabel(/^First number/).fill('01000');
  await page.getByLabel(/^Last number/).fill('01001');
  await page
    .getByRole('button', { name: 'Preview selection', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(
      'Review selection: choose 1–50 existing extensions or a valid range.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel(/^First number/)).toHaveValue('01000');
  await page.getByLabel(/^First number/).fill('6210');
  await page.getByLabel(/^Last number/).fill('6212');
  await page
    .getByRole('button', { name: 'Preview selection', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Save reservation', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Save reservation', exact: true })
    .click();
  await expect(
    page.getByText('Ownership saved. Calling verification remains separate.', {
      exact: true,
    }),
  ).toBeVisible();
  select(b);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/^PBX node/).selectOption(nodeId);
  await expect(
    page.getByRole('button', { name: 'Allocate extension 6210', exact: true }),
  ).toBeVisible();
  // Actual individual-stock controls support a further active-tenant expansion.
  await page.getByLabel('Selection method').selectOption('individual');
  const picker = page.getByRole('group', {
    name: 'Select existing extensions',
  });
  const individual = picker.getByRole('checkbox', { name: /^Extension 6116 / });
  for (let i = 0; i < 8 && !(await individual.count()); i++) {
    const first = picker.locator('label:has(input[type="checkbox"])').first();
    const previous = await first.textContent();
    await page.getByRole('button', { name: 'More stock', exact: true }).click();
    await expect(first).not.toHaveText(previous);
  }
  await individual.check();
  await page
    .getByRole('button', { name: 'Preview selection', exact: true })
    .click();
  await page.getByLabel('Ownership state').selectOption('allocated');
  await expect(
    page.getByRole('button', { name: 'Save allocation', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Save allocation', exact: true })
    .click();
  await expect(
    page.getByText('Ownership saved. Calling verification remains separate.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Ownership state').selectOption('reserved');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `.local/ui-review/allocation-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    globalThis.document.documentElement.style.zoom = '2';
  });
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
    true,
  );
  await page.evaluate(() => {
    globalThis.document.documentElement.style.zoom = '';
  });
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('CHECK allocation HTTPS: same-owner mounted reauthentication');
  // Same-owner mounted reauthentication retains allocation inputs without writes.
  await page.getByLabel('Selection method').selectOption('range');
  await page.getByLabel(/^First number/).fill('6221');
  await page.getByLabel(/^Last number/).fill('6221');
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
  await expect(page.getByLabel(/^First number/)).toHaveValue('6221');
  console.log('CHECK allocation HTTPS: lost save response');
  // Lost response after commit recovers only the exact original attempt.
  await page.getByLabel('Selection method').selectOption('range');
  await page.getByLabel(/^First number/).fill('6220');
  await page.getByLabel(/^Last number/).fill('6220');
  await page
    .getByRole('button', { name: 'Preview selection', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Save reservation', exact: true }),
  ).toBeEnabled();
  ingress.drop(path(two));
  await page
    .getByRole('button', { name: 'Save reservation', exact: true })
    .click();
  const retry = page.getByRole('button', { name: 'Retry access', exact: true });
  await expect(retry).toBeVisible();
  await delay(1100); // Honor the existing AccessError retry-after cooldown.
  console.log('CHECK allocation HTTPS: restore access after lost response');
  await retry.click();
  await expect(
    page.getByRole('button', {
      name: 'Retry original allocation request',
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole('button', {
      name: 'Retry original allocation request',
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      'Original outcome recovered. Reloaded saved ownership may be newer.',
      { exact: true },
    ),
  ).toBeVisible();
  // A delayed committed result cannot transfer work to a new node or operator.
  async function delayedSave(number) {
    await page.getByLabel(/^First number/).fill(number);
    await page.getByLabel(/^Last number/).fill(number);
    await page
      .getByRole('button', { name: 'Preview selection', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Save reservation', exact: true }),
    ).toBeEnabled();
    const gate = holdResponse('POST', path(two));
    await page
      .getByRole('button', { name: 'Save reservation', exact: true })
      .click();
    assert.equal(await gate.reached, 201);
    return gate;
  }
  console.log('CHECK allocation HTTPS: delayed node switch');
  const targetGate = await delayedSave('6222');
  await page.getByLabel(/^PBX node/).selectOption(otherNode);
  await page.getByLabel('Selection method').selectOption('range');
  targetGate.release();
  await expect(page.getByLabel(/^First number/)).toHaveValue('');
  await expect(
    page.getByRole('button', {
      name: 'Retry original allocation request',
      exact: true,
    }),
  ).not.toBeVisible();
  await page.getByLabel(/^PBX node/).selectOption(nodeId);
  await page.getByLabel('Selection method').selectOption('range');
  console.log('CHECK allocation HTTPS: delayed operator switch');
  const ownerGate = await delayedSave('6223');
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
  await page.getByLabel(/^PBX node/).selectOption(nodeId);
  await page.getByLabel('Selection method').selectOption('range');
  ownerGate.release();
  await expect(page.getByLabel(/^First number/)).toHaveValue('');
  await expect(
    page.getByRole('button', {
      name: 'Retry original allocation request',
      exact: true,
    }),
  ).not.toBeVisible();
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
  await expect(page.getByLabel(/^PBX node/)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const canonical = await request(path(two));
  assert.equal(canonical.status, 200);
  assert.equal(
    (
      await owner.query(
        "SELECT count(*)::int AS n FROM public.tenant_inventory_claims WHERE extension_id=$1 AND state<>'released'",
        [ext('6220').id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await request(`/platform/tenants/${two.id}`)).data.tenant.status,
    'active',
  );
  console.log(
    'PASS allocation focused real API/HTTPS ownership, races, rollback, release blockers and browser workflow',
  );
  // The enclosing launcher owns and drops the entire isolated database and Redis.
  await page.goto(`${config.origin}/ui-preview`);
}

export async function checkTenantAllocation(input) {
  try {
    return await runTenantAllocation(input);
  } catch (error) {
    const frames = String(error.stack)
      .split('\n')
      .filter((line) =>
        /check-(tenant-allocation|allocation-races)\.mjs:\d+:\d+/.test(line),
      )
      .map((line) => line.match(/check-[a-z-]+\.mjs:\d+:\d+/)?.[0]);
    const state = await input.page
      .evaluate(() => ({
        buttons: Array.from(globalThis.document.querySelectorAll('button'))
          .filter((b) =>
            /^(Retry access|Retry original allocation request|Save reservation|Preview selection)$/.test(
              b.textContent.trim(),
            ),
          )
          .map((b) => ({
            name: b.textContent.trim(),
            disabled: b.disabled,
            visible:
              !!b.getClientRects().length &&
              globalThis.getComputedStyle(b).visibility !== 'hidden',
          })),
        node: globalThis.document.getElementById('allocation-node')?.value,
        first: globalThis.document.getElementById('allocation-start')?.value,
        reauthentication: Array.from(
          globalThis.document.querySelectorAll('h1'),
        ).some((h) => h.textContent === 'Platform console sign-in'),
      }))
      .catch(() => null);
    console.log(
      'FAIL allocation fixture',
      JSON.stringify({ name: error.name, code: error.code, frames, state }),
    );
    await input.page
      .screenshot({
        path: '.local/ui-review/allocation-failure.png',
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  }
}
