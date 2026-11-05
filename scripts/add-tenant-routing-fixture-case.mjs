// This is a trusted deployment-only writer for an exact disposable routing database.
import assert from 'node:assert/strict';
export async function addTenantRoutingFixtureCase(client, input) {
  const keys = [
    'requestId',
    'tenantId',
    'nodeId',
    'direction',
    'routeId',
    'sourceId',
    'dialled',
    'expectedDestinationId',
    'expectedOutcome',
    'readinessRequired',
    'kind',
  ];
  assert.ok(
    input &&
      typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.keys(input).every((k) => keys.includes(k)),
  );
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
  assert.ok(
    ['requestId', 'tenantId', 'nodeId', 'routeId', 'sourceId'].every((k) =>
      uuid(input[k]),
    ),
  );
  assert.ok(
    ['inbound', 'outbound'].includes(input.direction) &&
      /^[0-9]{1,15}$/.test(input.dialled ?? ''),
  );
  assert.ok(['permitted', 'denied'].includes(input.expectedOutcome));
  assert.ok(
    input.expectedOutcome === 'permitted'
      ? uuid(input.expectedDestinationId)
      : input.expectedDestinationId === null,
  );
  assert.equal(typeof input.readinessRequired, 'boolean');
  assert.ok(
    [
      'routing',
      'ambiguous-source',
      'ordinary-draft',
      'expiry',
      'stale-source',
      'unpermitted',
    ].includes(input.kind),
  );
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    const node = (
      await client.query(
        `SELECT n.installation_id FROM public.pbx_nodes n JOIN public.tenants t ON t.id=$2 WHERE n.id=$1 AND n.display_name='Native live fixture' AND t.normalized_code LIKE 'routing-%' AND t.display_name LIKE 'Controlled routing tenant %' FOR SHARE OF n`,
        [input.nodeId, input.tenantId],
      )
    ).rows[0];
    assert.ok(node);
    const table =
      input.direction === 'inbound' ? 'inbound_rules' : 'outbound_rules';
    const route = (
      await client.query(
        `SELECT id FROM public.${table} WHERE id=$1 AND node_id=$2 AND removed_at IS NULL`,
        [input.routeId, input.nodeId],
      )
    ).rows[0];
    assert.ok(route);
    const before = (
      await client.query(
        'SELECT * FROM public.tenant_route_test_cases WHERE id=$1',
        [input.requestId],
      )
    ).rows[0];
    if (before)
      assert.deepEqual(
        [
          before.node_id,
          before.tenant_id,
          before.direction,
          before.route_id,
          before.source_id,
          before.dialled,
          before.expected_destination_id,
          before.expected_outcome,
          before.readiness_required,
          before.test_kind,
        ],
        [
          input.nodeId,
          input.tenantId,
          input.direction,
          input.routeId,
          input.sourceId,
          input.dialled,
          input.expectedDestinationId,
          input.expectedOutcome,
          input.readinessRequired,
          input.kind,
        ],
      );
    if (!before)
      await client.query(
        `INSERT INTO public.tenant_route_test_cases(id,node_id,installation_id,tenant_id,direction,route_id,source_id,dialled,expected_destination_id,expected_outcome,enabled,readiness_required,test_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12)`,
        [
          input.requestId,
          input.nodeId,
          node.installation_id,
          input.tenantId,
          input.direction,
          input.routeId,
          input.sourceId,
          input.dialled,
          input.expectedDestinationId,
          input.expectedOutcome,
          input.readinessRequired,
          input.kind,
        ],
      );
    await client.query('COMMIT');
    return { caseId: input.requestId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}
