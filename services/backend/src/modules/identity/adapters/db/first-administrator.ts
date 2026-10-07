import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type {
  FirstAdministrator,
  InitialAdministrator,
} from '../../../platform/application/draft-tenant-ports';
import { uuid } from '../../domain/storage';
import { StaffRepository } from './staff-repository';
export class FirstAdministratorRepository implements FirstAdministrator {
  create(
    transaction: Transaction,
    input: { id: string; tenantId: string; username: string },
  ) {
    return new StaffRepository().create(transaction, {
      plane: 'tenant',
      id: input.id,
      tenantId: input.tenantId,
      username: input.username,
      roles: ['tenant_admin'],
      status: 'active',
      credentialState: 'unset',
      passwordHash: null,
      credentialChangedAt: null,
    });
  }
  async read(
    snapshot: ReadSnapshot,
    tenantId: string,
    staffId: string,
  ): Promise<InitialAdministrator | null> {
    if (!uuid(tenantId) || !uuid(staffId))
      throw new Error('Invalid administrator reference');
    const result = await snapshot.query<InitialAdministrator>(
      'SELECT id,tenant_id,normalized_username,roles,status,credential_state FROM public.staff_users WHERE tenant_id=$1 AND id=$2',
      [tenantId, staffId],
    );
    return result.rows[0] ?? null;
  }
}
