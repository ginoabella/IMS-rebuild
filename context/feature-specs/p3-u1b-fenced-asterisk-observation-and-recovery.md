# P3-U1b — Fenced Asterisk observation and recovery

## Status and purpose

- **Status:** complete; B-01–09 verified 2026-10-14 17:44 +08:00 (Asia/Manila) under conditional development approval. [Evidence](../../docs/status/p3-u1b-evidence.md).
- **Requirement:** [P3-U1 parent scope and acceptance matrix](p3-u1-register-pbx-nodes-and-observe-health.md).
- **Goal:** produce freshness-qualified Asterisk health/registration observations under one current database-fenced owner per canonical PBX node.
- **Completion boundary:** controlled real Asterisk and independent telephony processes prove authenticated observation, single-owner coordination, stale-owner denial and reconciled restart/failover. Browser delivery remains c; live apply remains P3-U5.

Read [AGENT.md](../../AGENT.md) and required context. The parent owns common
policy and gates; a's registry/security contracts remain compatible.

## Starting state and dependencies

Require verified [a](p3-u1a-protected-pbx-registry-and-connectivity-contracts.md),
including registry identity/version, safe endpoints, secret/destination ports and
transaction-bound edit invalidation. Reuse P1-U5 transaction/outbox/delivery and
P1-U3 configuration/runtime grants without adding a new coordination service.
The existing independent telephony entry point is the runtime to extend.

Resolve G-01–03 for the actual observation adapter: authorized controlled target,
read-only transport/permissions and registration coverage, secret provider/access/
rotation, freshness and bounded I/O/reconciliation/retry/lease settings. Record
supplied/approved policy separately from routine implementation choices. Validate
settings and relationships before startup; do not assume numerical production
capacity or recovery targets. Unavailable real access leaves required live criteria
incomplete; fault simulators cannot substitute for them.

## Scope and ownership

Own module migrations/grants for durable lease epochs and bounded latest
observations, ownership repositories/ports, independent telephony composition,
read-only Asterisk adapter, reconciliation, passive observation DTO integration,
finite diagnostics and runtime checks/runbook. Integrate a's invalidation hook
atomically with registry edits and prove the previously delivered contract.

No UI, endpoint provisioning, tenant mapping, operational call metadata, revision
compiler, file installation/reload, rollback or general PBX command API. No
observer starts in HTTP or ordinary worker entry points. Future configuration
publication must reuse the ownership port; external enforcement and revision
ordering remain P3-U5.

## Database ownership and edit integration

Coordinate by canonical node ID with opaque process incarnation, strictly
increasing epoch, database-time expiry and desired version. Atomic acquisition/
renewal/takeover provides one current owner for one node while independent nodes
can have different owners. Expired leases are not silently renewed; reacquisition
creates a new generation. Release only matching incarnation/epoch. Epochs cannot
reset or be reused across restart/release; preserve sufficient durable metadata.

Every observation mutation, completion callback and durable publication intent
checks current owner/epoch/unexpired lease/desired version on the same transaction
as its write. Fence delayed work again when applying current state at a queued
consumer. Retain historical committed receipts if appropriate, but never let them
reassert an old epoch as current. If the implementation uses passive reads only,
do not add speculative realtime consumers; directly prove the publication intent
boundary through a narrowly scoped non-shipping fixture.

Connectivity edits invoke a's hook in the registry transaction: invalidate prior
observations/ownership and prevent old-version writes from committing afterwards.
Serialize edit, renewal and observation races consistently. Neither a stale owner
nor a delayed callback may mark the new connection healthy.

Loss/uncertainty of renewal, database unavailability, expiry, edit or shutdown
cancels connection I/O and local publication. Reacquire authoritative state and
reconcile before resuming. A stalled process might not cancel immediately; final
conditional database writes still reject its authority. Losing/releasing a lease
cannot release a successor's generation. Logs use safe node/process/epoch/correlation
identifiers; system observations cannot fabricate a platform operator actor.

## Adapter, observations and reconciliation

Use the supplied read-only management interface through the approved runtime
resolver and destination policy at each connect/reconnect. Bound connection/query
latency, concurrency, data sizes, retry/backoff and shutdown drain. Treat missing,
inaccessible or rotated secret material with finite sanitized states and the
established rotation policy; never log raw credentials/protocol payloads. A failure
for one node cannot prevent healthy observation for unrelated nodes.

Asterisk remains authoritative for live facts. Persist a bounded latest projection
for platform list/detail: node ID, desired version, epoch, sequence, last-success
time, connection/reconciliation state, safe failure category and supported
registration facts/counts. Store no caller/media/recording data. Unknown endpoints
stay unmapped and cannot create inventory, tenant ownership or ready extensions.
Bound projection cardinality and define snapshot replacement/cleanup without
creating indefinite raw event history.

