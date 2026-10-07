import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { CredentialProvenance } from '../../../identity/application/credential-action-ports';
export class CredentialProvenanceRepository implements CredentialProvenance {
  async linked(tx: Transaction, tenantId: string) {
    const result = await tx.query<{ staff_id: string }>(
      'SELECT staff_id FROM public.draft_tenant_receipts WHERE tenant_id=$1',
      [tenantId],
    );
    return result.rows[0]?.staff_id ?? null;
  }
}
