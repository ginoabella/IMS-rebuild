'use client';
import { useEffect, useRef, useState } from 'react';
import { useOperatorWork } from '../auth/console-access';
import { AccessError, type AccessFailure } from '../auth/client';
import { retirementOutput, verificationOutput, obj } from './validation';
const explanations: Record<string, string> = {
  runtime_not_current:
    'Runtime or desired routing changed. Reload and review the current revision.',
  verification_grant_required:
    'Select a current verification grant for this operator and controlled case.',
  operation_unresolved:
    'A call or runtime operation is pending or unknown. Reconcile it before continuing.',
  retained_dependency:
    'The artifact is still required by runtime or recovery. Reload and review its dependencies.',
  request_conflict:
    'This request differs from the recorded intent. Review its exact target.',
  intent_expired:
    'This intent has expired. Review current evidence before creating another intent.',
  test_case_unavailable:
    'This controlled case is unavailable for the selected tenant and PBX.',
};
export function useTelephonyOperation<T>(
  nodeId: string,
  tenantId: string | null,
) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const path = tenantId
    ? `/platform/tenants/${tenantId}/telephony/${nodeId}`
    : `/platform/pbx-nodes/${nodeId}/artifact-retirements`;
  const key = `verified-telephony:${tenantId ?? 'artifacts'}:${nodeId}`;
  const retained: { action: string; body: Record<string, unknown> } | null =
    work.values[key] ? JSON.parse(work.values[key]!) : null;
  const [view, setView] = useState<T>(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const mounted = useRef(true),
    epoch = useRef(0),
    busy = useRef(false),
    notice = useRef<HTMLParagraphElement>(null);
  const save = (attempt: typeof retained) =>
    latest.current.record({
      ...latest.current.values,
      [key]: attempt ? JSON.stringify(attempt) : '',
    });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  async function request(action: string, body?: Record<string, unknown>) {
    const r = await fetch(path + (action ? '/' + action : ''), {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'X-Platform-CSRF': latest.current.capture().proof } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const v: unknown = await r.json().catch(() => null);
    if ([400, 404, 409].includes(r.status))
      return {
        rejected: true as const,
        reason:
          obj(v) && typeof v.reason === 'string'
            ? (explanations[v.reason] ??
              'Reload and review the current configuration.')
            : 'Review current configuration.',
      };
    if (
      ![200, 201, 202].includes(r.status) ||
      !(tenantId
        ? verificationOutput(action ? [action] : [], body ? 'POST' : 'GET', v)
        : retirementOutput(body ? 'POST' : 'GET', v))
    )
      throw new AccessError(
        ([401, 403, 429].includes(r.status) ? r.status : 503) as AccessFailure,
      );
    return { rejected: false as const, value: v };
  }
  async function load() {
    const version = ++epoch.current,
      capture = latest.current.capture();
    try {
      const r = await request('');
      if (!mounted.current || version !== epoch.current || !capture.current())
        return;
      if (r.rejected) {
        setView(undefined);
        setMessage(r.reason);
        return;
      }
      setView(r.value as T);
    } catch (e) {
      if (mounted.current && version === epoch.current && capture.current()) {
        setView(undefined);
        setMessage('Current evidence could not be loaded. Reload to retry.');
        latest.current.rejectAccess(
          e instanceof AccessError ? e : new AccessError(503),
        );
      }
    }
  }
  useEffect(() => {
    if (work.ready) void load();
  }, [work.ready]);
  async function submit(action?: string, body?: Record<string, unknown>) {
    if (busy.current || !latest.current.ready) return;
    const attempt = body
      ? {
          action: action ?? '',
          body: { ...body, requestId: crypto.randomUUID() },
        }
      : retained;
    if (!attempt) return;
    save(attempt);
    busy.current = true;
    setPending(true);
    const capture = latest.current.capture();
    const version = ++epoch.current;
    try {
      const r = await request(attempt.action, attempt.body);
      if (!mounted.current || version !== epoch.current || !capture.current())
        return;
      save(null);
      setMessage(
        r.rejected
          ? r.reason
          : 'Intent recorded. Reload for the current outcome.',
      );
      await load();
    } catch (e) {
      if (mounted.current && version === epoch.current && capture.current()) {
        setMessage(
          'Response uncertain. The exact intent is retained; reconcile or retry this same intent.',
        );
        latest.current.rejectAccess(
          e instanceof AccessError ? e : new AccessError(503),
        );
      }
    } finally {
      busy.current = false;
      // The keyed owner/tenant/node component owns this single submission.
      // Access revalidation may invalidate the response epoch while the exact
      // receipt stays mounted; finishing must still release its pending state.
      if (mounted.current) setPending(false);
    }
  }
  return { work, view, pending, retained, message, notice, load, submit };
}
