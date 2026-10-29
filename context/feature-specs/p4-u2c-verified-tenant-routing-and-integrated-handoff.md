# P4-U2c — Verified tenant routing and integrated handoff

**Status:** planned. Split adopted 2026-10-29 (Asia/Manila, +08:00); implementation has not started.
**Parent:** [P4-U2 — Allocate inventory and verify tenant routing](p4-u2-allocate-inventory-and-verify-tenant-routing.md).

The parent owns shared behavior, ALLOC-01–06 and AC-01–12. This child integrates
canonical desired ownership with exact live runtime proof and closes the parent
acceptance matrix. Earlier desired-state checks are necessary but insufficient.

## Goal and expected result

An operator reviews an exact tenant-aware revision, validates/applies it through
the existing fenced executor and inspects actual inbound/outbound call results for
two tenants on one PBX. Permitted paths preserve ownership; forbidden or unknown
sources deny. Current evidence drives telephony-readiness display without activating
tenants. Release/reallocation follows approved dependency and active-call safeguards.

## Starting state and dependencies

Start after [a](p4-u2a-exclusive-tenant-inventory-allocation.md) and
[b](p4-u2b-tenant-route-bindings-and-permissions.md) pass their declared acceptance.
Consume their canonical ownership/binding/permission ports and mutation guards.
Recheck the [P3-U5 revision/runtime contract](../../docs/architecture/pbx-revisions.md)
and [integrated evidence](../../docs/status/p3-u5c-evidence.md).
Reuse existing immutable snapshots, protected exact-material custody, native physical
fencing, durable intent/outbox, independent probes, recovery and runtime pins.

Resolve ALLOC-04's exact controlled environment/actions/destinations and evidence
validity, ALLOC-05's isolated draft verification contract, and final ALLOC-06's
achievable safe release path. Reconfirm ALLOC-01–03 approved semantics consumed from
a/b. If ALLOC-06 requires substantial artifact retirement, refine that implementation
boundary and acceptance before coding; the split does not authorize general pruning.
Real controlled endpoints/ingress/destinations and their permitted access are required.
Missing live proof keeps the affected criteria and parent incomplete.

## Scope

- Extend atomic revision capture to include exact allocations, bindings, permissions,
  evaluated versions and safe semantic facts. Include these in immutable snapshots,
  diff, validation digests, fresh applicability checks and actual runtime dependency
  pins. Prevent mixed ownership/resource snapshots under concurrent changes.
- Introduce explicit snapshot/compiler/policy versions for tenant-aware rendering.
  Keep old snapshots/artifacts interpretable under their original `deny-unbound-1`
  policy. Old validation/probe results cannot be reused as tenant verification.
- Extend the existing typed renderer and protected fenced executor to consume b's
  canonical facts. Generate tenant ingress/endpoint contexts and enforce approved
  inbound graphs and outbound permissions. Unbound, foreign, unknown, ambiguous,
  stale or incompatible sources deny; numbers/labels alone never identify tenants.
- Apply only committed, reviewed, currently valid intent. Preserve native custody,
  ownership fencing, exact credential references, mutation barriers and recovery.
  HTTP/Next and ordinary workers receive neither PBX control nor provider material.
- Implement ALLOC-05's narrow verification admission for draft tenants without
  enabling ordinary draft calls/sign-in or adding lifecycle actions. Define setup,
  expiry/removal and failure behavior under the approved policy. Verification-mode
  admission cannot be inferred from tenant existence or voice preference.
- Provide operator-triggered bounded live routing tests under ALLOC-04. Persist
  actor-attributed test intent/results with exact installation/artifact/revision,
  allocation/binding versions, permitted test kind, time and sanitized outcome.
  Use the minimum trusted adapter required to prove actual ingress and destinations;
  general call synchronization stays with P5-U3. Unknown call dispatch outcomes
  require reconciliation, not automatic redial or untracked retries.
- Derive current telephony readiness from applicable validated/applied/verified
  provenance and required inbound/outbound results, with explicit invalidation and
  freshness rules. Pending/unknown operations, drift, stale/failed evidence or missing
  ownership cannot yield ready. Keep registration and lifecycle separate.
  Explicit voice-disabled configuration shows voice not required without invented
  tests; `not_configured` stays incomplete. U3 alone owns activation gates/actions.
- Implement ALLOC-06's safe release/transfer workflow and final actual proof. Recheck
  assignments, desired references, active-call safety and installed/in-flight/rollback
  pins using the canonical node lock and runtime dependency port. Unknown safety
  defers; no forced termination or inferred drain. Removing desired references does
  not release pins. Any approved narrow artifact-retirement extension must preserve
  required recovery targets and receive its own explicit verification here.
- Preserve immutable ownership/history/provenance so late old events cannot resolve
  to a new tenant after reallocation. Audit original/new ownership and safe release
  evidence. Where assignment writers are not yet delivered, verify the port/constraint
  boundary and identify that limitation; do not build U5 or claim its future races passed.
