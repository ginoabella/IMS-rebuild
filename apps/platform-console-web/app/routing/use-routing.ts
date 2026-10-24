'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  RoutingDetailDto,
  RoutingDto,
  RoutingListDto,
  RoutingKind,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { RoutingError, routingRequest } from './client';
type FormValues = {
  gatewayId: string;
  didId: string;
  name: string;
  number: string;
  members: string;
  strategy: string;
  timeout: string;
  fallbackKind: string;
  fallbackId: string;
  purpose: string;
  patternKind: string;
  digits: string;
  minLength: string;
  maxLength: string;
};
type Attempt = {
  parts: string[];
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
};
type State = {
  mode: 'list' | 'create' | 'detail' | 'edit';
  selected: RoutingDto | null;
  values: FormValues;
  attempt: Attempt | null;
  review: boolean;
};
export const empty = (): State => ({
  mode: 'list',
  selected: null,
  values: {
    gatewayId: '',
    didId: '',
    name: '',
    number: '',
    members: '',
    strategy: 'simultaneous',
    timeout: '20',
    fallbackKind: 'hangup',
    fallbackId: '',
    purpose: '',
    patternKind: 'exact',
    digits: '',
    minLength: '1',
    maxLength: '15',
  },
  attempt: null,
  review: false,
});
export function form(r: RoutingDto): FormValues {
  return {
    ...empty().values,
    name: r.name,
    ...('destination' in r
      ? {
          gatewayId: r.gatewayId,
          didId: r.didId ?? '',
          fallbackKind: r.destination.kind,
          fallbackId: r.destination.kind === 'hangup' ? '' : r.destination.id,
        }
      : 'memberIds' in r
        ? {
            number: r.number ?? '',
            members: r.memberIds.join('\n'),
            strategy: r.strategy,
            timeout: String(r.timeout),
            fallbackKind: r.fallback.kind,
            fallbackId: r.fallback.kind === 'hangup' ? '' : r.fallback.id,
          }
        : {
            purpose: r.purpose,
            patternKind: r.pattern.kind,
            digits: r.pattern.digits,
            minLength: String(r.pattern.minLength),
            maxLength: String(r.pattern.maxLength),
          }),
  };
}
const messages: Record<string, string> = {
  selector_conflict:
    'This gateway/DID selector is already claimed, including by disabled rules.',
  invalid_gateway: 'Select an existing gateway on this PBX.',
  invalid_did: 'Select an existing DID associated with this gateway.',
  stale_version:
    'This definition changed. Reload canonical state, review and use the current version.',
  number_conflict:
    'This number or pattern intersects an existing extension, group or reservation, including disabled claims.',
  name_conflict: 'This name is already used.',
  invalid_extension: 'Select existing extensions on this PBX.',
  invalid_group: 'Choose a nonremoved fallback group on this PBX.',
  referenced:
    'Existing references block removal. Change or remove the listed routing definition first.',
  request_conflict:
    'The request ID was used for different values. Reload before continuing.',
  intent_expired:
    'This request expired. Inspect canonical records before creating again.',
  graph_limit: 'The fallback graph exceeds the supported 512-group bound.',
};
export function useRouting({ nodeId }: { nodeId: string }) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [kind, setKind] = useState<RoutingKind>('groups');
  const stateKey = `routing:${nodeId}:${kind}`;
  const activeScope = useRef(stateKey);
  activeScope.current = stateKey;
  const state: State = work.values[stateKey]
    ? JSON.parse(work.values[stateKey]!)
    : empty();
  const save = (s: State) =>
    work.record({ ...work.values, [stateKey]: JSON.stringify(s) });
  const [page, setPage] = useState<RoutingListDto>();
  const [after, setAfter] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const [message, setMessage] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [blockers, setBlockers] = useState<
      { id: string; name: string; kind?: 'groups' | 'inbound' }[]
    >([]);
  const [canonical, setCanonical] = useState<RoutingDto | null>(null),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false),
    generation = useRef(0);
  // A disabled fieldset cannot receive focus. Wait until the submission settles.
  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (!pending && field) document.getElementById(`routing-${field}`)?.focus();
  }, [errors, pending]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  async function reload() {
    const capture = latest.current.capture(),
      token = ++generation.current;
    try {
      const result = await routingRequest<RoutingListDto>(
        nodeId,
        ['routing', kind],
        'GET',
        undefined,
        undefined,
        after,
      );
      if (
        mounted.current &&
        capture.current() &&
        activeScope.current === stateKey &&
        token === generation.current
      )
        setPage(result);
    } catch (e) {
      if (
        mounted.current &&
        capture.current() &&
        activeScope.current === stateKey &&
        token === generation.current
      ) {
        setMessage('Unable to load resources. Retry reload.');
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    setPage(undefined);
    setCanonical(null);
    setMessage('');
    setErrors({});
    setBlockers([]);
    setConfirm(false);
    if (work.ready) void reload();
  }, [kind, nodeId, after, work.ready, work.operatorId]);
  async function inspect(id: string, target: RoutingKind = kind) {
    if (busy.current) return;
    const targetDraft = work.values[`routing:${nodeId}:${target}`];
    if (target !== kind && targetDraft) {
      const retained: State = JSON.parse(targetDraft);
      if (retained.attempt || retained.review) {
        setKind(target);
        setAfter(null);
        setHistory([]);
        return;
      }
    }
    busy.current = true;
    setPending(true);
    const capture = work.capture();
    try {
      const { resource } = await routingRequest<RoutingDetailDto>(nodeId, [
        'routing',
        target,
        id,
      ]);
      if (
        !(mounted.current && capture.current()) ||
        activeScope.current !== stateKey
      )
        return;
      latest.current.record({
        ...latest.current.values,
        [`routing:${nodeId}:${target}`]: JSON.stringify({
          ...empty(),
          mode: 'detail',
          selected: resource,
          values: form(resource),
          attempt: null,
          review: false,
        }),
      });
      if (target !== kind) {
        setKind(target);
        setAfter(null);
        setHistory([]);
      }
      setMessage('');
      setErrors({});
      setBlockers([]);
      setCanonical(null);
      setConfirm(false);
    } catch (e) {
      if (mounted.current && capture.current()) {
        setMessage('Unable to load detail. Reload and try again.');
        if (e instanceof AccessError && e.status !== 503) work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function review() {
    if (busy.current) return;
    const capture = work.capture();
    try {
      await reload();
      if (
        !(mounted.current && capture.current()) ||
        activeScope.current !== stateKey
      )
        return;
      if (state.selected) {
        const { resource } = await routingRequest<RoutingDetailDto>(nodeId, [
          'routing',
          kind,
          state.selected.id,
        ]);
        if (
          !(mounted.current && capture.current()) ||
          activeScope.current !== stateKey
        )
          return;
        setCanonical(resource);
        setMessage('Canonical detail loaded below. Review before continuing.');
      } else
        setMessage(
          'List reloaded. Retry the same create request to recover its exact result, or inspect a record.',
        );
    } catch (e) {
      if (mounted.current && capture.current()) {
        setMessage('Canonical reload failed. Retry reload.');
        if (e instanceof AccessError && e.status !== 503) work.rejectAccess(e);
      }
    }
  }
  async function run(attempt: Attempt, retry = false) {
    if (
      busy.current ||
      !work.ready ||
      (state.attempt && !retry) ||
      (state.review && !retry)
    )
      return;
    busy.current = true;
    setPending(true);
    setErrors({});
    setBlockers([]);
    try {
      if (!(await work.authorize())) return;
      const capture = latest.current.capture();
      if (
        !(mounted.current && capture.current()) ||
        activeScope.current !== stateKey
      )
        return;
      latest.current.record({
        ...latest.current.values,
        [stateKey]: JSON.stringify({ ...state, attempt }),
      });
      try {
        const { resource } = await routingRequest<RoutingDetailDto>(
          nodeId,
          attempt.parts,
          attempt.method,
          attempt.body,
          capture.proof,
        );
        if (
          !(mounted.current && capture.current()) ||
          activeScope.current !== stateKey
        )
          return;
        latest.current.record({
          ...latest.current.values,
          [stateKey]: JSON.stringify({
            ...state,
            mode: 'detail',
            selected: resource,
            values: form(resource),
            attempt: null,
            review: false,
          }),
        });
        setMessage(
          resource.removedAt
            ? 'Resource removed. History is retained.'
            : 'Desired settings saved.',
        );
        setCanonical(null);
        setConfirm(false);
        await reload();
      } catch (e) {
        if (
          !(mounted.current && capture.current()) ||
          activeScope.current !== stateKey
        )
          return;
        if (e instanceof RoutingError) {
          latest.current.record({
            ...latest.current.values,
            [stateKey]: JSON.stringify({
              ...state,
              attempt: null,
              review:
                e.detail.reason === 'stale_version' ||
                (e.status === 404 && !!state.selected),
            }),
          });
          setMessage(messages[e.detail.reason ?? ''] ?? e.detail.message);
          setErrors(e.detail.fieldErrors ?? {});
          setBlockers(e.detail.blockers ?? []);
        } else if (
          e instanceof AccessError &&
          (e.status === 403 || e.status === 429)
        ) {
          latest.current.record({
            ...latest.current.values,
            [stateKey]: JSON.stringify({
              ...state,
              attempt: null,
              review: false,
            }),
          });
          setMessage(
            e.status === 429
              ? 'Too many requests. Wait and retry.'
              : 'Access was denied. Restore access and retry with the retained input.',
          );
          latest.current.rejectAccess(e);
        } else {
          setMessage(
            'The write outcome is unknown. Reload canonical state before continuing. A create can also retry its exact request ID.',
          );
          if (e instanceof AccessError && e.status !== 503)
            latest.current.rejectAccess(e);
        }
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const change = (key: keyof FormValues, value: string) => {
    if (!state.attempt && !state.review)
      save({ ...state, values: { ...state.values, [key]: value } });
  };
  const v = state.values,
    r = state.selected;
  const blocked = pending || !!state.attempt || state.review;
  function submit() {
    const values = valuesForForm(kind, v);
    void run({
      parts: ['routing', kind, ...(state.mode === 'edit' && r ? [r.id] : [])],
      method: state.mode === 'edit' ? 'PATCH' : 'POST',
      body: {
        ...values,
        ...(state.mode === 'edit' && r
          ? { expectedVersion: r.version }
          : { requestId: crypto.randomUUID() }),
      },
    });
  }
  return {
    kind,
    setKind,
    state,
    save,
    page,
    after,
    setAfter,
    history,
    setHistory,
    message,
    setMessage,
    errors,
    setErrors,
    blockers,
    setBlockers,
    canonical,
    setCanonical,
    pending,
    confirm,
    setConfirm,
    reload,
    inspect,
    review,
    run,
    change,
    v,
    r,
    blocked,
    submit,
  };
}
export type RoutingModel = ReturnType<typeof useRouting>;

export function valuesForForm(
  kind: RoutingKind,
  v: FormValues,
): Record<string, unknown> {
  return kind === 'inbound'
    ? {
        name: v.name,
        gatewayId: v.gatewayId,
        didId: v.didId || null,
        destination:
          v.fallbackKind === 'hangup'
            ? { kind: 'hangup' }
            : { kind: v.fallbackKind, id: v.fallbackId },
      }
    : kind === 'groups'
      ? {
          name: v.name,
          number: v.number || null,
          memberIds: v.members.split('\n').filter(Boolean),
          strategy: v.strategy,
          timeout: Number(v.timeout),
          fallback:
            v.fallbackKind === 'hangup'
              ? { kind: 'hangup' }
              : { kind: v.fallbackKind, id: v.fallbackId },
        }
      : {
          name: v.name,
          purpose: v.purpose,
          pattern: {
            kind: v.patternKind,
            digits: v.digits,
            minLength:
              v.patternKind === 'exact' ? v.digits.length : Number(v.minLength),
            maxLength:
              v.patternKind === 'exact' ? v.digits.length : Number(v.maxLength),
          },
        };
}
