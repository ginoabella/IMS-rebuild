# P3-U5c interruption and integrated Phase 3 evidence

**Completed — C-01–06, parent AC-01–10 and the Phase 3 gate passed within approved private development.**
Started October 26, 2026 (Asia/Manila, +08:00). Uses the existing
[approved U5-01–05 profile](../planning/p3-u5b-live-policy-review.md), including
scoped nftables/NET_ADMIN and separately approved synthetic inventory cleanup.

## Reproducible boundary matrix

Run `./dev exec pnpm check:pbx-revisions` in the Docker workspace. The trusted
launcher uses isolated real PostgreSQL, existing shared Redis, two HTTP replicas,
actual HTTPS and disposable pinned Asterisk 22.10.1. No fault switch is exposed in
ordinary HTTP or the shipped application. Finite records include operation,
revision, phase and owner epochs; no protocol/material payload is logged.

| Required boundary     | Reproducible evidence and expected observation                                                                                                                                                                                                                                                                                                | Current result |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Durable acceptance    | `check-pbx-live-intent.mjs`: reject operation/pin/audit/outbox inserts in real SQL, then race exact HTTP requests across A/B; rollback leaves no intent, pin, audit or active operation; exact receipts recover the same operation, changed fingerprints reject. HTTPS suppresses committed replies.                                          | Passed         |
| Protected staging     | `pbx-live-interruption-fixture.mjs`: abrupt exit before/after stage and validation; successor takes actual expired lease. `pbx-live-provider-owner.mjs`: injected owner loss before/after protected real exact-version resolution, followed by actual successor. Exact provider missing/denied/refused checks retain their declared boundary. | Passed         |
| Atomic activation     | Abrupt exit before/after actual complete-set selection; exact read-only reconciliation precedes any restoration/new intent. No admitted candidate selection replays.                                                                                                                                                                          | Passed         |
| Reload                | Abrupt exit before/after fixed actual reload; delayed dispatched command/helper SIGKILL race retains kernel fence until actual completion. Successor never blindly repeats the candidate reload.                                                                                                                                              | Passed         |
| Verification          | Abrupt exit before/after independent native probes and before/after canonical finish; candidate and baseline identity are checked separately, physical receipts recover lost SQL acknowledgement.                                                                                                                                             | Passed         |
| Ownership             | Actual PostgreSQL expiry/takeover and native lifetime flock/guardians; stale owner rejects, duplicates have no repeat effects, ordered physical outcome becomes canonical.                                                                                                                                                                    | Passed         |
| Active calls          | Native suite uses bounded synthetic calls, natural drain, zero-check/admission race, unknown/stale activity and deadline for apply/recovery. No forced hangup or public traffic.                                                                                                                                                              | Passed         |
| Recovery              | Same abrupt-exit matrix for explicit recovery, automatic failed/unknown recovery and explicit predecessor reconciliation. Unknown retains barrier/pins and rejects conflicting apply.                                                                                                                                                         | Passed         |
| Resource dependencies | Real in-flight/installed/rollback blockers, exact retained versions 1/2 and recovery without another provider read; unknown pins survive. No general retirement/release capability is introduced.                                                                                                                                             | Passed         |
| Browser/session       | Actual desired inventory/resource/routing save → capture/review/validate → lost apply reply/reauthentication → verify → lost recovery reply; second browser/canonical replica, actual drift and injected failed recovery → explicit reconciliation. Existing authority/CSRF/identity/pagination/axe/reflow checks remain included.            | Passed         |

The native interruption child exits with code 73, bypassing catches/finally. Its
successor waits for the real default 15-second SQL lease expiry and acquires the
actual kernel lock. Thirteen apply points and eleven recovery points exercise both sides
of stage (apply only), validate, select, reload, probe and canonical finish. The
fixture counts selection/reload calls across the loss boundary; pending/complete
physical receipts forbid any repeated candidate effect. Only an explicit audited
reconciliation may restore an unverified selected set. Every case verifies its
canonical installed/verified/known-good identity and restores the retained initial
fixture baseline before the next case. These tests originate no calls.

Consumer interruption is injected by aborting the owner loop around real GET-only
resolution; it does not claim an OS process crash or provider outage. Native process
crash points are actual abrupt exits. SQL insertion faults are transaction rollback
injection, not a database-server crash. Probe outage is injected; parser, selection,
loaded-runtime drift, command execution and HTTPS are actual integration.

## Child acceptance reconciliation

