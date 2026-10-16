# P3-U2b final implementation evidence — completed

Completed: 2026-10-16 10:49 +08:00 (Asia/Manila). Requirement:
[P3-U2b B-01–07](../../context/feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md).
B-01–07 passed under the user's conditional sections 2–6/G02-01–10 approval for
controlled private development. Full credential/provider, queue-selection and
inventory regressions and the final full Docker graph passed, exit 0. The unit
is completed within that scope; parent P3-U2 and production remain incomplete.

## Delivered behavior

Platform-only asynchronous setup/reset/status uses immutable extension/version,
originating operator, intent fingerprint and canonical operation/generation IDs.
A committed operation reserves ownership before any provider call. Exact CAS=0
preparation, transaction-bound canonical authority/inventory fences and atomic
association/version/history/audit/result prevent blind rotation and stale writes.
One active operation per extension and retained intent tombstones govern replay.
Logout/expiry permits continuation; canonical account revocation cancels it.

Only the designated installation-scoped worker receives provider create/read
access. Separate trusted cleanup has read/metadata/destroy access and cannot
create. HTTP, browsers, ordinary workers, observers and Asterisk receive no
provider token or endpoint material. Exhausted work requires explicit audited
same-key requeue; exhausted cleanup requires audited `cleanup-retry`. Associated
generations remain retained. Cleanup of terminal never-associated material needs
24-hour age, exact ownership and affirmative dependency evidence.

## Real development environment and recovery

OpenBao 2.7.1 is pinned to
`sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`.
It runs persistent single-node Raft, verified TLS, no published ports/UI, internal
Docker networks, declarative HMAC audit and manual unseal. Provider custody/data
use dedicated UID/GID 1003; workspace/HTTP uses 1002. Worker/cleanup leases start
at one hour, have a 24-hour maximum and explicit renewal/reprovisioning.

Initial root revocation also revoked a child administrator. Bootstrap now creates
an orphan administrator. Automatic review rejected the first temporary listener
recovery request, which did not run. The user then explicitly approved the exact
isolated development recovery: temporary root generation, retained seal-key quorum,
orphan administration, recovered-root revocation and restoration/restart/unseal.
It completed. Verified-TLS anonymous root-generation access returns 405 (disabled);
`disable_unauthed_generate_root_endpoints = true` is explicit. Normal scoped
administrator rotation also passed without enabling root generation. Runtime
scoped orphan tokens remain independent of administrator rotation.

## Acceptance

| ID   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Conditional approval, material/access/no-delivery/retention decisions, ordering/recovery table, safe API/errors, 30-day result recovery and retained tombstones are recorded. Architecture, deployment runbook and c/P3-U5 handoffs are synchronized.                                                                                                                                                                                                                                                    |
| B-02 | Real OpenBao setup/reset on exact canonical extensions, two production worker processes and duplicate queue delivery; one association business audit, exact desired-version advance and generation. Pending/denied/outage remains unset. Actual destruction of an isolated associated fixture degrades health without silent regeneration.                                                                                                                                                               |
| B-03 | Independent HTTP A/B same-intent replay, conflicting reuse, reset race, stale version, lost HTTP reply, real provider write with injected lost reply, TCP-proxy-dropped acceptance/final COMMIT acknowledgement, terminal expiry and retained tombstone denial. Final version fencing and delayed real preparation cannot replace a successor.                                                                                                                                                           |
| B-04 | Real provider stop/restart/sealed denial/manual unseal, real expired scoped token, actual audit constraint rollback, PostgreSQL connection interruption after preparation, process restart, six-attempt exhaustion and trusted same-key requeue. Age/dependency/current/history cleanup fences, lost destroy reply, process exit after destroy, dropped cleanup COMMIT acknowledgement, repeat cleanup and late write after an absent cleanup recover.                                                   |
| B-05 | Every credential route on HTTP A/B rejects anonymous, tenant staff, revoked/expired and forged authority; CSRF, origin, proxy channel and duplicate cookie cases deny with no-store. Redis failure returns 503/Retry-After 1; PostgreSQL failure denies. Final account revocation cancels; re-enablement cannot revive. Session logout/expiry continuation and same-operator fresh-session recovery pass.                                                                                                |
| B-06 | Actual generated passwords are compared inside the authorized scanner against captured HTTP responses and process logs, worker/provider logs, provider HMAC audit, operations, extension/profile snapshots, audit/outbox/jobs/results/receipts. No material found; independent passwords unique. Real worker/cleanup ACL denies foreign installations, policy administration, overwrite, metadata deletion and unauthorized create/destroy. Token TTL/renewal and process/custody/anonymous denial pass. |
| B-07 | Final real-provider credential suite, exact predecessor/successor retention checks, shared-queue installation selection, complete inventory regression and full `./dev check` passed, exit 0. The graph covers lint/format/types/builds, entrypoint/config, foundation/audit/durable/storage/identity/bootstrap, platform/staff/browser/session and PBX registry regressions. Final isolation, Compose, normal HTTPS and health checks passed.                                                           |

## Commands and results

- `./dev migrate`: passed additive migration on the real development PostgreSQL.
- `./dev exec pnpm check:extension-inventory --credentials`: passed, exit 0,
  including response, independent HTTP process-log, worker/provider and actual
  material scans. Final passing database fixture:
  `myims_session_5f7a47e19ad1`; removed. Its exact provider manifest accounted for
  26 generations: 25 destroyed, one absent. Metadata/tombstones retained.
