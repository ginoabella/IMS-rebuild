import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  openSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { join } from 'node:path';
import type { PbxOwnershipToken } from '../../application/observation-ports';
import {
  canonical,
  type RevisionSnapshot,
} from '../../domain/revision-snapshot';
import { uuid } from '../../../identity/domain/storage';
import {
  ProtectedArtifactStore,
  type ArtifactIdentity,
} from './artifact-store';
import { LiveExecutionStore, type LiveIntentRow } from './execution-store';
import {
  PhysicalMutationBoundary,
  type BoundaryIntent,
  type BoundaryResult,
} from './mutation-boundary';
import { materializeRevision } from './materialize';
import { NativePbxDriver } from './native-driver';
import { NativeAdmissionBarrier } from './admission';
import { RetainedLivePlans } from './retained-plans';
import {
  VerifiedLiveExecution,
  type RetainedLiveArtifact,
} from './verified-execution';
import type { NativeOwnerPort } from './owner-executor';
export interface NativeLiveProbes {
  verify(artifact: RetainedLiveArtifact, signal: AbortSignal): Promise<void>;
}
/** Private native composition only. The canonical SQL row defines every effect. */
export class NativeLiveApplication implements NativeOwnerPort {
  private readonly boundary: PhysicalMutationBoundary;
  private readonly execution: VerifiedLiveExecution;
  private readonly plans: RetainedLivePlans;
  private readonly busy = new Set<string>();
  constructor(
    private readonly root: string,
    private readonly nodeId: string,
    private readonly installationId: string,
    private readonly store: LiveExecutionStore,
    private readonly artifacts: ProtectedArtifactStore,
    private readonly driver: NativePbxDriver,
    private readonly admission: NativeAdmissionBarrier,
    private readonly probes: NativeLiveProbes,
  ) {
    this.boundary = new PhysicalMutationBoundary(root, nodeId, installationId, {
      current: (token) => store.ownership.verify(token),
      drain: () => driver.drain(),
    });
    this.execution = new VerifiedLiveExecution(
      this.boundary,
      driver,
      admission,
    );
    this.plans = new RetainedLivePlans(root, nodeId, installationId);
  }
  private initialId(): string {
    const path = join(this.root, 'initial-baseline');
    let fd: number;
    try {
      fd = openSync(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        // eslint-disable-next-line preserve-caught-error -- Native diagnostics remain finite and exclude protected file details.
        throw new Error('Native baseline unavailable');
      const id = randomUUID();
      fd = openSync(
        path,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        writeFileSync(fd, id);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      const directory = openSync(
        this.root,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
      return id;
    }
    try {
      const stat = fstatSync(fd);
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() ||
        stat.mode & 0o077 ||
        stat.size !== 36
      )
        throw new Error('Native baseline unavailable');
      const id = readFileSync(fd, 'utf8');
      if (!uuid(id)) throw new Error('Native baseline unavailable');
      return id;
    } finally {
      closeSync(fd);
    }
  }
  async connect(token: PbxOwnershipToken) {
    if (
      token.nodeId !== this.nodeId ||
      !(await this.store.ownership.verify(token))
    )
      throw new Error('Native ownership unavailable');
    const baselineId = this.initialId();
    await this.boundary.initialize(async () => {
      const node = (
        await this.store.pool.query<{ version: number }>(
          'SELECT version FROM public.pbx_nodes WHERE id=$1 AND installation_id=$2',
          [this.nodeId, this.installationId],
        )
      ).rows[0];
      if (!node) throw new Error('Native installation unavailable');
      const snapshot: RevisionSnapshot = {
        node: {
          id: this.nodeId,
          installationId: this.installationId,
          version: node.version,
        },
        eligibility: {
          allocations: 'unavailable',
          bindings: 'unavailable',
          sharedTrunkPermissions: 'unavailable',
        },
        capability: null,
        profiles: [],
        extensions: [],
        trunks: [],
        gateways: [],
        dids: [],
        groups: [],
        reservations: [],
        inbound: [],
        outbound: [],
        credentials: [],
      };
      const identity: ArtifactIdentity = {
        nodeId: this.nodeId,
        installationId: this.installationId,
        revisionId: baselineId,
        sequence: 1,
        compilerVersion: 'baseline-1',
        policyVersion: 'deny-unbound-1',
        sourceDigest: createHash('sha256')
          .update(canonical(snapshot))
          .digest('hex'),
      };
      // Capture actual no-resource/default-deny runtime and full unmanaged facts;
      // filesystem emptiness alone cannot establish this baseline.
      await this.driver.captureBaseline();
      this.artifacts.stage(identity, {
        pjsip: Buffer.alloc(0),
        dialplan: Buffer.alloc(0),
      });
      this.plans.save({
        identity,
        snapshot,
        unmanaged: this.driver.unmanaged(),
      });
      return baselineId;
    });
    await this.boundary.takeover(token);
    await this.store.recordBaseline(token, this.installationId, baselineId);
  }
  async inspect(token: PbxOwnershipToken, operationId: string) {
    return (await this.boundary.inspect(token, operationId)).state;
  }
  private intent(row: LiveIntentRow): BoundaryIntent {
    return {
      operationId: row.id,
      revisionId: row.target_id,
      sequence: row.sequence,
      expectedBaselineId: row.expected_baseline_id,
      fingerprint: row.fingerprint,
    };
  }
  private async reconcile(token: PbxOwnershipToken, row: LiveIntentRow) {
    if (!row.predecessor_id || !(await this.store.authorized(row)))
      throw new Error('Reconciliation authority unavailable');
    // A failed reconciliation may itself become the canonical predecessor before
    // the original physical pending intent was consumed. Resolve that immutable
    // ancestry in order; inspecting an unrelated pending ID is not proof that the
    // immediately preceding SQL operation reached the mutation boundary.
    const signal = AbortSignal.timeout(300000);
    const predecessors: LiveIntentRow[] = [];
    let predecessorId: string | null = row.predecessor_id;
    let sequence = row.sequence;
    while (predecessorId && predecessors.length < 128) {
      if (signal.aborted) throw new Error('Reconciliation deadline exceeded');
      const predecessor = await this.store.intent(this.nodeId, predecessorId);
      if (
        !predecessor ||
        predecessor.installation_id !== row.installation_id ||
        predecessor.expected_baseline_id !== row.expected_baseline_id ||
        predecessor.sequence >= sequence ||
        row.target_id !== row.expected_baseline_id
      )
        throw new Error('Reconciliation predecessor unavailable');
      predecessors.push(predecessor);
      predecessorId = predecessor.predecessor_id;
      sequence = predecessor.sequence;
    }
    if (predecessorId) throw new Error('Reconciliation ancestry unavailable');
    const predecessor = predecessors[0]!;
    const baseline = this.plans.load(row.target_id);
    const establish = async (
      guard: () => Promise<void>,
    ): Promise<BoundaryResult> => {
      const ownerGuard = guard;
      guard = async () => {
        if (signal.aborted) throw new Error('Reconciliation deadline exceeded');
        await ownerGuard();
        if (!(await this.store.authorized(row)))
          throw new Error('Reconciliation authority unavailable');
      };
      await this.driver.drain();
      await guard();
      await this.admission.close();
      await this.admission.quiet(Date.now() + 120000, signal, guard);
      await guard();
      await this.store.phase(token, row, 'recovering', { recovery: 'pending' });
      const verify = async () => {
        await this.driver.verify(
          baseline.identity,
          baseline.snapshot,
          baseline.unmanaged,
        );
        await this.probes.verify(baseline, signal);
        await this.admission.assertClosed();
        await guard();
      };
      try {
        try {
          await verify();
        } catch {
          // Explicit recovery intent authorizes restoration after exact read-only
          // reconciliation failed; it does not replay the candidate reload.
          await guard();
          this.driver.select(baseline.identity);
          await this.driver.reload(guard);
          await verify();
        }
        return {
          kind: 'recovered',
          installedId: row.target_id,
          verifiedId: row.target_id,
        };
      } catch {
        return { kind: 'unknown', installedId: null, verifiedId: null };
      }
    };
    for (const ancestor of [...predecessors].reverse()) {
      if (signal.aborted) throw new Error('Reconciliation deadline exceeded');
      const prior = await this.boundary.inspect(token, ancestor.id);
      if (prior.state === 'complete') continue;
      if (
        prior.state === 'pending' &&
        prior.pending?.operationId !== ancestor.id
      )
        throw new Error('Reconciliation pending identity unavailable');
      const result = await this.boundary.execute(
        token,
        this.intent(ancestor),
        ancestor.kind === 'reconcile'
          ? establish
          : async () => ({
              kind: 'validation_failed' as const,
              installedId: null,
              verifiedId: null,
              failure: 'stale_dependencies' as const,
            }),
        establish,
        ancestor.predecessor_id ?? undefined,
      );
      if (result.kind === 'unknown' || result.kind === 'failed') {
        await this.store.finish(token, row, result);
        return;
      }
    }
    const complete = async (guard: () => Promise<void>) => {
      const result = await establish(guard);
      if (result.kind === 'recovered' || result.kind === 'verified') {
        await guard();
        if (!(await this.store.authorized(row)))
          throw new Error('Reconciliation authority unavailable');
        await this.admission.open();
      }
      return result;
    };
    const result = await this.boundary.execute(
      token,
      this.intent(row),
      complete,
      complete,
      predecessor.id,
    );
    await this.store.finish(token, row, result);
  }
  async execute(
    token: PbxOwnershipToken,
    operationId: string,
    preparation: Parameters<NativeOwnerPort['execute']>[2],
  ) {
    if (!uuid(operationId) || token.nodeId !== this.nodeId)
      throw new Error('Native request unavailable');
    if (this.busy.has(operationId)) return;
    if (this.busy.size >= 2)
      throw new Error('Native operation capacity unavailable');
    this.busy.add(operationId);
    let accepted: LiveIntentRow | null = null;
    try {
      const row = await this.store.intent(this.nodeId, operationId);
      if (!row || row.installation_id !== this.installationId)
        throw new Error('Native intent unavailable');
      const active = (
        await this.store.pool.query<{ active_operation_id: string }>(
          'SELECT active_operation_id FROM public.pbx_live_runtime WHERE node_id=$1',
          [this.nodeId],
        )
      ).rows[0];
      if (active?.active_operation_id !== row.id) return;
      accepted = row;
      const intent = this.intent(row);
      const inspection = await this.boundary.inspect(token, operationId);
      if (inspection.state === 'complete' && inspection.result) {
        await this.store.finish(token, row, inspection.result);
        return;
      }
      if (!(await this.store.beginAttempt(token, row))) {
        await this.store.finish(token, row, {
          kind: 'unknown',
          installedId: null,
          verifiedId: null,
        });
        return;
      }
      if (row.kind === 'reconcile') {
        await this.reconcile(token, row);
        return;
      }
      if (inspection.state === 'not_started') {
        let failure: BoundaryResult | null = null;
        if (!(await this.store.authorized(row)))
          failure = {
            kind: 'revoked',
            installedId: null,
            verifiedId: null,
            failure: 'originator_revoked',
          };
        else if (
          row.kind === 'apply' &&
          !(await this.store.dependenciesCurrent(token, row))
        )
          failure = {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: 'stale_dependencies',
          };
        else if (preparation && 'failure' in preparation)
          failure = {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: preparation.failure,
          };
        if (failure) {
          const result = await this.boundary.execute(
            token,
            intent,
            async () => failure!,
            async () => {
              throw new Error('Native reconciliation required');
            },
          );
          await this.store.finish(token, row, result);
          return;
        }
        if (row.kind === 'apply') {
          if (
            !row.snapshot ||
            !row.source_digest ||
            !row.compiler_version ||
            !row.policy_version ||
            !preparation ||
            !('material' in preparation)
          )
            throw new Error('Protected material unavailable');
          const identity: ArtifactIdentity = {
            nodeId: this.nodeId,
            installationId: this.installationId,
            revisionId: row.target_id,
            sequence: row.revision_sequence!,
            sourceDigest: row.source_digest,
            compilerVersion: row.compiler_version,
            policyVersion: row.policy_version,
          };
          this.artifacts.stage(
            identity,
            materializeRevision(
              row.snapshot,
              row.target_id,
              preparation.material,
            ),
          );
          this.plans.save({
            identity,
            snapshot: row.snapshot,
            unmanaged: this.driver.unmanaged(),
          });
        }
      }
      const candidate = this.plans.load(row.target_id),
        baseline = this.plans.load(row.expected_baseline_id);
      const signal = AbortSignal.timeout(300000);
      const result = await this.execution.run(
        {
          token,
          intent,
          candidate,
          baseline,
          recovery: row.kind === 'recover',
          signal,
        },
        {
          authorized: () => this.store.authorized(row),
          dependenciesCurrent: () => this.store.dependenciesCurrent(token, row),
          phase: async (state) =>
            this.store.phase(
              token,
              row,
              state,
              state === 'waiting'
                ? { validation: 'passed' }
                : state === 'installing'
                  ? { installation: 'uncertain' }
                  : state === 'reloading' || state === 'verifying'
                    ? { installation: 'installed' }
                    : state === 'recovering'
                      ? { recovery: 'pending' }
                      : {},
            ),
          probes: (artifact, scope) => this.probes.verify(artifact, scope),
        },
      );
      await this.store.finish(token, row, result);
    } catch {
      if (accepted)
        await this.store
          .finish(token, accepted, {
            kind: 'unknown',
            installedId: null,
            verifiedId: null,
          })
          .catch(() => {});
      throw new Error('Native operation requires reconciliation');
    } finally {
      this.busy.delete(operationId);
    }
  }
}
