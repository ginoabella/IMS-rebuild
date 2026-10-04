# P1-U5c — Recovery verification and operational handoff

## Status and purpose

- **Status:** complete; 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Split prepared:** 2026-10-04 18:40 +08:00 (Asia/Manila).
- **Requirement:** Phase 1 P1-U5, recovery proof and integrated handoff.
- **Goal:** demonstrate durable work recovery under process/database interruption
  and deliver reproducible checks and operational documentation.
- **Completion boundary:** the a/b transaction-to-effect path passes the combined
  failure matrix and all parent acceptance criteria with reviewable evidence.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md)
and [progress tracker](../progress-tracker.md). Follow the
[parent overview and acceptance matrix](p1-u5-transactional-audit-and-durable-execution.md).
Deferred P1-U1 product recommendations remain unapproved. Criteria describe
required behavior, not verification already performed.

## Starting state and dependencies

[P1-U5a](p1-u5a-transactional-audit-and-outbox.md) and [P1-U5b](p1-u5b-durable-worker-delivery.md) must be independently verified.
Their write, permission, delivery, duplicate and retry checks and basic docs must
already exist. This spec does not claim they are implemented. Recheck the tracker,
actual commands, runtime permissions and retained evidence before activation.
P1-U3 backing services and the existing Docker workspace are required.

## Scope and ownership

- Testkit/scripts: controlled worker crash, database outage, restart and graceful
  drain matrix, plus integrated regression of a/b guarantees.
- Worker/configuration/database adapters: fixes necessary for this recovery
  boundary, preserving verified contracts and rerunning affected a/b checks.
- Workspace/CI/Docker: one focused durability command and foundation integration
  after test services and schemas can be provisioned reproducibly.
- Documentation/tracker: lasting architecture decisions, operational runbook,
  evidence, explicit limitations and subunit/parent completion state.

This is not permission to postpone a/b tests or implement a new capability.
Identity/session enforcement, PBX/SMS/storage integrations, socket fanout, manual
recovery UI/permissions, cleanup policy and production observability/HA/load
objectives remain out of scope. No new listener, queue or deployment service.

## Recovery journey and required matrix

Start with a trusted sample action and inspect committed audit/outbox state;
interrupt workers or PostgreSQL at a controlled boundary, restore the dependency,
restart workers and inspect the canonical result. Audit attribution must remain
unchanged while delivery/result state converges.

| Scenario | Required observation |
| --- | --- |
| Workers stopped before commit | Work stays pending durably and executes after startup; rollback creates no work. |
| Dispatcher killed around queue acceptance | Recoverable claims/handoff retry lose no work; duplicates are safe. |
| Handler killed while executing | Another/restarted worker recovers unfinished work using shared state. |
| Sink accepted effect, acknowledgement absent | Same stable key prevents a repeated effect after restart. |
| PostgreSQL unavailable during dispatch/execution | Bounded safe failure/degraded reporting; no lost intent, busy retry loop or false success; recovery after restoration. |
| Graceful termination with in-flight work | New work stops; bounded drain finishes or leaves recoverable work; connections close. |
| Completed and exhausted work across restart | Success effects do not multiply and retained terminal failure evidence remains inspectable. |
| Concurrent workers and independent scopes | Shared coordination works across OS processes without collapsing unrelated work/tenant keys. |

Implement a chosen, reproducible database-interruption mechanism against isolated
test data. Capture before/after state, attempts, effect counts, actor/correlation
and exit/shutdown outcomes. Use explicit synchronization and bounded polling;
fixed sleeps and process-local receipts do not establish recovery.

## Acceptance and required verification

| Parent ID | Required result within this subunit |
| --- | --- |
| AC-07 | Kill/restart an active worker and interrupt PostgreSQL, then restore them. Pending/in-flight work recovers, completed work does not multiply effects, and failed work remains visible. Graceful shutdown drains or leaves recoverable work within its bound. |
| AC-10 | Required workspace/foundation checks and focused integration command pass in Docker. Documentation covers ownership, guarantees, commands, failure/recovery, retained evidence and limitations. |

Integrated confirmation of parent AC-01–06, AC-08 and AC-09 is also mandatory.
Reuse the a/b checks rather than duplicating definitions: verify atomic rollback,
trusted context, append-only runtime permissions, handoff/delivery duplicates,
exhaustion, sentinel safety, queue deployment/rerun and entry-point isolation.
Record any failures and fix only those within this unit's authorized boundary.

Use real PostgreSQL/PostGIS and independent worker processes. Deterministic sink
checks verify only the declared fixture adapter. Docker recovery proves a local
process/backing-service boundary, not production availability, PBX behavior,
SMS delivery or live object storage.

Add and document one short focused command, provisionally
`./dev exec pnpm check:durability`. It does not exist at spec preparation time.
Wire it into the required foundation check sequence and CI with service/schema
prerequisites and isolated cleanup. Run it and the existing `./dev check`; record
actual invocations and results. Preserve existing HTTP health and process checks;
worker readiness must describe real queue capability without adding HTTP listeners.

## Operational handoff and evidence

The runbook must include prerequisites, trusted migration and worker launch/stop
commands, bounded configuration defaults, safe backlog/failure inspection,
interruption/restart recovery, verification and an owner/escalation point. Explain
commit versus queue acceptance versus effect completion, at-least-once delivery,
handler idempotency, external-adapter limits and retained audit/failure evidence.
Avoid exposing database URLs, secrets or unrestricted job payloads.

Record the transaction API, queue handoff/crash-window treatment, authoritative
result and receipt ownership, schema/grant/startup decisions and version-specific
library constraints in the architecture decision documentation. Synchronize
context only where implementation actually changes documented behavior.

Evidence must list commands, environment, injected failure boundaries, durable
assertions, outcomes and material limitations. Synthetic secret/personal-data
sentinels must be absent from audit, queue payloads and captured logs. Preserve
failed-work and audit history; do not invent retention periods or a manual retry
permission flow. Those decisions remain with later units.

## Completion and follow-up

Mark P1-U5c and parent P1-U5 complete only when a/b/c are verified, the full
[parent matrix](p1-u5-transactional-audit-and-durable-execution.md#acceptance-and-required-verification)
passes and documentation/tracker evidence is synchronized. An unavailable required
check keeps completion pending; a simulator cannot stand in for a real database
or required process interruption. Later feature units supply authenticated actors,
authorization, actual external adapters and their own recovery semantics.


## Observed completion

`./dev exec pnpm check:durability` and `./dev check` passed with exit status 0.
Real PostgreSQL/PostGIS and independent processes passed the full recovery matrix
and parent AC-01–10. Two runtime-only Docker replicas reported ready and drained
to exit 0 without listeners; HTTP stayed ready. See
[P1-U5c evidence and retained snapshots](../../docs/status/p1-u5c-evidence.md) for
commands, corrected recovery faults, durable assertions and limits. Parent P1-U5
and all three subunits are complete within the declared fixture boundary.
