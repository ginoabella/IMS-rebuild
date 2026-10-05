import {
  SnapshotDatabase,
  type ReadSnapshot,
} from '../../../../infrastructure/database/read-snapshot';
import type {
  StaffAuthorityRead,
  TenantAdmissionRead,
} from '../../application/authority-read';
import {
  staffAuthority,
  type AuthorityResult,
  type StaffAuthority,
} from '../../domain/authority';
import {
  normalizeTenantCode,
  normalizeUsername,
  uuid,
  onlyFields,
} from '../../domain/storage';
import { ordinaryAdmission } from '../../../tenancy/domain/admission';
export const credentialCoherence = `(credential_state='ready' AND password_hash IS NOT NULL AND octet_length(password_hash) BETWEEN 1 AND 4096 AND credential_changed_at IS NOT NULL AND isfinite(credential_changed_at))`;
export class StaffAuthorityRepository implements StaffAuthorityRead {
  constructor(
    private readonly database: SnapshotDatabase,
    private readonly tenants: TenantAdmissionRead,
  ) {}
  async candidate(input: {
    plane: 'tenant';
    tenantCode: unknown;
    username: unknown;
  }): Promise<AuthorityResult<StaffAuthority>> {
    const code = normalizeTenantCode(input?.tenantCode);
    const username = normalizeUsername(input?.username);
    if (
      !code ||
      !username ||
      input.plane !== 'tenant' ||
      !onlyFields(input, ['plane', 'tenantCode', 'username'])
    )
      return { kind: 'denied' };
    try {
      return await this.database.read(async (snapshot) => {
        const tenant = await this.tenants.byCode(snapshot, code);
        if (!ordinaryAdmission(tenant)) return { kind: 'denied' };
        const row = await this.staff(
          snapshot,
          tenant.id,
          'normalized_username',
          username,
        );
        return staffAuthority(row, tenant);
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async byId(input: {
    plane: 'tenant';
    tenantId: string;
    staffId: string;
  }): Promise<AuthorityResult<StaffAuthority>> {
    if (
      !input ||
      input.plane !== 'tenant' ||
      !uuid(input.tenantId) ||
      !uuid(input.staffId) ||
      !onlyFields(input, ['plane', 'tenantId', 'staffId'])
    )
      return { kind: 'denied' };
    try {
      return await this.database.read(async (snapshot) => {
        const tenant = await this.tenants.byId(snapshot, input.tenantId);
        const row = await this.staff(
          snapshot,
          input.tenantId,
          'id',
          input.staffId,
        );
        return staffAuthority(row, tenant);
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
  private async staff(
    snapshot: ReadSnapshot,
    tenantId: string,
    column: 'id' | 'normalized_username',
    value: string,
  ): Promise<unknown> {
    const result = await snapshot.query(
      `SELECT id,tenant_id,roles,status,credential_state,version,authentication_version,${credentialCoherence} AS credential_coherent FROM public.staff_users WHERE tenant_id=$1 AND ${column}=$2`,
      [tenantId, value],
    );
    return result.rows[0] ?? null;
  }
}
