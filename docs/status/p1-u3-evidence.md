# P1-U3 backend foundation verification

Date: 2026-10-04 (Asia/Manila). Environment: Linux amd64, Docker development
workspace with Node 22.23.3 and pnpm 10.12.1, Docker Engine 29.8.2 and Compose
5.6.0. This unit establishes infrastructure
connectivity, baseline schema deployment and health; applications remain placeholders.

## Scope and verification commands

```sh
./dev up
./dev check
./dev health
```

The complete check runs lint, formatting, strict TypeScript, all package/application
builds, four independent backend entry-point checks, configuration tests and the
live foundation rehearsal. The rehearsal creates and removes a uniquely named
database; private TCP proxies interrupt only its test backend connections.

## Acceptance evidence

`./dev check` passed with exit code 0:

- Root/workspace lint, formatting and strict TypeScript checks passed.
- All shared packages, three production web apps and backend compiled; Android
  and iOS bundle exports passed for both mobile apps.
- HTTP, worker, telephony and deployment processes started independently and
  shut down cleanly; listener isolation passed for non-HTTP entry points.
- All three configuration test groups passed: defaults/limits, missing/malformed
  or ambiguous values without secret disclosure, and distinct credential sources.
- A fresh disposable database returned readiness 503 while liveness remained
  200, then became ready after its baseline migration.
- Two simultaneous migration deployments and a subsequent rerun passed. The
  database contained exactly one completed baseline migration and PostGIS.
- The runtime role had no superuser, database-creation, role-administration or
  RLS-bypass privileges; an attempted feature-table creation was rejected.
- Interrupting PostgreSQL, session Redis and realtime Redis independently
  returned readiness 503 within the test's three-second bound. Liveness stayed
  at 200; restoring each connection recovered readiness to 200.
- Backend shutdown/restart retained the baseline and reconnected. Missing URL,
  invalid port and unreadable password file exited clearly with status 1.
- Captured process output contained none of the resolved credential passwords.
  Health responses returned only status/check fields with `Cache-Control: no-store`.

Host `http://127.0.0.1:4100/health/ready` also returned HTTP 200 with all three
dependencies up. Documentation relative-file links and `git diff --check` passed.
`./dev up` subsequently passed with exit code 0: frozen installation was up to date,
backend/shared packages built, migration deployment reran successfully, and the
separate backend was recreated and became healthy before the command returned.
The first full-check attempt stopped on README formatting; formatting was fixed
and the complete check was rerun successfully. Temporary database/proxy/process
fixtures were removed by the rehearsal.

## Implementation decisions

- Prisma owns versioned SQL migration history. The deployment entry point applies
  migrations under advisory locking and provisions runtime credentials; HTTP
  replicas never migrate.
- The baseline enables PostGIS and restricts `myims_runtime`; feature tables and
  their grants belong to subsequent units. No product records are seeded.
- Typed configuration rejects missing/invalid values with safe field messages.
  Secret-file resolution belongs to the backend adapter. Separate PostgreSQL
  runtime/deployment credentials and separate Redis services are required.
- The separate backend container receives runtime secrets and read-only source
  mounts. It does not mount the host credentials directory or migration secret.
- Dependency checks use bounded timeouts. Liveness is independent of backing
  services; readiness requires PostGIS, the baseline and both Redis connections.

## Limits

Local verification does not prove hosted CI, production deployment/HA, native
device behavior, operational workflows, PBX administration or live calling.
Asterisk runtime bootstrap was verified in the
[shared-services checkpoint](p1-u3-shared-services-evidence.md); HTTP readiness
does not require PBX administration connectivity before its owning units.
Fresh-database rehearsal is not a new-machine or full fresh-clone Docker rehearsal;
the prior [workspace checkpoint](development-container-evidence.md) records its
separate checks and portability limits.