- `./dev exec pnpm check:extension-inventory --credentials-api`: passed, exit 0.
  Real pg-boss ordinary worker excludes credential work; installation A/B claims
  select only their canonical operation installation. This uses an injected
  no-effect consumer port and makes no provider-association claim. Exact database
  `myims_session_9bb9ba9b1a2c` and Redis fixtures removed.
- `./dev exec pnpm check:extension-inventory --inventory`: passed, exit 0,
  including all A-01–07 cases. Exact database `myims_session_19d30dfb629b` and
  Redis container `myims-session-check-2bd45eb559ff` removed.
- `./dev endpoint-isolation-check`: passed, exit 0. Actual HTTP/workspace-node/
  observer cannot read worker/admin/seal custody; no provider host port; verified
  TLS anonymous material read 403 and root-generation access 405.
- Normal trusted `rotate-admin`: passed, exit 0, then scoped fixture provisioning
  and the real provider suite passed under the successor administrator.
- Backend build/typecheck, full lint, Compose configuration, launcher syntax,
  document links and whitespace passed at their checkpoints. Final graph and directly affected deployment/isolation checks
  establish the completed result recorded below.
- Final `./dev check`: passed, exit 0. Lint, formatting, every workspace typecheck,
  web/mobile/backend builds, entrypoint/config checks and complete real-service
  foundation/durable/storage/identity/bootstrap/auth/browser/session/PBX registry
  graph passed sequentially. Prior timeout/failure attempts below are superseded.
- Final `./dev endpoint-isolation-check`, isolation-script lint and opt-in Compose
  `config --quiet`: passed, exit 0, including both networks' `Internal=true`.
  The deployment-owned database bridge is explicitly external to Compose; fresh
  private-network setup is documented. This final declaration/assertion change was
  checked directly after the graph; backend/application implementation was unchanged.
- `./dev health`: live/ready HTTP 200; database and both Redis checks up.
- `./dev platform-https-check` and `./dev staff-https-check`: passed, exit 0;
  ordinary assets, private listeners, trusted TLS, channels/CSRF and preserved
  identities/credential actions/migrations verified. Transient regression and
  endpoint fixture container queries returned no remaining containers.
- Earlier full graph passed lint/format/types/builds, foundation/audit/durable/
  storage/identity/bootstrap and platform authority checks, then timed out in a
  session-fixture `init` while another suite ran. This is not a full-graph pass.
  The successful final execution was sequential.

Earlier provider-suite failures were fixture runtime configuration, non-atomic
response publication and editing the shell launcher while it was executing.
Those were corrected. The full graph also identified an unused independent HTTP
log callback in the scanner harness; it was connected, script lint passed and the
full provider suite reran successfully with those logs included. All assertion-complete runs retained exact manifests and
performed exact owned teardown; no failed run is counted as a clean acceptance
command. Initial provisioning 403 was resolved by the approved recovery above.

## Fault boundaries and cleanup qualification

Provider reply loss is an injected failure after a real write; the service itself
is real. Process interruption deliberately exits the isolated process at a named
checkpoint. Database COMMIT loss drops the actual PostgreSQL acknowledgement;
post-prepare connection failure cuts real TCP connections, not the shared server.
Audit failure is a disposable owner-installed constraint. Provider service outage,
seal/restart and token expiry use the actual OpenBao service.

Barriers control final revocation/edit and late-call timing; the late scenario
terminates the real advisory-lock backend, cancels the original operation, cleans
its absent key, associates a successor, releases the delayed real provider write
and cleans only the old key. Owner timestamp fixtures advance 24-hour/30-day age.
Six-attempt transient failure and permanent material validation use named provider
port faults; cleanup exhaustion uses an owner-set counter fixture. They prove
ordering/budget behavior, not independent provider availability.

Dependency assertions use the named owner-port fixture. b never exposes associated
generations to revisions, so application cleanup always retains them; unknown
facts deny cleanup. This is not live P3-U5 apply/rollback dependency proof.

Test-owner teardown is separate from application retirement. Every suite owns a
unique installation and disposable database; safe canonical binding manifests
are retained under ignored `.local/endpoint-fixtures/`. After processes/database
are removed, teardown destroys only those exact test versions, never metadata.
No test generation reaches a phone, tenant endpoint or PBX configuration. Ordinary
provider data/audit volumes and normal application/reference configuration remain.

## Handoff and remaining production review

See [API/authority/transaction contract](../architecture/endpoint-credentials.md),
[deployment/recovery runbook](../runbooks/endpoint-credentials.md) and
[approved G-02 review](../planning/p3-u2b-credential-contract-review.md).
c receives safe actions/status, caller intent versus canonical operation IDs,
exact uncertainty recovery and no password-entry/reveal contract. P3-U5 receives
exact desired generations and retained dependencies; it must separately approve
protected consumption, actual apply/rollback and retirement facts.

Production HA, secure key custody, tested joint backup/recovery, token management,
operational controls, worker provider scope and controlled credential retirement,
retention and secure destruction remain separately reviewed requirements. No
production deployment, phone delivery/revelation, live PBX application/revocation,
tenant calling readiness, parent P3-U2 completion or Phase 3 completion is claimed.
