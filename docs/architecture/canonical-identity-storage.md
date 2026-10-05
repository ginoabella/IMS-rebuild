# Canonical identity storage — P2-U1a

Status: implemented and verified 2026-10-05 14:07 +08:00 (Asia/Manila). This document
records the storage implementation for [P2-U1a](../../context/feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md).
The user explicitly approved D-05 account/credential representation and associated
storage rules for this unit on 2026-10-05. This is the scoped P1-U1 handoff for a;
P1-U1 remains deferred. Roles, admission, authentication, password policy,
setup/reset tokens, sessions and bootstrap execution remain with their later
units and decisions. Check results are recorded separately as acceptance evidence. Subsequent b
adds approved roles/admission and full authority mutations; see the
[authority contract](canonical-authority-admission.md). The a-only boundary
below records what a delivered at its checkpoint. c subsequently completed the
[bootstrap handoff](canonical-operator-bootstrap.md); see
[integrated parent evidence](../status/p2-u1c-evidence.md).

## Identifier contract

Use backend normalization on creation and lookup: JavaScript `trim()`, then
locale-independent ASCII lowercase. Accept only ASCII letters, digits, underscore,
hyphen and period; canonical values match `[a-z0-9][a-z0-9_.-]*`.
Tenant codes have 1–64 characters; usernames have 1–128 characters. Reject internal
whitespace, unsupported Unicode and empty/overlength results. Outer whitespace
uses JavaScript's trim definition; SQL accepts only the resulting ASCII canonical
value and rejects unnormalized writes. ASCII upper-case maps to lower-case;
unsupported Unicode never becomes supported through case, accent or compatibility
folding. Repeating normalization yields the same identifier. Passwords do not use
these functions.

Use PostgreSQL text columns with `COLLATE "C"`, explicit canonical regular
expressions and length checks; uniqueness compares canonical ASCII bytes.
Noncanonical direct SQL is rejected rather than rewritten. Identifier limits apply
to the canonical result. Display names are separate from identity codes.

## Storage and ownership boundary

Tenancy owns `public.tenants`; identity owns `public.staff_users`; platform owns
`public.platform_operators` and durable initial-bootstrap provenance. The operator
store has no tenant column. Staff ownership uses a non-null UUID tenant reference
with restrictive update/delete foreign keys. Tenant codes remain globally unique
across every status and immutable from first insertion. Staff uniqueness is
`(tenant_id, normalized_username)` across every account state; staff tenant IDs
are immutable. Immutable IDs and ownership require triggers in addition to runtime
column privileges. Retirement never releases a tenant code.

Approved account vocabulary: `active`/`disabled`. Approved credential vocabulary: `unset`/`ready`. Unset has null hash and last-change timestamp;
ready requires both. Callers must supply states explicitly; no eligible creation
default is selected. Password hashing,
policy, setup/reset tokens and bootstrap execution belong to later units.
Credential facts reside once in the owning identity row. General staff/operator read DTOs exclude usernames and
hashes; any later verifier gets a private credential-specific port.

Persist UUID IDs, creation/update timestamps, positive row versions and positive
account authentication or tenant authority versions. b defines the complete
mutation and authority-version rules and role schema. a must not add speculative
role columns, eligible admission or general lifecycle commands.

## Transactions and grants

Reuse the deployment advisory lock and Prisma SQL history. Runtime processes
never migrate. Repositories receive the existing same-connection `Transaction`;
application mutations must append audit atomically with the write and reject stale
expected versions. No independent repository transaction or external effect is
allowed. b owns the full mutation contract; trusted isolated fixtures can exercise
storage without creating production use cases.

Versioned runtime grants: tenant/staff reads, explicit inserts and updates to mutable
columns, excluding stable IDs, tenant codes and staff ownership. Operator reads
exclude hashes from general DTOs. Operator creation and bootstrap provenance
writes remain deployment-only; b's approved runtime operator status/credential
updates need a narrow column grant or typed capability, without granting bootstrap
insertion. No runtime schema ownership, trigger bypass, deletes or truncates.
New identity foreign keys do not modify historical audit references or foundation
fixtures. Append-only audit protections remain in force.

Safe outcomes must distinguish invalid input, duplicate identity, missing or
foreign-qualified records, stale writes and database unavailability. SQL error
messages, usernames and hashes never enter public errors or general diagnostics.
A read failure must not return missing or grant authority.

## Verification plan and handoff

