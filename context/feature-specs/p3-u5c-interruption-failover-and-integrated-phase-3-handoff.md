# P3-U5c — Interruption, failover and integrated Phase 3 handoff

Status: **planned**. Split adopted October 25, 2026 (Asia/Manila, +08:00).
Parent: [P3-U5 specification and acceptance](p3-u5-configuration-revisions-apply-and-recovery.md).

## Goal and starting state

Prove the complete configuration revision journey under interruption, competing
execution and uncertain recovery, then reconcile every parent criterion and the
Phase 3 gate with reproducible evidence and operator guidance.

Dependencies: verified [P3-U5a](p3-u5a-revision-capture-diff-and-validation.md) and
[P3-U5b](p3-u5b-fenced-live-apply-and-verified-recovery.md), approved parent
U5-01–05 policies for all exercised effects, a controlled live Asterisk and existing
real PostgreSQL/shared Redis/two HTTP replicas/HTTPS console. B must already include
external fencing, baseline, pins, active-call handling and verified recovery.

## Scope and required fault matrix

Extend focused checks, repair gaps within the existing telephony/console/durable
boundaries and publish the integrated handoff. Avoid introducing another runtime,
test-only source of authority, tenant allocation workflow or backup program.
Fault injection may exercise timing/failure boundaries, but live PBX success and
recovery claims require actual approved integration, not simulator results.

| Boundary | Required interruption/race and observable result |
| --- | --- |
| Durable acceptance | Interrupt before/after intent/audit/pin commit; lose the HTTP reply; repeat identical and changed fingerprints across replicas. No rolled-back effect, duplicate operation or lost accepted intent. |
| Protected staging | Crash before/after exact material read, artifact write and validation; inject provider/PBX/database loss. No latest-version fallback, secret leak or partial active set; resume or fail with truthful bounded state. |
| Atomic activation | Interrupt before/after complete-set activation and before recording its result; lose installer replies. Reconcile exact installed revision before any replay or newer work. |
| Reload | Interrupt before/after dispatch/acknowledgement, including delayed in-flight execution. An acknowledgement gap does not prove failure or justify a blind repeated effect. |
| Verification | Interrupt during probes and before/after known-good commit. Successful probes for another revision do not promote the target; status remains separate from installation. |
| Ownership | Pause old owner, expire lease, acquire successor and resume old process; race already-dispatched effects and duplicate jobs. The actual mutation boundary enforces monotonic epochs and serialized effects; only one ordered outcome becomes canonical. |
| Active calls | Race call arrival with the activity check, use stale/unknown snapshots and exhaust approved waiting limits, for apply and rollback. Approved defer/drain policy holds without unapproved hangup or traffic. |
| Recovery | Interrupt restore/reload/reverification; inject failed and uncertain recovery; race explicit recovery with newer apply. Retain source/target pins, block conflicting work and reconcile with audited actions; never declare attempted recovery verified. |
| Resource dependencies | Race reference removal/structural change and exact material-version replacement with acceptance, apply and recovery. Older installed/rollback dependencies persist until affirmative safe release; unknown external state retains pins. |
| Browser/session | Lose capture/apply/recover replies, reconnect to another replica and reauthenticate. Canonical reload recovers the exact operation and preserves identity isolation without duplicate live effects. |

Bound scenarios and fault controls to the approved installation. Record phase,
operation/revision/epoch and safe expected-versus-observed results. Do not log raw
protocol/material payloads or give ordinary HTTP/browser fixtures secret access.
Any required unperformed live scenario remains incomplete with a resume condition.

## Integrated browser and regression work

Exercise desired inventory/resource/routing save → revision capture → semantic
review → validation → explicit apply → independent verification → explicit/failed
apply recovery through the actual HTTPS console. Confirm ordinary desired saves
still cause no external effect. Review all separate status/freshness fields,
affected-resource navigation, bounded history, uncertain-operation feedback and
recovery-target selection under normal and fault outcomes.

Cover two HTTP replicas/shared sessions, platform versus staff authority, CSRF,
canonical permission/account changes versus mere session expiry, keyboard/focus,
progress accessibility, narrow-screen reflow and secret-free error output. Retain
the approved deny-by-default pre-onboarding boundary: fixtures do not deliver tenant
bindings, calling readiness, activation or operational event attribution.

Rerun affected P3-U1–U4 and durable/auth regressions. Preserve original data,
credentials and unmanaged PBX configuration. Remove exact temporary fixtures and
verify restoration/reconciliation of the intended retained baseline, backing-service
health and ordinary console/runtime after checks. Keep cleanup evidence distinct
from production rollback or backup readiness.

## Acceptance and checks

| ID | Required result |
| --- | --- |
| C-01 | Every fault-matrix row passes against its declared real/injected boundary with exact revision/operation reconciliation, bounded failures and no duplicate unsafe effect. Required live outcomes use actual approved Asterisk. |
| C-02 | Competing executors/HTTP replicas and stale-owner dispatched-effect races prove ordering at the real mutation boundary. Unknown/failed runtime and recovery states retain dependencies and deny readiness until affirmative reconciliation. |
| C-03 | Actual HTTPS integrated normal/failure/recovery journeys and browser/session/accessibility/security scenarios pass; a second replica/browser observes the same canonical result and safe data. |
| C-04 | Actual installed/in-flight/rollback resource and exact credential dependencies survive replacement, outage and removal races, then release only when positively safe. Unbound stock, unknown ingress and unmatched outbound remain denied. |
| C-05 | Focused and affected regression checks plus full Docker checks pass; fixture cleanup, baseline restoration/reconciliation and ordinary runtime/console health are documented. |
| C-06 | Publish a parent AC-01–10 evidence matrix, explicitly reconcile the Phase 3 gate, and provide operator/architecture handoffs with commands, approvals, procedures, limitations and remaining P4/P5 responsibilities. No completion claim precedes all required evidence. |

C completes full parent AC-04–10 fault/integration coverage and reconciles AC-01–10
using retained a/b evidence plus fresh checks where needed. Extend the proposed
`./dev exec pnpm check:pbx-revisions` to include this repeatable matrix and HTTPS
journey; it is not yet implemented. Use isolated real PostgreSQL/shared Redis,
two HTTP replicas, competing telephony executors and approved live PBX fixtures.
Run existing affected `check:routing`, `check:trunk-gateways`,
`check:extension-inventory`, `check:pbx-nodes` and durable/auth scripts inside the
Docker workspace, followed by `./dev check`. Record actual commands, policy/profile,
results and limitations. Documentation-only preparation requires formatting,
local-link/anchor and consistency checks, not runtime startup.

## Completion and downstream handoff

Provide one traceable parent acceptance matrix naming each criterion, its evidence,
environment and limits. Missing live evidence keeps the applicable criterion,
parent and Phase 3 gate incomplete; independent child results retain their scope.

Operator guidance must explain desired versus installed versus verified state,
initial baseline setup, approved commands/activity policy, exact retry versus new
intent, failed-recovery reconciliation and safe dependency retention. Architecture
guidance must cover external fencing, atomic artifacts, canonical operation
ordering and protected exact-version material access.

P4-U2 receives verified revision/resource provenance, actual dependency ports and
the future trusted allocation/binding eligibility boundary. P4-U3 still owns tenant
readiness/activation. P5-U3 receives preserved internal route/version identities
and must authenticate real ingress before tenant attribution. Production security,
HA, backup/restore targets and operational launch remain their owning later work.
