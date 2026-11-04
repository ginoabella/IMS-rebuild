import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkBindingLifecycle({
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
}) {
  const revoke = async (t, a) => {
    const body = {
      requestId: randomUUID(),
      ...tv(t),
      expectedVersion: a.version,
    };
    const r = await request(path(t, a.id + '/revoke'), 'POST', body);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.items[0].state, 'revoked');
    const replay = await request(path(t, a.id + '/revoke'), 'POST', body);
    assert.equal(replay.status, 200, JSON.stringify(replay));
    assert.equal(replay.data.replayed, true);
    assert.equal(replay.data.items[0].version, a.version + 1);
    return r.data.items[0];
  };
  const desiredOnly = await enabled(
    root + '/peers/dids',
    await create(root + '/peers/dids', {
      name: 'Desired-only release DID',
      number: '5550080',
      gatewayId: gateway.id,
    }),
  );
  const oldClaim = await save(one, 'dids', desiredOnly.id);
  await revoke(one, oldClaim);
  const replacement = await save(two, 'dids', desiredOnly.id);
  assert.notEqual(replacement.id, oldClaim.id);
  const retained = (
    await owner.query(
      'SELECT tenant_id,state,resource_id FROM public.tenant_route_authorizations WHERE id=$1',
      [oldClaim.id],
    )
  ).rows[0];
  assert.equal(retained.tenant_id, one.id);
  assert.equal(retained.state, 'revoked');
  assert.equal(retained.resource_id, desiredOnly.id);
  const hangup = await enabled(
    root + '/routing/inbound',
    await create(root + '/routing/inbound', {
      name: 'Tenant exact denial destination',
      gatewayId: gateway.id,
      didId: desiredOnly.id,
      destination: { kind: 'hangup' },
    }),
  );
  await save(two, 'inbound', hangup.id);
  const denialReview = await request(path(two, 'preview'), 'POST', {
    kind: 'inbound',
    resourceId: hangup.id,
    scope: 'owned',
  });
  assert.equal(denialReview.data.compatible, true);
  assert.equal(denialReview.data.callingEligible, false);
  const oldBinding = (await request(path(one))).data.items.find(
    (a) => a.kind === 'inbound' && a.resourceId === inbound[0].id,
  );
  const identity = async () =>
    (
      await owner.query(
        `SELECT md5(source_key||context_hash||watch_identity||attribution_key) AS digest FROM public.inbound_rules WHERE id=$1`,
        [inbound[0].id],
      )
    ).rows[0].digest;
  const before = await identity();
  await revoke(one, oldBinding);
  const rebound = await save(one, 'inbound', inbound[0].id);
  assert.notEqual(rebound.id, oldBinding.id);
  assert.equal(rebound.resourceId, oldBinding.resourceId);
  assert.equal(await identity(), before);
  const history = (await request(path(one) + '?history=true')).data.items;
  assert.ok(
    history.some(
      (a) =>
        a.id === oldBinding.id &&
        a.state === 'revoked' &&
        a.tenantId === one.id,
    ),
  );
  console.log(
    'PASS binding explicit desired-only release, retained tenant ownership/history, unbind/rebind replay and unchanged route identities',
  );
}
