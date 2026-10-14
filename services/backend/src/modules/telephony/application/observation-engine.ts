import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { ApprovedPbxCatalog } from '../domain/connectivity';
import type { ObservationSettings } from '../domain/observation-settings';
import type {
  ObservationStore,
  PbxObservationAdapter,
  PbxObservationSession,
  PbxOwnershipToken,
  ObservationTarget,
} from './observation-ports';

/** Protocol- and database-independent engine. Adapter snapshots are the only live facts. */
export class ObservationEngine {
  readonly incarnation = randomUUID();
  private readonly stopping = new AbortController();
  private readonly nodes = new Map<
    string,
    { cancel: AbortController; done: Promise<void> }
  >();
  private scanner?: Promise<void>;
  constructor(
    private readonly store: ObservationStore,
    private readonly catalog: ApprovedPbxCatalog,
    private readonly adapter: PbxObservationAdapter,
    private readonly settings: Readonly<ObservationSettings>,
  ) {}
  async start() {
    // Startup must actually reach authoritative database state.
    await this.store.discover();
    this.scanner = this.scan();
  }
  private async scan() {
    let after: string | null = null;
    while (!this.stopping.signal.aborted) {
      try {
        const targets = await this.store.discover(after);
        after =
          targets.length === 100
            ? (targets[targets.length - 1]?.id ?? null)
            : null;
        for (const target of targets) {
          if (
            this.stopping.signal.aborted ||
            this.nodes.size >= this.settings.concurrency
          )
            break;
          if (this.nodes.has(target.id)) continue;
          const started = performance.now();
          const token = await this.store.acquire(target.id, this.incarnation);
          if (!token) continue;
          // Discovery may race a connectivity edit before acquisition. Never
          // qualify the old descriptor with a token for the newer desired version.
          if (token.desiredVersion !== target.version) {
            await this.store.release(token);
            continue;
          }
          const cancel = new AbortController();
          if (this.stopping.signal.aborted) cancel.abort();
          const done = this.observe(target, token, cancel, started)
            .catch(() => {})
            .finally(() => this.nodes.delete(target.id));
          this.nodes.set(target.id, { cancel, done });
        }
      } catch {
        // Database discovery uncertainty also cancels every local node.
        for (const node of this.nodes.values()) node.cancel.abort();
      }
      try {
        await delay(1000, undefined, { signal: this.stopping.signal });
      } catch {
        break;
      }
    }
  }
  private async observe(
    target: ObservationTarget,
    initial: PbxOwnershipToken,
    cancel: AbortController,
    acquiredAt: number,
  ) {
    let token = initial;
    let session: PbxObservationSession | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let wake: ReturnType<typeof setTimeout> | undefined;
    let rotation: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: Promise<void> = Promise.resolve();
    const arm = (started: number) => {
      if (deadline) clearTimeout(deadline);
      deadline = setTimeout(
        () => cancel.abort(),
        Math.max(0, this.settings.leaseMs - (performance.now() - started)),
      );
    };
    arm(acquiredAt);
    const close = () => session?.close();
    cancel.signal.addEventListener('abort', close, { once: true });
    const renew = () => {
      wake = setTimeout(() => {
        heartbeat = (async () => {
          const started = performance.now();
          try {
            const next = await this.store.renew(token);
            if (
              !next ||
              cancel.signal.aborted ||
              performance.now() - started >= this.settings.leaseMs
            ) {
              cancel.abort();
              return;
            }
            token = next;
            arm(started);
            renew();
          } catch {
            cancel.abort();
          }
        })();
      }, this.settings.renewMs);
    };
    renew();
    let sequence = 0,
      attempts = 0,
      connectedAt = 0;
    try {
      while (!cancel.signal.aborted) {
        const profile = this.catalog.resolve(target.targetAlias);
        if (!profile || profile.installationId !== target.installationId) {
          await this.store.fail(token, 'destination_denied');
          break;
        }
        if (
          !session ||
          performance.now() - connectedAt >= this.settings.rotationMs
        ) {
          if (session && !(await this.store.fail(token, 'disconnected'))) {
            cancel.abort();
            break;
          }
          session?.close();
          session = undefined;
          const opened = await this.adapter.open(
            profile,
            target.credentialAlias,
            cancel.signal,
          );
          if (cancel.signal.aborted) {
            if (opened.kind === 'connected') opened.session.close();
            break;
          }
          if (opened.kind === 'failed') {
            if (!(await this.store.fail(token, opened.failure))) {
              cancel.abort();
              break;
            }
          } else {
            session = opened.session;
            connectedAt = performance.now();
            if (rotation) clearTimeout(rotation);
            const connectedSession = opened.session;
            rotation = setTimeout(() => {
              try {
                connectedSession.close();
              } catch {
                cancel.abort();
              }
            }, this.settings.rotationMs);
          }
        }
        if (session) {
          const snapshotToken = { ...token };
          const result = await session.snapshot(cancel.signal);
          if (cancel.signal.aborted) break;
          if (result.kind === 'complete' && !session.ended.aborted) {
            if (
              !(await this.store.publish(
                snapshotToken,
                sequence + 1,
                result.registrations,
                AbortSignal.any([cancel.signal, session.ended]),
              ))
            ) {
              if (cancel.signal.aborted || session.ended.aborted) {
                cancel.abort();
                break;
              }
              // A name-only edit may advance version within the same epoch. Reconcile
              // using a fresh canonical renewal; any other loss cancels this generation.
              const started = performance.now();
              const next = await this.store.renew(token);
              if (
                !next ||
                next.desiredVersion === snapshotToken.desiredVersion
              ) {
                cancel.abort();
                break;
              }
              token = next;
              arm(started);
              continue;
            }
            sequence++;
            attempts = 0;
            try {
              await delay(this.settings.cadenceMs, undefined, {
                signal: AbortSignal.any([cancel.signal, session.ended]),
              });
            } catch {
              if (cancel.signal.aborted) break;
            }
            continue;
          }
          if (
            !(await this.store.fail(
              token,
              result.kind === 'complete' ? 'disconnected' : result.failure,
            ))
          ) {
            cancel.abort();
            break;
          }
          session.close();
          session = undefined;
          if (rotation) clearTimeout(rotation);
          rotation = undefined;
        }
        const wait = Math.min(
          this.settings.retryMaxMs,
          1000 * 2 ** Math.min(attempts++, 4),
        );
        await delay(wait, undefined, { signal: cancel.signal });
      }
    } catch {
      cancel.abort();
    } finally {
      cancel.abort();
      session?.close();
      if (wake) clearTimeout(wake);
      if (deadline) clearTimeout(deadline);
      if (rotation) clearTimeout(rotation);
      await heartbeat;
      try {
        await this.store.release(token);
      } catch {
        /* expiry is the final release guard */
      }
      cancel.signal.removeEventListener('abort', close);
    }
  }
  async stop() {
    this.stopping.abort();
    for (const node of this.nodes.values()) node.cancel.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([
          this.scanner,
          ...[...this.nodes.values()].map((n) => n.done),
        ]),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, this.settings.drainMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
