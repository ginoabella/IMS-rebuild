import { setTimeout as delay } from 'node:timers/promises';
import type {
  ObservationTarget,
  PbxOwnedExecution,
  PbxOwnershipToken,
} from '../../application/observation-ports';
import type { LiveMaterial } from './materialize';
import { LiveMaterialFailure } from './exact-material';
import { LiveMaterialResolver } from './material-resolver';
import { LiveExecutionStore } from './execution-store';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
export interface NativeOwnerPort {
  /** Physical takeover acknowledgement and independently established baseline. */
  connect(token: PbxOwnershipToken): Promise<void>;
  inspect(
    token: PbxOwnershipToken,
    operationId: string,
  ): Promise<'not_started' | 'pending' | 'complete'>;
  execute(
    token: PbxOwnershipToken,
    operationId: string,
    preparation:
      | { material: LiveMaterial }
      | { failure: LiveMaterialFailure['code'] }
      | null,
  ): Promise<void>;
}
/** Same telephony process/lease as observation; no independent owner acquisition. */
export class LiveOwnerExecutor implements PbxOwnedExecution {
  private nextCustodyCheck = 0;
  constructor(
    private readonly installationId: string,
    private readonly nodeId: string,
    private readonly store: LiveExecutionStore,
    private readonly resolver: LiveMaterialResolver,
    private readonly native: NativeOwnerPort,
  ) {}
  async run(
    target: ObservationTarget,
    current: () => PbxOwnershipToken,
    signal: AbortSignal,
  ): Promise<void> {
    if (
      target.installationId !== this.installationId ||
      target.id !== this.nodeId
    )
      return;
    while (!signal.aborted) {
      try {
        await this.native.connect(current());
        if (signal.aborted) return;
        await this.store.heartbeat(current());
        await this.checkPreparationCustody(current(), signal);
        const operation = await this.store.next(target.id);
        if (operation) {
          const row = await this.store.intent(target.id, operation);
          if (!row) throw new Error('Live intent unavailable');
          const state = await this.native.inspect(current(), operation);
          let preparation: Parameters<NativeOwnerPort['execute']>[2] = null;
          if (state === 'not_started' && row.kind === 'apply' && row.snapshot) {
            // A revoked/stale request reaches the native boundary without secret
            // access, where its rejection consumes the ordered receipt durably.
            if (
              (await this.store.authorized(row)) &&
              (await this.store.dependenciesCurrent(current(), row))
            ) {
              try {
                preparation = {
                  material: await this.resolver.resolve(row.snapshot, signal),
                };
              } catch (error) {
                preparation = {
                  failure:
                    error instanceof LiveMaterialFailure
                      ? error.code
                      : 'material_unavailable',
                };
              }
            }
          }
          if (signal.aborted) return;
          await this.native.execute(current(), operation, preparation);
        }
      } catch {
        // Bounded private transport failures never trigger blind candidate replay.
        // Native inspect decides whether exact material preparation is admissible.
      }
      try {
        await delay(1000, undefined, { signal });
      } catch {
        return;
      }
    }
  }
  private async checkPreparationCustody(
    token: PbxOwnershipToken,
    signal: AbortSignal,
  ) {
    if (Date.now() < this.nextCustodyCheck) return;
    this.nextCustodyCheck = Date.now() + 5000;
    const row = (
      await this.store.pool.query<{
        snapshot: RevisionSnapshot;
        source_digest: string;
      }>(
        `SELECT v.snapshot,v.source_digest FROM public.pbx_live_runtime r JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE r.node_id=$1 AND r.boundary_epoch=$2 AND r.installed_id=r.verified_id AND r.runtime_state='verified' AND EXISTS(SELECT 1 FROM public.tenant_call_preparations p WHERE p.node_id=r.node_id)`,
        [this.nodeId, token.epoch],
      )
    ).rows[0];
    if (!row) return;
    let valid = false;
    let verifiedPreparations: string[] = [];
    try {
      // Exact GETs remain solely in the existing protected consumer. Discard material.
      verifiedPreparations = await this.resolver.preparationCustody(
        this.nodeId,
        signal,
      );
      await this.resolver.resolve(row.snapshot, signal);
      valid = !signal.aborted;
    } catch {
      /* Expired/denied/unavailable custody never promotes availability. */
    }
    const client = await this.store.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      // Publication uses the exclusive node lock. Take a fresh statement snapshot
      // after this lock; an earlier in-flight GET cannot restore an invalid proof.
      await client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR SHARE',
        [this.nodeId],
      );
      valid = valid && !signal.aborted;
      await client.query(
        `INSERT INTO public.tenant_call_custody_proofs(node_id,owner_epoch,source_digest,valid) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM public.pbx_ownership o WHERE o.node_id=$1 AND o.epoch=$2 AND o.expires_at>clock_timestamp()) AND (NOT $4 OR ARRAY(SELECT p.id FROM public.tenant_call_preparations p LEFT JOIN LATERAL (SELECT action FROM public.tenant_call_preparation_events e WHERE e.preparation_id=p.id ORDER BY version DESC LIMIT 1) e ON true WHERE p.node_id=$1 AND e.action IS DISTINCT FROM 'disable' AND EXISTS(SELECT 1 FROM public.tenant_call_preparation_steps s WHERE s.preparation_id=p.id AND s.step='cases' AND s.phase='outcome') ORDER BY p.id LIMIT 17)=$5::uuid[]) ON CONFLICT(node_id) DO UPDATE SET owner_epoch=excluded.owner_epoch,source_digest=excluded.source_digest,valid=excluded.valid,checked_at=clock_timestamp()`,
        [
          this.nodeId,
          token.epoch,
          row.source_digest,
          valid,
          verifiedPreparations,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }
}
