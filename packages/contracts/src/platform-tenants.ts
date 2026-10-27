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
    contacts: TenantContactsDto;
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
  | keyof CreateDraftTenantDto
  | 'body'
  | 'limit'
  | 'after'
  | 'tenantId'
  | 'search'
  | 'status'
  | 'name'
  | 'email'
  | 'phone'
  | 'expectedVersion'
  | 'expectedAuthorityVersion';
export interface TenantApiErrorDto {
  statusCode: number;
  message: string;
  fieldErrors?: Partial<Record<TenantInputField, string>>;
  reason?:
    | 'tenant_code_conflict'
    | 'request_conflict'
    | 'version_conflict'
    | 'eligibility_conflict';
}

export interface TenantContactsDto {
  name: string | null;
  email: string | null;
  phone: string | null;
}
export type TenantSection = 'name' | 'contacts';
export type SaveTenantSectionDto = {
  requestId: string;
  expectedVersion: number;
  expectedAuthorityVersion: number;
} & (
  | { section: 'name'; values: { displayName: string } }
  | { section: 'contacts'; values: Partial<TenantContactsDto> }
);
export interface TenantEditOutcomeDto {
  requestId: string;
  tenantId: string;
  section: TenantSection;
  version: number;
  authorityVersion: number;
}
export interface SavedTenantSectionDto {
  outcome: TenantEditOutcomeDto;
  replayed: boolean;
  current: TenantDetailDto;
}
