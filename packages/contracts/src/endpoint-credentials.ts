/** Safe desired state only. Never carries provider location or usable material. */
export type EndpointCredentialState =
  | 'queued'
  | 'retrying'
  | 'needs_reconciliation'
  | 'associated'
  | 'cancelled'
  | 'conflict'
  | 'failed';
export type EndpointCredentialFailure =
  | 'provider_unavailable'
  | 'provider_access_denied'
  | 'material_invalid'
  | 'material_unavailable'
  | 'originator_revoked'
  | 'stale_version'
  | 'dependency_changed'
  | 'needs_reconciliation'
  | 'cleanup_required';
export type EndpointCredentialConflict =
  | 'request_conflict'
  | 'stale_version'
  | 'dependency_changed'
  | 'inventory_ineligible'
  | 'tenant_claimed'
  | 'credential_state_conflict'
  | 'credential_operation_pending'
  | 'intent_expired';
export interface EndpointCredentialRequest {
  operationId: string;
  expectedVersion: number;
  expectedGenerationId: string | null;
}
export interface EndpointCredentialOperationDto {
  operationId: string;
  intentId: string;
  nodeId: string;
  extensionId: string;
  action: 'setup' | 'reset';
  state: EndpointCredentialState;
  expectedVersion: number;
  resultingVersion: number | null;
  generationId: string;
  generationOrdinal: number;
  createdAt: string;
  completedAt: string | null;
  retryable: boolean;
  failure: EndpointCredentialFailure | null;
}
export interface EndpointCredentialStatusDto {
  extensionId: string;
  desiredVersion: number;
  credential:
    | { kind: 'unset' }
    | {
        kind: 'configured';
        generationId: string;
        ordinal: number;
        materialHealth: 'verified' | 'unknown' | 'unavailable';
        verifiedAt: string | null;
        retirement: 'retained_dependency_unknown';
      };
  activeOperation: EndpointCredentialOperationDto | null;
  readiness: 'not_established';
}
