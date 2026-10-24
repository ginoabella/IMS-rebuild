# P3-U5a — Revision capture, diff and validation

Status: **planned**. Split adopted October 25, 2026 (Asia/Manila, +08:00).
Parent: [P3-U5 specification and acceptance](p3-u5-configuration-revisions-apply-and-recovery.md).

## Goal and starting state

Give the platform operator a complete capture → review → validate workflow for
an immutable configuration revision without installing live configuration.
Dependencies: verified P3-U1–U4, P1-U5 and existing platform sessions/console.
Reuse their canonical desired records, node/installation ownership, resource
versions, lock ordering, route identities, audit and request-recovery conventions.

The parent U5-01–05 decisions remain unresolved. Deterministic review and validation
can proceed within established contracts. A PBX-side validator requires U5-01;
material-consuming work requires U5-04; live fixture eligibility requires U5-05.
Record these as explicit blockers rather than inventing permissions or eligibility.

## Scope and contracts

- Add telephony-owned revision persistence, contracts, snapshot/compiler use cases,
  protected HTTP reads/mutations and the actual console workflow. Use one consistent,
  bounded primary-database snapshot per node; capture server revision UUID/sequence,
  parent/baseline, compiler/policy versions, actors/times and exact source UUIDs,
  versions, eligibility facts and safe credential references. Snapshot/audit/create
  receipt commit atomically. No secret-store read occurs through HTTP or Next.
- Keep captured content immutable. Validation runs and later runtime results are
  separately attributed records; desired edits never rewrite a snapshot. Scoped
  request fingerprints recover uncertain capture results without duplicate revisions.
  Follow canonical locks and transaction authority rather than introducing a second
  desired-state catalog. Bound snapshot size and compiler work explicitly.
- Implement deterministic typed compilation and structural validation preserving
  endpoint/profile identities, exact credential references, routing precedence,
  disabled-winner denial, reservations, transformations, group strategy/timeouts,
  fallbacks and internal attribution identities. Escape/reject configuration injection
  and reject arbitrary applications, paths, contexts and command text.
- Persist safe compiler inputs/provenance; credential material is resolved only by
  b's separately approved protected materialization boundary. Compilation here can
  describe exact material references without producing a secret-bearing browser
  artifact. Unsupported live capabilities are explicit blockers, never silently
  dropped enabled behavior.
- Preserve deny defaults. Unallocated/disabled inventory and unbound routes remain
  calling-ineligible; no tenant binding or shared-trunk permission is fabricated.
  Future real binding facts belong to P4-U2. Keep source identities stable without
  exposing opaque runtime keys as editable or client-authoritative fields.
- Provide a redacted semantic diff against a selected captured baseline and, when
  available, the canonical verified runtime revision. Distinguish no verified runtime
  from an empty configuration. Show additions/removals, edits, credential-reference
  changes, affected resources and eligibility blockers. Report drift only from actual
  evidence; unavailable runtime observations remain unknown.
- Record bounded validation diagnostics qualified by revision/compiler/policy and
  evaluated dependency versions. Offline validation remains usable while live PBX
  validation is unavailable. Validation performs no install, reload or call.
  Changed dependencies invalidate applicability; do not update captured content or
  claim readiness. b revalidates at apply acceptance.

Excluded: live installation, new PBX control permissions, material retrieval,
resource/credential retirement, tenant allocation and operational call ingestion.
Review references are not proof of actual installed/in-flight/rollback dependencies;
b owns those pins and their mutation blockers.

## Browser and recovery

From PBX detail, open revisions, capture desired state, inspect the saved revision,
compare a baseline and validate. Provide bounded paginated history/detail, readable
affected-resource links, explicit local/live validation coverage and stale-source
feedback. No Apply action is usable before b exists and its policy gates pass.

Reuse the dark shared components, same-origin protected proxy, platform permission,
CSRF and no-store conventions. Reject staff/cross-plane access, unknown inputs,
client-selected authority and raw compiler/command fields. Preserve safe values,
focus errors and support keyboard/reflow/loading/empty/offline/error states.
Recover an uncertain capture through its exact receipt; reload canonical results
after reauthentication using existing identity-bound mounted recovery.

## Acceptance and checks

| ID | Required result |
| --- | --- |
| A-01 | Real PostgreSQL capture is immutable and internally consistent under concurrent desired edits. Snapshot, actor audit and receipt are atomic; rollback leaves no successful revision, duplicate/uncertain retries recover one result and changed fingerprints reject. |
| A-02 | Deterministic compiler tests cover all approved resource/routing semantics, limits, exact credential references, stable identities, injection rejection and explicit unsupported/eligibility blockers. Unbound/unallocated stock cannot become calling-eligible. |
| A-03 | Redacted diff identifies changes, affected resources and baseline provenance. Missing/stale runtime facts stay unknown; safe DTOs, audit and logs contain no material or raw credential-bearing configuration. |
| A-04 | Validation results bind exact inputs and versions, show stale dependencies and distinguish offline/local from unavailable live checks. Desired saves, capture and local validation cause no PBX/provider effect. |
| A-05 | Actual HTTPS capture → detail → diff → validate journey works with two HTTP replicas, session/uncertain-response recovery, cross-plane/CSRF rejection, pagination, keyboard access and responsive states. |
| A-06 | Focused checks, affected regressions and normal Docker checks pass; publish operator review guidance, compiler/snapshot contract, evidence limits and b handoff. No live apply or parent completion is claimed. |

A owns parent AC-01 and deterministic portions of AC-02, plus review portions of
AC-08–10. Live AC-02 evidence remains b/c work. Establish the proposed
`./dev exec pnpm check:pbx-revisions` check for contracts, real PostgreSQL/shared
Redis, two replicas and HTTPS browser; the script is not yet implemented.
Run affected existing routing/resource/inventory/PBX and audit/auth checks as
defined in the parent, then `./dev check`. Documentation-only preparation uses
formatting/link/consistency review without services or runtime tests.

## Handoff

Give [P3-U5b](p3-u5b-fenced-live-apply-and-verified-recovery.md) immutable revision
IDs/source versions, safe exact material references, compiler/policy provenance,
validation diagnostics, baseline semantics and the browser review path. B adds
acceptance-time revalidation, protected materialization, actual dependency pins,
fenced installation, independent verification and verified recovery. A can complete
its offline boundary while the explicitly dependent live-policy work remains gated.
