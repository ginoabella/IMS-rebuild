# P4-U1b — Complete tenant onboarding configuration

**Status:** Children 1/2 complete within approved private development; child 3 planned; three-child split adopted 2026-10-26 (Asia/Manila, +08:00). Child 1 A-01–07 and child 2 B-01–07 passed on 2026-10-27/28 (+08:00); parent acceptance remains incomplete.
**Prepared:** 2026-10-26 (Asia/Manila, +08:00).
**Parent:** P4-U1 — Deliver tenant registry and onboarding.

## Requirement and outcome

Implement [P4-U1b in Phase 4](../implementation-plan.md#p4-u1b--complete-tenant-onboarding-configuration).
A signed-in platform operator finds an existing draft, resumes its saved detail,
edits its organization configuration, explicitly selects voice behavior, and
uses the existing initial-administrator credential handoff. Refresh or another
HTTP replica returns the committed configuration. The tenant remains draft;
credential readiness and configured voice preference confer no operational access.

Sources: [project overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow rules](../ai-workflow-rules.md),
and [current delivery state](../progress-tracker.md). This spec refines delivery;
user-approved ONB-01/03 policy is recorded below, while unresolved recommendations remain unapproved.

## Starting state and dependencies

- P4-U1a is verified complete: atomic draft/first-administrator creation, immutable
  normalized code, bounded list/detail, canonical operator audit, durable creation
  replay, and protected browser recovery. Reuse the
  [registry API](../../docs/architecture/draft-tenant-registry-api.md) and
  [browser contract](../../docs/architecture/draft-tenant-browser.md).
- P2-U4 is verified complete within its declared browser/native boundaries. The
  tenant detail already composes `AdministratorCredentials`; setup/reset/status,
  cancellation, explicit reissue and recipient exchange exist. Reuse the
  [approved credential policy](../../docs/planning/p2-u4a-credential-contract-review.md)
  and [implemented lifecycle](../../docs/architecture/qualified-credential-lifecycle.md).
  Do not rebuild credential issuance or add another setup mechanism.
- Phase 3 is complete within approved private development; see
  [P3-U5c evidence and handoff](../../docs/status/p3-u5c-evidence.md).
  This establishes infrastructure administration, not tenant voice readiness.
- Shared transactions/audit, platform sessions, protected admission, UI primitives,
  PostgreSQL/PostGIS and deployment-owned migrations already exist. Tenant records
  have row and authority versions; the tenancy repository has a versioned rename
  capability, but this does not establish an operator edit workflow.
- ONB-01/03 are resolved for child 1 name/contact writes by explicit user approval
  below; ONB-02 geography is also approved in its dedicated section. Recheck prerequisite
  evidence and actual interfaces at implementation start.

## Scope and ownership

| Boundary                 | Allowed work                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform console         | Extend `/tenants` and `/tenants/<UUID>` with search/filter, saved configuration, draft editing, voice preference and integrated administrator setup feedback. Reuse creation/navigation and the protected owner-bound shell. |
| Platform backend         | Orchestrate declared registry reads and configuration commands under canonical `platform_operator` authority; extend named HTTP consumers and bounded DTOs. Preserve immutable initial-administrator provenance.             |
| Tenancy                  | Own organization identity, contacts, voice preference and edit eligibility through narrow owner ports. Reuse immutable code and compatible row-version behavior.                                                             |
| Locations                | Own service-area/default-coordinate validation and canonical PostGIS persistence behind owner ports. Platform orchestration must not write neighboring tables directly.                                                      |
| Identity                 | Retain all administrator eligibility, setup/reset, action state, hashing, budgets and exchange policy. Consume its existing safe status and command interfaces.                                                              |
| Contracts and migrations | Add only the fields, constraints, indexes and runtime grants needed for these consumers. Use additive, deployment-owned migrations preserving existing drafts and receipts.                                                  |
| Verification and docs    | Focused real-service/browser checks, affected regressions, operator guide, downstream configuration contract and tracker evidence.                                                                                           |

P4-U2 owns PBX selection, inventory reservation/allocation, capacity/ranges,
route bindings and verified tenant routing. P4-U3 owns activation, suspension,
retirement and their access/routing effects. P4-U4 owns general staff/role changes.
P5-U4/U5 own intake drafts, map search, caller-location fallback and correction.
No incident UI, tile/geocoding integration, public intake, delivery service,
background cleanup, new infrastructure or general administrator replacement is
included. Geography authoring may require an additional approved provider decision
if the selected workflow actually uses a basemap or external search.

## Product decision gates

The [D-07 location recommendations](../../docs/planning/p1-u1-product-contracts.md#7-d-07--intake-location-and-drafts)
remain recommendations. Do not treat their presence as approval. Record resolved
policy in the authoritative context and link it from the tracker before coding.

| Gate                                        | Decision needed and recommended starting point                                                                                                                                                                                                                                                                                                                                                                     | Dependent work / resume condition                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ONB-01 — Contacts                           | Approve the contact fields, requiredness, bounds and intended use. Recommend one optional organizational contact with name, email and phone, without a directory, delivery or verification workflow. Specify validation and clearing semantics.                                                                                                                                                                    | Contact schema/form/DTO. Resolved for child 1 by the approved ONB-01/03 policy below.                                                                           |
| ONB-02 — Geographic contract | Resolved by user approval on 2026-10-28 (+08:00): prepared administrative/barangay GeoJSON uploads, operator ownership confirmation, optional WGS84 area/defaults, exact bounds and PostGIS containment rules under the [approved policy](../../docs/planning/p4-u1b-2-geography-policy-review.md). | Geography schema/authoring/intake handoff follows this exact contract; no external provider is used. |
| ONB-03 — Edit eligibility and voice changes | This unit guarantees draft onboarding. Recommend permitting its configuration mutations only while draft; keep other statuses readable and defer their mutation policy. Confirm whether name/contacts must also be editable outside draft.                                                                                                                                                                         | Configuration writes/status-race checks. Name/contact writes resolved as draft-only below; no implicit active-tenant or voice mutation is approved.                                                           |

Coordinate checks must at minimum reject non-finite or out-of-range values,
incomplete pairs and silent axis swapping. The recommended WGS84 limits are
longitude [-180, 180] and latitude [-90, 90]; final storage/containment rules follow
ONB-02. Do not invent a default location for existing tenants.

## Operator journey and behavior

### Find and resume a tenant

Extend the existing bounded registry with text search over code/display name and
an exact lifecycle-status filter. Use trimmed, case-insensitive literal matching;
escape query wildcard characters and parameterize SQL. Keep stable UUID ordering,
existing default page size 25 and maximum 100, validated query bounds and an
indexed/bounded access strategy. Changing search/filter resets pagination and
invalidates delayed results from the old selection. Omitted new query parameters
preserve the existing list behavior. Test empty search, combined filters,
no matches, invalid status, Unicode and pagination without claiming a frozen
snapshot across separate page requests.

Open the canonical detail rather than creating another draft or administrator.
Show immutable code, editable display name, lifecycle, contacts, geography,
voice preference and safe credential state. Missing configuration is visibly
incomplete. Initial-administrator provenance absent from older/nonreceipt tenants
stays unavailable; never infer a replacement from username, role or row order.

### Edit saved configuration

Provide explicit section saves with clear saved/unsaved/pending/error feedback.
Display name follows existing trim and 1–200 UTF-16-unit validation. Code is
read-only and rejected as a mutation field by the server. Reject unexpected
fields, client actor/tenant authority, lifecycle changes and overlength bodies.
Contacts and geography follow their resolved gates; define omitted versus cleared
values explicitly. A coordinate pair saves or clears atomically, never one axis.

A section save commits its owner changes, version advancement, required audit and
retry outcome together. Saving another section must not erase previously saved
fields. Before committing, recheck canonical operator authority, target status and
expected configuration versions. Concurrent stale edits return a conflict and
preserve local input for explicit reload/reconciliation. Follow existing lock
ordering, including platform issuer before tenant and tenant before staff;
coordinate geography locks consistently with the owning tenant transaction.

Reuse the canonical tenant row version for coordinated changes where practical;
if geography has an owned version, return/check the complete required version set.
Configuration edits do not silently change authentication authority versions or
invalidate credential actions. Verify compatibility with P2-U4's tenant-authority-version
and eligibility checks rather than promising unverified behavior.

Retried writes must not duplicate committed changes or audit. Use the existing
operator-scoped durable attempt pattern where compatible: bind a request ID to
actor, target, section, expected versions and canonical input. A confirmed same
attempt returns its saved outcome; changed input or another operator cannot adopt
it. If a later edit exists, present the recovered outcome separately from freshly
loaded current detail. Keep new edit receipts distinct from immutable creation
provenance and document grants/recovery without adding a cleanup policy.

Unavailable or lost responses leave the outcome uncertain. Preserve the captured
attempt, block replacement submissions and provide explicit original retry or
canonical reconciliation; never replay writes automatically after reconnect or
reauthentication. Audit failure rolls the whole section back. A failed contact or
geography save does not undo earlier successful section saves or credential work.

### Record explicit voice preference

Represent draft voice preference as **not configured**, **voice enabled**, or
**voice disabled**. Existing drafts/new P4-U1a creations start not configured;
absence must never be interpreted as explicit opt-out. The operator explicitly
chooses enabled or disabled. Show persisted preference independently of tenant
lifecycle, PBX apply/verification and credential state.

Saving enabled creates no allocation, apply, test result or readiness. Saving
disabled creates no activation or routing teardown. Downstream P4-U2/U3 consume
the canonical explicit preference and their own readiness/lifecycle rules.
No client-submitted `ready`, `active` or PBX binding can be accepted here.

### Complete the existing administrator handoff

Keep the P2-U4 issuer panel attached to the exact canonical detail/tenant and its
receipt-linked administrator. Refresh safe credential/action status after
exchange or explicit reload, without changing unrelated unsaved configuration.

Initial setup applies to the eligible unset administrator. Ready credentials use
only the approved linked recovery/reset rules. Reuse all purpose/status/role,
issuer/target version, pending-action and shared-budget checks. Suspended/retired,
disabled or unlinked targets remain denied under the existing policy.

Every issue/reissue retains the approved person-verification acknowledgment and
finite method. Contact edits do not establish verified identity or authorize
automatic code delivery. Hand codes directly using the existing approved process;
operators never choose or see the recipient's password. One-time codes remain
transient disclosure only, clear on owner/access loss and never enter retained
forms, URLs, logs, browser storage, receipts or ordinary detail DTOs. Lost issuance
uses safe status and explicit verified reissue, not configuration-write replay.

Recipient exchange remains on the existing clean HTTPS credential page. A ready
draft still rejects ordinary staff sign-in with `Invalid credentials` and creates
no staff session. Setup, configuration and activation have distinct outcomes.

## Security, consistency and presentation

All backend reads/writes require the existing platform-cookie plane and canonical
`platform_operator` permission. Tenant administrators cannot use these consumers.
Apply exact Origin, trusted proxy/source, CSRF for mutations, shared protected
admission and bounded bodies/queries at both Next and backend boundaries. Extend
only named consumers; document exact methods, DTOs and limits before coding.
Keep existing create/list/detail consumers compatible and safe-return paths literal
unless a deliberately bounded extension is required and tested.

Reads are passive and no-store; polling cannot renew sessions. Declare actual
configuration saves as operational activity under the delivered expiry policy.
Retain 400 field errors, 401 expiry, 403 authority/forgery denial, 404 missing target,
409 version/attempt/eligibility conflicts, 429 bounded limits and retryable 503
unavailability. Credential consumers keep their existing response contracts.
Canonical disabled/version races must not commit under stale operator authority.

Extend existing owner-bound mounted work with both canonical operator and target
UUID plus epoch/version capture. Same-owner reauthentication may retain nonsecret
inputs/attempts; owner replacement/logout clears them. Changing tenant cannot
apply late callbacks or retained values to another tenant. Access loss hides
protected data and focus. Unsaved mounted values are not durable drafts; reload
recovers committed state only. Use the shared dark UI, labeled inputs, keyboard
operation, visible focus, accessible errors/status feedback and narrow reflow.

Audit uses the canonical platform actor, target UUID, correlation and bounded
change kinds/field identifiers. Do not copy contact values or raw geometry into
logs/audit/receipts merely to describe a change. Canonical contacts/geography stay
in their owner storage; receipt input fingerprints are not plaintext copies.
No external effect is needed for these saves; add no speculative job or outbox.

## Acceptance and required verification

| ID    | Observable acceptance and required proof                                                                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Real operator searches by code/name, combines status filters, paginates, opens a retained draft and resumes it after refresh/another replica. Existing unfiltered behavior remains compatible; stale search results cannot replace current results.                                                                                                |
| AC-02 | Browser changes name and approved contacts, saves and reloads canonical values. Immutable code and unexpected fields reject server-side; invalid input preserves values and accessible feedback. Unset configuration stays explicit.                                                                                                               |
| AC-03 | Approved service area/defaults round-trip through real PostGIS and protected detail. Reject malformed/oversized/invalid geometry, wrong SRID/axes, incomplete/non-finite/out-of-range coordinates; test zero values, boundaries, clearing and the approved outside-area rule. No fabricated defaults.                                              |
| AC-04 | Explicit enabled/disabled preferences persist distinctly from not configured across new and existing drafts. None grants allocation, verified readiness, lifecycle transition or staff access; configuration fields cannot forge those states.                                                                                                     |
| AC-05 | Two HTTP replicas race section updates and status/authority changes. Stale versions cannot overwrite; different sections preserve saved values. Required audit, geography and receipt failures roll back the entire attempted save under actual runtime grants.                                                                                    |
| AC-06 | Inject response loss/uncertain commit and concurrent same-attempt retries: one logical change and audit, safe recovered outcome, changed-input/foreign-operator conflict. No automatic write replay or duplicate credentials. Earlier successful sections survive later failures.                                                                  |
| AC-07 | Existing issuer and recipient browser journey sets the linked administrator's credentials, refreshes safe status and retains unrelated configuration. Exercise expired/used/cancelled actions, explicit reissue, uncertain disclosure/exchange and approved ready-draft recovery. Passwords/codes never leak; contacts do not bypass verification. |
| AC-08 | Draft credentials ready or unset both deny ordinary staff sign-in; no configuration or exchange activates a tenant or produces PBX effects. Verify eligibility/status races against the approved ONB-03 and P2-U4 policy.                                                                                                                          |
| AC-09 | Direct backend and Next deny absent/expired/staff/forged authority, foreign target/action combinations, invalid CSRF/Origin/proxy and malformed/unbounded requests. Redis/database outages fail closed with safe retry feedback and no partial saves.                                                                                              |
| AC-10 | Expiry/reauthentication, logout/owner switch, target switch and delayed callbacks preserve same-owner nonsecret work only and isolate targets. One-time disclosures clear. Keyboard/focus, 320–1440px reflow, loading/empty/conflict/failed states and relevant accessibility checks pass.                                                         |
| AC-11 | Existing P4-U1a create/list/detail/replay remains verified, including immutable linked administrator, unset new credentials and explicit incomplete defaults. Publish exact configuration/intake/voice handoff, operator instructions, commands/results/limitations and tracker state. Parent P4-U1 completes only after combined a/b acceptance.  |

Add a focused real-service selector following existing `check:draft-tenant` and
`check:staff-auth` conventions, with API/browser/combined boundaries. Its exact
name/flags are an implementation deliverable, not an existing runnable command.
Use an isolated migrated PostgreSQL/PostGIS database with actual runtime grants,
shared session Redis, independent HTTP replicas and production Next/private HTTPS.
Wire required coverage into the owning check graph and retain exact fixture cleanup.

Required implementation regressions include `./dev exec pnpm check:draft-tenant`,
`./dev exec pnpm check:staff-auth --lifecycle`, affected identity/session/platform
checks, and final `./dev check`. Implement geography checks against real PostGIS;
fixtures prove declared boundaries only. No live Asterisk mutation/call or new
native-device acceptance is required for this configuration unit. Production HA,
map/search providers, actual intake fallback and operational activation remain
unverified until their owners perform the required work.

## Review and adopted sub-unit implementation

**Conclusion:** Split into three sequential vertical increments. Registry editing,
geographic configuration and credential/voice integration have distinct acceptance
boundaries; geography also has an unresolved product contract. Each increment
includes its own contracts, persistence where needed, backend, browser journey,
checks and documentation. A schema-only/API-only/UI-only split would postpone the
usable result and is not recommended.

| Unit                                                                                                                            | Goal and implementation boundary                                                                                                                                                              | Dependencies and result                                                                                                                                                           | Parent coverage                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [P4-U1b-1 — Resumable registry editing and contacts](p4-u1b-1-resumable-registry-editing-and-contacts.md)                       | Search/filter, detail/edit name and approved contacts; shared versioned save/retry/authority behavior. Preserve code and existing credential panel.                                           | Completed prerequisites; ONB-01/03 approved for name/contact fields below. Operator finds, edits and reloads one draft, including A/B conflict and lost-response recovery.                   | AC-01/02/05/06/09/10/11 for delivered fields.     |
| [P4-U1b-2 — Service area and default intake coordinates](p4-u1b-2-service-area-and-default-intake-coordinates.md)               | Approved geography authoring, PostGIS storage/validation, versioned protected save and safe canonical intake configuration read port. Reuse child 1 edit/recovery conventions.                | Verified child 1 and resolved ONB-02. Operator saves/reloads geography; real PostGIS proves validity/containment/version outcomes and tenant-qualified handoff.                   | AC-03 plus AC-05/06/09/10/11 for geography.       |
| [P4-U1b-3 — Voice preference and integrated onboarding handoff](p4-u1b-3-voice-preference-and-integrated-onboarding-handoff.md) | Explicit voice preference and complete detail composition; reuse/refresh administrator setup, verify recipient exchange and draft denial; combined P4-U1a/b acceptance and downstream guides. | Verified children 1/2, approved edit policy and existing P2-U4 lifecycle. Actual create → find → resume/edit → setup/exchange → reload journey passes while tenant remains draft. | AC-04/07/08 and final AC-01–11 across all fields. |

The user adopted this split and requested the three standalone specs on
2026-10-26 (Asia/Manila, +08:00). Execute children 1 → 2 → 3 sequentially,
recording prerequisite evidence, resolved decisions and the active checkpoint
before each implementation. Children 1/2 are **complete within approved private development**; child 3 remains
**planned**. P4-U1b, parent P4-U1 and Phase 4 remain incomplete. Split approval
itself did not resolve ONB-01–03; the subsequent explicit ONB-01/03 policy below
authorizes child 1 name/contact work.

Review checked scope coverage against Phase 4, existing registry/credential code,
module ownership, immutable provenance, geography policy status, concurrency and
partial-failure behavior. It found no need for another credential system, PBX
changes or activation in this unit. At that review, contact schema, service-area
semantics and non-draft editing remained unresolved. The subsequent explicit policy
below resolves the child 1 contact contract and denies non-draft edits; geography
remains unresolved.

## Approved ONB-01/03 policy — 2026-10-26 (+08:00)

The user explicitly approved the proposed policy in this implementation session.
ONB-01: one optional organizational contact with independently optional name,
email and phone. Trim all values. Name is 1–200 UTF-16 units; email is a valid
email address up to 254 units; phone is 1–50 units, uses digits, spaces, `+().-`
and contains at least one digit. Omitted fields preserve their committed values;
null or blank clears. Partial contacts are allowed and visibly incomplete.
Contacts are informational only: no identity verification or delivery authority.
ONB-03: name/contact configuration saves are draft-only. All other lifecycle
statuses remain readable. No non-draft edit or lifecycle transition is approved.
At the child 1 approval checkpoint, ONB-02 remained unresolved; the subsequent
child 2 approval below resolves it.

## Approved ONB-02 policy — 2026-10-28 (+08:00)

The user explicitly approved the complete
[geography policy](../../docs/planning/p4-u1b-2-geography-policy-review.md).
Platform operators configure draft-only geography by uploading prepared
administrative and optional barangay GeoJSON, reviewing tenant/upload comparison
and explicitly confirming ownership on upload/replacement. Locations owns
canonical SRID 4326 polygonal boundaries, allowlisted metadata and optional
default point. The contract defines exact formats, 4,096 combined positions,
byte/feature/ring/component bounds, PostGIS validity/containment/non-overlap,
clearing, versioning, audit and recovery. It approves this bounded file-import
exception for child 2; no provider, automatic simplification, incident behavior
or tenant-code change is approved. Earlier unresolved ONB-02 references describe
the state before this approval and are superseded by this section.
