import type { SaveTenantSectionDto, TenantSection } from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { TenantRecord } from '../../tenancy/domain/tenant-record';
export interface EditReceipt {
  request_id: string;
  operator_id: string;
  tenant_id: string;
  section: TenantSection;
  fingerprint: string;
  version: number;
  authority_version: number;
}
export interface TenantEditReceipts {
  inspect(tx: Transaction, requestId: string): Promise<EditReceipt | null>;
  save(tx: Transaction, receipt: EditReceipt): Promise<void>;
}
export interface TenantConfigurationOwner {
  configure(
    tx: Transaction,
    id: string,
    input: SaveTenantSectionDto,
  ): Promise<
    | { kind: 'found'; value: TenantRecord }
    | { kind: 'missing' | 'stale' | 'ineligible' | 'unavailable' }
  >;
}
