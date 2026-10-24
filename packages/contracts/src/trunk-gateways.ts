export type PeerResource = 'trunks' | 'gateways' | 'dids';
export interface PeerSettings {
  host: string;
  port: number;
  transport: 'udp';
  media: 'rtp';
  codecs: ('ulaw' | 'alaw')[];
  directMedia: false;
  rtpSymmetric: true;
  forceRport: true;
  authentication: 'ip-peer' | 'outbound-digest';
  credential?: { id: string; version: number };
  registration?: {
    registrar: string;
    realm: string;
    expiration: 3600;
    retryInterval: 60;
    forbiddenRetryInterval: 10;
  };
}
export interface TrunkValues {
  name: string;
  direction: 'inbound' | 'outbound' | 'both';
  settings: PeerSettings;
}
export interface GatewayValues {
  name: string;
  kind: 'sip-provider' | 'sip-device';
  trunkId: string | null;
  sourceAddresses: string[];
}
export interface PeerRecordDto {
  id: string;
  nodeId: string;
  installationId: string;
  name: string;
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  removedAt: string | null;
  credentialStatus: 'not_required' | 'selected';
}
export type TrunkDto = PeerRecordDto & TrunkValues;
export type GatewayDto = PeerRecordDto & GatewayValues;
export interface DidValues {
  name: string;
  number: string;
  gatewayId: string;
}
export type DidDto = PeerRecordDto & DidValues;
export interface CreateDidDto extends DidValues {
  requestId: string;
}
export interface EditDidDto extends DidValues {
  expectedVersion: number;
}
export type PeerDto = TrunkDto | GatewayDto | DidDto;
export interface PeerListDto {
  items: PeerDto[];
  nextCursor: string | null;
}
export interface PeerDetailDto {
  resource: PeerDto;
}
export type PeerConflict =
  | 'stale_version'
  | 'name_conflict'
  | 'source_conflict'
  | 'number_conflict'
  | 'invalid_gateway'
  | 'invalid_trunk'
  | 'invalid_credential'
  | 'referenced'
  | 'request_conflict'
  | 'intent_expired'
  | 'reserved_source';
export interface PeerErrorDto {
  statusCode: number;
  message: string;
  reason?: PeerConflict;
  fieldErrors?: Record<string, string>;
  blockers?: {
    id: string;
    name: string;
    kind?: 'gateways' | 'dids' | 'inbound';
  }[];
}
export interface CreateTrunkDto extends TrunkValues {
  requestId: string;
}
export interface EditTrunkDto extends TrunkValues {
  expectedVersion: number;
}
export interface CreateGatewayDto extends GatewayValues {
  requestId: string;
}
export interface EditGatewayDto extends GatewayValues {
  expectedVersion: number;
}
export interface PeerStatusDto {
  expectedVersion: number;
  enabled: boolean;
}
export interface RemovePeerDto {
  expectedVersion: number;
}

export interface TrunkCredentialSelection {
  id: string;
  label: string;
  installationId: string;
  purpose: 'outbound-digest';
  version: number;
  available: boolean;
}
export interface TrunkCredentialListDto {
  items: TrunkCredentialSelection[];
  nextCursor: string | null;
}
