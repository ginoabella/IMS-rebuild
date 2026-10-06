import type { PlatformSessionDto } from '@myims/contracts';
import type { Principal } from '../../identity/application/request-authority';
import type { SessionRecord } from '../../identity/domain/session';
/** Consumes canonical guard state, never request fields; deliberately performs no renewal. */
export class PlatformCurrentSession {
  execute(
    principal: Principal,
    record: SessionRecord,
  ): Omit<PlatformSessionDto, 'proof'> | null {
    if (
      principal.plane !== 'platform' ||
      record.plane !== 'platform' ||
      record.consumer !== 'web' ||
      principal.operatorId !== record.identityId ||
      principal.authenticationVersion !== record.authenticationVersion
    )
      return null;
    return {
      plane: 'platform',
      operatorId: principal.operatorId,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }
}
