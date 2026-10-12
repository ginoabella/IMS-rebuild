import type { StaffSessionDto } from '@myims/contracts';
import type { Principal } from './request-authority';
import type { SessionRecord } from '../domain/session';
/** Passive canonical metadata; no token, hash, version proof or renewal. */
export class StaffCurrentSession {
  execute(principal: Principal, record: SessionRecord): StaffSessionDto | null {
    if (
      principal.plane !== 'tenant' ||
      record.plane !== 'tenant' ||
      principal.tenantId !== record.tenantId ||
      principal.staffId !== record.identityId ||
      principal.authenticationVersion !== record.authenticationVersion ||
      principal.tenantAuthorityVersion !== record.tenantAuthorityVersion
    )
      return null;
    return {
      plane: 'tenant',
      tenantId: principal.tenantId,
      staffId: principal.staffId,
      roles: [...principal.roles],
      consumer: record.consumer,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }
}
