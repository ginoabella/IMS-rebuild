# P4-U1a-1 — Atomic draft creation and protected registry API

## Identity, state and requirement

- **Unit:** P4-U1a-1, first sequential child of P4-U1a.
- **Status:** complete; A-01–08 and required regressions passed 2026-10-07 13:50 +08:00 (Asia/Manila). See [evidence](../../docs/status/p4-u1a-1-evidence.md).
- **Requirement:** [parent spec](p4-u1a-draft-tenant-creation-and-initial-administrator.md) and [P4-U1a delivery plan](../implementation-plan.md#p4-u1a--create-a-draft-tenant-and-its-first-administrator).
- **Goal:** Expose a protected backend workflow that atomically creates a draft tenant and its first unset administrator, supports durable retries and returns canonical list/detail data.
- **Dependencies:** completed P2-U1/U2/U3 and P1-U4/U5. Recheck source and evidence before coding. No staff sign-in or PBX prerequisite.
- **Result:** A canonically authorized operator can create and read the draft through declared backend consumers on either HTTP replica. Failures leave no partial organization or false success.

Follow the parent contracts and [mandatory context](../ai-workflow-rules.md#establish-context-before-implementation).
This child establishes the API/database boundary. Its completion does not complete
the operator browser journey, P4-U1a, P4-U1 or the Phase 2 staff gate.

## Starting state and allowed changes

Reuse tenancy's `TenantRegistry`/`TenantRepository`, identity's canonical staff
store, existing normalization and constraints, platform-cookie HTTP guards,
shared limits, `TransactionAuthority`, append-only audit and the same-connection
transaction runner. Existing general staff reads omit usernames; administration
must use a narrow owner-provided port rather than the credential reader.

Tenant and staff repositories currently require different transaction targets.
Resolve that integration within this child while preserving both creation facts,
one actor, one connection and one commit. Existing fixtures are not production
registry endpoints or evidence for this new workflow.

| Owner | Scope |
| --- | --- |
| Platform application/HTTP | Create/list/detail services and adapters, caller-owned ports, safe outcomes and creation receipt persistence. |
| Tenancy | Narrow canonical create/list/detail registry capability; no duplicate tenant catalog. |
| Identity | Narrow tenant-qualified first-administrator create/read capability; no credential lifecycle or general staff-management routes. |
| Transaction/audit infrastructure | Minimal compatible support for server-validated per-write targets on one connection; preserve actor/correlation, poisoned rollback and existing consumers. |
| Contracts/database/checks/docs | Domain-grouped transport schemas, receipt/linkage migration and minimal grants/indexes, focused real-service checks, API contract and evidence. |

Exclude browser screens/proxy forwarding (child 2), tenant edit/search/filter,
contacts/geography/voice settings (P4-U1b), credentials (P2-U4), activation
(P4-U3), PBX effects, notifications and speculative jobs/outbox publication.

## Create contract and canonical state

Accept exactly `requestId`, `tenantCode`, `displayName` and
`administratorUsername`. Validate bounded raw input before normalization; reject
unknown fields, malformed/control text and invalid UUIDs. Reuse backend trim and
ASCII lowercase identifier rules: tenant code 1–64, username 1–128 canonical
characters matching `[a-z0-9][a-z0-9_.-]*`. Organization name is trimmed,
nonempty and at most 200 UTF-16 code units; preserve meaningful casing.

Generate tenant/staff UUIDs server-side. Explicitly set:

- Tenant: `status=draft`, existing initial row/authority versions and timestamps.
- Administrator: canonical new tenant ID, normalized username, `status=active`, exactly `roles=['tenant_admin']`.
- Credentials: `credential_state=unset`, null hash and null credential-change timestamp, existing initial authentication/row versions.

Client status/roles/actor/tenant IDs cannot control these values. Immutable code
and ownership, global code uniqueness across all statuses and within-tenant
username uniqueness remain database-enforced. Active account representation
alone grants no admission to an unset user in a draft tenant.

## One transaction and trusted attribution

1. Authenticate and authorize using the delivered platform-cookie principal. Derive the actor from that principal, never request data.
2. Open the existing primary PostgreSQL transaction and validate the operator's current canonical authority under the delivered transaction-held lock.
3. Claim/inspect the operator-scoped attempt receipt and compare the canonical-input fingerprint.
4. Create tenant and administrator through owner-implemented ports, append their correctly targeted audit, and persist the creation linkage/receipt on the same connection.
5. Confirm success only after the outer commit returns successfully.

Define the narrow target-context integration before coding. It must validate
server-generated tenant/staff references, preserve canonical actor/correlation,
retain required-write failure poisoning and share the original connection.
Do not change execution context ad hoc, weaken owner target checks, open two
transactions or insert into another module's tables from platform application
code. Verify old transaction/audit consumers remain compatible.

Audit contains both creation facts and the canonical operator attribution.
Reuse existing events when compatible; avoid duplicate summary events. Approved
bounded references/change kinds are sufficient. Do not log or audit raw form
values, usernames, request fingerprints, hashes, cookies or CSRF material.
Safe repository failures inside a callback still require full outer rollback.

## Durable attempt receipt and races

Own receipt storage in platform; canonical tenant and staff facts stay in their
owners. The receipt has an operator/request uniqueness boundary, canonical-input
fingerprint, original tenant/staff references and required creation provenance.
Linkage must identify the administrator within the linked tenant through database
integrity checks. Detail/handoff must never guess the initial administrator by
username, role or earliest timestamp. Read live names/status/roles/credentials
from canonical stores, not copied receipt snapshots.

Retain the receipt with its linked draft; introduce no cleanup/deletion job.
Use deployment-owned migrations and minimal runtime grants; HTTP never migrates.
Bound all queries and waits. Database uniqueness/locking, not replica memory,
coordinates concurrent creation and retries.

| Attempt | Required outcome |
| --- | --- |
| New request with unused normalized code | 201 only after one tenant/admin/receipt and required audit commit. |
| Same operator/request and canonical input | 200 with original linked IDs; no repeated creation writes/audit. Canonical read metadata may reflect later changes. |
| Same operator/request with changed canonical input | 409 request conflict; no mutation. |
| Different attempt/operator with the same normalized code | 409 code conflict; no adoption, administrator replacement or ownership transfer. |
| Concurrent identical attempts on two replicas | One committed pair and identical replay IDs. |
| Concurrent different attempts for the same code | One winner, clean losing transactions. |
| Staff/receipt/audit failure | Roll back all attempted writes; no orphan tenant, user, linkage or audit. |
| Lost response or uncertain commit acknowledgment | Safe unavailable/unknown outcome; explicit same-attempt retry finds the committed receipt or safely creates after rollback. No automatic replay. |

A request UUID is not a credential. Another operator using that UUID cannot
recover the first operator's receipt via the replay path. Normal authorized
platform list/detail access remains governed by platform permissions.

## Protected API and read contract

Declare named create (POST), list (GET) and detail (GET) consumers with explicit
`platform-cookie`, plane `platform`, permission `platform_operator` policies.
Document exact routes/DTOs before implementation; API naming is a routine choice.
Revalidate mutation authority in the transaction in addition to HTTP guards.
Use established trusted proxy/source, Origin, CSRF, shared protected admission,
error and Retry-After handling. No CSRF-less mutation or generic endpoint bypass.

Create is operational activity. Document list/detail activity classifications
consistently with the delivered policy; passive/background refresh cannot renew
sessions. Never extend original absolute lifetime.

Read the primary, disable caching with `no-store`, and expose only required
administration data. List includes ID, display name, normalized code, status and
bounded pagination (default 25, maximum 100), stable ordering and indexed access.
Detail includes canonical tenant metadata and linked administrator ID, tenant ID,
username, roles, account status and credential state. Exclude hash/private
verifier material, tokens and setup links. Missing valid IDs return 404; malformed
IDs return 400. A tenant without creation provenance has an explicit unavailable
administrator result, not guessed linkage or a repair action.

Use parent outcomes: 400 validation with bounded field errors; 401 absent/expired
session; 403 wrong plane/permission/CSRF/source; 409 conflicts; 429 limits;
retryable 503 database/Redis/authority outage or uncertain commit. Return no SQL,
stack or secret details. Read failures never become empty/missing success.

## Acceptance and required checks

| ID | Criterion | Parent coverage |
| --- | --- | --- |
| A-01 | Real protected create then list/detail yields the correct canonical draft/admin/receipt, explicit states/versions and safe DTOs. | AC-01, AC-08 |
| A-02 | Canonical normalization/bounds, unknown-field denial, global code collision across statuses, immutable ownership and identical usernames in distinct tenants pass. | AC-02, AC-03 |
| A-03 | Inject staff/receipt/audit failure and prove total rollback, same-connection target isolation and canonical actor attribution. Existing transaction/audit callers still pass. | AC-04 |
| A-04 | Independent HTTP replicas race identical attempts, changed-input reuse and separate same-code attempts; exact replay IDs and one creation audit set survive. Foreign operator cannot adopt a receipt. | AC-05 |
| A-05 | Inject response loss after commit and uncertain commit acknowledgment; explicit retries produce one durable outcome across process restart/replica change. | AC-06 backend |
| A-06 | Direct backend consumers reject absent/expired/foreign-plane sessions, forged fields, invalid Origin/CSRF/source and shared-limit/dependency failure. Operator disable/version races cannot commit stale authority. | AC-07 backend, AC-09 session regression |
| A-07 | Canonical list/detail reads, pagination limits/order, missing/malformed IDs, unavailable provenance and safe read outage pass. Hash/token sentinels remain absent in DTOs/logs. | AC-08, AC-11 backend |
| A-08 | Saved draft administrator remains denied by canonical staff admission; no usable credentials, staff session, activation or PBX work exists. Document tenant-qualified handoff IDs. | AC-10, AC-11 handoff |

Implemented command: `./dev exec pnpm check:draft-tenant --api`; final focused and full required verification passed, exit 0.
Use isolated real PostgreSQL/runtime grants, real session Redis, controlled
operator/staff fixtures and two independent HTTP processes. Use barriers and
fault injection to prove rollback/races/commit uncertainty, with exact teardown.
Fixture staff sessions test plane denial; they do not establish staff sign-in.

Run affected existing identity, transactional audit, platform authentication and
session checks plus `./dev check`. Add the focused check to the owning graph.
Record exact implemented commands, results and material limits. API fixtures
cannot satisfy browser criteria; child 2 must complete the combined journey.

## Completion and handoff

Complete only when A-01–08 and required regressions pass with evidence and tracker
updates. Publish the route/DTO/error contract, receipt semantics, target-context
integration, migration/grants, canonical linked IDs, activity classification and
check command. Child 2 consumes these contracts; it must not recreate backend
validation or persistence. All browser criteria and parent completion remain
pending at this child's completion.

Verified implementation and handoff: [API/DTO/receipt contract](../../docs/architecture/draft-tenant-registry-api.md) and [acceptance evidence](../../docs/status/p4-u1a-1-evidence.md). Child 2 and parent completion remain pending.
