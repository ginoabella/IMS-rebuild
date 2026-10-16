# P3-U2 — Manage extension inventory and endpoint profiles

## Status and purpose

- **Status:** completed 2026-10-16 within conditional private-development approval; a A-01–07, b B-01–07, c C-01–07 and parent AC-01–11 reconcile in [final integrated evidence](../../docs/status/p3-u2c-evidence.md). Live application, production and tenant calling readiness remain separate.
- **Requirement:** [Phase 3, P3-U2](../implementation-plan.md#p3-u2--manage-extension-inventory-and-endpoint-profiles), [platform requirements](../project-overview.md#platform-and-asterisk-administration), and [telephony architecture](../architecture.md#telephony-architecture).
- **Goal:** let a platform operator create and maintain individual and bulk SIP/WebRTC extension inventory, endpoint profiles and protected credential references before tenant reservation.
- **Completion boundary:** the protected browser journey persists valid inventory and profile choices, performs the approved credential setup/reset flow, and displays desired state separately from trustworthy registration observations. Unallocated or disabled inventory confers no tenant calling or staff assignment authority. Saving never installs or reloads Asterisk configuration.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
This document specifies intended behavior. The [tracker](../progress-tracker.md)
and implementation evidence record delivery; proposals below do not approve
missing product policies or expand existing PBX control permissions.

## Starting state and dependencies

P3-U1 and its a/b/c children are verified complete within conditional development
registry/observation scope. Recheck [integrated evidence](../../docs/status/p3-u1c-evidence.md)
and the actual owner interfaces before coding.

Reuse:

- Canonical PBX node and immutable installation identity from the [registry](../../docs/architecture/pbx-registry.md). Connectivity aliases and display names are not separate number namespaces.
- The independent telephony process, database ownership/fencing port and bounded passive PJSIP projection from [observation](../../docs/architecture/pbx-observation.md). Its AMI allowlist grants no provisioning or reload capability.
- Current platform authority, shared sessions, secure cookies, CSRF, no-store responses, narrow forwarding and operator-bound mounted recovery from the [browser contract](../../docs/architecture/pbx-browser.md).
- Same-transaction actor audit, explicit transaction handles, and existing durable execution for any required postcommit work. Do not create a second queue, secret store or assignment source of truth.
- Existing database deployment/migration ownership, runtime grants and shared UI primitives.

At specification preparation, telephony code owned registry/connectivity and observation only; shared
PBX DTOs expose bounded endpoint identifiers and contact counts. Neither existing
observations nor reference files establish canonical inventory, ownership,
credential lifecycle or verified endpoint profiles. P4-U1a draft tenants already
exist but are not an input requirement for inventory creation.

## Working Asterisk reference

The user supplied [reference/asterisk_config](../../reference/asterisk_config/)
as a working configuration reference on 2026-10-15. It informs compatibility
examples, not an import, deployment instruction or replacement for canonical
PostgreSQL desired state. Preserve the files unchanged in this unit.

| Reference | Relevant structure and intended use |
| --- | --- |
| [pjsip.conf](../../reference/asterisk_config/pjsip.conf) | Numbered SIP endpoints use related `auth`, `aor` and `endpoint` sections; examples allow `ulaw`/`alaw`, one contact, NAT helpers and disabled direct media. Numbered WebRTC examples add WS transport, `opus`, ICE, AVPF, RTCP multiplexing and DTLS media settings, with five contacts. Use these as candidate profile examples, subject to the gates below. |
| [http.conf](../../reference/asterisk_config/http.conf), [rtp.conf](../../reference/asterisk_config/rtp.conf), [modules.conf](../../reference/asterisk_config/modules.conf) | Inform deployment compatibility for signaling, media and available modules. HTTP listeners, public addresses, certificates and transport installation remain deployment/P3-U5 concerns. |
| [extensions.conf](../../reference/asterisk_config/extensions.conf) | Contains shared local routing, recording and gateway/public ingress examples. These are not safe tenant-isolation defaults; routing and attribution belong to P3-U4/P4-U2/P5-U3. |
| [manager.conf](../../reference/asterisk_config/manager.conf), [voicemail.conf](../../reference/asterisk_config/voicemail.conf) | Do not copy credentials, access rules, mailboxes or permissions. Existing observation approval is unchanged; voicemail is outside P3-U2. |

Reference endpoint numbers are examples, not allocations or reserved product
ranges. Public-mobile ingress and trunk sections are not staff extensions and
must not become inventory through discovery. Never reproduce passwords, private
addresses, provider paths or raw configuration in DTOs, audit, logs or this spec.
The reference's shared `local-users` context must not be assigned automatically
to newly created unallocated endpoints. Its WS/DTLS choices do not establish an
approved production signaling/certificate policy or the later browser calling flow.

## Scope and exclusions

Own extension/profile domain contracts, module-owned SQL constraints/grants,
protected individual/bulk creation and desired-edit APIs, credential setup/reset
metadata and the approved secret-provider integration, bounded list/detail reads,
platform screens, explicit inventory-to-observation mapping, checks and guides.

P3-U3 owns trunks/gateways/DIDs. P3-U4 owns groups, dial rules, reserved routing
patterns and generated contexts. P3-U5 owns configuration revisions, compiler,
diffs, validation, installation/reload, verification, rollback and external
stale-owner fencing. P4-U2 owns reservations/tenant allocation, P4-U5 staff
assignment, and P8-U8 browser calling and client credential delivery. Do not
implement their tables or mutation workflows speculatively here.

No raw configuration editor/upload/import, arbitrary PJSIP directives, automatic
discovery-to-inventory creation, live apply, operational calls, extension deletion,
PBX-number moves, recording/voicemail management or production-readiness claim.
Disable preserves identity, uniqueness and history; it is not deletion or release
of a number for reuse.

## Decisions required before dependent implementation

Use the existing D-09 telephony decision area; resolve only the portions needed
here. The user owns product-policy approval. Routine routes, SQL layout, bounded
pagination and adapter composition follow existing conventions.

| Gate | Required contract | Affected work and resume condition |
| --- | --- | --- |
| G-01 — Number and profile policy | Allowed number syntax/length and leading-zero equivalence, permitted ranges/exclusions, approved SIP/WebRTC profile fields/defaults, supported transports/codecs/contact behavior and node compatibility. Decide whether profiles are reusable across nodes or node-scoped. Reference settings above are candidates, not approved defaults. | Before dependent validation/schema/profile behavior: record the scoped policy and examples, including equivalent-number collisions and invalid profile combinations. Bulk request bounds must be documented and validated; no capacity target is inferred. |
| G-02 — Endpoint credential lifecycle | Approved generation or supplied-reference flow, secret provider and write/read identities, handoff to phones, rotation/versioning, old-secret retirement, retry retention and abandoned-material cleanup. Decide explicitly whether any one-time secret delivery is required and through what protected channel. | Before credential implementation: record a reviewed contract and provision protected access. Existing P3-U1 exact-file observation lookup is not a writable endpoint-secret service. Staff account password/setup policy is not a SIP credential policy. No credential reveal or browser password-entry flow is implicitly approved. |
| G-03 — Runtime identity and coexistence | Trusted generated endpoint/auth/AOR naming, mapping to observations, treatment of unmanaged existing PBX identifiers, and compatibility with the approved controlled installation. Existing runtime entries must not be overwritten or adopted merely because a number matches. | Before runtime mapping/acceptance: document mapping and collision/coexistence checks against the reference and controlled target. Resolve an ambiguous namespace before claiming usable inventory. Missing live visibility blocks the dependent check, not independent registry work. |

The user conditionally approved [inventory review Sections 2–4](../../docs/planning/p3-u2a-inventory-contract-review.md)
on 2026-10-15 for controlled private development: G-01 number/profile policy and
the G-03 generated namespace portion are resolved for a. This includes the initial
1000–899999 convention (future shorter municipal plans require explicit revision),
node-scoped immutable profiles, removeExisting=false, generated identities and
disabled/unallocated/unset stock. Production transport/media and contact recovery
need separate review. G-02/b, c’s live mapping/coexistence and P3-U5 apply remain
separate. A desired save grants no credentials, readiness or calling eligibility.
See the [implemented API/transaction contract](../../docs/architecture/extension-inventory.md).

The [c runtime mapping and controlled acceptance review](../../docs/planning/p3-u2c-observation-mapping-contract-review.md) sections 2–6 and G03-01–06 were conditionally approved by the user on 2026-10-16 for the existing private development installation. Its explicit preservation, exclusive-access, baseline, recovery and cleanup conditions apply. Approval does not complete acceptance.

No answer is needed to prepare this spec. Resolve the applicable gate before
implementing its dependent behavior; record the decision and affected child in
the tracker. Routing/reload/active-call policy remains with its owning later units.

## Inventory and endpoint profile contracts

An extension has an immutable ID and PBX-node identity, canonical number,
SIP/WebRTC kind, validated profile reference/version, desired administrative
status, credential reference/version metadata, optimistic version, timestamps
and actor attribution. Credential material is absent. New inventory has no tenant
or staff association and can be saved with credentials not yet configured.

Enforce number uniqueness across the entire canonical PBX node, across both
endpoint kinds, all profiles and disabled rows. Equivalent aliases of the same
installation must not create a second namespace. The same canonical number on
two genuinely distinct PBX nodes is permitted. Validate canonicalization before
persistence and enforce uniqueness in PostgreSQL; application-only checks cannot
resolve concurrent duplicates. Reject client-selected ownership, readiness,
registration state, generated runtime keys and arbitrary route/context fields.

A profile defines an allowlisted, typed endpoint behavior, not arbitrary Asterisk
text. Validate kind/transport/media/codec/contact combinations and node support.
Node management transport and endpoint signaling transport are separate concepts.
Deployment-controlled network addresses, certificates, secrets and tenant route
contexts are not profile form values. Internally generated identifiers must be
safe for eventual rendering; reject configuration/section injection.

Profile references must remain reproducible: retain an immutable selected profile
version, or an equivalent auditable snapshot without secrets. Editing a reusable
profile must not silently change existing extensions. Describe affected records
and require explicit versioned adoption if an update is offered. Referenced
profiles cannot be removed; profile deletion is not required here.

Model distinct facts rather than one overloaded status:

| Dimension | Required meaning |
| --- | --- |
| Inventory availability | Available means unallocated platform stock, not ready for calls. Reserved, tenant-allocated and assigned are sourced from their future canonical owners, never writable flags here. P3-U2 creates no such associations. |
| Administrative status | Enabled/disabled desired state, independent of ownership; a disabled row retains its number and any future ownership history. Disabling desired state is not proof of immediate PBX revocation. |
| Credentials | Unset/configured or a sanitized pending/failure state as needed by the approved provider contract; metadata never reveals material. Configured means protected desired credential reference exists, not that Asterisk uses it. |
| Configuration/readiness | Saved desired configuration is not applied/verified. This unit cannot set voice-ready or fabricate an applied revision. Later readiness must qualify the exact desired/profile/credential versions. |
| Runtime registration | Current/stale/historical/unknown/unregistered observations, qualified by coverage, node version, epoch and freshness. Registration grants no tenant authority. |

Do not add allocation/assignment tables solely to display future states. Keep the
read contract extensible through explicit owner ports; test future invalid-state
contracts with identified fixtures rather than pretending allocation is delivered.

## Individual, bulk and concurrent mutations

Individual create and bounded bulk create share one validation and persistence
path. Bulk input expands into a deterministic explicit set of canonical numbers;
the approved number policy governs range/leading-zero behavior. Provide a review
of numbers, endpoint kind and profile before commit. Reject malformed, excessive,
overlapping or duplicate input with bounded actionable errors.

Use atomic bulk creation: any invalid item, existing PBX-wide collision, stale
profile or audit failure creates no inventory from the request. A preview is
advisory; commit revalidates against canonical state and database constraints.
Concurrent overlapping requests yield one valid committed set and a safe conflict
for the other, with no partial request or orphan profile/reference relationships.
Do not automatically skip collisions or allocate a different number.

Persist actor-attributed audit in the same transaction as each business change.
A bulk event may describe the bounded affected IDs/count rather than unbounded
payloads; it must identify the committed set without secrets. Required outbox
intent commits atomically, and no PBX mutation is triggered by saving.

Create/bulk/credential actions need scoped durable intent IDs and canonical
fingerprints: same operator/key/payload returns the committed result; conflicting
reuse rejects; two replicas cannot create duplicate business effects or audit.
Document receipt lifetimes/expired-intent behavior before implementation. Version
edits and disable/re-enable actions using expected versions. After an uncertain
response, retry the same immutable intent or reload/review canonical state;
never replay changed input or announce that nothing committed.

Restrict P3-U2 edits to its unallocated inventory. Guard against new dependencies
at mutation time through the owning contract as later units arrive; never clear
foreign ownership or assignment to make an edit succeed. Desired disable/reset
on an already live resource must not claim immediate disconnection. Dependency-
and active-call-aware live effects remain gated on P3-U5/P4 policy.

## Credential setup and reset

Keep endpoint credentials separate from staff passwords and PBX management
credentials. Desired records, revision metadata, retry receipts, audit/outbox,
URLs and browser state contain opaque references/versions only. No shared default
password or password derived from the extension number is permitted.

Setup associates approved protected credential material with the exact extension;
reset creates a new credential generation and advances the desired version with
actor audit. Duplicate requests must not silently generate multiple rotations.
Existing registration observations cannot prove the new generation is active.
Old-runtime revocation and new-secret activation are live-apply outcomes, not
consequences of the desired save. UI copy must state this explicitly.

For secret-provider writes outside PostgreSQL, specify recoverable ordering:
prepare protected material under an idempotent operation identity, commit only a
usable reference plus audit, and reconcile an interrupted/uncommitted preparation
under G-02 cleanup rules. A provider failure cannot return a falsely configured
record. An audit/database rollback cannot orphan an active reference or expose
prepared material; prove cleanup/retry behavior at the chosen provider boundary.
If the approved flow uses existing references instead, verify existence and
access through the protected server port without returning material.

Only the required runtime process resolves material. HTTP/UI receives safe
status, never PBX administrator secrets or long-lived endpoint passwords under
this spec. Any necessary recipient handoff requires G-02's explicit delivery
contract; do not reuse staff-account setup tokens or introduce browser calling.

## Observation mapping and unallocated isolation

Join observations only through the approved exact node/installation and trusted
runtime endpoint mapping. Do not infer inventory or tenant ownership from a
number, contact, caller ID or reference section name. Preserve unknown/unmanaged
facts as unmapped; do not adopt existing reference endpoints automatically.

Reuse P3-U1 freshness/coverage rules and passive reads. A fresh complete covered
snapshot can establish an endpoint's observed presence/absence. Missing coverage,
a partial snapshot, lost ownership, disconnected PBX or stale projection yields
unknown/historical/stale information, not a false unregistered or ready state.
Observation age and node status stay visible independently of desired changes.

Unallocated inventory must have no tenant route, staff assignment, calling token
or tenant credential access. All relevant P3-U2 reads/mutations remain platform-
only, and readiness/assignment eligibility contracts deny unallocated/disabled
records even if a matching runtime endpoint registers. No endpoint is provisioned
into the reference's shared calling context as a side effect of creation.

P3-U2 proves isolation for its own surfaces, eligibility ports and absence of live
provisioning. Controlled target inspection must show newly saved inventory did
not install a usable endpoint/route. This is not proof of PBX-wide enforcement
against arbitrary manually configured endpoints. P3-U5 and P4-U2/P4-U5 must prove
live default-deny rendering, tenant routing and assignment rejection when those
capabilities exist; retain those checks explicitly in the handoff.

## Protected API and operator browser journey

Provide platform list/detail, individual/bulk creation, desired edits,
disable/re-enable, profile management/selection and approved credential actions.
Use existing canonical platform guards on every backend/proxy boundary; tenant
staff sessions, revoked/expired sessions and forged client authority grant none.
Apply existing CSRF/origin/channel, no-store, bounded body/result and narrow named
forwarding rules. Session-service failure denies access; PBX outage leaves valid
desired-state management usable with explicit unavailable observations.

The actual platform browser must support:

1. Choose a canonical PBX and inspect paginated inventory with number/kind/profile,
   administrative and ownership state, credential metadata and observed freshness.
2. Create one extension or review and commit a bounded bulk set. Preserve non-secret
   fields on validation/conflict and identify the exact committed result.
3. Inspect/edit desired settings and manage profiles without silently updating
   dependent extensions. Show conflicts with reload/review rather than overwrite.
4. Run approved credential setup/reset and disable/re-enable, distinguishing saved
   intent, pending live application and observed registration. Keep future tenant
   reservation/assignment actions unavailable until their owners are delivered.

Use shared dark tokens/primitives, clear labels/status text, visible focus,
keyboard navigation, responsive reflow and loading/empty/error/retry states.
Announce bulk errors and results accessibly. Preserve mounted unfinished work
only for the same canonical operator; expiry hides protected values and blocks
writes, foreign identity/logout clears them, and passive polling cannot renew
sessions. Never retain secrets in recovery state or browser storage, and never
automatically replay a mutation after reauthentication.

## Acceptance and required checks

| ID | Observable result and required verification |
| --- | --- |
| AC-01 | Document the approved applicable gates, safe contracts, number/profile rules, reference mapping and future-unit boundaries. No speculative allocation/routing/apply schema or PBX control adapter is introduced. |
| AC-02 | Individual SIP/WebRTC create/edit and profile selection persist against real PostgreSQL/runtime grants. Canonical number uniqueness holds across kinds/profiles/disabled stock, installation aliases and concurrent replicas; distinct nodes may reuse a number. Unsafe input/profile combinations and stale edits reject. |
| AC-03 | Bulk preview/commit works; duplicate/range/bound/collision/audit failures create no partial inventory. Overlapping races, same-intent replay, conflicting reuse and lost committed responses have deterministic bounded results and one business audit. |
| AC-04 | Profile versioning is reproducible; editing a shared profile cannot silently alter existing inventory. Invalid kind/transport/media combinations and unsafe references reject; referenced-profile removal is denied if exposed. |
| AC-05 | Approved credential setup/reset changes only the intended desired generation with audit; unset/provider failure, concurrent/duplicate reset, database/audit rollback and interruption recover without false configured status or uncontrolled material leaks. Old live credential revocation is not falsely claimed. |
| AC-06 | Platform-only API/proxy/browser authority, CSRF/origin/channel and no-store checks pass across two HTTP replicas, including tenant staff, revoked/expired authority, forged fields and shared-session outage. |
| AC-07 | Unallocated/disabled records cannot be assigned or obtain tenant route/credential/calling access through owned contracts. Runtime registration cannot override denial; disable retains number/history. No live endpoint/route appears from a desired save. Missing future enforcement is explicitly assigned to P3-U5/P4 rather than simulated as complete. |
| AC-08 | Exact trusted observation mapping uses controlled Asterisk and existing fenced projection; reference/unmanaged identifiers remain unmapped. Fresh complete absence differs from uncovered/partial/stale/historical data. Desired/profile/credential edits grant neither registration nor readiness; offline PBX does not prevent safe desired management. |
| AC-09 | Credential sentinels are absent from DTOs, raw-config responses, audit/outbox, desired/revision metadata, receipts, logs/errors, URLs, client bundles and recovery state. Secret-provider access respects the approved process boundary and cleanup policy. |
| AC-10 | Actual browser individual/bulk/profile/edit/credential/disable paths pass validation/conflict/uncertainty recovery, same/foreign-operator expiry, logout, keyboard/focus/status and narrow-width reflow checks. No automatic replay or passive session renewal. |
| AC-11 | Integrated AC-01–10, affected registry/observation/auth/durable regressions and full Docker graph pass. Guides, owner contracts, docs index, safe evidence and tracker record commands, environment, limits and explicit P3-U4/U5/P4/P8 handoffs. |

The implemented combined `./dev exec pnpm check:extension-inventory` procedure
passed, including inventory, real-provider credentials and actual browser checks. Run real database
constraints/transactions under runtime grants, shared Redis, two HTTP replicas,
the actual secure platform browser and controlled Asterisk passive observation.
Use deterministic barriers/fault fixtures for race and response-loss contracts;
mark injected/provider-fixture results separately from real provider/PBX checks.
New inventory need not register before P3-U5 applies it. Live observation may use
explicitly authorized isolated existing fixtures without modifying shared routes.

Run affected `check:pbx-nodes` and auth/durable checks in their documented modes,
then `./dev check`. Required evidence must identify the exact commands and results,
fixture ownership/cleanup and limitations. No production changes or reloads are
authorized by verification preparation. Missing required controlled observation
or credential-provider access keeps the dependent child/parent incomplete.

Final runtime results, requirement reconciliation, documentation checks and exact
cleanup/restoration are recorded in the [integrated evidence](../../docs/status/p3-u2c-evidence.md).

## Review and adopted implementation sub-units

**Review conclusion: split into three sequential sub-units.** Inventory and bulk
atomicity form a coherent database/API foundation. Credentials add an independent
external secret lifecycle and recovery boundary. The final child delivers the
operator journey and trustworthy observation presentation across those contracts.
Keep each child's failure/security tests with that child; do not defer correctness
to a testing-only unit. The user adopted this split on 2026-10-15 (Asia/Manila,
+08:00). The linked child specs define sequential implementation; a is complete under conditional approval; b is complete under conditional private-development approval with [B-01–07 evidence](../../docs/status/p3-u2b-evidence.md); c is complete under the user’s conditional G-03 approval dated 2026-10-16, with [integrated evidence](../../docs/status/p3-u2c-evidence.md).

| Unit | Starting state, scope and expected result | Parent criteria owned |
| --- | --- | --- |
| [P3-U2a — Protected inventory, profiles and atomic bulk creation](p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md) | Verified P3-U1; G-01 and the namespace portion of G-03 resolved. Own schema/constraints/grants, immutable profile selections, individual/bulk API, versioned edits/disable, audit/idempotency and eligibility denial. Credentials may remain unset. Real-service foundation is independently verifiable; no browser/credential completion claim. | AC-02–04; inventory portions of AC-01/06/07/09/11. |
| [P3-U2b — Protected endpoint credential lifecycle and recovery](p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md) | Verified a; G-02 resolved. Own setup/reset ports, approved provider integration, safe metadata, version/intent fencing, rollback/interruption cleanup and protected credential-action API. Prove desired credential lifecycle without live apply or browser handoff assumptions. | AC-05; credential portions of AC-01/06/07/09/11. |
| [P3-U2c — Operator inventory browser and integrated handoff](p3-u2c-operator-inventory-browser-and-integrated-handoff.md) | Verified a/b; remaining G-03 mapping/access resolved. Own actual browser/proxy workflows, passive observation join, mounted recovery, accessibility, operator guide and combined evidence. Rerun every parent criterion before claiming P3-U2 complete. | AC-08/10; integrated/browser portions of AC-01/06/07/09/11 and final reconciliation of AC-02–05. |

Implement the linked children in a → b → c order, rechecking their starting states
and applicable gates before each begins. Shared criteria require both the owner
checks and integrated verification. Child completion cannot substitute
for the browser journey or approve pending credential/profile policy.

Review corrections incorporated:

- Treat reference SIP/WebRTC settings as compatibility examples; do not copy shared routes, credentials or public ingress into platform inventory.
- Separate availability, disablement, credentials, registration and applied readiness; no status flag fabricates tenant ownership.
- Enforce PBX-wide canonical uniqueness and atomic bulk retries under concurrency, including disabled inventory.
- Retain profile/credential versions so desired edits cannot silently change dependencies or reuse old readiness evidence.
- Resolve endpoint-secret storage and handoff explicitly; existing read-only management-secret lookup does not authorize provisioning.
- Keep unallocated access denial testable now while assigning future live routing, revocation and staff-assignment proof to their actual owners. This avoids a circular dependency on P3-U5/P4 and an unsupported claim of live PBX isolation.

## P3-U2b conditional development approval — 2026-10-16

The user approved [G02-01–10 and sections 2–6](../../docs/planning/p3-u2b-credential-contract-review.md)
for controlled private development: private persistent verified-TLS OpenBao,
generated material, a dedicated worker, no recipient delivery, retained associated
generations and bounded recovery/cleanup. Production, phone delivery/revelation
and live PBX application remain separately gated. b passed B-01–07 and is complete within the approved development scope. See [current evidence](../../docs/status/p3-u2b-evidence.md).
