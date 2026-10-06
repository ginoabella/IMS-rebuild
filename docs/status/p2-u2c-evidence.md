# P2-U2c distributed admission and integrated recovery evidence

Completed 2026-10-06 11:12 +08:00 (Asia/Manila). **C-01–07 and parent AC-01–11 passed.**

Requirement: [c C-01–07](../../context/feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md)
and [parent AC-01–11](../../context/feature-specs/p2-u2-shared-session-store-and-authorization-guards.md).
Approval: [limiter policy and production conditions](../planning/p2-u2c-limiter-contract-review.md).
Contracts: [admission](../architecture/distributed-admission.md),
[lifecycle](../architecture/shared-session-lifecycle.md),
[canonical authority](../architecture/canonical-http-authority.md).
Operations: [integrated recovery](../runbooks/session-foundation.md).

## Environment and reproducibility

Pinned existing Node 22.23.3/Docker workspace, real PostgreSQL/PostGIS with deployment
migrations and actual restricted runtime grants. One unique `myims_session_`
database per run; authenticated pinned Redis 8 fixture with 128 MB/noeviction,
AOF `always` and an owned anonymous data volume. Private stdin/IPC transports
credentials/tokens; test-only listeners are separate OS processes. Controlled
primary TCP relays simulate interrupted canonical/fence PostgreSQL access; no
normal development PostgreSQL or session/realtime Redis data is modified.

Sign-in fixtures invoke the real admission port before a verification sentinel;
they neither verify passwords nor mint tokens over HTTP. Trusted issuance remains
private IPC. Source/identity fixed-window allowances are reduced explicitly only
for deadline/concurrency checks; defaults are the approved policy. The concurrent
A/B fixture uses bounded 1-second commands/concurrency 16 to isolate shared atomic
allowance from process-resource shedding. Fault checks use explicit 200 ms
commands. Neither setting becomes a product budget/default.

## Child acceptance

| ID   | Observable proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Approved independent source/identity policy; validated per-plane operation/budget/window/capacity/proxy configuration and generic outcomes. Lifecycle approval, selective fencing and production/transport gates remain explicit.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| C-02 | Two independent HTTP processes wait at admission barriers, then compete for one allowance: eight requests admit exactly three and reject five. Finite operation/outcome/count metrics contain no identifying labels. Both source and identity counters saturate; expiry permits the next window. Known/unknown and normalized identities, tenant/plane isolation, independent sources, spoofed forwarding, missing/ambiguous chains and raw input bounds checked. 429 causes no verifier/handler or operational renewal. Hostile cardinality stops at explicit cap; a full 8,192-field registry's actual Redis representation measured 876,709 bytes (<2 MiB per operation). |
| C-03 | Real EVAL response loss confirms a counter write but returns retryable 503 without verification; paused commands time out. ACL missing expiry permission prevents allocation; denied EVAL blocks protected work. Real noeviction OOM preserves readable session records while admission/required writes fail. a's issue/renew/rotate/revoke response-loss/timeout checks and b's canonical/outage/late-renewal HTTP checks rerun.                                                                                                                                                                                                                                            |
| C-04 | Capture actual Redis record bytes before revocation/rotation/canonical mutation, restore them and actually shut down/restart Redis. Current primary fences/canonical versions reject all old tokens through both HTTP replicas. Interrupted primary recovery returns 503 until fresh checks succeed; unrelated valid retained tenant authority recovers. Lost current records remain absent and 401.                                                                                                                                                                                                                                                                         |
| C-05 | Complete a A-01–07 and b B-01–07 regressions rerun; malformed data, planes/tenants, lifecycle deadlines/races, canonical status/roles/credential versions, grants, canonical audit actors and sensitive transaction locking remain covered. Production wiring imports no fixture issuer/routes. Private diagnostics/audit/HTTP sentinel checks and all five built-client scans pass.                                                                                                                                                                                                                                                                                         |
| C-06 | Complete focused/default and full Docker commands, CI default selection, exact fixture cleanup, safe evidence, settings and quarantine/fence recovery runbook reproduce parent coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| C-07 | U3/U4 receive trusted issuance, credential planes, conditional qualifying renewal, revocation/rotation, pre-verification sign-in admission and safe 400/401/403/429/503 mappings. Actual cookies/CSRF/mobile/socket/reauthentication and Phase 2 acceptance remain incomplete.                                                                                                                                                                                                                                                                                                                                                                                               |

## Central parent mapping

