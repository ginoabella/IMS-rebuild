'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  ExtensionListDto,
  GroupDto,
  GroupPreviewDto,
  RoutingListDto,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { inventoryRequest } from '../inventory/client';
import { routingRequest, RoutingError } from './client';
import { valuesForForm, type RoutingModel } from './use-routing';
type Choice = { id: string; label: string };
export function useRoutingResources(m: RoutingModel, nodeId: string) {
  const { v, state } = m;
  const work = useOperatorWork();
  const latest = useRef(work);
  latest.current = work;
  const [extensions, setExtensions] = useState<Choice[]>([]),
    [groups, setGroups] = useState<Choice[]>([]);
  const [extAfter, setExtAfter] = useState<string | null>(null),
    [groupAfter, setGroupAfter] = useState<string | null>(null);
  const [choiceMessage, setChoiceMessage] = useState(''),
    [member, setMember] = useState(''),
    [preview, setPreview] = useState<GroupPreviewDto | null>(null);
  const previewInput = JSON.stringify([v, state.selected?.id]);
  const activePreviewInput = useRef(previewInput);
  activePreviewInput.current = previewInput;
  const scope = useRef(nodeId);
  scope.current = nodeId;
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      generation.current++;
      mounted.current = false;
    };
  }, []);
  async function load(which: 'extensions' | 'groups', more = false) {
    const capture = latest.current.capture(),
      token = generation.current;
    try {
      const choices: Choice[] = [];
      let cursor: string | null;
      if (which === 'extensions') {
        const result = await inventoryRequest<ExtensionListDto>(
          nodeId,
          ['extensions'],
          'GET',
          undefined,
          undefined,
          more ? extAfter : null,
        );
        cursor = result.nextCursor;
        choices.push(
          ...result.items.map((e) => ({
            id: e.id,
            label: `${e.number} · ${e.kind} · ${e.administrativeStatus} · unallocated, calling-ineligible`,
          })),
        );
      } else {
        const result = await routingRequest<RoutingListDto>(
          nodeId,
          ['routing', 'groups'],
          'GET',
          undefined,
          undefined,
          more ? groupAfter : null,
        );
        cursor = result.nextCursor;
        choices.push(
          ...(result.items as GroupDto[]).map((g) => ({
            id: g.id,
            label: `${g.name} · ${g.enabled ? 'enabled' : 'disabled'} (desired), unbound`,
          })),
        );
      }
      if (
        !capture.current() ||
        scope.current !== nodeId ||
        token !== generation.current
      )
        return;
      if (which === 'extensions') {
        setExtensions((old) => (more ? [...old, ...choices] : choices));
        setExtAfter(cursor);
      } else {
        setGroups((old) => (more ? [...old, ...choices] : choices));
        setGroupAfter(cursor);
      }
      setChoiceMessage('');
    } catch (e) {
      if (
        capture.current() &&
        scope.current === nodeId &&
        token === generation.current
      ) {
        setChoiceMessage('Unable to load choices. Reload resources.');
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    generation.current++;
    setExtensions([]);
    setGroups([]);
    setExtAfter(null);
    setGroupAfter(null);
    setPreview(null);
    if (work.ready) {
      void load('extensions');
      void load('groups');
    }
  }, [nodeId, work.operatorId, work.ready]);
  useEffect(
    () => setPreview(null),
    [
      v.name,
      v.number,
      v.members,
      v.strategy,
      v.timeout,
      v.fallbackId,
      v.fallbackKind,
    ],
  );
  async function showPreview() {
    const input = previewInput;
    let capture: ReturnType<typeof work.capture> | undefined;
    try {
      if (!(await latest.current.authorize())) return;
      // authorize revalidates access and advances the owner epoch. Capture afterward.
      capture = latest.current.capture();
      if (
        !capture.current() ||
        !mounted.current ||
        scope.current !== nodeId ||
        activePreviewInput.current !== input
      )
        return;
      const result = await routingRequest<GroupPreviewDto>(
        nodeId,
        ['routing', 'groups', 'preview'],
        'POST',
        {
          ...valuesForForm('groups', v),
          ...(state.selected ? { resourceId: state.selected.id } : {}),
        },
        capture.proof,
      );
      if (
        capture.current() &&
        mounted.current &&
        scope.current === nodeId &&
        activePreviewInput.current === input
      )
        setPreview(result);
    } catch (e) {
      if (
        capture?.current() &&
        mounted.current &&
        scope.current === nodeId &&
        activePreviewInput.current === input
      ) {
        if (e instanceof RoutingError) {
          m.setErrors(e.detail.fieldErrors ?? {});
          m.setMessage(e.detail.reason ?? e.detail.message);
        } else if (e instanceof AccessError) {
          m.setMessage('Preview unavailable. Reload and retry.');
          if (e.status !== 503) latest.current.rejectAccess(e);
        }
      }
    }
  }
  return {
    extensions,
    groups,
    extAfter,
    groupAfter,
    choiceMessage,
    member,
    setMember,
    preview,
    load,
    showPreview,
    members: v.members.split('\n').filter(Boolean),
  };
}
export type RoutingResources = ReturnType<typeof useRoutingResources>;
