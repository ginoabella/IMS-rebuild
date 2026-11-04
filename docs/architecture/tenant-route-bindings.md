# Tenant desired route authorizations

P4-U2b implementation contract, 2026-11-03 (Asia/Manila, +08:00), under the
[approved policy](../planning/p4-u2b-routing-policy-review.md). This document
specifies intended behavior before coding; delivery evidence remains separate.

## Protected transport

Base `/platform/tenants/:tenantId/route-bindings/:nodeId`, with named no-store
Next forwarding at the same path. Canonical platform operator cookies are required;
POST also requires exact Origin and CSRF. Both transports reject unknown fields,
malformed UUIDs, arbitrary contexts/opaque identities and unsupported actions.
Requests/results are bounded to 64 KiB. Lists use UUID `after`, default limit 25,
maximum 100. Mutations require canonical draft/active tenant status and matching
tenant configuration/authority versions. Reads remain passive. No PBX/provider
connection, live apply, staff assignment or tenant activation occurs.

GET base accepts `after`, `limit`, optional literal `history=true`; returns
`{items,nextCursor,tenant,advisory:true,callingEligible:false}`. Items contain
`id,tenantId,nodeId,installationId,kind,resourceId,scope,state,version,evaluated,
createdAt,updatedAt,createdBy,updatedBy` plus current compatibility/blockers.
List reviews return compatibility/blockers with an empty `review.evaluated` to avoid
duplicating the stored graph; POST preview returns the full current evaluated set.
Kinds are `dids|groups|inbound|outbound|trunks|permission`; scope is `owned|shared`
(shared is valid only for trunks). Permission entries identify an existing trunk.
A shared trunk entry is platform-owned (`tenantId:null`), explicitly classified by
an authorized operator. Lists for a tenant include shared trunk classifications.

GET `selection` accepts `kind`, `after`, `limit`; returns existing safe UUID/name/
version/status choices, current owner/classification and next cursor. Existing PBX
resource/routing detail/edit links supply infrastructure administration. Extension
ownership continues through the existing allocation workflow.

POST `preview` accepts `{kind,resourceId,scope}` and returns bounded evaluated
resource facts `{kind,id,version}`, compatibility and actionable blockers. This
reviews a single existing ownership, route or trunk permission selection. Inbound
preview requires an exact DID; gateway catch-alls cannot bind tenants. DID and
reachable group ownership must be saved first; group ownership requires all
reachable members/fallback extensions to be allocated, enabled and tenant-owned,
and fallback groups already owned. Routes require explicit owned destinations;
no ownership is silently captured. Shared gateways derive explicit shared facts
from canonical platform-managed gateway records on the exact node/installation.

POST base accepts `{requestId,expectedTenantVersion,expectedAuthorityVersion,
kind,resourceId,scope,evaluated,expectedVersion}`. Evaluated facts are the complete reviewed set
from preview, with `expectedVersion:null` for a new entry or the reviewed
`currentVersion` for an existing entry. Reviewed facts are at most 512 distinct kind/UUID/version tuples; server recomputation
must match exactly. Client facts are a stale-review fence, never authority.
Returns `{items,replayed}`. POST `:id/revoke` accepts `{requestId,expectedVersion,
expectedTenantVersion,expectedAuthorityVersion}` and returns the same envelope.
Unbinding a route or revoking permission changes desired authorization only;
resource ownership/classification release additionally checks desired dependencies
and retained runtime safety. No runtime pins are cleared.

POST `outbound-preview` accepts only `{dialled}` (1–15 ASCII digits). Returns
`{advisory:true,callingEligible:false,reason,rule,transformed}`. Tenant-bound rules
filter before priority selection, including disabled winners. Selected-trunk
permission/availability failure denies without fallback. Original/output reservation
checks and global overlap constraints retain their existing meaning. Ordinary
node-wide preview remains unchanged.

Errors: 400 invalid fields/bounds, 401/403 access, 404 missing target, 409
`stale_version|tenant_ineligible|ownership_conflict|incompatible|referenced|
request_conflict|intent_expired|invalid_transition|graph_limit`, 503 sanitized
unavailable dependency. Blockers contain at most ten UUID/name/kind entries, with
navigation to the existing resource or tenant binding. Errors preserve form input.

## Canonical persistence and concurrency

Telephony owns retained authorization rows, per-version history and immutable
operator/request receipts. Typed restrictive foreign keys bind exact resource UUID,
node and installation. Current ownership is unique across tenants; current trunk
permissions are unique per tenant/trunk. Shared trunk classification cannot coexist
with exclusive ownership. Permission rows never override a foreign-owned trunk.

Lock order is operator SHARE, operator/request advisory lock, tenant SHARE,
canonical node UPDATE, then resource dependencies. Neighboring resource/routing,
allocation and runtime writers acquire the same node first. Constraints and locked
triggers backstop current associations and reject unsafe structural edits/removals;
name/status changes retain ownership and cause evaluated versions to become stale.
Member/fallback changes cannot introduce foreign or missing references while owned.
No resource removal cascades, retargets retained UUIDs or rewrites historical facts.

Authorization, actor-attributed old/new audit, per-version history and exact retry
outcome commit in one transaction. Reauthorization precedes receipt lookup. Exact
retry returns the immutable outcome for 30 days; changed intent conflicts forever,
expired requests cannot become new attempts. Unknown responses retain the original
owner/tenant/node-bound intent for explicit reconciliation; no automatic writes.

## Trusted eligibility and browser handoff

`TenantRouteEligibility.snapshot(tenantId,nodeId)` owns a primary repeatable-read,
read-only snapshot. `read(snapshot,tenantId,nodeId)` composes with c’s capture
transaction; its caller must hold canonical tenant/node locks or provide the same
repeatable-read guarantee. Results include canonical tenant/status/authority versions,
node/installation, exact current allocation rows, authorization rows with per-entry
compatibility and safe current resource definitions/versions.

The backend-only eligibility port reads canonical ownership, allocation, resources,
permissions and evaluated versions from one primary snapshot. Missing, duplicate,
stale, disabled, foreign or incompatible facts deny. Complete bounded graphs include
group ownership as well as members/fallbacks. Explicit same-node shared gateways
replace the old exclusive gateway fixture assumption. Tenant contexts remain typed
and server-generated. Public DTOs omit generated opaque route identities.

Eligibility describes desired authorization only. c must capture these exact facts
under the same node lock in its new versioned snapshot/compiler/pin contract and
provide verified tenant-aware live enforcement. Existing deny-unbound snapshots,
installed/in-flight/rollback pins and readiness remain unchanged in b.

Tenant detail separates inbound ownership/routes and outbound trunk classification,
permissions/routes, with existing-resource selectors, saved compatibility, dependency
links and advisory previews. Saved desired configuration and pending live verification
remain visible. Mounted values/uncertain intent are fenced by operator, tenant,
node and epoch. Identity/target changes discard work; same-owner access revalidation
preserves valid input and supports explicit retry. Keyboard focus, collapsed-card
notices and narrow-screen reflow follow the shared console conventions.

Existing routing/peer mutation errors also carry `{id,name,kind:'binding',tenantId}`
blockers (tenant UUID or null for shared platform classification). Both Next
sanitizers preserve only validated fields. Resource consoles link tenant-owned
blockers to that tenant's route card; shared classification blockers link to the
tenant registry where an operator selects a tenant/node to manage shared grants.
