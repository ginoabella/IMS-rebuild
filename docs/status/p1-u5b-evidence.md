# P1-U5b durable worker delivery evidence

Verification date: 2026-10-04 (Asia/Manila). Docker workspace uses Node 22.23.3,
pnpm 10.12.1 and the existing PostgreSQL 17/PostGIS development service. pg-boss
is pinned to 10.4.2; its provisioned schema is version 24. Repository baseline
included completed P1-U5a changes that were not committed; those were preserved.

## Commands and observed checks

```sh
./dev exec pnpm --filter @myims/backend add pg-boss@10.4.2 --save-exact
./dev migrate
./dev exec pnpm check:worker-delivery
./dev exec pnpm check:audit-outbox
./dev worker-up 2
./dev exec node scripts/worker-status.mjs
./dev worker-down
./dev health
./dev exec pnpm install --frozen-lockfile
./dev check
```

Backend build and migration passed. Focused worker delivery and audit/outbox
checks passed, including strengthened connectivity interruption and backoff.
Frozen install and the full `./dev check` passed with exit status 0: workspace
lint/format/type checks, all web/mobile/backend builds, entrypoint/configuration
checks and real PostgreSQL/PostGIS foundation checks. Fresh/concurrent/rerun
deployment, each dependency outage/recovery and backend restart passed. Final
scoped lint/format, documentation relative links and `git diff --check` passed.

The focused script creates a uniquely named `myims_worker_*` database using
trusted deployment credentials, applies all four versioned Prisma migrations plus
queue provisioning twice, then runs workers with actual application runtime
credentials and no deployment credentials. Privileged cleanup drops only that
disposable database. No production audit truncation or queue cleanup occurs.

The runnable checks assert:

- AC-04: stopped workers leave committed work pending with zero effects. Two OS
  workers deliver committed sample/audit/outbox intent. IPC barriers before enqueue
  and after enqueue hold the handoff transaction; an independent observer sees
  neither an accepted handoff nor a queue job. SIGKILL rolls both back; another
  worker recovers and creates one durable effect.
- AC-05: repeated sequential and six concurrent duplicate transport jobs converge
  to one sink effect and receipt. SIGKILL after independently committed destination
  acceptance but before caller acknowledgement leaves one effect and no local
  result; pg-boss expiration/retry converges after restart. The same idempotency key
  works independently for two tenants, and duplicates within one scope fail with
  SQLSTATE 23505 and roll back. Distinct work IDs remain independent.
- AC-06: transient failure retries once; persisted attempt timestamps prove at least
  the configured one-second retry delay. Exhaustion stops at three attempts and
  retains `retry_exhausted` without an effect/receipt. Unknown type, unknown version,
  permanent failure and malformed payload each terminate after one attempt. Hard
  crash timeout exhaustion retains `queue_exhausted`; destination acceptance can
  remain while local acknowledgement fails. Duplicate exhausted transport rows do
  not prevent reconciliation. A malformed transport ID terminally fails with zero
  retries and safe queue output.
- AC-08: initiating actor/correlation survive dispatch and both transient attempts.
  Attempt logs carry execution identity and safe failure codes. Synthetic
  secret/personal-data sentinel in malformed persisted work appears in none of the
  captured logs, audit metadata, generated job payloads, queue outputs or retained
  execution outcomes. The malformed outbox fixture itself deliberately contains
  that sentinel to exercise consumer validation; no sensitive production fixture
  is used.
- AC-09: fresh/rerun provisioning checks schema 24. Actual runtime cannot perform
  schema DDL, queue creation functions, version mutation or receipt/sink deletion.
  Every bounded setting rejects zero. Independent workers run with a preload that
  throws on any network listener. Production startup and clean SIGTERM are tested;
  the entrypoint regression checks clear failure/nonzero exit when PostgreSQL is
  unavailable instead of claiming placeholder readiness.

Focused polls have bounded deadlines; crash stages use explicit IPC barriers,
not uncontrolled sleeps. The sample, sink, receipts, outcomes and queue live in
PostgreSQL across process restarts. The driver-only connectivity proxy interrupts
real PostgreSQL connections for one worker without stopping shared services;
dispatch timestamps verify increasing backoff, pending work persists, and restored
connectivity delivers it. This complements, rather than completes, P1-U5c's combined
service outage and operational recovery rehearsal.

## Docker launch and regression evidence

Two runtime-only Docker worker replicas reported `ready` and exposed no ports.
The first launch exposed missing ownership-path configuration for read-only mounts;
using the backend's existing ownership-path setting corrected startup. Direct Node
container launch corrected pnpm signal forwarding. Both final containers reported
`stopped` and had Docker exit code 0. Workers were left stopped after the rehearsal.
The safe status command returned empty backlog/result counts on the development
database. HTTP live/ready both returned 200 with workers stopped.

Audit/outbox regression passed commit/invisibility, rollback and independent forced
write failures, swallowed-error rollback, trusted attribution, runtime INSERT and
append-only/bypass protection, safe logging and separately mutable handoff checks.
Migration-count assertions now account for four Prisma migrations; queue schema
history remains library-owned. The global key constraint changed through a new
versioned migration, preserving already-applied migration contents.

## Limits and follow-up

This proves the deterministic sample destination's deduplication and acknowledgement
boundary, not actual PBX/SMS/storage/socket adapters or universal exactly-once effects.
Runtime credentials share the established application role; there is no claim of
per-entrypoint DML-role isolation. No automatic retention cleanup runs; queue and
failed-result evidence remain retained. P1-U5c owns final `check:durability`/CI wiring,
integrated outage/restart/drain rehearsal and parent acceptance. Hosted CI,
production scheduling/HA/capacity targets and recovery UI are not verified here.
