# Development workspace in Docker

Owner: MyIMS development maintainer. Use the project's build, review, improve
process: build one step, run checks, review the working result, incorporate changes.
Docker is the default development environment, including Node and pnpm.

## Prerequisites and first start

Install Docker Engine with Compose on Linux, or Docker Desktop with Compose on
macOS/Windows. Docker must be running and usable by your user. Keep Git, an editor,
a browser and a POSIX shell on the host. Windows users should clone and run the
project inside WSL for Linux file permissions and file watching. Registry and
package-network access are needed for the first build/install.

```sh
git clone https://github.com/ginoabella/IMS-rebuild.git
cd IMS-rebuild
./dev up
./dev command
```

Open http://localhost:3100. `up` prepares local credentials, builds the pinned
Node 22.23.3/pnpm 10.12.1 workspace, waits for five healthy shared services and provisions private Garage storage, and
installs dependencies from the frozen lockfile inside Docker. It is safe to rerun.
The backend starts automatically after its baseline migration. Web/mobile processes
start when you run their command, in the foreground.
Stop each development command with Ctrl+C; use another terminal for other apps.

| Command                                     | Purpose / host port                                           |
| ------------------------------------------- | ------------------------------------------------------------- |
| `./dev command`                             | Command center, 3100                                          |
| `./dev platform`                            | Platform console, 3101                                        |
| `./dev public`                              | Public web, 3102                                              |
| `./dev backend`                             | Follow backend logs; API starts with up on 4100               |
| `./dev responder`                           | Responder Expo development server, 8081                       |
| `./dev public-mobile`                       | Public Expo development server, 8081                          |
| `./dev check`                               | Complete quality/build/process checks                         |
| `./dev shell`                               | Interactive workspace shell                                   |
| `./dev exec pnpm typecheck`                 | Run a specific workspace command                              |
| `./dev exec pnpm install --frozen-lockfile` | Update dependencies after pulling                             |
| `./dev status`                              | List containers and health                                    |
| `./dev down`                                | Stop/remove this project's containers/network, retain volumes |

Only one mobile Metro server uses 8081 at a time. These commands are host launchers;
inside the workspace shell or VS Code container terminal use `pnpm dev:command`,
`pnpm check`, etc. The workspace has no Docker CLI or Docker socket. Run Docker and
shared-container management commands from a host terminal.

## VS Code

Install VS Code's Dev Containers extension. Open the repository and choose
**Dev Containers: Reopen in Container**. Run `./dev up` first on the host to
provision Garage buckets/keys through trusted tooling. The configuration prepares credentials
on the host, starts the workspace and dependencies, installs frozen dependencies,
and opens `/workspace` as the non-root `node` user. ESLint and Prettier extensions
are configured. Closing VS Code leaves the stack running; `./dev down` stops it.
When using Remote SSH, Docker runs on the remote server, where the checkout lives.

## Isolation and persistence

Source code is bind-mounted, so edits appear on the host and support hot reload.
The workspace user matches the Linux checkout owner's UID/GID and creates normal
editable source artifacts. Use a checkout owned by your non-root development user.
Each workspace project's `node_modules`, the pnpm store, and all three Next.js
`.next` directories use separate named Docker volumes. Host dependencies and
Next.js caches remain separate, including the existing app on host port 3000.
Other generated files such as TypeScript `dist` remain ignored repository artifacts.

The Compose project name is `myims-rebuild-dev`. `./dev down` retains dependencies,
database/session/PBX/Garage volumes and `.local/shared-services` credentials. Avoid
`docker compose down -v` for routine work: it deletes data and dependency volumes.
If the database volume exists but its password file is missing, startup refuses
to replace it; restore the original password file. See the
[shared-services runbook](shared-services.md) for secrets and persistence details.

The workspace connects through Docker service names: `postgres:5432`,
`session-redis:6379`, `realtime-redis:6379`, `asterisk:5060/udp`, and `garage:3900`.
Backend adapters and typed secret configuration now connect to PostgreSQL and both
Redis services. Run `./dev health` for actual liveness/readiness; see the
[backend foundation runbook](backend-foundation.md).

## Port conflicts and remote access

`./dev` explicitly loads the repository-root `.env` when it exists.
Defaults bind to `127.0.0.1`. Copy `.env.example` to `.env` and change only ports
that conflict, then rerun `./dev up`. Keep `.env` private and uncommitted.
For example, `MYIMS_COMMAND_PORT=3200` maps host 3200 to container 3000; the app's
internal port remains 3000. No port conflict can be eliminated by containerization
alone because published ports still belong to the host.

For the current server, the straightforward option is an SSH tunnel:

```sh
ssh -L 3100:127.0.0.1:3100 gino@203.177.64.131
```

