import type { GeographyValuesDto, TenantGeographyDto } from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
/** Platform may only compose canonical detail after its own protected tenant read. */
export interface TenantGeographyOwner {
  read(snapshot: ReadSnapshot, tenantId: string): Promise<TenantGeographyDto>;
  save(
    tx: Transaction,
    tenantId: string,
    expectedVersion: number,
    values: GeographyValuesDto,
    confirmed: boolean,
  ): Promise<
    | { kind: 'saved'; version: number }
    | { kind: 'stale' }
    | { kind: 'confirmation_required' }
    | { kind: 'invalid'; message: string }
  >;
}
