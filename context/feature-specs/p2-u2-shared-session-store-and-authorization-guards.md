# P2-U2 — Shared session store and authorization guards

## Status and purpose

- **Status:** planned; three sequential child specs adopted, all planned.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [Phase 2, P2-U2](../implementation-plan.md#p2-u2--implement-the-shared-session-store-and-authorization-guards).
- **Goal:** enforce the same session authority on every HTTP replica.
- **Completion boundary:** a trusted backend consumer can create, validate,
  renew, rotate and revoke an opaque session through shared Redis; protected HTTP
  requests enforce current canonical authority and distributed limits on two
  replicas, including races, outages and restored stale data.

Sources: [overview](../project-overview.md), [architecture](../architecture.md#shared-session-management),
[UI context](../ui-context.md), [standards](../code-standards.md),
[workflow](../ai-workflow-rules.md), and [progress](../progress-tracker.md).
This spec defines intended behavior; it does not start implementation, approve
pending product policies or establish the Phase 2 authentication gate.

## Starting state and dependencies

Plan dependencies P2-U1 and P1-U3 are complete. Recheck their
[identity evidence](../../docs/status/p2-u1c-evidence.md) and
[shared-service evidence](../../docs/status/p1-u3-evidence.md) before implementation.
Reuse the [canonical authority ports](../../docs/architecture/canonical-authority-admission.md):
platform `byId` uses an operator ID; staff `byId` requires tenant ID and staff ID.
Both return coherent primary PostgreSQL snapshots with eligible, denied or
unavailable outcomes. Approved account states are active/disabled; credential
states are unset/ready. Ordinary staff require an active tenant and valid approved
roles. Identity authentication versions and tenant authority versions are monotonic
and change atomically with canonical authority writes and audit.

P1-U3 already supplies distinct session/realtime Redis services, authenticated
connections, bounded health checks and typed server configuration. P1-U5 supplies
transaction/audit/outbox conventions where canonical mutations need them. At spec
preparation, there is no session lifecycle adapter, protected-route guard or
shared rate-limit implementation. Redis connectivity is not session enforcement.
Existing shells and bootstrap are not sign-in journeys.

P1-U1 remains deferred outside approved scoped handoffs. The
[credential/session proposals](../../docs/planning/p1-u1-product-contracts.md#5-d-05--credentials-and-administrator-safeguards)
include unapproved lifetimes. Resolve the relevant gates below before dependent
runtime behavior; unrelated setup/recovery and incident decisions stay deferred.

## Scope and ownership

| Boundary | Responsibility |
| --- | --- |
| `modules/identity/` | Shared plane-tagged session ports, opaque-token generation/hash lookup, Redis adapter, lifecycle rules, canonical validation, distributed limiter and reusable guards. |
| `modules/platform/`, `modules/tenancy/` | Existing canonical authority/admission ports and mutation/version contracts; no duplicated operator or tenant registry. |
| HTTP entry point | Guard registration, explicit public/protected route metadata, consistent errors and trusted request identity extraction. |
| Configuration / Redis infrastructure | Validated lifecycle/limiter/timeouts settings, private credentials, bounded memory and noeviction configuration, necessary ACL/persistence documentation. |
| Checks / documentation | Two independent HTTP replica fixtures, real Redis/PostgreSQL checks, contract, recovery runbook, safe evidence and tracker. |

Keep domain rules independent of Redis/NestJS. Application services use small typed
ports; adapters own scripts, transport and serialization. Both identity planes
share lifecycle mechanics but remain separate discriminated authorities. Add
transport schemas to `packages/contracts` only for named consumers.

Out of scope: platform sign-in/logout endpoints and UI (P2-U3), staff sign-in,
setup/reset/recovery and mobile token delivery/storage (P2-U4), administration UI,
sockets/realtime delivery, public intake and production HA deployment. Reusable
revocation/rotation primitives belong here; their later user-facing workflows do
not. Use fixture-only protected routes and trusted session issuers for checks,
without shipping public token-minting or fixture endpoints. No web/mobile UI change
is needed. P2-U3/U4 own cookie/CSRF integration and actual browser/device checks;
this unit documents the consumer contract and accepts only explicit credentials.

## Session contract

### Tokens and records

Generate cryptographically random opaque tokens with at least 256 bits of entropy.
Return plaintext only once to the authorized transport consumer; never put it in
a URL, audit, log, exception, metric label or persisted record. Store only a
one-way cryptographic hash as the token lookup key. Bound token input before
hashing. Hashes are sensitive lookup material and are also excluded from diagnostics.
Never accept a client-provided token as a newly issued session identifier.

Validate a bounded, versioned session record at every read. Required facts are
plane, canonical identity ID, tenant ID and tenant authority version for staff,
authentication version, creation time, last activity/idle deadline, absolute
deadline and lifecycle generation/state needed for concurrency. Platform records
are tenantless and cannot contain staff roles. Staff records cannot contain
platform authority. Roles, if stored as a snapshot, never override canonical
roles. Store no password or password hash, username, tenant code or unnecessary
personal data.

Creation takes a trusted eligible canonical snapshot after the caller verifies
credentials. Recheck canonical status/versions before issuing usable authority;
a supplied DTO or stale snapshot is not proof of authentication. Login always
issues a fresh token. The backend-only creation port must not become an
unauthenticated session-minting API. P2-U3/U4 own credential verification.

### Expiry, renewal, rotation and revocation

Enforce both idle and absolute expiry using a documented shared time basis.
At or beyond either deadline the session is invalid even if Redis has retained
the key. TTL never exceeds the earlier deadline. Successful authorized activity
may advance idle expiry up to the original absolute deadline; failed, denied or
unavailable requests do not renew. Renewal never resets creation/absolute lifetime.
Validate time bounds and record schema; malformed records grant no authority.

Use atomic conditional operations for renewal, replacement and deletion. Missing,
expired, revoked or wrong-generation sessions cannot be recreated by a late
renewal. Concurrent rotations have a single winner; the losing caller receives a
typed invalid/conflict outcome and no replacement token. Old tokens stop working
when replacement succeeds. A lost issuance/rotation response does not authorize
reusing the old token or inventing local state; sign-in can recover lost access.

Single-session revocation is idempotent, shared and confirmed only after its
required writes succeed. Account-wide and tenant-wide revocation are bounded
operations backed by canonical version invalidation, not an unbounded request-time
Redis key scan. Canonical changes commit first; Redis cleanup/publication failure
cannot make the previous authority valid. Rotation after privilege change must
load current canonical authority; renewing an old snapshot cannot upgrade it.

Atomic Redis deletion protects live races but cannot alone protect against a
restored pre-revocation/pre-rotation snapshot. Before implementation, document and
verify a recovery strategy that keeps acknowledged revocations and replaced
credentials invalid: durable revocation/generation fencing, or a recovery procedure
that invalidates all sessions before serving restored Redis. If selective durable
metadata is required, keep it minimal and module-owned; Redis remains the shared
expiring session store. Do not claim arbitrary failover safety from TTL, asynchronous
replication or Redis-only tombstones. The procedure must fail closed until its
fence/reset is established. Never restore a usable session from replica memory.

## Canonical validation and authorization

For every protected HTTP request, validate the shared session, load current
canonical authority by its plane-qualified IDs and compare authentication version;
staff also require matching tenant authority version. Require current active/ready
eligibility and approved roles. Missing/malformed identity, disabled account,
unset credential, inactive tenant or any version mismatch rejects the session.
A suspend/reactivate or role remove/restore cycle cannot revive an older token.

Derive the request principal and audit actor from the canonical result. Never
trust tenant IDs, roles or identity fields from headers, route/body inputs or a
Redis role snapshot. A resource tenant parameter is an ownership selector that
must match authorized scope; it cannot replace the principal's canonical tenant.
Platform authority grants no tenant-staff authority and staff grants no platform
authority, including where usernames or IDs appear similar.

Use explicit plane and permission metadata with no permissive default for new
protected routes. Health and intentionally public routes remain explicitly public.
Permission checks use the approved role grants; owning application services still
check tenant ownership and domain restrictions. A guard is not a replacement for
mutation-level constraints. Document the concurrent-write boundary: a request
already validated before a canonical change may be in flight; sensitive writes
must enforce current authority at their transactional boundary. Do not promise
cancellation of completed requests or atomic PostgreSQL/Redis transactions.

| Outcome | HTTP mapping / behavior |
| --- | --- |
| Missing, malformed, expired, revoked or stale session | 401 with bounded generic unauthenticated response; no identity disclosure. |
| Valid session with wrong plane or insufficient permission | 403; no cross-plane data or tenant leakage. |
| Session Redis or canonical PostgreSQL unavailable | Retryable 503; no authority, renewal, local fallback or falsely successful revocation. |
| Distributed request limit exceeded | 429 with bounded retry timing; no session issuance or guarded work. |

Canonical failures remain unavailable rather than being reported as invalid
credentials. P2-U3/U4 separately map sign-in failures to their approved generic
responses. Cookie consumers require Secure/HttpOnly, explicit SameSite/domain/path
policy and CSRF protection for cookie-authenticated mutations. Bearer consumers
use authenticated transport and protected device storage. Never ambiguously choose
between conflicting cookie/bearer credentials; later transports must define and
test their accepted channel. Browser renewal must not bypass CSRF protections.

## Distributed rate limits and failure behavior

Use atomic Redis counters or another bounded atomic algorithm in session Redis.
Define a typed limiter port usable before expensive credential verification and on
protected operations. Namespace by operation and identity plane; tenant-qualified
identity limits include normalized tenant code plus username, while operator
limits are tenantless. Unknown identities follow the same limiter path as known
ones. Use bounded hashed identifiers and TTLs; attacker-controlled input cannot
create permanent/unbounded keys or expose identities through metrics.

Combine trusted source and identity dimensions under the approved policy; never
use arbitrary forwarded headers as the source address. Configure explicit trusted
proxy rules and reject ambiguous source extraction. A single client cannot gain
extra allowance by alternating replicas. Define counting of failures/successes,
window boundaries and retry timing before integration. Limiters do not create
account status changes or permanent lockout implicitly. Exact limits, windows and
operation coverage require the decision below; fixture values are not product defaults.

Bound connection/command timeouts and eligible retries. Capacity/noeviction write
failure, authentication failure, interruption and partial writes grant no authority.
Uncertain create/rotate/revoke results are explicit failures, not success. Session
Redis never falls back to realtime Redis or a process cache. Lost records require
sign-in again. Keep health/readiness and diagnostics useful without exposing tokens,
lookup hashes, credentials, identity input or Redis connection secrets.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Contract records approved lifecycle/limiter values or explicit pending gates, plane-tagged records/ports, errors and recovery guarantees. No proposed defaults become approval. |
| AC-02 | Trusted issuance produces distinct bounded random tokens; Redis holds hashed lookup keys only. Malformed/oversized tokens and records deny; secret sentinels are absent from logs/audit/errors/client artifacts. |
| AC-03 | A session issued through replica A works on B with identical canonical principal; same-named staff in two tenants remain isolated and tenantless platform sessions never enter staff routes. |
| AC-04 | Idle and absolute boundary checks pass independently; TTL is bounded, successful activity cannot extend absolute lifetime and denied/unavailable traffic cannot renew. Lost sessions require new sign-in. |
| AC-05 | Independent processes race renewal/revoke and concurrent rotation with barriers. Revocation cannot be undone; one replacement wins and old tokens fail on both replicas, including delayed/duplicate requests. |
| AC-06 | Canonical role/account/credential changes and all nonactive tenant states reject old sessions on both replicas. Reenable/role restore/reactivate cannot revive versions. Canonical outage returns 503. |
| AC-07 | Guarded routes enforce plane/permissions, canonical audit principal and tenant ownership with hostile request fields. Explicit public health remains accessible; sensitive-write authority boundary is covered by a representative transactional fixture. |
| AC-08 | Rate-limit requests distributed between A/B consume one allowance; concurrent boundary requests, window expiry, unknown identities and proxy spoofing pass. Redis limiter outage fails closed with 503. |
| AC-09 | Redis disconnect/restart, timeout and noeviction write rejection return retryable 503 without successful issuance/renewal/revocation claims. Recovery serves valid retained records only; deleted records are not reconstructed. |
| AC-10 | Restore actual stale Redis records captured before role/status changes, revocation and rotation. Canonical versions and the declared fence/reset strategy reject them before traffic resumes. Ambiguous write outcomes and recovery interruption remain safe. |
| AC-11 | Focused real-service/two-HTTP-replica checks and existing required Docker checks pass. Contract/runbook/evidence explain settings, secret handling, revocation, outage/reset procedure, fixture teardown and P2-U3/U4 handoff. |

Use real session Redis and PostgreSQL, actual runtime grants and two independently
running HTTP processes sharing those services. Ephemeral fixture issuers/routes
must be absent from production wiring. Use isolated services/databases/namespaces
and clean up only fixture-owned resources. Use synchronization barriers and bounded
clock/deadline fixtures rather than long sleeps for races and expiry. Mocks alone
cannot prove Redis atomicity, canonical invalidation or cross-replica HTTP guards.

Provisionally add `./dev exec pnpm check:session-foundation` with child selections;
this command does not exist at spec preparation. Run it plus `./dev check` during
implementation and record actual commands/results. Restart and restored-data checks
prove the declared controlled recovery boundary; production HA/failover topology
remains Phase 9 work. P2-U2 completion does not complete browser sign-in, CSRF,
mobile storage, sockets or the Phase 2 gate. This documentation task requires
consistency, acceptance coverage, relative-link and whitespace review only.

## Review and adopted implementation sub-units

**Review conclusion: split into three sequential sub-units.** Session lifecycle,
canonical HTTP authorization and distributed admission/recovery each have a clear
observable boundary. The user adopted the split on 2026-10-05. The linked child
specs define the sequential implementation boundaries; a/b/c remain planned.
Adopting the split does not approve pending product policies or start runtime work.

| Unit | Starting state and scope | Result and acceptance coverage |
| --- | --- | --- |
| [P2-U2a — Shared session lifecycle and recovery fencing](p2-u2a-shared-session-lifecycle-and-recovery-fencing.md) | Verified P2-U1/P1-U3 and approved relevant lifecycle policy; token/hash/record contracts, Redis lifecycle adapter, expiry/rotation/revocation, safe restored-data strategy and configuration. | Real-service two-process lifecycle, deadline/race/restore checks; AC-02, AC-04–05, lifecycle/revocation portions of AC-09–10 and its AC-01/AC-11 documentation. No HTTP sign-in. |
| [P2-U2b — Canonical authority validation and HTTP guards](p2-u2b-canonical-authority-validation-and-http-guards.md) | Verified a; reuse canonical plane-qualified authority ports, principal/error mapping, plane/permission guards and sensitive-write handoff. | Two HTTP replicas reuse a session and reject stale/foreign authority; AC-03, AC-06–07, canonical-version restore portion of AC-10 and its AC-01/AC-11 documentation. |
| [P2-U2c — Distributed rate limits and integrated recovery handoff](p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md) | Verified a/b plus approved limiter policy; atomic shared limits, trusted source extraction, failure matrix, combined fixture/CI checks and operator recovery guide. | Cross-replica limits and full outage/write-failure/stale-restore matrix; AC-08, remaining AC-09–10 and combined AC-01/AC-11. Re-runs all parent acceptance. |

Every AC-01–11 has an owner. Each child includes its checks/documentation; c does
not defer correctness checks from a/b. Lifecycle recovery fencing stays with a
because it affects storage design, while c proves the integrated HTTP recovery
path. Rate-limit failure enforcement applies to every declared consumer in c.
Do not split into unverified Redis schema, backend and later testing-only work.
The parent completes only when all children and all criteria pass; P2-U3/U4 depend
on the combined P2-U2 result. Retain top-level plan IDs and Phase 2 order.

## Decision gates and review findings

| Gate | Owner and required resolution | Dependent work / resume condition |
| --- | --- | --- |
| Session policy, scoped D-05 | User; approve idle/absolute lifetimes by web/mobile consumer and renewal activity. Existing draft proposes web 30 minutes/12 hours and mobile 24 hours/7 days, but these remain unapproved. | a's product defaults and parent completion; record scoped handoff before implementing them. |
| Limiter policy | User; approve protected/authentication operation coverage, budgets/windows, source/identity dimensions and counting behavior. | c and later sign-in integration; propose concrete values in a review before dependent implementation. No arbitrary defaults or implicit account lockout. |
| Recovery design | Implementation owner; document how acknowledged revocation/rotation survives stale Redis restoration, any minimal durable metadata, time basis and fail-closed reset/fencing sequence. | a design and AC-05/AC-10; do not postpone the solution until final testing. User decision is needed only if the design changes product behavior such as revoking other devices. |
| Cookie/proxy deployment contract | Implementation owner for trusted proxy configuration; user for deployment origins or cross-site behavior not yet defined. | c source extraction and P2-U3/U4 cookie/CSRF transport. Protected fixture HTTP checks do not approve browser policy. |

The review found the important risk is restoration of Redis-only revocation state:
live atomicity alone cannot prove stale-data safety. It also found canonical guards
must distinguish unavailable from denied, and renewal must not slide absolute
expiry or silently grant new privileges. These are addressed in the contracts and
acceptance matrix. No identity-store replacement, separate session-manager service,
public auth endpoint or early UI feature is necessary.
