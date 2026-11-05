import { PlatformAuthorityRepository } from '../../platform/adapters/db/authority-read';
import type { TenantVerificationView } from '@myims/contracts';
import { createHash, randomUUID } from 'node:crypto';
import type {
  SnapshotDatabase,
  ReadSnapshot,
} from '../../../infrastructure/database/read-snapshot';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { AuditWrite } from '../../audit/application/audit-write';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox-repository';
import type { PbxTransactions } from './pbx-nodes';
import type { AllocationTenancy } from './allocation-tenancy';
import { captureSnapshot } from '../adapters/db/revision-snapshot';
import { PeerRepository } from '../adapters/db/peer-repository';
import { canonical, type RevisionSnapshot } from '../domain/revision-snapshot';
import {
  tenantReadiness,
  type TenantEvidence,
} from '../domain/tenant-readiness';
import { id, object, PeerRejected } from '../domain/peer';
import { RoutingRejected } from '../domain/routing';
const digest = (v: unknown) =>
  createHash('sha256').update(canonical(v)).digest('hex');
export const tenantWorkContract = {
  type: 'telephony.tenant.verify',
  version: 1,
  fields: { operationId: { kind: 'uuid' as const } },
};
export const tenantVerificationAudit = {
  type: 'telephony.tenant.verification',
  version: 1,
  fields: {
    nodeId: { kind: 'uuid' as const },
    tenantId: { kind: 'uuid' as const },
    operationId: { kind: 'uuid' as const },
    action: {
      kind: 'enum' as const,
      values: [
        'grant',
        'revoke',
        'test',
        'passed',
        'denied',
        'failed',
        'unknown',
        'reconcile',
      ],
    },
  },
};
export interface TenantRuntime {
  runtime_generation: number;
  operator_id: string;
  authentication_version: number;
  artifact_id: string;
  revision_id: string;
  source_digest: string;
  snapshot: RevisionSnapshot;
  current: boolean;
}
export async function currentTenantRuntime(
  s: ReadSnapshot,
  nodeId: string,
): Promise<TenantRuntime | null> {
  return (
    (
      await s.query<TenantRuntime>(
        `SELECT a.id AS artifact_id,r.id AS revision_id,r.source_digest,r.snapshot,p.routing_generation AS runtime_generation,x.operator_id,x.authentication_version,
    (p.runtime_state='verified' AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.installed_id=p.verified_id AND p.executor_seen_at>clock_timestamp()-interval '15 seconds' AND o.expires_at>clock_timestamp() AND o.epoch=p.boundary_epoch AND f.valid AND f.runtime_generation=p.routing_generation AND f.artifact_id=a.id AND f.owner_epoch=o.epoch AND f.source_digest=r.source_digest AND f.checked_at>clock_timestamp()-interval '15 seconds' AND r.policy_version='tenant-routing-1' AND r.compiler_version='tenant-review-1' AND EXISTS(SELECT 1 FROM public.pbx_revision_validations v WHERE v.revision_id=r.id AND v.policy_version=r.policy_version AND v.compiler_version=r.compiler_version AND v.evaluated_digest=r.source_digest AND v.result->>'local'='passed' AND v.result->>'applicable'='true')) IS TRUE AS current
    FROM public.pbx_live_runtime p JOIN public.pbx_live_artifacts a ON a.id=p.verified_id JOIN public.pbx_revisions r ON r.id=a.revision_id JOIN public.pbx_live_operations x ON x.id=a.operation_id LEFT JOIN public.pbx_ownership o ON o.node_id=p.node_id LEFT JOIN public.tenant_runtime_proofs f ON f.node_id=p.node_id WHERE p.node_id=$1`,
        [nodeId],
      )
    ).rows[0] ?? null
  );
}
type Result = { status: number; value: Record<string, unknown> };
type TestRow = Omit<
  TenantVerificationView['tests'][number],
  'createdAt' | 'finishedAt'
> & {
  createdAt: Date;
  finishedAt: Date | null;
  actorVersion?: number;
};
type GrantRow = Omit<
  TenantVerificationView['grants'][number],
  'createdAt' | 'expiresAt'
