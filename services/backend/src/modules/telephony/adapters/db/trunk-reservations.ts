import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../../audit/application/audit-write';

export interface TrunkReservationRequest {
  nodeId: string;
  installationId: string;
  peerId: string;
  bindingId: string;
  generationId: string;
  operationId: string;
  requestId: string;
  authenticationVersion: number;
  nodeVersion: number;
  peerRevision: number;
  expectedOwnerRevision: number;
}
export interface TrunkReservationReceipt {
  operationId: string;
  bindingId: string;
  generationId: string;
  generationOrdinal: number;
  materialVersion: 1;
  state: 'reserved' | 'cancelled' | 'failed';
  outcome: 'created' | 'replayed';
}
export class TrunkReservationError extends Error {
  constructor(
    readonly code:
      | 'invalid_request'
      | 'intent_lock_required'
      | 'request_conflict'
      | 'scope_unavailable'
      | 'stale_owner'
      | 'preparation_active',
  ) {
    super('Trunk reservation rejected');
  }
}
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const versions = [
  'authenticationVersion',
  'nodeVersion',
  'peerRevision',
  'expectedOwnerRevision',
] as const;
const ids = [
  'nodeId',
  'installationId',
  'peerId',
  'bindingId',
  'generationId',
  'operationId',
  'requestId',
] as const;
const locks = new WeakMap<Transaction, Set<string>>();

/** Inactive owner persistence adapter, not admission or provider authority.
 * Caller locks current business authority first, then lockIntent, then canonical
 * node/peer dependencies, then reserve. Captured versions do not validate sessions.
 * HTTP/ordinary runtime cannot assume the owner role. No provider I/O occurs here. */
export class TrunkReservations {
  constructor(private readonly audit: AuditWrite) {}

