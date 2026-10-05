# Canonical role authority and admission — P2-U1b

Status: implemented and verified 2026-10-05 15:32 +08:00 (Asia/Manila).
See [B-01–07 acceptance evidence](../status/p2-u1b-evidence.md).
Requirement: [P2-U1b](../../context/feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md).
The user approved [review sections 1–4](../planning/p2-u1b-contract-review.md), with
creator closure independent of dispatcher role and subject to D-02/D-03 safeguards.
This is a scoped P1-U1 handoff; the remaining decisions stay deferred.

## Approved roles and admission

Identity owns one to four distinct fixed staff roles: `tenant_admin`, `call_taker`,
`dispatcher`, `responder`. Any nonempty combination is permitted; invalid,
unknown, duplicate, null and platform roles are rejected. Canonical ordering is
that list's order. Permissions follow the approved
[product matrix](../planning/p1-u1-product-contracts.md#1-d-01--permissions).
All valid staff roles include own-incident closure. Dispatchers also have tenant
incident closure. `incidentClosureGrant` evaluates only that grant; an incident
use case must prove the same-tenant canonical creator relationship and apply all
owning closure/assignment/audit safeguards. No incident workflow is implemented.

Platform owns a separate tenantless operator store. Its sole authority is
`platform_operator`, derived from that canonical store, never a staff grant.

| Tenant status | Active account, ready credential and valid roles | Other staff combinations |
| ------------- | ------------------------------------------------ | ------------------------ |
| draft         | denied                                           | denied                   |
| active        | eligible                                         | denied                   |
| suspended     | denied                                           | denied                   |
| retired       | denied                                           | denied                   |

Both planes require active accounts, ready/coherent credentials (including finite
last-change timestamps) and positive
valid row/authentication versions. `unset` or disabled denies. Staff additionally
require canonical active tenant, valid roles and tenant versions. Operators are
independent of tenant lifecycle. Unknown/malformed/missing/wrong-plane/foreign
facts deny; loading failure is unavailable. Only eligible results carry snapshots.
Eligibility establishes neither password verification nor authentication.

## Private coherent read contracts

Caller-owned `StaffAuthorityRead` offers `candidate({plane,tenantCode,username})`
and `byId({plane,tenantId,staffId})`. Candidate lookup normalizes tenant code,
resolves tenancy's canonical record, then normalizes/queries that tenant's username.
By-ID reads always qualify staff by tenant and user ID. Extra tenant/role/authority
fields are rejected. Neither execution context nor audit references supply authority.
The caller-owned `TenantAdmissionRead` port is implemented by tenancy's
`TenantAdmissionRepository`; identity queries only its own staff table.

`PlatformAuthorityRead` offers platform candidate and by-ID reads through only the
operator table. No tenant association is returned. Identical names or UUIDs in
separate stores never merge the authority planes.

`SnapshotDatabase` is constructed with the primary runtime PostgreSQL URL. It
owns a four-connection pool, 2-second connection acquisition/statement timeouts
and 5-second idle transaction timeout. Each read uses one `REPEATABLE READ READ
ONLY` transaction across owner queries, and returns only after commit. Escaped
snapshot handles cannot query after release. Failure at acquisition, query or
commit returns unavailable through the owner adapter. No local authorization
cache, fixture fallback, read replica or invented read actor is used.

Staff snapshots contain plane, staff/tenant IDs, canonical roles, account and
credential state, authentication version, tenant status and tenant authority
version. Platform snapshots contain plane, operator ID, fixed authority, account/
credential state and authentication version. They contain neither usernames nor
hashes. SQL returns credential coherence as a boolean instead of hash bytes.
Separate private `StaffCredentialRead` and `PlatformCredentialRead` ports expose
hash/authentication-version material only to later backend verifiers. Their
results cannot themselves establish tenant admission or replace a fresh canonical
eligibility read. No shared client contract exports these ports.

## Persistence and deployment

Migration `20261005010000_canonical_authority` adds mandatory `text[]` staff roles,
bounded cardinality, one-dimensional/one-based arrays, approved vocabulary and
null/duplicate rejection. It grants only role-column INSERT/UPDATE to the existing
runtime role. Operator creation/provenance remains deployment-only. a's ownership,
identifier, credential and append-only audit constraints/grants remain intact.

There is deliberately no role default or implicit backfill. The verified a
foundation has zero production identity records. Applying this migration to a
populated staff table fails atomically; such a deployment requires an explicitly
reviewed per-account role migration, not an invented universal privilege. Fresh
and rerun deployment are exercised by the disposable database check.

`StaffRepository.create` now requires explicit approved roles. Existing a
fixtures pass a fixed explicit role while retaining all storage assertions;
storage creation still does not imply operational eligibility.

## Atomic mutation boundary

Owner adapters supply `StaffAuthorityMutations.change`,
`OperatorAuthorityMutations.change` and `TenantAuthorityMutations.status`.
They accept the existing `Transaction`, a qualified target and expected row version.
Account changes are a discriminated status/roles/credential replacement command;
operator role commands are invalid. Tenant status is a persistence operation,
not an approved lifecycle transition API.

The existing foundation validates/freezes structural execution context. Adapters
add exact target type/ID/scope and actor-plane checks: staff accepts same-tenant
staff or trusted system; tenant/operator accepts platform or trusted system.
These are private persistence capabilities. Future authenticated owning use cases
must authenticate and authorize before providing the trusted transaction; a
structurally valid context alone does not prove those facts. Fixtures use explicit
system actors, never invented authenticated operators/staff. No public mutation
controller or general administrative endpoint is registered.

The adapter locks the qualified row, checks expected version, validates the
change, applies facts/version increments, appends an event-specific safe audit
on the same handle and commits through the caller's transaction. Stale returns
`stale`; missing/invalid/unavailable retain a's typed failure semantics. A required
SQL/audit failure poisons the transaction even if caught inside its callback;
the caller must await the outer transaction before treating a result as committed.

| Changed fact                                          | Row version | Authentication/tenant authority version |
| ----------------------------------------------------- | ----------- | --------------------------------------- |
| Staff username (a's rename)                           | +1          | authentication +1                       |
| Staff roles or account status                         | +1          | authentication +1                       |
| Staff credential state, hash or last-change timestamp | +1          | authentication +1                       |
| Operator status or credential facts                   | +1          | authentication +1                       |
| Tenant status                                         | +1          | tenant authority +1                     |
| Tenant display name (a's rename)                      | +1          | unchanged                               |
| Canonically identical roles/status/credential facts   | unchanged   | unchanged                               |

Each command changes one category; combined commands for the same qualified
target may reuse the same caller transaction with use-case authorization. Counters range from
1 to PostgreSQL integer maximum 2147483647. The maximum is valid for reads/no-ops;
a further increment fails with rollback, never reset/wrap. Locking plus expected
versions serializes competing writes; a stale contender cannot silently restore
privileges. Suspend/reactivate advances tenant authority twice, keeping previous
snapshots stale.

Audit event names distinguish staff/operator/tenant and roles/status/credential.
Metadata is limited to enum `oldCode`/`newCode`, old/new row versions and old/new
authority versions. Role-set codes come from the 15 fixed approved combinations.
Credential audit records only state codes, even when a ready hash is replaced.
No username, password/hash, timestamp, arbitrary request or unbounded role list is
recorded. Historical actor/target references remain retained by foundation audit.

## Verification and handoff

`./dev exec pnpm check:identity-foundation --authority` runs a's storage regressions
plus b's authority suite in one isolated real PostgreSQL database, using actual
runtime grants and trusted disposable-fixture administration. Omitting a selection
also runs both; `--storage` retains a-only selection. `check:foundation` now selects
`--authority`, so `./dev check` and existing Docker CI include it.

Independent read/writer connections and barriers prove old committed visibility,
repeatable-read coherence across committed tenant/role changes, and a lock-blocked
role-restoration contender losing with `stale`. Fixtures cover the 16 tenant/account/
credential combinations, four operator combinations, same names/UUIDs, wrong
planes/foreign/extra authority inputs, malformed roles, audit rollback, no-ops,
credential replacement, exhaustion, real connection termination/recovery and
statement timeout. Existing five-client artifact scans include b's synthetic
hash/identity sentinels and private database adapter exclusions.

c receives these approved operator eligibility, credential isolation, bounded
snapshot and atomic authority/audit contracts, plus combined a/b checks. Password
policy/usable hashing and trusted operator bootstrap remain c. P2-U2 must reload
canonical versions/status instead of trusting cached session roles. This unit
proves no password/session/Redis/socket/telephony or two-replica authentication
behavior, and does not complete parent P2-U1.
