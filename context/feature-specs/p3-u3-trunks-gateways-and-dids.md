# P3-U3 — Manage trunks, gateways, and DIDs

## Status and purpose

- **Status:** planned; feature specification and split review prepared 2026-10-16 (Asia/Manila, +08:00). Implementation has not started. The user adopted the three-child a → b → c split on 2026-10-16 (Asia/Manila, +08:00). This adopts implementation boundaries only; unresolved policies remain unapproved.
- **Requirement:** [Phase 3, P3-U3](../implementation-plan.md#p3-u3--manage-trunks-gateways-and-dids), [platform requirements](../project-overview.md#platform-and-asterisk-administration), and [telephony architecture](../architecture.md#telephony-architecture).
- **Goal:** let an authenticated platform operator create, inspect, edit and safely remove desired trunk, gateway and DID definitions through the console before tenant voice allocation.
- **Completion boundary:** valid definitions and their relationships persist in PostgreSQL with concurrency protection and actor-attributed audit. Invalid references, collisions and unsafe removal are rejected. The browser distinguishes a desired save from live Asterisk configuration, operational connectivity and tenant voice readiness.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
This document defines intended behavior; the [tracker](../progress-tracker.md)
records delivery state. Preparing this spec does not authorize PBX writes,
provider access expansion, operational calls or production deployment.

## Starting state and dependencies

The plan names P3-U1 as the dependency. P3-U1 and P3-U2 are now complete within
conditionally approved private-development boundaries; recheck their evidence
and actual interfaces before implementation:

- [PBX registry contract](../../docs/architecture/pbx-registry.md) and [P3-U1 evidence](../../docs/status/p3-u1c-evidence.md): canonical node/installation identity, deployment-controlled connectivity, safe aliases, authority, transactional edits and retry conventions.
- [PBX observation contract](../../docs/architecture/pbx-observation.md): independent fenced passive observation. Its current dynamic endpoint/contact coverage does not establish trunk registration, gateway health or DID reachability.
- [Inventory contract](../../docs/architecture/extension-inventory.md) and [P3-U2 evidence](../../docs/status/p3-u2c-evidence.md): node-scoped identity, immutable selections, safe desired-state mutations and protected browser patterns. These are reuse opportunities, not a new prerequisite absent from the plan.
- [Endpoint credential contract](../../docs/architecture/endpoint-credentials.md): private OpenBao is approved for the declared endpoint lifecycle only. It is not an approved trunk-credential service or a generic browser secret editor.
- [Inventory browser contract](../../docs/architecture/extension-inventory-browser.md): narrow named forwarding, current platform authority, CSRF, no-store reads, bounded bodies/results and operator-bound mounted recovery.
- Existing module-owned SQL repositories, deployment-owned migrations/grants, shared Redis sessions, same-transaction audit/outbox and durable execution where external work is actually needed.

At this review, the telephony module and shared contracts implement PBX nodes,
observations, endpoint inventory/profiles and endpoint credentials. They do not
contain a canonical trunk, gateway or DID catalog/API. Existing draft tenants do
not establish resource allocation or routing. No application behavior was executed
or reverified while preparing this documentation.

## Scope and ownership

P3-U3 owns typed trunk/gateway/DID contracts, canonical desired persistence,
relationship/collision validation, protected platform APIs, approved opaque
credential bindings, versioned edits, dependency-safe removal, browser workflows,
required checks and operator documentation. Introduce only the schema and ports
needed for these resources and their immediate consumers.

| Owner | Boundary retained |
| --- | --- |
| P3-U1 | PBX identity, management connectivity, leases and passive node observations. Resource saves do not change observer permissions or management credentials. |
| P3-U2 | Extension inventory/profiles and endpoint credential generations. Trunks and gateways are not staff extensions and must not be discovered into that inventory. |
| P3-U4 | Ring groups, inbound/outbound rules, patterns, precedence, destinations, generated contexts and trusted attribution keys. A DID here identifies desired ingress inventory; it is not an inbound route. |
| P3-U5 | Versioned configuration snapshots/compiler, diff review, validation, installation/reload, verification, rollback, ordered fenced execution and active-call handling. |
| P4-U2 / P4-U3 | Tenant reservations/allocations, approved outbound use, inbound tenant bindings, tested voice readiness and lifecycle effects. Shared trunks do not imply shared tenant contexts. |
| P5-U3 / P8 | Operational call attribution/intake, public voice and browser calling. |

No raw Asterisk editor/import, arbitrary directives, provider discovery,
provider account purchase/provisioning, dial-plan editor, tenant selector that
allocates resources, operational test-call button or implicit live apply belongs
in this unit. A configuration reference is evidence of compatibility only; keep
[reference/asterisk_config](../../reference/asterisk_config/) unchanged and never
copy its credentials, shared contexts or public ingress as product defaults.

## Decisions required before dependent implementation

The user owns product-policy decisions in the existing D-09 telephony area.
Resolve the following in a scoped contract review and reference that decision
from the tracker before implementing dependent behavior. Routine file layout,
HTTP route naming, bounded pagination and lock implementation follow existing
conventions. A split does not resolve a missing policy.

| Gate | Required decision and examples | Affected work / resume condition |
| --- | --- | --- |
| G-01 — Resource and connection policy | Define what constitutes a trunk versus a gateway; their supported relationships/cardinality, inbound/outbound capabilities, supported signaling/authentication modes, transport/media/profile fields and defaults. Define approved remote hosts/ports, source identification and deployment-controlled destination/ACL rules. Include one valid trunk, one valid gateway and invalid combinations. | a: approve the typed schema and compatibility policy before dependent contracts or migrations. Do not assume all gateways require a separate trunk or allow arbitrary SIP URLs. |
| G-02 — DID identity and collisions | Define accepted syntax, normalization, national versus international forms, leading-zero/plus handling, length/bounds and exact-number matching. Define the collision namespace across nodes, trunks, gateways and provider accounts, including disabled/removed identities, and whether multiple DIDs can share an ingress. Include equivalent-number, duplicate-ingress and genuinely separate-provider/node examples. | b: approve canonicalization and database uniqueness rules before DID persistence. Extension-number rules do not define DID rules; display labels never determine equivalence. |
| G-03 — Protected credential references | Define supported authentication modes, approved existing-reference selection or protected provisioning, material owner/provider, exact generation/version binding, allowed process access and safe missing/unavailable status. Decide whether any new provider operation, identity or supplied-secret handoff is needed and how it recovers. | a where authenticated definitions are supported: approve the specific reference/binding flow first. Reuse the provider only under an explicitly extended scoped contract. No browser entry/reveal, path submission, secret rotation or new worker permissions are implicitly approved. |
| G-04 — Desired lifecycle and removal | Define creation defaults, allowed desired status changes, fields that are immutable, disable versus removal behavior, history/identity reuse and collision reservations. Define which dependencies block removal or structural edits, and behavior when applied/in-flight/rollback/allocation/active-call facts are unavailable. | a needs identity/status/edit rules; b needs removal/history rules. Approve before exposing those actions. Unknown required safety facts must block removal; no cascade or guessed absence is allowed. |

No decision is needed to finish this specification. Live reload commands,
active-call drain/defer behavior, tenant routing semantics and test destinations
remain gates of their owning later units. P3-U3 cannot claim those gates resolved.

## Desired resource and relationship contracts

Every resource has an immutable internal ID and canonical PBX node/installation
association, bounded display name, explicit desired administrative state,
optimistic version, timestamps and creator/updater attribution. Moving a resource
to another installation is not an ordinary edit. Disabled records retain identity
and dependency checks; exact number reuse/removal behavior follows G-02/G-04.

| Resource | Required desired facts, subject to the gates |
| --- | --- |
| Trunk | Supported purpose/direction and approved typed connection/profile selection, authentication mode and opaque protected reference when required. Distinguish desired registration configuration from observed registration. A trunk is not a tenant allocation or outbound permission. |
| Gateway | Approved gateway kind and signaling/source definition, node identity, and any required trunk relationship under G-01. Trusted-source selectors must be allowlisted and unambiguous; caller ID does not identify a gateway. |
| DID | Canonical called number plus display form if needed, immutable identity and explicit node-qualified ingress association(s) under G-01/G-02. Store no tenant route destination or operator-entered attribution/context key. |

Use one authoritative relationship for each fact. Resolve resource IDs against
canonical state on the backend; reject cross-node links, unsupported combinations,
missing/removed references and fields outside the allowlist. Enforce restrictive
foreign keys and the approved canonical uniqueness rules in PostgreSQL, including
concurrent requests on different HTTP replicas. Disabled definitions cannot evade
collisions or be treated as absent dependencies.

A display name is not an Asterisk section name. Generate any required internal
identities from canonical server-owned IDs within a collision-safe namespace;
keep them distinct from managed/unmanaged endpoint identifiers. Do not accept raw
contexts, `sourceKey`, watch identities, tenant IDs, runtime readiness flags or
arbitrary PJSIP/configuration text. Reject control characters and configuration
injection. Later compilers must consume typed canonical facts, never concatenate
untrusted form text into instructions.

Exact G-01 source selectors and G-02 DID matching must not permit two definitions
to claim the same inbound source ambiguously. This is desired-definition conflict
validation; trusted runtime attribution and routing still belong to P3-U4/P4/P5.

## Save, edit, retry and removal behavior

List/detail reads are bounded, passive, protected primary-database reads with
no-store responses. An offline PBX does not prevent safe desired CRUD when
PostgreSQL and session authority are healthy. It cannot establish runtime
absence or justify a removal requiring live dependency evidence.

Create uses an operator/action-scoped immutable intent and normalized fingerprint.
Persist the safe receipt/result with the business change and actor audit. Same
intent/payload replay returns its original result; changed reuse conflicts, and
concurrent duplicates commit one business effect and one audit. Document receipt
lifetimes and expired-attempt behavior using the established conventions. A lost
commit response is uncertain; recover with the same intent or canonical review.

Edits and desired status changes require the expected resource version and any
relevant referenced version/capability revision. Revalidate relationships under
the same locks used by competing edits/removals. Stale writes conflict; canonical
no-ops do not manufacture a change. A changed association or authentication
selection must invalidate any affected desired verification qualification; it
cannot inherit future applied/readiness evidence from the old version.

Each mutation commits business data, required receipt, version changes and safe
actor-attributed audit atomically. Audit or constraint failure rolls everything
back. Required postcommit effects use the existing durable outbox/job mechanism;
saving definitions performs no network probe, secret fetch, registration, PBX
write, reload or call. Do not add queued work without an actual approved consumer.

Removal must inspect a complete dependency result and return bounded actionable
blockers. At minimum consider resource-to-resource references owned here; future
ring groups/rules, tenant bindings and applied/in-flight/known-good rollback
references remain with their owners. Do not cascade-delete DIDs, clear ownership,
or remove a referenced credential generation to make removal succeed.

Use narrow transaction-aware dependency ports; define coverage and unknown
explicitly. An absent later module is not evidence that applied/live dependencies
are absent. Never-applied, unallocated resources can be removable only when
canonical provenance and complete checks establish that fact under G-04.
Otherwise reject as dependency-unavailable or blocked with safe recovery guidance.
Do not introduce future allocation, route, call or revision tables to fabricate
these facts. Consumer ports and fixtures must identify their verified boundary.

Competing reference creation and removal must serialize: either the reference
commits and removal fails, or removal commits and the new reference fails.
Structural edits follow the same safeguards where changing a referenced fact
would invalidate dependencies. Removal retains required audit/history and a safe
replay outcome under G-04. It never claims that live traffic stopped or a provider
number was released. Live retirement and active-call changes require P3-U5 policy.

## Secrets and external access

Store only approved opaque references and exact non-secret version metadata.
Do not copy material, provider paths, tokens or raw configuration into desired
records, receipts, audit/outbox, logs/errors, URLs, DTOs or browser recovery state.
Return sanitized reference availability, never a secret or a provider exception.

Management credentials, staff passwords, endpoint secrets and trunk/provider
credentials are separate authorities. G-03 must identify the protected owner and
binding validation; HTTP/web/ordinary workers gain no provider token through this
spec. An existing reference may be selected through safe server-owned aliases;
arbitrary secret paths and client-declared existence are insufficient.

If G-03 requires external preparation/validation, define its approved runtime
boundary, bounded deadlines, durable ordering, idempotency and interruption/
cleanup behavior before implementation. Keep provider calls outside business
transactions and publish a configured association only after the approved exact
binding is established. Preserve uncertain effects for reconciliation; failure
cannot return a false configured result. This conditional work may justify an
additional child as described in the split review.

Saving or changing a desired credential reference never proves Asterisk uses it
or that an old credential was revoked. Existing passive endpoint observations
cannot qualify a new trunk generation or prove carrier connectivity.

## Platform browser journey

1. From PBX detail, open the node's trunks/gateways/DIDs area. Inspect paginated lists and detail pages with desired status, relationships and version; empty catalogs explain how to create definitions.
2. Create a valid trunk and gateway under the approved relationship policy, then a DID using eligible ingress choices. Show validation at the relevant field and preserve safe entered values on rejection.
3. Inspect and edit permitted fields or desired status. Referenced choices are node-qualified, reloadable and revalidated at commit. Stale conflicts require canonical reload/review rather than overwrite.
4. Request removal with an explicit affected-resource confirmation. Show concrete blockers or unavailable dependency checks without losing the current work. A successful removal updates canonical lists/detail according to G-04.
5. Review the saved desired result and the explanation that routing, apply/verification and tenant readiness follow later. Do not label a desired save as connected, applied or ready.

Reuse shared dark tokens, form/table/dialog primitives, accessible labels/errors,
keyboard controls, focus restoration, text statuses and narrow-width reflow.
Include loading, empty, unavailable, conflict, uncertain and retry states. Keep
resource desired state separate from passive node health. No trunk/gateway/DID
runtime status is inferred from endpoint contact counts or desired enablement.

Extend only named method/resource allowlists in the existing HTTPS forwarding
boundary; Next owns no authority, database access, PBX connector or secret access.
All reads/writes validate current backend platform authority and node/resource
scope. Enforce existing cookie channel, trusted peer, Origin/CSRF, request limits
and no-store behavior. Staff and public callers cannot access these surfaces.

Retain only non-secret mounted work for the same canonical operator and resource
workflow. Authority loss hides protected data and blocks submission; explicit
same-operator reauthentication can restore safe mounted work. Logout/foreign
identity clears it; full refresh has no durable draft guarantee. Fence late
callbacks by authority/workflow epoch. No automatic write replay, browser storage
or passive polling that renews the session. Uncertain creates retain their exact
intent; uncertain edits/removals require canonical review before another action.

## Acceptance and required verification

| ID | Observable result and required evidence |
| --- | --- |
| AC-01 | Applicable G-01–04 decisions are recorded before dependent implementation; resource/relationship/default/secret/lifecycle contracts and ownership handoffs are explicit. No future routing/allocation/apply feature is implied. |
| AC-02 | Valid trunks and gateways can be created, read and edited against real PostgreSQL/runtime grants. Invalid kinds, connection combinations, source conflicts, cross-node/dangling links and unknown fields reject. Disabled state preserves required identity. |
| AC-03 | DID create/read/edit follows approved exact normalization and collision scope. Equivalent numbers collide as specified, allowed separate scopes remain distinct, and concurrent duplicate creation cannot bypass database constraints. Unsafe or ambiguous ingress rejects. |
| AC-04 | Version conflicts, reference-edit races, duplicate/same-intent replay, changed-intent reuse, expired intents, lost responses and audit/constraint rollback have deterministic safe results across two HTTP replicas; no partial change or duplicate business audit. |
| AC-05 | Dependency-safe removal succeeds for an eligible unused resource and rejects referenced/allocated/applied/rollback-dependent or safety-unknown resources. Removal versus reference creation races preserve integrity. Audit/history/replay survive according to G-04; no cascade or live revocation claim. Distinguish real owned dependencies from future-owner contract fixtures. |
| AC-06 | Approved credential reference selection/binding and safe missing/unavailable states work without exposing material or expanding process permissions. Any approved external flow passes duplicate, interruption, uncertain effect and reconciliation checks at its real provider boundary. |
| AC-07 | Unauthenticated, staff/cross-plane, revoked/expired, forged-field and cross-node requests reject at API and proxy. CSRF/origin/channel and no-store checks pass; shared-session outage denies protected operations on both replicas. |
| AC-08 | Saves remain desired-only: PBX offline does not block safe desired operations, and no save invokes PBX writes, reloads, registration, calls or tenant readiness. Existing passive node observation remains independently qualified; no unsupported resource-health claims. |
| AC-09 | Actual browser trunk/gateway/DID create/detail/edit/status/removal paths pass validation preservation, blocker feedback, stale/uncertain recovery, same/foreign-operator expiry, logout, late callback isolation, keyboard/focus/status and narrow-width checks. No automatic mutation replay. |
| AC-10 | Credential sentinels and forbidden raw configuration/provider details are absent from responses, snapshots, receipts, audit/outbox, logs/errors, URLs, client assets and retained browser work. Unknown-key/configuration injection attempts reject. |
| AC-11 | Integrated AC-01–10 and affected PBX/inventory/auth/durable regressions pass. Operator/dependency/recovery guides, owner contracts, docs index and tracker retain reproducible commands, environment, fixture cleanup, limitations and P3-U4/U5/P4 handoffs. |

At implementation, add one short combined required-check command following the
existing selection-script convention. Proposed name:
`./dev exec pnpm check:pbx-resources`; it does not exist yet. Child modes must
prove their declared foundation or browser boundary without pretending to finish
the parent. Record the actual command before claiming completion.

Use real PostgreSQL with runtime grants, shared Redis and two HTTP replicas for
constraints, transactional authority, retries and race checks; use the actual
secure platform browser for the user journey. Deterministic barriers and injected
faults may prove documented races/response loss, with fixture limits recorded.
If an external secret flow is approved, real provider evidence is required for
that boundary. No live call or reload is needed to prove desired-state management.
Do not alter the controlled PBX merely to demonstrate CRUD.

Run affected existing `check:pbx-nodes`, `check:extension-inventory`,
`check:platform-auth` and `check:durability` procedures in their documented modes,
then `./dev check` for implementation. Record exact commands/results and restore
owned fixtures without disturbing existing resources. Missing required policy,
provider access or dependency evidence keeps its affected implementation
incomplete. For this documentation-only task, review consistency and local links;
application tests do not establish specification correctness.

## Review and adopted implementation sub-units

**Review conclusion: split P3-U3 into three sequential sub-units.** Trunk/gateway
configuration establishes the ingress foundation; DIDs add a separate identity
and collision policy plus dependency-sensitive lifecycle. The protected browser
then composes both into the required operator outcome. These are independently
verifiable increments under the workflow's foundation-unit exception. Keep
security, audit, concurrency and failure checks with each owning child, followed
by parent reconciliation in the last child. The user adopted this split on
2026-10-16 (Asia/Manila, +08:00); all children remain planned.

| Unit | Starting state and implementation boundary | Expected result / verification | Parent criteria owned |
| --- | --- | --- | --- |
| [P3-U3a — Protected trunk and gateway definitions](p3-u3a-protected-trunk-and-gateway-definitions.md) | Verified P3-U1; rechecked existing P3-U2 patterns; G-01, applicable G-03 and identity/status/edit portions of G-04 resolved. Own typed contracts, schema/grants, canonical connection/source definitions, approved opaque references, list/create/detail/versioned edit/status API, audit and retry receipts. No removal endpoint yet. | Independently verified desired trunk/gateway foundation under real database/session authority; invalid relationships/source conflicts, races, secret exposure and uncertain creation are covered. No browser or live connectivity completion claim. | AC-02/06; trunk/gateway portions of AC-01/04/07/08/10/11. |
| [P3-U3b — DID inventory and dependency-safe resource removal](p3-u3b-did-inventory-and-dependency-safe-resource-removal.md) | Verified a; G-02 and remaining G-04 resolved. Own DID schema/normalization/uniqueness/ingress links, protected CRUD/status, and shared safe-removal behavior for trunks, gateways and DIDs with owner dependency ports and history/replay rules. | Real-database DID equivalence/conflict checks plus unused removal, blocked/unknown dependencies and remove-versus-reference races. Future dependency fixtures prove ports only; unavailable real safety facts remain blocked. | AC-03/05; DID/lifecycle portions of AC-01/04/07/08/10/11. |
| [P3-U3c — Operator resource browser and integrated handoff](p3-u3c-operator-resource-browser-and-integrated-handoff.md) | Verified a/b with applicable gates resolved. Own actual console/proxy workflows, mounted recovery, accessibility, guides and integrated checks. | Operator completes trunk/gateway/DID create/inspect/edit/removal journey; all parent criteria rerun/reconciled with safe cleanup and documented limitations. | AC-09; integrated/browser portions of AC-01/04/07/08/10/11 and reconciliation of AC-02/03/05/06. |

Implement the linked child specs in a → b → c order, rechecking starting state
and applicable gates before each begins. Creating these specs does not start
application implementation or change the implementation plan's dependency order. Parent P3-U3 remains incomplete until
the complete browser journey and all required acceptance checks pass.

**Conditional refinement:** if G-03 requires new secret provisioning/rotation or
provider identities rather than selecting approved existing references, that
external lifecycle is independently verifiable and should become an additional
focused child before dependent resource/browser work. Specify its approval,
ordering, recovery and checks first; do not hide it inside a or treat the endpoint
credential approval as authority. Avoid that extra child when safe existing
reference selection fully satisfies the approved requirement.

Review corrections incorporated:

- Separate DID inventory from inbound routes and tenant ownership; no caller number or entered context grants attribution.
- Leave DID normalization/collision scope explicit rather than importing extension rules or assuming global uniqueness.
- Keep PBX management, endpoint and trunk/provider secret authorities distinct.
- Make dependency coverage, unknown safety facts, races and retained rollback history part of removal acceptance.
- Preserve desired/live separation through saves, disablement, credentials, observations and UI wording.
- Require actual browser completion and per-child integrity checks; no testing-only child substitutes for a working feature.
