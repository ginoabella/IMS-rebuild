'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  RevisionDetail,
  RevisionList,
  RevisionSummary,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { output } from './validation';
export function useRevisions(nodeId: string) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const key = `revisions:${nodeId}`;
  type Retained = {
    selected: string;
    baseline: string;
    attempt: { requestId: string; baselineId: string | null } | null;
  };
  const retained: Retained = work.values[key]
    ? JSON.parse(work.values[key]!)
    : { selected: '', baseline: '', attempt: null };
  const state = useRef(retained);
  state.current = retained;
  const save = (next: Retained) =>
    latest.current.record({
      ...latest.current.values,
      [key]: JSON.stringify(next),
    });
  const [list, setList] = useState<RevisionList>(),
    [detail, setDetail] = useState<RevisionDetail>(),
    [after, setAfter] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]),
    [baselineChoices, setBaselineChoices] = useState<RevisionSummary[]>([]),
    [baselineAfter, setBaselineAfter] = useState<string | null>(null);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const busy = useRef(false),
    mounted = useRef(true),
    generation = useRef(0),
    error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (message && !pending) error.current?.focus();
  }, [message, pending]);
  async function request<T>(
    parts: string[],
    method: 'GET' | 'POST' = 'GET',
    body?: object,
    query = '',
  ): Promise<T> {
    let r: Response;
    try {
      r = await fetch(
        `/platform/pbx-nodes/${nodeId}/${parts.join('/')}${query}`,
        {
          method,
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(7000),
          headers: {
            'Content-Type': 'application/json',
            ...(method === 'POST'
              ? { 'X-Platform-CSRF': latest.current.capture().proof }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
    } catch {
      throw new AccessError(503);
    }
    if ([401, 403, 429, 503].includes(r.status))
      throw new AccessError(
        r.status as 401 | 403 | 429 | 503,
        Math.max(1, Math.min(900, Number(r.headers.get('retry-after')) || 1)),
      );
    const v: unknown = await r.json().catch(() => null);
    if (!r.ok)
      throw new Error(
        r.status === 404
          ? 'No matching revision receipt was found. Retry the exact capture request to resolve an uncertain outcome.'
          : r.status === 409
            ? 'Capture conflict or snapshot limit. Reload canonical state and review.'
            : 'Invalid revision request.',
      );
    if (!output(parts, method, v)) throw new AccessError(503);
    return v as T;
  }
  async function load(
    selected = state.current.selected,
    baseline = state.current.baseline,
  ) {
    const capture = latest.current.capture(),
      token = ++generation.current;
    const [page, inspection] = await Promise.all([
      request<RevisionList>(
        ['revisions'],
        'GET',
        undefined,
        after ? `?after=${after}` : '',
      ),
      selected
        ? request<RevisionDetail>(
            ['revisions', selected],
            'GET',
            undefined,
            baseline ? `?baselineId=${baseline}` : '',
          )
        : Promise.resolve(undefined),
    ]);
    if (mounted.current && capture.current() && token === generation.current) {
      setList(page);
      setDetail(inspection);
      if (!baselineChoices.length && after === null) {
        setBaselineChoices(page.items);
        setBaselineAfter(page.nextCursor);
      }
    }
  }
  async function run(action: () => Promise<void>, operational = false) {
    if (busy.current || !latest.current.ready) return;
    busy.current = true;
    setPending(true);
    setMessage('');
    let capture = latest.current.capture();
    try {
      if (operational) {
        if (!(await latest.current.authorize())) return;
        capture = latest.current.capture();
      }
      if (!mounted.current || !capture.current()) return;
      await action();
    } catch (e) {
      if (mounted.current && capture.current()) {
        setMessage(
          e instanceof AccessError
            ? 'Service or session unavailable. Reload canonical state; an uncertain capture retains its exact request.'
            : e instanceof Error
              ? e.message
              : 'Unable to load revisions.',
        );
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  useEffect(() => {
    setDetail(undefined);
    setList(undefined);
    setBaselineChoices([]);
    setBaselineAfter(null);
    if (work.ready) void run(() => load());
  }, [nodeId, after, work.ready, work.operatorId]);
  async function capture(retry = false) {
    if (state.current.attempt && !retry) return;
    const guard = latest.current.capture();
    if (!mounted.current || !guard.current()) return;
    const attempt = state.current.attempt ?? {
      requestId: crypto.randomUUID(),
      baselineId: state.current.baseline || null,
    };
    save({ ...state.current, attempt });
    const r = await request<{ revision: RevisionSummary }>(
      ['revisions'],
      'POST',
      attempt,
    );
    if (!mounted.current || !guard.current()) return;
    save({ ...state.current, selected: r.revision.id, attempt: null });
    await load(r.revision.id);
    if (mounted.current && guard.current())
      setMessage('Revision captured. Desired configuration is unchanged.');
  }
  async function validate(revisionId: string) {
    const guard = latest.current.capture();
    if (!mounted.current || !guard.current()) return;
    await request(['revisions', revisionId, 'validate'], 'POST', {});
    if (mounted.current && guard.current()) await load();
  }
  async function recover() {
    const attempt = state.current.attempt;
    if (!attempt) return;
    const guard = latest.current.capture();
    const r = await request<{ revision: RevisionSummary }>([
      'revisions',
      'receipts',
      attempt.requestId,
    ]);
    if (!guard.current() || !mounted.current) return;
    save({ ...state.current, selected: r.revision.id, attempt: null });
    await load(r.revision.id);
    if (mounted.current && guard.current())
      setMessage('Recovered the exact capture receipt.');
  }
  async function inspect(id: string) {
    const guard = latest.current.capture();
    const r = await request<RevisionDetail>(
      ['revisions', id],
      'GET',
      undefined,
      state.current.baseline ? `?baselineId=${state.current.baseline}` : '',
    );
    if (!guard.current() || !mounted.current) return;
    save({ ...state.current, selected: id });
    setDetail(r);
  }
  async function baselines() {
    const guard = latest.current.capture();
    const r = await request<RevisionList>(
      ['revisions'],
      'GET',
      undefined,
      baselineAfter ? `?after=${baselineAfter}` : '',
    );
    if (!guard.current() || !mounted.current) return;
    setBaselineChoices((x) => [...x, ...r.items]);
    setBaselineAfter(r.nextCursor);
  }
  return {
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
  };
}
