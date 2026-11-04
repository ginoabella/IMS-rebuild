'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  RouteAuthorization,
  RouteAuthorizationKind,
  RouteBindingReview,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { bindingRequest, BindingError } from './client';
type Tenant = {
  id: string;
  status: string;
  version: number;
  authorityVersion: number;
};
export type Saved = RouteAuthorization & { review: RouteBindingReview };
type Page = { items: Saved[]; nextCursor: string | null; tenant: Tenant };
type Choice = {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
  owner: string | null;
  scope: string | null;
};
type Attempt = { parts: string[]; body: Record<string, unknown> };
export function useBindings(
  tenantId: string,
  nodeId: string,
  initial: RouteAuthorizationKind,
) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [kind, setKind] = useState(initial),
    [resourceId, setResourceId] = useState(''),
    [scope, setScope] = useState<'owned' | 'shared'>('owned'),
    [saved, setSaved] = useState<Page | null>(null),
    [choices, setChoices] = useState<Choice[]>([]),
    [choiceCursor, setChoiceCursor] = useState<string | null>(null),
    [review, setReview] = useState<RouteBindingReview | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [reviewed, setReviewed] = useState(false),
    [blockers, setBlockers] = useState<RouteBindingReview['blockers']>([]),
    [history, setHistory] = useState(false);
  const live = useRef(true),
    busy = useRef(false),
    epoch = useRef(0),
    attemptRef = useRef<Attempt | null>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  function note(text: string) {
    if (!live.current || !latest.current.ready) return;
    setMessage(text);
    requestAnimationFrame(() => {
      if (live.current && latest.current.ready) feedback.current?.focus();
    });
  }
  function retain(a: Attempt | null) {
    attemptRef.current = a;
    setAttempt(a);
    setReviewed(false);
  }
  function edit() {
    setMessage('Unsaved selection. Preview current values.');
    epoch.current++;
    setReview(null);
    setBlockers([]);
  }
  async function load(
    after: string | null = null,
    selectionAfter: string | null = null,
    h = history,
  ) {
    const capture = latest.current.capture(),
      revision = ++epoch.current;
    if (!latest.current.ready || busy.current) return;
    busy.current = true;
    setPending(true);
    setReview(null);
    try {
      const [page, selection] = await Promise.all([
        bindingRequest<Page>(
          tenantId,
          nodeId,
          [],
          undefined,
          undefined,
          `?limit=25${after ? '&after=' + after : ''}${h ? '&history=true' : ''}`,
        ),
        bindingRequest<{ items: Choice[]; nextCursor: string | null }>(
          tenantId,
          nodeId,
          ['selection'],
          undefined,
          undefined,
          `?kind=${kind}&limit=25${selectionAfter ? '&after=' + selectionAfter : ''}`,
        ),
      ]);
      if (live.current && capture.current() && revision === epoch.current) {
        setSaved(page);
        setChoices(selection.items);
        setChoiceCursor(selection.nextCursor);
        if (attemptRef.current) setReviewed(true);
      }
    } catch (e) {
      if (live.current && capture.current() && revision === epoch.current) {
        note('Saved route configuration could not be loaded.');
        latest.current.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  useEffect(() => {
    if (work.ready) void load();
  }, [work.ready, kind]);
  async function preview() {
    if (busy.current || !work.ready || attemptRef.current || !resourceId)
      return;
    const capture = work.capture(),
      revision = epoch.current;
    busy.current = true;
    setPending(true);
    try {
      const r = await bindingRequest<RouteBindingReview>(
        tenantId,
        nodeId,
        ['preview'],
        capture.proof,
        { kind, resourceId, scope },
      );
      if (live.current && capture.current() && revision === epoch.current) {
        setReview(r);
        setBlockers(r.blockers);
        note(
          r.compatible
            ? 'Review passed. Save desired authorization.'
            : 'Review the ownership and graph blockers.',
        );
      }
    } catch (e) {
      if (live.current && capture.current()) {
        if (e instanceof BindingError) {
          setBlockers(e.blockers);
          note(e.reason);
        } else {
          note('Preview unavailable.');
          work.rejectAccess(e);
        }
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  async function submit(a: Attempt) {
    if (busy.current || !work.ready) return;
    const capture = work.capture();
    busy.current = true;
    setPending(true);
    retain(a);
    let reload = false;
    try {
      const result = await bindingRequest<{ replayed: boolean }>(
        tenantId,
        nodeId,
        a.parts,
        capture.proof,
        a.body,
      );
      if (live.current && capture.current()) {
        retain(null);
        setReview(null);
        note(
          result.replayed
            ? 'Original outcome recovered. Reloaded saved configuration may be newer. Live verification is pending.'
            : 'Desired authorization saved. Live verification is pending.',
        );
        reload = true;
      }
    } catch (e) {
      if (live.current && capture.current()) {
        if (e instanceof BindingError) {
          retain(null);
          setReview(null);
          setBlockers(e.blockers);
          note(`Review required: ${e.reason}. Your selection is preserved.`);
        } else {
          note(
            'Outcome uncertain. Retain this original request and reconcile after access returns.',
          );
          work.rejectAccess(e);
        }
      }
    } finally {
      busy.current = false;
      if (live.current) {
        setPending(false);
        if (reload) void load();
      }
    }
  }
  async function advisory(dialled: string) {
    if (busy.current || !work.ready || attemptRef.current) return;
    const capture = work.capture(),
      revision = epoch.current;
    busy.current = true;
    setPending(true);
    try {
      const r = await bindingRequest<{
        reason: string;
        transformed: string | null;
      }>(tenantId, nodeId, ['outbound-preview'], capture.proof, { dialled });
      if (live.current && capture.current() && revision === epoch.current)
        note(
          `Tenant advisory: ${r.reason}${r.transformed ? ' → ' + r.transformed : ''}. Live verification pending.`,
        );
    } catch (e) {
      if (live.current && capture.current() && revision === epoch.current) {
        if (e instanceof BindingError) note('Review the advisory number.');
        else work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  function save() {
    if (!saved || !review?.compatible || attemptRef.current) return;
    void submit({
      parts: [],
      body: {
        requestId: crypto.randomUUID(),
        expectedTenantVersion: saved.tenant.version,
        expectedAuthorityVersion: saved.tenant.authorityVersion,
        expectedVersion: review.currentVersion,
        kind,
        resourceId,
        scope,
        evaluated: review.evaluated,
      },
    });
  }
  function revoke(a: Saved) {
    if (!saved || attemptRef.current) return;
    void submit({
      parts: [a.id, 'revoke'],
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: a.version,
        expectedTenantVersion: saved.tenant.version,
        expectedAuthorityVersion: saved.tenant.authorityVersion,
      },
    });
  }
  return {
    work,
    kind,
    setKind,
    resourceId,
    setResourceId,
    scope,
    setScope,
    saved,
    choices,
    choiceCursor,
    review,
    pending,
    message,
    attempt,
    reviewed,
    blockers,
    history,
    setHistory,
    feedback,
    note,
    retain,
    edit,
    load,
    preview,
    submit,
    save,
    revoke,
    advisory,
  };
}
