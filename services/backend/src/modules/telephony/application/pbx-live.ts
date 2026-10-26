import { createHash, randomUUID } from 'node:crypto';
import type { PbxTransactions } from './pbx-nodes';
import type { SnapshotDatabase } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox-repository';
import { PeerRepository } from '../adapters/db/peer-repository';
import { RevisionRepository } from '../adapters/db/revision-repository';
import { captureSnapshot } from '../adapters/db/revision-snapshot';
import {
  canonical,
  entries,
  COMPILER_VERSION,
  POLICY_VERSION,
} from '../domain/revision-snapshot';
import { compileRevision } from '../domain/revision-compiler';
import { id, object, PeerRejected } from '../domain/peer';
export const liveWorkContract = {
  type: 'telephony.revision.apply',
  version: 1,
  fields: { operationId: { kind: 'uuid' as const } },
};
export const liveAuditContract = {
  type: 'telephony.revision.live',
  version: 1,
  fields: {
    operationId: { kind: 'uuid' as const },
    nodeId: { kind: 'uuid' as const },
    action: {
      kind: 'enum' as const,
      values: [
        'apply',
        'recover',
        'reconcile',
        'baseline',
        'release',
        'queued',
        'waiting',
        'validating',
        'installing',
        'reloading',
        'verifying',
        'recovering',
        'verified',
        'recovered',
        'validation_failed',
        'revoked',
        'failed',
        'unknown',
      ],
    },
  },
};
const digest = (v: unknown) =>
  createHash('sha256').update(canonical(v)).digest('hex');
