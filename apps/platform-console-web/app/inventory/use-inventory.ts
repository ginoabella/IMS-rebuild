'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  ExtensionDto,
  ExtensionListDto,
  EndpointProfileListDto,
  ExtensionBulkPreviewDto,
  EndpointProfileDto,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { inventoryRequest, InventoryError } from './client';
import { describeResult, type InventoryMutationResult } from './result';
import {
  emptyInventory,
  type InventoryAttempt,
  type InventoryWork,
} from './work';
export function useInventory(nodeId: string) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [page, setPage] = useState<ExtensionListDto>(),
    [profiles, setProfiles] = useState<EndpointProfileListDto>();
  const [profileAfter, setProfileAfter] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [readError, setReadError] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const busy = useRef(false),
    generation = useRef(0);
  const state = work.inventory;
  const matches = state.nodeId === nodeId;
  const record = (next: InventoryWork) => work.recordInventory(next);
  useEffect(() => {
    if (work.ready && !matches)
      record({ ...emptyInventory(), nodeId, workflowId: crypto.randomUUID() });
  }, [work.ready, matches, nodeId]);
  useEffect(() => {
    return () => {
      generation.current++;
    };
  }, []);
  async function reload() {
    const capture = latest.current.capture(),
      token = ++generation.current;
    try {
      const [inventory, catalog] = await Promise.all([
        inventoryRequest<ExtensionListDto>(
          nodeId,
          ['extensions'],
          'GET',
          undefined,
          undefined,
          cursors.at(-1),
        ),
        inventoryRequest<EndpointProfileListDto>(
          nodeId,
          ['endpoint-profiles'],
          'GET',
          undefined,
          undefined,
          profileAfter,
        ),
      ]);
      if (!capture.current() || token !== generation.current) return;
      setPage(inventory);
      setProfiles(catalog);
      setReadError(false);
      return { inventory, catalog };
    } catch (e) {
      if (!capture.current() || token !== generation.current) return;
      setReadError(true);
      if (!(e instanceof InventoryError)) latest.current.rejectAccess(e);
    }
  }
  useEffect(() => {
    setPage(undefined);
    setProfiles(undefined);
    if (work.ready && matches) void reload();
  }, [work.ready, work.operatorId, nodeId, cursors, profileAfter, matches]);
  useEffect(() => {
    if (pending || !work.ready || !Object.keys(errors).length) return;
    const fields: Record<string, string> = {
      number: 'inventory-number',
      numbers: 'bulk-numbers',
      dependencies: 'inventory-profile',
      name: 'profile-name',
      settings: 'profile-codecs',
    };
    const first = Object.keys(errors).find((key) => fields[key]);
    if (first) document.getElementById(fields[first]!)?.focus();
  }, [errors, pending, work.ready]);
  const change = (name: string, value: string) => {
    setErrors({});
    if (!busy.current && !state.attempt)
      record({
        ...state,
        values: { ...state.values, [name]: value },
        preview: null,
      });
  };
  async function run(
    parts: string[],
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    retry = false,
  ) {
    if (busy.current || !matches || !work.ready) return;
    const old = state.attempt;
    if (
      (old && !retry) ||
      (retry &&
        (!old ||
          old.operatorId !== work.operatorId ||
          old.workflowId !== state.workflowId))
    )
      return;
    if (!retry && state.needsReview) {
      setMessage('Reload canonical state and review before a new action.');
      return;
    }
    const attempt: InventoryAttempt =
      retry && old
        ? old
        : {
            operatorId: work.operatorId,
            workflowId: state.workflowId,
            parts,
            method,
            body,
          };
    const capture = work.capture(),
      token = ++generation.current;
    if (!capture.current()) return;
    record({ ...state, attempt });
    busy.current = true;
    setPending(true);
    setMessage('Submitting reviewed intent…');
    try {
      const value = await inventoryRequest<InventoryMutationResult>(
        nodeId,
        attempt.parts,
        attempt.method,
        attempt.body,
        capture.proof,
      );
      if (!capture.current() || token !== generation.current) return;
      record({ ...state, attempt: null, preview: null, needsReview: true });
      setMessage(
        `Saved desired result: ${describeResult(value)} Review canonical state before another action. No live application or readiness is established.`,
      );
      await reload();
    } catch (e) {
      if (!capture.current() || token !== generation.current) return;
      if (e instanceof InventoryError) {
        setErrors(e.fields);
        record({
          ...state,
          attempt: null,
          needsReview: e.status === 409 || method === 'PATCH',
        });
        setMessage(
          `${e.reason.replaceAll('_', ' ')}${e.conflicts.length ? `: ${e.conflicts.join(', ')}` : ''}. Input retained; reload and review conflicts.`,
        );
      } else {
        record({ ...state, attempt, needsReview: attempt.method === 'PATCH' });
        setMessage(
          'Result uncertain. Explicitly retry the same immutable intent, or reload canonical state and review.',
        );
        work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function preview(body: Record<string, unknown>) {
    if (busy.current || state.attempt || !work.ready || !matches) return;
    const capture = work.capture(),
      token = ++generation.current;
    if (!capture.current()) return;
    busy.current = true;
    setPending(true);
    try {
      const value = await inventoryRequest<ExtensionBulkPreviewDto>(
        nodeId,
        ['extensions', 'bulk-preview'],
        'POST',
        body,
        capture.proof,
      );
      if (capture.current() && token === generation.current) {
        record({ ...state, preview: value });
        setMessage(
          'Advisory preview loaded. Review exact numbers before atomic commit; commit revalidates collisions and dependencies.',
        );
      }
    } catch (e) {
      if (capture.current() && token === generation.current) {
        if (e instanceof InventoryError)
          setMessage(`${e.reason}: ${e.conflicts.join(', ')}. Input retained.`);
        else work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function select(extension: ExtensionDto) {
    if (busy.current || state.attempt || !work.ready || !matches) return;
    const capture = work.capture(),
      token = ++generation.current;
    try {
      const result = await inventoryRequest<{ extension: ExtensionDto }>(
        nodeId,
        ['extensions', extension.id],
      );
      if (capture.current() && token === generation.current) {
        record({
          ...latest.current.inventory,
          extension: result.extension,
          needsReview: false,
        });
        setMessage(
          `Loaded extension ${result.extension.number}, version ${result.extension.version}. Review selected desired state.`,
        );
      }
    } catch (e) {
      if (capture.current() && token === generation.current) {
        if (e instanceof InventoryError) setMessage(e.reason);
        else work.rejectAccess(e);
      }
    }
  }
  return {
    work,
    state,
    matches,
    record,
    change,
    page,
    profiles,
    message,
    pending,
    readError,
    errors,
    reload,
    run,
    preview,
    select,
    previous: () => setCursors((c) => c.slice(0, -1)),
    next: () => {
      if (page?.nextCursor) setCursors((c) => [...c, page.nextCursor]);
    },
    hasPrevious: cursors.length > 1,
    nextProfiles: () => {
      if (profiles?.nextCursor) setProfileAfter(profiles.nextCursor);
    },
    firstProfiles: () => setProfileAfter(null),
    review: async () => {
      if (busy.current || state.attempt) return;
      const capture = work.capture(),
        workflow = state.workflowId;
      const loaded = await reload();
      if (
        !loaded ||
        !capture.current() ||
        latest.current.inventory.workflowId !== workflow
      )
        return;
      const token = generation.current;
      try {
        const extension = state.extension
          ? (
              await inventoryRequest<{ extension: ExtensionDto }>(nodeId, [
                'extensions',
                state.extension.id,
              ])
            ).extension
          : null;
        const profile = state.profile
          ? (
              await inventoryRequest<{ profile: EndpointProfileDto }>(nodeId, [
                'endpoint-profiles',
                state.profile.id,
                'versions',
                String(
                  loaded.catalog.items.find((p) => p.id === state.profile?.id)
                    ?.headVersion ?? state.profile.headVersion,
                ),
              ])
            ).profile
          : null;
        if (
          !capture.current() ||
          token !== generation.current ||
          latest.current.inventory.workflowId !== workflow
        )
          return;
        record({
          ...latest.current.inventory,
          extension,
          profile,
          needsReview: false,
        });
        setMessage(
          'Canonical versions reloaded for explicit review. Input is retained; compare it with saved state before submitting.',
        );
      } catch (e) {
        if (capture.current() && token === generation.current) {
          if (e instanceof InventoryError) setMessage(e.reason);
          else work.rejectAccess(e);
        }
      }
    },
    setMessage,
  };
}
export type InventoryModel = ReturnType<typeof useInventory>;
