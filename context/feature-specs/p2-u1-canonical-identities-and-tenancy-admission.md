# P2-U1 — Canonical identities and tenancy admission

## Status and purpose

- **Status:** in progress; a complete with A-01–07 evidence, b/c remain planned; parent acceptance incomplete.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [Phase 2, P2-U1](../implementation-plan.md#p2-u1--implement-canonical-identities-and-tenancy-admission).
- **Goal:** establish canonical identity, tenant ownership and admission rules for
  later authentication and administration.
- **Completion boundary:** real PostgreSQL constraints enforce tenant-qualified
  identities; backend consumers can load canonical authority through typed ports;
  a trusted command securely creates the first tenantless operator and safely
  handles repeated, concurrent and interrupted execution.

Sources: [overview](../project-overview.md), [architecture](../architecture.md),
[UI context](../ui-context.md), [standards](../code-standards.md),
[workflow](../ai-workflow-rules.md), and [progress](../progress-tracker.md).
This document specifies intended behavior. It does not approve pending product
rules, start implementation, or establish that Phase 2's session gate has passed.

## Starting state and dependencies

Required plan dependencies are P1-U1, P1-U3 and P1-U5. P1-U3 and P1-U5 are recorded
complete with [database evidence](../../docs/status/p1-u3-evidence.md) and
[durability evidence](../../docs/status/p1-u5c-evidence.md). They provide PostgreSQL,
deployment-coordinated migrations, restricted runtime credentials, explicit
transaction handles, safe logging, append-only audit and durable execution.

P1-U1 remains deferred. Its [decision register](../../docs/planning/p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation)
and [product contracts](../../docs/planning/p1-u1-product-contracts.md) are drafts.
D-01 role grants/combinations and D-06 lifecycle rules explicitly affect P2-U1.
D-05's credential policy also affects a usable bootstrap credential. Resolve the
relevant portions before dependent implementation; unrelated incident, dispatch,
PBX and recovery decisions need not be pulled into this unit. Record any approved
partial P1-U1 handoff rather than treating its deferred status as completion.

At preparation, source inspection found only audit under backend business modules,
health transport contracts, foundation/audit/worker migrations and a deployment
entry point supporting migration. There are no canonical tenant, staff or platform
identity tables, role/admission services, password adapter or operator bootstrap
command. Existing storage ownership fixtures do not supply real identities.
Recheck code and evidence when implementation starts; runtime checks were not
repeated for this documentation task.

## Scope and ownership

| Boundary | Responsibility in this unit |
| --- | --- |
| `modules/platform/` | Separate operator identity store, tenant registry administration port, trusted operator bootstrap use case and platform audit. |
| `modules/tenancy/` | Canonical tenant record, immutable normalized code, lifecycle/admission vocabulary, admission rules and tenant authority version. |
| `modules/identity/` | Tenant staff identities, tenant-qualified lookup, approved role representation, credential metadata, account authentication versions and canonical authority ports. |
| Database / deployment | Module-owned migrations, constraints, indexes, least-privilege grants, secure password adapter and listener-free bootstrap command. |
| Configuration / checks / docs | Necessary validated server-only settings, real-database fixtures, focused check wiring, identity contract, bootstrap runbook, evidence and tracker. |

The tenancy module owns tenant facts; platform administration invokes its small
typed port instead of owning a second registry. Staff and operator credentials
remain with their respective identity owners; a shared password-hashing adapter
may serve both without merging stores or authority planes. Cross-module consumers
use typed ports, not direct queries into another module's tables.

No browser or mobile changes are required. P1-U4 shells remain the interface
foundation for later sign-in/admin units. Add shared transport schemas only when
a named consumer needs them; backend-only ports need not become public contracts.

Out of scope: Redis sessions/tokens/guards/rate limits (P2-U2), platform sign-in
and logout (P2-U3), staff sign-in/setup/reset/recovery and mobile token storage
(P2-U4), tenant onboarding UI/profile/default coordinates (P4-U1), live lifecycle
actions and routing effects (P4-U3), staff administration UI (P4-U4), responder
profiles, telephony inventory, public intake and production provisioning. No
unauthenticated tenant/staff CRUD endpoints, fixture routes or default production
tenants are introduced to make this foundation verifiable.

## Identity and storage contracts

### Normalization and ownership

Use one backend normalization function per identifier: trim leading/trailing
whitespace and lowercase using a documented, locale-independent rule. Apply it
on creation and lookup, including operator usernames. Normalization is idempotent;
passwords are never trimmed, lowercased or otherwise identifier-normalized.
Internal whitespace is not silently removed. Specify supported characters and
finite length bounds consistently in validation and SQL before implementing;
do not add accent folding or Unicode compatibility folding implicitly.

Tenant display names are editable and never login identifiers. Store a single
canonical normalized tenant code; preserve display casing only for an actual
consumer. Tenant codes are immutable after insertion, including while draft or
retired, and globally unique across all lifecycle states. Retirement does not
free a code for reuse.

Each staff identity has exactly one non-null tenant ID and normalized username.
The database enforces `UNIQUE (tenant_id, normalized_username)` and a restrictive
foreign key to tenants. The same normalized username may exist in two tenants;
it cannot collide within one tenant, including for inactive accounts. Reparenting
a staff identity is rejected; moving a person requires a new tenant identity in
a later approved administration workflow.

Platform operators occupy a separate identity store with no tenant column or
tenant staff role. Their normalized usernames are unique in that store. A platform
username may also occur in a staff store without sharing identity or authority.
All references carry their identity plane; an unqualified user ID never selects
between stores or resolves tenant access.

Enforce normalization, nonempty/bounded identifiers, uniqueness, restrictive
ownership and code immutability in PostgreSQL as well as application validation.
Prove direct SQL cannot bypass these invariants using actual runtime credentials.
Use constraints, triggers or column privileges as appropriate, with migrations
and deployment ownership kept out of runtime. Application prechecks improve
errors; the database settles concurrent collisions.

### Canonical records and versions

| Record | Required canonical facts |
| --- | --- |
| Tenant | Stable ID, normalized immutable code, editable display name, `draft`/`active`/`suspended`/`retired` status, authority version, row concurrency version and timestamps. |
| Staff identity | Stable ID, immutable tenant ID, normalized username, approved account status and roles, credential state, authentication version, row version and timestamps. |
| Platform identity | Stable ID, normalized username, approved account status, platform operator authority, credential state, authentication version, row version, timestamps and durable initial-bootstrap provenance. |
| Credential metadata | Owning identity, password hash when ready, algorithm/parameters encoded with the hash, credential state and last-change timestamp. |

These are logical facts, not a mandate for separate tables per row. Keep one
authoritative representation and avoid duplicating credential or role state.
Role cardinality, grants and account/credential state names depend on D-01/D-05;
do not adopt the draft's multiple-role bundles or initial-status rules implicitly.
Setup/reset token records and delivery mechanisms belong to P2-U4.

Use positive monotonic versions. Row versions detect stale writes; authentication
and tenant authority versions detect stale authority. Their update rules must be
explicit even if an implementation shares a counter. Account status, role or
credential changes advance account authentication authority atomically; tenant
status changes advance tenant authority atomically. A suspend/reactivate cycle
must never make an old session snapshot current again. No-op writes and failed
transactions do not advance versions or fabricate success audit.

Canonical writes use existing same-connection transaction conventions. For any
mutation exposed within this unit, check the expected version, update the relevant
facts/authority version and append audit in one transaction. A stale writer gets
a typed conflict with no partial changes. Avoid adding general lifecycle or
credential-management commands solely to demonstrate version changes; isolated
fixtures can exercise the repository contract. Later owning use cases must reuse
the same atomic write rules.

Do not cascade identity/tenant deletion into retained audit or outbox history.
Existing audit actor/target references deliberately survive resource deletion;
new tenant ownership foreign keys must not retroactively invalidate historical
foundation fixtures. No account purge, retention schedule or code reuse is added.

## Admission and authority contracts

Provide separate canonical read ports for platform and staff consumers. The
staff path resolves normalized tenant code, then username within that tenant;
administrative/credential actions require `(tenant_id, staff_user_id)`. An ID
from another tenant returns a missing/denied result and cannot read or mutate the
foreign record. Operator lookup is tenantless and uses its own store.

Authority results form a discriminated union: a platform result has an operator
ID and platform authority, while a staff result has a staff ID, canonical tenant
ID and approved tenant roles. Return current account/credential status and
authentication version; staff results also carry tenant status/authority version.
Never infer roles or tenant membership from request fields, a fixture context,
username equality or an existing audit reference. Keep credential hashes out of
general authority/identity DTOs; only the private credential verifier needs them.

Ordinary staff admission requires an active tenant, eligible account and ready
credential under the approved contract. Missing tenant/account, malformed stored
authority, draft/suspended/retired tenant, unknown role or non-ready credential
denies admission. Loading failures return a bounded unavailable outcome and grant
no authority. Platform admission is independent of tenant state and never grants
staff authority. Code/name resolution is a private backend capability, not a
public tenant directory.

P2-U1 establishes eligibility results and canonical snapshots, not authenticated
sessions. P2-U2 validates status/version on protected operations, P2-U3/U4 verify
credentials and map invalid authentication combinations to the specified generic
response, and P4-U3 implements approved transitions/telephony coordination.
Any draft-tenant credential setup exception must be explicitly approved and
implemented through P2-U4's narrow setup capability; it is never ordinary staff
admission. Snapshot reads use the primary database and a consistent read so
mixed old roles/new versions cannot create authority.

## Trusted operator bootstrap

Extend the existing deployment entry point with an explicit bootstrap command;
document its final launcher during implementation. It runs with trusted deployment
access, opens no HTTP listener and starts no worker or PBX observer. Starting HTTP
or running migrations never creates an operator implicitly. Verify migrations
before bootstrap; missing schema/settings fail with a safe nonzero result.

Receive the initial operator username and password through a documented protected
input path. Passwords must not occur in command-line arguments, shell history,
source, default configuration, logs, audit, runbook examples or client bundles.
Use hidden interactive input or a protected secret input for automation; input
and temporary buffers/files must be bounded and cleaned up. No default password
or automatic insecure credential generation. Store only an appropriate salted
password hash; record the approved password policy and chosen hashing parameters.
Hashing is bounded and completed before the database write transaction.

Serialize bootstrap creation with a database lock and uniqueness constraints.
The initial operator, ready credential metadata and initial-bootstrap provenance
commit together with a system-attributed audit event identifying the trusted
command and bounded reason. The first operator cannot truthfully be its own
authenticated initiating actor. Reuse the existing audit context and safe metadata
allowlist; never log the username, password or hash.

A matching rerun returns the existing initial operator result without resetting
its credential, roles, status or authentication version, creating another operator,
or appending another creation event. A different requested identity, an unrelated
preexisting username, conflicting provenance or an ineligible existing bootstrap
account returns a safe conflict requiring the later approved recovery workflow.
Bootstrap is not password reset, account reactivation or operator recovery.
Validate rerun secret handling without silently replacing stored credentials.

Concurrent runs converge on one committed initial operator. Failure before commit
leaves neither a partial identity nor success audit. If the caller loses the commit
response, a rerun inspects durable provenance/result and reports the existing
identity safely. A process restart uses the same canonical database result; no
local receipt or marker is authoritative. Ordinary runtime credentials cannot
perform the trusted bootstrap operation. Test tenants/staff remain isolated
fixtures and are never created by bootstrap or production migrations.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Identity/admission contract records normalization, role/status representation, credential policy, versions and the approved P1-U1 handoff. Pending D-01/D-05/D-06 portions remain clearly pending and no fixture is represented as product approval. |
| AC-02 | Fresh migration and rerun succeed against real PostgreSQL; direct runtime SQL rejects empty/noncanonical/overlength codes, normalized duplicates, code updates and code reuse after retirement. Display-name edits preserve the code. |
| AC-03 | Two fixture tenants hold the same normalized staff username. Same-tenant duplicates, missing/foreign tenant ownership and staff reparenting fail, including concurrent insert races and direct runtime SQL. |
| AC-04 | Operator records remain tenantless and distinct from same-named staff records. Wrong-plane lookups, tenant-qualified foreign user IDs and unknown roles grant no authority. Public/runtime bootstrap access is unavailable. |
| AC-05 | Normalization is idempotent and identical on writes/lookups; case/outer-whitespace variants resolve or collide as specified. Internal whitespace/unsupported input follows the documented rule and password bytes remain unchanged. |
| AC-06 | Admission matrix covers every tenant state, approved account/credential states, missing records and database interruption. Only eligible canonical snapshots return authority; stale/malformed or unavailable inputs grant none. |
| AC-07 | Account role/status/credential and tenant-status changes advance the relevant authority versions atomically with audit; failed/stale writes roll back. Suspend/reactivate does not restore an old version. Independent connections observe committed coherent snapshots. |
| AC-08 | Bootstrap creates one eligible tenantless operator with a verifiable password hash and trusted system audit. Matching reruns preserve hash/status/roles/versions; conflicting requests are rejected. Concurrent processes create one result and one creation event. |
| AC-09 | Interrupted/failed bootstrap, forced audit failure and ambiguous commit recovery leave no partial identity or falsely reported success. Restart/rerun resolves durable result; fixtures/default tenants are absent from deployment provisioning. |
| AC-10 | Synthetic password/hash/identity-input sentinels do not enter logs, audit metadata, errors, evidence or client bundles. Runtime grants protect bootstrap writes; audit remains append-only and restrictive tenant references preserve integrity/history. |
| AC-11 | Focused identity checks and existing required Docker checks pass. Contract/runbook/evidence cover bootstrap input, safe rerun/conflicts, versions, fixture teardown and later-unit boundaries. |

Use actual PostgreSQL and actual runtime grants, with deployment credentials only
for migrations, trusted bootstrap and isolated fixture administration. Fixtures
use unique disposable databases/namespaces and clean up only their own resources.
Use independent connections/processes and barriers for races and commit visibility;
in-memory repository doubles do not prove constraints or concurrency. Admission
checks verify canonical eligibility, not sign-in, route guards or two-replica session
enforcement. Those require P2-U2–U4 and the Phase 2 gate.

Add a focused command, provisionally `./dev exec pnpm check:identity-foundation`,
with selected child checks during implementation. That command does not exist at
spec preparation. Integrate reproducible checks into the required foundation/CI
sequence and run the focused command plus `./dev check`; record actual commands,
environment, results and limitations. This documentation task requires consistency,
relative-link, acceptance-coverage and whitespace review, not runtime tests.

## Review and adopted implementation sub-units

**Review conclusion: split into three sequential sub-units.** Storage constraints,
canonical authority rules and trusted provisioning have distinct completion paths.
Each can be verified independently, while the parent retains the combined outcome.
The user adopted this split on 2026-10-05. The three child specs below define the
sequential implementation boundaries; a is complete, b/c remain planned. Approval of the split
does not approve pending product decisions or start runtime implementation.

| Unit | Starting state and scope | Result, checks and acceptance coverage |
| --- | --- | --- |
| [P2-U1a — Canonical identity stores and ownership constraints](p2-u1a-canonical-identity-stores-and-ownership-constraints.md) | Verified P1-U3/P1-U5 and recorded P1-U1 handoff for its scope; normalization, tenant/operator/staff records, credential metadata, versions, constraints/grants and repositories. Do not commit unapproved role cardinality. | Real-database fresh/rerun and direct-SQL ownership/immutability checks; two-tenant username and concurrent collision checks. Owns AC-02–03, AC-05, storage portions of AC-04/AC-10 and its AC-01/AC-11 documentation/checks. |
| [P2-U1b — Role contracts and canonical tenancy admission](p2-u1b-role-contracts-and-canonical-tenancy-admission.md) | Verified a plus approved D-01 and relevant D-05/D-06 rules; role persistence as needed, plane-tagged ports, admission matrix, coherent snapshots and atomic authority-version/audit write contracts. | Canonical eligible/denied/unavailable outcomes, foreign-ID and wrong-plane rejection, rollback/stale-write/version tests with independent connections. Owns AC-06–07, authority portions of AC-04/AC-10 and its AC-01/AC-11 documentation/checks. |
| [P2-U1c — Secure operator bootstrap and foundation handoff](p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md) | Verified a/b plus approved bootstrap credential policy; bounded password adapter, protected input, deployment command, durable provenance, rerun/concurrency/interruption behavior and combined checks/runbook. | Actual command creates one ready operator, matching rerun preserves it, conflicts fail safely and interruption recovery passes. Owns AC-08–09, final AC-04/AC-10 integration and combined AC-01/AC-11. |

All AC-01–11 are covered. Each child includes its own verification and docs;
there is no separate testing/documentation implementation unit. Role policy stays
with admission, bootstrap stays with secret handling and recovery, and database
constraints stay with their real-database proof. Do not split into a broad schema
phase followed by unrelated backend/UI work or start P2-U2 before the parent passes.

The split refines P2-U1 without changing top-level plan IDs or Phase 2 order.
Completing a does not establish role/admission authority; completing b does not
establish secure provisioning. The parent completes only when a/b/c and every
acceptance criterion pass. Reassess child boundaries after approved decisions;
a decision requiring later behavior must be recorded as a dependency rather than
implemented early or disguised as a fixture.

## Decision gates and review findings

| Gate | Owner and required resolution | Dependent work / resume condition |
| --- | --- | --- |
| P1-U1 partial handoff | User; record which identity/admission contracts are approved while unrelated product decisions remain deferred. | Before implementation starts, reconcile the plan dependency and affected child scope in the tracker. Do not mark P1-U1 complete from this spec. |
| D-01 | User; approved role names, allowed combinations/cardinality and permission bundles, including separation of platform and tenant authority. | b and parent completion; a must not freeze an unapproved role schema. |
| D-06 relevant portion | User; approved tenant admission/lifecycle contract. Active-only ordinary staff access already follows architecture; draft setup exceptions and transition effects remain pending. | b admission contract and parent completion; PBX/active-work coordination stays in P4-U3. |
| D-05 relevant portion | User; account/credential eligibility and bootstrap password policy. Hash implementation/parameters are routine technical choices documented and checked during implementation. | Dependent metadata constraints in a, eligibility in b and credential creation in c. Delivery/reset/recovery/last-admin rules stay gated for P2-U4/P4. |

The review found no need to expand into sessions, authentication UI or tenant
onboarding. The material dependency is deferred P1-U1, not missing infrastructure.
The required two-tenant database fixtures prove namespace/ownership behavior only;
they cannot approve role/lifecycle choices or demonstrate session-plane isolation.
Keep that limitation explicit when reporting parent or child completion.
