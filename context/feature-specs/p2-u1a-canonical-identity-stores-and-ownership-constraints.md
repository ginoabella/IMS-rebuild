# P2-U1a — Canonical identity stores and ownership constraints

## Status and purpose

- **Status:** planned; implementation has not started.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U1 parent scope and acceptance matrix](p2-u1-canonical-identities-and-tenancy-admission.md).
- **Goal:** establish database-enforced tenant-qualified identities and a separate
  tenantless operator store.
- **Completion boundary:** real PostgreSQL accepts valid canonical records and
  rejects normalization, uniqueness, ownership and immutability violations,
  including direct runtime SQL and concurrent writes.

The user adopted the three-spec split. The parent owns shared scope, exclusions
and AC-01–11; this spec owns persistence and identifier contracts. Creating the
split does not approve pending product decisions or authorize runtime implementation.

## Starting state and dependencies

P1-U3 provides PostgreSQL, deployment-coordinated migrations, typed configuration,
restricted runtime credentials and health. P1-U5 provides explicit transaction
handles, append-only audit and safe diagnostics. Recheck their evidence and current
source before implementation; the parent records the inspected foundation state.

P1-U1 remains deferred. Record a partial handoff covering this unit before starting.
Resolve D-05's account/credential state representation before encoding dependent
constraints. D-01's role cardinality and grants remain owned by b; a must not freeze
an unapproved role schema. Do not choose eligible initial account defaults or
credential policy from the proposed P1-U1 contracts. Independent design/check
preparation may continue while the relevant decisions are pending.

## Scope and ownership

Allowed changes: `modules/tenancy/` tenant persistence, `modules/identity/` staff
persistence, `modules/platform/` operator persistence, normalization/domain types,
module-owned SQL repositories, migrations/grants, isolated database fixtures,
focused check wiring and identity storage documentation.

Tenancy owns the single tenant registry. Platform administration consumes its typed
port; it does not maintain another tenant table. Keep operator/staff stores separate
even when credential primitives are shared. Use the established deployment lock
and migration history; HTTP and other runtime processes never migrate.

Do not add role bundles, admission decisions, public CRUD/fixture endpoints, session
storage, sign-in screens, bootstrap execution, recovery tokens, onboarding details,
responders, telephony records or cleanup policies. b owns role/admission behavior;
c owns password hashing and trusted bootstrap execution.

## Identifier and ownership contract

Normalize codes and usernames with shared backend functions: trim outer whitespace
and apply documented locale-independent lowercase. Use the same functions for
creation and lookup. Normalization must be idempotent. Internal whitespace is not
silently removed; passwords never pass through identifier normalization.

Document supported characters, finite lengths and Unicode/collation handling before
implementation. Application and SQL must accept the same canonical values. Do not
silently add accent or compatibility folding. Reject noncanonical direct SQL
writes rather than creating a second interpretation of an identifier.

Enforce in PostgreSQL:

- Globally unique, nonempty, bounded normalized tenant codes across all statuses.
- Immutable tenant codes from first insert, including draft and retired records.
  Editable display names never change login identity; retirement never frees a code.
- Non-null staff tenant ID with a restrictive tenant foreign key and
  `UNIQUE (tenant_id, normalized_username)` across all account statuses.
- Immutable staff tenant ownership. Reparenting is rejected; a future approved
  workflow may create a new identity for another tenant.
- A separate tenantless operator store with unique normalized operator usernames.
  Username equality with a staff record never shares identity or authority.

A repository API receives an explicit identity plane and, for staff by ID, the
canonical tenant qualification. A foreign `(tenant_id, staff_user_id)` returns a
typed missing/denied result and cannot modify that record. UUID uniqueness alone
does not establish plane or ownership. Creation validation may precheck collisions,
but database constraints settle simultaneous inserts without partial records.

## Records, transaction boundary and privileges

