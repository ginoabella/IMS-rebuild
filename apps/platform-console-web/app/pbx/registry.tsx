'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PbxNodeDto, PbxNodeListDto } from '@myims/contracts';
import { Badge, Button, ContentState, Panel } from '@myims/ui-web';
import { useOperatorWork } from '../auth/console-access';
import { getPbx, listPbx, PbxError } from './client';
import { PbxForm } from './form';
const linkClass =
  'inline-flex max-w-full min-h-11 items-center break-all rounded-md border border-subtle px-4 text-primary hover:bg-muted';
function usePbxRead<T>(load: () => Promise<T>, resource: string) {
  const work = useOperatorWork(),
    latest = useRef(work);
  latest.current = work;
  const readEpoch = useRef(0);
  const loadedResource = useRef({ owner: work.operatorId, resource });
  const [state, setState] = useState<{
      data?: T;
      error?: string;
      received?: number;
    }>({}),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!work.ready) return;
    const epoch = ++readEpoch.current;
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    const active = latest.current;
    if (
      loadedResource.current.owner !== work.operatorId ||
      loadedResource.current.resource !== resource
    ) {
      loadedResource.current = { owner: work.operatorId, resource };
      setState({});
    }
    async function read() {
      if (!active.ready || !live) return;
      const captured = active.capture();
      if (!captured.current()) return;
      try {
        const data = await load();
        if (live && readEpoch.current === epoch && captured.current())
          setState({ data, received: Date.now() });
      } catch (e) {
        if (!live || readEpoch.current !== epoch || !captured.current()) return;
        setState({
          error:
            e instanceof PbxError
              ? e.status === 404
                ? 'PBX node not found.'
                : 'Invalid PBX request.'
              : 'The protected PBX API is unavailable. Restore access and retry.',
        });
        if (!(e instanceof PbxError)) {
          active.rejectAccess(e);
          return;
        }
      }
      if (live && readEpoch.current === epoch && captured.current())
        timer = setTimeout(() => void read(), 5000);
    }
    void read();
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Resource and owner epochs fence navigation and late responses.
  }, [work.ready, work.operatorId, resource, revision]);
  return {
    ...(loadedResource.current.owner === work.operatorId &&
    loadedResource.current.resource === resource
      ? state
      : {}),
    retry: () => {
      readEpoch.current++;
      setRevision((n) => n + 1);
    },
    replace: (data: T) => {
      readEpoch.current++;
      setState({ data, received: Date.now() });
      setRevision((n) => n + 1);
    },
  };
}
function Observation({
  node,
  received,
}: {
  node: PbxNodeDto;
  received: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const o = node.observation;
  if (o.kind === 'not_available')
    return (
      <p>
        Saved · Not yet observed. Registration coverage and counts are unknown.
      </p>
    );
  const age = o.ageMs === null ? null : o.ageMs + Math.max(0, now - received);
  const freshness = age !== null && age >= 30000 ? 'stale' : o.freshness;
  const current = freshness === 'current' && o.desiredVersion === node.version;
  return (
    <div className="space-y-3 break-words">
      <div className="flex flex-wrap gap-2">
        <Badge>Saved</Badge>
        <Badge tone={o.reconciliation === 'complete' ? 'info' : 'warning'}>
          {o.reconciliation}
        </Badge>
        <Badge
          tone={
            current
              ? 'success'
              : o.connection === 'disconnected'
                ? 'error'
                : 'warning'
          }
        >
          {current ? o.connection : `Last connection: ${o.connection}`}
        </Badge>
        <Badge tone={current ? 'success' : 'warning'}>{freshness}</Badge>
      </div>
      <dl className="space-y-1">
        <dt>Observed desired version</dt>
        <dd>
          {o.desiredVersion} (saved: {node.version})
        </dd>
        <dt>Observer ownership</dt>
        <dd>{o.ownership}</dd>
        <dt>Last successful observation (Asia/Manila)</dt>
        <dd>
          {o.lastSuccessAt
            ? new Intl.DateTimeFormat('en-PH', {
                timeZone: 'Asia/Manila',
                dateStyle: 'medium',
                timeStyle: 'medium',
              }).format(new Date(o.lastSuccessAt))
            : 'No successful observation'}
        </dd>
        <dt>Last-success age</dt>
        <dd>
          {age === null ? 'Unknown' : `${Math.floor(age / 1000)} seconds`}
        </dd>
        <dt>Registration coverage</dt>
        <dd>{o.coverage}</dd>
        <dt>
          {current
            ? 'Observed registered endpoints'
            : 'Last-known registered endpoints'}
        </dt>
        <dd>
          {o.registeredEndpoints === null
            ? 'Unknown / unavailable'
            : o.registeredEndpoints === 0
              ? '0 — successful empty registration result'
              : o.registeredEndpoints}
        </dd>
      </dl>
      {o.failure && (
        <p role="status">
          Observation failure: {o.failure.replaceAll('_', ' ')}. Escalate
          secret/configuration failures to the deployment owner; PBX/observer
          failures to telephony operations.
        </p>
      )}
      {!current && (
        <p>
          These facts are historical, stale or unknown. They do not establish
          current health.
        </p>
      )}
      <p className="text-muted-foreground">
        Dynamic PJSIP contact observation only. Registration does not mean
        allocated, assigned, verified extension or voice-ready tenant.
      </p>
      {o.registrations.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer">
            Observed endpoint facts ({o.registrations.length})
          </summary>
          <ul className="space-y-2">
            {o.registrations.map((f) => (
              <li key={f.endpoint} className="break-all">
                {f.endpoint}: {f.registered ? 'registered' : 'unregistered'};
                dynamic contacts {f.contacts}; reachable contacts{' '}
                {f.reachableContacts}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
export function PbxRegistry() {
  const work = useOperatorWork(),
    [cursors, setCursors] = useState<(string | null)[]>([null]);
  const after = cursors.at(-1) ?? null,
    state = usePbxRead<PbxNodeListDto>(() => listPbx(after), after ?? 'first');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">PBX nodes</h1>
        <Link href="/pbx-nodes/register" className={linkClass}>
          Register PBX
        </Link>
      </div>
      {state.error ? (
        <ContentState
          kind="error"
          title={state.error}
          action={<Button onClick={state.retry}>Retry PBX list</Button>}
        />
      ) : !state.data ? (
        <ContentState kind="loading" title="Loading PBX nodes…" />
      ) : (
        <>
          <p>
            Desired settings and passive observations are separate. Saving does
            not apply PBX configuration.
          </p>
          {state.data.items.length === 0 && (
            <ContentState kind="empty" title="No PBX nodes on this page" />
          )}
          {state.data.items.map((n) => (
            <Panel key={n.id} aria-label={n.displayName}>
              <h2 className="font-display text-xl break-words">
                {n.displayName}
              </h2>
              <p className="my-3 break-all">
                Saved version {n.version} · {n.management.targetAlias}
              </p>
              <Observation node={n} received={state.received ?? Date.now()} />
              <Link className={`${linkClass} mt-3`} href={`/pbx-nodes/${n.id}`}>
                Inspect {n.displayName}
              </Link>
            </Panel>
          ))}
          {work.pbx.attempt && (
            <Panel>
              <p role="status">
                An earlier create still needs reconciliation. Review this
                canonical registry and all pages before releasing that intent. A
                new submission uses a new key and can conflict with an existing
                installation.
              </p>
              <Button
                variant="secondary"
                onClick={() => work.recordPbx({ ...work.pbx, attempt: null })}
              >
                I reviewed the registry; release prior create intent
              </Button>
            </Panel>
          )}
        </>
      )}
      <nav aria-label="PBX pagination" className="flex flex-wrap gap-3">
        <Button
          disabled={cursors.length === 1 || !state.data}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous page
        </Button>
        <Button
          disabled={!state.data?.nextCursor}
          onClick={() => {
            if (state.data?.nextCursor)
              setCursors((c) => [...c, state.data!.nextCursor]);
          }}
        >
          Next page
        </Button>
        <Button variant="secondary" onClick={state.retry}>
          Reload PBX list
        </Button>
      </nav>
    </div>
  );
}
export function PbxDetail({ id }: { id: string }) {
  const state = usePbxRead<PbxNodeDto>(() => getPbx(id), id),
    node = state.data;
  return (
    <div className="space-y-5">
      <Link href="/pbx-nodes" className={linkClass}>
        Back to PBX nodes
      </Link>
      <h1 className="font-display text-3xl font-semibold">PBX details</h1>
      {state.error ? (
        <ContentState
          kind="error"
          title={state.error}
          action={<Button onClick={state.retry}>Retry PBX detail</Button>}
        />
      ) : !node ? (
        <ContentState kind="loading" title="Loading PBX detail…" />
      ) : (
        <>
          <Panel aria-label="Saved desired connection">
            <h2 className="font-display text-xl break-words">
              {node.displayName}
            </h2>
            <dl className="my-4 space-y-1 break-all">
              <dt>Canonical node ID</dt>
              <dd>{node.id}</dd>
              <dt>Permanent installation ID</dt>
              <dd>{node.installationId}</dd>
              <dt>Saved desired version</dt>
              <dd>{node.version}</dd>
              <dt>Desired target / host / TLS name</dt>
              <dd>
                {node.management.targetAlias} / {node.management.host} /{' '}
                {node.management.tlsServerName}
              </dd>
              <dt>Desired transport / port</dt>
              <dd>
                {node.management.transport} / {node.management.port}
              </dd>
              <dt>Opaque credential reference</dt>
              <dd>{node.credentialAlias}</dd>
            </dl>
            <p>
              No configuration revision or live apply is implied by this
              registry save.
            </p>
          </Panel>
          <Panel aria-label="Runtime observation">
            <h2 className="mb-3 font-display text-xl">Runtime observation</h2>
            <Observation node={node} received={state.received ?? Date.now()} />
          </Panel>
          <Link href={`/pbx-nodes/${node.id}/inventory`} className={linkClass}>
            Manage extension inventory
          </Link>
          <Link href={`/pbx-nodes/${node.id}/peers`} className={linkClass}>
            Manage trunks, gateways and DIDs
          </Link>
          <PbxForm node={node} onSaved={state.replace} />
          <Button variant="secondary" onClick={state.retry}>
            Reload PBX detail
          </Button>
        </>
      )}
    </div>
  );
}
