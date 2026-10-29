'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  SaveTenantSectionDto,
  TenantDetailDto,
  TenantSection,
} from '@myims/contracts';
import {
  Button,
  Feedback,
  Field,
  Input,
  Panel,
  PanelHeading,
} from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { saveTenantSection, TenantError } from './client';

type RegistrySection = Exclude<TenantSection, 'geography'>;
type Values = {
  displayName: string;
  name: string;
  email: string;
  phone: string;
  voicePreference: string;
};
type SectionWork = {
  version: number;
  authorityVersion: number;
  values: Values;
  attempt: SaveTenantSectionDto | null;
  message: string;
  state: 'saved' | 'unsaved' | 'pending' | 'conflict' | 'failed' | 'uncertain';
  errors: Partial<Record<keyof Values, string>>;
};
function initial(detail: TenantDetailDto): SectionWork {
  return {
    version: detail.tenant.version,
    authorityVersion: detail.tenant.authorityVersion,
    values: {
      displayName: detail.tenant.displayName,
      name: detail.tenant.contacts.name ?? '',
      email: detail.tenant.contacts.email ?? '',
      phone: detail.tenant.contacts.phone ?? '',
      voicePreference: detail.tenant.voicePreference,
    },
    attempt: null,
    message: '',
    state: 'saved',
    errors: {},
  };
}
export function TenantEditor({
  id,
  detail,
  reload,
}: {
  id: string;
  detail?: TenantDetailDto;
  reload: () => void;
}) {
  const work = useOperatorWork();
  const canonicalDetail = useRef(detail);
  if (
    detail &&
    (!canonicalDetail.current ||
      detail.tenant.version >= canonicalDetail.current.tenant.version)
  )
    canonicalDetail.current = detail;
  const [sections, setSections] = useState<Record<
    RegistrySection,
    SectionWork
  > | null>(null);
  // Only initialization and patches advance work; a render can carry an older snapshot.
  const latest = useRef(sections);
  const live = useRef(true),
    busy = useRef(false),
    focus = useRef<string | null>(null);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!detail) return;
    const current = latest.current;
    const canonical = initial(detail);
    const next = current
      ? { ...current }
      : { name: canonical, contacts: canonical, voice: canonical };
    if (current)
      for (const section of ['name', 'contacts', 'voice'] as const) {
        if (
          current[section].state === 'saved' &&
          !current[section].attempt &&
          current[section].version <= detail.tenant.version
        )
          next[section] = { ...canonical, message: current[section].message };
      }
    latest.current = next;
    setSections(next);
  }, [detail]);
  useEffect(() => {
    if (work.ready && focus.current) {
      const target = document.getElementById(focus.current);
      if (target && !target.matches(':disabled')) {
        target.focus();
        if (document.activeElement === target) focus.current = null;
      }
    }
  }, [sections, work.ready, detail]);
  function patch(section: RegistrySection, update: Partial<SectionWork>) {
    const current = latest.current;
    if (!current || !live.current) return;
    const next = { ...current, [section]: { ...current[section], ...update } };
    latest.current = next;
    setSections(next);
  }
  async function save(section: RegistrySection, retry = false) {
    const s = latest.current?.[section];
    if (!s || busy.current || !work.ready || (!retry && s.attempt)) return;
    busy.current = true;
    const before = work.capture();
    patch(section, { state: 'pending', message: '', errors: {} });
    try {
      if (!(await work.authorize()) || !before.current() || !live.current) {
        patch(section, { state: s.attempt ? 'uncertain' : 'unsaved' });
        return;
      }
      const capture = work.capture();
      const attempt: SaveTenantSectionDto | null = retry
        ? s.attempt
        : {
            requestId: crypto.randomUUID(),
            expectedVersion: s.version,
            expectedAuthorityVersion: s.authorityVersion,
            ...(section === 'name'
              ? {
                  section: 'name',
                  values: { displayName: s.values.displayName },
                }
              : section === 'voice'
                ? {
                    section: 'voice',
                    values: {
                      voicePreference: s.values.voicePreference as
                        'enabled' | 'disabled',
                    },
                  }
                : {
                    section: 'contacts',
                    values: {
                      name: s.values.name,
                      email: s.values.email,
                      phone: s.values.phone,
                    },
                  }),
          };
      if (!attempt) return;
      patch(section, { attempt });
      try {
        const result = await saveTenantSection(id, attempt, capture.proof);
        if (!capture.current() || !live.current) return;
        // Original receipt is a historical outcome. Only the fresh current DTO populates fields.
        const current =
          canonicalDetail.current &&
          canonicalDetail.current.tenant.version > result.current.tenant.version
            ? canonicalDetail.current
            : result.current;
        canonicalDetail.current = current;
        const canonical = initial(current);
        patch(section, {
          ...canonical,
          message: result.replayed
            ? `Original save confirmed at version ${result.outcome.version}. Current version ${current.tenant.version} loaded.`
            : `Saved at version ${result.outcome.version}.`,
        });
        // A clean neighboring section can follow the new row version; unsaved work retains its original version.
        for (const other of ['name', 'contacts', 'voice'] as const)
          if (
            other !== section &&
            latest.current?.[other].state === 'saved' &&
            !latest.current[other].attempt
          )
            patch(other, canonical);
        reload();
      } catch (error) {
        if (!capture.current() || !live.current) return;
        if (error instanceof TenantError) {
          const fields = error.fields ?? {};
          patch(section, {
            attempt: null,
            state: error.status === 409 ? 'conflict' : 'failed',
            errors: fields,
            message:
              error.status === 409
                ? 'Conflict: your input is retained. Reload current detail, then explicitly discard this section or review before another save.'
                : error.status === 404
                  ? 'Tenant no longer available.'
                  : 'Save failed. Review the fields; input is retained.',
          });
          focus.current = Object.keys(fields).length
            ? `edit-${section}-${Object.keys(fields)[0]}`
            : `edit-${section}-feedback`;
        } else {
          patch(section, {
            state: 'uncertain',
            message:
              'Save outcome uncertain. Explicitly retry the original save to reconcile it before submitting replacement input.',
          });
          work.rejectAccess(
            error instanceof AccessError ? error : new AccessError(503),
          );
        }
      }
    } finally {
      busy.current = false;
      if (live.current && latest.current?.[section].state === 'pending')
        patch(section, {
          state: 'uncertain',
          message:
            'Save outcome uncertain. Retry the original save explicitly.',
        });
    }
  }
  if (!sections) return null;
  return (
    <div className="space-y-5">
      {(['name', 'contacts', 'voice'] as const).map((section) => {
        const s = sections[section],
          pending = s.state === 'pending';
        const fields =
          section === 'name'
            ? ([
                { key: 'displayName', label: 'Organization name', bound: 800 },
              ] as const)
            : section === 'voice'
              ? []
              : ([
                  { key: 'name', label: 'Contact name', bound: 800 },
                  {
                    key: 'email',
                    label: 'Contact email',
                    bound: 1016,
                  },
                  { key: 'phone', label: 'Contact phone', bound: 200 },
                ] as const);
        return (
          <Panel key={section} aria-labelledby={`edit-${section}-heading`}>
            <PanelHeading id={`edit-${section}-heading`}>
              {section === 'name'
                ? 'Organization name'
                : section === 'voice'
                  ? 'Voice preference'
                  : 'Organizational contact'}
            </PanelHeading>
            {section === 'contacts' && (
              <p className="my-3 text-muted-foreground">
                Informational only. Blank fields clear saved values. Contact{' '}
                {s.values.name && s.values.email && s.values.phone
                  ? 'complete'
                  : 'incomplete'}
                .
              </p>
            )}
            {detail?.tenant.status !== 'draft' && (
              <p>Configuration is read-only outside draft.</p>
            )}
            <form
              className="mt-4 space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save(section);
              }}
            >
              {section === 'voice' && (
                <Field
                  id="edit-voice-voicePreference"
                  label="Voice preference"
                  error={s.errors.voicePreference}
                >
                  <select
                    id="edit-voice-voicePreference"
                    className="min-h-11 w-full rounded-md border border-subtle bg-muted px-3"
                    value={s.values.voicePreference}
                    disabled={
                      pending ||
                      !!s.attempt ||
                      detail?.tenant.status !== 'draft'
                    }
                    aria-invalid={!!s.errors.voicePreference}
                    aria-describedby={
                      s.errors.voicePreference
                        ? 'edit-voice-voicePreference-error'
                        : undefined
                    }
                    onChange={(e) =>
                      patch(section, {
                        values: {
                          ...(latest.current?.[section].values ?? s.values),
                          voicePreference: e.target.value,
                        },
                        state: 'unsaved',
                        errors: {},
                        message: '',
                      })
                    }
                  >
                    <option value="not_configured" disabled>
                      Not configured — choose explicitly
                    </option>
                    <option value="enabled">Voice enabled</option>
                    <option value="disabled">Voice disabled</option>
                  </select>
                  <p>
                    Preference only. Allocation, live routing and activation
                    require separate verified steps.
                  </p>
                </Field>
              )}
              {fields.map((f) => (
                <Field
                  key={f.key}
                  id={`edit-${section}-${f.key}`}
                  label={f.label}
                  optional={section === 'contacts'}
                  error={s.errors[f.key]}
                >
                  <Input
                    id={`edit-${section}-${f.key}`}
                    autoComplete="off"
                    maxLength={f.bound}
                    value={s.values[f.key]}
                    required={section === 'name'}
                    disabled={
                      pending ||
                      !!s.attempt ||
                      detail?.tenant.status !== 'draft'
                    }
                    aria-invalid={!!s.errors[f.key]}
                    aria-describedby={
                      s.errors[f.key]
                        ? `edit-${section}-${f.key}-error`
                        : undefined
                    }
                    onChange={(e) =>
                      patch(section, {
                        values: {
                          ...(latest.current?.[section].values ?? s.values),
                          [f.key]: e.target.value,
                        },
                        state: 'unsaved',
                        errors: { ...s.errors, [f.key]: undefined },
                        message: '',
                      })
                    }
                  />
                </Field>
              ))}
              <p role="status">
                {pending
                  ? 'Saving…'
                  : s.attempt
                    ? 'Uncertain: original save needs confirmation'
                    : s.state === 'saved'
                      ? 'Saved'
                      : s.state === 'unsaved'
                        ? 'Unsaved changes'
                        : s.state === 'conflict'
                          ? 'Conflict'
                          : 'Save failed'}
              </p>
              {s.message && (
                <div id={`edit-${section}-feedback`} tabIndex={-1}>
                  <Feedback
                    tone={s.state === 'saved' ? 'success' : 'warning'}
                    title={s.message}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  pending={pending}
                  disabled={
                    !!s.attempt ||
                    detail?.tenant.status !== 'draft' ||
                    s.state === 'saved'
                  }
                >
                  Save {section}
                </Button>
                {s.attempt && (
                  <Button
                    disabled={pending}
                    onClick={() => void save(section, true)}
                  >
                    Retry original {section} save
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={pending || !!s.attempt || !detail}
                  onClick={() => {
                    if (detail) patch(section, initial(detail));
                  }}
                >
                  Discard {section} changes and use loaded detail
                </Button>
              </div>
            </form>
          </Panel>
        );
      })}
    </div>
  );
}
