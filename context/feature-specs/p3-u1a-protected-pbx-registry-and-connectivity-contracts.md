# P3-U1a — Protected PBX registry and connectivity contracts

## Status and purpose

- **Status:** complete; A-01–07 verified 2026-10-14 11:22 +08:00 (Asia/Manila). See [evidence](../../docs/status/p3-u1a-evidence.md).
- **Requirement:** [P3-U1 parent scope and acceptance matrix](p3-u1-register-pbx-nodes-and-observe-health.md).
- **Goal:** register and inspect canonical PBX desired connectivity through a protected, transactional platform API without exposing secrets or connecting before commit.
- **Completion boundary:** real PostgreSQL and two HTTP replicas prove registry creation, reads, versioned edits, safe retry and platform-only authority. Live observation belongs to b; operator screens belong to c.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
The parent owns shared scope, G-01–03 and AC-01–11; this child specializes its
registry boundary without approving any pending PBX policy.

## Starting state and dependencies

Require verified P2-U3 and P1-U5, reusing P1-U3 database/configuration, P2-U2
canonical guards and P1-U4 contracts/primitives where needed. Review the delivered
[platform HTTP contract](../../docs/architecture/platform-authentication-http.md),
[transactional audit/outbox contract](../../docs/architecture/transactional-audit-outbox.md)
and [durable delivery contract](../../docs/architecture/durable-worker-delivery.md).
The Asterisk container and telephony entry point are bootstrap/skeleton only.

Resolve G-01's management descriptor, approved target identity/network and
permitted transport, plus G-02's alias/resolver/access contract, before dependent
validation or resolution work. A read-only resolver probe may establish its own
boundary without claiming Asterisk authentication. Actual authenticated PBX access
and remaining observation policy are required by b. Record what was supplied,
what was verified and what remains pending in the tracker. Splitting does not
waive a gate; routine route/SQL choices do not require separate permission.

## Scope and ownership

Allowed changes are telephony-owned PBX registry schema/migrations/grants,
repositories/use cases, small domain-grouped transport schemas, protected
create/list/detail/edit endpoints, server-only secret/destination ports and
real-service registry checks/documentation. Integrate existing guards/audit/outbox
through owner interfaces rather than duplicating stores.

Do not implement browser screens, leases, observers, registration inventory,
trunks/routes/revisions/applies, node deletion or tenant allocations. b owns the
observation schema and per-node leases. a must settle its atomic version/edit
invalidation contract so b can integrate it without changing registry semantics.

## Registry and transaction contract

Persist immutable node ID, display name, canonical management connection identity,
validated non-secret descriptor, opaque approved credential aliases, optimistic
version, timestamps and actor attribution. Define descriptor normalization and
supported target identity before coding. Equivalent aliases must resolve to one
canonical managed target so duplicate records cannot bypass later single-owner
coordination. Reject unresolved identity; arbitrary names or DNS text cannot
establish that two physical PBXs differ.

Enforce target uniqueness with real database constraints and concurrent checks.
Create is atomically paired with platform-operator audit and any required durable
reconciliation intent; no external connection or publication occurs before commit.
A failed audit/intent rolls back the whole mutation. Reuse caller-owned transactions
and runtime grants, with migrations executed only by the trusted deployment path.

Use a create intent key scoped to canonical operator and operation, with a bounded
canonical request fingerprint and documented receipt retention. Same key/payload
returns the original safe result without duplicate node/audit; conflicting reuse
rejects. Another key targeting an existing canonical node produces a safe conflict.
Test concurrent replay and COMMIT-response loss. An ambiguous response permits an
explicit retry of the same intent or canonical reload, never a success/failure
assumption or automatic submission of changed data.

Edits require expected version and transactional canonical authority revalidation.
Reject stale versions; advance the desired version on a successful connectivity
change. Expose a transaction-bound invalidation port for b: once b exists, changing
target/reference must invalidate current observation and ownership generation in
the same commit. a may prove the handoff with an isolated contract fixture; it must
not add speculative observation/lease tables. Until b, the API exposes desired
records with observations explicitly not yet available, never inferred healthy.

