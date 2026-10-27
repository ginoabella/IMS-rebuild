import type { Transaction } from '../../../../infrastructure/database/transaction';
import type {
  TenantEditReceipts,
  EditReceipt,
} from '../../application/tenant-edit-ports';
export class TenantEditReceiptRepository implements TenantEditReceipts {
  async inspect(
    tx: Transaction,
    requestId: string,
  ): Promise<EditReceipt | null> {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `tenant-edit:${requestId}`,
    ]);
    const result = await tx.query<EditReceipt>(
      'SELECT request_id,operator_id,tenant_id,section,fingerprint,version,authority_version FROM public.tenant_edit_receipts WHERE request_id=$1',
      [requestId],
    );
    return result.rows[0] ?? null;
  }
  async save(tx: Transaction, r: EditReceipt) {
    await tx.query(
      'INSERT INTO public.tenant_edit_receipts(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        r.request_id,
        r.operator_id,
        r.tenant_id,
        r.section,
        r.fingerprint,
        r.version,
        r.authority_version,
        tx.context.correlationId,
      ],
    );
  }
}
