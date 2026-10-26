import {
  RuntimeDependencies,
  RetainedRuntimeDependency,
} from './runtime-dependencies';
import { createHash, randomUUID } from 'node:crypto';
import type { PeerDto, PeerResource } from '@myims/contracts';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { PbxTransactions } from './pbx-nodes';
import { PeerRepository } from '../adapters/db/peer-repository';
import {
  PeerRejected,
  peerConnection,
  address,
  id,
  invalid,
  object,
  values,
  version,
} from '../domain/peer';
export type PeerResult = { status: number; value: Record<string, unknown> };
export class Peers {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly store: PeerRepository,
    private readonly audit: AuditWrite,
    private readonly reserved: (
      installationId: string,
    ) => readonly string[] = () => [],
  ) {}
  private async handle(action: () => Promise<PeerResult>): Promise<PeerResult> {
    try {
      return await action();
    } catch (e) {
      return e instanceof PeerRejected
        ? {
            status: e.status,
            value: {
              statusCode: e.status,
              message:
                e.status === 400
                  ? 'Invalid resource request'
                  : e.status === 404
                    ? 'Resource not found'
                    : e.status === 403
                      ? 'Access denied'
                      : 'Resource conflict',
              ...(e.reason ? { reason: e.reason } : {}),
              ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
              ...(e.blockers ? { blockers: e.blockers } : {}),
            },
          }
        : {
            status: 503,
            value: { statusCode: 503, message: 'Service unavailable' },
          };
    }
  }
  credentials(nodeInput: unknown, query: unknown) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const q = object(query, ['after']);
      const after = q.after === undefined ? null : String(q.after);
      if (
        after !== null &&
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:[1-9][0-9]{0,9}$/.test(
          after,
        )
      )
        invalid('after');
      if (after !== null && Number(after.split(':')[1]) > 2147483647)
        invalid('after');
      return this.database.read(async (s) => {
        const node = await this.store.node(s, nodeId);
        if (!node) throw new PeerRejected(404);
        const rows = await this.store.credentials(
          s,
          node.installationId,
          after,
          101,
        );
        const items = rows.slice(0, 100),
          last = items.at(-1);
        return {
          status: 200,
          value: {
            items,
            nextCursor:
              rows.length > 100 && last ? `${last.id}:${last.version}` : null,
          },
        };
      });
    });
  }
  read(
    kind: PeerResource,
    nodeInput: unknown,
    resourceInput: unknown,
    query: unknown,
  ) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId');
      const q = object(query, resourceInput === null ? ['limit', 'after'] : []);
      const limit = q.limit === undefined ? 25 : Number(q.limit);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (q.limit !== undefined && !/^[1-9][0-9]{0,2}$/.test(String(q.limit)))
      )
        invalid('limit');
      const after = q.after === undefined ? null : id(q.after, 'after');
      const resourceId = resourceInput === null ? null : id(resourceInput);
      return this.database.read(async (s) => {
        if (!(await this.store.node(s, nodeId))) throw new PeerRejected(404);
        if (resourceId) {
          const resource = await this.store.detail(s, kind, nodeId, resourceId);
          if (!resource) throw new PeerRejected(404);
          return { status: 200, value: { resource } };
        }
        const rows = await this.store.list(s, kind, nodeId, after, limit + 1),
          items = rows.slice(0, limit);
        // Keep the existing 64 KiB browser/API boundary even for 32-address gateways.
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
  write(
    p: Principal,
    kind: PeerResource,
    nodeInput: unknown,
    resourceInput: unknown,
    operation: 'create' | 'edit' | 'status' | 'remove',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const nodeId = id(nodeInput, 'nodeId'),
        resourceId = operation === 'create' ? randomUUID() : id(resourceInput);
      const fields =
        kind === 'trunks'
          ? ['name', 'direction', 'settings']
          : kind === 'gateways'
            ? ['name', 'kind', 'trunkId', 'sourceAddresses']
            : ['name', 'number', 'gatewayId'];
      const data = object(
        input,
        operation === 'create'
          ? ['requestId', ...fields]
          : operation === 'edit'
            ? ['expectedVersion', ...fields]
            : [
                'expectedVersion',
                ...(operation === 'status' ? ['enabled'] : []),
              ],
      );
      const requestId =
        operation === 'create' ? id(data.requestId, 'requestId') : null;
      const expected =
        operation === 'create' ? null : version(data.expectedVersion);
      const v =
        operation === 'create' || operation === 'edit'
          ? values(kind, data)
          : null;
      if (operation === 'status' && typeof data.enabled !== 'boolean')
        invalid('enabled');
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: { type: 'sip-peer', reference: nodeId, tenantId: null },
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
            .update(JSON.stringify([kind, nodeId, v]))
            .digest('hex');
          if (requestId) {
            const receipt = await this.store.receipt(tx, requestId);
            if (receipt) {
              if (receipt.expired)
                throw new PeerRejected(409, 'intent_expired');
              if (receipt.fingerprint !== fingerprint)
                throw new PeerRejected(409, 'request_conflict');
              return { status: 200, value: receipt.result };
            }
          }
          const node = await this.store.node(tx, nodeId, true);
          if (!node) throw new PeerRejected(404);
          const old =
            operation === 'create'
              ? null
              : await this.store.detail(tx, kind, nodeId, resourceId);
          if (operation !== 'create' && (!old || old.removedAt))
            throw new PeerRejected(404);
          if (old && old.version !== expected)
            throw new PeerRejected(409, 'stale_version');
          if (
            operation === 'status' &&
            data.enabled === true &&
            old &&
            'settings' in old
          ) {
            await this.store.validate(
              tx,
              kind,
              nodeId,
              node.installationId,
              resourceId,
              values(kind, old as unknown as Record<string, unknown>),
            );
          }
          if (v) {
            await this.store.validate(
              tx,
              kind,
              nodeId,
              node.installationId,
              resourceId,
              v,
            );
            if ('sourceAddresses' in v) {
              const reserved = this.reserved(node.installationId).map(address);
              if (v.sourceAddresses.some((a) => reserved.includes(a)))
                throw new PeerRejected(409, 'reserved_source');
            }
          }
          if (
            old &&
            'settings' in old &&
            (operation === 'remove' ||
              (v &&
                'settings' in v &&
                (v.direction === 'inbound' ||
                  peerConnection(old.settings) !== peerConnection(v.settings))))
          ) {
            const blockers = await this.store.outboundBlockers(tx, old.id);
            if (blockers.length)
              throw new PeerRejected(409, 'referenced', undefined, blockers);
          }
          if (old) {
            const prior = values(
              kind,
              old as unknown as Record<string, unknown>,
            );
            const structural =
              operation === 'remove' ||
              (v &&
                ('settings' in v && 'settings' in prior
                  ? peerConnection(prior.settings) !==
                      peerConnection(v.settings) ||
                    (prior.direction !== v.direction &&
                      v.direction === 'outbound')
                  : 'number' in v && 'number' in prior
                    ? prior.number !== v.number ||
                      prior.gatewayId !== v.gatewayId
                    : 'kind' in v &&
                      'kind' in prior &&
                      (prior.kind !== v.kind ||
                        prior.trunkId !== v.trunkId ||
                        JSON.stringify(prior.sourceAddresses) !==
                          JSON.stringify(v.sourceAddresses))));
            if (
              structural ||
              (v &&
                'direction' in v &&
                'direction' in prior &&
                v.direction !== prior.direction)
            ) {
              try {
                await new RuntimeDependencies().assertUnreferenced(
                  tx,
                  nodeId,
                  kind,
                  old.id,
                );
              } catch (e) {
                if (e instanceof RetainedRuntimeDependency)
                  throw new PeerRejected(409, 'referenced', undefined, [
                    { id: old.id, name: 'Retained live or recovery revision' },
                  ]);
                throw e;
              }
            }
            if (structural) {
              const providerOnly =
                operation !== 'remove' &&
                v &&
                'settings' in v &&
                'settings' in prior &&
                v.direction === 'outbound' &&
                peerConnection(prior.settings) === peerConnection(v.settings);
              const blockers = await this.store.blockers(
                tx,
                kind,
                old.id,
                !!providerOnly,
              );
              if (blockers.length)
                throw new PeerRejected(409, 'referenced', undefined, blockers);
            }
            const same = v
              ? JSON.stringify(prior) === JSON.stringify(v)
              : operation === 'status' && old.enabled === data.enabled;
            if (same) return { status: 200, value: { resource: old } };
          }
          const resource = old
            ? await this.store.edit(
                tx,
                kind,
                old,
                v,
                operation === 'status' ? data.enabled === true : old.enabled,
                operation === 'remove',
              )
            : await this.store.create(
                tx,
                kind,
                nodeId,
                node.installationId,
                resourceId,
                v!,
              );
          await this.event(tx, kind, operation, resource);
          const result = { resource };
          if (requestId)
            await this.store.saveReceipt(tx, requestId, fingerprint, result);
          return { status: operation === 'create' ? 201 : 200, value: result };
        },
      );
    });
  }
  private async event(
    tx: Transaction,
    kind: PeerResource,
    operation: string,
    r: PeerDto,
  ) {
    await this.audit.append(
      tx,
      {
        type: 'telephony.sip-peer.desired-changed',
        version: 1,
        fields: {
          enabled: { kind: 'boolean' },
          resourceId: { kind: 'uuid' },
          nodeId: { kind: 'uuid' },
          resourceKind: {
            kind: 'enum',
            values: ['trunks', 'gateways', 'dids'],
          },
          operation: {
            kind: 'enum',
            values: ['create', 'edit', 'status', 'remove'],
          },
          version: { kind: 'integer', min: 1, max: 2147483647 },
        },
      },
      {
        enabled: r.enabled,
        resourceId: r.id,
        nodeId: r.nodeId,
        resourceKind: kind,
        operation,
        version: r.version,
      },
    );
  }
}
