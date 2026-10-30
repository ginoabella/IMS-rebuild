'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel, PanelHeading, Field } from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { listPbx } from '../pbx/client';
import { NodeAllocation } from './node';
const selectClass =
  'min-h-11 max-w-full rounded-md border border-subtle bg-muted px-3';
export function TenantAllocations({ tenantId }: { tenantId: string }) {
  const work = useOperatorWork();
  return (
    <OwnedAllocation
      key={`${work.operatorId}:${tenantId}`}
      tenantId={tenantId}
    />
  );
}
function OwnedAllocation({ tenantId }: { tenantId: string }) {
  const work = useOperatorWork(),
    [nodes, setNodes] = useState<{ id: string; displayName: string }[]>([]),
    [after, setAfter] = useState<string | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [nodeId, setNodeId] = useState(''),
    [message, setMessage] = useState(''),
    [loading, setLoading] = useState(true);
  const live = useRef(true),
    revision = useRef(0);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function loadNodes(next: string | null = null) {
    const epoch = ++revision.current,
      capture = work.capture();
    setLoading(true);
    try {
      const r = await listPbx(next);
      if (!live.current || epoch !== revision.current || !capture.current())
        return;
      setNodes(r.items);
      setCursor(r.nextCursor);
      setAfter(next);
      setLoading(false);
      setMessage('');
    } catch (e) {
      if (live.current && capture.current()) {
        setLoading(false);
        setMessage('PBX nodes could not be loaded.');
        work.rejectAccess(e);
      }
    }
  }
  useEffect(() => {
    if (work.ready)
      void loadNodes(
        after,
      ); /* Same-owner restoration reloads saved facts only. */
  }, [work.ready]);
  return (
    <Panel
      aria-label="Tenant extension allocation"
      className="max-w-full [overflow-wrap:anywhere] [&_button]:max-w-full"
    >
      <PanelHeading>Extension allocation</PanelHeading>
      <p className="text-muted-foreground">
        Reserve or allocate existing stock. Saved ownership, desired enablement
        and calling verification are separate.
      </p>
      <div className="flex flex-wrap items-end gap-3 [&>div]:min-w-0 [&>div]:max-w-full">
        <Field id="allocation-node" label="PBX node">
          <select
            id="allocation-node"
            className={selectClass}
            value={nodeId}
            disabled={!work.ready || loading}
            onChange={(e) => setNodeId(e.target.value)}
          >
            <option value="">Choose PBX node</option>
            {nodeId && !nodes.some((n) => n.id === nodeId) && (
              <option value={nodeId}>{nodeId}</option>
            )}
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          disabled={!after || !work.ready}
          onClick={() => void loadNodes()}
        >
          First nodes
        </Button>
        <Button
          variant="secondary"
          disabled={!cursor || !work.ready}
          onClick={() => void loadNodes(cursor)}
        >
          More nodes
        </Button>
      </div>
      {message ? (
        <p role="status">{message}</p>
      ) : loading ? (
        <p role="status">Loading PBX nodes…</p>
      ) : nodes.length === 0 ? (
        <p>
          No PBX nodes on this page. Configure a PBX node and its inventory
          before allocating.
        </p>
      ) : null}
      {nodeId && (
        <NodeAllocation key={nodeId} tenantId={tenantId} nodeId={nodeId} />
      )}
    </Panel>
  );
}
