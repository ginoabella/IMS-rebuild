'use client';

import { useId, useState, useRef } from 'react';
import { MoreHorizontal, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  ContentState,
  Divider,
  Feedback,
  Field,
  Input,
  Panel,
  PanelHeading,
  Select,
  Table,
  Textarea,
} from './primitives.js';
import { Overlay, OverflowMenu, Tabs } from './overlays.js';

export function UiPreview() {
  const prefix = useId();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(true);
  const [message, setMessage] = useState('');
  const processing = useRef(false);
  const nameId = `${prefix}-name`;

  async function submit() {
    if (processing.current) return;
    setSaved(false);
    if (name.trim().length < 3) {
      setError('Enter at least three characters. Your values have been kept.');
      return;
    }
    setError('');
    processing.current = true;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setPending(false);
    processing.current = false;
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <Feedback title="Foundation demonstration">
        All examples use local sample data. Nothing is stored or sent to an
        operational service.
      </Feedback>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel aria-labelledby={`${prefix}-form-heading`}>
          <PanelHeading id={`${prefix}-form-heading`}>
            Form controls
          </PanelHeading>
          <p className="mt-1 text-muted-foreground">
            Try a short name to see validation without losing your work.
          </p>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field
              id={nameId}
              label="Sample name"
              hint="Use at least three characters."
              error={error}
            >
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                aria-invalid={!!error}
                aria-describedby={`${nameId}-hint${error ? ` ${nameId}-error` : ''}`}
              />
            </Field>
            <Field id={`${prefix}-type`} label="Sample type">
              <Select id={`${prefix}-type`} defaultValue="review" required>
                <option value="review">For review</option>
                <option value="reference">Reference</option>
              </Select>
            </Field>
            <Field id={`${prefix}-notes`} label="Sample notes" optional>
              <Textarea
                id={`${prefix}-notes`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <Checkbox />
              Include in this local demonstration
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" pending={pending}>
                {pending ? 'Processing sample…' : 'Submit sample'}
              </Button>
              <Button variant="secondary" disabled>
                Unavailable
              </Button>
            </div>
            {saved && (
              <Feedback tone="success" title="Sample complete">
                The sample action completed locally.
              </Feedback>
            )}
          </form>
        </Panel>
        <Panel aria-labelledby={`${prefix}-interactions-heading`}>
          <PanelHeading id={`${prefix}-interactions-heading`}>
            Interactions
          </PanelHeading>
          <p className="mt-1 text-muted-foreground">
            Keyboard focus stays inside overlays and returns when they close.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Overlay
              title="Confirm sample action"
              description="This is a local confirmation example. It changes no operational data."
              trigger={<Button variant="destructive">Open confirmation</Button>}
            >
              <p className="text-muted-foreground">
                Use Escape or Close to dismiss this example.
              </p>
            </Overlay>
            <Overlay
              kind="sheet"
              title="Sample details"
              description="Secondary content in a scrollable side panel."
              trigger={<Button variant="secondary">Open details</Button>}
            >
              <p className="text-muted-foreground">
                The main workspace remains behind this panel.
              </p>
            </Overlay>
          </div>
          <Divider />
          <Tabs
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: (
                  <p>Shared components keep both applications consistent.</p>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                content: (
                  <p>
                    Arrow keys switch tabs. These examples have no backend
                    connection.
                  </p>
                ),
              },
            ]}
          />
        </Panel>
      </div>
      <Panel aria-labelledby={`${prefix}-table-heading`}>
        <PanelHeading id={`${prefix}-table-heading`}>Sample table</PanelHeading>
        <div
          className="mt-4 overflow-x-auto rounded-md"
          role="region"
          aria-label="Scrollable sample table"
          tabIndex={0}
        >
          <Table>
            <caption className="pb-3 text-left text-muted-foreground">
              Illustrative records only
            </caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">State</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono">SAMPLE-001</td>
                <td>
                  <Badge tone="warning">Pending review</Badge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setMessage('Sample record viewed locally.')
                      }
                    >
                      View sample
                    </Button>
                    <OverflowMenu
                      trigger={
                        <Button
                          variant="ghost"
                          aria-label="More actions for SAMPLE-001"
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      }
                      items={[
                        {
                          label: 'Copy sample reference',
                          onSelect: () =>
                            setMessage(
                              'Sample reference selected: SAMPLE-001.',
                            ),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
        {message && (
          <p role="status" className="mt-3 text-info">
            {message}
          </p>
        )}
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <ContentState kind="loading" title="Loading example">
          A visible loading state, not a live request.
        </ContentState>
        {failed ? (
          <ContentState
            kind="error"
            title="Sample request failed"
            action={
              <Button variant="secondary" onClick={() => setFailed(false)}>
                <RefreshCw aria-hidden="true" />
                Retry sample
              </Button>
            }
          >
            Try again to switch this local example to success.
          </ContentState>
        ) : (
          <Feedback tone="success" title="Sample retry complete">
            The example recovered.
          </Feedback>
        )}
        <ContentState kind="empty" title="No sample records yet">
          Records will appear here when a feature provides them.
        </ContentState>
        <ContentState kind="no-results" title="No matching samples">
          Change your filters in a future feature to see other results.
        </ContentState>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Feedback title="Information">
          Use labels alongside status colors.
        </Feedback>
        <Feedback tone="success" title="Success">
          The sample action completed.
        </Feedback>
        <Feedback tone="warning" title="Warning">
          This example needs attention.
        </Feedback>
        <Feedback tone="error" title="Error">
          The sample action failed.
        </Feedback>
      </div>
    </div>
  );
}
