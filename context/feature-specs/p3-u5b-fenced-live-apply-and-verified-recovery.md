# P3-U5b — Fenced live apply and verified recovery

Status: **planned**. Split adopted October 25, 2026 (Asia/Manila, +08:00).
Parent: [P3-U5 specification and acceptance](p3-u5-configuration-revisions-apply-and-recovery.md).

## Goal, dependencies and decisions

Turn an explicitly reviewed revision into independently verified live controlled
Asterisk configuration, with safe automatic/manual recovery in the same unit.
Start from verified [P3-U5a](p3-u5a-revision-capture-diff-and-validation.md), the
existing PBX ownership/observation port, P1-U5 durable execution and retained
endpoint-generation/trunk-version contracts. Reuse the existing platform console.

Resolve parent U5-01–05 for this scope before dependent effects: concrete
installation/commands/execution permissions and verified baseline; active-call
policy and race exclusion; controlled test destinations/budgets; protected exact
material access/retention; and pre-onboarding deny/fixture eligibility. Record the
owner's actual decisions in the parent and tracker. Split adoption approves none
of these live policies. Phone delivery and credential destruction remain excluded
unless separately authorized and specified before use.

## Accepted intent and ownership

- Accept only an explicitly reviewed immutable revision and expected live baseline.
  Recheck platform authority, current dependency/resource/material metadata versions,
  eligibility, validation/compiler/policy and canonical baseline under the existing
  node lock order. Reject stale inputs without substituting newer desired material.
- Commit operation, exact revision/baseline, actor audit, actual dependency pins,
  idempotency receipt and durable intent in one transaction before external effects.
  Exact duplicate/lost-response requests recover the same operation; conflicting
  fingerprints reject. Bound work, retries and timeouts and keep finite safe errors.
- Serialize apply/recovery for each node. Ordinary durable workers may deliver
  intent; the current fenced telephony owner alone gates external mutation. Reuse
  same-transaction ownership fences for persisted transitions and retain distinct
  HTTP, worker and telephony entry points. Expiry/closing the browser does not
  cancel accepted intent; recheck canonical execution authority using the existing
  durable-operation contract for account/permission changes.
- Define and prove enforcement at the actual PBX mutation boundary: canonical node,
  monotonic epoch, operation/revision identity, stale/duplicate/order rejection and
  serialization with an earlier command already executing. A pre-call SQL check or
  cancellation token is insufficient. Do not enable live apply until this mechanism
  passes real stale-owner/dispatch-race checks; c expands the matrix, not this gate.

## Protected installation and verification

Resolve only exact approved endpoint generations and actual trunk KV versions
through the approved protected consumer. HTTP/Next/ordinary workers receive no
provider access or material, and Asterisk receives no provider token. Fail missing,
unavailable or mismatched material without fallback to latest. Retain referenced
versions and restrict secret-bearing staging/runtime files and diagnostics.

Capture and verify the initial recoverable baseline before the first live change.
Stage and validate a complete managed artifact set, atomically select that set,
execute only approved fixed reload operations and preserve unmanaged files.
Do not expose raw material-bearing artifacts as browser review/download results.
Apply the approved active-call guard to installation and recovery, including
unknown/stale activity, the check-to-effect race and waiting/defer limits.

Record uncertain execution before effects. After timeout/crash or database/PBX/
provider loss, reconcile exact installed identity, reload and runtime facts before
retrying; unresolved predecessors block conflicting newer revisions. Do not blindly
replay reloads. Store validation, install/apply, verification and recovery separately.
Verify exact revision/artifact provenance, expected resource/profile/material
references and approved controlled route probes; registration or reload ACK alone
does not establish success. Promote known-good only after verification passes.

Production tenant bindings remain P4-U2. Leave unbound/unallocated stock denied;
approved synthetic probes prove their declared live boundary without granting tenant
traffic, public calling, readiness or operational event attribution.

## Recovery and actual dependencies

