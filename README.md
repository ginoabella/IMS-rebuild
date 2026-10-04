# MyIMS

Emergency response application under construction. We build one working step,
review it, and improve it. Routine technical choices are handled during implementation.

## Start developing with Docker

Install Docker with Compose, Git, and your editor. Node, pnpm, the backend, PostgreSQL/PostGIS,
both Redis services, and Asterisk run in containers. No host Node installation is
needed for this workflow. Run these commands from the repository root:

```sh
./dev up
./dev command
```

Open http://localhost:3100. Use separate terminals to run other applications:

| Command               | Application                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `./dev command`       | Command center, http://localhost:3100                              |
| `./dev platform`      | Platform console, http://localhost:3101                            |
| `./dev public`        | Public intake, http://localhost:3102                               |
| `./dev backend`       | Follow backend logs; API starts with `up` on http://localhost:4100 |
| `./dev responder`     | Responder Expo app                                                 |
| `./dev public-mobile` | Public Expo app                                                    |

```sh
./dev check       # Lint, formatting, types, builds and backend process checks
./dev shell       # Shell with Node and pnpm installed
./dev status      # Workspace and shared service status
./dev down        # Stop this stack; retain named volumes and local credentials
```

VS Code users can also choose **Dev Containers: Reopen in Container**.
See the [development runbook](docs/runbooks/development-container.md) for remote
server access, port overrides, mobile testing, troubleshooting and switching machines.
The default port 3100 avoids the existing host development process on port 3000.

## Current capability

P1-U3 establishes real backend connections to PostgreSQL/PostGIS and both Redis
services, a versioned baseline migration, and dependency-aware health. `./dev up`
builds/migrates and starts the backend automatically:

```sh
./dev health
./dev foundation-check
```

See the [backend foundation runbook](docs/runbooks/backend-foundation.md).
The applications remain foundation placeholders. Backend `/` returns
`operational: false`; authentication, incident workflows and operations UI are later
units. Asterisk has a bootstrap SIP transport; extensions, trunks and live calling
are later work. See [shared-service details](docs/runbooks/shared-services.md).

The complete Docker check builds three web apps, shared packages, the backend,
and Android/iOS Expo JavaScript bundles, then rehearses the foundation on a
disposable database with real-service connections. Native device behavior,
permissions and signing require a device/emulator outside the workspace container.
Hosted CI invokes these checks; a local pass does not prove hosted CI execution.

## Optional host workflow

The previous workflow remains available with Node 22.23.3 and pnpm 10.12.1:
`pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm dev:command` (port 3000).
Use `pnpm services:up/status/check/down` to manage shared services only.
Host backend startup requires the configuration documented in the backend runbook.
Keep host and container processes on different ports. HTTP defaults to loopback
on the host; `HOST` controls its bind address and `PORT` must be an integer 0–65535.

## Workspace boundaries

Five applications consume one modular backend with separate HTTP, worker,
telephony and deployment entry points. Shared packages establish build boundaries;
features add exports in their owning units. pnpm checks/builds in dependency order.

See the [documentation index](docs/README.md), [implementation plan](context/implementation-plan.md),
and [progress tracker](context/progress-tracker.md).
