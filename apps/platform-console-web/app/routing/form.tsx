'use client';
import { Button, Field, Input, Panel, Select } from '@myims/ui-web';
import type { RoutingModel } from './use-routing';
import { useRoutingResources } from './use-resources';
import { GroupFields } from './group-fields';
export function RoutingForm({
  model: m,
  nodeId,
}: {
  model: RoutingModel;
  nodeId: string;
}) {
  const { v, state, kind, change, errors, blocked } = m;
  const resources = useRoutingResources(m, nodeId);
  if (
    state.mode === 'detail' &&
    state.selected &&
    'memberIds' in state.selected
  ) {
    const group = state.selected;
    const fallback = group.fallback;
    const choices =
      fallback.kind === 'extension' ? resources.extensions : resources.groups;
    return (
      <Panel aria-label="Group dependencies">
        <h2 className="font-display text-xl">Members and fallback</h2>
        <p>
          {group.strategy === 'sequential'
            ? 'Ordered sequential: one attempt per member in this order.'
            : 'Simultaneous: one attempt for all members.'}{' '}
          Up to {group.timeout} seconds per attempt; busy, unavailable or
          unanswered advances. Exhaustion uses the fallback.
        </p>
        <ol>
          {group.memberIds.map((id, i) => (
            <li key={id} className="break-all">
              {i + 1}.{' '}
              {resources.extensions.find((e) => e.id === id)?.label ??
                `${id} · availability not loaded`}
            </li>
          ))}
        </ol>
        <p className="break-all">
          Fallback:{' '}
          {fallback.kind === 'hangup'
            ? 'Hang up'
            : (choices.find((c) => c.id === fallback.id)?.label ??
              `${fallback.id} · availability not loaded`)}
        </p>
        <p>
          Desired only. Disabled/unallocated members remain calling-ineligible;
          unbound groups have no tenant ownership. Preview all reachable
          dependencies from Edit group.
        </p>
        {resources.choiceMessage && (
          <p role="status">{resources.choiceMessage}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              void resources.load('extensions');
              void resources.load('groups');
            }}
          >
            Reload dependencies
          </Button>
          {resources.extAfter && (
            <Button
              variant="secondary"
              onClick={() => void resources.load('extensions', true)}
            >
              More dependency extensions
            </Button>
          )}
          {resources.groupAfter && (
            <Button
              variant="secondary"
              onClick={() => void resources.load('groups', true)}
            >
              More dependency groups
            </Button>
          )}
        </div>
      </Panel>
    );
  }
  if (state.mode !== 'create' && state.mode !== 'edit') return null;
  const input = (key: keyof typeof v, label: string, optional = false) => (
    <Field
      id={`routing-${key}`}
      label={label}
      optional={optional}
      error={errors[key]}
    >
      <Input
        id={`routing-${key}`}
        value={v[key]}
        required={!optional}
        maxLength={80}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `routing-${key}-error` : undefined}
        onChange={(e) => change(key, e.target.value)}
      />
    </Field>
  );
  return (
    <Panel aria-label="Resource form">
      <h2 className="font-display text-xl">
        {state.mode === 'edit' ? 'Edit' : 'Create'}{' '}
        {kind === 'groups' ? 'group' : 'reservation'}
      </h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.submit();
        }}
      >
        <fieldset className="min-w-0 space-y-4" disabled={blocked}>
          {input('name', 'Name')}
          {kind === 'groups' ? (
            <GroupFields model={m} resources={resources} input={input} />
          ) : (
            <>
              {input('purpose', 'Purpose')}
              <Field
                id="routing-pattern"
                label="Reservation pattern"
                error={errors.pattern}
              >
                <Select
                  id="routing-pattern"
                  value={v.patternKind}
                  aria-invalid={!!errors.pattern}
                  aria-describedby={
                    errors.pattern ? 'routing-pattern-error' : undefined
                  }
                  onChange={(e) => change('patternKind', e.target.value)}
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
              <p>
                Use 1–15 ASCII digits. Exact reservations match the full number,
                preserving leading zeros. Prefix reservations match only within
                the explicit total length bounds. Existing claims and other
                reservations cannot overlap. There is no enabled state.
              </p>
            </>
          )}
          {errors.body && <p role="alert">Review the entered fields.</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" pending={m.pending}>
              Save {kind === 'groups' ? 'group' : 'reservation'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                m.save({ ...state, mode: m.r ? 'detail' : 'list' })
              }
            >
              Cancel edit
            </Button>
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
