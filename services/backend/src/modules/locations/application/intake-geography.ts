import type { TenantGeographyDto } from '@myims/contracts';
import type {
  AuthorityResult,
  StaffAuthority,
} from '../../identity/domain/authority';
import type { TenantRecord } from '../../tenancy/domain/tenant-record';
import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Principal } from '../../identity/application/request-authority';
import { permissions } from '../../identity/domain/roles';
import { uuid } from '../../identity/domain/storage';
import type { TenantGeographyOwner } from './tenant-geography';
/** Internal future-intake port. Principal must come from RequestAuthority, never JSON.
 * No HTTP route. Revalidates canonical staff/tenant authority in the same snapshot
 * as geography. No incident fallback, public mapping or status bypass is provided.
 */
export class IntakeGeography {
  constructor(
    private readonly database: SnapshotDatabase,
    private readonly geography: Pick<TenantGeographyOwner, 'read'>,
    private readonly staff: {
      inSnapshot(
        snapshot: ReadSnapshot,
        tenantId: string,
        staffId: string,
      ): Promise<AuthorityResult<StaffAuthority>>;
    },
    private readonly tenants: {
      byId(
        snapshot: ReadSnapshot,
        tenantId: string,
      ): Promise<TenantRecord | null>;
    },
  ) {}
  async read(
    principal: Principal,
    tenantId: string,
  ): Promise<
    | {
        kind: 'found';
        tenantId: string;
        tenantVersion: number;
        tenantAuthorityVersion: number;
        geography: Pick<
          TenantGeographyDto,
          'area' | 'defaults' | 'version' | 'srid'
        >;
      }
    | { kind: 'denied' | 'unavailable' }
  > {
    if (
      principal.plane !== 'tenant' ||
      !uuid(tenantId) ||
      tenantId.toLowerCase() !== principal.tenantId ||
      !uuid(principal.staffId)
    )
      return { kind: 'denied' };
    try {
      return await this.database.read(async (snapshot) => {
        const current = await this.staff.inSnapshot(
          snapshot,
          principal.tenantId,
          principal.staffId,
        );
        if (
          current.kind !== 'eligible' ||
          current.snapshot.authenticationVersion !==
            principal.authenticationVersion ||
          current.snapshot.tenantAuthorityVersion !==
            principal.tenantAuthorityVersion ||
          !permissions(current.snapshot.roles).includes('incident.create')
        )
          return { kind: 'denied' as const };
        const row = await this.tenants.byId(snapshot, principal.tenantId);
        if (!row) return { kind: 'denied' as const };
        const { area, defaults, version, srid } = await this.geography.read(
          snapshot,
          tenantId,
        );
        return {
          kind: 'found' as const,
          tenantId: principal.tenantId,
          tenantVersion: row.version,
          tenantAuthorityVersion: row.authority_version,
          geography: { area, defaults, version, srid },
        };
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
