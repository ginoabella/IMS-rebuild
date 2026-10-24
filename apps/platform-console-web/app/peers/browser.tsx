'use client';
import Link from 'next/link';
import { Button, Panel } from '@myims/ui-web';
import { usePeers, empty } from './use-peers';
import { PeerDetail } from './detail';
import { PeerForm } from './form';
export function PeerBrowser({ nodeId }: { nodeId: string }) {
  const model = usePeers({ nodeId });
  const {
    kind,
    setKind,
    state,
    save,
    page,
    after,
    setAfter,
    history,
    setHistory,
    message,
    setMessage,
    setErrors,
    blockers,
    canonical,
    setCanonical,
    pending,
    setConfirm,
    reload,
    inspect,
    review,
    run,
    blocked,
  } = model;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <Link
        href={`/pbx-nodes/${nodeId}`}
        className="text-[var(--accent-primary)] underline"
      >
        Back to PBX detail
      </Link>
      <h1 className="font-display text-2xl">Trunks, gateways and DIDs</h1>
      <p>
        Desired configuration only. Saving or enabling does not contact a
        provider, register, reload the PBX or establish voice readiness. PBX
        connectivity is not required.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant={kind === 'trunks' ? 'primary' : 'secondary'}
          disabled={pending}
          onClick={() => {
            setKind('trunks');
            setAfter(null);
            setHistory([]);
          }}
        >
          Trunks
        </Button>
        <Button
          variant={kind === 'gateways' ? 'primary' : 'secondary'}
          disabled={pending}
          onClick={() => {
            setKind('gateways');
            setAfter(null);
            setHistory([]);
          }}
        >
          Gateways
        </Button>
        <Button
          variant={kind === 'dids' ? 'primary' : 'secondary'}
          disabled={pending}
          onClick={() => {
            setKind('dids');
            setAfter(null);
            setHistory([]);
          }}
        >
          DIDs
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void reload()}
        >
          Reload list
        </Button>
      </div>
      {message && (
        <p role="status" className="break-words">
          {message}
        </p>
      )}
      {!!blockers.length && (
        <Panel
          aria-label={
            blockers.some((b) => b.kind === 'inbound' || b.kind === 'outbound')
              ? 'Referencing routing rules or resources'
              : kind === 'trunks'
                ? 'Referencing gateways'
                : 'Referencing DIDs'
          }
        >
          <h2>
            {blockers.some((b) => b.kind === 'inbound' || b.kind === 'outbound')
              ? 'Referencing routing rules or resources'
              : kind === 'trunks'
                ? 'Referencing gateways'
                : 'Referencing DIDs'}
          </h2>
          <ul>
            {blockers.map((b) => (
              <li key={b.id}>
                {b.kind === 'inbound' || b.kind === 'outbound' ? (
                  <Link
                    className="text-[var(--accent-primary)] underline"
                    href={`/pbx-nodes/${nodeId}/routing`}
                  >
                    {b.name} · manage in routing
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void inspect(
                        b.id,
                        kind === 'trunks' ? 'gateways' : 'dids',
                      )
                    }
                  >
                    {b.name}
                  </Button>
                )}
                <span className="break-all"> {b.id}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(state.review || state.attempt) && (
        <Panel aria-label="Canonical review">
          <p>
            Review the saved result before another change. Your entered values
            are retained.
          </p>
          <Button disabled={pending} onClick={() => void review()}>
            Reload canonical state
          </Button>
          {state.attempt?.parts.length === 2 && (
            <Button
              disabled={pending}
              variant="secondary"
              onClick={() => void run(state.attempt!, true)}
            >
              Retry exact create request
            </Button>
          )}
          {canonical && (
            <>
              <pre className="my-3 whitespace-pre-wrap break-all">
                {JSON.stringify(canonical, null, 2)}
              </pre>
              <Button
                disabled={pending}
                onClick={() => {
                  save({
                    ...state,
                    selected: canonical,
                    attempt: null,
                    review: false,
                    mode: canonical.removedAt ? 'detail' : state.mode,
                  });
                  setCanonical(null);
                  setMessage(
                    'Current version selected. Review retained inputs before saving.',
                  );
                }}
              >
                Use current version
              </Button>
            </>
          )}
        </Panel>
      )}
      <Panel aria-label={`${kind} list`}>
        <h2 className="font-display text-xl">
          {kind === 'trunks'
            ? 'Trunks'
            : kind === 'gateways'
              ? 'Gateways'
              : 'DIDs'}
        </h2>
        {!page ? (
          <p role="status">Loading resources…</p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border-default)]">
              {page.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="min-w-0 break-words">
                    {item.name}
                    {'number' in item ? ` · ${item.number}` : ''} ·{' '}
                    {item.enabled ? 'Enabled (desired)' : 'Disabled (desired)'}{' '}
                    · v{item.version}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={pending || !!state.attempt || state.review}
                    onClick={() => void inspect(item.id)}
                  >
                    Inspect {item.name}
                  </Button>
                </li>
              ))}
            </ul>
            {!page.items.length && (
              <p>No {kind} yet. Create a desired definition.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                disabled={!history.length || pending}
                onClick={() => {
                  setAfter(history.at(-1) ?? null);
                  setHistory(history.slice(0, -1));
                }}
              >
                Previous page
              </Button>
              <Button
                variant="secondary"
                disabled={!page.nextCursor || pending}
                onClick={() => {
                  setHistory([...history, after]);
                  setAfter(page.nextCursor);
                }}
              >
                Next page
              </Button>
            </div>
          </>
        )}
      </Panel>
      <Button
        disabled={blocked}
        onClick={() => {
          save({ ...empty(), mode: 'create' });
          setMessage('');
          setErrors({});
          setConfirm(false);
        }}
      >
        Create{' '}
        {kind === 'trunks' ? 'trunk' : kind === 'gateways' ? 'gateway' : 'DID'}
      </Button>
      <PeerDetail model={model} />
      <PeerForm model={model} />
    </div>
  );
}
