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
    const result = await snapshot.query<Record<string, unknown>>(
      `SELECT binding_id AS "bindingId",node_id AS "nodeId",installation_id AS "installationId",peer_id AS "peerId",purposes,owner_revision AS "ownerRevision",generation_id AS "generationId",generation_ordinal AS "generationOrdinal",material_version AS "materialVersion",operation_id AS "operationId",reservation_state AS "reservationState"
       FROM public.trunk_credential_owner_references
       WHERE node_id=$1 AND installation_id=$2 AND binding_id=$3 AND generation_id=$4`,
      [scope.nodeId, scope.installationId, scope.bindingId, scope.generationId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    // Fail closed if a changed view/driver breaks this security-sensitive port.
    // Construct the safe projection explicitly; never pass extra columns through.
    if (
      result.rows.length !== 1 ||
      !row ||
      row.nodeId !== scope.nodeId.toLowerCase() ||
      row.installationId !== scope.installationId.toLowerCase() ||
      row.bindingId !== scope.bindingId.toLowerCase() ||
      row.generationId !== scope.generationId.toLowerCase() ||
      !isUuid(row.nodeId) ||
      !isUuid(row.installationId) ||
      !isUuid(row.bindingId) ||
      !isUuid(row.generationId) ||
      !isUuid(row.peerId) ||
      !isUuid(row.operationId) ||
      !isPositiveInteger(row.ownerRevision) ||
      !isPositiveInteger(row.generationOrdinal) ||
      row.materialVersion !== 1 ||
      !isPurposes(row.purposes) ||
      (row.reservationState !== 'reserved' &&
        row.reservationState !== 'cancelled' &&
        row.reservationState !== 'failed')
    ) {
      throw new Error('Invalid trunk owner reference');
    }
    return {
      bindingId: row.bindingId,
      nodeId: row.nodeId,
      installationId: row.installationId,
      peerId: row.peerId,
      purposes: [...row.purposes],
      ownerRevision: row.ownerRevision,
      generationId: row.generationId,
      generationOrdinal: row.generationOrdinal,
      materialVersion: row.materialVersion,
      operationId: row.operationId,
      reservationState: row.reservationState,
    };
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isPurposes(value: unknown): value is TrunkOwnerReference['purposes'] {
  return (
    Array.isArray(value) &&
    ((value.length === 1 &&
      (value[0] === 'outbound-request' || value[0] === 'registration')) ||
      (value.length === 2 &&
        value[0] === 'outbound-request' &&
        value[1] === 'registration'))
  );
}
