// Trusted test-only metadata writer for a disposable, labelled native fixture.
// Custody proof is explicitly synthetic here; ordinary setup never imports this.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export async function controlledLifecycleFixture(client, input) {
  const uuid = (v) =>
    typeof v === 'string' &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
  assert.equal(
    Object.keys(input).sort().join(),
    ['requestId', 'nodeId', 'fixturePreparation'].sort().join(),
  );
  const selection = input.fixturePreparation;
  assert.equal(
    Object.keys(selection).sort().join(),
    ['action', 'caseId', 'preparationId'].sort().join(),
  );
  assert.ok(
    [
      input.requestId,
      input.nodeId,
      selection.caseId,
      selection.preparationId,
    ].every(uuid),
  );
  assert.ok(['create', 'start', 'stop', 'disable'].includes(selection.action));
  assert.match(
    (await client.query('SELECT current_database() AS name')).rows[0].name,
    /^myims_session_[a-f0-9]{12}$/,
  );
  await client.query('BEGIN');
  try {
    const node = (
      await client.query(
        "SELECT n.installation_id,n.created_by,c.tenant_id,o.epoch,p.instance_id,r.verified_id,v.source_digest FROM public.pbx_nodes n JOIN public.tenant_route_test_cases c ON c.node_id=n.id JOIN public.tenants t ON t.id=c.tenant_id JOIN public.pbx_ownership o ON o.node_id=n.id JOIN public.tenant_call_participant_instances p ON p.node_id=n.id JOIN public.pbx_live_runtime r ON r.node_id=n.id JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE n.id=$1 AND c.id=$2 AND n.display_name='Native live fixture' AND t.normalized_code LIKE 'routing-%' FOR UPDATE OF n",
        [input.nodeId, selection.caseId],
      )
    ).rows[0];
    assert.ok(node);
    const action = selection.action === 'create' ? 'start' : selection.action;
    const previous = (
      await client.query(
        'SELECT preparation_id,action FROM public.tenant_call_preparation_events WHERE request_id=$1',
        [input.requestId],
      )
    ).rows[0];
    if (previous)
      assert.deepEqual(previous, {
        preparation_id: selection.preparationId,
        action,
      });
    else {
      if (selection.action === 'create') {
        const fingerprint = createHash('sha256')
          .update(JSON.stringify([input.nodeId, selection.caseId]))
          .digest('hex');
        await client.query(
          'INSERT INTO public.tenant_call_preparations(id,node_id,installation_id,operator_id,authentication_version,fingerprint,definition) SELECT $1,$2,$3,$4,authentication_version,$5,$6 FROM public.platform_operators WHERE id=$4',
          [
            selection.preparationId,
            input.nodeId,
            node.installation_id,
            node.created_by,
            fingerprint,
            { fixture: 'synthetic-private-sip', caseId: selection.caseId },
          ],
        );
        await client.query(
          'INSERT INTO public.tenant_call_preparation_cases(preparation_id,case_id) VALUES($1,$2)',
          [selection.preparationId, selection.caseId],
        );
      }
      assert.equal(
        (
          await client.query(
            'SELECT preparation_id FROM public.tenant_call_preparation_cases WHERE case_id=$1',
            [selection.caseId],
          )
        ).rows[0]?.preparation_id,
        selection.preparationId,
      );
      const latest = (
        await client.query(
          'SELECT version,action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
          [selection.preparationId],
        )
      ).rows[0];
      assert.notEqual(latest?.action, 'disable');
      if (action === 'start')
        await client.query(
          'INSERT INTO public.tenant_call_custody_proofs(node_id,owner_epoch,source_digest,valid) VALUES($1,$2,$3,true) ON CONFLICT(node_id) DO UPDATE SET owner_epoch=excluded.owner_epoch,source_digest=excluded.source_digest,valid=true,checked_at=clock_timestamp()',
          [input.nodeId, node.epoch, node.source_digest],
        );
      await client.query(
        'INSERT INTO public.tenant_call_preparation_events(request_id,preparation_id,version,action,owner_epoch,participant_instance) VALUES($1,$2,$3,$4,$5,$6)',
        [
          input.requestId,
          selection.preparationId,
          (latest?.version ?? 0) + 1,
          action,
          node.epoch,
          node.instance_id,
        ],
      );
      if (action === 'disable')
        await client.query(
          'INSERT INTO public.tenant_route_case_disables(case_id,request_id,preparation_id) VALUES($1,$2,$3)',
          [selection.caseId, input.requestId, selection.preparationId],
        );
    }
    await client.query('COMMIT');
    return { caseId: selection.caseId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
