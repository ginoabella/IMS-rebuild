# P1-U3 shared-container increment evidence

Verified: 2026-10-04 14:39 +08:00. Status: shared-container increment complete; P1-U3 overall
remains in progress pending backend configuration, migrations and health endpoints.

Docker Engine 29.8.2 / Compose 5.6.0 on Linux amd64 ran four digest-pinned services
under the dedicated `myims-rebuild-dev` project. No service runtime was installed
on the host. All four containers remain running and healthy.

| Check                                     | Result                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm services:up`                        | Passed; waits for four healthy containers                                           |
| `pnpm services:status`                    | PostgreSQL, both Redis services and Asterisk healthy; host ports bound to loopback  |
| `pnpm services:check`                     | Passed against real containers; PostGIS responds and Asterisk SIP transport loads   |
| Stop/start persistence fixture            | PostgreSQL row and session Redis key retained; temporary fixtures removed           |
| Redis isolation                           | Session key absent from realtime Redis before/after restart                         |
| Host Redis authentication                 | Unauthenticated PING rejected; generated credentials authenticate and PING succeeds |
| Focused ESLint and formatting             | Passed                                                                              |
| Generated credential files ignored by Git | All three paths confirmed ignored                                                   |
| `git diff --check`                        | Passed                                                                              |

Initial verification caught a relative Compose mount-path error and unauthenticated
host Redis connectivity failure. The mount root was corrected, separate Redis
credentials were generated/mounted, and the full service/restart checks above
passed on retry. The failed mount attempt created no directories outside the repo.

To repeat service checks, use the commands in the
[runbook](../runbooks/shared-services.md). The restart check creates a unique
scratch schema/table and a Redis key with expiry, writes synthetic value 42,
stops/starts only this Compose project, then verifies and removes the fixtures.
It is a controlled development rehearsal, not a production recovery test.

Asterisk has no tenant endpoints/trunks/routes and no enabled AMI/ARI. Its CLI and
transport checks do not prove a live call. Baseline migrations, typed configuration,
backend liveness/readiness, dependency-outage checks and full P1-U3 completion are
still pending. Backend runtime and application builds were not changed by this
increment, so full application builds were not repeated.
