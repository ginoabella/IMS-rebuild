# P4-U2b — Tenant route bindings and permissions

**Status:** planned. Split adopted 2026-10-29 (Asia/Manila, +08:00); implementation has not started.
**Parent:** [P4-U2 — Allocate inventory and verify tenant routing](p4-u2-allocate-inventory-and-verify-tenant-routing.md).

The parent owns shared contracts, ALLOC-01–06 policy gates and AC-01–12. This child
owns canonical desired route authorization and its actual operator browser workflow.
The desired graph remains denied live until c supplies tenant-aware verified apply.

## Goal and expected result

A platform operator selects existing inbound infrastructure and destinations for a
tenant, grants explicit outbound route/trunk permissions, saves the bindings and
reviews their compatibility and blockers. Foreign destinations and unapproved trunk
access reject. A backend-only trusted port supplies canonical current facts to c
and later consumers, replacing fixture-supplied allocation/binding authority.

## Starting state and dependencies

Start after [P4-U2a](p4-u2a-exclusive-tenant-inventory-allocation.md) acceptance.
Reuse its canonical ownership, locks, audit/replay and browser recovery patterns.
Recheck [inbound routing](../../docs/architecture/inbound-routing.md),
[outbound routing](../../docs/architecture/outbound-routing.md), generated internal
route identities and existing graph/reservation constraints.

Resolve parent ALLOC-02 for gateway/DID/group ownership and sharing, ALLOC-03 for
outbound permission/selection semantics, and applicable ALLOC-06 binding-release
rules before dependent implementation. Existing helpers require gateway ownership
and node-wide outbound previews have existing semantics: proposals do not silently
change either contract. Live verification decisions remain for c.

## Scope

- Add telephony-owned canonical route bindings, gateway/DID/group ownership and
  explicit tenant trunk permissions needed by the approved topology. Persist exact
  tenant, node/installation, resource UUIDs, evaluated versions, actors and history.
  Database uniqueness/ownership constraints and compatible locks backstop writes.
- Select existing infrastructure and routes; reuse P3-U4 editing/preview/navigation
  rather than rebuilding trunk or dialplan administration. Bindings do not create
  missing resources, change route UUIDs, regenerate opaque identities or expose them
  in browser DTOs. Contexts remain server-generated typed concepts.
- Validate the entire bounded inbound graph: gateway, selected DID, rule, groups,
  member extensions and fallbacks must satisfy ALLOC-02 and a's ownership facts.
  Reject foreign, missing, disabled, incompatible or cyclic destinations. Preserve
  exact-before-catch-all selection and disabled-winner denial. Hangup remains a valid
  denial destination and cannot count as successful inbound calling evidence.
- Model explicit outbound route/trunk permissions under ALLOC-03. Shared trunks
  need explicit tenant permission; foreign-owned trunks reject even when listed.
  Evaluate priorities, transforms, both reservation domains, disabled-winner and
  no-match denial under the approved tenant selection order. Keep ordinary node-wide
  preview meaning explicit; add a clearly scoped tenant advisory preview if needed.
- Supply a backend-only trusted eligibility port returning a consistent snapshot of
  canonical allocation, binding, resource ownership, permission and version facts.
  Reuse or explicitly revise the existing compatibility functions under approved
  policy. Missing/ambiguous/stale/incompatible facts deny. The port describes desired
  eligibility; it cannot claim installed readiness, authenticated live ingress or
  tenant activation.
- Integrate real dependency blockers into existing group/member/fallback, routing,
  gateway/DID, trunk and allocation mutation paths. Serialize concurrent binding
  creation and resource edits/removals; preserve retained historical associations.
  Reject unsafe changes with bounded navigable blockers; no cascade or retargeting.
- Commit binding/permission changes, actor-attributed old/new audit and exact retry
  outcome atomically. Version checks and existing authority/tenant/node lock order
  prevent stale commits. Unknown responses retain original intent for reconciliation;
  revocation/unbinding never clears actual installed/in-flight/rollback pins.
