import { createHash, randomUUID } from 'node:crypto';
import type {
  ReadSnapshot,
  SnapshotDatabase,
} from '../../../infrastructure/database/read-snapshot';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { AuditWrite } from '../../audit/application/audit-write';
import type { PbxTransactions } from './pbx-nodes';
import { PeerRepository } from '../adapters/db/peer-repository';
import { canonical } from '../domain/revision-snapshot';
import { id, object, PeerRejected } from '../domain/peer';
import { RoutingRejected } from '../domain/routing';
export const retirementAudit = {
  type: 'telephony.artifact.retirement',
  version: 1,
  fields: {
    operationId: { kind: 'uuid' as const },
    artifactId: { kind: 'uuid' as const },
    nodeId: { kind: 'uuid' as const },
    action: {
      kind: 'enum' as const,
      values: ['request', 'retired', 'rejected', 'unknown'],
    },
  },
};
/** Safe SQL facts only; native still proves actual quiet state and required recovery bytes. */
export async function retirementEligible(
  s: ReadSnapshot,
  nodeId: string,
  artifactId: string,
  replacementId: string,
  resourceId: string,
) {
  return (
    (
      await s.query(
        `SELECT a.id FROM public.pbx_live_artifacts a JOIN public.pbx_live_runtime r ON r.node_id=a.node_id WHERE a.id=$2 AND a.node_id=$1 AND NOT a.initial_baseline AND a.id<>$3 AND r.installed_id=$3 AND r.verified_id=$3 AND r.known_good_id=$3 AND r.runtime_state='verified' AND r.active_operation_id IS NULL AND r.active_profile_operation_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements x WHERE x.artifact_id=a.id)
     AND EXISTS(SELECT 1 FROM public.pbx_live_pins p WHERE p.revision_id=a.revision_id AND p.kind='extensions' AND p.resource_id=$4 AND p.released_at IS NULL)
     AND NOT EXISTS(SELECT 1 FROM public.pbx_live_artifacts b JOIN public.pbx_live_pins p ON p.revision_id=b.revision_id WHERE b.id=$3 AND p.kind='extensions' AND p.resource_id=$4 AND p.released_at IS NULL)
     AND NOT EXISTS(SELECT 1 FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE o.node_id=$1 AND (o.target_id=a.id OR o.expected_baseline_id=a.id) AND p.state NOT IN ('verified','recovered','validation_failed','revoked') AND p.recovery<>'passed')
     AND NOT EXISTS(SELECT 1 FROM public.tenant_route_test_progress t WHERE t.node_id=$1 AND t.state IN ('queued','dispatching','admitted','unknown'))`,
        [nodeId, artifactId, replacementId, resourceId],
      )
    ).rows.length === 1
  );
}
export class ArtifactRetirement {
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
          : e instanceof RoutingRejected
            ? 409
            : 503;
      return {
        status,
        value: {
          statusCode: status,
          message: 'Artifact retirement unavailable',
          ...(e instanceof RoutingRejected ? { reason: e.reason } : {}),
        },
      };
    }
  }
  read(p: Principal, nodeInput: unknown, q: unknown) {
    return this.handle(async () => {
      const nodeId = id(nodeInput);
      object(q, []);
      if (p.plane !== 'platform' || !p.grants.includes('platform_operator'))
        throw new PeerRejected(403);
      return this.database.read(async (s) => {
        if (!(await new PeerRepository().node(s, nodeId)))
          throw new PeerRejected(404);
        const items = (
          await s.query(
            `SELECT i.id,i.artifact_id AS "artifactId",i.replacement_id AS "replacementId",i.resource_id AS "resourceId",i.operator_id AS "createdBy",i.created_at AS "createdAt",p.state,p.updated_at AS "updatedAt" FROM public.pbx_artifact_retirement_intents i JOIN public.pbx_artifact_retirement_progress p ON p.intent_id=i.id WHERE i.node_id=$1 ORDER BY i.created_at DESC LIMIT 25`,
            [nodeId],
          )
        ).rows;
        return { status: 200, value: { items } };
      });
    });
  }
  write(
    p: Principal,
    nodeInput: unknown,
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const nodeId = id(nodeInput),
        v = object(input, [
          'requestId',
          'artifactId',
          'replacementId',
          'resourceId',
          'reconcileId',
        ]);
      const reconcileId =
        v.reconcileId === undefined ? null : id(v.reconcileId);
      const requestId = id(v.requestId),
        artifactId = id(v.artifactId),
        replacementId = id(v.replacementId),
        resourceId = id(v.resourceId);
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: {
            type: 'pbx-artifact-retirement',
            reference: nodeId,
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
            [`pbx-retirement:${p.operatorId}:${requestId}`],
          );
          const fingerprint = createHash('sha256')
            .update(
              canonical([
                nodeId,
                artifactId,
                replacementId,
                resourceId,
                reconcileId,
              ]),
            )
            .digest('hex');
          const old = (
            await tx.query<{ id: string; fingerprint: string }>(
              'SELECT id,fingerprint FROM public.pbx_artifact_retirement_intents WHERE operator_id=$1 AND request_id=$2',
              [p.operatorId, requestId],
            )
          ).rows[0];
          if (old) {
            if (old.fingerprint !== fingerprint)
              throw new RoutingRejected('request_conflict');
            return { status: 200, value: { id: old.id, replayed: true } };
          }
          if (!(await new PeerRepository().node(tx, nodeId, true)))
            throw new PeerRejected(404);
          const active =
            (
              await tx.query<{ active_retirement_id: string | null }>(
                'SELECT active_retirement_id FROM public.pbx_live_runtime WHERE node_id=$1',
                [nodeId],
              )
            ).rows[0]?.active_retirement_id ?? null;
          if (
            active !== reconcileId ||
            !(await retirementEligible(
              tx,
              nodeId,
              artifactId,
              replacementId,
              resourceId,
            ))
          )
            throw new RoutingRejected('retained_dependency');
          if (
            reconcileId &&
            !(
              await tx.query(
                `SELECT i.id FROM public.pbx_artifact_retirement_intents i JOIN public.pbx_artifact_retirement_progress p ON p.intent_id=i.id WHERE i.id=$1 AND i.node_id=$2 AND i.artifact_id=$3 AND i.replacement_id=$4 AND i.resource_id=$5 AND p.state='unknown'`,
                [reconcileId, nodeId, artifactId, replacementId, resourceId],
              )
            ).rows.length
          )
            throw new RoutingRejected('operation_unresolved');
          const id = randomUUID();
          await tx.query(
            'INSERT INTO public.pbx_artifact_retirement_intents(id,node_id,artifact_id,replacement_id,resource_id,operator_id,authentication_version,request_id,fingerprint,predecessor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [
              id,
              nodeId,
              artifactId,
              replacementId,
              resourceId,
              p.operatorId,
              p.authenticationVersion,
              requestId,
              fingerprint,
              reconcileId,
            ],
          );
          await tx.query(
            'INSERT INTO public.pbx_artifact_retirement_progress(intent_id) VALUES($1)',
            [id],
          );
          await tx.query(
            'UPDATE public.pbx_live_runtime SET active_retirement_id=$2 WHERE node_id=$1',
            [nodeId, id],
          );
          await this.audit.append(tx, retirementAudit, {
            operationId: id,
            artifactId,
            nodeId,
            action: 'request',
          });
          return { status: 202, value: { id, replayed: false } };
        },
      );
    });
  }
}