Failed pre-install validation leaves runtime untouched. Installation/reload/runtime
verification failure triggers restoration of the previous verified artifact set,
approved reload and independent recovery verification under the same fences and
activity policy. Provide an explicit audited operator recovery operation targeting
a known-good revision. Preserve desired edits and immutable history.

Failed or uncertain recovery retains both revisions and pins, reports unknown/failed
runtime, denies readiness and blocks conflicting operations pending bounded audited
reconciliation. Never mark a baseline healthy merely because restore was attempted.
The safe recovery path and its failure state must work before this unit completes.

Persist real in-flight, installed, verified and rollback dependencies on resource
UUIDs and exact credential versions. Add blockers to actual current removal and
structural mutation paths under compatible canonical locks; define the typed port
future reallocation/retirement paths must consume. Desired replacement never releases
an older runtime pin. Unknown state retains dependencies; affirmative reconciliation
alone permits eligible release. No general credential pruning or backup redesign.

## Browser outcome

Extend a's review path with explicit apply, durable progress, independent verification
and recover controls. Show desired/installed/verified/known-good/recovery states,
safe actor/time attribution, affected resources, waiting/activity and actionable
blockers separately. Show stale baselines and require review before changed intent.
Recover uncertain results by operation identity and reload canonical state across
replicas, reconnect and identity-bound reauthentication.

Use existing protected same-origin/no-store/session/CSRF conventions and dark shared
components. Reject raw commands/paths/material/runtime keys and cross-plane access.
Support labelled keyboard controls, focused errors, accessible progress, responsive
layout and clear unavailable/unknown/failed states.

## Acceptance and checks

| ID | Required result |
| --- | --- |
| B-01 | Real PostgreSQL/two-replica acceptance proves transactional intent/audit/pins, exact retries, stale review/baseline rejection and one ordered apply/recovery per node. Rolled-back intent has no external effect. |
| B-02 | The actual mutation boundary rejects stale owners, duplicates and out-of-order revisions, including paused owners and dispatched commands during takeover. Complete-set activation is atomic and preserves unmanaged configuration. |
| B-03 | Live approved Asterisk validates/installs/reloads/verifies the exact revision with protected exact-version credentials and controlled probes. Unbound/unallocated inventory remains denied; successful reload and registration cannot falsely promote known-good. |
| B-04 | Real validation/reload/verification failures preserve or restore the verified baseline as applicable. Automatic and explicit operator recovery verify success; injected failed/uncertain recovery retains pins, blocks conflicting work and supports audited reconciliation. |
| B-05 | Apply and rollback enforce approved active-call deferral/drain, unknown-state denial, deadlines and the check-to-effect race. No unapproved hangup, destination or traffic occurs. |
| B-06 | Exact credential replacement, missing provider/material, basic crash/lost-response retry and concurrent resource-removal/structural-edit races preserve dependencies. No material escapes the approved consumer/file boundary or enters client/audit/log/job payloads. |
| B-07 | Actual HTTPS review → apply → verify → recover journey, two-replica status, uncertain response/reauthentication, authorization/CSRF denial, keyboard/reflow and failure feedback pass. |
| B-08 | Publish live command/access policy, baseline/recovery/activity procedures, dependency/material contract and reproducible scoped evidence/cleanup. Focused, affected regression and normal Docker checks pass. |

B delivers parent AC-03/05/07 and the basic complete path for AC-04/06/08/09,
live portions of AC-02 and relevant AC-10. Extend a's proposed
`./dev exec pnpm check:pbx-revisions` with isolated real services, two HTTP replicas,
actual HTTPS and approved live Asterisk. Run affected parent-listed routing,
resource, inventory, PBX and durable/auth regressions, then `./dev check`.
Record fixture privileges and actual runtime grants separately. The script and
results do not yet exist; documentation preparation needs only document checks.

## Handoff

Give [P3-U5c](p3-u5c-interruption-failover-and-integrated-phase-3-handoff.md)
the working safe live/recovery path, phase/operation identities, boundary fencing
proof, installed provenance, dependency pins, recovery procedures and finite
diagnostics. Required safety behavior ships here; c completes broader adversarial
coverage and the integrated parent/Phase 3 acceptance record.
