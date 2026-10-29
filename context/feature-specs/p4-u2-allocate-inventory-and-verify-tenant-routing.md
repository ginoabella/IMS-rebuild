# P4-U2 — Allocate inventory and verify tenant routing

**Status:** planned; three-sub-unit split adopted 2026-10-29 (Asia/Manila, +08:00). Parent and children have no implementation or live acceptance yet.
**Prepared:** 2026-10-29 (Asia/Manila, +08:00).
**Requirement:** [Phase 4 / P4-U2](../implementation-plan.md#p4-u2--allocate-inventory-and-verify-tenant-routing).

## Goal and expected result

A signed-in platform operator allocates existing PBX inventory to a saved tenant,
binds its inbound destinations and approved outbound permissions, reviews and
applies an exact configuration revision, and sees independently verified tenant
routing results. Two tenants share one PBX without overlapping extension ownership
or cross-tenant routing. Saved intent, installed configuration, test evidence and
tenant lifecycle remain separately visible.

P4-U2 supplies canonical telephony eligibility and evidence. P4-U3 consumes those
facts for activation and lifecycle enforcement; neither a successful allocation
nor a passing call test activates a tenant or grants ordinary draft staff access.

Sources: [overview](../project-overview.md), [architecture](../architecture.md),
[UI context](../ui-context.md), [code standards](../code-standards.md),
[workflow rules](../ai-workflow-rules.md), and [tracker](../progress-tracker.md).
Requirements below follow those sources. Recommendations in the decision register
are proposals and do not establish approved product policy.

## Starting state and dependencies

- P4-U1 and its children are complete within approved private development:
  retained draft registry, initial administrator, contacts, geography, and explicit
  `not_configured` / `enabled` / `disabled` voice preference. Consume the
  [onboarding handoff](../../docs/status/p4-u1b-3-evidence.md) and
  [voice contract](../../docs/architecture/draft-tenant-registry-api.md#p4-u1b-3-voice-preference-contract).
- P3-U2 supplies existing extension inventory, immutable endpoint/profile identities,
  private credential custody and registration observations. There is no delivered
  canonical tenant allocation owner. Inventory's current `lockUnallocated` boundary
  must become allocation-aware; a display badge alone cannot enforce ownership.
- P3-U4 supplies desired groups, reservations, inbound/outbound rules, stable internal
  identities and fixture-tested compatibility checks. Reuse the
  [inbound](../../docs/architecture/inbound-routing.md) and
  [outbound](../../docs/architecture/outbound-routing.md) contracts. These checks
  presently receive trusted facts from fixtures, not production allocation tables.
- P3-U5 and Phase 3 are complete within approved private development. Consume the
  [revision/runtime handoff](../../docs/architecture/pbx-revisions.md#interruption-reconciliation-and-downstream-handoff):
  immutable snapshots, fenced apply/recovery, exact runtime provenance and retained
  dependency pins. Current `deny-unbound-1` policy deliberately denies tenant traffic;
  snapshots mark allocation/binding facts unavailable. Existing probes do not prove
  tenant routing. A versioned compiler/snapshot extension is required here.
- Existing platform authentication, canonical authority checks, shared Redis,
  transactional audit/outbox and mounted same-operator recovery remain authoritative.
- Recheck these dependencies and resolve applicable ALLOC decisions below before
  implementation. Controlled endpoints, ingress, outbound destinations and exact
  live permissions are required for live acceptance; missing access leaves that
  acceptance incomplete.

## Implementation scope

Changes belong to the existing telephony module, its PostgreSQL migrations and
repositories, small shared contracts, platform-console consumers, existing compiler
and live executor integration, and focused acceptance/runbook documentation.
Platform coordinates tenant selection; tenancy supplies canonical tenant state.
No new service, secret store, queue or parallel call authority is required.

### Exclusive inventory and node placement

- Select an existing canonical tenant and PBX node, then reserve/allocate existing
  extension UUIDs individually or through a bounded range selection. Do not create
  missing inventory implicitly, change PBX-wide number normalization, or treat a
  numeric range as proof that every extension already exists and is available.
- Preview the exact selected inventory, conflicts, disabled stock and capacity;
  save revalidates the complete selection. Range expansion is bounded and atomic;
  no silent partial allocation. ALLOC-01 defines reservation semantics and limits.
- Persist canonical tenant/node/resource ownership with versions, actors and history.
  Database constraints prevent overlapping current ownership, including intersecting
  ranges and individual selections. Disabled inventory retains ownership claims.
  Reuse the existing number namespace and reservation constraints; tenant capacity
  reservations and platform service-number exclusions must remain distinguishable.
- Show available, reserved, allocated, assigned and disabled facts without conflating
  ownership, staff assignment, desired enablement or runtime verification. A reserved
  extension is not automatically calling-eligible. Derive capacity from canonical
  claims rather than a second mutable count.
- Allocation is not staff assignment and never changes credentials or tenant status.
  Additional inventory remains an existing P3-U2 operator workflow.

### Tenant inbound and outbound bindings

- Select existing gateway/DID, inbound rule, group and outbound rule/trunk UUIDs.
  Bind generated tenant contexts to canonical tenant ownership and current resource
  versions. Never accept arbitrary context text, opaque attribution keys, dialplan
  applications, commands, or phone numbers as tenant authority.
- Every reachable inbound extension, group member and fallback must be eligible for
  the same tenant and installation/node. Reject foreign, missing, disabled or
  incompatible resources and cyclic graphs. Hangup can be a valid deny destination
  but does not establish successful inbound calling readiness.
- Preserve exact-before-catch-all selection and disabled-winner denial. ALLOC-02 must
  settle exclusive gateway versus shared-gateway/DID ownership and catch-all scope;
  do not weaken the existing gateway-ownership compatibility helper implicitly.
- Outbound access requires an explicit tenant route binding and permitted trunk.
  Shared trunks require explicit tenant permissions; a foreign-owned trunk remains
  forbidden. Tenant endpoint contexts must admit only approved routes, preserving
  existing priorities, transforms, reservation checks and default denial. ALLOC-03
  settles how node-wide route selection interacts with tenant permissions.
- Provide a backend-only trusted eligibility port over canonical allocation,
  ownership, binding, permission and version facts. Feed the established compatibility
  functions, revision capture and verification from this port. Fixture facts, caller
  numbers and client tenant IDs cannot replace it.
- Existing inventory, routing, group, gateway/DID and trunk mutations must consult
  actual new dependencies under canonical locks. Reject unsafe edits/removal and
  return bounded actionable blockers; never cascade, detach or rebind historical UUIDs.

### Revision capture, live apply and routing proof

- Capture allocations, route bindings and shared-trunk permissions atomically with
  the existing resource snapshot. Include their evaluated versions and safe semantic
  facts in validation digests, diffs, staleness checks and runtime dependency pins.
- Introduce explicit snapshot/compiler/policy versions for tenant-aware rendering.
  Keep old immutable snapshots interpretable under their original policy; never
  reinterpret historical `deny-unbound-1` artifacts as tenant-enabled configuration.
- Extend the existing typed renderer and fenced executor; HTTP and Next neither
  contact the PBX nor receive provider material. Local validation, committed apply,
  native verification and unknown/recovery states retain their established meanings.
- Install tenant ingress/endpoint contexts only through reviewed, validated, committed
  intent and fenced apply. Unbound, unknown, ambiguous, stale or incompatible sources
  deny. Resolve trusted runtime identity through exact verified revision provenance,
  not labels, caller ID, dialled numbers alone, or a matching configuration preview.
- Retain bounded, actor-attributed inbound/outbound test results for each tenant,
  tied to installation, verified artifact/revision, allocation/binding versions,
  test kind, time and sanitized result. Test destinations and endpoint custody follow
  ALLOC-04. No raw credentials or unnecessary caller information enter evidence.
- Show distinct configured, validation, apply, runtime verification and route-test
  facts, with actionable blockers. A derived telephony-ready result requires current
  matching evidence and no unresolved runtime operation/drift. Saving, registration,
  local validation or a previous passing test alone cannot establish readiness.
- P4-U2 owns evidence production/display; P4-U3 owns the activation decision. Explicit
  voice-disabled tenants show voice as not required, without fabricated passing
  calls. Missing voice intent stays incomplete. ALLOC-04 settles evidence lifetime
  and invalidation, and ALLOC-05 settles draft-only test isolation before any calls.

### Safe release and reallocation

- Recheck staff assignment, all current desired references, installed/in-flight/
  rollback dependencies and actual active-call safety before release or transfer.
  Unknown call/runtime state cannot prove safe release. Never force-drop calls or
  infer a successful drain from missing/stale observation.
- Use `RuntimeDependencyPort.assertUnreferenced` under the canonical node lock.
  Existing retained runtime pins cannot be released by removing desired bindings.
  P3-U5 currently offers no general artifact retirement/pruning operation.
- Implement ALLOC-06's approved release path. If it requires artifact retirement,
  first specify the exact extension to P3-U5 recovery/pin ownership within this unit
  and verify it; do not bypass pins or silently add garbage collection. When safe
  release cannot be proved, expose a blocker and retain original ownership.
- Preserve historical tenant/resource/revision associations and audit old/new ownership.
  Transfer is explicit and versioned; it cannot retarget old events or assignments.

## Transaction, API and browser behavior

- Use existing same-connection transactions with canonical operator authority,
  tenant eligibility, node/resource locking and version checks. Define one compatible
  lock order with registry, routing, assignment and runtime writers before migration;
  exercise races against those actual writers, not only allocation against itself.
- Commit ownership/bindings, actor-attributed audit and durable external intent
  atomically. Exact request replay recovers the original outcome; changed intent
  conflicts. Stale edits require reload/review. Uncertain responses never authorize
  a fresh transfer or an untracked repeated call. ALLOC-04 defines live-test retry.
- Add protected bounded list/detail, selection/preview, versioned allocation/binding
  mutations and verification/status operations through the existing platform API and
  named no-store Next forwarding. Reuse revision/apply endpoints and navigation.
  Exact DTOs/routes and numerical bounds are implementation contracts to document
  before coding, not claims about endpoints already present.
- Canonical platform authority is required on both transports. Staff/public sessions
  cannot allocate resources. A tenant UUID is an operator-authorized target, never
  authority. Enforce cookie/origin/CSRF, strict unknown-field rejection, bounded
  requests/results, safe errors and backend-only internal identities/secrets.
- Extend tenant detail with node/capacity, allocation, inbound/outbound permissions,
  verification and dependency blockers; link to existing PBX resources and revisions.
  Show saved state independently of unsaved edits, runtime and lifecycle.
- Reuse shared dark tokens/components, responsive layouts, labels, keyboard/focus
  behavior and loading/empty/error feedback. Preserve values on validation/conflict.
  Bind mounted recovery and uncertain intent to canonical operator, tenant and epoch;
  lost/unknown authority blocks submissions and another operator cannot inherit work.
  Browser refresh reloads saved state; durable unsaved-form storage is outside scope.

## Exclusions and downstream handoff

- P4-U3 owns activation/suspension/retirement, admission and route effects; P4-U4 owns
  staff/roles and P4-U5 owns staff assignment and permitted tenant telephony choices.
  P4-U2 must publish eligibility/dependency ports for those consumers without building
  their screens or transitions.
- P5-U3 owns operational call synchronization/intake. Publish authenticated-source
  and provenance requirements; do not build general call ingestion here. Controlled
  verification may use the minimum trusted live adapter needed for its declared proof.
- Public voice, browser calling, phone credential delivery, production telephony/HA,
  operational launch, general artifact cleanup and backup repair remain outside scope.

## Decisions required before dependent implementation

The product owner resolves policy. Record approved answers in this specification
or its linked policy record and synchronize affected architecture before coding.
Independent specification work can proceed. Splitting does not approve defaults.

| ID       | Required decision and recommended starting proposal                                                                                                                                                                                                                                                                             | Affected work / resume condition                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ALLOC-01 | Reservation lifecycle, expiry/release, disabled-stock selection, single/multiple node placement, range semantics and bounds. Recommend explicit existing-stock claims, no automatic future-stock capture or expiry, one node per allocation batch and atomic bounded selection.                                                 | Allocation schema/API/UI: approve exact ownership and reservation transitions, limits and node rules.                                            |
| ALLOC-02 | Gateway/DID/group ownership, permitted sharing and catch-all behavior. Recommend exclusive gateway/DID/group ownership initially, with all reachable destinations owned by one tenant, matching the current trusted-facts helper.                                                                                               | Inbound bindings: approve topology and collision/default-denial rules, or explicitly revise the helper contract for shared gateways.             |
| ALLOC-03 | Approved outbound permissions and route winner evaluation within a tenant context. Recommend filter to explicitly permitted rules, then apply existing priorities/transforms and deny disabled winners; explicitly review this change from node-wide preview semantics.                                                         | Outbound binding/compiler: approve selection order, trunk sharing and denied-route behavior.                                                     |
| ALLOC-04 | Controlled ingress/endpoints, destination allowlist, allowed call actions, evidence success/freshness/invalidation and uncertain-test retry. Recommend operator-triggered bounded tests with exact artifact provenance, no automatic redial after uncertainty and invalidation on relevant semantic change.                     | Live tests/readiness: approve concrete environment, authority, success conditions and validity rules; test doubles cannot satisfy the live gate. |
| ALLOC-05 | How draft tenants can prove routing before activation without ordinary calling access. Recommend a narrowly scoped verification mode limited to controlled endpoints/destinations; ordinary draft traffic and staff sign-in remain denied. Define disabled/not-configured behavior and leave lifecycle policy to U3.            | Tenant-aware live rendering: approve verification-mode admission/removal and its production boundary before enabling tenant paths.               |
| ALLOC-06 | Release/reallocation with assignments, desired references, active/unknown calls and retained runtime pins. Recommend reject/defer until all blockers are explicitly cleared; no forced call termination. Decide whether a reviewed artifact-retirement capability is necessary or intentionally deferred with visible blockers. | Release/transfer and parent acceptance: approve achievable safe path and required runtime extension; existing pins cannot be bypassed.           |

## Acceptance criteria

| ID    | Required observable result                                                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | From saved tenant detail, operator reserves/allocates existing inventory and reloads the same canonical node/ownership on another replica. Invalid/missing/disabled selections follow ALLOC-01; no missing inventory is created.                                                                          |
| AC-02 | Two tenants share a PBX with disjoint allocations. Concurrent individual/range overlaps, intersecting ranges and inventory mutations cannot double-own numbers or partially commit a batch; constraints backstop API checks.                                                                              |
| AC-03 | Operator binds inbound gateway/DID/rule/group destinations. Every reachable destination respects approved ownership; foreign members/fallbacks, ambiguous catch-alls and incompatible references reject without changing state.                                                                           |
| AC-04 | Explicit outbound rule/trunk permissions work for each tenant, including an approved shared trunk. Foreign-owned, unpermitted, disabled and unmatched paths deny; priority/transform/reservation behavior matches ALLOC-03.                                                                               |
| AC-05 | Authority, stale-version, duplicate/replay, unknown-commit and rollback cases preserve one canonical result with correct old/new actor audit and no orphan intent. Staff/public/cross-plane and malformed DTO attempts deny on API and Next.                                                              |
| AC-06 | Exact allocation/binding/permission facts enter immutable revision capture, diff, validation, compiler output and pins. Relevant edits invalidate applicability/evidence; old snapshots keep their original deny policy.                                                                                  |
| AC-07 | Actual controlled inbound and outbound calls for both tenants on one PBX succeed through their permitted paths with trusted identity and exact verified provenance. Attempted cross-tenant, unallocated, unknown/ambiguous and stale-source paths fail closed. Fixtures alone do not pass this criterion. |
| AC-08 | Failed apply, lost owner, interrupted test, unavailable dependency, pending/unknown runtime and recovery never promote premature readiness. Reviewed known-good recovery retains ownership/history and does not replay uncertain calls.                                                                   |
| AC-09 | UI/backend distinguish saved intent, registration, local validation, live verification, tenant test evidence and lifecycle. Missing/stale/failed evidence cannot yield telephony readiness; voice-disabled handling grants no activation or fabricated proof.                                             |
| AC-10 | Release/transfer follows ALLOC-06: assignments, desired references, active/unknown calls and retained pins block unsafe changes. An approved safe release/reallocation scenario retains history and prevents old provenance from attributing calls to the new owner.                                      |
| AC-11 | Actual browser workflow covers allocation, binding, revision review/apply/test inspection and conflict/recovery with keyboard access and responsive layouts. Form values survive validation and same-owner mounted recovery; changed identity cannot recover another operator's work.                     |
| AC-12 | Required focused, real-service, live two-tenant, affected regression and normal checks pass. Operator instructions, trusted eligibility/readiness contracts, limitations and reproducible evidence are updated. No tenant activation, staff assignment or production launch is inferred.                  |

## Verification procedure

For this documentation change, review source consistency, acceptance/decision/split
coverage, local links, formatting and whitespace. No runtime pass is claimed.

For implementation, define a short focused allocation/routing check command in the
Docker workspace, with API, browser, concurrency, provenance and controlled live
modes. It does not exist yet. Retain exact commands, environment, fixture ownership,
results and injected-versus-real boundaries in `docs/status`.

1. Run domain/constraint checks for ownership/range intersections, complete reachable
   graphs, outbound permissions, snapshot compatibility and readiness invalidation.
2. Use real PostgreSQL/PostGIS, shared Redis and two HTTP replicas for complete
   browser/API journeys, race schedules, actual authority revocation, transactional
   audit/rollback, exact replay, stale edits and unavailable dependencies.
3. Use controlled real Asterisk and two tenant fixtures on one node. Retain inbound,
   outbound and denied-route results for exact installed provenance. Exercise failed
   apply/recovery, drift, interrupted tests, active-call deferral and stale-source
   denial. ALLOC-05 must make the draft test boundary explicit; never silently
   activate fixtures through a new operator workflow.
4. Run affected existing Docker checks: `./dev exec pnpm check:draft-tenant`,
   `./dev exec pnpm check:extension-inventory`, `./dev exec pnpm check:trunk-gateways`,
   `./dev exec pnpm check:routing`, `./dev exec pnpm check:pbx-revisions`, and relevant platform/staff
   authentication checks where authority or forwarding changes. Run `./dev check`.
   Existing revision checks retain their own real/native mode requirements.
5. Apply additive migrations through the normal deployment path, refresh affected
   ordinary development consumers, confirm health and existing platform/staff access,
   preserve retained PBX baseline/pins and unrelated tenants, and clean only owned
   fixtures. A missing controlled live result leaves AC-07 and parent completion open.

## Review and adopted sub-unit implementation

**Review finding:** split into three sequential vertical sub-units. Exclusive
inventory, desired route authorization and live routing proof each has an observable
operator outcome and distinct failure matrix. Keep persistence, contracts, backend
and browser together in each increment; a backend-only allocation step would not
complete its operator journey. The user adopted this split on 2026-10-29
(Asia/Manila, +08:00); standalone child specifications are linked below. This
approves the delivery split, not ALLOC-01–06 policy recommendations.

| Adopted unit                                                                                                        | Scope and independently reviewable result                                                                                                                                                                                                                          | Dependencies / decisions                                                                | Parent acceptance                                         |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [P4-U2a — Exclusive tenant inventory allocation](p4-u2a-exclusive-tenant-inventory-allocation.md)                   | Canonical node/stock claims, individual/range preview and atomic save, ownership-aware inventory writers, dependency-aware release blockers, audit/replay and actual tenant-detail allocation browser. Two replicas prove exclusivity. No live tenant eligibility. | P4-U1/P3-U5 handoffs; ALLOC-01 and applicable ALLOC-06 blockers.                        | AC-01–02, allocation portions of AC-05/10–12.             |
| [P4-U2b — Tenant route bindings and permissions](p4-u2b-tenant-route-bindings-and-permissions.md)                   | Canonical inbound/group/gateway/DID ownership, outbound route/trunk permissions, trusted eligibility port and actual operator binding screens with preview/conflict/reference checks. Produces desired tenant graph, still denied live until c.                    | a; ALLOC-02/03 and binding portions of ALLOC-06.                                        | AC-03–04, binding portions of AC-05/10–12.                |
| [P4-U2c — Verified tenant routing and integrated handoff](p4-u2c-verified-tenant-routing-and-integrated-handoff.md) | Versioned capture/compiler integration, protected tenant-aware apply, isolated draft verification, exact live two-tenant calls, evidence/readiness display, safe release/transfer proof under runtime pins and integrated recovery/regressions.                    | a/b; ALLOC-04/05 and final ALLOC-06 resolution; real controlled endpoints/destinations. | AC-06–09; finish AC-05/10–12 and rerun AC-01–04 together. |

Coverage review: every parent criterion has an owner; cross-cutting authority,
audit, browser and regression checks apply to all children, with integrated closure
in c. No child can promote tenant readiness before c's actual proof. The split
preserves U3 activation, U5 assignment and P5-U3 ingestion boundaries.

The main sizing risk is c: tenant-aware compilation, isolated test admission and
retained-pin release must be designed together before deciding whether it needs
further refinement. Do not split off a nominal verification-only child that merely
relabels existing probes. If ALLOC-06 requires a substantial retirement mechanism,
refine that scope and acceptance explicitly before implementation.

**Review outcome:** suitable for sub-unit implementation with the boundaries above.
The three child specifications are created and the split is adopted. P4-U2 and
a/b/c remain planned; ALLOC-01–06 remain open until explicitly resolved. No
implementation, live acceptance or policy approval follows from creating the specs.
