// Read-only canonical plan export. Publication and native start remain explicit.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  manifest,
  fingerprint,
  stepId,
} from './tenant-call-preparation-store.mjs';
import {
  currentSuccessorFacts,
  successorPlan,
} from './tenant-call-preparation-supersession.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
assert.equal(process.argv.length, 4);
const p = manifest(JSON.parse(readFileSync(process.argv[2], 'utf8')));
const { SnapshotDatabase } = load(
  './dist/infrastructure/database/read-snapshot.js',
);
const db = new SnapshotDatabase(
  load('./dist/infrastructure/configuration.js').loadBackendConfig().database
    .url,
);
try {
  const plan = await db.read(async (s) => {
    const current = await currentSuccessorFacts(s, p);
    const runtime = (
      await s.query(
        'SELECT verified_id,runtime_state FROM public.pbx_live_runtime WHERE node_id=$1',
        [p.nodeId],
      )
    ).rows[0];
    assert.equal(runtime.runtime_state, 'verified');
    const event = (
      await s.query(
        'SELECT version,action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
        [p.requestId],
      )
    ).rows[0];
    assert.ok(event && event.action !== 'disable');
    const generation = (
      await s.query(
        'SELECT coalesce(max(generation),0)::integer AS n FROM public.tenant_call_preparation_fact_sets WHERE preparation_id=$1',
        [p.requestId],
      )
    ).rows[0].n;
    const cases = [];
    const add = (
      key,
      tenantId,
      direction,
      routeId,
      sourceId,
      dialled,
      destination = null,
      kind = 'routing',
    ) =>
      cases.push({
        key,
        tenantId,
        direction,
        routeId,
        sourceId,
        dialled,
        expectedDestinationId: destination,
        expectedOutcome: destination ? 'permitted' : 'denied',
        readinessRequired: !!destination,
        kind,
      });
    let expiryAdded = false;
    for (let index = 0; index < p.tenants.length; index++) {
      const tenantId = current.resources.tenantIds[index];
      const outgoing = current.outbound.find(
        (r) => r.pattern.digits === p.tenants[index].outboundNumber,
      );
      assert.ok(outgoing);
      for (const incoming of current.inbound) {
        const did = current.dids.find((d) => d.id === incoming.didId);
        assert.ok(did);
        if (current.routing.inbound(tenantId, incoming.id)) {
          assert.equal(incoming.destination.kind, 'extension');
          add(
            `in-${incoming.id}`,
            tenantId,
            'inbound',
            incoming.id,
            current.resources.gatewayId,
            did.number,
            incoming.destination.id,
          );
        } else if (
          current.resources.tenantIds.some(
            (t) => t !== tenantId && current.routing.inbound(t, incoming.id),
          )
        )
          add(
            `cross-in-${index}-${incoming.id}`,
            tenantId,
            'inbound',
            incoming.id,
            current.resources.gatewayId,
            did.number,
          );
      }
      let conditionalAdded = false;
      for (const sourceId of current.resources.extensionIds) {
        const own = current.routing.extension(tenantId, sourceId);
        if (own && current.routing.outbound(tenantId, outgoing.id)) {
          add(
            `out-${sourceId}`,
            tenantId,
            'outbound',
            outgoing.id,
            sourceId,
            outgoing.pattern.digits,
            current.resources.trunkId,
          );
          if (!conditionalAdded) {
            for (const kind of ['ordinary-draft', 'ambiguous-source'])
              add(
                `${kind}-${index}`,
                tenantId,
                'outbound',
                outgoing.id,
                sourceId,
                outgoing.pattern.digits,
                null,
                kind,
              );
            if (!expiryAdded) {
              add(
                `expiry-${index}`,
                tenantId,
                'outbound',
                outgoing.id,
                sourceId,
                outgoing.pattern.digits,
                null,
                'expiry',
              );
              expiryAdded = true;
            }
            conditionalAdded = true;
          }
        } else {
          const previouslyOwned =
            (
              await s.query(
                "SELECT 1 FROM public.tenant_inventory_claims WHERE tenant_id=$1 AND extension_id=$2 AND state='released' LIMIT 1",
                [tenantId, sourceId],
              )
            ).rows.length > 0;
          const stale =
            previouslyOwned &&
            !own &&
            current.resources.tenantIds.some(
              (t) => t !== tenantId && current.routing.extension(t, sourceId),
            );
          add(
            `deny-${index}-${sourceId}`,
            tenantId,
            'outbound',
            outgoing.id,
            sourceId,
            outgoing.pattern.digits,
            null,
            stale ? 'stale-source' : own ? 'unpermitted' : 'routing',
          );
        }
      }
      if (index === 0)
        add(
          'unknown-source',
          tenantId,
          'outbound',
          outgoing.id,
          stepId(p.requestId, 'unknown-source'),
          outgoing.pattern.digits,
        );
    }
    return successorPlan({
      version: 1,
      requestId: randomUUID(),
      expectedGeneration: generation,
      expectedLifecycleVersion:
        event.action === 'stop' ? event.version : event.version + 1,
      expectedArtifactId: runtime.verified_id,
      expectedSourceDigest: fingerprint(current.snapshot),
      facts: current.facts,
      cases,
    });
  });
  writeFileSync(process.argv[3], JSON.stringify(plan, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      state: 'successor_plan_exported',
      preparationId: p.requestId,
      expectedGeneration: plan.expectedGeneration,
      expectedLifecycleVersion: plan.expectedLifecycleVersion,
      cases: plan.cases.length,
      effects: false,
      output: process.argv[3],
    }),
  );
} finally {
  await db.close();
}
