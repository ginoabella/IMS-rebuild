# Desired outbound routing contract

The approved [R-03/R-04 policy](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4c-policy--october-24-2026-0800)
uses exact ASCII digits or literal prefixes with minimum/maximum total lengths
1–15. Leading zeros are significant; `+`, regex, Asterisk applications/patterns
and arbitrary contexts reject. Priority is an integer 0–2147483647; lower wins
within the canonical PBX node. Equal-priority intersecting input domains reject,
including disabled definitions. Different priorities may overlap. A selected
disabled rule denies without falling through. No match denies.

Strip 0–minimum input length leading digits, then prepend 0–15 literal ASCII
digits. Every admitted input must produce 1–15 digits. The exact output domain
has fixed prefix `addPrefix + input.digits.slice(stripCount)` and total bounds
`input.lengthBounds - stripCount + addPrefix.length`. The fixed prefix may be
empty when stripping beyond a prefix; this still describes all possible suffixes,
not one sample. Reservations block intersections with either entire domain.
There are no emergency/service exceptions, implicit aliases or inferred
international/service permissions. Creating a rule grants no live permission.

## Persistence, locking and references

`outbound_rules` is telephony-owned, with immutable node/installation IDs and
server UUID, safe name, explicit trunk UUID, pattern, priority, strip/add,
desired status, versions, actors/times and retained soft-removal history.
Create starts disabled. Same-node/installation nonremoved outbound/both trunks
are required; disabled trunks remain visible desired dependencies.

Authority → operator/request receipt → canonical node lock → dependency and
pattern checks is the existing write order. Receipt, rule, internal identities,
derived domains and audit commit atomically. No-ops preserve version/audit;
exact create retries recover the same resource, stale writes conflict and
uncertain edits require canonical review. Preview uses a passive database
snapshot and every write revalidates at commit. Validation is bounded to 512
current outbound rules per node, at most fifteen lengths per domain and ten
reported conflicts. Reservation lookup uses the canonical indexed claim model.

`outbound_number_domains` is a derived constraint index, not a second reservation
model. Database triggers synchronize input/output spans with node serialization;
length-specific ranges preserve leading zeros. Input domains have an exclusion
constraint on node, priority, length and span. Reservation writes check both
outbound domains; outbound writes check canonical reservation claims. Runtime
cannot mutate derived domains directly. Database ownership FKs and field/length
checks backstop application validation.

Actual trunk removal, changes to its connection structure, or loss of outbound
direction reject while any current outbound rule references it, including disabled
rules. Existing gateway/DID blockers remain. Name/status and compatible credential
version adoption remain allowed. Nothing cascades or retargets on name reuse.
Removed rules retain the original trunk UUID; after removal eligible trunk changes
resume. Future binding/apply/rollback owners must add their real dependencies.

## HTTP and browser

Base `/platform/pbx-nodes/:nodeId/routing/outbound` supports GET bounded list
(default 25, maximum 100, UUID cursor), POST create with `requestId`, GET `/:id`,
PATCH `/:id` with full fields and `expectedVersion`, PATCH `/:id/status` with
`{expectedVersion,enabled}`, and POST `/:id/remove` with `{expectedVersion}`.
Fields: `{name,pattern:{kind,digits,minLength,maxLength},priority,trunkId,
stripCount,addPrefix}`; omitted strip/add default to zero/empty. Unknown fields,
including tenant bindings and opaque keys, reject. Existing platform-cookie,
operator permission, exact-origin/CSRF, identity fencing and no-store rules apply.

POST `/preview` takes only `{dialled}` (1–15 ASCII digits). It returns
`advisory:true`, `callingEligible:false`, winning rule/null, transformed number/null,
business reason, evaluated rule/trunk UUIDs/versions/availability and warnings.
It evaluates saved rules; unsaved form edits and sample numbers carry no identity
or permission. Disabled winners and unavailable trunks are explicit.

Errors include `priority_conflict`, `reserved_number`, `invalid_trunk`,
`outbound_limit`, shared name/version/receipt conflicts and sanitized service
failures. Bounded blockers include UUID/name/kind for operator navigation.
No credential read, PBX contact, registration, call, compiler or worker is involved.

## Downstream handoff

The existing `routeIdentity(installationId,routeId)` generates all four stable
internal identities at creation, independent of number, label or client identity.
Opaque keys are absent from browser DTOs; runtime has no identity UPDATE grants.
Unbound rules establish no tenant ownership or calling eligibility.

`outboundTenantCompatible` is an internal trusted-facts boundary: an eligible
route must belong to the binding tenant/installation, and its eligible same-
installation trunk must explicitly permit that tenant. A foreign-owned trunk
rejects even if a permission list contains the tenant. Shared trunks require
explicit permissions. Missing/unbound facts deny. Fixtures prove this boundary;
there is no allocation workflow or public binding API.

P4-U2 must supply authoritative current route/trunk permissions and reachable
allocations. P3-U5 receives desired graphs, generated identities, versions,
canonical locking/dependencies and exact trunk credential-version references;
it owns diffs, compilation, fenced apply, verification, active-call policy and
rollback dependencies. P5-U3 must authenticate event sources and reconcile actual
mapping/version facts; no dialled-number attribution fallback is allowed.
Desired-route completion alone grants no live tenant routing or voice readiness.
