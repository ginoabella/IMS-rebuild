import type { Transaction } from '../../../../infrastructure/database/transaction';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { uuid, type StorageResult } from '../../domain/storage';
import {
  prepareChange,
  authorityEvent,
  type AccountChange,
  type LockedAccount,
} from '../../domain/authority-change';
import { authorityVersion } from '../../../tenancy/domain/admission';
import { storageFailure } from './storage-failure';
import { onlyFields } from '../../domain/storage';
import type { StaffRecord } from './staff-repository';
// Internal persistence capability. Authenticated owning use cases must authorize
// their actor before supplying the existing trusted transaction handle.
export class StaffAuthorityMutations {
  async change(
    transaction: Transaction,
    input: { plane: 'tenant'; tenantId: string; staffId: string },
    expectedVersion: number,
    change: AccountChange,
  ): Promise<StorageResult<StaffRecord>> {
    const { actor, target } = transaction.context;
    if (
      !input ||
      !(
        input.plane === 'tenant' &&
        uuid(input.tenantId) &&
        uuid(input.staffId) &&
        onlyFields(input, ['plane', 'tenantId', 'staffId'])
      ) ||
      !authorityVersion(expectedVersion) ||
      target.type !== 'staff' ||
      target.reference !== input.staffId ||
      target.tenantId !== input.tenantId ||
      !(
        actor.kind === 'system' ||
        (actor.kind === 'tenant_staff' && actor.tenantId === input.tenantId)
      )
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const { rows } = await transaction.query<LockedAccount>(
          `SELECT id,status,credential_state,password_hash,credential_changed_at,version,authentication_version,roles FROM public.staff_users WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
          [input.staffId, input.tenantId],
        );
        const row = rows[0];
        if (!row) return { kind: 'missing' as const };
        if (row.version !== expectedVersion) return { kind: 'stale' as const };
        if (
          !authorityVersion(row.version) ||
          !authorityVersion(row.authentication_version)
        )
          return { kind: 'invalid' as const };
        const prepared = prepareChange(row, change, true);
        if (!prepared) return { kind: 'invalid' as const };
        if (prepared.noop) {
          const result = await transaction.query<StaffRecord>(
            `SELECT id,tenant_id,roles,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at FROM public.staff_users WHERE id=$1 AND tenant_id=$2`,
            [input.staffId, input.tenantId],
          );
          const value = result.rows[0];
          if (!value) throw new Error('Missing locked identity');
          return { kind: 'found' as const, value };
        }
        const assignments = {
          status: 'status=$3',
          roles: 'roles=$3',
          credential:
            'credential_state=$3,password_hash=$4,credential_changed_at=$5',
        }[prepared.kind];
        const result = await transaction.query<StaffRecord>(
          `UPDATE public.staff_users SET ${assignments},version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1 AND tenant_id=$2 RETURNING id,tenant_id,roles,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at`,
          [input.staffId, input.tenantId, ...prepared.values],
        );
        const value = result.rows[0];
        if (!value) throw new Error('Missing locked identity');
        await new AuditRepository().append(
          transaction,
          authorityEvent('staff', change.kind),
          {
            oldCode: prepared.oldCode,
            newCode: prepared.newCode,
            oldRowVersion: row.version,
            newRowVersion: value.version,
            oldAuthorityVersion: row.authentication_version,
            newAuthorityVersion: value.authentication_version,
          },
        );
        return { kind: 'found' as const, value };
      });
    } catch (error) {
      return storageFailure(error);
    }
  }
}
