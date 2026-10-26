import type { PbxOwnershipToken } from '../../application/observation-ports';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import type { ArtifactIdentity } from './artifact-store';
import type { NativePbxDriver } from './native-driver';
import { NativePbxFailure } from './native-driver';
import type { NativeAdmissionBarrier } from './admission';
import type { BoundaryIntent, BoundaryResult } from './mutation-boundary';
import { PhysicalMutationBoundary } from './mutation-boundary';

export interface RetainedLiveArtifact {
  identity: ArtifactIdentity;
  snapshot: RevisionSnapshot;
  unmanaged: string;
}
export interface VerifiedExecutionRequest {
  token: PbxOwnershipToken;
  intent: BoundaryIntent;
  candidate: RetainedLiveArtifact;
  baseline: RetainedLiveArtifact;
  recovery: boolean;
  signal: AbortSignal;
}
/** All implementations are private trusted composition, never HTTP arguments. */
export interface LiveExecutionProof {
  authorized(): Promise<boolean>;
  dependenciesCurrent(): Promise<boolean>;
  phase(
    state:
      | 'validating'
      | 'waiting'
      | 'installing'
      | 'reloading'
      | 'verifying'
      | 'recovering',
  ): Promise<void>;
  /** Independent bounded controlled probes, including resource/profile/material facts. */
  probes(artifact: RetainedLiveArtifact, signal: AbortSignal): Promise<void>;
}
/**
 * The complete native effect/recovery algorithm. Promotion is impossible without
 * an independently supplied probe implementation. A reload ACK is never proof.
 * Callers persist the boundary result under the same canonical ownership fence.
 */
export class VerifiedLiveExecution {
  constructor(
    private readonly boundary: PhysicalMutationBoundary,
    private readonly driver: Pick<
      NativePbxDriver,
      'validate' | 'select' | 'reload' | 'verify' | 'drain'
    >,
    private readonly admission: Pick<
      NativeAdmissionBarrier,
      'begin' | 'quiet' | 'close' | 'open' | 'assertClosed'
    >,
  ) {}
  async run(
    request: VerifiedExecutionRequest,
    proof: LiveExecutionProof,
  ): Promise<BoundaryResult> {
    const { token, intent, candidate, baseline, signal } = request;
    if (
      candidate.identity.nodeId !== token.nodeId ||
      baseline.identity.nodeId !== token.nodeId ||
      candidate.identity.installationId !== baseline.identity.installationId ||
      candidate.identity.revisionId !== intent.revisionId ||
      baseline.identity.revisionId !== intent.expectedBaselineId
    )
      throw new NativePbxFailure('boundary_unavailable');
    await this.boundary.takeover(token);
    const verified = async (
      artifact: RetainedLiveArtifact,
      guard: () => Promise<void>,
    ) => {
      await guard();
      await this.admission.assertClosed();
      await this.admission.quiet(Date.now() + 120000, signal, guard);
      await this.driver.verify(
        artifact.identity,
        artifact.snapshot,
        artifact.unmanaged,
      );
      await proof.probes(artifact, signal);
      await this.admission.assertClosed();
      await guard();
    };
    const result = (
      artifact: RetainedLiveArtifact,
      recovered: boolean,
    ): BoundaryResult => ({
      kind: recovered ? 'recovered' : 'verified',
      installedId: artifact.identity.revisionId,
      verifiedId: artifact.identity.revisionId,
    });
    const restore = async (
      guard: () => Promise<void>,
    ): Promise<BoundaryResult> => {
      // Never race a timed-out, already dispatched native command with restore.
      await this.driver.drain();
      await guard();
      await this.admission.assertClosed();
      await proof.phase('recovering');
      await this.admission.quiet(Date.now() + 120000, signal, guard);
      await guard();
      this.driver.select(baseline.identity);
      await this.driver.reload(guard);
      await verified(baseline, guard);
      await this.admission.open();
      return result(baseline, true);
    };
    return this.boundary.execute(
      token,
      intent,
      async (ownerGuard) => {
        const guard = async () => {
          if (signal.aborted)
            throw new NativePbxFailure('boundary_unavailable');
          await ownerGuard();
        };
        if (!(await proof.authorized()))
          return {
            kind: 'revoked',
            installedId: null,
            verifiedId: null,
            failure: 'originator_revoked',
          };
        if (!request.recovery && !(await proof.dependenciesCurrent()))
          return {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: 'stale_dependencies',
          };
        await proof.phase('validating');
        try {
          await this.driver.validate(candidate.identity, candidate.snapshot);
        } catch {
          return {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: 'validation_failed',
          };
        }
        await guard();
        // Authority may change while isolated validation runs. Browser expiry is
        // irrelevant; canonical account/grant changes are rechecked before effects.
        if (!(await proof.authorized()))
          return {
            kind: 'revoked',
            installedId: null,
            verifiedId: null,
            failure: 'originator_revoked',
          };
        if (!request.recovery && !(await proof.dependenciesCurrent()))
          return {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: 'stale_dependencies',
          };
        await proof.phase('waiting');
        await this.admission.begin(Date.now() + 120000, signal, guard);
        // Waiting can outlive account or desired-source changes. Recheck at the
        // actual admission boundary, then reject without touching the selected set.
        if (!(await proof.authorized())) {
          await guard();
          await this.admission.open();
          return {
            kind: 'revoked',
            installedId: null,
            verifiedId: null,
            failure: 'originator_revoked',
          };
        }
        if (!request.recovery && !(await proof.dependenciesCurrent())) {
          await guard();
          await this.admission.open();
          return {
            kind: 'validation_failed',
            installedId: null,
            verifiedId: null,
            failure: 'stale_dependencies',
          };
        }
        let selected = false;
        let failure:
          'install_failed' | 'reload_failed' | 'verification_failed' =
          'install_failed';
        try {
          await guard();
          await this.admission.assertClosed();
          await proof.phase(request.recovery ? 'recovering' : 'installing');
          // From this point a failure is uncertain even when selection throws.
          selected = true;
          this.driver.select(candidate.identity);
          failure = 'reload_failed';
          await proof.phase('reloading');
          await this.driver.reload(guard);
          failure = 'verification_failed';
          await proof.phase('verifying');
          await verified(candidate, guard);
          await this.admission.open();
          return result(candidate, request.recovery);
        } catch {
          if (!selected) throw new NativePbxFailure('boundary_unavailable');
          try {
            return { ...(await restore(guard)), failure };
          } catch {
            // Retain pending intent, both sets and pins. No health/promotion claim.
            return { kind: 'unknown', installedId: null, verifiedId: null };
          }
        }
      },
      async (guard) => {
        // Crash/timeout reconciliation first reads exact loaded facts. Never replay
        // the interrupted candidate reload. If neither set verifies, leave the gate
        // closed until an explicit audited recovery can establish the baseline.
        await guard();
        await this.admission.close();
        for (const artifact of [candidate, baseline]) {
          try {
            await verified(artifact, guard);
            await this.admission.open();
            const reconciled = result(
              artifact,
              request.recovery || artifact === baseline,
            );
            // A healthy old baseline cannot establish candidate verification.
            // The candidate was just independently checked and did not match.
            return artifact === baseline &&
              candidate.identity.revisionId !== baseline.identity.revisionId
              ? { ...reconciled, failure: 'verification_failed' }
              : reconciled;
          } catch {
            /* Try the other exact retained identity, without mutation. */
          }
        }
        return { kind: 'unknown', installedId: null, verifiedId: null };
      },
    );
  }
}
