# P3-U3a — Protected trunk and gateway definitions

## Status and purpose

- **Status:** in progress from 2026-10-19 (Asia/Manila, +08:00). The user approved both definition and OpenBao reviews; implementation and required evidence remain outstanding.
- **Requirement:** [P3-U3 parent scope, gates and AC-01–11](p3-u3-trunks-gateways-and-dids.md).
- **Goal:** establish canonical desired trunk and gateway definitions through protected, audited, concurrency-safe platform APIs.
- **Completion boundary:** valid definitions and approved opaque credential bindings persist against real PostgreSQL/runtime grants; invalid combinations, ambiguous sources, unsafe references and stale writes reject. Two HTTP replicas prove authority, retries and atomicity. Browser delivery, DID management and resource removal follow in b/c.

Read [AGENT.md](../../../../../../AGENT.md) and its required context before implementation.
The parent remains authoritative for shared requirements and unresolved gates.
This child does not approve PBX control, provider access or pending product policy.

Proposed decisions and approval scope are prepared in the
[draft contract review](../../docs/planning/p3-u3a-definition-contract-review.md).
Both reviews were explicitly approved on 2026-10-19. The [focused lifecycle refinement](p3-u3a-1-isolated-trunk-credential-lifecycle.md) precedes authenticated integration. Concrete compatible deployment profiles and an authorized platform provisioning identity remain prerequisites; full a completion requires real owner/binding evidence.

