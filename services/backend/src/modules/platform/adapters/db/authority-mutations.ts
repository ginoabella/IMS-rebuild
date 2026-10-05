import type { Transaction } from '../../../../infrastructure/database/transaction';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { uuid, type StorageResult } from '../../../identity/domain/storage';
import {
  prepareChange,
  authorityEvent,
  type AccountChange,
  type LockedAccount,
} from '../../../identity/domain/authority-change';
import { authorityVersion } from '../../../tenancy/domain/admission';
import { storageFailure } from '../../../identity/adapters/db/storage-failure';
import { onlyFields } from '../../../identity/domain/storage';
import type { OperatorRecord } from './operator-repository';
// Internal persistence capability. Authenticated owning use cases must authorize
// their actor before supplying the existing trusted transaction handle.
export class OperatorAuthorityMutations {
  async change(
    transaction: Transaction,
    input: { plane: 'platform'; operatorId: string },
    expectedVersion: number,
    change: AccountChange,
  ): Promise<StorageResult<OperatorRecord>> {
    const { actor, target } = transaction.context;
    if (
      !input ||
      !(
        input.plane === 'platform' &&
        uuid(input.operatorId) &&
        onlyFields(input, ['plane', 'operatorId'])
      ) ||
      !authorityVersion(expectedVersion) ||
      target.type !== 'operator' ||
      target.reference !== input.operatorId ||
      target.tenantId !== null ||
      !(actor.kind === 'system' || actor.kind === 'platform_operator')
    )
      return { kind: 'invalid' };
    try {
      return await transaction.required(async () => {
        const { rows } = await transaction.query<LockedAccount>(
          `SELECT id,status,credential_state,password_hash,credential_changed_at,version,authentication_version FROM public.platform_operators WHERE id=$1 AND $2::uuid IS NULL FOR UPDATE`,
          [input.operatorId, null],
        );
        const row = rows[0];
        if (!row) return { kind: 'missing' as const };
        if (row.version !== expectedVersion) return { kind: 'stale' as const };
        if (
          !authorityVersion(row.version) ||
          !authorityVersion(row.authentication_version)
        )
          return { kind: 'invalid' as const };
        const prepared = prepareChange(row, change, false);
        if (!prepared) return { kind: 'invalid' as const };
        if (prepared.noop) {
          const result = await transaction.query<OperatorRecord>(
            `SELECT id,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at FROM public.platform_operators WHERE id=$1 AND $2::uuid IS NULL`,
            [input.operatorId, null],
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
        const result = await transaction.query<OperatorRecord>(
          `UPDATE public.platform_operators SET ${assignments},version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1 AND $2::uuid IS NULL RETURNING id,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at`,
          [input.operatorId, null, ...prepared.values],
        );
        const value = result.rows[0];
        if (!value) throw new Error('Missing locked identity');
        await new AuditRepository().append(
          transaction,
          authorityEvent('operator', change.kind),
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
