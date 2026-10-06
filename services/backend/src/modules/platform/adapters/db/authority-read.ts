import type { Transaction } from '../../../../infrastructure/database/transaction';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import type { PlatformAuthorityRead } from '../../application/authority-read';
import {
  platformAuthority,
  type AuthorityResult,
  type PlatformAuthority,
} from '../../../identity/domain/authority';
import { normalizeUsername, uuid } from '../../../identity/domain/storage';
import { onlyFields } from '../../../identity/domain/storage';
const credentialCoherence = `(credential_state='ready' AND password_hash IS NOT NULL AND octet_length(password_hash) BETWEEN 1 AND 4096 AND credential_changed_at IS NOT NULL AND isfinite(credential_changed_at))`;
export class PlatformAuthorityRepository implements PlatformAuthorityRead {
  constructor(private readonly database: SnapshotDatabase) {}
  async candidate(input: {
    plane: 'platform';
    username: unknown;
  }): Promise<AuthorityResult<PlatformAuthority>> {
    const username = normalizeUsername(input?.username);
    if (
      !username ||
      input.plane !== 'platform' ||
      !onlyFields(input, ['plane', 'username'])
    )
      return { kind: 'denied' };
    return this.read('normalized_username', username);
  }
  async byId(input: {
    plane: 'platform';
    operatorId: string;
  }): Promise<AuthorityResult<PlatformAuthority>> {
    if (
      !input ||
      input.plane !== 'platform' ||
      !uuid(input.operatorId) ||
      !onlyFields(input, ['plane', 'operatorId'])
    )
      return { kind: 'denied' };
    return this.read('id', input.operatorId);
  }
  async lockedById(
    transaction: Transaction,
    operatorId: string,
  ): Promise<AuthorityResult<PlatformAuthority>> {
    if (!uuid(operatorId)) return { kind: 'denied' };
    const result = await transaction.query(
      `SELECT id,status,credential_state,version,authentication_version,${credentialCoherence} AS credential_coherent,'platform_operator' AS authority FROM public.platform_operators WHERE id=$1 FOR SHARE`,
      [operatorId],
    );
    return platformAuthority(result.rows[0]);
  }
  private async read(
    column: 'id' | 'normalized_username',
    value: string,
  ): Promise<AuthorityResult<PlatformAuthority>> {
    try {
      return await this.database.read(async (snapshot) => {
        const result = await snapshot.query(
          `SELECT id,status,credential_state,version,authentication_version,${credentialCoherence} AS credential_coherent,'platform_operator' AS authority FROM public.platform_operators WHERE ${column}=$1`,
          [value],
        );
        return platformAuthority(result.rows[0]);
      });
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
