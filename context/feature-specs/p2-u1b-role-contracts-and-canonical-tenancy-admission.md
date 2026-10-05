# P2-U1b — Role contracts and canonical tenancy admission

## Status and purpose

- **Status:** planned; implementation has not started.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U1 parent scope and acceptance matrix](p2-u1-canonical-identities-and-tenancy-admission.md).
- **Goal:** supply canonical, plane-specific eligibility and authority snapshots
  with atomic version/audit rules for later session enforcement.
- **Completion boundary:** approved roles and admission rules produce coherent
  eligible/denied/unavailable results from real PostgreSQL; stale and failed
  mutations cannot leave mismatched authority, versions or audit.

The user adopted the three-spec split. The parent owns shared scope, exclusions
and AC-01–11. This spec owns role/admission contracts, not authenticated access.
Creating the split does not approve pending product rules or start implementation.

## Starting state and dependencies

Require verified [P2-U1a](p2-u1a-canonical-identity-stores-and-ownership-constraints.md)
and its canonical stores, normalization, versions, ownership constraints and grants.
Reuse P1-U5's transaction, audit and safe diagnostic interfaces without duplicating
them. Recheck a's evidence and the current schema before starting.

Resolve D-01 role names, combinations/cardinality and permission bundles; relevant
D-05 account/credential eligibility; and D-06 admission/lifecycle contract. Record
the approved P1-U1 partial handoff. The existing architecture already requires
active-only ordinary tenant staff admission; the proposed role matrix and draft
setup exception remain unapproved. Delivery/recovery, active-call coordination
and other later policies are not silently adopted by this child.

## Scope and ownership

Allowed changes: identity role types/persistence as needed by the approved decision,
tenancy admission domain rules, private platform/staff canonical read ports,
consistent snapshot repositories, version/audit mutation coordination, necessary
module-owned migrations/grants, fixtures/checks and contract documentation.

Keep pure domain rules independent of NestJS, Prisma and Redis. Tenancy owns tenant
status/admission; identity owns staff roles/account/credentials; platform owns its
tenantless operators. Consumers use caller-owned typed ports into these owners.
Do not create another authority registry, public tenant directory or role catalog
editable through unapproved routes.

Do not implement Redis sessions, token verification, guards, login/logout, CSRF,
socket revalidation, role-management UI, credential reset/setup tokens or lifecycle
UI/PBX coordination. Eligibility is a foundation result; future consumers must
authenticate and authorize before using it.

## Roles and canonical read contract

Persist only approved role names/cardinality and valid grants. Staff roles cannot
contain platform authority; operator authority cannot become tenant membership.
If the approved decision requires schema changes after a, add a versioned
module-owned migration and verify fresh/rerun plus existing a regressions.
Reject unknown roles or inconsistent persisted grants rather than dropping them
and treating the remaining record as eligible.

Expose separate private staff and platform read paths with a discriminated result:

- Staff snapshots include canonical staff ID, tenant ID, roles, account/credential
  state, account authentication version, tenant status and tenant authority version.
- Platform snapshots include canonical operator ID, platform authority,
  account/credential state and authentication version, with no tenant association.
- Denied/missing results expose no usable authority. Unavailable results are
  distinct safe failures, also with no authority.

Staff login-candidate resolution uses normalized tenant code followed by username
within that tenant. By-ID resolution for later protected/administrative operations
requires the tenant-qualified user ID. Platform lookup uses only its own store.
Foreign IDs and wrong-plane inputs fail even when usernames match. Client-selected
tenant IDs/roles, audit references and fixture execution contexts cannot create
canonical authority. Keep hashes in a private credential-verification port;
general snapshots/DTOs must not contain them.

Read from primary PostgreSQL in a single coherent snapshot. A single joined read or
a transaction with suitable isolation must prevent mixed old roles/new versions
and mixed old tenant state/new tenant versions. Bound connection/statement timeouts.
Do not cache authorization in local replica memory or fall back to fixture data
when canonical reads fail.

## Admission contract

Ordinary staff eligibility requires all of: canonical active tenant, eligible
account, ready credential and valid approved roles. Draft, suspended and retired
tenants deny ordinary admission. Missing records, ineligible account/credential,
unknown role, invalid version or malformed authority deny it. Canonical loading
failure returns unavailable, never an eligible snapshot.

