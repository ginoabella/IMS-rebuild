import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../../audit/application/audit-write';

export interface TrunkReservationScope {
  nodeId: string;
  installationId: string;
  bindingId: string;
  generationId: string;
  operationId: string;
}

/** Lower-level owner adapter only. Caller must independently authorize current
 * business authority before entering this transaction. No worker/API composition,
 * provider cleanup, qualification or claim authority is established here. */
export class TrunkReservationTransitions {
  constructor(private readonly audit: AuditWrite) {}

  async terminal(
    transaction: Transaction,
    scope: TrunkReservationScope,
    state: 'cancelled' | 'failed',
  ): Promise<'changed' | 'replayed' | null> {
    return transaction.required(async () => {
      const { actor, target, correlationId } = transaction.context;
      if (
        !Object.values(scope).every(
          (id) =>
            typeof id === 'string' &&
            /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id),
        ) ||
        Object.keys(scope).sort().join(',') !==
          'bindingId,generationId,installationId,nodeId,operationId' ||
        (state !== 'cancelled' && state !== 'failed') ||
        actor.kind !== 'platform_operator' ||
        target.type !== 'trunk_credential_operation' ||
        target.reference !== scope.operationId ||
        target.tenantId !== null
      )
        throw new Error('Invalid trunk reservation transition');

      // The immutable generation join independently qualifies all supplied scope.
      // Lock only the exact reservation: no last/latest/other-installation fallback.
      const found = await transaction.query<{ state: string }>(
        `SELECT r.state FROM public.trunk_credential_reservations r
         JOIN public.trunk_credential_generations g ON g.id=r.generation_id AND g.binding_id=r.binding_id AND g.operation_id=r.id
         WHERE r.id=$1 AND r.binding_id=$2 AND r.generation_id=$3 AND g.node_id=$4 AND g.installation_id=$5
         AND r.operator_id=$6 AND r.correlation_id=$7 FOR UPDATE OF r`,
        [
          scope.operationId,
          scope.bindingId,
          scope.generationId,
          scope.nodeId,
          scope.installationId,
          actor.reference,
          correlationId,
        ],
      );
      if (found.rows.length === 0) return null;
      if (found.rows.length !== 1)
        throw new Error('Invalid trunk reservation transition');
      if (found.rows[0]?.state === state) return 'replayed';
      if (found.rows[0]?.state !== 'reserved')
        throw new Error('Terminal trunk reservation conflict');
      const updated = await transaction.query(
        `UPDATE public.trunk_credential_reservations SET state=$2,terminal_at=clock_timestamp() WHERE id=$1 AND state='reserved' RETURNING id`,
        [scope.operationId, state],
      );
      if (updated.rows.length !== 1)
        throw new Error('Trunk reservation transition lost');
      await transaction.query(
        'INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES($1,$2)',
        [scope.operationId, state],
      );
      await this.audit.append(
        transaction,
        {
          type: 'trunk.credential.' + state,
          version: 1,
          fields: {
            bindingId: { kind: 'uuid' },
            generationId: { kind: 'uuid' },
          },
        },
        { bindingId: scope.bindingId, generationId: scope.generationId },
      );
      // Deferred DB constraint independently demands same-transaction history/audit.
      return 'changed';
    });
  }
}
