import type { Transaction } from '../../../infrastructure/database/transaction';
import type { StorageResult } from '../../identity/domain/storage';
import type {
  TenantRecord,
  TenantStatus,
} from '../../tenancy/domain/tenant-record';
/** Platform administration consumes tenancy's registry through this caller-owned port. */
export interface TenantRegistry {
  find(
    transaction: Transaction,
    code: unknown,
  ): Promise<StorageResult<TenantRecord>>;
  create(
    transaction: Transaction,
    input: {
      id: string;
      code: unknown;
      displayName: string;
      status: TenantStatus;
    },
  ): Promise<StorageResult<TenantRecord>>;
  rename(
    transaction: Transaction,
    id: string,
    version: number,
    displayName: string,
  ): Promise<StorageResult<TenantRecord>>;
}
