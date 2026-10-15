/** Controlled-development desired inventory; no credentials or live readiness. */
export type EndpointKind = 'sip' | 'webrtc';
export type AudioCodec = 'opus' | 'ulaw' | 'alaw';
interface CommonEndpointSettings {
  codecs: AudioCodec[];
  maxContacts: number;
  removeExisting: false;
  directMedia: false;
  rtpSymmetric: true;
  forceRport: true;
}
export type EndpointSettings = CommonEndpointSettings &
  (
    | {
        signaling: 'udp';
        mediaEncryption: 'none';
        rewriteContact: true;
        ice: false;
        avpf: false;
        rtcpMux: false;
        useReceivedTransport: false;
      }
    | {
        signaling: 'wss';
        mediaEncryption: 'dtls-srtp';
        rewriteContact: false;
        ice: true;
        avpf: true;
        rtcpMux: true;
        useReceivedTransport: true;
        dtlsVerify: 'fingerprint';
        dtlsSetup: 'actpass';
      }
  );
export interface EndpointProfileDto {
  id: string;
  nodeId: string;
  kind: EndpointKind;
  name: string;
  version: number;
  headVersion: number;
  settings: EndpointSettings;
  capabilityRevision: number;
  createdAt: string;
  createdBy: string;
}
export interface EndpointProfileDetailDto {
  profile: EndpointProfileDto;
}
export interface EndpointCapabilityDto {
  installationId: string;
  revision: number;
  kinds: EndpointKind[];
  signaling: string[];
  codecs: AudioCodec[];
  media: string[];
}
export interface EndpointProfileListDto {
  nodeVersion: number;
  capability: EndpointCapabilityDto | null;
  items: EndpointProfileDto[];
  nextCursor: string | null;
}
export interface CreateEndpointProfileRequest {
  requestId: string;
  name: string;
  template: 'sip-basic' | 'webrtc-basic';
  /** Optional safe choices; remaining template settings are fixed. */
  settings?: { codecs: AudioCodec[]; maxContacts: number };
  expectedNodeVersion: number;
  expectedCapabilityRevision: number;
}
export interface CreateEndpointProfileVersionRequest {
  requestId: string;
  expectedVersion: number;
  name: string;
  settings: { codecs: AudioCodec[]; maxContacts: number };
  expectedNodeVersion: number;
  expectedCapabilityRevision: number;
}
export interface InventoryDependencies {
  profileId: string;
  profileVersion: number;
  expectedProfileHead: number;
  expectedNodeVersion: number;
  expectedCapabilityRevision: number;
}
export type ExtensionBulkNumbers =
  | { numbers: string[]; range?: never }
  | { range: { start: string; end: string }; numbers?: never };
export type PreviewExtensionBulkRequest = InventoryDependencies &
  ExtensionBulkNumbers & { kind: EndpointKind };
export type CreateExtensionBulkRequest = PreviewExtensionBulkRequest & {
  requestId: string;
};
export interface CreateExtensionRequest extends InventoryDependencies {
  requestId: string;
  kind: EndpointKind;
  number: string;
}
export interface ExtensionBulkPreviewDto extends InventoryDependencies {
  nodeId: string;
  kind: EndpointKind;
  numbers: string[];
  advisory: true;
}
export interface ExtensionBulkResultDto {
  operationId: string;
  nodeId: string;
  profileId: string;
  profileVersion: number;
  items: { id: string; number: string; version: number }[];
}
export interface ExtensionDto {
  id: string;
  nodeId: string;
  number: string;
  kind: EndpointKind;
  profile: { id: string; version: number };
  availability: 'available';
  administrativeStatus: 'enabled' | 'disabled';
  credentials: { kind: 'unset' };
  readiness: { kind: 'not_established' };
  observation: { kind: 'not_available' };
  eligibility: { eligible: false; reasons: ('unallocated' | 'disabled')[] };
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
export interface ExtensionDetailDto {
  extension: ExtensionDto;
}
export interface ExtensionListDto {
  items: ExtensionDto[];
  nextCursor: string | null;
}
export interface EditExtensionRequest extends InventoryDependencies {
  expectedVersion: number;
}
export interface SetExtensionStatusRequest {
  expectedVersion: number;
  administrativeStatus: 'enabled' | 'disabled';
}
export type InventoryConflict =
  | 'number_conflict'
  | 'request_conflict'
  | 'stale_version'
  | 'dependency_changed'
  | 'profile_name_conflict'
  | 'inventory_ineligible'
  | 'intent_expired';
export interface InventoryApiErrorDto {
  statusCode: number;
  message: string;
  reason?: InventoryConflict;
  fieldErrors?: Partial<
    Record<
      | 'body'
      | 'nodeId'
      | 'extensionId'
      | 'profileId'
      | 'version'
      | 'number'
      | 'numbers'
      | 'kind'
      | 'settings'
      | 'name'
      | 'requestId'
      | 'dependencies'
      | 'expectedVersion'
      | 'limit'
      | 'after',
      string
    >
  >;
  conflicts?: { numbers: string[]; total: number; truncated: boolean };
}
