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

Platform operator sign-in requires HTTPS and the private authentication proxy;
the HTTP preview command alone does not provide that setup. Review the
[private platform HTTPS runbook](platform-development-https.md)
for `./dev platform-https`, Windows/macOS certificate trust and the approved private SSH
tunnel to `https://localhost:3443`. The launcher uses the existing shared services
and bootstrap account without migration or container recreation.

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

## Observation profile workspace recreation

The approved local PBX observation preparer masks
`/workspace/.local/pbx-observation` with an empty root-owned tmpfs so general
workspace HTTP/web processes cannot read host observer/server material. On first
activation it recreates the workspace if that material was previously readable.
Persistent source, dependency/cache volumes and private development files remain;
processes and packages/browser binaries installed only in the old container do not.

Restore the existing Playwright verification environment using the same commands
as CI before browser regressions after such a recreation:

```sh
./dev exec pnpm exec playwright install chromium
docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml exec -T --user root workspace pnpm exec playwright install-deps chromium
```

Restart previously running private platform/staff HTTPS supervisors using their
runbooks and verify both report ready. PBX observer material remains unavailable
to them. See [local PBX observation operations](pbx-observation.md) for the scoped
approval, separate telephony process mounts, lifecycle and verification commands.

P3-U2b conditionally approves a dedicated private persistent verified-TLS OpenBao
service for controlled development only. See the [endpoint credential runbook](endpoint-credentials.md)
for process isolation, manual unseal, token custody and deferred production review.

## Retained PBX profile transition and recovery

Build the affected native dependencies through `./dev exec pnpm build:backend`.
The following Docker entry points are implemented:

```sh
./dev pbx-profile status NODE_UUID INSTALLATION_UUID
./dev pbx-profile preflight docs/status/p4-u2-dev-a-expectations.json
./dev exec pnpm check:pbx-profile
./dev pbx-profile composition-check
./dev pbx-profile preservation before NODE_UUID BEFORE.json
./dev pbx-profile rehearse-compatibility docs/status/p4-u2-dev-a-expectations.json
./dev pbx-profile rehearse docs/status/p4-u2-dev-a-expectations.json
```

Status is passive and prints sanitized facts/blockers. Preflight compares the exact
reviewed node/installation, initial/current artifact IDs, compiler/policy and
unmanaged digest, returning exit `2` if blocked. Never refresh the expectation file
to conceal drift. The checked-in expectations are dated evidence for the observed
retained installation, not a reusable default for a different installation.
Neither command changes ownership, configuration, credentials, SQL state or calls.
The host separately checks the existing installation-scoped consumer's bounded
GET-only access. Required nonzero material references remain blocked until an exact
provider-material proof exists; availability alone does not prove material values.
The native role has no provider token. Status remains informational even when it
reports blockers; preflight exits `2` when blocked.

The focused check runs behavioral tests and an actual inspection-only native
regression: five mutation methods reject and protected bytes, ownership, modes and
mtime remain identical. Run this when no separate administrative mutation is in
progress; concurrent real mutation can invalidate the preservation comparison.

`rehearse-compatibility` creates a disposable actual-Asterisk copy with network
`none`, no ports, no provider/database mounts and no writable retained mounts. It
requires an already built `myims-rebuild-dev-asterisk-live` image and material-free
retained snapshot. It verifies the old pair, six additional module loads, rejection
of old-artifact/new-profile mismatch, a new rendered compatible pair and exact old
pair restoration. The fixture copies protected bytes only in memory and its private
container layer/volumes, then removes that container and its anonymous volumes.
It emits no raw configuration or protocol data. Do not interpret this result as a
SQL transition or interruption-recovery rehearsal, or as tenant calling readiness.

`rehearse` builds the backend and pinned supervisor image, then creates owned
PostgreSQL/Asterisk copies. It exercises actual helper/PBX process loss, separately
labelled SQL faults, exact original-baseline restore, active/unknown activity,
owner loss, node-version drift at dispatch, whole-container loss before the first
selector and between static/managed selection, competing console intents,
protected custody attacks and normal console recovery across profiles. It
publishes no ports and places only bounded
Local calls inside its disposable PBX. Its copies have no provider token. Cleanup
removes only its exact database, containers and labelled volumes. `--smoke` selects
only the normal transition/restore case; `--safety` selects the additional safety
scenarios. Neither subset substitutes for the complete matrix.

