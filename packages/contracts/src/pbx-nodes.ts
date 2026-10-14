/** Platform desired-state consumer; no tenant allocation or observed health. */
export interface PbxManagementDto {
  targetAlias: string;
  transport: string;
  port: number;
}
export interface CreatePbxNodeRequest {
  requestId: string;
  displayName: string;
  management: PbxManagementDto;
  credentialAlias: string;
}
export interface EditPbxNodeRequest extends Omit<
  CreatePbxNodeRequest,
  'requestId'
> {
  expectedVersion: number;
}
export interface PbxNodeDto {
  id: string;
  installationId: string;
  displayName: string;
  management: PbxManagementDto & { host: string; tlsServerName: string };
  credentialAlias: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  observation: PbxObservationDto;
}
export interface PbxNodeDetailDto {
  node: PbxNodeDto;
}
export interface PbxNodeListDto {
  items: PbxNodeDto[];
  nextCursor: string | null;
}
export type PbxConflict =
  'target_conflict' | 'request_conflict' | 'stale_version' | 'intent_expired';
export type PbxInputField =
  | 'body'
  | 'requestId'
  | 'displayName'
  | 'management'
  | 'credentialAlias'
  | 'expectedVersion'
  | 'nodeId'
  | 'limit'
  | 'after';
export interface PbxApiErrorDto {
  statusCode: number;
  message: string;
  reason?: PbxConflict;
  fieldErrors?: Partial<Record<PbxInputField, string>>;
}

/** Minimal PJSIP facts only. Never inventory, tenant attribution or voice readiness. */
export interface PbxRegistrationFact {
  endpoint: string;
  registered: boolean;
  contacts: number;
  reachableContacts: number;
}
export type PbxObservationFailure =
  | 'secret_missing'
  | 'secret_unavailable'
  | 'destination_denied'
  | 'resolution_unavailable'
  | 'connect_failed'
  | 'auth_failed'
  | 'timeout'
  | 'protocol_failed'
  | 'snapshot_incomplete'
  | 'resource_limit'
  | 'disconnected'
  | 'ownership_lost';
export type PbxObservationDto =
  | { kind: 'not_available' }
  | {
      kind: 'observed';
      desiredVersion: number;
      epoch: string;
      sequence: number;
      lastSuccessAt: string | null;
      ageMs: number | null;
      freshness: 'current' | 'stale' | 'unknown' | 'historical';
      connection: 'reachable' | 'disconnected' | 'unknown';
      reconciliation: 'complete' | 'reconciling';
      ownership: 'current' | 'absent';
      failure: PbxObservationFailure | null;
      coverage: 'pjsip-dynamic-contacts' | 'unknown';
      registrations: PbxRegistrationFact[];
      registeredEndpoints: number | null;
    };
