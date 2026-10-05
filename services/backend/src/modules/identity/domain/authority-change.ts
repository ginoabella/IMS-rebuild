import { canonicalRoles, roleCode, roleCodes, type StaffRole } from './roles';
import type { AccountStatus, CredentialState } from './storage';
export type AccountChange =
  | { kind: 'status'; status: AccountStatus }
  | { kind: 'roles'; roles: StaffRole[] }
  | {
      kind: 'credential';
      credentialState: CredentialState;
      passwordHash: string | null;
      credentialChangedAt: Date | null;
    };
export interface LockedAccount {
  id: string;
  status: AccountStatus;
  credential_state: CredentialState;
  password_hash: string | null;
  credential_changed_at: Date | null;
  roles?: StaffRole[];
  version: number;
  authentication_version: number;
}
export interface PreparedChange {
  kind: AccountChange['kind'];
  values: unknown[];
  oldCode: string;
  newCode: string;
  noop: boolean;
}
export function prepareChange(
  row: LockedAccount,
  change: AccountChange,
  staff: boolean,
): PreparedChange | null {
  if (
    !change ||
    typeof change !== 'object' ||
    !['active', 'disabled'].includes(row.status) ||
    !['ready', 'unset'].includes(row.credential_state)
  )
    return null;
  const keys = Object.keys(change);
  if (
    change.kind === 'status' &&
    keys.every((key) => ['kind', 'status'].includes(key)) &&
    ['active', 'disabled'].includes(change.status)
  ) {
    return {
      kind: 'status',
      values: [change.status],
      oldCode: row.status,
      newCode: change.status,
      noop: row.status === change.status,
    };
  }
  if (
    staff &&
    change.kind === 'roles' &&
    keys.every((key) => ['kind', 'roles'].includes(key))
  ) {
    const roles = canonicalRoles(change.roles),
      old = canonicalRoles(row.roles);
    if (!roles || !old) return null;
    return {
      kind: 'roles',
      values: [roles],
      oldCode: roleCode(old),
      newCode: roleCode(roles),
      noop: roleCode(old) === roleCode(roles),
    };
  }
  if (
    change.kind === 'credential' &&
    keys.every((key) =>
      [
        'kind',
        'credentialState',
        'passwordHash',
        'credentialChangedAt',
      ].includes(key),
    )
  ) {
    const ready =
      change.credentialState === 'ready' &&
      typeof change.passwordHash === 'string' &&
      Buffer.byteLength(change.passwordHash) > 0 &&
      Buffer.byteLength(change.passwordHash) <= 4096 &&
      change.credentialChangedAt instanceof Date &&
      Number.isFinite(change.credentialChangedAt.getTime());
    const unset =
      change.credentialState === 'unset' &&
      change.passwordHash === null &&
      change.credentialChangedAt === null;
    if (!ready && !unset) return null;
    return {
      kind: 'credential',
      values: [
        change.credentialState,
        change.passwordHash,
        change.credentialChangedAt,
      ],
      oldCode: row.credential_state,
      newCode: change.credentialState,
      noop:
        row.credential_state === change.credentialState &&
        row.password_hash === change.passwordHash &&
        (row.credential_changed_at?.getTime() ?? null) ===
          (change.credentialChangedAt?.getTime() ?? null),
    };
  }
  return null;
}
export function authorityEvent(
  plane: 'staff' | 'operator' | 'tenant',
  kind: 'status' | 'roles' | 'credential',
) {
  const states =
    kind === 'roles'
      ? roleCodes
      : kind === 'credential'
        ? ['unset', 'ready']
        : plane === 'tenant'
          ? ['draft', 'active', 'suspended', 'retired']
          : ['active', 'disabled'];
  const version = { kind: 'integer' as const, min: 1, max: 2147483647 };
  return {
    type: `${plane}.authority.${kind}.changed`,
    version: 1,
    fields: {
      oldCode: { kind: 'enum' as const, values: states },
      newCode: { kind: 'enum' as const, values: states },
      oldRowVersion: version,
      newRowVersion: version,
      oldAuthorityVersion: version,
      newAuthorityVersion: version,
    },
  };
}
