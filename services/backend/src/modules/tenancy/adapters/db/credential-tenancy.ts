import type { Transaction } from '../../../../infrastructure/database/transaction';
import type {
  CredentialTenancy,
  CredentialTenant,
} from '../../../identity/application/credential-action-ports';
export class CredentialTenancyRepository implements CredentialTenancy {
  async lock(tx: Transaction, tenantId: string) {
    const result = await tx.query<CredentialTenant>(
      'SELECT id,status,version,authority_version FROM public.tenants WHERE id=$1 FOR UPDATE',
      [tenantId],
    );
    return result.rows[0] ?? null;
  }
}
