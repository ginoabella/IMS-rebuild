'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '@myims/ui-web';
import type {
  PbxLiveOperation,
  PbxLiveStatus,
  RevisionDetail,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { liveOutput } from './live-validation';
type Action = 'apply' | 'recover' | 'reconcile';
type Attempt = {
  action: Action;
  body: {
    requestId: string;
    expectedBaselineId: string;
    revisionId?: string;
    targetId?: string;
  };
};
type Retained = { attempt: Attempt | null; operationId: string | null };
class LiveRejected extends Error {}
export function LivePanel({
  nodeId,
  detail,
}: {
  nodeId: string;
  detail?: RevisionDetail;
}) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const key = `live-revisions:${nodeId}`;
  const retained: Retained = work.values[key]
    ? JSON.parse(work.values[key]!)
    : { attempt: null, operationId: null };
  const saved = useRef(retained);
  saved.current = retained;
  const [status, setStatus] = useState<PbxLiveStatus>();
  const [operation, setOperation] = useState<PbxLiveOperation>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState('');
  const [target, setTarget] = useState('');
  const mounted = useRef(true),
    busy = useRef(false),
    error = useRef<HTMLParagraphElement>(null);
  const save = (value: Retained) =>
    latest.current.record({
      ...latest.current.values,
      [key]: JSON.stringify(value),
    });
  const runtime = detail?.runtimeDiff.runtime;
  const reviewedBaseline =
    runtime?.kind === 'verified_runtime' ? runtime.artifactId : null;
  const reviewKey = `${detail?.revision.id ?? ''}:${reviewedBaseline ?? ''}:${status?.verifiedId ?? ''}`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (message) error.current?.focus();
  }, [message]);
  async function request<T>(parts: string[] = [], body?: object): Promise<T> {
    const method = body ? 'POST' : 'GET';
    const response = await fetch(
      `/platform/pbx-nodes/${nodeId}/revisions/live${parts.length ? '/' + parts.join('/') : ''}`,
      {
        method,
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(7000),
        headers: {
          'Content-Type': 'application/json',
          ...(body
            ? { 'X-Platform-CSRF': latest.current.capture().proof }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if ([401, 403, 429, 503].includes(response.status))
      throw new AccessError(response.status as 401 | 403 | 429 | 503);
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409 || response.status === 400)
        throw new LiveRejected(
          'Request rejected. Reload revisions and live state, then review the exact baseline before a new request.',
        );
      throw new Error(
        response.status === 404
          ? 'No matching receipt yet. Retry the retained exact request to resolve its outcome.'
          : 'Live operation unavailable.',
      );
    }
    if (!liveOutput(['revisions', 'live', ...parts], method, value))
      throw new AccessError(503);
    return value as T;
  }
  async function refresh() {
    const guard = latest.current.capture();
    const next = await request<PbxLiveStatus>();
    const id = saved.current.operationId;
    const receipt = id
      ? await request<{ operation: PbxLiveOperation }>(['operations', id])
      : null;
    if (mounted.current && guard.current()) {
      setStatus(next);
      setOperation(receipt?.operation);
    }
  }
  async function run(
    action: () => Promise<void>,
    operational = false,
    passive = false,
  ) {
    if (busy.current || !latest.current.ready) return;
    busy.current = true;
    if (!passive) {
      setPending(true);
      setMessage('');
    }
    let guard = latest.current.capture();
    try {
      if (operational) {
        if (!(await latest.current.authorize())) return;
        guard = latest.current.capture();
      }
      if (!mounted.current || !guard.current()) return;
      await action();
    } catch (e) {
      if (mounted.current && guard.current()) {
        if (!passive)
          setMessage(
            e instanceof Error
              ? e.message
              : 'Live operation unavailable. The exact request remains retained.',
          );
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
        // A failed passive read removes availability; stale health never enables apply.
        setStatus(undefined);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  useEffect(() => {
    setStatus(undefined);
    setOperation(undefined);
    setReviewed('');
    setTarget('');
    if (!work.ready) return;
    void run(refresh, false, true);
    const timer = setInterval(() => void run(refresh, false, true), 2000);
    return () => clearInterval(timer);
  }, [nodeId, work.ready, work.operatorId]);
  async function submit(action: Action, retry = false) {
    const guard = latest.current.capture();
    let attempt = saved.current.attempt;
    if (attempt && !retry) return;
    if (!attempt) {
      if (!status?.available || !status.verifiedId) return;
      if (
        action === 'apply' &&
        (!detail ||
          reviewed !== reviewKey ||
          reviewedBaseline !== status.verifiedId)
      )
        return;
      attempt = {
        action,
        body: {
          requestId: crypto.randomUUID(),
          expectedBaselineId:
            action === 'reconcile' ? status.knownGoodId! : status.verifiedId,
          ...(action === 'apply'
            ? { revisionId: detail!.revision.id }
            : {
                targetId: action === 'reconcile' ? status.knownGoodId! : target,
              }),
        },
      };
      save({ ...saved.current, attempt });
    }
    try {
      const receipt = await request<{ operation: PbxLiveOperation }>(
        [attempt.action],
        attempt.body,
      );
      if (!mounted.current || !guard.current()) return;
      save({ attempt: null, operationId: receipt.operation.id });
      setOperation(receipt.operation);
      setReviewed('');
      setMessage(
        `Accepted ${receipt.operation.kind} operation ${receipt.operation.id}. Progress is durable; closing this page does not cancel it.`,
      );
      await refresh();
    } catch (e) {
      if (e instanceof LiveRejected && mounted.current && guard.current()) {
        save({ ...saved.current, attempt: null });
        setReviewed('');
      }
      throw e;
    }
  }
  async function receipt() {
    const attempt = saved.current.attempt;
    if (!attempt) return;
    const guard = latest.current.capture();
    const value = await request<{ operation: PbxLiveOperation }>([
      'receipts',
      attempt.body.requestId,
    ]);
    if (!mounted.current || !guard.current()) return;
    save({ attempt: null, operationId: value.operation.id });
    setOperation(value.operation);
    setReviewed('');
    await refresh();
  }
  const canApply =
    status?.available &&
    status.runtime === 'verified' &&
    !status.activeOperationId &&
    detail?.sourceCurrent &&
    detail.validation?.local === 'passed' &&
    detail.validation.applicable &&
    reviewedBaseline === status.verifiedId &&
    reviewed === reviewKey;
  return (
    <Panel title="Live apply and verified recovery">
      <p>
        Desired revision: {detail?.revision.sequence ?? 'select a revision'}.
        Installed: {status?.installedId ?? 'unavailable'}. Verified:{' '}
        {status?.verifiedId ?? 'unavailable'}. Known good:{' '}
        {status?.knownGoodId ?? 'unavailable'}.
      </p>
      <p>
        Runtime: {status?.runtime ?? 'unavailable'}. Drift: unknown.{' '}
        {status?.available
          ? 'Execution boundary connected.'
          : 'A verified initial baseline and connected execution boundary are required.'}{' '}
        Unallocated and unbound resources remain denied.
      </p>
      <p ref={error} tabIndex={-1} role="status" aria-live="polite">
        {pending ? 'Submitting live request…' : message}
      </p>
      <label className="my-3 flex items-start gap-2">
        <input
          type="checkbox"
          checked={reviewed === reviewKey}
          disabled={
            !detail || !reviewedBaseline || pending || !!retained.attempt
          }
          onChange={(event) =>
            setReviewed(event.target.checked ? reviewKey : '')
          }
        />
        I reviewed the runtime comparison for revision{' '}
        {detail?.revision.sequence ?? '—'} against verified artifact{' '}
        {reviewedBaseline ?? 'unavailable'}.
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!canApply || pending || !!retained.attempt}
          onClick={() => void run(() => submit('apply'), true)}
        >
          {status?.available ? 'Apply reviewed revision' : 'Apply unavailable'}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void run(refresh)}
        >
          Reload live state
        </Button>
      </div>
      {retained.attempt && (
        <div className="my-3 space-y-2">
          <p>
            Request outcome uncertain. This operator’s exact request is retained
            across reauthentication.
          </p>
          <Button disabled={pending} onClick={() => void run(receipt)}>
            Recover operation receipt
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              void run(() => submit(retained.attempt!.action, true), true)
            }
          >
            Retry exact live request
          </Button>
        </div>
      )}
      <div className="my-3 flex flex-wrap items-center gap-3">
        <label htmlFor="live-recovery-target">Verified recovery target</label>
        <select
          id="live-recovery-target"
          className="max-w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2"
          value={target}
          disabled={pending || !!retained.attempt}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Select a known-good artifact</option>
          {status?.artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>
              {artifact.initialBaseline
                ? 'Initial baseline'
                : artifact.revisionId}{' '}
              · {artifact.verifiedAt}
            </option>
          ))}
        </select>
        <Button
          disabled={
            !status?.available ||
            status.runtime !== 'verified' ||
            !!status.activeOperationId ||
            !target ||
            pending ||
            !!retained.attempt
          }
          onClick={() => void run(() => submit('recover'), true)}
        >
          Recover selected artifact
        </Button>
        <Button
          disabled={
            !status?.available ||
            !status.activeOperationId ||
            !status.knownGoodId ||
            pending ||
            !!retained.attempt
          }
          onClick={() => void run(() => submit('reconcile'), true)}
        >
          Reconcile to known good
        </Button>
      </div>
      {operation && (
        <div role="status" aria-live="polite">
          <p>
            Operation {operation.id}: {operation.state}. Accepted{' '}
            {operation.createdAt} by {operation.createdBy}; updated{' '}
            {operation.updatedAt}.
          </p>
          <p>
            Validation: {operation.validation}. Installation:{' '}
            {operation.installation}. Independent verification:{' '}
            {operation.verification}. Recovery: {operation.recovery}.
          </p>
          {operation.state === 'waiting' && (
            <p>
              Waiting for all node calls to drain within the approved deadline.
              Calls are never forcibly ended.
            </p>
          )}
          {operation.failure && (
            <p>
              Blocker: {operation.failure}. Unknown execution retains
              dependencies and blocks conflicting work.
            </p>
          )}
        </div>
      )}
      {!!status?.operations.length && (
        <ul className="my-3 space-y-2">
          {status.operations.map((item) => (
            <li key={item.id}>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  save({ ...saved.current, operationId: item.id });
                  void run(refresh);
                }}
              >
                {item.kind} #{item.sequence}: {item.state}
              </Button>{' '}
              · {item.createdAt} · {item.createdBy}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
