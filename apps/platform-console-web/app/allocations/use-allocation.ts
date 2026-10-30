'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  AllocationList,
  AllocationStock,
  AllocationTenant,
  AllocationPreview,
  AllocationSave,
  AllocationChange,
  AllocationOutcome,
  InventoryClaim,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { allocationRequest, AllocationError } from './client';
type Attempt = { parts: string[]; body: AllocationSave | AllocationChange };
export function useNodeAllocation({
  tenantId,
  nodeId,
}: {
  tenantId: string;
  nodeId: string;
}) {
  const work = useOperatorWork();
  const [saved, setSaved] = useState<AllocationList | null>(null),
    [stock, setStock] = useState<AllocationStock[]>([]),
    [stockCursor, setStockCursor] = useState<string | null>(null),
    [stockAfter, setStockAfter] = useState<string | null>(null),
    [claimAfter, setClaimAfter] = useState<string | null>(null),
    [history, setHistory] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [mode, setMode] = useState('individual'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [state, setState] = useState<'reserved' | 'allocated'>('reserved'),
    [preview, setPreview] = useState<AllocationPreview | null>(null),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [canonicalReviewed, setCanonicalReviewed] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const live = useRef(true),
    busy = useRef(false),
    readEpoch = useRef(0),
    editEpoch = useRef(0),
    attemptRef = useRef<Attempt | null>(null),
    latest = useRef(work);
  latest.current = work;
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function note(s: string) {
    setMessage(s);
    requestAnimationFrame(() => {
      if (live.current) feedback.current?.focus();
    });
  }
  function retain(a: Attempt | null) {
    if (a) setCanonicalReviewed(false);
    attemptRef.current = a;
    setAttempt(a);
  }
  async function reload(cAfter = claimAfter, sAfter = stockAfter, h = history) {
    const access = latest.current,
      capture = access.capture(),
      epoch = ++readEpoch.current;
    if (!access.ready) return;
    try {
      const [claims, inventory] = await Promise.all([
        allocationRequest<AllocationList>(
          tenantId,
          nodeId,
          [],
          undefined,
          undefined,
          `?limit=25${cAfter ? '&after=' + cAfter : ''}${h ? '&history=true' : ''}`,
        ),
        allocationRequest<{
          items: AllocationStock[];
          nextCursor: string | null;
          tenant: AllocationTenant;
        }>(
          tenantId,
          nodeId,
          ['stock'],
          undefined,
          undefined,
          `?limit=25${sAfter ? '&after=' + sAfter : ''}`,
        ),
      ]);
      if (live.current && epoch === readEpoch.current && capture.current()) {
        setSaved(claims);
        if (attemptRef.current) setCanonicalReviewed(true);
        setStock(inventory.items);
        setStockCursor(inventory.nextCursor);
        setClaimAfter(cAfter);
        setStockAfter(sAfter);
      }
    } catch (e) {
      if (live.current && capture.current()) {
        note(
          'Saved allocation could not be loaded. Reload after access is restored.',
        );
        if (!(e instanceof AllocationError)) access.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    if (work.ready) void reload();
  }, [work.ready]);
  function edit() {
    editEpoch.current++;
    setPreview(null);
    setMessage('');
  }
  async function review() {
    if (busy.current || !work.ready || attemptRef.current) return;
    busy.current = true;
    setPending(true);
    const capture = work.capture(),
      epoch = editEpoch.current;
    try {
      const r = await allocationRequest<AllocationPreview>(
        tenantId,
        nodeId,
        ['preview'],
        capture.proof,
        {
          selection:
            mode === 'range'
              ? { range: { start, end } }
              : { extensionIds: chosen },
        },
      );
      if (live.current && capture.current() && epoch === editEpoch.current) {
        setPreview(r);
        note(
          r.canSave
            ? 'Review the exact stock below, then save.'
            : 'Selection contains missing or owned stock, pending credential work, or an ineligible tenant. Review the selection.',
        );
      }
    } catch (e) {
      if (live.current && capture.current()) {
        note(
          e instanceof AllocationError
            ? 'Review selection: choose 1–50 existing extensions or a valid range.'
            : 'Preview unavailable. Inputs are retained.',
        );
        if (!(e instanceof AllocationError)) work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  async function submit(original: Attempt) {
    if (busy.current || !work.ready) return;
    busy.current = true;
    setPending(true);
    let sent = false;
    const before = work.capture();
    try {
      if (!(await work.authorize()) || !before.current() || !live.current)
        return;
      const capture = work.capture();
      readEpoch.current++;
      retain(original);
      sent = true;
      const result = await allocationRequest<AllocationOutcome>(
        tenantId,
        nodeId,
        original.parts,
        capture.proof,
        original.body,
      );
      if (!live.current) return;
      if (!capture.current()) {
        note(
          'Outcome is uncertain. Restore access, then retry the exact original request or review saved ownership.',
        );
        return;
      }
      retain(null);
      if (original.parts.length === 0) setChosen([]);
      setPreview(null);
      note(
        result.replayed
          ? 'Original outcome recovered. Reloaded saved ownership may be newer.'
          : 'Ownership saved. Calling verification remains separate.',
      );
      await reload();
    } catch (e) {
      if (!live.current) return;
      if (e instanceof AllocationError && before.current()) {
        retain(null);
        note(
          `Allocation was rejected: ${e.reason.replaceAll('_', ' ')}.${e.blockers.length ? ' ' + e.blockers.map((b) => b.name).join('; ') : ''} Inputs are retained; reload and preview before saving again.`,
        );
        setPreview(null);
      } else {
        if (sent)
          note(
            'Outcome is uncertain. Restore access, then retry the exact original request or review saved ownership.',
          );
        if (before.current()) work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  function save() {
    if (!preview?.canSave || attemptRef.current) return;
    void submit({
      parts: [],
      body: {
        requestId: crypto.randomUUID(),
        expectedTenantVersion: preview.tenant.version,
        expectedAuthorityVersion: preview.tenant.authorityVersion,
        state,
        items: preview.items.flatMap((i) =>
          i.missing ? [] : [{ extensionId: i.id, expectedVersion: i.version }],
        ),
      },
    });
  }
  function change(c: InventoryClaim, action: 'promote' | 'release') {
    if (!saved || attemptRef.current) return;
    void submit({
      parts: [c.id, action],
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: c.version,
        expectedTenantVersion: saved.tenant.version,
        expectedAuthorityVersion: saved.tenant.authorityVersion,
      },
    });
  }
  const disabled = !work.ready || pending || !!attempt;
  return {
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
  };
}
