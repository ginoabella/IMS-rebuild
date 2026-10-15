'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PbxNodeDto } from '@myims/contracts';
import { Button, Feedback, Field, Input, Panel } from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { getPbx, PbxError, savePbx } from './client';
import { write } from './validation';
import { emptyPbx, type PbxValues } from './work';
const fields = [
  { key: 'displayName', label: 'PBX name', bound: 800 },
  { key: 'targetAlias', label: 'Approved target alias', bound: 128 },
  { key: 'transport', label: 'Management transport', bound: 64 },
  { key: 'port', label: 'Management port', bound: 5 },
  { key: 'credentialAlias', label: 'Opaque credential alias', bound: 128 },
] as const;
export function valuesOf(node: PbxNodeDto): PbxValues {
  return {
    displayName: node.displayName,
    ...node.management,
    port: String(node.management.port),
    credentialAlias: node.credentialAlias,
  };
}
export function PbxForm({
  node,
  onSaved,
}: {
  node?: PbxNodeDto;
  onSaved?: (node: PbxNodeDto) => void;
}) {
  const work = useOperatorWork(),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [errors, setErrors] = useState<Partial<Record<keyof PbxValues, string>>>(
      {},
    );
  const busy = useRef(false),
    operation = useRef(0),
    focus = useRef<string | null>(null);
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  useEffect(() => {
    if (node && work.ready && work.pbx.edit?.id !== node.id)
      work.recordPbx({
        ...work.pbx,
        edit: {
          id: node.id,
          values: valuesOf(node),
          expectedVersion: node.version,
          needsReview: false,
        },
      });
  }, [node, work]);
  useEffect(() => {
    if (!pending && focus.current) {
      document.getElementById(focus.current)?.focus();
      focus.current = null;
    }
  }, [pending, errors, message]);
  const edit = node && work.pbx.edit?.id === node.id ? work.pbx.edit : null;
  const values = node ? (edit?.values ?? valuesOf(node)) : work.pbx.values;
  const blocked = node ? !edit || edit.needsReview : !!work.pbx.attempt;
  async function reload() {
    if (!node || busy.current) return;
    busy.current = true;
    setPending(true);
    const captured = work.capture(),
      epoch = ++operation.current;
    try {
      const canonical = await getPbx(node.id);
      if (!captured.current() || epoch !== operation.current) return;
      work.recordPbx({
        ...work.pbx,
        edit: {
          id: node.id,
          values,
          expectedVersion: canonical.version,
          needsReview: false,
        },
      });
      onSaved?.(canonical);
      setMessage(
        `Loaded saved version ${canonical.version}. Your input is preserved. Compare it with the saved connection above before explicitly saving.`,
      );
      focus.current = 'pbx-displayName';
    } catch (e) {
      if (captured.current() && epoch === operation.current) {
        if (e instanceof PbxError)
          setMessage('The saved node could not be loaded.');
        else work.rejectAccess(e);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function submit(retry = false) {
    if (busy.current || (blocked && !retry)) return;
    const desired = {
      displayName: values.displayName,
      management: {
        targetAlias: values.targetAlias,
        transport: values.transport,
        port: Number(values.port),
      },
      credentialAlias: values.credentialAlias,
    };
    const payload = node
      ? { ...desired, expectedVersion: edit?.expectedVersion ?? node.version }
      : retry
        ? work.pbx.attempt?.payload
        : { ...desired, requestId: crypto.randomUUID() };
    if (!payload) return;
    if (!write(payload, !!node)) {
      const next: Partial<Record<keyof PbxValues, string>> = {};
      if (!values.displayName.trim() || values.displayName.trim().length > 200)
        next.displayName = 'Use a name of 1–200 characters.';
      for (const f of ['targetAlias', 'credentialAlias'] as const)
        if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(values[f].trim().toLowerCase()))
          next[f] = 'Use an approved opaque alias.';
      if (!/^[a-z0-9-]{1,64}$/.test(values.transport))
        next.transport = 'Use the approved management transport.';
      if (
        !/^[0-9]{1,5}$/.test(values.port) ||
        Number(values.port) < 1 ||
        Number(values.port) > 65535
      )
        next.port = 'Use an approved port between 1 and 65535.';
      if (!Object.keys(next).length)
        next.displayName = 'Review the desired PBX fields.';
      setErrors(next);
      focus.current = `pbx-${fields.find((f) => next[f.key])?.key ?? 'displayName'}`;
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage('');
    setErrors({});
    const before = work.capture(),
      epoch = ++operation.current;
    try {
      if (
        !(await work.authorize()) ||
        !before.current() ||
        epoch !== operation.current
      )
        return;
      const captured = work.capture();
      // Intent is immutable from the moment transport begins. Recovery never replays it.
      if (!node && 'requestId' in payload) {
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const fingerprint = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('');
        if (!captured.current() || epoch !== operation.current) return;
        if (
          retry &&
          (work.pbx.attempt?.operatorId !== work.operatorId ||
            work.pbx.attempt.fingerprint !== fingerprint)
        )
          return;
        work.recordPbx({
          ...work.pbx,
          attempt: { operatorId: work.operatorId, fingerprint, epoch, payload },
        });
      }
      if (node && edit)
        work.recordPbx({ ...work.pbx, edit: { ...edit, needsReview: true } });
      try {
        const saved = await savePbx(payload, captured.proof, node?.id);
        if (!captured.current() || epoch !== operation.current) return;
        if (node) {
          work.recordPbx({
            ...work.pbx,
            edit: {
              id: saved.id,
              values: valuesOf(saved),
              expectedVersion: saved.version,
              needsReview: false,
            },
          });
          onSaved?.(saved);
          setMessage(
            `Saved desired version ${saved.version}. Observation is separate from this save.`,
          );
        } else {
          work.recordPbx({
            ...work.pbx,
            values: emptyPbx().values,
            attempt: null,
          });
        }
        await work.authorize();
        if (captured.current() && epoch === operation.current && !node)
          router.push(`/pbx-nodes/${saved.id}`);
      } catch (e) {
        if (!captured.current() || epoch !== operation.current) return;
        if (e instanceof PbxError) {
          const needsReview = e.status === 409;
          if (node && edit)
            work.recordPbx({ ...work.pbx, edit: { ...edit, needsReview } });
          if (
            !node &&
            e.reason !== 'intent_expired' &&
            e.reason !== 'request_conflict'
          )
            work.recordPbx({ ...work.pbx, attempt: null });
          const next: Partial<Record<keyof PbxValues, string>> = {};
          for (const f of fields)
            if (
              e.fields[
                f.key === 'targetAlias' ||
                f.key === 'transport' ||
                f.key === 'port'
                  ? 'management'
                  : f.key
              ]
            )
              next[f.key] =
                'Review this field and the approved connection profile.';
          setErrors(next);
          focus.current = `pbx-${fields.find((f) => next[f.key])?.key ?? 'displayName'}`;
          setMessage(
            e.reason === 'target_conflict'
              ? 'This installation is already registered. Inspect the PBX list.'
              : e.reason === 'stale_version'
                ? 'A newer version is saved. Reload and review before saving.'
                : e.reason === 'intent_expired'
                  ? 'The retry window has ended. Reload the registry to reconcile this intent.'
                  : e.reason === 'request_conflict'
                    ? 'The original intent conflicts. Reconcile the registry before continuing.'
                    : 'Review the PBX fields and try again.',
          );
        } else {
          setMessage(
            node
              ? 'Edit outcome is uncertain. Reload the saved version and review before another edit.'
              : 'Create outcome is uncertain. Explicitly retry the original submission to confirm it.',
          );
          work.rejectAccess(
            e instanceof AccessError ? e : new AccessError(503),
          );
        }
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Panel aria-label={node ? 'Connectivity edit' : 'Register PBX'}>
      <h2 className="font-display text-xl font-semibold">
        {node ? 'Edit desired connectivity' : 'Register PBX'}
      </h2>
      <p className="my-3 text-muted-foreground">
        Use a deployment-approved target, transport, port and opaque credential
        alias. The development observer supports AMI over TLS (ami-tls). Saving
        retains desired settings; it does not apply configuration or prove
        reachability. Never enter passwords, URLs or secret file locations.
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {fields.map((f) => (
          <Field
            key={f.key}
            id={`pbx-${f.key}`}
            label={f.label}
            error={errors[f.key]}
          >
            <Input
              id={`pbx-${f.key}`}
              required
              autoComplete="off"
              maxLength={f.bound}
              inputMode={f.key === 'port' ? 'numeric' : undefined}
              value={values[f.key]}
              disabled={pending || (!node && !!work.pbx.attempt)}
              aria-invalid={!!errors[f.key]}
              aria-describedby={
                errors[f.key] ? `pbx-${f.key}-error` : undefined
              }
              onChange={(e) => {
                const next = { ...values, [f.key]: e.target.value };
                if (node && edit)
                  work.recordPbx({
                    ...work.pbx,
                    edit: { ...edit, values: next },
                  });
                else work.recordPbx({ ...work.pbx, values: next });
                setErrors({});
              }}
            />
          </Field>
        ))}
        {message && <Feedback tone="warning" title={message} />}
        {!node && work.pbx.attempt && (
          <Feedback tone="warning" title="Original create needs confirmation">
            <p className="mb-3">
              The original payload is locked until its outcome is reconciled.
              Retry uses the same operator-bound key and payload.
            </p>
            <Button pending={pending} onClick={() => void submit(true)}>
              Retry original create
            </Button>
            <Link className="ml-3 text-primary underline" href="/pbx-nodes">
              Reload canonical registry
            </Link>
          </Feedback>
        )}
        {node && edit?.needsReview && (
          <Button
            pending={pending}
            variant="secondary"
            onClick={() => void reload()}
          >
            Reload saved version for review
          </Button>
        )}
        <Button type="submit" pending={pending} disabled={blocked}>
          {node ? 'Save desired connectivity' : 'Register PBX node'}
        </Button>
      </form>
    </Panel>
  );
}
