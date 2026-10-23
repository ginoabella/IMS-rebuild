'use client';
import { Button, Panel } from '@myims/ui-web';
import { form, type PeerModel } from './use-peers';
export function PeerDetail({ model }: { model: PeerModel }) {
  const { r, state, kind, pending, blocked, confirm, setConfirm, save, run } =
    model;
  return (
    <>
      {' '}
      {r && (state.mode === 'detail' || state.mode === 'edit') && (
        <Panel aria-label="Resource detail">
          <h2 className="font-display text-xl">{r.name}</h2>
          <dl className="grid gap-2 break-all sm:grid-cols-2">
            <dt>ID</dt>
            <dd className="font-mono">{r.id}</dd>
            <dt>Installation</dt>
            <dd className="font-mono">{r.installationId}</dd>
            <dt>Version</dt>
            <dd className="font-mono">{r.version}</dd>
            <dt>Status</dt>
            <dd>
              {r.removedAt
                ? 'Removed'
                : r.enabled
                  ? 'Enabled (desired)'
                  : 'Disabled (desired)'}
            </dd>
            <dt>Credentials</dt>
            <dd>
              {r.credentialStatus === 'not_required'
                ? 'number' in r
                  ? 'Not required (DID inventory)'
                  : 'Not required (IP-peer)'
                : 'Selected version (desired)'}
            </dd>
            <dt>Created by</dt>
            <dd className="font-mono">
              {r.createdBy} · {r.createdAt}
            </dd>
            <dt>Updated by</dt>
            <dd className="font-mono">
              {r.updatedBy} · {r.updatedAt}
            </dd>
          </dl>
          <pre className="my-3 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(
              'settings' in r
                ? { direction: r.direction, settings: r.settings }
                : 'number' in r
                  ? { number: r.number, gatewayId: r.gatewayId }
                  : {
                      kind: r.kind,
                      trunkId: r.trunkId,
                      sourceAddresses: r.sourceAddresses,
                    },
              null,
              2,
            )}
          </pre>
          {!r.removedAt && (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={blocked}
                onClick={() =>
                  save({ ...state, mode: 'edit', values: form(r) })
                }
              >
                Edit{' '}
                {kind === 'trunks'
                  ? 'trunk'
                  : kind === 'gateways'
                    ? 'gateway'
                    : 'DID'}
              </Button>
              <Button
                variant="secondary"
                disabled={blocked}
                onClick={() =>
                  void run({
                    parts: ['peers', kind, r.id, 'status'],
                    method: 'PATCH',
                    body: { expectedVersion: r.version, enabled: !r.enabled },
                  })
                }
              >
                {r.enabled ? 'Disable' : 'Enable'}{' '}
                {kind === 'trunks'
                  ? 'trunk'
                  : kind === 'gateways'
                    ? 'gateway'
                    : 'DID'}
              </Button>
              <Button
                variant="destructive"
                disabled={blocked}
                onClick={() => setConfirm(true)}
              >
                Remove{' '}
                {kind === 'trunks'
                  ? 'trunk'
                  : kind === 'gateways'
                    ? 'gateway'
                    : 'DID'}
              </Button>
            </div>
          )}
          {confirm && !r.removedAt && (
            <div className="mt-4 space-y-3">
              <p>
                Remove {r.name}? Existing references block removal; its history
                will be retained.
              </p>
              <Button
                variant="destructive"
                disabled={blocked}
                onClick={() =>
                  void run({
                    parts: ['peers', kind, r.id, 'remove'],
                    method: 'POST',
                    body: { expectedVersion: r.version },
                  })
                }
              >
                Confirm removal
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirm(false)}
              >
                Cancel removal
              </Button>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