  async lockIntent(transaction: Transaction, requestId: string): Promise<void> {
    return transaction.required(async () => {
      const { actor } = transaction.context;
      if (
        actor.kind !== 'platform_operator' ||
        actor.plane !== 'platform' ||
        actor.tenantId !== null ||
        !uuid(actor.reference) ||
        !uuid(requestId)
      )
        throw new TrunkReservationError('invalid_request');
      await transaction.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('trunk-reservation-intent:' || $1 || ':' || $2,0))",
        [actor.reference, requestId],
      );
      const held = locks.get(transaction) ?? new Set<string>();
      held.add(requestId);
      locks.set(transaction, held);
    });
  }

  async reserve(
    transaction: Transaction,
    request: TrunkReservationRequest,
  ): Promise<TrunkReservationReceipt> {
    return transaction.required(async () => {
      // Capture scalar intent before any await; caller mutation cannot change
      // validated scope or the receipt while locks/audit I/O are pending.
      const data = { ...request };
      const { actor, target, correlationId } = transaction.context;
      if (
        actor.kind !== 'platform_operator' ||
        actor.plane !== 'platform' ||
        actor.tenantId !== null ||
        !uuid(actor.reference) ||
        target.type !== 'trunk_credential_operation' ||
        target.tenantId !== null ||
        target.reference !== data.operationId ||
        Object.keys(data).sort().join(',') !==
          [...ids, ...versions].sort().join(',') ||
        !ids.every((key) => uuid(data[key])) ||
        !versions.every(
          (key) =>
            Number.isSafeInteger(data[key]) &&
            data[key] > 0 &&
            data[key] <= 2147483647,
        )
      )
        throw new TrunkReservationError('invalid_request');
      if (!locks.get(transaction)?.has(data.requestId))
        throw new TrunkReservationError('intent_lock_required');

      const prior = await transaction.query<{
        operationId: string;
        bindingId: string;
        generationId: string;
        nodeId: string;
        installationId: string;
        peerId: string;
        authenticationVersion: number;
        nodeVersion: number;
        peerRevision: number;
        expectedOwnerRevision: number;
        correlationId: string;
        generationOrdinal: number;
        state: TrunkReservationReceipt['state'];
      }>(
        `SELECT r.id AS "operationId",r.binding_id AS "bindingId",r.generation_id AS "generationId",
          g.node_id AS "nodeId",g.installation_id AS "installationId",g.peer_id AS "peerId",
          r.authentication_version AS "authenticationVersion",r.node_version AS "nodeVersion",
          r.peer_revision AS "peerRevision",r.expected_owner_revision AS "expectedOwnerRevision",
          r.correlation_id AS "correlationId",g.ordinal AS "generationOrdinal",r.state
         FROM public.trunk_credential_reservations r
         JOIN public.trunk_credential_generations g ON g.operation_id=r.id AND g.id=r.generation_id AND g.binding_id=r.binding_id
         WHERE r.operator_id=$1 AND r.request_id=$2`,
        [actor.reference, data.requestId],
      );
      const previous = prior.rows[0];
      if (previous) {
        if (
          prior.rows.length !== 1 ||
          ![...ids.filter((key) => key !== 'requestId'), ...versions].every(
            (key) => previous[key] === data[key],
          ) ||
          previous.correlationId !== correlationId
        )
          throw new TrunkReservationError('request_conflict');
        return {
          operationId: previous.operationId,
          bindingId: previous.bindingId,
          generationId: previous.generationId,
          generationOrdinal: previous.generationOrdinal,
          materialVersion: 1,
          state: previous.state,
          outcome: 'replayed',
        };
      }
      // Binding-scoped advisory serialization permits ordinal allocation without
      // granting UPDATE on immutable binding rows. The DB trigger also row-locks
      // and independently enforces the next ordinal against direct owner SQL.
      await transaction.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('trunk-reservation-binding:' || $1,0))",
        [data.bindingId],
      );
      const binding = await transaction.query<{
        ownerRevision: number;
        peerRevision: number;
      }>(
        `SELECT b.owner_revision AS "ownerRevision",p.revision AS "peerRevision"
         FROM public.trunk_credential_bindings b JOIN public.trunk_credential_peer_scopes p
         ON p.peer_id=b.peer_id AND p.node_id=b.node_id AND p.installation_id=b.installation_id
         WHERE b.id=$1 AND b.node_id=$2 AND b.installation_id=$3 AND b.peer_id=$4`,
        [data.bindingId, data.nodeId, data.installationId, data.peerId],
      );
      if (binding.rows.length !== 1)
        throw new TrunkReservationError('scope_unavailable');
      if (
        binding.rows[0]?.ownerRevision !== data.expectedOwnerRevision ||
        binding.rows[0]?.peerRevision !== data.peerRevision
      )
        throw new TrunkReservationError('stale_owner');
      const active = await transaction.query(
        "SELECT id FROM public.trunk_credential_reservations WHERE binding_id=$1 AND state='reserved'",
        [data.bindingId],
      );
      if (active.rows.length)
        throw new TrunkReservationError('preparation_active');
      const next = await transaction.query<{ ordinal: number }>(
        'SELECT (COALESCE(max(ordinal),0)+1)::integer AS ordinal FROM public.trunk_credential_generations WHERE binding_id=$1',
        [data.bindingId],
      );
      const ordinal = next.rows[0]?.ordinal;
      if (!ordinal || !Number.isSafeInteger(ordinal))
        throw new TrunkReservationError('invalid_request');
      await transaction.query(
        `INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          data.generationId,
          data.bindingId,
          data.nodeId,
          data.installationId,
          data.peerId,
          ordinal,
          data.operationId,
        ],
      );
      await transaction.query(
        `INSERT INTO public.trunk_credential_reservations(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          data.operationId,
          data.bindingId,
          data.generationId,
          data.requestId,
          actor.reference,
          data.authenticationVersion,
          data.nodeVersion,
          data.peerRevision,
          data.expectedOwnerRevision,
          correlationId,
        ],
      );
      await transaction.query(
        "INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES($1,'reserved')",
        [data.operationId],
      );
      await this.audit.append(
        transaction,
        {
          type: 'trunk.credential.reserved',
          version: 1,
          fields: {
            bindingId: { kind: 'uuid' },
            generationId: { kind: 'uuid' },
          },
        },
        { bindingId: data.bindingId, generationId: data.generationId },
      );
      return {
        operationId: data.operationId,
        bindingId: data.bindingId,
        generationId: data.generationId,
        generationOrdinal: ordinal,
        materialVersion: 1,
        state: 'reserved',
        outcome: 'created',
      };
    });
  }
}