| ID   | Evidence required for completion                                                                                                                                           | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C-01 | All ten declared fault rows and 24 actual process-loss cases; real pinned Asterisk success/recovery and finite expected/observed records                                   | Passed |
| C-02 | Real SQL/native epoch/guardian dispatch races, competing recover/apply, unknown pins/readiness denial and audited predecessor-chain recovery                               | Passed |
| C-03 | Actual integrated HTTPS desired saves/live/failure/recovery, separate Chromium/shared session on replica B, auth/CSRF/keyboard/progress/axe/reflow                         | Passed |
| C-04 | Actual material versions 1/2, protected-consumer loss, concurrent resource blockers, unknown retention and affirmative never-installed pin release; deny-by-default probes | Passed |
| C-05 | Affected and full Docker checks, exact fixture cleanup, intended retained revision preservation and ordinary service/HTTPS health                                          | Passed |
| C-06 | AC-01–10 matrix, explicit Phase 3 gate and operator/architecture/P4/P5 handoffs with commands/policies/limits                                                              | Passed |

## Parent acceptance reconciliation

Retained evidence: [a](p3-u5a-evidence.md), [b](p3-u5b-evidence.md).
Fresh focused and affected checks below reconcile the retained child evidence within the approved U5-01–05 boundary.

| Parent criterion | Evidence/environment                                                                                                               | Status |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-01            | A-01–06 plus fresh SQL/A/B/HTTPS immutable capture, diff, validation and passive saves                                             | Passed |
| AC-02            | Compiler contracts plus actual native authentication/group/inbound/outbound/reservation/deny probes under U5-03/05                 | Passed |
| AC-03            | Real SQL intent/pins, actual complete-set native install and independent verification, explicit HTTPS apply                        | Passed |
| AC-04            | Actual SQL/native dispatch race, abrupt-process successors, two HTTP replicas and exact retries                                    | Passed |
| AC-05            | Actual invalid parser/selection/drift; failed/unknown recovery and audited native/browser reconciliation                           | Passed |
| AC-06            | Declared real/injected acceptance, material, stage, activate, reload, probe and finish loss boundaries                             | Passed |
| AC-07            | Real bounded call/admission tests for apply/recovery; stale/unknown/deadline tests                                                 | Passed |
| AC-08            | Protected exact versions, provider/custody isolation, actual durable resource/material pins and blockers                           | Passed |
| AC-09            | Actual HTTPS normal/failure/recovery, lost replies, reauthentication, second browser, permission/CSRF, keyboard/axe/reflow/history | Passed |
| AC-10            | Operator/architecture/downstream handoff, affected/full checks and exact cleanup/retained baseline health                          | Passed |

**Phase 3 gate passed:** browser configuration and actual controlled-PBX live
verification/recovery passed, with desired/runtime/rollback operator guidance.
All C-01–06 and parent AC-01–10 criteria above are reconciled. This completes the
approved pre-onboarding development gate. Tenant binding/allocation and readiness
remain P4-U2/U3; authenticated operational ingress attribution remains P5-U3.
Production security, HA, capacity and joint backup/restore remain with later owners.

## Commands and final results

Every command below exited 0. Exact timestamps, public source fingerprints,
24 operation/revision/epoch interruption records, two protected consumer records,
two resource races and preservation/health facts are retained in the
[machine record](p3-u5c-verification.json). Temporary log paths identify the local
receipts; the committed bounded records preserve the outcomes after those expire.