Persist stable IDs, timestamps and positive concurrency/authority versions as
defined in the parent. Tenant status uses the overview's draft/active/suspended/
retired vocabulary. Account and credential states use the approved D-05 vocabulary.
Keep credential state, optional password hash and last-change metadata under the
owning identity module; do not duplicate these facts in multiple stores. The hash
will encode its algorithm/parameters when c creates a usable credential.

Provide storage for durable initial-bootstrap provenance without creating an
operator implicitly. c defines the command's atomic creation/rerun behavior. No
production tenant/staff/operator seed data is added to migrations.

Business write repositories accept the existing same-connection transaction handle.
Do not start their own transactions or external effects. b supplies the complete
version/audit mutation contract; c uses it for bootstrap. Any application mutation
introduced in a must already obey the parent's atomic write/audit rule. Fixtures
may seed isolated records through trusted tooling without creating public use cases.

Version/grant migrations explicitly. Runtime privileges cannot change tenant codes,
reparent staff, bypass constraints, acquire schema ownership or execute the trusted
bootstrap path. Verify the chosen privilege mechanism works with b's necessary
runtime operations; document any narrower trusted operator-store write capability.
Preserve append-only audit and existing historical actor/target references. New
tenant foreign keys apply to tenant-owned identity data, not retroactively to
foundation audit fixtures. No cascade deletes retained history.

Map invalid input, duplicate identity, missing/foreign ownership, stale writes and
database failure to safe typed outcomes. Do not emit usernames, password hashes,
SQL details or raw exception messages in logs/errors. No database-unavailable
result can masquerade as a successful write or a missing-record authority decision.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| A-01 | Storage contract records normalization, bounds/collation, state representation, versions, grants and the relevant approved handoff; unresolved roles/admission remain explicit. | AC-01 storage portion |
| A-02 | Fresh migrations and rerun pass on real PostgreSQL; actual runtime SQL rejects empty/noncanonical/overlength codes, global collisions, code updates and retired-code reuse. Display-name changes preserve identity. | AC-02 |
| A-03 | Two tenants hold the same normalized staff username. Same-tenant duplicates, missing tenant references, foreign qualified writes and reparenting fail, including concurrent inserts. | AC-03 |
| A-04 | Operator records have no tenant association and remain distinct from same-named staff records. Wrong-store and foreign-qualified repository access fails; runtime cannot invoke trusted bootstrap writes. | AC-04 storage/privilege portions |
| A-05 | Case/outer-whitespace variants produce the documented resolution/collision; normalization is idempotent. Internal whitespace/unsupported input and SQL normalization agree. Password input is never normalized. | AC-05 |
| A-06 | Restricted grants, restrictive ownership and retained audit protections pass direct-SQL checks. Synthetic identity/hash sentinels are absent from diagnostics and general DTOs; client exports contain no credential access. | AC-10 storage portion |
| A-07 | Focused database checks and existing Docker checks pass; contract/evidence describe exact commands, fixture isolation and limitations. | AC-11 scoped checks/docs |

Use uniquely identified disposable PostgreSQL databases, separate connections and
barriers for collision races. Runtime credentials perform constraint/privilege
assertions; trusted deployment credentials only migrate and administer fixtures.
Clean up only the current run's resources. Test doubles cannot prove SQL
constraints, migration safety or actual grants.

Implement the storage portion of the provisional parent command
`./dev exec pnpm check:identity-foundation`; provide a documented focused selection
for a. The command/selection does not exist at preparation. Run the focused checks
and `./dev check`, recording evidence. Documentation preparation requires link,
consistency and whitespace review only.

## Completion and handoff

Complete a only when A-01–07 pass. Hand
[b](p2-u1b-role-contracts-and-canonical-tenancy-admission.md) the normalization,
module-owned repositories, canonical IDs/versions, schema/grants and isolated
fixtures. Hand [c](p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md)
the operator/credential/provenance storage contract through the b-verified foundation.
Document any schema extension b needs for approved roles instead of adding a
speculative representation now. a completion proves ownership/storage, not
admission, authenticated sessions, bootstrap or parent completion.
