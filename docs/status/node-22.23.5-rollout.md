# Node 22.23.5 development rollout

**Complete within the private development rollout scope, 2026-11-14
(Asia/Manila, +08:00).** The user prioritized pending Node work before
P4-U2-DEV-c. Development Docker runtimes now use Node **22.23.5** and pnpm
**10.12.1**. The pending maximum-feature geography SQL timeout was reproduced,
fixed without relaxing validation or timeouts, and verified before ordinary deployment.
P4-U2-DEV-c remains deferred and incomplete; no ordinary calling acceptance is claimed.

## Version and implementation scope

The [official release index](https://nodejs.org/dist/index.json) was rechecked on
November 14. [Node 22.23.5](https://nodejs.org/en/blog/release/v22.23.5), released
November 11, superseded the earlier
[22.23.4 compatibility evaluation](node-22.23.4-docker-compatibility.md).
The official image's Linux amd64 manifest is pinned throughout active tooling:

`node:22.23.5-bookworm-slim@sha256:47725aca53d3295ec2d3be8f62726599b3033cc262edc2c7e429909b3ac599fc`

Updated workspace/PBX/backup Dockerfiles, deployment/test launchers, `.nvmrc`,
package engine minimum and current setup documentation together. Historical reports
and immutable backup image/source declarations retain their original versions.
No application dependency, reference configuration or endpoint material changed.
Lockfile SHA-256 remains
`21e746bbf840b3fd6952ef23a661bb92bbfc1782b482738461fd686f58acce44`.

Actual workspace, backend, telephony and Asterisk containers each report
`v22.23.5`. The PBX remains Asterisk 22.10.1. Backup image smoke checks report
Node 22.23.5, age 1.3.2 and restic 0.19.1. Its candidate tag was updated; no backup
operation, upload, restore or scheduler was activated. Existing failed backup work
and its immutable recovery image remain untouched. Host Node and other CPU
architectures were not upgraded or certified.

## Pending geography issue closed

The first complete-session rerun reproduced the prior maximum-1,000-feature
failure at `check-tenant-geography.mjs:435`: HTTP 503 instead of 200. PostgreSQL
confirmed a statement timeout in the original interior-overlap pair query. This
was already observed during 22.23.4 evaluation; no Node-specific cause is asserted.

Additive migration `20261114000000_tenant_geography_overlap_cost` shares a bounded
bounding-box sweep between the CHECK and owner diagnostics. Cached numeric bounds
reject disjoint pairs before accessing geometry. Remaining candidates use the same
exact `&&` / `ST_Relate(...,'2********')` predicates, with original feature ordinals.
All per-feature, coordinate, containment, metadata and topology rules, safe errors,
4,096-position/1,000-feature bounds and the 2-second statement timeout remain intact.
Original migrations were not edited. No canonical geography row was rewritten.

Transaction-local temporary-schema benchmarks were rolled back. Refined pair
search measured 118–167 ms versus 421 ms for the old self-join in the same run;
full validation measured 299–496 ms versus 509–825 ms. These are diagnostic samples,
not universal latency promises. Earlier experimental sweep timings had insufficient
margin and were refined before acceptance.

Focused API and complete-session runs passed the original maximum-feature request
and direct tests for both sweep axes, late original ordinals, shared edges, holes,
multipart interiors and helper cardinality. Existing metadata corruption, topology,
containment, authority, rollback and exact recovery checks also passed. Normal
ordinary migration completed, followed by exact source-checksum/completion and
runtime execute-grant verification. Migration checksum:
`6bf3541abd28ff3633e569a0908f2577e0c1707c059307e7c10e049a910b2d3a`.
See the [owner contract](../architecture/tenant-geography.md#bounded-overlap-search--2026-11-14-0800).

## Verification ledger

| Check                                                              | Result                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three candidate Docker builds                                      | Passed: workspace, native PBX helper and backup tools.                                                                                                                                                                           |
| Frozen install, lockfile, actual runtime versions                  | Passed; pnpm 10.12.1, unchanged lockfile, four ordinary Node containers at 22.23.5.                                                                                                                                              |
| Initial `./dev check` quality/build stages                         | Lint, formatting, types, all web/mobile/backend builds, entrypoints and six configuration tests passed.                                                                                                                          |
| Initial `./dev check` foundation/storage stages                    | Complete foundation, durability, storage/access, identity, client exclusion and deployment storage checks passed.                                                                                                                |
| Initial literal `./dev check` final stage                          | **Exited 1:** recreated workspace lacked Chromium at the first browser launch. This invocation is not reported as a pass.                                                                                                        |
| Browser restoration                                                | Documented Chromium/Linux-library installation and actual headless launch passed. Runbook now explicitly covers Node workspace recreation.                                                                                       |
| First complete session rerun                                       | **Exited 1:** reproduced the prior maximum-feature SQL timeout after earlier HTTP/browser/authority checks passed.                                                                                                               |
| Affected source checks                                             | Script and backend ESLint, formatting and backend compilation passed for the shared overlap diagnostic and regressions.                                                                                                          |
| `./dev exec pnpm check:draft-tenant --api`                         | Passed, exit 0: full draft/onboarding/geography/voice API and new overlap regressions.                                                                                                                                           |
| `./dev exec node scripts/check-foundation.mjs`                     | Passed, exit 0, after the new migration: fresh schema, exact reruns/concurrent deployment, restricted role, outage/recovery and shutdown checks.                                                                                 |
| Final `./dev exec pnpm check:session-foundation` without selector  | **Passed, exit 0:** complete final deployment stage used by `./dev check`, including new maximum-feature tests, actual HTTPS browsers, credential lifecycle, limiter/backing-service faults, session lifecycle and PBX registry. |
| `./dev migrate`                                                    | Passed on the retained ordinary database; additive migration source checksum independently matched.                                                                                                                              |
| Quiet retained runtime refresh                                     | Passed: only workspace/backend/telephony/PBX Node runtimes refreshed; retained volumes, identity and selected profile preserved.                                                                                                 |
| `./dev platform-https-check`, `./dev staff-https-check`            | Passed on normal private ingress: TLS, bounds, Origin/CSRF, forwarding, secret isolation, actual Chromium presentation and preservation. No ordinary credential sign-in was attempted.                                           |
| `./dev health`, `./dev pbx-live-check`, profile/preparation status | Passed: live/ready 200, exact protected/loaded PBX, fresh owner/custody, zero channels/pending work and truthful preparation blockers.                                                                                           |
| Exact preservation and final source checks                         | Passed as detailed below; final documentation formatting and whitespace checks passed.                                                                                                                                           |

The complete final session stage was rerun after the two actual failures; unchanged
successful quality/foundation/storage stages were not blindly repeated. The affected
backend and fresh-schema checks were repeated for the SQL change. No assertion,
payload ceiling, production statement budget or suite deadline was relaxed.
Real and injected fault boundaries retain the existing suites' labels. These checks
do not establish new SIP/RTP, production, backup/restore or native OS acceptance.

## Ordinary recovery and preserved target

The stack was stopped at session start. Supported `./dev up` completed on 22.23.3
before rollout; existing provider and telephony containers were resumed. Documented
one-shot unseal restored the retained provider without initialization/root recovery.
Approved named-custodian GET-only consumer replacement measured 86,399-second TTL,
maximum 86,400 seconds and zero configuration updates. Endpoint material was retained.
The recreated PostgreSQL container had lost its documented internal
`endpoint-database` attachment; its existing bridge/alias were restored without
restarting PostgreSQL or publishing a port.

Fresh exact-target and actual quiet checks preceded ordinary effects. Both private
HTTPS supervisors were restored sequentially with the retained TLS/auth material.
Workspace HTTPS and backend publications remain loopback-only.

| Retained fact                              | Final result                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node / installation                        | `bcb9d21c-96cd-4975-bd68-314b588a23a9` / `58adb785-5384-41ce-9c72-ccda6ea554db`                                                                                |
| Current / verified / known-good artifact   | `e6ee0b86-da28-4ba9-bf42-a6c6e985c341`, unchanged                                                                                                              |
| Initial baseline                           | `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7`, unchanged                                                                                                              |
| Static digest                              | `f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`, unchanged                                                                                  |
| Original artifacts / retained pins         | Three / 20, preserved                                                                                                                                          |
| Native/canonical/runtime epoch; generation | 16 / 16 / 16; routing generation 18, fresh independent proof                                                                                                   |
| Loaded runtime / recovery                  | Exact protected/loaded match; historical compatible profiles and recovery custody retained; no blockers                                                        |
| Activity / controlled work                 | Zero channels, pending/unknown work, active grants, test intents or results                                                                                    |
| Persistent setup                           | Lifecycle v4 and all eleven immutable cases retained; fresh protected custody, zero available cases until explicit start against the new owner/native instance |

Original rows across **82 stable canonical tables** are preserved exactly. The only
addition is startup verification audit `62f72d52-67b2-42d8-b25a-c3291ebe29fc`:
`telephony.profile.transition`, system `pbx-observation`, action `verified`, same
node, original profile operation `0f95eb77-4c41-4b1f-8cb1-7f132d956d01`.
No original audit row changed. The additive migration metadata and expected volatile
ownership/runtime/observation/custody/participant proofs are separately declared.
Protected artifact/baseline/profile bytes, historical native sequence/receipts and
original reference bytes match exactly. The initial strict whole-audit equality
comparison identified this one addition; final acceptance checks its exact hash and
provenance rather than broadly exempting audit data.

Private snapshots/results are `.local/verification/node-rollout-{before,after}.json`,
`node-rollout-protected-{before,after}.json`, `node-rollout-audit-added.json` and
`node-rollout-preservation-result.json`. Previous images remain tagged
`myims-node-rollback-workspace:22.23.3` and `myims-node-rollback-asterisk:22.23.3`.
No static-profile rollback, artifact selection or rebaseline was performed.

Local logs use `/tmp/myims-node-22.23.5-` with suffixes
`{workspace,pbx,backup}-build.log`, `dev-check.log`, `browser-{install,deps}.log`,
`session-rerun.log`, `geography-focused.log`, `foundation-final.log`,
`session-final.log`, `ordinary-migrate.log`, `{platform,staff}-https-check.log`.
Exact failed/successful test exits are retained beside their corresponding logs.
Temporary benchmark logs use `/tmp/myims-node-geography-sweep-benchmark-3.log`.

## P4-U2-DEV-c handoff

c remains incomplete. No route authorization, grant, call, apply, retirement or
transfer was attempted. Restart intentionally invalidated b's old start admission;
case discovery and custody persist, but availability requires a new explicit
supported start after fresh target/quiet checks. Grants/evidence were not renewed.
The current `review-2` / `deny-unbound-1` artifact is not tenant calling proof.
Resume c using its approved manifest and ordinary-console acceptance requirements;
no manual sign-off cells or parent acceptance gates were filled by this rollout.
