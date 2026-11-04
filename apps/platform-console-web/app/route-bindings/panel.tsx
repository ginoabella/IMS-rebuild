'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input } from '@myims/ui-web';
import type { RouteAuthorizationKind } from '@myims/contracts';
import { useBindings } from './use-bindings';
import { labels, dependencyLink } from './navigation';
import { SavedAuthorizations } from './saved';
const selectClass =
  'min-h-11 w-full max-w-full rounded-md border border-subtle bg-muted px-3';
export function BindingPanel({
  tenantId,
  nodeId,
  direction,
  onFeedback,
}: {
  tenantId: string;
  nodeId: string;
  direction: 'inbound' | 'outbound';
  onFeedback: (message: string) => void;
}) {
  const s = useBindings(
      tenantId,
      nodeId,
      direction === 'inbound' ? 'dids' : 'trunks',
    ),
    [dialled, setDialled] = useState('');
  const kinds: RouteAuthorizationKind[] =
    direction === 'inbound'
      ? ['dids', 'groups', 'inbound']
      : ['trunks', 'permission', 'outbound'];
  const prefix = `binding-${direction}`,
    disabled = !s.work.ready || s.pending || !!s.attempt;
  useEffect(() => {
    onFeedback(
      s.attempt
        ? 'Original request outcome needs reconciliation.'
        : s.pending
          ? 'Route authorization operation pending.'
          : s.message || (s.resourceId ? 'Unsaved resource selection.' : ''),
    );
  }, [s.message, s.attempt, s.pending, s.resourceId, onFeedback]);
  return (
    <section
      aria-label={`${direction} tenant route configuration`}
      className="min-w-0 space-y-4 border-t border-subtle pt-4"
    >
      <h3 className="font-display text-lg">
        {direction === 'inbound'
          ? 'Inbound routes'
          : 'Outbound routes and trunk permissions'}
      </h3>
      <p>
        Desired configuration · live verification pending. Saving grants no live
        calling readiness.
      </p>
      <p>
        {direction === 'inbound'
          ? 'Gateways are shared. Save exact DID ownership and destination group ownership before binding an existing inbound rule. Gateway catch-alls remain platform-only.'
          : 'Classify an existing trunk as tenant-owned or shared, grant explicit tenant permission, then bind an existing outbound rule. Foreign-owned trunks always deny.'}
      </p>
      <p ref={s.feedback} role="status" tabIndex={-1}>
        {s.message}
      </p>
      {s.attempt && (
        <div className="space-y-2">
          <p>
            The original request is retained for reconciliation. Reload saved
            facts before discarding it.
          </p>
          <Button
            disabled={!s.work.ready || s.pending}
            onClick={() => void s.submit(s.attempt!)}
          >
            Retry original {direction} request
          </Button>
          <Button
            variant="secondary"
            disabled={!s.work.ready || s.pending || !s.reviewed}
            onClick={() => {
              s.retain(null);
              s.edit();
              s.note(
                'Original request discarded after canonical review. Preview again.',
              );
            }}
          >
            Discard after canonical review
          </Button>
        </div>
      )}
      <Button
        variant="secondary"
        disabled={!s.work.ready || s.pending}
        onClick={() => void s.load()}
      >
        Reload saved {direction} configuration
      </Button>
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="font-medium">Select existing resources</legend>
        <Field id={`${prefix}-kind`} label="Authorization">
          <select
            id={`${prefix}-kind`}
            className={selectClass}
            value={s.kind}
            onChange={(e) => {
              s.edit();
              s.setKind(e.target.value as RouteAuthorizationKind);
              s.setScope('owned');
              s.setResourceId('');
            }}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-resource`} label="Existing resource">
          <select
            id={`${prefix}-resource`}
            className={selectClass}
            value={s.resourceId}
            onChange={(e) => {
              s.edit();
              s.setResourceId(e.target.value);
            }}
          >
            <option value="">Choose existing resource</option>
            {s.resourceId && !s.choices.some((c) => c.id === s.resourceId) && (
              <option value={s.resourceId}>{s.resourceId}</option>
            )}
            {s.choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · v{c.version} · {c.enabled ? 'enabled' : 'disabled'} ·{' '}
                {c.scope === 'shared'
                  ? 'shared'
                  : c.owner === tenantId
                    ? 'owned by this tenant'
                    : c.owner
                      ? 'foreign-owned'
                      : 'unclaimed'}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void s.load()}>
            First resource choices
          </Button>
          <Button
            variant="secondary"
            disabled={!s.choiceCursor}
            onClick={() => void s.load(null, s.choiceCursor)}
          >
            More resource choices
          </Button>
        </div>
        {s.kind === 'trunks' && (
          <Field id={`${prefix}-scope`} label="Trunk ownership">
            <select
              id={`${prefix}-scope`}
              className={selectClass}
              value={s.scope}
              onChange={(e) => {
                s.edit();
                s.setScope(e.target.value as 'owned' | 'shared');
              }}
            >
              <option value="owned">Exclusive to this tenant</option>
              <option value="shared">Shared platform trunk</option>
            </select>
          </Field>
        )}
        {s.resourceId && (
          <a
            className="text-primary underline"
            href={dependencyLink(
              nodeId,
              s.kind === 'permission' ? 'trunks' : s.kind,
              s.resourceId,
            )}
          >
            Inspect existing resource
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!s.resourceId}
            variant="secondary"
            onClick={() => void s.preview()}
          >
            Preview {direction} authorization
          </Button>
          <Button
            disabled={
              !s.review?.compatible ||
              !s.saved ||
              !['draft', 'active'].includes(s.saved.tenant.status)
            }
            onClick={s.save}
          >
            Save {direction} authorization
          </Button>
        </div>
      </fieldset>
      {s.review && (
        <p>
          Evaluated {s.review.evaluated.length} exact resource and ownership
          versions.{' '}
          {s.review.compatible
            ? 'Compatible desired selection.'
            : 'Selection is blocked.'}
        </p>
      )}
      {s.review && (
        <details className="max-h-80 overflow-auto rounded-md border border-subtle p-3">
          <summary>Reviewed resources and ownership versions</summary>
          <ul>
            {s.review.evaluated.map((f) => (
              <li key={`${f.kind}:${f.id}`} className="break-words">
                <a
                  className="underline"
                  href={
                    f.kind === 'allocation'
                      ? `/tenants/${tenantId}#allocation-heading`
                      : dependencyLink(
                          nodeId,
                          f.kind === 'authorization' ? 'binding' : f.kind,
                          f.id,
                        )
                  }
                >
                  {f.kind === 'gateways' ? 'Shared gateway' : f.kind} · {f.id} ·
                  v{f.version}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {s.blockers.length > 0 && (
        <ul aria-label={`${direction} blockers`}>
          {s.blockers.map((b, i) => (
            <li key={`${b.id}:${i}`}>
              <a
                className="text-primary underline"
                href={dependencyLink(nodeId, b.kind, b.id, b.tenantId)}
              >
                {b.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a
          className="text-primary underline"
          href={`/pbx-nodes/${nodeId}/routing`}
        >
          Manage existing routes and groups
        </a>{' '}
        ·{' '}
        <a
          className="text-primary underline"
          href={`/pbx-nodes/${nodeId}/peers`}
        >
          Manage gateways, DIDs and trunks
        </a>
      </p>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={s.history}
          disabled={disabled}
          onChange={(e) => {
            s.setHistory(e.target.checked);
            void s.load(null, null, e.target.checked);
          }}
        />
        Show retained history
      </label>
      <SavedAuthorizations
        s={s}
        direction={direction}
        nodeId={nodeId}
        kinds={kinds}
        disabled={disabled}
      />
      {direction === 'outbound' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void s.advisory(dialled);
          }}
        >
          <Field
            id={`${prefix}-dialled`}
            label="Tenant outbound advisory number"
          >
            <Input
              id={`${prefix}-dialled`}
              value={dialled}
              maxLength={15}
              pattern="[0-9]{1,15}"
              required
              disabled={disabled}
              onChange={(e) => {
                s.edit();
                setDialled(e.target.value);
              }}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={disabled}>
            Preview tenant outbound selection
          </Button>
        </form>
      )}
    </section>
  );
}
