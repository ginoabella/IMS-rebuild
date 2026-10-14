import { createHash, randomUUID } from 'node:crypto';
import type { PbxConflict, PbxNodeDto } from '@myims/contracts';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ExecutionContext } from '../../../infrastructure/execution/context';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import { uuid } from '../../identity/domain/storage';
import type { ApprovedPbxCatalog } from '../domain/connectivity';
import {
  desiredInput,
  listInput,
  invalid,
  type InvalidPbx,
  type DesiredPbx,
} from './pbx-input';
import type {
  PbxRegistry,
  PbxReceipts,
  PbxDesiredChangePort,
} from './pbx-ports';
export interface PbxTransactions {
  run<T>(
    context: ExecutionContext,
    action: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
}
export type PbxFailure =
  | InvalidPbx
  | { kind: 'denied' | 'unavailable' | 'missing' }
  | { kind: 'conflict'; reason: PbxConflict };
class Rejected extends Error {
  constructor(readonly outcome: PbxFailure) {
    super('PBX registry rejected');
  }
}
function canonical(input: DesiredPbx) {
  const p = input.profile;
  return [
    p.installationId,
    input.displayName,
    p.targetAlias,
    p.host,
    p.transport,
    p.port,
    p.tlsServerName,
    input.credentialAlias,
  ];
}
function connectivity(node: PbxNodeDto) {
  const p = node.management;
  return JSON.stringify([
    node.installationId,
    p.targetAlias,
    p.host,
    p.transport,
    p.port,
    p.tlsServerName,
    node.credentialAlias,
  ]);
}
export class PbxNodes {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly catalog: ApprovedPbxCatalog,
    private readonly registry: PbxRegistry,
    private readonly receipts: PbxReceipts,
    private readonly audit: AuditWrite,
    private readonly changes: PbxDesiredChangePort,
  ) {}
  private allowed(p: Principal) {
    return p.plane === 'platform' && p.grants.includes('platform_operator');
  }
  private async authorized(tx: Transaction, p: Principal) {
    if (!(await this.authority.validate(tx, p)))
      throw new Rejected({ kind: 'denied' });
  }
  private context(
    p: Principal,
    id: string,
    correlationId: string,
  ): ExecutionContext {
    return {
      actor: principalActor(p),
      target: { type: 'pbx-node', reference: id, tenantId: null },
      correlationId,
    };
  }
  private async changed(
    tx: Transaction,
    node: PbxNodeDto,
    change: 'created' | 'edited',
    connectivityChanged: boolean,
  ) {
    await this.audit.append(
      tx,
      {
        type: 'telephony.pbx.desired-changed',
        version: 1,
        fields: {
          version: { kind: 'integer', min: 1, max: 2147483647 },
          change: { kind: 'enum', values: ['created', 'edited'] },
          connectivityChanged: { kind: 'boolean' },
        },
      },
      { version: node.version, change, connectivityChanged },
    );
  }
  async create(
    p: Principal,
    input: unknown,
    correlationId: string,
  ): Promise<
    PbxFailure | { kind: 'created' | 'replayed'; value: { node: PbxNodeDto } }
  > {
    if (!this.allowed(p) || p.plane !== 'platform') return { kind: 'denied' };
    const parsed = desiredInput(input, this.catalog, false);
    if (parsed.kind !== 'valid') return parsed;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(canonical(parsed.value)))
      .digest('hex');
    try {
      const value = await this.transactions.run(
        this.context(p, randomUUID(), correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          const receipt = await this.receipts.inspect(
            tx,
            p.operatorId,
            parsed.requestId,
          );
          if (receipt) {
            if (receipt.expired)
              throw new Rejected({
                kind: 'conflict',
                reason: 'intent_expired',
              });
            if (receipt.fingerprint !== fingerprint)
              throw new Rejected({
                kind: 'conflict',
                reason: 'request_conflict',
              });
            return {
              kind: 'replayed' as const,
              value: { node: receipt.result },
            };
          }
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            [`pbx-target:${parsed.value.profile.installationId}`],
          );
          const node = await this.registry.create(
            tx,
            tx.context.target.reference,
            parsed.value,
          );
          if (!node)
            throw new Rejected({ kind: 'conflict', reason: 'target_conflict' });
          await this.changed(tx, node, 'created', true);
          await tx.required(() => this.changes.onCreate(tx, node));
          await this.receipts.save(tx, parsed.requestId, fingerprint, node);
          return { kind: 'created' as const, value: { node } };
        },
      );
      return value;
    } catch (error) {
      return error instanceof Rejected
        ? error.outcome
        : { kind: 'unavailable' };
    }
  }
  async edit(
    p: Principal,
    id: unknown,
    input: unknown,
    correlationId: string,
  ): Promise<PbxFailure | { kind: 'edited'; value: { node: PbxNodeDto } }> {
    if (!this.allowed(p)) return { kind: 'denied' };
    if (!uuid(id)) return invalid('nodeId');
    const parsed = desiredInput(input, this.catalog, true);
    if (parsed.kind !== 'valid') return parsed;
    try {
      const node = await this.transactions.run(
        this.context(p, id.toLowerCase(), correlationId),
        async (tx) => {
          await this.authorized(tx, p);
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            [`pbx-target:${parsed.value.profile.installationId}`],
          );
          const old = await this.registry.locked(tx, id);
          if (!old) throw new Rejected({ kind: 'missing' });
          if (old.version !== parsed.expectedVersion)
            throw new Rejected({ kind: 'conflict', reason: 'stale_version' });
          const profile = parsed.value.profile;
          const nextConnectivity = JSON.stringify([
            profile.installationId,
            profile.targetAlias,
            profile.host,
            profile.transport,
            profile.port,
            profile.tlsServerName,
            parsed.value.credentialAlias,
          ]);
          const connectivityChanged = connectivity(old) !== nextConnectivity;
          if (
            !connectivityChanged &&
            old.displayName === parsed.value.displayName
          )
            return old;
          const next = await this.registry.edit(tx, id, parsed.value);
          if (!next)
            throw new Rejected({ kind: 'conflict', reason: 'target_conflict' });
          await this.changed(tx, next, 'edited', connectivityChanged);
          await tx.required(() =>
            this.changes.onChange(tx, {
              nodeId: next.id,
              previousVersion: old.version,
              nextVersion: next.version,
              connectivityChanged,
            }),
          );
          return next;
        },
      );
      return { kind: 'edited', value: { node } };
    } catch (error) {
      return error instanceof Rejected
        ? error.outcome
        : { kind: 'unavailable' };
    }
  }
  async list(input: unknown) {
    const parsed = listInput(input);
    if (parsed.kind !== 'valid') return parsed;
    try {
      const rows = await this.database.read((s) =>
        this.registry.list(s, parsed.limit + 1, parsed.after),
      );
      const items = rows.slice(0, parsed.limit);
      return {
        kind: 'found' as const,
        value: {
          items,
          nextCursor:
            rows.length > parsed.limit
              ? (items[items.length - 1]?.id ?? null)
              : null,
        },
      };
    } catch {
      return { kind: 'unavailable' as const };
    }
  }
  async detail(id: unknown) {
    if (!uuid(id)) return invalid('nodeId');
    try {
      const node = await this.database.read((s) => this.registry.byId(s, id));
      return node
        ? { kind: 'found' as const, value: { node } }
        : { kind: 'missing' as const };
    } catch {
      return { kind: 'unavailable' as const };
    }
  }
}
