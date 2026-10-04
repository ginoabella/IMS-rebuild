import type { Transaction } from '../../../infrastructure/database/transaction';
import type { DataContract } from '../../../infrastructure/execution/context';
export interface AuditWrite {
  append(
    transaction: Transaction,
    contract: DataContract,
    metadata: unknown,
  ): Promise<string>;
}
