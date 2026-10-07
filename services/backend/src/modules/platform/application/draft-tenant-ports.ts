import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { TenantRegistry } from './tenant-registry';
import type { TenantRecord } from '../../tenancy/domain/tenant-record';
import type { StorageResult } from '../../identity/domain/storage';
import type { StaffRole } from '../../identity/domain/roles';
export interface DraftTenantRegistry extends TenantRegistry {
  createDraft(
    transaction: Transaction,
    input: { id: string; code: string; displayName: string },
  ): Promise<StorageResult<TenantRecord>>;
  byId(snapshot: ReadSnapshot, id: string): Promise<TenantRecord | null>;
  list(
    snapshot: ReadSnapshot,
    limit: number,
    after: string | null,
  ): Promise<TenantRecord[]>;
}
export interface InitialAdministrator {
  id: string;
  tenant_id: string;
  normalized_username: string;
  roles: StaffRole[];
  status: 'active' | 'disabled';
  credential_state: 'unset' | 'ready';
}
/** Caller-owned narrow administration port; never consumes credential reads. */
export interface FirstAdministrator {
  create(
    transaction: Transaction,
    input: {
      id: string;
      tenantId: string;
      username: string;
    },
  ): Promise<StorageResult<unknown>>;
  read(
    snapshot: ReadSnapshot,
    tenantId: string,
    staffId: string,
  ): Promise<InitialAdministrator | null>;
}
export interface CreationReceipt {
  fingerprint: string;
  tenant_id: string;
  staff_id: string;
}
export interface DraftCreationReceipts {
  inspect(
    transaction: Transaction,
    operatorId: string,
    requestId: string,
  ): Promise<CreationReceipt | null>;
  save(
    transaction: Transaction,
    operatorId: string,
    requestId: string,
    receipt: CreationReceipt,
  ): Promise<void>;
  linked(snapshot: ReadSnapshot, tenantId: string): Promise<string | null>;
}
