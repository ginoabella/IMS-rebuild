// Ordinary no-call grant/restart proof; restarting services is a separate explicit step.
import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 30000 });
export async function checkOrdinaryRestart(s) {
  const {
    stage,
    page,
    p,
    tenants,
    query,
    get,
    button,
    openTenant,
    journal,
    save,
    readStage,
  } = s;
  const evidence = async () =>
    (
      await query(
        "SELECT (SELECT count(*)::integer FROM public.tenant_route_test_intents WHERE node_id=$1) AS tests,(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.intent_id)::text,'[]'),'UTF8')),'hex') FROM public.tenant_route_test_results r JOIN public.tenant_route_test_intents i ON i.id=r.intent_id WHERE i.node_id=$1) AS resultsHash",
        [p.nodeId],
      )
    )[0];
  const runtime = async () =>
    (
      await query(
        'SELECT r.verified_id,r.routing_generation,r.boundary_epoch::text AS epoch,v.source_digest FROM public.pbx_live_runtime r JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE r.node_id=$1',
        [p.nodeId],
      )
    )[0];
  if (stage === 'restart-grant') {
    assert.equal(
      (
        await query(
          'SELECT 1 FROM public.tenant_verification_grants g WHERE node_id=$1 AND expires_at>statement_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations v WHERE v.grant_id=g.id)',
          [p.nodeId],
        )
      ).length,
      0,
    );
    for (const tenant of tenants) {
      await openTenant(tenant);
      const path = `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`;
      const before = await get(path);
      const c = before.cases.find(
        (c) => c.expectedOutcome === 'permitted' && c.available === true,
      );
      if (!c) continue;
      await page
        .getByRole('checkbox', { name: new RegExp(`^Permit case ${c.id}:`) })
        .check();
      await page.getByLabel(/^Verification lifetime/).selectOption('900');
      await button('Grant verification').click();
      await expect(
        page.getByText('Intent recorded. Reload for the current outcome.', {
          exact: true,
        }),
      ).toBeVisible();
      const view = await get(path),
        grant = view.grants.find((g) => g.active);
      assert.ok(grant);
      journal.restartGrant = {
        tenantId: tenant.id,
        caseId: c.id,
        grant,
        runtime: await runtime(),
        evidence: await evidence(),
      };
      save();
      return;
    }
    throw new Error(
      'No approved current positive case for no-call restart proof',
    );
  }
  assert.equal(stage, 'restart-check');
  const recorded = readStage('restart-grant');
  assert.equal(recorded.state, 'stage_passed');
  const prior = recorded.restartGrant;
  const tenant = tenants.find((t) => t.id === prior.tenantId);
  assert.ok(tenant);
  const current = await runtime();
  assert.equal(current.verified_id, prior.runtime.verified_id);
  assert.equal(current.source_digest, prior.runtime.source_digest);
  assert.ok(BigInt(current.epoch) > BigInt(prior.runtime.epoch));
  assert.ok(current.routing_generation > prior.runtime.routing_generation);
  assert.deepEqual(await evidence(), prior.evidence);
  await openTenant(tenant);
  const path = `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`;
  const view = await get(path),
    grant = view.grants.find((g) => g.id === prior.grant.id);
  assert.ok(grant);
  assert.equal(grant.createdAt, prior.grant.createdAt);
  assert.equal(grant.expiresAt, prior.grant.expiresAt);
  assert.ok(Date.parse(grant.expiresAt) > Date.now());
  assert.equal(grant.active, false);
  assert.equal(
    view.cases.find((c) => c.id === prior.caseId)?.available,
    true,
    'Explicit fresh-instance preparation start is required before this check',
  );
  await page.getByLabel(/^Draft verification grant/).selectOption(grant.id);
  await page.getByLabel(/^Controlled call case/).selectOption(prior.caseId);
  await button('Run controlled call test').click();
  await expect(
    page.getByText(
      'Select a current verification grant for this operator and controlled case.',
      { exact: true },
    ),
  ).toBeVisible();
  assert.deepEqual(await evidence(), prior.evidence);
  journal.restartProof = {
    unchangedArtifactAndSource: true,
    oldEpoch: prior.runtime.epoch,
    newEpoch: current.epoch,
    unchangedGrantTimes: true,
    unchangedTestsAndResultTimes: true,
    staleGrantRejectedBeforeIntent: true,
  };
  save();
  await button('Revoke selected grant').click();
  await expect
    .poll(
      async () =>
        (
          await query(
            'SELECT grant_id FROM public.tenant_verification_revocations WHERE grant_id=$1',
            [grant.id],
          )
        ).length,
    )
    .toBe(1);
}
