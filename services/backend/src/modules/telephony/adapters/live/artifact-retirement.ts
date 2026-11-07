import {
  mkdirSync,
  lstatSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  constants,
  readFileSync,
} from 'node:fs';
import type { LiveExecutionStore } from './execution-store';
import type { NativePbxDriver } from './native-driver';
import type { NativeAdmissionBarrier } from './admission';
import type { ProtectedArtifactStore } from './artifact-store';
import type { RetainedLivePlans } from './retained-plans';
import {
  retirementEligible,
  retirementAudit,
} from '../../application/artifact-retirement';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { canonical } from '../../domain/revision-snapshot';
/** Narrow exact-artifact metadata retirement; no artifact/material deletion. */
export async function retireArtifact(
  root: string,
  nodeId: string,
  store: LiveExecutionStore,
  driver: NativePbxDriver,
  barrier: NativeAdmissionBarrier,
  plans: RetainedLivePlans,
  artifacts: ProtectedArtifactStore,
  exclusive: <T>(
    artifactId: string,
    action: (guard: () => Promise<void>) => Promise<T>,
  ) => Promise<T>,
) {
  const intent = (
    await store.pool.query<{
      id: string;
      artifact_id: string;
      replacement_id: string;
      resource_id: string;
      operator_id: string;
      authentication_version: number;
      dispatch_epoch: string | null;
    }>(
      `SELECT i.*,p.owner_epoch::text AS dispatch_epoch FROM public.pbx_live_runtime r JOIN public.pbx_artifact_retirement_intents i ON i.id=r.active_retirement_id JOIN public.pbx_artifact_retirement_progress p ON p.intent_id=i.id WHERE r.node_id=$1 AND p.state='queued'`,
      [nodeId],
    )
  ).rows[0];
  if (!intent) return;
  const markUnknown = async () => {
    await Transaction.run(
      store.pool,
      {
        actor: {
          kind: 'system',
          reference: 'native-retirement',
          plane: 'system',
          tenantId: null,
          reason: 'uncertain-exact-artifact-retirement',
        },
        target: {
          type: 'pbx-artifact-retirement',
          reference: nodeId,
          tenantId: null,
        },
        correlationId: intent.id,
      },
      'telephony.retirement-unknown',
      new SafeLogger('telephony'),
      async (tx) => {
        const changed = await tx.query(
          `UPDATE public.pbx_artifact_retirement_progress SET state='unknown',updated_at=clock_timestamp() WHERE intent_id=$1 AND state='queued' RETURNING intent_id`,
          [intent.id],
        );
        if (changed.rows.length)
          await new AuditRepository().append(tx, retirementAudit, {
            operationId: intent.id,
            artifactId: intent.artifact_id,
            nodeId,
            action: 'unknown',
          });
      },
    );
  };
  let dispatchEpoch: string | null = intent.dispatch_epoch;
  await exclusive(intent.replacement_id, async (guard) => {
    const checked = async () => {
      await guard();
      const authority = await new PlatformAuthorityRepository(
        store.database,
      ).byId({ plane: 'platform', operatorId: intent.operator_id });
      if (
        authority.kind !== 'eligible' ||
        authority.snapshot.authenticationVersion !==
          intent.authentication_version ||
        !(await store.database.read((s) =>
          retirementEligible(
            s,
            nodeId,
            intent.artifact_id,
            intent.replacement_id,
            intent.resource_id,
          ),
        ))
      )
        throw new Error('Retirement authority unavailable');
    };
    try {
      await checked();
      if (dispatchEpoch !== null) {
        await markUnknown();
        return;
      }
      dispatchEpoch = await Transaction.run(
        store.pool,
        {
          actor: {
            kind: 'system',
            reference: 'native-retirement',
            plane: 'system',
            tenantId: null,
            reason: 'committed-exact-artifact-retirement',
          },
          target: {
            type: 'pbx-artifact-retirement',
            reference: nodeId,
            tenantId: null,
          },
          correlationId: intent.id,
        },
        'telephony.retirement-dispatch',
        new SafeLogger('telephony'),
        async (tx) => {
          await tx.query(
            'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
            [nodeId],
          );
          const claimed = (
            await tx.query<{ epoch: string }>(
              `UPDATE public.pbx_artifact_retirement_progress p SET owner_epoch=o.epoch,updated_at=clock_timestamp() FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE p.intent_id=$2 AND r.node_id=$1 AND r.active_retirement_id=p.intent_id AND r.boundary_epoch=o.epoch AND o.expires_at>clock_timestamp() AND p.state='queued' AND p.owner_epoch IS NULL RETURNING p.owner_epoch::text AS epoch`,
              [nodeId, intent.id],
            )
          ).rows[0];
          if (!claimed)
            throw new Error('Retirement dispatch no longer current');
          return claimed.epoch;
        },
      );
      await checked();
      await barrier.begin(
        Date.now() + 30000,
        new AbortController().signal,
        checked,
      );
      await checked();
      const replacement = plans.load(intent.replacement_id);
      await driver.verify(
        replacement.identity,
        replacement.snapshot,
        replacement.unmanaged,
      );
      // Independently prove the immutable initial recovery baseline descriptor remains retained.
      const initial = readFileSync(root + '/initial-baseline', 'utf8');
      const initialPlan = plans.load(initial);
      artifacts.load(initialPlan.identity);
      if (
        initialPlan.identity.compilerVersion !== 'baseline-1' ||
        [
          initialPlan.snapshot.extensions,
          initialPlan.snapshot.trunks,
          initialPlan.snapshot.gateways,
          initialPlan.snapshot.dids,
          initialPlan.snapshot.groups,
          initialPlan.snapshot.inbound,
          initialPlan.snapshot.outbound,
        ].some((resources) => resources.length > 0)
      )
        throw new Error('Initial recovery resource absence unavailable');
      const directory = root + '/retired';
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const stat = lstatSync(directory);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.uid !== 0 ||
        stat.mode & 0o077
      )
        throw new Error('Retirement custody unavailable');
      const receipt = canonical({
        artifactId: intent.artifact_id,
        replacementId: intent.replacement_id,
        resourceId: intent.resource_id,
        intentId: intent.id,
      });
      const path = directory + '/' + intent.artifact_id + '.json';
      try {
        const fd = openSync(
          path,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        );
        try {
          writeFileSync(fd, receipt);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
      } catch (e) {
        if (!(e && typeof e === 'object' && 'code' in e && e.code === 'EEXIST'))
          throw e;
        const previous = JSON.parse(readFileSync(path, 'utf8')) as Record<
          string,
          unknown
        >;
        if (
          previous.artifactId !== intent.artifact_id ||
          previous.replacementId !== intent.replacement_id ||
          previous.resourceId !== intent.resource_id
        )
          throw new Error('Retirement receipt conflicts', { cause: e });
      }
      const fd = openSync(
        directory,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      await checked();
      await barrier.quiet(
        Date.now() + 5000,
        new AbortController().signal,
        checked,
      );
      // Open only after native recovery denial is durable; SQL still blocks new operations.
      await checked();
      await barrier.open();
      await checked();
      await Transaction.run(
        store.pool,
        {
          actor: {
            kind: 'system',
            reference: 'native-retirement',
            plane: 'system',
            tenantId: null,
            reason: 'approved-exact-artifact-retirement',
          },
          target: {
            type: 'pbx-artifact-retirement',
            reference: nodeId,
            tenantId: null,
          },
          correlationId: intent.id,
        },
        'telephony.retirement',
        new SafeLogger('telephony'),
        async (tx) => {
          await tx.query(
            'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
            [nodeId],
          );
          if (
            !(await retirementEligible(
              tx,
              nodeId,
              intent.artifact_id,
              intent.replacement_id,
              intent.resource_id,
            ))
          )
            throw new Error('Retirement no longer applicable');
          const epoch = (
            await tx.query<{ epoch: string }>(
              `SELECT o.epoch::text AS epoch FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE r.node_id=$1 AND r.active_retirement_id=$2 AND r.boundary_epoch=o.epoch AND o.epoch=$3 AND o.expires_at>clock_timestamp()`,
              [nodeId, intent.id, dispatchEpoch],
            )
          ).rows[0]?.epoch;
          if (!epoch) throw new Error('Retirement owner unavailable');
          await tx.query(
            'INSERT INTO public.pbx_artifact_retirements(artifact_id,intent_id,replacement_id,owner_epoch) VALUES($1,$2,$3,$4)',
            [intent.artifact_id, intent.id, intent.replacement_id, epoch],
          );
          await tx.query(
            `UPDATE public.pbx_live_pins SET released_at=clock_timestamp(),release_operation_id=NULL,release_retirement_id=$2 WHERE revision_id=(SELECT revision_id FROM public.pbx_live_artifacts WHERE id=$1) AND released_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.pbx_live_artifacts sibling WHERE sibling.node_id=public.pbx_live_pins.node_id AND sibling.revision_id=public.pbx_live_pins.revision_id AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements retired WHERE retired.artifact_id=sibling.id))`,
            [intent.artifact_id, intent.id],
          );
          await tx.query(
            `WITH RECURSIVE chain AS (SELECT id,predecessor_id FROM public.pbx_artifact_retirement_intents WHERE id=$1 UNION ALL SELECT i.id,i.predecessor_id FROM public.pbx_artifact_retirement_intents i JOIN chain c ON c.predecessor_id=i.id) UPDATE public.pbx_artifact_retirement_progress SET state='retired',owner_epoch=$2,updated_at=clock_timestamp() WHERE intent_id IN (SELECT id FROM chain)`,
            [intent.id, epoch],
          );
          await tx.query(
            'UPDATE public.pbx_live_runtime SET active_retirement_id=NULL WHERE node_id=$1 AND active_retirement_id=$2',
            [nodeId, intent.id],
          );
          await new AuditRepository().append(tx, retirementAudit, {
            operationId: intent.id,
            artifactId: intent.artifact_id,
            nodeId,
            action: 'retired',
          });
        },
      );
    } catch {
      // Native tombstones and pins are never undone on uncertainty. An explicit
      // reviewed reconciliation must establish safety before conflicting work.
      await markUnknown();
    }
  });
}
