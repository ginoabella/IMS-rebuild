# P3-U4c — Outbound rules and integrated routing handoff

Status: planned. Sub-unit specification created October 24, 2026
(Asia/Manila, +08:00), following the user's instruction to create the three
P3-U4 sub-units. No implementation or runtime verification is claimed.

Parent: [P3-U4 — Ring groups and dial plans](p3-u4-ring-groups-and-dial-plans.md).
Predecessors: [a — Groups and reservations](p3-u4a-ring-groups-and-reserved-number-protection.md)
and [b — Inbound rules and identities](p3-u4b-inbound-rules-and-trusted-route-identities.md).
The parent owns shared invariants, routing-policy decisions and AC-01–08.

## Goal and starting state

The operator manages and previews desired outbound rules with explicit matching,
precedence, number transformations and trunk destinations, then completes the
integrated group/inbound/outbound console journey.

Start from verified a/b acceptance and existing P3-U3 outbound-capable trunks.
Reuse reservations, destination/ownership validation, shared route identities,
canonical node locking, audit, request receipts and the working routing console.
No live outbound permission, tenant binding or PBX configuration is assumed.

## Decisions and dependencies

Resolve parent R-03 before implementing outbound grammar, priority, overlapping
matches, transformations and allowed call classes. Confirm R-04's treatment of
outbound intersections and emergency/service reservations; do not infer permission
to call a reserved number or silently block an approved emergency route.
Carry forward approved R-01/R-02/R-05 without redefining them in this child.

The parent's exact-number/bounded-prefix grammar and lower-priority-number-wins
semantics are proposals. Record the decided scope of matching and any approved
exceptions in the parent/tracker before dependent work. No broad default outbound
route or operational call-class permission is introduced by creating this spec.

## Scope and expected result

- Add telephony-owned desired outbound-rule persistence, constraints, typed
  contracts and protected bounded list/create/detail/edit/status/soft-removal APIs.
  Fields express the approved pattern, length bounds, priority, explicit trunk ID
  and optional strip/add transformation; accept no raw Asterisk applications,
  arbitrary dial-plan text or opaque context keys.
- Validate grammar and intersections deterministically within the approved scope.
  Enforce equal-priority conflict rejection and ordered overlap behavior as decided;
  disabled definitions retain conflict claims. No match denies. Bound validation
  work and return actionable errors with the conflicting rule/reservation.
- Validate transformations for all numbers admitted by the pattern, not only one
  preview sample. Prevent strip underflow, empty/oversized output and invalid
  characters. Apply the approved reservation/call-class policy to original and
  transformed values as appropriate; explicitly prevent transformation bypasses.
- Extend a's reservation management checks to current outbound rules, including
  concurrent reservation edits. Use one canonical reservation model and grammar,
  and revalidate dependencies at commit despite advisory preview success.
- Require a nonremoved same-node/installation outbound-capable trunk. Add actual
  route blockers to trunk removal and incompatible direction/structural edits,
  including disabled outbound references. Preserve compatible credential-version
  adoption and existing gateway/DID blockers; no cascade or name-based retargeting.
- Reuse b's internal identity generation for outbound rules and reject browser
  tenant/attribution authority. A future tenant binding must explicitly authorize
  its outbound rules/trunks and reachable destinations. Use trusted compatibility
  fixtures to prove denied foreign/unauthorized shared-trunk use without creating
  a tenant-allocation workflow or granting unallocated stock calling eligibility.
- Commit rules/references/version/receipt/audit atomically using existing locks,
  no-op and recovery conventions. Add actual cross-replica reference and pattern
  races rather than relying only on client preview or process-local state.
- Deliver outbound forms/list/detail/status/removal and advisory preview. Explain
  the chosen rule, priority, transformed number or denied result and evaluated
  versions in business terms. Sample numbers are matching input, not attribution.
  Complete navigation across groups/reservations/inbound/outbound and show useful
  desired/unbound/disabled/dependency states with keyboard/responsive behavior.

Preview and save remain passive with the PBX offline. No call, registration,
credential read, live permission, apply worker or compiler is added. Reuse existing
platform access, same-origin proxies and identity-bound mounted form recovery.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Real PostgreSQL/API/browser outbound management enforces approved patterns/lengths/priorities and transformations. Cover exact/prefix boundaries, equal-priority overlap rejection, permitted ordered overlap, disabled claims, no match, strip underflow, empty/oversized output and invalid syntax.                                                           |
| C-02 | Reserved-number/call-class policy applies to rule domains and transformations as approved. Existing-rule versus new/edited reservation and concurrent rule/reservation writes cannot bypass protection; retain a's extension/group namespace guarantees.                                                                                                        |
| C-03 | Same-installation outbound trunks work; inbound-only/removed/foreign trunks reject. Actual removal/incompatible-edit blockers include disabled routes. Concurrent create/edit/removal, stale versions, request replay/conflict, no-ops, rollback and lost responses preserve references/audit and usable recovery. Compatible credential adoption still works.  |
| C-04 | Trusted tenant fixtures reject foreign or unauthorized shared-trunk use. Unbound outbound rules and generated identities establish no tenant ownership/calling eligibility; unsupported binding/key inputs reject. Reconcile b's identity invariants for outbound routes.                                                                                       |
| C-05 | Actual HTTPS console completes group → inbound → outbound management and previews, then status changes and dependency-ordered removal. Include reservations, blocker inspection, input retention, stale/unknown/session recovery, wrong-plane/CSRF denial, keyboard access and narrow-screen layout. PBX-offline paths have no live effects or secret exposure. |
| C-06 | Reconcile every parent AC-01–08 against a/b/c evidence; focused real-service/two-replica/browser checks, affected regressions and `./dev check` pass. Publish operator guidance and routing/reservation/identity/dependency contracts with actual commands, environment, fault-fixture limits and the downstream handoff.                                       |

Owns parent AC-03 and outbound portions of AC-04/06–08, plus final AC-01–08
reconciliation. Extend the focused Docker routing check established in a/b.
Run affected `check:extension-inventory`, `check:trunk-gateways` and
`check:pbx-nodes` scripts in the Docker workspace and the normal `./dev check`.
Use real PostgreSQL, shared sessions, two HTTP replicas and the actual browser
for those claims. Record commands/results; do not claim that these checks exist
or have passed merely because this spec defines them.

## Completion and handoff

Complete c and parent P3-U4 only when A-01–06, B-01–06, C-01–06 and all parent
criteria pass within their documented boundaries. Publish an acceptance mapping,
operator guide and tracker evidence, including any remaining policy or environment
limitations. Required failures keep the relevant unit incomplete.

Hand P3-U5 validated desired graphs, immutable identities, dependency/locking
rules and exact selected resource/credential references. That unit owns revision
diffs, compilation, approved commands, fenced apply, verification, active-call
handling and rollback dependencies. Hand P4-U2 real tenant-binding integration
requirements and P5-U3 trusted attribution contracts. Neither parent completion
nor successful preview establishes live tenant routing, voice readiness, production
readiness or completion of the Phase 3 gate.
