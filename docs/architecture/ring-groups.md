# Ring groups and reserved numbers

P3-U4a implements the user-approved R-01/R-04/R-05 policy in the
[parent spec](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md).
Telephony owns `ring_groups`, ordered `ring_group_members`, `number_reservations`
and immutable create results in `routing_receipts`. This is unbound desired state;
HTTP and preview have no PBX, DNS, credential-store or call adapter. Tenant bindings,
opaque attribution keys and unknown fields reject. Inventory remains unallocated
and calling-ineligible. No live readiness follows from enabling a definition.

Groups start disabled and accept an optional canonical number 1000–899999, 1–32
ordered distinct same-node inventory extensions, simultaneous/sequential strategy,
5–120 seconds per attempt (default 20), and explicit hangup/extension/group fallback.
Simultaneous uses one attempt; sequential uses one per member in order. Busy,
unavailable and no-answer advance; exhaustion follows the fallback. Disabled
inventory is allowed for planning and labelled unavailable. The complete fallback
graph is checked transactionally, bounded to 512 current groups per node; cycles
reject with a fallback field error. Membership and destination foreign keys enforce
exact node/installation identity. Deferred membership constraints require 1–32
members at commit. Referenced groups cannot be removed, including references from
disabled groups. Name/number/order/strategy edits preserve resource identity.

Reservations have a safe name/purpose and exact ASCII digits or a literal digit
prefix with explicit minimum/maximum total length 1–15. Exact patterns require
both lengths to equal the digit count. Leading zeros are significant. There is no
enable switch. Platform operators can create/edit/remove reservations; changes
reject intersections with existing extensions, nonremoved groups or other
reservations, including disabled claims. No initial reservations are seeded: the
reviewed running bootstrap contains only its default hangup catch-all; reference
examples are not authoritative. Emergency/service policy is not inferred.

## Namespace and transaction coordination

The derived `telephony_number_claims` constraint index has one numeric `int8range`
per digit length for each owner. Prefix `12`, lengths 3–4, produces length-3
`[120,130)` and length-4 `[1200,1300)` ranges. Digit length preserves distinctions
such as `01` versus `1`. An installation/length/range GiST exclusion constraint
prevents overlap across resource types and replicas. Only fixed-search-path,
security-definer owner triggers can mutate this derived index; runtime has SELECT
only. The additive migration backfills all existing extension claims before use.
No second editable reservation model exists. `domain/routing.ts` exports the
shared pattern parser and intersection matcher for P3-U4c. Outbound rules must
check reservations using this grammar; their own priority/overlap semantics remain
with c and cannot be inferred from the namespace constraint.

Lock order is canonical operator authority, scoped request receipt advisory lock,
canonical node, then dependency rows/number claims. Group/reservation writes take
node `FOR UPDATE`. Inventory keeps its existing node `FOR SHARE` and sorted
per-number advisory locks, so independent inventory creates can still progress
concurrently. Shared/exclusive node modes exclude reservation/group edits before
claims are read; no SHARE-to-UPDATE upgrade is introduced. Database exclusions
backstop even direct conflicting writes. Extension individual/bulk previews and
commits consult the shared claim index, including current reservations and groups.

All resource/member/reference/version/claim/audit/receipt changes commit together.
Positive expected versions are checked before no-op detection. Canonical no-ops
keep version/audit unchanged. Operator-scoped request IDs cover both routing kinds;
exact canonical create retries replay the original result before rechecking current
dependencies, while changed intent conflicts. Receipts expire after 30 days and
expired keys reject; no pruning job is introduced. Soft removal retains UUID,
members/fallback/settings and audit; only eligible namespace claims are released.
Replacement numbers never retarget old IDs. Uncertain edits require canonical
reload/review; unknown creates can explicitly retry their exact request.

Extension status and profile adoption remain compatible with group references;
these changes do not remove or retarget inventory and disabled resources prevent
future apply eligibility. There is no extension removal feature. Future allocation,
apply/in-flight/rollback consumers must add actual blockers before using IDs and
share this node coordination. Existing trunk/gateway/DID removal contracts remain
owned by [resource dependencies](trunks-and-gateways.md); b adds [actual inbound references](inbound-routing.md).

## Protected transport and browser

Base: `/platform/pbx-nodes/:nodeId/routing/:kind`, kind `groups`, `reservations` or [inbound](inbound-routing.md).
GET base lists current definitions with UUID `after` cursor, limit 1–100/default 25,
at most 64 KiB. GET `/:id` retains removed history. POST base uses `requestId` and
value fields; PATCH `/:id` uses full values plus `expectedVersion`. Group-only
PATCH `/:id/status` uses `{expectedVersion, enabled}`. POST `/:id/remove` uses
`{expectedVersion}`. Group fields are `name,number,memberIds,strategy,timeout,fallback`;
reservation fields are `name,purpose,pattern`. Fallback is `{kind:'hangup'}` or
`{kind:'extension'|'group',id}`. Pattern is `{kind:'exact'|'prefix',digits,minLength,maxLength}`.
Creation returns 201, replay/no-op/edits 200. Detail results wrap `{resource}`.

POST `/groups/preview` takes group values plus optional existing `resourceId`,
returns an advisory result, evaluated dependency IDs/versions/desired availability,
attempt count, this group's maximum ring duration, and unbound/disabled warnings.
It never grants tenant/calling eligibility. Preview uses a passive primary snapshot,
with POST CSRF checks but no operational activity renewal. Mutation revalidates
current dependencies under the node lock; preview is no save token.

Existing platform-cookie authority, source checks, exact Origin/CSRF, limits,
no-store reads and canonical transactional operator validation apply. Errors use
400 safe field errors, 404 missing/removed mutation target, 409 fixed conflict
reasons and at most ten actionable claim/reference IDs/names, or sanitized 503.
Next forwards named routing paths only, bounds inputs/outputs and validates DTOs.
The console at `/pbx-nodes/:nodeId/routing` uses shared UI, resource selectors,
ordered members, availability labels, retained inputs, field focus, explicit
canonical reload/exact-create retry and canonical-owner/epoch mounted work fences.
Mounted drafts do not survive refresh.

`tenantCompatible` is a narrow deterministic boundary accepting explicitly trusted
allocation facts and inspecting every reachable member/fallback. Tests establish
mixed-tenant rejection only. P4-U2 must supply actual canonical allocation/binding
facts before tenant use; no HTTP binding or fixture allocation is delivered here.

P3-U4b adds [inbound management/identities](inbound-routing.md), sharing node locks,
receipts, group destination validation and actual group-removal blockers.
