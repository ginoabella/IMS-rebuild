'use client';
import { useRef, useState } from 'react';
import { Button, Field, Textarea, Panel, Overlay } from '@myims/ui-web';
import { useStaffWork } from './console-access';
import { AccessError } from './client';
export function WorkFixture() {
  const { values, record, authorize, capture, rejectAccess } = useStaffWork();
  const busy = useRef(false);
  const [submissions, setSubmissions] = useState(0),
    [pending, setPending] = useState(false),
    [open, setOpen] = useState(false);
  return (
    <Panel>
      <h2>Unfinished incident fixture</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          let attempt = capture();
          try {
            if (!(await authorize())) return;
            attempt = capture();
            if (!attempt.current()) return;
            const r = await fetch('/staff/auth/work-fixture', {
              method: 'POST',
              cache: 'no-store',
              credentials: 'same-origin',
              signal: AbortSignal.timeout(7000),
              headers: {
                'Content-Type': 'application/json',
                'X-Staff-CSRF': attempt.proof,
              },
              body: '{}',
            });
            if (!attempt.current()) return;
            if (!r.ok)
              throw new AccessError(
                r.status === 401 ? 401 : r.status === 403 ? 403 : 503,
              );
            setSubmissions((n) => n + 1);
          } catch (error) {
            if (attempt.current()) rejectAccess(error);
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <Field id="fixture-notes" label="Unfinished notes">
          <Textarea
            id="fixture-notes"
            value={values.notes ?? ''}
            onChange={(e) => record({ notes: e.target.value })}
          />
        </Field>
        <Button type="submit" pending={pending}>
          Submit retained work
        </Button>
        <p role="status">Explicit submissions: {submissions}</p>
      </form>
      <Overlay
        trigger={<Button>Open protected dialog</Button>}
        open={open}
        onOpenChange={setOpen}
        title="Protected unfinished work"
        description="Mounted nonsecret incident notes"
      >
        <p>{values.notes}</p>
      </Overlay>
    </Panel>
  );
}
