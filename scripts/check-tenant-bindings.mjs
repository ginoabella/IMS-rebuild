import { checkTenantRevisionCapture } from './check-tenant-revision-capture.mjs';
import { checkBindingLifecycle } from './check-binding-lifecycle.mjs';
import { checkBindingSelection } from './check-binding-selection.mjs';
import { checkBindingRecovery } from './check-binding-recovery.mjs';
import { checkBindingRaces } from './check-binding-races.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expandTenantCards } from './tenant-card-browser.mjs';
const expect = baseExpect.configure({ timeout: 20000 });
async function runTenantBindings({
  request,
  direct,
  nodeId,
  otherNode,
  installation,
  owner,
  page,
  config,
  a,
  b,
  allocationDependencies,
  expire,
  login,
  ingress,
  holdResponse,
  username,
  issue,
  staffFacts,
  context,
  session,
}) {
  const root = `/platform/pbx-nodes/${nodeId}`,
    created = [];
  async function tenant() {
    const r = await request('/platform/tenants', 'POST', {
      requestId: randomUUID(),
      tenantCode: 'binding-' + randomUUID().slice(0, 8),
      displayName: 'Binding tenant',
      administratorUsername: 'admin',
    });
    assert.equal(r.status, 201, JSON.stringify(r));
    created.push(r.data.tenant);
    return r.data.tenant;
  }
  const one = await tenant(),
    two = await tenant();
  const path = (t = one, suffix = '') =>
    `/platform/tenants/${t.id}/route-bindings/${nodeId}${suffix ? '/' + suffix : ''}`;
  const tv = (t) => ({
    expectedTenantVersion: t.version,
    expectedAuthorityVersion: t.authorityVersion,
  });
  async function create(path, body) {
    const r = await request(path, 'POST', { requestId: randomUUID(), ...body });
    assert.equal(r.status, 201, JSON.stringify(r));
    return r.data.resource ?? r.data.profile;
  }
  async function enabled(path, r) {
    const response = await request(`${path}/${r.id}/status`, 'PATCH', {
      expectedVersion: r.version,
      enabled: true,
    });
    assert.equal(response.status, 200, JSON.stringify(response));
    return response.data.resource ?? response.data.extension;
  }
  await owner.query(
    `INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])`,
    [installation],
  );
  const profile = await create(root + '/endpoint-profiles', {
    name: 'Binding stock',
    template: 'sip-basic',
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  const bulk = await request(root + '/extensions/bulk', 'POST', {
    requestId: randomUUID(),
    kind: 'sip',
    range: { start: '7100', end: '7103' },
    profileId: profile.id,
    profileVersion: 1,
    expectedProfileHead: 1,
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  assert.equal(bulk.status, 201, JSON.stringify(bulk));
  const extensions = bulk.data.items;
  // The inventory status transport is POST with its existing versioned dependency fields.
  for (const e of extensions) {
    const r = await request(`${root}/extensions/${e.id}/status`, 'PATCH', {
      expectedVersion: e.version,
      administrativeStatus: 'enabled',
    });
    if (r.status !== 200)
      console.log('Inventory enable contract', JSON.stringify(r));
    assert.equal(r.status, 200, JSON.stringify(r));
    e.version = r.data.extension?.version ?? r.data.resource?.version ?? 2;
  }
  async function allocate(t, e) {
    const r = await request(
      `/platform/tenants/${t.id}/allocations/${nodeId}`,
      'POST',
      {
        requestId: randomUUID(),
        ...tv(t),
        state: 'allocated',
        items: [{ extensionId: e.id, expectedVersion: e.version }],
      },
    );
    assert.equal(r.status, 201, JSON.stringify(r));
    return r.data.items[0];
  }
  const claim1 = await allocate(one, extensions[0]),
    claim2 = await allocate(two, extensions[1]);
  const settings = {
    host: 'binding-provider.invalid',
    port: 5060,
    transport: 'udp',
    media: 'rtp',
    codecs: ['ulaw'],
    directMedia: false,
    rtpSymmetric: true,
    forceRport: true,
    authentication: 'ip-peer',
  };
  const trunks = [];
  for (let i = 0; i < 2; i++)
    trunks.push(
      await enabled(
        root + '/peers/trunks',
        await create(root + '/peers/trunks', {
          name: 'Binding trunk ' + i,
          direction: 'both',
          settings: { ...settings, host: `binding-${i}.invalid` },
        }),
      ),
    );
  const gateway = await enabled(
    root + '/peers/gateways',
    await create(root + '/peers/gateways', {
      name: 'Shared binding gateway',
      kind: 'sip-device',
      trunkId: null,
      sourceAddresses: ['192.0.2.181'],
    }),
  );
  const dids = [],
    groups = [],
    inbound = [],
    outbound = [];
  for (let i = 0; i < 2; i++) {
    dids.push(
      await enabled(
        root + '/peers/dids',
        await create(root + '/peers/dids', {
          name: 'Tenant DID ' + i,
          number: '555000' + i,
          gatewayId: gateway.id,
        }),
      ),
    );
    groups.push(
      await enabled(
        root + '/routing/groups',
        await create(root + '/routing/groups', {
          name: 'Tenant group ' + i,
          number: null,
          memberIds: [extensions[i].id],
          strategy: 'simultaneous',
          timeout: 20,
          fallback: { kind: 'hangup' },
        }),
      ),
    );
    inbound.push(
      await enabled(
        root + '/routing/inbound',
        await create(root + '/routing/inbound', {
          name: 'Tenant inbound ' + i,
          gatewayId: gateway.id,
          didId: dids[i].id,
          destination: { kind: 'group', id: groups[i].id },
        }),
      ),
    );
    outbound.push(
      await enabled(
        root + '/routing/outbound',
        await create(root + '/routing/outbound', {
          name: 'Tenant outbound ' + i,
          trunkId: trunks[0].id,
          pattern: {
            kind: 'exact',
            digits: '55510' + i,
            minLength: 6,
            maxLength: 6,
          },
          priority: i,
          stripCount: 1,
          addPrefix: '9',
        }),
      ),
    );
  }
  async function preview(t, kind, id, scope = 'owned') {
    const r = await request(path(t, 'preview'), 'POST', {
      kind,
      resourceId: id,
      scope,
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data;
  }
  async function intent(t, kind, id, scope = 'owned', expectedVersion = null) {
    const review = await preview(t, kind, id, scope);
    assert.equal(review.compatible, true, JSON.stringify(review));
    return {
      requestId: randomUUID(),
      ...tv(t),
      expectedVersion,
      kind,
      resourceId: id,
      scope,
      evaluated: review.evaluated,
    };
  }
  async function save(t, kind, id, scope = 'owned', expectedVersion = null) {
    const body = await intent(t, kind, id, scope, expectedVersion);
    const r = await request(path(t), 'POST', body);
    assert.ok([200, 201].includes(r.status), JSON.stringify(r));
    return r.data.items[0];
  }
  console.log(
    'CHECK binding: explicit ownership and permissions for two tenants sharing one gateway/trunk',
  );
  const shared = await save(one, 'trunks', trunks[0].id, 'shared');
  const permissions = [];
  for (let i = 0; i < 2; i++) {
    const t = [one, two][i];
    await save(t, 'dids', dids[i].id);
    await save(t, 'groups', groups[i].id);
    await save(t, 'inbound', inbound[i].id);
    assert.equal(
      (await preview(t, 'outbound', outbound[i].id)).compatible,
      false,
    );
    permissions.push(await save(t, 'permission', trunks[0].id));
    await save(t, 'outbound', outbound[i].id);
    const advisory = await request(path(t, 'outbound-preview'), 'POST', {
      dialled: '55510' + i,
    });
    assert.equal(advisory.data.reason, 'matched', JSON.stringify(advisory));
    assert.equal(advisory.data.transformed, '95510' + i);
    assert.equal(advisory.data.callingEligible, false);
    assert.equal(
      (
        await request(path(t, 'outbound-preview'), 'POST', {
          dialled: '55510' + (1 - i),
        })
      ).data.reason,
      'no_match',
    );
  }
  await checkTenantRevisionCapture({
    request,
    owner,
    root,
    one,
    two,
    extensions,
    inbound,
    outbound,
    permissions,
    path,
    tv,
  });
  await checkBindingLifecycle({
    request,
    root,
    path,
    one,
    two,
    create,
    enabled,
    save,
    tv,
    owner,
    gateway,
    inbound,
  });
  await checkBindingSelection({
    request,
    root,
    path,
    one,
    two,
    trunk: trunks[0],
    create,
    enabled,
    save,
  });
  await save(two, 'trunks', trunks[1].id);
  assert.equal(
    (await preview(one, 'permission', trunks[1].id)).compatible,
    false,
  );
  assert.equal((await preview(two, 'dids', dids[0].id)).compatible, false);
  assert.equal((await preview(two, 'groups', groups[0].id)).compatible, false);
  assert.equal(
    (await preview(two, 'inbound', inbound[0].id)).compatible,
    false,
  );
  const catchall = await enabled(
    root + '/routing/inbound',
    await create(root + '/routing/inbound', {
      name: 'Platform catch-all',
      gatewayId: gateway.id,
      didId: null,
      destination: { kind: 'hangup' },
    }),
  );
  assert.equal((await preview(one, 'inbound', catchall.id)).compatible, false);
  const foreign = await enabled(
    root + '/routing/groups',
    await create(root + '/routing/groups', {
      name: 'Foreign member',
      number: null,
      memberIds: [extensions[1].id],
      strategy: 'simultaneous',
      timeout: 20,
      fallback: { kind: 'hangup' },
    }),
  );
  assert.equal((await preview(one, 'groups', foreign.id)).compatible, false);
  assert.equal((await preview(one, 'groups', randomUUID())).compatible, false);
  const cyclic = await enabled(
    root + '/routing/groups',
    await create(root + '/routing/groups', {
      name: 'Canonical cycle denial fixture',
      number: null,
      memberIds: [extensions[0].id],
      strategy: 'simultaneous',
      timeout: 20,
      fallback: { kind: 'hangup' },
    }),
  );
  await assert.rejects(
    owner.query(
      `UPDATE public.ring_groups SET fallback_group_id=id,version=version+1,updated_at=clock_timestamp() WHERE id=$1`,
      [cyclic.id],
    ),
    (e) => e.code === '23514',
  );
  const cycleAttempt = await request(
    `${root}/routing/groups/${cyclic.id}`,
    'PATCH',
    {
      expectedVersion: cyclic.version,
      name: cyclic.name,
      number: null,
      memberIds: cyclic.memberIds,
      strategy: cyclic.strategy,
      timeout: cyclic.timeout,
      fallback: { kind: 'group', id: cyclic.id },
    },
  );
  assert.equal(cycleAttempt.status, 400, JSON.stringify(cycleAttempt));
  const unchangedCycle = (await request(`${root}/routing/groups/${cyclic.id}`))
    .data.resource;
  assert.equal(unchangedCycle.version, cyclic.version);
  assert.deepEqual(unchangedCycle.fallback, { kind: 'hangup' });
  const wrong = await request(
    `/platform/tenants/${one.id}/route-bindings/${otherNode}/preview`,
    'POST',
    { kind: 'inbound', resourceId: inbound[0].id, scope: 'owned' },
  );
  assert.equal(wrong.data.compatible, false, JSON.stringify(wrong));
  console.log(
    'CHECK binding: real neighboring writers, stale facts and retained authorization',
  );
  for (const [p, method, body] of [
    [
      `${root}/routing/groups/${groups[0].id}`,
      'PATCH',
      {
        expectedVersion: groups[0].version,
        name: groups[0].name,
        number: null,
        memberIds: [extensions[1].id],
        strategy: 'simultaneous',
        timeout: 20,
        fallback: { kind: 'hangup' },
      },
    ],
    [
      `${root}/routing/groups/${groups[0].id}/remove`,
      'POST',
      { expectedVersion: groups[0].version },
    ],
    [
      `${root}/routing/inbound/${inbound[0].id}/remove`,
      'POST',
      { expectedVersion: inbound[0].version },
    ],
    [
      `${root}/peers/dids/${dids[0].id}/remove`,
      'POST',
      { expectedVersion: dids[0].version },
    ],
    [
      `${root}/peers/gateways/${gateway.id}/remove`,
      'POST',
      { expectedVersion: gateway.version },
    ],
    [
      `${root}/peers/trunks/${trunks[0].id}/remove`,
      'POST',
      { expectedVersion: trunks[0].version },
    ],
    [
      `/platform/tenants/${one.id}/allocations/${nodeId}/${claim1.id}/release`,
      'POST',
      { requestId: randomUUID(), ...tv(one), expectedVersion: claim1.version },
    ],
  ]) {
    const r = await request(p, method, body);
    assert.equal(r.status, 409, JSON.stringify(r));
    assert.equal(r.data.reason, 'referenced', JSON.stringify(r));
  }
  const replayBody = await intent(one, 'dids', dids[0].id, 'owned', 1);
  const replay = await Promise.all([
    direct(a, path(one), 'POST', replayBody),
    direct(b, path(one), 'POST', replayBody),
  ]);
  assert.ok(
    replay.every((r) => r.status === 200),
    JSON.stringify(replay),
  );
  assert.equal(replay.filter((r) => r.data.replayed).length, 1);
  assert.equal(
    (await request(path(one), 'POST', { ...replayBody, expectedVersion: 99 }))
      .data.reason,
    'request_conflict',
  );
  const staleBody = await intent(one, 'dids', dids[0].id, 'owned', 1);
  const rename = await request(`${root}/peers/dids/${dids[0].id}`, 'PATCH', {
    expectedVersion: dids[0].version,
    name: 'Renamed DID',
    number: dids[0].number,
    gatewayId: gateway.id,
  });
  assert.equal(rename.status, 200, JSON.stringify(rename));
  assert.equal(
    (await request(path(one), 'POST', staleBody)).data.reason,
    'stale_version',
  );
  await save(one, 'dids', dids[0].id, 'owned', 1);
  const currentInbound = (await request(path(one))).data.items.find(
    (r) => r.kind === 'inbound',
  );
  assert.equal(currentInbound.review.compatible, false);
  await save(one, 'inbound', inbound[0].id, 'owned', currentInbound.version);
  const retainedRevision = await request(root + '/revisions', 'POST', {
    requestId: randomUUID(),
  });
  assert.equal(retainedRevision.status, 201, JSON.stringify(retainedRevision));
  await owner.query(
    `INSERT INTO public.pbx_live_pins(revision_id,node_id,kind,resource_id,version) VALUES($1,$2,'trunks',$3,$4)`,
    [
      retainedRevision.data.revision.id,
      nodeId,
      trunks[0].id,
      trunks[0].version,
    ],
  );
  const pinsBefore = (
    await owner.query(
      `SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL`,
      [nodeId],
    )
  ).rows[0].n;
  // Revoke desired permission without altering runtime pins; the bound rule remains but denies.
  const revoke = await request(
    path(one, permissions[0].id + '/revoke'),
    'POST',
    {
      requestId: randomUUID(),
      ...tv(one),
      expectedVersion: permissions[0].version,
    },
  );
  assert.equal(revoke.status, 200, JSON.stringify(revoke));
  assert.equal(
    (
      await request(path(one, 'outbound-preview'), 'POST', {
        dialled: '555100',
      })
    ).data.reason,
    'incompatible',
  );
  assert.equal(
    (
      await request(path(two, 'outbound-preview'), 'POST', {
        dialled: '555101',
      })
    ).data.reason,
    'matched',
  );
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL`,
        [nodeId],
      )
    ).rows[0].n,
    pinsBefore,
  );
  await save(one, 'permission', trunks[0].id);
  const ob = (await request(path(one))).data.items.find(
    (r) => r.kind === 'outbound' && r.resourceId === outbound[0].id,
  );
  await save(one, 'outbound', outbound[0].id, 'owned', ob.version);
  const disable = await request(
    `${root}/routing/outbound/${outbound[0].id}/status`,
    'PATCH',
    { expectedVersion: outbound[0].version, enabled: false },
  );
  assert.equal(disable.status, 200, JSON.stringify(disable));
  assert.equal(
    (
      await request(path(one, 'outbound-preview'), 'POST', {
        dialled: '555100',
      })
    ).data.reason,
    'disabled_rule',
  );
  console.log(
    'CHECK binding: runtime grants, SQL rollback, transport bounds and trusted port',
  );
  for (const table of ['audit_events', 'tenant_route_receipts']) {
    if (table === 'audit_events') {
      await owner.query(
        `CREATE FUNCTION public.binding_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.tenant-route.changed' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$`,
      );
      await owner.query(
        'CREATE TRIGGER binding_audit_failure BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.binding_audit_failure()',
      );
    } else
      await owner.query(
        'REVOKE INSERT ON public.tenant_route_receipts FROM myims_runtime',
      );
    try {
      const body = await intent(one, 'dids', dids[1].id).catch(() => null); // foreign ownership itself must deny before any write
      assert.equal(body, null);
      const fresh = await create(root + '/peers/dids', {
        name: 'Rollback ' + table,
        number: table === 'audit_events' ? '5550098' : '5550099',
        gatewayId: gateway.id,
      });
      const ready = await enabled(root + '/peers/dids', fresh);
      const payload = await intent(one, 'dids', ready.id);
      const r = await request(path(one), 'POST', payload);
      assert.equal(r.status, 503, JSON.stringify(r));
      assert.equal(
        (
          await owner.query(
            'SELECT 1 FROM public.tenant_route_authorizations WHERE resource_id=$1',
            [ready.id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await owner.query(
            'SELECT 1 FROM public.tenant_route_receipts WHERE request_id=$1',
            [payload.requestId],
          )
        ).rows.length,
        0,
      );
    } finally {
      if (table === 'audit_events') {
        await owner.query(
          'DROP TRIGGER binding_audit_failure ON public.audit_events',
        );
        await owner.query('DROP FUNCTION public.binding_audit_failure()');
      } else
        await owner.query(
          'GRANT INSERT ON public.tenant_route_receipts TO myims_runtime',
        );
    }
  }
  for (const suffix of [
    '?limit=101',
    '?limit=1&limit=2',
    '?tenantId=' + two.id,
  ])
    assert.equal((await request(path(one) + suffix)).status, 400);
  for (const extra of [
    { context: 'arbitrary' },
    { sourceKey: 'caller-controlled' },
    { tenantId: two.id },
  ])
    assert.equal(
      (
        await request(path(one, 'preview'), 'POST', {
          kind: 'dids',
          resourceId: dids[0].id,
          scope: 'owned',
          ...extra,
        })
      ).status,
      400,
    );
  assert.equal((await direct(a, path(one), 'GET', undefined, '')).status, 401);
  assert.equal(
    (
      await direct(
        a,
        path(one, 'preview'),
        'POST',
        { kind: 'dids', resourceId: dids[0].id, scope: 'owned' },
        undefined,
        { origin: 'https://foreign.invalid' },
      )
    ).status,
    403,
  );
  const staffSession = await issue(a, staffFacts);
  assert.equal(
    (
      await direct(
        a,
        path(one),
        'GET',
        undefined,
        `__Host-myims-platform=${staffSession.token}`,
      )
    ).status,
    403,
  );
  const wrongPlane = await context.request.get(config.origin + path(one), {
    headers: {
      Cookie: `__Host-myims-platform=${staffSession.token}`,
      'Sec-Fetch-Site': 'same-origin',
    },
  });
  assert.equal(wrongPlane.status(), 403);
  assert.equal(
    (
      await request(
        path(one, 'preview'),
        'POST',
        { kind: 'dids', resourceId: dids[0].id, scope: 'owned' },
        { 'X-Platform-CSRF': 'invalid' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(path(one), 'GET', undefined, {
        Authorization: 'Bearer wrong-plane',
      })
    ).status,
    403,
  );
  const backend = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const runtime = allocationDependencies.runtime;
  const duplicateSql = (nodeExpression, didExpression = 'did_id') =>
    `INSERT INTO public.tenant_route_authorizations(id,tenant_id,node_id,installation_id,kind,did_id,scope,evaluated,created_by,updated_by) SELECT $1,$2,${nodeExpression},installation_id,kind,${didExpression},scope,evaluated,created_by,updated_by FROM public.tenant_route_authorizations WHERE resource_id=$3 AND kind='dids' AND state='active'`;
  await assert.rejects(
    runtime.query(duplicateSql('node_id'), [randomUUID(), two.id, dids[0].id]),
    (e) => e.code === '23505',
  );
  const foreignKeyDid = await create(root + '/peers/dids', {
    name: 'Binding FK boundary',
    number: '5550083',
    gatewayId: gateway.id,
  });
  await assert.rejects(
    runtime.query(duplicateSql('$4::uuid', '$5::uuid'), [
      randomUUID(),
      two.id,
      dids[0].id,
      otherNode,
      foreignKeyDid.id,
    ]),
    (e) => e.code === '23503',
  );
  const { BindingEvaluator } = backend(
    './dist/modules/telephony/application/tenant-route-eligibility.js',
  );
  const evaluator = await BindingEvaluator.load(
    allocationDependencies.runtime,
    one.id,
    nodeId,
  );
  const portReview = await evaluator.review('inbound', inbound[0].id, 'owned');
  assert.equal(portReview.compatible, true, JSON.stringify(portReview));
  const { TenantRouteEligibility } = backend(
    './dist/modules/telephony/application/tenant-route-eligibility.js',
  );
  const { SnapshotDatabase } = backend(
    './dist/infrastructure/database/read-snapshot.js',
  );
  const { AllocationTenancyRepository } = backend(
    './dist/modules/tenancy/adapters/db/allocation-tenancy.js',
  );
  const parameters = allocationDependencies.runtime.connectionParameters;
  const canonicalUrl = new URL('postgresql://localhost');
  canonicalUrl.hostname = parameters.host;
  canonicalUrl.port = String(parameters.port);
  canonicalUrl.username = parameters.user;
  canonicalUrl.password = parameters.password;
  canonicalUrl.pathname = '/' + parameters.database;
  const canonicalDatabase = new SnapshotDatabase(canonicalUrl.href);
  try {
    const snapshot = await new TenantRouteEligibility(
      canonicalDatabase,
      new AllocationTenancyRepository(),
    ).snapshot(one.id, nodeId);
    assert.equal(snapshot.tenant.id, one.id);
    assert.equal(snapshot.installationId, installation);
    assert.equal(snapshot.callingEligible, false);
    assert.equal(
      snapshot.authorizations.find((a) => a.authorization.kind === 'inbound')
        .review.compatible,
      true,
    );
    assert.ok(
      snapshot.allocations.some(
        (c) => c.id === claim1.id && c.state === 'allocated',
      ),
    );
    assert.ok(
      snapshot.resources.some(
        (r) => r.kind === 'gateways' && r.resource.id === gateway.id,
      ),
    );
  } finally {
    await canonicalDatabase.close();
  }
  const cross = await direct(b, path(two));
  assert.equal(cross.status, 200);
  assert.ok(
    cross.data.items.every(
      (r) => r.tenantId === two.id || r.scope === 'shared',
    ),
  );
  await checkBindingRaces({
    owner,
    runtime: allocationDependencies.runtime,
    request,
    direct,
    a,
    b,
    path,
    one,
    two,
    nodeId,
    root,
    intent,
    create,
    enabled,
    gateway,
    extensions,
    tv,
    allocationDependencies,
    claim1,
    settings,
    issue,
    session,
  });
  console.log(
    'CHECK binding HTTPS: actual selectors, save/reload, focus, responsive layout and no readiness claim',
  );
  await page.goto(`${config.origin}/tenants/${one.id}`);
  await expandTenantCards(page);
  await page.locator('#route-binding-node').selectOption(nodeId);
  const inPanel = page.getByRole('region', {
    name: 'inbound tenant route configuration',
  });
  await expect(
    inPanel.getByRole('button', { name: 'Preview inbound authorization' }),
  ).toBeVisible();
  await inPanel.locator('#binding-inbound-resource').selectOption(dids[0].id);
  await inPanel
    .getByRole('button', { name: 'Preview inbound authorization' })
    .click();
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeEnabled();
  await inPanel
    .getByRole('button', { name: 'Save inbound authorization' })
    .focus();
  await page.keyboard.press('Enter');
  await expect(inPanel.getByRole('status')).toContainText(
    'Desired authorization saved',
  );
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeDisabled();
  await page.reload();
  await expandTenantCards(page);
  await page.locator('#route-binding-node').selectOption(nodeId);
  await expect(inPanel).toContainText('DID ownership');
  await expect(inPanel).toContainText('Live verification pending');
  await inPanel.locator('#binding-inbound-kind').selectOption('groups');
  await inPanel.locator('#binding-inbound-resource').selectOption(foreign.id);
  await inPanel
    .getByRole('button', { name: 'Preview inbound authorization' })
    .click();
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeDisabled();
  await expect(
    inPanel.getByRole('list', { name: 'inbound blockers' }),
  ).toContainText('Enabled allocated extension');
  await expect(inPanel.locator('#binding-inbound-resource')).toHaveValue(
    foreign.id,
  );
  await inPanel.locator('#binding-inbound-kind').selectOption('dids');
  await inPanel.locator('#binding-inbound-resource').selectOption(dids[0].id);
  await inPanel
    .getByRole('button', { name: 'Preview inbound authorization' })
    .click();
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeEnabled();
  const didBeforeConflict = (await request(`${root}/peers/dids/${dids[0].id}`))
    .data.resource;
  const conflictRename = await request(
    `${root}/peers/dids/${dids[0].id}`,
    'PATCH',
    {
      expectedVersion: didBeforeConflict.version,
      name: 'Browser conflict DID',
      number: didBeforeConflict.number,
      gatewayId: gateway.id,
    },
  );
  assert.equal(conflictRename.status, 200, JSON.stringify(conflictRename));
  await inPanel
    .getByRole('button', { name: 'Save inbound authorization' })
    .click();
  await expect(inPanel.getByRole('status')).toContainText('stale_version');
  await expect(inPanel.locator('#binding-inbound-resource')).toHaveValue(
    dids[0].id,
  );
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeDisabled();
  await inPanel
    .getByRole('button', { name: 'Preview inbound authorization' })
    .click();
  await expect(
    inPanel.getByRole('button', { name: 'Save inbound authorization' }),
  ).toBeEnabled();
  await inPanel
    .getByRole('button', { name: 'Save inbound authorization' })
    .click();
  await expect(inPanel.getByRole('status')).toContainText(
    'Desired authorization saved',
  );
  for (const [kind, id] of [
    ['groups', groups[0].id],
    ['inbound', inbound[0].id],
  ]) {
    await inPanel.locator('#binding-inbound-kind').selectOption(kind);
    await inPanel.locator('#binding-inbound-resource').selectOption(id);
    await inPanel
      .getByRole('button', { name: 'Preview inbound authorization' })
      .click();
    await expect(
      inPanel.getByRole('button', { name: 'Save inbound authorization' }),
    ).toBeEnabled();
    await inPanel
      .getByRole('button', { name: 'Save inbound authorization' })
      .click();
    await expect(inPanel.getByRole('status')).toContainText(
      'Desired authorization saved',
    );
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(inPanel).toBeVisible();
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
  }
  const axe = await new AxeBuilder({ page })
    .include('[aria-label="Tenant route bindings"]')
    .analyze();
  assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
  await page.screenshot({
    path: '.local/ui-review/tenant-bindings-phone.png',
    fullPage: true,
  });
  const outPanel = page.getByRole('region', {
    name: 'outbound tenant route configuration',
  });
  await outPanel
    .locator('#binding-outbound-resource')
    .selectOption(trunks[0].id);
  await outPanel.locator('#binding-outbound-scope').selectOption('shared');
  await outPanel
    .getByRole('button', { name: 'Preview outbound authorization' })
    .click();
  await expect(
    outPanel.getByRole('button', { name: 'Save outbound authorization' }),
  ).toBeEnabled();
  await outPanel
    .getByRole('button', { name: 'Save outbound authorization' })
    .click();
  await expect(outPanel.getByRole('status')).toContainText(
    'Desired authorization saved',
  );
  await outPanel.locator('#binding-outbound-kind').selectOption('permission');
  await expect(outPanel.locator('#binding-outbound-resource')).toBeEnabled();
  await outPanel
    .locator('#binding-outbound-resource')
    .selectOption(trunks[0].id);
  await outPanel
    .getByRole('button', { name: 'Preview outbound authorization' })
    .click();
  await expect(
    outPanel.getByRole('button', { name: 'Save outbound authorization' }),
  ).toBeEnabled();
  await outPanel
    .getByRole('button', { name: 'Save outbound authorization' })
    .click();
  await expect(outPanel.getByRole('status')).toContainText(
    'Desired authorization saved',
  );
  const enabledAgain = await request(
    `${root}/routing/outbound/${outbound[0].id}/status`,
    'PATCH',
    { expectedVersion: disable.data.resource.version, enabled: true },
  );
  assert.equal(enabledAgain.status, 200, JSON.stringify(enabledAgain));
  await outPanel.locator('#binding-outbound-kind').selectOption('outbound');
  await expect(outPanel.locator('#binding-outbound-resource')).toBeEnabled();
  await outPanel
    .locator('#binding-outbound-resource')
    .selectOption(outbound[0].id);
  await outPanel
    .getByRole('button', { name: 'Preview outbound authorization' })
    .click();
  await expect(
    outPanel.getByRole('button', { name: 'Save outbound authorization' }),
  ).toBeEnabled();
  await outPanel
    .getByRole('button', { name: 'Save outbound authorization' })
    .click();
  await expect(outPanel.getByRole('status')).toContainText(
    'Desired authorization saved',
  );
  await outPanel.getByLabel('Tenant outbound advisory number').fill('555100');
  await outPanel
    .getByRole('button', { name: 'Preview tenant outbound selection' })
    .click();
  await expect(outPanel.getByRole('status')).toContainText(
    'Tenant advisory: matched',
  );
  await checkBindingRecovery({
    page,
    config,
    one,
    two,
    nodeId,
    otherNode,
    dids,
    path,
    expire,
    login,
    ingress,
    holdResponse,
    username,
    request,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${config.origin}/tenants/${one.id}`);
  await expandTenantCards(page);
  await page.locator('#route-binding-node').selectOption(nodeId);
  await expect(page.locator('#binding-inbound-resource')).toBeEnabled();
  await page.screenshot({
    path: '.local/ui-review/tenant-bindings-desktop.png',
    fullPage: true,
  });
  console.log(
    'PASS binding focused real PostgreSQL/shared Redis/two-replica/API/HTTPS suite',
  );
  // Everything is confined to the harness-owned database/Redis/browser; launcher removes it.
  assert.ok(shared.id && claim2.id);
}

export async function checkTenantBindings(input) {
  try {
    return await runTenantBindings(input);
  } catch (error) {
    console.log(
      'FAIL binding fixture',
      JSON.stringify({
        name: error.name,
        code: error.code,
        message: String(error.message).slice(0, 1800),
        frames: error.stack
          ?.split('\n')
          .filter((line) =>
            /check-(tenant-bindings|binding-races)\.mjs:\d+:\d+/.test(line),
          )
          .slice(0, 3),
      }),
    );
    throw error;
  }
}
