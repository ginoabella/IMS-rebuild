# P4-U1a — Draft tenant creation and initial administrator

## Identity, status and requirement

- **Unit:** P4-U1a, Phase 4 — Onboard tenants and enable tenant administration.
- **Status:** in progress at parent level; backend child 1 is verified complete on 2026-10-07 (Asia/Manila, +08:00). Browser child 2 and combined parent acceptance remain pending.
- **Requirement:** [P4-U1a in the implementation plan](../implementation-plan.md#p4-u1a--create-a-draft-tenant-and-its-first-administrator), the approved early-draft delivery exception, and the overview's platform tenant creation requirement.
- **Dependencies:** completed P2-U1, P2-U2, P2-U3, P1-U4 and P1-U5. Recheck their handoffs before implementing. Neither P2-U4 nor Phase 3 is a prerequisite.
- **Result:** A signed-in platform operator creates one retained draft tenant and its first tenant administrator, then sees the saved organization in protected list/detail screens. The administrator has no usable credentials or ordinary staff access.

This spec defines intended behavior. The user adopted the two-child split on
2026-10-07 (Asia/Manila, +08:00); linked child specs define sequential delivery.
P4-U1 remains incomplete until both P4-U1a and P4-U1b are verified. Backend implementation/evidence is delivered by child 1; browser and combined
parent acceptance remain with child 2.

## Sources and starting state

Follow [overview](../project-overview.md), [architecture](../architecture.md),
[UI context](../ui-context.md), [code standards](../code-standards.md),
[workflow](../ai-workflow-rules.md), and [tracker](../progress-tracker.md).
Reuse the delivered [identity storage contract](../../docs/architecture/canonical-identity-storage.md),
[role/admission contract](../../docs/architecture/canonical-authority-admission.md),
[HTTP authority](../../docs/architecture/canonical-http-authority.md),
[platform HTTP authentication](../../docs/architecture/platform-authentication-http.md),
and [browser/work integration](../../docs/architecture/platform-browser-access.md).

At specification preparation, source inspection confirmed:

- Tenancy owns canonical tenants; identity owns tenant-qualified staff. Existing SQL constraints enforce immutable tenant codes/ownership, global code uniqueness, within-tenant username uniqueness, explicit states, and coherent unset credential metadata.
- `platform/application/tenant-registry.ts` is the existing caller-owned registry port. `TenantRepository` and `StaffRepository` already create and audit rows, but no production tenant creation use case, list/detail transport or console workflow exists.
- `Transaction` supplies one connection and commit/rollback boundary. Its execution context has one target: tenant creation requires a tenant target, while staff creation requires a staff target. Passing the same unchanged context to both repositories will fail their target checks.
- `TransactionAuthority.validate` supports canonical operator revalidation under a transaction-held lock. Platform-cookie guards, protected rate limits, exact-origin CSRF, narrow Next forwarding and owner-isolated in-memory work are delivered.
- Existing general staff DTOs omit usernames. A safe administration read port must expose the required username without using the private credential read or exposing hashes.

These are integration inputs, not proof that the requested feature works. Existing
fixtures and the development PBX container do not establish onboarding readiness.

## Scope and ownership

| Boundary | Allowed work |
| --- | --- |
| Backend platform module | Create/list/detail use cases, caller-owned tenant/staff administration ports, safe results, protected HTTP adapters and durable creation receipts. |
| Tenancy and identity modules | Implement narrowly required registry/staff ports against existing canonical rows; maintain domain ownership and explicit state/role rules. |
| Transaction/audit infrastructure | Minimum compatible support for trusted per-write targets on the same transaction, preserving actor, correlation, rollback poisoning and existing callers. |
| PostgreSQL migrations | Only creation receipt/linkage, necessary indexes/grants and changes required by this journey. Reuse tenant/staff tables and constraints. |
| Shared contracts | Domain-grouped create/list/detail DTOs, validation/error shapes and bounded pagination. No private credential types. |
| Platform console | Protected tenant list, creation form, saved detail view, explicit narrow forwarding and owner-bound recovery. |
| Checks and docs | Real database/API/browser verification, operator instructions, contract/handoff, evidence and tracker updates. |

Out of scope: tenant edit/search/filter/contact configuration, service areas,
default coordinates, voice configuration and credential setup integration
(P4-U1b); setup/reset/recovery and staff sign-in (P2-U4); activation/suspension/
retirement (P4-U3); PBX inventory/allocation/routes; staff management; notifications;
public intake; production deployment. Do not add a password field, setup link,
email delivery, credential token, staff session or activation shortcut.

## Operator journey and UI

1. The signed-in operator opens **Tenants** from the protected platform console. Show a bounded, paginated canonical list with organization name, normalized tenant code, lifecycle status and a detail action; include clear loading, empty and retryable error states.
2. **Create tenant** opens a focused form with **Tenant code**, **Organization name**, and **Administrator username**. The username is the first administrator's tenant-qualified login identifier. Personal name/email/phone are not required by this unit or present in its identity store.
3. Explain that the code is permanent, the organization starts as a draft, and administrator credential setup and activation follow later. The action is **Create draft tenant**.
4. Validate without clearing values. Display field errors, focus the first invalid field, and prevent duplicate clicks while pending. Display canonical code/username after save.
5. Confirm only a committed result, then open the saved detail. Display tenant code/name/status, administrator username, fixed `tenant_admin` role and **Credentials not set**. Identify the draft as unavailable for ordinary staff sign-in.
6. Refresh or revisit list/detail and load the committed primary-database state. The detail page has no edit, setup, activate or voice action in this unit.
7. On response loss, retain values and the request identifier; offer explicit retry of the same attempt. Resolve an uncertain attempt before sending edited inputs as a new attempt. An authentication outage/expiry blocks submission and hides protected work. Same-operator reauthentication can resume mounted values; a different operator or confirmed logout clears them. Do not automatically resubmit after reauthentication.

Use delivered dark tokens, shared form/table/status components, accessible names,
keyboard/focus behavior, text statuses and responsive reflow. Reuse
`useOperatorWork()` for non-secret values; namespace/extend it only for this
actual form. Refresh/process loss may discard unfinished inputs, consistent with
P2-U3b; committed drafts remain durable. Persist no session tokens or form data in
browser storage. Extend safe return destinations only for delivered tenant paths,
with tests against external URLs and encoded bypasses.

## Input and canonical state contract

The create DTO contains only `requestId` (a UUID for the attempt), `tenantCode`,
`displayName`, and `administratorUsername`. Bound raw bodies and text before
normalization, reject unknown fields, malformed text and invalid UUIDs. Backend
validation owns the rules; client validation is feedback only.

| Field | Contract |
| --- | --- |
| Tenant code | Existing JavaScript trim and ASCII lowercase; 1–64 canonical characters matching `[a-z0-9][a-z0-9_.-]*`. Globally unique across every tenant status and immutable. |
| Organization name | Nonempty after trim, at most 200 UTF-16 code units, matching the existing storage limit. Persist the trimmed display text; preserve meaningful casing. Reject malformed/control text. |
| Administrator username | Existing trim and ASCII lowercase; 1–128 canonical characters with the same identifier grammar. Unique within the newly created tenant. The same username may exist in another tenant. |
| Request identifier | Non-authoritative UUID reused only for the same logical submission. Never supplies an actor, tenant identity or permission. |

Generate tenant/staff UUIDs on the backend. Creation sets tenant `status=draft`,
staff `status=active`, exactly `roles=['tenant_admin']`,
`credential_state=unset`, `password_hash=null`, and
`credential_changed_at=null`, with existing initial versions/timestamps. Active
here is an explicit account representation; unset credentials and draft tenant
admission still deny ordinary staff authority. Reject client-supplied status,
roles, tenant/staff IDs, actor IDs, passwords and credential metadata.

## Atomic creation, attribution and durable retry

Use one primary PostgreSQL transaction for the following path:

1. Derive the canonical platform operator from the backend principal; revalidate its current authority using the delivered transaction authority lock.
2. Claim or inspect a durable platform creation receipt scoped to `(operatorId, requestId)`. Record a server-derived fingerprint of canonical input, not arbitrary client identity assertions.
3. Insert the draft through the tenancy-owned port and the administrator through an identity-owned, caller-qualified port. Persist their receipt linkage and append actor-attributed audit in the same transaction.
4. Return success only after the outer transaction has confirmed commit. A safe inner repository result is not a commit acknowledgment.

The receipt links the original tenant and administrator IDs, allowing saved detail
and P2-U4 handoff without guessing an administrator from username or creation
time. It records creation provenance, not a second copy of tenant/name/role/
credential truth. Detail reads join current canonical records through module-owned
ports. Receipt ownership stays platform-side; runtime grants remain minimal.
Retain the receipt with its linked draft for reliable recovery; automatic receipt
cleanup/deletion is not introduced here. Later retention policy must preserve
required history and retry guarantees.

| Case | Required behavior |
| --- | --- |
| New attempt, unused normalized code | One tenant, one administrator, one receipt and required audit entries commit together. |
| Same operator/request, identical canonical input | Return the original linked IDs; read current metadata canonically and do not create another administrator or duplicate creation audit. |
| Same operator/request, changed canonical input | 409 conflict; no mutation. Editing after a definitive validation/conflict outcome uses a fresh attempt identifier. |
| Another request/operator, same normalized tenant code | 409 code conflict; never adopt or modify the existing organization. |
| Concurrent identical requests on different replicas | Converge on one committed result through database uniqueness/locking. |
| Concurrent different requests for the same code | One winner; losers leave no partial staff, receipt or audit. |
| Response/commit acknowledgment lost | No success claim or automatic replay. Explicit same-attempt retry resolves the durable outcome, even on another replica. |
| Failed validation, authority recheck, staff insertion, receipt or audit write | No partially created organization. Retry follows its safe outcome; rollback removes all attempt writes. |

Implement a narrow transaction/audit extension or compatible owner adapter that
supports tenant and staff audit targets on the same connection. Targets must be
server-validated and may not replace the authenticated actor/correlation. Do not
use separate transactions, mutate trusted context ad hoc, bypass repository
target checks or insert into a neighboring module's tables from platform code.
Preserve both creation facts and their platform actor in append-only audit; do
not duplicate existing creation events just to add a summary. Audit/log metadata
uses approved bounded identifiers/change kinds, not raw form values, usernames,
passwords, cookies, CSRF proofs or request fingerprints. No external effect needs
a job/outbox in this unit; do not add speculative publications.

## Protected transport and reads

Use named create, list and detail backend consumers. Route names and exact DTO
shapes are routine implementation choices to document before coding. Each
requires the delivered platform-cookie channel, canonical platform principal and
`platform_operator` permission. Tenant staff, even tenant administrators, cannot
use these consumers. Client-selected tenant IDs are resource references under
platform authority, never staff admission authority.

The narrow Next boundary forwards only these declared methods/paths, bounded
query/body fields and existing trusted source/cookie/CSRF headers. Keep
exact-origin, proxy-proof and CSRF checks for creation; neither Server Actions
nor a generic proxy may bypass them. Protected responses and server reads use
`no-store`. Bind async form callbacks/results to the rendered canonical owner.

List uses stable ordering and bounded pagination (default 25, maximum 100), with
validated cursors or page parameters and indexed access. Search/filter is P4-U1b.
Detail returns only required tenant and linked administrator metadata, never
credential hashes or setup/session tokens. Missing valid resource IDs return
404. Tenants without a P4-U1a creation link must not be assigned a guessed initial
administrator; present unavailable administrator provenance explicitly. This does
not add a repair or provisioning workflow.

| Outcome | Required response/presentation |
| --- | --- |
| New committed draft | 201 and safe tenant/administrator result. |
| Confirmed replay | 200 and the original linked result. |
| Invalid fields/body/query | 400 with bounded declared field errors; preserve form values. |
| Duplicate code or request/input conflict | 409 with a safe declared reason; preserve values and recovery context. |
| Missing/expired platform session | 401; block/hide work and use existing reauthentication. |
| Wrong plane/permission or CSRF/origin failure | 403; no read or mutation. |
| Shared protected limit | 429 with bounded Retry-After; no automatic write retry. |
| Database/Redis/authority dependency unavailable or uncertain commit | Retryable 503; no local authority fallback or false success. |

Declare creation as qualifying operational activity; list/detail navigation may
use operational activity under the delivered policy. Passive session checks and
background refreshes remain passive and cannot defeat expiry. Reuse shared
protected admission and existing deadline/rotation behavior.

## Acceptance and required verification

| ID | Observable criterion and proof |
| --- | --- |
| AC-01 | Real operator create/list/detail journey saves a draft and correctly owned first administrator with exactly `tenant_admin`, active account, unset/null credential metadata and initial versions. Verify canonical rows and visible DTOs. |
| AC-02 | Normalize codes/usernames identically to existing contracts; reject malformed/unknown/overlength input. Browser validation preserves values and has keyboard/focus feedback. |
| AC-03 | Global normalized code collision, including non-draft statuses, is rejected. Two new tenants may share an administrator username without sharing staff identity. Codes/ownership remain immutable. |
| AC-04 | Failures at staff, receipt and audit writes roll back tenant/staff/linkage/all attempted audit. Verify same-connection targets and actor attribution with real runtime database grants. |
| AC-05 | Two real HTTP replicas handle identical and conflicting concurrent attempts; one committed tenant/admin pair, exact replay IDs, no duplicate audit, safe changed-input/foreign-operator conflicts. |
| AC-06 | Inject committed response loss and ambiguous commit acknowledgment; explicit same-attempt retry discovers one durable outcome. No browser auto-replay after outage or reauthentication. |
| AC-07 | Direct backend and Next consumers deny absent/expired, wrong-plane, forged actor/status/role/tenant data and invalid CSRF/origin/source. Canonical operator disable/version races cannot commit using stale authority. |
| AC-08 | Refresh/revisit/another replica show saved list/detail from canonical primary state; pagination is bounded. Missing resources and absent creation provenance have explicit safe outcomes. |
| AC-09 | Expiry/outage blocks and hides work; same-owner recovery retains mounted values/attempt, identity switch/logout clears them, delayed callbacks cannot transfer values/results. Session/rotation/activity regressions pass. |
| AC-10 | New drafts grant no ordinary staff admission, credentials, setup token, session, activation or PBX effect. Verify admission through existing canonical ports; future staff sign-in HTTP proof belongs to P2-U4. |
| AC-11 | Operator/audit/docs handoff records tenant-qualified administrator IDs, exact commands/results/limits and P2-U4/P4-U1b/P4-U3 ownership. Protected UI is accessible and clients/logs expose no private credentials or fixtures. |

Implement a focused real-service command following current workspace conventions;
implemented backend selector: `./dev exec pnpm check:draft-tenant --api`. This
selector is verified; child 2 adds browser/combined coverage to the command. It must cover the matrix with isolated PostgreSQL/runtime grants,
real session Redis, independent HTTP processes and production Next HTTPS browser
composition. Wire the owning required check into the project check graph.

Retain relevant identity, audit and platform/session regressions using existing
`check:identity-foundation`, `check:platform-auth`, and
`check:session-foundation` procedures, plus final `./dev check`. Add regression
coverage for any transaction context extension and safe return-path changes.
Record exact implemented flags, environment, outcomes and fixture teardown in
unit evidence. Development two-replica checks do not prove production HA. No live
Asterisk or staff credential lifecycle is required for this unit.

## Review and adopted sub-unit implementation

**Review conclusion:** The scope is cohesive and could be one end-to-end unit.
A two-step split is useful because durable atomic creation and browser recovery
have independently verifiable boundaries. Crossing UI/API/database boundaries
alone does not require a split; no separate migration-only or audit-only child is
recommended. The IDs below extend P4-U1a rather than colliding with P4-U1b.

| Unit | Goal and allowed scope | Starting state / dependencies | Result and required verification |
| --- | --- | --- | --- |
| [P4-U1a-1 — Atomic draft creation and protected registry API](p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md) | Owned ports/DTOs, minimal target-context integration, creation receipt, transaction/audit, protected create/list/detail and canonical admission denial. | Completed P2-U1/U2/U3 and P1-U4/U5; verified existing transaction constraints. | Backend create-to-read workflow with durable retries across replicas. AC-01–08 and AC-10 at API/database boundary; targeted transaction/identity/session/auth regressions. Provides safe DTOs, linked IDs, exact transport/error/retry contract and reproducible evidence. |
| [P4-U1a-2 — Operator browser creation and integrated handoff](p4-u1a-2-operator-browser-creation-and-integrated-handoff.md) | Tenant navigation/list/form/detail, explicit proxy consumers, owner-bound inputs/attempts, feedback/recovery, guides and complete parent verification. | Verified P4-U1a-1 plus delivered P2-U3b protected browser integration. | Real browser create/list/detail and refresh/retry/reauthentication journey; AC-01–11 across browser/API/database and full required checks. |

Child 1 is **complete** with [API evidence](../../docs/status/p4-u1a-1-evidence.md); child 2 is **planned** and consumes the [verified contract](../../docs/architecture/draft-tenant-registry-api.md). Execute sequentially,
recording the current dependency evidence and active checkpoint before each
implementation. P4-U1a completes only after both and the complete acceptance
matrix pass; P2-U4 must not start merely because the backend child passes.

Review found no need to resolve credential delivery, administrator reset policy,
geography, lifecycle transitions or PBX readiness to create an unset draft.
Those remain explicit later decision gates. Identifier normalization, minimal
identity fields, account representation, receipt design and API naming follow
existing contracts or routine implementation choices. Do not infer approval of
later product policy from this spec. Recheck source/evidence at implementation
start and resolve any newly discovered contradiction before dependent coding.
