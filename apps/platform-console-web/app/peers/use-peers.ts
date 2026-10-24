'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  TrunkCredentialListDto,
  TrunkCredentialSelection,
  PeerDetailDto,
  PeerDto,
  PeerListDto,
  PeerResource,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { PeerError, peerRequest } from './client';
type FormValues = {
  authentication: string;
  credential: string;
  registration: string;
  registrar: string;
  realm: string;
  name: string;
  direction: string;
  host: string;
  port: string;
  codecs: string;
  kind: string;
  trunkId: string;
  sources: string;
  number: string;
  gatewayId: string;
};
type Attempt = {
  parts: string[];
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
};
type State = {
  mode: 'list' | 'create' | 'detail' | 'edit';
  selected: PeerDto | null;
  values: FormValues;
  attempt: Attempt | null;
  review: boolean;
};
export const empty = (): State => ({
  mode: 'list',
  selected: null,
  values: {
    authentication: 'ip-peer',
    credential: '',
    registration: 'off',
    registrar: '',
    realm: '',
    name: '',
    direction: 'both',
    host: '',
    port: '5060',
    codecs: 'ulaw,alaw',
    kind: 'sip-device',
    trunkId: '',
    sources: '',
    number: '',
    gatewayId: '',
  },
  attempt: null,
  review: false,
});
export function form(r: PeerDto): FormValues {
  return {
    ...empty().values,
    name: r.name,
    ...('direction' in r
      ? {
          authentication: r.settings.authentication,
          credential: r.settings.credential
            ? `${r.settings.credential.id}:${r.settings.credential.version}`
            : '',
          registration: r.settings.registration ? 'on' : 'off',
          registrar: r.settings.registration?.registrar ?? '',
          realm: r.settings.registration?.realm ?? '',
          direction: r.direction,
          host: r.settings.host,
          port: String(r.settings.port),
          codecs:
            r.settings.codecs.length === 2
              ? 'ulaw,alaw'
              : r.settings.codecs.join(','),
        }
      : 'number' in r
        ? { number: r.number, gatewayId: r.gatewayId }
        : {
            kind: r.kind,
            trunkId: r.trunkId ?? '',
            sources: r.sourceAddresses.join('\n'),
          }),
  };
}
const messages: Record<string, string> = {
  invalid_credential:
    'This credential version is missing, unavailable or belongs to another installation/purpose. Reload credential choices and choose an available version.',
  stale_version:
    'This resource changed. Reload canonical detail, review it, then use the current version to continue.',
  name_conflict: 'This name is already used on this installation.',
  number_conflict:
    'This canonical number is already used on this installation, including disabled DIDs.',
  invalid_gateway: 'Choose a nonremoved gateway on this installation.',
  source_conflict:
    'A source address is already used by another gateway, including disabled gateways.',
  invalid_trunk:
    'Choose a trunk on this installation. Provider gateways require an inbound-capable trunk.',
  referenced:
    'Existing references block this change. Edit or remove the listed resources first.',
  request_conflict:
    'This request ID already identifies another create. Reload to review the original outcome.',
  intent_expired:
    'This create request expired. Reload and inspect the canonical records before starting again.',
  reserved_source:
    'This address is reserved for unmanaged ingress in deployment configuration.',
};
export function usePeers({ nodeId }: { nodeId: string }) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [kind, setKind] = useState<PeerResource>('trunks');
  const stateKey = `peers:${nodeId}:${kind}`;
  const activeScope = useRef(stateKey);
  activeScope.current = stateKey;
  const state: State = work.values[stateKey]
    ? JSON.parse(work.values[stateKey]!)
    : empty();
  const save = (s: State) =>
    work.record({ ...work.values, [stateKey]: JSON.stringify(s) });
  const [credentials, setCredentials] = useState<TrunkCredentialSelection[]>(
    [],
  );
  const [credentialCursor, setCredentialCursor] = useState<string | null>(null);
  const [credentialMessage, setCredentialMessage] = useState('');
  async function loadCredentials(more = false) {
    const capture = latest.current.capture();
    try {
      const result = await peerRequest<TrunkCredentialListDto>(
        nodeId,
        ['peers', 'trunks', 'credentials', 'selections'],
        'GET',
        undefined,
        undefined,
        more ? credentialCursor : null,
      );
      if (!capture.current()) return;
      setCredentials((old) =>
        more ? [...old, ...result.items] : result.items,
      );
      setCredentialCursor(result.nextCursor);
      setCredentialMessage(
        result.items.length
          ? ''
          : 'No confirmed credentials. Ask the development administrator to run trunk credential setup.',
      );
    } catch (e) {
      if (capture.current()) {
        setCredentialMessage('Unable to load credentials. Retry reload.');
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    setCredentials([]);
    setCredentialCursor(null);
    if (work.ready) void loadCredentials();
  }, [nodeId, work.ready, work.operatorId]);
  const [page, setPage] = useState<PeerListDto>();
  const [after, setAfter] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const [message, setMessage] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [blockers, setBlockers] = useState<
      {
        id: string;
        name: string;
        kind?: 'gateways' | 'dids' | 'inbound' | 'outbound';
      }[]
    >([]);
  const [canonical, setCanonical] = useState<PeerDto | null>(null),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false);
  const busy = useRef(false),
    generation = useRef(0);
  // A disabled fieldset cannot receive focus. Wait until the submission settles.
  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (!pending && field)
      document
        .getElementById(field === 'settings' ? 'peer-host' : `peer-${field}`)
        ?.focus();
  }, [errors, pending]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function reload() {
    const capture = latest.current.capture(),
      token = ++generation.current;
    try {
      const result = await peerRequest<PeerListDto>(
        nodeId,
        ['peers', kind],
        'GET',
        undefined,
        undefined,
        after,
      );
      if (
        capture.current() &&
        activeScope.current === stateKey &&
        token === generation.current
      )
        setPage(result);
    } catch (e) {
      if (
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
  async function inspect(id: string, target: PeerResource = kind) {
    if (busy.current) return;
    const targetDraft = work.values[`peers:${nodeId}:${target}`];
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
      const { resource } = await peerRequest<PeerDetailDto>(nodeId, [
        'peers',
        target,
        id,
      ]);
      if (!capture.current() || activeScope.current !== stateKey) return;
      latest.current.record({
        ...latest.current.values,
        [`peers:${nodeId}:${target}`]: JSON.stringify({
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
      if (capture.current()) {
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
      if (!capture.current() || activeScope.current !== stateKey) return;
      if (state.selected) {
        const { resource } = await peerRequest<PeerDetailDto>(nodeId, [
          'peers',
          kind,
          state.selected.id,
        ]);
        if (!capture.current() || activeScope.current !== stateKey) return;
        setCanonical(resource);
        setMessage('Canonical detail loaded below. Review before continuing.');
      } else
        setMessage(
          'List reloaded. Retry the same create request to recover its exact result, or inspect a record.',
        );
    } catch (e) {
      if (capture.current()) {
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
      if (!capture.current() || activeScope.current !== stateKey) return;
      latest.current.record({
        ...latest.current.values,
        [stateKey]: JSON.stringify({ ...state, attempt }),
      });
      try {
        const { resource } = await peerRequest<PeerDetailDto>(
          nodeId,
          attempt.parts,
          attempt.method,
          attempt.body,
          capture.proof,
        );
        if (!capture.current() || activeScope.current !== stateKey) return;
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
        if (!capture.current() || activeScope.current !== stateKey) return;
        if (e instanceof PeerError) {
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
    const values =
      kind === 'trunks'
        ? {
            name: v.name,
            direction: v.direction,
            settings: {
              host: v.host,
              port: Number(v.port),
              transport: 'udp',
              media: 'rtp',
              codecs: v.codecs.split(',').map((s) => s.trim()),
              directMedia: false,
              rtpSymmetric: true,
              forceRport: true,
              authentication: v.authentication,
              ...(v.authentication === 'outbound-digest'
                ? {
                    credential: {
                      id: v.credential.split(':')[0] ?? '',
                      version: Number(v.credential.split(':')[1]),
                    },
                    ...(v.registration === 'on'
                      ? {
                          registration: {
                            registrar: v.registrar,
                            realm: v.realm,
                            expiration: 3600,
                            retryInterval: 60,
                            forbiddenRetryInterval: 10,
                          },
                        }
                      : {}),
                  }
                : {}),
            },
          }
        : kind === 'dids'
          ? { name: v.name, number: v.number, gatewayId: v.gatewayId.trim() }
          : {
              name: v.name,
              kind: v.kind,
              trunkId: v.trunkId.trim() || null,
              sourceAddresses: v.sources.split(/[\s,]+/).filter(Boolean),
            };
    void run({
      parts: ['peers', kind, ...(state.mode === 'edit' && r ? [r.id] : [])],
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
    credentials,
    credentialCursor,
    credentialMessage,
    loadCredentials,
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
export type PeerModel = ReturnType<typeof usePeers>;
