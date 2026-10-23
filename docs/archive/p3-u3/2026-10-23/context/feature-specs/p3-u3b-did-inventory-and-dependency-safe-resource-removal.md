# P3-U3b — DID inventory and dependency-safe resource removal

## Status and purpose

- **Status:** planned; child specification prepared 2026-10-16 (Asia/Manila, +08:00), in the user-adopted a → b → c sequence. No implementation or policy approval is claimed.
- **Requirement:** [P3-U3 parent scope, gates and AC-01–11](p3-u3-trunks-gateways-and-dids.md).
- **Goal:** manage canonical DID inventory and enforce safe desired removal of DIDs, trunks and gateways without breaking resource dependencies or retained history.
- **Completion boundary:** protected DID creation/read/edit/status and eligible resource removal work under real database/session authority. Canonical collisions, invalid ingress, reference/removal races and safety-unknown dependencies reject with safe actionable results. Browser completion belongs to c.

Read [AGENT.md](../../../../../../AGENT.md) and its required context before implementation.
The parent owns shared behavior and unresolved policies. Removal is a desired
lifecycle action, not evidence that Asterisk or a carrier released a resource.

## Starting state and gates

Require verified [P3-U3a](p3-u3a-protected-trunk-and-gateway-definitions.md), its
actual evidence, protected trunk/gateway APIs, canonical identity, transaction
lock/version/dependency ports, audit/retry conventions and safe credential boundary.
Recheck applicable [registry](../../../../../architecture/pbx-registry.md) and current
platform authority; no direct cross-owner database access is introduced.

| Parent gate | Required for b / resume condition |
| --- | --- |
| G-01 | a's approved relationships must define eligible DID ingress and its cardinality. Resolve any outstanding DID-specific association ambiguity before persistence. |
| G-02 | Approve accepted syntax, canonical forms, national/international/plus/leading-zero behavior, lengths, exact matching, duplicate scope across installations/providers/trunks/gateways and disabled/removed identities. Record examples of equivalent collisions and legitimate distinct scopes. |
| G-04, remaining portions | Approve DID defaults/edits/status, disable versus removal, retained identity/history/reuse, dependency blockers and unavailable-fact behavior. Define removal retries and visibility after removal. Unknown required safety facts deny destructive changes. |

G-03 retains a's exact approved credential boundary; b does not expand it. DID
normalization is not inherited from extension numbering or a caller-ID parser.
Do not decide global uniqueness, wildcard matching, soft versus physical deletion
or number reuse by convenience. Record scoped decisions before dependent code.

## Scope and ownership

Own DID contracts/schema/constraints/grants, repositories/use cases, protected
list/create/detail/versioned edit/status APIs and dependency-aware removal for all
three resource types. Extend a's transaction ports only as needed for real DID
references and safe lifecycle. Own focused real-service checks and documentation.

c delivers the actual browser/proxy journey. P3-U4 owns routes/destinations,
patterns/precedence and trusted attribution; P3-U5 owns compiler/revisions/live
apply/rollback/retirement and active-call policy; P4 owns tenant allocation and
readiness. Do not add their tables, a carrier API, live test-call tooling,
automatic reassignment, cascaded ownership clearing or raw configuration editor.

## DID identity and ingress

Persist immutable internal identity, canonical node/installation association,
canonical called number and optional display form, explicit approved ingress
relationship, desired status, optimistic version, timestamps and actor attribution.
Allowed changes and identity reservation after removal follow G-02/G-04. Moving
an identity to another installation is not an ordinary field edit.

Apply one approved normalization function at all write/lookup boundaries. Validate
before fingerprinting and persistence; display formatting never determines
uniqueness. Enforce approved collision scope with PostgreSQL constraints under
concurrent replicas, including disabled/removed records where policy retains
reservation. Cross-node/provider examples must use approved genuine scopes,
not aliases that duplicate one installation's namespace.

Resolve ingress IDs and versions against canonical a resources. Enforce approved
node, kind, direction, status and relationship eligibility; reject dangling,
removed, wrong-node, incompatible or ambiguous ingress. Restrictive foreign keys
and shared transaction locks protect these facts beyond application previews.
Multiple DIDs on an ingress are allowed only as approved by G-01/G-02.

A DID is inventory, not a tenant binding, inbound destination or trusted call
source by itself. Reject tenant ownership, endpoint/staff assignments, route
contexts, attribution keys, caller-ID trust, raw directives, wildcard routes and
client-declared applied/ready fields. No DID save creates an operational route.

## DID mutations and retry behavior

Reuse a's operator/action-scoped creation intent/fingerprint/receipt semantics
and documented lifetime/expired-intent behavior. Equivalent approved number forms
must fingerprint consistently. Same intent/payload returns the original result;
changed reuse conflicts. Same intent must not create multiple DIDs or audits
across replicas or after a lost response.

Edits/status changes revalidate expected versions, ingress eligibility and current
platform authority under a's lock order. Competing association changes, trunk/
gateway structural changes and removal serialize. Stale edits reject; no-ops do
not create business changes. Required identity/relationship/version/audit/receipt
writes commit together; audit or constraint failure leaves no partial change.

List/detail reads are bounded, paginated, passive and no-store. Never synthesize
reachability or registration from saved DIDs, desired enablement or endpoint
contact observations. PBX outage alone permits safe desired operations; unknown
required live dependency facts still block unsafe removal or structural edits.

## Dependency-safe resource removal

Before removal, resolve canonical target/version and operator authority, then
obtain transaction-consistent dependency coverage. A prior UI preview is advisory.
Check at least these categories through their actual owners:

