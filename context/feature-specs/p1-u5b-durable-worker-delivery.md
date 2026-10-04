# P1-U5b — Durable worker delivery

## Status and purpose

- **Status:** complete; 2026-10-04 19:45 +08:00 (Asia/Manila).
- **Evidence:** [focused delivery and regression results](../../docs/status/p1-u5b-evidence.md).
- **Split prepared:** 2026-10-04 18:40 +08:00 (Asia/Manila).
- **Requirement:** Phase 1 P1-U5, durable execution of committed intent.
- **Goal:** deliver committed outbox work through independent pg-boss workers
  with safe duplicates, bounded retries and durable outcomes.
- **Completion boundary:** committed intent through queue handoff and sample sink
  execution, including concurrency and delivery crash windows.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md)
and [progress tracker](../progress-tracker.md). Follow the
[parent overview and acceptance matrix](p1-u5-transactional-audit-and-durable-execution.md).
Deferred P1-U1 product recommendations remain unapproved. Criteria describe
required behavior, not verification already performed.

## Starting state and dependencies

[P1-U5a](p1-u5a-transactional-audit-and-outbox.md) must be verified first: transaction-bound audit/outbox,
trusted work context, immutable work identity, runtime grants and safe logging.
P1-U3 supplies real PostgreSQL/PostGIS and coordinated deployment. The worker was
an empty placeholder and pg-boss was absent when the parent draft was prepared;
recheck current state before implementing. No P1-U5a completion is claimed here.

## Scope and ownership

- Backend infrastructure: committed-work dispatcher and queue adapter.
- Independent worker entry point: registered handlers, lifecycle and shared-state
  coordination; no HTTP listener or telephony observer.
- Deployment/database: queue schema provisioning and minimal runtime privileges;
  durable receipts/results required by the actual sample consumer.
- Workspace/configuration/Docker: compatible pinned pg-boss dependency and lockfile,
  validated bounded settings and a reproducible worker launch path.
- Testkit/docs: deterministic durable sink, focused concurrency/crash/retry checks,
  guarantees, startup instructions, decisions, evidence and tracker updates.

Reuse P1-U5a ports, schema and logging. Changes to a contracts must be necessary,
documented and regression-checked. No business feature schema, actual PBX/SMS/
storage/socket delivery, recovery UI, retention cleanup or production scheduler.

## Outbox and worker contract

The observable path is:

```text
trusted trigger -> validate -> transaction(sample + audit + outbox) -> commit
  -> worker dispatch -> pg-boss job -> registered handler -> durable result
```

- An outbox record identifies one work item with immutable ID, work type/schema
  version, stable idempotency key, initiating context, target scope and a minimal
  validated payload. Track handoff progress separately from immutable audit.
  Dispatch completion means queue acceptance, not external effect success.
- Workers scan committed pending work in bounded batches. Concurrent dispatchers
  coordinate using database locking or recoverable claims; abandoned claims must
  become eligible again. HTTP may insert outbox records but starts no dispatch loop.
- Never mark handoff complete before durable queue acceptance. Resolve the
  enqueue/mark crash window either with a verified shared transaction supported
  by the selected library or a retryable handoff that permits duplicates. Specify
  and test the chosen method; queue deduplication alone is not handler idempotency.
- Jobs retain the stable work ID, tenant/target context and correlation ID through
  retries. Validate payload version/type before invoking a registered handler;
  unknown or malformed work has an explicit terminal failure rather than an
  arbitrary dynamic invocation or endless retry.
- Delivery is at least once. A completed-work receipt keyed by work identity and
  handler, or an equivalent module-owned constraint, prevents concurrent/repeated
  executions from duplicating database effects. Store the receipt and effect in
  one transaction. Scope keys to prevent unrelated tenants/work types colliding.
- A receipt recorded before a nontransactional external effect can lose work;
  one recorded afterward can repeat it. External adapters therefore require a
  destination-supported idempotency key or explicit reconciliation protocol.
  Prove the sample with a deterministic durable sink supporting deduplication,
  including interruption after sink acceptance but before local acknowledgement.
  Do not claim universal exactly-once external execution.
- Define one authoritative execution result for each work item, including
  attempts, bounded safe failure code, timestamps and final outcome. Document
  which facts belong to `pg-boss` and which receipts belong to handlers; avoid a
  competing scheduler or duplicate editable queue status. Queue retention must
  not erase the retained failed-work evidence needed by later recovery tools.
