'use client';
import { Button } from '@myims/ui-web';
import type { RouteAuthorizationKind } from '@myims/contracts';
import type { useBindings } from './use-bindings';
import { labels, dependencyLink } from './navigation';
export function SavedAuthorizations({
  s,
  direction,
  nodeId,
  kinds,
  disabled,
}: {
  s: ReturnType<typeof useBindings>;
  direction: string;
  nodeId: string;
  kinds: RouteAuthorizationKind[];
  disabled: boolean;
}) {
  return (
    <>
      <ul
        className="space-y-3"
        aria-label={`Saved ${direction} authorizations`}
      >
        {s.saved?.items
          .filter((a) => kinds.includes(a.kind))
          .map((a) => (
            <li
              id={`route-binding-${a.id}`}
              key={a.id}
              className="space-y-2 rounded-md border border-subtle p-3"
            >
              <p>
                {labels[a.kind]} ·{' '}
                {a.scope === 'shared' ? 'shared platform' : 'this tenant'} ·{' '}
                {a.state} · v{a.version}
              </p>
              <a
                className="text-primary underline"
                href={dependencyLink(
                  nodeId,
                  a.kind === 'permission' ? 'trunks' : a.kind,
                  a.resourceId,
                )}
              >
                Inspect resource {a.resourceId}
              </a>
              <p>
                {a.review.compatible
                  ? 'Desired compatibility current'
                  : 'Desired compatibility blocked or stale'}{' '}
                · Live verification pending
              </p>
              {a.review.blockers.map((b, i) => (
                <p key={i}>
                  <a
                    className="text-primary underline"
                    href={dependencyLink(nodeId, b.kind, b.id, b.tenantId)}
                  >
                    {b.name}
                  </a>
                </p>
              ))}
              {a.state === 'active' && (
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => s.revoke(a)}
                >
                  Revoke {labels[a.kind].toLowerCase()}
                </Button>
              )}
            </li>
          ))}
      </ul>
      {s.saved && !s.saved.items.some((a) => kinds.includes(a.kind)) && (
        <p>No saved {direction} authorizations on this page.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => void s.load()}
        >
          First saved {direction}
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || !s.saved?.nextCursor}
          onClick={() => void s.load(s.saved!.nextCursor)}
        >
          More saved {direction}
        </Button>
      </div>
    </>
  );
}
