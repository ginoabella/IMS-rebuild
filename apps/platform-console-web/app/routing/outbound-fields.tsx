'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Select } from '@myims/ui-web';
import type {
  OutboundPreviewDto,
  PeerListDto,
  TrunkDto,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { peerRequest } from '../peers/client';
import { routingRequest, RoutingError } from './client';
import type { RoutingModel } from './use-routing';
export function OutboundFields({
  model: m,
  nodeId,
  inspection = false,
}: {
  model: RoutingModel;
  nodeId: string;
  inspection?: boolean;
}) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const [trunks, setTrunks] = useState<TrunkDto[]>([]),
    [after, setAfter] = useState<string | null>(null);
  const [message, setMessage] = useState(''),
    [dialled, setDialled] = useState(''),
    [preview, setPreview] = useState<OutboundPreviewDto | null>(null);
  const generation = useRef(0),
    mounted = useRef(true);
  const inputKey = JSON.stringify([
    nodeId,
    dialled,
    m.state.selected?.id,
    m.state.selected?.version,
    m.v,
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
  async function load(more = false) {
    const capture = latest.current.capture(),
      token = generation.current;
    try {
      const r = await peerRequest<PeerListDto>(
        nodeId,
        ['peers', 'trunks'],
        'GET',
        undefined,
        undefined,
        more ? after : null,
      );
      if (
        !mounted.current ||
        !capture.current() ||
        token !== generation.current
      )
        return;
      setTrunks((old) =>
        more ? [...old, ...(r.items as TrunkDto[])] : (r.items as TrunkDto[]),
      );
      setAfter(r.nextCursor);
      setMessage('');
    } catch (e) {
      if (
        mounted.current &&
        capture.current() &&
        token === generation.current
      ) {
        setMessage('Unable to load trunks. Reload choices.');
        if (e instanceof AccessError && e.status !== 503)
          latest.current.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    generation.current++;
    setTrunks([]);
    setAfter(null);
    if (work.ready) void load();
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
      const r = await routingRequest<OutboundPreviewDto>(
        nodeId,
        ['routing', 'outbound', 'preview'],
        'POST',
        { dialled },
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
          setMessage('Preview unavailable. Reload and retry.');
          if (e.status !== 503) latest.current.rejectAccess(e);
        }
      }
    }
  }
  const v = m.v;
  const input = (
    key:
      | 'digits'
      | 'minLength'
      | 'maxLength'
      | 'priority'
      | 'stripCount'
      | 'addPrefix',
    label: string,
    optional = false,
  ) => (
    <Field
      id={`routing-${key}`}
      label={label}
      optional={optional}
      error={m.errors[key] ?? (key === 'digits' ? m.errors.pattern : undefined)}
    >
      <Input
        id={`routing-${key}`}
        value={v[key]}
        required={!optional}
        maxLength={15}
        aria-invalid={
          !!(m.errors[key] || (key === 'digits' && m.errors.pattern))
        }
        aria-describedby={
          m.errors[key] || (key === 'digits' && m.errors.pattern)
            ? `routing-${key}-error`
            : undefined
        }
        onChange={(e) => m.change(key, e.target.value)}
      />
    </Field>
  );
  const selected = m.state.selected;
  const trunkId =
    inspection && selected && 'trunkId' in selected
      ? selected.trunkId
      : v.trunkId;
  const trunk = trunks.find((t) => t.id === trunkId);
  return (
    <div className="min-w-0 space-y-4">
      {inspection ? (
        <p className="break-all">
          Trunk: {trunk?.name ?? trunkId} ·{' '}
          {trunk?.enabled
            ? 'desired enabled'
            : 'disabled / availability unavailable'}
        </p>
      ) : (
        <>
          <Field
            id="routing-pattern"
            label="Outbound pattern"
            error={m.errors.pattern}
          >
            <Select
              id="routing-pattern"
              value={v.patternKind}
              aria-invalid={!!m.errors.pattern}
              aria-describedby={
                m.errors.pattern ? 'routing-pattern-error' : undefined
              }
              onChange={(e) => m.change('patternKind', e.target.value)}
            >
              <option value="exact">Exact number</option>
              <option value="prefix">Bounded digit prefix</option>
            </Select>
          </Field>
          {input('digits', 'ASCII digits')}
          {v.patternKind === 'prefix' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {input('minLength', 'Minimum total length')}
              {input('maxLength', 'Maximum total length')}
            </div>
          )}
          {input('priority', 'Priority (lower wins)')}
          <Field
            id="routing-trunkId"
            label="Outbound trunk"
            error={m.errors.trunkId}
          >
            <Select
              id="routing-trunkId"
              required
              value={trunkId}
              aria-invalid={!!m.errors.trunkId}
              aria-describedby={
                m.errors.trunkId ? 'routing-trunkId-error' : undefined
              }
              onChange={(e) => m.change('trunkId', e.target.value)}
            >
              <option value="">Select a trunk</option>
              {trunks
                .filter((t) => t.direction !== 'inbound')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.direction} ·{' '}
                    {t.enabled ? 'enabled' : 'disabled'} (desired)
                  </option>
                ))}
              {trunkId &&
                !trunks.some(
                  (t) => t.id === trunkId && t.direction !== 'inbound',
                ) && (
                  <option value={trunkId}>{trunkId} · reload choices</option>
                )}
            </Select>
          </Field>
          {input('stripCount', 'Leading digits to strip')}
          {input('addPrefix', 'Digit prefix to add', true)}
        </>
      )}
      <p>
        Exact digits or bounded prefixes, total length 1–15. Lower priority
        wins; disabled rules retain claims and deny when selected. Strip first,
        then add. Every possible output must contain 1–15 digits. Reservations
        block both original and transformed numbers. New rules start disabled
        and unbound.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Reload outbound trunks
        </Button>
        {after && (
          <Button type="button" onClick={() => void load(true)}>
            More trunks
          </Button>
        )}
      </div>
      <Field
        id="routing-dialled"
        label="Sample outbound number"
        optional
        error={m.errors.dialled}
      >
        <Input
          id="routing-dialled"
          aria-invalid={!!m.errors.dialled}
          aria-describedby={
            m.errors.dialled ? 'routing-dialled-error' : undefined
          }
          maxLength={15}
          value={dialled}
          onChange={(e) => setDialled(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        disabled={!dialled || m.pending}
        onClick={() => void showPreview()}
      >
        Preview outbound match
      </Button>
      <p>
        Preview evaluates saved rules. The sample is matching input. No tenant
        identity, live permission or call is established.
      </p>
      {message && <p role="status">{message}</p>}
      {preview && (
        <div role="status" className="space-y-2">
          <p>
            {preview.reason.replaceAll('_', ' ')} ·{' '}
            {preview.rule?.name ?? 'No matching rule: denied'}
            {preview.rule
              ? ` · priority ${preview.rule.priority} · transformed number ${preview.transformed}`
              : ''}
          </p>
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <ul>
            {preview.resources.map((r) => (
              <li key={r.id} className="break-all">
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
