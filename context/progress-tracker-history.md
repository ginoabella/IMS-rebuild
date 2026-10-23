# Progress Tracker History

This file preserves historical checkpoints, completed-unit details and superseded
updates. [progress-tracker.md](progress-tracker.md) is authoritative for current
delivery state. Historical statements such as “running”, “pending” or “incomplete”
describe their checkpoint and may have been superseded by later verified results.
Decisions remain owned by their linked contracts/reviews; history is not approval.

## Archive index

- [2026-10-20 — Named custodian capability checkpoint closed](#2026-10-20--named-custodian-capability-checkpoint-closed): intermediate handoff/session checkpoints; final bounded verification owner-accepted with cleanup confirmed.
- [2026-10-15 — P3-U2a delivery and superseded checkpoints](#2026-10-15--p3-u2a-delivery-and-superseded-checkpoints): P3-U1 final checkpoint, a implementation checkpoints and prior planning notes.
- [2026-10-14 — Original tracker snapshot](#2026-10-14--original-tracker-snapshot): full pre-compaction tracker, including foundation/identity delivery, early draft creation, staff acceptance and P3-U1 spec preparation.

## 2026-10-14 — Original tracker snapshot

Archived 2026-10-14 (Asia/Manila, +08:00) at the user's request. The complete
pre-compaction tracker follows verbatim, preserving its original headings, dates,
links and evidence limits. Its relative links retain their original context-directory
base. P3-U1 was planned and P2-U4 was complete at this checkpoint; no implementation
status was changed by archiving. Repeated or superseded text is intentionally retained.

Original snapshot SHA-256: `12dfa06d3709adf6d13c6443993e6cb3c76ad641f8e461045eadbfebc1b7b005`.

<!-- BEGIN ORIGINAL TRACKER SNAPSHOT 2026-10-14 -->
# Progress Tracker

Completed P2-U4c and parent P2-U4 (2026-10-13 17:20 +08:00 (Asia/Manila)): C-01–09 and parent
AC-01–12 are reconciled. Final full `./dev check` exited 0 after the corrected
bounded primary-recovery read check; production browser/credential/HTTP, shared
limits/recovery, all application builds, foundation/storage/identity and client
scans passed. Focused browser and limits checks also exited 0. Reported Android
release acceptance passes protected sign-in/restart, canonical B ownership,
injected write/delete/interruption quarantine and recovery, fingerprint cancellation,
authenticated lock/unlock resume, reset/fresh replacement, normal/lost-response
logout and approved idle/original absolute expiry. Runtime/fixture retired, control
socket removed and existing t001 unchanged; backend live/ready HTTP 200.

Declared evidence limits remain: Android 16/API 36 with 2025-04-05 patch; desktop
Node 24.13.1 is outside the supported engine, while Docker uses Node 22.23.3.
Storage faults are injected around real OS calls; physically locked reads and
exact interruption timing are not claimed. Trusted fixture clock renewals are
not shipping responder operations. General activation, persistent incident drafts,
full responder operations and production readiness remain later units.

2026-10-13 (Asia/Manila +08:00) focused recovery regression passed:
`./dev exec pnpm check:session-foundation --limits` exited 0 after the bounded
post-restoration read retry correction. Shared authority, limits/capacity, outage,
retained-record recovery, revoked/rotated/stale denial, Redis restart, migrations,
diagnostics and fixture cleanup pass. Changed checker lint/format pass. The final
full `./dev check` restarted automatically and remains running; no final full pass
or unit/parent completion is claimed yet.

2026-10-13 (Asia/Manila +08:00) required full regression failed:
latest detached full check exited 1 after distributed-limit checks: post-primary-
restoration tenant HTTP expected 200 but received 503. No full pass is claimed.
The recovery fixture now permits six explicit read attempts honoring the real
503 Retry-After, asserting no protected handler work during every failed attempt,
then requiring 200 and all revoked/rotated/stale records to remain denied. This
corrects an immediate-readiness assumption without changing production retries,
connection deadlines, admission or write behavior. Focused limits/recovery rerun
is started, followed automatically by the full Docker check only if it passes.
Fixture retirement and reported native evidence remain valid; c/parent incomplete.

2026-10-13 (Asia/Manila +08:00) acceptance fixture cleanup passed:
private A/B runtime stopped and its owner-only control socket is absent. Exact
fixture tenant was retired through the audited authority mutation; retained
fixture sessions cannot regain canonical admission. Utility verified existing
t001 tenant/staff status and authority versions unchanged. Original staff/browser
composition remains available; the temporary 3445 SSH target is no longer live.
Native device evidence is reconciled with C-05–08 and parent AC-08–11, preserving
reported-device/test-injection/clock limits. Final full regression result remains
required before C-09/AC-12 and unit/parent completion.

2026-10-13 (Asia/Manila +08:00) final declared desktop environment:
Windows C:\ims, Pixel_8_API_36 / emulator-5554, Android 16/API 36, security patch
2025-04-05, Node v24.13.1 and pnpm 10.12.1. Release package
com.myims.responder.acceptance built/installed and reported native tests passed.
Desktop Node 24 lies outside the repository's supported >=22.23.3 <23 engine;
no supported-Node Windows build or broader desktop-toolchain compatibility is
claimed. Docker verification uses pinned Node 22.23.3. Scoped mkcert trust and
SSH/ADB reverse preserved the https://localhost:3444 origin. Test fingerprints
were approved/cancelled explicitly and passwords were cleared from screens.

2026-10-13 (Asia/Manila +08:00) Android absolute-expiry denial passed:
user supplied Invalid credentials or session ended. Sign in again after explicit
Check access on the session advanced past its original seven-day absolute cap.
B independently records session 401 at offset 648,000 seconds. Activity renewals
preserved the original deadline; earlier HTTP 200 history did not grant access.
Reported device matrix now covers native sign-in/restart/owner on B, reset and
fresh replacement, idle/absolute expiry, normal and lost-response logout,
injected write/delete/interruption quarantine and recovery, cancelled biometric
read and authenticated lock/unlock resume. Direct read while physically locked
and Android-generated storage failures are not claimed. Android 16/API 36 and
pnpm 10.12.1 are confirmed; separate security-patch/Node values requested.
Final full Docker regression result and evidence reconciliation remain pending.

2026-10-13 (Asia/Manila +08:00) Android absolute-expiry test prepared:
fresh post-idle sign-in shows protected token write/readback, marker cleanup,
HTTPS 200 and verified access; B confirms native.responder canonical owner.
Private control advances only the new owned session through half-idle activity
renewals, checking the original absolute deadline remains unchanged, then past
seven days (final offset 648,000 seconds). Canonical backend lookup denies it.
Android explicit Check access denial remains to be observed. Simulated trusted
operational renewals do not imply shipped responder operations or change policy.
Prior idle denial independently confirmed B session 401 at offset 86,401 seconds.

2026-10-13 (Asia/Manila +08:00) Android idle-expiry denial observed:
after advancing the runtime-owned responder session past the approved 24-hour
idle deadline, user tapped Check access and supplied Invalid credentials or
session ended. Sign in again, with protected UI hidden. Earlier HTTP 200 trace
history did not preserve authority. Fresh sign-in will prepare the independent
seven-day absolute-limit test. Final full Docker check remains running.

2026-10-13 (Asia/Manila +08:00) Android fresh credentials after reset passed:
user supplied protected token write/readback, completed pending-marker cleanup,
HTTPS session HTTP 200 and verified staff access after downloading the updated
handoff and signing in. B status confirms native.responder canonical owner.
This completes the reported retained-token reset denial and fresh replacement.
Advanced only this runtime-owned session by 86,401 seconds through the private
clock control; backend lookup now denies it at the approved 24-hour idle bound.
Android explicit revalidation of idle expiry is next; absolute expiry and full
final checks remain pending. No production or device clock/policy changed.

2026-10-13 (Asia/Manila +08:00) Android retained-token reset denial passed:
after the actual responder credential reset, user tapped Check access and supplied
Invalid credentials or session ended. Sign in again, with protected UI hidden.
Private runtime independently confirms session HTTP 401 on B. The previous HTTP
200 is earlier trace history and did not preserve authority. Fresh-password
sign-in/replacement and device idle/absolute checks remain; c/parent incomplete.

2026-10-13 (Asia/Manila +08:00) retained Android session prepared for reset:
user supplied successful protected token write/readback and HTTPS session 200;
private B status confirmed native.responder canonical owner. Ran the fixed-fixture
responder reset once through actual protected administrator issuer and recipient
browser exchange. Script passed, exit 0: old preparatory token denied on A/B,
fresh credentials verified, authentication version incremented and t001 unchanged.
Private handoff updated for native.responder. Android still retains its pre-reset
token; explicit device Check access denial and fresh-password replacement remain
to be observed. No device reset acceptance completion is claimed yet.

2026-10-13 (Asia/Manila +08:00) full-check execution interruption:
the latest foreground full Docker check ended with exit 143 during integrated
browser work; it is not a pass. The workspace remains running and reports no
OOM kill. Restarted the full required check in a detached process with owner-only
log and retained exit-status file, so desktop response turns do not interrupt
its supervision. Cause of the termination is not established. Focused browser
acceptance remains passed; c/parent completion still requires the full result.

2026-10-13 (Asia/Manila +08:00) Android lost-logout-response recovery passed:
private runtime records completed B logout HTTP 201 with response dropped, then
an explicit B retry HTTP 201. User confirms the app first showed unavailable or
uncertain access and they tapped Retry sign out and storage cleanup. Supplied
screen confirms sign-out and protected storage cleared, with marker write,
token deletion/readback and marker deletion. No false success was reported for
the missing response. Credential reset and device lifetime checks remain.

Focused production HTTPS browser regression passes, exit 0, after adding an
explicit completed-sign-out navigation wait before subsequent test input.
C-01–04/08, credential A-02/07, qualified issuer/recipient, mounted owner recovery,
uncertain logout retry and secret diagnostics pass. Final full Docker check has
passed lint/format/typecheck/build, foundation/storage/identity checks and is
running integrated session regressions. Full completion is not yet claimed.

2026-10-13 (Asia/Manila +08:00) Android independent replica B passed:
supplied screenshot shows protected token read completed, HTTPS session HTTP 200
and Staff access verified. Private runtime status independently identifies B,
native.responder and matching canonical ownership. Lost completed-logout response
is armed for the next device check. Reset, expiry and response-loss device checks
remain pending; c/parent remain incomplete.

Final integrated regression passed lifecycle, platform/draft, staff HTTP, limits,
recovery and credential API gates, then failed the staff browser login after
uncertain-logout retry with no recognized error. Full quality check is running
separately. Browser acceptance now explicitly waits for the completed sign-out
navigation before filling the new document; focused browser rerun is running.
This navigation-race hypothesis is not yet recorded as a confirmed fix.

Remaining native acceptance prepared (2026-10-13, Asia/Manila +08:00): private
A/B production HTTP runtime and owner-only replica/lost-logout/session-clock
controls implemented. Trusted TLS self-check passes all three accounts across
A/B, unchanged passive deadlines, forbidden browser/query headers, suppressed
completed logout response, revoked-token denial and explicit retry. Scoped
clock tests pass approved 24-hour idle/7-day absolute expiry, synthetic operational
renewal and real rotation without extending the cap. Actual browser issuer and
recipient reset passes for native.other; A/B old-token denial, fresh password,
version increment and unchanged t001 verified. Private handoff updated only for
native.other; native.responder unchanged. Desktop B/response-loss/reset/expiry
evidence and final combined regressions remain pending. c/parent incomplete.

Native device-lock/resume revalidation passed (2026-10-13, Asia/Manila +08:00):
following emulator lock/unlock instructions, user screenshot shows background
then active, completed protected token read, HTTPS session HTTP 200 and verified
access. User confirms MyIMS requested a fingerprint after Android unlock and it
was approved. Resume automatically revalidated; no explicit retry was needed.
This proves reported authenticated resume, not a direct read while Android was
locked. Independent B, reset, lifetime/response-loss and final acceptance checks
remain pending; P2-U4C and parent remain incomplete.

Native interrupted-write cleanup passed (2026-10-13, Asia/Manila +08:00): after
reported retained-marker restart denial, user supplied Local access cleared. No
stored session was available to revoke, with marker write, token deletion/readback
and marker deletion in the trace. This verifies local marker recovery without
claiming orphan server revocation after process loss. Device-lock/resume,
independent B, reset, lifetime/response-loss and final regressions remain open.
P2-U4C and parent remain incomplete.

Native interrupted-write restart quarantine observed (2026-10-13, Asia/Manila
+08:00): following pause-write and force-stop/relaunch instructions, user screen
shows completed protected pending-marker read, unavailable/uncertain access and
cleanup retry. No token read/session request or verified UI appears. Records
reported restart denial with the retained recovery marker; explicit cleanup is
next. Pause timing was not captured, and no orphan revocation after process loss
is claimed. Device lock, independent B, reset, lifetime/response-loss and final
checks remain pending; P2-U4C and parent remain incomplete.

Native biometric cancellation recovery passed (2026-10-13, Asia/Manila +08:00):
after failed protected token read kept access hidden, user approved explicit
cleanup and supplied Sign-out confirmed and protected storage cleared. Trace
shows marker write, token deletion/readback and marker deletion. The reported
cancelled-read/cleanup sequence is verified. Interrupted token write is next;
device lock, independent B, reset, lifetime/response-loss and final regressions
remain pending. P2-U4C and parent remain incomplete.

Native biometric cancellation blocked access (2026-10-13, Asia/Manila +08:00):
after the instructed Check access/cancel prompt sequence, user screenshot shows
read token: failed and access unavailable/uncertain with protected UI hidden.
Retry sign out and storage cleanup is offered. Records cancelled protected read
denying authority; explicit cleanup recovery is next. Interrupted write/device
lock, independent B, reset, lifetime/response-loss and final checks remain open.

Native rejected-deletion recovery restart passed (2026-10-13, Asia/Manila +08:00):
following confirmed cleanup retry, user supplied the relaunched app showing
Sign in to continue after storage reads. No verified session returned. The
reported injected delete failure, blocked UI, explicit cleanup and subsequent
restart denial sequence is verified. Cancelled biometric storage access is next;
interrupted write/locked storage, independent B, reset, lifetime/response-loss
and final regressions remain pending. P2-U4C and parent remain incomplete.

Native rejected-deletion cleanup retry passed (2026-10-13, Asia/Manila +08:00):
after the documented HTTP 201 logout/injected delete rejection, user supplied
Sign-out confirmed and protected storage cleared following explicit retry.
Trace shows pending-marker write, token deletion/readback and marker deletion.
Restart denial after this recovery is next; interruption/locked storage,
independent B, reset, lifetime/response-loss and final regressions remain pending.
P2-U4C and parent P2-U4 remain incomplete.

Native rejected-deletion quarantine observed (2026-10-13, Asia/Manila +08:00):
user screenshot shows Armed: delete, HTTPS logout HTTP 201, completed protected
pending-marker write and injected token-delete rejection. Verified UI is hidden;
Retry sign out and storage cleanup is offered. This proves the reported injected
delete failure stays blocked after confirmed server logout. Cleanup retry and
subsequent restart denial remain pending; no complete deletion recovery claim.

Native rejected-write recovery passed (2026-10-13, Asia/Manila +08:00): user
confirmed Armed: write before sign-in; resulting protected UI remained blocked
with cleanup operations in the trace. Subsequent Retry stored access now shows
Sign in to continue after marker/token reads, confirming no usable stored token
remains. This is an injected failure around actual Android protected storage,
not a spontaneous OS write failure or independently replayed orphan token.
Rejected deletion/retry is next; interruption/locked storage, independent B,
reset, lifetime/response-loss and final checks remain pending. c/parent incomplete.

Native fault attempt observation (2026-10-13, Asia/Manila +08:00): following
fault-selection instructions, user screenshot shows access unavailable/uncertain,
protected pending-marker write, token deletion/readback and marker deletion.
Protected UI remains hidden. The rolling trace no longer includes the injection
event; the user subsequently confirms Armed: write before sign-in. The observed
rejected-write attempt stayed blocked and cleaned up; explicit retry is next to
verify cleared state. P2-U4C and parent remain incomplete.

Native post-logout restart denial passed (2026-10-13, Asia/Manila +08:00): after
confirmed normal logout/cleanup, user supplied the restarted screen showing
completed storage reads and Sign in to continue, without restored verified
access. Combined with prior sign-in, retained-session restart and normal logout,
the reported Android normal path is verified. Rejected token-write recovery is
next; deletion/interruption/locked-storage, independent B, reset, lifetime/response
loss and final regressions remain pending. P2-U4C/parent remain incomplete.

Native normal logout passed (2026-10-13, Asia/Manila +08:00): following the
verified retained-session restart, user tapped Sign out and supplied the screen
Sign-out confirmed and protected storage cleared. Trace shows protected marker
write, token deletion/readback and marker deletion. This verifies the reported
normal revoke-then-clear UI path on Android. Post-logout restart denial is next;
fault/locked storage, independent B, reset, lifetime/response-loss and final
regressions remain pending. P2-U4C and parent P2-U4 remain incomplete.

Native retained-session restart passed (2026-10-13, Asia/Manila +08:00): user
provided verified sign-in immediately before the instructed force-stop/relaunch,
then a screenshot showing completed pending-marker/token reads, session HTTPS
HTTP 200 and Staff access verified. Records successful stored-token retrieval and
canonical revalidation after process restart on the declared Android emulator,
with explicit retry allowed. Normal logout/deletion and restart denial are next;
fault/locked storage, independent B, reset, lifetime/response-loss and final
regressions remain pending. P2-U4C and parent P2-U4 remain incomplete.

Restart test clarification (2026-10-13, Asia/Manila +08:00): after relaunch the
user supplied Sign in to continue with storage reads completed and no session
request. User confirms sign-out or a fault control was used between verified
access and this screenshot. This is not a clean retained-session restart test
and does not establish either restart failure or complete logout/fault acceptance.
Repeat from verified access without intervening sign-out/fault/reinstall.

Native device success checkpoint (2026-10-13, Asia/Manila +08:00): user screenshot
from the Windows Pixel_8_API_36 acceptance app shows token write/readback and
pending-marker deletion/readback completed, session HTTPS HTTP 200, and Staff
access verified. This verifies the corrected sign-in/storage/session UI path on
the declared Android emulator. Process restart, locked/cancelled storage,
logout/deletion/fault recovery, independent replica B, reset and lifetime/response
loss acceptance remain pending; P2-U4C and parent P2-U4 remain incomplete.

Native session URL correction (2026-10-13, Asia/Manila +08:00): desktop trace
shows completed secure-storage writes/verification and HTTP 403 on session GET.
All three fixture accounts pass server HTTPS checks, including native.admin.
The installed React Native whatwg-fetch Request appends a cache-busting query
for cache: no-store GET, while the native ingress intentionally rejects queries.
Transport now sends Cache-Control: no-store without the rewriting cache option;
the ingress still sends no-store responses and retains its exact-route boundary.
Actual installed-polyfill regression, lint and mobile typecheck pass. Desktop
rebuild/retest subsequently passed as recorded above; remaining native acceptance
is pending.

Native diagnostic checkpoint (2026-10-13 UTC): the desktop user reports four
approved fingerprint prompts followed by uncertain access. The adapter protects
both the token and pending marker per operation; its 15-second total deadline and
app-state transitions remain possible causes, not confirmed diagnoses. Added a
test-only bounded operation trace (storage labels, HTTP statuses and app state,
without values, headers or errors). Focused lint, staged native typecheck and
mobile port checks pass; the updated desktop trace and native acceptance remain
pending. No biometric policy or production storage behavior changed.



## Current Goal

Deliver MyIMS according to [implementation-plan.md](implementation-plan.md),
using its nine phases and numbered implementation units. The delivery plan exists;
P1-U2 is complete: workspace, app skeletons and required quality checks pass.
P1-U3 is complete: shared services, baseline migrations, typed backend
configuration and health are verified. P1-U4 is complete: shared web primitives
and distinct platform/command-center shells are verified. P1-U5a transactional audit/outbox and P1-U5b durable worker delivery are complete;
P1-U5c recovery verification/operational handoff and parent P1-U5 are complete.
P1-U6a shared storage adapter/configuration is complete with user-approved local
Garage. P1-U6b tenant-checked references/recovery and parent P1-U6 are complete:
120-second default, hard 300-second ceiling and full local acceptance verified.
P2-U1a/b/c and parent P2-U1 are complete and verified: canonical storage,
role/admission/version contracts and secure initial operator bootstrap.
P2-U2a/b/c and parent P2-U2 are complete and verified: shared lifecycle/fencing,
canonical HTTP guards, distributed admission and integrated controlled recovery.
P2-U3a/b and parent P2-U3 are complete and verified: platform HTTP/browser
access, logout and canonical-owner isolated reauthentication. Staff browser/native journeys are verified through completed P2-U4; later
operational evidence authorization and production decisions remain pending.
P4-U1a-1 is complete: the protected atomic draft registry API and durable receipt
workflow are verified; P4-U1a-2 browser delivery and parent P4-U1a acceptance
are complete. P2-U4a is complete under the approved delivery order: qualified
credential setup/reset/recovery and real issuer/recipient handoff are verified.
P2-U4b is complete: qualified staff HTTP authentication and separate HTTPS browser/mobile
transport are verified. P2-U4c and parent P2-U4 are complete: reported Android
acceptance, production browser/recovery and final full Docker regressions pass.
Phase 2 implementation units are complete; broader operational gates remain.
Protected traffic/capacity validation remains mandatory before production.
Follow the agreed [build, review, improve process](ai-workflow-rules.md#build-review-improve):
small working steps, routine choices handled by the agent, user feedback on results,
and short questions only when a feature needs a decision.
The user requested a simpler process and to start building on 2026-10-04; this
authorizes routine foundation choices, not approval of proposed product rules.


## Completed

- P2-U4b staff authentication HTTP and transport boundaries: strict qualified
  verification, shared admission, version-bound issuance, browser cookie/CSRF,
  attested mobile bearer delivery, canonical session metadata and durable logout.
  B-01–09, focused HTTP/HTTPS and lifecycle checks, relevant regressions and final
  `./dev check` passed, exit 0. Completed 2026-10-12 12:42 +08:00 (Asia/Manila); see
  [acceptance evidence](../docs/status/p2-u4b-evidence.md) and
  [transport/c handoff](../docs/architecture/staff-authentication-http.md).
  Actual command-center/native secure storage and parent acceptance remain c.

- P2-U4a qualified credential lifecycle and administrator handoff: approved
  G-01–06, durable single-use actions, qualified issuer/target state checks, atomic
  credential/version/audit replacement, shared budgets and actual HTTPS UI.
  A-01–08, focused lifecycle, all 10 existing UI tests and final `./dev check`
  passed, exit 0. Completed 2026-10-08 00:18 +08:00 (Asia/Manila); see
  [acceptance evidence](../docs/status/p2-u4a-evidence.md) and
  [handoff guide](../docs/guides/staff-credential-handoff.md). Staff issuer access
  was verified through controlled existing-session fixtures; b now supplies ordinary
  staff HTTP authentication, while actual command-center/mobile and parent acceptance remain c. Persistent recipient HTTPS configuration is an
  explicit deployment step in the runbook.

- P4-U1a-2 operator browser and parent P4-U1a: protected tenant list/create/detail,
  named bounded forwarding, canonical-owner mounted draft/attempt recovery,
  explicit original retry and stale callback fencing. API A-01–08, browser
  B-01–08/parent AC-01–11, combined/standalone selectors, all 10 UI tests and
  final `./dev check` passed, exit 0. Completed 2026-10-07 16:00 +08:00
  (Asia/Manila); see [browser/parent evidence](../docs/status/p4-u1a-2-evidence.md)
  and [operator guide](../docs/guides/draft-tenant-creation.md).
  P4-U1b, credential setup and activation remain with their later units.

- P4-U1a-1 atomic draft creation/protected registry API: canonical owner ports,
  immutable operator-scoped receipt and qualified administrator linkage,
  authority-locked same-connection creation/audit, durable replica retries and
  protected uncached list/detail. A-01–08, complete identity/bootstrap, full
  Docker graph including audit/session/platform HTTP/browser regressions and
  all five client scans passed, exit 0. Local migration and health passed.
  Completed 2026-10-07 13:50 +08:00 (Asia/Manila); see [API evidence](../docs/status/p4-u1a-1-evidence.md).
  Browser child 2 and parent acceptance are now complete; credentials, activation
  and PBX remain with their owning units.

- DEV-PLATFORM-HTTPS implementation and automated verification: approved private
  SSH/HTTPS console, retained private CA/TLS/authentication material, exact
  origin/proxy configuration, lifecycle commands and Windows/macOS trust runbook.
  Real-stack security/browser and restart/preservation checks passed; existing
  operator and shared containers/data retained. User confirmed working Windows
  access/sign-in on 2026-10-07; macOS and explicit refresh/logout checks remain
  unconfirmed. See
  [evidence and handoff limits](../docs/status/platform-development-https-evidence.md).

- P2-U3b browser access/isolated reauthentication and parent P2-U3: real HTTPS
  Next/Nest composition, protected console, cookie/CSRF proxy, keyboard sign-in,
  confirmed/retryable cross-replica logout and same-owner in-memory work recovery.
  Protected dialogs hide/release focus; foreign-owner shell/work state clears.
  B-01–08, A-01–09, parent AC-01–11, complete session/full Docker checks,
  nine normal UI regressions and all five client scans passed, exit 0.
  Completed 2026-10-07 09:11 +08:00 (Asia/Manila); see [combined evidence](../docs/status/p2-u3b-evidence.md).

- P2-U3a platform authentication HTTP boundary: real tenantless credentials,
  bounded typed verifier, shared pre-verification limits, canonical version-bound
  web issuance, declared Secure cookie consumers, trusted proxy/Origin and
  context-bound CSRF, passive current-session/logout and cross-replica durable
  single-session revocation. A-01–09, focused HTTP/HTTPS Chromium, identity/
  bootstrap/session regressions and full Docker checks passed. See
  [a evidence](../docs/status/p2-u3a-evidence.md). b and parent are subsequently complete.

- P2-U2c distributed admission/integrated recovery and parent P2-U2: approved
  independent source/identity limits, bounded expiring atomic Redis registries,
  trusted proxy extraction, protected 429/503 and new-operation reconnection without
  write replay. C-01–07, all a/b regressions, parent AC-01–11, complete focused and
  full Docker checks passed. See [combined evidence](../docs/status/p2-u2c-evidence.md).
  Production realistic traffic/capacity review and U3/U4/Phase 2 transport remain.

- P2-U2b canonical HTTP authority and guards: current primary canonical versions,
  frozen plane-qualified principals/approved grants, explicit global route policy,
  safe 401/403/503, post-success conditional renewal and typed transactional owner
  locks. B-01–07, real two-HTTP-replica authority/lifecycle checks and full Docker
  checks passed. See [b evidence](../docs/status/p2-u2b-evidence.md).
  c and parent are subsequently complete; browser/mobile sign-in remain U3/U4.

- P2-U2a shared session lifecycle and durable recovery fencing: approved web
  60-minute/12-hour and mobile 24-hour/7-day policy, qualifying activity only,
  fixed absolute deadline through rotation, audited PostgreSQL generation/
  revocation fencing, bounded Redis scripts/configuration/maintenance and
  independent-process real-service expiry/race/uncertain-write/stale-restore
  checks. A-01–07, final focused and full Docker checks passed. See
  [lifecycle evidence](../docs/status/p2-u2a-evidence.md). c and parent are subsequently complete.

- P2-U1c secure initial operator bootstrap and parent P2-U1: approved scoped
  D-05 policy, protected input/private hashing, atomic system audit/provenance,
  independent process races and durable interruption/commit-response-loss recovery;
  C-01–08, parent AC-01–11 and full Docker checks passed. See
  [integrated evidence](../docs/status/p2-u1c-evidence.md).

- P2-U1b approved role bundles and creator-closure grant, canonical plane-specific
  admission snapshots, isolated credential ports and atomic authority-version/audit
  mutations: B-01–07, focused real-PostgreSQL a/b checks and full Docker checks
  passed. See [P2-U1b evidence](../docs/status/p2-u1b-evidence.md).

- P2-U1a canonical identity stores and ownership constraints: approved D-05
  storage states, tenant/staff/operator separation, immutable ownership, audited
  qualified repositories and runtime grants; focused real-PostgreSQL and full
  Docker checks passed. See [P2-U1a evidence](../docs/status/p2-u1a-evidence.md).

- P1-U6b and parent P1-U6 tenant-checked GET references and recovery: canonical
  ownership/permission ports, 120-second default/hard 300-second ceiling, real
  Garage expiry/tampering and integrated outage/restart matrix; focused and full
  Docker checks passed. See [P1-U6b evidence](../docs/status/p1-u6b-evidence.md).

- P1-U6a private Garage provider, bounded shared adapter, optional configuration,
  trusted provisioning and same-identity recovery: real-provider independent
  process, restart/outage, privilege and client-sentinel checks plus full Docker
  checks passed. See [P1-U6a evidence](../docs/status/p1-u6a-evidence.md).

- P1-U5c and parent P1-U5 recovery/operational handoff: integrated real-PostgreSQL
  process/outage/drain matrix, focused command, CI wiring and full Docker checks
  passed. See [P1-U5c evidence](../docs/status/p1-u5c-evidence.md).

- P1-U5b durable pg-boss workers, atomic queue handoff, idempotent sample delivery,
  bounded retries and retained outcomes; focused PostgreSQL and full Docker checks
  passed. See [P1-U5b evidence](../docs/status/p1-u5b-evidence.md).

- P1-U5a transactional audit/outbox, trusted attribution, append-only runtime
  protections and safe logging; focused PostgreSQL and full Docker checks passed.
  See [P1-U5a evidence](../docs/status/p1-u5a-evidence.md).

- P1-U4 shared theme, accessible primitives and platform/command-center shells;
  all 12 production browser checks and full workspace/foundation checks passed.
  See [P1-U4 evidence](../docs/status/p1-u4-evidence.md).

- P1-U2 workspace and quality checks; detailed evidence and limitations are recorded
  in its checkpoint below and `docs/status/p1-u2-evidence.md`.

- P1-U3 shared services, baseline migration, typed configuration and backend
  health; complete Docker checks and acceptance rehearsal passed. See
  `docs/status/p1-u3-evidence.md` and its checkpoint below.

- Created the implementation plan from the project overview and required context.
  Each unit defines its goal, scope, dependencies, result/acceptance criteria, and
  verification. The plan maps all ten overview success criteria to delivery units.
  This is documentation completion only, not completion of application units.


## In Progress

None. P2-U4c and parent P2-U4 are complete. See the
[final acceptance evidence](../docs/status/p2-u4c-evidence.md) for commands,
reported Android results, cleanup and declared limitations. Phase 3 follows the
approved delivery order; no Phase 3 unit has been started.

## Unit Checkpoints

### P2-U4 — Tenant staff sign-in and credential lifecycle

- **Status:** complete; all children and AC-01–12 verified 2026-10-13 17:20 +08:00 (Asia/Manila). G-01–06 remain approved.
- **Requirement/scope:** [feature spec](feature-specs/p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md); qualified setup/reset/recovery, initial-admin handoff, staff authentication, secure browser/mobile consumers and isolated expiry recovery.
- **Dependencies:** completed P2-U1/U2, P1-U4/U5 and P4-U1a; reuse verified P2-U3 transport/verifier patterns. Scoped D-05/D-06 setup/reset/recovery policies are now approved through the credential review.
- **Acceptance/checks:** AC-01–12 pass real PostgreSQL/Redis, independent production HTTP replicas, production Next HTTPS and reported Android SecureStore/transport checks. Final `./dev check` and focused browser/recovery regressions pass, exit 0; see [reconciliation](../docs/status/p2-u4c-evidence.md).
- **Review/split:** adopted 2026-10-07 (Asia/Manila, +08:00); a/b/c are complete under approved G-01–06.
- **Remaining:** none within P2-U4. General activation/PBX/staff management remain later units; ordinary draft admission stays denied.
- **Verification:** child a A-01–08 and b B-01–09, focused HTTP/lifecycle and complete relevant foundation/audit/identity/session/platform/draft regressions pass; actual parent command-center/native acceptance and Phase 2 completion are not claimed.


### P2-U4a — Qualified credential lifecycle and administrator handoff

- **Status:** complete; A-01–08 verified 2026-10-08 00:18 +08:00 (Asia/Manila). Resumed after user approval on 2026-10-07.
- **Requirement/scope:** [child spec](feature-specs/p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md); Capability schema/authorization/exchange, atomic credential/version/audit, real operator/recipient UI and qualified draft handoff; A-01–08.
- **Dependencies:** Verified foundations/P4-U1a and G-01–06 approval before dependent implementation.
- **Required verification:** Established `./dev exec pnpm check:staff-auth --api` and `--lifecycle`, actual two-replica/runtime-service/browser acceptance and final `./dev check`.
- **Preparation:** read required context, parent/child specs and existing canonical authority, transaction, provenance, credential mutation and session/limiter interfaces. Created the requested [credential contract review](../docs/planning/p2-u4a-credential-contract-review.md) with concrete sections 1–6, issuer/state matrix, handoff procedure, budgets/retention and proposed implementation contracts. Sections 1–6 are now user-approved.
- **Approval:** user approved review sections 1–6; recorded scoped D-05/D-06 and synchronized parent/child before runtime changes.
- **Implementation checkpoint:** feature-owned action migration/runtime grants, immutable metadata and retention, narrow tenancy/provenance/management-binding ports, tenant-first staff mutation locks, atomic credential/version/audit replacement and shared source/issuer/target budgets are implemented. Separate exchange/staff browser boundaries and bounded named forwarding serve real operator/recipient UI and existing-session staff issuer UI. Mounted owner recovery, uncertainty, page-hide/target-change secret clearing and late callback fencing are verified.
- **Verification:** A-01–08; `./dev exec pnpm check:staff-auth --lifecycle`, all 10 `check:ui` regressions and final `./dev check` passed, exit 0, including real-service A/B races, rollback/interruption/COMMIT loss, stale Redis restoration, HTTPS/Axe/reflow, six configuration tests and all five client scans. [Acceptance evidence](../docs/status/p2-u4a-evidence.md) records results and limits. Documentation links/whitespace pass.
- **Remaining:** none within a. b ordinary staff HTTP sign-in/logout is complete; c delivers actual command-center/native access and parent acceptance. Persistent recipient HTTPS configuration is documented in the runbook; automated checks own temporary real origins.

### P2-U4b — Staff authentication HTTP and transport boundaries

- **Status:** complete; B-01–09 verified 2026-10-12 12:42 +08:00 (Asia/Manila); started 2026-10-12.
- **Requirement/scope:** [child spec](feature-specs/p2-u4b-staff-authentication-http-and-transport-boundaries.md); Canonical staff verification/issuance, shared limits, cookie/CSRF and mobile bearer HTTP, current-session/logout and safe failures; B-01–09.
- **Dependencies:** Verified P2-U4a and parent foundations.
- **Required verification:** Established `./dev exec pnpm check:staff-auth --http`, real independent A/B HTTP and HTTPS Chromium/native probes, a lifecycle and relevant regressions, plus final `./dev check`.
- **Implementation checkpoint:** strict tenant-qualified sign-in/private verifier integration, separate browser-cookie/mobile-bearer adapters, passive canonical metadata/logout, trusted native ingress classification and shared durable enforcement are implemented. Named routes, CSRF/proxy/source/error/lifecycle and secure-storage outcomes are documented in [transport/c handoff](../docs/architecture/staff-authentication-http.md).
- **Verification:** B-01–09; focused `check:staff-auth --http` and `--lifecycle`, `check:draft-tenant --browser`, `check:session-foundation --lifecycle` and `--limits`, and final `./dev check` passed, exit 0. Real qualified a credentials, shared budgets, proof/authority races, reset/stale restoration, dependency/write/response loss, web/mobile expiry/renewal/rotation, production A/B HTTPS Chromium cookies and native bearer transport pass. Full foundation/audit/worker/storage/identity/bootstrap/session/platform/draft/credential regressions, six configuration tests and all five client scans pass. Existing browser probes now settle navigation before fault injection; Redis startup/restart fixtures wait for command readiness. [Evidence](../docs/status/p2-u4b-evidence.md) records results, browser prerequisites and limits.
- **Remaining:** none within b. completed c provides actual command-center/issuer integration, reported native secure storage, owner-isolated recovery and full parent acceptance. Parent P2-U4 is complete.

### P2-U4c — Command-center and mobile access with isolated recovery

- **Status:** complete; C-01–09 and parent AC-01–12 verified 2026-10-13 17:20 +08:00 (Asia/Manila).
- **Requirement/scope:** [child spec](feature-specs/p2-u4c-command-center-and-mobile-access-with-isolated-recovery.md); Actual protected command center, real staff issuer integration, minimal native secure-storage consumer, owner-isolated expiry recovery and full parent matrix; C-01–09.
- **Dependencies:** Verified P2-U4a/b; declared HTTPS/native storage configuration and device access.
- **Required verification:** focused browser/mobile-port/limits and final full Docker graph pass, exit 0. All 11 shared UI checks and reported Android release-app acceptance pass within the declared boundaries; see [final evidence and parent reconciliation](../docs/status/p2-u4c-evidence.md).
- **Implementation checkpoint:** production browser/native consumers, owner/epoch recovery, bounded HTTPS transport and authenticated SecureStore marker quarantine/revocation/cleanup delivered. Native compatibility fixes, finite secret-free acceptance traces, private A/B/response-loss/clock controls and issuer/recipient fixture reset tooling verified. Guides/runbooks/index synchronized; exact fixture retired and t001 unchanged.
- **Active fixture checkpoint:** `scripts/prepare-staff-native-fixture.mjs` prepares only the known Docker development database/ingress, audited fixture creation/status, real responder credential-action issue/exchange, owner-only handoff, HTTPS sign-in/session/logout and canonical retirement. Prepare/check pass; duplicate preparation safely denies; secret file Git exclusion and 0700/0600 permissions pass. Existing t001 and staff authority versions remain unchanged. The control administrator is seeded test data; the fixture utility alone does not establish general P4-U3 activation or native evidence. Reported native acceptance is separately verified above.
- **Remaining/resume:** none within c. Reported device acceptance is complete on Windows/Android 16/API 36; fixture is retired. The runbook retains reproducible checks and the evidence records unsupported desktop Node 24, injected-fault, clock, interruption-timing and physically-locked-read limits. Later activation, persistent incident drafts, responder operations and production verification remain.



### P4-U1a — Draft tenant creation and initial administrator

- **Status:** complete; both children and parent acceptance verified 2026-10-07 16:00 +08:00 (Asia/Manila).
- **Requirement/scope:** [feature spec](feature-specs/p4-u1a-draft-tenant-creation-and-initial-administrator.md); protected list/create/detail, atomic draft tenant and unset first administrator, platform audit and durable retry recovery.
- **Dependencies:** completed P2-U1/U2/U3 and P1-U4/U5; no P2-U4 or Phase 3 prerequisite under the approved delivery-order exception.
- **Acceptance/checks:** AC-01–11, child 1 A-01–08 and child 2 B-01–08 passed. API/browser/combined `check:draft-tenant` selectors, all 10 production UI/safe-return tests and final `./dev check` passed, exit 0. Real PostgreSQL/runtime grants, Redis, two HTTP replicas and production Next HTTPS establish the declared local boundary.
- **Review/split:** adopted 2026-10-07 (Asia/Manila, +08:00); [API/database child](feature-specs/p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md) and [browser/integrated child](feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md) are complete. Scoped staff integration preserves one connection, actor/correlation and poison while retaining existing consumers.
- **Remaining:** none within P4-U1a. Credential setup remains P2-U4/P4-U1b; activation remains P4-U3. Draft staff admission remains denied; P4-U1 and Phase 2 remain incomplete.
- **Verification:** [child 1 evidence](../docs/status/p4-u1a-1-evidence.md) and [browser/complete parent evidence](../docs/status/p4-u1a-2-evidence.md) map every criterion, actual fault boundaries, commands/results, cleanup and limitations.

### P4-U1a-1 — Atomic draft creation and protected registry API

- **Status:** complete; verified 2026-10-07 13:50 +08:00 (Asia/Manila).
- **Requirement/scope:** [child spec](feature-specs/p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md); owned create/read ports, protected API, same-connection target integration, durable receipt, transactional audit and admission denial.
- **Dependencies:** completed P2-U1/U2/U3 and P1-U4/U5; recheck their evidence before starting.
- **Acceptance/checks:** A-01–08 cover parent AC-01–08/10/11 at the backend boundary and session regressions. Final `./dev exec pnpm check:draft-tenant --api`, complete `check:identity-foundation` and `./dev check` passed, exit 0. The full graph includes existing audit/outbox, platform HTTP/HTTPS browser, session/admission/recovery and all five client scans.
- **Delivered:** protected POST/GET `/platform/tenants` and GET `/platform/tenants/:tenantId`; canonical owner creation/reads, strict bounded normalization, operator/request fingerprint receipts, qualified immutable linkage, one authority-locked creation commit and both owner audit facts. Expiring staff target handles share connection/poison and unfinished scopes prevent commit; only the canonical code constraint yields code conflict. Read pagination defaults to 25/max 100 with UUID keysets. Reads are passive; create is operational.
- **Evidence:** [acceptance/commands/limits](../docs/status/p4-u1a-1-evidence.md) and [API/DTO/receipt/migration/handoff contract](../docs/architecture/draft-tenant-registry-api.md). Local additive deployment and live/ready 200 passed. The initial full check found one stale identity migration count; corrected to eight, focused reruns and final full graph passed.
- **Remaining/handoff:** no child 1 work remains. Child 2 delivered declared Next forwarding, owner-bound browser form/list/detail and combined parent verification. P4-U1a is complete; P4-U1 and the staff gate remain incomplete.

### P4-U1a-2 — Operator browser creation and integrated handoff

- **Status:** complete; verified 2026-10-07 16:00 +08:00 (Asia/Manila).
- **Requirement/scope:** [child spec](feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md); protected tenant list/form/detail, explicit forwarding, owner-bound attempt recovery and complete parent acceptance.
- **Dependencies:** verified P4-U1a-1 and delivered P2-U3b/P1-U4 browser/UI foundation.
- **Acceptance/checks:** B-01–08, child 1 A-01–08 and parent AC-01–11 passed. Final API, standalone browser and combined selectors, all 10 production UI/safe-return tests and full `./dev check` passed, exit 0. Full graph includes audit/outbox/worker recovery, storage, identity/bootstrap, HTTP/browser/session/limiter regressions and all five client scans.
- **Delivered:** tenant list/create/detail, bounded protected forwarding, literal safe returns and typed canonical-owner draft/attempt memory with explicit retry and stale callback fencing. [Operator guide](../docs/guides/draft-tenant-creation.md), [browser contract](../docs/architecture/draft-tenant-browser.md) and [acceptance/commands/limits evidence](../docs/status/p4-u1a-2-evidence.md) are complete.
- **Remaining/handoff:** none within this child or P4-U1a. Mounted unfinished work survives same-owner recovery and client navigation; refresh/process loss may discard it. Saved canonical tenants/admin IDs are durable. Credential setup, later onboarding and activation stay with P2-U4/P4-U1b/P4-U3; P4-U1 and Phase 2 remain incomplete.

### DEV-PLATFORM-HTTPS — Private development console access

- **Status:** implementation and automated verification complete;
  2026-10-07 10:20 +08:00 (Asia/Manila). User subsequently confirmed working Windows
  access/sign-in; macOS and explicit refresh/logout checklist confirmation remain
  pending.
- **Scope/approval:** user approved private `https://localhost:3443` through SSH to
  server loopback 3101, retained existing data/shared services/operator and no
  public console or disposable authentication environment. See the
  [approved decision](../docs/planning/platform-development-https-access.md).
- **Implemented:** Docker workspace HTTPS ingress, private normal Next/Nest
  processes, persistent owner-only CA/TLS/authentication secrets, exact origin and
  proxy peers, publication guard, prepare/start/status/stop/check commands and
  Windows/macOS trust instructions.
- **Verification:** final `./dev platform-https-check` passed, exit 0, including
  real CA/hostname checks, cookie/CSRF/session denial, request/source rejection,
  cross-container private-listener isolation, normal browser presentation and
  client secret/fixture exclusion. Host loopback TLS CSRF probe returned 200.
  Stop/restart retained original operator, shared credentials and all private
  material; normal backend/UI/Next builds, scoped ESLint, shell syntax, formatting,
  Compose/docs-link and whitespace checks passed.
- **Handoff:** [server/Windows/macOS runbook](../docs/runbooks/platform-development-https.md)
  and [evidence/limits](../docs/status/platform-development-https-evidence.md).
  Test-started console stopped; existing seven development containers retained
  and shared services healthy. No migration, bootstrap or fixture provisioning
  ran. P2-U3 stays complete; U4/production remain planned.

### P2-U3 — Platform operator sign-in

- **Status:** complete; 2026-10-07 09:11 +08:00 (Asia/Manila).
- **Requirement/scope:** [feature spec](feature-specs/p2-u3-platform-operator-sign-in.md); tenantless credential verification, cookie/CSRF HTTP boundary, protected console, logout and identity-isolated expiry/reauthentication.
- **Acceptance/checks:** A-01–09, B-01–08 and parent AC-01–11 passed. Focused browser, combined platform, complete session and final full Docker commands passed, exit 0; latest full run reran the complete parent/session matrix.
- **Split:** adopted 2026-10-06; sequential [a HTTP boundary](feature-specs/p2-u3a-platform-authentication-http-boundary.md) and [b browser access/reauthentication](feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md), both complete and verified.
- **Dependencies:** complete P2-U1/U2 and P1-U4; existing Nest authority and approved lifetime/limiter policies preserved.
- **Remaining:** none within this unit. Phase 2 staff/mobile journeys and production infrastructure/traffic gates remain pending.
- **Verification/handoff:** [combined evidence](../docs/status/p2-u3b-evidence.md) maps every parent criterion, exact commands and limits; [operator guide](../docs/guides/platform-operator-access.md), [browser contract](../docs/architecture/platform-browser-access.md) and [runbook](../docs/runbooks/platform-authentication.md) record bootstrap/ingress prerequisites, recovery and future form integration.


### P2-U3a — Platform authentication HTTP boundary

- **Status:** complete; 2026-10-06 14:02 +08:00 (Asia/Manila).
- **Requirement/scope:** [a spec](feature-specs/p2-u3a-platform-authentication-http-boundary.md); credential verification, shared sign-in/session/logout, explicit cookie channel, CSRF and origin/source contract.
- **Dependencies:** verified P2-U1/U2 and P1-U4; recheck evidence before implementation.
- **Acceptance/checks:** A-01–09; `./dev exec pnpm check:platform-auth --http` includes A/B production adapters and HTTPS Chromium probe; identity/session regressions and `./dev check` are required.
- **Implemented:** named backend sign-in/current-session/logout, bounded typed verifier, explicit cookie consumers and shared-secret/context-bound CSRF transport. Contract: [HTTP boundary](../docs/architecture/platform-authentication-http.md).
- **Handoff:** tested endpoints, safe session/error DTOs, exact proxy/origin/source/CSRF requirements, logout retry procedure and real-service fixtures documented in [contract](../docs/architecture/platform-authentication-http.md), [runbook](../docs/runbooks/platform-authentication.md) and [evidence](../docs/status/p2-u3a-evidence.md). Console/proxy/reauthentication is subsequently delivered and verified in b; deployment origin/proxy/TLS and production traffic/capacity are prerequisites.
- **Verification:** A-01–09 passed; final focused `./dev exec pnpm check:platform-auth --http` and complete `./dev check` passed, exit 0, including identity/bootstrap, all session/admission/recovery, production module wiring, HTTPS Chromium and all five client scans. Links/format/launcher/whitespace and precise fixture teardown verified.

### P2-U3b — Platform browser access and isolated reauthentication

- **Status:** complete; 2026-10-07 09:11 +08:00 (Asia/Manila); started 2026-10-06 (Asia/Manila, +08:00).
- **Requirement/scope:** [b spec](feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md); protected browser console/sign-in/logout, narrow transport, same-operator unfinished-work recovery and complete parent acceptance.
- **Dependencies:** verified P2-U3a A-01–09 and P1-U4 shared primitives.
- **Implemented:** backend-validated dynamic server layout; exact trusted-ingress cookie/CSRF proxy; distinct accessible sign-in and safe returns; confirmed/retryable logout; expiry/outage hiding; coalesced canonical restoration reads and rendered-owner callback guards. Mounted non-secret work resumes only for its canonical owner; identity switch/confirmed logout clears work and shell state. Protected portal scope hides dialogs/menus and releases focus traps. Build-selected TypeScript paths exclude the verification form from shipping output while including it in the isolated test build.
- **Acceptance/checks:** B-01–08, a's A-01–09 and parent AC-01–11 passed. Focused browser/default platform/complete session commands passed; final `./dev check` reran all HTTP/browser/admission/lifecycle/recovery checks and passed, exit 0. Final normal UI suite passed all nine checks. All five built-client scans, links, format, launcher syntax, whitespace and precise fixture cleanup passed.
- **Remaining:** none within b. Retention is in memory during the mounted journey; refresh/process loss and durable incident drafts remain P5-U4. Staff/mobile and production TLS/HA/capacity gates remain pending.
- **Handoff:** [evidence](../docs/status/p2-u3b-evidence.md), [operator guide](../docs/guides/platform-operator-access.md), [browser/form contract](../docs/architecture/platform-browser-access.md) and [runbook](../docs/runbooks/platform-authentication.md). Phase 3 receives protected composition/current canonical owner; P2-U4 receives reusable cookie/CSRF patterns without staff authority or policy approval.

### P2-U2 — Shared session store and authorization guards

- **Status:** complete; 2026-10-06 11:12 +08:00 (Asia/Manila).
- **Requirement:** [parent specification](feature-specs/p2-u2-shared-session-store-and-authorization-guards.md); AC-01–11.
- **Implemented:** a shared lifecycle/durable recovery fences, b canonical HTTP
  authority/transaction guards and c approved distributed admission plus integrated
  failure/recovery. All three sequential children are complete.
- **Approval:** scoped lifetimes/activity/selective fencing and c limiter policy
  are approved. The protected 120/minute default and 8,192-counter ceiling retain
  mandatory realistic traffic/combined memory validation before production.
- **Verification:** complete focused `./dev exec pnpm check:session-foundation`
  and `./dev check` passed, exit 0, using actual Redis/PostgreSQL/runtime grants
  and independent HTTP processes. [Central evidence](../docs/status/p2-u2c-evidence.md)
  maps every parent AC to c's checks and [a proof](../docs/status/p2-u2a-evidence.md)/
  [b proof](../docs/status/p2-u2b-evidence.md). Health live/ready HTTP 200; exact
  fixture cleanup, client sentinels and docs/launcher checks passed.
- **Remaining:** none within parent scope. U3 platform sign-in/logout,
  cookie/CSRF and isolated reauthentication are subsequently verified. U4 owns
  staff sign-in/credential lifecycle, mobile transport and isolated recovery.
  Production HA/TLS/joint-store rollback and Phase 2 gate remain incomplete.

### P2-U2c — Distributed rate limits and integrated recovery handoff

- **Status:** complete; 2026-10-06 11:12 +08:00 (Asia/Manila).
- **Requirement:** [c specification](feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md); C-01–07 and parent AC-01–11.
- **Approval:** [section 1](../docs/planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy)
  approved with realistic polling/operator/future mobile traffic and capacity gates.
- **Implemented:** typed pre-verification admission; independent source/identity
  fixed windows, bounded 8,192-field expiring Redis registries, hashed identities,
  validated config/proxy extraction, finite private metrics, protected 400/429/503
  and bounded new-operation reconnection without ambiguous write replay.
- **Verification:** focused `--limits`, complete default and full Docker passed,
  exit 0, including a/b regressions, barriers, ACL/OOM/response-loss/timeout, actual
  Redis restart/stale restore and interrupted primary recovery on both HTTP
  replicas. Full registry measured 876,709 bytes. Health/cleanup and docs passed;
  [evidence](../docs/status/p2-u2c-evidence.md) records corrected fixture assertions
  and exact results. Hosted CI remains unexecuted locally.
- **Handoff:** [admission contract](../docs/architecture/distributed-admission.md)
  and [integrated operations](../docs/runbooks/session-foundation.md) define U3/U4
  issuance/renew/revoke/errors, restore quarantine/fencing, private credentials,
  noeviction/capacity and mandatory production traffic review.
- **Remaining:** none within c. Excluded credential-recovery/public-intake/socket
  limiter policies, browser/device journeys and Phase 2 acceptance remain pending.

### P2-U2b — Canonical authority validation and HTTP guards

- **Status:** complete; 2026-10-06 09:48 +08:00 (Asia/Manila).
- **Requirement:** [b specification](feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md); B-01–07.
- **Implemented:** current canonical frozen principals/actor mapping, explicit
  global plane/permission guards, generic 401/403/retryable 503, post-success
  conditional renewal, typed transaction authority locks and separate two-process
  HTTP fixture graph. Public health works during dependency failure.
- **Contract:** [canonical HTTP authority](../docs/architecture/canonical-http-authority.md);
  [verification runbook](../docs/runbooks/canonical-http-authority.md).
- **Verification:** focused `./dev exec pnpm check:session-foundation --authority`
  and final `./dev check` passed, exit 0. Final combined authority/lifecycle suite
  includes post-handler renewal outage. B-01–07, a regressions, canonical identity,
  five-client leakage and required Docker checks passed. Documentation consistency,
  relative links, formatting, launcher syntax and whitespace verified. See
  [b evidence](../docs/status/p2-u2b-evidence.md).
- **Remaining:** none within b. c receives guards/principals/errors/transaction ports
  and HTTP fixtures; c/parent/limits are subsequently complete. Sign-in and
  production decisions remain incomplete. U3/U4 own credential channels and expired-work preservation.

### P2-U2a — Shared session lifecycle and recovery fencing

- **Status:** complete; 2026-10-06 08:53 +08:00 (Asia/Manila).
- **Requirement:** [a specification](feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md); A-01–07.
- **Prepared:** [scoped D-05 review and durable generation fencing design](../docs/planning/p2-u2a-session-contract-review.md).
  Section 1 is approved with web 60-minute/12-hour and mobile 24-hour/7-day idle/absolute
  lifetimes and explicit successful authorized activity, excluding passive polling.
  Section 2 chooses selective durable fencing without revoking other devices.
- **Prerequisites:** read required context, P2-U1/P1-U3 evidence and existing
  plane-qualified authority/configuration boundaries;
  `./dev exec pnpm check:identity-foundation --authority` passed, exit 0,
  including real migrations/runtime grants, version races and unavailable paths.
- **Approval:** user explicitly approved revised lifetimes/activity and durable
  fencing on 2026-10-06. Expiry/reauthentication must hand off preservation of
  unfinished incident work to P2-U3/U4. Unrelated product decisions remain pending.
- **Implemented checkpoint:** typed backend lifecycle and canonical bridge, bounded
  approved configuration, strict schema/plane records, audited durable generation
  fences with migration/grants, conditional Redis scripts and trusted runtime.
  Isolated Redis/PostgreSQL independent-process fixture and full Docker wiring
  are added; focused lifecycle suite passed, exit 0: strict issuance/records, deadline/TTL
  caps, barrier races, real response loss/OOM/timeouts, audit rollback/interruption,
  actual Redis restart and restored-record fencing. Final audited cleanup, real
  PostgreSQL COMMIT-response loss, physical TTL expiry and full Docker checks
  passed, exit 0; final lint/format/links/whitespace passed. See
  [A-01–07 evidence](../docs/status/p2-u2a-evidence.md).
  Local trusted migration and live/ready HTTP 200 passed; seven migrations,
  zero session/identity seeds and no session fixture databases remain.
- **Handoff:** b receives typed lookup/lifecycle and canonical bridge, conditional
  renewal and fencing; c receives bounded failure/restore/restart fixtures/settings.
  P2-U3/U4 must verify expiry/reauthentication with preservation and isolation of
  unfinished incident work. a alone does not establish HTTP/sign-in acceptance; b/c and parent are now
  verified separately. Sign-in and Phase 2 remain incomplete.

### P2-U2 implementation sub-units

| Unit | Status | Scope and verification |
| --- | --- | --- |
| [P2-U2a — Shared session lifecycle and recovery fencing](feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md) | complete | Lifecycle, expiry/rotation/revocation and recovery fencing; A-01–07 with real-service independent-process checks. |
| [P2-U2b — Canonical authority validation and HTTP guards](feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md) | complete | Canonical principals, plane/permission guards and transactional authority boundary; B-01–07 with two HTTP replicas after a. |
| [P2-U2c — Distributed rate limits and integrated recovery handoff](feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md) | complete | Distributed limits, integrated outage/restore checks and combined parent handoff; C-01–07 and parent AC-01–11 after a/b. |

Parent completion requires all children and AC-01–11. The split preserves
top-level plan IDs and Phase 2 order; each child includes its own checks/docs.

### P2-U1c — Secure operator bootstrap and foundation handoff

- **Status:** complete; 2026-10-05 17:04 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1c specification](feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md).
- **Scope:** protected credential input, private hashing, explicit trusted deployment
  bootstrap, durable atomic provenance and combined identity verification/handoff.
- **Approval:** user approved [review sections 1–2](../docs/planning/p2-u1c-bootstrap-contract-review.md)
  and instructed implementation to continue; scoped D-05/P1-U1 handoff recorded
  in product contracts. Later D-05 policies remain pending.
- **Implemented:** bounded hidden/file input and salted private scrypt, explicit
  `./dev bootstrap-operator`, PostgreSQL singleton provenance/serialization,
  active/ready initial versions 1/1 and atomic trusted system audit. Reruns preserve
  credentials/versions; conflicts fail; lost commit response reports uncertainty.
- **Acceptance:** C-01–08 and parent AC-01–11 passed. Prerequisite a/b recheck,
  final combined `./dev exec pnpm check:identity-foundation` and full `./dev check`
  passed, exit 0. Independent actual command races, forced audit rejection,
  precommit process/database termination, real commit-response-loss recovery,
  hidden PTY confirmation, protected-input/hash bounds and client sentinels passed.
- **Operational check:** actual Docker launcher rejects protected weak input with
  fixed invalid-input/exit 1; local stores/provenance remain empty with six migrations.
  Live/ready HTTP 200; no identity/bootstrap fixture databases remain. Documentation
  links/formatting and whitespace checked. See [evidence](../docs/status/p2-u1c-evidence.md),
  [contract](../docs/architecture/canonical-operator-bootstrap.md) and
  [runbook](../docs/runbooks/operator-bootstrap.md).
- **Review corrections:** fixed strict indexed-access/import errors and refreshed
  activity statistics within the fixture's held transaction before lock observation.
  Final focused/full runs passed; no production transaction guarantee weakened.
- **Remaining:** none within c/parent. P2-U2–U4 own sessions/guards/sign-in;
  reset/delivery/recovery/last-admin and production readiness remain gated.

### P2-U1b — Role contracts and canonical tenancy admission

- **Status:** complete; 2026-10-05 15:32 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1b specification](feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md).
- **Scope:** approved role persistence, private plane-specific authority snapshots,
  canonical admission and atomic authority-version/audit mutations.
- **Required acceptance/checks:** B-01–07; focused real-PostgreSQL checks with a regressions,
  independent connection/concurrency checks and full `./dev check`.
- **Completed:** read AGENT.md, feature spec and mandatory project context;
  inspected a's evidence, storage contract, migration, transaction handle and
  existing owner repositories. Re-ran a's real-PostgreSQL prerequisite successfully.
- **Prerequisite recheck:** `./dev exec pnpm check:identity-foundation --storage` passed,
  exit 0: fresh/rerun migrations, ownership, qualified collisions, runtime grants,
  audit/version rollback and safe unavailable/sentinel checks. This earlier
  recheck covers a; final combined verification is recorded below.
- **Approved decision:** [P2-U1b contract review](../docs/planning/p2-u1b-contract-review.md)
  sections 1–4 approved, including fixed role names/cardinality/combinations,
  permission bundles and active/ready/active-tenant admission. Creator closure
  needs no additional dispatcher role and remains subject to D-02/D-03 safeguards.
  Recorded in [product contracts](../docs/planning/p1-u1-product-contracts.md).
- **Implemented:** approved role schema/bundles and creator grant, private coherent
  primary snapshot/verifier ports, owner authority mutations, event-specific audit,
  and focused authority selection with storage regressions and client sentinels.
- **Acceptance:** B-01–07 passed. Final focused `--authority` PostgreSQL suite
  includes a regressions; full `./dev check` passed, exit 0. Final runtime source
  lint/typecheck/format and document links/whitespace passed. Local migration,
  zero identity seeds, runtime role grant, live/ready HTTP 200 and fixture teardown
  verified. See [b evidence](../docs/status/p2-u1b-evidence.md) and
  [authority handoff](../docs/architecture/canonical-authority-admission.md).
- **Review corrections:** sparse role arrays and infinite credential timestamps
  deny; restored exact fixture constraints. Updated audit/foundation migration
  count assertions to six; final full rerun passed after the initial audit count
  failure. A focused run overlapped source edits; the rebuilt final run passed.
- **Remaining:** none within b. c owns usable hashing/bootstrap; P2-U2 must reload
  canonical account/tenant status and authority versions. No password/session/
  Redis/socket/PBX or parent completion is claimed. Hosted CI not run locally.
- **Deferred:** P1-U1 remains incomplete; credential policy/bootstrap, setup/reset/
  recovery, lifecycle transitions, PBX and active-work/session effects remain later.

### P2-U1a — Canonical identity stores and ownership constraints

- **Status:** complete; 2026-10-05 14:07 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1a specification](feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md).
- **Scope:** canonical tenant/staff/operator stores, normalization, ownership,
  credential/provenance metadata, versions/grants, qualified audited repositories,
  caller-owned tenant registry port and isolated database/client checks.
- **Acceptance:** A-01–07 passed. See [evidence](../docs/status/p2-u1a-evidence.md)
  and [storage contract](../docs/architecture/canonical-identity-storage.md).
- **Scoped P1-U1 handoff:** user explicitly approved D-05 account `active`/`disabled`,
  credential `unset`/`ready` and associated storage rules for a; no state defaults.
  P1-U1 remains deferred. Roles, admission, authentication, password policy,
  setup/reset tokens, sessions and bootstrap execution remain with later units.
- **Completed:** canonical migration, immutable codes/ownership/IDs, restrictive
  tenant FK, unique namespaces, credential coherence, positive monotonic counters,
  restricted operator/bootstrap writes, plane/tenant-qualified read/write ports,
  atomic audit/stale/no-op semantics and reproducible fixture/check wiring.
- **Verification:** focused PostgreSQL command and final direct suite passed;
  full `./dev check` passed, exit 0. Local trusted migration, live/ready HTTP 200,
  zero identity seeds and no remaining identity fixture databases verified.
  Changed-document links/whitespace reviewed. Hosted CI not executed locally.
- **Remaining:** none within a. b owns role schema/admission and complete authority
  mutation rules; c owns usable password hashing and trusted bootstrap execution.
  Neither parent completion nor authentication/session acceptance is claimed.

### P1-U1 — Delivery contracts and decision gates

- **Status:** deferred by user reprioritization; draft retained, product approval pending.
- **Requirement:** implementation plan P1-U1 and overview goals 1–5.
- **Scope:** foundation agreement, proposed product contracts, acceptance matrix,
  decision register, documentation index and tracker; documentation only.
- **Acceptance:** approved role/transition/closure/eligibility/category/credential
  contracts; every unresolved decision has owner, affected units and resume
  condition; review overview coverage. See the
  [review draft](../docs/planning/p1-u1-review-draft.md).
- **Completed:** reviewable foundation scope and P1-U2 boundary; recommendations
  D-01–D-08; explicit later gates D-09–D-13; acceptance examples and overview mapping.
- **Remaining:** user approval/modifications, synchronize approved authoritative
  context and decision records, reconcile the matrix; then complete or record a
  partial handoff. P2-U1a D-05 storage and P2-U1b D-01/D-05/D-06
  role/eligibility/admission handoffs are approved; other recommendations remain pending.
- **Required checks:** documentation consistency and relative-link review, decision
  owner/unit/resume-condition coverage, all ten success criteria mapped. Runtime
  checks do not apply to this draft.
- **Verification:** source context reviewed; Python relative-file-link review passed
  across five documents, D-01–D-13 coverage and all ten overview success-criteria
  mappings passed; `git diff --check` passed. No application/PBX/device behavior verified.
- **Decision gate:** F-01/F-02 foundation agreement before P1-U2. F-03 defines the
  proposed switch if full P1-U1 contracts remain unanswered. User owns decisions.
- **Resume:** incorporate explicit review answers; dependent product units wait
  for their decision IDs. The user has authorized starting the independent P1-U2 foundation. Product
  decisions remain pending and block their dependent features.


### P1-U2 — Workspace and quality checks

- **Status:** complete.
- **Completion date:** 2026-10-04 (Asia/Manila); explicitly confirmed in the tracker at the user's request.
- **Requirement:** implementation plan P1-U2; existing architecture boundaries.
- **Scope:** five application skeletons, four shared packages, independent NestJS
  entry points, pinned pnpm/Node, strict TypeScript, lint/format/build graph, CI, docs.
- **Acceptance:** fresh frozen install; all app/package checks; web placeholder
  rendering; Android/iOS bundle generation; isolated process startup and shutdown.
- **Required checks:** `pnpm install --frozen-lockfile`, `pnpm check`, clean-copy
  rehearsal and web HTTP smoke. Native device integration belongs to later units.
- **Completed:** five apps, four packages, independent backend entry points,
  pinned dependency install, checks, CI definition, setup documentation and decision
  record. `pnpm check` passed in the workspace and a clean source-only copy after
  frozen installation. All three production web HTTP checks passed. Android and
  iOS bundle artifacts exist for both mobile apps.
- **Verification:** see [P1-U2 evidence](../docs/status/p1-u2-evidence.md) for
  commands, environment, clean-copy procedure and limitations.
- **Remaining:** none within P1-U2. CI execution and native-device/operational
  integration have not been claimed. Database/health belong to P1-U3.
- **Decisions:** user requested starting development with a simpler process.
  Follow F-01/F-02's architecture-aligned foundation with pnpm ordering; defer
  P1-U1's product rules. No application behavior is approved by that switch.

### P1-U3 — Shared services and baseline database

- **Status:** complete; 2026-10-04 16:56 +08:00 (Asia/Manila).
- **Requirement:** implementation plan P1-U3 and user request to run shared
  services, including Asterisk, in Docker without installing their runtimes locally.
- **Scope:** Compose, persistence/secrets, PostGIS baseline SQL migration with
  Prisma history, coordinated deployment, typed configuration, backend connections
  and liveness/readiness. Asterisk scope is runtime bootstrap only.
- **Acceptance:** `./dev up` starts database/backend, applies the baseline through
  deployment and waits for readiness. Invalid configuration fails clearly; HTTP
  does not migrate. No feature tables are seeded. Dependencies recover after outage.
- **Required checks:** `./dev up`, `./dev check`, `./dev health`; prior shared-service
  stop/start persistence, authentication and Redis isolation checks.
- **Completed:** four shared services, Docker workspace and separate backend;
  PostGIS migration, restricted runtime role, distinct deployment/runtime secrets,
  configuration validation and bounded dependency health checks. Full workspace
  lint/format/types/builds, entry-point/configuration checks and live foundation
  rehearsal passed. Concurrent migration, rerun, runtime privileges, fresh database,
  each dependency outage/recovery and backend restart all passed.
- **Verification:** [full P1-U3 evidence](../docs/status/p1-u3-evidence.md) and
  [shared-container evidence](../docs/status/p1-u3-shared-services-evidence.md).
  Documented startup rerun with frozen install and automatic backend readiness
  passed. Hosted CI, production HA, native devices and live PBX calls are unverified.
- **Remaining:** none within P1-U3. Domain schemas, sessions, jobs, PBX
  administration and operational features belong to their planned units.
- **Decisions:** loopback service/backend ports, separate Redis services,
  digest-pinned images and deployment-only migrations. Runtime backend mounts
  exclude migration secrets and host credential directory. Product gates remain pending.

### Docker development workspace — Approved foundation increment

- **Status:** complete; P1-U3 overall remains in progress.
- **Requirement:** user's approval to containerize the development platform and document it.
- **Scope:** pinned Node/pnpm workspace, separate dependency/cache volumes, host
  launcher, Dev Containers configuration, Docker-based CI workflow and runbook.
- **Acceptance:** develop/check without host Node/pnpm; source reloads in the web
  app; backend is reachable through its published port; service data is retained.
- **Verification:** complete `./dev check` passed in Docker, web/backend smoke and
  source reload passed, service networking/authentication and credential lifecycle
  passed. [Detailed evidence and limits](../docs/status/development-container-evidence.md).
- **Decisions:** default container web ports 3100–3102 and backend 4100; retain the
  optional host workflow; mobile device/emulator tooling remains external.

### P1-U4 — Web primitives and operations shell

- **Status:** complete; 2026-10-04 18:18 +08:00 (Asia/Manila).
- **Requirement:** implementation plan P1-U4; existing UI context and P1-U2.
- **Scope and acceptance:** [feature spec](feature-specs/p1-u4-web-primitives-and-operations-shell.md)
  defines shared theme, accessible primitives, distinct app shells and AC-01–09.
- **Delivery sequence:** user-approved P1-U4a shared theme, P1-U4b accessible
  primitives, P1-U4c app shells/final integration; all three are complete.
- **Completed:** shared tokens/local fonts, Tailwind/PostCSS pipeline, ESM UI
  exports, native controls and Radix overlays/tabs/menus, interactive previews,
  distinct app-owned navigation/homes, responsive shells, browser checks and CI wiring.
- **Required checks:** `./dev check` sequence and `./dev exec pnpm check:ui`,
  keyboard/contrast/responsive and visual review.
- **Verification:** full workspace and backend-foundation sequence passed with
  logged exit status 0 after terminal interruptions; 12 production browser checks
  passed. Desktop/tablet/narrow, 320px reflow, 200% CSS zoom, invalid-input state,
  focus and reduced-motion checks passed. Documentation links and whitespace passed.
  Commands, artifacts and limits are in [P1-U4 evidence](../docs/status/p1-u4-evidence.md).
- **Decisions:** local Fontsource assets, shared ESM/CSS exports, manual shadcn
  composition conventions, and Webpack development after a stale-route Turbopack
  panic. Use elevated error surfaces and stronger control borders for contrast.
- **Remaining:** none within P1-U4. Authentication, operational data and domain
  actions remain with their later units. Hosted CI, native device/screen-reader
  checks and production accessibility certification are unverified; deferred
  product decisions remain unapproved.

### P1-U5 — Transactional audit and durable execution

- **Status:** complete; 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Requirement:** Phase 1 P1-U5; dependency P1-U3 is complete.
- **Scope and acceptance:** [parent feature spec](feature-specs/p1-u5-transactional-audit-and-durable-execution.md)
  and its a/b/c subunits define AC-01–10.
- **Completed:** atomic sample/audit/outbox writes, trusted context, append-only
  runtime protections, coordinated pg-boss provisioning/handoff, idempotent
  delivery, bounded retries, retained results, process/database recovery and
  bounded drain; operational runbook, architecture decisions and CI integration.
- **Required checks and verification:** `./dev exec pnpm check:durability` and
  `./dev check` passed with exit status 0. Real PostgreSQL/PostGIS and independent
  workers passed the full AC-01–10 matrix. Two Docker replicas reported ready with
  no published ports and drained to exit 0; HTTP health stayed 200. See
  [integrated evidence](../docs/status/p1-u5c-evidence.md) and its retained snapshots.
- **Decisions:** pg-boss 10.4.2/schema 24, shared-transaction handoff, retained
  result/receipt ownership, safe checked-out client errors, awaited public queue
  pull/ack APIs and shared shutdown deadline; see
  [worker contract](../docs/architecture/durable-worker-delivery.md).
- **Remaining:** none within this foundation boundary. Authentication, actual
  adapters, retention/manual recovery permissions and production HA remain with
  their owning units. The isolated connection outage does not prove server crash,
  disk recovery or live PBX/SMS/storage behavior. Hosted CI execution is unverified.

### P1-U5a — Transactional audit and outbox

- **Status:** complete; 2026-10-04 19:11 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5a-transactional-audit-and-outbox.md)
  owns the detailed boundary and scoped parent acceptance criteria.
