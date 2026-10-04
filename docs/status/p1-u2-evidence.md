# P1-U2 verification evidence

Completed: 2026-10-04 13:59 +08:00.
Boundary: workspace/app scaffolding; operational features are not implemented.

## Delivered

Five application skeletons, four shared package boundaries, four isolated NestJS
entry points, strict TypeScript, lint/format checks, pnpm dependency-ordered builds,
pinned Node/package manager/direct dependencies and lockfile, CI configuration,
setup documentation and a workspace decision record.

## Checks and observed results

| Procedure                                                                  | Result                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` in workspace                              | Passed; lockfile unchanged                                                                                   |
| `pnpm check` in workspace                                                  | Passed, exit 0                                                                                               |
| Clean-copy `pnpm install --frozen-lockfile`                                | Passed with registry access                                                                                  |
| Clean-copy `CI=1 NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1 pnpm check` | Passed, exit 0                                                                                               |
| Expo `install --check` for the shared mobile dependency set                | Passed after matching React Native 0.83.10 to Expo SDK 55                                                    |
| Three production Next.js servers; request `/`                              | HTTP 200; correct application title and pending-feature text                                                 |
| Both mobile exports' `dist/metadata.json` and referenced bundles           | Android and iOS files exist for each app                                                                     |
| All four backend entry points                                              | Independent startup; HTTP response verified; non-HTTP listeners prohibited; clean shutdown; deployment exits |
| Documentation file links and `git diff --check`                            | Passed                                                                                                       |

The clean source snapshot was `/tmp/myims-p1-u2-bfi2nl8z`. It excluded `.git`,
`node_modules`, `.next`, `.expo`, `dist`, TypeScript build information and generated
`next-env.d.ts`. No pre-existing application build output was supplied. The host
already had Node 22.23.3 and pnpm 10.12.1; shared tooling caches may be reused.
An offline install attempt initially lacked cached tarballs; normal frozen install
then downloaded dependencies successfully. That offline attempt is not a required
acceptance failure: setup requires package-registry access for uncached packages.
Clean-check output is retained locally at `/tmp/myims-p1-u2-clean-check.log`.

To repeat after the source is committed, clone it into a new directory, use the
pinned toolchain and run the install/check commands above. For HTTP smoke, build,
start each web app with its package `start` script on an unused port, request `/`,
verify the title and pending-feature text, then terminate the server. The process
check is reproducible with `pnpm check:entrypoints`.

## Limits and next unit

Hosted CI has been configured but not executed. Mobile checks export JavaScript
and Hermes bytecode; they do not prove native signing, device behavior, permissions
or assignment journeys. Web smoke proves server rendering, not a complete browser
operational journey. Worker and telephony contexts are idle skeletons; no jobs or
PBX integrations are claimed. HTTP `/` is a foundation placeholder, not dependency
readiness. No database or authenticated operational behavior exists yet.

P1-U3 owns Compose, PostgreSQL/PostGIS, migrations, separate Redis services,
validated runtime configuration and liveness/readiness. P1-U1's product proposals
remain deferred and require answers only before dependent feature implementation.