- Extend existing tenant detail/revision consumers with affected-resource review,
  apply/recovery progress, exact route-test outcomes, stale-evidence explanations,
  readiness blockers and approved release actions. Use bounded protected APIs,
  named no-store forwarding, strict DTOs, canonical authority and Origin/CSRF.
  Retain accessible responsive states and operator/tenant/epoch-bound recovery.

No tenant activation/suspension/retirement, staff assignment screens, browser
calling, public voice intake, general event ingestion, production rollout or backup
repair belongs to this child. Versioned tenant-routing support extends the current
live boundary; it does not approve additional environments or control commands.

## Acceptance criteria

| ID   | Required observable result                                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Exact canonical allocation/binding/permission facts enter consistent immutable capture, safe diff, validation and pins. Relevant concurrent semantic changes invalidate applicability. Historical deny-policy artifacts retain their interpretation and authority.                                                                                                  |
| C-02 | Actual operator HTTPS review/validate/apply runs through existing durable intent, exact-material custody and physical fencing. Tenant-aware runtime matches approved ownership/permissions; stale authority, unsupported policy and invalid dependencies reject before unsafe effects.                                                                              |
| C-03 | Controlled real inbound and outbound calls for each of two tenants sharing one PBX prove permitted destinations and exact verified provenance. Actual cross-tenant, unallocated, unpermitted, unknown/ambiguous and stale-source attempts deny; mocked resolver inputs alone cannot satisfy these cases.                                                            |
| C-04 | Draft verification stays within ALLOC-05's approved endpoints/destinations and lifetime/removal behavior. Ordinary draft sign-in and traffic remain denied. Voice-disabled/not-configured and lifecycle display do not fabricate success or activation.                                                                                                             |
| C-05 | Evidence freshness/invalidation, duplicate intent, interrupted/uncertain calls, pending runtime, drift, failed apply, owner loss and dependency outages never promote readiness or replay calls. Reviewed known-good recovery preserves tenant ownership, history and pin safety.                                                                                   |
| C-06 | Actual active-call and unknown-state scenarios defer release. Existing desired/assignment/runtime dependencies block unsafe transfer. An approved safe release/reallocation scenario succeeds only after required blockers clear; old provenance cannot acquire the new tenant. Any necessary approved retirement extension preserves rollback/recovery guarantees. |
| C-07 | API/Next reject wrong-plane/forged authority, Origin/CSRF errors, malformed/unbounded input and secret/opaque-key injection. Actual browser covers accessible responsive allocation/binding/revision/test/release states, conflicts and identity/tenant-isolated mounted recovery.                                                                                  |
| C-08 | Focused real-service/live checks, affected a/b/resource/routing/revision/authority regressions, ordinary environment preservation and `./dev check` pass. Reconcile every parent AC-01–12 with exact evidence and publish operator and downstream contracts with declared limitations.                                                                              |

Parent mapping: AC-06–09, final AC-05/10–12 and integrated rerun of AC-01–04.
C-03 establishes parent AC-07; C-06 establishes the final release/transfer portion
of AC-10. A missing required real result leaves these open; successful P3 probes,
local validation or development fixtures alone do not substitute.

## Required verification

Define a short integrated Docker allocation/routing command with explicit real
API/browser/concurrency and live verification modes. No new command exists yet.
Use actual PostgreSQL/PostGIS, shared Redis, two HTTP replicas, production Next/private
HTTPS and controlled real Asterisk. Record exact mode, provenance and target facts,
redacting secrets and unnecessary caller data.

Exercise source-snapshot and apply-acceptance races, actual native owner loss and
reviewed recovery, evidence invalidation and uncertain call dispatch. Distinguish
injected response/provider faults from actual call/runtime behavior. Run a/b checks,
`./dev exec pnpm check:draft-tenant`, `./dev exec pnpm check:extension-inventory`,
`./dev exec pnpm check:trunk-gateways`, `./dev exec pnpm check:routing`,
`./dev exec pnpm check:pbx-revisions`, affected platform/staff authentication checks
and `./dev check`. Preserve existing required native/live revision modes.

Apply migrations normally; refresh affected ordinary consumers, verify health and
platform/staff access, preserve unrelated tenants and required runtime/rollback
artifacts, remove only owned fixtures and confirm verification-mode cleanup.
Retain reproducible evidence in `docs/status`. Formatting/link/coverage checks
suffice for this documentation preparation; no runtime pass is implied.

## Completion and downstream handoff

Complete c only after C-01–08 pass. Mark parent complete only after a/b/c and all
AC-01–12 are reconciled against required actual evidence. Update the tracker,
architecture contracts and operator guide with commands, safe recovery and limits.

Hand P4-U3 current telephony evidence/readiness and explicit voice-state semantics
for its separate activation/lifecycle decisions. Hand P4-U5 verified tenant-owned
extension/permission selection and dependency ports without implementing assignment.
Hand P5-U3 generated identities, exact runtime provenance and authenticated-source
requirements without claiming operational call ingestion. Production readiness and
the remainder of Phase 4 remain separately incomplete.
