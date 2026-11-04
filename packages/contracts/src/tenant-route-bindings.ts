export type RouteAuthorizationKind =
  'dids' | 'groups' | 'inbound' | 'outbound' | 'trunks' | 'permission';
export type EvaluatedRouteFact = { kind: string; id: string; version: number };
export interface RouteAuthorization {
  id: string;
  tenantId: string | null;
  nodeId: string;
  installationId: string;
  kind: RouteAuthorizationKind;
  resourceId: string;
  scope: 'owned' | 'shared';
  state: 'active' | 'revoked';
  version: number;
  evaluated: EvaluatedRouteFact[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
export interface RouteBindingReview {
  advisory: true;
  callingEligible: false;
  compatible: boolean;
  currentVersion: number | null;
  evaluated: EvaluatedRouteFact[];
  blockers: {
    id: string;
    name: string;
    kind: string;
    tenantId?: string | null;
  }[];
}