- Add bounded platform APIs and named no-store Next forwarding for binding selection,
  versioned save/revoke and advisory compatibility results. Document exact methods,
  DTOs, bounds and errors before coding. Enforce canonical platform authority,
  cookie/origin/CSRF, strict validation and safe service failures on both transports.
  Caller ID, arbitrary context text and client-supplied opaque keys cannot bind tenants.
- Deliver tenant-detail inbound/outbound sections with existing-resource selectors,
  ownership/permission summaries, graph errors and dependency links. Clearly label
  desired configuration and pending live verification. Preserve valid entered values,
  accessible keyboard/focus and responsive states; fence mounted recovery/results by
  operator, tenant and epoch. Staff/public sessions cannot manage these bindings.

No new live route enablement, direct PBX/provider access, test calls, lifecycle
transitions, staff assignment or general call ingestion is introduced here.

## Acceptance criteria

| ID   | Required observable result                                                                                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Real operator browser binds approved existing inbound gateway/DID/rule/group resources and reloads canonical bindings across replicas. ALLOC-02 ownership, selector uniqueness, catch-all scope and complete graph rules hold.                                                |
| B-02 | Foreign members/fallbacks, wrong-node resources, missing/disabled references and cycles reject atomically. Known exact/catch-all and disabled-winner preview semantics remain defined; hangup does not establish calling readiness.                                           |
| B-03 | Explicit outbound grants work in canonical compatibility/tenant advisory checks for two tenants, including an approved shared trunk. Foreign-owned, unpermitted, disabled and unmatched paths deny; priorities/transforms/reservations match ALLOC-03.                        |
| B-04 | Real concurrent binding saves, allocation release, group/member edits, DID/gateway changes and trunk removal preserve dependencies and ownership. Permission revocation cannot silently release runtime pins or retarget retained history.                                    |
| B-05 | The backend-only port supplies exact consistent ownership/permission/version facts, and missing/ambiguous/stale facts deny. No public payload, number or fixture-supplied map becomes canonical authority; saved desired eligibility remains distinct from runtime readiness. |
| B-06 | Audit/receipt failure, stale versions, exact concurrent replay, changed intent, uncertain responses and authority loss preserve one canonical outcome. API/Next authorization, CSRF/Origin, bounds, dependency outage and wrong-plane denials pass.                           |
| B-07 | Actual HTTPS browser covers selectors, graph/conflict feedback, saved versus pending status, keyboard/focus, reflow and same-owner recovery. Owner/tenant switches and late callbacks cannot attach another target's work; no save claims live apply.                         |
| B-08 | Focused real database/shared Redis/two-replica/API/browser checks, affected allocation/routing/resource/authority regressions and `./dev check` pass. Publish canonical eligibility/dependency contracts, operator instructions and exact c handoff/evidence.                 |

Parent mapping: AC-03–04 and binding portions of AC-05/10–12. AC-04's actual live
permission enforcement and AC-07 remain for c; these desired-state checks cannot
replace live calls. Parent completion remains open.

## Required verification

Add a focused binding/permission API/browser/race selector using a's Docker check
entry. Verify actual PostgreSQL constraints, reachable graph cases, locks, runtime
grants, audit rollback, shared-session recovery and actual HTTPS consumers. Exercise
actual neighboring writers in B-04 and explicit shared versus foreign trunk cases.
Run `./dev exec pnpm check:routing`, `./dev exec pnpm check:trunk-gateways`,
`./dev exec pnpm check:extension-inventory`, the a checks, affected registry/revision/
authority checks and `./dev check`. These checks do not establish live readiness.

Record commands, boundaries and cleanup in `docs/status`; apply additive migrations
through deployment, refresh ordinary affected consumers and preserve unrelated data,
existing access, retained runtime and pins. Documentation preparation uses consistency,
formatting and link checks only.

## Completion and handoff

Complete after B-01–08 pass with evidence and tracker updates. Hand c the canonical
trusted-facts port, snapshot/locking semantics, approved route evaluation, exact
bindings/permissions, mutation blockers and actual browser consumers. c owns the
new snapshot/compiler versions, live enforcement, exact route tests, readiness and
final reallocation proof. U3 activation, U5 assignment and P5-U3 ingestion remain
separate; no new downstream authority is implied by this child's completion.
