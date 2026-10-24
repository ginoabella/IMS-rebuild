# P3-U4a — Ring groups and reserved-number protection

Status: planned. Sub-unit specification created October 24, 2026
(Asia/Manila, +08:00), following the user's instruction to create the three
P3-U4 sub-units. No implementation or runtime verification is claimed.

Parent: [P3-U4 — Ring groups and dial plans](p3-u4-ring-groups-and-dial-plans.md).
The parent owns shared invariants, routing-policy decisions and AC-01–08.
This child owns group/reservation delivery and its acceptance below.

## Goal and starting state

The operator manages desired ring groups, membership, fallback behavior and
reserved numbers in the actual platform console. Group numbers, individual/bulk
extension creation and reservations share one validated installation namespace.

Start from completed P3-U1/P3-U2/P3-U3 within their verified private-development
boundaries. Reuse existing inventory/resource APIs, canonical ownership, platform
sessions, audit, expected versions and request receipts. Recheck relevant
[inventory policy](../../docs/planning/p3-u2a-inventory-contract-review.md) and
[resource dependency contracts](../../docs/architecture/trunks-and-gateways.md).
No prior routing implementation is assumed.

## Decisions and dependencies

Resolve parent R-01, R-04 and R-05 before their dependent implementation:
group numbering/membership/strategy/timeouts/fallbacks, actual reservation policy
and management authority, and unbound-definition behavior. The parent's values
are proposals, not approvals. Record decisions in the parent and tracker.

This child establishes shared exact-number/bounded-prefix reservation matching.
Outbound rule intersection is added in c. Confirm the approved grammar now so c
can extend the same validator without a second reservation model. Review actual
bootstrap/unmanaged usage when establishing reservations; preserve runtime files.

## Scope and expected result

- Add telephony-owned group, membership, fallback and reservation persistence,
  constraints, typed DTOs and protected bounded APIs. Provide list/create/detail/
  edit, desired group status and eligible soft removal. Reservation mutations
  follow the approved authority/claim policy rather than inventing an enable switch.
- Group fields cover a name, optional dialable number, ordered member IDs,
  strategy, timeout and explicit fallback. Apply approved bounds and defaults.
  References use existing extension/group UUIDs on the same canonical node and
  installation; reject missing/removed/wrong-kind or duplicate members.
- Validate the complete fallback graph and reject direct/indirect cycles on every
  affected edit. Bound traversal and return a useful field or dependency error.
  Explain sequential versus simultaneous timeout behavior in the form and preview.
- Add namespace checks to existing individual/bulk extension creation and group/
  reservation writes. Reconcile existing inventory locking with the canonical node
  lock; constraints and transactions must prevent races across replicas. Check
  reservation edits against existing desired claims, not only newly created stock.
- Retain disabled definitions' claims. Add actual group/member/fallback blockers
  to affected existing paths and group removal; no cascade or silent reassignment.
  Do not introduce an extension deletion feature merely to provide a blocker.
- Commit each mutation, reference change, version, receipt and audit atomically.
  Preserve existing no-op, exact-create retry, stale-version and canonical reload
  behavior. Soft removal retains UUID/history and releases only eligible claims.
- Add the routing navigation and working group/reservation console screens with
  resource selectors, dependency details, advisory validation and availability
  warnings. Use shared UI, labelled controls, keyboard support, narrow-screen
  reflow and safe value retention on errors. Fence mounted recovery by operator.

Disabled/unallocated members may be planned only as allowed by R-01/R-05; display
their condition explicitly. Group creation never allocates an extension, establishes
tenant ownership, changes calling eligibility or contacts Asterisk. Reject unsupported
tenant-binding inputs. Tenant compatibility rules take trusted facts at a narrow
boundary and inspect every reachable member/fallback; fixture checks do not deliver
real allocations. No inbound/outbound rules, credentials or live apply are added.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Real PostgreSQL/API/browser group create/read/edit/status/removal follows approved R-01/R-05, including optional number, distinct members/order, strategies, timeout bounds/defaults, fallback termination and direct/indirect cycle rejection. Missing, removed, wrong-node/installation and wrong-kind destinations reject. |
| A-02 | Reservation create/edit/removal and individual/bulk extension/group writes enforce approved R-04. Test exact and bounded-prefix intersections, boundary values, existing-stock conflicts, disabled claims and eligible claim release without retargeting old IDs.                                                             |
| A-03 | Two-replica extension-versus-group, bulk-versus-reservation, reservation-edit-versus-create and fallback-reference-versus-removal races preserve constraints. Stale writes, same/changed request replay, rollback, no-ops and lost responses retain correct versions/audit and usable recovery.                               |
| A-04 | Trusted ownership fixtures reject mixed-tenant reachable graphs; APIs reject unsupported tenant bindings and opaque keys. Unallocated inventory remains calling-ineligible. Disabled-resource warnings and compatibility results make no live-readiness claim.                                                                |
| A-05 | Actual HTTPS console completes group/reservation management and blocker/recovery paths with existing authentication, wrong-plane/CSRF denial, input retention, keyboard access and responsive states. Offline PBX saves/previews cause no external effects or secret exposure.                                                |
| A-06 | Focused real-database/API/browser checks, affected inventory/resource/PBX regressions and `./dev check` pass. Operator guidance and dependency contracts document actual commands, approved policy, evidence limits and the b/c handoff.                                                                                      |

Owns parent AC-01 and group/reservation portions of AC-04/06–08. Follow the
parent's Docker verification procedure; introduce and record the focused routing
check command during implementation. Use real PostgreSQL/shared sessions and two
HTTP replicas for race claims. A mock alone cannot satisfy these acceptance rows.

## Completion and handoff

Complete a only when A-01–06 pass and the tracker records evidence/limitations.
Hand b verified group destinations, fallback validation, namespace reservations,
actual blockers, browser navigation and transaction/recovery conventions. Hand c
the shared reservation matcher and namespace mutation contract. Future allocation/
apply owners must add their real dependencies before use. Parent P3-U4, tenant
readiness and live PBX routing remain incomplete.
