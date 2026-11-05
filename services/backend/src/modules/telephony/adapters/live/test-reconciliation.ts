import type { LiveExecutionStore } from './execution-store';
import type { NativeAdmissionBarrier } from './admission';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { tenantVerificationAudit } from '../../application/tenant-verification';
/** Reconcile activity only; never dispatch or infer a successful call. */
export async function reconcileRouteTest(
  nodeId: string,
  artifactId: string,
  store: LiveExecutionStore,
  barrier: NativeAdmissionBarrier,
  guard: () => Promise<void>,
) {
  const intent = (
    await store.pool.query<{
      id: string;
      test_id: string;
      operator_id: string;
      authentication_version: number;
      tenant_id: string;
    }>(
      `SELECT x.*,i.tenant_id FROM public.tenant_route_test_reconciliation_intents x JOIN public.tenant_route_test_intents i ON i.id=x.test_id JOIN public.tenant_route_test_progress p ON p.intent_id=i.id WHERE i.node_id=$1 AND p.state='unknown' AND NOT EXISTS(SELECT 1 FROM public.tenant_route_test_reconciliation_results r WHERE r.intent_id=x.id) ORDER BY x.created_at LIMIT 1`,
      [nodeId],
    )
  ).rows[0];
  if (!intent) return;
  const check = async () => {
    await guard();
    const actor = await new PlatformAuthorityRepository(store.database).byId({
      plane: 'platform',
      operatorId: intent.operator_id,
    });
    if (
      actor.kind !== 'eligible' ||
      actor.snapshot.authenticationVersion !== intent.authentication_version
    )
      throw new Error('Reconciliation authority unavailable');
  };
  await check();
  await barrier.begin(Date.now() + 30000, new AbortController().signal, check);
  await check();
  await barrier.quiet(Date.now() + 3000, new AbortController().signal, check);
  await check();
  await barrier.open();
  await Transaction.run(
    store.pool,
    {
      actor: {
        kind: 'system',
        plane: 'system',
        reference: 'native-test-reconciliation',
        tenantId: null,
        reason: 'operator-requested-call-safety-reconciliation',
      },
      target: {
        type: 'tenant-route-verification',
        reference: nodeId,
        tenantId: null,
      },
      correlationId: intent.id,
    },
    'telephony.test-reconciliation',
    new SafeLogger('telephony'),
    async (tx) => {
      await tx.query('SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE', [
        nodeId,
      ]);
      const epoch = (
        await tx.query<{ epoch: string }>(
          `SELECT o.epoch::text AS epoch FROM public.pbx_live_runtime r JOIN public.pbx_ownership o ON o.node_id=r.node_id WHERE r.node_id=$1 AND r.verified_id=$2 AND r.boundary_epoch=o.epoch AND o.expires_at>clock_timestamp()`,
          [nodeId, artifactId],
        )
      ).rows[0]?.epoch;
      if (!epoch) throw new Error('Native owner unavailable');
      await tx.query(
        'INSERT INTO public.tenant_route_test_reconciliation_results(intent_id,owner_epoch) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [intent.id, epoch],
      );
      await tx.query(
        `UPDATE public.tenant_route_test_progress SET state='failed',updated_at=clock_timestamp() WHERE intent_id=$1 AND state='unknown'`,
        [intent.test_id],
      );
      await new AuditRepository().append(tx, tenantVerificationAudit, {
        nodeId,
        tenantId: intent.tenant_id,
        operationId: intent.id,
        action: 'reconcile',
      });
    },
  );
}
