# Development container verification

Date: 2026-10-04. Environment: Linux amd64, Docker Engine 29.8.2,
Compose 5.6.0. Scope: container development toolchain, not operational features.

## Verified behavior

- Built the development image and installed frozen workspace dependencies in Docker.
  Node reports 22.23.3; pnpm reports 10.12.1.
- Workspace commands run as the non-root checkout owner (UID/GID 1002 in this
  environment). Source is bind-mounted; all 11 workspace dependency directories,
  three Next.js caches and the pnpm store use 15 named volumes. No Docker socket
  is mounted. Host dependency directories are covered by separate container mounts.
- pnpm initially selected `/workspace/.pnpm-store` because of filesystem placement.
  Set an explicit container store path, moved the generated store into its volume,
  reinstalled dependencies, and removed the temporary host store. The effective
  store is `/home/node/.local/share/pnpm/store/v10`.
- `./dev prepare` and `./dev exec node --version` passed with a restricted host
  PATH containing Docker, id and dirname, with no host Node/pnpm available.
  Repeating `./dev up` under the same restricted PATH also passed; all services
  remained healthy and the frozen install reported already up to date (4.3 seconds).
- Command-center development server returned HTTP 200 through host port 3100.
  A temporary test route picked up a source edit without restarting the server.
  Backend returned the expected foundation JSON through port 4100. Removed the
  temporary route and restarted only the workspace to stop test app processes.
- Workspace reached PostgreSQL over TCP and authenticated to each separate Redis
  service with PING. The existing service check also passed PostgreSQL/PostGIS,
  both authenticated Redis PINGs and Asterisk 22/PJSIP transport checks.
- Disposable credential initialization checks passed: missing password with an
  existing database is rejected, repeated initialization preserves secrets,
  directory/database-password permissions are 0700/0600, and Redis secrets differ.
  Temporary fixtures were removed and no credentials were printed.
- Shell syntax, documentation relative links and patch whitespace checks passed.

## Complete quality check

`./dev check` passed with exit code 0 inside Docker:

- Root and all workspace lint, Prettier checks and strict TypeScript checks.
- All four shared-package builds, three Next.js production builds, and backend compilation.
- Android and iOS JavaScript/assets exports for both Expo applications.
- All four backend entry points started independently and shut down cleanly.
  HTTP returned the expected foundation JSON; worker/telephony/deployment listener
  isolation passed.

The check ran after dependency-store correction and workspace restart. Browser
WebSocket HMR was not separately exercised; source-reload verification used HTTP
responses from the running Next.js development server.

## Limits and remaining work

VS Code configuration is supplied; interactive VS Code attachment was not tested.
Hosted GitHub Actions has been changed to use the Docker CLI workflow but was not
executed here. macOS, Windows, ARM emulation, native mobile devices/emulators,
Expo device networking and live PBX calls were not exercised.

At this checkpoint, backend connections, baseline migrations, typed dependency
configuration and liveness/readiness were unfinished P1-U3 work. Subsequent
[P1-U3 verification](p1-u3-evidence.md) records their implementation and checks.
The applications remain foundation placeholders, and backend `/` still reports
`operational: false`.

## Server preview access correction

The initial defaults published port 3100 only on localhost, and the workspace was
idle after smoke-test cleanup. The user requested the public-IP preview and
confirmed that `203.177.64.131` is forwarded by a firewall to LAN server `172.16.7.53`.

Added `MYIMS_COMMAND_BIND` so only the requested command-center port can bind
publicly. The server-local `.env` selects `0.0.0.0` for command center while the
other workspace ports remain on `127.0.0.1`. Also corrected the launcher to load
root `.env` explicitly, since Compose's configuration directory differed from it.

After recreation, started the command center in the background. Verified host
listener `0.0.0.0:3100`, the resolved Compose port mappings, and HTTP 200 with the
command-center page through `172.16.7.53:3100`. Added both LAN/public Next.js
allowed development origins. Public access requires firewall forwarding of TCP
`203.177.64.131:3100` to `172.16.7.53:3100`; a request to the public URL from this server also returned HTTP 200.
An independent external browser was not tested. Backend, Metro, other web ports
and shared services remain local.
