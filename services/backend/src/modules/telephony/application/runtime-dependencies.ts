import type { Transaction } from '../../../infrastructure/database/transaction';
import type { RevisionResourceKind } from '@myims/contracts';
/** Future reallocation/retirement must consume this port under canonical node locks. */
export interface RuntimeDependencyPort {
  assertUnreferenced(
    tx: Transaction,
    nodeId: string,
    kind: RevisionResourceKind,
    resourceId: string,
  ): Promise<void>;
}
export class RetainedRuntimeDependency extends Error {
  constructor() {
    super('Retained runtime dependency');
  }
}
export class RuntimeDependencies implements RuntimeDependencyPort {
  async assertUnreferenced(
    tx: Transaction,
    nodeId: string,
    kind: RevisionResourceKind,
    resourceId: string,
  ) {
    await tx.query('SELECT id FROM public.pbx_nodes WHERE id=$1 FOR SHARE', [
      nodeId,
    ]);
    const pins = await tx.query(
      "SELECT 1 FROM public.pbx_live_pins WHERE node_id=$1 AND kind=$2 AND resource_id=$3 AND released_at IS NULL UNION ALL SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND $2='node' AND baseline_verified_at IS NOT NULL LIMIT 1",
      [nodeId, kind, resourceId],
    );
    if (pins.rows.length) throw new RetainedRuntimeDependency();
  }
}