Registry save does not require a reachable PBX or successful secret read. Validate
that the alias is approved, but classify runtime resolution/connect failure later;
valid desired state is retained. Do not claim a save verifies connectivity.

## Secret, destination and HTTP boundaries

Accept approved opaque aliases only; reject plaintext credentials, provider paths,
URLs containing credentials and unrecognized fields. Resolve aliases server-side
using the approved runtime-only provider/configuration. Clients and audit see only
safe references, never material or unrestricted locations. HTTP needs alias
validation, not unrestricted access to resolved credentials; document least-privilege
process access. b owns reconnect behavior after runtime secret rotation.

Validate approved target/transport/port and actual address resolution at the point
of connection through a narrow destination policy port; descriptor checks alone
cannot make a later DNS resolution safe. Deny unintended metadata/local targets
outside the approved network while allowing explicitly approved controlled PBX
addresses. Test policy with safe fixtures; no arbitrary remote scanning.

All endpoints require canonical platform authority and established credential
channels. Reuse no-store, CSRF/Origin for writes, bounded validation and pagination,
trusted source extraction and transactional authority checks. Staff, expired or
revoked sessions and forged role/tenant/ownership fields grant nothing. Reads are
passive. Apply existing safe 401/403/503 behavior; document bounded validation,
not-found and conflict contracts before implementation. Sanitize exceptions and
keep credentials/raw input out of diagnostics, receipts, outbox and responses.

## Acceptance and verification

| ID | Required observable result/check | Parent coverage |
| --- | --- | --- |
| A-01 | Named DTOs/routes, normalization/target identity, secret/destination policy, retry/error/receipt contracts and b's atomic invalidation handoff are documented; no duplicate store or speculative schema. | AC-01 registry |
| A-02 | Real runtime grants support desired create/read/edit; one actor audit and required intent commit atomically. Forced audit/intent failure leaves no node or effect; migrations remain deployment-owned. | AC-02 transaction |
| A-03 | Equivalent-target concurrent create, same-intent replay and conflicting key/payload produce one canonical node/business audit or safe conflict. COMMIT-response loss is recovered explicitly without duplicate creation. | AC-02 retry/uniqueness |
| A-04 | Versioned edits reject stale writes; successful connectivity change advances version and invokes transaction-bound invalidation. Failed invalidation rolls back; unknown observations are never healthy. | AC-02 edits; AC-01 handoff |
| A-05 | Actual shared platform sessions on HTTP A/B enforce plane/current authority, cookie/channel/CSRF/Origin and no-store. Staff, revoked/expired/forged authority deny; database/Redis outage safely denies protected work. | AC-03 API |
| A-06 | Approved alias validation/resolution and destination checks pass; missing/inaccessible secret outcomes are sanitized without undoing desired save. Credential/path/protocol/target abuse rejects; secret sentinels remain absent from DTOs, audit/receipts/outbox/logs/exceptions and client contract output. | AC-04 registry |
| A-07 | Request/list bounds and pagination pass; focused real-service checks, affected authority/audit/delivery regressions and full Docker graph pass. Contract, runbook, evidence/index/tracker describe tested boundaries and pending b/c work. | AC-11 scoped |

During implementation establish the proposed selection
`./dev exec pnpm check:pbx-nodes --registry` (not present at spec creation).
Use real PostgreSQL/runtime grants, shared Redis and independent HTTP A/B processes,
isolated operators/staff and fixture-owned nodes. Barrier fixtures prove races;
fault fixtures prove rollback and actual response-loss uncertainty. Resolver/policy
fixtures prove their declared port boundary, not live Asterisk observation. Run
affected existing authority/audit/outbox regressions and `./dev check`; record
actual commands, outcomes, environment and precise fixture cleanup.
Documentation preparation needs consistency, coverage, links and whitespace only.

## Completion and handoff

Complete a only when A-01–07 pass. Hand [b](p3-u1b-fenced-asterisk-observation-and-recovery.md)
the canonical registry/version ports, approved alias/destination policy, edit
invalidation transaction hook, safe DTO/error contracts, receipt semantics and
reproducible checks. Hand c the protected endpoint/forwarding requirements.
No a completion claim establishes live connectivity, ownership failover, browser
acceptance, tenant voice readiness or parent completion.
