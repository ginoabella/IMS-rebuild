'use client';
import Link from 'next/link';
import { Button, Panel } from '@myims/ui-web';
import type { RevisionDetail, RevisionResourceKind } from '@myims/contracts';
const linkClass = 'text-[var(--accent-primary)] underline';
function resourceHref(nodeId: string, kind: RevisionResourceKind) {
  return `/pbx-nodes/${nodeId}/${['profiles', 'extensions', 'capability', 'credentials'].includes(kind) ? 'inventory' : ['trunks', 'gateways', 'dids'].includes(kind) ? 'peers' : ['groups', 'reservations', 'inbound', 'outbound'].includes(kind) ? 'routing' : ''}`;
}
export function RevisionReview({
  detail,
  nodeId,
  pending,
  onValidate,
}: {
  detail: RevisionDetail;
  nodeId: string;
  pending: boolean;
  onValidate: () => void;
}) {
  return (
    <>
      <Panel title={`Revision ${detail.revision.sequence} detail`}>
        <p>
          Captured {detail.revision.createdAt} by {detail.revision.createdBy}.
          Compiler {detail.revision.compilerVersion}; policy{' '}
          {detail.revision.policyVersion}.
        </p>
        <p>
          {detail.sourceCurrent
            ? 'Captured sources are current.'
            : 'Sources changed. Capture and review a new revision before applying.'}
        </p>
        <p>
          Parent: {detail.revision.parentId ?? 'none'}. Baseline:{' '}
          {detail.diff.baseline
            ? `Revision ${detail.diff.baseline.sequence}`
            : 'no captured baseline; additions shown from empty review comparison'}
          .
        </p>
        {detail.diff.baseline && (
          <p>
            Baseline captured {detail.diff.baseline.createdAt} by{' '}
            {detail.diff.baseline.createdBy}; compiler{' '}
            {detail.diff.baseline.compilerVersion}; policy{' '}
            {detail.diff.baseline.policyVersion}.
          </p>
        )}
        <Button disabled={pending} onClick={onValidate}>
          Validate offline
        </Button>
        <p>
          Local validation: {detail.validation?.local ?? 'not run'}. Live
          coverage from this offline check: not evaluated. Applicability:{' '}
          {detail.validation
            ? detail.validation.applicable
              ? 'current dependencies'
              : 'stale dependencies'
            : 'not evaluated'}
          .
        </p>
        {detail.validation && (
          <p>
            Validation {detail.validation.id} · {detail.validation.createdAt} ·{' '}
            {detail.validation.createdBy}
          </p>
        )}
      </Panel>
      <Panel title="Semantic changes">
        <p>
          {detail.runtimeDiff.runtime.kind === 'verified_runtime'
            ? `Runtime comparison uses verified artifact ${detail.runtimeDiff.runtime.artifactId}, verified ${detail.runtimeDiff.runtime.verifiedAt}.`
            : 'Runtime comparison unavailable; no verified runtime revision exists.'}
        </p>
        {detail.diff.changes.length ? (
          <ul className="space-y-2">
            {detail.diff.changes.map((c, i) => (
              <li key={i}>
                <Link className={linkClass} href={resourceHref(nodeId, c.kind)}>
                  {c.kind}: {c.name}
                </Link>{' '}
                · {c.change} · fields:{' '}
                {c.fields.join(', ') || 'internal provenance'}
                <ul>
                  {c.values.map((v) => (
                    <li className="break-words" key={v.field}>
                      {v.field}: {v.before ?? 'absent'} → {v.after ?? 'absent'}
                    </li>
                  ))}
                </ul>
                {c.credentialReferenceChanged
                  ? ' · credential reference changed'
                  : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>No semantic changes against this captured baseline.</p>
        )}
      </Panel>
      <Panel title="Changes against verified runtime">
        {detail.runtimeDiff.runtime.kind === 'verified_runtime' ? (
          detail.runtimeDiff.changes.length ? (
            <ul className="space-y-2">
              {detail.runtimeDiff.changes.map((change, index) => (
                <li key={index}>
                  {change.kind}: {change.name} · {change.change}
                  <ul>
                    {change.values.map((value) => (
                      <li key={value.field}>
                        {value.field}: {value.before ?? 'absent'} →{' '}
                        {value.after ?? 'absent'}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p>No semantic changes against verified runtime.</p>
          )
        ) : (
          <p>
            No independently verified runtime baseline is available for review.
          </p>
        )}
      </Panel>
      <Panel title="Affected resources and exact references">
        <ul className="space-y-2">
          {detail.resources.map((r, i) => (
            <li key={i}>
              <Link className={linkClass} href={resourceHref(nodeId, r.kind)}>
                {r.kind}: {r.name}
              </Link>{' '}
              · version {r.version} · {r.id}
              {r.credentialReferences.map((c) => (
                <span key={c}> · {c}</span>
              ))}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Validation diagnostics and eligibility blockers">
        <ul>
          {(detail.validation?.diagnostics ?? detail.diagnostics).map(
            (d, i) => (
              <li key={i}>
                {d.severity}: {d.code}
                {d.resourceId ? ` · ${d.resourceId}` : ''}
              </li>
            ),
          )}
        </ul>
      </Panel>
    </>
  );
}
