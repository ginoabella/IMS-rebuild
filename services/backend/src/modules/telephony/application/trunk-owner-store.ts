import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';

/** Immutable owner facts only; this reference never establishes qualification. */
export interface TrunkOwnerReference {
  bindingId: string;
  nodeId: string;
  installationId: string;
  peerId: string;
  purposes: ('outbound-request' | 'registration')[];
  ownerRevision: number;
  generationId: string;
  generationOrdinal: number;
  materialVersion: 1;
  operationId: string;
  reservationState: 'reserved' | 'cancelled' | 'failed';
}
export interface TrunkOwnerReadStore {
  exactReference(
    snapshot: ReadSnapshot,
    scope: {
      nodeId: string;
      installationId: string;
      bindingId: string;
      generationId: string;
    },
  ): Promise<TrunkOwnerReference | null>;
}
