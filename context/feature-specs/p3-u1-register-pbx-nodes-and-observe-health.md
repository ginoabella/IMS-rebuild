# P3-U1 — Register PBX nodes and observe health

## Status and purpose

- **Status:** planned; specification prepared and three-child split adopted 2026-10-14 (Asia/Manila, +08:00). No implementation or live PBX verification is claimed.
- **Requirement:** [Phase 3, P3-U1](../implementation-plan.md#p3-u1--register-pbx-nodes-and-observe-health), platform Asterisk administration in the [overview](../project-overview.md), and [telephony architecture](../architecture.md#telephony-architecture).
- **Goal:** let a platform operator register and inspect PBX connectivity while exactly one current database-fenced process owns observation and configuration publication for each node.
- **Completion boundary:** the real platform browser registers a controlled node and displays trustworthy, freshness-qualified health/registration observations; duplicate observers, ownership loss, restart and failover satisfy the matrix below. Saving a node never applies Asterisk configuration or establishes tenant voice readiness.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
Follow the approved delivery order: completed P2-U4 precedes Phase 3; P4-U1a
is the delivered early draft-creation exception. This spec defines intended
behavior; the tracker and evidence record actual delivery.

## Starting state and dependencies

Require verified P2-U3 and P1-U5; reuse the P1-U3 database/runtime/configuration
foundation, P1-U4 primitives, and P2-U2 canonical platform guards. Recheck their
owner interfaces and recorded evidence before coding.

- [Platform HTTP](../../docs/architecture/platform-authentication-http.md) and [browser access](../../docs/architecture/platform-browser-access.md) provide separate platform authority, Secure cookies, CSRF, trusted forwarding and mounted same-operator recovery.
- [Transactional audit/outbox](../../docs/architecture/transactional-audit-outbox.md) and [durable delivery](../../docs/architecture/durable-worker-delivery.md) provide atomic actor-attributed mutations and retryable committed intent. Do not create another queue or audit store.
- [Shared services](../../docs/runbooks/shared-services.md) provide a containerized Asterisk bootstrap. Bootstrap alone does not establish an authenticated observation interface, PBX administration or live acceptance.
- `services/backend/src/entrypoints/telephony/main.ts` currently starts an isolated application context and reports capabilities pending. It has no delivered observer/lease behavior. Extend this entry point without starting observers in HTTP or ordinary worker processes.
- Controlled Asterisk management access and a runtime-only secret resolver must be supplied/established for the selected environment. Registration acceptance may use isolated runtime fixtures; extension provisioning remains P3-U2.

## Scope and exclusions

Own the telephony module's PBX-node records, small shared transport contracts,
module-owned SQL migrations/grants, platform registry API, platform list/create/
detail UI, runtime secret-reference boundary, independent telephony observation,
database leases/fencing and minimal reconciled health/registration metadata.
Add operator documentation, reproducible checks and evidence with the capability.

P3-U2 owns extension inventory/profiles/credential setup; P3-U3 owns trunks,
gateways and DIDs; P3-U4 owns routing. P3-U5 owns revision compilation, diff,
validation, live installation/reload, apply ordering and rollback. P4 owns tenant
allocation/activation/staff extension assignment; P5-U3 owns operational call
synchronization and tenant attribution. Do not add those schemas or workflows here.
No general PBX command console, credential reveal/upload flow, node deletion,
configuration apply, call/media migration or production HA claim is included.

## Decision and environment gates

Use [D-09](../../docs/planning/p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation)
as the owning PBX decision register. Split it by affected capability; do not hold
this unit for routing/reload/active-call decisions needed only by later units.

| Gate | What must be established before dependent implementation/checks | Resume condition |
| --- | --- | --- |
| G-01 — Controlled observation environment | Target node, authorized management interface/transport, trusted network destinations, read-only permissions, supported health/registration data, and safe test fixtures. | Document the supplied controlled target and permitted operations; verify real authenticated access without exposing credentials. |
| G-02 — Secret resolution | Approved secret provider or protected runtime configuration, opaque reference vocabulary, process access and rotation/reconnect behavior. No provider is selected by this spec. | Record the scoped choice and provision least-privilege runtime access; raw credentials remain outside source, database snapshots, clients and audit. |
| G-03 — Observation policy | Named freshness threshold, bounded query/connect timeouts, reconciliation cadence, lease duration/renew interval, retry/backoff ceilings and registration coverage. | Document validated settings and their stale/unknown semantics before coding dependent behavior; approve any operational policy not already supplied. No numeric service target is assumed. |

Implementation details such as SQL layout, route names and adapter structure are
resolved within existing conventions. Do not require approval for routine choices.
The future configuration writer must establish a PBX-side enforcement boundary
that rejects obsolete ownership epochs; a PostgreSQL check alone cannot revoke an
already issued external write. P3-U1 exposes no mutating PBX operation. P3-U5 must
prove external stale-owner rejection before apply becomes available.

## Desired registry contract

A canonical node has an immutable internal ID, operator-visible name, validated
management connection descriptor, opaque credential reference(s), optimistic
version, timestamps and creation/update attribution. Choose a deterministic
canonical connection identity so two records cannot accidentally target the same
managed PBX and bypass per-node ownership; reject equivalent concurrent duplicates.
Document supported descriptor normalization and uniqueness before implementation.
Do not treat a display name, DNS spelling or a client-provided ownership key as
proof of distinct physical nodes; unresolved target identity fails safely.

The browser submits only permitted non-secret fields and approved opaque aliases.
Accept neither passwords nor arbitrary secret paths/provider URLs. Resolve aliases
through the backend deployment-controlled boundary. Constrain destination,
transport, port and address resolution to the approved management network; reject
URL credentials, unsupported protocols and unintended local/cloud metadata targets.
Clients cannot use the form as an arbitrary outbound network probe.

Create and any connectivity edit commit desired state plus platform-actor audit
in one transaction, with a durable observation/reconciliation intent where required.
Audit failure rolls back the change; no connection is attempted before commit.
Use bounded request/result sizes and pagination. Define a scoped idempotency key
and canonical request fingerprint for create: same owner/key/payload returns the
original result, conflicting reuse rejects, and duplicate races create one node
and one business audit. A connection-identity collision under another key returns
a safe conflict. Retain retry receipts under a documented bounded policy.

Connectivity edits use an expected version; reject stale writes and preserve the
form for explicit reload/retry. A changed target/reference invalidates previous
freshness and requires a new ownership generation and reconciliation. Observations
from the old desired version cannot establish health for the new connection.
Missing/inaccessible secrets or an unavailable PBX do not undo a valid registry
save or make it look connected; report the committed desired record and safe
observation failure independently. After an ambiguous response, explicitly retry
with the same intent identity or reload canonical state; never claim failure means
nothing committed, or automatically replay a changed request.

## Observation and authority contract

Asterisk owns live registration and signaling facts. PostgreSQL stores a bounded
latest observation projection for the platform list/detail consumer, not a competing
live source of truth. Store node ID, desired version, ownership epoch, observation
sequence, last successful observation time, connection/reconciliation state, safe
failure category, and covered registration facts/counts as supported by G-01/G-03.
Exclude credentials, raw protocol payloads, caller data and recording content.
No tenant ownership or endpoint usability is inferred from observed registrations.

Show connection, ownership/reconciliation and registration independently. A
reachable node may have no registered endpoints; an empty successful snapshot is
distinct from unknown/unavailable data. Show last-observed age and stale/unknown
state. A previous success remains historical after timeout/disconnect; it cannot
remain a current healthy badge indefinitely. Unknown endpoint observations stay
unmapped; do not create inventory or infer a tenant from numbers. P3-U2 later
joins trusted PBX identities to inventory under its own contract.

On initial ownership, restart, reconnect or failover, read an authoritative bounded
snapshot before marking observation current. Account for events arriving during
snapshot acquisition using the selected adapter's ordering/reconciliation contract;
if ordering cannot be proven, remain reconciling and resnapshot. Apply repeated
observations idempotently, reject old sequence/version/epoch updates and converge
after gaps. A complete snapshot replaces obsolete observations; a partial or failed
snapshot cannot be interpreted as an empty registration set.

Use a narrow read-only authenticated adapter, bounded I/O and concurrency, finite
backoff and cancellation. Secret lookup/connect/auth/protocol failures become
sanitized states; never expose raw responses or stack traces. Refresh is a passive
read of shared observations unless an explicit bounded reconciliation command is
documented; it does not spawn another observer or renew a user session by polling.
Browser reads reload canonical snapshots; realtime sockets are not required here.

## Per-node ownership and fencing

Persist coordination in PostgreSQL with a node key, opaque process incarnation,
monotonically increasing ownership epoch and database-time expiry. Acquisition,
renewal and takeover are atomic; expired leases cannot be renewed as if still owned.
Never reset/reuse an epoch on restart or release. Replicas can own different nodes,
but contenders for one node yield exactly one current owner. No Redis lock or
replica-local flag substitutes for the database lease.

Every observation write, durable publication intent and completion callback
atomically verifies owner, epoch, unexpired lease and current desired version on
the same database transaction as its mutation. Check again at queued execution or
consumer application where delayed work could otherwise make old state current.
Historical committed receipts may remain retained; stale work cannot overwrite or
reassert current observations. Record system attribution with process/node/epoch
and correlation identifiers, never a fabricated operator actor.

Loss of renewal, ambiguous renewal response, database outage, expiry, target edit
or shutdown cancels node I/O and blocks local publication immediately. A process
must reacquire canonical authority and reconcile before resuming. Database-time
conditional writes remain the final guard even if cancellation is delayed. Release
only the matching incarnation/epoch; a departing process cannot release a successor's
lease. A failover owner reconciles rather than replaying old process memory.

The shared ownership port is the mandatory contract for later configuration
publication. P3-U1 verifies stale-owner denial at its observation/publication
boundary and that no mutating adapter is reachable. It does not claim a live apply
check without the P3-U5 writer and PBX-side fence. Revision sequencing remains P3-U5.

## Platform API and browser journey

All reads and mutations require current canonical platform-operator authority;
tenant staff and client-selected roles/tenant IDs grant none. Reuse existing
no-store responses, cookie/channel/CSRF/origin policy and named narrow forwarding.
Session/backing-service failure denies protected operations with existing retryable
unavailable behavior. PBX outage is displayed as node state, independently of
whether platform API/session services are available.

Provide a platform PBX list, register form and detail/inspection screen; connectivity
editing can reuse the detail form. Show safe desired connection fields separately
from observed facts, freshness and reconciliation. Secret aliases may be displayed
only as safe opaque references; never return resolved material or unrestricted
provider locations. Status copy must distinguish saved, connecting/reconciling,
reachable, disconnected, stale and secret/configuration failure as applicable.

Use shared dark primitives, visible labels/focus, keyboard navigation, responsive
reflow, accessible status announcements, loading/empty/error/retry states and
bounded duplicate submission. Preserve permitted values on validation/conflict.
Reuse identity-bound mounted unfinished-work recovery: expiry hides protected
values and blocks writes; the same canonical operator may resume explicitly;
another operator cannot see them; confirmed logout clears them. No browser-storage
drafts or automatic mutation replay. Polling does not avoid session expiry.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Contracts document target identity, ownership, safe DTOs, gates/settings and desired/observed separation; existing modules/processes remain distinct with no speculative later-unit schema. |
| AC-02 | Real PostgreSQL register/edit persists desired state plus one actor audit; rollback, concurrent canonical-target collision, idempotent replay/conflicting reuse, stale edit and ambiguous committed response behave as specified. No precommit PBX effects. |
| AC-03 | API and actual browser enforce platform-only current authority, CSRF/channel/origin, no-store and narrow forwarding; staff, expired/revoked sessions and forged authority deny on two HTTP replicas. |
| AC-04 | Approved alias resolution and destination validation work; inaccessible/rotated secrets have explicit recovery behavior. Sentinels are absent from responses, audit/outbox, revisions if present, logs, exception text, URLs and client output. |
| AC-05 | Controlled real Asterisk authenticated observation shows reachable health and supported registration facts, including empty/unregistered vs unavailable/unknown; invalid auth and unavailable node produce safe states without changing desired settings. |
| AC-06 | Independent telephony processes contest one node under real database grants: one current owner; distinct nodes can be observed independently; conditional renewal/takeover/release and monotonically increasing epochs hold under races. |
| AC-07 | Delayed writes, publication intents and callbacks from an expired/replaced owner or old desired version reject. Lease/database loss or uncertain renewal stops work; paused stale process cannot release/overwrite its successor. No live PBX mutation path exists. |
| AC-08 | Restart, disconnect/reconnect and owner failover reconcile snapshots; duplicate/out-of-order/gap/partial snapshot checks converge without false empty/healthy state. Old observations become explicitly stale after the configured threshold. |
| AC-09 | Connection/query/concurrency/retry bounds and graceful shutdown pass; PBX failure is isolated per node, HTTP does not start observers and platform remains usable while a PBX is down. |
| AC-10 | Actual browser list/register/detail/edit, validation/conflict/retry and freshness states pass keyboard/focus/responsive checks. Same-operator expiry resumes retained values; foreign identity/logout clears them, and passive reads cannot renew. |
| AC-11 | Integrated real-service browser/ownership suite, required regressions and full Docker graph pass; operator guide, observation/ownership contract, runbook, safe evidence, docs index and tracker record commands, settings, limits and handoff to P3-U2/U5. |

During implementation establish a focused `./dev exec pnpm check:pbx-nodes`
procedure (proposed command; it does not exist at spec creation). Run it against
real PostgreSQL/runtime grants, shared session Redis, two HTTP replicas, two
independent telephony processes and controlled Asterisk; actual browser checks
use the existing secure platform environment. Use barrier/fault fixtures for
lease races, paused owners, ambiguous responses and snapshot gaps without long
sleeps. Use isolated PBX observations/fixtures and precise cleanup; do not provision
production extensions or alter existing tenant routes. Mocked adapter faults prove
the declared fault contract only; real authentication/connectivity/registration
observations remain required for parent completion.

Run affected platform-auth, durable-foundation and process-isolation regressions
and `./dev check`; record actual commands and outcomes rather than assuming names
or results. Documentation preparation requires coverage, consistency, local links
and whitespace checks only. Missing live access keeps the dependent runtime unit
incomplete; it does not prevent independently verified registry foundation delivery.

## Review and adopted implementation sub-units

**Review conclusion: split into three sequential sub-units.** The registry's
transaction/security contract can be verified independently; observer ownership
and recovery form a second cohesive runtime outcome; the browser is the final
operator journey. Keep race/failure checks with their owning implementation,
rather than deferring them to a testing-only unit. The user adopted this split on 2026-10-14 (Asia/Manila, +08:00).
The linked child specs define sequential delivery; all children remain planned.

| Unit | Starting state and scope | Expected result and parent coverage |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | Verified foundation/platform auth; resolve the needed portions of G-01/G-02. Desired records/identity constraints, audit/idempotency, runtime secret/destination ports, protected create/list/detail/edit API and grants. | Real-service registry foundation with safe retries/security; owns AC-02/03 and registry portions of AC-01/04/11. No live observation or browser journey claimed. |
| [P3-U1b — Fenced Asterisk observation and recovery](p3-u1b-fenced-asterisk-observation-and-recovery.md) | Verified a; G-01–03 resolved for observation. Independent telephony runtime, database lease/epoch port, read-only adapter, latest observation projection, reconciliation/freshness and runtime diagnostics. | Real controlled observation plus duplicate-process/lease-loss/restart recovery; owns AC-05–09 and runtime portions of AC-01/04/11. Exposes the ownership handoff required by P3-U5. |
| [P3-U1c — Operator PBX browser journey and integrated handoff](p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | Verified a/b; actual platform screens/proxy, mounted recovery, operator guide and combined evidence. | Browser register/inspect/edit with explicit desired/runtime state; owns AC-10 and browser portions of AC-01/03/04/11; reruns all AC-01–11 before parent completion. |

Every criterion has an owner; shared criteria require integrated verification.
Foundation child completion cannot substitute for live observation or browser
acceptance. Retain P3-U1's top-level order before P3-U2–U5.

Review fixes incorporated into this spec:

- Enforce canonical connection identity so duplicate registry rows cannot defeat one-owner semantics.
- Bind observations to desired version and ownership epoch; connection edits cannot reuse old health.
- Treat registration coverage, freshness and empty/partial snapshots explicitly; reachability alone grants no voice readiness.
- Distinguish database fencing from external write enforcement; leave mutating PBX commands disabled until P3-U5 proves its fence.
- Keep only the applicable D-09 environment/secret/observation gates here; routing, reload and active-call policy remain with their owning units.
