'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  ContentState,
  Panel,
  PanelHeading,
  Table,
} from '@myims/ui-web';
import type { TenantDetailDto, TenantListDto } from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { listTenants, tenantDetail, TenantError } from './client';

function useRegistry<T>(load: () => Promise<T>, resource: string) {
  const work = useOperatorWork();
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [revision, setRevision] = useState(0);
  const latest = useRef(work);
  latest.current = work;
  useEffect(() => {
    let live = true;
    setState({});
    const active = latest.current;
    void (async () => {
      if (!active.ready || !live) return;
      const captured = active.capture();
      if (!captured.current()) return;
      try {
        const data = await load();
        if (live && captured.current()) setState({ data });
      } catch (error) {
        if (!live || !captured.current()) return;
        setState({
          error:
            error instanceof TenantError
              ? error.status === 404
                ? 'Tenant not found.'
                : 'Invalid tenant request.'
              : 'The registry could not be loaded. Retry after access is restored.',
        });
        if (!(error instanceof TenantError)) active.rejectAccess(error);
      }
    })();
    return () => {
      live = false;
    };
    // Owner/resource/retry changes trigger reads; session restoration never replays a write.
  }, [work.operatorId, work.ready, resource, revision]);
  return { ...state, retry: () => setRevision((n) => n + 1) };
}
const linkClass =
  'inline-flex min-h-11 items-center rounded-md border border-subtle px-4 text-primary hover:bg-muted';
export function TenantRegistry() {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const after = cursors[cursors.length - 1] ?? null;
  const state = useRegistry<TenantListDto>(
    () => listTenants(after),
    after ?? 'first',
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Tenants</h1>
        <Link href="/tenants/create" className={linkClass}>
          Create tenant
        </Link>
      </div>
      {state.error ? (
        <ContentState
          kind="error"
          title={state.error}
          action={<Button onClick={state.retry}>Retry registry</Button>}
        />
      ) : !state.data ? (
        <ContentState kind="loading" title="Loading tenants…" />
      ) : state.data.items.length === 0 ? (
        <ContentState
          kind="empty"
          title="No tenants on this page"
          action={
            <Link href="/tenants/create" className={linkClass}>
              Create tenant
            </Link>
          }
        >
          Saved organizations will appear here.
        </ContentState>
      ) : (
        <Panel aria-label="Tenant registry">
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">Saved organizations</caption>
              <thead>
                <tr>
                  <th scope="col">Organization name</th>
                  <th scope="col">Tenant code</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="break-words">{t.displayName}</td>
                    <td className="break-all">{t.tenantCode}</td>
                    <td>
                      <Badge>{t.status}</Badge>
                    </td>
                    <td>
                      <Link
                        href={`/tenants/${t.id}`}
                        className="inline-flex min-h-11 items-center text-primary underline"
                        aria-label={`View ${t.displayName}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      )}
      <nav aria-label="Tenant pagination" className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={cursors.length === 1 || !state.data}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous page
        </Button>
        <Button
          variant="secondary"
          disabled={!state.data?.nextCursor}
          onClick={() => {
            if (state.data?.nextCursor)
              setCursors((c) => [...c, state.data!.nextCursor]);
          }}
        >
          Next page
        </Button>
        <Button variant="ghost" onClick={state.retry}>
          Reload tenants
        </Button>
      </nav>
    </div>
  );
}
export function TenantDetail({ id }: { id: string }) {
  const state = useRegistry<TenantDetailDto>(() => tenantDetail(id), id);
  const detail = state.data;
  return (
    <div className="space-y-5">
      <Link href="/tenants" className={linkClass}>
        Back to tenants
      </Link>
      <h1 className="font-display text-3xl font-semibold">Tenant details</h1>
      {state.error ? (
        <ContentState
          kind="error"
          title={state.error}
          action={<Button onClick={state.retry}>Retry detail</Button>}
        />
      ) : !detail ? (
        <ContentState kind="loading" title="Loading tenant…" />
      ) : (
        <>
          <Panel aria-labelledby="organization-heading">
            <PanelHeading id="organization-heading" className="break-words">
              {detail.tenant.displayName}
            </PanelHeading>
            <dl className="mt-4 space-y-2 break-all">
              <dt className="text-muted-foreground">Tenant code</dt>
              <dd>{detail.tenant.tenantCode}</dd>
              <dt className="text-muted-foreground">Lifecycle status</dt>
              <dd>
                <Badge>{detail.tenant.status}</Badge>
              </dd>
              <dt className="text-muted-foreground">Tenant ID</dt>
              <dd>{detail.tenant.id}</dd>
            </dl>
          </Panel>
          <Panel aria-labelledby="administrator-heading">
            <PanelHeading id="administrator-heading">
              Initial administrator
            </PanelHeading>
            {detail.administrator.kind === 'unavailable' ? (
              <ContentState
                kind="error"
                title="Initial administrator provenance unavailable"
              >
                This organization has no available linked creation record. An
                administrator cannot be inferred.
              </ContentState>
            ) : (
              <dl className="mt-4 space-y-2 break-all">
                <dt className="text-muted-foreground">
                  Administrator username
                </dt>
                <dd>{detail.administrator.username}</dd>
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  {detail.administrator.roles
                    .map((r) =>
                      r === 'tenant_admin'
                        ? 'Tenant administrator'
                        : r.replaceAll('_', ' '),
                    )
                    .join(', ')}
                </dd>
                <dt className="text-muted-foreground">Account status</dt>
                <dd>{detail.administrator.status}</dd>
                <dt className="text-muted-foreground">Credential state</dt>
                <dd>
                  <Badge tone="warning">
                    {detail.administrator.credentialState === 'unset'
                      ? 'Credentials not set'
                      : 'Credentials ready'}
                  </Badge>
                </dd>
                <dt className="text-muted-foreground">Administrator ID</dt>
                <dd>{detail.administrator.id}</dd>
              </dl>
            )}
          </Panel>
          {detail.tenant.status === 'draft' && (
            <p className="text-muted-foreground">
              This draft is unavailable for ordinary staff sign-in. Credential
              setup and activation are separate later steps.
            </p>
          )}
          <Button variant="secondary" onClick={state.retry}>
            Reload detail
          </Button>
        </>
      )}
    </div>
  );
}
