import type { PbxNodeDto } from '@myims/contracts';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type {
  PbxReceipts,
  PbxCreateReceipt,
} from '../../application/pbx-ports';
export class PbxReceiptRepository implements PbxReceipts {
  async inspect(tx: Transaction, operatorId: string, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `pbx-create:${operatorId}:${requestId}`,
    ]);
    const result = await tx.query<PbxCreateReceipt>(
      "SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.pbx_create_receipts WHERE operator_id=$1 AND request_id=$2",
      [operatorId, requestId],
    );
    return result.rows[0] ?? null;
  }
  async save(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    result: PbxNodeDto,
  ) {
    await tx.query(
      'INSERT INTO public.pbx_create_receipts(operator_id,request_id,fingerprint,node_id,result,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
      [
        tx.context.actor.reference,
        requestId,
        fingerprint,
        result.id,
        result,
        tx.context.correlationId,
      ],
    );
  }
}
