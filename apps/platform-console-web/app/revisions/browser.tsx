'use client';
import Link from 'next/link';
import { Button, Panel } from '@myims/ui-web';
import { RevisionReview } from './review';
import { LivePanel } from './live-panel';
import { useRevisions } from './use-revisions';
const linkClass = 'text-[var(--accent-primary)] underline';
export function RevisionsBrowser({ nodeId }: { nodeId: string }) {
  const {
    retained,
    pending,
    message,
    error,
    list,
    history,
    setAfter,
    setHistory,
    after,
    detail,
    baselineChoices,
    baselineAfter,
    save,
    run,
    capture,
    load,
    recover,
    inspect,
    baselines,
    validate,
  } = useRevisions(nodeId);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 break-words p-4">
      <Link className={linkClass} href={`/pbx-nodes/${nodeId}`}>
        Back to PBX detail
      </Link>
      <h1 className="font-display text-2xl">Configuration revisions</h1>
      <p>
        Capture desired configuration, review changes and run offline structural
        validation. Unallocated inventory and unbound routes remain
        calling-ineligible.
      </p>
      <p ref={error} tabIndex={-1} role="status">
        {pending ? 'Loading revisions…' : message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pending || !!retained.attempt}
          onClick={() => void run(() => capture(), true)}
        >
          Capture desired state
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void run(() => load())}
        >
          Reload revisions
        </Button>
      </div>
      {retained.attempt && (
        <Panel title="Capture outcome uncertain">
          <p>
            The exact request is retained for this operator. Recover its receipt
            or retry the same request.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending} onClick={() => void run(recover)}>
              Recover capture receipt
            </Button>
            <Button
              disabled={pending}
              onClick={() => void run(() => capture(true), true)}
            >
              Retry exact capture
            </Button>
          </div>
        </Panel>
      )}
      <Panel title="Captured history">
        {!list ? (
          <p>Loading history…</p>
        ) : !list.items.length ? (
          <p>No revisions captured. Capture desired state to begin.</p>
        ) : (
          <ul className="space-y-2">
            {list.items.map((r) => (
              <li key={r.id}>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void run(() => inspect(r.id))}
                >
                  Revision {r.sequence}
                </Button>{' '}
                <span>
                  {r.createdAt} · {r.createdBy}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-3">
          <Button
            variant="secondary"
            disabled={pending || !history.length}
            onClick={() => {
              setAfter(history.at(-1) ?? null);
              setHistory((x) => x.slice(0, -1));
            }}
          >
            Previous revisions
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !list?.nextCursor}
            onClick={() => {
              setHistory((x) => [...x, after]);
              setAfter(list?.nextCursor ?? null);
            }}
          >
            Next revisions
          </Button>
        </div>
      </Panel>
      <Panel title="Comparison baseline">
        <label htmlFor="revision-baseline">Captured baseline</label>
        <select
          id="revision-baseline"
          className="mx-2 max-w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2"
          disabled={pending || !!retained.attempt}
          value={retained.baseline}
          onChange={(e) => {
            save({ ...retained, baseline: e.target.value });
          }}
        >
          <option value="">
            Saved capture baseline (none for a new capture)
          </option>
          {[
            ...new Map(
              [...baselineChoices, ...(list?.items ?? [])].map((r) => [
                r.id,
                r,
              ]),
            ).values(),
          ].map((r) => (
            <option value={r.id} key={r.id}>
              Revision {r.sequence}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          disabled={pending || (baselineChoices.length > 0 && !baselineAfter)}
          onClick={() => void run(baselines)}
        >
          Load more baselines
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !retained.selected}
          onClick={() => void run(() => load())}
        >
          Compare baseline
        </Button>
      </Panel>
      <LivePanel nodeId={nodeId} detail={detail} />
      {detail && (
        <RevisionReview
          detail={detail}
          nodeId={nodeId}
          pending={pending}
          onValidate={() => void run(() => validate(detail.revision.id), true)}
        />
      )}
    </div>
  );
}
