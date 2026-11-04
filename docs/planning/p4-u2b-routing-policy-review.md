# P4-U2b routing policy review

Prepared 2026-11-03 (Asia/Manila, +08:00). **Owner-approved in chat, 2026-11-03, with shared-gateway amendment.**
The owner also approved platform-only catch-alls: tenant bindings require exact
tenant-owned DIDs; unmatched numbers grant no tenant routing eligibility.

The [child specification](../../context/feature-specs/p4-u2b-tenant-route-bindings-and-permissions.md)
requires resolution of [parent ALLOC-02/03 and applicable ALLOC-06](../../context/feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md#decisions-required-before-dependent-implementation)
before dependent implementation. The owner approved ALLOC-03 and binding-scoped
ALLOC-06 as proposed, and approved ALLOC-02 with gateways shared while DIDs, inbound
rules and ring groups remain tenant-owned. This approval grants no live readiness.

## Approved ALLOC-02 — Shared gateways and exclusive tenant destinations

- Gateways are shared platform infrastructure on their canonical node/installation.
  Exclusively assign each selected DID, inbound rule and reachable ring group to
  one tenant. Multiple tenants may use different owned DIDs on the same gateway.
  Existing extension ownership comes from a's allocated claims; reserved stock
  does not establish route eligibility.
- Require the shared gateway to be current, enabled and compatible on the same
  node/installation. Require the selected DID, rule, every reachable group,
  extension member and fallback to be current, enabled, compatible and owned by
  the same tenant on that node/installation. Missing, foreign, disabled or cyclic
  graphs reject atomically. Ownership is retained when resources are disabled;
  subsequent checks deny eligibility without bypassing dependency protection.
- Preserve existing global gateway selector uniqueness, including disabled rules,
  and exact-before-catch-all selection with disabled-winner denial. Tenant-owned
  exact DIDs on the shared gateway cannot be captured by another tenant.
- Gateway catch-alls remain platform-only and cannot bind a tenant. Tenant inbound
  bindings require an exact owned DID. Unmatched ingress grants no tenant eligibility.
- Hangup is a permitted denial destination, never successful calling evidence.
  Binding selects existing resource UUIDs; it does not edit infrastructure,
  regenerate identities or admit caller-supplied context/attribution values.

This explicitly revises the existing exclusive gateway ownership requirement in
[inbound compatibility](../architecture/inbound-routing.md#internal-identity-and-ownership-handoff).
Implementation must distinguish a canonical shared gateway from absent ownership;
a missing tenant owner alone cannot establish approved shared infrastructure.

## Approved ALLOC-03 — Explicit tenant outbound selection

- Bind each outbound rule exclusively to one tenant. A tenant must also have an
  explicit permission for the rule's trunk, including a trunk owned by that tenant.
  Model a trunk as either exclusively tenant-owned or explicitly shared platform
  infrastructure; an unbound resource is not implicitly approved shared access.
- Shared trunks may grant explicit permissions to multiple tenants. A foreign-owned
  trunk always rejects even when a permission lists the requesting tenant. Revoking
  a trunk permission denies dependent desired eligibility and shows affected routes;
  it never silently selects another trunk or clears retained runtime pins.
- For tenant advisory evaluation, filter to that tenant's explicitly bound routes,
  then choose the matching rule with the existing lowest numeric priority. Keep
  disabled bound rules in selection: a disabled winner denies. After selection,
  missing permission, unavailable/foreign trunk or incompatible facts deny without
  falling through to a lower-ranked rule. No matching bound route denies.
- Preserve global equal-priority overlap constraints, exact/prefix matching,
  strip/add transforms and reservation protection of both original and transformed
  domains. Tenant filtering does not relax existing node-wide resource constraints.
- Keep ordinary node-wide preview unchanged. Label tenant preview as desired-state
  advisory with no calling readiness; tenant filtering is an explicitly distinct
  selection scope, to be handed to c for its versioned compiler/live enforcement.

This extends the existing explicit route ownership and trunk permission checks in
[outbound compatibility](../architecture/outbound-routing.md#downstream-handoff)
without changing ordinary node-wide preview semantics.

## Approved binding-scoped ALLOC-06 — No runtime pin release

- Allow explicit versioned revocation/unbinding of desired authorizations, retaining
  historical ownership, exact associations and actor-attributed old/new audit.
  Revocation does not assert that installed calling permissions have changed.
- Block unsafe resource edits, removals and allocation release using actual current
  binding/group/member/fallback dependencies under compatible canonical locks.
  Keep bounded navigable blockers; do not cascade, retarget or transfer ownership.
- Resource ownership release requires all current desired dependencies to be removed
  explicitly and affirmative proof of no assignment, installed/in-flight/rollback
  pin or unknown call/runtime safety. Reuse a's runtime dependency checks under the
  canonical node lock; unavailable facts deny release.
- Installed-resource transfer, artifact retirement, live revocation and calling
  readiness remain c's work. Unbinding or revocation cannot clear runtime pins.

This retains [a's approved desired-only release boundary](p4-u2a-allocation-policy-review.md#approved-scoped-alloc-06-decision).

## Decision and continuation

All b policy gates are resolved by owner chat approval, including platform-only
catch-alls. Synchronize affected architecture and publish exact bounded API/DTO,
snapshot, locking and replay contracts before coding. Then implement the complete operator
journey and verify B-01–08 with the required PostgreSQL/shared Redis/two-replica,
actual HTTPS browser, neighboring-writer races, regression and full checks.

This policy approval establishes no application implementation, live access,
verified readiness or completed acceptance criterion.
