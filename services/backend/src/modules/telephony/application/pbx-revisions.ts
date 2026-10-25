import { createHash, randomUUID } from 'node:crypto';
import type { RevisionDetail, RevisionValidation } from '@myims/contracts';
import type {
  SnapshotDatabase,
  ReadSnapshot,
} from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { PbxTransactions } from './pbx-nodes';
import { id, object, PeerRejected, invalid } from '../domain/peer';
import { RoutingRejected } from '../domain/routing';
import {
  COMPILER_VERSION,
  POLICY_VERSION,
  canonical,
  entries,
} from '../domain/revision-snapshot';
import {
  compileRevision,
  reviewResources,
  semanticDiff,
} from '../domain/revision-compiler';
import { captureSnapshot } from '../adapters/db/revision-snapshot';
import {
  RevisionRepository,
  summary,
  type SavedRevision,
} from '../adapters/db/revision-repository';
import { PeerRepository } from '../adapters/db/peer-repository';
const digest = (v: unknown) =>
  createHash('sha256').update(canonical(v)).digest('hex');
type Result = { status: number; value: Record<string, unknown> };
export class PbxRevisions {
  private readonly store = new RevisionRepository();
  private readonly nodes = new PeerRepository();
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly audit: AuditWrite,
  ) {}
  private async handle(action: () => Promise<Result>): Promise<Result> {
    try {
      return await action();
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
            status === 503
              ? 'Service unavailable'
              : 'Revision request rejected',
          ...(e instanceof RoutingRejected ? { reason: e.reason } : {}),
          ...(e instanceof PeerRejected ? { fieldErrors: e.fieldErrors } : {}),
        },
      };
    }
  }
  private async saved(s: ReadSnapshot, node: string, revision: string) {
    const r = await this.store.detail(s, node, revision);
    if (!r) throw new PeerRejected(404);
    return r;
  }
  private async detail(
    s: ReadSnapshot,
    r: SavedRevision,
    baselineId: string | null | undefined,
  ): Promise<RevisionDetail> {
    const baseline = baselineId === undefined ? r.baselineId : baselineId;
    const b = baseline ? await this.saved(s, r.nodeId, baseline) : null;
    const current = await captureSnapshot(s, r.nodeId),
      sourceCurrent = digest(current) === r.sourceDigest;
    const compiled = compileRevision(r.snapshot),
      validation = await this.store.validation(s, r.id);
    return {
      revision: summary(r),
      resources: reviewResources(r.snapshot),
      diagnostics: compiled.diagnostics,
      sourceCurrent,
      validation: validation
        ? {
            ...validation,
            applicable:
              validation.applicable &&
              validation.evaluatedDigest === digest(current) &&
              r.compilerVersion === COMPILER_VERSION &&
              r.policyVersion === POLICY_VERSION,
          }
        : null,
      diff: semanticDiff(
        r.snapshot,
        b?.snapshot ?? null,
        b ? summary(b) : null,
      ),
    };
  }
  read(p: Principal, nodeInput: unknown, revisionInput: unknown, q: unknown) {
    return this.handle(async () => {
      const node = id(nodeInput, 'nodeId'),
        query = object(q, revisionInput ? ['baselineId'] : ['after', 'limit']);
      const revision = revisionInput ? id(revisionInput) : null;
      const baseline =
        query.baselineId === undefined
          ? undefined
          : id(query.baselineId, 'baselineId');
      const after = query.after === undefined ? 0 : Number(query.after),
        limit = query.limit === undefined ? 25 : Number(query.limit);
      if (
        !Number.isSafeInteger(after) ||
        after < 0 ||
        after > 2147483647 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        invalid('query');
      return this.database.read(async (s) => {
        if (!(await this.nodes.node(s, node))) throw new PeerRejected(404);
        if (p.plane !== 'platform') throw new PeerRejected(403);
        if (revision)
          return {
            status: 200,
            value: (await this.detail(
              s,
              await this.saved(s, node, revision),
              baseline,
            )) as unknown as Record<string, unknown>,
          };
        const rows = await this.store.list(s, node, after, limit + 1),
          items = rows.slice(0, limit);
        return {
          status: 200,
          value: {
            items,
            nextCursor:
              rows.length > limit ? String(items.at(-1)!.sequence) : null,
          },
        };
      });
    });
  }
  recover(p: Principal, nodeInput: unknown, requestInput: unknown, q: unknown) {
    return this.handle(async () => {
      object(q, []);
      if (p.plane !== 'platform') throw new PeerRejected(403);
      const node = id(nodeInput),
        requestId = id(requestInput);
      return this.database.read(async (s) => {
        const receipt = await this.store.receiptRead(
          s,
          principalActor(p).reference,
          requestId,
        );
        if (!receipt) throw new PeerRejected(404);
        return {
          status: 200,
          value: {
            revision: summary(await this.saved(s, node, receipt.revisionId)),
          },
        };
      });
    });
  }
  write(
    p: Principal,
    nodeInput: unknown,
    revisionInput: unknown,
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const node = id(nodeInput, 'nodeId'),
        revision = revisionInput ? id(revisionInput) : null;
      const data = object(input, revision ? [] : ['requestId', 'baselineId']);
      const requestId = revision ? null : id(data.requestId, 'requestId');
      const baseline =
        data.baselineId === undefined || data.baselineId === null
          ? null
          : id(data.baselineId, 'baselineId');
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: { type: 'pbx-revision', reference: node, tenantId: null },
          correlationId,
        },
        async (tx) => {
          if (
            p.plane !== 'platform' ||
            !p.grants.includes('platform_operator') ||
            !(await this.authority.validate(tx, p))
          )
            throw new PeerRejected(403);
          const fingerprint = digest([node, baseline]);
          if (requestId) {
            const receipt = await this.store.receipt(tx, requestId);
            if (receipt) {
              if (receipt.expired) throw new RoutingRejected('intent_expired');
              if (receipt.fingerprint !== fingerprint)
                throw new RoutingRejected('request_conflict');
              return {
                status: 200,
                value: {
                  revision: summary(
                    await this.saved(tx, node, receipt.revisionId),
                  ),
                },
              };
            }
          }
          // Canonical order: authority → scoped receipt → node → source facts.
          if (!(await this.nodes.node(tx, node, true)))
            throw new PeerRejected(404);
          if (revision)
            return this.validate(tx, await this.saved(tx, node, revision));
          if (baseline) await this.saved(tx, node, baseline);
          const snapshot = await captureSnapshot(tx, node),
            last = await this.store.latest(tx, node),
            revisionId = randomUUID();
          await tx.query(
            `INSERT INTO public.pbx_revisions(id,node_id,installation_id,sequence,parent_id,baseline_id,compiler_version,policy_version,snapshot,source_digest,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              revisionId,
              node,
              snapshot.node.installationId,
              (last?.sequence ?? 0) + 1,
              last?.id ?? null,
              baseline,
              COMPILER_VERSION,
              POLICY_VERSION,
              snapshot,
              digest(snapshot),
              principalActor(p).reference,
            ],
          );
          await this.event(tx, revisionId, node, 'capture');
          await tx.query(
            'INSERT INTO public.pbx_revision_receipts(operator_id,request_id,fingerprint,revision_id) VALUES($1,$2,$3,$4)',
            [principalActor(p).reference, requestId, fingerprint, revisionId],
          );
          return {
            status: 201,
            value: {
              revision: summary(await this.saved(tx, node, revisionId)),
            },
          };
        },
      );
    });
  }
  private async validate(tx: Transaction, r: SavedRevision): Promise<Result> {
    const current = await captureSnapshot(tx, r.nodeId),
      evaluatedDigest = digest(current),
      compiled = compileRevision(r.snapshot);
    const applicable =
      evaluatedDigest === r.sourceDigest &&
      r.compilerVersion === COMPILER_VERSION &&
      r.policyVersion === POLICY_VERSION;
    const result: RevisionValidation = {
      id: randomUUID(),
      revisionId: r.id,
      compilerVersion: COMPILER_VERSION,
      policyVersion: POLICY_VERSION,
      evaluatedDigest,
      evaluatedDependencies: entries(current).map((e) => ({
        kind: e.kind,
        id: e.value.id,
        version: e.value.version,
      })),
      createdBy: tx.context.actor.reference,
      createdAt: new Date().toISOString(),
      local: compiled.local,
      live: 'unavailable',
      applicable,
      diagnostics: [
        ...compiled.diagnostics,
        ...(!applicable
          ? [
              {
                code: 'stale_dependencies',
                resourceId: null,
                severity: 'error' as const,
              },
            ]
          : []),
      ],
    };
    await tx.query(
      `INSERT INTO public.pbx_revision_validations(id,revision_id,compiler_version,policy_version,evaluated_digest,result,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        result.id,
        r.id,
        COMPILER_VERSION,
        POLICY_VERSION,
        evaluatedDigest,
        result,
        result.createdBy,
      ],
    );
    await this.event(tx, r.id, r.nodeId, 'validate');
    return { status: 201, value: { validation: result } };
  }
  private event(
    tx: Transaction,
    revisionId: string,
    nodeId: string,
    operation: string,
  ) {
    return this.audit.append(
      tx,
      {
        type: 'telephony.revision.recorded',
        version: 1,
        fields: {
          revisionId: { kind: 'uuid' },
          nodeId: { kind: 'uuid' },
          operation: { kind: 'enum', values: ['capture', 'validate'] },
        },
      },
      { revisionId, nodeId, operation },
    );
  }
}
