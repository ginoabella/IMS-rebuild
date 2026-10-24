import { checkIntegratedRouting } from './check-integrated-routing.mjs';
import { checkOutboundRouting } from './check-outbound-routing.mjs';
import { checkInboundRouting } from './check-inbound-routing.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { intersects, pattern, validateGraph, tenantCompatible } = backend(
  './dist/modules/telephony/domain/routing.js',
);
export async function checkRouting({
  request,
  direct,
  create,
  path,
  nodeId,
  otherNode,
  installation,
  owner,
  session,
  page,
  config,
  ingress,
  a,
  b,
  issue,
  staffFacts,
  login,
  holdResponse,
}) {
  console.log('CHECK routing: inventory fixtures and shared claim setup');
  const root = `/platform/pbx-nodes/${nodeId}`;
  const gp = (id = '', suffix = '') =>
    path('groups', ...[id, suffix].filter(Boolean));
  const rp = (id = '', suffix = '') =>
    path('reservations', ...[id, suffix].filter(Boolean));
  const exact = (digits) => ({
    kind: 'exact',
    digits,
    minLength: digits.length,
    maxLength: digits.length,
  });
  const prefix = (digits, minLength, maxLength) => ({
    kind: 'prefix',
    digits,
    minLength,
    maxLength,
  });
  const reservation = (name, p) => ({
    requestId: randomUUID(),
    name,
    purpose: 'Controlled desired protection',
    pattern: p,
  });
  const n = await request(root);
  assert.equal(n.status, 200, JSON.stringify(n));
  await owner.query(
    `INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])`,
    [installation],
  );
  const profile = await request(root + '/endpoint-profiles', 'POST', {
    requestId: randomUUID(),
    name: 'Routing inventory',
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
  const extension = (number) => ({
    requestId: randomUUID(),
    kind: 'sip',
    number,
    ...deps,
  });
  const bulk = (numbers) => ({
    requestId: randomUUID(),
    kind: 'sip',
    numbers,
    ...deps,
  });
  const ext = async (number) => {
    const r = await request(root + '/extensions', 'POST', extension(number));
    assert.equal(r.status, 201, JSON.stringify(r));
    return r.data.extension;
  };
  const e1 = await ext('1000'),
    e2 = await ext('899999');
  assert.equal(e1.eligibility.eligible, false);
  const boundaryStock = await request(
    root + '/extensions/bulk',
    'POST',
    bulk(Array.from({ length: 30 }, (_, i) => String(6000 + i))),
  );
  assert.equal(boundaryStock.status, 201, JSON.stringify(boundaryStock));
  const thirtyTwo = [
    e1.id,
    e2.id,
    ...boundaryStock.data.items.map((e) => e.id),
  ];

  const group = (
    name,
    number = null,
    memberIds = [e1.id],
    fallback = { kind: 'hangup' },
  ) => ({
    requestId: randomUUID(),
    name,
    number,
    memberIds,
    strategy: 'simultaneous',
    timeout: 20,
    fallback,
  });
  const values = (g) => ({
    name: g.name,
    number: g.number,
    memberIds: g.memberIds,
    strategy: g.strategy,
    timeout: g.timeout,
    fallback: g.fallback,
  });
  const edit = (g, more = {}) =>
    request(gp(g.id), 'PATCH', {
      ...values(g),
      ...more,
      expectedVersion: g.version,
    });
  const remove = (k, g) =>
    request((k === 'groups' ? gp : rp)(g.id, 'remove'), 'POST', {
      expectedVersion: g.version,
    });
  await checkInboundRouting({
    request,
    direct,
    create,
    nodeId,
    otherNode,
    installation,
    owner,
    page,
    config,
    a,
    b,
    e1,
    ingress,
    issue,
    staffFacts,
  });
  await checkOutboundRouting({
    request,
    direct,
    create,
    nodeId,
    otherNode,
    installation,
    owner,
    page,
    config,
    a,
    b,
    issue,
    staffFacts,
    ingress,
  });
  console.log('CHECK routing: grammar, trusted ownership and group lifecycle');
  // Deterministic grammar/compatibility checks use explicitly trusted allocation facts.
  for (const p of [
    exact('0'),
    exact('000'),
    exact('123456789012345'),
    prefix('0', 1, 15),
    prefix('123', 3, 15),
  ])
    assert.deepEqual(pattern(p), p);
  for (const p of [
    prefix('', 1, 15),
    prefix('1', 0, 15),
    prefix('1', 1, 16),
    prefix('123', 2, 4),
    { ...exact('123'), minLength: 2 },
    prefix('+1', 2, 4),
    prefix('_X', 2, 4),
  ])
    assert.throws(() => pattern(p));
  assert.ok(intersects(prefix('12', 3, 5), prefix('123', 3, 4)));
  assert.ok(!intersects(prefix('12', 4, 5), exact('123')));
  assert.ok(!intersects(exact('01'), exact('1')));
  assert.throws(() =>
    validateGraph([
      { id: 'a', fallback: { kind: 'group', id: 'b' } },
      { id: 'b', fallback: { kind: 'group', id: 'a' } },
    ]),
  );
  const fixture = (id, memberIds, fallback = { kind: 'hangup' }) => ({
    id,
    memberIds,
    fallback,
    enabled: true,
    removedAt: null,
  });
  const trusted = new Map([
    ['e1', { tenantId: 'one', eligible: true }],
    ['e2', { tenantId: 'two', eligible: true }],
  ]);
  assert.ok(tenantCompatible('a', 'one', [fixture('a', ['e1'])], trusted));
  assert.ok(
    tenantCompatible(
      'a',
      'one',
      [
        fixture('a', ['e1'], { kind: 'group', id: 'b' }),
        fixture('b', ['e1'], { kind: 'extension', id: 'e1' }),
      ],
      trusted,
    ),
  );
  assert.ok(
    !tenantCompatible(
      'a',
      'one',
      [fixture('a', ['e1'], { kind: 'group', id: 'b' }), fixture('b', ['e2'])],
      trusted,
    ),
  );
  assert.ok(
    !tenantCompatible(
      'a',
      'one',
      [fixture('a', ['e1'], { kind: 'extension', id: 'e2' })],
      trusted,
    ),
  );
  assert.ok(
    !tenantCompatible('a', 'one', [fixture('a', ['e1', 'e2'])], trusted),
  );
  trusted.set('e1', { tenantId: null, eligible: false });
  assert.ok(!tenantCompatible('a', 'one', [fixture('a', ['e1'])], trusted));
  const originalIntent = group('Primary', '9000', [e1.id, e2.id]);
  const original = await create(gp(), originalIntent);
  assert.equal(original.enabled, false);
  const maximum = await create(gp(), {
    ...group('Thirty two members', null, thirtyTwo),
    timeout: 120,
    strategy: 'sequential',
  });
  assert.equal(maximum.memberIds.length, 32);

  assert.deepEqual(original.memberIds, [e1.id, e2.id]);
  assert.equal(
    (await request(gp(), 'POST', originalIntent)).data.resource.id,
    original.id,
  );
  assert.equal(
    (await request(gp(), 'POST', { ...originalIntent, name: 'Changed replay' }))
      .data.reason,
    'request_conflict',
  );
  assert.equal((await edit(original)).data.resource.version, 1);
  assert.equal((await create(gp(), group('No number'))).number, null);
  for (const more of [
    { memberIds: [] },
    { memberIds: [e1.id, e1.id] },
    { memberIds: Array(33).fill(e1.id) },
    { timeout: 4 },
    { timeout: 121 },
    { strategy: 'random' },
    { number: '0999' },
    { number: '900000' },
    { number: '1000000' },
    { number: '１２３４' },
    { fallback: { kind: 'external', id: e1.id } },
    { tenantId: randomUUID() },
    { sourceKey: 'opaque' },
  ])
    assert.equal(
      (
        await request(gp(), 'POST', {
          ...group('Invalid ' + randomUUID()),
          ...more,
        })
      ).status,
      400,
      JSON.stringify(more),
    );
  const defaultIntent = group('Defaults');
  delete defaultIntent.timeout;
  delete defaultIntent.strategy;
  const defaults = await create(gp(), defaultIntent);
  assert.equal(defaults.timeout, 20);
  assert.equal(defaults.strategy, 'simultaneous');
  for (const ref of [randomUUID(), original.id])
    assert.equal(
      (
        await request(
          gp(),
          'POST',
          group('Wrong member ' + randomUUID(), null, [ref]),
        )
      ).data.reason,
      'invalid_extension',
    );
  for (const ref of [randomUUID(), e1.id])
    assert.equal(
      (
        await request(
          gp(),
          'POST',
          group('Wrong fallback ' + randomUUID(), null, [e1.id], {
            kind: 'group',
            id: ref,
          }),
        )
      ).data.reason,
      'invalid_group',
    );
  const foreignGroup = await direct(
    a,
    `/platform/pbx-nodes/${otherNode}/routing/groups`,
    'POST',
    group('Foreign members'),
  );
  assert.equal(foreignGroup.data.reason, 'invalid_extension');
  let g2 = await create(
    gp(),
    group('Fallback', '9001', [e2.id], { kind: 'group', id: original.id }),
  );
  assert.equal(
    (await edit(original, { fallback: { kind: 'group', id: original.id } }))
      .status,
    400,
  );
  assert.equal(
    (await edit(original, { fallback: { kind: 'group', id: g2.id } })).status,
    400,
  );
  assert.equal((await remove('groups', original)).data.reason, 'referenced');
  let changed = (
    await edit(original, {
      memberIds: [e2.id, e1.id],
      strategy: 'sequential',
      timeout: 5,
      fallback: { kind: 'extension', id: e2.id },
    })
  ).data.resource;
  assert.deepEqual(changed.memberIds, [e2.id, e1.id]);
  const preview = await request(gp('preview'), 'POST', {
    ...values(changed),
    resourceId: changed.id,
  });
  assert.equal(preview.status, 200, JSON.stringify(preview));
  assert.equal(preview.data.maximumRingSeconds, 10);
  assert.equal(preview.data.callingEligible, false);
  assert.ok(preview.data.resources.every((r) => r.version > 0));
  assert.ok(preview.data.warnings.some((w) => w.includes('Disabled')));
  assert.equal(
    (
      await request(gp(changed.id, 'status'), 'PATCH', {
        expectedVersion: 1,
        enabled: true,
      })
    ).data.reason,
    'stale_version',
  );
  changed = (
    await request(gp(changed.id, 'status'), 'PATCH', {
      expectedVersion: 2,
      enabled: true,
    })
  ).data.resource;
  changed = (
    await request(gp(changed.id, 'status'), 'PATCH', {
      expectedVersion: 3,
      enabled: false,
    })
  ).data.resource;
  assert.equal(
    (
      await request(gp(changed.id, 'status'), 'PATCH', {
        expectedVersion: 4,
        enabled: false,
      })
    ).data.resource.version,
    4,
  );
  assert.equal(
    (await request(root + '/extensions', 'POST', extension('9000'))).data
      .reason,
    'number_conflict',
  );
  assert.equal(
    (await request(gp(), 'POST', group('Ext clash', '1000'))).data.reason,
    'number_conflict',
  );
  assert.equal(
    (
      await request(
        rp(),
        'POST',
        reservation('Existing stock', prefix('1', 4, 6)),
      )
    ).data.reason,
    'number_conflict',
  );
  console.log('CHECK routing: reservation intersections and release');
  const reserved = await create(
    rp(),
    reservation('Prefix', prefix('72', 4, 6)),
  );
  for (const number of ['7200', '72999', '720000']) {
    assert.equal(
      (await request(root + '/extensions', 'POST', extension(number))).data
        .reason,
      'number_conflict',
    );
    assert.equal(
      (await request(gp(), 'POST', group('Reserved ' + number, number))).data
        .reason,
      'number_conflict',
    );
  }
  assert.equal(
    (await request(root + '/extensions', 'POST', extension('720'))).status,
    400,
  );
  await ext('7300');
  assert.equal(
    (await request(rp(), 'POST', reservation('Nested', prefix('721', 4, 5))))
      .data.reason,
    'number_conflict',
  );
  assert.equal(
    (await request(rp(), 'POST', reservation('Exact nested', exact('7200'))))
      .data.reason,
    'number_conflict',
  );
  assert.equal(
    (
      await request(rp(reserved.id), 'PATCH', {
        expectedVersion: 1,
        name: reserved.name,
        purpose: reserved.purpose,
        pattern: exact('9000'),
      })
    ).data.reason,
    'number_conflict',
  );
  assert.equal(
    (
      await request(rp(reserved.id, 'status'), 'PATCH', {
        expectedVersion: 1,
        enabled: false,
      })
    ).status,
    400,
  );
  const previewBody = bulk(['7400', '7200']);
  delete previewBody.requestId;
  const bp = await request(
    root + '/extensions/bulk-preview',
    'POST',
    previewBody,
  );
  assert.equal(bp.data.reason, 'number_conflict');
  assert.equal(
    (await request(root + '/extensions/bulk', 'POST', bulk(['7400', '7200'])))
      .data.reason,
    'number_conflict',
  );
  assert.equal(
    (
      await owner.query(
        "SELECT id FROM public.extensions WHERE node_id=$1 AND number='7400'",
        [nodeId],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await request(rp(reserved.id), 'PATCH', {
        expectedVersion: 1,
        name: reserved.name,
        purpose: reserved.purpose,
        pattern: reserved.pattern,
      })
    ).data.resource.version,
    1,
  );
  assert.equal((await remove('reservations', reserved)).status, 200);
  assert.equal(
    (
      await request(rp(), 'POST', {
        requestId: (
          await owner.query(
            `SELECT request_id FROM public.routing_receipts WHERE result->'resource'->>'id'=$1`,
            [reserved.id],
          )
        ).rows[0].request_id,
        name: reserved.name,
        purpose: reserved.purpose,
        pattern: reserved.pattern,
      })
    ).data.resource.id,
    reserved.id,
  );

  await ext('7200');
  assert.ok((await request(rp(reserved.id))).data.resource.removedAt);
  for (const p of [
    exact('0'),
    exact('000'),
    exact('123456789012345'),
    prefix('88', 3, 3),
  ])
    await create(rp(), reservation('Boundary ' + p.digits, p));
  // Distinct exact/length and leading zero claims remain independent.
  await create(rp(), reservation('One digit', exact('1')));
  await create(rp(), reservation('Leading zero', exact('01')));
  const staleReservation = await create(
    rp(),
    reservation('Edited protection', exact('7500')),
  );
  let res = await request(rp(staleReservation.id), 'PATCH', {
    expectedVersion: 1,
    name: staleReservation.name,
    purpose: 'Changed purpose',
    pattern: prefix('75', 4, 4),
  });
  assert.equal(res.data.resource.version, 2);
  assert.equal(
    (
      await request(rp(staleReservation.id), 'PATCH', {
        expectedVersion: 1,
        name: staleReservation.name,
        purpose: 'Changed purpose',
        pattern: exact('7501'),
      })
    ).data.reason,
    'stale_version',
  );
  console.log('CHECK routing: two-replica namespace/reference races');
  // Two independent production HTTP replicas coordinate all namespace owners.
  for (let i = 0; i < 4; i++) {
    const number = String(7600 + i);
    const race = await Promise.all([
      direct(a, root + '/extensions', 'POST', extension(number)),
      direct(b, gp(), 'POST', group('Extension race ' + i, number)),
    ]);
    assert.deepEqual(
      race.map((r) => r.status).sort(),
      [201, 409],
      JSON.stringify(race),
    );
  }
  const bulkRace = await Promise.all([
    direct(a, root + '/extensions/bulk', 'POST', bulk(['7700', '7701'])),
    direct(b, rp(), 'POST', reservation('Bulk race', prefix('77', 4, 4))),
  ]);
  assert.deepEqual(
    bulkRace.map((r) => r.status).sort(),
    [201, 409],
    JSON.stringify(bulkRace),
  );
  const editReservation = await create(
    rp(),
    reservation('Edit race', exact('7800')),
  );
  const editRace = await Promise.all([
    direct(a, rp(editReservation.id), 'PATCH', {
      expectedVersion: 1,
      name: editReservation.name,
      purpose: editReservation.purpose,
      pattern: prefix('78', 4, 4),
    }),
    direct(b, gp(), 'POST', group('Reservation edit race', '7801')),
  ]);
  assert.ok(
    (editRace[0].status === 200 && editRace[1].status === 409) ||
      (editRace[0].status === 409 && editRace[1].status === 201),
    JSON.stringify(editRace),
  );
  for (let i = 0; i < 4; i++) {
    const target = await create(gp(), group('Removal race target ' + i));
    const race = await Promise.all([
      direct(
        a,
        gp(),
        'POST',
        group('Removal race ref ' + i, null, [e1.id], {
          kind: 'group',
          id: target.id,
        }),
      ),
      direct(b, gp(target.id, 'remove'), 'POST', { expectedVersion: 1 }),
    ]);
    assert.ok(
      (race[0].status === 201 && race[1].status === 409) ||
        (race[0].status === 409 && race[1].status === 200),
      JSON.stringify(race),
    );
  }
  const same = group('Same request race', '7900');
  const replayRace = await Promise.all([
    direct(a, gp(), 'POST', same),
    direct(b, gp(), 'POST', same),
  ]);
  assert.deepEqual(replayRace.map((r) => r.status).sort(), [200, 201]);
  assert.equal(replayRace[0].data.resource.id, replayRace[1].data.resource.id);
  await owner.query(
    `CREATE FUNCTION public.reject_routing_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.routing.desired-changed' THEN RAISE EXCEPTION 'injected audit rejection'; END IF; RETURN NEW; END; $$`,
  );
  await owner.query(
    'CREATE TRIGGER routing_audit_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_routing_audit()',
  );
  const fault = group('Routing audit rollback', '7950');
  try {
    assert.equal((await request(gp(), 'POST', fault)).status, 503);
  } finally {
    await owner.query(
      'DROP TRIGGER routing_audit_fault ON public.audit_events',
    );
    await owner.query('DROP FUNCTION public.reject_routing_audit()');
  }
  assert.equal(
    (
      await owner.query(
        "SELECT id FROM public.ring_groups WHERE name='Routing audit rollback'",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT owner_id FROM public.telephony_number_claims WHERE installation_id=$1 AND digit_length=4 AND span @> 7950::bigint',
        [installation],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT request_id FROM public.routing_receipts WHERE request_id=$1',
        [fault.requestId],
      )
    ).rows.length,
    0,
  );
  assert.equal((await request(gp(), 'POST', fault)).status, 201);
  assert.equal(
    (
      await request(gp(), 'POST', group('No csrf'), {
        'X-Platform-CSRF': 'wrong',
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
          gp(),
          method,
          method === 'POST' ? group('Staff denied') : undefined,
          `__Host-myims-platform=${staffToken}`,
        )
      ).status,
      403,
    );
  assert.equal((await request(gp() + '?limit=101')).status, 400);
  assert.equal((await request(gp() + '?forged=1')).status, 400);
  assert.equal((await request(gp() + '?limit=1')).data.items.length, 1);
  assert.equal((await request(gp())).cache, 'no-store');
  assert.equal(
    (
      await request(
        `/platform/pbx-nodes/${otherNode}/routing/groups/${original.id}`,
      )
    ).status,
    404,
  );
  console.log('CHECK routing: access, audit rollback and SQL constraints');
  // Exact SQL constraint rejects an overlapping claim even outside application validators.
  await assert.rejects(
    owner.query(
      `INSERT INTO public.number_reservations(id,node_id,installation_id,name,purpose,pattern_kind,digits,min_length,max_length,created_by,updated_by) VALUES($1,$2,$3,'SQL overlap','Constraint check','exact','1000',4,4,$4,$4)`,
      [randomUUID(), nodeId, installation, session.operatorId],
    ),
    (e) => e.code === '23P01',
  );
  await assert.rejects(
    owner.query(
      `INSERT INTO public.ring_groups(id,node_id,installation_id,name,strategy,timeout,created_by,updated_by) VALUES($1,$2,$3,'Empty SQL group','simultaneous',20,$4,$4)`,
      [randomUUID(), nodeId, installation, session.operatorId],
    ),
    (e) => e.code === '23514',
  );
  // Release only after references are removed; replacement keeps a distinct UUID.
  assert.equal((await remove('groups', g2)).status, 200);
  assert.equal((await remove('groups', changed)).status, 200);
  const reused = await create(gp(), group('Primary', '9000'));
  assert.notEqual(reused.id, original.id);
  assert.equal(
    (
      await request(
        gp(),
        'POST',
        group('Removed fallback rejected', null, [e1.id], {
          kind: 'group',
          id: original.id,
        }),
      )
    ).data.reason,
    'invalid_group',
  );
  assert.ok((await request(gp(original.id))).data.resource.removedAt);
  const audit = (
    await owner.query(
      "SELECT metadata FROM public.audit_events WHERE event_type='telephony.routing.desired-changed' AND metadata->>'resourceId'=$1 ORDER BY (metadata->>'version')::integer",
      [original.id],
    )
  ).rows;
  assert.deepEqual(
    audit.map((r) => r.metadata.operation),
    ['create', 'edit', 'status', 'status', 'remove'],
  );
  console.log(
    'PASS routing PostgreSQL/A/B API: bounds/defaults/order, graph rejection, namespace intersections, disabled/released claims, trusted tenant fixtures, strict inputs/access, SQL constraints, atomic audit/receipt rollback, no-ops/replays/stale writes and four namespace/reference races.',
  );
  console.log('CHECK routing: actual group/reservation browser journey');
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}`);
  await page
    .getByRole('link', {
      name: 'Routing: groups and rules',
      exact: true,
    })
    .click();
  const button = (name) => page.getByRole('button', { name, exact: true });
  const detail = page.getByRole('region', {
    name: 'Resource detail',
    exact: true,
  });
  await button('Create group').click();
  const memberSelect = page.getByLabel('Add inventory member', {
    exact: false,
  });
  await expect
    .poll(() => memberSelect.locator('option').count())
    .toBeGreaterThan(1);
  while (await button('More extensions').isVisible()) {
    const before = await memberSelect.locator('option').count();
    await button('More extensions').click();
    await expect
      .poll(() => memberSelect.locator('option').count())
      .toBeGreaterThan(before);
  }
  await page.getByLabel(/^Name/).fill('Browser group');
  await page.getByLabel('Dialable number', { exact: false }).fill('8100');
  await page
    .getByLabel('Add inventory member', { exact: false })
    .selectOption(e1.id);
  await button('Add member').click();
  await page
    .getByLabel('Add inventory member', { exact: false })
    .selectOption(e2.id);
  await button('Add member').click();
  await button('Move member 2 up').click();
  await page.getByLabel('Ring strategy').selectOption('sequential');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      `group form reflow ${width}`,
    );
  }
  assert.deepEqual(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
    [],
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  await button('Preview group').click();
  await expect(
    page.getByText('Advisory preview:', { exact: false }),
  ).toContainText('40 seconds');
  ingress.drop(gp(), 'POST');
  await button('Save group').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await button('Retry exact create request').click();
  await expect(detail).toContainText('Browser group');
  const browserGroup = (
    await owner.query(
      "SELECT id FROM public.ring_groups WHERE name='Browser group'",
    )
  ).rows[0].id;
  const browserSaved = (await request(gp(browserGroup))).data.resource;
  assert.deepEqual(browserSaved.memberIds, [e2.id, e1.id]);
  await button('Enable group').click();
  await expect(button('Disable group')).toBeVisible();
  await button('Disable group').click();
  await expect(button('Enable group')).toBeVisible();
  await expect(button('Edit group')).toBeEnabled();
  await button('Edit group').focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Dialable number', { exact: false }).fill('1000');
  await button('Save group').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'intersects an existing' }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser group');
  await expect(
    page.getByLabel('Dialable number', { exact: false }),
  ).toHaveValue('1000');
  await page.getByLabel('Dialable number', { exact: false }).fill('8101');
  const current = (await request(gp(browserGroup))).data.resource;
  await request(gp(browserGroup, 'status'), 'PATCH', {
    expectedVersion: current.version,
    enabled: true,
  });
  await button('Save group').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Dialable number', { exact: false }),
  ).toHaveValue('8101');
  await button('Reload canonical state').click();
  await button('Use current version').click();
  await button('Save group').click();
  await expect(detail).toContainText('8101');
  await button('Edit group').click();
  await page.getByLabel('Dialable number', { exact: false }).fill('8102');
  ingress.drop(gp(browserGroup), 'PATCH');
  await button('Save group').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Dialable number', { exact: false }),
  ).toHaveValue('8102');
  await button('Reload canonical state').click();
  await button('Use current version').click();
  await button('Save group').click();
  await expect(detail).toContainText('8102');
  const ref = await create(
    gp(),
    group('Browser reference', null, [e1.id], {
      kind: 'group',
      id: browserGroup,
    }),
  );
  await button('Remove group').click();
  await button('Confirm removal').click();
  await expect(
    page.getByRole('region', { name: 'Dependencies', exact: true }),
  ).toContainText('Browser reference');
  await button('Open group Browser reference').click();
  await expect(detail).toContainText(ref.id);
  await button('Remove group').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  await button('Reload list').click();
  await button('Inspect Browser group').click();
  await button('Remove group').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  await button('Reserved numbers').click();
  await button('Create reservation').click();
  await page.getByLabel(/^Name/).fill('Browser protection');
  await page.getByLabel(/^Purpose/).fill('Private service range');
  await page.getByLabel('Reservation pattern').selectOption('prefix');
  await page.getByLabel('ASCII digits').fill('82');
  await page.getByLabel('Minimum total length').fill('1');
  await page.getByLabel('Maximum total length').fill('4');
  await button('Save reservation').click();
  await expect(page.getByLabel('Reservation pattern')).toBeFocused();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser protection');
  await page.getByLabel('Minimum total length').fill('4');
  await button('Save reservation').click();
  await expect(detail).toContainText('Browser protection');
  await button('Edit reservation').click();
  await page.getByLabel(/^Purpose/).fill('Edited service purpose');
  await button('Save reservation').click();
  await expect(detail).toContainText('Edited service purpose');
  await button('Edit reservation').click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      `routing reflow ${width}`,
    );
  }
  assert.deepEqual(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
    [],
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await button('Cancel edit').click();
  await button('Remove reservation').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  // A completion held across logout must not repopulate cleared mounted work.
  await button('Ring groups').click();
  const gate = holdResponse('GET', gp(reused.id));
  await button('Inspect Primary').click();
  await gate.reached;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  gate.release();
  await expect(
    page.getByRole('heading', {
      name: 'Platform console sign-in',
      exact: true,
    }),
  ).toBeVisible();
  await login();
  await expect(
    page.getByRole('heading', { name: 'Platform console', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toHaveCount(0);
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/routing`);
  await expect(
    page.getByRole('heading', {
      name: 'Routing: groups and rules',
      exact: true,
    }),
  ).toBeVisible();
  await checkIntegratedRouting({
    page,
    config,
    nodeId,
    e1,
    create,
    request,
    owner,
  });
  console.log(
    'PASS routing actual HTTPS browser: navigation, ordered selectors/preview, group/reservation create/edit/status/removal, input/focus retention, blockers, lost-create/stale recovery, keyboard/reflow/axe and mounted identity fence; unreachable PBX, no live adapter.',
  );
}
