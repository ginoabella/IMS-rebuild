import { storageFailure } from '../../../identity/adapters/db/storage-failure';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import {
  normalizeUsername,
  uuid,
  type StorageResult,
  type AccountStatus,
  type CredentialState,
} from '../../../identity/domain/storage';
export interface OperatorRecord {
  id: string;
  status: AccountStatus;
  credential_state: CredentialState;
  credential_changed_at: Date | null;
  version: number;
  authentication_version: number;
  created_at: Date;
  updated_at: Date;
}
const columns =
  'id,status,credential_state,credential_changed_at,version,authentication_version,created_at,updated_at';
export class OperatorRepository {
  async find(
    transaction: Transaction,
    reference: { plane: 'platform'; operatorId: string },
  ): Promise<StorageResult<OperatorRecord>> {
    if (reference.plane !== 'platform' || !uuid(reference.operatorId))
      return { kind: 'invalid' };
    return this.read(transaction, 'id', reference.operatorId);
  }
  async lookup(
    transaction: Transaction,
    reference: { plane: 'platform'; username: unknown },
  ): Promise<StorageResult<OperatorRecord>> {
    const username = normalizeUsername(reference.username);
    if (reference.plane !== 'platform' || !username) return { kind: 'invalid' };
    return this.read(transaction, 'normalized_username', username);
  }
  private async read(
    transaction: Transaction,
    column: 'id' | 'normalized_username',
    value: string,
  ): Promise<StorageResult<OperatorRecord>> {
    try {
      const result = await transaction.query<OperatorRecord>(
        `SELECT ${columns} FROM public.platform_operators WHERE ${column}=$1`,
        [value],
      );
      return result.rows[0]
        ? { kind: 'found', value: result.rows[0] }
        : { kind: 'missing' };
    } catch (error) {
      return storageFailure(error);
    }
  }
}
