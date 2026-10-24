'use client';
import Link from 'next/link';
import { Button, Panel } from '@myims/ui-web';
import { useRouting, empty, form } from './use-routing';
import { RoutingForm } from './form';
export function RoutingBrowser({ nodeId }: { nodeId: string }) {
  const m = useRouting({ nodeId });
  const {
    kind,
    setKind,
    state,
    save,
    page,
    pending,
    blocked,
    message,
    blockers,
    canonical,
    setCanonical,
    setMessage,
    run,
    r,
    confirm,
    setConfirm,
  } = m;
  const label =
    kind === 'outbound'
      ? 'outbound rule'
      : kind === 'inbound'
        ? 'inbound rule'
        : kind === 'groups'
          ? 'group'
          : 'reservation';
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <Link
        className="text-[var(--accent-primary)] underline"
        href={`/pbx-nodes/${nodeId}`}
      >
        Back to PBX detail
      </Link>
      <h1 className="font-display text-2xl">Routing: groups and rules</h1>
      <p>
        Unbound desired configuration. Saving, enabling and previewing do not
        contact the PBX or establish tenant ownership, calling eligibility or
        live readiness. Disabled definitions retain number claims.
      </p>
      <div className="flex flex-wrap gap-3">
        {(['groups', 'inbound', 'outbound', 'reservations'] as const).map(
          (k) => (
            <Button
              key={k}
              variant={k === kind ? 'primary' : 'secondary'}
              disabled={pending}
              onClick={() => {
                setKind(k);
                m.setAfter(null);
                m.setHistory([]);
              }}
            >
              {k === 'outbound'
                ? 'Outbound rules'
                : k === 'inbound'
                  ? 'Inbound rules'
                  : k === 'groups'
                    ? 'Ring groups'
                    : 'Reserved numbers'}
            </Button>
          ),
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void m.reload()}
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
        <Panel aria-label="Dependencies">
          <h2>Conflicting claims or referencing definitions</h2>
          <ul>
            {blockers.map((b) => (
              <li key={b.id} className="break-all">
                {b.name} · {b.id}
                {message.startsWith('Existing references') && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => void m.inspect(b.id, b.kind ?? 'groups')}
                  >
                    Open{' '}
                    {b.kind === 'outbound'
                      ? 'outbound rule'
                      : b.kind === 'inbound'
                        ? 'inbound rule'
                        : 'group'}{' '}
                    {b.name}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p>
            Extension claims can be inspected in{' '}
            <Link className="underline" href={`/pbx-nodes/${nodeId}/inventory`}>
              extension inventory
            </Link>
            . Reservation claims are in Reserved numbers.
          </p>
        </Panel>
      )}
      {(state.review || state.attempt) && (
        <Panel aria-label="Canonical review">
          <p>
            Review the saved result before another change. Entered values are
            retained.
          </p>
          <Button disabled={pending} onClick={() => void m.review()}>
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
              <pre className="whitespace-pre-wrap break-all">
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
          {kind === 'outbound'
            ? 'Outbound rules'
            : kind === 'inbound'
              ? 'Inbound rules'
              : kind === 'groups'
                ? 'Ring groups'
                : 'Reserved numbers'}
        </h2>
        {!page ? (
          <p>Loading definitions…</p>
        ) : (
          <>
            <ul>
              {page.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="min-w-0 break-words">
                    {item.name} ·{' '}
                    {'trunkId' in item
                      ? `${item.pattern.kind} ${item.pattern.digits} · priority ${item.priority} · ${item.enabled ? 'Enabled' : 'Disabled'} (desired) · unbound`
                      : 'destination' in item
                        ? `${item.didId ? 'Exact DID' : 'Gateway catch-all'} · ${item.destination.kind} · ${item.enabled ? 'Enabled' : 'Disabled'} (desired) · unbound`
                        : 'memberIds' in item
                          ? `${item.number ?? 'No dialable number'} · ${item.enabled ? 'Enabled' : 'Disabled'} (desired)`
                          : `${item.pattern.kind} ${item.pattern.digits} · lengths ${item.pattern.minLength}–${item.pattern.maxLength}`}{' '}
                    · v{item.version}
                  </span>
                  <Button
                    disabled={blocked}
                    variant="secondary"
                    onClick={() => void m.inspect(item.id)}
                  >
                    Inspect {item.name}
                  </Button>
                </li>
              ))}
            </ul>
            {!page.items.length && <p>No {kind} yet.</p>}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={pending || !m.history.length}
                variant="secondary"
                onClick={() => {
                  m.setAfter(m.history.at(-1) ?? null);
                  m.setHistory(m.history.slice(0, -1));
                }}
              >
                Previous page
              </Button>
              <Button
                disabled={pending || !page.nextCursor}
                variant="secondary"
                onClick={() => {
                  m.setHistory([...m.history, m.after]);
                  m.setAfter(page.nextCursor);
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
          m.setErrors({});
          setMessage('');
          setConfirm(false);
        }}
      >
        Create {label}
      </Button>
      {r && (state.mode === 'detail' || state.mode === 'edit') && (
        <Panel aria-label="Resource detail">
          <h2 className="font-display text-xl">{r.name}</h2>
          <p>
            {r.removedAt
              ? 'Removed'
              : 'enabled' in r
                ? r.enabled
                  ? 'Enabled (desired)'
                  : 'Disabled (desired)'
                : 'Reserved'}{' '}
            · unbound
          </p>
          <pre className="my-3 whitespace-pre-wrap break-all">
            {JSON.stringify(r, null, 2)}
          </pre>
          {!r.removedAt && (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={blocked}
                onClick={() =>
                  save({ ...state, mode: 'edit', values: form(r) })
                }
              >
                Edit {label}
              </Button>
              {'enabled' in r && (
                <Button
                  variant="secondary"
                  disabled={blocked}
                  onClick={() =>
                    void run({
                      parts: ['routing', kind, r.id, 'status'],
                      method: 'PATCH',
                      body: { expectedVersion: r.version, enabled: !r.enabled },
                    })
                  }
                >
                  {r.enabled ? 'Disable' : 'Enable'} {label}
                </Button>
              )}
              <Button
                variant="destructive"
                disabled={blocked}
                onClick={() => setConfirm(true)}
              >
                Remove {label}
              </Button>
            </div>
          )}
          {confirm && !r.removedAt && (
            <div className="mt-4 space-y-3">
              <p>
                Remove {r.name}? References block group removal. History remains
                and eligible number claims are released.
              </p>
              <Button
                disabled={blocked}
                variant="destructive"
                onClick={() =>
                  void run({
                    parts: ['routing', kind, r.id, 'remove'],
                    method: 'POST',
                    body: { expectedVersion: r.version },
                  })
                }
              >
                Confirm removal
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirm(false)}
              >
                Cancel removal
              </Button>
            </div>
          )}
        </Panel>
      )}
      <RoutingForm model={m} nodeId={nodeId} />
    </div>
  );
}