| Docker command                                             | Result and scope                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:pbx-revisions`                      | Passed October 26 02:42–02:59 UTC: all 24 actual abrupt losses, native fence/activity/SQL/provider and integrated HTTPS/session journeys; then-existing 16 contracts.                                                                 |
| `./dev exec pnpm check:pbx-revisions --native-integration` | Passed final test-only addition: concurrent acceptance versus resource removal/edit plus real native/SQL recovery, connection-loss, late authority and safe-release regressions. Diagnostic subset complements the full focused pass. |
| `./dev exec pnpm check:routing`                            | Passed serial final run.                                                                                                                                                                                                              |
| `./dev exec pnpm check:trunk-gateways`                     | Passed.                                                                                                                                                                                                                               |
| `./dev exec pnpm check:pbx-nodes`                          | Passed full registry/actual AMI/browser with nonempty retained baseline.                                                                                                                                                              |
| `./dev exec pnpm check:platform-auth`                      | Passed.                                                                                                                                                                                                                               |
| `./dev exec pnpm check:extension-inventory`                | Passed full API/provider/browser and actual PBX mapping/cleanup.                                                                                                                                                                      |
| `./dev exec pnpm check:durability`                         | Passed standalone and within the full graph.                                                                                                                                                                                          |
| `./dev check`                                              | Passed October 26 03:52–04:26 UTC: lint/format/types, builds/exports, entrypoint/configuration, foundation/durability/storage/identity/session/registry graph.                                                                        |
| Protected-boundary contracts                               | All seven passed, including exact/full/truncated/missing/extra/duplicate/ambiguous baseline identity cases.                                                                                                                           |
| Final test-only fixture format/lint                        | Passed. No production change followed the full graph.                                                                                                                                                                                 |
| `./dev pbx-live-check`, `./dev health`                     | Exact retained bytes/loaded runtime/journal/SQL match; live and ready HTTP 200, database and both Redis services up.                                                                                                                  |
| `./dev platform-https-check`, `./dev staff-https-check`    | Transport/security/actual Chromium passed; both ordinary consoles ready.                                                                                                                                                              |

Final changed-document validation passed: 758 local targets, 58 heading anchors,
22 public source fingerprints, shell syntax and diff whitespace. Public handoff
documents were formatted. Final inspection found no remaining live fixture
containers or fixture directories.

## Preservation and cleanup

The operator-applied verified revision
`4b475c04-b573-4cc1-9d86-1c81b65f4060`, accepted at
`2026-10-26T01:43:40.527Z`, is the retained preservation target. Independent before
and final checks match its SQL installed/verified/known-good identity, physical
journal, protected artifact and loaded runtime. The unmanaged digest remains
`ab5af92b12e47751c9e48e3540e0029ae72d93e337d1db1bef6cec5810abce01`.
No active operation, pending physical intent or active channels remain. The initial
baseline `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7` remains retained; cleanup did not
restore over the operator's newer revision. The final supervised helper refresh
loaded current code and preserved Asterisk PID/start identity; the same independent
baseline check passed after refresh.

Native/SQL, HTTP/Redis and HTTPS fixtures removed their exact owned containers,
databases, socket/directory fixtures and browser processes. Full inventory/provider
cleanup accounted for 26 generations (25 destroyed, one absent), then two browser
generations (both destroyed); both exact temporary provider tokens were revoked and
their files removed. Policy metadata is retained without tokens. The controlled
PBX fixture restored original configuration/resource inventory and running state,
removed owned fixtures and released its lock. Unrelated retained data, credentials,
backup failure and operational history remain preserved. Acceptance cleanup does
not establish production rollback or joint-store backup/restore readiness.

## Repairs and limits

The fault checks exposed a recovery-chain gap: a failed explicit reconciliation
could become the canonical predecessor while an older apply remained physically
pending. The native owner now validates immutable predecessor ancestry oldest first
(maximum 128 within its deadline), checks actual pending identity, and uses the
current explicitly authorized recovery after quiet waits and before effects/barrier
opening. Final affirmative proof atomically audits and resolves all unknown/failed
ancestors. Candidate apply is never blindly replayed; uncertainty retains pins and
denial. Actual canonical revocation after the quiet check and subsequent authorized
chain recovery pass against native Asterisk and PostgreSQL.

The actual scoped SQL connection-loss regression terminates its executor's SQL
connection and waits for the canonical result: socket acknowledgement means queued,
not completed. Physical receipts then reconcile exact identity without reloading.
The added concurrent resource tests prove one serialized outcome: acceptance pins
and blocks mutation, or mutation invalidates the reviewed revision before effects.

Observation fixtures previously assumed empty PBX inventory and human CLI identities
that never truncate. They now qualify complete authenticated AMI facts against the
trusted CLI baseline, reject ambiguous/missing/extra/duplicate identities, retain
full identities and compare exact starting inventory after cleanup. Installed
resources are preserved. The new seven-contract guard and full PBX/inventory suites
pass. The generic auth fixture restores focus/session revalidation after its second
browser, fixing an unsent logout assertion without changing application auth.

Earlier attempts remain historical: concurrent routing stopped during sign-in
transport before routing assertions; serial routing passed. PBX retries exposed the
empty/truncated baseline assumptions above. Editing the shell launcher while a prior
run was still reading it invalidated that attempt; the stable full focused run used
a fixed launcher and exited 0. The final added race fixture initially omitted
required pattern lengths and failed input validation before acceptance; its corrected
real native/SQL run passed. These failures are not counted as acceptance successes.

Boundary limits remain explicit: consumer cancellation around real GET-only provider
reads and probe outages are injected, not OS/provider crashes. Native loss is actual
abrupt process exit; SQL insertion faults are transaction injection. Exact versions
1/2 use actual retained provider reads, with no secret output or provider token in
HTTP/Next/Asterisk. Eleven bounded sequential synthetic calls (at most two legs,
no public traffic) exercise approved activity/routing policy. No tenant bindings,
tenant calling readiness or authenticated operational attribution are delivered.

## Operator and downstream handoff

Use the [operator guide](../runbooks/pbx-revisions.md) for initial baseline setup,
desired/installed/verified distinctions, exact retry versus new intent, activity
policy, unknown/failed-recovery reconciliation and conservative dependency retention.
The [architecture contract](../architecture/pbx-revisions.md) describes external
fencing, atomic artifacts, operation ordering, protected exact-version consumption
and the dependency ports.

P4-U2 receives immutable verified revision/resource provenance and actual retained
resource/material dependency facts; it must implement trusted allocation/binding and
shared-trunk eligibility. P4-U3 owns tenant readiness/activation. P5-U3 must preserve
internal route/version identities and authenticate real ingress before attribution.
Successful development probes or editable caller/label data do not supply those
boundaries. Production security/HA/backup and operational launch remain later work.