- **Completed:** explicit same-connection transaction handle; immutable trusted
  actor/target context; event-specific safe metadata/payload validation; audit write
  port and SQL repository; outbox repository; versioned constraints/indexes/grants;
  safe structured logging/correlation and disposable database fixture checks.
- **Required checks and verification:** `./dev exec pnpm check:audit-outbox` and
  `./dev check` passed with exit status 0. Real PostgreSQL commit/open-transaction
  invisibility, rollback, independent audit/outbox failures, caught-error rollback,
  attribution/SQL constraints, actual runtime INSERT and append-only/bypass denial,
  sentinel exclusion, fresh/rerun migrations and existing configuration/entry-point
  isolation checks passed. `./dev migrate` and `./dev health` passed.
  [Commands, assertions and limitations](../docs/status/p1-u5a-evidence.md).
- **Decisions:** module-owned SQL, frozen actor scope separate from target scope,
  code-owned primitive field allowlists, database timestamps, immutable outbox
  intent and separately mutable pending/accepted handoff. See the
  [write contract](../docs/architecture/transactional-audit-outbox.md).
- **Remaining:** none within P1-U5a. Authentication/domain authorization remain
  with P2/domain units. Worker delivery and integrated recovery/CI wiring are now verified in P1-U5b/c;
  parent P1-U5 is complete.

