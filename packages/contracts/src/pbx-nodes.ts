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
  observation: { kind: 'not_available' };
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
