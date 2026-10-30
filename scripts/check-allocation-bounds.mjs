import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkAllocationBounds({
  request,
  owner,
  root,
  path,
  one,
  nodeId,
  otherNode,
  deps,
  save,
}) {
  const stock = await request(root + '/extensions/bulk', 'POST', {
    requestId: randomUUID(),
    kind: 'sip',
    range: { start: '6300', end: '6349' },
    ...deps,
  });
  assert.equal(stock.status, 201, JSON.stringify(stock));
  const batch = await request(path(one), 'POST', save(one, stock.data.items));
  assert.equal(batch.status, 201, JSON.stringify(batch));
  assert.equal(batch.data.items.length, 50);
  const ids = new Set();
  let after = null;
  do {
    const r = await request(
      path(one) + '?limit=100' + (after ? '&after=' + after : ''),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(Buffer.byteLength(JSON.stringify(r.data)) <= 65536);
    for (const c of r.data.items) {
      assert.ok(!ids.has(c.id));
      ids.add(c.id);
    }
    after = r.data.nextCursor;
  } while (after);
  const total = (
    await owner.query(
      "SELECT count(*)::int AS n FROM public.tenant_inventory_claims WHERE tenant_id=$1 AND node_id=$2 AND state<>'released'",
      [one.id, nodeId],
    )
  ).rows[0].n;
  assert.equal(ids.size, total);
  const installation = (
    await owner.query(
      'SELECT installation_id FROM public.pbx_nodes WHERE id=$1',
      [otherNode],
    )
  ).rows[0].installation_id;
  await owner.query(
    "INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])",
    [installation],
  );
  const base = `/platform/pbx-nodes/${otherNode}`;
  const profile = await request(base + '/endpoint-profiles', 'POST', {
    requestId: randomUUID(),
    name: 'Other node allocation stock',
    template: 'sip-basic',
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  assert.equal(profile.status, 201, JSON.stringify(profile));
  const e = await request(base + '/extensions', 'POST', {
    requestId: randomUUID(),
    kind: 'sip',
    number: '6400',
    ...deps,
    profileId: profile.data.profile.id,
  });
  assert.equal(e.status, 201, JSON.stringify(e));
  const placed = await request(
    path(one, otherNode),
    'POST',
    save(one, [e.data.extension]),
  );
  assert.equal(placed.status, 201, JSON.stringify(placed));
  assert.equal((await request(path(one, otherNode))).data.capacity.reserved, 1);
  assert.equal(
    (await request(path(one, nodeId, placed.data.items[0].id))).status,
    404,
  );
  assert.equal(
    (await request(path(one, otherNode, placed.data.items[0].id))).data.items
      .length,
    1,
  );
  console.log(
    'PASS allocation 50-stock atomic save, byte-bounded complete pagination and explicit multi-node placement',
  );
}
