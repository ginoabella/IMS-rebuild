import type { AllocationTenant } from '@myims/contracts';
import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
/** Tenancy owns canonical status/version facts; callers lock before node resources. */
export interface AllocationTenancy {
  read(
    s: ReadSnapshot,
    tenantId: string,
    lock?: boolean,
  ): Promise<AllocationTenant | null>;
}
