# P4-U2a — Exclusive tenant inventory allocation

**Status:** complete within approved private development; A-01–07 passed, 2026-10-30 (Asia/Manila, +08:00). Owner approved ALLOC-01 and scoped ALLOC-06 in the [policy record](../../docs/planning/p4-u2a-allocation-policy-review.md), including active-tenant expansion.
**Evidence:** [Final acceptance and preservation](../../docs/status/p4-u2a-evidence.md).
**Parent:** [P4-U2 — Allocate inventory and verify tenant routing](p4-u2-allocate-inventory-and-verify-tenant-routing.md).

The parent owns shared behavior, ALLOC-01–06 policy gates and AC-01–12. This child
owns the complete operator allocation workflow, including persistence, contracts,
backend enforcement and browser interaction. Adopting the split approves no pending
policy recommendation.

## Goal and expected result

From a saved tenant's detail, a platform operator selects existing PBX inventory,
reviews an individual or range selection, saves exclusive reservations/allocations,
and reloads their canonical ownership on another HTTP replica. Two tenants on one
PBX cannot own overlapping stock. Saving changes neither tenant status nor calling
eligibility, credentials or staff assignments.

## Starting state and dependencies

Start from completed P4-U1 and P3-U5 within their approved private-development
boundaries, plus the P3-U2 inventory and P3-U4 namespace/reference contracts.
Recheck the [onboarding handoff](../../docs/status/p4-u1b-3-evidence.md) and
[runtime dependency handoff](../../docs/architecture/pbx-revisions.md#interruption-reconciliation-and-downstream-handoff).
Existing inventory has no canonical tenant allocation owner; extend its
`lockUnallocated` enforcement instead of adding an ownership badge without guards.

Resolve parent ALLOC-01 before allocation schema/API/UI implementation. Resolve
applicable ALLOC-06 release blockers before implementing release behavior. If the
safe installed-resource release path remains undecided, retain it as pending for c;
a's scope must not bypass runtime pins. Other unresolved policy does not prevent
independent documentation work.

## Scope

- Add telephony-owned canonical tenant/node/resource claims, immutable resource
  identity, positive versions, actors/times and retained ownership history through
  additive migrations and least-privilege grants. Use canonical tenancy state
  through existing owner ports; platform coordinates the authorized target.
- Select existing extension UUIDs individually or by a bounded range. Preview exact
  stock, gaps, disabled entries and conflicts; commit revalidates the full selection.
  Follow ALLOC-01's approved normalization, lifecycle, node and expansion rules.
  Never create absent extensions or silently save the available subset.
- Enforce non-overlapping current ownership with database constraints and locking,
  including intersecting range/range and individual/range selections. Reuse the
  existing PBX-wide number namespace. Keep tenant capacity claims distinct from
  platform reserved service-number exclusions and outbound reservation protection.
- Derive capacity and ownership from canonical claims. Display reservation,
  allocation, staff-assignment, desired-disabled and verification facts separately;
  disabling an extension does not release its ownership. No secondary mutable count.
- Make actual inventory edit/disable/remove/profile/credential boundary operations
  allocation-aware where necessary. Define permitted compatible changes and reject
  unsafe ones with bounded actionable blockers; regress existing unallocated flows.
  Desired ownership alone must not make extension stock ready for calling.
- Establish dependency-aware release checks against current claims/references,
  existing assignments where present and `RuntimeDependencyPort.assertUnreferenced`
  under the canonical node lock. Unknown runtime/call safety blocks release.
  Installed/in-flight/rollback pins cannot be cleared by deleting desired claims.
  The final approved safe-transfer scenario and live-call proof belong to c.
- Commit claim changes, old/new ownership audit and scoped retry results atomically.
  Use one compatible authority/tenant/node/resource lock order with existing writers.
  Exact concurrent retries produce one outcome; changed intent conflicts. Expected
  version checks prevent lost updates. Unknown outcomes require exact original
  reconciliation or canonical review, never an automatic new allocation.
- Add protected bounded selection/list/detail and versioned mutations through Nest
  and named no-store Next forwarding. Document exact DTOs/routes, numerical bounds,
  replay scope and safe errors before coding. Enforce platform permission,
  canonical authority, cookie/Origin/CSRF, strict field validation and service-failure
  denial. Client tenant IDs are targets, not authority; staff/public access denies.
- Deliver the actual tenant-detail allocation section, node/inventory selectors,
  preview/conflict display, saved ownership/capacity and release blockers. Reuse
  shared dark tokens, keyboard/focus patterns and responsive states. Preserve inputs
  on errors and same-owner mounted reauthentication; bind attempts/results to
  operator, tenant and epoch. Owner/target changes cannot inherit pending work.
  Refresh restores saved data; durable unsaved drafts are outside scope.

No tenant route binding, compiler enablement, live tests, lifecycle actions, staff
management/assignment or phone credential delivery is added. Existing renderer
policy continues denying unbound inventory.

## Acceptance criteria

| ID   | Required observable result                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01 | Real operator browser selects a saved tenant/node, previews individual/range stock, saves approved claims and reloads the same result on another replica. Gaps, invalid/disabled selections and bounds follow ALLOC-01 without implicit inventory creation or partial saves.               |
| A-02 | Two tenants share one PBX with disjoint claims. Concurrent range/range, individual/range and duplicate selections cannot double-own stock; direct constraint checks and real concurrent API writes establish the invariant.                                                                |
| A-03 | Allocation races against actual inventory edit/disable/remove and existing namespace/reservation writers preserve valid references and approved mutation behavior. Disabled stock retains claims; old unallocated/profile/credential workflows retain their contracts.                     |
| A-04 | Stale versions, authority/tenant eligibility changes, exact concurrent replay, changed fingerprints and lost responses preserve one canonical outcome. Injected audit/receipt failures roll back ownership and intent under real runtime grants.                                           |
| A-05 | Release blocks actual desired references, any existing assignment, installed/in-flight/rollback pins and unknown safety. Blockers explain the dependency; no deletion, force termination or hidden pin release occurs. Unreferenced desired-only release follows approved ALLOC-06 policy. |
| A-06 | API and Next deny wrong-plane/unauthenticated/forged authority, CSRF/Origin errors, extra/unbounded fields and unavailable dependencies. Browser covers accessible responsive preview/save/conflict/recovery; owner/target changes and delayed callbacks cannot transfer work.             |
| A-07 | Focused real PostgreSQL/shared Redis/two-replica/API/HTTPS checks, affected inventory/registry/routing/authority regressions and `./dev check` pass. Publish canonical ownership/locking/replay contracts, operator instructions, exact evidence and the b/c handoff.                      |

Parent mapping: AC-01–02 and allocation portions of AC-05/10–12. A-05 proves safe
blocking within this child; it does not complete parent AC-10's live release/transfer
scenario. No readiness or parent completion follows from a passing a.

## Required verification

The focused allocation API/browser/race selector is
`./dev exec pnpm check:tenant-allocation` in the Docker workspace. Run meaningful
real database constraint/race, rollback,
shared-session and actual private HTTPS browser checks for A-01–07. Include direct
runtime-pin blocker proof against the existing dependency port; fixtures cannot
establish active-call release safety. Run `./dev exec pnpm check:extension-inventory`,
`./dev exec pnpm check:draft-tenant`, affected routing/revision/authority checks and
`./dev check`. Record exact commands/modes, real versus injected boundaries and
owned-fixture cleanup in `docs/status`.

Apply migrations normally, refresh affected ordinary consumers, verify health and
existing access, and preserve unrelated tenants, runtime artifacts, pins and secrets.
Documentation-only preparation requires formatting, links and coverage review,
not runtime tests.

## Completion and handoff

Complete only when A-01–07 pass with reproducible evidence and tracker updates.
Hand b canonical allocation/version facts, reference guards, lock ordering, bounded
selection and replay/browser recovery patterns. Hand c release blockers and exact
unresolved runtime dependencies. Parent P4-U2 remains incomplete until a/b/c and
all parent acceptance pass; ALLOC decisions remain owned by the parent.
