import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });

export async function checkDidInventory({
  request,
  direct,
  create,
  path,
  foreign,
  a,
  b,
  owner,
  session,
  staffToken,
}) {
  const gateway = (name, address) => ({
    requestId: randomUUID(),
    name,
    kind: 'sip-device',
    trunkId: null,
    sourceAddresses: [address],
  });
  const ingress = await create(
    path('gateways'),
    gateway('DID ingress', '192.0.2.151'),
  );
  const alternate = await create(
    path('gateways'),
    gateway('Alternate DID ingress', '192.0.2.152'),
  );
  const foreignGateway = await create(
    foreign + '/gateways',
    gateway('Foreign DID ingress', '192.0.2.151'),
  );
  const did = (name, number, gatewayId = ingress.id) => ({
    requestId: randomUUID(),
    name,
    number,
    gatewayId,
  });
  const intent = did('Canonical DID', ' +63 (2) 8123-4567 ');
  const original = await create(path('dids'), intent);
  assert.equal(original.number, '+63281234567');
  assert.equal(original.enabled, false);
  assert.equal(
    (await request(path('dids'), 'POST', { ...intent, number: '+63281234567' }))
      .data.resource.id,
    original.id,
  );
  assert.equal(
    (await request(path('dids'), 'POST', { ...intent, number: '9' })).data
      .reason,
    'request_conflict',
  );
  assert.equal(
    (
      await request(
        path('dids'),
        'POST',
        did('Equivalent', '+63 2 8123 4567', alternate.id),
      )
    ).data.reason,
    'number_conflict',
  );
  for (const [i, number] of [
    '0281234567',
    '281234567',
    '+0281234567',
    '0',
    '+0',
    '123456789012345',
  ].entries())
    assert.equal(
      (await create(path('dids'), did(`Distinct ${i}`, number))).number,
      number,
    );
  assert.equal(
    (
      await create(
        foreign + '/dids',
        did('Other installation', original.number, foreignGateway.id),
      )
    ).number,
    original.number,
  );
  for (const number of [
    '',
    '+',
    '1234567890123456',
    '++1',
    '1+2',
    '１２３',
    '١٢٣',
    '1\t2',
    '1\n2',
    '1\u00a02',
    '1.2',
    'sip:123',
    '123;context=x',
  ]) {
    const r = await direct(
      a,
      path('dids'),
      'POST',
      did(`Invalid ${randomUUID()}`, number),
    );
    assert.equal(r.status, 400, JSON.stringify(r));
    assert.ok(r.data.fieldErrors.number);
  }
  for (const gatewayId of [foreignGateway.id, randomUUID()])
    assert.equal(
      (
        await request(
          path('dids'),
          'POST',
          did('Invalid gateway', '100', gatewayId),
        )
      ).data.reason,
      'invalid_gateway',
    );
  assert.equal(
    (
      await request(path('dids'), 'POST', {
        ...did('Unknown field', '100'),
        destination: 'tenant',
      })
    ).status,
    400,
  );
  assert.equal(
    (await request(path('dids'), 'POST', did(' canonical did ', '100'))).data
      .reason,
    'name_conflict',
  );
  assert.equal(
    (
      await request(path('dids', original.id), 'PATCH', {
        expectedVersion: 1,
        name: original.name,
        number: '+63 (2) 8123-4567',
        gatewayId: ingress.id,
      })
    ).data.resource.version,
    1,
  );
  let result = await request(path('gateways', ingress.id, 'remove'), 'POST', {
    expectedVersion: 1,
  });
  assert.equal(result.data.reason, 'referenced');
  assert.ok(result.data.blockers.some((r) => r.id === original.id));
  result = await request(path('gateways', ingress.id), 'PATCH', {
    expectedVersion: 1,
    name: ingress.name,
    kind: 'sip-device',
    trunkId: null,
    sourceAddresses: ['192.0.2.153'],
  });
  assert.equal(result.data.reason, 'referenced');
  const renamed = await request(path('gateways', ingress.id), 'PATCH', {
    expectedVersion: 1,
    name: 'Renamed DID ingress',
    kind: 'sip-device',
    trunkId: null,
    sourceAddresses: ingress.sourceAddresses,
  });
  assert.equal(renamed.status, 200);
  result = await request(path('dids', original.id), 'PATCH', {
    expectedVersion: 1,
    name: 'Edited DID',
    number: '+63 (2) 8000-0001',
    gatewayId: alternate.id,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.resource.gatewayId, alternate.id);
  assert.equal(
    (
      await request(path('dids', original.id, 'status'), 'PATCH', {
        expectedVersion: 1,
        enabled: true,
      })
    ).data.reason,
    'stale_version',
  );
  result = await request(path('dids', original.id, 'status'), 'PATCH', {
    expectedVersion: 2,
    enabled: true,
  });
  assert.equal(result.data.resource.version, 3);
  result = await request(path('dids', original.id, 'status'), 'PATCH', {
    expectedVersion: 3,
    enabled: false,
  });
  assert.equal(result.data.resource.version, 4);
  assert.equal(
    (
      await request(path('dids', original.id, 'status'), 'PATCH', {
        expectedVersion: 4,
        enabled: false,
      })
    ).data.resource.version,
    4,
  );
  assert.equal(
    (
      await request(
        path('dids'),
        'POST',
        did('Disabled collision', '+63280000001'),
      )
    ).data.reason,
    'number_conflict',
  );
  assert.equal(
    (
      await request(path('dids', original.id, 'remove'), 'POST', {
        expectedVersion: 4,
      })
    ).status,
    200,
  );
  assert.ok((await request(path('dids', original.id))).data.resource.removedAt);
  const reused = await create(path('dids'), did('Edited DID', '+63280000001'));
  assert.notEqual(reused.id, original.id);
  assert.equal(
    (
      await request(path('gateways', alternate.id, 'remove'), 'POST', {
        expectedVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        path('dids'),
        'POST',
        did('Removed link', '100', alternate.id),
      )
    ).data.reason,
    'invalid_gateway',
  );
  assert.equal(
    (
      await request(path('dids', original.id, 'status'), 'PATCH', {
        expectedVersion: 5,
        enabled: true,
      })
    ).status,
    404,
  );
  assert.equal((await request(foreign + '/dids/' + reused.id)).status, 404);
  assert.equal((await request(path('dids') + '?limit=1')).data.items.length, 1);
  assert.equal((await request(path('dids') + '?limit=101')).status, 400);
  assert.equal(
    (
      await request(path('dids'), 'POST', did('No csrf', '100'), {
        'X-Platform-CSRF': 'wrong',
      })
    ).status,
    403,
  );
  const staff = `__Host-myims-platform=${staffToken}`;
  assert.equal(
    (await direct(b, path('dids'), 'GET', undefined, staff)).status,
    403,
  );
  assert.equal(
    (await direct(b, path('dids'), 'POST', did('Staff denied', '100'), staff))
      .status,
    403,
  );
  const duplicate = did('Exact duplicate race', '150');
  const duplicates = await Promise.all([
    direct(a, path('dids'), 'POST', duplicate),
    direct(b, path('dids'), 'POST', duplicate),
  ]);
  assert.deepEqual(duplicates.map((r) => r.status).sort(), [200, 201]);
  assert.equal(duplicates[0].data.resource.id, duplicates[1].data.resource.id);
  const collisions = await Promise.all([
    direct(a, path('dids'), 'POST', did('Number race A', '+(1)-51')),
    direct(b, path('dids'), 'POST', did('Number race B', '+151')),
  ]);
  assert.deepEqual(collisions.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    collisions.find((r) => r.status === 409).data.reason,
    'number_conflict',
  );
  for (let i = 0; i < 5; i++) {
    const target = await create(
      path('gateways'),
      gateway(`DID race ${i}`, `192.0.2.${160 + i}`),
    );
    const race = await Promise.all([
      direct(
        a,
        path('dids'),
        'POST',
        did(`DID ref race ${i}`, `200${i}`, target.id),
      ),
      direct(b, path('gateways', target.id, 'remove'), 'POST', {
        expectedVersion: 1,
      }),
    ]);
    assert.ok(
      (race[0].status === 201 && race[1].status === 409) ||
        (race[0].status === 409 && race[1].status === 200),
      JSON.stringify(race),
    );
  }
  assert.equal(
    (
      await owner.query(
        'SELECT d.id FROM public.sip_dids d JOIN public.sip_gateways g ON g.id=d.gateway_id WHERE d.removed_at IS NULL AND g.removed_at IS NOT NULL',
      )
    ).rows.length,
    0,
  );
  await owner.query(
    `CREATE FUNCTION public.reject_did_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.sip-peer.desired-changed' AND NEW.metadata->>'resourceKind'='dids' THEN RAISE EXCEPTION 'injected audit rejection'; END IF; RETURN NEW; END; $$`,
  );
  await owner.query(
    'CREATE TRIGGER did_audit_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_did_audit()',
  );
  try {
    assert.equal(
      (await request(path('dids'), 'POST', did('DID audit rollback', '300')))
        .status,
      503,
    );
  } finally {
    await owner.query('DROP TRIGGER did_audit_fault ON public.audit_events');
    await owner.query('DROP FUNCTION public.reject_did_audit()');
  }
  assert.equal(
    (
      await owner.query(
        "SELECT id FROM public.sip_dids WHERE name='DID audit rollback'",
      )
    ).rows.length,
    0,
  );
  const audit = (
    await owner.query(
      "SELECT metadata,actor_reference FROM public.audit_events WHERE event_type='telephony.sip-peer.desired-changed' AND metadata->>'resourceId'=$1 ORDER BY (metadata->>'version')::integer",
      [original.id],
    )
  ).rows;
  assert.deepEqual(
    audit.map((r) => r.metadata.operation),
    ['create', 'edit', 'status', 'status', 'remove'],
  );
  assert.ok(
    audit.every(
      (r) =>
        r.actor_reference === session.operatorId &&
        r.metadata.resourceKind === 'dids',
    ),
  );
  // Check actual constraints directly, independent of application validation.
  for (const values of [
    [
      randomUUID(),
      'Bad number SQL',
      '1-2',
      ingress.id,
      ingress.nodeId,
      ingress.installationId,
    ],
    [
      randomUUID(),
      'Duplicate SQL',
      reused.number,
      ingress.id,
      ingress.nodeId,
      ingress.installationId,
    ],
    [
      randomUUID(),
      'Foreign link SQL',
      '301',
      foreignGateway.id,
      ingress.nodeId,
      ingress.installationId,
    ],
  ]) {
    await assert.rejects(
      owner.query(
        'INSERT INTO public.sip_dids(id,name,number,gateway_id,node_id,installation_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',
        [...values, session.operatorId],
      ),
      (e) => ['23514', '23505', '23503'].includes(e.code),
    );
  }
  console.log(
    'PASS P3-U3c real PostgreSQL/A/B API: exact normalization, plus/zero distinctions, uniqueness, ownership, no-op/stale/status/removal, retained identity/audit, audit rollback, duplicate and reference/removal races, protected paths.',
  );
}

export async function checkDidBrowser({
  page,
  request,
  path,
  owner,
  ingress,
  browserTrunk,
}) {
  const buttons = (name) => page.getByRole('button', { name, exact: true });
  const detail = page.getByRole('region', {
    name: 'Resource detail',
    exact: true,
  });
  const browserGateway = (
    await owner.query(
      "SELECT id FROM public.sip_gateways WHERE name='Browser provider'",
    )
  ).rows[0].id;
  console.log('CHECK DID browser: validation and exact lost-create recovery');
  await buttons('DIDs').click();
  await buttons('Create DID').click();
  await page.getByLabel(/^Name/).fill('Browser DID');
  await page.getByLabel(/^DID number/).fill('+63 (2) 8123-45xx');
  await page.getByLabel(/^Gateway ID/).fill(browserGateway);
  await buttons('Save DID').click();
  await expect(page.getByLabel(/^DID number/)).toBeFocused();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser DID');
  await page.getByLabel(/^DID number/).fill('+63 (2) 8123-4500');
  await expect(
    page.getByText('Canonical preview:', { exact: false }),
  ).toContainText('+63281234500');
  ingress.drop(path('dids'), 'POST');
  await buttons('Save DID').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await buttons('Retry exact create request').click();
  await expect(detail).toContainText('+63281234500');
  const didId = (
    await owner.query("SELECT id FROM public.sip_dids WHERE name='Browser DID'")
  ).rows[0].id;
  console.log('CHECK DID browser: status, keyboard edit and stale review');
  await buttons('Enable DID').click();
  await expect(buttons('Disable DID')).toBeVisible();
  await buttons('Disable DID').click();
  await expect(buttons('Enable DID')).toBeVisible();
  await buttons('Edit DID').focus();
  await page.keyboard.press('Enter');
  await page.getByLabel(/^DID number/).fill('0281234500');
  const current = (await request(path('dids', didId))).data.resource;
  await request(path('dids', didId, 'status'), 'PATCH', {
    expectedVersion: current.version,
    enabled: true,
  });
  await buttons('Save DID').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^DID number/)).toHaveValue('0281234500');
  await buttons('Reload canonical state').click();
  await buttons('Use current version').click();
  await buttons('Save DID').click();
  await expect(detail).toContainText('0281234500');
  await buttons('Create DID').click();
  console.log('CHECK DID browser: collision retention and responsive form');
  await page.getByLabel(/^Name/).fill('Browser duplicate');
  await page.getByLabel(/^DID number/).fill('(02) 8123-4500');
  await page.getByLabel(/^Gateway ID/).fill(browserGateway);
  await buttons('Save DID').click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'canonical number is already used' }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser duplicate');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      `DID form reflow ${width}`,
    );
  }
  assert.deepEqual(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
    [],
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  console.log(
    'CHECK DID browser: gateway blocker navigation and ordered removal',
  );
  await buttons('Gateways').click();
  await buttons('Inspect Browser provider').click();
  await buttons('Remove gateway').click();
  await buttons('Confirm removal').click();
  await expect(
    page.getByRole('region', { name: 'Referencing DIDs', exact: true }),
  ).toContainText('Browser DID');
  // A blocker opens the actual DID detail across tabs.
  await buttons('Browser DID').click();
  await expect(detail).toContainText(didId);
  await buttons('Remove DID').click();
  await buttons('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  await buttons('Gateways').click();
  await buttons('Inspect Browser provider').click();
  assert.equal(
    (
      await request(path('trunks', browserTrunk, 'remove'), 'POST', {
        expectedVersion: (await request(path('trunks', browserTrunk))).data
          .resource.version,
      })
    ).data.reason,
    'referenced',
  );
  console.log(
    'PASS P3-U3c actual HTTPS browser: trunk → gateway → DID, canonical help, validation/collision retention, lost-create retry, stale review, status/edit, actionable DID blocker navigation, dependency-ordered DID removal, keyboard, responsive form and axe.',
  );
}