Then browse http://localhost:3100 on your workstation. To use the existing direct
server IP instead, set `MYIMS_COMMAND_BIND=0.0.0.0` in `.env`, rerun `./dev up`, start
`./dev command`, and browse http://203.177.64.131:3100. This exposes only command-center port 3100;
the other ports stay on localhost. Host firewall/NAT rules determine reachability.
On this server, public TCP 3100 must reach `172.16.7.53:3100` through the router.
Successful access on port 3000 does not establish forwarding for port 3100.
`MYIMS_WEB_BIND` controls the default binding for the other workspace ports.
Command center allows `203.177.64.131` and `172.16.7.53` in Next.js `allowedDevOrigins`.
For a different hostname, add that exact host to the relevant app's Next config
and restart its dev command. Shared services continue binding to loopback.

## Mobile and machine portability

The container produces Android/iOS JavaScript bundles. A physical device or
emulator and native Android/iOS build tools remain outside this container. Expo's
advertised Docker address may be unreachable from a device; configure an accessible
host address with `REACT_NATIVE_PACKAGER_HOSTNAME` and appropriate published port,
or use an Expo tunnel with its required tooling. Native testing and tunnel setup
have not been verified by this increment.

To switch machines, clone the repository and run `./dev up`. Fresh named volumes
and fresh service credentials are created on that machine; development database
contents do not move with Git. Moving data requires backup/restore together with
the corresponding credentials. The PostGIS service explicitly uses linux/amd64;
ARM machines need amd64 emulation (Docker Desktop commonly provides it). Linux
amd64 is verified; macOS, Windows, ARM and VS Code UI attachment remain unverified.

## Troubleshooting and rollback

- Docker unavailable: start Docker and confirm `docker info` works as your user.
- Startup fails: inspect `./dev status` and
  `docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml --profile workspace logs`.
- Dependencies change: rerun `./dev up` or the frozen install command above.
- Workspace image changes: rerun `./dev up` to rebuild/recreate it.
- Run checks with application dev processes stopped, because builds and dev share
  each app's container cache. Stop with Ctrl+C before `./dev check`.
- Rollback to the optional host workflow: `./dev down`, install the pinned host
  Node/pnpm versions, and use the commands in the README. Data volumes are retained.

This is a development environment. Backend baseline migrations and dependency
health are implemented; production images/deployment, live PBX calls and operational
features remain later work. See [backend startup and verification](backend-foundation.md).

## Reference

Persistence and mount behavior follow [Docker volumes](https://docs.docker.com/engine/storage/volumes/).
The optional workspace uses [Compose profiles](https://docs.docker.com/compose/how-tos/profiles/);
editor integration follows the [Dev Container configuration reference](https://containers.dev/implementors/json_reference/).

## Current server preview

The server-local `.env` selects public binding for command-center port 3100 only.
The command center was started in the background for review. Inspect its logs with:

```sh
./dev exec tail -n 40 /tmp/myims-command-dev.log
```

After a workspace restart/recreation, start it again with `./dev command` and keep
that terminal running. `./dev up` starts the workspace, shared services and backend;
web/mobile servers use their separate commands. `.env` is ignored by Git, so configure
the binding separately when moving to another server.

## Backend startup and checks

`./dev up` now builds the backend/config/contracts, applies the baseline through
the trusted deployment entry point, and starts a separate backend container on
host loopback port 4100. `./dev backend` follows its logs; `./dev health` reports
liveness and dependency readiness. `./dev migrate` applies pending migrations.
`./dev foundation-check` rehearses fresh startup, concurrent/rerun migration,
configuration errors, dependency outages/recovery and backend restart using
private fixtures. `./dev check` includes that rehearsal after workspace checks.

The backend container has read-only source/dependencies and only runtime secrets;
the development workspace retains trusted deployment access. Closing an app
terminal does not stop the backend container. `./dev down` stops the complete stack.
VS Code workspace users should run `./dev up` from a host terminal for complete
backend startup; its port 4100 belongs to the separate backend container.

Garage storage uses internal HTTP and private persistent volumes; no HTTPS setup is
required for local adapter checks. See [storage operations](shared-storage.md).

## Session lifecycle verification

Use `./dev exec pnpm check:session-foundation --lifecycle` for lifecycle-only
checks or `--authority` for two HTTP replicas plus lifecycle regressions. Omitting
the selection runs both. See the [HTTP authority runbook](canonical-http-authority.md).
The launcher creates and cleans its own authenticated Redis container/data volume
and the suite owns its disposable PostgreSQL database. The workspace has no
Docker socket; the host fixture helper uses the existing trusted Docker boundary.
`./dev check` and the explicit CI lifecycle step run this suite. See the
[session recovery runbook](shared-session-lifecycle.md) for bounded settings and
restoration limits.
