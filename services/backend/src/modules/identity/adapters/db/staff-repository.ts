import { storageFailure } from './storage-failure';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import {
  normalizeUsername,
  positiveVersion,
  uuid,
  type AccountStatus,
  type CredentialState,
  type StorageResult,
} from '../../domain/storage';
export interface StaffRecord {
  id: string;
  tenant_id: string;
  status: AccountStatus;
  credential_state: CredentialState;
  credential_changed_at: Date | null;
  version: number;
  authentication_version: number;
  created_at: Date;
  updated_at: Date;
}
export interface StaffReference {
  plane: 'tenant';
  tenantId: string;
  staffId: string;
}
const columns =
  'id,tenant_id,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at';
const event = {
  type: 'identity.storage.changed',
  version: 1,
  fields: {
    change: { kind: 'enum' as const, values: ['staff_created', 'staff_named'] },
  },
};
function qualified(input: StaffReference) {
  return (
    input.plane === 'tenant' && uuid(input.tenantId) && uuid(input.staffId)
  );
}
export class StaffRepository {
  async find(
    transaction: Transaction,
    reference: StaffReference,
  ): Promise<StorageResult<StaffRecord>> {
    if (!qualified(reference)) return { kind: 'invalid' };
    try {
      const result = await transaction.query<StaffRecord>(
        `SELECT ${columns} FROM public.staff_users WHERE tenant_id=$1 AND id=$2`,
        [reference.tenantId, reference.staffId],
      );
      return result.rows[0]
        ? { kind: 'found', value: result.rows[0] }
        : { kind: 'missing' };
    } catch (error) {
      return storageFailure(error);
    }
  }
  async lookup(
    transaction: Transaction,
    reference: { plane: 'tenant'; tenantId: string; username: unknown },
  ): Promise<StorageResult<StaffRecord>> {
    const username = normalizeUsername(reference.username);
    if (reference.plane !== 'tenant' || !uuid(reference.tenantId) || !username)
      return { kind: 'invalid' };
    try {
      const result = await transaction.query<StaffRecord>(
        `SELECT ${columns} FROM public.staff_users WHERE tenant_id=$1 AND normalized_username=$2`,
        [reference.tenantId, username],
      );
      return result.rows[0]
        ? { kind: 'found', value: result.rows[0] }
        : { kind: 'missing' };
    } catch (error) {
      return storageFailure(error);
    }
  }
  async create(
    transaction: Transaction,
    input: {
      plane: 'tenant';
      id: string;
      tenantId: string;
      username: unknown;
      status: AccountStatus;
      credentialState: CredentialState;
      passwordHash: string | null;
      credentialChangedAt: Date | null;
    },
  ): Promise<StorageResult<StaffRecord>> {
    const username = normalizeUsername(input.username);
    const ready =
      input.credentialState === 'ready' &&
      typeof input.passwordHash === 'string' &&
      Buffer.byteLength(input.passwordHash) > 0 &&
      Buffer.byteLength(input.passwordHash) <= 4096 &&
      input.credentialChangedAt instanceof Date &&
      Number.isFinite(input.credentialChangedAt.getTime());
    const unset =
      input.credentialState === 'unset' &&
      input.passwordHash === null &&
      input.credentialChangedAt === null;
    if (
      input.plane !== 'tenant' ||
      !uuid(input.id) ||
      transaction.context.target.reference !== input.id ||
      !uuid(input.tenantId) ||
      !username ||
      !['active', 'disabled'].includes(input.status) ||
      (!ready && !unset) ||
      transaction.context.target.tenantId !== input.tenantId ||
      transaction.context.target.type !== 'staff'
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const result = await transaction.query<StaffRecord>(
          `INSERT INTO public.staff_users (id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
          [
            input.id,
            input.tenantId,
            username,
            input.status,
            input.credentialState,
            input.passwordHash,
            input.credentialChangedAt,
          ],
        );
        await new AuditRepository().append(transaction, event, {
          change: 'staff_created',
        });
        const value = result.rows[0];
        if (!value) throw new Error('Identity write returned no record');
        return { kind: 'found' as const, value };
      });
    } catch (error) {
      return storageFailure(error);
    }
  }
  async rename(
    transaction: Transaction,
    reference: StaffReference,
    version: number,
    usernameInput: unknown,
  ): Promise<StorageResult<StaffRecord>> {
    const username = normalizeUsername(usernameInput);
    if (
      !qualified(reference) ||
      !positiveVersion(version) ||
      !username ||
      transaction.context.target.reference !== reference.staffId ||
      transaction.context.target.tenantId !== reference.tenantId ||
      transaction.context.target.type !== 'staff'
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const locked = await transaction.query<{
          id: string;
          version: number;
          normalized_username: string;
        }>(
          `SELECT id,version,normalized_username FROM public.staff_users WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
          [reference.tenantId, reference.staffId],
        );
        const row = locked.rows[0];
        if (!row) return { kind: 'missing' as const };
        if (row.version !== version) return { kind: 'stale' as const };
        if (row.normalized_username === username)
          return this.find(transaction, reference);
        const result = await transaction.query<StaffRecord>(
          `UPDATE public.staff_users SET normalized_username=$3,version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2 AND version=$4 RETURNING ${columns}`,
          [reference.tenantId, reference.staffId, username, version],
        );
        await new AuditRepository().append(transaction, event, {
          change: 'staff_named',
        });
        const value = result.rows[0];
        if (!value) throw new Error('Identity write returned no record');
        return { kind: 'found' as const, value };
      });
    } catch (error) {
      return storageFailure(error);
    }
  }
}
