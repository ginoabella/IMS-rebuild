'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  EndpointCredentialStatusDto,
  ExtensionDto,
} from '@myims/contracts';
import { Button, Panel } from '@myims/ui-web';
import { inventoryRequest, InventoryError } from './client';
import { ProfileChoice, dependencies } from './forms';
import type { InventoryModel } from './use-inventory';
export function Registration({ extension }: { extension: ExtensionDto }) {
  const o = extension.observation;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const received = performance.now();
    setElapsed(0);
    const t = setInterval(
      () => setElapsed(Math.max(0, performance.now() - received)),
      1000,
    );
    return () => clearInterval(t);
  }, [o]);
  if (o.kind === 'not_available')
    return <p>Registration unknown · no observation available.</p>;
  const age = o.ageMs === null ? null : o.ageMs + elapsed;
  const current =
    o.registration !== 'unknown' &&
    o.freshness === 'current' &&
    age !== null &&
    age < 30000 &&
    o.desiredVersion === o.nodeVersion &&
    o.coverage === 'pjsip-dynamic-contacts' &&
    o.ownership === 'current' &&
    o.reconciliation === 'complete' &&
    o.connection === 'reachable';
  return (
    <div className="space-y-1">
      <p>
        Registration:{' '}
        {current
          ? o.registration.replaceAll('_', ' ')
          : 'unknown / historical or stale'}
      </p>
      <p>
        Observation age:{' '}
        {age === null ? 'unknown' : `${Math.floor(age / 1000)} seconds`} ·{' '}
        {o.connection} · {o.coverage} · {o.reconciliation} · ownership{' '}
        {o.ownership}
      </p>
      <p>
        Node desired/observed versions {o.nodeVersion}/{o.desiredVersion}; epoch{' '}
        {o.epoch}, sequence {o.sequence}.
      </p>
      {current && (
        <p>
          Endpoint{' '}
          {o.endpointPresent ? 'present' : 'absent from covered snapshot'} ·
          dynamic contacts {o.contacts ?? 'none'} · reachable contacts{' '}
          {o.reachableContacts ?? 'none'}
        </p>
      )}
      <p>
        Observation verifies no profile or credential generation and grants no
        calling readiness.
      </p>
    </div>
  );
}
export function InventoryDetail({ model }: { model: InventoryModel }) {
  const extension = model.state.extension;
  const [status, setStatus] = useState<EndpointCredentialStatusDto>();
  const requestEpoch = useRef(0),
    target = useRef(`${extension?.id}:${extension?.version}`);
  target.current = `${extension?.id}:${extension?.version}`;
  useEffect(
    () => () => {
      requestEpoch.current++;
    },
    [],
  );
  useEffect(
    () => setStatus(undefined),
    [
      extension?.id,
      extension?.version,
      model.work.operatorId,
      model.work.ready,
    ],
  );
  if (!extension) return null;
  const blocked =
    model.pending || !!model.state.attempt || model.state.needsReview;
  const request = (action: 'setup' | 'reset') =>
    void model.run(
      ['extensions', extension.id, 'credentials', action],
      'POST',
      {
        operationId: crypto.randomUUID(),
        expectedVersion: extension.version,
        expectedGenerationId:
          extension.credentials.kind === 'configured'
            ? extension.credentials.generationId
            : null,
      },
    );
  return (
    <Panel aria-label={`Extension ${extension.number} details`}>
      <h2 className="font-display text-xl">
        Extension {extension.number} details
      </h2>
      <dl className="my-3 space-y-1 break-words">
        <dt>Canonical identity</dt>
        <dd>{extension.id}</dd>
        <dt>Kind / desired version</dt>
        <dd>
          {extension.kind} / {extension.version}
        </dd>
        <dt>Desired administrative status</dt>
        <dd>{extension.administrativeStatus}</dd>
        <dt>Ownership</dt>
        <dd>Available · unallocated platform inventory</dd>
        <dt>Selected profile/version</dt>
        <dd>
          {extension.profile.id} / {extension.profile.version}
        </dd>
        <dt>Safe credentials</dt>
        <dd>
          {extension.credentials.kind}
          {extension.credentials.kind === 'configured'
            ? ` · generation ${extension.credentials.generationId}`
            : ''}
        </dd>
        <dt>Readiness</dt>
        <dd>Not established · allocation and calling remain unavailable</dd>
      </dl>
      <Registration extension={extension} />
      <p className="my-3">
        Disable/re-enable and credential reset save desired state only. They do
        not disconnect phones, revoke the old runtime password, release
        ownership or apply configuration.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={blocked}
          onClick={() =>
            void model.run(['extensions', extension.id, 'status'], 'PATCH', {
              expectedVersion: extension.version,
              administrativeStatus:
                extension.administrativeStatus === 'enabled'
                  ? 'disabled'
                  : 'enabled',
            })
          }
        >
          {extension.administrativeStatus === 'enabled'
            ? 'Disable desired extension'
            : 'Re-enable desired extension'}
        </Button>
        <Button
          disabled={model.pending || !!model.state.attempt}
          variant="secondary"
          onClick={() => void model.select(extension)}
        >
          Reload and review selected extension
        </Button>
      </div>
      <fieldset disabled={blocked} className="my-4 min-w-0 space-y-3">
        <ProfileChoice model={model} id="adoption-profile" />
        <p>
          Adopt only after reviewing the affected extension above and selected
          profile version. Number/node identity cannot change.
        </p>
        <Button
          disabled={!dependencies(model)}
          onClick={() => {
            const d = dependencies(model);
            if (d)
              void model.run(['extensions', extension.id], 'PATCH', {
                expectedVersion: extension.version,
                ...d,
              });
          }}
        >
          Adopt selected profile version
        </Button>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={blocked}
          onClick={() =>
            request(extension.credentials.kind === 'unset' ? 'setup' : 'reset')
          }
        >
          {extension.credentials.kind === 'unset'
            ? 'Set up desired credentials'
            : 'Reset desired credentials'}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const capture = model.work.capture(),
              epoch = ++requestEpoch.current;
            if (!capture.current()) return;
            try {
              const s = await inventoryRequest<EndpointCredentialStatusDto>(
                extension.nodeId,
                ['extensions', extension.id, 'credentials'],
              );
              if (
                capture.current() &&
                epoch === requestEpoch.current &&
                target.current === `${extension.id}:${extension.version}`
              )
                setStatus(s);
            } catch (e) {
              if (
                capture.current() &&
                epoch === requestEpoch.current &&
                target.current === `${extension.id}:${extension.version}`
              ) {
                if (e instanceof InventoryError) model.setMessage(e.reason);
                else model.work.rejectAccess(e);
              }
            }
          }}
        >
          Reload safe credential status
        </Button>
      </div>
      {status && (
        <div role="status" className="mt-3 space-y-1 break-words">
          <p>
            Desired credential status: {status.credential.kind} · desired
            version {status.desiredVersion}
          </p>
          {status.credential.kind === 'configured' && (
            <p>
              Generation {status.credential.generationId}; material health{' '}
              {status.credential.materialHealth}. Retained dependencies unknown.
            </p>
          )}
          <p>
            Active operation:{' '}
            {status.activeOperation
              ? `${status.activeOperation.operationId} · ${status.activeOperation.state} · ${status.activeOperation.failure ?? 'no failure reported'}`
              : 'none'}
            . Live activation is not established.
          </p>
        </div>
      )}
    </Panel>
  );
}