The [DEV-01 review](../planning/p4-u2-dev-a-profile-transition-review.md) records
the approved preservation strategy and conditional quiet maintenance effects.
Check the [evidence ledger](../status/p4-u2-dev-a-evidence.md) before relying on
acceptance. Finish the actual isolated matrix and required sequential regressions
before retained effects. Preserve a before-state inventory of canonical history,
pins, protected artifacts, original static/reference bytes and unrelated data.
Apply the additive migration with `./dev migrate`, build the affected backend,
and refresh the existing backend/telephony consumers so their operation barriers
use the current build (`docker restart myims-rebuild-dev-backend-1 myims-rebuild-dev-telephony-1`).
Refresh ordinary private HTTPS with `./dev platform-https-stop` then
`./dev platform-https`, and `./dev staff-https-stop` then `./dev staff-https`;
each start retains its existing protected material and runs its normal build.
Persistent controlled-call preparation uses the same native helper, protected
consumer and backing stores. See the [dedicated setup/lifecycle runbook](persistent-controlled-calls.md)
for `./dev tenant-calls inspect`, `preview`, `rehearse`, `prepare`, `credentials`,
`status`, `start`, `stop`, `restart`, `reconcile` and `disable`. Preparation and
reads never place calls or grant readiness. b implementation and ordinary
preparation acceptance are complete; its [evidence](../status/p4-u2-dev-b-evidence.md)
records exact resources and the remaining c application/calling/cleanup boundary.

Check the exact old-profile preflight. A legacy helper requires the explicit
helper-only refresh below; its preflight permits only the missing new-executor
marker, and verifies the exact old loaded pair, process and inherited lock. It
terminates only that helper and verifies the Asterisk process survives.

```sh
./dev pbx-profile refresh-executor BEFORE_EXPECTATIONS.json
./dev pbx-profile preflight BEFORE_EXPECTATIONS.json
./dev pbx-profile composition-check
./dev pbx-profile upgrade BEFORE_EXPECTATIONS.json OPERATION_UUID
./dev pbx-profile operation-status BEFORE_EXPECTATIONS.json OPERATION_UUID
./dev pbx-profile reconcile BEFORE_EXPECTATIONS.json OPERATION_UUID
```

Choose a new UUID once and retain it with the immutable request. Upgrade creates
that distinct compatible artifact without changing its captured revision or pins.
It accepts one canonical intent, waits for native quiet preparation, durably records
restart uncertainty, rechecks the current owner/epoch, exact selected pair and
quiet admission barrier, and recreates only Asterisk with the same mounts/ports.
The host retains canonical locks through dispatch and releases them before waiting
for startup proof. A lost response never authorizes another restart. Operation
status is read-only; reconcile waits for independent native inspection of the
same durable operation and sends no selection/restart. `prepared` requires the
original explicit dispatch; `unknown` requires inspection and a reviewed compatible
rollback. Do not retry an uncertain effect with a different upgrade UUID.

For explicit rollback, use expectations for the currently acknowledged source
(even if its actual loaded pair is uncertain), a fresh rollback UUID, and an exact
retained compatible target/digest. Supply the unresolved predecessor UUID only
when replacing that active profile operation; omit it for an ordinary completed
profile restoration:

```sh
./dev pbx-profile rollback SOURCE_EXPECTATIONS.json ROLLBACK_UUID TARGET_ARTIFACT_UUID TARGET_UNMANAGED_DIGEST [UNRESOLVED_PREDECESSOR_UUID]
./dev pbx-profile reconcile SOURCE_EXPECTATIONS.json ROLLBACK_UUID
./dev pbx-live-check
./dev pbx-profile preservation after BEFORE.json AFTER.json
```

Rollback restores both static and managed selections, followed by the required
quiet restart and independent proof. Existing console recovery also selects the
artifact's own static profile and uses the fixed native restart when needed.
An original baseline with missing custody cannot be recaptured; preserve uncertainty
and repair custody or review a separate migration decision. Unknown activity or an
expired owner defers effects. Never force hangup, release pins, edit the selector,
copy reference credentials, or change expectations to hide drift. Ordinary startup
only reads the selected directory and invalidates stale runtime proof; it cannot
accept an upgrade or replay a selector/restart request.
An interrupted first preparation may boot the exact already-selected legacy pair
only when the protected journal proves no selector was established. Admission
stays closed until fresh native verification. After selection is established,
a missing selector blocks startup; do not recreate it from SQL or recapture a
baseline.

Run exact post-transition preflight/status and `pbx-live-check`, health and both
HTTPS checks. Preserve the dated old expectations; write a separate after-state
file for the newly verified artifact/digest. Routine provider-access expiry uses
`./dev pbx-live-access INSTALLATION_UUID`, which replaces only the scoped read
consumer with zero policy/static changes. Do not rerun `pbx-live-prepare` or
manually load modules on a retained installation. This procedure grants no tenant
routes, persistent call participants or ordinary SIP/RTP readiness.
