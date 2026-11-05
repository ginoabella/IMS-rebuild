'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Field, Panel, PanelHeading } from '@myims/ui-web';
import type {
  ArtifactRetirementView,
  ExtensionListDto,
  PbxLiveStatus,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
import { inventoryRequest } from '../inventory/client';
import { liveOutput } from '../revisions/live-validation';
import { useTelephonyOperation } from './use-operation';
export function RetirementPanel({ nodeId }: { nodeId: string }) {
  const work = useOperatorWork();
  return (
    <OwnedRetirement key={`${work.operatorId}:${nodeId}`} nodeId={nodeId} />
  );
}
function OwnedRetirement({ nodeId }: { nodeId: string }) {
  const { work, view, pending, retained, message, notice, load, submit } =
    useTelephonyOperation<ArtifactRetirementView>(nodeId, null);
  const [runtime, setRuntime] = useState<PbxLiveStatus>(),
    [stock, setStock] = useState<ExtensionListDto>(),
    [artifactId, setArtifactId] = useState(''),
    [resourceId, setResourceId] = useState(''),
    [reviewed, setReviewed] = useState(false);
  const mounted = useRef(true),
    epoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
    };
  }, []);
  async function sources(after: string | null = null) {
    const capture = work.capture(),
      version = ++epoch.current;
    try {
      const [response, extensions] = await Promise.all([
        fetch(`/platform/pbx-nodes/${nodeId}/revisions/live`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(7000),
        }),
        inventoryRequest<ExtensionListDto>(
          nodeId,
          ['extensions'],
          'GET',
          undefined,
          undefined,
          after,
        ),
      ]);
      const v: unknown = await response.json();
      if (!response.ok || !liveOutput([], 'GET', v)) throw new AccessError(503);
      if (mounted.current && version === epoch.current && capture.current()) {
        setRuntime(v as PbxLiveStatus);
        setStock(extensions);
        setReviewed(false);
      }
    } catch (e) {
      if (mounted.current && version === epoch.current && capture.current()) {
        setRuntime(undefined);
        work.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    if (work.ready) void sources();
  }, [work.ready]);
  const disabled = !work.ready || pending || !!retained;
  return (
    <Panel
      aria-labelledby="retirement-heading"
      className="min-w-0 [overflow-wrap:anywhere]"
    >
      <PanelHeading id="retirement-heading">
        Superseded artifact retirement
      </PanelHeading>
      <p ref={notice} role="status" tabIndex={-1}>
        {message}
      </p>
      <p>
        Retire an exact superseded artifact only after a reviewed replacement
        omits the selected extension. Required recovery targets, active calls
        and unknown safety block retirement. Artifact bytes and ownership
        history remain retained.
      </p>
      <div className="flex flex-wrap items-end gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
        <Field id="retire-artifact" label="Superseded artifact">
          <select
            id="retire-artifact"
            className="min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3"
            value={artifactId}
            disabled={disabled}
            onChange={(e) => {
              setArtifactId(e.target.value);
              setReviewed(false);
            }}
          >
            <option value="">Choose superseded artifact</option>
            {runtime?.artifacts
              .filter(
                (a) =>
                  !a.initialBaseline &&
                  a.id !== runtime.verifiedId &&
                  a.id !== runtime.knownGoodId &&
                  a.id !== runtime.installedId,
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.verifiedAt} · {a.id}
                </option>
              ))}
          </select>
        </Field>
        <Field id="retire-extension" label="Extension removed from runtime">
          <select
            id="retire-extension"
            className="min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3"
            value={resourceId}
            disabled={disabled}
            onChange={(e) => {
              setResourceId(e.target.value);
              setReviewed(false);
            }}
          >
            <option value="">Choose extension</option>
            {stock?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.number} · {e.administrativeStatus}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          disabled={disabled || !stock?.nextCursor}
          onClick={() => void sources(stock?.nextCursor ?? null)}
        >
          More extensions
        </Button>
      </div>
      <label className="my-3 flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={disabled}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I reviewed the replacement artifact {runtime?.verifiedId ?? '—'} and its
        required recovery targets.
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={
            disabled ||
            !reviewed ||
            !artifactId ||
            !resourceId ||
            !runtime?.verifiedId
          }
          onClick={() =>
            void submit('', {
              artifactId,
              replacementId: runtime?.verifiedId,
              resourceId,
            })
          }
        >
          Request exact artifact retirement
        </Button>
        <Button
          variant="secondary"
          disabled={!work.ready || pending}
          onClick={() => {
            void load();
            void sources();
          }}
        >
          Reload retirement and runtime
        </Button>
        {retained && (
          <Button
            disabled={!work.ready || pending}
            onClick={() => void submit()}
          >
            Recover exact retirement intent
          </Button>
        )}
      </div>
      {!!view?.items.length && (
        <ul className="mt-3 space-y-2 [overflow-wrap:anywhere]">
          {view.items.map((i) => (
            <li key={i.id}>
              <strong>{i.state}</strong> · artifact {i.artifactId}
              <p>
                Replacement {i.replacementId} · extension {i.resourceId}
              </p>
              {i.state === 'unknown' && (
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void submit('', {
                      artifactId: i.artifactId,
                      replacementId: i.replacementId,
                      resourceId: i.resourceId,
                      reconcileId: i.id,
                    })
                  }
                >
                  Reconcile this retirement after review
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
