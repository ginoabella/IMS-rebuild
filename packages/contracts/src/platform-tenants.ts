/** Safe platform administration transport; no credential verifier material. */
export interface CreateDraftTenantDto {
  requestId: string;
  tenantCode: string;
  displayName: string;
  administratorUsername: string;
}
export interface TenantSummaryDto {
  id: string;
  tenantCode: string;
  displayName: string;
  status: 'draft' | 'active' | 'suspended' | 'retired';
}
export interface TenantDetailDto {
  tenant: TenantSummaryDto & {
    version: number;
    authorityVersion: number;
    createdAt: string;
    updatedAt: string;
  };
  administrator:
    | { kind: 'unavailable' }
    | {
        kind: 'available';
        id: string;
        tenantId: string;
        username: string;
        roles: ('tenant_admin' | 'call_taker' | 'dispatcher' | 'responder')[];
        status: 'active' | 'disabled';
        credentialState: 'unset' | 'ready';
      };
}
export interface TenantListDto {
  items: TenantSummaryDto[];
  nextCursor: string | null;
}
export type TenantInputField =
  keyof CreateDraftTenantDto | 'body' | 'limit' | 'after' | 'tenantId';
export interface TenantApiErrorDto {
  statusCode: number;
  message: string;
  fieldErrors?: Partial<Record<TenantInputField, string>>;
  reason?: 'tenant_code_conflict' | 'request_conflict';
}
