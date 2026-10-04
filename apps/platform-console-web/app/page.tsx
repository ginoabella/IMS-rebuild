import Link from 'next/link';
import { Badge, ContentState, Panel, PanelHeading } from '@myims/ui-web';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">
            Platform workspace
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            Platform console
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Shared telephony infrastructure and organization onboarding.
          </p>
        </div>
        <Link
          href="/ui-preview"
          className="inline-flex min-h-11 items-center rounded-md border border-subtle bg-muted px-4 font-medium hover:bg-card"
        >
          Explore UI preview
        </Link>
      </div>
      <Panel aria-labelledby="console-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading id="console-heading">Console foundation</PanelHeading>
          <Badge tone="info">Interface preview</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Administration features are pending. Platform management has its own
          home, separate from the tenant command center.
        </p>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel aria-labelledby="asterisk-heading">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-subtle">01</span>
            <PanelHeading id="asterisk-heading">
              Asterisk infrastructure
            </PanelHeading>
          </div>
          <p className="mt-2 text-muted-foreground">
            Configure and verify shared telephony infrastructure before
            onboarding voice-enabled organizations.
          </p>
          <div className="mt-5">
            <ContentState
              kind="empty"
              title="Infrastructure management is pending"
            >
              PBX nodes, extensions, routing and configuration review will be
              delivered here.
            </ContentState>
          </div>
        </Panel>
        <Panel aria-labelledby="tenants-heading">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-subtle">02</span>
            <PanelHeading id="tenants-heading">Organizations</PanelHeading>
          </div>
          <p className="mt-2 text-muted-foreground">
            Onboard tenants, establish ownership and review the readiness of
            their configured services.
          </p>
          <div className="mt-5">
            <ContentState kind="empty" title="Tenant management is pending">
              Organization onboarding and lifecycle management will follow
              platform configuration.
            </ContentState>
          </div>
        </Panel>
      </div>
    </div>
  );
}
