'use client';
import type {
  InventoryDependencies,
  EndpointProfileDto,
} from '@myims/contracts';
import { Button, Field, Input, Panel, Select, Textarea } from '@myims/ui-web';
import type { InventoryModel } from './use-inventory';
export function dependencies(
  model: InventoryModel,
): InventoryDependencies | null {
  const profile = model.profiles?.items.find(
    (p) => p.id === model.state.values.profileId,
  );
  if (!profile || !model.profiles?.capability) return null;
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    expectedProfileHead: profile.headVersion,
    expectedNodeVersion: model.profiles.nodeVersion,
    expectedCapabilityRevision: model.profiles.capability.revision,
  };
}
const control = 'min-h-11 w-full';
export function ProfileChoice({
  model,
  id = 'inventory-profile',
}: {
  model: InventoryModel;
  id?: string;
}) {
  return (
    <Field
      label="Selected profile version"
      id={id}
      error={model.errors.dependencies}
    >
      <Select
        id={id}
        value={model.state.values.profileId}
        onChange={(e) => model.change('profileId', e.target.value)}
        className={control}
      >
        <option value="">Choose an approved profile</option>
        {model.profiles?.items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.kind} · version {p.version}
          </option>
        ))}
      </Select>
    </Field>
  );
}
export function CreateInventory({ model }: { model: InventoryModel }) {
  const { state, change, run, preview } = model,
    v = state.values,
    d = dependencies(model);
  const selected = model.profiles?.items.find((p) => p.id === v.profileId);
  const body = () => (d && selected ? { ...d, kind: selected.kind } : null);
  const blocked = model.pending || !!state.attempt || state.needsReview;
  return (
    <Panel aria-label="Create inventory">
      <h2 className="font-display text-xl">Create inventory</h2>
      <p>
        New numbers are unallocated and desired disabled. Saving installs no
        usable endpoint or route.
      </p>
      <fieldset disabled={blocked} className="my-4 space-y-3 min-w-0">
        <ProfileChoice model={model} />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const b = body();
            if (b)
              void run(['extensions'], 'POST', {
                ...b,
                number: v.number,
                requestId: crypto.randomUUID(),
              });
          }}
        >
          <Field
            label="Individual number"
            id="inventory-number"
            aria-invalid={!!model.errors.number}
            aria-describedby={
              model.errors.number ? 'inventory-number-error' : undefined
            }
            error={model.errors.number}
          >
            <Input
              id="inventory-number"
              required
              maxLength={32}
              value={v.number}
              onChange={(e) => change('number', e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!d}>
            Create individual extension
          </Button>
        </form>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const b = body();
            if (b)
              void preview({
                ...b,
                ...(v.bulkMode === 'range'
                  ? { range: { start: v.rangeStart, end: v.rangeEnd } }
                  : { numbers: v.numbers.split(',') }),
              });
          }}
        >
          <Field label="Bulk input mode" id="bulk-mode">
            <Select
              id="bulk-mode"
              value={v.bulkMode}
              onChange={(e) => change('bulkMode', e.target.value)}
            >
              <option value="list">Comma-separated list</option>
              <option value="range">Inclusive range</option>
            </Select>
          </Field>
          {v.bulkMode === 'range' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Range start" id="range-start">
                <Input
                  id="range-start"
                  value={v.rangeStart}
                  maxLength={32}
                  onChange={(e) => change('rangeStart', e.target.value)}
                />
              </Field>
              <Field label="Range end" id="range-end">
                <Input
                  id="range-end"
                  value={v.rangeEnd}
                  maxLength={32}
                  onChange={(e) => change('rangeEnd', e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <Field
              error={model.errors.numbers}
              label="Bulk numbers (comma-separated, maximum 50)"
              id="bulk-numbers"
            >
              <Textarea
                id="bulk-numbers"
                value={v.numbers}
                maxLength={1650}
                onChange={(e) => change('numbers', e.target.value)}
              />
            </Field>
          )}
          <p>
            Numbers 1000–899999; no leading zeroes. Duplicate or colliding
            numbers reject the entire set.
          </p>
          <Button type="submit" disabled={!d}>
            Preview bulk creation
          </Button>
        </form>
      </fieldset>
      {state.preview && (
        <div className="space-y-3 break-words" role="status">
          <p>
            Review {state.preview.kind} · profile {state.preview.profileId}{' '}
            version {state.preview.profileVersion}
          </p>
          <p>Canonical numbers: {state.preview.numbers.join(', ')}</p>
          <Button
            disabled={blocked}
            onClick={() => {
              const {
                advisory: _advisory,
                nodeId: _node,
                ...payload
              } = state.preview!;
              void _advisory;
              void _node;
              void run(['extensions', 'bulk'], 'POST', {
                ...payload,
                requestId: crypto.randomUUID(),
              });
            }}
          >
            Commit reviewed bulk intent
          </Button>
        </div>
      )}
    </Panel>
  );
}
export function ProfileEditor({ model }: { model: InventoryModel }) {
  const { state, change, run } = model,
    v = state.values,
    p = state.profile;
  function choose(profile: EndpointProfileDto | null) {
    if (state.attempt || model.pending) return;
    model.record({
      ...state,
      profile,
      needsReview: false,
      values: {
        ...v,
        name: profile?.name ?? '',
        template: profile?.kind === 'webrtc' ? 'webrtc-basic' : 'sip-basic',
        codecs: profile?.settings.codecs.join(',') ?? 'ulaw,alaw',
        maxContacts: String(profile?.settings.maxContacts ?? 1),
      },
    });
  }
  return (
    <Panel aria-label="Endpoint profiles">
      <h2 className="font-display text-xl">Endpoint profiles</h2>
      <p>
        Versions are immutable. Existing selections stay pinned until explicit
        adoption.
      </p>
      <ul className="my-3 space-y-2">
        {model.profiles?.items.map((profile) => (
          <li key={profile.id} className="break-words">
            {profile.name} · {profile.kind} · head {profile.headVersion}{' '}
            <Button
              variant="secondary"
              disabled={!!state.attempt || model.pending}
              onClick={() => choose(profile)}
            >
              Review profile {profile.name}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={model.firstProfiles}>
          First profile page
        </Button>
        <Button
          variant="secondary"
          disabled={!model.profiles?.nextCursor}
          onClick={model.nextProfiles}
        >
          Next profile page
        </Button>
        <Button
          variant="secondary"
          disabled={!!state.attempt || model.pending}
          onClick={() => choose(null)}
        >
          New profile
        </Button>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!model.profiles?.capability) return;
          void run(
            p ? ['endpoint-profiles', p.id, 'versions'] : ['endpoint-profiles'],
            'POST',
            {
              requestId: crypto.randomUUID(),
              name: v.name,
              settings: {
                codecs: v.codecs.split(',').map((c) => c.trim()),
                maxContacts: Number(v.maxContacts),
              },
              expectedNodeVersion: model.profiles.nodeVersion,
              expectedCapabilityRevision: model.profiles.capability.revision,
              ...(p
                ? { expectedVersion: p.headVersion }
                : { template: v.template }),
            },
          );
        }}
      >
        <fieldset
          className="space-y-3 min-w-0"
          disabled={model.pending || !!state.attempt || state.needsReview}
        >
          <p>
            {p
              ? `Versioning ${p.name} from head ${p.headVersion}. Extensions retain their selected versions.`
              : 'Create a node-scoped approved profile.'}
          </p>
          <Field
            label="Profile name"
            id="profile-name"
            error={model.errors.name}
          >
            <Input
              id="profile-name"
              required
              maxLength={80}
              value={v.name}
              onChange={(e) => change('name', e.target.value)}
            />
          </Field>
          <Field label="Profile template" id="profile-template">
            <Select
              id="profile-template"
              disabled={!!p}
              value={v.template}
              onChange={(e) => {
                model.record({
                  ...state,
                  values: {
                    ...v,
                    template: e.target.value,
                    codecs:
                      e.target.value === 'webrtc-basic'
                        ? 'opus,ulaw,alaw'
                        : 'ulaw,alaw',
                    maxContacts: e.target.value === 'webrtc-basic' ? '5' : '1',
                  },
                  preview: null,
                });
              }}
            >
              <option value="sip-basic">SIP basic</option>
              <option value="webrtc-basic">WebRTC basic</option>
            </Select>
          </Field>
          <Field
            error={model.errors.settings}
            label="Ordered codecs (comma-separated)"
            id="profile-codecs"
          >
            <Input
              id="profile-codecs"
              required
              value={v.codecs}
              maxLength={30}
              onChange={(e) => change('codecs', e.target.value)}
            />
          </Field>
          <Field label="Maximum contacts" id="profile-contacts">
            <Input
              id="profile-contacts"
              type="number"
              min={1}
              max={5}
              required
              value={v.maxContacts}
              onChange={(e) => change('maxContacts', e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!model.profiles?.capability}>
            {p ? 'Save new profile version' : 'Create endpoint profile'}
          </Button>
        </fieldset>
      </form>
    </Panel>
  );
}
