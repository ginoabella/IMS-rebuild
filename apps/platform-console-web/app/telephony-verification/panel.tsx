'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Field, Panel, PanelHeading } from '@myims/ui-web';
import type { TenantVerificationView } from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { useTelephonyOperation } from './use-operation';
export function VerificationPanel({
  tenantId,
  nodeId,
  onSummary,
}: {
  tenantId: string;
  nodeId: string;
  onSummary?: (value: string) => void;
}) {
  const work = useOperatorWork();
  return (
    <OwnedVerification
      key={`${work.operatorId}:${tenantId}:${nodeId}`}
      tenantId={tenantId}
      nodeId={nodeId}
      onSummary={onSummary}
    />
  );
}
function OwnedVerification({
  tenantId,
  nodeId,
  onSummary,
}: {
  tenantId: string;
  nodeId: string;
  onSummary?: (value: string) => void;
}) {
  const { work, view, pending, retained, message, notice, load, submit } =
    useTelephonyOperation<TenantVerificationView>(nodeId, tenantId);
  const [caseId, setCaseId] = useState(''),
    [grantId, setGrantId] = useState(''),
    [grantCaseIds, setGrantCaseIds] = useState<string[]>([]),
    [lifetimeSeconds, setLifetimeSeconds] = useState(1800);
  useEffect(() => {
    onSummary?.(
      view
        ? `Telephony ${view.readiness.state.replaceAll('_', ' ')}${view.readiness.blockers.length ? ': ' + view.readiness.blockers.map((b) => b.replaceAll('_', ' ')).join(', ') : ''}`
        : 'Current telephony evidence unavailable.',
    );
  }, [view, onSummary]);
  const disabled = !work.ready || pending || !!retained;
  const grantSelectionCurrent =
    grantCaseIds.length > 0 &&
    grantCaseIds.length <= 16 &&
    grantCaseIds.every((id) =>
      view?.cases.some((c) => c.id === id && c.available !== false),
    );
  return (
    <Panel aria-labelledby={`verification-heading-${nodeId}`}>
      <PanelHeading id={`verification-heading-${nodeId}`}>
        Verified tenant routing
      </PanelHeading>
      <p ref={notice} tabIndex={-1} role="status">
        {pending ? 'Recording intent…' : message}
      </p>
      <p>
        Telephony readiness:{' '}
        <strong>
          {view?.readiness.state === 'not_required'
            ? 'Voice not required'
            : view?.readiness.state === 'ready'
              ? 'Ready'
              : 'Incomplete'}
        </strong>
        . Tenant lifecycle and registration are separate.
      </p>
      {!!view?.readiness.blockers.length && (
        <ul className="list-inside list-disc">
          {view.readiness.blockers.map((b) => (
            <li key={b}>{b.replaceAll('_', ' ')}</li>
          ))}
        </ul>
      )}
      {view?.artifactId && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 [overflow-wrap:anywhere]">
          <dt>Verified artifact</dt>
          <dd>{view.artifactId}</dd>
          <dt>Revision</dt>
          <dd>{view.revisionId}</dd>
        </dl>
      )}
      <Link
        className="text-[var(--accent-primary)] underline"
        href={`/pbx-nodes/${nodeId}/revisions`}
      >
        Review revisions, apply and recovery
      </Link>
      <div className="my-3 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={!work.ready || pending}
          onClick={() => void load()}
        >
          Reload evidence
        </Button>
        {retained && (
          <Button
            disabled={!work.ready || pending}
            onClick={() => void submit()}
          >
            Recover exact verification intent
          </Button>
        )}
      </div>
      {!view ? (
        <p>Current telephony evidence is unavailable.</p>
      ) : !view.cases.length ? (
        <p>
          No approved controlled call cases are configured for this tenant and
          PBX.
        </p>
      ) : (
        <>
          <p>
            Draft tests require an explicit grant lasting at most 30 minutes.
            Each test makes one bounded controlled call. Unknown outcomes
            require reconciliation before another test.
          </p>
          {view.cases.some((c) => c.available === false) ? (
            <p role="status">
              Some controlled cases are unavailable: preparation is stopped or
              stale, ownership changed, or protected custody is unavailable.
              Inspect preparation status before starting another test.
            </p>
          ) : null}
          <fieldset disabled={disabled} className="my-3 min-w-0 space-y-2">
            <legend>Cases permitted by the new grant</legend>
            <p>
              Select the exact cases to permit. No cases are selected by
              default.
            </p>
            {view.cases.map((c) => (
              <label
                key={c.id}
                className="flex min-h-11 items-center gap-3 [overflow-wrap:anywhere]"
              >
                <input
                  type="checkbox"
                  aria-label={`Permit case ${c.id}: ${c.direction} ${c.dialled}, ${c.kind.replaceAll('-', ' ')}, expected ${c.expectedOutcome}`}
                  checked={grantCaseIds.includes(c.id)}
                  disabled={c.available === false}
                  onChange={(event) =>
                    setGrantCaseIds((ids) =>
                      event.target.checked
                        ? [...ids, c.id]
                        : ids.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  {c.direction} · {c.kind.replaceAll('-', ' ')} · {c.dialled} ·
                  expected {c.expectedOutcome}
                  {c.available === false ? ' · preparation unavailable' : ''}
                  <span className="block text-sm">
                    Case {c.id} · source {c.sourceId}
                  </span>
                </span>
              </label>
            ))}
            <p role="status">{grantCaseIds.length} cases selected.</p>
            {grantCaseIds.length > 0 && !grantSelectionCurrent && (
              <p role="status">
                The selected cases are no longer available. Review preparation
                and clear the selection before granting again.
              </p>
            )}
            <Button
              variant="secondary"
              disabled={disabled || grantCaseIds.length === 0}
              onClick={() => setGrantCaseIds([])}
            >
              Clear grant selection
            </Button>
          </fieldset>
          <div className="flex flex-wrap items-end gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
            <Field id={`test-case-${nodeId}`} label="Controlled call case">
              <select
                id={`test-case-${nodeId}`}
                className="min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3"
                value={caseId}
                disabled={disabled}
                onChange={(e) => setCaseId(e.target.value)}
              >
                <option value="">Choose controlled case</option>
                {view.cases.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={c.available === false}
                  >
                    {c.direction} · {c.kind.replaceAll('-', ' ')} · {c.dialled}{' '}
                    · expected {c.expectedOutcome} · case {c.id}
                    {c.available === false ? ' · preparation unavailable' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`test-grant-${nodeId}`} label="Draft verification grant">
              <select
                id={`test-grant-${nodeId}`}
                className="min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3"
                value={grantId}
                disabled={disabled}
                onChange={(e) => setGrantId(e.target.value)}
              >
                <option value="">No draft grant selected</option>
                {view.grants.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.active ? 'Current' : 'Inactive'} · expires {g.expiresAt}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id={`grant-duration-${nodeId}`}
              label="Verification lifetime"
            >
              <select
                id={`grant-duration-${nodeId}`}
                className="min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3"
                disabled={disabled}
                value={lifetimeSeconds}
                onChange={(e) => setLifetimeSeconds(Number(e.target.value))}
              >
                <option value={10}>10 seconds (expiry verification)</option>
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
              </select>
            </Field>
            <Button
              disabled={disabled || !view.artifactId || !grantSelectionCurrent}
              onClick={() =>
                void submit('grant', {
                  artifactId: view.artifactId,
                  caseIds: grantCaseIds,
                  lifetimeSeconds,
                })
              }
            >
              Grant verification
            </Button>
            <Button
              disabled={
                disabled ||
                !caseId ||
                !view.artifactId ||
                !view.cases.some(
                  (c) => c.id === caseId && c.available !== false,
                )
              }
              onClick={() =>
                void submit('test', {
                  artifactId: view.artifactId,
                  caseId,
                  grantId: grantId || null,
                })
              }
            >
              Run controlled call test
            </Button>
            <Button
              variant="secondary"
              disabled={disabled || !grantId}
              onClick={() => void submit('revoke', { grantId })}
            >
              Revoke selected grant
            </Button>
          </div>
        </>
      )}
      {!!view?.tests.length && (
        <ul className="mt-3 space-y-3 [overflow-wrap:anywhere]">
          {view.tests.map((t) => (
            <li key={t.id}>
              <strong>
                {t.direction}: {t.state}
              </strong>{' '}
              · expected {t.expectedOutcome} · observed {t.outcome ?? 'pending'}{' '}
              · {t.current ? 'current provenance' : 'stale provenance'}
              <p>
                Revision {t.revisionId} · artifact {t.artifactId}
              </p>
              <p>
                Test {t.id} · {t.finishedAt ?? t.createdAt}
                {t.destinationId
                  ? ` · observed destination ${t.destinationId}`
                  : ''}
              </p>
              {t.state === 'unknown' && (
                <div>
                  <Button
                    disabled={disabled}
                    onClick={() => void submit('reconcile', { testId: t.id })}
                  >
                    Reconcile call safety
                  </Button>
                  <p>
                    Call dispatch is uncertain. No automatic redial is
                    permitted.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
