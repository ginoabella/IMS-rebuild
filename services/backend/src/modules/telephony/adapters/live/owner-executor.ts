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
}
