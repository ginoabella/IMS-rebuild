# P3-U1a acceptance evidence

2026-10-14 (Asia/Manila, +08:00). **A-01–07 passed; complete at 11:22 +08:00.**
Requirement: [P3-U1a A-01–07](../../context/feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md).
Policy: [approved scoped review and user clarifications](../planning/p3-u1a-connectivity-contract-review.md).
Implementation: [registry contract](../architecture/pbx-registry.md),
[operations](../runbooks/pbx-registry.md).

Docker workspace uses supported Node 22.23.3, real PostgreSQL/PostGIS, deployment
migrations and myims_runtime grants. Acceptance uses a separately provisioned
authenticated Redis container and independent production Nest HTTP processes.
Synthetic target catalogs and protected file/address fixtures prove their declared
ports, not authenticated live Asterisk observation. No observer/lease/browser,
tenant association, live apply or voice-readiness claim is made.

## Required results

| Acceptance | Evidence/status                                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01       | Named DTO/routes, canonical installation/profile identity, future/shared-tenant separation, provider/destination/retry/error/invalidation contracts implemented/documented; consistency review and local links passed.                                          |
| A-02       | Passed: single actor audit/receipt and required-write rollback; real grants/DDL/immutable receipt/identity restrictions. Contract fixture tests required outbox intent rollback. Focused and final full-graph runs passed.                                      |
| A-03       | Passed: independent A/B barrier races for equivalent aliases, same-intent replay and conflicting payload; real suppressed HTTP result and PostgreSQL COMMIT acknowledgment, explicit retry after process replacement. Focused and final full-graph runs passed. |
| A-04       | Passed: stale/concurrent edits, stable rotation identity, original-result replay after edit, atomic invalidation/intent rollback and generation preservation for rename. Focused and final full-graph runs passed.                                              |
| A-05       | Focused and full-graph session/channel/Origin/CSRF/revocation/current-authority/outage matrix passed.                                                                                                                                                           |
| A-06       | Focused protected provider/rotation and bounded exact-address/cancellation fixtures passed; no live PBX authentication.                                                                                                                                         |
| A-07       | Pagination/sentinel checks, affected regressions and final full Docker graph passed, exit 0.                                                                                                                                                                    |

## Commands and cleanup

- `./dev pbx-catalog-prepare`: passed; ignored non-secret local catalog provisioned,
  persistent installation UUID retained. No management listener/credentials changed.
- `./dev exec pnpm build:backend`: passed at the first implementation checkpoint.
- Intermediate focused acceptance iterations intermediate failures concerned fixture
  lock-barrier selection and established malformed-channel 401 expectations.
  These were corrected without weakening assertions on denied work or data.
- `./dev exec pnpm check:pbx-nodes --registry`: passed, exit 0.
- `./dev exec node scripts/probe-pbx-destination.mjs`: read-only controlled Docker DNS/address probe: approved, exit 0; no socket
  connection or credential read, no authenticated PBX observation claimed.
- First `./dev check`: workspace quality/build/configuration/process-isolation
  passed; foundation stopped on the old nine-migration assertion after the new
  tenth migration deployed successfully. Updated the expected count to ten.
- Second `./dev check`: foundation recovery passed; audit stopped on another
  old migration-count assertion. Audited all such assertions; foundation, audit
  and identity now expect ten migrations and retain their permission checks.
- `./dev exec pnpm check:foundation`: passed, exit 0, including corrected
  migration inventory, authority/audit/outbox, delivery/recovery and storage.
- Third `./dev check`: all earlier stages passed; legacy platform-browser
  same-owner recovery timed out before the PBX fixture ran.
- `./dev exec pnpm check:platform-auth --browser`: passed, exit 0, without
  authentication or UI source changes; the browser failure did not reproduce.
- Final `./dev check`: passed, exit 0, 2026-10-14 11:22 +08:00. Includes
  workspace lint/format/typecheck/build, process isolation, configuration,
  foundation/audit/delivery/storage/identity/authority/bootstrap, actual platform/
  staff/credential browser and shared session recovery, and final PBX A-01–07.

The harness owns the unique disposable database, generated Redis container,
tracked session keys, temporary provider/catalog files, proxies and child
processes. Teardown drops only the exact disposable database and removes owned
files/container, preserving normal tenants/PBX infrastructure. Local non-secret
catalog/installation identity intentionally remain as approved deployment config.

## Final cleanup and handoff

Final full graph ended with all PBX acceptance markers and the independent HTTP
log/audit sentinel scan. PBX runs last in the shared harness so its intentionally
retained contract intent cannot contaminate legacy empty-outbox assertions; the
harness reconnects its trusted Redis client after lifecycle restart before running
PBX. Direct contract-fixture transaction diagnostics use the same SafeLogger through
an injected capture sink, including forced invalidation and actual SQL outbox failure.

Final cleanup verification found no session databases from this task and no
myims-session-check-* Redis containers. One pre-existing database,
`myims_session_426486cb1209`, has audit timestamps only from 2026-10-07 and no PBX
registry table; it was inspected read-only and preserved outside this task's cleanup boundary. Fixture child processes, tracked session
keys, proxies and private temporary credential/catalog files were removed by the
owning harness. The existing Asterisk/shared-service containers were retained;
local non-secret deployment catalog/installation UUID intentionally remain.
No runtime credentials or source/private provider material appear in evidence.

The implementation supports many installation/profile identities (42 isolated
profiles tested with different approved ports), equivalence aliases and permanent
identity through credential alias/material rotation. No tenant/LGU association is
created; a future explicit contract may share one PBX across several tenants.
The local profile does not hardcode the registry to one Asterisk version, Docker
host/port or credential provider.

b receives PbxRegistry/PbxReceipts/PbxDesiredChangePort, canonical desired versions,
approved catalog/provider/destination boundaries, receipt/error semantics and the
focused real-service procedure. b still requires authenticated AMI-TLS provisioning,
verified read-only permissions, live registration fixtures, rotation/reconnect and
G-03 observation/lease/freshness policy. c receives named protected endpoints,
DTOs/errors, exact forwarding/Origin/CSRF/passive-read requirements and explicit
same-intent recovery. No live observation, lease failover, browser PBX journey,
configuration apply or tenant voice readiness is established by a completion.

The earlier legacy browser timeout passed unchanged in the focused rerun and in
the final complete graph; no authentication or UI behavior was altered to obtain
a pass. Earlier migration inventory failures were corrected in foundation/audit/
identity assertions to account for the tenth deployment-owned migration.
