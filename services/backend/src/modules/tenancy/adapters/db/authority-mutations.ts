import type { Transaction } from '../../../../infrastructure/database/transaction';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { uuid, type StorageResult } from '../../../identity/domain/storage';
import { authorityEvent } from '../../../identity/domain/authority-change';
import { authorityVersion } from '../../domain/admission';
import { storageFailure } from '../../../identity/adapters/db/storage-failure';
import { onlyFields } from '../../../identity/domain/storage';
import type { TenantRecord, TenantStatus } from '../../domain/tenant-record';
const columns =
  'id,normalized_code,display_name,status,version,authority_version,created_at,updated_at';
// Persistence boundary only; P4-U3 owns transitions, activation and PBX effects.
export class TenantAuthorityMutations {
  async status(
    transaction: Transaction,
    input: { tenantId: string },
    expectedVersion: number,
    status: TenantStatus,
  ): Promise<StorageResult<TenantRecord>> {
    const { actor, target } = transaction.context;
    if (
      !input ||
      !uuid(input.tenantId) ||
      !onlyFields(input, ['tenantId']) ||
      !authorityVersion(expectedVersion) ||
      !['draft', 'active', 'suspended', 'retired'].includes(status) ||
      target.type !== 'tenant' ||
      target.reference !== input.tenantId ||
      target.tenantId !== null ||
      (actor.kind !== 'system' && actor.kind !== 'platform_operator')
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const { rows } = await transaction.query<TenantRecord>(
          `SELECT ${columns} FROM public.tenants WHERE id=$1 FOR UPDATE`,
          [input.tenantId],
        );
        const row = rows[0];
        if (!row) return { kind: 'missing' as const };
        if (row.version !== expectedVersion) return { kind: 'stale' as const };
        if (
          !authorityVersion(row.version) ||
          !authorityVersion(row.authority_version) ||
          !['draft', 'active', 'suspended', 'retired'].includes(row.status)
        )
          return { kind: 'invalid' as const };
        if (row.status === status)
          return { kind: 'found' as const, value: row };
        const result = await transaction.query<TenantRecord>(
          `UPDATE public.tenants SET status=$2,version=version+1,authority_version=authority_version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,
          [input.tenantId, status],
        );
        const value = result.rows[0];
        if (!value) throw new Error('Missing locked tenant');
        await new AuditRepository().append(
          transaction,
          authorityEvent('tenant', 'status'),
          {
            oldCode: row.status,
            newCode: status,
            oldRowVersion: row.version,
            newRowVersion: value.version,
            oldAuthorityVersion: row.authority_version,
            newAuthorityVersion: value.authority_version,
          },
        );
        return { kind: 'found' as const, value };
      });
    } catch (error) {
      return storageFailure(error);
    }
  }
}
