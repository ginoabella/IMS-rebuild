# Inbound routing and internal route identities

Telephony owns `inbound_rules`, an additive desired-state model. The approved
[R-02 policy](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4b-policy--october-24-2026-0800)
selects a canonical same-node gateway and either an associated DID UUID or an
explicit catch-all (`didId: null`). Destination is hangup, extension or group UUID.
New rules are disabled. Rules have immutable installation/node/UUID ownership,
actor/time attribution, positive versions and retained soft-removal history.

Exact DID precedes gateway catch-all. Disabled definitions retain selector claims;
a disabled exact match reports `disabled_rule` and does not fall through to a
catch-all. A known gateway with no selector reports `no_match`; an unknown,
removed or foreign-node gateway reports `unknown_ingress`. Number-only requests
cannot establish ingress authority. Preview requires a trusted gateway selection;
it is not an authenticated live ingress adapter.

Preview accepts the exact canonical dialled value: optional leading `+`, 1–15
ASCII digits. Leading zeros and plus remain significant. It introduces no aliases,
country inference or inventory migration. DID inventory continues to own its
existing formatting canonicalization. Selector uniqueness includes disabled rules;
partial unique indexes enforce one exact gateway/DID selector and one catch-all.
Composite foreign keys enforce DID/node/installation ownership and same-node
destination references. Locked association triggers enforce gateway/DID matching
for current rules while retained removed history preserves its original tuple. Every save revalidates current references and
the complete bounded reachable group/fallback graph.

## Transactions and actual dependencies

Reuse [routing coordination](ring-groups.md): authority, operator-scoped routing
receipt lock, canonical node `FOR UPDATE`, then dependencies. Inbound creates use
the existing routing receipt namespace, fingerprint and 30-day retention. Exact
retries replay their original DTO even after removal; changed intent conflicts.
Expected-version checks precede canonical no-op detection; no-ops retain version
and audit count. Rule, identity, reference, version, audit and receipt commit together.
Unknown commit results require exact-create retry or canonical reload/review.

Nonremoved rules, including disabled rules, block DID removal and DID number or
gateway changes, gateway removal and structural kind/trunk/source changes, and
destination group removal. Existing DID-to-gateway and gateway-to-trunk blockers
remain in force. Names and desired status are compatible changes. Shared node
serialization excludes concurrent reference creates and resource mutations;
removal never cascades, detaches or rebinds a retained UUID to a reused number.
Database ownership foreign keys and locked current-association triggers backstop
these checks. After rule removal, a DID can change gateway without rewriting the
removed rule’s historical gateway/DID tuple. Later
allocation/apply/rollback consumers must add their actual dependencies.

## Protected HTTP contract

Base: `/platform/pbx-nodes/:nodeId/routing/inbound`.
GET base uses UUID `after`, limit 1–100/default 25, bounded to 64 KiB. GET `/:id`
returns retained detail. POST base accepts `{requestId, name, gatewayId, didId,
destination}`; PATCH `/:id` accepts full values and `expectedVersion`.
`destination` is `{kind:'hangup'}` or `{kind:'extension'|'group',id}`.
PATCH `/:id/status` accepts `{expectedVersion,enabled}`; POST `/:id/remove` accepts
`{expectedVersion}`. Create returns 201; replay/edit/no-op returns 200.

POST `/preview` accepts only `{gatewayId,dialled}` and returns `advisory: true`,
`callingEligible: false`, reason, winning rule or null, exact/catch-all precedence
or null, evaluated resource UUIDs/versions/desired availability and warnings.
It evaluates saved rules in one passive primary snapshot. Preview has no save token
and grants no tenant/apply eligibility. Gateway, linked trunk, matching DID, rule
and reachable destinations are included when applicable. Missing and disabled
resources remain explicit rejection/unavailability states.

Existing platform cookie/operator permission, exact Origin/CSRF, session/authority,
no-store, query/body bounds and strict Next DTO validation apply. Unknown fields,
unsupported tenant bindings and supplied runtime keys reject at both transports.
Conflicts use `selector_conflict`, `name_conflict`, `invalid_gateway`, `invalid_did`,
`invalid_extension`, `invalid_group`, `referenced`, `stale_version`, receipt reasons
or graph limits, with at most ten actionable blocker UUIDs/names. Routing and resource
blockers also carry the referencing kind for correct browser navigation. Service errors
are sanitized 503 responses. No secret or opaque route identity is a browser DTO.

## Internal identity and ownership handoff

`domain/route-identity.ts: routeIdentity(installationId,routeId)` owns the reusable
v1 generator for inbound and future outbound routes. SHA-256 hashes a domain-tagged
JSON tuple of canonical installation and route UUIDs. It produces distinct prefixed
`sourceKey`, `watchIdentity`, `attributionKey`, plus `contextHash`. Persist these only
at create. Runtime has no UPDATE grants on identity columns. Label, caller-ID and
dialled-number changes do not enter this calculation; replacement UUIDs and foreign
installations produce different identities. Opaque keys are internal identifiers,
not credentials or proof that an event is authenticated.

`inboundTenantCompatible` takes explicitly trusted binding/allocation facts and
checks gateway, selected DID and every reachable extension/member/fallback against
one tenant and eligibility. `resolveRouteTenant` requires exactly one matching
installation/key binding with the evaluated version and compatible destinations.
Unbound, unknown, stale, duplicate/conflicting, malformed or cyclic mapping facts
resolve no tenant. No phone-number fallback exists. These deterministic fixtures
prove the boundary only: no allocation tables, tenant-binding API, event ingestion,
Asterisk compiler or live attribution is delivered.

P4-U2 must provide canonical current binding/allocation facts; P3-U5 must preserve
these mappings in verified configuration; P5-U3 must authenticate real ingress and
reconcile source/version facts before calling this internal boundary. Shared
outbound permissions remain P3-U4c/P4 work. Saving/enabling/previewing remains
PBX-offline and has no external effects or calling-readiness implication.
