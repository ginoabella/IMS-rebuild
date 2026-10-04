# Durable workers

Use the existing Docker workspace; no host Node or PostgreSQL installation is
needed. Start the foundation with `./dev up`, then:

```sh
./dev worker-up 2
./dev worker-logs
./dev worker-down
./dev exec pnpm check:durability
```

`worker-up` builds and runs coordinated deployment before starting runtime-only
worker containers. It accepts a worker replica count (default 1). Workers mount
source/dependencies read-only and only the runtime PostgreSQL secret. They expose
no port. HTTP health is independent of worker presence. `./dev down` stops both
profiles without deleting data volumes. No business delivery trigger is exposed;
the focused check creates/cleans a uniquely named disposable database.

## Settings

All settings validate before startup. Defaults and inclusive limits:

| Variable               | Default | Limits                                       |
| ---------------------- | ------- | -------------------------------------------- |
| WORKER_BATCH           | 20      | 1–100                                        |
| WORKER_CONCURRENCY     | 2       | 1–10 per process                             |
| WORKER_POLL_MS         | 1000    | 100–30000                                    |
| WORKER_ATTEMPTS        | 3       | 1–10 total attempts                          |
| WORKER_RETRY_SECONDS   | 2       | 1–60 base delay, pg-boss exponential backoff |
| WORKER_TIMEOUT_SECONDS | 30      | 5–300                                        |
| WORKER_SHUTDOWN_MS     | 10000   | 1000–30000                                   |

Pass overrides through root `.env` and rerun `worker-up`. Job retry/expiry settings
are captured when handed off; changing defaults does not rewrite existing jobs.
Queue pull polling has a 0.5-second minimum; dependency errors increase its
backoff to a maximum of 30 seconds. Queue claims and retries remain pg-boss-owned. Dispatch polling/backoff is separate from
pg-boss retry scheduling. Connections use a 2-second acquisition timeout and a
5-second SQL timeout; per-process pool maximum is concurrency plus two. Production
capacity targets and alert thresholds remain Phase 9 work.

Startup logs `ready` only after queue schema, queue existence and actual runtime
job SELECT/INSERT/UPDATE/DELETE permission checks succeed.
Missing database/schema/configuration causes `failed` and nonzero exit. Runtime
connection/dispatch errors report `degraded`; successful database/dispatch recovery
reports `ready`. Configuration errors omit values and startup errors omit details.

SIGTERM stops accepting work and drains the awaited consumer/dispatch loops.
The production entrypoint forces exit after that bound plus six seconds; Compose
allows 40 seconds. Hard death rolls back handoff/acknowledgement transactions.
Unfinished active jobs become retryable through pg-boss expiration when another
worker runs. Destination acceptance remains durable and deduplicated.

## Inspection and recovery

Use a trusted workspace command for counts, without querying payloads or secrets:

```sh
./dev exec node scripts/worker-status.mjs
```

It reports pending/accepted handoff counts, queue transport counts and retained
execution outcome/failure-code counts. An accepted handoff or completed transport
job alone does not imply a successful effect; inspect `work_results` and module
receipts through trusted, authorized database tooling for individual diagnosis.

After a PostgreSQL interruption, restore the existing database service (`./dev up`
for stopped development services). Already-running workers back off and recover
using the same durable state. Failed startup containers restart under Compose's
restart policy; `./dev worker-up 2` also restarts them explicitly. Never clear queue,
outbox, audit or receipts to repair an outage. Terminal failures remain inspectable;
manual redrive/recovery permissions and retention policies belong to later units.
The integrated recovery check runs the audit/outbox and delivery checks, then
kills active handlers and interrupts actual PostgreSQL connections at handoff,
before destination acceptance and after acceptance. It uses a test-only TCP proxy
for the disposable database; it never stops the shared development database.
Each boundary uses IPC synchronization and bounded durable-state polling.
Safe before/during/after snapshots include attempts, effect/receipt counts,
attribution and shutdown outcomes. The proxy is a local connectivity outage
rehearsal, not PostgreSQL host crash, storage corruption or backup restoration.

## Operational handoff

The repository maintainer operating the development foundation owns migration,
worker launch/stop and this check. Escalate persistent dependency failure, growing
backlog or retained terminal failure to the project owner with safe work IDs,
correlation IDs, failure codes and bounded timestamps/counts. Production on-call
ownership and response targets must be assigned in Phase 9; none is implied here.

Deployment prerequisites are the pinned Docker workspace, healthy PostgreSQL /
PostGIS, frozen dependencies and trusted deployment credentials. `./dev up` installs,
builds and migrates; `./dev migrate` reruns coordinated migrations and queue
provisioning. Runtime workers use only the restricted runtime credential. Run:

```sh
./dev up
./dev migrate
./dev worker-up 2
./dev exec node scripts/worker-status.mjs
./dev worker-down
./dev exec pnpm check:durability
./dev check
```

`./dev check` includes the durability matrix after the foundation checks. CI runs
the same foundation/durability command after `./dev up` provisions services and
schemas. Focused checks apply deployment twice in uniquely named disposable
databases and drop only those databases in `finally`, including failed runs.
They never clear development audit or failure history. A forcibly killed test
driver can leave a `myims_worker_*` / `myims_audit_*` test database; only its trusted
operator should identify and remove that isolated fixture after checking no check
process remains. Never apply this cleanup pattern to an operational database.

Commit means the action, audit and outbox intent are durable. Queue acceptance
means handoff is durable. Effect completion means the destination accepted the
effect and the authoritative execution result/receipt acknowledged it. These are
separate facts. Delivery is at least once; every real handler must provide its own
stable destination idempotency key or reconciliation protocol. The PostgreSQL
fixture destination proves only its declared adapter, not PBX, SMS or live storage.

After interruption, restore PostgreSQL, start/restart workers and inspect counts
until pending work converges. Inspect retained failures even when queue transport
says completed. Use trusted database tooling with a bounded projection, for example:

```sql
SELECT work_id, outcome, attempts, failure_code,
       first_attempt_at, last_attempt_at, finished_at
FROM public.work_results
ORDER BY last_attempt_at DESC NULLS LAST, work_id
LIMIT 50;
```

Do not export unrestricted payloads, URLs or secrets. A terminal failure following
an accepted destination effect can mean acknowledgement failed; inspect destination
and local receipts before considering any recovery. Preserve audit and failures;
no manual retry permission or retention period is established by this unit.

SIGTERM stops new dispatch and consumption. Successful in-flight drain closes the
queue/pool and exits 0; stalled work forces process exit 1 at shutdown bound plus
six seconds, releasing database connections/locks and leaving transport eligible
for expiration/retry. Diagnose nonzero shutdown before restarting, then use the
same canonical IDs. Completed effects must remain single and exhausted results
must remain inspectable. See [recovery evidence](../status/p1-u5c-evidence.md).
