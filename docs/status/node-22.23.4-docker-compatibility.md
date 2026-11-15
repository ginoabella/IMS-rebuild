# Node 22.23.4 Docker compatibility

Verified 2026-11-10 (Asia/Manila, +08:00). Unit `NODE-22-PATCH-COMPAT`:
complete within the build/integration evaluation scope requested by the user.

Node **22.23.4 is compatible with the tested project builds and integrations**.
The repository still pins 22.23.3; this evaluation does not apply the upgrade.

## Candidate and isolation

- Source revision: `8e7e5c496190aa54defee98c0e5b8e3bead09820`.
- Platform: Linux amd64, Docker 29.9.3, Compose 5.7.0, pnpm 10.12.1.
- Candidate base: `node:22.23.4-bookworm-slim@sha256:aaa4b5baf1ecff3b283486bb1f90405cdda225a3e6f79660d2c559fa510a7292`
  (the registry's amd64 manifest digest).
- Unchanged lockfile SHA-256:
  `21e746bbf840b3fd6952ef23a661bb92bbfc1782b482738461fd686f58acce44`.
- Tracked source was copied into `/tmp/myims-node-22.23.4-check`. Only the three
  candidate Dockerfiles changed Node pins. Two deployment test launchers used the
  disposable Compose project/container names instead of the retained project.
- Compose project `myims-node-upgrade-check` used fresh PostgreSQL/PostGIS, Redis,
  Garage and bootstrap Asterisk volumes, fresh credentials, and no published ports.
  No retained application database, PBX configuration, storage or credential was
  used. No retained service was started or upgraded.

The existing package constraints accept this patch release. No application code,
dependency versions, lockfile, schema, timeout or test assertion was changed to
obtain the final passes.

## Results

| Check                                        | Result                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace Docker image build                 | Passed                                                                                                                                                   |
| PBX helper Docker image build                | Passed; Node 22.23.4, Asterisk 22.10.1 and embedded Node entrypoint syntax smoke checks passed                                                           |
| Backup Docker image build                    | Passed; Node 22.23.4, age 1.3.2 and restic 0.19.1 execute                                                                                                |
| `pnpm install --frozen-lockfile`             | Passed; 932 packages, unchanged lockfile                                                                                                                 |
| `pnpm lint`, `pnpm format:check`             | Passed                                                                                                                                                   |
| Shared package builds and `pnpm typecheck`   | Passed                                                                                                                                                   |
| `pnpm build`                                 | Passed: backend/shared packages, three production Next apps, both Expo apps exported for Android and iOS                                                 |
| `pnpm check:entrypoints`                     | Passed: independent HTTP/deployment startup and shutdown; missing worker/telephony settings fail clearly without listeners                               |
| `pnpm check:config`                          | Passed: six tests                                                                                                                                        |
| `pnpm db:migrate`, candidate backend startup | Passed; final live/ready HTTP 200, PostgreSQL and both Redis services up                                                                                 |
| `pnpm check:foundation`                      | Passed: 52 reported assertion groups covering migrations, audit/outbox, worker crashes/retries/recovery, storage/access, identity and operator bootstrap |
| `pnpm check:storage-clients`                 | Passed for all five app bundles                                                                                                                          |
| `node scripts/check-storage-deployment.mjs`  | Passed: provisioning reruns, provider restart, persistent bytes, runtime mounts and secret exclusion                                                     |
| `node scripts/check-session-deployment.mjs`  | Full unchanged rerun passed, exit 0; 67 reported assertion groups                                                                                        |

These execute the quality and integration stages used by `./dev check` against
the disposable stack. The retained project's literal `./dev check` command was
not run.

The session suite covered real PostgreSQL/Redis and independent HTTP replicas,
platform/staff authentication, shared admission limits, credential lifecycle,
draft/onboarding/geography/voice APIs, Chromium HTTPS browser journeys, session
expiry/rotation/revocation, lost responses, backing-service outages/restarts and
PBX registry APIs. Existing fixture-only presentation and mobile port checks
retain their original evidence limits.

## Initial failures and resolution

1. A temporary isolation-only edit to the storage provisioner's default container
   name caused a formatting warning. The edit was removed, restoring that source
   file, and formatting passed. Isolation used the supported environment override.
2. Type checking in the pristine copy initially lacked generated shared-package
   declarations (`@myims/contracts` and `@myims/ui-web`). Building the shared
   packages first resolved this; all subsequent typechecks and builds passed:

   ```sh
   pnpm -r --filter './packages/*' --workspace-concurrency=1 build
   pnpm typecheck
   pnpm build
   ```

3. The first full session run failed at
   `scripts/check-tenant-geography.mjs:435`: the maximum 1,000-feature request
   returned HTTP 503 instead of 200. PostgreSQL independently logged a statement
   timeout in `valid_tenant_geography`, in its feature-pair topology validation.
   The unchanged focused `--draft-tenant` suite then passed on both the existing
   Node 22.23.3 image and the candidate 22.23.4 image using the same disposable
   backing services. The entire session suite was rerun unchanged on 22.23.4 and
   passed, including that geography assertion and all remaining checks. This
   does not establish a repeatable Node regression; the observed SQL timeout
   remains a performance/reliability follow-up. No limits were relaxed.

## Handoff and limits

The coordinated patch update can proceed within this verified scope: update all
active Node pins and Docker digests, then rebuild/recreate the intended development
services through their supported workflow. Recheck the available security release
at implementation time. See the [22.23.4 release notes](https://nodejs.org/en/blog/release/v22.23.4)
and [October security advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

This evaluation does not prove live PBX apply/recovery or SIP/RTP calls, real
OpenBao material consumption, backup upload/restore, native OS device behavior,
production load/availability, or other CPU architectures. PBX and backup image
coverage here is build/runtime smoke coverage; the broader service checks use
their existing declared real/fixture boundaries.

Raw local logs are `/tmp/myims-node-candidate-*.log`; baseline comparison logs
are `/tmp/myims-node-baseline-*.log`. These are temporary diagnostics, not durable
repository evidence. Candidate images remain available as
`myims-node-upgrade-check-workspace`, `myims-node-upgrade-check-asterisk` and
`myims-node-upgrade-check-backup`. Disposable services and their volumes are
removed after verification; retained development state remains unchanged.
