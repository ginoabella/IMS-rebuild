'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Feedback, Field, Input, Panel } from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { createDraftTenant, TenantError } from './client';
import { draftErrors } from './validation';
import type { TenantApiErrorDto } from '@myims/contracts';
const fields = [
  {
    key: 'tenantCode',
    label: 'Tenant code',
    hint: 'Permanent identifier. Letters are saved in lowercase.',
    bound: 256,
  },
  {
    key: 'displayName',
    label: 'Organization name',
    hint: 'Up to 200 characters after trimming.',
    bound: 800,
  },
  {
    key: 'administratorUsername',
    label: 'Administrator username',
    hint: 'Tenant-qualified identifier. Letters are saved in lowercase.',
    bound: 512,
  },
] as const;
export function CreateTenant() {
  const work = useOperatorWork(),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const [errors, setErrors] = useState<
    NonNullable<TenantApiErrorDto['fieldErrors']>
  >({});
  const busy = useRef(false);
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!pending && focusTarget.current) {
      document.getElementById(focusTarget.current)?.focus();
      focusTarget.current = null;
    }
  }, [pending, errors]);
  function showErrors(next: NonNullable<TenantApiErrorDto['fieldErrors']>) {
    focusTarget.current = fields.find((f) => next[f.key])?.key ?? null;
    setErrors(next);
  }
  async function submit(retry: boolean) {
    if (busy.current || (!retry && work.draft.attempt)) return;
    if (!retry) {
      const next = draftErrors(work.draft.values);
      if (Object.keys(next).length) {
        showErrors(next);
        return;
      }
    }
    busy.current = true;
    setPending(true);
    setMessage('');
    setErrors({});
    const before = work.capture();
    try {
      if (!(await work.authorize())) return;
      // Authorization may have replaced the owner or invalidated this mounted callback.
      if (!before.current()) return;
      const captured = work.capture();
      const attempt = retry
        ? work.draft.attempt
        : { requestId: crypto.randomUUID(), ...work.draft.values };
      if (!attempt) return;
      // Recoverable from the moment transport begins, including late/lost responses.
      work.recordDraft({ ...work.draft, attempt });
      try {
        const saved = await createDraftTenant(attempt, captured.proof);
        if (!captured.current()) return;
        work.recordDraft({
          values: {
            tenantCode: '',
            displayName: '',
            administratorUsername: '',
          },
          attempt: null,
        });
        await work.authorize();
        if (captured.current()) router.push(`/tenants/${saved.tenant.id}`);
      } catch (error) {
        if (!captured.current()) return;
        if (error instanceof TenantError) {
          work.recordDraft({ ...work.draft, attempt: null });
          showErrors(error.fields ?? {});
          setMessage(
            error.status === 409
              ? error.reason === 'tenant_code_conflict'
                ? 'This tenant code is already in use. Choose another code.'
                : 'This submission conflicts with an earlier request. Review the saved tenants before continuing.'
              : 'Review the fields and try again.',
          );
        } else {
          setMessage(
            'Creation is not confirmed. Retry the original submission explicitly to resolve its outcome.',
          );
          work.rejectAccess(
            error instanceof AccessError ? error : new AccessError(503),
          );
        }
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/tenants" className="text-primary underline">
        Back to tenants
      </Link>
      <h1 className="font-display text-3xl font-semibold">Create tenant</h1>
      <p className="text-muted-foreground">
        The tenant code is permanent. This creates a draft organization with its
        first administrator. Credential setup and activation follow later;
        ordinary staff sign-in remains unavailable.
      </p>
      <Panel aria-label="Draft tenant form">
        <form
          noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          {fields.map((f) => (
            <Field
              key={f.key}
              id={f.key}
              label={f.label}
              hint={f.hint}
              error={errors[f.key]}
            >
              <Input
                id={f.key}
                name={f.key}
                autoComplete="off"
                required
                maxLength={f.bound}
                value={work.draft.values[f.key]}
                disabled={pending}
                aria-invalid={!!errors[f.key]}
                aria-describedby={`${f.key}-hint${errors[f.key] ? ` ${f.key}-error` : ''}`}
                onChange={(e) => {
                  work.recordDraft({
                    ...work.draft,
                    values: { ...work.draft.values, [f.key]: e.target.value },
                  });
                  setErrors((current) => ({ ...current, [f.key]: undefined }));
                }}
              />
            </Field>
          ))}
          {message && <Feedback tone="error" title={message} />}
          {work.draft.attempt && (
            <Feedback
              tone="warning"
              title="Original submission needs confirmation"
            >
              <p>
                Resolve the original submission before creating with edited
                values. A confirmed save opens its saved organization.
              </p>
              <dl className="my-3 break-words">
                <dt>Submitted tenant code</dt>
                <dd>{work.draft.attempt.tenantCode}</dd>
                <dt>Submitted organization</dt>
                <dd>{work.draft.attempt.displayName}</dd>
                <dt>Submitted administrator</dt>
                <dd>{work.draft.attempt.administratorUsername}</dd>
              </dl>
              <Button onClick={() => void submit(true)} pending={pending}>
                Retry original submission
              </Button>
            </Feedback>
          )}
          <Button
            type="submit"
            pending={pending}
            disabled={!!work.draft.attempt}
          >
            {pending ? 'Creating draft…' : 'Create draft tenant'}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