Run `./dev exec pnpm check:identity-foundation --storage` for this unit
(`--storage` selects a regressions; the default now includes b authority and c bootstrap checks). It is integrated into
`check:foundation`, and therefore `./dev check` and existing CI. Use unique disposable PostgreSQL databases, the real
deployment entry point for fresh/rerun migration, runtime credential assertions,
independent connections and held transactions as race barriers. Teardown must
remove only the database created by the current run.

Cover A-01–07: canonical/invalid identifiers, all tenant statuses, retired-code
collision, immutable codes and ownership, two-tenant username equality, duplicate
and foreign-key rejection, concurrent inserts, wrong-plane/foreign-qualified
repository access, runtime bootstrap denial, retained audit, synthetic sentinel
absence and existing `./dev check` regression verification. Update any existing
checks that assert the exact migration count when adding a migration; preserve
their fresh/rerun assertions.

Foundation source inspection confirms `Transaction.query()` uses the active pooled
connection and marks failed required writes for rollback. `AuditRepository.append()`
uses that handle. `migrate()` holds the deployment lock across Prisma deployment
and runtime credential provisioning. Their prior
results are in [P1-U3 evidence](../status/p1-u3-evidence.md) and
[P1-U5a evidence](../status/p1-u5a-evidence.md).

Verified handoff to b: canonical normalization,
qualified repository ports, IDs/versions, grants and isolated fixtures.
See [acceptance evidence](../status/p2-u1a-evidence.md). c consumes
the operator credential/provenance contract through b's verified foundation.
At a's checkpoint roles, admission, authentication, sessions and bootstrap
were unimplemented. b adds roles/admission; authentication, sessions and
bootstrap remain later.

## Repository contract for b

`TenantRepository.find` normalizes a code and returns the canonical tenant record.
`StaffRepository.lookup` requires `plane: tenant`, canonical tenant UUID and a
username; `find` and `rename` require `(plane, tenantId, staffId)`.
`OperatorRepository.find/lookup` require `plane: platform` and query only the
operator store. They provide storage snapshots, without roles or authority grants.
The caller-owned `modules/platform/application/tenant-registry.ts` port is
implemented by tenancy; canonical tenant types live in tenancy/domain. Platform
administration consumes this typed registry capability; platform stores no tenant facts. No public controller is registered.

Creation receives a caller-generated UUID matching the transaction audit target.
Staff creation also requires the target tenant to match. All fields and states
are explicit. Rename methods lock the qualified record, check its expected row
version, update and append `identity.storage.changed` atomically. Display-name
changes advance tenant row version only; staff username changes advance row and
authentication versions. Identical canonical values are no-ops with no version or
audit advance. Stale/foreign writes change nothing. Complete role/status/credential
and tenant-status mutation rules remain b's responsibility; no general lifecycle
or credential-management API is supplied here.

SQL writes and audit failures poison the existing transaction handle, even if a
repository returns a safe failure variant inside the callback. The outer
`Transaction.run` must then reject and roll back; callers must not treat an inner
`found` result as committed until the transaction resolves. Expected input,
missing and stale checks perform no mutation. Repository outcomes contain only
`found`, `invalid`, `duplicate`, `missing`, `stale` or `unavailable`; SQL exceptions
are mapped in the database adapter, without raw messages. Infrastructure failure
at connection acquisition/commit is still handled by the owning application
boundary using the existing safe diagnostics. This unit exposes no application
endpoint that could turn that failure into a public response.

Row and authority counters use positive PostgreSQL integers, starting at 1.
The largest integer cannot be incremented and fails safely with rollback; callers
must not reset counters. PostgreSQL also rejects row or authority counter
regressions; b supplies the complete atomic increment rules. Mutable column grants permit b's audited updates while
excluding ID, original timestamp, code and tenant ownership. Direct runtime SQL
proves persistence constraints, not business authorization. A b-owned use case
must still enforce roles, expected versions and audit. Operator INSERT and
bootstrap provenance access remain deployment-only, while runtime has the mutable
operator-column updates needed by later authenticated use cases. No trusted
bootstrap function, command or implicit operator creation exists in a.

Credential hashes have a 4096-byte storage ceiling and nonempty ready values.
a enforces metadata coherence; c owns hash algorithm/parameter encoding and
verification. Synthetic fixture hashes prove storage only. Database hash access
is server-only; general records never select or return the hash or username.
Staff rename reads the canonical username privately while holding a row lock,
then returns the general projection. No hash primitive
or credential access is exported to shared client contracts.
