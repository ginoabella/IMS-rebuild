import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { outboundTenantCompatible, routeIdentity } = backend(
  './dist/modules/telephony/domain/route-identity.js',
);
const { outboundValues, transformedDomain, intersects } = backend(
  './dist/modules/telephony/domain/routing.js',
);
export async function checkOutboundRouting({
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
}) {
  console.log(
    'CHECK outbound: full domains, priorities, reservations, references and recovery',
  );
  const root = `/platform/pbx-nodes/${nodeId}`,
    op = (id = '', action = '') =>
      `${root}/routing/outbound${id ? '/' + id : ''}${action ? '/' + action : ''}`;
  const rp = (id = '', action = '') =>
    `${root}/routing/reservations${id ? '/' + id : ''}${action ? '/' + action : ''}`;
  const tp = (id = '', action = '') =>
    `${root}/peers/trunks${id ? '/' + id : ''}${action ? '/' + action : ''}`;
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
  const settings = {
    host: 'outbound.invalid',
    port: 5060,
    transport: 'udp',
    media: 'rtp',
    codecs: ['ulaw'],
    directMedia: false,
    rtpSymmetric: true,
    forceRport: true,
    authentication: 'ip-peer',
  };
  const trunkBody = (name, direction = 'both') => ({
    requestId: randomUUID(),
    name,
    direction,
    settings,
  });
  let trunk = await create(tp(), trunkBody('Outbound primary'));
  const inbound = await create(
    tp(),
    trunkBody('Outbound inbound-only', 'inbound'),
  );
  const body = (name, pattern = exact('9123'), more = {}) => ({
    requestId: randomUUID(),
    name,
    pattern,
    trunkId: trunk.id,
    priority: 100,
    stripCount: 0,
    addPrefix: '',
    ...more,
  });
  const values = (r) => ({
    name: r.name,
    pattern: r.pattern,
    trunkId: r.trunkId,
    priority: r.priority,
    stripCount: r.stripCount,
    addPrefix: r.addPrefix,
  });
  const remove = (r) =>
    request(op(r.id, 'remove'), 'POST', { expectedVersion: r.version });
  const preview = (dialled) => request(op('preview'), 'POST', { dialled });
  const reservation = (name, pattern) => ({
    requestId: randomUUID(),
    name,
    purpose: 'Outbound protection',
    pattern,
  });
  for (const bad of [
    body('Bad syntax', exact('_X.')),
    body('Bad plus', exact('+123')),
    body('Bad newline', exact('123\n')),
    body('Bad prefix newline', exact('123'), { addPrefix: '1\n' }),
    body('Bad length', prefix('9', 1, 16)),
    body('Strip underflow', exact('9'), { stripCount: 2 }),
    body('Empty output', exact('9'), { stripCount: 1 }),
    body('Oversized output', prefix('9', 1, 15), { addPrefix: '1' }),
    body('Bad add', exact('9'), { addPrefix: '+' }),
    body('Negative priority', exact('9'), { priority: -1 }),
    body('Inbound trunk', exact('9'), { trunkId: inbound.id }),
    body('Unknown trunk', exact('9'), { trunkId: randomUUID() }),
    body('Tenant input', exact('9'), { tenantId: randomUUID() }),
    body('Opaque key', exact('9'), { sourceKey: 'browser' }),
  ]) {
    assert.ok(
      [400, 409].includes((await request(op(), 'POST', bad)).status),
      JSON.stringify(bad),
    );
  }
  assert.equal((await request(op() + '?limit=101')).status, 400);
  assert.equal(
    (await request(op(), 'POST', body('CSRF'), { 'X-Platform-CSRF': 'wrong' }))
      .status,
    403,
  );
  const staffToken = (await issue(a, staffFacts)).token;
  assert.equal(
    (
      await direct(
        b,
        op(),
        'POST',
        body('Wrong plane'),
        `__Host-myims-platform=${staffToken}`,
      )
    ).status,
    403,
  );
  const foreign = await create(
    `/platform/pbx-nodes/${otherNode}/peers/trunks`,
    trunkBody('Foreign outbound'),
  );
  assert.equal(
    (
      await request(
        op(),
        'POST',
        body('Foreign trunk', exact('9'), { trunkId: foreign.id }),
      )
    ).data.reason,
    'invalid_trunk',
  );
  let broad = await create(
    op(),
    body('Outbound prefix', prefix('9', 3, 5), {
      stripCount: 1,
      addPrefix: '00',
    }),
  );
  assert.equal(broad.enabled, false);
  assert.equal((await preview('9123')).data.reason, 'disabled_rule');
  assert.equal((await preview('9123')).data.transformed, '00123');
  for (const n of ['91', '912345', '8123'])
    assert.equal((await preview(n)).data.reason, 'no_match');
  assert.equal(
    (await request(op(), 'POST', body('Equal overlap', exact('9123')))).data
      .reason,
    'priority_conflict',
  );
  let specific = await create(
    op(),
    body('Outbound exact', exact('9123'), { priority: 10 }),
  );
  const sqlId = randomUUID(),
    sqlKeys = routeIdentity(installation, sqlId);
  await assert.rejects(
    owner.query(
      `INSERT INTO public.outbound_rules(id,node_id,installation_id,name,trunk_id,pattern_kind,digits,min_length,max_length,priority,source_key,context_hash,watch_identity,attribution_key,created_by,updated_by) SELECT $1,node_id,installation_id,'SQL overlap',trunk_id,pattern_kind,digits,min_length,max_length,priority,$3,$4,$5,$6,created_by,updated_by FROM public.outbound_rules WHERE id=$2`,
      [
        sqlId,
        specific.id,
        sqlKeys.sourceKey,
        sqlKeys.contextHash,
        sqlKeys.watchIdentity,
        sqlKeys.attributionKey,
      ],
    ),
    (e) => e.code === '23P01',
  );
  assert.equal((await preview('9123')).data.rule.id, specific.id);
  assert.equal((await preview('999')).data.rule.id, broad.id);
  assert.equal((await preview('99999')).data.rule.id, broad.id);
  specific = (
    await request(op(specific.id, 'status'), 'PATCH', {
      expectedVersion: 1,
      enabled: true,
    })
  ).data.resource;
  assert.equal((await preview('9123')).data.reason, 'unavailable_trunk');
  trunk = (
    await request(tp(trunk.id, 'status'), 'PATCH', {
      expectedVersion: 1,
      enabled: true,
    })
  ).data.resource;
  assert.equal((await preview('9123')).data.reason, 'matched');
  const keys = (
    await owner.query(
      'SELECT source_key,context_hash,watch_identity,attribution_key FROM public.outbound_rules WHERE id=$1',
      [specific.id],
    )
  ).rows[0];
  const generated = routeIdentity(installation, specific.id);
  assert.deepEqual(Object.values(keys), Object.values(generated));
  assert.notDeepEqual(generated, routeIdentity(installation, randomUUID()));
  const noOpAudits = Number(
    (
      await owner.query(
        "SELECT count(*) AS count FROM public.audit_events WHERE metadata->>'resourceId'=$1",
        [specific.id],
      )
    ).rows[0].count,
  );
  let result = await request(op(specific.id), 'PATCH', {
    ...values(specific),
    expectedVersion: specific.version,
  });
  assert.equal(result.data.resource.version, specific.version);
  assert.equal(
    Number(
      (
        await owner.query(
          "SELECT count(*) AS count FROM public.audit_events WHERE metadata->>'resourceId'=$1",
          [specific.id],
        )
      ).rows[0].count,
    ),
    noOpAudits,
  );
  result = await request(op(specific.id), 'PATCH', {
    ...values(specific),
    name: 'Outbound renamed',
    expectedVersion: specific.version,
  });
  specific = result.data.resource;
  assert.deepEqual(
    (
      await owner.query(
        'SELECT source_key,context_hash,watch_identity,attribution_key FROM public.outbound_rules WHERE id=$1',
        [specific.id],
      )
    ).rows[0],
    keys,
  );
  assert.equal(
    (
      await request(op(specific.id), 'PATCH', {
        ...values(specific),
        expectedVersion: 1,
      })
    ).data.reason,
    'stale_version',
  );
  for (const p of [exact('9123'), exact('00123')])
    assert.equal(
      (
        await request(
          rp(),
          'POST',
          reservation('Existing domain reservation', p),
        )
      ).data.reason,
      'number_conflict',
    );
  const reserved = await create(
    rp(),
    reservation('Outbound reserved', prefix('55', 3, 5)),
  );
  for (const v of [
    body('Reserved input', exact('551')),
    body('Reserved output', exact('811'), { stripCount: 1, addPrefix: '55' }),
  ])
    assert.equal(
      (await request(op(), 'POST', v)).data.reason,
      'reserved_number',
    );
  // Stripping beyond the fixed prefix leaves an unconstrained suffix domain.
  const transformed = transformedDomain(
    outboundValues(
      body('Whole domain', prefix('7', 3, 3), {
        stripCount: 2,
        addPrefix: '55',
      }),
    ),
  );
  assert.equal(transformed.digits, '55');
  assert.ok(intersects(transformed, exact('551')));
  assert.equal(
    (
      await request(
        op(),
        'POST',
        body('Suffix bypass', prefix('7', 3, 3), {
          stripCount: 2,
          addPrefix: '55',
        }),
      )
    ).data.reason,
    'reserved_number',
  );
  for (const change of [
    { direction: 'inbound', settings },
    { direction: 'both', settings: { ...settings, host: 'changed.invalid' } },
  ])
    assert.equal(
      (
        await request(tp(trunk.id), 'PATCH', {
          name: trunk.name,
          ...change,
          expectedVersion: trunk.version,
        })
      ).data.reason,
      'referenced',
    );
  assert.equal(
    (
      await request(tp(trunk.id, 'remove'), 'POST', {
        expectedVersion: trunk.version,
      })
    ).data.reason,
    'referenced',
  );
  const binding = {
    installationId: installation,
    routeId: specific.id,
    version: specific.version,
    tenantId: randomUUID(),
    trunkId: trunk.id,
    enabled: true,
  };
  const facts = new Map([
    [
      specific.id,
      {
        installationId: installation,
        tenantId: binding.tenantId,
        eligible: true,
        permittedTenantIds: [],
      },
    ],
    [
      trunk.id,
      {
        installationId: installation,
        tenantId: null,
        eligible: true,
        permittedTenantIds: [binding.tenantId],
      },
    ],
  ]);
  assert.equal(outboundTenantCompatible(binding, facts), true);
  for (const override of [
    { permittedTenantIds: [] },
    { tenantId: randomUUID() },
    { installationId: randomUUID() },
    { eligible: false },
  ]) {
    const denied = new Map(facts);
    denied.set(trunk.id, { ...facts.get(trunk.id), ...override });
    assert.equal(outboundTenantCompatible(binding, denied), false);
  }
  assert.equal(
    outboundTenantCompatible({ ...binding, tenantId: null }, facts),
    false,
  );
  const replay = body('Outbound replay', exact('60001'));
  const retries = await Promise.all([
    direct(a, op(), 'POST', replay),
    direct(b, op(), 'POST', replay),
  ]);
  assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
  assert.equal(retries[0].data.resource.id, retries[1].data.resource.id);
  assert.equal(
    (await request(op(), 'POST', { ...replay, name: 'Changed replay' })).data
      .reason,
    'request_conflict',
  );
  await remove(retries[0].data.resource);
  for (let i = 0; i < 3; i++) {
    const race = await Promise.all([
      direct(a, op(), 'POST', body('Overlap A ' + i, exact('6100' + i))),
      direct(b, op(), 'POST', body('Overlap B ' + i, exact('6100' + i))),
    ]);
    assert.deepEqual(
      race.map((r) => r.status).sort(),
      [201, 409],
      JSON.stringify(race),
    );
    await remove(race.find((r) => r.status === 201).data.resource);
  }
  for (const transformed of [false, true]) {
    const rule = body(
      'Reservation race ' + transformed,
      exact(transformed ? '62002' : '62001'),
      transformed ? { stripCount: 1, addPrefix: '88' } : {},
    );
    const reservedPattern = exact(transformed ? '882002' : '62001');
    const race = await Promise.all([
      direct(a, op(), 'POST', rule),
      direct(
        b,
        rp(),
        'POST',
        reservation('Reservation race ' + transformed, reservedPattern),
      ),
    ]);
    assert.deepEqual(
      race.map((r) => r.status).sort(),
      [201, 409],
      JSON.stringify(race),
    );
    if (race[0].status === 201) await remove(race[0].data.resource);
    else
      await request(rp(race[1].data.resource.id, 'remove'), 'POST', {
        expectedVersion: 1,
      });
  }
  const removable = await create(tp(), trunkBody('Trunk removal race'));
  const removalRace = await Promise.all([
    direct(
      a,
      op(),
      'POST',
      body('Trunk reference race', exact('63001'), { trunkId: removable.id }),
    ),
    direct(b, tp(removable.id, 'remove'), 'POST', { expectedVersion: 1 }),
  ]);
  assert.ok(
    (removalRace[0].status === 201 && removalRace[1].status === 409) ||
      (removalRace[0].status === 409 && removalRace[1].status === 200),
    JSON.stringify(removalRace),
  );
  if (removalRace[0].status === 201) {
    await remove(removalRace[0].data.resource);
    await request(tp(removable.id, 'remove'), 'POST', { expectedVersion: 1 });
  }
  assert.equal(
    (
      await request(
        op(),
        'POST',
        body('Already removed trunk', exact('63004'), {
          trunkId: removable.id,
        }),
      )
    ).data.reason,
    'invalid_trunk',
  );
  const editTarget = await create(tp(), trunkBody('Trunk edit reference race'));
  const changing = await create(
    op(),
    body('Changing trunk reference', exact('63002')),
  );
  const referenceEdit = await Promise.all([
    direct(a, op(changing.id), 'PATCH', {
      ...values(changing),
      trunkId: editTarget.id,
      expectedVersion: 1,
    }),
    direct(b, tp(editTarget.id, 'remove'), 'POST', { expectedVersion: 1 }),
  ]);
  assert.deepEqual(
    referenceEdit.map((r) => r.status).sort(),
    [200, 409],
    JSON.stringify(referenceEdit),
  );
  await remove((await request(op(changing.id))).data.resource);
  if (referenceEdit[0].status === 200)
    assert.equal(
      (
        await request(tp(editTarget.id, 'remove'), 'POST', {
          expectedVersion: 1,
        })
      ).status,
      200,
    );
  const directionTarget = await create(tp(), trunkBody('Trunk direction race'));
  const directionRace = await Promise.all([
    direct(
      a,
      op(),
      'POST',
      body('Direction reference race', exact('63003'), {
        trunkId: directionTarget.id,
      }),
    ),
    direct(b, tp(directionTarget.id), 'PATCH', {
      name: directionTarget.name,
      direction: 'inbound',
      settings,
      expectedVersion: 1,
    }),
  ]);
  assert.ok(
    (directionRace[0].status === 201 && directionRace[1].status === 409) ||
      (directionRace[0].status === 409 && directionRace[1].status === 200),
    JSON.stringify(directionRace),
  );
  if (directionRace[0].status === 201)
    await remove(directionRace[0].data.resource);
  assert.equal(
    (
      await request(tp(directionTarget.id, 'remove'), 'POST', {
        expectedVersion: directionRace[1].status === 200 ? 2 : 1,
      })
    ).status,
    200,
  );
  await owner.query(
    `CREATE FUNCTION public.reject_outbound_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.routing.desired-changed' AND NEW.metadata->>'resourceKind'='outbound' THEN RAISE EXCEPTION 'outbound fault'; END IF; RETURN NEW; END $$`,
  );
  await owner.query(
    'CREATE TRIGGER outbound_audit_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_outbound_audit()',
  );
  const rollback = body('Outbound rollback', exact('64001'));
  try {
    assert.equal((await request(op(), 'POST', rollback)).status, 503);
  } finally {
    await owner.query(
      'DROP TRIGGER outbound_audit_fault ON public.audit_events',
    );
    await owner.query('DROP FUNCTION public.reject_outbound_audit()');
  }
  assert.equal(
    (
      await owner.query('SELECT id FROM public.outbound_rules WHERE name=$1', [
        rollback.name,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT request_id FROM public.routing_receipts WHERE request_id=$1',
        [rollback.requestId],
      )
    ).rows.length,
    0,
  );
  const editA = await create(op(), body('Edit overlap A', exact('66001'))),
    editB = await create(op(), body('Edit overlap B', exact('66002')));
  const editRace = await Promise.all([
    direct(a, op(editA.id), 'PATCH', {
      ...values(editA),
      pattern: exact('66003'),
      expectedVersion: 1,
    }),
    direct(b, op(editB.id), 'PATCH', {
      ...values(editB),
      pattern: exact('66003'),
      expectedVersion: 1,
    }),
  ]);
  assert.deepEqual(
    editRace.map((r) => r.status).sort(),
    [200, 409],
    JSON.stringify(editRace),
  );
  await remove((await request(op(editA.id))).data.resource);
  await remove((await request(op(editB.id))).data.resource);
  const editReservation = await create(
    rp(),
    reservation('Reservation edit race', exact('67001')),
  );
  const er = await Promise.all([
    direct(
      a,
      op(),
      'POST',
      body('Rule against reservation edit', exact('67002')),
    ),
    direct(b, rp(editReservation.id), 'PATCH', {
      ...reservation(editReservation.name, exact('67002')),
      requestId: undefined,
      expectedVersion: 1,
    }),
  ]);
  assert.ok(
    (er[0].status === 201 && er[1].status === 409) ||
      (er[0].status === 409 && er[1].status === 200),
    JSON.stringify(er),
  );
  if (er[0].status === 201) await remove(er[0].data.resource);
  await request(rp(editReservation.id, 'remove'), 'POST', {
    expectedVersion: er[1].status === 200 ? 2 : 1,
  });
  await remove(specific);
  await remove(broad);
  await request(rp(reserved.id, 'remove'), 'POST', { expectedVersion: 1 });
  console.log(
    'CHECK outbound: actual HTTPS management, preview and narrow-screen keyboard access',
  );
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/routing`);
  const button = (name) => page.getByRole('button', { name, exact: true });
  await button('Outbound rules').click();
  await button('Create outbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser outbound');
  await page.getByLabel('ASCII digits').fill('65001');
  await expect
    .poll(() => page.getByLabel('Outbound trunk').locator('option').count())
    .toBeGreaterThan(1);
  await page.getByLabel('Outbound trunk').selectOption(trunk.id);
  await page.getByLabel('Leading digits to strip').fill('1');
  await page.getByLabel('Digit prefix to add').fill('00');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
  }
  await page.getByLabel('Priority (lower wins)').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Outbound trunk')).toBeFocused();
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
  await page.getByLabel('Leading digits to strip').fill('99');
  await button('Save outbound rule').click();
  await expect(page.getByLabel('Leading digits to strip')).toBeFocused();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser outbound');
  await page.getByLabel('Leading digits to strip').fill('1');
  ingress.drop(op(), 'POST');
  await button('Save outbound rule').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await button('Retry exact create request').click();
  await expect(button('Edit outbound rule')).toBeVisible();
  await page.getByLabel('Sample outbound number').fill('65001');
  await button('Preview outbound match').click();
  await expect(page.getByText(/transformed number 005001/)).toBeVisible();
  await button('Enable outbound rule').click();
  await expect(button('Disable outbound rule')).toBeVisible();
  await button('Edit outbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser outbound renamed');
  await button('Save outbound rule').click();
  await expect(button('Edit outbound rule')).toBeVisible();
  // Lost edit response uses the shared canonical review path with retained inputs.
  await button('Edit outbound rule').click();
  await page.getByLabel(/^Name/).fill('Browser outbound uncertain');
  const browserRule = (
    await owner.query(
      "SELECT id FROM public.outbound_rules WHERE name='Browser outbound renamed' AND removed_at IS NULL",
    )
  ).rows[0].id;
  ingress.drop(op(browserRule), 'PATCH');
  await button('Save outbound rule').click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue(
    'Browser outbound uncertain',
  );
  await button('Reload canonical state').click();
  await button('Use current version').click();
  await button('Save outbound rule').click();
  await expect(button('Edit outbound rule')).toBeVisible();
  await button('Disable outbound rule').click();
  await expect(button('Enable outbound rule')).toBeVisible();
  await button('Remove outbound rule').click();
  await button('Confirm removal').click();
  await expect(
    page.getByRole('region', { name: 'Resource detail' }).getByText(/Removed/),
  ).toBeVisible();
  assert.equal(
    (
      await request(tp(trunk.id, 'remove'), 'POST', {
        expectedVersion: trunk.version,
      })
    ).status,
    200,
  );
  console.log(
    'PASS outbound: real PostgreSQL/two replicas/API/browser grammar, precedence, transforms, reservations, references, identities, fixture tenant permissions, recovery and passive preview.',
  );
}
