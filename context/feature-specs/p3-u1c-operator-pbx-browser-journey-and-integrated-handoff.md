# P3-U1c — Operator PBX browser journey and integrated handoff

## Status and purpose

- **Status:** planned; split adopted 2026-10-14 (Asia/Manila, +08:00).
- **Requirement:** [P3-U1 parent scope and acceptance matrix](p3-u1-register-pbx-nodes-and-observe-health.md).
- **Goal:** let an authenticated platform operator register, inspect and edit PBX connectivity through the actual console with clear desired/runtime states and safe recovery.
- **Completion boundary:** real secure-browser registry/observation journey and all parent AC-01–11 pass with a/b's real-service ownership/failover evidence. This completes P3-U1 only, not configuration apply or the Phase 3 gate.

Read [AGENT.md](../../AGENT.md) and required context. The parent owns shared
policy; c consumes delivered contracts without inventing new permissions,
observation targets, secret providers or numeric policies.

## Starting state and dependencies

Require verified [a](p3-u1a-protected-pbx-registry-and-connectivity-contracts.md)
and [b](p3-u1b-fenced-asterisk-observation-and-recovery.md), including controlled
live observations, stale-owner rejection and current safe DTO/freshness semantics.
Reuse P1-U4 shared primitives and P2-U3's [platform browser contract](../../docs/architecture/platform-browser-access.md)
and secure development environment. Recheck actual endpoint/forwarding and mounted
owner-recovery interfaces and a/b evidence before coding.

G-01–03 must be resolved for the integrated target; do not turn unknown observations
into demo health or claim fixture-only authentication as the operator journey.
An unavailable controlled PBX blocks dependent integrated acceptance; independently
verified a/b portions retain their documented status.

## Scope and ownership

Own platform-console PBX list/register/detail/connectivity-edit composition,
narrow named forwarding, safe server reads/client interactions, accessible status
presentation, identity-bound mounted form/intent state, actual browser checks,
operator guide and combined parent evidence. Extend existing telephony contracts
only where necessary and verify a/b compatibility.

No new sessions, database access in Next.js, observer/lease logic in UI, secret
upload/reveal, persisted browser drafts, node deletion, extension provisioning,
trunk/route editors, apply/reload/rollback buttons, tenant activation or operational
call UI. Runtime failures remain node observations; platform service/auth failures
retain established HTTP semantics.

## Operator journey

1. A currently authorized operator opens the PBX list. Server and API reads require current backend authority, return no-store data and show bounded pagination with loading/empty/error/retry states.
2. Register presents labeled non-secret desired fields and permitted opaque secret aliases. Show supported target/transport constraints and that saving retains desired settings separately from observation. Do not request raw credentials or expose provider locations.
3. Explicit submit creates one stable owner-bound intent and calls a's protected API. Suppress simultaneous duplicate clicks; validation/conflict preserves permissible values and focuses/announces actionable errors.
4. Confirmed success opens canonical detail. Show desired connection/version separately from current connection, reconciliation, registration coverage/counts and last-success age. Missing observation means not yet observed; successful empty registration is visibly different from unknown/unavailable.
5. Passive refresh reads b's shared projection without spawning a process or renewing a user session. Display stale/historical observations correctly after disconnect, observer loss or freshness expiry. Node failure does not hide other nodes or imply the platform API is down.
6. Connectivity edit carries expected version. On conflict, preserve current input for explicit reload/review; never overwrite a newer saved version. Confirmed edit clears any current-health claim until the new version reconciles.

Display saved/reconciling/reachable/disconnected/stale and sanitized secret/
configuration failure as distinct applicable states, using text as well as color.
Observed registration does not mean allocated, assigned, verified extension or
voice-ready tenant. No revision/apply success is implied by registry save.

## Transport, uncertainty and identity recovery

Use existing Secure/HttpOnly host-only platform cookies, canonical guards,
CSRF/Origin and explicit source/channel rules. Add only named bounded forwarding
for a/b routes with validated DTOs and safe errors. Server Components/Server Actions
and direct/deep-link API calls enforce the same backend authority; cookie presence
and client-provided role/tenant fields cannot grant access. Never return resolved
credentials or raw backend/protocol errors. Do not cache protected results in
shared public output or expose secret sentinels in bundles/storage/URLs/logs.

Track a create intent with canonical operator ID, immutable payload/fingerprint
and rendered-operation epoch. A lost response is uncertain: offer explicit retry
of the same key/payload or canonical reload. Editing the payload starts a new
intent only after the prior uncertainty is reconciled; do not blindly submit a
second create or replay writes after reauthentication. Connectivity-edit response
loss requires canonical version reload/review before another edit. a's create
receipt contract is reused, not recreated in browser storage.

