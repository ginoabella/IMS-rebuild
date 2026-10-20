import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type {
  TrunkOwnerReadStore,
  TrunkOwnerReference,
} from '../../application/trunk-owner-store';

/** No provider composition, qualification or "latest" generation selection. */
export class TrunkOwnerReferences implements TrunkOwnerReadStore {
  async exactReference(
    snapshot: ReadSnapshot,
    scope: {
      nodeId: string;
      installationId: string;
      bindingId: string;
      generationId: string;
    },
  ): Promise<TrunkOwnerReference | null> {
    const result = await snapshot.query<TrunkOwnerReference>(
      `SELECT binding_id AS "bindingId",node_id AS "nodeId",installation_id AS "installationId",peer_id AS "peerId",purposes,owner_revision AS "ownerRevision",generation_id AS "generationId",generation_ordinal AS "generationOrdinal",material_version AS "materialVersion",operation_id AS "operationId",reservation_state AS "reservationState"
       FROM public.trunk_credential_owner_references
       WHERE node_id=$1 AND installation_id=$2 AND binding_id=$3 AND generation_id=$4`,
      [scope.nodeId, scope.installationId, scope.bindingId, scope.generationId],
    );
    return result.rows[0] ?? null;
  }
}
