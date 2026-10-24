import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { routeIdentity, inboundTenantCompatible, resolveRouteTenant } = backend(
  './dist/modules/telephony/domain/route-identity.js',
);
export async function checkInboundRouting({
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
}) {
  console.log('CHECK inbound: selectors, validation, preview and dependencies');
  const root = `/platform/pbx-nodes/${nodeId}`,
    ip = (id = '', op = '') =>
      `${root}/routing/inbound${id ? `/${id}` : ''}${op ? `/${op}` : ''}`,
    pp = (kind, id = '', op = '') =>
      `${root}/peers/${kind}${id ? `/${id}` : ''}${op ? `/${op}` : ''}`;
  const gateway = async (name, address) =>
    create(pp('gateways'), {
      requestId: randomUUID(),
      name,
      kind: 'sip-device',
      trunkId: null,
      sourceAddresses: [address],
    });
  const g1 = await gateway('Inbound gateway one', '192.0.2.201'),
    g2 = await gateway('Inbound gateway two', '192.0.2.202');
  const did = async (name, number, gatewayId = g1.id) =>
    create(pp('dids'), { requestId: randomUUID(), name, number, gatewayId });
  const d1 = await did('Inbound leading zero', '00123'),
    d2 = await did('Inbound plus', '+00123'),
    d3 = await did('Inbound plain', '123'),
    foreign = await did('Inbound foreign DID', '456', g2.id);
  const values = (r) => ({
    name: r.name,
    gatewayId: r.gatewayId,
    didId: r.didId,
    destination: r.destination,
  });
  const body = (
    name,
    didId = null,
    gatewayId = g1.id,
    destination = { kind: 'hangup' },
  ) => ({ requestId: randomUUID(), name, gatewayId, didId, destination });
  const edit = (r, more = {}) =>
    request(ip(r.id), 'PATCH', {
      ...values(r),
      ...more,
      expectedVersion: r.version,
    });
  const remove = (r) =>
    request(ip(r.id, 'remove'), 'POST', { expectedVersion: r.version });
  const preview = (dialled, gatewayId = g1.id) =>
    request(ip('preview'), 'POST', { gatewayId, dialled });
  const catchall = await create(ip(), body('Inbound catch-all'));
  let exact = await create(
    ip(),
    body('Inbound exact', d1.id, g1.id, { kind: 'extension', id: e1.id }),
  );
  assert.equal(exact.enabled, false);
  assert.equal((await request(ip() + '?limit=101')).status, 400);
  assert.equal((await request(ip() + '?unexpected=1')).status, 400);
  assert.equal((await request(ip() + '?limit=1')).data.items.length, 1);
  assert.equal((await request(ip())).cache, 'no-store');
  assert.equal(
    (
      await request(ip(), 'POST', body('No csrf', d2.id), {
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
          ip(),
          method,
          method === 'POST' ? body('Wrong plane', d2.id) : undefined,
          `__Host-myims-platform=${staffToken}`,
        )
      ).status,
      403,
    );
  const sqlId = randomUUID(),
    sqlKeys = routeIdentity(installation, sqlId);
  await assert.rejects(
    owner.query(
      'INSERT INTO public.inbound_rules(id,node_id,installation_id,name,gateway_id,did_id,source_key,context_hash,watch_identity,attribution_key,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)',
      [
        sqlId,
        nodeId,
        installation,
        'Inbound SQL invalid association',
        g2.id,
        d1.id,
        sqlKeys.sourceKey,
        sqlKeys.contextHash,
        sqlKeys.watchIdentity,
        sqlKeys.attributionKey,
        exact.createdBy,
      ],
    ),
    { code: '23503' },
  );

  for (const bad of [
    { sourceKey: 'supplied' },
    { contextHash: 'supplied' },
    { watchIdentity: 'supplied' },
    { attributionKey: 'supplied' },
    { tenantId: randomUUID() },
    { binding: { tenantId: randomUUID() } },
  ]) {
    assert.equal(
      (
        await direct(a, ip(), 'POST', {
          ...body('Rejected binding', d2.id),
          ...bad,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(ip(), 'POST', {
          ...body('Rejected proxy binding', d2.id),
          ...bad,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (await request(ip(), 'POST', body('Wrong gateway', foreign.id))).status,
    409,
  );
  assert.equal(
    (await request(ip(), 'POST', body('Duplicate disabled', d1.id))).data
      .reason,
    'selector_conflict',
  );
  assert.equal(
    (await request(ip(), 'POST', body('Duplicate catch-all'))).data.reason,
    'selector_conflict',
  );
  assert.equal(
    (
      await request(
        ip(),
        'POST',
        body('Unknown destination', d2.id, g1.id, {
          kind: 'extension',
          id: randomUUID(),
        }),
      )
    ).status,
    409,
  );
  for (const number of ['+00123', '123', '00124']) {
    const p = await preview(number);
    assert.equal(p.status, 200, JSON.stringify(p));
    assert.equal(p.data.rule.id, catchall.id);
    assert.equal(p.data.precedence, 'catch_all');
  }
  let p = await preview('00123');
  assert.equal(p.status, 200, JSON.stringify(p));
  assert.equal(p.data.rule.id, exact.id);
  assert.equal(p.data.reason, 'disabled_rule');
  assert.equal(p.data.precedence, 'exact');
  assert.equal(p.data.callingEligible, false);
  assert.equal((await preview('00123', g2.id)).data.reason, 'no_match');
  assert.equal(
    (await preview('00123', randomUUID())).data.reason,
    'unknown_ingress',
  );
  assert.equal(
    (
      await request(
        `/platform/pbx-nodes/${otherNode}/routing/inbound/preview`,
        'POST',
        { gatewayId: g1.id, dialled: '00123' },
      )
    ).data.reason,
    'unknown_ingress',
  );
  const keys = (
    await owner.query(
      'SELECT source_key,context_hash,watch_identity,attribution_key FROM public.inbound_rules WHERE id=$1',
      [exact.id],
    )
  ).rows[0];
  assert.deepEqual(keys, {
    source_key: routeIdentity(installation, exact.id).sourceKey,
    context_hash: routeIdentity(installation, exact.id).contextHash,
    watch_identity: routeIdentity(installation, exact.id).watchIdentity,
    attribution_key: routeIdentity(installation, exact.id).attributionKey,
  });
  assert.ok(!JSON.stringify(exact).includes(keys.source_key));
  const auditBefore = (
    await owner.query(
      "SELECT count(*)::integer AS n FROM public.audit_events WHERE event_type='telephony.routing.desired-changed' AND metadata->>'resourceId'=$1",
      [exact.id],
    )
  ).rows[0].n;
  const noOp = await edit(exact);
  assert.equal(
    (
      await owner.query(
        "SELECT count(*)::integer AS n FROM public.audit_events WHERE event_type='telephony.routing.desired-changed' AND metadata->>'resourceId'=$1",
        [exact.id],
      )
    ).rows[0].n,
    auditBefore,
  );
  assert.equal(noOp.data.resource.version, 1);
  exact = (await edit(exact, { name: 'Inbound exact renamed' })).data.resource;
  const keysAfter = (
    await owner.query(
      'SELECT source_key,context_hash,watch_identity,attribution_key FROM public.inbound_rules WHERE id=$1',
      [exact.id],
    )
  ).rows[0];
  assert.deepEqual(keysAfter, keys);
  assert.equal(
    (
      await request(ip(exact.id), 'PATCH', {
        ...values(exact),
        expectedVersion: 1,
      })
    ).data.reason,
    'stale_version',
  );
  for (const [kind, r, more] of [
    ['dids', d1, { number: '00124' }],
    ['dids', d1, { gatewayId: g2.id }],
    ['gateways', g1, { sourceAddresses: ['192.0.2.203'] }],
  ]) {
    const v =
      kind === 'dids'
        ? { name: r.name, number: r.number, gatewayId: r.gatewayId }
        : {
            name: r.name,
            kind: r.kind,
            trunkId: r.trunkId,
            sourceAddresses: r.sourceAddresses,
          };
    const rejected = await request(pp(kind, r.id), 'PATCH', {
      ...v,
      ...more,
      expectedVersion: 1,
    });
    assert.equal(rejected.status, 409, JSON.stringify(rejected));
    assert.equal(rejected.data.reason, 'referenced');
  }
  for (const [kind, r] of [
    ['dids', d1],
    ['gateways', g1],
  ])
    assert.equal(
      (await request(pp(kind, r.id, 'remove'), 'POST', { expectedVersion: 1 }))
        .data.reason,
      'referenced',
    );
  console.log(
    'CHECK inbound: internal identities and trusted ownership fixtures',
  );
  // Stable internally generated identity; trusted facts only, never HTTP allocation.
  const tenant = randomUUID(),
    facts = new Map([
      [g1.id, { tenantId: tenant, eligible: true }],
      [d1.id, { tenantId: tenant, eligible: true }],
      [e1.id, { tenantId: tenant, eligible: true }],
    ]);
  const binding = {
    installationId: installation,
    routeId: exact.id,
    version: exact.version,
    tenantId: tenant,
    gatewayId: g1.id,
    didId: d1.id,
    destination: exact.destination,
    enabled: true,
  };
  assert.ok(inboundTenantCompatible(binding, [], facts));
  assert.equal(
    resolveRouteTenant(
      installation,
      keys.attribution_key,
      exact.version,
      [binding],
      [],
      facts,
    ),
    tenant,
  );
  for (const bs of [
    [],
    [binding, binding],
    [{ ...binding, tenantId: null }],
    [{ ...binding, version: 99 }],
  ])
    assert.equal(
      resolveRouteTenant(
        installation,
        keys.attribution_key,
        exact.version,
        bs,
        [],
        facts,
      ),
      null,
    );
  assert.equal(
    resolveRouteTenant(
      installation,
      'unknown',
      exact.version,
      [binding],
      [],
      facts,
    ),
    null,
  );
  assert.equal(
    resolveRouteTenant(
      randomUUID(),
      keys.attribution_key,
      exact.version,
      [binding],
      [],
      facts,
    ),
    null,
  );
  assert.notDeepEqual(
    routeIdentity(randomUUID(), exact.id),
    routeIdentity(installation, exact.id),
  );
  assert.notDeepEqual(
    routeIdentity(installation, randomUUID()),
    routeIdentity(installation, exact.id),
  );
  facts.set(g1.id, { tenantId: randomUUID(), eligible: true });
  assert.ok(!inboundTenantCompatible(binding, [], facts));
  facts.set(g1.id, { tenantId: tenant, eligible: true });
  facts.set(d1.id, { tenantId: randomUUID(), eligible: true });
  assert.ok(!inboundTenantCompatible(binding, [], facts));
  facts.set(d1.id, { tenantId: tenant, eligible: true });
  facts.set(e1.id, { tenantId: null, eligible: false });
  assert.ok(!inboundTenantCompatible(binding, [], facts));
  facts.set(e1.id, { tenantId: tenant, eligible: true });
  const group = await create(`${root}/routing/groups`, {
    requestId: randomUUID(),
    name: 'Inbound destination group',
    number: null,
    memberIds: [e1.id],
    strategy: 'simultaneous',
    timeout: 20,
    fallback: { kind: 'hangup' },
  });
  const gr = await create(
    ip(),
    body('Inbound group rule', d2.id, g1.id, { kind: 'group', id: group.id }),
  );
  assert.equal(
    (
      await request(`${root}/routing/groups/${group.id}/remove`, 'POST', {
        expectedVersion: 1,
      })
    ).data.reason,
    'referenced',
  );
  assert.equal((await preview('+00123')).data.rule.id, gr.id);
  assert.equal((await preview('00123')).data.rule.id, exact.id);
  const groupFixture = { ...group, enabled: true };
  assert.ok(
    inboundTenantCompatible(
      { ...binding, destination: { kind: 'group', id: group.id } },
      [groupFixture],
      facts,
    ),
  );
  facts.set(e1.id, { tenantId: randomUUID(), eligible: true });
  assert.ok(
    !inboundTenantCompatible(
      { ...binding, destination: { kind: 'group', id: group.id } },
      [groupFixture],
      facts,
    ),
  );
  facts.set(e1.id, { tenantId: tenant, eligible: true });
  const fallbackId = randomUUID();
  facts.set(fallbackId, { tenantId: randomUUID(), eligible: true });
  assert.ok(
    !inboundTenantCompatible(
      { ...binding, destination: { kind: 'group', id: group.id } },
      [{ ...groupFixture, fallback: { kind: 'extension', id: fallbackId } }],
      facts,
    ),
  );
  console.log(
    'CHECK inbound: reference races, exact replay and atomic rollback',
  );
  // Shared-node serialization against selector-changing edits and removals on replica B.
  for (let i = 0; i < 3; i++) {
    const d = await did(`Inbound race ${i}`, `901${i}`);
    const rb = body(`Inbound race rule ${i}`, d.id);
    const mutation =
      i === 0
        ? direct(b, pp('dids', d.id, 'remove'), 'POST', { expectedVersion: 1 })
        : direct(b, pp('dids', d.id), 'PATCH', {
            expectedVersion: 1,
            name: d.name,
            number: i === 1 ? '9021' : d.number,
            gatewayId: i === 2 ? g2.id : d.gatewayId,
          });
    const race = await Promise.all([direct(a, ip(), 'POST', rb), mutation]);
    if (race[0].status === 201) {
      if (i === 1 && race[1].status === 200) {
        // An edit committed before reference creation is a valid serial order.
        // Once the reference exists, subsequent selector edits must reject.
        const order = await owner.query(
          'SELECT d.updated_at <= r.created_at AS ordered FROM public.sip_dids d JOIN public.inbound_rules r ON r.did_id=d.id WHERE r.id=$1',
          [race[0].data.resource.id],
        );
        assert.equal(order.rows[0].ordered, true);
        assert.equal(
          (
            await request(pp('dids', d.id), 'PATCH', {
              expectedVersion: 2,
              name: d.name,
              number: '9022',
              gatewayId: g1.id,
            })
          ).data.reason,
          'referenced',
        );
      } else assert.equal(race[1].status, 409, JSON.stringify(race));
      await remove(race[0].data.resource);
    } else {
      assert.equal(race[1].status, 200, JSON.stringify(race));
      assert.equal(race[0].status, 409, JSON.stringify(race));
    }
    const latestDid = (await request(pp('dids', d.id))).data.resource;
    if (!latestDid.removedAt)
      assert.equal(
        (
          await request(pp('dids', d.id, 'remove'), 'POST', {
            expectedVersion: latestDid.version,
          })
        ).status,
        200,
      );
  }
  for (const targetKind of ['gateway', 'group']) {
    const target =
      targetKind === 'gateway'
        ? await gateway('Inbound gateway race', '192.0.2.204')
        : await create(`${root}/routing/groups`, {
            requestId: randomUUID(),
            name: 'Inbound group race',
            number: null,
            memberIds: [e1.id],
            strategy: 'simultaneous',
            timeout: 20,
            fallback: { kind: 'hangup' },
          });
    const rb =
      targetKind === 'gateway'
        ? body('Inbound gateway removal race', null, target.id)
        : body('Inbound group removal race', null, g2.id, {
            kind: 'group',
            id: target.id,
          });
    const targetPath =
      targetKind === 'gateway'
        ? pp('gateways', target.id, 'remove')
        : `${root}/routing/groups/${target.id}/remove`;
    const race = await Promise.all([
      direct(a, ip(), 'POST', rb),
      direct(b, targetPath, 'POST', { expectedVersion: 1 }),
    ]);
    assert.ok(
      (race[0].status === 201 && race[1].status === 409) ||
        (race[0].status === 409 && race[1].status === 200),
      JSON.stringify(race),
    );
    if (race[0].status === 201) {
      await remove(race[0].data.resource);
      assert.equal(
        (await request(targetPath, 'POST', { expectedVersion: 1 })).status,
        200,
      );
    }
  }
  const retryBody = body('Inbound exact replay', d3.id);
  const retries = await Promise.all([
    direct(a, ip(), 'POST', retryBody),
    direct(b, ip(), 'POST', retryBody),
  ]);
  assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
  assert.equal(retries[0].data.resource.id, retries[1].data.resource.id);
  assert.equal(
    (await request(ip(), 'POST', { ...retryBody, name: 'Different intent' }))
      .data.reason,
    'request_conflict',
  );
  await remove(retries[0].data.resource);
  assert.equal(
    (await request(ip(), 'POST', retryBody)).data.resource.id,
    retries[0].data.resource.id,
  );
  await owner.query(
    `CREATE FUNCTION public.reject_inbound_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.routing.desired-changed' AND NEW.metadata->>'resourceKind'='inbound' THEN RAISE EXCEPTION 'injected inbound audit rejection'; END IF; RETURN NEW; END; $$`,
  );
  await owner.query(
    'CREATE TRIGGER inbound_audit_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_inbound_audit()',
  );
  const fault = body('Inbound atomic rollback', d3.id);
  try {
    assert.equal((await request(ip(), 'POST', fault)).status, 503);
  } finally {
    await owner.query(
      'DROP TRIGGER inbound_audit_fault ON public.audit_events',
    );
    await owner.query('DROP FUNCTION public.reject_inbound_audit()');
  }
  assert.equal(
    (
      await owner.query('SELECT id FROM public.inbound_rules WHERE name=$1', [
        fault.name,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT request_id FROM public.routing_receipts WHERE request_id=$1',
        [fault.requestId],
      )
    ).rowCount,
    0,
  );
  const recovered = await create(ip(), fault);
  await remove(recovered);
  console.log(
    'CHECK inbound: actual HTTPS browser creation, preview and recovery',
  );
  await owner.query(
    `CREATE FUNCTION public.reject_inbound_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected inbound receipt rejection'; END; $$`,
  );
  await owner.query(
    'CREATE TRIGGER inbound_receipt_fault BEFORE INSERT ON public.routing_receipts FOR EACH ROW EXECUTE FUNCTION public.reject_inbound_receipt()',
  );
  const receiptFault = body('Inbound receipt rollback', d3.id);
  try {
    assert.equal((await request(ip(), 'POST', receiptFault)).status, 503);
  } finally {
    await owner.query(
      'DROP TRIGGER inbound_receipt_fault ON public.routing_receipts',
    );
    await owner.query('DROP FUNCTION public.reject_inbound_receipt()');
  }
  assert.equal(
    (
      await owner.query('SELECT id FROM public.inbound_rules WHERE name=$1', [
        receiptFault.name,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT request_id FROM public.routing_receipts WHERE request_id=$1',
        [receiptFault.requestId],
      )
    ).rowCount,
    0,
  );
  const receiptRecovered = await create(ip(), receiptFault);
  await remove(receiptRecovered);
  // Actual HTTPS console: keyboard creation, retained error input, lost response and stale recovery.
  const button = (name) => page.getByRole('button', { name, exact: true }),
    detail = page.getByRole('region', { name: 'Resource detail', exact: true });
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/peers`);
  await button('DIDs').click();
  await button('Inspect Inbound leading zero').click();
  await button('Remove DID').click();
  await button('Confirm removal').click();
  const dependency = page.getByRole('region', {
    name: 'Referencing inbound rules or resources',
    exact: true,
  });
  await expect(dependency).toContainText(exact.name);
  await dependency
    .getByRole('link', {
      name: `${exact.name} · manage in routing`,
      exact: true,
    })
    .click();
  await button('Inbound rules').click();
  await button('Create inbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser inbound');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
  }
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByLabel('Trusted gateway', { exact: false })
    .selectOption(g1.id);
  await page.getByLabel('DID selector', { exact: false }).selectOption(d1.id);
  await page.getByLabel(/^Name/).fill('   ');
  await button('Save inbound rule').click();
  await expect(page.getByLabel(/^Name/)).toBeFocused();
  await expect(page.getByLabel(/^Name/)).toHaveValue('   ');
  await page.getByLabel(/^Name/).fill('Browser inbound');
  await button('Save inbound rule').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'already claimed' }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser inbound');
  await page
    .getByLabel('Trusted gateway', { exact: false })
    .selectOption(g2.id);
  await page
    .getByLabel('DID selector', { exact: false })
    .selectOption(foreign.id);
  await page
    .getByLabel('Inbound destination', { exact: false })
    .selectOption('extension');
  const destinationSelect = page.getByLabel('Destination resource', {
    exact: false,
  });
  await expect
    .poll(() => destinationSelect.locator('option').count())
    .toBeGreaterThan(1);
  if (!(await destinationSelect.locator(`option[value="${e1.id}"]`).count()))
    await button('More extensions').click();
  await destinationSelect.selectOption(e1.id);
  ingress.drop(ip(), 'POST');
  await button('Save inbound rule').focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser inbound');
  await button('Retry exact create request').click();
  await expect(detail).toContainText('Browser inbound');
  const browserRule = (
    await owner.query(
      "SELECT id FROM public.inbound_rules WHERE name='Browser inbound'",
    )
  ).rows[0].id;
  await button('Enable inbound rule').click();
  await expect(button('Disable inbound rule')).toBeVisible();
  await page.getByLabel('Sample dialled number', { exact: false }).fill('456');
  await button('Preview inbound match').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'matched · exact' }),
  ).toBeVisible();
  await button('Edit inbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser inbound edited');
  const current = (await request(ip(browserRule))).data.resource;
  await request(ip(browserRule, 'status'), 'PATCH', {
    expectedVersion: current.version,
    enabled: false,
  });
  await button('Save inbound rule').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await button('Reload canonical state').click();
  await button('Use current version').click();
  await button('Save inbound rule').click();
  await expect(detail).toContainText('Browser inbound edited');
  await button('Edit inbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser inbound response loss');
  ingress.drop(ip(browserRule), 'PATCH');
  await button('Save inbound rule').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue(
    'Browser inbound response loss',
  );
  await button('Reload canonical state').click();
  await button('Use current version').click();
  await button('Save inbound rule').click();
  await expect(detail).toContainText('Browser inbound response loss');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
  }
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  await button('Remove inbound rule').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  console.log('CHECK inbound: dependency-ordered fixture removal');
  await remove(gr);
  assert.equal(
    (
      await request(`${root}/routing/groups/${group.id}/remove`, 'POST', {
        expectedVersion: 1,
      })
    ).status,
    200,
  );
  await remove(exact);
  await remove(catchall);
  const replacement = await create(ip(), body('Inbound replacement', d1.id));
  assert.notEqual(replacement.id, exact.id);
  assert.notDeepEqual(
    routeIdentity(installation, replacement.id),
    routeIdentity(installation, exact.id),
  );
  await remove(replacement);
  // Dependencies release only after rule removal; compatible names/status preserve identity.
  const releasedDid = await request(pp('dids', d1.id), 'PATCH', {
    expectedVersion: d1.version,
    name: d1.name,
    number: d1.number,
    gatewayId: g2.id,
  });
  assert.equal(releasedDid.status, 200, JSON.stringify(releasedDid));
  d1.version = releasedDid.data.resource.version;
  const historical = (await request(ip(exact.id))).data.resource;
  assert.equal(historical.gatewayId, g1.id);
  assert.equal(historical.didId, d1.id);
  assert.ok(historical.removedAt);
  for (const d of [d1, d2, d3, foreign])
    assert.equal(
      (
        await request(pp('dids', d.id, 'remove'), 'POST', {
          expectedVersion: d.version,
        })
      ).status,
      200,
    );
  for (const g of [g1, g2])
    assert.equal(
      (
        await request(pp('gateways', g.id, 'remove'), 'POST', {
          expectedVersion: 1,
        })
      ).status,
      200,
    );
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log(
    'PASS inbound real PostgreSQL/two replicas/API/HTTPS browser: trusted selectors, significant numbers, precedence, disabled claims, destinations, dependency races, exact replay, no-op/stale/rollback, internal identities and fixture-only tenant compatibility, lost response recovery, keyboard/reflow/axe, desired-only offline operation.',
  );
}
