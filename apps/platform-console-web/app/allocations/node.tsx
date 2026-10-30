'use client';
import { Button, Field, Input } from '@myims/ui-web';
import { useNodeAllocation } from './use-allocation';
const selectClass =
  'min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3';
export function NodeAllocation({
  tenantId,
  nodeId,
}: {
  tenantId: string;
  nodeId: string;
}) {
  const {
    work,
    saved,
    stock,
    stockCursor,
    stockAfter,
    claimAfter,
    history,
    setHistory,
    chosen,
    setChosen,
    mode,
    setMode,
    start,
    setStart,
    end,
    setEnd,
    state,
    setState,
    preview,
    attempt,
    pending,
    message,
    feedback,
    canonicalReviewed,
    disabled,
    reload,
    submit,
    retain,
    edit,
    note,
    review,
    save,
    change,
  } = useNodeAllocation({ tenantId, nodeId });
  return (
    <div className="space-y-5 pt-4">
      <p ref={feedback} tabIndex={-1} role="status" className="break-words">
        {message}
      </p>
      <Button
        variant="secondary"
        disabled={!work.ready || pending}
        onClick={() => void reload()}
      >
        Reload saved ownership
      </Button>
      {attempt && (
        <div className="space-y-3">
          <p>
            Keep this original request for reconciliation. A fresh save is
            blocked while its outcome is uncertain.
          </p>
          <Button
            disabled={!work.ready || pending}
            onClick={() => void submit(attempt)}
          >
            Retry original allocation request
          </Button>
          <Button
            variant="secondary"
            disabled={!work.ready || pending || !canonicalReviewed}
            onClick={() => {
              retain(null);
              edit();
              note(
                'Original attempt discarded after canonical review. Preview current stock before a new save.',
              );
            }}
          >
            Discard original attempt after review
          </Button>
        </div>
      )}
      {!saved && !message && (
        <p role="status">Loading saved ownership and stock…</p>
      )}
      {saved && (
        <>
          <dl className="grid grid-cols-[min(40%,10rem)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 [overflow-wrap:anywhere]">
            <dt>Available on PBX</dt>
            <dd>{saved.capacity.available}</dd>
            <dt>Reserved</dt>
            <dd>{saved.capacity.reserved}</dd>
            <dt>Allocated</dt>
            <dd>{saved.capacity.allocated}</dd>
            <dt>Desired disabled</dt>
            <dd>{saved.capacity.disabled}</dd>
            <dt>Tenant lifecycle</dt>
            <dd>{saved.tenant.status}</dd>
          </dl>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={history}
              disabled={pending || !work.ready}
              onChange={(e) => {
                setHistory(e.target.checked);
                void reload(null, stockAfter, e.target.checked);
              }}
            />
            Include released ownership history
          </label>
          {saved.items.length === 0 ? (
            <p>No saved claims on this page.</p>
          ) : (
            <ul className="space-y-3">
              {saved.items.map((c) => (
                <li key={c.id} className="rounded-md border border-subtle p-3">
                  <p className="break-words">
                    Extension {c.stock.number} · {c.state} · version {c.version}{' '}
                    · desired {c.stock.administrativeStatus}
                  </p>
                  <p>
                    Staff assignment: {c.stock.assignment}. Calling
                    verification: {c.stock.verification.replaceAll('_', ' ')}.
                  </p>
                  {c.blockers.length > 0 && (
                    <ul className="list-inside list-disc">
                      {c.blockers.map((b, i) => (
                        <li key={i}>{b.name}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {c.state === 'reserved' && (
                      <Button
                        disabled={disabled}
                        onClick={() => change(c, 'promote')}
                      >
                        Allocate extension {c.stock.number}
                      </Button>
                    )}
                    {c.state !== 'released' && (
                      <Button
                        variant="secondary"
                        disabled={disabled || c.blockers.length > 0}
                        onClick={() => change(c, 'release')}
                      >
                        Release extension {c.stock.number}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
            <Button
              variant="secondary"
              disabled={!claimAfter || pending || !work.ready}
              onClick={() => void reload(null)}
            >
              First claims
            </Button>
            <Button
              variant="secondary"
              disabled={!saved.nextCursor || pending || !work.ready}
              onClick={() => void reload(saved.nextCursor)}
            >
              More claims
            </Button>
          </div>
        </>
      )}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="font-semibold">Select existing extensions</legend>
        <Field id="allocation-selection" label="Selection method">
          <select
            id="allocation-selection"
            className={selectClass}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              edit();
            }}
          >
            <option value="individual">Individual extensions</option>
            <option value="range">Number range</option>
          </select>
        </Field>
        {mode === 'range' ? (
          <div className="flex flex-wrap gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
            <Field id="allocation-start" label="First number">
              <Input
                id="allocation-start"
                value={start}
                maxLength={32}
                onChange={(e) => {
                  setStart(e.target.value);
                  edit();
                }}
              />
            </Field>
            <Field id="allocation-end" label="Last number">
              <Input
                id="allocation-end"
                value={end}
                maxLength={32}
                onChange={(e) => {
                  setEnd(e.target.value);
                  edit();
                }}
              />
            </Field>
          </div>
        ) : (
          <>
            {stock.length === 0 && (
              <p>
                No inventory extensions on this page. Create stock in PBX
                administration before allocating.
              </p>
            )}
            <p>
              {chosen.length} selected (maximum 50). Disabled stock can be
              owned.
            </p>
            <Button
              variant="secondary"
              disabled={chosen.length === 0}
              onClick={() => {
                setChosen([]);
                edit();
              }}
            >
              Clear individual selection
            </Button>
            <div className="grid gap-2 sm:grid-cols-2">
              {stock.map((e) => (
                <label
                  key={e.id}
                  className="flex min-h-11 items-center gap-2 break-words"
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(e.id)}
                    disabled={
                      !!e.claim ||
                      e.credentialPending ||
                      (!chosen.includes(e.id) && chosen.length >= 50)
                    }
                    onChange={(ev) => {
                      setChosen((current) =>
                        ev.target.checked
                          ? [...current, e.id]
                          : current.filter((id) => id !== e.id),
                      );
                      edit();
                    }}
                  />
                  Extension {e.number} · {e.administrativeStatus}
                  {e.claim
                    ? ' · ' + e.claim.state
                    : e.credentialPending
                      ? ' · credential setup pending'
                      : ''}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
              <Button
                variant="secondary"
                disabled={!stockAfter}
                onClick={() => void reload(claimAfter, null)}
              >
                First stock
              </Button>
              <Button
                variant="secondary"
                disabled={!stockCursor}
                onClick={() => void reload(claimAfter, stockCursor)}
              >
                More stock
              </Button>
            </div>
          </>
        )}
        <Field id="allocation-state" label="Ownership state">
          <select
            id="allocation-state"
            className={selectClass}
            value={state}
            onChange={(e) =>
              setState(e.target.value as 'reserved' | 'allocated')
            }
          >
            <option value="reserved">Reserve capacity</option>
            <option value="allocated">Allocate capacity</option>
          </select>
        </Field>
        <Button onClick={() => void review()}>Preview selection</Button>
        {preview && (
          <div>
            <ul className="list-inside list-disc">
              {preview.items.map((i, index) => (
                <li key={index}>
                  Extension {i.number}:{' '}
                  {i.missing
                    ? 'missing stock'
                    : `${i.administrativeStatus}, ${i.claim ? 'already ' + i.claim.state : i.credentialPending ? 'credential setup pending' : 'available'}, version '+i.version}`}
                </li>
              ))}
            </ul>
            <Button disabled={!preview.canSave} onClick={save}>
              Save {state === 'reserved' ? 'reservation' : 'allocation'}
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  );
}
