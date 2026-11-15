// Trusted deployment only: append exact successor cases after canonical transfer.
// No resource, credential, grant, runtime, fixture or call writer is imported.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fingerprint, stepId, uuid } from './tenant-call-preparation-store.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { captureSnapshot } = load(
  './dist/modules/telephony/adapters/db/revision-snapshot.js',
);
const { tenantRouting } = load(
  './dist/modules/telephony/domain/tenant-routing.js',
);
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();
const kinds = [
  'tenant',
  'extension',
  'claim',
  'gateway',
  'trunk',
  'inbound',
  'outbound',
  'did',
  'profile',
];
export function successorPlan(input) {
  assert.ok(
    exactKeys(input, [
      'version',
      'requestId',
      'expectedGeneration',
      'expectedLifecycleVersion',
      'expectedArtifactId',
      'expectedSourceDigest',
      'facts',
      'cases',
    ]),
  );
  assert.equal(input.version, 1);
  assert.ok(uuid(input.requestId) && uuid(input.expectedArtifactId));
  assert.match(input.expectedSourceDigest, /^[a-f0-9]{64}$/);
  assert.ok(
    Number.isSafeInteger(input.expectedGeneration) &&
      input.expectedGeneration >= 0 &&
      input.expectedGeneration < 1000,
  );
  assert.ok(
    Number.isSafeInteger(input.expectedLifecycleVersion) &&
      input.expectedLifecycleVersion > 0,
  );
  assert.ok(
    Array.isArray(input.facts) &&
      input.facts.length > 0 &&
      input.facts.length <= 128,
  );
  for (const f of input.facts) {
    assert.ok(
      exactKeys(f, ['kind', 'resourceId', 'version', 'authorityVersion']),
    );
    assert.ok(
      kinds.includes(f.kind) &&
        uuid(f.resourceId) &&
        Number.isSafeInteger(f.version) &&
        f.version > 0,
    );
    assert.ok(
      f.kind === 'tenant'
        ? Number.isSafeInteger(f.authorityVersion) && f.authorityVersion > 0
        : f.authorityVersion === null,
    );
  }
  assert.equal(
    new Set(input.facts.map((f) => `${f.kind}:${f.resourceId}`)).size,
    input.facts.length,
  );
  assert.ok(
    Array.isArray(input.cases) &&
      input.cases.length > 0 &&
      input.cases.length <= 32,
  );
  for (const c of input.cases) {
    assert.ok(
      exactKeys(c, [
        'key',
        'tenantId',
        'direction',
        'routeId',
        'sourceId',
        'dialled',
        'expectedDestinationId',
        'expectedOutcome',
        'readinessRequired',
        'kind',
      ]),
    );
    assert.match(c.key, /^[a-z][a-z0-9-]{0,55}$/);
    assert.ok([c.tenantId, c.routeId, c.sourceId].every(uuid));
    assert.ok(['inbound', 'outbound'].includes(c.direction));
    assert.match(c.dialled, /^[0-9]{1,15}$/);
    assert.ok(
      [
        'routing',
        'ordinary-draft',
        'ambiguous-source',
        'stale-source',
        'expiry',
        'unpermitted',
      ].includes(c.kind),
    );
    assert.ok(['permitted', 'denied'].includes(c.expectedOutcome));
    assert.equal(typeof c.readinessRequired, 'boolean');
    assert.ok(
      c.expectedOutcome === 'permitted'
        ? uuid(c.expectedDestinationId) && c.kind === 'routing'
        : c.expectedDestinationId === null,
    );
  }
  assert.equal(new Set(input.cases.map((c) => c.key)).size, input.cases.length);
  assert.ok(Buffer.byteLength(JSON.stringify(input)) <= 65536);
  return input;
}
const sortFacts = (facts) =>
  [...facts].sort((a, b) =>
    `${a.kind}:${a.resourceId}`.localeCompare(`${b.kind}:${b.resourceId}`),
  );
