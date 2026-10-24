import { previewOutbound } from '../adapters/db/outbound-repository';
import { createHash, randomUUID } from 'node:crypto';
import type { RoutingKind, RoutingDto } from '@myims/contracts';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { PbxTransactions } from './pbx-nodes';
import { RoutingRepository } from '../adapters/db/routing-repository';
import {
  RoutingRejected,
  routingValues,
  groupValues,
  object,
  id,
  invalid,
  version,
} from '../domain/routing';
import { PeerRejected } from '../domain/peer';
import { previewInbound } from '../adapters/db/inbound-repository';
type Result = { status: number; value: Record<string, unknown> };
export class Routing {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly store: RoutingRepository,
    private readonly audit: AuditWrite,
  ) {}
  private async handle(action: () => Promise<Result>): Promise<Result> {
    try {
      const r = await action();
      if (Buffer.byteLength(JSON.stringify(r.value)) > 65536)
        throw new Error('Bound exceeded');
      return r;
    } catch (e) {
      const status =
        e instanceof PeerRejected
          ? e.status
          : e instanceof RoutingRejected
            ? 409
            : 503;
      return {
        status,
        value: {
          statusCode: status,
          message:
            status === 400
              ? 'Review the entered fields.'
              : status === 404
                ? 'Resource not found.'
                : status === 403
                  ? 'Access denied'
                  : status === 409
                    ? 'Resource conflict'
                    : 'Service unavailable',
          ...(e instanceof PeerRejected ? { fieldErrors: e.fieldErrors } : {}),
          ...(e instanceof RoutingRejected
            ? { reason: e.reason, blockers: e.blockers }
            : {}),
        },
      };
    }
  }
  read(
    k: RoutingKind,
    nodeInput: unknown,
    resourceInput: unknown,
    query: unknown,
  ) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        resourceId = resourceInput === null ? null : id(resourceInput);
      const q = object(query, resourceId ? [] : ['limit', 'after']);
      const limit = q.limit === undefined ? 25 : Number(q.limit);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (q.limit !== undefined && !/^[1-9][0-9]{0,2}$/.test(String(q.limit)))
      )
        invalid('limit');
      const after = q.after === undefined ? null : id(q.after, 'after');
      return this.database.read(async (s) => {
        if (!(await this.store.node(s, nodeId))) throw new PeerRejected(404);
        if (resourceId) {
          const resource = await this.store.detail(s, k, nodeId, resourceId);
          if (!resource) throw new PeerRejected(404);
          return { status: 200, value: { resource } };
        }
        const rows = await this.store.list(s, k, nodeId, after, limit + 1),
          items = rows.slice(0, limit);
        while (items.length && Buffer.byteLength(JSON.stringify(items)) > 60000)
          items.pop();
        return {
          status: 200,
          value: {
            items,
            nextCursor:
              rows.length > items.length ? (items.at(-1)?.id ?? null) : null,
          },
        };
      });
    });
  }
  outboundPreview(nodeInput: unknown, input: unknown) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const data = object(input, ['dialled']);
      if (
        typeof data.dialled !== 'string' ||
        data.dialled.length < 1 ||
        data.dialled.length > 15 ||
        /[^0-9]/.test(data.dialled)
      )
        invalid('dialled', 'Use 1–15 ASCII digits.');
      const dialled = data.dialled;
      return this.database.read(async (s) => {
        if (!(await this.store.node(s, nodeId))) throw new PeerRejected(404);
        return {
          status: 200,
          value: { ...(await previewOutbound(s, this.store, nodeId, dialled)) },
        };
      });
    });
  }
  inboundPreview(nodeInput: unknown, input: unknown) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const data = object(input, ['gatewayId', 'dialled']);
      const gatewayId = id(data.gatewayId, 'gatewayId');
      if (
        typeof data.dialled !== 'string' ||
        !/^\+?[0-9]{1,15}$/.test(data.dialled)
      )
        invalid(
          'dialled',
          'Use the exact canonical number, including leading zeros and +.',
        );
      const dialled = data.dialled;
      return this.database.read(async (s) => {
        if (!(await this.store.node(s, nodeId))) throw new PeerRejected(404);
        return {
          status: 200,
          value: {
            ...(await previewInbound(
              s,
              this.store,
              nodeId,
              gatewayId,
              dialled,
            )),
          },
        };
      });
    });
  }
  preview(nodeInput: unknown, input: unknown) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const data = object(input, [
        'resourceId',
        'name',
        'number',
        'memberIds',
        'strategy',
        'timeout',
        'fallback',
      ]);
      const resourceId =
        data.resourceId === undefined
          ? randomUUID()
          : id(data.resourceId, 'resourceId');
      const v = groupValues(data);
      return this.database.read(async (s) => {
        const node = await this.store.node(s, nodeId);
        if (!node) throw new PeerRejected(404);
        await this.store.validate(
          s,
          'groups',
          nodeId,
          node.installationId,
          resourceId,
          v,
        );
        return {
          status: 200,
          value: await this.store.preview(s, nodeId, v, resourceId),
        };
      });
    });
  }
  write(
    p: Principal,
    k: RoutingKind,
    nodeInput: unknown,
    resourceInput: unknown,
    op: 'create' | 'edit' | 'status' | 'remove',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        resourceId = op === 'create' ? randomUUID() : id(resourceInput);
      if (k === 'reservations' && op === 'status') throw new PeerRejected(404);
      const fields =
        k === 'outbound'
          ? [
              'name',
              'pattern',
              'priority',
              'trunkId',
              'stripCount',
              'addPrefix',
            ]
          : k === 'inbound'
            ? ['name', 'gatewayId', 'didId', 'destination']
            : k === 'groups'
              ? [
                  'name',
                  'number',
                  'memberIds',
                  'strategy',
                  'timeout',
                  'fallback',
                ]
              : ['name', 'purpose', 'pattern'];
      const data = object(
        input,
        op === 'create'
          ? ['requestId', ...fields]
          : op === 'edit'
            ? ['expectedVersion', ...fields]
            : ['expectedVersion', ...(op === 'status' ? ['enabled'] : [])],
      );
      const requestId =
          op === 'create' ? id(data.requestId, 'requestId') : null,
        expected = op === 'create' ? null : version(data.expectedVersion);
      const v =
        op === 'create' || op === 'edit' ? routingValues(k, data) : null;
      if (op === 'status' && typeof data.enabled !== 'boolean')
        invalid('enabled');
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: { type: 'pbx-routing', reference: nodeId, tenantId: null },
          correlationId,
        },
        async (tx) => {
          if (
            p.plane !== 'platform' ||
            !p.grants.includes('platform_operator') ||
            !(await this.authority.validate(tx, p))
          )
            throw new PeerRejected(403);
          const fingerprint = createHash('sha256')
            .update(JSON.stringify([k, nodeId, v]))
            .digest('hex');
          if (requestId) {
            const receipt = await this.store.receipt(tx, requestId);
            if (receipt) {
              if (receipt.expired) throw new RoutingRejected('intent_expired');
              if (receipt.fingerprint !== fingerprint)
                throw new RoutingRejected('request_conflict');
              return { status: 200, value: receipt.result };
            }
          }
          // Lock order: authority → request receipt → canonical node → references/claims.
          // Inventory's existing FOR SHARE is compatible with other inventory writers,
          // but excludes this FOR UPDATE before either side checks number claims.
          const node = await this.store.node(tx, nodeId, true);
          if (!node) throw new PeerRejected(404);
          const old =
            op === 'create'
              ? null
              : await this.store.detail(tx, k, nodeId, resourceId);
          if (op !== 'create' && (!old || old.removedAt))
            throw new PeerRejected(404);
          if (old && old.version !== expected)
            throw new RoutingRejected('stale_version');
          if (v)
            await this.store.validate(
              tx,
              k,
              nodeId,
              node.installationId,
              resourceId,
              v,
            );
          if (
            op === 'status' &&
            old &&
            ('memberIds' in old || 'destination' in old || 'trunkId' in old)
          )
            await this.store.validate(
              tx,
              k,
              nodeId,
              node.installationId,
              resourceId,
              old,
            );
          if (op === 'remove' && k === 'groups') {
            const blockers = await this.store.blockers(tx, nodeId, resourceId);
            if (blockers.length)
              throw new RoutingRejected('referenced', blockers);
          }
          if (
            old &&
            ((v &&
              JSON.stringify(
                routingValues(k, old as unknown as Record<string, unknown>),
              ) === JSON.stringify(v)) ||
              (op === 'status' &&
                'enabled' in old &&
                old.enabled === data.enabled))
          )
            return { status: 200, value: { resource: old } };
          const resource = await this.store.save(
            tx,
            k,
            nodeId,
            node.installationId,
            resourceId,
            v,
            old,
            op === 'status'
              ? data.enabled === true
              : !!(old && 'enabled' in old && old.enabled),
            op === 'remove',
          );
          await this.event(tx, k, op, resource);
          const result = { resource };
          if (requestId)
            await this.store.saveReceipt(tx, requestId, fingerprint, result);
          return { status: op === 'create' ? 201 : 200, value: result };
        },
      );
    });
  }
  private async event(
    tx: Transaction,
    k: RoutingKind,
    operation: string,
    r: RoutingDto,
  ) {
    await this.audit.append(
      tx,
      {
        type: 'telephony.routing.desired-changed',
        version: 1,
        fields: {
          resourceId: { kind: 'uuid' },
          nodeId: { kind: 'uuid' },
          resourceKind: {
            kind: 'enum',
            values: ['groups', 'reservations', 'inbound', 'outbound'],
          },
          operation: {
            kind: 'enum',
            values: ['create', 'edit', 'status', 'remove'],
          },
          version: { kind: 'integer', min: 1, max: 2147483647 },
        },
      },
      {
        resourceId: r.id,
        nodeId: r.nodeId,
        resourceKind: k,
        operation,
        version: r.version,
      },
    );
  }
}
