import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type {
  CreationReceipt,
  DraftCreationReceipts,
} from '../../application/draft-tenant-ports';
import { uuid } from '../../../identity/domain/storage';
export class DraftCreationReceiptRepository implements DraftCreationReceipts {
  async inspect(
    tx: Transaction,
    operatorId: string,
    requestId: string,
  ): Promise<CreationReceipt | null> {
    if (!uuid(operatorId) || !uuid(requestId))
      throw new Error('Invalid attempt reference');
    // Held until outer commit/rollback; statement/lock timeouts bound contention.
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `draft-tenant:${operatorId}:${requestId}`,
    ]);
    const result = await tx.query<CreationReceipt>(
      'SELECT fingerprint,tenant_id,staff_id FROM public.draft_tenant_receipts WHERE operator_id=$1 AND request_id=$2',
      [operatorId, requestId],
    );
    return result.rows[0] ?? null;
  }
  async save(
    tx: Transaction,
    operatorId: string,
    requestId: string,
    receipt: CreationReceipt,
  ) {
    await tx.query(
      'INSERT INTO public.draft_tenant_receipts(operator_id,request_id,fingerprint,tenant_id,staff_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
      [
        operatorId,
        requestId,
        receipt.fingerprint,
        receipt.tenant_id,
        receipt.staff_id,
        tx.context.correlationId,
      ],
    );
  }
  async linked(
    snapshot: ReadSnapshot,
    tenantId: string,
  ): Promise<string | null> {
    const result = await snapshot.query<{ staff_id: string }>(
      'SELECT staff_id FROM public.draft_tenant_receipts WHERE tenant_id=$1',
      [tenantId],
    );
    return result.rows[0]?.staff_id ?? null;
  }
}