export async function currentSuccessorFacts(client, p) {
  const parent = (
    await client.query(
      "SELECT result FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step='cases' AND phase='outcome'",
      [p.requestId],
    )
  ).rows[0]?.result;
  assert.ok(parent?.resources);
  const resources = parent.resources;
  const snapshot = await captureSnapshot(client, p.nodeId);
  assert.equal(snapshot.node.id, p.nodeId);
  assert.equal(snapshot.node.installationId, p.installationId);
  assert.equal(snapshot.node.version, p.expectedNodeVersion);
  assert.equal(snapshot.capability?.version, p.expectedCapabilityRevision);
  const routing = tenantRouting(snapshot);
  assert.equal(routing.valid, true);
  const tenants = snapshot.tenantRouting.tenants.filter((t) =>
    resources.tenantIds.includes(t.id),
  );
  assert.equal(tenants.length, 2);
  assert.ok(tenants.every((t) => t.status === 'draft'));
  const extensions = snapshot.extensions.filter((e) =>
    resources.extensionIds.includes(e.id),
  );
  assert.equal(extensions.length, 3);
  assert.deepEqual(
    extensions.map((e) => e.number).sort(),
    [...p.tenants.map((t) => t.extensionNumber), p.unallocatedNumber].sort(),
  );
  const profiles = snapshot.profiles.filter((profile) =>
    extensions.some(
      (e) => e.profileId === profile.id && e.profileVersion === profile.version,
    ),
  );
  assert.equal(profiles.length, 1);
  const originalProfile = (
    await client.query(
      "SELECT resource_id FROM public.tenant_call_preparation_facts WHERE preparation_id=$1 AND kind='profile'",
      [p.requestId],
    )
  ).rows;
  assert.equal(originalProfile.length, 1);
  assert.equal(profiles[0].id, originalProfile[0].resource_id);
  const profileHead = (
    await client.query(
      'SELECT head_version FROM public.endpoint_profiles WHERE id=$1 AND node_id=$2',
      [profiles[0].id, p.nodeId],
    )
  ).rows[0];
  assert.equal(profileHead?.head_version, profiles[0].version);
  const gateways = snapshot.gateways.filter(
    (g) => g.id === resources.gatewayId,
  );
  const trunks = snapshot.trunks.filter((t) => t.id === resources.trunkId);
  assert.equal(gateways.length, 1);
  assert.equal(trunks.length, 1);
  assert.deepEqual(gateways[0].sourceAddresses, ['127.0.0.2']);
  assert.equal(trunks[0].settings.host, '127.0.0.4');
  assert.equal(trunks[0].settings.port, 20020);
  const dids = snapshot.dids.filter(
    (d) =>
      d.gatewayId === resources.gatewayId &&
      p.tenants.some((t) => t.inboundNumber === d.number),
  );
  assert.equal(dids.length, 2);
  const inbound = snapshot.inbound.filter(
    (r) =>
      r.gatewayId === resources.gatewayId && dids.some((d) => d.id === r.didId),
  );
  assert.ok(
    inbound.every(
      (r) =>
        r.destination.kind === 'hangup' ||
        (r.destination.kind === 'extension' &&
          resources.extensionIds.includes(r.destination.id)),
    ),
  );
  const outbound = snapshot.outbound.filter(
    (r) =>
      r.trunkId === resources.trunkId &&
      r.pattern.kind === 'exact' &&
      p.tenants.some((t) => t.outboundNumber === r.pattern.digits),
  );
  assert.equal(outbound.length, 2);
  const claims = snapshot.tenantRouting.allocations.filter((c) =>
    resources.extensionIds.includes(c.extensionId),
  );
  assert.ok(claims.every((c) => resources.tenantIds.includes(c.tenantId)));
  const facts = [];
  for (const [kind, rows] of [
    ['tenant', tenants],
    ['extension', extensions],
    ['claim', claims],
    ['profile', profiles],
    ['gateway', gateways],
    ['trunk', trunks],
    ['did', dids],
    ['inbound', inbound],
    ['outbound', outbound],
  ])
    for (const r of rows)
      facts.push({
        kind,
        resourceId: r.id,
        version: r.version,
        authorityVersion: kind === 'tenant' ? r.authorityVersion : null,
      });
  // Successors cannot replace the original exact three provider operations.
  const credentials = (
    await client.query(
      "SELECT o.extension_id,o.generation_id FROM public.tenant_call_preparation_steps s JOIN public.endpoint_credential_operations o ON o.id=(s.result->>'operationId')::uuid WHERE s.preparation_id=$1 AND s.step IN ('credential-0','credential-1','credential-2') AND s.phase='outcome' AND o.node_id=$2 AND o.state='associated' AND o.material_health='verified'",
      [p.requestId, p.nodeId],
    )
  ).rows;
  assert.equal(credentials.length, 3);
  assert.ok(
    extensions.every((e) =>
      credentials.some(
        (c) => c.extension_id === e.id && c.generation_id === e.generationId,
      ),
    ),
  );
  return {
    facts: sortFacts(facts),
    snapshot,
    resources,
    routing,
    inbound,
    outbound,
    dids,
  };
}
export async function publishSuccessor(store, supplied) {
  const plan = successorPlan(supplied),
    p = store.input,
    client = store.client;
  return store.locked(() =>
    store.transaction(async () => {
      await client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
        [p.nodeId],
      );
      await store.verifyExisting();
      const previous = (
        await client.query(
          'SELECT * FROM public.tenant_call_preparation_fact_sets WHERE request_id=$1',
          [plan.requestId],
        )
      ).rows[0];
      if (previous) {
        assert.equal(previous.preparation_id, p.requestId);
        assert.equal(previous.fingerprint, fingerprint(plan));
        return {
          generation: previous.generation,
          caseIds: previous.case_ids,
          replayed: true,
        };
      }
      const latest = (
        await client.query(
          'SELECT generation FROM public.tenant_call_preparation_fact_sets WHERE preparation_id=$1 ORDER BY generation DESC LIMIT 1',
          [p.requestId],
        )
      ).rows[0];
      assert.equal(latest?.generation ?? 0, plan.expectedGeneration);
      const event = (
        await client.query(
          'SELECT version,action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
          [p.requestId],
        )
      ).rows[0];
      assert.equal(event?.version, plan.expectedLifecycleVersion);
      assert.equal(event.action, 'stop');
      const runtime = (
        await client.query(
          "SELECT r.*,v.source_digest,o.expires_at>statement_timestamp() AS owner_current,(r.executor_seen_at>statement_timestamp()-interval '15 seconds' AND f.valid AND f.artifact_id=r.verified_id AND f.source_digest=v.source_digest AND f.owner_epoch=o.epoch AND f.runtime_generation=r.routing_generation AND f.checked_at>statement_timestamp()-interval '15 seconds') IS TRUE AS native_current FROM public.pbx_live_runtime r JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id JOIN public.pbx_ownership o ON o.node_id=r.node_id AND o.epoch=r.boundary_epoch LEFT JOIN public.tenant_runtime_proofs f ON f.node_id=r.node_id WHERE r.node_id=$1 AND v.compiler_version='tenant-review-1' AND v.policy_version='tenant-routing-1'",
          [p.nodeId],
        )
      ).rows[0];
      assert.ok(runtime?.owner_current);
      assert.equal(runtime.native_current, true);
      assert.equal(runtime.runtime_state, 'verified');
      for (const key of ['installed_id', 'verified_id', 'known_good_id'])
        assert.equal(runtime[key], plan.expectedArtifactId);
      for (const key of [
        'active_operation_id',
        'active_retirement_id',
        'active_profile_operation_id',
      ])
        assert.equal(runtime[key], null);
      assert.equal(runtime.source_digest, plan.expectedSourceDigest);
      assert.equal(
        (
          await client.query(
            "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown')",
            [p.nodeId],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await client.query(
            'SELECT 1 FROM public.tenant_verification_grants g WHERE g.node_id=$1 AND g.expires_at>statement_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations r WHERE r.grant_id=g.id)',
            [p.nodeId],
          )
        ).rows.length,
        0,
      );
      const current = await currentSuccessorFacts(client, p);
      assert.equal(fingerprint(current.snapshot), plan.expectedSourceDigest);
      assert.deepEqual(sortFacts(plan.facts), current.facts);
      for (const c of plan.cases) {
        assert.ok(current.resources.tenantIds.includes(c.tenantId));
        const route = (
          c.direction === 'inbound' ? current.inbound : current.outbound
        ).find((r) => r.id === c.routeId);
        assert.ok(route);
        assert.ok(
          c.direction === 'inbound'
            ? c.sourceId === current.resources.gatewayId &&
                current.dids.some(
                  (d) => d.id === route.didId && d.number === c.dialled,
                )
            : p.tenants.some((t) => t.outboundNumber === c.dialled) &&
                (current.resources.extensionIds.includes(c.sourceId) ||
                  c.sourceId === stepId(p.requestId, 'unknown-source')),
        );
        if (
          c.expectedOutcome === 'denied' &&
          !['ordinary-draft', 'ambiguous-source', 'expiry'].includes(c.kind)
        ) {
          const wouldPermit =
            c.direction === 'inbound'
              ? current.routing.inbound(c.tenantId, c.routeId)
              : current.routing.extension(c.tenantId, c.sourceId) &&
                current.routing.outboundRule(c.tenantId, c.dialled)?.id ===
                  c.routeId;
          assert.equal(
            wouldPermit,
            false,
            'A currently permitted route cannot be published as an unconditional denial',
          );
        }
        if (c.expectedOutcome === 'permitted') {
          if (c.direction === 'inbound') {
            assert.equal(current.routing.inbound(c.tenantId, c.routeId), true);
            assert.deepEqual(route.destination, {
              kind: 'extension',
              id: c.expectedDestinationId,
            });
          } else {
            assert.equal(
              current.routing.extension(c.tenantId, c.sourceId),
              true,
            );
            assert.equal(
              current.routing.outboundRule(c.tenantId, c.dialled)?.id,
              c.routeId,
            );
            assert.equal(c.expectedDestinationId, current.resources.trunkId);
          }
        }
      }
      for (const tenantId of current.resources.tenantIds) {
        const other = (
          await client.query(
            'SELECT count(*)::integer AS n FROM public.tenant_route_test_cases c WHERE c.tenant_id=$1 AND c.node_id=$2 AND c.enabled AND NOT EXISTS(SELECT 1 FROM public.tenant_route_case_disables d WHERE d.case_id=c.id) AND NOT EXISTS(SELECT 1 FROM public.tenant_call_preparation_cases owned WHERE owned.case_id=c.id AND owned.preparation_id=$3)',
            [tenantId, p.nodeId, p.requestId],
          )
        ).rows[0].n;
        assert.ok(
          other + plan.cases.filter((c) => c.tenantId === tenantId).length <=
            16,
        );
      }
      await client.query(
        'INSERT INTO public.tenant_route_case_disables(case_id,request_id,preparation_id) SELECT case_id,$2,preparation_id FROM public.tenant_call_preparation_cases WHERE preparation_id=$1 ON CONFLICT DO NOTHING',
        [p.requestId, plan.requestId],
      );
      const ids = [];
      for (const c of plan.cases) {
        const id = stepId(plan.requestId, 'case-' + c.key);
        await client.query(
          'INSERT INTO public.tenant_route_test_cases(id,node_id,installation_id,tenant_id,direction,route_id,source_id,dialled,expected_destination_id,expected_outcome,enabled,readiness_required,test_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12)',
          [
            id,
            p.nodeId,
            p.installationId,
            c.tenantId,
            c.direction,
            c.routeId,
            c.sourceId,
            c.dialled,
            c.expectedDestinationId,
            c.expectedOutcome,
            c.readinessRequired,
            c.kind,
          ],
        );
        await client.query(
          'INSERT INTO public.tenant_call_preparation_cases(preparation_id,case_id) VALUES($1,$2)',
          [p.requestId, id],
        );
        ids.push(id);
      }
      const generation = plan.expectedGeneration + 1;
      await client.query(
        'INSERT INTO public.tenant_call_preparation_fact_sets(preparation_id,generation,request_id,fingerprint,operator_id,authentication_version,source_digest,facts,case_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          p.requestId,
          generation,
          plan.requestId,
          fingerprint(plan),
          p.operatorId,
          p.authenticationVersion,
          plan.expectedSourceDigest,
          JSON.stringify(current.facts),
          ids,
        ],
      );
      await client.query(
        'UPDATE public.tenant_call_custody_proofs SET valid=false WHERE node_id=$1',
        [p.nodeId],
      );
      await store.audit('step');
      return { generation, caseIds: ids, replayed: false };
    }),
  );
}
