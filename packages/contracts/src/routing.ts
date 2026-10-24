export type RoutingKind = 'groups' | 'reservations' | 'inbound';
export type GroupDestination =
  { kind: 'hangup' } | { kind: 'extension' | 'group'; id: string };
export interface GroupValues {
  name: string;
  number: string | null;
  memberIds: string[];
  strategy: 'simultaneous' | 'sequential';
  timeout: number;
  fallback: GroupDestination;
}
export interface NumberPattern {
  kind: 'exact' | 'prefix';
  digits: string;
  minLength: number;
  maxLength: number;
}
export interface ReservationValues {
  name: string;
  purpose: string;
  pattern: NumberPattern;
}
export interface RoutingRecord {
  id: string;
  nodeId: string;
  installationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  removedAt: string | null;
}
export type GroupDto = RoutingRecord & GroupValues & { enabled: boolean };
export type ReservationDto = RoutingRecord & ReservationValues;
export interface InboundValues {
  name: string;
  gatewayId: string;
  didId: string | null;
  destination: GroupDestination;
}
export type CreateInboundRequest = InboundValues & { requestId: string };
export type EditInboundRequest = InboundValues & { expectedVersion: number };
export interface InboundPreviewRequest {
  gatewayId: string;
  dialled: string;
}
export type InboundDto = RoutingRecord & InboundValues & { enabled: boolean };
export type RoutingDto = GroupDto | ReservationDto | InboundDto;
export interface InboundPreviewDto {
  advisory: true;
  callingEligible: false;
  reason: 'matched' | 'unknown_ingress' | 'no_match' | 'disabled_rule';
  rule: InboundDto | null;
  precedence: 'exact' | 'catch_all' | null;
  resources: {
    id: string;
    version: number;
    kind: 'gateway' | 'did' | 'trunk' | 'rule' | 'extension' | 'group';
    available: boolean;
  }[];
  warnings: string[];
}
export interface RoutingDetailDto {
  resource: RoutingDto;
}
export interface RoutingListDto {
  items: RoutingDto[];
  nextCursor: string | null;
}
export type CreateGroupRequest = GroupValues & { requestId: string };
export type EditGroupRequest = GroupValues & { expectedVersion: number };
export type CreateReservationRequest = ReservationValues & {
  requestId: string;
};
export type EditReservationRequest = ReservationValues & {
  expectedVersion: number;
};
export interface RoutingErrorDto {
  statusCode: number;
  message: string;
  reason?: string;
  fieldErrors?: Record<string, string>;
  blockers?: { id: string; name: string; kind?: 'groups' | 'inbound' }[];
}
export interface GroupPreviewDto {
  advisory: true;
  callingEligible: false;
  attempts: number;
  maximumRingSeconds: number;
  resources: {
    id: string;
    version: number;
    kind: 'extension' | 'group';
    available: boolean;
  }[];
  warnings: string[];
}
