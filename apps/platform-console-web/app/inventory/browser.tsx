'use client';
import Link from 'next/link';
import { Button, ContentState, Panel } from '@myims/ui-web';
import { useInventory } from './use-inventory';
import { CreateInventory, ProfileEditor } from './forms';
import { InventoryDetail, Registration } from './detail';
export function InventoryBrowser({ nodeId }: { nodeId: string }) {
  const model = useInventory(nodeId),
    { state } = model;
  return (
    <div className="min-w-0 space-y-5 break-words">
      <Link
        href={`/pbx-nodes/${nodeId}`}
        className="inline-flex min-h-11 items-center text-primary underline"
      >
        Back to PBX details
      </Link>
      <h1 className="font-display text-3xl">Extension inventory</h1>
      <p>
        Inventory management, passive PBX observation and future live
        configuration deployment are separate. Saving establishes no tenant
        calling readiness or WebRTC functionality.
      </p>
      <p
        role="status"
        aria-live="polite"
        className="whitespace-pre-wrap break-all"
      >
        {model.message}
      </p>
      {!model.matches ? (
        <ContentState kind="loading" title="Preparing operator workflow…" />
      ) : (
        <>
          {state.attempt && (
            <Panel aria-label="Uncertain inventory intent">
              <p>
                Retained immutable intent requires explicit recovery. Input is
                locked. Reauthentication never submits automatically.
              </p>
              {state.attempt.method === 'POST' && (
                <Button
                  disabled={model.pending}
                  onClick={() =>
                    void model.run(
                      state.attempt!.parts,
                      state.attempt!.method,
                      state.attempt!.body,
                      true,
                    )
                  }
                >
                  Retry same inventory intent
                </Button>
              )}
              <p>
                For edits, reload and review canonical versions. For creation,
                inspect every relevant inventory/profile page before releasing
                the prior intent.
              </p>
              <Button
                variant="secondary"
                disabled={model.pending}
                onClick={() => {
                  model.record({ ...state, attempt: null, needsReview: true });
                  model.setMessage(
                    'Prior intent released after explicit canonical review. Reload the selected resource before editing.',
                  );
                }}
              >
                I reviewed canonical state; release prior intent
              </Button>
            </Panel>
          )}
          {state.needsReview && (
            <Panel>
              <p>
                Review canonical state before another action. A stale or
                uncertain edit must reload the selected extension/profile and
                preserve input for comparison.
              </p>
              <Button
                disabled={model.pending || !!state.attempt}
                onClick={() => void model.review()}
              >
                Reload list for explicit review
              </Button>
            </Panel>
          )}
          {model.readError ? (
            <ContentState
              kind="error"
              title="Inventory could not be loaded"
              action={
                <Button onClick={() => void model.reload()}>
                  Retry inventory
                </Button>
              }
            />
          ) : !model.page ? (
            <ContentState kind="loading" title="Loading inventory…" />
          ) : (
            <Panel aria-label="Canonical extension inventory">
              <h2 className="font-display text-xl">Canonical inventory</h2>
              {model.page.items.length === 0 ? (
                <ContentState kind="empty" title="No extensions on this page" />
              ) : (
                <ul className="space-y-4">
                  {model.page.items.map((e) => (
                    <li key={e.id} className="my-3 border-b border-subtle pb-3">
                      <p>
                        {e.number} · {e.kind} · desired {e.administrativeStatus}{' '}
                        · available / unallocated · credentials{' '}
                        {e.credentials.kind} · version {e.version}
                      </p>
                      <p className="break-all">
                        Profile {e.profile.id} version {e.profile.version}
                      </p>
                      <Registration extension={e} />
                      <Button
                        disabled={model.pending || !!state.attempt}
                        onClick={() => void model.select(e)}
                      >
                        Inspect extension {e.number}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <nav
                aria-label="Inventory pagination"
                className="mt-3 flex flex-wrap gap-3"
              >
                <Button
                  disabled={!model.hasPrevious || model.pending}
                  onClick={model.previous}
                >
                  Previous inventory page
                </Button>
                <Button
                  disabled={!model.page.nextCursor || model.pending}
                  onClick={model.next}
                >
                  Next inventory page
                </Button>
                <Button variant="secondary" onClick={() => void model.reload()}>
                  Reload inventory
                </Button>
              </nav>
            </Panel>
          )}
          {model.profiles && !model.profiles.capability && (
            <Panel aria-label="Missing approved endpoint compatibility">
              <p role="status">
                No approved endpoint capability declaration is available for
                this installation. The deployment owner must declare reviewed
                compatibility before profiles or inventory can be created. PBX
                reachability does not establish compatibility.
              </p>
            </Panel>
          )}
          {model.profiles?.capability && model.profiles.items.length === 0 && (
            <p role="status">
              No endpoint profiles on this page. Create a compatible approved
              profile or return to the first profile page before creating
              inventory.
            </p>
          )}
          <InventoryDetail model={model} />
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <CreateInventory model={model} />
            <ProfileEditor model={model} />
          </div>
        </>
      )}
    </div>
  );
}
