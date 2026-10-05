import { storageFailure } from '../../../identity/adapters/db/storage-failure';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import {
  normalizeTenantCode,
  positiveVersion,
  uuid,
  type StorageResult,
} from '../../../identity/domain/storage';
import type { TenantRecord, TenantStatus } from '../../domain/tenant-record';
import type { TenantRegistry } from '../../../platform/application/tenant-registry';
const columns =
  'id,normalized_code,display_name,status,version,authority_version,created_at,updated_at';
const event = {
  type: 'identity.storage.changed',
  version: 1,
  fields: {
    change: {
      kind: 'enum' as const,
      values: [
        'tenant_created',
        'tenant_named',
        'staff_created',
        'staff_named',
      ],
    },
  },
};
export class TenantRepository implements TenantRegistry {
  async find(
    transaction: Transaction,
    code: unknown,
  ): Promise<StorageResult<TenantRecord>> {
    const normalized = normalizeTenantCode(code);
    if (!normalized) return { kind: 'invalid' };
    try {
      const result = await transaction.query<TenantRecord>(
        `SELECT ${columns} FROM public.tenants WHERE normalized_code=$1`,
        [normalized],
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
      id: string;
      code: unknown;
      displayName: string;
      status: TenantStatus;
    },
  ): Promise<StorageResult<TenantRecord>> {
    const code = normalizeTenantCode(input.code);
    if (
      !uuid(input.id) ||
      transaction.context.target.reference !== input.id ||
      !code ||
      typeof input.displayName !== 'string' ||
      !input.displayName.trim() ||
      input.displayName.length > 200 ||
      !['draft', 'active', 'suspended', 'retired'].includes(input.status)
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const id = input.id;
        if (
          transaction.context.target.type !== 'tenant' ||
          transaction.context.target.tenantId !== null
        )
          return { kind: 'invalid' as const };
        const result = await transaction.query<TenantRecord>(
          `INSERT INTO public.tenants (id,normalized_code,display_name,status) VALUES ($1,$2,$3,$4) RETURNING ${columns}`,
          [id, code, input.displayName, input.status],
        );
        await new AuditRepository().append(transaction, event, {
          change: 'tenant_created',
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
    id: string,
    version: number,
    displayName: string,
  ): Promise<StorageResult<TenantRecord>> {
    if (
      !uuid(id) ||
      !positiveVersion(version) ||
      typeof displayName !== 'string' ||
      !displayName.trim() ||
      displayName.length > 200 ||
      transaction.context.target.reference !== id ||
      transaction.context.target.type !== 'tenant' ||
      transaction.context.target.tenantId !== null
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const locked = await transaction.query<TenantRecord>(
          `SELECT ${columns} FROM public.tenants WHERE id=$1 FOR UPDATE`,
          [id],
        );
        const row = locked.rows[0];
        if (!row) return { kind: 'missing' as const };
        if (row.version !== version) return { kind: 'stale' as const };
        if (row.display_name === displayName)
          return { kind: 'found' as const, value: row };
        const result = await transaction.query<TenantRecord>(
          `UPDATE public.tenants SET display_name=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND version=$3 RETURNING ${columns}`,
          [id, displayName, version],
        );
        await new AuditRepository().append(transaction, event, {
          change: 'tenant_named',
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