The [approved completion direction and plan](../../docs/planning/p3-u3a-approved-completion-direction.md)
(2026-10-20) supersedes earlier pending-direction language: independent local
implementation is authorized. The separately approved second named retained capability session passed
all identity and ten-path checks; revocation/403 confirmed, both authorizations consumed
([findings](../../../../../status/p3-u3a-retained-capability-session-2.md)); concrete
retained remediation remains unapproved. The timing amendment remains conditional pending implementation and real
transaction/failure acceptance, as specified in the [trunk contract](../../docs/architecture/trunk-credentials.md#conditional-attestation-timing--not-accepted-for-runtime-use).
A-04 includes that matrix and database finalization revalidation of current business
authority, exact owner/installation/generation, replay protection and 60-second
freshness. No runtime acceptance is implied. Earlier checkpoints follow as history.

The single approved recovery/handoff and endpoint regressions have executed, but
real token-lifetime override failed the maximum contract. The user's follow-up
accepts the corrected complete-array candidate for disposable testing only and
authorizes policy-composition, renewal, concurrency and rootless maintenance design
investigation. [Follow-up evidence](../../../../../status/p3-u3a-disposable-review-followup.md)
records the resulting findings, fixes and rehearsal. Retained remediation remains
blocked, including the separate three-write pre-backup exception. No further root
recovery, retained modification/restart, SIP/PBX activation or deployment is
authorized. This is not completion of the focused lifecycle owner or A-01–07.

The 2026-10-20 follow-up accepts disposable design evidence and authorizes an
original-issuance application-deadline investigation and permitted non-disruptive
verification. The [security rationale](../../../../../status/p3-u3a-security-acceptance-rationale.md)
distinguishes the test-only guard from unimplemented runtime/finalization integration.
The [conditional retained failure/authorization proposal](../../docs/planning/p3-u3a-retained-failure-and-authorization-review.md)
is separate; existing backup authority is unknown and the pre-backup exception
remains unapproved. Provider HTTP 500 and fractional-expiry findings remain open.

## Starting state and decision gates

Require verified P3-U1 and recheck its [integrated evidence](../../../../../status/p3-u1c-evidence.md).
Reuse canonical node/installation identity from the [registry](../../../../../architecture/pbx-registry.md),
existing platform transaction authority, shared sessions, SQL repository patterns,
same-transaction audit and deployment-owned migrations/grants. P3-U2's
[inventory contracts](../../../../../architecture/extension-inventory.md) supply existing
version/retry patterns without making endpoint profiles the authority for trunks.

Resolve these portions of the parent's D-09 decision area before dependent code:

| Gate | Required for a / resume condition |
| --- | --- |
| G-01 | Approve trunk/gateway meanings, kinds and direction, relationship cardinality, supported connection/authentication modes, typed fields/defaults, transport/media compatibility, deployment-controlled destinations and unambiguous trusted-source selectors. Record valid and invalid examples before schema/validation implementation. |
| G-03 | Approve exact opaque reference selection/binding, material owner, version semantics and safe availability status for authenticated definitions. Identify the protected owner that establishes binding without exposing material. Existing endpoint OpenBao approval grants no trunk scope or new process permissions. |
| G-04, a portion | Approve initial desired state, editable versus immutable facts, status transitions and structural-edit dependency safeguards. A later removal policy is not needed to expose a's create/read/edit/status boundary; no removal endpoint is added here. |

G-02's DID policy and b's removal policy remain unresolved without blocking
independent a work whose applicable gates are satisfied. If G-03 needs new secret
provisioning/rotation/provider identities, refine a separate focused lifecycle
child before dependent work, as required by the parent. Do not conceal that
external integration in this foundation or invent an approved reference service.

## Scope and exclusions

Own telephony trunk/gateway contracts, migrations/constraints/grants, pure rules,
SQL repositories, use cases, bounded platform list/create/detail/versioned edit/
status APIs, immutable creation receipts and focused verification/documentation.
Document concrete routes, DTOs, finite errors and request/result/query limits
before consumers are implemented; use existing NestJS/application boundaries.

b adds DID inventory and shared resource removal. c adds the actual console and
named forwarding. P3-U4 owns groups/rules/contexts/attribution; P3-U5 owns revision
compilation, apply/verify/rollback and live retirement; P4 owns tenant allocation
and readiness. No speculative tables for those features, generic config editor,
raw import, live probe/reload/call, discovery/adoption or provider account workflow.
Preserve [working configuration references](../../../../../../reference/asterisk_config).

## Canonical definitions and validation

Persist immutable resource ID and canonical node/installation association,
bounded display name, approved typed settings/relationships, explicit desired
administrative state, optimistic version, timestamps and actor attribution.
Aliases of one installation share its canonical namespace; display labels and
remote addresses cannot create alternate installation identity.

A trunk records the approved purpose/direction, connection/profile configuration,
authentication mode and required opaque credential reference/version. A gateway
records its approved kind, connection/source definition and any trunk relationship
required by G-01. Do not impose a universal gateway-to-trunk relationship before
that policy is decided. Retain reproducible selected settings/versions; changing
reusable configuration cannot silently change existing definitions.

Resolve every relationship against canonical node-qualified state. Reject missing,
removed, wrong-node or incompatible resources, invalid capability revisions and
unknown fields. Enforce approved uniqueness/source conflicts and restrictive
foreign keys in PostgreSQL, including disabled definitions and races. Distinguish
permitted shared-provider definitions from ambiguous ingress using G-01 examples.

Never accept tenant allocation, staff identity, caller-ID-based source authority,
route destination, raw contexts/directives, `sourceKey`, observed health or applied/
ready status as writable facts. Generate required internal runtime identifiers
from server-owned identity in a collision-safe namespace, distinct from endpoint
inventory and unmanaged objects. Reject control characters and configuration
injection rather than accepting arbitrary SIP URLs or configuration fragments.

## Mutations, concurrency and failure behavior

Creates use an immutable operator/action-scoped intent and canonical fingerprint.
One transaction commits resource/relationships, safe original receipt and actor
business audit. Same key/payload returns the original safe result; changed reuse
conflicts. Define receipt lifetime, expiry and post-pruning behavior before coding.
A dropped commit acknowledgment is uncertain: exact-intent retry or canonical
review recovers it, never a new creation presumed safe from an error response.

Edits/status changes require expected versions and current selected reference/
capability qualifications. Revalidate canonical operator authority and dependencies
on the existing transaction handle. Serialize competing relationship/status/setting
changes; stale versions reject and canonical no-ops do not add a business audit.
Changes advance versions atomically with audit. Audit or database failure leaves
no partial definitions, binding changes or successful receipts.

Provide b narrow transaction-aware read/lock/dependency contracts for these
resources, including current version and eligibility. Establish one lock order
for node, affected resources and relationships; b must use it for DID references
and removal. Structural changes whose safety requires unavailable dependency
facts reject. Do not implement an always-empty dependency adapter or future
allocation/revision schema. Future verification consumers must qualify the exact
desired versions rather than retain readiness after changed settings.

Reads are bounded/paginated, passive and no-store. PBX outage alone does not block
safe desired operations. Database/session failures deny protected work with safe
retryable outcomes. No mutation issues a network probe, secret fetch, PBX write,
registration, reload or call. Required external work, if separately approved, uses
committed durable intent and the existing queue; no speculative queued consumer.

## Credential and access boundaries

Use only G-03-approved opaque references/versions or safe server-owned selection
aliases. Reject arbitrary provider paths, submitted credentials and client claims
that material exists. Binding must be established by the approved protected owner;
HTTP/Next/ordinary workers receive neither material nor provider tokens. A safe
selection is not proof of live registration, activation or old-secret revocation.

Keep PBX management, staff, endpoint and provider/trunk credentials distinct.
Missing or unavailable binding has a sanitized explicit result under G-03 and
must never return falsely configured. Material, tokens, provider paths and raw
configuration are excluded from desired rows, DTOs, receipts, audit/outbox,
logs/errors, URLs and future browser state. No reveal or rotation endpoint here.

Every API checks current platform authority, node/resource qualification and the
existing channel/Origin/CSRF rules. Sensitive writes revalidate authority in their
transaction. Staff/public, revoked/expired sessions and forged ownership fields
reject on HTTP A/B. Shared Redis failure cannot fall back to replica-local state.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| A-01 | Applicable G-01/G-03/G-04 decisions, typed DTO/routes, limits, finite errors, receipt retention and b/c handoffs are documented; no invented policy, provider permissions or future-unit implementation. | AC-01 |
| A-02 | Real PostgreSQL/runtime grants support trunk/gateway create/read/edit/status with exact audit and versions. Valid relationship examples work; unsupported combinations, ambiguous source conflicts, disabled-identity bypasses, cross-node/missing references and injection reject, including concurrent replicas. | AC-02; AC-10 input |
| A-03 | Concurrent duplicate creation/same-intent replay has one effect/audit; changed reuse and expired intents reject safely. Lost responses recover; stale edits, referenced-setting races and audit/constraint rollback preserve atomicity and canonical no-op semantics. | AC-04 |
| A-04 | Approved exact reference selection/binding and missing/unavailable results work with safe outputs/process isolation. Endpoint/management authority cannot be reused implicitly. No false configured, activated or revoked result. Any separately approved external boundary has required real-provider evidence. | AC-06/10 |
| A-05 | Real sessions and two HTTP replicas prove platform-only authority, CSRF/origin/channel/no-store, wrong-node/forged/staff/revoked/expired denial and database/Redis outage behavior. Reads stay passive and bounded. | AC-07 |
| A-06 | Offline PBX permits safe desired CRUD; saved settings/status create no live effects or unsupported health/readiness claims. Transaction-aware version/dependency ports are verified for b; unknown structural-edit safety rejects. | AC-08; AC-02 integrity |
| A-07 | Focused real-service checks, affected PBX/inventory/auth/durable regressions and full Docker graph pass. Contract/runbook/evidence/index/tracker record actual commands, cleanup, limitations and remaining b/c. | AC-11 scoped |

During implementation establish the proposed selection
`./dev exec pnpm check:pbx-resources --definitions`; this command does not exist
yet and has no passing result. Use real PostgreSQL/runtime grants, shared Redis
and independent HTTP A/B, deterministic race barriers and explicit response-loss/
audit-failure fixtures. Record real versus injected boundaries and cleanup.

Run affected existing documented PBX, inventory, platform auth and durability
checks plus `./dev check`. No PBX modification or live call is required for this
foundation. Documentation-only preparation requires consistency/link/whitespace
review, not runtime checks. Missing required policy/access keeps dependent a
implementation incomplete; do not mark the parent complete from API delivery.

## Handoff

b receives canonical IDs, versions, eligibility, transaction-aware relationship
locks, safe DTO/error/retry contracts and dependency checks. c receives protected
APIs and canonical uncertainty recovery. Record implemented interfaces in their
owner documentation before either consumer starts; do not let consumers query
telephony tables or infer authority from browser selections.

## Approved contract amendment — 2026-10-19

The user's approval adopts U3A-01–05 and the OpenBao review's exact decision.
Outbound digest and separate optional outbound registration are desired dimensions,
subject to a concrete reviewed profile. Registration requires digest, exact registrar,
realm, algorithm and protected registration identity; fixed timing is 3600/60/10
seconds/seconds/retries with permanent auth rejection. No automatic downgrade.
Explicit expected-version credential adoption is allowed; other structural facts
remain immutable. Exact references include binding/generation UUIDs, ordinal,
material version 1 and expected owner revision. Owner qualification expires after
60 seconds by database time. Canonical association, eligibility and qualification
remain separate, with `not_required`, `missing`, `unavailable`, and `bound` summaries.

A-04 is replaced by section 8 of the approved OpenBao review, including real
import/qualification, claim/adoption, ACL/process isolation, interruption/retry,
cleanup races and retained history. A-01/02/03/05/06/07 are extended there too.
Approval does not satisfy these checks. No authenticated success is exposed until
the focused lifecycle owner and compatible profile are implemented and verified.
