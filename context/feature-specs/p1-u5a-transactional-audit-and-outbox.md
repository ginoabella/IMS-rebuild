# P1-U5a — Transactional audit and outbox

## Status and purpose

- **Status:** complete; 2026-10-04 19:11 +08:00 (Asia/Manila).
- **Split prepared:** 2026-10-04 18:40 +08:00 (Asia/Manila).
- **Requirement:** Phase 1 P1-U5, transaction and audit foundation.
- **Goal:** commit a sample change, actor-attributed audit and durable work intent
  atomically, with append-only history and safe correlation context.
- **Completion boundary:** trusted fixture through commit/rollback and inspection
  of persisted audit/outbox records. Worker execution is P1-U5b.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md)
and [progress tracker](../progress-tracker.md). Follow the
[parent overview and acceptance matrix](p1-u5-transactional-audit-and-durable-execution.md).
Deferred P1-U1 product recommendations remain unapproved. Criteria describe
required behavior, not verification already performed.

## Starting state and dependencies

P1-U3 is complete and required: shared PostgreSQL/PostGIS, typed configuration,
restricted `myims_runtime` role and deployment-coordinated Prisma/SQL migrations.
P1-U2 supplies independent process entry points and quality checks. Inspection at
parent drafting found baseline-only schema, no audit/outbox module and an empty
worker module. Recheck code and prior evidence before implementation.

Trusted fixture actor references avoid premature identity, tenant and incident
tables. Structural attribution checks do not prove authentication or permissions;
those arrive in P2 and the owning domain units. P1-U4 is not a dependency.

## Scope and ownership

- `services/backend/src/modules/audit/`: contracts, write port and SQL repository.
- Backend infrastructure: transaction-bound connection/context, outbox write
  repository and safe logging/correlation utilities.
- Deployment/database: versioned audit/outbox constraints, indexes and runtime
  grants, reusing the existing deployment lock.
- Configuration/testkit and documentation: needed validation, isolated fixtures,
  focused checks, write-contract documentation and tracker/evidence updates.

Feature use cases retain business-write ownership; audit owns audit records and
infrastructure owns transport intent. Add shared contracts only for a named
consumer. Applications never write these tables directly.

Out of scope: queue provisioning, dispatcher loops, pg-boss handlers, identity or
business tables, public sample routes, UI, incident timelines, retention cleanup,
manual recovery tools and production infrastructure. No second queue or service.

## Transaction and audit contract

1. A use case receives trusted execution context and opens one PostgreSQL
   transaction. Its business write, audit append and outbox insert use the same
   transaction-bound connection. Passing a repository that silently uses another
   connection is invalid. External calls and queue publication stay outside it.
2. Any required audit/outbox failure rolls back the whole action. The caller
   receives success only after commit. Rollback leaves no sample change, audit
   event, outbox work or externally observable delivery.
3. Audit events carry an immutable ID, event type/schema version, database-recorded
   timestamp, actor kind/reference and identity plane, canonical tenant scope
   where applicable, target type/reference, correlation ID and bounded,
   event-specific safe metadata. Initiating actor and executing service are
   distinguishable for asynchronous work; retries never replace the initiator.
4. Actor context distinguishes platform operator, tenant staff and trusted
   system execution. A system action names its service/command and reason rather
   than fabricating a user. Staff attribution requires a tenant; platform actor
   identity stays tenantless even when the target is a tenant-owned resource.
   Target scope and actor identity scope must not be conflated.
5. Context comes from authenticated backend state or a trusted internal command,
   never a submitted actor/tenant field. Validate structural combinations now;
   identity existence and permissions become enforceable in P2 and domain units.
   Public-channel attribution contracts remain with P8-U3 onward.
6. Events are inserted only. Runtime credentials cannot update, delete or
   truncate them, alter protections, or acquire the owner role. Prove this with
   SQL under the actual runtime role, not only repository method availability.
   Deployment ownership is privileged maintenance, not an application rewrite path.
7. Audit is retained independently of mutable execution status. No cleanup or
   cascading feature deletion removes history in this unit. Define identity/target
   references without foreign keys to speculative tables; later migrations must
   preserve retained attribution. Timeline remains a separate domain responsibility.

