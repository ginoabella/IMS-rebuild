# Durable worker delivery — P1-U5b

Committed outbox intent feeds the `committed-work-v1` pg-boss queue. HTTP inserts
intent only. Independent Nest application-context workers have no listener,
Redis session dependency, deployment credential or telephony observer.

## Queue and deployment

Pin pg-boss **10.4.2**, CommonJS compatible with the existing backend and Node 22;
its published package requires Node >=20 and owns schema **24**. Consulted the
[official constructor documentation](https://github.com/timgit/pg-boss/blob/master/docs/api/constructor.md)
and verified the installed version's `types.d.ts`, `src/contractor.js`,
`src/plans.js`, `src/boss.js` and `version.json` before implementation. Current
master documentation is not a substitute for these version-specific checks.

The existing trusted deployment advisory lock covers Prisma migrations, queue
installation/upgrades, fixed queue creation and runtime grants. pg-boss owns its
schema history separately from Prisma. Runtime uses `migrate:false`,
`supervise:false`, `schedule:false`: `start()` checks the schema version without
DDL. Runtime cannot create queues, change the version, execute queue functions,
create schema objects or perform retention cleanup. Its queue permissions are
SELECT on queue/version and SELECT/INSERT/UPDATE/DELETE on the job parent table
(the selected library implements failure/retry with DELETE/INSERT). Deployment
owns partition tables. The existing application runtime role is shared with HTTP;
this is not per-entrypoint DML credential isolation.

Workers call pg-boss's `expire()` to recover expired active jobs; pg-boss remains
the scheduler and owns retry timing, transport state and queue attempts. Automatic
archive/drop is disabled for this unit, preserving transport evidence and avoiding
unapproved retention cleanup. Future retention must preserve the independent
retained results. Queue/library upgrades require trusted deployment first.

## Atomic handoff

Each dispatcher selects a bounded batch of committed pending outbox rows with
`FOR UPDATE SKIP LOCKED`. `boss.send(...,{db:{executeSql}})` uses that exact
PostgreSQL transaction connection. Job insertion and the subsequent accepted
handoff update commit together. Termination before or after enqueue but before
commit rolls both back and releases locks; another dispatcher can resume. No
persisted leases or local claims exist. Queue acceptance means durable transport
handoff, not effect success. Work IDs are also the initial queue job IDs.

Jobs carry stable work ID, correlation, actor references and target scope. Handlers
reload immutable canonical intent by ID rather than authorizing from serialized
actor state. Only the explicitly registered `sample.deliver` v1 contract is
invoked. Unknown type/version or malformed payload becomes retained `invalid_work`.
Later handlers must recheck canonical scope and effect-specific preconditions;
structural context validation here is not authentication or perpetual permission.

Outbox keys now use a unique `(work_type, COALESCE(tenant_id,''), idempotency_key)`
index; the empty scope represents platform targets and cannot be a valid tenant ID.
This necessary P1-U5a contract extension permits the same key across unrelated
tenants/types while preserving rollback for duplicates in the same scope.

## Receipts, sample destination and outcomes

Delivery is at least once. A transaction-scoped PostgreSQL advisory lock serializes
all jobs for one work ID; hash collisions only serialize unrelated work. A receipt
is keyed by work ID and handler, and commits with the sample's local acknowledgement
and `work_results` success. Duplicates see the terminal result and perform no effect.

The named deterministic sample destination, `sample_delivery_sink`, commits its
acceptance independently before local acknowledgement. Its acceptance row is the destination-owned receipt and effect in one transaction.
The persistent unique work ID and scoped handler/idempotency key support safe
repetition after a hard crash.
Receipt insertion before destination acceptance would lose work; acceptance without
destination deduplication could repeat work. Real external adapters need their own
destination-supported key or reconciliation protocol. This sample proves only its
own boundary, not universal exactly-once effects or any live integration.

`work_results` is the authoritative retained execution outcome: pending, succeeded
or failed; attempt count, first/last attempt timestamps, safe failure code and finish
time. It does not schedule or edit transport retries. pg-boss owns transport claims,
retry count, retry delay and expiration. Result attempts count committed executions
and include queue retry count after interruption; a killed transaction can leave no
first-attempt timestamp, so queue-only exhaustion uses the last observed queue start.

Eligible sample failures retry by throwing a fixed safe error after committing
attempt evidence. Permanent/malformed/exhausted work records terminal failure and
returns to pg-boss: **transport completed means consumed**, and must never be used
as the execution-success flag. Queue-only failure after hard crashes/timeouts is
reconciled to `queue_exhausted` when no live duplicate remains. A destination may
already have accepted such work; failed local acknowledgement is not proof that
an external effect did not occur. Later recovery tools must inspect receipts and
reconcile destination state. No recovery UI or retry authorization is implemented.

The sample supports `once`, deterministic first-attempt `transient`, `permanent`
and `exhaust` modes for executable failure verification. Payloads, arbitrary errors
and actor personal data never enter logs/results/queue error output. Structured
logs carry bounded references, initiating actor and correlation, executing process,
job/attempt IDs and safe failure codes. Dispatch errors emit degraded readiness;
repeated errors delay dispatch exponentially up to 30 seconds.

## Recovery verification and lifecycle — P1-U5c

The integrated `check:durability` command reuses a/b acceptance definitions and
adds explicit `before_sink` execution barriers through the existing injectable
fixture hooks. Production accepts no fault environment switches. The test fixture
and production entrypoint share `installWorkerShutdown`, so the successful drain
and forced deadline exercise the same lifecycle policy. New dispatch stops before
draining; stalled handlers exit nonzero within the configured bound plus six
seconds. PostgreSQL releases transactions/locks on process death; pg-boss expiration
and bounded retries recover unfinished work. `pool.end()` precedes a clean stopped
state. The outer process deadline covers hooks/external calls that never settle.

A driver-owned TCP proxy severs established real PostgreSQL sessions and rejects
new sessions for isolated runtime workers. Owner/observer connections remain
available to assert durable state and restore connectivity deterministically.
This intentionally proves database unavailability to workers without introducing
a service or interrupting unrelated data. It does not prove server crash recovery
or disk durability. PostgreSQL/PostGIS and independent OS processes are mandatory;
no in-memory receipt or simulator replaces them.

`check:foundation` includes this command after baseline checks; Docker CI invokes
it after service startup, frozen install and trusted schema provisioning. Each
suite owns and cleans its disposable database. Reviewable snapshots omit payloads
and credentials and retain actor/correlation, attempts, outcomes and effect counts.
The recovery matrix and limits are recorded in
[P1-U5c evidence](../status/p1-u5c-evidence.md).

PostgreSQL socket termination can emit a client error while a transaction is
checked out between queries. The worker now registers a safe client error listener
on each pool connection as well as the pool error listener. This avoids uncaught
EventEmitter termination and lets the query/rollback and transport retry paths
converge after restoration. Reviewed the official
[node-postgres client events](https://node-postgres.com/apis/client#events) and
[pool events](https://node-postgres.com/apis/pool#events); the outage matrix covers
the installed pg 8.23.1 dependency.

The pinned pg-boss 10.4.2 `manager.js` callback worker calls `complete`/`fail`
without awaiting their promises. The recovery run exposed a rejected failure
update after the pool had begun closing. The application therefore uses the public
`fetch`/`complete`/`fail` pull APIs with every acknowledgement awaited; no dependency
internals are modified. Reviewed the official
[jobs API](https://github.com/timgit/pg-boss/blob/master/docs/api/jobs.md) and the
installed 10.4.2 signatures/implementation. Bounded per-process consumer loops
use pg-boss's shared claims, expiration and retry scheduling; polling is at least
500ms with increasing dependency-error backoff capped at 30 seconds. Shutdown
waits for dispatch and consumer loops before stopping pg-boss and closing the pool.
The outer deadline emits safe `shutdown_timeout` and exits 1 for stalled work.
Handler failures submit fixed safe failure codes rather than raw error objects.

Startup readiness also verifies queue existence, compatible schema and each actual
runtime job-table DML privilege. Revoking queue UPDATE in an isolated database
must fail production worker startup with no ready state or network listener;
restoring the grant permits subsequent recovery checks.
