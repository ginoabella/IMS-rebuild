import type { StaffAuthorityRead } from '../../application/authority-read';
import type { PlatformAuthorityRead } from '../../../platform/application/authority-read';
import type { SessionAuthorityRead } from '../../application/session-ports';
import type { SessionAuthority } from '../../domain/session';
export class CanonicalSessionAuthority implements SessionAuthorityRead {
  constructor(
    private readonly staff: StaffAuthorityRead,
    private readonly platform: PlatformAuthorityRead,
  ) {}
  async current(a: SessionAuthority) {
    if (a.plane === 'platform') {
      const result = await this.platform.byId({
        plane: 'platform',
        operatorId: a.identityId,
      });
      if (result.kind !== 'eligible') return result;
      return {
        kind: 'eligible' as const,
        authority: {
          plane: 'platform' as const,
          identityId: result.snapshot.operatorId,
          authenticationVersion: result.snapshot.authenticationVersion,
        },
      };
    }
    const result = await this.staff.byId({
      plane: 'tenant',
      tenantId: a.tenantId,
      staffId: a.identityId,
    });
    if (result.kind !== 'eligible') return result;
    return {
      kind: 'eligible' as const,
      authority: {
        plane: 'tenant' as const,
        identityId: result.snapshot.staffId,
        tenantId: result.snapshot.tenantId,
        authenticationVersion: result.snapshot.authenticationVersion,
        tenantAuthorityVersion: result.snapshot.tenantAuthorityVersion,
      },
    };
  }
}