Use a test-only sample record to prove the transaction boundary. Keep its schema
and delivery sink isolated from production migrations and public endpoints.

## Outbox write contract and handoff to P1-U5b

Each outbox row identifies one work item with immutable ID, work type/schema
version, stable idempotency key, initiating context, target scope and a minimal
validated payload. Persist it with the sample change and audit on the same
transaction connection. Define initial pending state and constraints so P1-U5b
can dispatch only committed intent. Handoff status is mutable and separate from
immutable audit; queue acceptance will not mean effect success.

Do not dispatch or call external services in this unit. PostgreSQL is the durable
source of pending intent; memory and local disk are not substitutes. Specify the
work/context shape for the next spec without creating speculative handlers.

## Logging, configuration and operational behavior

Emit structured logs with timestamp, level, process/entry point, operation,
correlation ID, work/job ID where applicable, attempt and safe outcome/error code.
Generate correlation IDs at trusted boundaries; validate and bound incoming
identifiers, and keep them separate from authentication authority. Carry the same
operation correlation through transaction, handoff, execution and retry, with
separate attempt identifiers where useful.

Use explicit field allowlists for audit, jobs and logs. Omit passwords, tokens,
cookie/header contents, database URLs, Redis/PBX credentials, raw requests,
reporter contact data, precise location and unnecessary personal details. Sanitize
unexpected exceptions before logging; do not serialize unrestricted error objects.
Exercise these boundaries with synthetic secret and personal-data sentinels.


## Acceptance and required verification

| Parent ID | Required result within this subunit |
| --- | --- |
| AC-01 | Real PostgreSQL commit retains sample change, trusted actor-attributed audit and outbox work; no effect runs before commit. Rollback and forced audit/outbox write failure leave none of them. |
| AC-02 | Invalid actor/scope combinations fail before persistence. Platform actor identity remains tenantless while target scope is retained; tenant staff requires its tenant and system work names its origin. Fixture checks do not claim authentication. |
| AC-03 | Actual runtime-role INSERT succeeds while UPDATE, DELETE, TRUNCATE and attempts to bypass audit protection fail. Privileged test cleanup is isolated from runtime credentials. |

Parent AC-08 applies here to write-path attribution/correlation and synthetic
secret/personal-data sentinels in audit, outbox payloads and captured logs.
Parent AC-09 applies here to fresh/rerun audit/outbox migrations, runtime grants,
invalid write-related configuration and entry-point isolation. Queue setup and
execution portions remain with P1-U5b; integrated confirmation is P1-U5c.

Force audit and outbox insertion failures independently; prove all sample writes
roll back. Hold a transaction open to prove its intent is not externally visible
before commit. Run append-only/bypass checks using actual runtime credentials,
including inability to acquire the owner role or alter protections.

Use the existing Docker workspace. Record actual commands, environment,
assertions, results and limitations as each increment is verified. Use real
PostgreSQL/PostGIS for persistence and permissions; use isolated fixtures with
privileged cleanup that cannot clear production audit history. Scoped quality
checks must pass alongside the behavioral checks. The proposed final
`./dev exec pnpm check:durability` command does not exist yet; P1-U5c owns its
final wiring, while each earlier unit must supply runnable focused checks.

## Decisions, completion and next unit

Resolve transaction API, schema/indexes, write-context validation and grants as
routine choices within the architecture; record lasting decisions. Preserve
history without inventing retention periods or user-facing recovery permissions.
No deferred product gate blocks trusted foundation fixtures.

Complete this subunit only after its scoped criteria, focused checks and evidence
pass. Update the tracker, then proceed to
[P1-U5b — durable worker delivery](p1-u5b-durable-worker-delivery.md). This subunit establishes durable
intent; parent P1-U5 remains incomplete until a/b/c and the parent matrix pass.

## Completion evidence

Scoped criteria passed in the existing Docker workspace, including the focused
`./dev exec pnpm check:audit-outbox`, full `./dev check`, deployment migration
and health. See [verification evidence](../../docs/status/p1-u5a-evidence.md) and
[write/handoff contract](../../docs/architecture/transactional-audit-outbox.md).
P1-U5b/c remain planned; parent P1-U5 is incomplete.
