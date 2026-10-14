import type { PbxProfile } from '../domain/connectivity';
import type {
  PbxRegistrationFact,
  PbxObservationFailure,
} from '@myims/contracts';
/** Complete bounded snapshot or finite failure; protocol data never crosses this port. */
export type ObservationSnapshot =
  | { kind: 'complete'; registrations: PbxRegistrationFact[] }
  | { kind: 'failed'; failure: PbxObservationFailure };
export interface PbxObservationSession {
  /** Signals transport loss without exposing protocol errors or payloads. */
  readonly ended: AbortSignal;
  snapshot(signal: AbortSignal): Promise<ObservationSnapshot>;
  close(): void;
}
/** No action/command argument; replaceable independently of ownership and persistence. */
export interface PbxObservationAdapter {
  open(
    profile: Readonly<PbxProfile>,
    credentialAlias: string,
    signal: AbortSignal,
  ): Promise<
    | { kind: 'connected'; session: PbxObservationSession }
    | { kind: 'failed'; failure: PbxObservationFailure }
  >;
}
export interface PbxOwnershipToken {
  nodeId: string;
  incarnation: string;
  epoch: string;
  desiredVersion: number;
}
/** Future writers must also enforce epochs at the external PBX write boundary. */
export interface PbxOwnership {
  acquire(
    nodeId: string,
    incarnation: string,
  ): Promise<PbxOwnershipToken | null>;
  renew(token: PbxOwnershipToken): Promise<PbxOwnershipToken | null>;
  release(token: PbxOwnershipToken): Promise<boolean>;
  verify(token: PbxOwnershipToken): Promise<boolean>;
}
export interface ObservationTarget {
  id: string;
  version: number;
  installationId: string;
  targetAlias: string;
  credentialAlias: string;
}
export interface ObservationStore extends PbxOwnership {
  discover(after?: string | null): Promise<ObservationTarget[]>;
  publish(
    token: PbxOwnershipToken,
    sequence: number,
    registrations: PbxRegistrationFact[],
    signal?: AbortSignal,
  ): Promise<boolean>;
  fail(
    token: PbxOwnershipToken,
    failure: PbxObservationFailure,
  ): Promise<boolean>;
}
