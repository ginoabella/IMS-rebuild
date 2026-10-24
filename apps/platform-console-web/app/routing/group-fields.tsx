'use client';
import type { ReactNode } from 'react';
import { Button, Field, Input, Select } from '@myims/ui-web';
import type { RoutingModel } from './use-routing';
import type { RoutingResources } from './use-resources';
export function GroupFields({
  model: m,
  resources,
  input,
}: {
  model: RoutingModel;
  resources: RoutingResources;
  input: (
    key: keyof RoutingModel['v'],
    label: string,
    optional?: boolean,
  ) => ReactNode;
}) {
  const { v, change, errors } = m;
  const {
    members,
    extensions,
    groups,
    member,
    setMember,
    choiceMessage,
    extAfter,
    groupAfter,
    load,
    showPreview,
    preview,
  } = resources;
  return (
    <>
      {input('number', 'Dialable number', true)}
      <p>
        Optional 1000–899999. Extensions, groups and reserved patterns share the
        installation namespace.
      </p>
      <Field
        id="routing-memberIds"
        label="Add inventory member"
        error={errors.memberIds}
      >
        <Select
          id="routing-memberIds"
          value={member}
          aria-invalid={!!errors.memberIds}
          aria-describedby={
            errors.memberIds ? 'routing-memberIds-error' : undefined
          }
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="">Select an extension</option>
          {extensions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="button"
        disabled={!member || members.includes(member) || members.length >= 32}
        onClick={() => {
          change('members', [...members, member].join('\n'));
          setMember('');
        }}
      >
        Add member
      </Button>
      <ol className="space-y-2">
        {members.map((id, i) => (
          <li key={id} className="break-all">
            {i + 1}.{' '}
            {extensions.find((e) => e.id === id)?.label ??
              `${id} · reload choices to inspect availability`}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={i === 0}
                onClick={() => {
                  const next = [...members];
                  [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                  change('members', next.join('\n'));
                }}
              >
                Move member {i + 1} up
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  change('members', members.filter((x) => x !== id).join('\n'))
                }
              >
                Remove member {i + 1}
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Field
        id="routing-strategy"
        label="Ring strategy"
        error={errors.strategy}
      >
        <Select
          id="routing-strategy"
          value={v.strategy}
          onChange={(e) => change('strategy', e.target.value)}
        >
          <option value="simultaneous">Simultaneous</option>
          <option value="sequential">Ordered sequential</option>
        </Select>
      </Field>
      <Field
        id="routing-timeout"
        label="Timeout per attempt (seconds)"
        error={errors.timeout}
      >
        <Input
          id="routing-timeout"
          type="number"
          min={5}
          max={120}
          required
          value={v.timeout}
          aria-invalid={!!errors.timeout}
          aria-describedby={
            errors.timeout ? 'routing-timeout-error' : undefined
          }
          onChange={(e) => change('timeout', e.target.value)}
        />
      </Field>
      <p>
        Simultaneous rings all members for one attempt. Sequential tries each
        member in the displayed order for up to this timeout each. Busy,
        unavailable or unanswered advances. Exhaustion uses the explicit
        fallback.
      </p>
      <Field id="routing-fallback" label="Fallback" error={errors.fallback}>
        <Select
          id="routing-fallback"
          value={v.fallbackKind}
          aria-invalid={!!errors.fallback}
          aria-describedby={
            errors.fallback ? 'routing-fallback-error' : undefined
          }
          onChange={(e) => {
            change('fallbackKind', e.target.value);
          }}
        >
          <option value="hangup">Hang up</option>
          <option value="extension">Extension</option>
          <option value="group">Ring group</option>
        </Select>
      </Field>
      {v.fallbackKind !== 'hangup' && (
        <Field id="routing-fallbackId" label="Fallback destination">
          <Select
            id="routing-fallbackId"
            required
            value={v.fallbackId}
            onChange={(e) => change('fallbackId', e.target.value)}
          >
            <option value="">Select a destination</option>
            {(v.fallbackKind === 'extension' ? extensions : groups).map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
            {v.fallbackId &&
              !(v.fallbackKind === 'extension' ? extensions : groups).some(
                (e) => e.id === v.fallbackId,
              ) && (
                <option value={v.fallbackId}>
                  {v.fallbackId} · reload choices
                </option>
              )}
          </Select>
        </Field>
      )}
      <p>
        {choiceMessage ||
          'Disabled and unallocated stock may be planned; none is ready for tenant calling.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void load('extensions');
            void load('groups');
          }}
        >
          Reload resources
        </Button>
        {extAfter && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load('extensions', true)}
          >
            More extensions
          </Button>
        )}
        {groupAfter && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load('groups', true)}
          >
            More groups
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => void showPreview()}
        >
          Preview group
        </Button>
      </div>
      {preview && (
        <div role="status" className="space-y-2">
          <p>
            Advisory preview: {preview.attempts} attempt(s), up to{' '}
            {preview.maximumRingSeconds} seconds before this group exhausts.
            Fallback groups have their own attempts.
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
    </>
  );
}