| Category | Required treatment |
| --- | --- |
| P3-U3 resource relationships | Inspect actual DID-to-ingress and gateway/trunk links. Referenced parents cannot be removed; disabled children still count. No implicit cascade or detachment. |
| Route/group/configuration consumers | Use typed owner ports when these consumers exist. Missing implementation or unavailable coverage is not proof of zero dependencies. |
| Tenant reservations/allocations | Preserve future canonical ownership; never clear a tenant binding or reinterpret shared infrastructure as unowned to allow removal. |
| Applied/in-flight/known-good rollback and credential dependencies | Retain any referenced resource/history and exact protected generations. a/b do not manufacture P3-U5 revision facts or destroy secret material. |
| Active calls and external state | Use only approved authoritative safety facts where required by G-04. Offline/stale observation cannot prove no active calls; live drain/defer belongs to P3-U5. |

Dependency results distinguish complete-empty, complete-blocked and unknown/
unavailable, with bounded safe blocker details. Count truncation is explicit;
never interpret a truncated result as complete. Do not leak secret references,
raw configuration or unrelated tenant data in errors.

Never-applied, unallocated desired resources can be eligible only where approved
canonical provenance and complete checks prove that boundary. Define this narrow
case in G-04 and evidence; future-owner fixture adapters do not prove actual live
safety. Unknown dependencies reject the action without erasing the definition.
Do not create a parallel calls/allocations/revision store to make checks pass.

Use a's resource locks and restrictive constraints so reference creation and
removal cannot both commit an invalid result. Either a new reference commits
and removal conflicts, or removal commits and the reference fails. Apply the
same protection to structural edits that invalidate references. Document lock
ordering and prove races with deterministic barriers, not timing assumptions.

Successful removal records operator, exact target/version and safe outcome with
required history/audit/retry state atomically. Define repeated-removal and uncertain
response behavior under G-04: an exact original retry can recover its committed
outcome; changed intent/version cannot remove a replacement resource. No silent
success on an unqualified missing target. Never claim live revocation, carrier
release or freed number identity beyond the approved desired lifecycle.

## Security and failure behavior

All endpoints use current platform authority and existing channel/Origin/CSRF/
no-store rules. Enforce node-qualified resource access and transaction authority
for writes. Staff/public, forged fields and revoked/expired sessions reject across
two replicas. Database/Redis outage denies protected work safely; failed dependency
checks return bounded retryable or blocked outcomes without any partial removal.

DIDs and ingress selections do not expose raw PBX configuration or secret material.
Keep credential sentinels/provider details out of rows, DTOs, receipts, audit/outbox,
logs/errors and URLs. No network probe, credential fetch, call, reload or readiness
mutation follows a save/status/removal. Future live apply consumes committed
canonical desired state under P3-U5, not effects triggered in these HTTP requests.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| B-01 | Applicable G-01/G-02/G-04 decisions, normalization/collision examples, DID DTO/routes/bounds, removal/history/retry rules and owner coverage are documented before code. No future policy or schema is invented. | AC-01 |
| B-02 | Real PostgreSQL/runtime grants support valid DID create/read/edit/status. Equivalent forms collide in approved scopes, valid separate scopes coexist, and disabled/removed reservation rules hold. Wrong-node/missing/removed/incompatible/ambiguous ingress and injection reject. | AC-03; AC-10 input |
| B-03 | Same-intent/concurrent duplicates have one effect/audit; changed/expired reuse, stale versions and lost responses recover safely. Ingress changes and audit/constraint failures preserve atomicity. | AC-04 |
| B-04 | Eligible unused DID, trunk and gateway removal succeeds with audit/history/replay preserved. Actual owned references block removal; unknown/truncated/unavailable safety coverage blocks as specified. Future-owner fixtures are explicitly qualified; no cascade, secret destruction or live-revocation claim. | AC-05 |
| B-05 | Deterministic remove-versus-reference and structural-edit races preserve constraints, expected versions and lock ordering. Audit/dependency/database failures commit no partial removal; exact lost-response retry cannot affect a replacement identity. | AC-04/05 |
| B-06 | Real two-replica platform sessions prove authority, CSRF/origin/channel/no-store, cross-node/staff/forged/revoked/expired denial and session outage behavior. Safe output checks pass; passive/offline CRUD adds no live effects or health/readiness assertions. | AC-07/08/10 |
| B-07 | Focused DID/removal checks, a regressions, affected PBX/inventory/auth/durable checks and full Docker graph pass. Contract/runbook/evidence/index/tracker identify commands, cleanup, limits and c/P3-U4/U5/P4 handoffs. | AC-11 scoped |

During implementation establish proposed
`./dev exec pnpm check:pbx-resources --did-lifecycle`; this command does not exist
yet. Verify constraints/transactions with real PostgreSQL/runtime grants, shared
Redis and two HTTP replicas. Use real resource relationships and deterministic
barriers; label fault injections and future-owner fixtures. Retain evidence of
complete safety coverage for actual successful removals. Unknown coverage is a
required rejection result, not permission to skip checks.

Run a and affected existing documented PBX/inventory/platform auth/durability
checks plus `./dev check`. No live PBX mutation or operational call is required.
Documentation preparation uses consistency/link/whitespace review only. b can be
complete within this declared desired-state boundary without claiming live
retirement; parent completion still requires c's actual browser and reconciliation.

## Handoff

c receives stable DID and removal DTOs, bounded dependency/blocker outcomes,
version/intent recovery semantics, eligible ingress reads and exact removal
visibility rules. Later owners must implement compatible transaction-aware
reference/dependency checks before using these resources; fixture contracts do
not substitute for real allocation, routing, apply or active-call safety.
