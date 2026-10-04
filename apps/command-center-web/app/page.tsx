import Link from 'next/link';
import { Badge, ContentState, Panel, PanelHeading } from '@myims/ui-web';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">
            Operations workspace
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            Command center
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A shared workspace for intake, dispatch and incident monitoring.
          </p>
        </div>
        <Link
          href="/ui-preview"
          className="inline-flex min-h-11 items-center rounded-md border border-subtle bg-muted px-4 font-medium hover:bg-card"
        >
          Explore UI preview
        </Link>
      </div>
      <Panel aria-labelledby="workspace-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading id="workspace-heading">
            Workspace foundation
          </PanelHeading>
          <Badge tone="info">Interface preview</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Operational features are pending. This home shows how the workspace
          will organize primary and contextual information.
        </p>
      </Panel>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Panel aria-labelledby="intake-heading">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-subtle">01</span>
              <PanelHeading id="intake-heading">Incident intake</PanelHeading>
            </div>
            <div className="mt-4">
              <ContentState kind="empty" title="Intake is pending">
                Caller details, incident entry and draft protection will be
                delivered here.
              </ContentState>
            </div>
          </Panel>
          <Panel aria-labelledby="monitoring-heading">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-subtle">02</span>
              <PanelHeading id="monitoring-heading">
                Operational map and queues
              </PanelHeading>
            </div>
            <div className="mt-4 flex min-h-52 items-center justify-center rounded-xl border border-dashed bg-elevated p-6 text-center">
              <div>
                <p className="font-display text-xl">Monitoring workspace</p>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  Incident queues, map layers and responder locations are
                  pending.
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <Panel aria-labelledby="context-heading">
          <PanelHeading id="context-heading">Context panel</PanelHeading>
          <p className="mt-2 text-muted-foreground">
            Secondary details stay alongside the primary workspace on wide
            screens.
          </p>
          <div className="mt-5">
            <ContentState kind="empty" title="Dispatch context is pending">
              Responder details and assignment actions will appear with
              dispatch.
            </ContentState>
          </div>
        </Panel>
      </div>
    </div>
  );
}