### P1-U5b — Durable worker delivery

- **Status:** complete; 2026-10-04 19:45 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5b-durable-worker-delivery.md)
  owns the detailed boundary and scoped parent acceptance criteria.
- **Completed:** pinned pg-boss 10.4.2, deployment-owned schema provisioning,
  atomic queue/outbox handoff, independent worker, retained results/receipts and
  durable sample sink. Worker settings and runtime grants are bounded.
- **Completed verification:** real PostgreSQL handoff crash barriers, two OS
  workers, restart-safe sink acknowledgement, duplicate delivery, bounded retry,
  terminal failures, scoped keys and safe logging passed. Audit/outbox regressions
  passed; two runtime-only Docker replicas reported ready with no published ports.
  Added worker contract, settings/startup/recovery runbook and safe status command.
- **Verification:** `./dev exec pnpm check:worker-delivery`,
  `./dev exec pnpm check:audit-outbox`, frozen install and `./dev check` passed
  with exit status 0. Timeout exhaustion, isolated PostgreSQL connectivity
  interruption/backoff, actor/correlation traces, sentinel exclusion and runtime
  permissions passed. Both Docker replicas drained and exited 0; HTTP remained ready.
  Scoped lint/format, documentation links and whitespace passed.
  [Commands, assertions and limitations](../docs/status/p1-u5b-evidence.md).
- **Decisions:** atomic handoff through pg-boss same-connection adapter; scoped
  tenant/work-type keys; queue owns scheduling, retained outcomes own execution
  facts; no automatic retention cleanup. See the
  [worker contract](../docs/architecture/durable-worker-delivery.md) and
  [runbook](../docs/runbooks/durable-workers.md).
- **Remaining:** none within P1-U5b. Combined recovery rehearsal, integrated
  `check:durability`/CI wiring and parent completion are now verified in P1-U5c.

### P1-U5c — Recovery verification and operational handoff

- **Status:** complete; 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5c-recovery-verification-and-operational-handoff.md)
  owns AC-07/10 and integrated confirmation of AC-01–09; a/b were reverified.
- **Completed:** focused command/foundation/CI wiring; controlled SIGKILL at
  handoff/execution/accepted sink; real PostgreSQL connectivity outage at three
  boundaries; completed/exhausted state and attribution across restart; successful
  and forced bounded drains; safe snapshots and operational owner/escalation docs.
- **Recovery fixes:** safe errors for checked-out database clients; awaited public
  pg-boss fetch/complete/fail and consumer/dispatch drain before pool close;
  shared deadline; startup queue capability checks. Preserved a/b contracts.
- **Verification:** `./dev exec pnpm check:durability` and full `./dev check` exited
  0. Final drain exited 0 in 183ms; stalled drain exited 1 at 7014ms and recovered
  with one effect/receipt. Both Docker replicas reported ready without ports,
  drained/closed connections and exited 0. HTTP live/ready stayed 200; development
  backlog was empty. Scoped lint/format, relative links and whitespace passed.
  [Evidence and limitations](../docs/status/p1-u5c-evidence.md).
- **Remaining:** none within P1-U5c. Fixture sink/local connection interruption
  does not prove production HA, PostgreSQL host/disk recovery or live adapters.
  Audit/failures remain retained; manual retry and retention policy are deferred.

### P1-U6b — Tenant-checked references and recovery verification

- **Status:** complete; 2026-10-05 10:52 +08:00 (Asia/Manila); parent P1-U6 complete.
- **Requirement:** [P1-U6b spec](feature-specs/p1-u6b-tenant-checked-references-and-recovery-verification.md);
  B-01–07 and parent AC-01–09.
- **Scope:** caller-owned ownership/permission ports, tenant-checked access,
  approved reference signing/configuration and integrated recovery verification.
- **Preparation:** read AGENT.md, required context and storage specs; inspected
  existing Garage adapter/configuration, fixtures, ADR and runbook. P1-U6a
  evidence was complete at the initial preparation checkpoint; final checks also
  reverified the adapter foundation with access integrated.
- **Verification:** B-01–07 and parent AC-01–09 passed. `./dev up`, focused storage,
  isolated storage deployment and full `./dev check` exited 0; all five client scans,
  independent reference readers, provider/process restart, runtime privileges and
  unchanged health policy passed. Final live/ready are 200. Garage expiry returns
  400; tampering returns 403. [Evidence](../docs/status/p1-u6b-evidence.md).
