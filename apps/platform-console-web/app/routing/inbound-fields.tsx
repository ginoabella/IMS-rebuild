'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Panel, Select } from '@myims/ui-web';
import type {
  DidDto,
  GatewayDto,
  PeerListDto,
  InboundPreviewDto,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { peerRequest } from '../peers/client';
import { routingRequest, RoutingError } from './client';
import type { RoutingModel } from './use-routing';
import type { RoutingResources } from './use-resources';
type Props = {
  model: RoutingModel;
  nodeId: string;
  resources: RoutingResources;
};
export function InboundFields({
  model: m,
  nodeId,
  resources,
  inspection = false,
}: Props & { inspection?: boolean }) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [gateways, setGateways] = useState<GatewayDto[]>([]),
    [dids, setDids] = useState<DidDto[]>([]);
  const [gatewayAfter, setGatewayAfter] = useState<string | null>(null),
    [didAfter, setDidAfter] = useState<string | null>(null);
  const [message, setMessage] = useState(''),
    [dialled, setDialled] = useState(''),
    [preview, setPreview] = useState<InboundPreviewDto | null>(null);
  const generation = useRef(0),
    mounted = useRef(true);
  const selected = m.state.selected;
  const gatewayId =
    inspection && selected && 'gatewayId' in selected
      ? selected.gatewayId
      : m.v.gatewayId;
  const inputKey = JSON.stringify([
    nodeId,
    gatewayId,
    dialled,
    selected?.id,
    selected?.version,
  ]);
  const active = useRef(inputKey);
  active.current = inputKey;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  async function load(kind: 'gateways' | 'dids', more = false) {
    const capture = latest.current.capture(),
      token = generation.current;
    try {
      const r = await peerRequest<PeerListDto>(
        nodeId,
        ['peers', kind],
        'GET',
        undefined,
        undefined,
        more ? (kind === 'gateways' ? gatewayAfter : didAfter) : null,
      );
      if (
        !mounted.current ||
        !capture.current() ||
        token !== generation.current
      )
        return;
      if (kind === 'gateways') {
        setGateways((old) =>
          more
            ? [...old, ...(r.items as GatewayDto[])]
            : (r.items as GatewayDto[]),
        );
        setGatewayAfter(r.nextCursor);
      } else {
        setDids((old) =>
          more ? [...old, ...(r.items as DidDto[])] : (r.items as DidDto[]),
        );
        setDidAfter(r.nextCursor);
      }
      setMessage('');
    } catch (e) {
      if (
        mounted.current &&
        capture.current() &&
        token === generation.current
      ) {
        setMessage('Unable to load ingress. Reload choices.');
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    generation.current++;
    setGateways([]);
    setDids([]);
    setGatewayAfter(null);
    setDidAfter(null);
    if (work.ready) {
      void load('gateways');
      void load('dids');
    }
  }, [nodeId, work.operatorId, work.ready]);
  useEffect(() => setPreview(null), [inputKey]);
  async function showPreview() {
    const key = inputKey;
    let capture: ReturnType<typeof work.capture> | undefined;
    try {
      if (!(await latest.current.authorize())) return;
      capture = latest.current.capture();
      if (!mounted.current || !capture.current() || active.current !== key)
        return;
      const r = await routingRequest<InboundPreviewDto>(
        nodeId,
        ['routing', 'inbound', 'preview'],
        'POST',
        { gatewayId, dialled },
        capture.proof,
      );
      if (mounted.current && capture.current() && active.current === key)
        setPreview(r);
    } catch (e) {
      if (mounted.current && capture?.current() && active.current === key) {
        if (e instanceof RoutingError) {
          m.setErrors(e.detail.fieldErrors ?? {});
          setMessage(e.detail.reason ?? e.detail.message);
        } else if (e instanceof AccessError) {
          setMessage('Preview unavailable. Retry after reloading.');
          if (e.status !== 503) latest.current.rejectAccess(e);
        }
      }
    }
  }
  const gateway = gateways.find((g) => g.id === gatewayId);
  const didId =
    inspection && selected && 'didId' in selected ? selected.didId : m.v.didId;
  const did = dids.find((d) => d.id === didId);
  const destination =
    inspection && selected && 'destination' in selected
      ? selected.destination
      : null;
  const destinationKind = destination?.kind ?? m.v.fallbackKind;
  const destinationId =
    destination && destination.kind !== 'hangup'
      ? destination.id
      : m.v.fallbackId;
  const choices =
    destinationKind === 'extension' ? resources.extensions : resources.groups;
  return (
    <div className="min-w-0 space-y-4">
      {inspection ? (
        <>
          <p className="break-all">
            Gateway: {gateway?.name ?? gatewayId} ·{' '}
            {gateway?.enabled
              ? 'desired enabled'
              : 'disabled / availability unavailable'}
          </p>
          <p className="break-all">
            Selector:{' '}
            {didId
              ? `${did?.number ?? didId} · exact DID (first precedence)`
              : 'Gateway catch-all (after exact DID)'}
          </p>
          <p className="break-all">
            Destination:{' '}
            {destinationKind === 'hangup'
              ? 'Hang up'
              : (choices.find((c) => c.id === destinationId)?.label ??
                destinationId)}
          </p>
        </>
      ) : (
        <>
          <Field
            id="routing-gatewayId"
            label="Trusted gateway"
            error={m.errors.gatewayId}
          >
            <Select
              id="routing-gatewayId"
              required
              value={gatewayId}
              aria-invalid={!!m.errors.gatewayId}
              onChange={(e) => m.change('gatewayId', e.target.value)}
            >
              <option value="">Select a gateway</option>
              {gateways.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.enabled ? 'enabled' : 'disabled'} (desired)
                </option>
              ))}
              {gatewayId && !gateway && (
                <option value={gatewayId}>{gatewayId} · reload choices</option>
              )}
            </Select>
          </Field>
          <Field id="routing-didId" label="DID selector" error={m.errors.didId}>
            <Select
              id="routing-didId"
              value={m.v.didId}
              aria-invalid={!!m.errors.didId}
              onChange={(e) => m.change('didId', e.target.value)}
            >
              <option value="">Explicit gateway catch-all</option>
              {dids
                .filter((d) => d.gatewayId === gatewayId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.number} · {d.name} · {d.enabled ? 'enabled' : 'disabled'}
                  </option>
                ))}
              {m.v.didId &&
                !dids.some(
                  (d) => d.id === m.v.didId && d.gatewayId === gatewayId,
                ) && (
                  <option value={m.v.didId}>
                    {m.v.didId} · select a DID belonging to this gateway
                  </option>
                )}
            </Select>
          </Field>
          <Field
            id="routing-destination"
            label="Inbound destination"
            error={m.errors.destination}
          >
            <Select
              id="routing-destination"
              value={m.v.fallbackKind}
              onChange={(e) => m.change('fallbackKind', e.target.value)}
            >
              <option value="hangup">Hang up</option>
              <option value="extension">Extension</option>
              <option value="group">Ring group</option>
            </Select>
          </Field>
          {destinationKind !== 'hangup' && (
            <Field id="routing-destinationId" label="Destination resource">
              <Select
                id="routing-destinationId"
                required
                value={destinationId}
                onChange={(e) => m.change('fallbackId', e.target.value)}
              >
                <option value="">Select a destination</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
                {destinationId &&
                  !choices.some((c) => c.id === destinationId) && (
                    <option value={destinationId}>
                      {destinationId} · reload choices
                    </option>
                  )}
              </Select>
            </Field>
          )}
        </>
      )}
      <p>
        Exact DID takes precedence over the gateway catch-all, including a
        disabled exact claim. Leading zeros and + are significant. New rules
        start disabled and unbound. Disabled dependencies prevent eventual apply
        eligibility.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void load('gateways');
            void load('dids');
            void resources.load('extensions');
            void resources.load('groups');
          }}
        >
          Reload inbound resources
        </Button>
        {gatewayAfter && (
          <Button type="button" onClick={() => void load('gateways', true)}>
            More gateways
          </Button>
        )}
        {didAfter && (
          <Button type="button" onClick={() => void load('dids', true)}>
            More DIDs
          </Button>
        )}
        {resources.extAfter && (
          <Button
            type="button"
            onClick={() => void resources.load('extensions', true)}
          >
            More extensions
          </Button>
        )}
        {resources.groupAfter && (
          <Button
            type="button"
            onClick={() => void resources.load('groups', true)}
          >
            More groups
          </Button>
        )}
      </div>
      <Field
        id="routing-dialled"
        label="Sample dialled number"
        optional
        error={m.errors.dialled}
      >
        <Input
          id="routing-dialled"
          value={dialled}
          maxLength={16}
          onChange={(e) => setDialled(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        disabled={!gatewayId || !dialled || m.pending}
        onClick={() => void showPreview()}
      >
        Preview inbound match
      </Button>
      <p>
        Preview evaluates saved rules for the selected trusted gateway. No
        number alone establishes ingress or tenant identity. No call or live
        configuration change occurs.
      </p>
      {message && <p role="status">{message}</p>}
      {preview && (
        <div role="status" className="space-y-2">
          <p>
            {preview.reason} · {preview.precedence ?? 'no winning selector'} ·{' '}
            {preview.rule?.name ?? 'no rule'}
          </p>
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <ul>
            {preview.resources.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="break-all">
                {r.kind} {r.id} · v{r.version} ·{' '}
                {r.available ? 'desired enabled' : 'disabled / unavailable'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
export function InboundInspection(props: Props) {
  return (
    <Panel aria-label="Inbound associations">
      <InboundFields {...props} inspection />
    </Panel>
  );
}