class LiveRejected extends Error {
  constructor(readonly reason: string) {
    super('Live revision request rejected');
  }
}
const projection = `o.id,o.node_id AS "nodeId",o.sequence,o.kind,o.revision_id AS "revisionId",o.expected_baseline_id AS "expectedBaselineId",o.target_id AS "targetId",o.operator_id AS "createdBy",o.created_at AS "createdAt",p.state,p.validation,p.installation,p.verification,p.recovery,p.failure,p.updated_at AS "updatedAt"`;
export class PbxLive {
  private readonly nodes = new PeerRepository();
  private readonly revisions = new RevisionRepository();
  private readonly outbox = new OutboxRepository();
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly audit: AuditWrite,
  ) {}
  private async handle(
    action: () => Promise<{ status: number; value: Record<string, unknown> }>,
  ) {
    try {
      return await action();
    } catch (e) {
      const status =
        e instanceof PeerRejected
          ? e.status
          : e instanceof LiveRejected
            ? 409
            : 503;
      return {
        status,
        value: {
          statusCode: status,
          message:
            status === 503
              ? 'Service unavailable'
              : 'Live revision request rejected',
          ...(e instanceof LiveRejected ? { reason: e.reason } : {}),
        },
      };
    }
  }
  read(
    p: Principal,
    nodeInput: unknown,
    operationInput: unknown,
    requestInput: unknown,
    q: unknown,
  ) {
    return this.handle(async () => {
      object(q, []);
      if (p.plane !== 'platform') throw new PeerRejected(403);
      const node = id(nodeInput),
        operation = operationInput ? id(operationInput) : null,
        request = requestInput ? id(requestInput) : null;
      return this.database.read(async (s) => {
        if (!(await this.nodes.node(s, node))) throw new PeerRejected(404);
        if (operation || request) {
          const r = await s.query(
            `SELECT ${projection} FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.node_id=$1 AND ${operation ? 'o.id=$2' : 'o.request_id=$2 AND o.operator_id=$3'}`,
            [
              node,
              operation ?? request,
              ...(request ? [principalActor(p).reference] : []),
            ],
          );
          if (!r.rows[0]) throw new PeerRejected(404);
          return { status: 200, value: { operation: r.rows[0] } };
        }
        const runtime = (
          await s.query(
            `SELECT node_id AS "nodeId",runtime_state AS runtime,installed_id AS "installedId",verified_id AS "verifiedId",known_good_id AS "knownGoodId",active_operation_id AS "activeOperationId",baseline_verified_at AS "baselineVerifiedAt",(executor_seen_at>clock_timestamp()-interval '15 seconds') AS "executorAvailable",updated_at AS "updatedAt" FROM public.pbx_live_runtime WHERE node_id=$1`,
            [node],
          )
        ).rows[0];
        const artifacts = (
          await s.query(
            `SELECT id,revision_id AS "revisionId",initial_baseline AS "initialBaseline",verified_at AS "verifiedAt" FROM public.pbx_live_artifacts WHERE node_id=$1 ORDER BY verified_at DESC LIMIT 100`,
            [node],
          )
        ).rows;
        const operations = (
          await s.query(
            `SELECT ${projection} FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.node_id=$1 ORDER BY o.sequence DESC LIMIT 25`,
            [node],
          )
        ).rows;
        return {
          status: 200,
          value: {
            ...(runtime
              ? Object.fromEntries(
                  Object.entries(runtime).filter(
                    ([key]) => key !== 'executorAvailable',
                  ),
                )
              : {
                  nodeId: node,
                  runtime: 'unavailable',
                  installedId: null,
                  verifiedId: null,
                  knownGoodId: null,
                  activeOperationId: null,
                  baselineVerifiedAt: null,
                  updatedAt: null,
                }),
            available:
              !!runtime?.baselineVerifiedAt &&
              runtime.executorAvailable === true,
            artifacts,
            operations,
          },
        };
      });
    });
  }
  accept(
    p: Principal,
    nodeInput: unknown,
    kind: 'apply' | 'recover' | 'reconcile',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const node = id(nodeInput),
        data = object(input, [
          'requestId',
          'revisionId',
          'expectedBaselineId',
          'targetId',
        ]),
        request = id(data.requestId),
        baseline = id(data.expectedBaselineId),
        target = id(kind === 'apply' ? data.revisionId : data.targetId);
      if (
        (kind === 'apply' && data.targetId !== undefined) ||
        (kind !== 'apply' && data.revisionId !== undefined)
      )
        throw new PeerRejected(400);
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: {
            type: 'pbx-live-operation',
            reference: node,
            tenantId: null,
          },
          correlationId,
        },
        async (tx) => {
          if (
            p.plane !== 'platform' ||
            !p.grants.includes('platform_operator') ||
            !(await this.authority.validate(tx, p))
          )
            throw new PeerRejected(403);
          await tx.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            [`pbx-live:${p.operatorId}:${request}`],
          );
          const fingerprint = digest([node, kind, baseline, target]);
          const old = (
            await tx.query<{
              id: string;
              fingerprint: string;
              node_id: string;
            }>(
              'SELECT id,fingerprint,node_id FROM public.pbx_live_operations WHERE operator_id=$1 AND request_id=$2',
              [p.operatorId, request],
            )
          ).rows[0];
          if (old) {
            if (old.fingerprint !== fingerprint || old.node_id !== node)
              throw new LiveRejected('request_conflict');
            return {
              status: 200,
              value: { operation: await this.operation(tx, old.id) },
            };
          }
          const n = await this.nodes.node(tx, node, true);
          if (!n) throw new PeerRejected(404);
          const runtime = (
            await tx.query<{
              verified_id: string;
              known_good_id: string;
              active_operation_id: string | null;
              runtime_state: string;
              baseline_verified_at: Date | null;
            }>(
              'SELECT verified_id,known_good_id,active_operation_id,runtime_state,baseline_verified_at FROM public.pbx_live_runtime WHERE node_id=$1 FOR UPDATE',
              [node],
            )
          ).rows[0];
          if (!runtime?.baseline_verified_at)
            throw new LiveRejected('verified_baseline_required');
          if (runtime.active_operation_id && kind !== 'reconcile')
            throw new LiveRejected('operation_unresolved');
          if (
            kind !== 'reconcile' &&
            (runtime.runtime_state !== 'verified' ||
              runtime.verified_id !== baseline)
          )
            throw new LiveRejected('stale_baseline');
          if (
            kind === 'reconcile' &&
            (!runtime.active_operation_id ||
              baseline !== runtime.known_good_id ||
              target !== runtime.known_good_id)
          )
            throw new LiveRejected('reconciliation_target_required');
          if (kind === 'reconcile') {
            const predecessor = (
              await tx.query<{ kind: string; state: string }>(
                'SELECT o.kind,p.state FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.id=$1 AND o.node_id=$2',
                [runtime.active_operation_id, node],
              )
            ).rows[0];
            if (
              !predecessor ||
              !['unknown', 'failed'].includes(predecessor.state)
            )
              throw new LiveRejected('operation_unresolved');
          }
          let revision = null;
          if (kind === 'apply') {
            revision = await this.revisions.detail(tx, node, target);
            if (!revision) throw new PeerRejected(404);
            const current = await captureSnapshot(tx, node),
              validation = await this.revisions.validation(tx, target);
            if (
              revision.compilerVersion !== COMPILER_VERSION ||
              revision.policyVersion !== POLICY_VERSION ||
              digest(current) !== revision.sourceDigest ||
              !validation ||
              !validation.applicable ||
              validation.evaluatedDigest !== revision.sourceDigest ||
              validation.local !== 'passed' ||
              compileRevision(revision.snapshot).local !== 'passed'
            )
              throw new LiveRejected('stale_review');
          } else {
            const approved = await tx.query(
              'SELECT 1 FROM public.pbx_live_artifacts WHERE id=$1 AND node_id=$2',
              [target, node],
            );
            if (!approved.rows.length)
              throw new LiveRejected('known_good_target_required');
          }
          const operationId = randomUUID(),
            sequence = (
              await tx.query<{ next: number }>(
                'SELECT COALESCE(max(sequence),0)+1 AS next FROM public.pbx_live_operations WHERE node_id=$1',
                [node],
              )
            ).rows[0]!.next;
          await tx.query(
            'INSERT INTO public.pbx_live_operations(id,node_id,installation_id,sequence,kind,revision_id,expected_baseline_id,target_id,operator_id,authentication_version,request_id,fingerprint,correlation_id,predecessor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
            [
              operationId,
              node,
              n.installationId,
              sequence,
              kind,
              revision?.id ?? null,
              baseline,
              target,
              p.operatorId,
              p.authenticationVersion,
              request,
              fingerprint,
              correlationId,
              kind === 'reconcile' ? runtime.active_operation_id : null,
            ],
          );
          await tx.query(
            'INSERT INTO public.pbx_live_progress(operation_id,node_id) VALUES($1,$2)',
            [operationId, node],
          );
          if (revision)
            for (const entry of entries(revision.snapshot))
              await tx.query(
                'INSERT INTO public.pbx_live_pins(revision_id,node_id,kind,resource_id,version,material_kind,material_version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(revision_id,kind,resource_id,version) DO UPDATE SET released_at=NULL,release_operation_id=NULL',
                [
                  revision.id,
                  node,
                  entry.kind,
                  entry.value.id,
                  entry.value.version,
                  entry.kind === 'credentials'
                    ? 'purpose' in entry.value &&
                      entry.value.purpose === 'endpoint'
                      ? 'endpoint'
                      : 'trunk'
                    : null,
                  entry.kind === 'credentials'
                    ? 'purpose' in entry.value &&
                      entry.value.purpose === 'endpoint'
                      ? 1
                      : entry.value.version
                    : null,
                ],
              );
          await tx.query(
            'UPDATE public.pbx_live_runtime SET active_operation_id=$2,updated_at=clock_timestamp() WHERE node_id=$1',
            [node, operationId],
          );
          await this.audit.append(tx, liveAuditContract, {
            operationId,
            nodeId: node,
            action: kind,
          });
          await this.outbox.insert(tx, liveWorkContract, operationId, {
            operationId,
          });
          return {
            status: 202,
            value: { operation: await this.operation(tx, operationId) },
          };
        },
      );
    });
  }
  private async operation(tx: Transaction, operationId: string) {
    return (
      await tx.query(
        `SELECT ${projection} FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.id=$1`,
        [operationId],
      )
    ).rows[0]!;
  }
}
