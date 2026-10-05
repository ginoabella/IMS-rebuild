import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import type { PlatformCredentialRead } from '../../application/credential-read';
import { uuid } from '../../../identity/domain/storage';
import { authorityVersion } from '../../../tenancy/domain/admission';
import { onlyFields } from '../../../identity/domain/storage';
export class PlatformCredentialRepository implements PlatformCredentialRead {
  constructor(private readonly database: SnapshotDatabase) {}
  async read(input: { plane: 'platform'; operatorId: string }) {
    if (
      !input ||
      input.plane !== 'platform' ||
      !uuid(input.operatorId) ||
      !onlyFields(input, ['plane', 'operatorId'])
    )
      return { kind: 'denied' as const };
    try {
      return await this.database.read(async (snapshot) => {
        const { rows } = await snapshot.query(
          `SELECT password_hash,authentication_version FROM public.platform_operators WHERE id=$1 AND status='active' AND credential_state='ready' AND credential_changed_at IS NOT NULL AND isfinite(credential_changed_at)`,
          [input.operatorId],
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