Initial ownership/reconnect/restart/failover requires an authoritative complete
snapshot. Establish how the adapter handles events during snapshot acquisition;
use ordered merge or remain reconciling and resnapshot when ordering is uncertain.
Reject duplicate/older sequence, epoch or desired version. Detect gaps and
reconcile. A partial/failed snapshot cannot remove registrations as if empty;
a complete snapshot replaces obsolete facts and permits an explicitly empty set.

Separate reachability, reconciliation/ownership, registration coverage and age.
A reachable PBX with no registrations is distinct from unknown data. Derive stale
status after the configured freshness threshold even if no observer is alive;
HTTP reads must not rely on the failed owner writing its own stale marker. Retain
last-known observations as historical, never as current healthy after disconnect/
timeout. Passive reads do not acquire leases, spawn observers or renew user sessions.

## External publication limit

No mutating PBX adapter or arbitrary command path is reachable in b. Provide a
narrow ownership verification contract for later writers and document that a
pre-call database check alone cannot fence an already issued external command.
P3-U5 must enforce stale-epoch rejection at the PBX write boundary, ordered revisions
and active-call policy before enabling apply. b proves its own persisted observation/
publication fencing and absence of live mutation; it does not claim live apply
safety by extrapolating from read-only checks.

## Acceptance and verification

| ID | Required observable result/check | Parent coverage |
| --- | --- | --- |
| B-01 | Adapter capabilities/settings, snapshot ordering/freshness, minimal projection/grants, process composition and P3-U5 ownership handoff are documented. G-01–03 resolved for the tested target. | AC-01 runtime |
| B-02 | Controlled real Asterisk authenticates and reports supported reachable/registration facts; successful empty/unregistered results differ from unknown/unavailable/auth failure. Desired registry state remains unchanged. | AC-05 |
| B-03 | Two independent processes race for one real database lease: one current owner, conditional renew/takeover/release, database expiry and monotonically increasing epochs hold. Independent canonical nodes can be owned separately. | AC-06 |
| B-04 | Barrier-delayed old-owner/old-version writes, callbacks and publication intent/consumer execution reject after expiry/takeover/edit. Paused old process cannot release successor; edit invalidation/audit rollback is atomic. | AC-07 |
| B-05 | Renewal failure/ambiguous response/database outage cancels work and blocks publication; reacquisition requires reconciliation. Process restart and bounded drain do not restore an old epoch or leak connections. | AC-07 loss; AC-09 shutdown |
| B-06 | Real disconnect/reconnect and failover reconcile; injected duplicates/out-of-order/gaps/events-during-snapshot/partial snapshots converge safely. Complete snapshot removes obsolete facts; freshness expires without a live observer and never implies voice readiness. | AC-08 |
| B-07 | Secret lookup failure/rotation and reconnect respect approved policy/destination checks; secret sentinels are absent from projections, publication/audit/logs/exceptions and safe DTOs. Unknown registrations never gain tenant attribution. | AC-04 runtime; AC-05 safety |
| B-08 | Finite timeouts/concurrency/retries and per-node failure isolation pass; HTTP/worker start no observers. No live PBX mutation path is wired, and the future writer's external-fencing obligation is explicit. | AC-09; AC-07 mutation limit |
| B-09 | Focused real-PBX/multi-process suite, a regressions, affected durable/process checks and full Docker graph pass. Contract/runbook/evidence/index/tracker retain exact settings, commands, cleanup and c/P3-U5 limits. | AC-11 scoped |

Establish proposed `./dev exec pnpm check:pbx-nodes --observation` during
implementation; it is not present at spec creation. Use real PostgreSQL/runtime
grants, two independent telephony processes, actual controlled Asterisk and a's
HTTP boundary. A second controlled node is needed for live independent-target
checks; a synthetic second adapter proves ownership/isolation contracts only and
must be labeled accordingly. Use isolated runtime registration fixtures without
creating product inventory, touching tenant routes or making operational calls.

Use barriers and bounded fault controls for stale processes, database interruption,
renewal response loss and snapshot ordering; separate live connectivity evidence
from injected fault evidence. Run a's checks, affected durable/process regressions
and `./dev check`. Record actual commands/results and precise fixture cleanup.
Documentation preparation requires coverage/link/consistency/whitespace review.

## Completion and handoff

Complete b only when B-01–09 pass at their declared boundaries, including required
real controlled observation. Hand [c](p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md)
tested passive DTOs/status semantics, safe faults, freshness settings, fixtures
and owner-recovery evidence. Hand P3-U5 the lease/epoch port and explicit external
write-fence obligation. b does not complete the browser, parent or Phase 3 gate.
