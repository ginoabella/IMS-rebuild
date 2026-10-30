# Exclusive tenant inventory allocation

P4-U2a implements the owner-approved [allocation policy](../planning/p4-u2a-allocation-policy-review.md).
This document specifies contracts before implementation; acceptance evidence is
recorded separately. Saved claims grant no calling readiness or staff assignment.

## Routes and strict DTOs

All routes require canonical `platform_operator` authority through platform cookies;
writes and POST previews require exact Origin and CSRF. Staff/public access denies.
All results use no-store, 64 KiB ceilings and safe errors. Unknown fields reject.
UUIDs normalize lowercase; versions are positive 32-bit integers.

Base: `/platform/tenants/:tenantId/allocations/:nodeId`. Named Next forwarding
uses exactly these routes; arbitrary backend paths are unavailable.

- GET base: `limit` (default 25, max 100), `after` (claim UUID), `history`
  (optional literal `true`). Returns `{items,nextCursor,capacity,tenant}`;
  items include current stock facts and release blockers. Capacity is derived
  from current claims across pages, separately counting reserved/allocated/disabled and unclaimed available PBX stock.
- GET `:claimId`: no query; returns the same list envelope with exactly one
  tenant/node-qualified claim, current stock and release blockers (including released
  history). Foreign claims return 404.
- GET `stock`: bounded `limit`/`after` inventory selectors on the exact node.
- POST `preview`: `{selection}` where selection is exactly `{extensionIds}`
  (1–50 distinct UUIDs) or `{range:{start,end}}` (canonical number strings,
  inclusive ascending step one, 1–50 numbers). Returns `{items,canSave,tenant}`;
  each item identifies exact stock/version, disabled state and current claim,
  or a missing-stock gap. Disabled stock is selectable; gaps/claims block new save.
- POST base: `{requestId,expectedTenantVersion,expectedAuthorityVersion,
state,items}`; state is `reserved|allocated`, items are 1–50 distinct
  `{extensionId,expectedVersion}` from reviewed preview. Revalidates every item.
- POST `:claimId/promote` or `:claimId/release`: `{requestId,expectedVersion,
expectedTenantVersion,expectedAuthorityVersion}`. Promotion accepts only reserved;
  release requires provably unreferenced desired-only stock. Returns `{items,replayed}`
  for every mutation, with the original historical outcome on exact replay.

Read tenant facts contain only `{id,status,version,authorityVersion}`. Stock facts
contain UUID, canonical number, kind, version, desired administrative status,
`credentialPending` (blocks new claims), `assignment:'none'`, `verification:'not_established'` and current claim. There is
no staff assignment table in this starting state; future assignment writers must
consume the allocation lock/version contract rather than duplicating assignment.

Errors: 400 invalid bounded fields; 401/403 authentication/authority; 404 missing
tenant/node/claim; 409 `stale_version|tenant_ineligible|selection_conflict|
request_conflict|intent_expired|referenced|invalid_transition`; 503 dependency or
unknown failure. Blockers are at most ten `{id,name}` values. No secrets/runtime
keys or raw SQL errors are returned.

## Persistence, locking and inventory compatibility

Telephony owns `tenant_inventory_claims`, retained per-version ownership history
and immutable operator request receipts. Restrictive FKs bind tenant, node,
installation and immutable extension identity. A partial unique index permits at
most one current reserved/allocated claim per extension. Range saves expand into
existing UUID claims; the PBX-wide number namespace remains owned by existing
inventory/group/service-number exclusion triggers.

Lock order: canonical operator SHARE → operator/request advisory lock → canonical
tenant SHARE → canonical node UPDATE → sorted extension UPDATE → claim rows.
Inventory writers already acquire node SHARE before profile/extension locks;
routing/runtime writers acquire the same node before resource dependencies. No
allocation writer upgrades an already-held node SHARE. Tenant status/version
writers serialize on the tenant row. All ownership changes, history, actor audit
and successful receipt commit in one same-connection transaction.

Receipts are scoped to operator/request, with fingerprints covering operation,
tenant, node, claim, expected versions and sorted stock. Concurrent exact retry
returns one original outcome for 30 days; changed intent conflicts forever and
expired requests cannot become new attempts. Reauthorization always precedes
receipt lookup. Uncertain responses require explicit exact original retry or
canonical review. Client owner/target changes discard mounted attempts; access
revalidation never automatically writes.

Desired enable/disable is compatible and retains claims. Profile adoption,
credential setup/rotation and other operations using `lockUnallocated` reject
current claims with the actionable `tenant_claimed` conflict. Profile versions remain immutable and existing stock stays pinned;
creating a new profile version does not mutate claimed stock. Existing inventory
removal is unavailable. SQL constraints additionally reject changing claimed
profile/credential identity. Historical ownership cannot be retargeted or deleted.

Release checks actual desired group/member/fallback/inbound references and
`RuntimeDependencyPort.assertUnreferenced` under node UPDATE. Any current pin,
prior committed live intent containing the extension, pending/unknown runtime,
or unavailable dependency blocks desired-only release. Immutable live-intent
history proves whether stock was ever submitted for native installation. The
initial baseline has no revision snapshot: stock created on or before its canonical
verification time also blocks release, even without later intent/pins. Only stock
created after that baseline with no live intent/pin, or desired-only nodes that
have never entered the managed runtime boundary, can establish never-installed
safety. Missing verified runtime identities/times block release. Absent browser
observations are irrelevant. Installed-resource
release/transfer and pin retirement remain with c. Future staff assignments must
add actual blockers before shipping their writer.
