'use client';
import { useEffect } from 'react';
import { Button, Field, Input } from '@myims/ui-web';
import { useNodeAllocation } from './use-allocation';
const selectClass =
  'min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3';
export function NodeAllocation({
  tenantId,
  nodeId,
  onFeedback,
}: {
  tenantId: string;
  nodeId: string;
  onFeedback?: (message: string) => void;
}) {
  const {
    work,
    saved,
    stock,
    stockCursor,
    stockAfter,
    stockSearch,
    setStockSearch,
    stockPrefix,
    stockLoading,
    searchStock,
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
  useEffect(() => {
    onFeedback?.(message);
  }, [message, onFeedback]);
  return (
    <div className="space-y-5 pt-4">
      <p ref={feedback} tabIndex={-1} role="status" className="break-words">
        {message}
      </p>
      <Button
        variant="secondary"
        disabled={!work.ready || pending || stockLoading}
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
            disabled={!work.ready || pending || stockLoading}
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
            <form
              role="search"
              aria-label="Find stock extensions"
              className="flex flex-wrap items-end gap-2 [&>div]:min-w-0"
              onSubmit={(event) => {
                event.preventDefault();
                searchStock(stockSearch);
              }}
            >
              <Field
                id="allocation-number-search"
                label="Extension number"
                optional
                hint="Enter a full number or its first digits. Searches all PBX stock."
              >
                <Input
                  id="allocation-number-search"
                  type="search"
                  inputMode="numeric"
                  pattern="[1-9][0-9]{0,5}"
                  maxLength={6}
                  value={stockSearch}
                  onChange={(event) => setStockSearch(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="secondary">
                Find extensions
              </Button>
              {stockPrefix && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStockSearch('');
                    searchStock('');
                  }}
                >
                  Show all extensions
                </Button>
              )}
            </form>
            {stockLoading ? (
              <p role="status">Loading extensions…</p>
            ) : (
              stock.length === 0 && (
                <p>
                  {stockPrefix
                    ? `No extensions match ${stockPrefix}.`
                    : 'No inventory extensions on this page. Create stock in PBX administration before allocating.'}
                </p>
              )
            )}
            <p>
              {chosen.length} selected (maximum 50). Disabled stock can be
              owned. Selections are kept across searches and pages.
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
            <div
              role="region"
              aria-label="Extension choices"
              tabIndex={0}
              aria-busy={stockLoading || undefined}
              className="max-h-72 overflow-y-auto overscroll-contain rounded-md border p-2"
            >
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-2">
                {stock.map((e) => {
                  const selected = chosen.includes(e.id);
                  const blocked =
                    !!e.claim ||
                    e.credentialPending ||
                    (!selected && chosen.length >= 50);
                  const status = `${e.administrativeStatus}${e.claim ? ' · ' + e.claim.state : e.credentialPending ? ' · credential setup pending' : ''}`;
                  return (
                    <label
                      key={e.id}
                      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-md border px-2 py-1 break-words ${selected ? 'border-primary bg-primary/10' : 'border-subtle'} ${blocked ? 'opacity-60' : 'cursor-pointer hover:bg-muted'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={blocked}
                        aria-label={`Extension ${e.number} · ${status}`}
                        onChange={(ev) => {
                          setChosen((current) =>
                            ev.target.checked
                              ? [...current, e.id]
                              : current.filter((id) => id !== e.id),
                          );
                          edit();
                        }}
                      />
                      <span className="min-w-0">
                        <span className="font-mono font-semibold">
                          {e.number}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {status}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {stock.length} extensions on this page
              {stockPrefix ? ` matching ${stockPrefix}` : ''}. Use pages to
              browse more; preview shows every selected extension.
            </p>
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
