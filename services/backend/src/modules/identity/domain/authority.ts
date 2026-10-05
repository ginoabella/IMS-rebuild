import { uuid, type AccountStatus, type CredentialState } from './storage';
import { canonicalRoles, type StaffRole } from './roles';
import {
  authorityVersion,
  ordinaryAdmission,
} from '../../tenancy/domain/admission';
export type AuthorityResult<T> =
  { kind: 'eligible'; snapshot: T } | { kind: 'denied' | 'unavailable' };
export interface StaffAuthority {
  plane: 'tenant';
  staffId: string;
  tenantId: string;
  roles: StaffRole[];
  accountStatus: AccountStatus;
  credentialState: CredentialState;
  authenticationVersion: number;
  tenantStatus: 'active';
  tenantAuthorityVersion: number;
}
export interface PlatformAuthority {
  plane: 'platform';
  operatorId: string;
  authority: 'platform_operator';
  accountStatus: AccountStatus;
  credentialState: CredentialState;
  authenticationVersion: number;
}
function account(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  return uuid(row.id) &&
    row.status === 'active' &&
    row.credential_state === 'ready' &&
    row.credential_coherent === true &&
    authorityVersion(row.version) &&
    authorityVersion(row.authentication_version)
    ? row
    : null;
}
export function staffAuthority(
  staff: unknown,
  tenant: unknown,
): AuthorityResult<StaffAuthority> {
  const row = account(staff);
  if (!row || !ordinaryAdmission(tenant) || row.tenant_id !== tenant.id)
    return { kind: 'denied' };
  const roles = canonicalRoles(row.roles);
  if (!roles) return { kind: 'denied' };
  // account() validated these scalar values at the database boundary.
  return {
    kind: 'eligible',
    snapshot: {
      plane: 'tenant',
      staffId: row.id as string,
      tenantId: tenant.id,
      roles,
      accountStatus: 'active',
      credentialState: 'ready',
      authenticationVersion: row.authentication_version as number,
      tenantStatus: 'active',
      tenantAuthorityVersion: tenant.authority_version,
    },
  };
}
export function platformAuthority(
  operator: unknown,
): AuthorityResult<PlatformAuthority> {
  const row = account(operator);
  if (!row || row.authority !== 'platform_operator' || 'tenant_id' in row)
    return { kind: 'denied' };
  return {
    kind: 'eligible',
    snapshot: {
      plane: 'platform',
      operatorId: row.id as string,
      authority: 'platform_operator',
      accountStatus: 'active',
      credentialState: 'ready',
      authenticationVersion: row.authentication_version as number,
    },
  };
}
