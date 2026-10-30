import type { AllocationTenant } from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { AllocationTenancy } from '../../../telephony/application/allocation-tenancy';
export class AllocationTenancyRepository implements AllocationTenancy {
  async read(s: ReadSnapshot, tenantId: string, lock = false) {
    return (
      (
        await s.query<AllocationTenant>(
          `SELECT id,status,version,authority_version AS "authorityVersion" FROM public.tenants WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
          [tenantId],
        )
      ).rows[0] ?? null
    );
  }
}