Reuse mounted same-operator recovery. Protected 401 blocks submission and hides
retained form values during authentication; restore only after current backend
identity matches the prior canonical operator. Another operator or confirmed logout
clears retained values, intent and protected shell state. Treat 403 as denied and
503 as retryable unavailability, preserving hidden/safe state as the existing
contract permits. Passive refresh cannot prevent idle expiry; resumed submission
is explicit under current authority.

Fence late reads/mutations with canonical owner and operation epoch across target
changes, expiry, logout, navigation and identity replacement. A late callback
cannot reopen another operator's data or overwrite a newer node view. Retain
unfinished non-secret work in mounted application memory only; reload persistence
and browser-storage drafts are outside scope.

## UI and documentation requirements

Use shared dark tokens/primitives, visible labels/focus, keyboard navigation,
accessible announcements/dialog focus where applicable and desktop/tablet/narrow
reflow. Show timestamps/age clearly and use the project's Asia/Manila timezone for
operator-facing documented schedules/times. Preserve input on bounded validation
and support explicit retry without multiplying requests.

The operator guide explains how to register/inspect/edit, use opaque references,
read saved vs observed/freshness states, recover uncertain writes, and escalate
secret/PBX/observer failures. The runbook describes approved runtime access,
settings, ownership/reconciliation recovery and shutdown. Combined evidence maps
every parent criterion to reproducible commands/environment/results and limits;
never publish credential material or unrestricted secret paths.

## Acceptance and verification

| ID | Required observable result/check | Parent coverage |
| --- | --- | --- |
| C-01 | Actual console list/register/detail/edit uses a/b contracts, bounded named forwarding and current backend authority. Direct/deep links, server reads and A/B calls reject staff/forged/expired/revoked authority and CSRF/channel/Origin abuse; responses are no-store. | AC-01 browser; AC-03 browser |
| C-02 | Real operator registers and inspects a controlled node; duplicate click, validation, canonical-target conflict, optimistic edit and lost create/edit response preserve safe explicit retry/reload behavior without duplicate mutation/audit. | AC-10 journey; AC-02 integrated |
| C-03 | Desired and observed state, reconciliation, registration coverage/empty/unknown, sanitized auth/secret failure and historical/stale age display accurately during real disconnect/reconnect/failover and a target/reference edit. No registration observation claims voice readiness. | AC-10 states; AC-05/08 integrated |
| C-04 | Same canonical operator can explicitly resume hidden retained work after expiry; another operator and confirmed logout clear it. Passive refresh cannot renew; late owner/operation callbacks cannot expose or overwrite protected state. No automatic write replay or browser-storage drafts. | AC-10 recovery; AC-03 expiry |
| C-05 | Node failure remains distinguishable from protected API/session unavailability; retry and restored reads work without spawning another observer. Healthy independent-node views remain usable. | AC-09 browser; AC-10 failure |
| C-06 | Keyboard/labels/focus/announcements and desktop/tablet/narrow reflow pass actual browser checks. Secret sentinels are absent from HTML/DTOs/URLs/storage/bundles/logs and artifacts; only safe opaque aliases appear. | AC-10 accessibility; AC-04 browser |
| C-07 | Combined real-service/browser/ownership suite reruns every parent AC-01–11, a/b regressions and required full Docker graph. Guide/contracts/runbook/index/tracker and safe evidence reflect actual settings, results, limitations and P3-U2/U5 handoff. | AC-11 combined; AC-01–11 reconciliation |

Establish proposed `./dev exec pnpm check:pbx-nodes --browser` and combined
`./dev exec pnpm check:pbx-nodes` during implementation; neither exists at spec
creation. Browser checks use the actual secure platform app/proxy, real platform
sessions on independent HTTP A/B, real PostgreSQL/Redis, independent telephony
processes and controlled Asterisk. Do not replace the operator journey with mocked
API data. Reuse isolated a/b fixtures and real loss/failover controls; clearly
label injected faults separately from live integration evidence. Precisely clean
fixture-owned resources without editing existing tenant routes.

Rerun a/b selections, affected platform-auth/owner-recovery and durable/process
regressions, plus `./dev check`. A simulator alone cannot establish parent live
acceptance. Record actual commands, browser/environment, outcomes and material
limits. Documentation preparation needs link/coverage/consistency/whitespace
checks only; no application runtime check is claimed by writing these specs.

## Completion and handoff

Complete c only when C-01–07 and every parent criterion pass. Reconcile actual
a/b/c evidence and current dependency/gate state before marking parent P3-U1
complete. Pass canonical node identity, safe registry/observation ports and
freshness/coverage semantics to P3-U2; pass the database ownership port and
unfulfilled external write-fencing/revision-ordering obligations to P3-U5.
Tenant allocation, configuration apply/recovery, production HA and the remaining
Phase 3 gate stay separately incomplete until their owning units pass.
