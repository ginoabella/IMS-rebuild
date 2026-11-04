import { sortFacts } from '../../domain/tenant-route-bindings';
import type {
  RouteAuthorization,
  RouteAuthorizationKind,
  EvaluatedRouteFact,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import { randomUUID } from 'node:crypto';
const columns = `id,tenant_id AS "tenantId",node_id AS "nodeId",installation_id AS "installationId",kind,resource_id AS "resourceId",scope,state,version,evaluated,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy"`;
type Row = Omit<RouteAuthorization, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};
function dto(r: Row): RouteAuthorization {
  return {
    ...r,
    evaluated: sortFacts(r.evaluated),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export class RouteBindingRepository {
  async all(s: ReadSnapshot, nodeId: string) {
    const rows = (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_route_authorizations WHERE node_id=$1 AND state='active' ORDER BY id LIMIT 2049`,
        [nodeId],
      )
    ).rows;
    if (rows.length > 2048) throw new Error('Authorization graph bound');
    return rows.map(dto);
  }
  async detail(s: ReadSnapshot, id: string) {
    const row = (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_route_authorizations WHERE id=$1`,
        [id],
      )
    ).rows[0];
    return row ? dto(row) : null;
  }
  async page(
    s: ReadSnapshot,
    nodeId: string,
    tenantId: string,
    after: string | null,
    limit: number,
    history: boolean,
  ) {
    return (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_route_authorizations WHERE node_id=$1 AND (tenant_id=$2 OR (kind='trunks' AND scope='shared')) AND ($3::uuid IS NULL OR id>$3) AND ($4 OR state='active') ORDER BY id LIMIT $5`,
        [nodeId, tenantId, after, history, limit],
      )
    ).rows.map(dto);
  }
  async insert(
    tx: Transaction,
    tenantId: string | null,
    nodeId: string,
    installationId: string,
    kind: RouteAuthorizationKind,
    resourceId: string,
    scope: 'owned' | 'shared',
    evaluated: EvaluatedRouteFact[],
  ) {
    const field = {
      dids: 'did_id',
      groups: 'group_id',
      inbound: 'inbound_id',
      outbound: 'outbound_id',
      trunks: 'trunk_id',
      permission: 'trunk_id',
    }[kind];
    const id = randomUUID();
    await tx.query(
      `INSERT INTO public.tenant_route_authorizations(id,tenant_id,node_id,installation_id,kind,${field},scope,evaluated,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [
        id,
        tenantId,
        nodeId,
        installationId,
        kind,
        resourceId,
        scope,
        JSON.stringify(evaluated),
        tx.context.actor.reference,
      ],
    );
    return (await this.detail(tx, id))!;
  }
  async change(
    tx: Transaction,
    id: string,
    evaluated: EvaluatedRouteFact[],
    revoke: boolean,
  ) {
    await tx.query(
      `UPDATE public.tenant_route_authorizations SET state=$2,evaluated=$3,version=version+1,updated_at=clock_timestamp(),updated_by=$4 WHERE id=$1`,
      [
        id,
        revoke ? 'revoked' : 'active',
        JSON.stringify(evaluated),
        tx.context.actor.reference,
      ],
    );
    return (await this.detail(tx, id))!;
  }
  async receipt(tx: Transaction, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `tenant-route-binding:${tx.context.actor.reference}:${requestId}`,
    ]);
    return (
      await tx.query<{
        fingerprint: string;
        result: { items: RouteAuthorization[] };
        expired: boolean;
      }>(
        `SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.tenant_route_receipts WHERE operator_id=$1 AND request_id=$2`,
        [tx.context.actor.reference, requestId],
      )
    ).rows[0];
  }
  async saveReceipt(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    items: RouteAuthorization[],
  ) {
    await tx.query(
      `INSERT INTO public.tenant_route_receipts(operator_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4)`,
      [tx.context.actor.reference, requestId, fingerprint, { items }],
    );
  }
}
/** Caller already holds the canonical node lock; same query covers actual neighboring writers. */
export async function bindingBlockers(
  s: ReadSnapshot,
  nodeId: string,
  kind: string,
  id: string,
) {
  return (
    await s.query<{
      id: string;
      name: string;
      kind: 'binding';
      tenantId: string | null;
    }>(
      `SELECT id,CASE WHEN tenant_id IS NULL THEN 'Shared trunk classification: review tenant route bindings' ELSE 'Tenant '||tenant_id::text||' desired '||kind END AS name,'binding' AS kind,tenant_id AS "tenantId" FROM public.tenant_route_authorizations WHERE node_id=$1 AND state='active' AND evaluated @> $2::jsonb ORDER BY id LIMIT 10`,
      [nodeId, JSON.stringify([{ kind, id }])],
    )
  ).rows;
}
