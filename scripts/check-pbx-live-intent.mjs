// Real PostgreSQL/two HTTP replicas. Deliberately no native/provider effects.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkPbxLiveIntent({
  request,
  direct,
  owner,
  nodeId,
  a,
  b,
  revision,
  extensionId,
}) {
  const root = `/platform/pbx-nodes/${nodeId}`;
  const path = root + '/revisions/live';
  const baseline = randomUUID();
  const body = {
    requestId: randomUUID(),
    revisionId: revision.id,
    expectedBaselineId: baseline,
  };
  assert.equal(
    (await direct(a, path + '/apply', 'POST', body)).data.reason,
    'verified_baseline_required',
  );
  assert.equal((await request(path)).data.available, false);
  // Explicit fixture metadata establishes only acceptance/pinning semantics. This
  // is NOT an independently verified PBX baseline or B-03 promotion evidence.
  await owner.query(
    'INSERT INTO public.pbx_live_artifacts(id,node_id,revision_id,initial_baseline,verified_at) VALUES($1,$2,NULL,true,clock_timestamp())',
    [baseline, nodeId],
  );
  await owner.query(
    "INSERT INTO public.pbx_live_runtime(node_id,installed_id,verified_id,known_good_id,runtime_state,baseline_verified_at) VALUES($1,$2,$2,$2,'verified',clock_timestamp())",
    [nodeId, baseline],
  );
  assert.equal(
    (await request(path)).data.available,
    false,
    'metadata without executor cannot enable browser Apply',
  );
  const detail = await request(root + '/revisions/' + revision.id);
  assert.equal(detail.data.runtimeDiff.runtime.artifactId, baseline);
  const validation = await request(
    root + '/revisions/' + revision.id + '/validate',
    'POST',
    {},
  );
  assert.equal(validation.data.validation.local, 'passed');
  const before = (
    await owner.query(
      'SELECT count(*)::int AS n FROM public.pbx_live_operations WHERE node_id=$1',
      [nodeId],
    )
  ).rows[0].n;
  await owner.query(
    "CREATE FUNCTION public.reject_live_intent_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='telephony.revision.live' THEN RAISE EXCEPTION 'owned live acceptance fault'; END IF; RETURN NEW; END $$",
  );
  await owner.query(
    'CREATE TRIGGER live_intent_check_fault BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_live_intent_check()',
  );
  const rolledBack = randomUUID();
  try {
    assert.equal(
      (
        await direct(a, path + '/apply', 'POST', {
          ...body,
          requestId: rolledBack,
        })
      ).status,
      503,
    );
  } finally {
    await owner.query(
      'DROP TRIGGER live_intent_check_fault ON public.audit_events',
    );
    await owner.query('DROP FUNCTION public.reject_live_intent_check()');
  }
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM public.pbx_live_operations WHERE node_id=$1',
        [nodeId],
      )
    ).rows[0].n,
    before,
  );
  assert.equal((await direct(b, path + '/receipts/' + rolledBack)).status, 404);
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM public.pbx_live_pins WHERE node_id=$1',
        [nodeId],
      )
    ).rows[0].n,
    0,
  );
  const accepted = await Promise.all([
    direct(a, path + '/apply', 'POST', body),
    direct(b, path + '/apply', 'POST', body),
  ]);
  assert.ok(
    accepted.every((value) => [200, 202].includes(value.status)),
    JSON.stringify(accepted),
  );
  const operation = accepted[0].data.operation;
  assert.equal(accepted[1].data.operation.id, operation.id);
  assert.equal(
    (await direct(b, path + '/receipts/' + body.requestId)).data.operation.id,
    operation.id,
  );
  assert.equal(
    (
      await direct(a, path + '/apply', 'POST', {
        ...body,
        revisionId: randomUUID(),
      })
    ).data.reason,
    'request_conflict',
  );
  assert.equal(
    (
      await direct(b, path + '/apply', 'POST', {
        ...body,
        requestId: randomUUID(),
      })
    ).data.reason,
    'operation_unresolved',
  );
  assert.equal(
    (
      await owner.query(
        "SELECT count(*)::int AS n FROM public.outbox_work WHERE work_type='telephony.revision.apply' AND payload->>'operationId'=$1",
        [operation.id],
      )
    ).rows[0].n,
    1,
  );
  const pins = (
    await owner.query(
      'SELECT kind,resource_id FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL',
      [nodeId],
    )
  ).rows;
  assert.ok(
    pins.some(
      (pin) => pin.kind === 'extensions' && pin.resource_id === extensionId,
    ),
  );
  await assert.rejects(
    owner.query('DELETE FROM public.extensions WHERE id=$1', [extensionId]),
    (error) => error.code === '23514',
  );
  await assert.rejects(
    owner.query('UPDATE public.extensions SET number=$2 WHERE id=$1', [
      extensionId,
      '9999',
    ]),
    (error) => error.code === '23514',
  );
  for (const sql of [
    'UPDATE public.pbx_live_operations SET target_id=gen_random_uuid() WHERE id=$1',
    'DELETE FROM public.pbx_live_operations WHERE id=$1',
  ])
    await assert.rejects(
      owner.query(sql, [operation.id]),
      (error) => error.code === '23514',
    );
  await owner.query('SET ROLE myims_runtime');
  try {
    for (const sql of [
      "UPDATE public.pbx_live_runtime SET runtime_state='verified' WHERE node_id=$1",
      "UPDATE public.pbx_live_progress SET verification='passed' WHERE node_id=$1",
      "UPDATE public.pbx_live_pins SET released_at=clock_timestamp(),release_operation_id='" +
        operation.id +
        "' WHERE node_id=$1",
    ])
      await assert.rejects(
        owner.query(sql, [nodeId]),
        (error) => error.code === '42501',
      );
  } finally {
    await owner.query('RESET ROLE');
  }
  const metadata = (
    await owner.query(
      "SELECT metadata FROM public.audit_events WHERE event_type='telephony.revision.live' AND metadata->>'operationId'=$1",
      [operation.id],
    )
  ).rows;
  assert.equal(metadata.length, 1);
  assert.ok(!/password|token|pjsip|\/var\//i.test(JSON.stringify(metadata)));
  console.log(
    'PASS live intent: actual PostgreSQL/two-replica atomic intent/audit/pin/outbox rollback, exact duplicate and receipt, unresolved serialization, immutable history, actual structural-removal blockers and least-privilege promotion/pin-release denial; fixture metadata only, no live baseline claim',
  );
}
