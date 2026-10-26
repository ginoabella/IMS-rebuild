# P3-U5 — Review, validate, apply, and recover configuration revisions

Status: **in progress**; [P3-U5a](p3-u5a-revision-capture-diff-and-validation.md)
is complete within its offline boundary; b is completed within approved private development under U5-01–05
and c remains planned. Prepared and reviewed October 25, 2026 (Asia/Manila,
+08:00). This specification defines intended behavior; it grants no new live
PBX, secret-access or calling authority. The three-child delivery split was adopted
October 25, 2026 when the user requested the child specifications.

## Requirement and outcome

Implement [Phase 3, P3-U5](../implementation-plan.md#p3-u5--review-validate-apply-and-recover-configuration-revisions):
a platform operator captures desired configuration, reviews its diff and affected
resources, validates it, explicitly applies it, observes independent verification,
and recovers to a known-good revision after failure. Saving inventory, credentials
or routing forms remains passive.

Completion requires the actual console and controlled live Asterisk, including
failed validation/reload/verification, rollback, competing applies, interruption,
owner failover and active-call handling. A simulator cannot satisfy the Phase 3
gate. Production readiness and tenant activation remain later work.

## Starting state and scope

P3-U1–U4 are complete within their recorded private-development boundaries.
Reuse their canonical node/installation identities, desired resources, versions,
node locks, generated route identities, protected platform sessions, mounted
reauthentication recovery and safe DTO conventions. P1-U5 supplies transactional
audit/outbox and durable execution. Relevant existing contracts are:

- [PBX ownership and observation](../../docs/architecture/pbx-observation.md),
  especially its external-command fencing limitation.
- [Endpoint credential generations](../../docs/architecture/endpoint-credentials.md)
  and [simple trunk credential versions](../../docs/architecture/trunk-credentials.md).
- [Ring groups and reservations](../../docs/architecture/ring-groups.md),
  [inbound identities](../../docs/architecture/inbound-routing.md) and
  [outbound matching and permissions](../../docs/architecture/outbound-routing.md).

Extend the telephony module, module-owned PostgreSQL migrations, shared contracts,
existing durable delivery, independent telephony execution boundary and platform
console. Add only the protected installation/material ports actually needed.
HTTP/Next remain unable to resolve secrets or issue PBX commands. Reuse the
existing deployment catalog for installation identity and command policy.

Excluded: tenant allocation/binding workflows and readiness (P4-U2/U3), operational
call ingestion/attribution (P5-U3), phone credential delivery unless separately
approved as necessary, production HA and backup redesign. Preserve unmanaged PBX
configuration, existing material and the approved simple trunk model. Do not
revive the archived credential/attestation infrastructure.

## Decisions required before dependent implementation

The owner decides product and access policy. The owner approved the five recommended policies in the linked concrete review;
routine filenames, DTO names and compatible implementation choices need no gate.

| ID | Decision and recommended direction | Affected work and resume condition |
| --- | --- | --- |
| U5-01 | Approve the controlled installation, managed include boundary, exact validation/reload/verification commands, permitted execution identity and recovery commands. Prefer fixed deployment-owned operations with bounded arguments/timeouts; no arbitrary CLI, shell or AMI action input. Establish and verify the initial recoverable baseline before the first live change. | Live validation/apply/recovery; record the concrete command/access profile and baseline procedure before execution. Earlier observation permission does not authorize control. |
| U5-02 | Approve active-call detection, affected-call scope, freshness, waiting deadline and drain/defer behavior. Recommend deferring affected changes while calls are active or state is unknown; no forced hangup. Prevent new affected calls before relying on a zero-call check if the approved procedure requires a quiet window. | Apply and rollback; specify how activity is checked and races are excluded, including a failed change with active calls. Unknown activity must not mean idle. |
| U5-03 | Approve isolated test endpoints, ingress/egress destinations, call budgets, observations and cleanup. Recommend controlled synthetic peers with no public/emergency destinations, tenant traffic or paid trunk calls. | Live verification; record exactly which checks are passive and which originate traffic. Test fixtures establish the declared boundary only. |
| U5-04 | Approve exact endpoint-generation/trunk-version consumption, protected materialization identity/access and necessary PBX file protection. Keep HTTP, Next and ordinary workers outside material access; do not give Asterisk an OpenBao token. Separately decide phone delivery, retirement and retention. Recommend retaining every referenced version; no credential destruction in this unit. | Secret-dependent compilation/apply/rollback; review concrete least-privilege access and credential dependency/retirement rules. Existing endpoint worker rights and trusted trunk setup rights do not automatically extend to live consumers. |
| U5-05 | Resolve the pre-onboarding verification boundary. Recommend deploying a deny-by-default infrastructure revision that leaves unallocated inventory and unbound routes calling-ineligible, with separately approved isolated fixtures proving actual compilation/routing. | Compiler eligibility and live acceptance; agree the fixture topology and evidence required for Phase 3 without introducing production tenant bindings ahead of P4-U2. |

A concrete [P3-U5b private-development policy review](../../docs/planning/p3-u5b-live-policy-review.md)
was explicitly approved in full by the owner in chat on October 25, 2026
(Asia/Manila, +08:00): “yes I approve the five recommended policies, please continue”.
That concrete profile resolves U5-01–05 for controlled private development, including
its timing/budgets and read-only material consumer setup. The mandatory boundary,
admission, baseline and recovery proof gates remain required before live enablement.

Revision review and deterministic compiler work may proceed within established
contracts without live effects. Splitting work does not resolve these decisions.
No further approval is needed to finish this documentation request.

## Immutable revision and review contract

- Capture a bounded, consistent primary-database snapshot for one canonical
  installation/node. Persist a server revision UUID and ordered sequence, parent
  and baseline references, compiler/policy version, actor/time, source resource
  UUIDs/versions, eligibility facts and exact safe credential references. Never
  persist material in snapshots, diffs, audit, outbox, jobs or client payloads.
- Derive deterministic managed includes from typed canonical data. Treat labels,
  addresses and patterns as data; escape/reject configuration delimiters and
  disallow raw applications, contexts, include paths and command text. Preserve
  approved matching, disabled-winner denial, reservations, group order/timeouts,
  fallback behavior and route identities. Unsupported live capabilities produce
  explicit validation blockers rather than silently omitted enabled behavior.
- Unbound routes and unallocated/disabled stock cannot gain tenant calling
  eligibility through compilation. Default/unknown ingress and unmatched outbound
  traffic deny. Future P4-U2 bindings must supply canonical ownership and explicit
  shared-trunk permissions for every reachable destination; preserve trusted
  identities/version mappings for P5-U3 without inventing tenant attribution.
- Show a redacted semantic diff against the selected baseline and the actual
  verified runtime revision, distinguishing desired edits, additions, removals,
  credential-reference changes and affected dependencies. Include eligibility
  blockers and unmanaged/drift warnings. Browser diffs never contain raw
  credential-bearing configuration or editable opaque attribution keys.
- Validation records the exact revision/compiler/policy and dependency versions,
  finite diagnostics and any approved PBX validation result. It does not apply,
  reload, originate calls or establish readiness. Local deterministic validation
  can work offline; live validation is explicitly unavailable while PBX is offline.
- Apply accepts an explicitly reviewed revision and expected live baseline.
  Revalidate current dependencies, policy, authority and baseline transactionally
  before accepting intent. Desired edits after capture never mutate that revision;
  changed dependencies require fresh validation/review. Never apply stale review
  silently or substitute newer credentials.

## Durable apply, fencing and installation

Commit accepted operation, exact revision/baseline, actor attribution, dependency
pins, audit and durable intent together before external effects. Use scoped
idempotency and immutable request fingerprints. An uncertain browser response
recovers the same operation; it must not create a second apply.

Serialize applies and recoveries per node through the existing ownership and
canonical lock conventions. Only the current fenced owner may advance the ordered
revision. Workers may deliver intent, but the external effect remains gated by
the current telephony owner. Keep HTTP, worker and telephony entry points distinct.

**External fencing is mandatory:** a database check before sending a command
cannot revoke that command after lease loss. The installation boundary must
enforce node identity, monotonically ordered ownership epoch and operation/revision
identity at the point of mutation, reject stale/duplicate/out-of-order effects and
serialize successor work with any earlier effect already executing. Document and
prove this mechanism before live apply; local cancellation alone is insufficient.
Do not add an unrelated service merely to label the operation fenced.

Stage the complete managed artifact set in a protected location and validate it
before activation. Atomically select a complete versioned include set; preserve
unmanaged files and previous recoverable artifacts. Multi-file copying followed
by reload is insufficient. Secret-bearing runtime artifacts have restricted access
and never become review/download artifacts. Retain enough safe provenance to
reconcile the exact revision and credential versions without material hashes in
public projections. Recheck ownership/activity at each required effect boundary.

Record external uncertainty before issuing effects. Retrying after timeout, process
crash, PBX outage or database loss reconciles installed identity, reload outcome and
runtime observations before deciding the next action. Never blindly replay a reload
or advance a newer revision over an unresolved predecessor. Use bounded retries,
timeouts and safe finite errors; exhausted or ambiguous work remains visibly
unresolved and blocks conflicting applies until audited reconciliation.

## Verification, recovery and retained dependencies

Track validation, installation/apply, runtime verification and recovery separately.
An installed include or successful reload acknowledgement does not establish a
verified revision. Verification identifies the exact installed artifact/revision,
expected endpoints/profiles/credential references and route behavior, then runs
the approved controlled probes. Registration alone proves neither selected
credentials nor successful routing or tenant readiness.

Promote known-good only after required verification passes. Validation failure
leaves runtime untouched. Installation/reload/verification failure restores the
previous verified artifact set under the same fencing, active-call and command
policy, then reloads and verifies the recovery. The first apply requires a captured,
verified baseline; an arbitrary current filesystem is not automatically known-good.
Rollback is its own audited operation and never rewrites desired records or history.

If recovery cannot be verified, show failed recovery/unknown runtime explicitly,
retain both revisions and pins, deny readiness and block further conflicting work.
Offer bounded operator reconciliation and retry against the same recorded facts.
Do not report the previous revision healthy just because restoration was attempted.

Persist actual in-flight, installed, verified and rollback dependencies on source
resources and exact credential versions. Add blockers to the existing removal,
structural edit and future reallocation/retirement paths using their canonical
lock order. A newer desired version does not release an older runtime dependency.
Unknown external state retains pins. Release only on affirmative reconciliation
that no installed/in-flight/recovery target needs the resource; keep history and
audit. There is no general credential pruning or backup project in this scope.

## Platform browser journey

From PBX detail, open configuration revisions, capture desired state, inspect the
diff and affected resources, validate, explicitly apply and follow durable progress.
Show saved desired, installed, verified, known-good and recovery states separately,
with timestamps, safe actor attribution, blockers and freshness. Provide retained
operation detail, bounded revision/history pagination and an explicit recover action
with the selected known-good target and affected-resource review.

Use existing dark tokens/components, protected same-origin proxies, platform
permissions, CSRF checks and no-store reads. Staff/cross-plane access rejects.
No browser-supplied command, path, material, tenant authority or runtime identity
is accepted. Preserve safe inputs and identity-bound mounted recovery after
reauthentication; reload canonical operation status after reconnect or uncertainty.
Closing the browser or session expiry does not falsely cancel an accepted durable
operation. Recheck canonical execution authority according to the established
durable-operation contract, distinguishing expiry from account/permission changes.

Include loading/empty/error/offline and stale-baseline states, labelled controls,
keyboard navigation, focused validation errors, accessible progress text and
narrow-screen reflow. Disabling an Apply button is never the concurrency control.
Document what the operator can retry, when to wait and when reconciliation is needed.

## Acceptance and required verification

| ID | Required result and evidence |
| --- | --- |
| AC-01 | Real database/API/browser capture, redacted diff, affected-resource review and validation use immutable consistent snapshots. Repeated compilation is deterministic; injection, unsupported configuration and stale dependencies reject. Desired saves perform no live effects. |
| AC-02 | Compilation preserves all approved endpoint/resource/routing semantics, deny defaults, reservations and generated identities. Unbound/unallocated stock remains ineligible; isolated fixtures demonstrate the approved live boundary without claiming tenant allocation or ownership. |
| AC-03 | Explicit browser apply commits durable audited intent and pins before effects, installs a complete artifact set atomically, uses approved commands and records apply separately from verification. Real controlled Asterisk independently confirms the selected revision and approved probes. |
| AC-04 | Two HTTP replicas and competing executors preserve one ordered node operation under duplicate requests, stale baselines, concurrent edits and racing applies/recoveries. A paused stale owner cannot mutate PBX after successor takeover, including already-dispatched effect races. |
| AC-05 | Real failed validation, installation/reload and runtime verification leave or restore the verified baseline as appropriate. Recovery itself is verified. Failed/uncertain recovery denies readiness, retains pins and supports explicit audited reconciliation without losing desired edits. |
| AC-06 | Interrupt before/after durable commit, stage, activation, reload and verification; restart/failover and lost replies reconcile exact external state. Duplicate delivery does not repeat an unsafe effect; database/PBX/provider outages remain bounded and truthful. |
| AC-07 | Approved active-call scenarios defer/drain both apply and rollback correctly. Stale/unknown activity blocks unsafe effects; demonstrate the check-to-effect race and waiting deadline without unapproved hangup or public calling. |
| AC-08 | Exact endpoint-generation/trunk-version access is confined to the approved consumer. Replacement desired credentials do not silently alter a captured revision or revoke live credentials. Installed/in-flight/rollback dependencies block real removal/retirement races and retain material on unknown state. Logs, audit, DTOs and artifacts respect secret boundaries. |
| AC-09 | Actual HTTPS journey covers review → validate → apply → verify → recover, uncertain responses, reauthentication, authorization/CSRF denial, pagination, keyboard and responsive states. A second replica/browser sees the same canonical operation results. |
| AC-10 | Publish operator commands/policy, initial baseline and recovery procedures, dependency/credential contracts, exact live evidence and limits, cleanup/restoration evidence and P4-U2/P5-U3 handoffs. All affected regressions and normal Docker checks pass; reconcile the Phase 3 gate explicitly. |

Use deterministic contract tests, isolated real PostgreSQL/shared Redis, two HTTP
replicas and the actual HTTPS console. Test external fencing at the actual mutation
boundary and run live acceptance against the approved controlled Asterisk. Keep
fault fixtures distinct from real integration results. Record baseline fingerprints,
temporary resources and exact cleanup; preserve existing data/material/configuration.

Establish a focused `check:pbx-revisions` workspace script during implementation;
the proposed invocation is `./dev exec pnpm check:pbx-revisions`. It is implemented for a’s offline boundary;
[focused and affected/normal checks passed](../../docs/status/p3-u5a-evidence.md).
B/c must extend it for their live acceptance; no parent/live pass is claimed. Run affected existing `check:routing`,
`check:trunk-gateways`, `check:extension-inventory`, `check:pbx-nodes` and durable/auth
checks inside the Docker workspace, followed by `./dev check`. Documentation-only
preparation needs formatting, local-link and consistency review, with no service
startup or runtime tests.

## Review and adopted implementation split

**Deliver three sequential sub-units.** Revision review has a useful independent
outcome; live apply and minimum verified rollback form one safety boundary; broader
failure/failover acceptance can follow once that complete path works. Do not ship
live apply first and postpone its baseline, pins, fencing or recovery to a later unit.

| Implementation unit | Starting state and focused result | Acceptance ownership |
| --- | --- | --- |
| [P3-U5a — Revision capture, diff and validation](p3-u5a-revision-capture-diff-and-validation.md) | Verified U1–U4/P1-U5. Deliver immutable snapshot/compiler, safe semantic diff, affected-resource/dependency review, deterministic validation and complete browser review workflow. Expose unresolved live-policy blockers. No live installation. Any PBX validator waits for U5-01. | AC-01; deterministic AC-02; review portions of AC-08/09/10. Live AC-02 evidence remains b/c. |
| [P3-U5b — Fenced live apply and verified recovery](p3-u5b-fenced-live-apply-and-verified-recovery.md) | Completed B-01–08; [evidence](../../docs/status/p3-u5b-evidence.md). Verified a; U5-01–05 resolved for its scope. Deliver protected exact-version materialization, durable intent/pins, external fencing, atomic activation, approved reload/probes, active-call handling and minimum verified automatic/manual recovery with browser progress. Initial baseline and failed-recovery handling are mandatory here. | Live AC-02; AC-03–08/09 for the complete basic live/recovery journey; relevant AC-10 contracts/runbook. |
| [P3-U5c — Interruption, failover and integrated Phase 3 handoff](p3-u5c-interruption-failover-and-integrated-phase-3-handoff.md) | Verified b. Complete the adversarial interruption/uncertainty/failover/concurrency matrix, repair discovered gaps, finish browser reconciliation and operator evidence, regress U1–U4 and reconcile every parent acceptance criterion. | Full AC-04–10 fault coverage and final AC-01–10 reconciliation. |

The split follows the repository workflow rule: each unit has a verifiable result
and carries its own required backend/browser/checks/docs. It is not a layer-by-layer
split. A is completed within its offline boundary; b is completed within approved private development under U5-01–05
and c remains planned. Adopting this split
does not resolve U5-01–05 or authorize live effects.

Review findings incorporated above: database fencing alone cannot protect external
effects; atomic files do not imply verified runtime; rollback needs a verified
initial baseline and its own activity policy; desired edits must not release live
credential/resource pins; pre-onboarding fixtures must not grant unbound routes
tenant traffic. Missing product/access decisions remain explicit implementation
gates. P3-U5 and the Phase 3 gate remain incomplete.