| Parent | Proof                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01  | Approved a lifecycle policy and c limiter policy; current typed records/ports, [admission contract](../architecture/distributed-admission.md), recovery and explicit production/transport gates.                                                                                     |
| AC-02  | [a A-02 evidence](p2-u2a-evidence.md): random/hash-only issuance and malformed tokens/records; rerun by complete command, captured diagnostics and five-client scans.                                                                                                                |
| AC-03  | [b B-02/04 evidence](p2-u2b-evidence.md): A/B shared canonical principal, tenant isolation and opposite-plane denial; rerun with real admission.                                                                                                                                     |
| AC-04  | a A-03 expiry/TTL/absolute/qualifying activity and b post-success HTTP renewal regressions; c's operational 429 does not renew.                                                                                                                                                      |
| AC-05  | a A-04 independent lifecycle barriers/single rotation winner/revoke-renew races and b late HTTP renewal; rerun with fresh connection handling.                                                                                                                                       |
| AC-06  | b B-03/06 audited canonical role/account/credential/tenant changes and primary failure; restored old versions deny.                                                                                                                                                                  |
| AC-07  | b B-04/05 explicit guards/grants/owning resource boundaries, canonical audit and transactional authority lock races; public health remains alive.                                                                                                                                    |
| AC-08  | c C-01/02/03 actual shared allowance, boundary/expiry, dimensions, spoofing and fail-closed admission faults.                                                                                                                                                                        |
| AC-09  | a write/read failures, actual uncertain PostgreSQL/Redis writes and OOM; b protected dependency/renewal faults; c limiter write/ACL/timeout/OOM and full retained/lost HTTP restart recovery. Confirmed DEL may revoke during OOM; required unconfirmed writes never report success. |
| AC-10  | a durable fences and b canonical restored-data proof; c actual captured stale records/restart and interrupted primary recovery through both HTTP replicas.                                                                                                                           |
| AC-11  | Required focused/full Docker results below, combined CI wiring, integrated contract/runbook/handoff and exact owned-resource teardown.                                                                                                                                               |

## Corrections and limits

The first concurrent fixture run terminated on a rejected request promise before
all barriers settled. Attach immediate all-settled handlers and provide explicit
bounded concurrency/deadline headroom for the allowance test. Its exact abandoned
database was verified by fixture-only rows/schema and zero connections and removed;
no broad cleanup was used. A later standalone rerun exposed an inherited total-key
count assertion racing normal TTL expiry; it now proves exactly one newly created
issuance record and its expected identity/plane directly. Final successful runs
are the acceptance evidence.

Registry memory measures the actual approved-sized hash representation, not total
production memory. Production must measure combined session load, persistence and
replication buffers, headroom, cardinality, peak source/NAT and realistic aggregate
web polling/operator/future mobile traffic. If normal behavior can reach the
120/minute protected identity default, bring a revised budget for approval before
production; future consumers retain that requirement. This unit has no delivered
normal web/mobile sign-in/operational traffic profile to certify.

The controlled restart retains current primary PostgreSQL fences/canonical state.
Selective retained recovery does not claim arbitrary HA or joint-store rollback.
Restore quarantines admission; possible limiter counter rollback requires waiting
the longest configured window before reopening. Production TLS/ACL/HA/capacity,
private owning-consumer probes, cookie/CSRF/device storage/socket and unfinished-work
reauthentication behavior remain owning-unit gates. Credential-recovery/public-intake/socket
and other omitted rate-limit policies were not approved by this work.

## Commands and observed results

- Prerequisite `./dev exec pnpm check:session-foundation --authority`: passed,
  exit 0, real b HTTP checks and a lifecycle/recovery regressions.
- Focused `./dev exec pnpm check:session-foundation --limits`: passed, exit 0,
  combined c/b/a checks after bounded concurrency fixture correction.
- Final `./dev check`: passed, exit 0, workspace lint/format/typecheck, all
  web/mobile/backend builds, entrypoint/configuration checks, real foundation,
  audit/outbox/worker recovery, storage, canonical identities/bootstrap, all five
  client-secret scans, isolated storage deployment/restart and default combined
  a/b/c session suite including finite metric privacy. Follow-up fixture-only
  total-key assertion refinement is covered by the final complete rerun below;
  no product behavior changed after this full pass.
- Final `./dev exec pnpm check:session-foundation`: passed, exit 0, every a/b/c
  check, including direct new-record ambiguous-write proof independent of earlier
  fixture TTL expiry.
- Focused backend typecheck/lint and final changed-file formatting: passed,
  including bounded metrics, Docker configuration and client sentinel additions.
- Effective workspace-profile Docker configuration: approved 120/minute identity,
  8,192 fields, empty proxy trust and 2-second command defaults verified without
  printing full environment/secrets; Compose validation passed.
- `./dev health`: live and ready HTTP 200; all declared dependencies up.
- Final docs relative-file links/anchors, formatting, launcher syntax and
  `git diff --check`: passed. CI now runs the complete default selection; hosted
  CI was not executed locally.

Fixture cleanup inventory confirmed zero session fixture databases and containers
remain. No application session/identity seed or migration was introduced by c.
User-facing sign-in/credential recovery, web/CSRF/mobile/socket journeys and Phase 2
completion remain incomplete. The parent infrastructure is complete within its
explicit acceptance and controlled recovery boundary.