> & {
  createdAt: Date;
  expiresAt: Date;
};
export class TenantVerification {
  constructor(
    private readonly transactions: PbxTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly tenancy: AllocationTenancy,
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
              : 'Verification request rejected',
          ...(e instanceof RoutingRejected ? { reason: e.reason } : {}),
        },
      };
    }
  }
  read(p: Principal, tenantInput: unknown, nodeInput: unknown, q: unknown) {
    return this.handle(async () => {
      object(q, []);
      const tenantId = id(tenantInput),
        nodeId = id(nodeInput);
      if (p.plane !== 'platform' || !p.grants.includes('platform_operator'))
        throw new PeerRejected(403);
      return this.database.read(async (s) => ({
        status: 200,
        value: { ...(await this.project(s, tenantId, nodeId)) },
      }));
    });
  }
  /** Backend consumers compose this read with their own primary transaction. */
  async project(
    s: ReadSnapshot,
    tenantId: string,
    nodeId: string,
  ): Promise<TenantVerificationView> {
    if (
      !(await this.tenancy.read(s, tenantId)) ||
      !(await new PeerRepository().node(s, nodeId))
    )
      throw new PeerRejected(404);
    const snapshot = await captureSnapshot(s, nodeId),
      runtime = await currentTenantRuntime(s, nodeId);
    if (runtime) {
      const actor = await new PlatformAuthorityRepository(this.database).readIn(
        s,
        runtime.operator_id,
      );
      runtime.current =
        runtime.current &&
        actor.kind === 'eligible' &&
        actor.snapshot.authenticationVersion === runtime.authentication_version;
    }
    // Voice-disabled tenants need no allocation. Use the narrow tenancy-owned fact port.
    if (!snapshot.tenantRouting!.tenants.some((t) => t.id === tenantId)) {
      const row = (
        await s.query<{
          tenants: NonNullable<RevisionSnapshot['tenantRouting']>['tenants'];
        }>(`SELECT public.tenant_routing_capture(ARRAY[$1::uuid]) AS tenants`, [
          tenantId,
        ])
      ).rows[0];
      if (row && Array.isArray(row.tenants))
        snapshot.tenantRouting!.tenants.push(...row.tenants);
    }
    const tests = (
      await s.query<TestRow>(
        `SELECT i.id,i.case_id AS "caseId",i.artifact_id AS "artifactId",i.revision_id AS "revisionId",i.operator_id AS "createdBy",i.authentication_version AS "actorVersion",i.created_at AS "createdAt",p.state,c.direction,c.expected_outcome AS "expectedOutcome",r.outcome,r.destination_id AS "destinationId",r.created_at AS "finishedAt",(i.source_digest=$3 AND i.artifact_id=$4 AND i.runtime_generation=$5 AND c.enabled AND (i.grant_id IS NULL OR EXISTS(SELECT 1 FROM public.tenant_verification_grants g WHERE g.id=i.grant_id AND g.expires_at>clock_timestamp() AND g.runtime_generation=i.runtime_generation AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations x WHERE x.grant_id=g.id)))) AS current FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id JOIN public.tenant_route_test_cases c ON c.id=i.case_id LEFT JOIN public.tenant_route_test_results r ON r.intent_id=i.id WHERE i.tenant_id=$1 AND i.node_id=$2 ORDER BY i.created_at DESC LIMIT 25`,
        [
          tenantId,
          nodeId,
          digest(snapshot),
          runtime?.artifact_id ?? null,
          runtime?.runtime_generation ?? -1,
        ],
      )
    ).rows;
    for (const test of tests) {
      const actor = await new PlatformAuthorityRepository(this.database).readIn(
        s,
        test.createdBy,
      );
      test.current =
        test.current === true &&
        actor.kind === 'eligible' &&
        actor.snapshot.authenticationVersion === test.actorVersion;
      delete test.actorVersion;
    }
    const pending =
      (
        await s.query(
          `SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') LIMIT 1`,
          [nodeId],
        )
      ).rows.length > 0;
    // A bounded recent-results display must never age an isolation failure out
    // of readiness. Revoking its grant also cannot repair the same loaded runtime.
    const isolationFailed =
      (
        await s.query(
          `SELECT 1 FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_cases c ON c.id=i.case_id JOIN public.tenant_route_test_results r ON r.intent_id=i.id WHERE i.node_id=$1 AND i.artifact_id=$2 AND i.runtime_generation=$3 AND i.source_digest=$4 AND c.expected_outcome='denied' AND r.outcome='permitted' LIMIT 1`,
          [
            nodeId,
            runtime?.artifact_id ?? null,
            runtime?.runtime_generation ?? -1,
            digest(snapshot),
          ],
        )
      ).rows.length > 0;
    const evidence: TenantEvidence[] = tests
      .filter(
        (t): t is TestRow & { finishedAt: Date } =>
          t.finishedAt instanceof Date,
      )
      .map((t) => ({
        direction: t.direction,
        permitted: t.outcome === 'permitted',
        expected: t.expectedOutcome === 'permitted',
        current: t.current === true,
        createdAt: t.finishedAt,
      }));
    const cases = (
      await s.query<TenantVerificationView['cases'][number]>(
        `SELECT id,direction,route_id AS "routeId",source_id AS "sourceId",dialled,expected_outcome AS "expectedOutcome",expected_destination_id AS "expectedDestinationId",readiness_required AS "readinessRequired",test_kind AS kind FROM public.tenant_route_test_cases WHERE tenant_id=$1 AND node_id=$2 AND enabled ORDER BY id LIMIT 17`,
        [tenantId, nodeId],
      )
    ).rows;
    if (cases.length > 16) throw new RoutingRejected('graph_limit');
    const grants = (
      await s.query<GrantRow>(
        `SELECT g.id,g.artifact_id AS "artifactId",g.created_at AS "createdAt",g.expires_at AS "expiresAt",(g.expires_at>clock_timestamp() AND g.runtime_generation=$3 AND g.artifact_id=$4 AND g.source_digest=$5 AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations x WHERE x.grant_id=g.id)) AS active FROM public.tenant_verification_grants g WHERE g.tenant_id=$1 AND g.node_id=$2 ORDER BY g.created_at DESC LIMIT 10`,
        [
          tenantId,
          nodeId,
          runtime?.runtime_generation ?? -1,
          runtime?.artifact_id ?? null,
          digest(snapshot),
        ],
      )
    ).rows;
    const readiness = tenantReadiness(
      snapshot,
      tenantId,
      !!runtime?.current && runtime.source_digest === digest(snapshot),
      pending,
      evidence,
      new Date(),
    );
    if (
      readiness.state === 'ready' &&
      cases
        .filter((c) => c.readinessRequired === true)
        .some((c) => {
          const latest = tests.find((t) => t.caseId === c.id);
          return (
            !latest?.current ||
            latest.outcome !== c.expectedOutcome ||
            !(latest.finishedAt instanceof Date) ||
            Date.now() - latest.finishedAt.getTime() >= 86400000
          );
        })
    ) {
      readiness.state = 'incomplete';
      readiness.blockers.push('required_test_cases_incomplete');
    }
    if (readiness.state === 'ready' && isolationFailed) {
      readiness.state = 'incomplete';
      readiness.blockers.push('isolation_verification_failed');
    }
    return {
      readiness,
      artifactId: runtime?.artifact_id ?? null,
      revisionId: runtime?.revision_id ?? null,
      cases,
      grants: grants.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
      })),
      tests: tests.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        finishedAt: t.finishedAt?.toISOString() ?? null,
      })),
    };
  }
  write(
    p: Principal,
    tenantInput: unknown,
    nodeInput: unknown,
    action: 'grant' | 'revoke' | 'test' | 'reconcile',
    input: unknown,
    correlationId: string,
  ) {
    return this.handle(async () => {
      const tenantId = id(tenantInput),
        nodeId = id(nodeInput),
        v = object(
          input,
          action === 'reconcile'
            ? ['requestId', 'testId']
            : action === 'grant'
              ? ['requestId', 'artifactId', 'caseIds', 'lifetimeSeconds']
              : action === 'revoke'
                ? ['requestId', 'grantId']
                : ['requestId', 'artifactId', 'caseId', 'grantId'],
        );
      const requestId = id(v.requestId),
        artifactId =
          action === 'revoke' || action === 'reconcile'
            ? null
            : id(v.artifactId);
      const lifetimeSeconds =
        v.lifetimeSeconds === undefined ? 1800 : v.lifetimeSeconds;
      if (
        action === 'grant' &&
        (typeof lifetimeSeconds !== 'number' ||
          !Number.isInteger(lifetimeSeconds) ||
          lifetimeSeconds < 1 ||
          lifetimeSeconds > 1800)
      )
        throw new PeerRejected(400);
      const caseIds =
        action === 'grant' &&
        Array.isArray(v.caseIds) &&
        v.caseIds.length > 0 &&
        v.caseIds.length <= 16
          ? v.caseIds.map((x) => id(x))
          : action === 'test'
            ? [id(v.caseId)]
            : [];
      if (
        action === 'grant' &&
        (caseIds.length === 0 || new Set(caseIds).size !== caseIds.length)
      )
        throw new PeerRejected(400);
      const grantId =
        action === 'revoke'
          ? id(v.grantId)
          : action === 'test' && v.grantId !== null
            ? id(v.grantId)
            : null;
      return this.transactions.run(
        {
          actor: principalActor(p),
          target: {
            type: 'tenant-route-verification',
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
            [`tenant-verification:${p.operatorId}:${requestId}`],
          );
          const fingerprint = digest([tenantId, nodeId, action, v]);
          const old = (
            await tx.query<{
              fingerprint: string;
              result: Record<string, unknown>;
              expired: boolean;
            }>(
              `SELECT fingerprint,result,created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.tenant_verification_receipts WHERE operator_id=$1 AND request_id=$2`,
              [p.operatorId, requestId],
            )
          ).rows[0];
          if (old) {
            if (old.fingerprint !== fingerprint)
              throw new RoutingRejected('request_conflict');
            if (old.expired) throw new RoutingRejected('intent_expired');
            return { status: 200, value: { ...old.result, replayed: true } };
          }
          const tenant = await this.tenancy.read(tx, tenantId, true);
          if (!tenant || !(await new PeerRepository().node(tx, nodeId, true)))
            throw new PeerRejected(404);
          const operationId = randomUUID();
          let result: Record<string, unknown>;
          if (action === 'reconcile') {
            const testId = id(v.testId);
            if (
              !(
                await tx.query(
                  `SELECT i.id FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id WHERE i.id=$1 AND i.node_id=$2 AND i.tenant_id=$3 AND p.state='unknown'`,
                  [testId, nodeId, tenantId],
                )
              ).rows.length
            )
              throw new RoutingRejected('operation_unresolved');
            await tx.query(
              'INSERT INTO public.tenant_route_test_reconciliation_intents(id,test_id,operator_id,authentication_version,request_id) VALUES($1,$2,$3,$4,$5)',
              [
                operationId,
                testId,
                p.operatorId,
                p.authenticationVersion,
                requestId,
              ],
            );
            result = { id: operationId, action, state: 'queued' };
          } else if (action === 'revoke') {
            const grant = await tx.query(
              'SELECT id FROM public.tenant_verification_grants WHERE id=$1 AND tenant_id=$2 AND node_id=$3',
              [grantId, tenantId, nodeId],
            );
            if (!grant.rows.length) throw new PeerRejected(404);
            await tx.query(
              'INSERT INTO public.tenant_verification_revocations(grant_id,operator_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
              [grantId, p.operatorId],
            );
            result = { id: grantId, action };
          } else {
            const current = await currentTenantRuntime(tx, nodeId),
              snapshot = await captureSnapshot(tx, nodeId);
            if (
              !current?.current ||
              current.artifact_id !== artifactId ||
              current.source_digest !== digest(snapshot) ||
              !['draft', 'active'].includes(tenant.status) ||
              snapshot.tenantRouting?.tenants.find((t) => t.id === tenantId)
                ?.voicePreference !== 'enabled'
            )
              throw new RoutingRejected('runtime_not_current');
            const cases = (
              await tx.query(
                'SELECT id FROM public.tenant_route_test_cases WHERE id=ANY($1::uuid[]) AND node_id=$2 AND tenant_id=$3 AND enabled',
                [caseIds, nodeId, tenantId],
              )
            ).rows;
            if (cases.length !== caseIds.length)
              throw new RoutingRejected('test_case_unavailable');
            if (action === 'grant') {
              if (tenant.status !== 'draft')
                throw new RoutingRejected('tenant_ineligible');
              const g = (
                await tx.query(
                  `INSERT INTO public.tenant_verification_grants(id,tenant_id,node_id,artifact_id,revision_id,source_digest,operator_id,authentication_version,request_id,runtime_generation,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp()+$11::integer*interval '1 second') RETURNING expires_at AS "expiresAt"`,
                  [
                    operationId,
                    tenantId,
                    nodeId,
                    artifactId,
                    current.revision_id,
                    current.source_digest,
                    p.operatorId,
                    p.authenticationVersion,
                    requestId,
                    current.runtime_generation,
                    lifetimeSeconds,
                  ],
                )
              ).rows[0]!;
              for (const caseId of caseIds)
                await tx.query(
                  'INSERT INTO public.tenant_verification_grant_cases(grant_id,case_id) VALUES($1,$2)',
                  [operationId, caseId],
                );
              result = { id: operationId, action, expiresAt: g.expiresAt };
            } else {
              if (
                tenant.status === 'draft' &&
                !(
                  await tx.query(
                    `SELECT g.id FROM public.tenant_verification_grants g JOIN public.tenant_verification_grant_cases gc ON gc.grant_id=g.id WHERE g.id=$1 AND g.tenant_id=$2 AND g.node_id=$3 AND g.artifact_id=$4 AND g.source_digest=$5 AND gc.case_id=$6 AND g.runtime_generation=$7 AND g.operator_id=$8 AND g.authentication_version=$9 AND g.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations x WHERE x.grant_id=g.id)`,
                    [
                      grantId,
                      tenantId,
                      nodeId,
                      artifactId,
                      current.source_digest,
                      caseIds[0],
                      current.runtime_generation,
                      p.operatorId,
                      p.authenticationVersion,
                    ],
                  )
                ).rows.length
              )
                throw new RoutingRejected('verification_grant_required');
              if (
                (
                  await tx.query(
                    `SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') LIMIT 1`,
                    [nodeId],
                  )
                ).rows.length
              )
                throw new RoutingRejected('operation_unresolved');
              await tx.query(
                'INSERT INTO public.tenant_route_test_intents(id,case_id,tenant_id,node_id,artifact_id,revision_id,grant_id,source_digest,operator_id,authentication_version,request_id,runtime_generation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
                [
                  operationId,
                  caseIds[0],
                  tenantId,
                  nodeId,
                  artifactId,
                  current.revision_id,
                  grantId,
                  current.source_digest,
                  p.operatorId,
                  p.authenticationVersion,
                  requestId,
                  current.runtime_generation,
                ],
              );
              await tx.query(
                'INSERT INTO public.tenant_route_test_progress(intent_id,node_id) VALUES($1,$2)',
                [operationId, nodeId],
              );
              await new OutboxRepository().insert(
                tx,
                tenantWorkContract,
                operationId,
                { operationId },
              );
              result = { id: operationId, action, state: 'queued' };
            }
          }
          await this.audit.append(tx, tenantVerificationAudit, {
            nodeId,
            tenantId,
            operationId,
            action,
          });
          await tx.query(
            'INSERT INTO public.tenant_verification_receipts(operator_id,request_id,fingerprint,result) VALUES($1,$2,$3,$4)',
            [p.operatorId, requestId, fingerprint, result],
          );
          return {
            status: action === 'test' || action === 'reconcile' ? 202 : 201,
            value: { ...result, replayed: false },
          };
        },
      );
    });
  }
}
