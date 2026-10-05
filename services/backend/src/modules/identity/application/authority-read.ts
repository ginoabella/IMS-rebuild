import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { AuthorityResult, StaffAuthority } from '../domain/authority';
// Caller-owned cross-module port; tenancy owns the returned canonical facts.
export interface TenantAdmissionRead {
  byCode(snapshot: ReadSnapshot, code: string): Promise<unknown>;
  byId(snapshot: ReadSnapshot, tenantId: string): Promise<unknown>;
}
export interface StaffAuthorityRead {
  candidate(input: {
    plane: 'tenant';
    tenantCode: unknown;
    username: unknown;
  }): Promise<AuthorityResult<StaffAuthority>>;
  byId(input: {
    plane: 'tenant';
    tenantId: string;
    staffId: string;
  }): Promise<AuthorityResult<StaffAuthority>>;
}
