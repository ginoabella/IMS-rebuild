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
    [lifetimeSeconds, setLifetimeSeconds] = useState(1800);
  useEffect(() => {
    onSummary?.(
      view
        ? `Telephony ${view.readiness.state.replaceAll('_', ' ')}${view.readiness.blockers.length ? ': ' + view.readiness.blockers.map((b) => b.replaceAll('_', ' ')).join(', ') : ''}`
        : 'Current telephony evidence unavailable.',
    );
  }, [view, onSummary]);
  const disabled = !work.ready || pending || !!retained;
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
                    {c.direction} · {c.dialled} · expected {c.expectedOutcome}
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
                {view.grants
                  .filter((g) => g.active)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      Expires {g.expiresAt}
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
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
              </select>
            </Field>
            <Button
              disabled={
                disabled ||
                !view.artifactId ||
                view.cases.length > 16 ||
                !view.cases.some((c) => c.available !== false)
              }
              onClick={() =>
                void submit('grant', {
                  artifactId: view.artifactId,
                  caseIds: view.cases
                    .filter((c) => c.available !== false)
                    .map((c) => c.id),
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