Platform eligibility checks its own account/credential/authority independently
of tenant lifecycle. It grants only platform authority. A draft setup token may
eventually authorize credential setup under an explicit P2-U4 contract; it never
makes a staff identity operationally eligible here.

Do not equate eligible with authenticated: this child does not prove a password,
issue a token or admit a request. P2-U2 implements canonical session validation;
P2-U3/U4 implement sign-in and generic invalid-credentials responses. P4-U3 owns
allowed lifecycle transitions and their operational/telephony effects.

## Atomic authority-version and audit contract

Document precisely which facts affect row version and authority version. Account
role/status/credential changes monotonically advance account authentication
authority; tenant status changes monotonically advance tenant authority. Positive
versions never reset or wrap; exhaustion fails safely. A suspend/reactivate cycle
leaves old authority snapshots stale. No-op writes leave versions unchanged.

Coordinate a mutation on the existing transaction handle: validate trusted actor
and qualified target, check expected row version, write changed facts and relevant
versions, append the event-specific audit, then commit. Record old/new fixed state
or role codes and versions through the safe allowlist; never record usernames,
passwords, hashes, arbitrary requests or invented authenticated actors.

Stale writes return a typed conflict; audit failure, validation failure or SQL
failure rolls back facts and versions. Independent readers observe only committed
coherent results. Serialize concurrent changes or reject them through expected
versions; no lost update silently restores privileges. Preserve audit references
and append-only protections from the foundation.

Keep the mutation boundary small enough for later use cases to reuse. Test-only
fixtures may exercise status/role/credential changes through that contract; do not
add general lifecycle/admin APIs merely to prove version changes. Credential
replacement in production belongs to its approved owning use case. Redis revocation,
socket invalidation and routing effects remain later integrations; a version bump
alone does not demonstrate those behaviors.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| B-01 | Approved role/admission/eligibility contract and P1-U1 handoff are recorded; deferred setup/recovery/routing rules remain explicit. Role persistence follows approved cardinality and retains a's constraints. | AC-01 authority portion |
| B-02 | Same-named operator/staff and two-tenant fixtures resolve only through their qualified plane. Foreign IDs, client role/tenant input and unknown stored roles grant no authority; hashes are absent from snapshots. | AC-04 authority portion |
| B-03 | Matrix covers all four tenant states and approved account/credential states, missing/malformed records and database interruption. Only canonical eligible results carry authority; loading failure is safely unavailable. | AC-06 |
| B-04 | Role/status/credential and tenant-status mutations atomically advance relevant versions with audit. Stale/failed writes and forced audit failure leave all canonical facts unchanged; no-ops do not advance versions. | AC-07 mutation portion |
| B-05 | Independent connections observe coherent committed snapshots during concurrent writes; suspend/reactivate leaves previous authority versions stale. Conflicts do not silently restore privileges. | AC-07 consistency portion |
| B-06 | Qualified target checks, actual grants and retained append-only audit pass. Synthetic identity/credential sentinels are absent from snapshots, diagnostics, audit metadata and client exports. | AC-10 authority portion |
| B-07 | Focused authority checks, a regressions and existing Docker checks pass; contract/evidence record versions, admission matrix, exact commands and limitations. | AC-11 scoped checks/docs |

Use a's isolated real PostgreSQL fixtures and actual runtime credentials, with
independent connections/barriers for concurrent reads and mutations. Trusted
test administration may inject malformed rows or controlled audit failures solely
within disposable fixtures. Pure rule tests supplement database checks; they
cannot replace canonical isolation/transaction proof.

Extend `./dev exec pnpm check:identity-foundation` with a documented focused
selection for b and required a regressions. The command/selection is provisional
and does not exist at preparation. Run it plus `./dev check` and record exact
results. Documentation preparation needs consistency, link and whitespace checks.

## Completion and handoff

Complete b only when B-01–07 pass. Hand
[c](p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md) approved operator
eligibility, plane-specific snapshots, coherent read and atomic mutation/audit
contracts, relevant grants and the combined a/b fixtures/checks. Future P2-U2
must use canonical status/version validation rather than trusting cached roles.
b completion does not prove password verification, session revocation,
two-replica authentication or parent completion.
