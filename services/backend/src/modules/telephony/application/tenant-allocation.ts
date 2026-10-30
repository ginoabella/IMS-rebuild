import { createHash, randomUUID } from 'node:crypto';
import type { InventoryClaim } from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { PbxTransactions } from './pbx-nodes';
import type { AllocationTenancy } from './allocation-tenancy';
import { AllocationRepository } from '../adapters/db/allocation-repository';
import {
  AllocationRejected,
  selection,
  allocationItems,
} from '../domain/allocation';
import { PeerRejected, id, object, version, invalid } from '../domain/peer';
import { InventoryRejected } from '../domain/inventory';
type Result = { status: number; value: Record<string, unknown> };
export class TenantAllocation {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly tenancy: AllocationTenancy,
    private readonly store: AllocationRepository,
    private readonly audit: AuditWrite,
  ) {}
  private async handle(action: () => Promise<Result>): Promise<Result> {
    try {
      const result = await action();
      if (Buffer.byteLength(JSON.stringify(result.value)) > 65536)
        throw new Error('Bound exceeded');
      return result;
    } catch (e) {
      const status =
        e instanceof PeerRejected
          ? e.status
          : e instanceof AllocationRejected
            ? 409
            : e instanceof InventoryRejected
              ? 400
              : 503;
      return {
        status,
        value: {
          statusCode: status,
          message:
            status === 400
              ? 'Review the entered fields.'
              : status === 403
                ? 'Access denied'
                : status === 404
                  ? 'Resource not found.'
                  : status === 409
                    ? 'Allocation conflict'
                    : 'Service unavailable',
          ...(e instanceof PeerRejected ? { fieldErrors: e.fieldErrors } : {}),
          ...(e instanceof AllocationRejected
            ? { reason: e.reason, blockers: e.blockers }
            : {}),
        },
      };
    }
  }
  private context(p: Principal, tenantId: string, correlationId: string) {
    return {
      actor: principalActor(p),
      target: { type: 'tenant', reference: tenantId, tenantId: null },
      correlationId,
    };
  }
  private async authorized(tx: Transaction, p: Principal) {
    if (
      p.plane !== 'platform' ||
      !p.grants.includes('platform_operator') ||
      !(await this.authority.validate(tx, p))
    )
      throw new PeerRejected(403);
  }
  private async target(
    s: Parameters<AllocationTenancy['read']>[0],
    tenantId: string,
    nodeId: string,
    lock = false,
  ) {
    const tenant = await this.tenancy.read(s, tenantId, lock);
    if (!tenant) throw new PeerRejected(404);
    const node = await this.store.node(s, nodeId, lock);
    if (!node) throw new PeerRejected(404);
    return { tenant, node };
  }
  read(
    p: Principal,
    t: unknown,
    n: unknown,
    kind: 'claims' | 'stock',
    query: unknown,
    correlationId: string,
    claimInput: unknown = null,
  ) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        claimId = claimInput === null ? null : id(claimInput),
        q = object(
          query,
          claimId
            ? []
            : kind === 'claims'
              ? ['limit', 'after', 'history']
              : ['limit', 'after'],
        );
      const limit = q.limit === undefined ? 25 : Number(q.limit);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (q.limit !== undefined && !/^[1-9][0-9]{0,2}$/.test(String(q.limit)))
      )
        invalid('limit');
      const after = q.after === undefined ? null : id(q.after);
      if (q.history !== undefined && q.history !== 'true') invalid('history');
      // A locked read provides canonical authority, consistent blockers and the same
      // dependency snapshot used by release, including the actual runtime port.
      return this.transactions.run(
        this.context(p, tenantId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const { tenant } = await this.target(tx, tenantId, nodeId, true);
          if (kind === 'stock') {
            const rows = await this.store.stock(
              tx,
              nodeId,
              null,
              null,
              after,
              limit + 1,
            );
            const items = rows.slice(0, limit);
            while (
              items.length &&
              Buffer.byteLength(JSON.stringify(items)) > 58000
            )
              items.pop();
            return {
              status: 200,
              value: {
                items,
                nextCursor:
                  rows.length > items.length
                    ? (items.at(-1)?.id ?? null)
                    : null,
                tenant,
              },
            };
          }
          const selected = claimId ? await this.store.claim(tx, claimId) : null;
          if (
            claimId &&
            (!selected ||
              selected.tenantId !== tenantId ||
              selected.nodeId !== nodeId)
          )
            throw new PeerRejected(404);
          const rows = selected
            ? [selected]
            : await this.store.list(
                tx,
                tenantId,
                nodeId,
                after,
                limit + 1,
                q.history === 'true',
              );
          const items = [];
          for (const claim of rows.slice(0, limit)) {
            const stock = (
              await this.store.stock(tx, nodeId, [claim.extensionId], null)
            )[0]!;
            items.push({
              ...claim,
              stock,
              blockers:
                claim.state === 'released'
                  ? []
                  : await this.store.blockers(tx, nodeId, claim.extensionId),
            });
          }
          while (
            items.length &&
            Buffer.byteLength(JSON.stringify(items)) > 58000
          )
            items.pop();
          return {
            status: 200,
            value: {
              items,
              nextCursor:
                rows.length > items.length ? (items.at(-1)?.id ?? null) : null,
              capacity: await this.store.capacity(tx, tenantId, nodeId),
              tenant,
            },
          };
        },
      );
    });
  }
  preview(t: unknown, n: unknown, input: unknown) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        data = object(input, ['selection']),
        sel = selection(data.selection);
      return this.database.read(async (s) => {
        const { tenant } = await this.target(s, tenantId, nodeId);
        const stock = await this.store.stock(s, nodeId, sel.ids, sel.numbers);
        const items = sel.numbers
          ? sel.numbers.map((number) => {
              const e = stock.find((e) => e.number === number);
              return e ? { ...e, missing: false } : { number, missing: true };
            })
          : stock.map((e) => ({ ...e, missing: false }));
        // Missing UUID selections cannot be silently reduced to available stock.
        if (sel.ids && stock.length !== sel.ids.length)
          throw new AllocationRejected('selection_conflict');
        return {
          status: 200,
          value: {
            items,
            canSave:
              ['draft', 'active'].includes(tenant.status) &&
              items.every(
                (e) =>
                  !e.missing &&
                  'claim' in e &&
                  !e.claim &&
                  !e.credentialPending,
              ),
            tenant,
          },
        };
      });
    });
  }
  write(
    p: Principal,
    t: unknown,
    n: unknown,
    c: unknown,
    op: 'create' | 'promote' | 'release',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const tenantId = id(t),
        nodeId = id(n),
        claimId = op === 'create' ? null : id(c),
        data = object(input, [
          'requestId',
          'expectedTenantVersion',
          'expectedAuthorityVersion',
          ...(op === 'create' ? ['state', 'items'] : ['expectedVersion']),
        ]);
      const requestId = id(data.requestId),
        tenantVersion = version(data.expectedTenantVersion),
        authorityVersion = version(data.expectedAuthorityVersion);
      const expected = op === 'create' ? null : version(data.expectedVersion),
        items = op === 'create' ? allocationItems(data.items) : null;
      if (
        op === 'create' &&
        data.state !== 'reserved' &&
        data.state !== 'allocated'
      )
        invalid('state');
      const state = data.state === 'reserved' ? 'reserved' : 'allocated';
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            op,
            tenantId,
            nodeId,
            claimId,
            tenantVersion,
            authorityVersion,
            expected,
            op === 'create' ? state : null,
            items,
          ]),
        )
        .digest('hex');
      return this.transactions.run(
        this.context(p, tenantId, correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const receipt = await this.store.receipt(tx, requestId);
          if (receipt) {
            if (receipt.fingerprint !== fingerprint)
              throw new AllocationRejected('request_conflict');
            if (receipt.expired) throw new AllocationRejected('intent_expired');
            return {
              status: 200,
              value: { ...receipt.result, replayed: true },
            };
          }
          const { tenant, node } = await this.target(
            tx,
            tenantId,
            nodeId,
            true,
          );
          if (!['draft', 'active'].includes(tenant.status))
            throw new AllocationRejected('tenant_ineligible');
          if (
            tenant.version !== tenantVersion ||
            tenant.authorityVersion !== authorityVersion
          )
            throw new AllocationRejected('stale_version');
          const saved: InventoryClaim[] = [];
          if (items) {
            const stock = await this.store.stock(
              tx,
              nodeId,
              items.map((i) => i.extensionId),
              null,
              null,
              51,
              true,
            );
            if (
              stock.length !== items.length ||
              stock.some((e) => e.claim || e.credentialPending)
            )
              throw new AllocationRejected('selection_conflict');
            if (
              stock.some(
                (e) =>
                  items.find((i) => i.extensionId === e.id)!.expectedVersion !==
                  e.version,
              )
            )
              throw new AllocationRejected('stale_version');
            for (const e of stock) {
              const claim = await this.store.insert(
                tx,
                randomUUID(),
                tenantId,
                nodeId,
                node.installationId,
                e.id,
                state,
              );
              saved.push(claim);
              await this.event(tx, claim, null);
            }
          } else {
            const old = await this.store.claim(tx, claimId!);
            if (!old || old.tenantId !== tenantId || old.nodeId !== nodeId)
              throw new PeerRejected(404);
            await this.store.stock(
              tx,
              nodeId,
              [old.extensionId],
              null,
              null,
              1,
              true,
            );
            if (old.version !== expected)
              throw new AllocationRejected('stale_version');
            if (
              old.state === 'released' ||
              (op === 'promote' && old.state !== 'reserved')
            )
              throw new AllocationRejected('invalid_transition');
            if (op === 'release') {
              const blockers = await this.store.blockers(
                tx,
                nodeId,
                old.extensionId,
              );
              if (blockers.length)
                throw new AllocationRejected('referenced', blockers);
            }
            const claim = await this.store.change(
              tx,
              old.id,
              op === 'release' ? 'released' : 'allocated',
            );
            saved.push(claim);
            await this.event(tx, claim, old.state);
          }
          await this.store.saveReceipt(tx, requestId, fingerprint, saved);
          return {
            status: op === 'create' ? 201 : 200,
            value: { items: saved, replayed: false },
          };
        },
      );
    });
  }
  private async event(tx: Transaction, c: InventoryClaim, old: string | null) {
    await this.audit.append(
      tx,
      {
        type: 'telephony.allocation.changed',
        version: 1,
        fields: {
          claimId: { kind: 'uuid' },
          tenantId: { kind: 'uuid' },
          nodeId: { kind: 'uuid' },
          extensionId: { kind: 'uuid' },
          oldState: { kind: 'enum', values: ['none', 'reserved', 'allocated'] },
          state: {
            kind: 'enum',
            values: ['reserved', 'allocated', 'released'],
          },
          version: { kind: 'integer', min: 1, max: 2147483647 },
        },
      },
      {
        claimId: c.id,
        tenantId: c.tenantId,
        nodeId: c.nodeId,
        extensionId: c.extensionId,
        oldState: old ?? 'none',
        state: c.state,
        version: c.version,
      },
    );
  }
}
