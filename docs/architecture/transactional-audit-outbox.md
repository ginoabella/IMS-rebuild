# Transactional audit and outbox write contract

P1-U5a supplies durable intent, with no dispatcher, handler or public fixture route.
Business use cases own their writes; the audit module owns history; infrastructure
owns transport intent. HTTP, worker, telephony and deployment graphs remain separate.

## Calling the write path

Construct execution context only from authenticated backend state or a trusted
internal command. `executionContext` checks shape, bounded references and actor/scope
combinations; it does not authenticate, resolve identities or grant permission.
P2 and domain use cases must enforce those checks before opening a transaction.
Never copy submitted actor or tenant fields into this context.

Use `Transaction.run(pool, context, operation, logger, action)`. Inject a pool
configured with the existing typed database URL, pool maximum and dependency
connection/statement timeouts, and close it with its owning process. No new
write-specific environment setting is required. The transaction validates and
freezes a detached context snapshot before acquiring a connection. Await every
business query, `AuditWrite.append` and `OutboxRepository.insert` inside `action`.
All use the explicit `Transaction` handle; neither write repository accepts a pool
or silently opens a connection. Return values reach the caller only after COMMIT.
A required repository validation/query failure poisons the handle even when a
caller catches it. Rollback releases or discards the connection; the handle becomes
unusable after completion. Business repositories must not issue transaction-control
SQL or expose the handle outside the callback. External calls and queue publication
must stay outside this callback.

As with any database transaction, connection loss during COMMIT can leave the
caller uncertain whether it committed. Resolve by inspecting the durable business
result/intent rather than blindly repeating external work. A stable idempotency key
has a unique database constraint scoped to work type and target tenant (P1-U5b):
a duplicate within that scope fails and rolls back; this
write API does not yet implement a domain duplicate-response contract.

## Attribution and safe data

Platform operators have platform identity and no actor tenant, even when the
resource has a tenant. Tenant staff have tenant identity and a required canonical
tenant matching the target tenant. A system actor names its originating service or
command in `reference` and a bounded reason code, with no fabricated user. Identity
plane and actor scope are distinct from `target.tenantId`. No speculative identity,
tenant or target foreign keys exist; later migrations must preserve these retained
references independently of account/resource deletion.

Correlation identifiers are bounded to 80 ASCII identifier characters.
`correlationId(incoming)` accepts a valid identifier or generates a UUID; validity
confers no authentication authority. Generate it at the trusted boundary and keep
it unchanged through audit, outbox, queue handoff, execution and retries. Log the
executing process separately from the immutable initiating actor. Later workers
must add their work/job and attempt context without replacing the initiator.

Each owning backend use case supplies a code-owned `DataContract` with event/work
type, positive schema version and an explicit event-specific field allowlist.
Contracts are never accepted from a request. Current rules permit only bounded
integers, booleans and fixed enum codes; there is no arbitrary string, object or
raw-request metadata escape hatch. Unknown or missing fields fail validation;
JSON is bounded to 4096 bytes and independently constrained in SQL. Contracts must
never list personal fields or secrets. No shared transport contract is added without
a named consumer; the only current consuming contracts are isolated acceptance
fixtures. Future capabilities must define their own reviewed safe contracts.

`SafeLogger` emits only timestamp, level, process/entry point, operation,
correlation ID, optional work ID, attempt, outcome and a sanitized error code.
SQLSTATE codes, `invalid_write` and `unexpected_error` are allowed; exception
messages, detail, stacks, headers and unrestricted objects are omitted. Operation
names and identifiers are trusted code/reference values, never reporter contact,
location or submitted free text. A logging sink failure cannot turn committed data
into an apparent application rollback.

## Storage, grants and next-unit handoff

Migration `20261004010000_audit_outbox` uses the existing deployment lock and Prisma
history. `audit_events` holds UUID, event type/version, database-recorded timestamp,
actor identity/scope/reason, target/scope, correlation and safe metadata. Runtime
credentials can SELECT and INSERT approved columns; cannot override timestamps,
UPDATE, DELETE, TRUNCATE, disable/drop its mutation trigger or acquire its owner role.
The trigger also prevents ordinary privileged mutation; deployment ownership
remains a privileged maintenance capability, never an application rewrite path.
There is no history cleanup, deletion cascade or retention period in this unit.

`outbox_work` holds immutable UUID, work type/version, a stable idempotency key
unique within target tenant/work type, initiating context, target scope, correlation
and minimal payload. Callers namespace keys by the owning operation/resource.
P1-U5b extends the original global constraint with the scoped unique index. The database generates `created_at`, `pending` handoff status
and a null `accepted_at`. Only handoff status/accepted timestamp are runtime mutable;
intent is never deleted to indicate execution success. Pending intent has a partial
index ordered by creation time/ID. Audit target/tenant/time and correlation indexes
support inspection; outbox correlation supports operational tracing.

P1-U5b transitions handoff to `accepted` with `accepted_at` only after recoverable
queue acceptance; that means queue handoff, never successful external effect.
It must validate the immutable work type/version/context/payload, preserve the
idempotency key and initiating attribution, and maintain execution state separately.
Queue provisioning, dispatch loops, retry policies, handlers and result ownership
are implemented in P1-U5b; see the [worker contract](durable-worker-delivery.md). Parent P1-U5 remains incomplete until a/b/c verification passes.

## Verification and operation

Run `./dev migrate` to apply production migrations through deployment, and
`./dev exec pnpm check:audit-outbox` for focused verification. The latter builds the
backend, creates a uniquely named disposable PostgreSQL database, runs fresh and
rerun deployment, and adds test-only sample/sink tables. It connects as actual
runtime credentials for writes and permission assertions. Only the trusted test
owner creates failure constraints and drops that disposable database during cleanup;
it cannot target or clear production audit history. No test fixtures enter production
migrations or public endpoints. Interruption can leave a disposable `myims_audit_*`
database; inspect and remove only that identified fixture using deployment credentials.

The test proves open-transaction invisibility with a second connection, commit,
rollback, independent database audit/outbox failure, attribution validation,
append-only/bypass denial and synthetic sentinel exclusion from persisted data and
captured logs. A test-only delivery sink stays empty; no dispatch exists in this
unit. See [P1-U5a evidence](../status/p1-u5a-evidence.md) for commands/results/limits.

## Atomic tenant and first-administrator targets

P4-U1a-1 adds `withStaffCreationTarget(staffId, callback)` for a platform actor's
UUID tenant root. It validates the staff UUID and existing canonical root tenant,
then supplies an expiring staff-target handle in that tenant. Root and child retain
one connection, immutable actor/correlation and shared required-failure poison.
Root context is never changed, and scoped handles cannot query after callback
return or outer completion. An unfinished target callback prevents outer commit. Existing consumers retain their original target checks and runner API.
See the [draft registry contract](draft-tenant-registry-api.md).
