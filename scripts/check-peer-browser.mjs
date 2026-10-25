import { checkPbxRevisions } from './check-pbx-revisions.mjs';
import { checkRouting } from './check-routing.mjs';
// Real PostgreSQL + Redis + two production Nest replicas + HTTPS Next browser.
// PBX targets are deliberately unreachable .invalid names; no telephony process is started.
import assert from 'node:assert/strict';
import { checkDidInventory, checkDidBrowser } from './check-did-inventory.mjs';
import { checkSimpleTrunkCommand } from './check-simple-trunk-command.mjs';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
export async function checkPeerBrowser({
  routingOnly = false,
  revisionsOnly = false,
  expire,
  trunkAccess,
  holdResponse,
  page,
  context,
  config,
  owner,
  select,
  a,
  b,
  ingress,
  login,
  issue,
  staffFacts,
  redis,
  key,
}) {
  const session = await page.evaluate(async () =>
    (await fetch('/platform/auth/session')).json(),
  );
  const nodeId = randomUUID(),
    otherNode = randomUUID(),
    installation =
      trunkAccess?.installationId ?? 'f4000000-0000-4000-8000-000000000001';
  for (const [id, install] of [
    [nodeId, installation],
    [otherNode, randomUUID()],
  ])
    await owner.query(
      `INSERT INTO public.pbx_nodes(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by) VALUES($1,$2,'Offline peer fixture','offline-peer','offline-peer.invalid','ami-tls',5039,'offline-peer.invalid','offline-peer',$3,$3)`,
      [id, install, session.operatorId],
    );
  const base = `/platform/pbx-nodes/${nodeId}/peers`,
    foreign = `/platform/pbx-nodes/${otherNode}/peers`;
  const settings = {
    host: 'provider.invalid',
    port: 5060,
    transport: 'udp',
    media: 'rtp',
    codecs: ['ulaw', 'alaw'],
    directMedia: false,
    rtpSymmetric: true,
    forceRport: true,
    authentication: 'ip-peer',
  };
  const trunk = (name, more = {}) => ({
    requestId: randomUUID(),
    name,
    direction: 'both',
    settings,
    ...more,
  });
  const gateway = (name, sources, trunkId = null, kind = 'sip-device') => ({
    requestId: randomUUID(),
    name,
    kind,
    trunkId,
    sourceAddresses: sources,
  });
  async function request(path, method = 'GET', body, extra = {}) {
    return page.evaluate(
      async ({ path, method, body, extra }) => {
        const s = await (await fetch('/platform/auth/session')).json();
        const r = await fetch(path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Platform-CSRF': s.proof,
            ...extra,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return {
          status: r.status,
          data: await r.json(),
          cache: r.headers.get('cache-control'),
        };
      },
      { path, method, body, extra },
    );
  }
  async function direct(call, path, method = 'GET', body, cookieOverride) {
    const session = await page.evaluate(async () =>
      (await fetch('/platform/auth/session')).json(),
    );
    const cookie =
      cookieOverride ??
      (await context.cookies(config.origin))
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
    const response = await context.request.fetch(`${call.url}${path}`, {
      method,
      headers: {
        origin: config.origin,
        'x-platform-proxy': config.proxySecret,
        'x-forwarded-for': '192.0.2.10',
        cookie,
        'x-platform-csrf': session.proof,
        'content-type': 'application/json',
      },
      ...(body ? { data: body } : {}),
    });
    return { status: response.status(), data: await response.json() };
  }
  async function create(path, body) {
    const result = await request(path, 'POST', body);
    assert.equal(result.status, 201, JSON.stringify(result));
    return result.data.resource;
  }
  const path = (kind, id = '', suffix = '') =>
    `${base}/${kind}${id ? `/${id}` : ''}${suffix ? `/${suffix}` : ''}`;
  if (revisionsOnly) {
    await checkPbxRevisions({
      request,
      direct,
      nodeId,
      otherNode,
      installation,
      owner,
      session,
      page,
      context,
      config,
      a,
      b,
      holdResponse,
      issue,
      staffFacts,
      ingress,
      expire,
      login,
    });
    return;
  }
  if (routingOnly) {
    await checkRouting({
      request,
      direct,
      create,
      path: (...parts) =>
        `/platform/pbx-nodes/${nodeId}/routing/${parts.join('/')}`,
      nodeId,
      otherNode,
      installation,
      owner,
      session,
      page,
      context,
      config,
      ingress,
      a,
      b,
      issue,
      staffFacts,
      login,
      select,
      holdResponse,
    });
    return;
  }
  await checkSimpleTrunkCommand(owner, installation);
  // Metadata fixtures establish the SQL/API/browser boundary only. Real OpenBao
  // setup acceptance is deliberately tracked separately, never inferred here.
  const credentialId = randomUUID(),
    foreignCredential = randomUUID(),
    unavailableCredential = randomUUID();
  if (trunkAccess) {
    let settle;
    const finished = new Promise((resolve) => {
      settle = resolve;
    });
    const listener = (message) => {
      if (
        message.channel === 'myims_trunk_fixture' &&
        message.payload?.endsWith(`:${credentialId}`)
      )
        settle(message.payload.startsWith('ready:'));
    };
    owner.on('notification', listener);
    await owner.query('LISTEN myims_trunk_fixture');
    console.log(
      'SIMPLE_TRUNK_FIXTURE_REQUEST ' +
        JSON.stringify({
          installationId: installation,
          credentialId,
          database: owner.connectionParameters.database,
        }),
    );
    const timeout = setTimeout(() => settle(false), 120000);
    try {
      assert.equal(
        await finished,
        true,
        'trusted real OpenBao acceptance must finish before browser fixture mutations',
      );
    } finally {
      clearTimeout(timeout);
      owner.off('notification', listener);
      await owner.query('UNLISTEN myims_trunk_fixture');
    }
    console.log(
      'PASS real OpenBao command published actual versions directly into the browser fixture database.',
    );
  }
  for (const [id, install, available] of [
    [credentialId, installation, true],
    [
      foreignCredential,
      (
        await owner.query(
          'SELECT installation_id FROM public.pbx_nodes WHERE id=$1',
          [otherNode],
        )
      ).rows[0].installation_id,
      true,
    ],
    [unavailableCredential, installation, false],
  ]) {
    if (trunkAccess && id === credentialId) {
      await owner.query(
        'INSERT INTO public.sip_credential_versions(credential_id,material_version,available) VALUES($1,3,false)',
        [id],
      );
      continue;
    }
    await owner.query(
      'INSERT INTO public.sip_credentials(id,installation_id,label,available) VALUES($1,$2,$3,$4)',
      [id, install, `Credential ${id}`, available],
    );
    for (const version of [1, 2, 3])
      await owner.query(
        'INSERT INTO public.sip_credential_versions(credential_id,material_version,available) VALUES($1,$2,$3)',
        [id, version, version !== 3],
      );
  }
  await owner.query('BEGIN');
  try {
    await owner.query('SET LOCAL ROLE myims_runtime');
    await owner.query(
      'SELECT id FROM public.sip_credentials WHERE id=$1 FOR SHARE',
      [credentialId],
    );
    await owner.query(
      'SELECT credential_id FROM public.sip_credential_versions WHERE credential_id=$1 FOR SHARE',
      [credentialId],
    );
    await assert.rejects(
      owner.query('UPDATE public.sip_credentials SET id=id WHERE id=$1', [
        credentialId,
      ]),
      (e) => e.code === '42501',
    );
  } finally {
    await owner.query('ROLLBACK');
  }
  const digest = {
    ...settings,
    authentication: 'outbound-digest',
    credential: { id: credentialId, version: 1 },
  };
  const registration = {
    registrar: 'registrar.invalid',
    realm: 'synthetic.invalid',
    expiration: 3600,
    retryInterval: 60,
    forbiddenRetryInterval: 10,
  };
  const selections = await request(path('trunks') + '/credentials/selections');
  assert.equal(selections.status, 200);
  assert.ok(
    selections.data.items.some(
      (c) => c.id === credentialId && c.version === 1 && c.available,
    ),
  );
  assert.ok(!selections.data.items.some((c) => c.id === foreignCredential));
  assert.equal(
    (await request(path('trunks') + '/credentials/selections?extra=1')).status,
    400,
  );
  const authenticated = await create(
    path('trunks'),
    trunk('Digest API', { settings: digest }),
  );
  const registered = await create(
    path('trunks'),
    trunk('Registration API', { settings: { ...digest, registration } }),
  );
  assert.equal(authenticated.credentialStatus, 'selected');
  const rejectedSettings = [
    { ...digest, credential: { id: foreignCredential, version: 1 } },
    { ...digest, credential: { id: unavailableCredential, version: 1 } },
    { ...digest, credential: { id: randomUUID(), version: 1 } },
    { ...digest, credential: { id: credentialId, version: 3 } },
    { ...digest, credential: { id: credentialId, version: 99 } },
  ];
  for (const bad of rejectedSettings)
    assert.equal(
      (
        await request(
          path('trunks'),
          'POST',
          trunk('Invalid credential', { settings: bad }),
        )
      ).data.reason,
      'invalid_credential',
    );
  for (const bad of [
    { ...settings, credential: digest.credential },
    { ...settings, registration },
    { ...digest, registration: { ...registration, realm: '' } },
    {
      ...digest,
      registration: { ...registration, registrar: 'sip://invalid' },
    },
    { ...digest, registration: { ...registration, retryInterval: 1 } },
  ])
    assert.equal(
      (
        await request(
          path('trunks'),
          'POST',
          trunk('Incompatible', { settings: bad }),
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await request(
        path('trunks'),
        'POST',
        trunk('Inbound digest', { direction: 'inbound', settings: digest }),
      )
    ).status,
    400,
  );
  await create(
    path('gateways'),
    gateway(
      'Digest gateway',
      ['192.0.2.101'],
      authenticated.id,
      'sip-provider',
    ),
  );
  const outboundReference = await create(
    `/platform/pbx-nodes/${nodeId}/routing/outbound`,
    {
      requestId: randomUUID(),
      name: 'Credential adoption outbound reference',
      pattern: {
        kind: 'exact',
        digits: '987654321',
        minLength: 9,
        maxLength: 9,
      },
      priority: 100,
      trunkId: authenticated.id,
      stripCount: 0,
      addPrefix: '',
    },
  );
  const adopted = await request(path('trunks', authenticated.id), 'PATCH', {
    expectedVersion: 1,
    name: authenticated.name,
    direction: 'both',
    settings: { ...digest, credential: { id: credentialId, version: 2 } },
  });
  assert.equal(adopted.status, 200);
  assert.equal(adopted.data.resource.settings.credential.version, 2);
  assert.equal(
    (
      await request(
        `/platform/pbx-nodes/${nodeId}/routing/outbound/${outboundReference.id}`,
      )
    ).data.resource.trunkId,
    authenticated.id,
  );
  assert.equal(
    (
      await request(
        `/platform/pbx-nodes/${nodeId}/routing/outbound/${outboundReference.id}/remove`,
        'POST',
        { expectedVersion: 1 },
      )
    ).status,
    200,
  );

  assert.equal(
    (await request(path('trunks', registered.id))).data.resource.settings
      .credential.version,
    1,
  );
  assert.equal(
    (
      await request(path('trunks', authenticated.id), 'PATCH', {
        expectedVersion: 1,
        name: authenticated.name,
        direction: 'both',
        settings: digest,
      })
    ).data.reason,
    'stale_version',
  );
  const retained = await owner.query(
    'SELECT material_version FROM public.sip_credential_versions WHERE credential_id=$1 ORDER BY material_version',
    [credentialId],
  );
  assert.deepEqual(
    retained.rows.map((r) => r.material_version),
    [1, 2, 3],
  );
  console.log(
    'PASS P3-U3b real SQL/API metadata fixtures: bounded choices, installation/purpose/availability/version checks, digest/registration validation, explicit version adoption and old selection retention. Provider setup not established by fixtures.',
  );
  select(a);
  const intent = trunk('API primary');
  const original = await create(path('trunks'), intent);
  assert.equal(original.enabled, false);
  assert.equal(original.credentialStatus, 'not_required');
  select(b);
  assert.equal(
    (await request(path('trunks'), 'POST', intent)).data.resource.id,
    original.id,
  );
  assert.equal(
    (await request(path('trunks'), 'POST', { ...intent, name: 'Different' }))
      .data.reason,
    'request_conflict',
  );
  for (const invalid of [
    trunk('API primary'),
    trunk(' api PRIMARY '),
    trunk('Invalid', {
      settings: { ...settings, host: 'https://bad.invalid' },
    }),
    trunk('Invalid', { settings: { ...settings, authentication: 'digest' } }),
    trunk('Invalid', { settings: { ...settings, codecs: ['opus'] } }),
    trunk('Invalid', { settings: { ...settings, port: 0 } }),
    trunk('Invalid', { settings: { ...settings, directMedia: true } }),
    trunk('Invalid', { unknown: 'raw config' }),
    trunk('bad\nname'),
  ])
    assert.ok(
      [400, 409].includes(
        (await request(path('trunks'), 'POST', invalid)).status,
      ),
    );
  assert.equal(
    (
      await request(
        path('gateways'),
        'POST',
        gateway('Reserved source', ['192.0.2.250']),
      )
    ).data.reason,
    'reserved_source',
  );
  const provider = await create(
    path('gateways'),
    gateway('API provider', ['2001:0db8:0:0::1'], original.id, 'sip-provider'),
  );
  assert.deepEqual(provider.sourceAddresses, ['2001:db8::1']);
  assert.equal(
    (
      await request(
        path('gateways'),
        'POST',
        gateway('Overlap', ['2001:db8::1']),
      )
    ).data.reason,
    'source_conflict',
  );
  assert.equal(
    (
      await request(
        foreign + '/gateways',
        'POST',
        gateway('Foreign', ['192.0.2.20'], original.id, 'sip-provider'),
      )
    ).data.reason,
    'invalid_trunk',
  );
  assert.equal(
    (
      await request(
        path('gateways'),
        'POST',
        gateway('Missing link', ['192.0.2.20'], null, 'sip-provider'),
      )
    ).status,
    400,
  );
  for (const source of [
    '192.0.2.0/24',
    'provider.invalid',
    '0.0.0.0/0',
    '2001:db8::/64',
  ])
    assert.equal(
      (
        await request(
          path('gateways'),
          'POST',
          gateway('Invalid source', [source]),
        )
      ).status,
      400,
    );
  const device = await create(
    path('gateways'),
    gateway('Standalone device', ['::ffff:192.0.2.9']),
  );
  assert.deepEqual(device.sourceAddresses, ['192.0.2.9']);
  assert.equal(
    (
      await request(
        path('gateways'),
        'POST',
        gateway('Mapped duplicate', ['192.0.2.9']),
      )
    ).data.reason,
    'source_conflict',
  );
  let result = await request(path('trunks', original.id, 'remove'), 'POST', {
    expectedVersion: 1,
  });
  assert.equal(result.data.reason, 'referenced');
  assert.equal(result.data.blockers[0].id, provider.id);
  result = await request(path('trunks', original.id), 'PATCH', {
    expectedVersion: 1,
    name: original.name,
    direction: 'outbound',
    settings,
  });
  assert.equal(result.data.reason, 'referenced');
  let current = (
    await request(path('trunks', original.id, 'status'), 'PATCH', {
      expectedVersion: 1,
      enabled: true,
    })
  ).data.resource;
  assert.equal(current.version, 2);
  assert.equal(
    (
      await request(path('trunks', original.id, 'status'), 'PATCH', {
        expectedVersion: 1,
        enabled: false,
      })
    ).data.reason,
    'stale_version',
  );
  const count = async () =>
    Number(
      (
        await owner.query(
          "SELECT count(*) FROM public.audit_events WHERE event_type='telephony.sip-peer.desired-changed'",
        )
      ).rows[0].count,
    );
  const beforeNoop = await count();
  result = await request(path('trunks', original.id), 'PATCH', {
    expectedVersion: 2,
    name: original.name,
    direction: 'both',
    settings,
  });
  assert.equal(result.data.resource.version, 2);
  assert.equal(await count(), beforeNoop);
  const beforeFail = await count();
  await owner.query(
    "ALTER TABLE public.audit_events ADD CONSTRAINT peer_reject_audit CHECK(event_type <> 'telephony.sip-peer.desired-changed') NOT VALID",
  );
  try {
    assert.equal(
      (await request(path('trunks'), 'POST', trunk('Audit rollback'))).status,
      503,
    );
  } finally {
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT peer_reject_audit',
    );
  }
  assert.equal(await count(), beforeFail);
  assert.equal(
    (
      await owner.query(
        "SELECT count(*) FROM public.sip_trunks WHERE name='Audit rollback'",
      )
    ).rows[0].count,
    '0',
  );
  const compatible = await create(
    path('trunks'),
    trunk('Compatible device link'),
  );
  const linkedDevice = await create(
    path('gateways'),
    gateway('Linked device', ['192.0.2.31'], compatible.id),
  );
  assert.equal(
    (
      await request(path('trunks', compatible.id), 'PATCH', {
        expectedVersion: 1,
        name: compatible.name,
        direction: 'outbound',
        settings,
      })
    ).status,
    200,
    'Device links do not impose provider-only direction restrictions',
  );
  assert.equal(
    (
      await request(path('trunks', compatible.id, 'remove'), 'POST', {
        expectedVersion: 2,
      })
    ).data.reason,
    'referenced',
  );
  await request(path('gateways', linkedDevice.id, 'remove'), 'POST', {
    expectedVersion: 1,
  });
  const duplicate = trunk('Concurrent intent');
  const duplicates = await Promise.all([
    direct(a, path('trunks'), 'POST', duplicate),
    direct(b, path('trunks'), 'POST', duplicate),
  ]);
  assert.deepEqual(duplicates.map((r) => r.status).sort(), [200, 201]);
  assert.equal(duplicates[0].data.resource.id, duplicates[1].data.resource.id);
  for (let i = 0; i < 4; i++) {
    const target = await create(path('trunks'), trunk(`Race ${i}`));
    const [reference, removal] = await Promise.all([
      direct(
        a,
        path('gateways'),
        'POST',
        gateway(
          `Race gateway ${i}`,
          [`192.0.2.${40 + i}`],
          target.id,
          'sip-provider',
        ),
      ),
      direct(b, path('trunks', target.id, 'remove'), 'POST', {
        expectedVersion: 1,
      }),
    ]);
    assert.ok(
      (reference.status === 201 && removal.status === 409) ||
        (reference.status === 409 && removal.status === 200),
      JSON.stringify([reference, removal]),
    );
  }
  const sourceRace = await Promise.all([
    direct(
      a,
      path('gateways'),
      'POST',
      gateway('Source race A', ['192.0.2.90']),
    ),
    direct(
      b,
      path('gateways'),
      'POST',
      gateway('Source race B', ['192.0.2.90']),
    ),
  ]);
  assert.deepEqual(sourceRace.map((r) => r.status).sort(), [201, 409]);
  const nameRace = await Promise.all([
    direct(a, path('trunks'), 'POST', trunk('Name race')),
    direct(b, path('trunks'), 'POST', trunk('name RACE')),
  ]);
  assert.deepEqual(nameRace.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await request(path('trunks') + '?limit=1')).data.items.length,
    1,
  );
  assert.equal((await request(path('trunks') + '?limit=0')).status, 400);
  assert.equal(
    (await request(path('trunks', original.id) + '?extra=1')).status,
    400,
  );
  assert.equal(
    (
      await request(path('trunks'), 'POST', trunk('No csrf'), {
        'X-Platform-CSRF': '',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(path('trunks'), 'GET', undefined, {
        Authorization: 'Bearer invalid',
      })
    ).status,
    403,
  );
  assert.equal((await request(path('trunks', randomUUID()))).status, 404);
  assert.equal((await request(`${foreign}/trunks/${original.id}`)).status, 404);
  const staffSession = await issue(a, staffFacts);
  assert.equal(
    (
      await direct(
        a,
        path('trunks'),
        'GET',
        undefined,
        `__Host-myims-platform=${staffSession.token}`,
      )
    ).status,
    403,
  );
  const platformToken = (await context.cookies(config.origin)).find(
    (c) => c.name === '__Host-myims-platform',
  ).value;
  const passiveBefore = await redis.get(key(platformToken));
  assert.equal((await direct(b, path('trunks'))).status, 200);
  assert.equal(
    await redis.get(key(platformToken)),
    passiveBefore,
    'Resource reads must not renew activity',
  );
  const anonymous = await context.request.get(config.origin + path('trunks'), {
    headers: { Cookie: '', 'Sec-Fetch-Site': 'same-origin' },
  });
  assert.equal(anonymous.status(), 401);
  // Gateway edits/status and retained soft history plus source/name reuse.
  let edited = (
    await request(path('gateways', device.id), 'PATCH', {
      expectedVersion: 1,
      name: 'Edited device',
      kind: 'sip-device',
      trunkId: null,
      sourceAddresses: ['192.0.2.10'],
    })
  ).data.resource;
  assert.equal(edited.version, 2);
  edited = (
    await request(path('gateways', device.id, 'status'), 'PATCH', {
      expectedVersion: 2,
      enabled: true,
    })
  ).data.resource;
  assert.equal(edited.version, 3);
  await request(path('gateways', device.id, 'remove'), 'POST', {
    expectedVersion: 3,
  });
  assert.ok(
    (await request(path('gateways', device.id))).data.resource.removedAt,
  );
  assert.notEqual(
    (await create(path('gateways'), gateway('Edited device', ['192.0.2.10'])))
      .id,
    device.id,
  );
  await checkDidInventory({
    request,
    direct,
    create,
    path,
    foreign,
    a,
    b,
    owner,
    session,
    staffToken: staffSession.token,
  });
  const audit = (
    await owner.query(
      "SELECT actor_reference,metadata FROM public.audit_events WHERE event_type='telephony.sip-peer.desired-changed'",
    )
  ).rows;
  assert.ok(
    audit.length > 10 &&
      audit.every((e) => e.actor_reference === session.operatorId),
  );
  console.log(
    'PASS P3-U3a real PostgreSQL/API: CRUD, both gateway kinds, ownership, validation, exact sources, idempotency, no-op/version/audit rollback, reference/removal races, passive protected paths. Offline .invalid PBX targets; no PBX adapter used.',
  );
  // Actual operator UI journey, including safe-input validation, stale review and lost response.
  console.log(
    'CHECK peer browser: protected sign-in return and PBX navigation',
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Platform console sign-in',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/peers`);
  await expect(
    page.getByRole('heading', {
      name: 'Platform console sign-in',
      exact: true,
    }),
  ).toBeVisible();
  await login();
  await expect(page).toHaveURL(`${config.origin}/pbx-nodes/${nodeId}/peers`);
  await page
    .getByRole('link', { name: 'Back to PBX detail', exact: true })
    .click();
  await page
    .getByRole('link', {
      name: 'Manage trunks, gateways and DIDs',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Trunks, gateways and DIDs',
      exact: true,
    }),
  ).toBeVisible();
  console.log(
    'CHECK peer browser: form validation and definitive rejection recovery',
  );
  await page.getByRole('button', { name: 'Create trunk', exact: true }).click();
  await page.getByLabel(/^Name/).fill('Browser trunk');
  await page.getByLabel('Remote host or IP').fill('invalid/host');
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Review the entered fields.' }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser trunk');
  await page.getByLabel('Remote host or IP').fill('browser-provider.invalid');
  let denialInjected = false;
  const denyCreate = async (route) => {
    if (route.request().method() !== 'POST' || denialInjected) {
      await route.continue();
      return;
    }
    denialInjected = true;
    await route.continue({
      headers: {
        ...route.request().headers(),
        'x-platform-csrf': 'invalid-proof',
      },
    });
  };
  await page.route(`**${path('trunks')}`, denyCreate);
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry access', exact: true }),
  ).toBeVisible();
  await page.unroute(`**${path('trunks')}`, denyCreate);
  await page.getByRole('button', { name: 'Retry access', exact: true }).click();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser trunk');
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Browser trunk');
  console.log(
    'CHECK peer browser: trunk status, edit and stale canonical review',
  );
  const browserTrunk = (
    await owner.query(
      "SELECT id FROM public.sip_trunks WHERE name='Browser trunk'",
    )
  ).rows[0].id;
  await page.getByRole('button', { name: 'Enable trunk', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Disable trunk', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Disable trunk', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enable trunk', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit trunk', exact: true }).click();
  await page.getByLabel(/^Name/).fill('Browser trunk edited');
  current = (await request(path('trunks', browserTrunk))).data.resource;
  await request(path('trunks', browserTrunk, 'status'), 'PATCH', {
    expectedVersion: current.version,
    enabled: true,
  });
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue('Browser trunk edited');
  await page
    .getByRole('button', { name: 'Reload canonical state', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Use current version', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Browser trunk edited');
  console.log('CHECK peer browser: gateway CRUD and reference blockers');
  await page.getByRole('button', { name: 'Gateways', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create gateway', exact: true })
    .click();
  await page.getByLabel(/^Name/).fill('Browser provider');
  await page.getByLabel('Gateway kind').selectOption('sip-provider');
  await page.getByLabel(/^Trunk ID/).fill(browserTrunk);
  await page.getByLabel(/^Exact source IP addresses/).fill('192.0.2.80');
  await page.getByRole('button', { name: 'Save gateway', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Browser provider');
  await page
    .getByRole('button', { name: 'Enable gateway', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Disable gateway', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Disable gateway', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enable gateway', exact: true }),
  ).toBeVisible();
  await checkDidBrowser({ page, request, path, owner, ingress, browserTrunk });
  await page.getByRole('button', { name: 'Trunks', exact: true }).click();
  const inspectGate = holdResponse('GET', path('trunks', browserTrunk));
  await page
    .getByRole('button', { name: 'Inspect Browser trunk edited', exact: true })
    .click();
  await inspectGate.reached;
  try {
    await expect(
      page.getByRole('button', { name: 'Remove trunk', exact: true }),
    ).toBeDisabled();
  } finally {
    inspectGate.release();
  }
  await page.getByRole('button', { name: 'Remove trunk', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm removal', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Referencing gateways', exact: true }),
  ).toContainText('Browser provider');
  await page.getByRole('button', { name: 'Gateways', exact: true }).click();
  await page
    .getByRole('button', { name: 'Inspect Browser provider', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit gateway', exact: true }).click();
  await page.getByLabel('Gateway kind').selectOption('sip-device');
  await page.getByLabel(/^Trunk ID/).fill('');
  await page.getByRole('button', { name: 'Save gateway', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('sip-device');
  await page
    .getByRole('button', { name: 'Remove gateway', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm removal', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Removed');
  await page.getByRole('button', { name: 'Trunks', exact: true }).click();
  await page
    .getByRole('button', { name: 'Inspect Browser trunk edited', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove trunk', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm removal', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Removed');
  await page.getByRole('button', { name: 'Create trunk', exact: true }).click();
  await page.getByLabel(/^Name/).fill('Lost browser create');
  await page.getByLabel('Remote host or IP').fill('offline.invalid');
  ingress.drop(path('trunks'), 'POST');
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Canonical review', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Retry exact create request', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Lost browser create');
  assert.equal(
    (
      await owner.query(
        "SELECT count(*) FROM public.sip_trunks WHERE name='Lost browser create'",
      )
    ).rows[0].count,
    '1',
  );
  console.log(
    'CHECK peer browser: digest, desired registration and version adoption',
  );
  await page.getByRole('button', { name: 'Create trunk', exact: true }).click();
  await page.getByLabel(/^Name/).fill('Browser digest');
  await page.getByLabel('Remote host or IP').fill('digest.invalid');
  await page.getByLabel(/^Authentication/).selectOption('outbound-digest');
  await page
    .getByLabel('Credential label and version')
    .selectOption(`${credentialId}:1`);
  await page.getByLabel('Desired outbound registration').selectOption('on');
  await page.getByLabel('Registrar host or IP').fill('registrar.invalid');
  await page.getByLabel('Registration realm').fill('synthetic.invalid');
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource detail', exact: true }),
  ).toContainText('Browser digest');
  await page.getByRole('button', { name: 'Edit trunk', exact: true }).click();
  await expect(page.getByLabel('Credential label and version')).toHaveValue(
    `${credentialId}:1`,
  );
  await page
    .getByLabel('Credential label and version')
    .selectOption(`${credentialId}:2`);
  await page.getByRole('button', { name: 'Save trunk', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Resource form', exact: true }),
  ).toHaveCount(0);
  const browserDigest = (
    await owner.query(
      "SELECT settings FROM public.sip_trunks WHERE name='Browser digest'",
    )
  ).rows[0].settings;
  assert.equal(browserDigest.credential.version, 2);
  assert.deepEqual(browserDigest.registration, registration);
  assert.ok(!JSON.stringify(browserDigest).includes('password'));
  console.log(
    'PASS P3-U3b actual HTTPS browser digest + desired registration + explicit credential version adoption.',
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      `Peer screen reflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const axe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  await page.getByRole('button', { name: 'Edit trunk', exact: true }).focus();
  assert.equal(
    await page.evaluate(() => globalThis.document.activeElement?.textContent),
    'Edit trunk',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByLabel(/^Name/)).toBeVisible();
  console.log(
    'PASS P3-U3a actual HTTPS browser: create/list/detail/edit/enable/disable/remove; provider/device, validation retention, actionable blockers, stale canonical review, exact lost-create retry, keyboard and 320px reflow, axe.',
  );
}
