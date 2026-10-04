# MyIMS

Emergency response application under construction. Start with one verified unit
at a time; product decisions are resolved when a feature needs them.

## Local setup

Use Node.js 22.23.3 (`nvm install && nvm use`) and pnpm 10.12.1. With Corepack
available, run `corepack enable` and `corepack prepare pnpm@10.12.1 --activate`.
Then run:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The root check runs lint, formatting, strict typechecking, dependency-ordered
builds, and backend process checks. `pnpm build` includes all three Next.js apps,
four shared packages, backend compilation, and Android/iOS Expo JS bundles.
Mobile bundles do not prove native device behavior, permissions, or signing.
CI uses the same commands. CI execution itself is not verified by a local run.

## Shared services in Docker

PostgreSQL/PostGIS, two Redis services and Asterisk run in containers; their
runtimes do not need to be installed on the host. Docker and Compose are already
available on the development server.

```sh
pnpm services:up
pnpm services:status
pnpm services:check
```

Stop them with `pnpm services:down`; database and session data are retained.
See [shared-service setup](docs/runbooks/shared-services.md) for ports and details.
Backend connections, baseline migrations and health endpoints are the next P1-U3
increment. Asterisk extensions, trunks and routing remain in the telephony units.

## Run an application

```sh
pnpm dev:command
```

Open http://localhost:3000 for the command center placeholder. Remote development
through http://203.177.64.131:3000 is also allowed for Next.js development resources
and hot reload. Restart `pnpm dev:command` after changing allowed development origins.
If port 3000 is occupied, stop the conflicting service you manage before starting.
Other commands:

| Command                  | Application                                               |
| ------------------------ | --------------------------------------------------------- |
| `pnpm dev:platform`      | Platform console, http://localhost:3001                   |
| `pnpm dev:public`        | Public intake, http://localhost:3002                      |
| `pnpm dev:backend`       | Backend foundation, http://127.0.0.1:4000                 |
| `pnpm dev:responder`     | Responder Expo app; open on a compatible simulator/device |
| `pnpm dev:public-mobile` | Public Expo app; open on a compatible simulator/device    |

These are minimal placeholders. Authentication, operations UI, backend database
integration and telephony features are pending; the shared containers are available. Backend `/` reports `operational: false`;
it is not a dependency readiness endpoint. P1-U3 will establish health/readiness.
HTTP binds to loopback during scaffolding. No secrets or external services are
required for P1-U2. Set `PORT` only to an integer between 0 and 65535.

For compiled backend entry points, run `pnpm --filter @myims/backend build`, then
`pnpm --filter @myims/backend start:http` (or `start:worker`, `start:telephony`,
`start:deployment`). Worker and telephony are idle application contexts without
jobs, PBX connections or HTTP listeners; deployment initializes and exits. Stop
long-running processes with Ctrl+C. `pnpm check:entrypoints` verifies isolation,
HTTP output, no network listener in non-HTTP processes, and clean shutdown.

## Workspace boundaries

Five applications consume one modular backend. Shared packages contain exports
only as owning units need them; their current empty exports establish package
build boundaries. Web apps depend on `ui-web` and `contracts`; mobile depends on
`contracts`; backend depends on `config` and `contracts`. There are no alternate
API or shared UI packages. pnpm recursively checks/builds in dependency order;
serial execution keeps local resource usage predictable.

See the [documentation index](docs/README.md), [implementation plan](context/implementation-plan.md),
and [progress tracker](context/progress-tracker.md).
