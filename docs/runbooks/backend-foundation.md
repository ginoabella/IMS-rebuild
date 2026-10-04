# Backend foundation and health

Owner: MyIMS development maintainer. P1-U3 establishes infrastructure connectivity,
versioned baseline migrations and process health. Product features remain in later units.

## Start and inspect

From the repository root, with Docker/Compose running:

```sh
./dev up
./dev health
./dev backend
```

`up` starts shared services and the workspace, installs frozen dependencies, builds
backend/shared packages, applies migrations through the deployment entry point,
and starts a separate backend container. It waits for backend readiness before
returning. `backend` follows backend logs; Ctrl+C exits log viewing and leaves the
container running. HTTP source changes reload through the development watcher.
The command-center preview is started separately with `./dev command`.

Backend defaults to host loopback port 4100. Inside Docker it is `backend:4000`.
No firewall forwarding or public backend binding is needed to inspect health.

```sh
curl http://127.0.0.1:4100/health/live
curl http://127.0.0.1:4100/health/ready
```

| Endpoint        | Behavior                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health/live`  | HTTP 200, `{"status":"alive"}` while the process serves HTTP; dependency-independent.                                                                     |
| `/health/ready` | HTTP 200 only when PostgreSQL/PostGIS, the baseline migration and both authenticated Redis connections pass. Otherwise HTTP 503 with dependency statuses. |
| `/`             | Foundation placeholder with `operational: false`; no operational application capability is claimed.                                                       |

Health responses use `Cache-Control: no-store`. Checks run concurrently with bounded
connection/query/command timeouts. PostgreSQL uses a pool of five connections by
default; Redis disables offline command queuing and reconnects with bounded backoff.
Liveness remains available during dependency failure, while readiness returns 503.
Asterisk bootstrap health is monitored separately by Compose; HTTP does not require
PBX management connectivity before the telephony units implement it.

## Baseline migration and credentials

```sh
./dev migrate             # Build backend, apply pending migrations through deployment
./dev foundation-check    # Fresh database, rerun/concurrency, configuration and outage tests
./dev check               # Complete workspace quality checks plus foundation rehearsal
./dev down                # Stop this stack; retain its data/dependency volumes and secrets
```

`infra/database/migrations` owns version-controlled SQL migrations, and
`infra/database/schema.prisma` initially contains no feature models. Prisma 7.10.0
Migrate owns `_prisma_migrations` and uses advisory locking. The deployment wrapper
also holds a PostgreSQL advisory lock through migration and runtime credential
provisioning, so concurrent commands targeting the same database serialize fully.
HTTP processes never migrate. Repeating migration deployment preserves existing
data and applies pending migrations only; no reset is part of startup.

The baseline enables PostGIS, creates the `myims_runtime` login role without
superuser, database creation, role administration or RLS-bypass privileges, revokes
public schema creation, and grants runtime access to migration metadata. Feature
migrations must explicitly grant the runtime role the access their repositories need.
There are no tenant, identity, incident, or other product tables in this baseline.

The workspace/deployment path receives bootstrap migration credentials. The backend
container receives only runtime PostgreSQL and Redis credentials, with read-only
source/dependency mounts; the host `.local` directory and database admin secret are
not mounted there. Runtime and migration URLs must target the same database. The
trusted deployment command assigns the generated runtime password after migration
using parameterized values and server-side quoting. Passwords do not appear in SQL
migration files, CLI arguments, health responses or process diagnostics.

Development credentials live under the Git-ignored `.local/shared-services` directory.
The PostgreSQL admin and runtime files are owner-only and preserved across starts.
Redis files contain one generated `requirepass` directive. Back up data together
with the corresponding credentials. Production uses protected secret injection and
separate trusted deployment/runtime access; these local containers do not establish
production HA or operational rollout readiness.

## Configuration

`packages/config` owns runtime validation. Secret-file reading belongs to the backend
infrastructure adapter. Compose supplies the default development endpoints and mounts
credentials as secrets. Missing/invalid required values fail startup with the field
name and a safe message; raw URLs, passwords and stack traces are not returned.

| Variable                                              | Purpose                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | Runtime PostgreSQL URL with user and database name.                                                                          |
| `DATABASE_PASSWORD_FILE`                              | Absolute path to a nonempty single-line runtime password, when the URL contains no password.                                 |
| `MIGRATION_DATABASE_URL`                              | Trusted deployment PostgreSQL URL; excluded from API runtime.                                                                |
| `MIGRATION_DATABASE_PASSWORD_FILE`                    | Absolute path to migration password; excluded from API runtime.                                                              |
| `SESSION_REDIS_URL`, `REALTIME_REDIS_URL`             | Separate Redis service URLs; supports `redis` and `rediss`.                                                                  |
| `SESSION_REDIS_AUTH_FILE`, `REALTIME_REDIS_AUTH_FILE` | Absolute paths to generated `requirepass` configuration files when URLs contain no password.                                 |
| `HOST`, `PORT`                                        | HTTP bind; defaults 127.0.0.1 and 4000. Docker sets HOST to 0.0.0.0, with the published backend port still on host loopback. |
| `DEPENDENCY_TIMEOUT_MS`                               | 100–10000 milliseconds, default 2000.                                                                                        |
| `DATABASE_POOL_MAX`                                   | 1–20 connections per HTTP process, default 5.                                                                                |

A connection may use an inline URL password or its secret-file reference, never
both. Redis workloads must target separate physical service addresses. For optional
host development, supply these values through protected environment configuration,
build with `pnpm build:backend`, deploy with `pnpm db:migrate`, and start with
`pnpm dev:backend`. Compose `.env` holds host bindings/ports; it is not automatically
loaded by arbitrary host Node processes.

## Verification and recovery

The foundation rehearsal creates a uniquely named disposable database on the local
PostgreSQL service and removes it afterward. It tests fresh-schema readiness,
concurrent migration commands, repeat deployment, runtime privilege restrictions,
backend restart, invalid configuration and unavailable credentials. Private TCP
proxies interrupt each test process's real database/Redis connections; existing
shared services and the command-center preview remain running during outage tests.
Fixtures are not written into the application database or Redis stores.

During failure, inspect `./dev health` and `./dev backend`. Restore the dependency
or configuration and allow reconnects, or rerun `./dev up`. Failed migration history
must be investigated before retry; never edit an applied migration or reset a shared
database to hide a failure. Deployment lock acquisition is limited to 20 seconds;
the Prisma migration command is limited to 60 seconds and its own advisory lock
to 10 seconds. Rerun after
another deployment finishes. The baseline adds infrastructure only; do not drop
PostGIS or its role during ordinary rollback. Stop containers with `./dev down`
and use backup/restore when reverting persisted schema is actually necessary.

Prisma migration behavior follows [Prisma v7 deployment and advisory locking](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production).
Pooling/timeouts follow [node-postgres](https://node-postgres.com/apis/client), and
Redis recovery follows [node-redis production guidance](https://redis.io/docs/latest/develop/clients/nodejs/produsage/).
