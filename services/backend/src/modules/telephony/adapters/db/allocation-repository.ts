import type {
  AllocationBlocker,
  AllocationStock,
  InventoryClaim,
} from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import {
  RuntimeDependencies,
  RetainedRuntimeDependency,
} from '../../application/runtime-dependencies';
import { PeerRepository } from './peer-repository';
import { RoutingRepository } from './routing-repository';
const columns = `id,tenant_id AS "tenantId",node_id AS "nodeId",installation_id AS "installationId",extension_id AS "extensionId",state,version,created_at AS "createdAt",updated_at AS "updatedAt",created_by AS "createdBy",updated_by AS "updatedBy"`;
type Row = Omit<InventoryClaim, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};
function dto(r: Row): InventoryClaim {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export class AllocationRepository {
  node = new PeerRepository().node;
  async claim(s: ReadSnapshot, id: string) {
    const r = (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_inventory_claims WHERE id=$1`,
        [id],
      )
    ).rows[0];
    return r ? dto(r) : null;
  }
  async stock(
    s: ReadSnapshot,
    nodeId: string,
    ids: string[] | null,
    numbers: string[] | null,
    after: string | null = null,
    limit = 51,
    lock = false,
  ): Promise<AllocationStock[]> {
    const rows = (
      await s.query<
        Omit<AllocationStock, 'claim' | 'assignment' | 'verification'>
      >(
        `SELECT id,number,kind,version,administrative_status AS "administrativeStatus",EXISTS(SELECT 1 FROM public.endpoint_credential_operations o WHERE o.extension_id=extensions.id AND o.state IN ('queued','retrying','needs_reconciliation')) AS "credentialPending" FROM public.extensions WHERE node_id=$1 AND ($2::uuid[] IS NULL OR id=ANY($2)) AND ($3::text[] IS NULL OR number=ANY($3)) AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5${lock ? ' FOR UPDATE' : ''}`,
        [nodeId, ids, numbers, after, limit],
      )
    ).rows;
    const claims = (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_inventory_claims WHERE extension_id=ANY($1::uuid[]) AND state<>'released'`,
        [rows.map((r) => r.id)],
      )
    ).rows.map(dto);
    return rows.map((r) => ({
      ...r,
      claim: claims.find((c) => c.extensionId === r.id) ?? null,
      assignment: 'none',
      verification: 'not_established',
    }));
  }
  async list(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
    after: string | null,
    limit: number,
    history: boolean,
  ) {
    return (
      await s.query<Row>(
        `SELECT ${columns} FROM public.tenant_inventory_claims WHERE tenant_id=$1 AND node_id=$2 AND ($3::uuid IS NULL OR id>$3) AND ($4 OR state<>'released') ORDER BY id LIMIT $5`,
        [tenantId, nodeId, after, history, limit],
      )
    ).rows.map(dto);
  }
  async capacity(s: ReadSnapshot, tenantId: string, nodeId: string) {
    return (
      await s.query<{
        available: number;
        reserved: number;
        allocated: number;
        disabled: number;
      }>(
        `SELECT (SELECT count(*)::integer FROM public.extensions e WHERE e.node_id=$2 AND NOT EXISTS(SELECT 1 FROM public.tenant_inventory_claims own WHERE own.extension_id=e.id AND own.state<>'released')) AS available,count(*) FILTER(WHERE c.state='reserved')::integer AS reserved,count(*) FILTER(WHERE c.state='allocated')::integer AS allocated,count(*) FILTER(WHERE c.state<>'released' AND e.administrative_status='disabled')::integer AS disabled FROM public.tenant_inventory_claims c JOIN public.extensions e ON e.id=c.extension_id WHERE c.tenant_id=$1 AND c.node_id=$2`,
        [tenantId, nodeId],
      )
    ).rows[0]!;
  }
  async blockers(
    tx: Transaction,
    nodeId: string,
    extensionId: string,
  ): Promise<AllocationBlocker[]> {
    const blockers: AllocationBlocker[] =
      await new RoutingRepository().blockers(tx, nodeId, extensionId);
    try {
      await new RuntimeDependencies().assertUnreferenced(
        tx,
        nodeId,
        'extensions',
        extensionId,
      );
    } catch (e) {
      if (!(e instanceof RetainedRuntimeDependency)) throw e;
      blockers.push({
        id: extensionId,
        name: 'Retained installed, in-flight or rollback revision',
      });
    }
    // A committed live intent is conservative affirmative history: do not claim
    // never-installed safety after pins have been released or an operation failed.
    const history = await tx.query(
      `SELECT 1 FROM public.pbx_live_operations o JOIN public.pbx_revisions r ON r.id=o.target_id WHERE o.node_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot->'extensions') e WHERE e->>'id'=$2) LIMIT 1`,
      [nodeId, extensionId],
    );
    if (history.rows.length)
      blockers.push({
        id: extensionId,
        name: 'Prior live intent requires installed-resource release review',
      });
    const unknown = await tx.query(
      `SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND (runtime_state<>'verified' OR active_operation_id IS NOT NULL OR installed_id IS NULL OR verified_id IS NULL OR known_good_id IS NULL OR baseline_verified_at IS NULL) LIMIT 1`,
      [nodeId],
    );
    if (unknown.rows.length)
      blockers.push({
        id: extensionId,
        name: 'Runtime safety is pending or unknown',
      });
    // The initial native baseline has no revision snapshot. Stock that already
    // existed then cannot be proved absent from it using later intent history.
    const initial = await tx.query(
      `SELECT 1 FROM public.pbx_live_runtime r JOIN public.extensions e ON e.node_id=r.node_id AND e.id=$2 WHERE r.node_id=$1 AND e.created_at<=r.baseline_verified_at LIMIT 1`,
      [nodeId, extensionId],
    );
    if (initial.rows.length)
      blockers.push({
        id: extensionId,
        name: 'Initial runtime baseline requires installed-resource release review',
      });
    return blockers.slice(0, 10).map(({ id, name }) => ({ id, name }));
  }
  async insert(
    tx: Transaction,
    id: string,
    tenantId: string,
    nodeId: string,
    installationId: string,
    extensionId: string,
    state: 'reserved' | 'allocated',
  ) {
    await tx.query(
      `INSERT INTO public.tenant_inventory_claims(id,tenant_id,node_id,installation_id,extension_id,state,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)`,
      [
        id,
        tenantId,
        nodeId,
        installationId,
        extensionId,
        state,
        tx.context.actor.reference,
      ],
    );
    return (await this.claim(tx, id))!;
  }
  async change(tx: Transaction, id: string, state: 'allocated' | 'released') {
    await tx.query(
      `UPDATE public.tenant_inventory_claims SET state=$2,version=version+1,updated_at=clock_timestamp(),updated_by=$3 WHERE id=$1`,
      [id, state, tx.context.actor.reference],
    );
    return (await this.claim(tx, id))!;
  }
  async receipt(tx: Transaction, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `tenant-allocation:${tx.context.actor.reference}:${requestId}`,
    ]);
    return (
      await tx.query<{
        fingerprint: string;
        result: { items: InventoryClaim[] };
        expired: boolean;
      }>(
        `SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.tenant_inventory_receipts WHERE operator_id=$1 AND request_id=$2`,
        [tx.context.actor.reference, requestId],
      )
    ).rows[0];
  }
  async saveReceipt(
    tx: Transaction,
    requestId: string,
    fingerprint: string,
    items: InventoryClaim[],
  ) {
    await tx.query(
      'INSERT INTO public.tenant_inventory_receipts(operator_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4)',
      [tx.context.actor.reference, requestId, fingerprint, { items }],
    );
  }
}
