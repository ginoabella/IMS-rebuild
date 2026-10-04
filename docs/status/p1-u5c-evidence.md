# P1-U5c recovery verification and operational handoff evidence

Verification date: 2026-10-04 (Asia/Manila). Environment: existing Docker
workspace, Node 22.23.3, pnpm 10.12.1, PostgreSQL 17/PostGIS, pg 8.23.1 and
pg-boss 10.4.2 (schema 24). Prior uncommitted a/b implementation was preserved.
The focused `./dev exec pnpm check:durability` passed with exit status 0.
Two runtime-only Docker replicas reported ready, exposed no ports, drained to
stopped and exited 0. HTTP live/ready remained 200 and safe worker status returned
empty development backlog/outcomes. Full workspace/foundation checks passed with exit status 0.

## Reproducible checks

```sh
./dev exec pnpm check:durability
./dev check
./dev worker-up 2
./dev exec node scripts/worker-status.mjs
./dev worker-down
./dev health
```

`check:durability` builds the backend once, reuses `check-audit-outbox.mjs` and
`check-worker-delivery.mjs --recovery`, and loads the recovery assertions in
`worker-recovery.mjs`. Foundation checks and CI call it after real backing services
and deployment prerequisites exist. Test schemas/queues are freshly deployed and
rerun in uniquely named disposable databases using trusted deployment credentials.
Workers use the actual restricted runtime role in independent OS processes.
Fixtures clean their own databases even on assertion failure.

The driver captures safe JSON snapshots, actor/correlation, outcome/attempts,
effect/receipt counts and exit/shutdown durations. It holds IPC barriers at precise
failure boundaries and observes shared PostgreSQL state with bounded polling.
Polling intervals do not establish success; durable predicates do. No simulator,
fixed startup sleep or process-local receipt establishes recovery.

## Matrix and parent coverage

| Parent IDs     | Boundary and assertions                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01–03       | Existing a checks: held-transaction invisibility, commit, rollback, forced/swallowed audit/outbox write failures; trusted structural attribution; actual runtime INSERT and append-only/bypass denial.                                                                                                                                                       |
| AC-04          | Stopped-worker backlog; two independent dispatchers; SIGKILL before/after queue insertion before shared handoff commit; no visible job/handoff before commit; restarted worker yields one effect.                                                                                                                                                            |
| AC-05          | Sequential/concurrent duplicate jobs; sink acceptance before acknowledgement SIGKILL; stable key and independent tenant/work keys; exactly one fixture effect/receipt after recovery.                                                                                                                                                                        |
| AC-06          | Transient backoff from stored timestamps, permanent/malformed/type/version failures, bounded exhaustion and hard-crash transport exhaustion; retained safe terminal failure evidence.                                                                                                                                                                        |
| AC-07          | SIGKILL at active handler before sink; restarted worker has at least two attempts and one effect/receipt. Completed and exhausted states/audit remain identical across restart. Connectivity loss during dispatch, active handler and accepted sink produces no false success; restoration converges to one effect/receipt with identical audit attribution. |
| AC-07 shutdown | SIGTERM at an active execution barrier; release lets drain finish with exit 0/stopped and leaves newly committed work pending. Withhold release: shared production deadline forces exit 1 within configured shutdown plus six seconds; next worker recovers work.                                                                                            |
| AC-08          | Captured logs, full audit rows, queue payload/output and retained results exclude synthetic secret/personal-data sentinel. Existing retry trace verifies initiating actor/correlation on dispatch and both attempts; recovery snapshots compare unchanged attribution.                                                                                       |
| AC-09          | Fresh/rerun queue schema 24 and runtime DDL denial; bounded invalid settings; no worker listeners or false readiness when queue UPDATE permission is revoked; independent process/deployment/configuration checks retained.                                                                                                                                  |
| AC-10          | Focused Docker command, integrated foundation/CI sequence, full workspace checks, architecture record and runbook with owner/escalation, failure inspection and limits.                                                                                                                                                                                      |

## Failure found and correction

The first focused run passed a/b checks and active-handler recovery but failed the
PostgreSQL degradation predicate. It also exited the stalled fixture before the
intended outer shutdown deadline. Socket termination/idle transaction expiry can
emit an error on a checked-out pg client between queries. The pool error listener
alone does not handle that client event. Added a safe listener to each newly
connected worker client, preserving query rejection, rollback and retry semantics
without logging raw connection errors. A subsequent run identified pg-boss 10.4.2's
unawaited callback failure update after pool shutdown. Replaced callback consumption
with public fetch/complete/fail APIs and awaited dispatch/consumer drain before
closing the database. No third-party internals were modified. Strengthened the stalled-drain check to
require exit near the shared deadline and empty stderr. Outage barriers are
single-use so subsequent execution can recover normally. Affected a/b checks are
rerun by the integrated command.

## Operational contract and limits

See [worker architecture](../architecture/durable-worker-delivery.md) and
[operational handoff](../runbooks/durable-workers.md). Commit, queue acceptance and
authoritative effect acknowledgement are separate. Delivery is at least once;
this PostgreSQL fixture destination deduplicates its own effects. Queue transport
completion is not an execution success flag. Destination acceptance can survive
failed local acknowledgement. Audit and failed evidence are preserved with no
invented retention or manual retry permission.

The test-only TCP proxy closes established real PostgreSQL sessions and rejects
new worker connections, leaving isolated owner/observer access available for
before/during/after assertions. This proves actual database unavailability to
workers in Docker, not a PostgreSQL server crash, disk loss, backup restoration,
production HA/capacity, PBX, SMS, sockets or live storage. Hosted CI execution,
production on-call assignment and external-adapter recovery remain unverified.

## Final observed result

The focused durability command and full `./dev check` both exited 0. Full checks
passed lint, formatting, types, all web/backend and Android/iOS mobile builds,
entrypoint isolation, configuration, fresh/concurrent/rerun migrations, runtime
permissions, HTTP dependency outage/recovery and backend restart. The final nested
durability run passed every parent AC-01–10, including denied queue-capability
startup, active handler death and the three PostgreSQL interruption boundaries.

The final successful in-flight drain took 183ms and exited 0; the stalled drain
reported `shutdown_timeout` and exited 1 after 7014ms (configured 1000ms plus
6000ms grace). A restarted worker recovered its work in two attempts with one
effect/receipt. Completed work remained at one effect and one receipt; exhausted
work retained three attempts, `retry_exhausted`, zero effects and zero receipts.
Actor/correlation/audit were unchanged. Both Docker replicas had no published
ports and exited 0 through `./dev worker-down`; HTTP remained ready.

[Retained safe snapshots and passing assertions](p1-u5c-recovery-snapshots.json)
record the final run, settings and nine before/after/recovery observations.
Scoped source lint, final artifact/document formatting, relative links and
whitespace checks passed. Final trusted cleanup inspection found zero disposable
audit/worker/foundation test databases. P1-U5a/b/c and parent P1-U5 are complete within their
fixture foundation boundary; the limitations above still apply.
