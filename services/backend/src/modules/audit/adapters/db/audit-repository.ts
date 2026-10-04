import { randomUUID } from 'node:crypto';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import {
  safeData,
  type DataContract,
} from '../../../../infrastructure/execution/context';
import type { AuditWrite } from '../../application/audit-write';
export class AuditRepository implements AuditWrite {
  async append(
    transaction: Transaction,
    contract: DataContract,
    metadata: unknown,
  ) {
    return transaction.required(async () => {
      const data = safeData(contract, metadata);
      const id = randomUUID();
      const { actor, target, correlationId } = transaction.context;
      await transaction.query(
        `INSERT INTO public.audit_events
      (id, event_type, schema_version, actor_kind, actor_reference, identity_plane, actor_tenant_id, system_reason, target_type, target_reference, tenant_id, correlation_id, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          id,
          contract.type,
          contract.version,
          actor.kind,
          actor.reference,
          actor.plane,
          actor.tenantId,
          actor.kind === 'system' ? actor.reason : null,
          target.type,
          target.reference,
          target.tenantId,
          correlationId,
          data,
        ],
      );
      return id;
    });
  }
}
