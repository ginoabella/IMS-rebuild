'use client';
// Included only by the explicit non-shipping browser verification composition.
import { useState } from 'react';
import { Button, Field, Textarea, Panel } from '@myims/ui-web';
import { useOperatorWork } from './console-access';
export function WorkFixture() {
  const { values, record, authorize } = useOperatorWork();
  const [submissions, setSubmissions] = useState(0);
  const [pending, setPending] = useState(false);
  return (
    <Panel>
      <h2>Unfinished-work verification form</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          try {
            if (await authorize()) setSubmissions((count) => count + 1);
          } finally {
            setPending(false);
          }
        }}
      >
        <Field id="fixture-notes" label="Unfinished notes">
          <Textarea
            id="fixture-notes"
            value={values.notes ?? ''}
            onChange={(event) => record({ notes: event.target.value })}
          />
        </Field>
        <Button type="submit" pending={pending}>
          Submit retained work
        </Button>
        <p role="status">Explicit submissions: {submissions}</p>
      </form>
    </Panel>
  );
}
