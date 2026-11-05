import { RoutingRepository } from '../adapters/db/routing-repository';
import { PeerRepository } from '../adapters/db/peer-repository';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { RouteAuthorization } from '@myims/contracts';
import { bindingBlockers } from '../adapters/db/route-binding-repository';
import { BindingRejected } from '../domain/tenant-route-bindings';
import {
  RuntimeDependencies,
  RetainedRuntimeDependency,
} from './runtime-dependencies';
export async function releaseRouteOwnership(
  tx: Transaction,
  old: RouteAuthorization,
) {
  const blockers = await bindingBlockers(
    tx,
    old.nodeId,
    'authorization',
    old.id,
  );
  if (blockers.length) throw new BindingRejected('referenced', blockers);
  if (old.kind !== 'dids' && old.kind !== 'groups' && old.kind !== 'trunks')
    return;
  const desired: { id: string; name: string; kind: string }[] =
    old.kind === 'groups'
      ? await new RoutingRepository().blockers(tx, old.nodeId, old.resourceId)
      : await new PeerRepository().blockers(tx, old.kind, old.resourceId);
  if (old.kind === 'trunks')
    desired.push(
      ...(await new PeerRepository().outboundBlockers(tx, old.resourceId)),
    );
  if (desired.length)
    throw new BindingRejected(
      'referenced',
      desired
        .slice(0, 10)
        .map((b) => ({ id: b.id, name: b.name, kind: b.kind })),
    );
  // Desired-only ownership release never establishes safety from absent observations.
  try {
    await new RuntimeDependencies().assertUnreferenced(
      tx,
      old.nodeId,
      old.kind,
      old.resourceId,
    );
  } catch (e) {
    if (e instanceof RetainedRuntimeDependency)
      throw new BindingRejected('referenced', [
        {
          id: old.resourceId,
          name: 'Retained installed, in-flight or rollback revision',
          kind: old.kind,
        },
      ]);
    throw e;
  }
  const table = {
    dids: 'sip_dids',
    groups: 'ring_groups',
    trunks: 'sip_trunks',
  }[old.kind];
  const retained = await tx.query(
    `SELECT 1 FROM public.pbx_live_operations o JOIN public.pbx_revisions r ON r.id=o.target_id JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.node_id=$1
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot->$2) e WHERE e->>'id'=$3::text)
     AND (r.policy_version<>'tenant-routing-1' OR EXISTS(SELECT 1 FROM public.pbx_live_pins pin WHERE pin.revision_id=r.id AND pin.kind=$2 AND pin.resource_id=$3::uuid))
     AND NOT (p.state IN ('validation_failed','revoked') AND NOT EXISTS(SELECT 1 FROM public.pbx_live_artifacts a WHERE a.operation_id=o.id))
     AND NOT EXISTS(SELECT 1 FROM public.pbx_live_artifacts a JOIN public.pbx_artifact_retirements x ON x.artifact_id=a.id WHERE a.operation_id=o.id)
     UNION ALL SELECT 1 FROM public.pbx_live_runtime r JOIN public.${table} e ON e.node_id=r.node_id AND e.id=$3::uuid WHERE r.node_id=$1 AND (r.runtime_state<>'verified' OR r.active_operation_id IS NOT NULL OR r.installed_id IS NULL OR r.verified_id IS NULL OR r.known_good_id IS NULL OR r.baseline_verified_at IS NULL OR (e.created_at<=r.baseline_verified_at AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements x JOIN public.pbx_artifact_retirement_intents i ON i.id=x.intent_id WHERE i.node_id=$1))) LIMIT 1`,
    [old.nodeId, old.kind, old.resourceId],
  );
  if (retained.rows.length)
    throw new BindingRejected('referenced', [
      {
        id: old.resourceId,
        name: 'Managed runtime requires installed-resource release review',
        kind: old.kind,
      },
    ]);
}
