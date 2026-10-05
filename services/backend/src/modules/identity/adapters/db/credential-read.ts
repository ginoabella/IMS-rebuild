import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import type { StaffCredentialRead } from '../../application/credential-read';
import { uuid } from '../../domain/storage';
import { authorityVersion } from '../../../tenancy/domain/admission';
import { onlyFields } from '../../domain/storage';
export class StaffCredentialRepository implements StaffCredentialRead {
  constructor(private readonly database: SnapshotDatabase) {}
  async read(input: { plane: 'tenant'; tenantId: string; staffId: string }) {
    if (
      !input ||
      input.plane !== 'tenant' ||
      !uuid(input.tenantId) ||
      !uuid(input.staffId) ||
      !onlyFields(input, ['plane', 'tenantId', 'staffId'])
    )
      return { kind: 'denied' as const };
    try {
      return await this.database.read(async (snapshot) => {
        const { rows } = await snapshot.query(
          `SELECT password_hash,authentication_version FROM public.staff_users WHERE tenant_id=$1 AND id=$2 AND status='active' AND credential_state='ready' AND credential_changed_at IS NOT NULL AND isfinite(credential_changed_at)`,
          [input.tenantId, input.staffId],
        );
        const row = rows[0];
        if (
          !row ||
          typeof row.password_hash !== 'string' ||
          Buffer.byteLength(row.password_hash) < 1 ||
          Buffer.byteLength(row.password_hash) > 4096 ||
          !authorityVersion(row.authentication_version)
        )
          return { kind: 'denied' as const };
        return {
          kind: 'ready' as const,
          credential: {
            passwordHash: row.password_hash,
            authenticationVersion: row.authentication_version,
          },
        };
      });
    } catch {
      return { kind: 'unavailable' as const };
    }
  }
}
