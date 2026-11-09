import { reconcileRouteTest } from './test-reconciliation';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { tenantVerificationAudit } from '../../application/tenant-verification';
import { retireArtifact } from './artifact-retirement';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  lstatSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  constants,
} from 'node:fs';
import type { LiveExecutionStore } from './execution-store';
import type { NativePbxDriver } from './native-driver';
import type { NativeAdmissionBarrier } from './admission';
import { RetainedLivePlans } from './retained-plans';
import type { ProtectedArtifactStore } from './artifact-store';
import { ControlledSipCall } from './controlled-sip';
import { captureSnapshot } from '../db/revision-snapshot';
import { canonical } from '../../domain/revision-snapshot';
import { runtimeNames } from './materialize';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { tenantRouting } from '../../domain/tenant-routing';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
interface Runtime {
  runtime_generation: number;
  artifact_id: string;
  revision_id: string;
  source_digest: string;
  epoch: string;
}
/** Existing physically fenced native owner only. No ordinary-worker dispatch path. */
export class TenantRuntimeMonitor {
  private readonly participantInstance = randomUUID();
  private participantInitialized = false;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private readonly plans: RetainedLivePlans;
  private readonly receipts: string;
  constructor(
    private readonly root: string,
    private readonly nodeId: string,
    installationId: string,
    private readonly store: LiveExecutionStore,
    private readonly driver: NativePbxDriver,
    private readonly barrier: NativeAdmissionBarrier,
    private readonly artifacts: ProtectedArtifactStore,
    private readonly exclusive: <T>(
      artifactId: string,
      action: (guard: () => Promise<void>) => Promise<T>,
    ) => Promise<T>,
  ) {
    this.plans = new RetainedLivePlans(root, nodeId, installationId);
    this.receipts = root + '/tenant-tests';
    mkdirSync(this.receipts, { recursive: true, mode: 0o700 });
    const stat = lstatSync(this.receipts);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o077
    )
      throw new Error('Test custody unavailable');
  }
  private async runtime(): Promise<Runtime | null> {
    return (
      (
        await this.store.pool.query<Runtime>(
          `SELECT a.id AS artifact_id,r.id AS revision_id,r.source_digest,p.routing_generation AS runtime_generation,o.epoch::text AS epoch FROM public.pbx_live_runtime p JOIN public.pbx_live_artifacts a ON a.id=p.installed_id AND a.id=p.verified_id JOIN public.pbx_revisions r ON r.id=a.revision_id JOIN public.pbx_ownership o ON o.node_id=p.node_id WHERE p.node_id=$1 AND p.runtime_state='verified' AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.active_profile_operation_id IS NULL AND o.expires_at>clock_timestamp() AND o.epoch=p.boundary_epoch AND r.policy_version='tenant-routing-1' AND r.compiler_version='tenant-review-1'`,
          [this.nodeId],
        )
      ).rows[0] ?? null
    );
  }
  async tick() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      if (!this.participantInitialized) {
        await this.store.pool.query(
          `INSERT INTO public.tenant_call_participant_instances(node_id,instance_id) VALUES($1,$2) ON CONFLICT(node_id) DO UPDATE SET instance_id=excluded.instance_id,started_at=clock_timestamp()`,
          [this.nodeId, this.participantInstance],
        );
        this.participantInitialized = true;
      }
      await retireArtifact(
        this.root,
        this.nodeId,
        this.store,
        this.driver,
        this.barrier,
        this.plans,
        this.artifacts,
        this.exclusive,
      );
      const runtime = await this.runtime();
      if (!runtime) {
        const retained = (
          await this.store.pool.query<{ id: string }>(
            `SELECT a.id FROM public.pbx_live_runtime p JOIN public.pbx_live_artifacts a ON a.id=p.verified_id AND a.id=p.installed_id JOIN public.pbx_ownership o ON o.node_id=p.node_id WHERE p.node_id=$1 AND p.runtime_state='verified' AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.active_profile_operation_id IS NULL AND o.expires_at>clock_timestamp() AND o.epoch=p.boundary_epoch`,
            [this.nodeId],
          )
        ).rows[0];
        if (retained)
          await this.exclusive(retained.id, async (guard) => {
            await guard();
            const plan = this.plans.load(retained.id);
            await this.driver.verify(
              plan.identity,
              plan.snapshot,
              plan.unmanaged,
            );
            await reconcileRouteTest(
              this.nodeId,
              retained.id,
              this.store,
              this.barrier,
              guard,
            );
          });
        return;
      }
      await this.exclusive(runtime.artifact_id, async (guard) => {
        await guard();
        const plan = this.plans.load(runtime.artifact_id);
        let valid = false;
        try {
          await this.driver.verify(
            plan.identity,
            plan.snapshot,
            plan.unmanaged,
          );
          valid = true;
        } catch {
          /* Drift stays incomplete. */
        }
        await this.store.pool.query(
          `INSERT INTO public.tenant_runtime_proofs(node_id,artifact_id,owner_epoch,source_digest,valid,runtime_generation) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS(SELECT 1 FROM public.pbx_live_runtime p JOIN public.pbx_ownership o ON o.node_id=p.node_id WHERE p.node_id=$1 AND p.verified_id=$2 AND p.installed_id=$2 AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.active_profile_operation_id IS NULL AND p.routing_generation=$6 AND o.epoch=$3 AND o.expires_at>clock_timestamp()) ON CONFLICT(node_id) DO UPDATE SET artifact_id=excluded.artifact_id,owner_epoch=excluded.owner_epoch,source_digest=excluded.source_digest,valid=excluded.valid,runtime_generation=excluded.runtime_generation,checked_at=clock_timestamp()`,
          [
            this.nodeId,
            runtime.artifact_id,
            runtime.epoch,
            runtime.source_digest,
            valid,
            runtime.runtime_generation,
          ],
        );
        if (valid) {
          await guard();
          await reconcileRouteTest(
            this.nodeId,
            runtime.artifact_id,
            this.store,
            this.barrier,
            guard,
          );
          await this.test(runtime);
        }
      });
    } finally {
      this.busy = false;
    }
  }
  private receipt(id: string): {
    outcome: 'permitted' | 'denied' | 'failed' | 'unknown';
    destinationId: string | null;
    epoch: string;
    finishedAt: string;
  } | null {
    try {
      const fd = openSync(
        this.receipts + '/' + id + '.json',
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = lstatSync(this.receipts + '/' + id + '.json');
        if (
          !stat.isFile() ||
          stat.uid !== 0 ||
          stat.mode & 0o077 ||
          stat.size > 512
        )
          return null;
        const v = JSON.parse(readFileSync(fd, 'utf8')) as {
          outcome: 'permitted' | 'denied' | 'failed' | 'unknown';
          destinationId: string | null;
          epoch: string;
          finishedAt: string;
        };
        return ['permitted', 'denied', 'failed', 'unknown'].includes(
          v.outcome,
        ) &&
          /^[1-9][0-9]{0,18}$/.test(v.epoch) &&
          typeof v.finishedAt === 'string' &&
          Number.isFinite(Date.parse(v.finishedAt))
          ? v
          : null;
      } finally {
        closeSync(fd);
      }
    } catch {
      return null;
    }
  }
  private async test(runtime: Runtime) {
    const row = (
      await this.store.pool.query<{
        id: string;
        tenant_id: string;
        artifact_id: string;
        runtime_generation: number;
        revision_id: string;
        source_digest: string;
        operator_id: string;
        authentication_version: number;
        state: string;
        expired: boolean;
        direction: 'inbound' | 'outbound';
        route_id: string;
        source_id: string;
        dialled: string;
        expected_destination_id: string | null;
        expected_outcome: string;
        test_kind: string;
        allowed: boolean;
      }>(
        `SELECT i.*,p.state,p.deadline<=clock_timestamp() AS expired,(c.enabled AND public.tenant_case_preparation_available(c.id) AND (i.grant_id IS NULL OR EXISTS(SELECT 1 FROM public.tenant_verification_grants g JOIN public.tenant_verification_grant_cases gc ON gc.grant_id=g.id WHERE g.id=i.grant_id AND gc.case_id=i.case_id AND g.artifact_id=i.artifact_id AND g.source_digest=i.source_digest AND g.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations v WHERE v.grant_id=g.id)))) AS allowed,c.direction,c.route_id,c.source_id,c.dialled,c.expected_destination_id,c.expected_outcome,c.test_kind FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id JOIN public.tenant_route_test_cases c ON c.id=i.case_id WHERE i.node_id=$1 AND p.state IN ('queued','dispatching','admitted') ORDER BY i.created_at LIMIT 1`,
        [this.nodeId],
      )
    ).rows[0];
    if (!row) return;
    const known = this.receipt(row.id);
    if (known) {
      await this.finish(
        row.id,
        known.epoch === runtime.epoch
          ? known
          : {
              outcome: 'unknown',
              destinationId: null,
              epoch: runtime.epoch,
              finishedAt: known.finishedAt,
            },
      );
      return;
    }
    if (row.state !== 'queued') {
      if (row.expired)
        await this.finish(row.id, {
          outcome: 'unknown',
          destinationId: null,
          epoch: runtime.epoch,
        });
      return;
    }
    const actor = await new PlatformAuthorityRepository(
      this.store.database,
    ).byId({ plane: 'platform', operatorId: row.operator_id });
    const current = await this.store.database.read((s) =>
      captureSnapshot(s, this.nodeId),
    );
    if (
      row.runtime_generation !== runtime.runtime_generation ||
      !row.allowed ||
      actor.kind !== 'eligible' ||
      actor.snapshot.authenticationVersion !== row.authentication_version ||
      row.artifact_id !== runtime.artifact_id ||
      row.source_digest !== hash(canonical(current))
    ) {
      await this.finish(row.id, {
        outcome: 'failed',
        destinationId: null,
        epoch: runtime.epoch,
      });
      return;
    }
    if (!(await this.barrier.idle())) return;
    const nonce = randomBytes(32).toString('hex');
    const dispatch = await this.store.pool.connect();
    let dispatched: boolean;
    let discard = false;
    try {
      await dispatch.query('BEGIN');
      await dispatch.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR SHARE',
        [this.nodeId],
      );
      const result = await dispatch.query(
        `UPDATE public.tenant_route_test_progress p SET state='dispatching',nonce_hash=$2,owner_epoch=$3,deadline=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() WHERE p.intent_id=$1 AND p.state='queued' AND EXISTS(SELECT 1 FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_cases c ON c.id=i.case_id WHERE i.id=p.intent_id AND c.enabled AND public.tenant_case_preparation_available(c.id)) AND EXISTS(SELECT 1 FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE r.node_id=p.node_id AND r.verified_id=$4 AND r.active_operation_id IS NULL AND r.active_retirement_id IS NULL AND r.active_profile_operation_id IS NULL AND o.epoch=$3 AND o.expires_at>clock_timestamp()) RETURNING intent_id`,
        [row.id, hash(nonce), runtime.epoch, runtime.artifact_id],
      );
      dispatched = result.rows.length === 1;
      await dispatch.query('COMMIT');
    } catch (error) {
      try {
        await dispatch.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      dispatch.release(discard);
    }
    if (!dispatched) return;
    let outcome: 'permitted' | 'denied' | 'failed' | 'unknown';
    let destinationId: string | null = null;
    try {
      const plan = this.plans.load(runtime.artifact_id),
        names = runtimeNames(plan.snapshot, row.revision_id);
      const s = plan.snapshot,
        routing = tenantRouting(s);
      const bytes = this.artifacts.load(plan.identity).pjsip.toString('utf8');
      const password = (auth: string) => {
        const secret = bytes
          .split(`[${auth}]\n`)[1]
          ?.split('\n[')[0]
          ?.match(/^password=([a-f0-9]{64})$/m)?.[1];
        if (!secret) throw new Error('Exact fixture material missing');
        return secret;
      };
      const endpoint = s.extensions.find((e) => e.id === row.source_id);
      const destination = s.extensions.find(
        (e) => e.id === row.expected_destination_id,
      );
      const route = s.outbound.find((r) => r.id === row.route_id),
        trunk = s.trunks.find((t) => t.id === route?.trunkId);
      const gateway = s.gateways.find((g) => g.id === row.source_id);
      if (row.direction === 'inbound') {
        const inbound = s.inbound.find((r) => r.id === row.route_id);
        const target = inbound?.destination;
        if (target?.kind === 'group') {
          const g = s.groups.find((g) => g.id === target.id);
          if (
            !g ||
            g.memberIds.length !== 1 ||
            (row.expected_outcome === 'permitted' &&
              g.memberIds[0] !== row.expected_destination_id) ||
            g.fallback.kind !== 'hangup' ||
            g.timeout > 15
          )
            throw new Error('Controlled two-leg graph required');
        } else if (
          row.expected_outcome === 'permitted' &&
          (target?.kind !== 'extension' ||
            target.id !== row.expected_destination_id)
        )
          throw new Error('Controlled destination required');
      }
      if (
        row.direction === 'outbound' &&
        (!trunk ||
          trunk.settings.host !== '127.0.0.4' ||
          trunk.settings.port < 20000 ||
          trunk.settings.port > 20100)
      )
        throw new Error('Controlled trunk required');
      if (row.direction === 'outbound' && endpoint) {
        const actualOwner = s.tenantRouting?.tenants.find((t) =>
          routing.extension(t.id, endpoint.id),
        );
        const actualRule = actualOwner
          ? routing.outboundRule(actualOwner.id, row.dialled)
          : null;
        const actualTrunk = actualRule
          ? s.trunks.find((t) => t.id === actualRule.trunkId)
          : null;
        if (
          actualRule &&
          (!actualTrunk ||
            actualTrunk.settings.host !== '127.0.0.4' ||
            actualTrunk.settings.port < 20000 ||
            actualTrunk.settings.port > 20100)
        )
          throw new Error('Controlled actual source destination required');
      }
      if (
        row.direction === 'inbound' &&
        (!gateway ||
          canonical(gateway.sourceAddresses) !== canonical(['127.0.0.2']))
      )
        throw new Error('Controlled ingress required');
      if (
        row.expected_outcome === 'permitted' &&
        (row.direction === 'inbound'
          ? !destination || !routing.inbound(row.tenant_id, row.route_id)
          : !endpoint ||
            trunk?.id !== row.expected_destination_id ||
            routing.outboundRule(row.tenant_id, row.dialled)?.id !==
              row.route_id)
      )
        throw new Error('Controlled positive graph required');
      const result = await new ControlledSipCall().run({
        direction: row.direction,
        number: row.dialled,
        username:
          row.direction === 'inbound'
            ? names.gateway(row.source_id)
            : (endpoint?.endpointKey ??
              `ims-unknown-${row.source_id.replaceAll('-', '')}`),
        password:
          row.direction === 'outbound' && endpoint
            ? password(endpoint.authKey)
            : null,
        nonce:
          row.test_kind === 'ordinary-draft'
            ? randomBytes(32).toString('hex')
            : nonce,
        ambiguous: row.test_kind === 'ambiguous-source',
        destinationUsername:
          row.direction === 'inbound'
            ? (destination?.endpointKey ?? 'ims-absent')
            : `${route!.addPrefix}${row.dialled.slice(route!.stripCount)}`,
        destinationAor: destination?.aorKey ?? 'ims-absent',
        destinationPassword:
          row.direction === 'inbound' && destination
            ? password(destination.authKey)
            : null,
        sinkPort: row.direction === 'outbound' ? trunk!.settings.port : 20021,
      });
      outcome = result.outcome;
      if (outcome === 'permitted') {
        const admitted =
          (
            await this.store.pool.query(
              `SELECT 1 FROM public.tenant_route_test_progress WHERE intent_id=$1 AND state='admitted'`,
              [row.id],
            )
          ).rows.length > 0;
        if (!admitted || !result.destinationObserved || !result.mediaObserved)
          outcome = 'failed';
        else
          destinationId =
            row.direction === 'inbound'
              ? (destination?.id ?? null)
              : (trunk?.id ?? null);
      }
      if (!(await this.barrier.idle())) {
        outcome = 'unknown';
        destinationId = null;
      }
    } catch {
      outcome = 'unknown';
      destinationId = null;
    }
    const receipt = {
      outcome,
      destinationId,
      epoch: runtime.epoch,
      finishedAt: new Date().toISOString(),
    };
    const fd = openSync(
      this.receipts + '/' + row.id + '.json',
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, canonical(receipt));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const directory = openSync(
      this.receipts,
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
    await this.finish(row.id, receipt);
  }
  private async finish(
    id: string,
    result: {
      outcome: 'permitted' | 'denied' | 'failed' | 'unknown';
      destinationId: string | null;
      epoch: string;
      finishedAt?: string;
    },
  ) {
    await Transaction.run(
      this.store.pool,
      {
        actor: {
          kind: 'system',
          plane: 'system',
          reference: 'native-tenant-test',
          tenantId: null,
          reason: 'committed-controlled-route-test',
        },
        target: {
          type: 'tenant-route-verification',
          reference: this.nodeId,
          tenantId: null,
        },
        correlationId: id,
      },
      'telephony.test-result',
      new SafeLogger('telephony'),
      async (tx) => {
        await tx.query(
          'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
          [this.nodeId],
        );
        const owner =
          (
            await tx.query(
              `SELECT 1 FROM public.pbx_live_runtime p JOIN public.pbx_ownership o ON o.node_id=p.node_id WHERE p.node_id=$1 AND p.active_operation_id IS NULL AND p.active_retirement_id IS NULL AND p.active_profile_operation_id IS NULL AND p.boundary_epoch=o.epoch AND o.epoch=$2 AND o.expires_at>clock_timestamp()`,
              [this.nodeId, result.epoch],
            )
          ).rows.length > 0;
        if (!owner) throw new Error('Native result ownership unavailable');
        const pending = (
          await tx.query<{
            tenant_id: string;
            state: string;
            expected_outcome: string;
          }>(
            'SELECT i.tenant_id,p.state,c.expected_outcome FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id JOIN public.tenant_route_test_cases c ON c.id=i.case_id WHERE i.id=$1 FOR UPDATE OF p',
            [id],
          )
        ).rows[0];
        if (
          !pending ||
          !['queued', 'dispatching', 'admitted'].includes(pending.state)
        )
          return;
        const state =
          result.outcome === 'permitted'
            ? pending.expected_outcome === 'permitted'
              ? 'passed'
              : 'failed'
            : result.outcome === 'denied' &&
                pending.expected_outcome !== 'denied'
              ? 'failed'
              : result.outcome;
        await tx.query(
          'INSERT INTO public.tenant_route_test_results(intent_id,outcome,destination_id,owner_epoch,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [
            id,
            result.outcome,
            result.destinationId,
            result.epoch,
            result.finishedAt ?? new Date().toISOString(),
          ],
        );
        await tx.query(
          'UPDATE public.tenant_route_test_progress SET state=$2,updated_at=clock_timestamp() WHERE intent_id=$1',
          [id, state],
        );
        await new AuditRepository().append(tx, tenantVerificationAudit, {
          nodeId: this.nodeId,
          tenantId: pending.tenant_id,
          operationId: id,
          action: state,
        });
      },
    );
  }

  start() {
    this.timer = setInterval(() => {
      void this.tick().catch(() => {});
    }, 3000);
    void this.tick().catch(() => {});
  }
  async close() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    while (this.busy) await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