- Retry only eligible failures with bounded attempts, backoff, timeouts and
  concurrency. Exhaustion stays inspectable and is not reported as success.
  Dispatcher failures also need backoff and visible status; unavailable PostgreSQL
  must not lose committed work or create a tight retry loop.
- Stop accepting new work during graceful shutdown, allow bounded draining and
  release connections. Forced termination leaves unfinished jobs recoverable.
  Two workers use shared PostgreSQL state; neither local memory nor local disk
  supplies authoritative claims, receipts or progress.
- Queue schema initialization/upgrades follow the trusted coordinated deployment
  path. Worker/HTTP runtime credentials receive only necessary permissions and
  no deployment secrets. Verify the selected `pg-boss` version can run without
  automatic runtime DDL before settling its startup configuration.

Generic infrastructure carries trusted context; each later handler rechecks the
canonical scope and execution preconditions appropriate to its effect. It must
not treat a serialized actor or stale session as perpetual authorization.
Feature-specific cancellation, ordering and PBX fencing remain with their owners.

## Logging, configuration and startup

Consume the safe logging/correlation contract from
[P1-U5a](p1-u5a-transactional-audit-and-outbox.md#logging-configuration-and-operational-behavior).
Carry the initiating actor and stable correlation through dispatch, job attempts
and final outcomes; distinguish the executing service and attempt IDs. Extend
allowlists for work/job IDs and safe failure codes without unrestricted errors,
requests or personal data. Run synthetic sentinel checks across the entire path.

Validate retry/batch/concurrency/polling/shutdown settings at startup, with bounded
defaults recorded during implementation. Worker startup must distinguish ready,
degraded and failed states; the placeholder `capabilities: pending` message must
not stand in for queue readiness. HTTP health remains independent of whether a
worker process is running. Do not add a worker HTTP listener just for this unit.
Document how to inspect backlog/failed work, start/stop workers and recover after
database interruption using trusted commands, without exposing payload secrets.
Production alerts and numerical capacity/recovery targets remain Phase 9 work.

## Acceptance and required verification

| Parent ID | Required result within this subunit |
| --- | --- |
| AC-04 | With workers stopped, committed work persists. Starting a worker delivers it; two dispatchers and a crash in the queue-handoff window lose no work. Handoff status never implies effect success. |
| AC-05 | Sequential and concurrent duplicate jobs yield one durable sample effect. Interruption after sink acceptance before acknowledgement converges using the same idempotency key. Unrelated work/tenant keys remain independent. |
| AC-06 | Eligible failures retry with bounded attempts/backoff, permanent or malformed work fails explicitly, and exhausted retries retain inspectable failure evidence without a successful result. |

Parent AC-08 applies end to end here, including jobs, retries, captured logs and
retained outcomes. Parent AC-09 applies to queue schema fresh/rerun provisioning,
validated worker settings, least-privilege runtime and process isolation.

Use real PostgreSQL and two independent OS workers/dispatchers. Inject failure
before and after queue acceptance and after sink acceptance before local
acknowledgement, using explicit barriers and bounded polling. Assert durable
state and effect counts rather than relying on log messages or sleeps. Include
concurrent duplicates, distinct tenant/work keys, unknown schema versions,
permanent failures and exhaustion. The sink must persist and support deduplication
across process restarts; a process-local counter is insufficient.

Use the existing Docker workspace. Record actual commands, environment,
assertions, results and limitations as each increment is verified. Use real
PostgreSQL/PostGIS for persistence and permissions; use isolated fixtures with
privileged cleanup that cannot clear production audit history. Scoped quality
checks must pass alongside the behavioral checks. The proposed final
`./dev exec pnpm check:durability` command does not exist yet; P1-U5c owns its
final wiring, while each earlier unit must supply runnable focused checks.

The sample sink proves its own idempotency boundary; it does not verify live
external integrations or universal exactly-once effects. P1-U5c completes the
combined outage/restart/drain rehearsal and parent regression. Tests and basic
startup/recovery documentation belong here as well.

## Decisions, completion and next unit

Consult current official library documentation during implementation and verify
version-specific transaction/schema/startup capabilities. Resolve handoff method,
queue/result/receipt ownership, safe bounded settings and runtime grants; record
lasting decisions. No second scheduler or competing editable queue status.
Feature owners later define execution preconditions, cancellation, ordering,
live adapter idempotency and PBX fencing; serialized actor context is not perpetual
authorization.

Complete this subunit only when its scoped criteria and focused evidence pass.
Then proceed to [P1-U5c](p1-u5c-recovery-verification-and-operational-handoff.md). Worker delivery alone does not complete
parent P1-U5 or establish production HA.