- **Decision:** user approved GET-only bearer references, explicit reachable host,
  expiry without immediate revocation, a 120-second default and hard 300-second
  maximum. See [storage ADR](../docs/architecture/shared-storage.md#approved-p1-u6b-access-contract).
- **Required checks:** focused `./dev exec pnpm check:storage`, deployment/client
  checks and `./dev check`; two trusted tenants, deny-before-provider ordering,
  actual provider expiry/tampering and interrupted access recovery.
- **Implementation checkpoint:** caller-owned ownership/permission ports and access
  service, explicit signing host/configuration and adapter GET signing with bounded
  byte verification exist. Trusted two-tenant, independent-process, expiry/tampering
  and access interruption checks extend the existing focused command.
- **Remaining:** none within b or parent P1-U6. P2/P8 must provide real identity,
  canonical metadata and role/session authorization; external HTTPS, production HA,
  file policy, retention and recovery remain with their owning units. Issued bearers
  remain valid until expiry; no immediate revocation, public route or schema added.

### P1-U6a — Shared storage adapter and configuration

- **Status:** complete; 2026-10-05 09:43 +08:00 (Asia/Manila).
- **Requirement and scope:** [P1-U6a spec](feature-specs/p1-u6a-shared-storage-adapter-and-configuration.md);
  private shared provider adapter, bounded operations, configuration, trusted
  provisioning, isolated checks and supporting ADR/runbook. P1-U6b and business
  artifact metadata/access workflows remain outside this unit.
- **Acceptance and required checks:** A-01–07; approved setup ADR, real-provider
  independent-process access, restart/interruption and same-identity recovery,
  private access, safe configuration/outcomes, provisioning/privileges/health;
  `./dev exec pnpm check:storage` and `./dev check` after implementation.
- **Completed preparation:** read AGENT.md, required application context and
  parent/child storage specs; inspected configuration and secret loading,
  deployment/Docker/check wiring. At the starting baseline there were no storage
  settings, provider service or adapter in the inspected boundaries.
- **Decision:** user explicitly approved Garage after reviewing the local Docker,
  private bucket, separate credentials and internal HTTP proposal. No hosted
  environment or HTTPS facility is required for this unit.
- **Implementation checkpoint:** pinned Garage 2.3.0, persistent private provider,
  trusted provisioning, separate runtime/fixture credentials, optional validated
  settings, bounded S3 adapter and safe same-identity write/read verification exist.
  Independent OS processes have empty isolated working directories; readers
  receive no artifact bytes through IPC. Actual enabled-HTTP startup/health checks, input
  validation, private access, ambiguous write and integrity-conflict recovery pass.
- **Verification:** A-01–07 passed. `./dev up`, `./dev exec pnpm check:storage`,
  `./dev storage-deployment-check`, `./dev exec pnpm check:storage-clients` and
  final `./dev check` exited 0. Full checks include existing configuration,
  entry-point, database/audit/outbox and worker recovery regressions. All five
  client builds exclude actual credential/content/configuration and SDK import
  sentinels. [Evidence and limits](../docs/status/p1-u6a-evidence.md).
- **Handoff and remaining:** none within a; typed port, approved private setup,
  safe outcomes, same-identity recovery and runbook are available to b. Garage's
  coarse bucket write/delete permission is documented; tenant access, signing,
  lifetime/revocation, production hosting/TLS/HA, backup and retention remain gated.

### P2-U1 — Canonical identities and tenancy admission

- **Status:** complete; 2026-10-05 17:04 +08:00 (Asia/Manila); a/b/c and parent acceptance verified.
- **Requirement and scope:** [P2-U1 parent spec](feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md);
  canonical stores/ownership, role contracts/admission and secure operator bootstrap.
- **Sequence:** adopted [a](feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md),
  [b](feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md) and
  [c](feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md), all complete.
- **Acceptance:** A-01–07, B-01–07, C-01–08 and parent AC-01–11 passed.
  Final complete identity command and `./dev check` passed, exit 0. Centralized
  [parent evidence](../docs/status/p2-u1c-evidence.md) maps every criterion to
  exact checks/results and limitations.
- **Handoff:** scoped a/b/c P1-U1 and D-01/D-05/D-06 decisions recorded;
  canonical plane-specific ports, eligibility/versions and private bootstrap
  credentials available to P2-U2. No authentication/session or Phase 2 gate claimed.

## P3-U1 specification checkpoint

- **Status:** planned; documentation prepared/reviewed 2026-10-14 (Asia/Manila, +08:00).
- **Requirement and scope:** [P3-U1 feature spec](feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md); protected PBX registry, secret references, independent fenced observation and platform browser inspection. AC-01–11 define required completion evidence.
- **Adopted split:** user requested the three child specs on 2026-10-14 (Asia/Manila, +08:00). Deliver a → b → c; all children and parent remain planned. Creating specs does not approve pending PBX policy or establish runtime delivery.
- **Remaining:** implementation and all runtime acceptance; controlled management access, secret resolution and observation settings under scoped D-09/G-01–03 must be established before dependent work. Later routing/reload/active-call decisions remain with their owners.
- **Verification:** documentation coverage, consistency, local links and whitespace checked; no runtime checks or live PBX completion claimed. Required future procedure is the proposed focused PBX-node matrix plus affected regressions and full Docker checks, as defined in the spec.

### P3-U1 child delivery sequence

| Unit | Status | Scope and acceptance |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | planned | Desired registry/API, target/alias validation, audit/idempotency and atomic edit handoff; A-01–07. |
| [P3-U1b — Fenced Asterisk observation and recovery](feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md) | planned | Verified a plus resolved observation gates; real read-only adapter, database epochs/leases, freshness/reconciliation and stale-owner rejection; B-01–09. |
| [P3-U1c — Operator PBX browser journey and integrated handoff](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | planned | Verified a/b; actual register/inspect/edit UI, isolated recovery and combined AC-01–11 evidence; C-01–07. |

The parent retains shared scope/gates and acceptance. Child checks remain with their
implementation boundaries; c reconciles all parent criteria before completion.
Required-check selections in the child specs are proposed until implemented.

## Next Up

Phase 3, beginning with [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) under the adopted P3-U1 a → b → c sequence,
then P4-U1b/remaining Phase 4 under the approved 2026-10-07 delivery order.
P2-U4 and a/b/c are complete; early P4-U1a and its two children are complete.
P4-U1b and general tenant activation remain planned. Draft credential setup
continues to preserve draft status and deny ordinary staff access.

P1-U1 remains deferred outside approved scoped handoffs. Phase 2 units are complete;
this checkpoint does not claim telephony, onboarding completion, operational
response journeys or production rollout.

### Planned units

P1-U1 is `deferred`; P1-U2, P1-U3 and P1-U4 are `complete`; P1-U5 and P1-U6 are `complete` (including P1-U6a/b); P2-U1 and P2-U2 are `complete` (all children complete); P2-U3 is `complete` (a/b complete); P4-U1a and both children are `complete`; P2-U4 is `complete` (a/b/c complete); other units remain `planned`. Their requirement references,
scope, acceptance criteria, dependencies, and verification are defined in the
linked plan. P1-U2 scaffolding, full P1-U3 foundation and P1-U4 web foundation have been verified.
Create a detailed per-unit checkpoint when that unit starts.

| Phase | Unit IDs | Status | Scope and acceptance reference |
| --- | --- | --- | --- |
| 1 | P1-U1, P1-U2, P1-U3, P1-U4, P1-U5, P1-U6 | P1-U1 deferred; P1-U2/P1-U3/P1-U4 complete; P1-U5/P1-U6 complete | [Runnable foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1, P2-U2, P2-U3, P2-U4 | P2-U1/P2-U2/P2-U3/P2-U4 complete | [Identities and sessions](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1, P3-U2, P3-U3, P3-U4, P3-U5 | planned | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
| 4 | P4-U1 (a/b), P4-U2, P4-U3, P4-U4, P4-U5 | U1a complete; U1b and remaining units planned | [Tenant onboarding and administration](implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration) |
| 5 | P5-U1, P5-U2, P5-U3, P5-U4, P5-U5, P5-U6, P5-U7 | planned | [Staff intake and dispatch](implementation-plan.md#phase-5--deliver-staff-intake-incident-management-and-dispatch) |
| 6 | P6-U1, P6-U2, P6-U3, P6-U4 | planned | [Responder mobile and monitoring](implementation-plan.md#phase-6--complete-responder-mobile-work-and-synchronized-monitoring) |
| 7 | P7-U1, P7-U2, P7-U3 | planned | [First-release verification](implementation-plan.md#phase-7--verify-the-complete-first-release-journey) |
| 8 | P8-U1, P8-U2, P8-U3, P8-U4, P8-U5, P8-U6, P8-U7, P8-U8, P8-U9, P8-U10, P8-U11 | planned | [Public channels and extensions](implementation-plan.md#phase-8--add-public-channels-and-operational-extensions) |
| 9 | P9-U1, P9-U2, P9-U3, P9-U4, P9-U5 | planned | [Production readiness and launch](implementation-plan.md#phase-9--prove-production-readiness-and-launch-the-new-system) |


## Open Questions

The [decision-gate table](implementation-plan.md#decisions-required-before-dependent-implementation)
identifies the required answers and affected units. Current unresolved areas are:

- Later evidence/recovery permissions, lifecycle transitions, closure safeguards, dispatch concurrency,
  responder eligibility/availability, and category/priority semantics.
- Distributed limiter policy is approved in [c review section 1](../docs/planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy);
  realistic protected traffic and combined session/limiter capacity need production validation;
  production/joint-store recovery remains pending;
  scoped session lifetimes/activity and selective durable fencing are approved.
- Credential setup/reset/recovery (including draft administrator setup),
  administrator safeguards, and tenant lifecycle
  effects on access, routes, and active work.
- Default coordinate configuration, service-area behavior, map tiles/search,
  draft ownership/conflicts, mobile targets, and foreground-location policies.
- Controlled PBX access, secret management, routing semantics, validation/reload
  commands, active-call changes, and live test destinations.
- Real evidence/recording authorization, allowed files, retention and production
  recovery policies; local Garage setup and foundation reference lifetime/revocation
  contract are approved.
- Public channel mappings/handoff/feedback, SMS provider, voice behavior, browser
  calling design, report definitions, and permitted recovery actions.
- Production platform/HA decisions, measurable readiness/recovery targets, owners,
  and which later extensions are required for the initial operational deployment.

These questions block dependent implementation. Proposed answers and gates are
listed in the [P1-U1 decision register](../docs/planning/p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation).
The user owns approval of all decisions; D-05 storage representation and its
associated rules are approved for P2-U1a; D-01 and relevant D-05/D-06
role/eligibility/admission rules, including creator closure, are approved for b;
c's scoped bootstrap password policy and initial-account handoff are also approved.
Other proposed answers remain pending. P1-U1
is deferred; P1-U2 independent foundation implementation is complete.


## Architecture Decisions

User-authorized independent foundation work follows the existing stack, module
boundaries and shared-state invariants. Routine P1-U2 choices use pnpm ordering,
pinned compatible dependencies and isolated Nest modules; see
[workspace decisions](../docs/architecture/workspace-foundation.md). The scoped D-05 storage
representation handoff and b's scoped role/admission/creator-closure handoff are
approved; c's scoped bootstrap handoff is approved as well. Other P1-U1 product recommendations remain unapproved.


## Verification and Limitations

- P4-U1a-2 and parent P4-U1a: B-01–08/A-01–08/AC-01–11, API/browser/combined
  selectors, all 10 normal UI tests and final full Docker graph passed, exit 0.
  [Integrated evidence](../docs/status/p4-u1a-2-evidence.md) records real HTTPS,
  PostgreSQL/Redis, two HTTP processes, response loss and owner fencing, fixture
  cleanup and command outcomes. Mounted unfinished inputs can be lost on refresh;
  saved tenants/admin linkage remain durable. Production HA/traffic and credential
  delivery/activation/PBX remain with their later units.

- P2-U3a/b and parent: A-01–09, B-01–08, parent AC-01–11, focused/combined
  platform, complete session and final full Docker checks passed, exit 0.
  Nine normal UI regressions and shipping fixture/credential exclusion passed.
  [Combined evidence](../docs/status/p2-u3b-evidence.md) records actual HTTPS
  topology, canonical-owner retention, precise cleanup and handoffs. Retention
  remains in memory; durable drafts, staff/mobile and production gates remain.

- P2-U2c and parent: C-01–07, a/b regressions, complete focused and full Docker
  checks passed. Central [AC-01–11 evidence](../docs/status/p2-u2c-evidence.md)
  records topology, safe results, exact cleanup and corrected fixture assertions.
  Mandatory realistic traffic/combined memory, production TLS/HA/joint rollback
  and U4 mobile/socket/reauthentication gates remain incomplete; U3 browser/CSRF
  and isolated reauthentication are subsequently complete.

- P2-U2a: A-01–07 and required focused/full checks passed. Lifecycle document
  links and new UI/transport handoffs passed review. The implementation plan has
  six pre-existing `context/...` source links that resolve incorrectly relative
  to that file; confirmed unchanged in HEAD and retained as an unrelated docs
  follow-up. No lifecycle/spec/runbook/evidence links depend on them.

- P1-U2: frozen install and full `pnpm check` passed in the workspace and clean
  source copy. Web HTTP smoke and both mobile platforms' bundle artifact checks
  passed. Hosted CI and native devices were not exercised. At that checkpoint, no
  database, sessions, jobs, PBX or operational feature was implemented. P1-U3 now
  has shared containers, baseline migration, backend connectivity and health;
  domain features remain pending.

- P1-U1 draft: relative-file-link checks passed across five changed/new documents;
  decision IDs D-01–D-13 and overview criteria 1–10 are present. Manual consistency
  review confirmed proposed behavior is marked pending and each gate lists the
  owner, affected units and resume condition. `git diff --check` passed. These are
  documentation checks, not proof of product behavior or user approval.

- Initial inspection found context files and empty directories. P1-U2 has now
  added runnable application skeletons; operational features remain pending.
- Reviewed the plan against the overview, architecture, UI context, code standards,
  and workflow rules. Checked unit IDs, dependency references, Markdown file links,
  and coverage of all ten overview success criteria.
- P1-U2 runtime/build checks verify scaffolding only. No live PBX, native-device,
  multi-replica, operational workflow or production acceptance is claimed.


## Session Notes

- 2026-10-14 (Asia/Manila, +08:00) — Adopted the user-requested P3-U1 split and created a/b/c specs with sequential dependencies, scoped contracts, A/B/C acceptance and full parent AC-01–11 coverage. Updated parent/tracker/docs index. Documentation coverage, relative links, consistency and whitespace checked. All children/parent remain planned; scoped PBX gates and runtime/live verification remain pending.

- 2026-10-14 (Asia/Manila, +08:00) — Read AGENT.md, required context and Phase 3; prepared/reviewed the P3-U1 feature spec. Recommended three sequential implementation sub-units with full AC-01–11 coverage; recorded scoped PBX environment/secret/observation gates and the later external apply-fencing handoff. Documentation checks passed; P3-U1 remains planned, child specs are not yet created, and no runtime/live integration checks are claimed.

- Completed P2-U4c and parent P2-U4 (2026-10-13 17:20 +08:00 (Asia/Manila)): C-01–09 and parent
  AC-01–12 are reconciled. Final full `./dev check` exited 0 after the corrected
  bounded primary-recovery read check; production browser/credential/HTTP, shared
  limits/recovery, all application builds, foundation/storage/identity and client
  scans passed. Focused browser and limits checks also exited 0. Reported Android
  release acceptance passes protected sign-in/restart, canonical B ownership,
  injected write/delete/interruption quarantine and recovery, fingerprint cancellation,
  authenticated lock/unlock resume, reset/fresh replacement, normal/lost-response
  logout and approved idle/original absolute expiry. Runtime/fixture retired, control
  socket removed and existing t001 unchanged; backend live/ready HTTP 200.

    Declared evidence limits remain: Android 16/API 36 with 2025-04-05 patch; desktop
  Node 24.13.1 is outside the supported engine, while Docker uses Node 22.23.3.
  Storage faults are injected around real OS calls; physically locked reads and
  exact interruption timing are not claimed. Trusted fixture clock renewals are
  not shipping responder operations. General activation, persistent incident drafts,
  full responder operations and production readiness remain later units.


- 2026-10-13 (Asia/Manila, +08:00) — Prepared the user-authorized isolated active
  native fixture with an owner-only handoff. Audited draft creation, fixture-only
  active transition and staff creation use existing repositories; two responders
  receive real single-use service-issued/exchanged credentials. A seeded control
  admin is explicitly test-only. Actual verified HTTPS sign-in/session/logout and
  revoked-token denial pass for all three accounts; t001/staff statuses and
  authority versions remain unchanged. Initial preparer checks incorrectly expected
  POST 200 and read TLS socket state after release; incomplete fixtures were safely
  retired and the corrected fresh fixture passes. Product draft-to-active delivery
  remains P4-U3 before ordinary login. Native storage/matrix and c/parent closure
  remain pending; handoff contains no completion claim. Independent --check passes,
  duplicate preparation refuses overwrites, owner-only Git-ignored files are verified,
  and focused lint/mobile typecheck/port regressions pass. Final full graph and
  native matrix remain closure gates after device evidence.

- 2026-10-13 (Asia/Manila, +08:00) — User authorized preparing an isolated active
  tenant/account to continue P2-U4c. Development-only fixture utility is being
  prepared with audited creation/status changes, a fixture control administrator,
  responder credentials through the real action service, private handoff and
  canonical retirement. This does not implement general activation or change
  t001. Actual OS checks must pass before closing c/parent. Production activation
  remains P4-U3 and must precede ordinary tenant login.

- 2026-10-13 (Asia/Manila, +08:00) — After copying the native timeout fix,
  user reports an explicit Invalid credentials or session ended response.
  Status-only read-only inspection of t001/tenant001 confirms tenant draft,
  staff active and credential ready. Draft tenant admission correctly denies
  ordinary sign-in; credential setup does not activate the tenant. No lifecycle
  or credential mutations were performed. An isolated active acceptance fixture
  is still needed for successful native sign-in/storage evidence.

- 2026-10-13 (Asia/Manila, +08:00) — User reported successful Windows release
  APK build/install/launch on Pixel_8_API_36 after resolving stale pnpm junctions.
  Desktop CA-verified HTTPS returned the expected anonymous 401; native stored
  access retry reports absent storage. Sign-in still failed. Inspection of the
  installed React Native 0.83.10 abort polyfill confirmed no AbortSignal.timeout;
  mobile transport called it before fetch. Replaced it with AbortController and
  a cleared seven-second timer. Focused mobile port checks using the actual native
  abort polyfill, lint, typecheck and formatting pass. Patched desktop APK and real
  sign-in/storage acceptance remain pending; P2-U4c and parent remain incomplete.

- 2026-10-12 12:42 +08:00 (Asia/Manila) — Completed requested P2-U4b and cleared its in-progress entry. Implemented strict qualified staff sign-in, separate cookie/CSRF and attested mobile-bearer boundaries, canonical current-session/logout and c storage/topology handoff. B-01–09 and focused HTTP/lifecycle/browser/recovery checks passed. Corrected existing browser fixture synchronization and Redis startup/restart readiness; final complete `./dev check` passed, exit 0. Evidence, contract, runbook, index and tracker updated. c, parent P2-U4 and Phase 2 remain incomplete.

- 2026-10-12 08:12 +08:00 (Asia/Manila) — Repaired the user-reported local
  administrator setup-code failure. Live runtime diagnostics confirmed the
  credential-actions table and migration were absent while Redis budget access
  worked. `./dev migrate` completed, exit 0; runtime migration/table/read grants
  and the actual tenant’s canonical credential service status passed (unset, no
  outstanding action). No code was issued or credentials changed during checks.
  Added HTTPS troubleshooting guidance for schema updates and explicit status/retry.
  Browser issuance retest remains user-side; no application code or broader unit
  completion changed.

- 2026-10-08 00:18 +08:00 (Asia/Manila) — Completed approved P2-U4a and cleared its in-progress entry. Implemented qualified setup/reset/recovery, atomic audited version replacement, shared budgets and separate HTTPS/CSRF UI boundaries. Real A/B API/HTTPS acceptance, all 10 UI regressions and full Docker graph passed, exit 0. Published evidence/guide/runbook and recorded fixture/deployment limits; b/c and parent remain incomplete.

- 2026-10-07 (Asia/Manila, +08:00) — User approved all recommended P2-U4a
  review decisions and instructed continuation. Recorded G-01–06 approval in
  product contracts/review/specs and resumed a in progress. Runtime implementation
  and A-01–08 verification remain required; parent and b/c remain incomplete.

- 2026-10-07 (Asia/Manila, +08:00) — Started P2-U4a as requested and marked
  in progress. Required G-01–06 are still unapproved; inspected existing owner
  interfaces and prepared the user-requested [approval document](../docs/planning/p2-u4a-credential-contract-review.md).
  Sections 1–6 propose qualified issuer/state rules, draft setup/recovery, staff
  password policy, capability lifetimes/revocation, verified-person handoff and
  independent abuse/retention policy. Documentation checks passed. Cleared active
  work and recorded blocked/resume conditions; no runtime changes or completion.

- 2026-10-07 (Asia/Manila, +08:00) — User adopted the P2-U4 three-child split. Created a/b/c specs with sequential dependencies, explicit scope/decision gates, A-01–08/B-01–09/C-01–09 checks and parent acceptance ownership. Linked children from parent/docs index/tracker; documentation links, coverage and whitespace reviewed. No policy approval, runtime implementation or completion claimed.

- 2026-10-07 (Asia/Manila, +08:00) — Read AGENT.md, mandatory context and Phase 2; created and reviewed the P2-U4 feature spec with AC-01–12, initial-admin provenance, secure browser/mobile boundaries, credential race/revocation behavior and six explicit product gates. Recommended three sequential implementation children without adopting the split or approving pending policies. Registered the spec in the docs index/tracker; documentation checks only. P2-U4 remains planned.

- 2026-10-07 16:00 +08:00 (Asia/Manila) — Completed requested P4-U1a-2 and
  integrated P4-U1a acceptance. Read AGENT.md/context/spec/API handoff, marked
  active work, built protected tenant screens/forwarding and mounted owner-bound
  explicit recovery. Real production HTTPS/Nest/PostgreSQL/Redis checks cover
  committed response loss, late owner callbacks, validation, pagination, outages,
  keyboard/reflow and accessibility. Corrected production fixture composition,
  backend error focus and passive expiry test synchronization. API/browser/
  combined selectors, 10 UI tests and final full `./dev check` passed, exit 0.
  Earlier long tool sessions ended with signal 143; the final supervised serial
  run recorded actual command exit statuses and completed cleanly. Owned fixture
  cleanup verified; local live/ready 200 and shared data retained. Updated contracts,
  guide/index/specs/evidence and cleared active work. P2-U4 is next; P4-U1/Phase 2
  remain incomplete and credential setup/activation/PBX stay downstream.

- 2026-10-07 13:50 +08:00 (Asia/Manila) — Completed requested P4-U1a-1. Read instructions/context/spec
  and dependency source/evidence; implemented documented protected create/list/detail,
  canonical owner ports, fixed initial states, shared poisoned target handles,
  immutable qualified receipts and atomic owner audit. Final focused API A-01–08,
  full identity/bootstrap and full Docker checks passed, exit 0, including all
  session/platform HTTP/HTTPS browser regressions and five client scans. Local
  migration and health passed. Corrected a stale migration-count assertion exposed
  by the first full run; final full rerun passed. Recorded evidence/contracts and
  cleared active work. Child 2 and parent/browser acceptance remain pending.

- 2026-10-07 +08:00 (Asia/Manila) — User requested creating the P4-U1a split
  feature specs. Adopted sequential P4-U1a-1 API/database and P4-U1a-2 browser/
  integrated handoff; created detailed child contracts, acceptance criteria and
  parent coverage, linked parent/tracker/index and kept every unit planned.
  Clarified explicit recovery before editing an uncertain creation attempt.
  Documentation links, acceptance coverage and whitespace checked; no runtime
  implementation or tests claimed.

- 2026-10-07 +08:00 (Asia/Manila) — Prepared and reviewed the requested P4-U1a
  feature spec after AGENT.md, mandatory context and source inspection. Defined
  atomic draft/admin creation, per-target audit integration, durable retry receipt,
  protected list/detail/browser contracts and AC-01–11. Recommended two sequential
  sub-units without adopting or starting them. Reviewed documentation consistency,
  local links and whitespace; no runtime checks or feature completion claimed.

- 2026-10-07 11:12 +08:00 (Asia/Manila) — User approved updating the delivery plan
  to create a tenant and its first administrator before staff authentication.
  Split P4-U1 into early draft creation (a) and later onboarding configuration (b),
  added P4-U1a to P2-U4 dependencies, and synchronized Next Up and overview wording.
  Draft admission remains denied; credential setup policy and activation remain
  with their owning units. Reviewed dependency order and documentation consistency;
  no application changes, runtime checks, or new completion claims.

- 2026-10-07 — User confirmed Windows private HTTPS access/sign-in is working.
  Updated the development runbook with sequential PowerShell commands, download
  existence checks, encountered error recovery and terminal lifetime guidance.
  Added macOS certificate download/fingerprint comparison, login-keychain trust,
  SSH tunnel and certificate removal instructions from Apple's documentation.
  Windows success is user-reported; macOS and explicit refresh/logout checks remain
  unconfirmed. Documentation only; running console and shared services untouched.

- 2026-10-07 10:20 +08:00 — Completed approved DEV-PLATFORM-HTTPS implementation
  and automated verification using the existing database, Redis and operator.
  Added persistent private TLS/secrets, exact origin/proxy configuration,
  loopback/internal ingress and normal application processes, lifecycle tooling
  and Windows instructions. Real transport/browser/private-network checks passed;
  restart and original preservation baseline passed. Stopped owned test-started
  console processes and retained shared containers/data. Windows certificate
  trust and actual operator sign-in/logout remain the user's private manual step.

- 2026-10-07 — User requested documentation to review how to enable sign-in after
  successfully creating the initial operator. Prepared the
  [development HTTPS access proposal](../docs/planning/platform-development-https-access.md):
  recommended `https://localhost:3443` through an SSH tunnel to server loopback
  3101, certificate trust, private settings, ingress requirements and verification.
  Documentation only; runtime setup and the user's actual sign-in remain pending.
  Existing development data and bootstrap account are to be retained. P2-U3 stays
  complete; this proposal does not start staff access or production deployment.

- 2026-10-07 09:11 +08:00 (Asia/Manila) — Completed P2-U3b and parent P2-U3. Real production
  Next HTTPS composition, narrow ingress/cookie/CSRF proxy, protected server reads,
  accessible sign-in/logout and canonical-owner in-memory recovery are verified.
  Protected dialogs/menus hide and release focus during expiry; identity switches
  reset the shell. Build-selected TypeScript paths keep the fixture absent from
  shipping bundles and present only in isolated verification output. Final browser,
  complete parent/session/full Docker matrix, nine normal UI tests and all five
  client scans passed, exit 0; owned fixtures cleaned up. Updated guide/contracts,
  evidence/index/specs/tracker and cleared active work. U4 stays planned; Phase 2
  staff, durable drafts and production readiness remain outside this completion.

- 2026-10-06 14:02 +08:00 (Asia/Manila) — Completed P2-U3a A-01–09. Final focused
  auth HTTP/secure Chromium and full Docker checks passed, exit 0; actual
  production module wiring, real canonical credential/version races, independent
  A/B limits, single-session logout/retries, transactional authority, internal
  crypto failure, actual lost writes/stale restoration/recovery and all five
  client scans verified. Preserved bootstrap/bearer/lifecycle policies and
  generic failures; bounded credential pipeline prevents plaintext DB queues.
  Fixed conservative cookie expiry for HTTP-Date rounding and gave real COMMIT
  loss fixtures approved finite timeout headroom without relaxing assertions.
  Recorded contract/runbook/evidence/b handoff and cleared active work. b,
  parent browser journey, deployment prerequisites and production gates remain.

- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U3a at the user's request.
  Read AGENT.md/mandatory context/a and parent specs; rechecked delivered operator
  and combined session evidence. Implemented named auth HTTP contracts, canonical
  credential/version issuance, typed finite scrypt verification, explicit bearer/
  cookie policies, trusted proxy/Origin and stateless context-bound CSRF, passive
  session/logout and durable single-session revocation. Initial focused A/B and
  secure Chromium probe passed. Expanded checks found browser HTTP-Date cookie
  rounding could exceed absolute expiry; corrected the conservative Expires value
  and retained the strict assertion. Final acceptance/regressions/full Docker
  verification remain in progress; no a/parent completion claimed.

- 2026-10-06 (Asia/Manila, +08:00) — User adopted P2-U3a/b split and requested
  child specs. Created sequential HTTP-authentication and browser/reauthentication
  specs with A-01–09, B-01–08 and complete parent AC-01–11 ownership. Updated parent,
  tracker and docs index. Consistency, relative links, coverage and whitespace
  checked; children/parent remain planned with no runtime implementation claimed.


- 2026-10-06 (Asia/Manila, +08:00) — Read AGENT.md, required context and Phase 2;
  prepared/reviewed P2-U3 spec AC-01–11 against delivered operator/session/guard
  boundaries. Recommended two sequential sub-units with complete acceptance
  ownership. Identified bearer-only guard integration, verifier overload/error
  distinction, secure-origin/login CSRF and isolated unfinished-work handoff.
  Linked spec/tracker/index; documentation consistency, links and whitespace
  checked. Split remains proposed and P2-U3 planned; no runtime work claimed.


- 2026-10-06 11:12 +08:00 (Asia/Manila) — Completed P2-U2c and parent P2-U2 under approved
  limiter policy/production review conditions. Final full Docker and standalone
  complete session checks passed, exit 0; C-01–07/all a/b/parent AC-01–11 mapped
  in central evidence. Redis registry memory 876,709 bytes; health live/ready 200,
  exact fixture cleanup and final docs/config/launcher checks passed. Cleared
  active work. Realistic traffic/capacity/HA and U3/U4/Phase 2 gates remain open.


- 2026-10-06 (Asia/Manila, +08:00) — Full Docker check passed, including
  current combined session/limiter/recovery and finite metric privacy checks.
  The subsequent standalone complete rerun exposed an inherited total-key-count
  assertion racing expiry of earlier fixture records. Replaced it with direct
  proof of exactly one newly created expected issuance record. Required final
  complete rerun remains in progress; c/parent are not yet marked complete.


- 2026-10-06 (Asia/Manila, +08:00) — Focused c `--limits` passed, exit 0,
  including a/b regressions, real A/B concurrent admission and TTL/capacity,
  proxy/identity bounds, limiter response loss/ACL/OOM, actual restart/stale
  restore and interrupted primary recovery. Full-size registry measured 876,709
  bytes. Added integrated contract/runbook and preserved mandatory realistic
  traffic/production capacity gates. Complete focused/full Docker verification
  remains in progress; no c/parent completion yet.


- 2026-10-06 (Asia/Manila, +08:00) — Implemented approved typed admission,
  atomic expiring bounded Redis registry, validated policy/proxy configuration,
  trusted source extraction and protected HTTP 400/429/503 wiring. Shared session
  connection handling now reconnects only for new operations without ambiguous
  write replay. Backend build passed; real two-HTTP limiter/outage/recovery fixture
  and combined CI selections are implemented and under verification. c remains
  in progress until required integrated and full Docker acceptance passes.


- 2026-10-06 (Asia/Manila, +08:00) — User approved c review section 1 and
  the 8,192 active-counter ceiling. Resumed implementation. Protected 120/minute
  identity default is subject to realistic web/polling/operator/future mobile
  traffic validation and budget re-review before production if normal behavior
  reaches it. Omitted recovery/public-intake/socket policies remain unapproved.


- 2026-10-06 (Asia/Manila, +08:00) — Prepared the user-requested
  [P2-U2c approval document](../docs/planning/p2-u2c-limiter-contract-review.md).
  Section 1 defines the required policy decision; sections 2–3 document source
  trust/resource bounds and implementation/verification. Existing real-service
  `./dev exec pnpm check:session-foundation --authority` passed, exit 0,
  including lifecycle/recovery regressions and two HTTP replicas. Documentation
  consistency/relative links/formatting/whitespace checked. Independent preparation
  is complete; c is blocked until explicit section 1 approval/revision under the
  parent's limiter gate. No runtime limiter or c/parent completion is claimed.


- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U2c at the user's request.
  Read AGENT.md, required context and child/parent specifications. a/b are
  complete; preparing a concrete limiter policy review and rechecking their
  real-service fixtures. Product limiter coverage/budgets/counting require explicit
  approval under the parent gate; no proposed values or completion claimed.


- 2026-10-06 09:48 +08:00 (Asia/Manila) — Completed requested P2-U2b B-01–07. Canonical
  request principals, explicit global HTTP policies, safe failures, activity renewal
  and transaction owner locks are verified with real two-process HTTP fixtures.
  Initial focused authority/a regressions passed. The first full attempt stopped on
  fixture formatting; corrected formatting and final full Docker run passed, exit 0,
  including the strengthened post-handler renewal outage check. Recorded contract,
  evidence, consumer transport/transaction limits and c handoff; synchronized docs
  and cleared active work. c/parent and sign-in remain incomplete.

- 2026-10-06 08:53 +08:00 (Asia/Manila) — Completed P2-U2a A-01–07 under explicit
  revised D-05/recovery approval. Shared opaque lifecycle, fixed absolute expiry,
  audited minimal durable fencing/retention, bounded conditional Redis and
  independent process barriers are verified. Final focused lifecycle and full
  Docker checks passed, exit 0, including actual Redis/PostgreSQL write-response
  loss, audit rollback/process interruption, physical expiry and actual stale
  record restoration/restart. Local deployment/health and precise fixture teardown
  passed. Updated evidence/runbook/specs/product contracts and required UI/transport
  unfinished-work reauthentication handoff; cleared active work. b/c, sign-in and
  parent completion remain pending.


- 2026-10-06 (Asia/Manila, +08:00) — User approved P2-U2a scoped D-05 and
  durable generation/revocation fencing, revising web idle to 60 minutes while
  retaining web 12-hour absolute and mobile 24-hour/7-day. Activity excludes
  passive polling/health/heartbeats and rotation keeps the original absolute
  deadline. Recorded unfinished-incident preservation as a required P2-U3/U4
  reauthentication handoff and resumed implementation. Typed ports/configuration,
  audited minimal fences/migration/grants, atomic Redis scripts and isolated
  real-service checks are implemented. Focused lifecycle checks passed, exit 0;
  required full Docker verification remains in progress. No a/parent completion yet.


- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U2a as requested, then prepared
  the user-requested [approval document](../docs/planning/p2-u2a-session-contract-review.md).
  Section 1 contains proposed idle/absolute defaults and qualifying activity;
  section 2 selects minimal durable generation fencing that preserves other devices.
  Read required instructions/context/spec and prior evidence; focused real-service
  identity authority check passed, exit 0. Documentation links/whitespace reviewed.
  a remains incomplete and blocked pending explicit section 1 approval/revision;
  no session runtime, lifecycle acceptance or full Docker check claimed.


- 2026-10-05 (Asia/Manila, +08:00) — Adopted the user-requested P2-U2 split and
  created a/b/c feature specs with sequential dependencies, scoped contracts,
  acceptance criteria and complete parent AC-01–11 coverage. Updated parent,
  tracker and docs index. Documentation consistency, relative links, acceptance
  coverage and whitespace checked. All children/parent remain planned; session
  and limiter policies remain pending and no runtime changes/checks are claimed.


- 2026-10-05 (Asia/Manila, +08:00) — Prepared and reviewed the requested P2-U2
  feature spec after reading AGENT.md, required context, Phase 2 and current
  authority/Redis boundaries. Defined lifecycle, canonical guards, shared limits,
  failure/recovery contracts and AC-01–11; recommended three sequential sub-units
  with complete acceptance coverage. Session/limiter policies remain unapproved;
  recovery fencing/reset must be designed before implementation. Documentation
  consistency, relative links and whitespace checked; P2-U2 remains planned.


- 2026-10-05 17:04 +08:00 (Asia/Manila) — Completed P2-U1c and parent P2-U1 under
  approved review sections 1–2. Protected input/private scrypt, atomic PostgreSQL
  bootstrap/provenance/system audit and safe unchanged reruns are verified.
  Independent races, audit rollback, precommit interruption and real COMMIT-response
  loss/PTY/sentinel checks passed. Final combined identity and full Docker checks
  exited 0; actual launcher safe rejection, zero local seeds, health and precise
  fixture teardown passed. Synchronized evidence/contracts/runbook/tracker and
  cleared active work. Sessions/sign-in and broader product/production gates remain.


- 2026-10-05 (Asia/Manila, +08:00) — Started P2-U1c as requested and marked
  in progress. Read instructions/context/spec and a/b evidence. User requested
  a review document; prepared and linked the scoped bootstrap contract.
  Dependent implementation awaits approval of sections 1–2; c and parent remain
  incomplete. No bootstrap runtime changes or completion claim.

- 2026-10-05 15:32 +08:00 (Asia/Manila) — Completed P2-U1b B-01–07 under the user's
  approved role/admission contract and revised creator-closure grant. Implemented
  explicit role constraints, coherent bounded primary snapshots, private verifier
  ports and audited authority mutations. Final focused a/b PostgreSQL checks and
  full Docker rerun passed, exit 0; corrected the legacy audit migration count.
  Local migration, zero seeds, runtime grant, health and fixture teardown passed.
  Recorded evidence/handoff, synchronized context and cleared active work.
  c/bootstrap, password policy, sessions and parent acceptance remain incomplete.

- 2026-10-05 (Asia/Manila, +08:00) — User approved P2-U1b review sections
  1–4 with creator closure independent of dispatcher role, subject to owning
  D-02/D-03 safeguards, and instructed implementation to continue. Recorded the
  scoped P1-U1 handoff in product contracts/review and resumed b in progress.

- 2026-10-05 (Asia/Manila, +08:00) — Created the user-requested P2-U1b
  approval review document with fixed role codes/cardinality/combinations, full
  permission matrix, account/credential and four-state tenant admission matrices,
  scoped P1-U1 handoff and explicit later gates. Linked it from the docs index
  and tracker. Proposal remains unapproved; b remains blocked and incomplete.

- 2026-10-05 14:23 +08:00 (Asia/Manila) — Started P2-U1b at the user's
  request and marked it in progress. Read AGENT.md, mandatory context and spec;
  rechecked storage migration/repositories/transaction/audit contracts and re-ran
  `./dev exec pnpm check:identity-foundation --storage` successfully (exit 0).
  Prepared and asked the spec-required scoped D-01/D-05/D-06 contract decision.
  Independent preparation complete; b is blocked awaiting that decision, with
  no runtime/schema changes or completion claim. P1-U1 remains deferred.

- 2026-10-05 14:07 +08:00 (Asia/Manila) — Completed P2-U1a A-01–07 after D-05 approval.
  Focused real-PostgreSQL checks, full Docker checks, local migration and health
  passed; client sentinels and fixture teardown verified. Recorded evidence and
  storage/registry/credential/provenance handoff, synchronized specs/context and
  cleared active work. b/c and parent acceptance remain incomplete.

- 2026-10-05 +08:00 (Asia/Manila) — Resumed P2-U1a after explicit D-05
  storage representation approval. Recorded its scoped P1-U1 handoff, added
  canonical identity/provenance migration, ownership/version protections,
  qualified audited repositories and caller-owned tenant registry port. Focused
  PostgreSQL checks and lint passed; integrated full Docker checks are running.
  No roles, admission, credential policy, sessions or bootstrap execution added.

- 2026-10-05 +08:00 (Asia/Manila) — Started P2-U1a at the user's request,
  read AGENT.md and mandatory context, inspected existing migration/transaction/
  audit foundations and prepared the storage design. Asked the spec-required
  D-05 representation/scoped P1-U1 handoff decision. User requested reviewing
  first; dependent implementation is held and the unit is blocked, incomplete.
  Documentation links and whitespace checked; no identity runtime checks claimed.

- 2026-10-05 +08:00 (Asia/Manila) — Created the user-requested P2-U1a/b/c
  child feature specs with sequential dependencies, detailed contracts, scoped
  acceptance criteria and parent AC-01–11 coverage. Updated parent, tracker and
  docs index to record the adopted split. Documentation consistency, relative
  links, acceptance coverage and whitespace checked; all units remain planned.
  Product decisions and runtime implementation remain pending.

- 2026-10-05 +08:00 (Asia/Manila) — Prepared and reviewed the P2-U1 feature
  spec after reading AGENT.md, required context, Phase 2, existing specs and
  source boundaries. Defined canonical ownership/normalization, role/admission
  ports, authority versions, credential metadata and secure retry-safe bootstrap;
  recommended three sequential sub-units with AC-01–11 coverage. P1-U1 partial
  handoff and relevant D-01/D-05/D-06 decisions remain pending. Documentation
  consistency, relative links and whitespace checked; no runtime changes/checks
  or Phase 2 completion claimed. P2-U1 remains planned.

- 2026-10-05 10:52 +08:00 (Asia/Manila) — Completed P1-U6b and parent P1-U6
  after explicit approval of GET bearer access, a 120-second default and hard
  300-second ceiling. Added tenant ownership/permission ports, bounded verified
  reference issuance, reachable signing configuration and real Garage access/
  expiry/tampering/recovery checks. Focused, fresh provider and full Docker checks
  passed; all five client scans and live/ready 200 passed. Corrected rejection
  expectations for Garage HTTP 400 without weakening lifetime enforcement. One
  workspace refresh interrupted an earlier check; its two verified exact fixtures
  were removed, and final runs passed. Added evidence/runbook/ADR handoff and
  cleared active work. Real identity/evidence and production gates remain open.

- 2026-10-05 (Asia/Manila) — Started P1-U6b at the user's request and marked it
  in progress. Read repository instructions and required context; inspected a's
  adapter/configuration and verification boundaries. Prepared a concrete pending
  access proposal in the storage ADR and asked the required D-10 decision. The
  spec explicitly forbids inferring access approval from provider/spec approval.
  Recorded the unit as blocked after independent preparation; resume upon explicit
  access-contract approval or revision. Relative-file links and whitespace passed;
  no runtime implementation or acceptance completion is claimed.

- 2026-10-05 09:43 +08:00 (Asia/Manila) — Completed P1-U6a after explicit Garage approval.
  Implemented pinned private provider, runtime/fixture credential separation,
  validated optional configuration and bounded adapter with verified bytes and
  same-identity recovery. Focused, fresh-volume/restart and all five client scans
  passed; final full Docker check exited 0. The earlier full run ended with a shell
  parse error because the launcher was edited while running; the unchanged rerun
  passed. Added ADR/runbook/evidence and cleared active work. P1-U6b remains planned
  with access/lifetime/revocation approval pending; parent P1-U6 is incomplete.

- 2026-10-05 +08:00 (Asia/Manila) — Started P1-U6a at the user's implementation
  request and marked it in progress. Read required context and storage specs;
  rechecked P1-U3 evidence and configuration, runtime secrets, deployment and
  Docker/check boundaries. No storage adapter/configuration/provider exists.
  Provider/setup approval remains an explicit prerequisite in the requested spec;
  asked the focused setup question and recorded blocked/resume conditions.
  No runtime implementation or storage acceptance checks are claimed. Tracker
  relative-file links and `git diff --check` passed.

- 2026-10-05 +08:00 (Asia/Manila) — Split P1-U6 into two child feature specs at
  the user's request. Parent retains shared scope and AC-01–09; a owns adapter,
  configuration and provisioning, b owns tenant-checked references and combined
  recovery verification. Updated tracker/index links. Documentation consistency,
  relative links, acceptance coverage and whitespace checks passed. Both units
  remain planned; provider/access D-10 remains pending.

- 2026-10-05 08:24 +08:00 (Asia/Manila) — Drafted the P1-U6 storage feature spec
  from AGENT.md, required context, Phase 1 and existing source boundaries.
  Recommended two implementation units with explicit acceptance coverage;
  provider/access D-10 remains pending, and evidence/retention stay in Phase 8.
  Documentation consistency, relative-file links and whitespace checks passed.
  P1-U6 remains planned; no runtime checks or implementation were performed.

- 2026-10-04 20:18 +08:00 (Asia/Manila) — Completed P1-U5c and parent P1-U5. Focused
  durability and full Docker checks passed AC-01–10. Corrected checked-out
  connection errors and unawaited pg-boss acknowledgements; verified queue
  readiness, process/database recovery, retained terminal states and bounded
  drain. Two Docker replicas exited 0; HTTP stayed ready. Saved safe snapshots,
  runbook and evidence; cleared active work. P1-U6 requires its storage decision.

- 2026-10-04 19:45 +08:00 (Asia/Manila) — Completed P1-U5b. Atomic pg-boss handoff,
  independent workers, restart-safe sample sink, scoped keys, bounded retries and
  retained failures passed focused real-PostgreSQL checks. Frozen install,
  audit/outbox regressions and full `./dev check` passed. Verified two Docker worker
  replicas, graceful exit 0 and independent HTTP health; added contract, runbook
  and evidence. Cleared active work. P1-U5c remains planned; parent remains incomplete.

- 2026-10-04 19:11 +08:00 (Asia/Manila) — Completed P1-U5a. Transaction-bound
  audit/outbox writes, structural attribution, append-only grants/trigger and safe
  metadata/logging passed focused real-PostgreSQL checks. Full `./dev check`,
  deployment migration and health passed. Added write/handoff contract and evidence;
  cleared active work. P1-U5b/c remain planned and parent P1-U5 remains incomplete.


- 2026-10-04 18:40 +08:00 (Asia/Manila) — Split P1-U5 into three separate feature specs at the user's
  request. Parent now holds shared scope and acceptance matrix; a/b/c own detailed
  contracts and sequential verification boundaries. Updated tracker/index links.
  Documentation link, acceptance coverage and whitespace checks passed;
  runtime implementation remains planned.

- 2026-10-04 18:33 +08:00 — Drafted P1-U5 feature spec from repository guidance,
  Phase 1, required context and current backend/migration boundaries. Recommended
  three sequential subunits with explicit transaction, delivery and recovery
  checks. Relative-file links, acceptance coverage and whitespace checks passed.
  Documentation only; P1-U5 and its proposed subunits remain planned.

- 2026-10-04 18:18 +08:00 — Completed the approved three-subunit P1-U4 sequence.
  Shared theme/primitives and distinct operations shells passed 12 production
  browser checks, contrast/keyboard/visual review and the full workspace/backend
  foundation checks. Terminal connections interrupted earlier attempts; final
  Docker-detached check logged exit status 0. Updated spec, UI guide, runbook,
  evidence and CI. Operational/authentication features remain pending; P1-U5 is next.

- 2026-10-04 17:18 +08:00 — Drafted P1-U4 feature spec from repository guidance,
  Phase 1 and existing UI skeletons. Recommended three sequential subunits with
  explicit acceptance/check boundaries. Documentation only; P1-U4 remains planned.

- 2026-10-04 16:56 +08:00 — Resumed and completed P1-U3. Full `./dev check`
  passed after correcting README formatting; fresh/concurrent/rerun migration,
  restricted runtime role, backend restart, configuration failures and individual
  dependency outages/recovery passed. `./dev up` rerun and backend health passed.
  Recorded evidence and synchronized runbooks/tracker. P1-U4 is next; operational
  features and deferred product decisions remain pending.

- 2026-10-04 — User requested marking P1-U2 completed. Confirmed its existing
  complete status and added an explicit completion date to its checkpoint.
  P1-U3 remains in progress. Documentation-only update; whitespace check passed.

- 2026-10-04 — Corrected server preview access: the workspace had localhost-only
  binding and no application process. Added a separate command-center bind setting
  and explicit root `.env` loading in launchers. This server selects public port
  3100 only; other workspace/service ports remain local. Started the command-center
  preview in Docker and verified HTTP 200 at `172.16.7.53:3100`. Added LAN/public
  development origins. Public access depends on the firewall's TCP 3100 forwarding
  to this LAN address. The public URL also returned HTTP 200 from this server;
  an independent external browser remains unverified.

- 2026-10-04 — User approved the complete Docker development workspace and requested
  documentation. Added Docker-only host launcher, isolated dependencies/caches,
  non-root workspace, optional VS Code integration and Docker CI commands.
  Full Docker check, application/source-reload smoke, networking and credential
  checks passed. Updated setup, architecture, workflow and verification docs.
  Hosted CI, VS Code UI, other operating systems and native devices are unverified.
  P1-U3 remains in progress for baseline migrations and backend health.

- 2026-10-04 14:39 +08:00 — Shared-container increment verified: four healthy services,
  restart persistence, Redis isolation and authenticated host access passed.
  Corrected Compose mount resolution and Redis credentials during checks.
  Temporary fixtures removed; generated secrets ignored by Git. P1-U3 remains
  in progress for backend connections, baseline migrations and health.

- 2026-10-04 14:35 +08:00 — User requested shared services in Docker and explicitly included
  Asterisk. Added four digest-pinned containers, local bindings, data volumes,
  automatic database secret, health checks and root commands. Service startup and
  queries passed. P1-U3 remains in progress; backend/migrations/health are pending.

- 2026-10-04 14:18 +08:00 — User explicitly adopted the build, review, improve process.
  Added it to the authoritative workflow rules and linked it from the current
  goal. Retained unit boundaries, verification and dependent-decision handling.
  Documentation consistency and whitespace checks passed; no runtime code changed.

- 2026-10-04 14:13 +08:00 — User resolved the port 3000 conflict by stopping its container
  and confirmed the command-center development page returns HTTP 200. Added the
  exact remote host `203.177.64.131` to command-center `allowedDevOrigins` to
  permit development resources/hot reload. No ports changed. Focused lint,
  typecheck, formatting and `git diff --check` passed; remote browser retest requires
  restarting the user-owned dev process.

- 2026-10-04 13:59 +08:00 — Completed P1-U2. Workspace and clean-copy checks passed,
  including all web/mobile builds and four isolated backend process checks.
  Production web HTTP smoke passed. Updated setup/docs and recorded evidence.
  P1-U1 product decisions remain deferred; P1-U3 is next.

- 2026-10-04 +08:00 — User requested a simpler process and to start building.
  Deferred P1-U1 product review, activated independent P1-U2 under the existing
  architecture, and began scaffold/check implementation. No product draft adopted.

- 2026-10-04 13:14 +08:00 — Prepared P1-U1 foundation review, proposed product
  contracts, acceptance matrix and decision gates. Added docs index and corrected
  tracker links to the implementation plan. User review pending; P1-U2 remains
  planned and no runtime capability is claimed.

- 2026-10-04 11:31 +08:00 — Created `implementation-plan.md` with nine phases and
  50 planned units, phase gates, unresolved decisions, and success-criteria mapping.
  Linked the plan from this tracker and recorded the unimplemented starting state.
- 2026-10-04 11:19 +08:00 — Completed documentation cleanup: removed the obsolete delivery-plan dependency from `AGENT.md` and the unused phase heading from this tracker. Reviewed all repository documents; the delivery-plan file is absent and no numbered delivery stages remain. Documentation consistency checks passed; runtime tests are not applicable.

<!-- END ORIGINAL TRACKER SNAPSHOT 2026-10-14 -->


## 2026-10-14 — P3-U1a pre-completion checkpoint (Asia/Manila, +08:00)

## Current Unit Checkpoint — P3-U1

- **Status:** P3-U1a in progress under approved scoped connectivity contract; b/c planned and parent incomplete. Updated 2026-10-14 (Asia/Manila, +08:00).
- **Requirement:** [P3-U1 feature spec](feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md), parent AC-01–11.
- **Scope:** protected PBX registry, safe secret references, independent database-fenced observation, health/registration freshness and platform browser inspection.
- **Dependencies:** verified P2-U3/P1-U5, existing foundation/guards/UI, and scoped D-09 environment/secret access. Recheck owner interfaces and evidence before coding.
- **Adopted sequence:** a → b → c, requested by the user on 2026-10-14. P3-U1a resumed under scoped G-01/G-02 approval; b/c and parent completion remain pending. Spec creation does not approve pending policy.
- **Prepared:** [connectivity review](../docs/planning/p3-u1a-connectivity-contract-review.md) covers the proposed local target, canonical identity, TLS destination boundary, opaque aliases/process access, named API/DTO/error contracts, retry receipts and b's atomic invalidation handoff. Preparation does not satisfy A-01–07.
- **Approval/resume:** user approved review section 1 for the existing local Compose target, with multiple-installation, shared-tenant, credential-rotation and future-profile clarifications. Approved non-secret local catalog is provisioned; isolated resolver fixtures exercise protected local files; actual live authentication/G-03 remain with b. Tracked AMI and HTTP/ARI are disabled; no credentials were read or management access changed.
- **Implementation checkpoint:** telephony-owned desired registry/receipt migration and runtime grants, protected create/list/detail/versioned-edit API, canonical catalog, server-only resolver/destination ports and atomic b handoff are implemented. Local non-secret catalog provisioned with persistent installation identity. Focused A-01–07 acceptance passed, exit 0; the actual controlled DNS/address probe passed without connection/authentication. The full Docker graph and final regression confirmation are still running.
- **Remaining:** finish focused A-01–07 acceptance, affected regressions, full Docker checks and evidence/runbook handoff. Saving desired settings must remain distinct from observed health, live apply and tenant voice readiness.
- **Required verification:** focused registry, controlled observation/ownership and actual secure-browser matrix, affected regressions and full Docker checks. Proposed `check:pbx-nodes` selections do not exist yet; establish actual commands during implementation.
- **Documentation verification:** acceptance coverage, local links, consistency and whitespace checked. No runtime completion inferred.

| Unit | Status | Boundary and acceptance |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | in progress | Scoped G-01/G-02 approved; desired registry/API, target/alias validation, transactional audit/idempotency and atomic edit handoff; A-01–07. |
| [P3-U1b — Fenced Asterisk observation and recovery](feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md) | planned | Verified a and resolved observation gates; real read-only adapter, database epochs/leases, freshness/reconciliation and stale-owner rejection; B-01–09. |
| [P3-U1c — Operator PBX browser journey and integrated handoff](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | planned | Verified a/b; real register/inspect/edit UI, isolated recovery and combined AC-01–11 evidence; C-01–07. |

### Prerequisites for dependent P3-U1 work

| Gate | Required condition and resume evidence |
| --- | --- |
| G-01 — Controlled observation environment | Establish canonical controlled target, authorized interface/transport/network, read-only permissions and supported registration fixtures; document real authenticated access before live acceptance. |
| G-02 — Secret resolution | Establish approved provider/protected runtime configuration, opaque aliases, least-privilege process access and rotation/reconnect behavior; provision access without exposing material. |
| G-03 — Observation policy | Establish freshness, bounded I/O/concurrency/reconciliation/retry and lease settings with coverage/stale semantics; validate settings before dependent implementation. |

Resolve only the gate portions needed by the current child. Routine SQL/routes/
adapter choices follow existing conventions. Routing/reload/active-call policy
remains with later units; P3-U5 must prove external stale-owner fencing before
live apply is enabled. Missing live access cannot be replaced by simulator evidence.


## 2026-10-14 — Session notes archived at P3-U1a completion

- 2026-10-14 (Asia/Manila, +08:00) — Started P3-U1a, read required context and delivered owner contracts/evidence, and verified disabled management bootstrap plus absent PBX resolver/registry/check command in tracked source. Prepared the scoped connectivity decision review and independent API/transaction/invalidation contracts; then marked a blocked pending user approval. Documentation links/coverage/whitespace checked; no runtime changes, provisioning, credentials read or acceptance checks run.

- 2026-10-14 (Asia/Manila, +08:00) — Archived the full pre-compaction tracker verbatim with a checksum, condensed current state and reconciled superseded pending entries against final results/approved policies. Preserved completed evidence, open gates, deferred resume conditions and limitations. Archive preservation, current links/anchors, status consistency and whitespace checked; no runtime changes/checks.
- 2026-10-14 (Asia/Manila, +08:00) — Prepared/reviewed P3-U1 and adopted the user-requested a/b/c specs with sequential dependencies and full AC-01–11 coverage. Documentation checks passed; parent/children remain planned and PBX gates unresolved.
- 2026-10-13 17:20 +08:00 (Asia/Manila) — Completed P2-U4c/parent after final full Docker exit 0 and focused passes. Reported native evidence reconciled; isolated fixture/runtime retired and limits retained in the linked evidence.


## 2026-10-14 — P3-U1b pre-completion checkpoint (Asia/Manila, +08:00)

- Started the requested b unit after required context/registry inspection. Prepared
  [local policy review](../docs/planning/p3-u1b-observation-contract-review.md); the
  user conditionally approved G-01–03 for the isolated development target, with
  broader AMI `system` permission disclosure, a replaceable adapter boundary,
  protected material isolation and no production/live-control approval.
- Implemented durable epochs/leases/latest projection and column-scoped grants,
  atomic registry edit invalidation, passive freshness DTOs, independent engine
  and fixed-action certificate-verified AMI adapter. Preserved applied migration
  history through a follow-up grants version; twelve migrations now exist.
- Final focused controlled observation passed, including real registration,
  credential rotation, disconnect/reconnect and independent shipping processes.
  Database races/expiry/cancelled callbacks/intents and actual TCP/COMMIT-loss
  recovery passed; synthetic adapter/ordering/concurrency faults remain labeled.
  Exact fixture names, cleanup and c/P3-U5 boundaries are in
  [b evidence](../docs/status/p3-u1b-evidence.md).
- Full-graph intermediate findings: legacy migration counts, empty workspace-mask
  traversal permissions, a bootstrap race while supervisor builders ran, and
  missing Playwright browser/cache dependencies after workspace recreation.
  Counts/mask were corrected, focused identity/bootstrap passed unchanged,
  supervisors were restored ready, and existing CI browser prerequisites restored.
  At this historical checkpoint the final full graph remained pending.
- Registry, durability/process and focused b checks passed; b remained in progress
  until B-09/full graph/documentation reconciliation. c, parent P3-U1, live apply,
  tenant voice readiness and production deployment remained incomplete/unapproved.

## 2026-10-14 — P3-U1b final reconciliation (Asia/Manila, +08:00)

Full `./dev check` passed, exit 0, at 17:44 +08:00 after the documented browser
fixture readiness correction. B-01–09 completed, tracker cleared, c/P3-U5 handoff
reconciled, exact fixture cleanup independently verified and normal HTTPS/observer
services retained. This supersedes the pending pre-completion checkpoint above
within b's conditional development scope only; parent/browser/live apply and
production remain pending. See [final evidence](../docs/status/p3-u1b-evidence.md).


## 2026-10-15 — P3-U1c pre-completion checkpoints (Asia/Manila, +08:00)

Historical snapshots superseded by the completed c/parent checkpoint at 2026-10-15 09:32 +08:00 (Asia/Manila).

## In Progress

P3-U1c — Operator PBX browser journey and integrated handoff. Started 2026-10-15
(Asia/Manila, +08:00). Implemented named bounded forwarding, safe DTO validation, PBX list/register/detail/
versioned edit, mounted owner-bound intent recovery and passive observation UI.
Combined real registry/observation/browser acceptance passed. Required full Docker
graph, shared UI tests and final maximum-name browser checks are running; C-07
and final documentation/cleanup reconciliation remain before completion.

## Current Unit Checkpoint — P3-U1

- **Status:** P3-U1a complete (A-01–07); P3-U1b complete (B-01–09); c in progress and parent incomplete. Updated 2026-10-15 (Asia/Manila, +08:00).
- **Requirement:** [P3-U1 feature spec](feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md), parent AC-01–11.
- **Scope:** protected PBX registry, safe secret references, independent database-fenced observation, health/registration freshness and platform browser inspection.
- **Dependencies:** verified P2-U3/P1-U5, existing foundation/guards/UI, and scoped D-09 environment/secret access. Recheck owner interfaces and evidence before coding.
- **Adopted sequence:** a → b → c, requested by the user on 2026-10-14. P3-U1a completed under scoped G-01/G-02 approval; b completed under conditional G-01–03 development approval. c and parent completion remain pending.
- **Delivered a:** [registry contract](../docs/architecture/pbx-registry.md), [operations](../docs/runbooks/pbx-registry.md) and [A-01–07 evidence](../docs/status/p3-u1a-evidence.md). Telephony-owned desired records, permanent installation identity, bounded creation receipts, protected create/list/detail/versioned edit, approved catalog and server-only resolver/destination ports, atomic b invalidation/intent handoff and real-service acceptance are complete.
- **Approval:** [section 1](../docs/planning/p3-u1a-connectivity-contract-review.md) approved for the local Compose target. Multiple installations/profiles, stable identity through credential rotation and future explicit shared-tenant associations are preserved; registration creates no tenant/LGU link. Local catalog/UUID provisioned and actual controlled DNS/address probe passed. b now enables approved private AMI-TLS for development observation; ARI remains disabled.
- **a verification at completion:** focused registry, affected foundation/authority/audit/delivery and platform browser regressions passed; final `./dev check` passed, exit 0, 2026-10-14 11:22 +08:00. Exact fixture cleanup verified; no live PBX credential material read or AMI authentication claimed. Early migration-count assertions were updated; one legacy browser timeout passed unchanged on focused/final rerun.
- **Delivered b:** [replaceable observation contract](../docs/architecture/pbx-observation.md), [operations](../docs/runbooks/pbx-observation.md) and [B-01–09 evidence](../docs/status/p3-u1b-evidence.md). Independent AMI-TLS observer, durable leases/epochs, transactional cancellation/fencing, atomic edit invalidation, complete reconciliation and passive freshness projections verified against controlled Asterisk 22.10.1 and real PostgreSQL. Broader upstream AMI `system` permissions are explicitly acknowledged; the account is not strictly read-only at the PBX. Protected material is isolated from HTTP/web/ordinary workers; application actions are fixed and observation-only.
- **b verification:** final focused real-PBX/multi-process acceptance, a regressions, affected durable/process checks and full `./dev check` passed, exit 0, 2026-10-14 17:44 +08:00. Exact fixture cleanup verified. Real, synthetic and injected fault evidence are distinguished; only one real PBX was tested. Approved settings are development-only; production deployment is unapproved.
- **Delivered c checkpoint:** operator list/register/detail/versioned edit, named safe forwarding, immutable owner/fingerprint/epoch create intents, explicit uncertain-edit reload/review, passive desired/runtime/freshness presentation and operator guide. Focused platform lint/typecheck pass. Initial real browser run reached live detail/axe/reflow; a harness sign-in heading assertion was corrected. Mounted detail recovery was hardened during review. The second run passed live disconnect/reconnect/freshness and version-conflict review; its edit-response fault was corrected to match PATCH so passive GETs cannot consume it. Test polling now avoids redundant session reads and uses a bounded cadence; independent real PBX fixture accounts preserve unchanged sign-in budgets. Latest live create/edit/observation/target-reference recovery portions passed; mounted recovery, combined matrix and full graph remain pending.
- **Remaining/resume c:** rerun corrected C-01–07 browser acceptance and combined parent AC-01–11, affected regressions/full Docker graph and exact cleanup. All three `check:pbx-nodes` selections now exist; corrected browser and combined completion results are pending in [c evidence](../docs/status/p3-u1c-evidence.md). Registry save never implies health, live apply or tenant voice readiness.
- **Documentation verification:** B-01–09 coverage, local links, consistency and whitespace checked. P3-U5 must enforce epochs at the external write boundary before live apply; a pre-call database check cannot fence an already issued command.

| Unit | Status | Boundary and acceptance |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | complete | Desired registry/API, canonical target/alias validation, transactional audit/retry, versioned edits and atomic handoff verified; [A-01–07 evidence](../docs/status/p3-u1a-evidence.md). |
| [P3-U1b — Fenced Asterisk observation and recovery](feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md) | complete | G-01–03 conditionally approved for development; fixed observation-only adapter, database epochs/leases, freshness/reconciliation and stale-owner rejection verified; [B-01–09 evidence](../docs/status/p3-u1b-evidence.md). |
| [P3-U1c — Operator PBX browser journey and integrated handoff](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | in progress | Verified a/b; real register/inspect/edit UI, isolated recovery and combined AC-01–11 evidence; C-01–07. |

## Recent Session Notes

- 2026-10-14 17:44 +08:00 (Asia/Manila) — Completed P3-U1b after focused B-01–08 and full Docker exit 0/B-09. Conditional development approval preserved; real Asterisk registration/rotation/reconnect and real database/multi-process fencing/recovery passed. Exact temporary endpoints/contacts/file, named databases and Redis fixtures removed; normal observers and HTTPS services retained ready. Full graph passed after documented environment repairs and staff browser fixture readiness correction. c, parent, live apply, tenant voice readiness and production remain pending. Prior checkpoints are archived in history; detailed boundaries are in the linked evidence.


## 2026-10-15 — P3-U2a delivery and superseded checkpoints

Archived 2026-10-15 15:01 +08:00 (Asia/Manila) after verified P3-U2a A-01–07 completion.
The following statements describe historical checkpoints; current status is in
[the tracker](progress-tracker.md). Relative links keep their context-directory base.

## In Progress

**P3-U2a — Protected inventory, profiles and atomic bulk creation** — in progress,
2026-10-15 (Asia/Manila, +08:00). Implement A-01–07 under the user's conditional
approval of inventory contract Sections 2–4 and development under Sections 5–7.
Number policy 1000–899999, node-scoped immutable profiles, generated identities,
removeExisting=false and disabled/unset defaults are approved for controlled
private development. Shorter municipal numbering requires an explicit policy
revision; production transport/media/contact recovery requires separate review.
Credentials (b/G-02), live mapping/browser (c) and application (P3-U5) remain separate.

- Completed: required context/spec and existing transaction/registry review;
  deployment-owned schema/grants, strict transport contracts/canonical input,
  immutable profile/extension repositories, capability deployment port and
  protected inventory/profile API with atomic audit/receipts and version locks.
- Verification checkpoint: focused PostgreSQL/Redis/HTTP A/B suite passed all
  sections and safe-output/process diagnostics, exit 0; affected PBX registry
  regression passed A-01–07, exit 0. Final focused rerun also passed direct SQL profile-shape rejection and
  explicit exact PostgreSQL/Redis fixture cleanup, exit 0. Deployment migration and
  the controlled canonical installation capability declaration both passed.
- Remaining: final full Docker graph pass, normal HTTPS restoration, final
  documentation/evidence reconciliation. All focused inventory, registry,
  isolated authority/lifecycle, complete foundation/audit/worker/storage/identity
  and staff-browser selections passed, exit 0. Legacy migration-count checks now
  compare exact repository history. A second-context staff-browser login fixture
  now uses the same foreground/navigation barrier as its main login, preserving
  password-clearing protection and existing deadlines; its focused real HTTPS
  rerun passed. A fresh complete graph with both corrections is running.

## Current Unit Checkpoint — P3-U1

- **Status:** parent P3-U1 and a/b/c complete within approved development registry/observation scope; reconciled 2026-10-15 09:32 +08:00 (Asia/Manila). Phase 3 remains incomplete.
- **Requirement:** [P3-U1 AC-01–11](feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md) and [c C-01–07](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md).
- **Delivered a:** protected desired registry, canonical installation identity, safe aliases/destinations, transactional audit/receipts, versioned edits and atomic observation handoff; [A-01–07 evidence](../docs/status/p3-u1a-evidence.md).
- **Delivered b:** independent AMI-TLS observation, durable leases/epochs/fencing, complete reconciliation, freshness and sanitized failures; [B-01–09 evidence](../docs/status/p3-u1b-evidence.md). The upstream account has broader `system` permissions than the fixed application allowlist and is not strictly read-only at the PBX.
- **Delivered c:** actual secure list/register/detail/connectivity edit, bounded named forwarding, current backend authority, owner-bound immutable create intent/fingerprint/epoch, uncertain-edit canonical reload/review, passive desired/runtime states and accessible responsive presentation; [browser contract](../docs/architecture/pbx-browser.md), [operator guide](../docs/runbooks/pbx-operator-guide.md), [C-01–07/parent evidence](../docs/status/p3-u1c-evidence.md).
- **Verification:** combined `./dev exec pnpm check:pbx-nodes`, durable/process regressions, full `./dev check`, all 12 shared UI tests and final `--browser` selection passed, exit 0. Real AMI/SIP, disconnect/reconnect, ownership/freshness and reference/target recovery are separated from injected faults and synthetic second-target evidence. Final maximum-name/keyboard/axe/reflow and secret-exclusion checks passed.
- **Cleanup/runtime:** exact task database/Redis/PBX fixtures removed; existing installation/catalog/material/tenant routes retained. Both normal HTTPS supervisors restored ready and network checks passed; backend live/ready HTTP 200. An older October 7 disposable database without PBX schema was identified read-only and preserved.
- **Approval/boundary:** existing scoped G-01/G-02 and conditional G-01–03 local-development approvals unchanged. One real controlled installation was tested; production deployment/secrets/HA/capacity and strict PBX-side read-only enforcement remain unapproved. Registry save establishes neither live apply nor tenant voice readiness.
- **Handoff:** P3-U2 consumes canonical node/installation identity, safe registry/observation ports and freshness/coverage semantics. P3-U5 must deliver external stale-epoch fencing and ordered configuration revisions; a pre-call database check cannot revoke an issued PBX command. Tenant allocation/activation and the remaining Phase 3 gate stay incomplete.
- **Documentation:** guide/contracts/runbooks/index, every parent criterion, local links, consistency and whitespace reconciled. Historical intermediate checkpoints are archived; final results are authoritative.

| Unit | Status | Boundary and acceptance |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | complete | A-01–07; [registry evidence](../docs/status/p3-u1a-evidence.md). |
| [P3-U1b — Fenced Asterisk observation and recovery](feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md) | complete | B-01–09; conditional development approval; [observation evidence](../docs/status/p3-u1b-evidence.md). |
| [P3-U1c — Operator PBX browser journey and integrated handoff](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | complete | C-01–07 and parent AC-01–11; [combined evidence](../docs/status/p3-u1c-evidence.md). |

### Prerequisites for dependent P3-U1 work

| Gate | Required condition and resume evidence |
| --- | --- |
| G-01 — Controlled observation environment | Resolved for isolated development: existing Asterisk 22.10.1, verified private AMI-TLS and cleaned-up no-call registration fixtures. AMI `system` is broader than read-only; the application enforces its fixed allowlist. Production PBX-side enforcement remains unapproved. |
| G-02 — Secret resolution | Resolved for isolated development: protected exact-file provider/opaque aliases, dedicated telephony mounts and fresh lookup on reconnect/rotation verified. Production secrets management requires separate review. |
| G-03 — Observation policy | Resolved for isolated development: approved validated limits, complete reconciliation and passive stale/historical/unknown semantics verified. Exact values are in the b contract/evidence; production capacity/HA/recovery requires separate review. |

Resolve only the gate portions needed by the current child. Routine SQL/routes/
adapter choices follow existing conventions. Routing/reload/active-call policy
remains with later units; P3-U5 must prove external stale-owner fencing before
live apply is enabled. Missing live access cannot be replaced by simulator evidence.


## Recent Session Notes

- 2026-10-15 (Asia/Manila, +08:00) — Prepared [P3-U2a inventory/profile contract review](../docs/planning/p3-u2a-inventory-contract-review.md) with recommended number/range/leading-zero rules, node-scoped immutable profile versions, contact/media defaults, generated endpoint/auth/AOR namespace, disabled/unset initial stock, bulk/retry bounds and b/c handoffs. G-01 and applicable G-03 decisions await user approval; implementation remains planned. Documentation consistency, local links and whitespace checked; no runtime verification claimed.

- 2026-10-15 (Asia/Manila, +08:00) — User adopted the P3-U2 a → b → c split and requested separate child specs. Created [a — inventory/profiles/atomic bulk](feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md), [b — protected credential lifecycle](feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md) and [c — browser/integrated handoff](feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md), with child acceptance matrices and parent coverage. All remain planned; implementation has not started and policy gates are not approved by spec creation. Documentation consistency, coverage, links and whitespace reviewed.

- 2026-10-15 (Asia/Manila, +08:00) — Prepared and reviewed the P3-U2 feature spec using Phase 3, delivered P3-U1 contracts and the user-supplied working Asterisk reference. Recommended three sequential children: inventory/profiles/atomic bulk API, protected credential lifecycle, then browser/observation/integrated handoff. No child implementation or split adoption claimed. Applicable number/profile, credential provider/handoff and runtime identity/coexistence decisions remain required; live apply/allocation/assignment stay with later owners. Documentation consistency/link/whitespace review only.

- 2026-10-15 09:32 +08:00 (Asia/Manila) — Completed P3-U1c and parent P3-U1 after combined real-service/browser/ownership acceptance, durable/process regressions, full Docker graph, shared UI and final maximum-name browser checks. Exact owned fixtures removed; older unrelated database preserved. Normal platform/staff HTTPS ready, their network checks passed and backend live/ready returned 200. P3-U2/U5 handoff documented; configuration apply, tenant voice readiness and production remain incomplete.


## P3-U2b preceding implementation checkpoints — archived 2026-10-16 10:49 +08:00

Historical intermediate states before final acceptance; superseded by the current [tracker](progress-tracker.md) and [final evidence](../docs/status/p3-u2b-evidence.md).

### In Progress

P3-U2b — protected endpoint credential lifecycle and recovery. Started
2026-10-16 (Asia/Manila, +08:00), under the user's conditional approval of
[sections 2–6 and G02-01–10](../docs/planning/p3-u2b-credential-contract-review.md).
Scope: private persistent TLS OpenBao, protected asynchronous setup/reset/status,
exact-generation recovery and conservative cleanup; no delivery or live PBX apply.
Required completion: B-01–07, real provider/PostgreSQL/Redis/HTTP A/B denial,
concurrency/recovery checks, regressions, full Docker graph and updated handoffs.
Current checkpoint: approval/architecture/runbooks synchronized; private OpenBao
2.7.1 pinned by digest, persistent Raft and verified TLS provisioned, manually
unsealed, declarative HMAC audit enabled, initialization root revoked. Added
operation/generation migration, strict safe API/controller, provider CAS adapter,
worker preflight/final authority/version fences, filtered shared-queue claims and
trusted maintenance. Real inventory and partial credential API checks passed on
PostgreSQL/Redis/HTTP A/B; custody/file and anonymous provider denial passed after
separating UID 1003. The full Docker graph is being rerun after fixing safe-error
lint and private-custody formatting traversal. [Incomplete evidence](../docs/status/p3-u2b-evidence.md).
The user explicitly approved isolated development administration recovery after
initial automatic-review rejection. Recovery completed: orphan scoped administrator
created, recovered root revoked, protected listener settings restored and provider
manually unsealed. Real provider acceptance is running; no completion claimed.

### Current Unit Checkpoint — P3-U2b

- **Status:** in progress; 2026-10-16 (Asia/Manila, +08:00).
- **Requirement:** [B-01–07](feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md); [implementation evidence](../docs/status/p3-u2b-evidence.md).
- **Delivered source:** retained operation/generation metadata, safe platform API, OpenBao CAS adapter, filtered dedicated worker, transaction/authority/version fences and trusted recovery/cleanup.
- **Verified:** final real-provider credential suite passed, exit 0: PostgreSQL/Redis/HTTP A/B, two production workers, setup/reset, authority/version/replay fences, real provider/COMMIT/HTTP loss, seal/token/restart/audit/database/cleanup recovery and actual-material scans. Exact 26-generation teardown passed (25 destroyed, one absent); disposable database removed. Private administration recovery/rotation and process isolation passed.
- **Remaining:** sequential full Docker graph, evidence reconciliation and handoff. Final real queue-selection and complete inventory regressions passed, exit 0, with exact fixture cleanup. Production/delivery/live apply remain excluded.

### Previous Completed Checkpoint — P3-U2a

- **Status:** complete within conditionally approved controlled-development inventory/profile scope; 2026-10-15 15:01 +08:00 (Asia/Manila). Parent P3-U2 and Phase 3 remain incomplete.
- **Requirement:** [P3-U2a A-01–07](feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md); [final evidence](../docs/status/p3-u2a-evidence.md).
- **Delivered:** protected individual/bulk preview/create, bounded list/detail/profile APIs; node-wide canonical number reservation, immutable generated endpoint/auth/AOR identities, node-scoped immutable profile versions and explicit adoption, versioned disable/re-enable, transactional actor audit, owner/operation-scoped durable intent receipts and unallocated calling/assignment denial.
- **Compatibility/deployment:** reviewed revisioned capability declarations are deployment-owned. Additive migration and the existing controlled installation’s non-secret declaration applied successfully. No editable profiles/inventory were seeded on startup.
- **Verification:** final real PostgreSQL/runtime-grant, shared Redis and independent HTTP A/B inventory suite passed, including overlapping/non-overlapping races, audit/receipt rollback, immutable profile history, exact actor/set audit, same/conflicting intents and actual HTTP/COMMIT acknowledgment loss. Registry, isolated authority/lifecycle, staff browser, complete foundation/durability/storage/identity and final full `./dev check` passed, exit 0.
- **Regression maintenance:** foundation/audit/identity now verify exact repository migration history instead of hard-coded counts. A second-context staff-browser fixture uses its existing foreground/navigation barrier before password entry; authentication, expiry and password-clearing behavior remain unchanged. Focused and integrated checks passed.
- **Cleanup/runtime:** exact inventory PostgreSQL/Redis/session/catalog fixtures removed. Normal platform and staff HTTPS supervisors restored ready; both network checks passed. Backend live/ready HTTP 200, PostgreSQL and both Redis dependencies up. Existing identities/material/unmanaged PBX/reference configuration retained.
- **Handoff:** [API/transaction contract](../docs/architecture/extension-inventory.md), [runbook](../docs/runbooks/extension-inventory.md). b must authorize and call `InventoryVersionPort.lockUnallocated` on the same transaction before approved credential/version/audit changes; c receives safe DTOs, dependency tokens and explicit uncertainty recovery. G-02/b, c’s live mapping/browser, P3-U5 apply and P4 calling eligibility remain separate.
- **Approval limits:** initial 1000–899999 convention, node-scoped profiles, removeExisting=false and generated namespace are approved only within the recorded conditional development scope. Shorter municipal plans need explicit policy revision; production transport/media/contact recovery needs separate review. Saving/enabling grants no credentials, live installation, readiness or calling eligibility.


### Recent Session Notes

- 2026-10-16 (Asia/Manila, +08:00) — Started P3-U2b under the user's conditional sections 2–6/G02-01–10 approval. Added provider/lifecycle source and synchronized documentation. Real partial API/inventory/isolation checks passed; provider administration recovery was rejected by automatic approval review and requires an explicit decision. Full real-provider acceptance remains incomplete; see linked evidence.

- 2026-10-16 (Asia/Manila, +08:00) — Prepared the [P3-U2b G-02 credential contract review](../docs/planning/p3-u2b-credential-contract-review.md) with recommended decisions, explicit new-provider/process approval, operation ordering, retention, cleanup, API and acceptance handoffs. Documentation only; user approval and real protected provider access remain required before implementation. No credential material or runtime configuration changed.
- 2026-10-15 15:01 +08:00 (Asia/Manila) — Completed P3-U2a A-01–07 under the user’s conditional approval. Delivered protected inventory/profile/atomic bulk APIs, immutable identity/version contracts, audit/receipts and exact b transaction handoff. Real-service focused checks, affected regressions and full Docker graph passed; fixtures removed, normal HTTPS restored ready, health 200. [Evidence](../docs/status/p3-u2a-evidence.md) records commands, fixes and limits. Credentials, c browser/live mapping, live apply and production acceptance remain separate.


## 2026-10-16 — P3-U2c implementation checkpoints (historical)

The following records preceded final c/parent acceptance and remain historical.

## In Progress

- **P3-U2c — Operator inventory browser and integrated handoff:** in progress, 2026-10-16 (Asia/Manila, +08:00).
- **Requirement:** [C-01–07](feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md), integrated parent AC-01–11.
- **Scope:** named protected forwarding, inventory/profile/credential browser workflows, operator-bound mounted recovery, passive exact observation composition, browser and real-service acceptance, guides and evidence.
- **Checkpoint:** implementation resumed under user conditional approval on 2026-10-16 (Asia/Manila, +08:00). Required context and a/b/browser interfaces reviewed; prepared [G-03 runtime mapping and controlled acceptance review](../docs/planning/p3-u2c-observation-mapping-contract-review.md) at the user’s request. G03-01–06 and sections 2–6 approved with explicit preservation, exclusive access, baseline, recovery and cleanup conditions. Implementation/testing authorized only on the existing private development installation. No new acceptance passes yet.
- **Gate:** G-03 conditionally approved by the user. Before any fixture reload/stop/start, verify exclusive access, no operational calls/conflicting activity, baseline and documented recovery. Identity collisions, uncertain ownership or failed cleanup/restoration stop dependent acceptance. c and parent P3-U2 remain incomplete until all criteria and evidence pass.
- **Documentation checks:** 248 local link targets across five affected Markdown files, six decision IDs/acceptance coverage and `git diff --check` passed; docs index Prettier check passed. Context/planning files are excluded by repository formatting policy. Runtime checks were not run for this documentation checkpoint.
- **Checkpoint (implementation):** exact stored node/installation/runtime-key passive composition, bounded protected forwarding, inventory/profile/credential/disable browser forms and operator-bound mounted intent recovery implemented. Backend build, platform-console typecheck and focused lint passed; injected exact-mapping checks passed. First browser run exposed a test-label mismatch; corrected, original PBX baseline/fixture absence/running state verified and lock released. [c evidence](../docs/status/p3-u2c-evidence.md) records actual outcomes. Controlled launcher now checks exclusive target lock, no calls, identity/configuration/routing baseline and private recovery manifest before fixtures; browser/live acceptance and regressions are pending.
- **Checkpoint (recovery fix):** deterministic acceptance exposed a delayed selected-extension read copying older input over newer values. Canonical reads now merge into current mounted work; credential-status callbacks are target/version/request fenced. Console typecheck and focused lint passed. Rerunning the complete browser/provider/live-service matrix; all prior attempts verified PBX baseline restoration and token/material cleanup.
- **Checkpoint (integrated browser):** `./dev exec pnpm check:extension-inventory --browser` passed, exit 0, run `a4486cd1-b84d-4348-b6bf-20bd7f296ab0`. Actual secure inventory/profile/credential flows, bulk/reset uncertainty, mounted identity recovery, live Asterisk SIP/outage/reconciliation, separately injected faults, HTTP A/B/session-Redis outage, material scans and responsive/axe/keyboard checks passed. Both generations destroyed, tokens revoked/removed, exact original PBX baseline/state/owned-object absence and lock release verified. Canonical save results now use readable operator summaries.
- **Final verification checkpoint:** combined inventory (including real credentials/browser), PBX registry/observation/browser, platform auth, durability and full `./dev check` passed, exit 0. All 12 shared UI checks and normal HTTPS restoration/health passed; a focused automatic provider-token-cleanup rerun is still running. The run-owned ledger includes restoration in finally; c/parent remain incomplete until those checks and final evidence reconciliation pass.

## Latest Completed Checkpoint — P3-U2b

- **Status:** completed within conditionally approved controlled private development; 2026-10-16 10:49 +08:00 (Asia/Manila). Parent P3-U2, c and Phase 3 remain incomplete.
- **Requirement:** [B-01–07](feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md); [final evidence](../docs/status/p3-u2b-evidence.md).
- **Delivered:** private persistent verified-TLS OpenBao, retained generation/operation metadata, protected asynchronous setup/reset/status, exact intent recovery, dedicated installation-scoped worker, atomic authority/version/association/audit fences and trusted bounded requeue/cleanup.
- **Verification:** real OpenBao/PostgreSQL/runtime grants/Redis/HTTP A/B and two production worker processes passed setup/reset, replay/races, lost provider/HTTP/COMMIT replies, revocation/session continuation, restart/seal/token expiry, database/audit rollback, late preparation and interrupted cleanup. Actual-password scans and worker/cleanup/process security denials passed. Final full credential, queue-selection and inventory regressions plus `./dev check` passed, exit 0.
- **Cleanup/runtime:** exact 26-generation final fixture teardown accounted for 25 destroyed/one absent; metadata retained, disposable database/Redis/worker fixtures removed. Root recovery was explicitly user-approved, recovered root revoked and protected listener restored; scoped administrator rotation passed. Backend live/ready 200; normal platform/staff HTTPS checks passed. Both endpoint networks remain internal.
- **Handoff:** [safe API/transaction contract](../docs/architecture/endpoint-credentials.md), [deployment/recovery runbook](../docs/runbooks/endpoint-credentials.md). c receives safe asynchronous status and immutable intent recovery; P3-U5 receives exact generations and retained dependency history.
- **Deferred approval:** production HA, key custody, joint backup/recovery, token/operational security, worker provider scope and credential retirement/retention/secure destruction. Phone delivery/revelation, live PBX application/revocation and tenant calling readiness remain outside b.

## 2026-10-20 — Named custodian capability checkpoint closed

Archived 2026-10-20 (Asia/Manila, +08:00) following owner acceptance of the
completed second session. These intermediate entries retain their original
checkpoint status; the scoped verification is now closed successfully. Neither
session authorization can be reused. Full inventory/backup readiness remains
unestablished, and P3-U3a remains incomplete.

- **Second limited session completed — 2026-10-20 (Asia/Manila, +08:00):** separately authorized one additional attended session after complete disposable native-TLS corrected-identity/full-workflow verification (nine synthetic groups plus exact native login/self-lookup/ten-path batch/revoke/403 passed). Rechecked exact protected custody/isolation; retained session 15:46:06.360–15:46:07.340 +08:00, **one login, one batch, all identity/lifetime checks and ten capability comparisons matched, zero differences**. Snapshot, maintainer-policy self-edit and entity/group listing denied as expected; issuer-policy maintenance/policy-role-accessor list/auth read matched. Self-revoke acknowledged and final lookup **403**, helper removed. Both limited login authorizations consumed; no further login/retry or retained remediation authorized. [Expected/observed report and limits](../docs/status/p3-u3a-retained-capability-session-2.md). Separate backup/maintenance authority remains **unknown, not absent**. Native disposable 500 and 43–650 ms expiry-overrun failures preserved; full diagnostic exit 1, scoped verification gate passed and exact fixture cleanup verified. Independent inactive local replacement candidate implemented with 25 passing synthetic lifecycle groups; real provider/custody/restart integration remains outstanding.

- **Custodian handoff follow-up / single session consumed — 2026-10-20 (Asia/Manila, +08:00):** identified one final file line ending as the only incompatibility; October 19 execution already documented omitting this framing from its maintenance copy. Shared parser preserves the same credential alphabet/length and original file/account bytes; synthetic/parser/helper scope checks passed (28 preparation tests), lint/format passed. Existing protected handoff reused after exact isolation/custody checks. **One login** at 15:25:43 +08:00 succeeded; username/path/sole policy/no identity policies/no period/orphan/service/TTL/900-second maximum checks passed, but the verifier's display-name expectation differed (disposable follow-up confirmed an incorrect default-prefix assumption in the local check; corrected without another retained session). Stopped before capabilities (**zero batches**); self-revoke acknowledged and final lookup **403**, helper removed. No retry authorized: single-login approval consumed. [Sanitized cause/session findings](../docs/status/p3-u3a-custodian-handoff-followup.md). Backup/maintenance availability stays **unknown, not absent**. Owner accepted stable backup identity/separately controlled attended maintenance as preferred architecture for further design review only; no implementation or retained remediation authorized.


## 2026-10-23 — P3-U3 superseded design and operational checkpoints

Historical work before the owner's development simplification. These observations
remain evidence; earlier next-step/acceptance gates are superseded by the
[current replacement spec](feature-specs/p3-u3-development-resource-management.md).

## In Progress

- **Administrator local failed-operation inspection complete — 2026-10-23 (Asia/Manila, +08:00):** owner ran the read-only inspector for `ec0b8e2d-49d9-45e3-930e-6b769b58f103`. [Exact report](../docs/status/p3-u3a-backup-operation-local-inspection.json). Six-event journal ends at scoped capture start; snapshot/encrypted/spool/receipt outputs empty, staged audit only (2 files / 477,406 bytes), no upload stage recorded. Capture attempt has no result/cleanup receipt. This establishes local failure progress, not token cleanup, successful backup or permission to retry. Pending state and all outputs preserved. Next implementation is a new guarded, source-bound single-mount TTL correction package with a fresh backup route and administrative authority gate, followed by evidenced closure and verified maintenance replacement; consumed bootstrap approval cannot be reused. [Repair guidance](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-secretid-ttl-correction.md). No further owner diagnostic command required for this local checkpoint; scheduling inactive; **P3-U3a incomplete**.

- **Pending capture evidence recorded / read-only inspector implemented — 2026-10-23 (Asia/Manila, +08:00):** owner reported only capture attempt `f581c3c3-b082-468c-a8f5-40083f0df9fe` at `2026-10-22T23:54:11.850Z`, no cleanup result in supplied listing. [Owner evidence](../docs/status/p3-u3a-backup-capture-attempt-unconfirmed.json). Cleanup remains unconfirmed; this does not establish an active token. Added administrator-only local inspector for exact pending operation, journal and output metadata, with strict custody/schema/symlink checks and no credential/snapshot contents, provider/repository access, pending mutation or retry authorization. **6/6** focused checks passed; actual administrator run pending. [Single command and repair gates](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-secretid-ttl-correction.md#pending-evidence-checkpoint--october-23-2026-0800). Retained TTL correction/guarded package, attended closure/replacement and routine backup acceptance remain open; scheduling inactive; **P3-U3a incomplete**.

- **Retained run-now cause confirmed / local age check corrected — 2026-10-23 (Asia/Manila, +08:00):** owner status pins pending operation `ec0b8e2d-49d9-45e3-930e-6b769b58f103` to snapshot helper refusal. Agent read-only audit projections show initial SecretID actually issued for **300 seconds**, not requested 30 days, and next-day AppRole login error before snapshot retrieval. Exact pinned OpenBao disposable probe reproduces mount-ceiling clipping; proposed 720-hour mount maximum with role token ceilings unchanged proves 30-day/1,000-use SecretID, 300-second workload lease/explicit maximum, restore denial and revoke/403. Fixtures removed. [Diagnosis](../docs/status/p3-u3a-backup-secretid-expiry-diagnosis.json); [exact correction and execution gates](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-secretid-ttl-correction.md). Local status/capture cutoff now respect actual bootstrap mount-bound lifetime; **14/14** focused tests pass. No retained API/configuration/credential write, retry or pending removal; previous backup preserved. Next reconcile exact pending files and prepare a separately approved guarded single-mount tuning package before verified replacement; consumed bootstrap authority cannot be reused. Scheduling inactive; **P3-U3a incomplete**.

- **First retained run-now unconfirmed — 2026-10-23 (Asia/Manila, +08:00):** owner supplied `operation-unconfirmed` / `details-suppressed`, automatic retry false and scheduling inactive. [Exact output](../docs/status/p3-u3a-backup-operations-run-now-unconfirmed.json). No completion, failure phase, provider/repository effect or token cleanup can be inferred from this output. Agent has not retried or cleared pending state. Protected evidence requires interactive sudo; next owner command is read-only administrator `status`, then inspect the exact operation if present. Routine backup/rotation acceptance remains open; **P3-U3a incomplete**.

- **Retained administrator status checkpoint passed — 2026-10-23 (Asia/Manila, +08:00):** owner-reported status confirms host metadata verified, bootstrap credential generation, no pending/last routine operation, no age cutoff/reminder and no attention flag. Last successful backup remains the owner-verified bootstrap snapshot. [Exact report](../docs/status/p3-u3a-backup-operations-admin-status.json). This is metadata-only, not fresh provider login/repository access or routine backup/rotation acceptance. Next: attended `run-now --execute`, inspect its sanitized result before rotation; preserve any failed/pending operation and do not automatically retry. Scheduling inactive, readiness incomplete; **P3-U3a incomplete**.

- **Owner Windows archive verification complete — 2026-10-23 (Asia/Manila, +08:00):** owner supplied successful `independent-archive-integrity-verified` output at 07:48:47 +08:00 using Node v24.22.1 and existing backup identity `C:\MyIMS-Recovery\myims-age-identity.txt`. Report matches the pinned request/repository/post-install snapshot and both archive identities; native snapshot integrity and 5,593 audit JSON records passed, with no plaintext output or provider/repository access reported. [Exact owner report](../docs/status/p3-u3a-owner-archive-verification.json); [Windows key/escrow-copy/verification paths](../docs/runbooks/p3-u3a-independent-archive-verification.md#recorded-windows-locations). Private key stayed on Windows; agent did not handle it. OS-level network disconnection, Windows ACL audit and encrypted-key-copy recoverability were not independently established. Owner-copy/decryption checkpoint is complete; earlier pending descriptions below are historical. Next: attended retained command acceptance starting with administrator status, then coordinated recovery and operational gates. Native retained restore, sealed-checksum cryptography, audit continuity, joint PostgreSQL recovery and achieved RPO/RTO remain unproven. Scheduling inactive; **P3-U3a incomplete**.

- **P3-U3a isolated joint recovery rehearsal — fixture implementation complete, 2026-10-22 (Asia/Manila, +08:00):** actual SQL migrations/owner foundation seed, hash-bound quiescent paired PostgreSQL dump/native Raft capture, synthetic age encrypt/decrypt, native pg_restore and separate TLS OpenBao force-restore/restart/source-seal checks now pass. Restored owner/audit rows and SQL read/escalation denials preserved; fresh bounded read-only auth and all known transported-session lookup/revoke/403 checked. Correct pair matches cancelled reservation provenance with runtime use always false; mismatched checkpoint rejects pre-restore, dedicated negative native clone detects KV version drift/orphan and source stays unchanged by restoration. **11/11 native**, **8/8 focused** passed; exact ownership-label cleanup and all source bindings verified, all 67 consumed-bootstrap artifacts preserved. [Evidence, commands and limits](../docs/status/p3-u3a-isolated-joint-recovery.md). No retained services/keys or application changes, scheduling inactive. This is trunk-owner-foundation fixture proof, not retained restore, complete application/lease/transaction-fence recovery, sealed-checksum crypto, active credential reconciliation or achieved RPO/RTO. Owner off-host verification, retained command acceptance, actual coordinated checkpoint/recovery/operational gates and existing lifetime/HTTP/browser/trunk/gateway acceptance remain open; **P3-U3a incomplete**.

- **Retained ciphertext export and owner custody verified — 2026-10-22 (Asia/Manila, +08:00):** owner completed read-only export `f870564b-45b5-4b34-a5c9-949df4a35194` for pinned post-install Restic snapshot `c51f8a679a86d29265af9b4588b1f76d537e7cacb09ce1bc75e660bd60015324`. Independent local verification matched all five request/ciphertext/receipt hashes and ciphertext lengths; owner UID/GID 1002, directory 0700, regular single-link files 0600. No private key, decryption, plaintext or provider access in this verification. [Evidence](../docs/status/p3-u3a-retained-verification-export.json); [filled-in next Windows copy/offline commands](../docs/runbooks/p3-u3a-independent-archive-verification.md#owner-run-offline-verification). Preserve source and export; no rerun needed. Owner off-host copy/decryption, native restore/joint PostgreSQL reconciliation and operational acceptance remain pending. Scheduling inactive; **P3-U3a incomplete**.

- **P3-U3a independent archive verification — implementation complete within disposable acceptance, 2026-10-22 (Asia/Manila, +08:00):** added source/hash-bound installation-checkpoint request, default-plan exact-snapshot read-only ciphertext export, exclusive private owner handoff and portable offline in-memory age snapshot/audit verifier. No extraction/plaintext output, provider or owner-key access on this server. Strict file/receipt/request/member/hash checks; wrong-key/tamper/link/traversal failures reject. Focused Node **8/8**, host **5/5**, native TLS/Raft OpenBao + TLS append-only Restic/export/offline decrypt **12/12** passed with all fixture keys/resources/watcher removed and exercised sources unchanged. All 67 consumed bootstrap artifacts preserved. [Evidence](../docs/status/p3-u3a-independent-archive-verification.md), [exact next command and owner instructions](../docs/runbooks/p3-u3a-independent-archive-verification.md). Actual administrator custody/export and owner Windows/off-host decryption remain pending (interactive sudo required); native restore/sealed-checksum cryptography, audit continuity, joint PostgreSQL/generation reconciliation and measured recovery/operational readiness remain unproven. No schedule, production or retained provider/repository modification; **P3-U3a incomplete**.

- **P3-U3a backup operator commands — implementation complete within disposable verification, 2026-10-22 (Asia/Manila, +08:00):** delivered status, explicit plan/execute run-now, attended replacement-before-retirement rotation, shared lock, fsynced pending/no-retry fence, private atomic generation adoption, conservative day-23/day-30 age checks, last-successful-backup preservation and local sanitized failure records. Unprivileged status explicitly reports hidden runtime state requires administrator; no credential reads/provider API. Final same-code TLS/Raft OpenBao + authenticated TLS append-only Restic rehearsal **14/14**, host state/fault tests **11/11**, rotation contracts **6/6**, existing package/controller/bridge **17/17** passed; fixture cleanup/source binding and scoped lint/format/syntax/links passed. All 67 consumed bootstrap artifacts unchanged. [Commands, evidence and limits](../docs/status/p3-u3a-backup-operations.md). No retained backup login/rotation/upload or schedule activation during implementation. Actual administrator custody/retained command acceptance, independent fresh decryption/joint recovery and alerts/capacity/rotation acceptance remain before scheduling. Existing lifetime/HTTP/browser/trunk/gateway acceptance remains open; **P3-U3a incomplete**.

- **Guarded bootstrap and password handoff complete — 2026-10-22 (Asia/Manila, +08:00):** owner reported successful exact administrator handoff for operation `d6550071-561a-4339-bc15-50a5b22ac43d`, with protected source preserved and no password printed. Independent metadata-only verification confirms approved UID/GID 1002, parent 0700, regular single-link file 0600; password not read, no provider access. [Separate handoff evidence](../docs/status/p3-u3a-bootstrap-maintenance-handoff.json) preserves the original execution record. All 67 pinned source hashes still match. Bootstrap scope is complete and consumed; do not rerun staging/executor/handoff. [Current guidance](../docs/status/p3-u3a-bootstrap-retained-execution.md): next implement status/run-now/attended rotation interfaces and failure reporting without schedule activation, then independent fresh decryption/joint recovery and operational acceptance. No timer/production activation; existing lifetime/HTTP/browser/trunk/gateway work remains open. **P3-U3a incomplete.**

- **Retained bootstrap installed; two backups retrieved — 2026-10-22 (Asia/Manila, +08:00):** owner approved corrected digest `76ac9c1e4e280427145290dbd08569175e3b618486ef094ef93e1bb7e5d2fbc4` and prepared staging. One guarded operation `d6550071-561a-4339-bc15-50a5b22ac43d` passed current-state/88-read semantic review, fresh encrypted pre-change upload/retrieval before writes, all nine exact acknowledgments and ten host checks, native readback/maintenance acceptance, root revoke/403, normal TLS/405 restoration in **43.496s**, guard cancellation/restart restoration/helper removal, and scoped post-install snapshot plus separate audit upload/retrieval into a distinct Restic snapshot. All 67 pinned source artifacts remain unchanged; final normal provider metadata verified. Request consumed; **do not rerun executor/staging**. Administrator password handoff still requires owner interactive sudo; [exact command, evidence and next guidance](../docs/status/p3-u3a-bootstrap-retained-execution.md). No timer/production/application changes or deletion. Next: complete protected handoff, status/run-now/attended rotation interfaces, independent decryption/joint recovery and operational acceptance; existing lifetime/HTTP/browser/trunk/gateway acceptance remains open. **P3-U3a incomplete.** Earlier pending-execution checkpoints below are historical.

- **Administrator staging refusal corrected — 2026-10-22 (Asia/Manila, +08:00):** `unsafe_parent` came from a staging-helper assumption conflicting with the installed backup root (UID/GID 12010, mode 0700). Read-only metadata confirms only an empty root-owned `bootstrap` parent was created; both operation directories remain absent. Helper now permits only the exact private service ancestor and validates all ancestors before mkdir; **7/7** focused package/staging tests passed. Only the staging source hash changed; paths/provider writes/guard remain unchanged. New review digest `76ac9c1e4e280427145290dbd08569175e3b618486ef094ef93e1bb7e5d2fbc4`; original digest-bound approval preserved, retained/root flags held false pending acceptance of correction. Owner should rerun the same staging command, then agent verifies current state and continues after corrected-package acceptance. [Diagnosis and scope](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-bootstrap-execution-request.md#staging-parent-check-correction--october-22-2026-0800). No provider/root/provisioning action; **P3-U3a incomplete**.

- **Exact bootstrap approved; administrator staging pending — 2026-10-22 (Asia/Manila, +08:00):** owner explicitly approved [the concrete one-time execution request](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-bootstrap-execution-request.md) for operation `d6550071-561a-4339-bc15-50a5b22ac43d`, package `07907f91e232a093bd0d125413995d03c8099fa0ae887c5232c9859338eacc85`. Approval is recorded against that unchanged digest in the manifest; public package validation passed. Interactive sudo authentication is required (`sudo -n true` failed), so the owner must run the exact administrator staging command in the request. Staging remains unprepared, approval unconsumed, attended execution window unopened; no provider isolation/root/provisioning/repository action has started. Once staging exists, verify metadata/current state, open the bounded window and run the approved launcher without asking for approval again. **P3-U3a incomplete.**

- **Retained bootstrap wiring / post-install backup package — 2026-10-22 (Asia/Manila, +08:00):** completed shared host ports, existing-repository read-only gate, semantic 59-policy/full-role/identity review, ten per-operation stdio host guard/source/candidate/freshness checks, separate snapshot/maintenance custody, administrator-only staging/handoff, scoped post-install encryption and exact independent upload/retrieval. Focused regressions **38/38** backup, **24/24** authority/guard and **15/15** host checks passed; public package validation has no provider/custody access. Same-code native success **9/9** and real-write/lost-response **9/9** passed with existing custodian entity/alias, root revoke/403, protected TLS/405 restoration and complete cleanup. New source-bound [disabled operation manifest](../infra/backup/bootstrap-request.json) and [one-time execution request](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-bootstrap-execution-request.md) are concrete; [evidence and limits](../docs/status/p3-u3a-bootstrap-host-wiring.md). No retained provider/key/repository action; only hash-bound historical inventory policy-hash extraction offline. Remaining execution requires the plan's separate digest-bound guarded-root approval and administrator fresh staging, then current-state preflight and attended execution. No timer or production activation. Independent fresh decryption/joint recovery and existing lifetime/HTTP/browser/trunk acceptance remain unfinished; **P3-U3a incomplete**.

- **Guarded bootstrap controller core and native rehearsal — 2026-10-22 (Asia/Manila, +08:00):** owner authorized continued implementation/rehearsal. Added inactive backup-proof gate, closed-prior-label validation, exclusive fsynced journal and cleanup/containment controller; nine-exact-path provisioning core pins pre-state data hashes, journals before-send/ack separately, rechecks freshness and protects SecretID/password outputs. Native synthetic TLS/Raft/append-only Restic harness exercises recovery, pre-change encryption/upload/retrieval before writes, exact provisioning and protected restoration/scoped post-install snapshot. Current-source native success **9/9** and real-write/lost-response **8/8** passed, with root revoke/403, protected TLS/405 restoration and exact cleanup. **7/7** controller and **4/4** provisioning fault groups passed; independent native deadline/interruption acceptance passed. [Evidence, commands and limits](../docs/status/p3-u3a-bootstrap-controller.md). No retained service/custody/repository access or activation. Retained host adapters/semantic authority review, per-write guard-health bridge, protected outputs and post-install encrypted upload/retrieval still required before concrete execution approval. **P3-U3a incomplete.**

- **Current installer-route review / guarded-bootstrap preparation — 2026-10-22 (Asia/Manila, +08:00):** owner reapproved next-step plan and continuation. One fresh retained read-only custodian session verified identity, **31 exact capability paths**, fourteen role bodies and two issuer policy hashes; sole session revoked/403 in **1.13 seconds**, helper/public trust removed. All backup and rotation installation paths deny; no direct installer established, other credentials remain unknown. Fourteen roles match nine configured fields; six native response fields/aliases and user/identity composition still need root-only review. Both readable policies match captured pre-state, not constrained replacements. Focused review/bootstrap-plan/custodian regressions passed **15/15**, with scoped lint/format, source hashes and link checks. Pinned disposable TLS/Raft fixture passed **8/8 assertions**, including exact 21-request audit; initial documented role-capability expectation corrected before retained access. Added fail-closed offline [nine-write guarded-bootstrap preparation](../docs/planning/p3-u3a-guarded-bootstrap-preparation.json) and [current evidence/controller handoff](../docs/status/p3-u3a-current-installer-route.md). No retained policy/auth/role/user write, root recovery, restart, snapshot or scheduling. Next: implement/rehearse a new backup-first guarded controller; old capture controller/approval cannot be reused (consumed operation, initialized repository, prior closed label and different ordering). Exact root execution remains gated by that concrete preparation and separate bootstrap approval. **P3-U3a incomplete.**

- **Approved simpler backup model / exact rotation candidate — 2026-10-22 (Asia/Manila, +08:00):** owner approved [next-step direction](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-authority-next-step.md); `gino` is the attended operator/rotation owner, existing custodian preserved. Added offline hash-bound [exact three-policy remediation and separate rotation-only candidate](../docs/planning/p3-u3a-backup-maintenance-review.json), fail-closed generator and artifact-regeneration checks. Pinned disposable OpenBao 2.7.1 native ACL/AppRole/userpass verification passed **12/12 groups** with exact fixture/network cleanup: all fourteen exact role issuances under the three replacement policies, fixed 30-day/1,000-use rotation issuance, rejected overrides/extras, denied installer/material/restore operations, 900/300-second human/workload bounds, replacement-before-retirement, old-login denial and self-revoke/403. Initial candidate representation failures corrected and documented. [Evidence, commands and limits](../docs/status/p3-u3a-backup-maintenance-review.md). No retained login, credential read, write, root recovery, timer or custodian change. Current independent installer route/complete effective authority and fresh backup-first evidence remain required before retained installation; joint recovery, alerts/capacity and exact host acceptance precede scheduling. Existing lifetime/HTTP/browser findings remain open; **P3-U3a incomplete**.

- **Offline captured-authority review and operational handoff — 2026-10-22:** owner authorized the recommended read-only review and development/operations/maintenance documentation. Pinned network-disabled helper verified the captured inventory's exact SHA256/operation without credentials or provider requests. Ten installation-specific policy bodies match current generators; fourteen roles match only the explicitly compared fields. Three privileged policies differ substantively: captured endpoint/trunk issuer and custodian token-create grants lack the proposed required/allowed parameter constraints (six/six/two unconditional grants). No current effective authority or direct installer route established; user/identity mappings and complete role aliases remain unverified. Added repeatable offline reviewer and focused tests, sanitized hash-bound [review evidence](../docs/status/p3-u3a-captured-authority-review.md), [operations/maintenance runbook](../docs/runbooks/p3-u3a-development-backup.md), and [disabled minimal installation proposal/work items](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-authority-next-step.md). Next: reconcile exact privileged-policy changes, establish separately authorized installer/current capabilities and rotation ownership, then prepare concrete execution scope. No login, policy/auth/role mutation, recovery, scheduling or cleanup; prior capture/upload authorization stays consumed. **P3-U3a incomplete.** Earlier checkpoint descriptions below are historical and do not reopen completed capture/transfer work.

- **Approved development capture/upload request complete — 2026-10-22 (Asia/Manila, +08:00):** owner reported both ciphertext handoffs; independent offline spool verification matched exact four files, both original ciphertext hashes, capture operation and UID/GID 12010 mode-0600 custody, with no prior upload receipt. One durably fenced upload through the pinned file-credential client on the isolated TLS repository network committed Restic snapshot `e259689800a00c5a42109a9c8e72a49a6a908bc659ea79a3f9dc0b1ca0d10582` (receipt `42aec76d-652e-4150-94a1-31c26910e02e`). Read-only `--no-lock` reconciliation verified repository ID, exact four-file snapshot contents and retrieved SHA256/length for both ciphertexts and both receipts; no decryption, repository writes during verification or OpenBao API access. Exact upload/verifier helpers removed; provider Docker metadata remains normal. [Complete operation evidence](../docs/status/p3-u3a-development-capture-execution.json), [completed request and acceptance boundary](../docs/planning/p3-u3a-development-recovery-capture-request.md#captureupload-request-complete--october-22-2026-0800). Root/init/capture/upload request is consumed and closed; no further mutation or cleanup is authorized by it. Plaintext staging, ciphertext spool, receipts, closed host intents/config/source and deadline record remain accounted for. Fresh age decryption/off-host recovery, isolated native restore coordinated with PostgreSQL and credential-generation reconciliation, measured RPO/RTO, current effective-authority review before identity provisioning, ongoing backup operations and trunk/gateway/lifecycle/HTTP acceptance remain unfinished. Existing renewal HTTP 500/expiry/lifetime/browser findings preserved. **Capture/upload request complete; P3-U3a incomplete**.

- **Retained development capture completed; ciphertext handoff pending — 2026-10-22 (Asia/Manila, +08:00):** executed approved operation `24096f3d-bf41-4ec2-9e12-95e2057c115d` after current-source native controller and retained-host preflight passed. Exact Restic repository initialized once and verified empty (version 2); retained seal usability verified by approved one-shot unseal. One root-generation attempt produced the native snapshot/seven-file metadata capture. Same-operation finisher cancelled generation, revoked root and verified lookup 403. Protected HCL/TLS/mounts/normal network restored; one-shot restoration unseal, active health and anonymous generation 405 passed before guard cancellation. Measured isolation-to-protected-restoration **25.356 seconds** against 840-second maximum; this is not joint disaster-recovery RTO. Original restart policy restored in place; closed operation label retained, root helper and temporary recovery network removed, detached watcher exit independently verified. Complete capture and separate post-cleanup audit encrypted offline to existing backup recipient; ciphertext SHA256/operation bindings and all seven source hashes verified independently, with no plaintext output. [Execution evidence](../docs/status/p3-u3a-development-capture-execution.json), [exact remaining handoff commands](../docs/planning/p3-u3a-development-recovery-capture-request.md#retained-execution-completed--october-22-2026-0800). Root recovery and repository-init approvals consumed/disabled; transfer remains authorized. Root-owned plaintext staging and closed operation records preserved pending separate cleanup. Administrator-only ciphertext handoff requires the owner's authenticated terminal; repository upload/retrieval verification has not happened. No policy/auth/role/user/SecretID provisioning, custodian, production, application, PostgreSQL/Redis or Asterisk changes. Current effective-authority review, ongoing backup identity/operations, off-host fresh-backup recovery, joint PostgreSQL/generation reconciliation and measured RPO/RTO remain pending; existing renewal HTTP 500/expiry/lifetime/browser findings preserved. **P3-U3a incomplete**.

- **Staging confirmed / attended capture controller verified — 2026-10-22 (Asia/Manila, +08:00):** owner reported exact `empty_staging_prepared`; independent mounted metadata confirms empty owned outputs, protected seal metadata, bounded audit and backup client/public-recipient custody without private contents/provider requests. Added operation-bound fsynced execution fence, no-retry one-time Restic initializer, and attended guarded controller using existing pinned helpers. Initializer regression **36/36 passed** (TLS/ACL/replay/backup/retrieval/decryption/isolated native restore); actual controller methods passed four integration groups through guarded Compose isolation/capture/root revoke/403/protected normal restoration/405/restart policy/both archives, with exact fixture/watcher cleanup. Three initializer fault groups and four sequencing groups passed. [Procedure and boundaries](../docs/planning/p3-u3a-development-recovery-capture-request.md#attended-controller-ready--october-22-2026-0800), [live operation status](../docs/status/p3-u3a-development-capture-execution.json). Retained repository/provider mutation has not started at this checkpoint; next is current-source host preflight and the already approved one operation. Ciphertext-only administrator handoff/upload/retrieval remains after successful capture. No provisioning/custodian/production/cleanup authority. **P3-U3a incomplete**.

- **Approved development recovery capture / staging prepared; host preflight in progress — 2026-10-22 (Asia/Manila, +08:00):** owner approved the development native-backup/current-metadata capture request, including its bounded root recovery and one-time repository initialization scope; no identity provisioning, custodian change, production or destructive cleanup. Added explicit root-only empty staging preparation (refuses existing/partial operations), one-shot protected TLS unseal/readiness transport, and a normal-network restoration overlay retaining the operation label and restart=no. Extended real native fixture through actual Compose replacement in both phases: **15/15 passed**, root revoke/403, TLS health/anonymous 405 before guard cancellation, seven-file archive/decryption and separate cleanup audit handoff; exact fixture and watcher cleanup verified. **8/8 custody tests and 4/4 unseal fault groups passed**, full workspace lint, changed-file formatting and retained graph rendering passed. `./dev check` stopped on pre-existing formatting issues in 19 untouched docs/evidence files; typecheck/build/entrypoint checks and 6/6 configuration tests passed separately. Retained Docker metadata matches normal image/network and running state; no retained key read/provider API/repository operation before staging. Owner now reports `empty_staging_prepared` for the exact operation; no provider/credential access or existing-object change. The staging dependency is satisfied; host execution preflight continues, root recovery remains unstarted and approval unconsumed. [Approved scope and exact administrator next command](../docs/planning/p3-u3a-development-recovery-capture-request.md#approved-continuation--october-22-2026-0800). Full host executor, repository initialization/upload/retrieval, actual retained key usability and joint PostgreSQL recovery remain unverified. Existing renewal HTTP 500/expiry/lifetime/browser findings remain; **P3-U3a incomplete**.

- **Authorized host-procedure and lifecycle continuation — 2026-10-21 (Asia/Manila, +08:00):** added inactive complete native recovery-capture packaging, independent post-cleanup audit encryption, descriptor-anchored ciphertext-only handoff, and manual-only pinned capture/archive Compose profiles. Private staging now uses separate root-owned `/srv/myims-openbao-recovery-development`, outside backup UID control. Six synthetic handoff tests and 35 archive/audit/snapshot fault checks passed; actual native recover/capture/finish plus seven-file archive/decryption and separate audit handoff passed in disposable TLS fixtures; new-image guarded Restic/isolated restore regression 51/51 passed. Retained controller unseal/empty-directory preflight and deadline ownership across Compose recreation remain before a concrete execution request. Added inactive exact-binding reservation persistence with intent/binding serialization, immutable replay and atomic audit; real PostgreSQL tests passed. Ordinary claim/exhaustion excludes both credential namespaces; three real queue isolation groups passed, including ordinary malformed-job failure; seven reservation groups passed, including caller mutation during audit. Build, scoped lint/format and exact fixture cleanup passed. [Host request and remaining gates](../docs/planning/p3-u3a-development-recovery-capture-request.md), [owner/worker boundary](../docs/status/p3-u3a-reservation-and-worker-isolation.md). No retained key/provider operation, migration, activation or privilege change. Current-authority commands, dedicated verifier/cleanup/provider composition, qualification/claim/adoption and trunk/gateway/two-HTTP APIs remain unfinished. Existing renewal HTTP 500, expiry/lifetime and browser findings are preserved; timed COMPLIANCE remains deferred. **P3-U3a incomplete**.

- **Disposable backup/recovery authority rehearsal — 2026-10-21 (Asia/Manila, +08:00):** 51/51 checks passed after correcting the restore fixture's declarative audit path to match the native snapshot on an independent volume. Separate restore network could not reach source; fresh scoped authentication, original seal unseal, native restore, backup-first four-write fixture provisioning, unchanged custodian restrictions, root revoke/403, protected configuration/405 restoration and independent deadline guard passed. Exact fixture/watcher cleanup verified. [Evidence and limitations](../docs/status/p3-u3a-backup-authority-preparation.md#disposable-recovery-authority-rehearsal--october-21-2026-0800). Both owner-reported Windows recovery packages are verified. [Capture-only request](../docs/planning/p3-u3a-development-recovery-capture-request.md) remains a disabled draft pending concrete host staging/handoff and current metadata scope review, then separate execution approval. No retained key read, provider operation or repository initialization. Actual key usability, current effective authority, joint PostgreSQL recovery and measured RPO/RTO remain pending; renewal HTTP 500, expiry/lifetime and browser findings remain unresolved. **P3-U3a incomplete**.

- **Separate OpenBao seal custody handoff — 2026-10-21 (Asia/Manila, +08:00):** owner Windows fresh setup succeeded, creating a separate wrapping identity with public recipient validated by pinned age. Earlier unusable file/folder preserved as historical; working backup age identity unaffected. Prepared administrator-only seal exporter (six synthetic tests passed; no-read plan passed): exact seal.json plus manifest, strict metadata/schema, separate public recipient, in-memory archive and network-disabled encryption, exclusive ciphertext outside checkout. [Next command and scope](../docs/status/p3-u3a-backup-authority-preparation.md). Owner-reported administrator seal-only export succeeded with ciphertext SHA256, source unchanged and zero OpenBao requests/changes. Owner-reported Windows SCP/SHA256 matched the encrypted seal package, verifying transfer. Separate seal-only Windows verifier prepared with fixed hash, private output ACL, exact members/manifest and share-schema checks; Owner Windows seal verifier passed package decryption, manifest, one seal file/schema and account ACL checks, completing the separate off-host seal recovery-copy checkpoint. Restic escrow already verified. Provider key usability remains untested; next is exact authority-operation preparation/rehearsal and separate final approval. No agent retained key read or OpenBao operation; recovery/provisioning remains unauthorized. **P3-U3a remains incomplete**.

- **Age recovery-key check / Restic escrow handoff — 2026-10-21 (Asia/Manila, +08:00):** owner-executed Windows decryption challenge SHA256 matched exactly; no private key handled by agent. Local administrator readiness already passed with matching protected public recipient and seal/Restic/SMTP metadata. Prepared explicit administrator-only Restic credential escrow exporter (five synthetic tests passed): three fixed client files plus manifest, in-memory archive, pinned network-disabled age via stdin, exclusive encrypted output outside checkout; excludes OpenBao seal/private age/SMTP material and makes no provider changes. [Single next command and exact scope](../docs/status/p3-u3a-backup-authority-preparation.md#windows-decryption-passed-next-assisted-escrow-handoff). Owner-reported administrator export succeeded, producing the encrypted Restic package and SHA256 without seal/private-key reads or provider changes. Owner-reported Windows SCP/SHA256 now matches the exported ciphertext, verifying the off-host encrypted copy. Prepared source-reviewed Windows verifier with account-restricted output ACLs, exact archive/member/file hashes and sanitized JSON. Owner-executed Windows verifier now passed recovery_package_verified: real package decryption, all three credential files/internal hashes and account ACL checks passed. Manual off-host Restic credential recovery-copy checkpoint is verified; actual repository access remains untested and independent OpenBao seal custody remains pending. Prepared separate Windows-only seal-escrow wrapping-key helper using the verified account ACL pattern; it prints only a public recipient and does not access the actual seal file or OpenBao; owner Windows attempt stopped at keygen stage; corrected native stderr handling and prepared exact same-folder resume to reuse any existing identity without overwrite. Same-folder resume reached public derivation; direct age-keygen reports no identities found. Failed file preserved; fresh new-folder run of the corrected helper pending; no retained recovery, provisioning or repository init authorized. **P3-U3a remains incomplete**.

- **Backup authority preparation / simplified administrator handoff — 2026-10-21 (UTC):** owner accepted preparation plan and is intended seal-key custodian; another-host storage is an explicit planning assumption, not verified transfer. Added one metadata-only administrator checker with optional exclusive public-recipient installation (four disposable tests passed). Owner-reported run returned local_checks_passed: matching protected public recipient already installed and all seal/Restic/SMTP metadata checks passed, with no secret contents/network/provider operations. Independent custody, age decryption and retained recovery readiness remain unverified. Disposable backup-before-four-write provisioning rehearsal **39/39 passed**, including native restore before writes, exact readback, installer revoke/403, independent AppRole capture and fresh encrypted snapshot/separate audit commit; exact teardown verified. [Evidence and single next command](../docs/status/p3-u3a-backup-authority-preparation.md), [disabled preparation manifest](../infra/backup/authority-preparation-review.json). Earlier preflight-path failure preserved. Real root recovery was not rehearsed or authorized; off-host seal/Restic custody, age decryption, retained source/audit/joint PostgreSQL recovery and final exact operation remain gated. Existing lifetime/HTTP 500/expiry/browser findings preserved; **P3-U3a remains incomplete**.

- **Development storage verified / snapshot-only source candidate — 2026-10-21 (Asia/Manila, +08:00):** administrator created the non-login UID/GID 12010 account and isolated TLS/append-only Rest Server. Independent read-only checks verify exact image/hardening, no ports, internal network, authenticated CA/hostname validation and anonymous/other-repository denial; repository remains uninitialized. [Installed evidence](../docs/status/p3-u3a-development-storage-verification.json). The 2-GiB pilot is not full retention readiness. Added inactive, separately tagged TLS/AppRole source helper: strict scope/maximum/denied capabilities, bounded native GET, durable uncertainty fencing, revoke/403 before output and lock through durable output. Final **35/35 native workflow** and **15/15 source fault groups** passed with exact fixture cleanup; [evidence and limits](../docs/status/p3-u3a-snapshot-source-candidate.md), [inactive source manifest](../infra/backup/snapshot-candidate-review.json). Installed provider/tooling tag unchanged; the separately approved names-only custodian session below is complete. No retained snapshot provisioning, timer, snapshot/restore/prune or custodian change. SMTP `smtp.office365.com:587` negotiated verified TLS 1.3 without credentials or email submission; 11 synthetic alert tests pass; the owner-reported delivery attempt failed with submission unconfirmed. Added flushed safe stage/error reporting and authentication-only `--check-smtp` diagnosis without email submission; administrator-reported initial authentication rejection (535) is preserved in history; the latest `--check-smtp` passed verified TLS and authentication with no email submission. The latest administrator `notification_test` was successfully submitted with clean QUIT; owner-provided Exchange trace confirms Delivered at 2026-10-21 11:12 UTC+08:00. Owner confirmed inbox receipt, completing the manual SMTP delivery check; automatic alert scheduling/integration is still pending. The cause of the earlier rejection is not established. No live diagnostic run by the agent. Owner-reported administrator configuration check passed (`configurationValid=true`, no message submitted); the password file is configured/readable, and the latest administrator diagnostic verifies SMTP authentication; Exchange trace and owner inbox confirmation verify manual email delivery. Owner supplied an age public recipient, validated with pinned age in an isolated no-network container; public installation file and administrator handoff are prepared. Owner confirms age private-key storage outside MyIMS; host recipient installation, backup-host exclusion, independent recovery-copy count and decryptability remain unverified. Owner approved the [bounded authority metadata review](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-openbao-authority-discovery-request.md); completed one custodian session after eight synthetic groups/seven native checks, observing 2 auth mounts, 60 policy names and 14 role names. Revoked/403 confirmed, helper removed and approval consumed. No backup-specific names or independently usable installer route established; no policy bodies/secrets or privilege changes. [Findings/next decision](../docs/status/p3-u3a-authority-metadata-review.md). Owner subsequently named the existing custodian password path; metadata and offline framing recheck passed with zero logins. It is not evidence of unseal/recovery-key custody; that remains unestablished. Owner reports no personally held seal/recovery keys. Repository installation review found the documented `.local/endpoint-credentials/seal.json` lead (initializer writes it; October 19 presence/recovery recorded), with current presence now confirmed by owner-reported administrator stat (regular, 0600, 1003:1003); key usability and independent custody remain unverified. Legacy endpoint administrator was retired/deny-all and recovered root revoked; no independently usable installer established. No private-store search or provider access in this follow-up. [Authority-establishment preparation plan](../docs/planning/p3-u3a-backup-authority-establishment-plan.md) records custody tasks, existing-installer/recovery branches and backup-first exact-four-object provisioning scope; it is not execution authorization. Installer authority/backup-first/snapshot identity, independent repository/age/seal custody, real audit/rotation/scheduler/alerts/housekeeping and joint PostgreSQL recovery with measured RPO/RTO remain gated. Existing HTTP 500/expiry, retained lifetime and browser findings preserved; **P3-U3a remains incomplete**.

- **Development backup artifacts and independent trunk terminal adapter — 2026-10-21 (Asia/Manila, +08:00):** owner accepted platform/docs and continued disposable/local work, preserving `platform-owner-custodian`. Prepared separate profile-gated TLS Rest Server project, pinned tools image, native snapshot validation/age archives, separate audit continuity and file-credential Restic uploader/check helpers. Actual Compose/native restore passed **32/32**, focused archive/audit faults **11/11**, exact disposable cleanup verified. [Evidence/limits](../docs/status/p3-u3a-restic-development-artifacts.md), [consolidated actionable installation request](../docs/planning/p3-u3a-development-backup-installation-request.md), [disabled artifact/hash manifest](../infra/backup/review-manifest.json). No retained service, volume, credentials, scheduler, privileged provider access or cleanup activated. Installer/backup-first/snapshot identity, actual paths/custody/owners, scheduling/rotation/alerting/housekeeping and joint PostgreSQL recovery with measured RPO/RTO remain gated. Native snapshot-only retained identity is not validated by synthetic fixture authority. Timed COMPLIANCE retention stays deferred and is not an initial blocker. Independent inactive exact-scope terminal reservation adapter now passes real PostgreSQL audit rollback, runtime denial and concurrent change-once/replay with all 15 migration sources and previous owner/grant regressions; [trunk evidence](../docs/status/p3-u3a-trunk-reservation-transitions.md). Backend build and scoped lint/format passed. Usable owner commands, protected workers/provider integration and binding/claim/adoption APIs remain unfinished; native renewal HTTP 500/expiry timing, retained lifetime and browser-recovery findings preserved. **P3-U3a remains incomplete.**

- **Final backup platform decision — 2026-10-21 (Asia/Manila, +08:00):** owner approved Docker Restic + append-only Rest Server for development and production, superseding B2/SeaweedFS primary preferences. Timed COMPLIANCE retention is explicitly accepted as absent and deferred as a future enhancement, not an initial acceptance blocker. [Authoritative architecture/security requirements](../docs/archive/p3-u3/2026-10-23/docs/architecture/backup-platform.md) and [minimal installation plan/remaining approvals](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-installation-approval-package.md) preserve append-only client restrictions, separate reviewed pruning authority, native snapshots/separate audit/age/manifests, independent recoverable repository/key/seal custody, and verified joint recovery with measured RPO/RTO. Same-host development risk accepted; production requires independent physical server/NAS administration, restricted authenticated TLS, capacity monitoring and an independently protected additional recovery copy or equivalent reviewed backup-host-compromise safeguard. Platform choice is settled; actual installer/backup-first/snapshot identity, custody, exact deployment/operations and recovery approvals remain pending. No retained execution, activation, privilege expansion, production deployment, destructive cleanup or root recovery authorized. Independent implementation/disposable verification continues; **P3-U3a remains incomplete**.

- **Disposable backup-platform evidence — 2026-10-21 (Asia/Manila, +08:00):** [SeaweedFS evidence](../docs/status/p3-u3a-seaweedfs-backup-evaluation.md) preserves failed concurrent retention/hold checks. Selected Restic/append-only Rest Server passed 26/26 native backup/restart/append-only/retrieval/decryption/restore checks in its [disposable evidence](../docs/status/p3-u3a-restic-backup-evaluation.md). This proves only the declared fixture scope, not production readiness or cross-host recovery. Exact disposable resources and synthetic keys removed; existing Garage/OpenBao/PostgreSQL/Redis and protected credentials untouched.

- **Independent exact owner read-port checkpoint — 2026-10-21 (Asia/Manila, +08:00):** hardened exact owner references and exercised the actual compiled adapter/`SnapshotDatabase` in isolated real PostgreSQL. All 15 migration sources, existing grants/audit/terminal/concurrency/role hazards and new scope/safe-projection/snapshot checks passed; build and scoped lint/format/syntax passed. Exact fixture containers removed. No owner commands/workers/API activation or retained access; provider/browser findings remain. [Evidence](../docs/status/p3-u3a-trunk-owner-reference-port.md).

- **Sustainable administration direction approved — 2026-10-21 (Asia/Manila, +08:00):** owner approved the two-capability design direction only, unchanged custodian restrictions, existing-route preference and native AppRole fallback for disposable validation. Both retained-session approvals remain consumed. Prepared the [minimal installation-authority and backup package](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-installation-approval-package.md) and [candidate exact-path/body/hash manifest](../docs/planning/p3-u3a-backup-installation-review-manifest.json), execution disabled. Owner does not yet know existing operator/destination/key custody and requested recommendations: initially proposed an owner-controlled immutable off-host bucket (now superseded by the final Restic platform decision above), public-key encryption with two independently held private-key copies, one host timer and separate audit collection. Actual installer/backup-first route, destination/owner, key/seal custody, rotation/alert owners, measured capacity and joint recovery remain unresolved. Four-write pre-backup bootstrap exception is described separately and unapproved; no root recovery or custodian expansion assumed. Timed immutability is now deferred; candidate administrative retention remains hourly 30 days plus monthly 12 months (about 91.5 GiB of full snapshot inputs at the 128-MiB cutoff, excluding audit/overhead and without assuming Restic storage savings), pending configuration approval. No retained access/identity/job/snapshot/policy/restart/restore or live SIP/PBX action. Local implementation remains independent; P3-U3a and native lifetime/browser/integrated acceptance remain incomplete.
- **Canonical trunk owner database foundation — verified further 2026-10-21 (Asia/Manila, +08:00):** local migration/read-port checkpoint implemented and verified; no shared database migration or retained provider access. Added separate NOLOGIN owner capability with all membership edges rejected; immutable deployment peer scopes, exact binding/generation/reservation/history provenance, monotonic ordinals/active-preparation uniqueness, safe runtime projection and savepoint-safe same-transaction platform/no-tenant audit evidence. All 15 migration sources and real isolated PostgreSQL grant/provenance/ordinal/audit rollback/old-audit reuse/membership hazards passed, exact fixture removed; backend build, scoped lint/format/Python syntax passed. [Evidence and limits](../docs/status/p3-u3a-trunk-owner-foundation.md). Captured versions remain provenance, not independently validated authority. New real disposable checks passed successful audited cancellation, retained terminal provenance/no resurrection, and two-session binding-lock timeout/release with no partial generation; all 15 migrations and prior grant/audit/membership checks passed again, exact fixture removed. No usable reserve/verify/claim/adoption API, protected worker composition, provider token or runtime wiring; those, actual SQL-adapter invocation, Prisma deployment/default graph and L-01/A-04 acceptance remain outstanding. Native 500/expiry and browser failures preserved.
- **Local controlled replacement candidate — 2026-10-20 (Asia/Manila, +08:00):** added inactive replacement coordinator validating exact scoped policy/service/orphan/maximum/origin/TTL/deadline before switching, excluding outstanding work and concurrent replacements, and pausing consumption until exact prior revoke plus 403 confirmation. Uncertain/late cleanup preserves prior/staged accounting and forbids retry/fallback. All 25 synthetic lifecycle groups (ten replacement) passed; final combined preparation/lifecycle run passed 53 tests, scoped lint/format passed. [Evidence](../docs/status/p3-u3a-controlled-replacement-candidate.md). The experimental overlap budget bounds switching admission, not physical revocation during provider failure. No real replacement issuance/provider/process/custody/swap/restart acceptance or runtime activation; those and canonical owner/grants/API/timing work remain outstanding. Native 500/expiry and browser failures remain preserved.
- **Local same-token reconciliation candidate — 2026-10-20 (Asia/Manila, +08:00):** added bounded same-token self-lookup reconciliation after uncertain renewal while consumption remains paused; original identity, conservative prior lease and absolute issuance deadline must remain valid, with terminal revocation/clock/identity/expiry failures, timeout/cancellation, concurrency fencing and finite attempts. All 15 simulated groups passed; real disposable lost-renewal-response reconciliation passed in two isolated runs. Latest probe admitted 21 operations, denied eight, first denial 5,735 ms against six seconds. Native near-expiry 500 and 34–642 ms expiry-overrun failures remain, suite exit 1; 58 revoked/19 expired, zero known remaining and fixture teardown verified. [Evidence](../docs/status/p3-u3a-same-token-reconciliation.md). Candidate remains investigation-only; no runtime integration or accepted clock/restart guarantees. Pre-maximum replacement and canonical owner/grants/API/timing work remain outstanding. Native disposable custom-mount display-name comparisons also confirmed the verifier's default-prefix assumption was wrong; corrected local check, with no second retained login or retrospective retained field equality claim.
- **Local policy-helper checkpoint — 2026-10-20 (Asia/Manila, +08:00):** aligned pure provisioning/custodian plan generation and exact-body preflight with the approved complete-array candidate through one shared bounded issuance-rule generator. Disposable historical fixtures retain pinned original bodies; no retained policies changed. Backend build and 19 preparation checks passed. Real disposable 14 positive paths/434 negatives, ten helpers, native fixed issuers, 20 concurrency rounds, trunk and maintenance/interruption regressions passed their checks. Suite exit 1 preserves native near-expiry HTTP 500 and measured 60/220/290 ms renewal-expiry overruns; 58 revoked/18 already expired, zero known remaining and exact fixture teardown verified. [Evidence](../docs/status/p3-u3a-policy-helper-alignment.md). Runtime lifecycle reconciliation/replacement and canonical owner/API integration remain outstanding; no runtime timing amendment or retained acceptance is claimed.
- **P3-U3a — protected trunk and gateway definitions:** in progress; approved independent local implementation; named retained verification checkpoint owner-accepted and closed; both authorizations consumed; remediation unapproved; started 2026-10-19 (Asia/Manila, +08:00). [Specification](../docs/archive/p3-u3/2026-10-23/context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md), A-01–07.
- **Direction approval — 2026-10-20 (Asia/Manila, +08:00):** owner approved the [completion direction and focused implementation plan](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-approved-completion-direction.md). Preserve essential security, one-hour initial runtime leases and 86,400-second configured explicit maxima; complete-array constraints are the hardening candidate. Local owner/grants/worker isolation/APIs/binding/claim/adoption, helpers, bounded renewal reconciliation and controlled pre-maximum replacement may proceed with disposable services. The 60-second attestation transaction-timing amendment is approved in principle only, **not accepted for runtime use** pending implementation and real transaction/failure acceptance with independent database authority/owner/installation/generation/replay/freshness checks. Stable separately controlled existing backup/maintenance routes are preferred; new/expanded retained privilege requires separate approval. Direction review is complete; the owner subsequently approved the [single named retained capability check](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-authority-verification-request.md), which proceeded after a documented file-framing correction, then stopped at a display-name check before capabilities and was revoked/403. The separately approved second session subsequently completed all ten capabilities and cleanup successfully; both authorizations are consumed, no further login/retry is authorized. Concrete retained remediation remains pending. No further retained login/issuance, alternative custody discovery, policy/role changes, restart, recovery/restore, live SIP/PBX or deployment is authorized.
- **Earlier approval/execution checkpoint:** user explicitly approved both the [definition contract review](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-definition-contract-review.md) and [isolated OpenBao trunk credential review](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-openbao-trunk-credential-review.md), the custodian succession design, and one isolated recovery operation with mandatory custody, backup, guard, succession and restoration gates. No repeat recovery, expanded privileges or live SIP/PBX/production effects are authorized. [Current execution checkpoint](../docs/status/p3-u3a-recovery-execution.md).
- **Current work:** one explicitly authorized recovery operation executed on 2026-10-19 (UTC), with mandatory consistent Raft/separate audit backup and exact privileged-inventory gate before writes. Recovered root revocation was verified, then fresh 15-minute human login, fixed issuer replacement and independent scoped runtime issuance/denials passed for both installations. Durable restricted issuer custody preceded retiring the exact old administrator policy; no active old-admin accessor existed. Original endpoint policies/permissions and retained provider storage/TLS were preserved. Normal HCL/network/restart restoration, TLS 200/root-generation 405, exact helper/network cleanup and read-only endpoint isolation passed. Window: 06:13:07.931–06:13:34.970 UTC (27.04 seconds), guard cancelled afterward. All 18 preparation checks and disposable real TLS handoff rehearsal passed. Real endpoint provider/API/lifecycle regressions passed, exit 0, with exact 26-generation/token/database cleanup. Subsequent real trunk token escalation test failed: requested 48h TTL/max yielded 24h initial TTL but 48h explicit maximum. The exact token and all other known test tokens were revoked/403, zero token files remained, and the test helper was removed. No trunk material was imported. Stopped for mandatory separate review; no role/policy remediation or repeat recovery. [Finding and concrete hardening proposal](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-token-lifetime-hardening-review.md). Provisioning security acceptance is not passed. [Execution evidence](../docs/status/p3-u3a-recovery-execution.md).
- **Disposable validation completed; acceptance failed:** isolated pinned 2.7.1 tests found the original scalar policy constraints reject normal array requests. A complete-array candidate issued on all 14 paths and rejected all 434 negative requests; ten unchanged runtime-helper cases, native userpass/fixed issuers and unchanged trunk provider regression passed. Findings remain: a privileged overlapping policy permits a 48h maximum, accelerated absolute-expiry renewal returned HTTP 500 (final lookup 403), and direct concurrent endpoint prepare returned one access denial before successful replay/verification/cleanup. Final run revoked 45 known tokens, verified seven already expired, and removed exact fixture containers/network/TLS/audit/tmpfs; trunk regression independently revoked its four children. Scoped build/preparation 18/18 and lint/syntax passed. No retained credentials/data were accessed, and no retained changes/restart/recovery occurred. [Evidence and limits](../docs/status/p3-u3a-disposable-lifetime-validation.md), [maintenance/backup proposal](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-lifetime-maintenance-proposal.md).
- **Authorized follow-up — 2026-10-20 (Asia/Manila, +08:00):** user accepted complete-array constraints for disposable testing only and approved overlap/renewal/concurrency/rootless-maintenance investigation. Exact token-policy, native entity/group identity-policy and generic issuance grants can widen authority; ordinary issuer requests and exact deny still reject. Hardened runtime issuer helper refuses identity-policy/period overlap. Endpoint create-only ACL races were reproduced as 403; exact immutable read reconciliation now passes 20 four-caller rounds with replay, wrong-generation denial, cleanup/retry and no resurrection. Both adapters reject failed/malformed/uncertain renewal responses. Existing endpoint/trunk token leases and 24 non-target policy/role records were preserved. Rootless original-to-candidate writes, native snapshot plus separate audit capture/append preservation and corruption/storage/overwrite faults, base64 exact-body enforcement, native alias readback, accessor cleanup, 12 interruption checkpoints and accelerated ticket expiry were rehearsed. All 14 issuance paths/434 negatives, ten normal helper cases, trunk regression and 18 preparation tests pass; lint/syntax passed. **Acceptance still fails:** provider returns near-expiry 500; successful scaled renewals reported up to 836 ms beyond the six-second issue-time boundary. Failed renewal preserved its prior expiry, but lookup remained briefly live beyond that boundary. Final diagnostic exit 1; 58 revoked/18 already-expired known tokens accounted for, zero remaining and fixture teardown verified. No retained credentials/custody or provider changes/restart/recovery occurred. [Findings, limitations and prerequisites](../docs/status/p3-u3a-disposable-review-followup.md), [exact rehearsal manifest](../docs/planning/p3-u3a-rootless-maintenance-rehearsal-manifest.json).
- **Latest review / deadline investigation — 2026-10-20 (Asia/Manila, +08:00):** user accepted prior disposable concurrency/identity/renewal-validation/backup design evidence for continued development; retained execution and pre-backup exception remain unapproved. Added a test-only original-issuance deadline candidate (proposed 2-second skew bound plus 3-second safety margin, monotonic/pre/post checks, failed-renewal pause) with eight simulated test groups. A separate real disposable probe admitted 20 operations, denied admission from 5.605 seconds against a six-second maximum and remained denied while provider lookup was still 200 at 6.121 seconds. Original HTTP-500 and fractional-expiry failures remain visible; no production guard or canonical finalization integration is claimed. Repeated 14/434 issuance matrix, ten helper checks, 20 concurrency rounds and backup/interruption regressions completed; 58 revoked/19 already-expired tokens, zero known remaining and fixture cleanup verified. The full default graph passed static/build/config, foundation/durability/storage/identity/deployment and most session checks, then failed the existing credential-browser lost-issuance recovery visibility assertion. A focused browser rerun passed; root cause is not yet established. Added sanitized status/expiry diagnostics and a stricter committed-201 fault precondition; the complete default session-stage rerun passed, exit 0, including the stricter precondition and remaining session/desired-registry checks. All 26 focused security and 12 shared UI checks passed. Desired inventory A-01–07 also passed, exit 0, with isolated database/Redis cleanup. Separate command results are recorded in the [security rationale](../docs/status/p3-u3a-security-acceptance-rationale.md). Prepared a [precise no-root failure/manual-review plan](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-failure-and-authorization-review.md) and [exact conditional authorization draft](../docs/planning/p3-u3a-retained-maintenance-authorization-draft.json). The owner cannot yet verify existing snapshot/maintenance availability and requested inclusion for approval review. Availability remains unknown, not demonstrated absent; an execution gate rather than justification for an exception.
- **Remaining/resume:** proceed locally through compatible policy/lifecycle helpers, canonical owner/grants and isolated workers, then definitions and same-transaction claim/adoption under the approved plan; do not wait for retained administration. Preserve the full-graph browser failure until explained; review conservative deadline/clock assumptions, transactional finalization and fixed-issuer helper compatibility. Resolve provider 500 and precise-expiry acceptance, establish an independently authorized current effective policy/entity/group/auth/role/accessor/lease inventory, and have the owner supply or rule out an existing backup-first route. No immutable server-wide ceiling is claimed. The separate nine-write draft includes three unapproved pre-backup writes and precise containment/manual-review states; it is not execution-ready or approved. Both individually authorized named sessions have been used and revoked/403; the second passed all ten capabilities. Additional retained login is not authorized. Alternative custody discovery, remediation, other token/lease changes, restart, restore and root recovery remain unauthorized. Develop canonical owner/binding/API PostgreSQL/Redis/two-HTTP acceptance locally now. Separately authorized retained remediation, security prerequisites and retained trunk ACL/import/qualification remain necessary for end-to-end completion and final integration checks. SIP/PBX activation/deployment remain excluded; P3-U3a is incomplete.

## Recent Session Notes

- 2026-10-21 (Asia/Manila, +08:00) — Independently verified the administrator-completed storage stage and uninitialized repository; verified SMTP reachability/STARTTLS without authenticating or sending mail. Implemented inactive snapshot-only source candidate with final 35 native and 15 synthetic fault checks, separate pinned image and exact disposable cleanup. Final checks passed: 25 artifact hashes, both installed/candidate image pins, 197 local links/anchors, syntax, scoped lint/format and diff whitespace. Actual key/authority/operational/joint-recovery gates remain; no retained provider change or scheduler activation.

- 2026-10-21 (Asia/Manila, +08:00) — Owner approved development installation and selected host-administrator execution. Created exact empty persistent backup volume; prepared root-only storage installer (2-GiB pilot cap) and read-only probe. 33/33 disposable Compose/native checks and six synthetic SMTP tests passed; no retained service, credentials, timer, OpenBao login/write or email send. Recorded Microsoft 365 STARTTLS configuration and protected password edit path, authority-reference findings and remaining custody/native/joint-recovery gates.

- 2026-10-21 (Asia/Manila, +08:00) — Continued authorized local/disposable P3-U3a: prepared development backup artifacts and consolidated installation request; 32 real Compose/native recovery checks and 11 archive/audit faults passed with exact teardown. Added inactive trunk terminal adapter; real PostgreSQL/grants/audit/concurrency suite and backend build/scoped checks passed. Final documentation checks passed: 11 pinned artifact hashes, unchanged provisioning bodies/policy hashes and disabled approvals, 316 local links/anchors and diff whitespace. No retained execution, custodian change, policy expansion, production deployment or root recovery. See current checkpoint and linked evidence for unresolved source/scheduler/custody/joint-recovery and application integration gates.

- 2026-10-21 (Asia/Manila, +08:00) — Recorded final owner Restic/append-only Rest Server architecture decision for development/production; removed timed COMPLIANCE retention from mandatory initial acceptance and preserved other security/recovery gates. Added authoritative backup contract, reconciled architecture/design/installation plan/disabled manifest and security rationale. No retained services, credentials or provider state changed. Documentation checks passed: 368 local links/anchors across 11 affected files, JSON and both policy hashes, unchanged provisioning bodies/bounds, disabled execution/exception flags and diff whitespace. Application tests were not run for this documentation-only decision; no new acceptance claimed. P3-U3a remains incomplete.

- 2026-10-21 (Asia/Manila, +08:00) — Recorded owner acceptance of same-host SeaweedFS Docker placement for development and separate-machine storage for production. Synchronized architecture, design, installation proposal and disabled review manifest; no deployment or retained operation occurred. JSON, policy hashes, local links and diff whitespace checked; documentation-only change, no application tests rerun.

- 2026-10-21 (Asia/Manila, +08:00) — Recorded owner's design-direction approval and request for recommendations where operational owners/destination/custody are unknown. Prepared exact candidate provisioning manifest and minimal separate installation review; unresolved facts block execution, existing authority remains unknown, and no backup-first exception is approved. No retained access or administrative implementation occurred. Continued independent owner/grants testing: successful audited terminal transition and two-session generation lock timeout/release passed with all prior PostgreSQL checks and exact cleanup ([evidence](../docs/status/p3-u3a-trunk-owner-foundation.md#october-21--terminal-and-concurrent-generation-verification)). Python syntax passed; manifest hashes, local links and whitespace checked. No new runtime/API or AppRole validation is claimed; native backup configuration tests, owner commands/workers and integrated security/integration acceptance remain outstanding.

- 2026-10-20 (Asia/Manila, +08:00) — Canonical trunk owner source migration/read port verified against fresh isolated PostgreSQL: all 15 migrations, grants, immutable provenance, savepoint-safe audit/rollback and unsafe-role hazards passed. No shared deployment/provider access or runtime wiring. Consolidated administrative design and owner acceptance closure are ready for review; native provider/integration acceptance remains outstanding. [Foundation evidence](../docs/status/p3-u3a-trunk-owner-foundation.md).

- 2026-10-20 (Asia/Manila, +08:00) — Owner accepted and closed the named custodian capability-verification checkpoint within its limits; the account functions as intended on the verified paths. Prepared consolidated sustainable administration design for separate review, with no retained activity or credential creation. Earlier preflight/first/second-session checkpoint details moved to [history](progress-tracker-history.md#2026-10-20--named-custodian-capability-checkpoint-closed). Local owner/grants work continues independently; P3-U3a remains incomplete.

- 2026-10-20 (Asia/Manila, +08:00) — Completed separately approved second limited session after native disposable exact-workflow testing: all identity/lifetime and ten capability sets matched, revoke/403 confirmed. Both authorizations consumed; unknown separate backup authority and unapproved retained remediation remain. [Findings](../docs/status/p3-u3a-retained-capability-session-2.md).

- 2026-10-20 (Asia/Manila, +08:00) — Resolved exact handoff framing incompatibility with a shared parser and unchanged credential/file. Conditional continuation used the one authorized login; stopped at display-name expectation before capabilities and confirmed revoke/403. Backup/maintenance direction accepted for design review only; no additional session or retained changes authorized. [Follow-up](../docs/status/p3-u3a-custodian-handoff-followup.md).

- 2026-10-20 (Asia/Manila, +08:00) — Recorded limited named verification approval and exact-handoff preflight stop before login; backup authority remains unknown. Independent local complete-array policy/preflight alignment implemented and checked with disposable services; provider timing failures preserved. See current entries and linked reports above.

- 2026-10-20 (Asia/Manila, +08:00) — Recorded owner direction approval and synchronized planning, architecture and lifecycle/definition contracts. Conditional transaction timing remains inactive pending implementation and real acceptance. Prepared a separate bounded existing-custodian capability-verification request with owner-supplied backup-route metadata; neither it nor retained execution is approved. Documentation only; no runtime/provider/custody access or fresh application acceptance claimed. Existing provider 500/expiry, retained lifetime and browser failure evidence remains unchanged. Documentation checks: no new local-link/anchor defects, six already documented implementation-plan relative links remain; whitespace check passed. Application tests were not run for this documentation-only change.

- 2026-10-20 (Asia/Manila, +08:00) — Latest user review authorized original-issuance deadline investigation and permitted full non-disruptive verification. Test-only prototype and separate disposable probe passed their safety checks, while native provider 500/expiry-overrun assertions remain failed. Draft retained authorization distinguishes unknown existing backup authority from proven unavailability and specifies exact partial-state containment/manual cleanup without fixture root. Full default graph exited 1 at credential-browser recovery visibility; focused browser and complete default session reruns passed without an application change. Root cause remains unresolved; 26 focused security and 12 UI checks passed. No retained provider/custody changes occurred.

- 2026-10-20 (Asia/Manila, +08:00) — Completed authorized disposable investigation/rehearsal checkpoint; see the current follow-up entry and [report](../docs/status/p3-u3a-disposable-review-followup.md). Exact policy/identity composition, endpoint create-only races and rootless maintenance scope are tested. Newly measured subsecond expiry overrun and reproduced 500 keep acceptance failed. Pre-backup exception and all retained execution remain unapproved; no root recovery, provider changes or protected custody search occurred.

- 2026-10-19 (UTC) — Endpoint provider regression passed, exit 0, with PostgreSQL/Redis/HTTP A/B, provider outage/seal/restart/expiry, cleanup/acknowledgement races, secret scans and exact owned fixture cleanup. Real trunk token test then found 172,800-second explicit maximum from a 48h request (initial TTL 86,400), contrary to the 24h maximum contract. Test token and all other known test tokens self-revoked/403; no token files or test helper remain, and no trunk import began. Stopped before remediation per the user's required privileged-condition review. Root remains revoked and normal provider restored. Prepared review-only exact parameter constraints; current human cannot self-edit its maintainer policy or obtain an authenticated snapshot, so retained maintenance authority must also be reviewed. P3-U3a blocked/incomplete; single recovery authority consumed.

- 2026-10-19 06:13 UTC — Executed the single authorized isolated OpenBao recovery in a 27.04-second guarded window. Real consistent snapshot/separate audit preservation and 46-policy/one-root/zero-lease inventory passed before provisioning. Root revoked/403, independent human and fixed issuers verified, both-installation runtime issuance/denials passed, replacement issuer files staged durably, exact legacy admin policy retired (no active accessor), endpoint policies preserved. Normal provider/storage/TLS/network restored, helper/network removed and guard cancelled; read-only isolation passed. Endpoint provider regressions are running. Human sessions and initial issuers revoked. No repeat recovery, live SIP/PBX or production effect; P3-U3a stays incomplete.

- 2026-10-19 (UTC) — User confirmed a fresh password outside container mounts and a separate protected personal copy. File permissions/ownership/format and mount isolation passed without printing content. Custodian metadata recheck still found none; read-only PostgreSQL work/cleanup counts were zero. All original 14 preparation checks passed again. Added manual read-only snapshot/audit/inventory capture and mandatory operation-bound backup gate before recovered-root writes. Disposable real TLS OpenBao testing found a null-versus-empty alias default mismatch; corrected only that known empty default while preserving unknown/nonempty privilege rejection. Retained provider and single-operation authority remain untouched during preparation.

- 2026-10-19 (UTC) — User supplied a protected, ignored password file under `private/`. Verified that the running workspace mounted the checkout and application processes shared its UID; owner-only permissions did not isolate the file from those processes. Relocated its exact bytes outside container mounts to `/home/gino/.openbao-custodian/password`, verified directory/file 0700/0600 and original path absent. No secret output or evidence of a read/compromise. Stopped before recovery under the user's uncertainty condition; a fresh personally retained password is required there. The single-operation authorization remains unused; no provider, policy, auth or token mutation occurred.

- 2026-10-19 (UTC) — Recorded the user's custodian-design approval and explicit single-operation recovery authorization. Fresh documented custody metadata check passed, exit 0, with no custodian/bootstrap and excluded endpoint admin unused. Human-password personal retention and protected handoff location are not established; stopped before enabling recovery. Added the [execution checkpoint](../docs/status/p3-u3a-recovery-execution.md), mandatory consistent Raft/separate audit backup gate and root-revoked independent succession order. No recovery, provider restart, privilege change or administrative retirement occurred. The authorization remains unused; required real acceptance and P3-U3a remain incomplete.

- 2026-10-19 (Asia/Manila, +08:00) — User conditionally approved the synthetic digest-only profile, separate custody and restricted provisioning, explicitly requiring another confirmation before recovery execution. Documented custodian/bootstrap credentials are absent; excluded endpoint admin was not read or used. Provider TLS/health/disabled-root/unpublished-port checks, retained storage metadata, endpoint isolation and read-only canonical work counts verified. Prepared exact role plans, protected import/token primitives and opt-in endpoint cutover without changing provider/runtime state. Six focused fixture checks passed; remaining verification and the separate execution gate are recorded in the pre-execution report.


- 2026-10-19 02:32 UTC — Final complete `./dev check` passed, exit 0, after narrow browser-capture and draft mixed-policy fixture corrections; no application runtime source changed. Focused draft API A-01–08, 14 protected preparation checks, six real disposable guard scenarios/cleanup, restoration Compose comparison and retained read-only custody/TLS/isolation checks passed. User accepted personal custody of dedicated `platform-owner-custodian`; exact reviewed handoff/issuer replacement helpers are prepared, not installed. Updated concise [readiness summary and execution request](../docs/status/p3-u3a-provisioning-preexecution.md); privileged findings must stop for separate review, and live unseal/backup/ACL/lease/handoff/owner proofs remain outstanding. No root recovery, provider restart, privileged policy change or administrative revocation executed. Separate execution authorization is still required; a and parent stay incomplete.

- 2026-10-19 (UTC) — Addressed the follow-up recovery readiness review without executing recovery. Final metadata-only documented custody check found no custodian/bootstrap. Disposable deadline acceptance passed real timeout, exact label selection, parent/watcher interruption and safe failure reporting; fixtures removed. Three read-only provisioning preflight tests and the exact human-custodian plan scope test passed; preflight now refuses unexpected existing configuration before writes. Captured protected restoration metadata; actual privileged inventory/consistent snapshot/unseal remains an authorized-window prerequisite. Complete graph rerun is ongoing; successor human auth is proposed and needs approval/preparation, not claimed available.

- 2026-10-19 (Asia/Manila, +08:00) — Resumed non-disruptive P3-U3a preparation. All seven preparation checks, effective recovery-overlay validation and real endpoint API baseline passed. Corrected the browser fixture capture precondition after reproducing the retained-notes failure; focused platform browser/shared-session acceptance passed, exit 0, with owned fixture cleanup. Full graph remains recorded as failed before that correction, not rerun. Prepared a token-free operation-labelled detached recovery deadline guard; it is unarmed. Updated the [pre-execution report](../docs/status/p3-u3a-provisioning-preexecution.md) with exact necessity, prerequisites, service impact, restoration and failure handling. No provider mutation, recovery or provisioning executed. Required real privileged OpenBao and owner integration evidence remains outstanding; a stays in progress, awaiting the user’s separate recovery-operation confirmation.

- 2026-10-19 (Asia/Manila, +08:00) — Started P3-U3a and recorded both user approvals. Specified the required focused credential-lifecycle refinement. User requested a document explaining the recommended provisioning/profile approach; prepared it with explicit pending decisions and conditional recovery/restoration scope. Source review confirms protected listener and bootstrap self-revocation; no custodian token was read/tested. Non-secret container status inspected; no provider/schema/service mutation or runtime completion claimed.


- 2026-10-16 (Asia/Manila, +08:00) — Evaluated [U3A-04 reuse of existing OpenBao](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-openbao-trunk-credential-review.md). Recommend a separate trunk mount/importer/verifier/cleanup/DB-owner boundary on the retained server; no endpoint runtime token reuse. Source review identified self-editing endpoint administration and endpoint-specific queue filtering as required remediation points. Proposed opaque exact generations, protected import, 60-second owner attestation, lifecycle refinement and A-04 evidence; user approval, compatible profile and provisioning authority remain pending. Documentation only; no runtime/policy/schema/service changes or fresh provider evidence.

- 2026-10-16 (Asia/Manila, +08:00) — Prepared the [P3-U3a contract review](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-definition-contract-review.md) for user approval after checking repository guidance, parent/child gates, existing ports and retained evidence. Proposes resource/connection and initial identity/status/edit policies, independent IP-peer staging, bounded API/retry/dependency contracts and A-01–07 checks. No established trunk credential-binding owner found in inspected contracts/source; authenticated scope requires a concrete G-03 review and possibly the parent's focused lifecycle refinement. All decisions remain pending; a/parent remain planned. Documentation only; no runtime checks or service changes.

- 2026-10-16 (Asia/Manila, +08:00) — User adopted the P3-U3 three-child split; created [a: trunk/gateway definitions](../docs/archive/p3-u3/2026-10-23/context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md), [b: DID inventory and safe resource removal](../docs/archive/p3-u3/2026-10-23/context/feature-specs/p3-u3b-did-inventory-and-dependency-safe-resource-removal.md) and [c: operator browser/integrated handoff](../docs/archive/p3-u3/2026-10-23/context/feature-specs/p3-u3c-operator-resource-browser-and-integrated-handoff.md). Each specifies starting state, gates, scope, acceptance and required checks mapped to parent AC-01–11. Parent/index synchronized; documentation consistency, local links/anchors and whitespace reviewed. G-01–04 policies remain unresolved; a/b/c and parent are planned, with no runtime verification or implementation claimed.

- 2026-10-16 (Asia/Manila, +08:00) — Prepared and reviewed the [P3-U3 feature spec](../docs/archive/p3-u3/2026-10-23/context/feature-specs/p3-u3-trunks-gateways-and-dids.md). Recommended three sequential sub-units: trunk/gateway foundation, DID inventory and dependency-safe removal, then integrated operator browser. Split remains proposed; G-01–04 resource, DID, credential-reference and lifecycle policies require scoped decisions before dependent implementation. Documentation only; P3-U3 remains planned, no implementation or runtime verification claimed.

- 2026-10-16 15:33 +08:00 (Asia/Manila) — Completed P3-U2c and parent P3-U2 under the conditional private-development G-03 approval. All C/parent criteria, required checks and exact cleanup/restoration passed; [final evidence](../docs/status/p3-u2c-evidence.md). In Progress cleared; detailed earlier checkpoints archived.

- 2026-10-16 10:49 +08:00 (Asia/Manila) — Completed P3-U2b B-01–07 under the user's conditional G-02 private-development approval. Real provider/lifecycle/security/recovery evidence, complete inventory/queue regressions and final full Docker graph passed, exit 0. Fixture material accounted for and exact owned resources removed; normal runtime readiness verified. In Progress cleared. Approved recovery and deferred production/delivery/live-apply boundaries are recorded in [final evidence](../docs/status/p3-u2b-evidence.md). Earlier checkpoints moved to tracker history.


## 2026-10-23 — Previous completed checkpoint retained during P3-U3a completion

### P3-U2c / parent P3-U2 checkpoint

- **Status:** completed within conditionally approved private development; 2026-10-16 15:33 +08:00 (Asia/Manila).
- **Requirement:** [C-01–07](feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md), parent AC-01–11; [final evidence](../docs/status/p3-u2c-evidence.md).
- **Delivered:** protected inventory/profile/credential browser, bounded named forwarding, exact passive observation composition, operator-bound mounted recovery and explicit uncertainty/version review. PBX detail links to **Manage extension inventory**.
- **Verification:** combined inventory/real credentials/browser, PBX registry/observation/browser, platform auth, durability, full `./dev check`, all 12 shared UI checks and final automatic-token-cleanup credential rerun passed, exit 0. Actual SIP REGISTER/expiry-zero and service outages are distinguished from injected faults in the evidence.
- **Preservation/cleanup:** exact original Asterisk configuration/routing/object/running baseline restored; no calls, fixtures or lock remain. Generations accounted for, temporary tokens revoked/removed, disposable databases/containers absent. Ordinary canonical node/version and empty inventory preserved; platform/staff HTTPS ready and health checks passed, backend live/ready 200.
- **Handoff:** [browser contract](../docs/architecture/extension-inventory-browser.md), [operator/recovery guide](../docs/runbooks/extension-inventory-browser.md). P3-U4/U5, P4 and P8 retain routing, live apply/recovery/revocation, allocation, tenant readiness and browser calling. Production and the Phase 3 gate remain incomplete; no expanded PBX permissions or deployment approval is claimed.
