import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
export async function checkBindingRaces({
  owner,
  runtime,
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
}) {
  async function waiting(
    pattern = '%public.pbx_nodes%FOR UPDATE%',
    requestId = null,
  ) {
    for (let i = 0; i < 100; i++) {
      if (
        (
          await runtime.query(
            `SELECT 1 FROM pg_stat_activity a WHERE a.datname=current_database() AND a.wait_event_type='Lock' AND a.query LIKE $1 AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='advisory' AND l.granted AND l.objid=(hashtextextended($2,0)&4294967295)::oid AND l.classid=((hashtextextended($2,0)>>32)&4294967295)::oid)) LIMIT 1`,
            [
              pattern,
              requestId
                ? `tenant-route-binding:${session.operatorId}:${requestId}`
                : null,
            ],
          )
        ).rows.length
      )
        return;
      await delay(10);
    }
    throw new Error('Canonical node lock wait not reached');
  }
  async function queued(first, second, requestId) {
    await owner.query('BEGIN');
    await owner.query(
      'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
      [nodeId],
    );
    let x, y;
    try {
      x = first();
      await waiting(undefined, requestId);
      y = second();
      await delay(50);
    } finally {
      await owner.query('COMMIT');
    }
    return Promise.all([x, y]);
  }
  const did = await enabled(
    root + '/peers/dids',
    await create(root + '/peers/dids', {
      name: 'Concurrent ownership DID',
      number: '5550088',
      gatewayId: gateway.id,
    }),
  );
  const first = await intent(one, 'dids', did.id),
    second = await intent(two, 'dids', did.id);
  const outcomes = await Promise.all([
    direct(a, path(one), 'POST', first),
    direct(b, path(two), 'POST', second),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::integer AS n FROM public.tenant_route_authorizations WHERE resource_id=$1 AND state='active'`,
        [did.id],
      )
    ).rows[0].n,
    1,
  );
  const group = await enabled(
    root + '/routing/groups',
    await create(root + '/routing/groups', {
      name: 'Concurrent group ownership',
      number: null,
      memberIds: [extensions[0].id],
      strategy: 'simultaneous',
      timeout: 20,
      fallback: { kind: 'hangup' },
    }),
  );
  const groupIntent = await intent(one, 'groups', group.id);
  const graph = await queued(
    () => direct(a, path(one), 'POST', groupIntent),
    () =>
      direct(b, `${root}/routing/groups/${group.id}`, 'PATCH', {
        expectedVersion: group.version,
        name: group.name,
        number: null,
        memberIds: [extensions[1].id],
        strategy: 'simultaneous',
        timeout: 20,
        fallback: { kind: 'hangup' },
      }),
    groupIntent.requestId,
  );
  assert.equal(graph[0].status, 201, JSON.stringify(graph));
  assert.equal(graph[1].data.reason, 'referenced', JSON.stringify(graph));
  const mutable = await enabled(
    root + '/peers/dids',
    await create(root + '/peers/dids', {
      name: 'Concurrent DID edit',
      number: '5550087',
      gatewayId: gateway.id,
    }),
  );
  const mutableIntent = await intent(one, 'dids', mutable.id);
  const edit = await queued(
    () => direct(a, path(one), 'POST', mutableIntent),
    () =>
      direct(b, `${root}/peers/dids/${mutable.id}`, 'PATCH', {
        expectedVersion: mutable.version,
        name: mutable.name,
        number: '5550086',
        gatewayId: gateway.id,
      }),
    mutableIntent.requestId,
  );
  assert.equal(edit[0].status, 201, JSON.stringify(edit));
  assert.equal(edit[1].data.reason, 'referenced', JSON.stringify(edit));
  const refreshGroup = await intent(one, 'groups', group.id, 'owned', 1);
  const allocationRace = await queued(
    () => direct(a, path(one), 'POST', refreshGroup),
    () =>
      direct(
        b,
        `/platform/tenants/${one.id}/allocations/${nodeId}/${claim1.id}/release`,
        'POST',
        {
          requestId: randomUUID(),
          ...tv(one),
          expectedVersion: claim1.version,
        },
      ),
    refreshGroup.requestId,
  );
  assert.equal(allocationRace[0].status, 200, JSON.stringify(allocationRace));
  assert.equal(
    allocationRace[1].data.reason,
    'referenced',
    JSON.stringify(allocationRace),
  );
  const gatewayDid = await enabled(
    root + '/peers/dids',
    await create(root + '/peers/dids', {
      name: 'Gateway serialization DID',
      number: '5550082',
      gatewayId: gateway.id,
    }),
  );
  const gatewayIntent = await intent(one, 'dids', gatewayDid.id);
  const gatewayRace = await queued(
    () => direct(a, path(one), 'POST', gatewayIntent),
    () =>
      direct(b, `${root}/peers/gateways/${gateway.id}`, 'PATCH', {
        expectedVersion: gateway.version,
        name: gateway.name,
        kind: gateway.kind,
        trunkId: gateway.trunkId,
        sourceAddresses: ['192.0.2.182'],
      }),
    gatewayIntent.requestId,
  );
  assert.equal(gatewayRace[0].status, 201, JSON.stringify(gatewayRace));
  assert.equal(
    gatewayRace[1].data.reason,
    'referenced',
    JSON.stringify(gatewayRace),
  );
  const removableTrunk = await enabled(
    root + '/peers/trunks',
    await create(root + '/peers/trunks', {
      name: 'Concurrent classified trunk',
      direction: 'both',
      settings: { ...settings, host: 'concurrent-trunk.invalid' },
    }),
  );
  const trunkIntent = await intent(one, 'trunks', removableTrunk.id, 'shared');
  const trunkRace = await queued(
    () => direct(a, path(one), 'POST', trunkIntent),
    () =>
      direct(b, `${root}/peers/trunks/${removableTrunk.id}/remove`, 'POST', {
        expectedVersion: removableTrunk.version,
      }),
    trunkIntent.requestId,
  );
  assert.equal(trunkRace[0].status, 201, JSON.stringify(trunkRace));
  assert.equal(
    trunkRace[1].data.reason,
    'referenced',
    JSON.stringify(trunkRace),
  );
  // SQL uniqueness and immutable identities/history protect writes through the real runtime role.
  await assert.rejects(
    runtime.query(
      `UPDATE public.tenant_route_authorizations SET tenant_id=$1 WHERE resource_id=$2`,
      [two.id, mutable.id],
    ),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    runtime.query(`DELETE FROM public.tenant_route_history`),
    (e) => e.code === '42501',
  );
  await assert.rejects(
    runtime.query(
      `UPDATE public.sip_dids SET number='5550085',version=version+1 WHERE id=$1`,
      [mutable.id],
    ),
    (e) => e.code === '23514',
  );
  await assert.rejects(
    runtime.query(`DELETE FROM public.ring_group_members WHERE group_id=$1`, [
      group.id,
    ]),
    (e) => e.code === '23514',
  );
  // Real lost COMMIT acknowledgement recovers the single immutable outcome on another replica.
  const extra = await enabled(
    root + '/peers/dids',
    await create(root + '/peers/dids', {
      name: 'Unknown response DID',
      number: '5550084',
      gatewayId: gateway.id,
    }),
  );
  const original = await intent(one, 'dids', extra.id);
  const { replica, commitProxy, proxy } = allocationDependencies;
  const loss = await commitProxy(/INSERT INTO public\.tenant_route_receipts/);
  const uncertain = await replica({
    productionHttp: true,
    runtimeUrl: loss.url,
  });
  assert.equal(
    (await direct(uncertain, path(one), 'POST', original)).status,
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
  assert.equal((await direct(unavailable, path(one))).status, 503);
  const redisLoss = await proxy('pause'),
    redisUnavailable = await replica({
      productionHttp: true,
      redisUrl: redisLoss.url,
    });
  redisLoss.arm();
  assert.equal((await direct(redisUnavailable, path(one))).status, 503);
  const actorId = randomUUID();
  await owner.query(
    `INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) SELECT $1,$2,'active',credential_state,password_hash,credential_changed_at FROM public.platform_operators WHERE id=$3`,
    [actorId, 'binding-' + actorId, session.operatorId],
  );
  const actorToken = (
      await issue(a, {
        plane: 'platform',
        identityId: actorId,
        authenticationVersion: 1,
      })
    ).token,
    actorCookie = `__Host-myims-platform=${actorToken}`;
  const actorProof = (
    await direct(a, '/platform/auth/session', 'GET', undefined, actorCookie)
  ).data.proof;
  const actorBody = { ...original, requestId: randomUUID() };
  await owner.query('BEGIN');
  let deniedActor;
  try {
    await owner.query(
      `UPDATE public.platform_operators SET status='disabled',authentication_version=authentication_version+1 WHERE id=$1`,
      [actorId],
    );
    deniedActor = direct(a, path(one), 'POST', actorBody, actorCookie, {
      'x-platform-csrf': actorProof,
    });
    await waiting('%public.platform_operators%FOR SHARE%');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await deniedActor).status, 403);
  assert.equal(
    (
      await owner.query(
        'SELECT 1 FROM public.tenant_route_receipts WHERE operator_id=$1 AND request_id=$2',
        [actorId, actorBody.requestId],
      )
    ).rows.length,
    0,
  );
  const suspended = await request('/platform/tenants', 'POST', {
    requestId: randomUUID(),
    tenantCode: 'binding-suspended-' + randomUUID().slice(0, 6),
    displayName: 'Ineligible binding tenant',
    administratorUsername: 'admin',
  });
  assert.equal(suspended.status, 201);
  await owner.query(
    `UPDATE public.tenants SET status='suspended',version=version+1,authority_version=authority_version+1 WHERE id=$1`,
    [suspended.data.tenant.id],
  );
  const denied = await request(path(suspended.data.tenant), 'POST', {
    ...original,
    requestId: randomUUID(),
    ...tv(suspended.data.tenant),
  });
  assert.equal(denied.status, 409);
  assert.equal(denied.data.reason, 'tenant_ineligible');
  console.log(
    'PASS binding real concurrent ownership/group/DID writers, SQL grants, unknown COMMIT and dependency outages',
  );
}
