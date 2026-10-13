# P2-U4c implementation and evidence checkpoint

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

2026-10-13 (+08:00) remaining native runtime preparation: new private port 3445
reuses declared mkcert CA/hostname and public app origin. Two independent actual
production Nest graphs use existing stores. Owner-only Unix socket controls
switch A/B, suppress confirmed HTTP 201 logout responses and advance time only
for existing fixed-fixture sessions. No production policy/clock changes or HTTP
control endpoints. Normal issuance retains real time and durable creation caps.
Shutdown revokes tracked sessions before clock overrides are removed.

TLS self-check passes all three accounts with A issuance/B canonical owner and
unchanged passive deadlines, browser/query boundary denial, actual suppressed
logout response yielding 503, A revoked-token denial and explicit retry. Separate
production-graph clock checks pass 24-hour idle denial on A/B and seven-day
absolute cap under test IPC operational renewals and real rotation. Clock worker
test corrections preserved the database guard; no shipping expiry change.

Real protected issuer/recipient browser reset passed for native.other, proving
old-token denial on A/B, fresh password, authentication-version increment and
unchanged t001. Its private handoff is updated; native.responder is unchanged.
Node CA/hostname checks accompany the known leaf SPKI pin used only in test
Chromium. These prove prepared backend/browser controls, not the remaining actual
Android B/response-loss/reset/expiry UI checks. Full final regressions are pending.

Final runtime repeat: native.admin and native.responder A/B checks pass; repeated
native.other preparation reached normal sign-in HTTP 429. Existing admission
limits were preserved and no shared budgets cleared. The earlier complete
three-account TLS check, subsequent real native.other reset and independent clock
checks passed. B is selected for device continuation; this repeat is not recorded
as a complete additional self-check pass.

2026-10-13 (+08:00) device-lock/resume revalidation passed: after instructed
emulator lock/unlock, supplied trace shows App state background then active,
protected token read completed, HTTPS session HTTP 200 and verified access.
User confirms the MyIMS fingerprint prompt appeared after Android unlock and
was approved. This establishes reported authenticated automatic resume and
canonical revalidation, not direct SecureStore execution while Android remained
locked. Cross-replica, reset, lifetime/response-loss and final regressions remain.

2026-10-13 (+08:00) interrupted-write local cleanup passed: following marker
quarantine, user supplied Local access cleared. No stored session was available
to revoke, with trace of marker write, token deletion/readback and marker deletion.
The interrupted token was never saved, so this establishes local cleanup only;
no server orphan-token revocation is claimed. Exact interruption timing remains
uncaptured. Device-lock, cross-replica, reset, expiry/response-loss and final
regressions are still required before completion.

2026-10-13 (+08:00) interrupted-write restart quarantine observed: following
pause-write/force-stop/relaunch instructions, user supplied completed pending
marker read and hidden authority with cleanup retry. No token read or session
request follows the marker read in the trace. This is reported retained-marker
restart denial; exact pre-deadline pause timing is not captured. Cleanup remains
to be checked. The issued orphan token cannot be claimed revoked after process
loss; the server lifetime bounds that unreachable token.

2026-10-13 (+08:00) biometric cancellation cleanup recovery passed: after the
documented cancelled token read and hidden UI, user supplied confirmation of
sign-out/protected-storage clearing following approved explicit cleanup. Trace
shows marker write, token deletion/readback and marker deletion. This completes
the reported cancellation/recovery sequence; actual device-lock denial and
interrupted-write recovery remain separate outstanding checks.

2026-10-13 (+08:00) biometric cancellation denial observed: after instructed
Check access and fingerprint cancellation, supplied trace shows token read failed
and the screen hides protected UI with explicit sign-out/storage-cleanup retry.
Prior HTTP 200 remains earlier history and does not grant access after the failed
read. This is reported prompt-cancellation evidence, not device-lock evidence.
Explicit authenticated cleanup recovery remains to be checked.

2026-10-13 (+08:00) injected deletion-failure recovery restart passed: after
confirmed explicit cleanup, user supplied the instructed relaunched app showing
Sign in to continue with storage reads and no restored verified access. Combined
with the HTTP 201 logout, injected rejection and cleanup confirmation, this
completes the reported Android deletion-failure recovery sequence. Other native
failure checks, independent B, reset, expiry/response-loss and final checks remain.

2026-10-13 (+08:00) injected deletion-failure cleanup retry passed: after the
reported logout HTTP 201 and injected deletion rejection, explicit cleanup retry
produced Sign-out confirmed and protected storage cleared. Supplied trace shows
marker write, token deletion/readback and marker deletion. This establishes
reported recovery from the injected local deletion failure. Post-recovery restart
denial remains pending, along with the other outstanding acceptance gates.

2026-10-13 (+08:00) injected deletion-failure quarantine observed: supplied native
trace shows Armed: delete, HTTPS logout HTTP 201, protected pending-marker write
completed, then Injected token-delete rejection after real protected marker.
Protected UI is hidden and Retry sign out and storage cleanup is displayed.
This establishes reported revoke-before-delete ordering and blocked authority
after the injected local failure. Explicit cleanup and restart denial remain
pending; no cross-replica revoked-token replay is established by this screenshot.

2026-10-13 (+08:00) native injected write-failure recovery passed: user confirmed
Armed: write before the attempt, supplied blocked-access/cleanup evidence, then
supplied Sign in to continue after explicit stored-access retry. No verified
authority was shown for the failed attempt and no usable stored token remained.
This proves the reported test-harness rejection path around actual Android
storage, not an Android-generated write failure. The rolling trace omitted the
injection and logout messages; no independent orphan-token replay is claimed.
Deletion-failure, interruption/locked storage and the remaining matrix are open.

2026-10-13 (+08:00) fault attempt observation: user screenshot shows access
unavailable/uncertain, pending-marker write, token deletion/readback and marker
deletion, with protected UI hidden. The ten-message rolling trace omits the
earlier injection event. User subsequently confirms Armed: write before sign-in;
this records the rejected-write attempt's blocked access and observed cleanup.
Explicit retry must still establish absent stored access afterward.

2026-10-13 (+08:00) native post-logout restart denial passed: following confirmed
logout and the instructed force-stop/relaunch, user supplied Sign in to continue
with storage reads and no restored verified access. This completes the reported
Android normal-path sign-in, retained-token restart, logout/cleanup and signed-out
restart sequence. Failure/recovery, cross-replica, reset, expiry/response-loss and
final regression evidence are still outstanding; c/parent are incomplete.

2026-10-13 (+08:00) native normal logout passed: after verified access/restart,
user supplied Sign-out confirmed and protected storage cleared with trace of
protected pending-marker write, token deletion/readback and marker deletion.
The controller emits this confirmation only after successful server logout and
confirmed local cleanup. This is reported normal-path device evidence, not an
independent replay of the revoked token, cross-replica revocation or injected
deletion-failure evidence. Post-logout restart denial remains to be checked.

2026-10-13 (+08:00) native retained-session restart passed: user supplied the
verified sign-in starting screen, followed the instructed force-stop/relaunch
sequence and supplied a screen showing completed marker/token reads, session
HTTPS HTTP 200 and Staff access verified. This proves the reported Android
process-restart retrieval and canonical session revalidation path, including
explicit retry if offered. It does not establish immediate automatic unlock,
locked/cancelled storage, logout/fault cleanup, independent replica B, reset or
lifetime/response-loss acceptance. Those checks and final regressions remain
required before C-05–09 and parent closure.

2026-10-13 (+08:00) restart attempt remains inconclusive: the subsequent screen
shows Sign in to continue after completed storage reads, with no session request.
User confirms intervening sign-out or a fault control. This is not retained-token
restart evidence and is not sufficient to establish logout or fault recovery.
A clean force-stop/relaunch directly from verified access remains required.

2026-10-13 (+08:00) user-reported Android success: the supplied screenshot from
the declared Pixel_8_API_36 acceptance app shows completed token write/readback,
pending-marker deletion/readback, HTTPS session HTTP 200 and Staff access
verified. This establishes successful native storage/session admission UI after
the GET correction. It does not establish process restart, cancellation/lock,
fault cleanup/logout, independent replica B, reset or lifetime/response-loss
acceptance. C-05–09 and parent completion remain pending.

2026-10-13 (+08:00) native GET correction: the desktop trace reports completed
protected token writes/readback/marker cleanup followed by session HTTP 403.
Fresh trusted-HTTPS checks pass sign-in/session/logout for all three accounts,
including native.admin. The actual installed whatwg-fetch Request reproduces
query rewriting for cache: no-store GET, conflicting with the intentional native
ingress query denial. Removed that fetch option and retained cache prevention
through request/ingress response Cache-Control: no-store headers. Regression
coverage constructs actual native Request objects for all transport calls and
asserts exact URLs, no-store and omitted browser credentials. Focused checks pass;
patched desktop session success is now reported above; the remaining native
matrix is pending.
Android and iOS release exports also pass for this correction; these bundles do
not establish a successful desktop device session.

2026-10-13 active fixture preparation: user explicitly authorized separate test
accounts after the ordinary draft tenant denied mobile sign-in. The development-only
fixture utility creates a separately named tenant and three staff records through
audited repositories, uses the audited test-only draft-to-active transition, and
sets two responder passwords through the real single-use credential-action service.
The seeded administrator is a fixture control, not production bootstrap/onboarding.
Passwords are kept only in the owner-only private handoff and are not logged.
All three accounts pass CA/hostname-verified HTTPS sign-in, canonical session,
logout and revoked-token denial. Existing t001 tenant/staff state and authority
versions remain unchanged. This proves fixture/API readiness, not patched-device
storage or operator-facing activation. Native acceptance, independent B,
clock/response-loss checks and final parent closure remain pending.

2026-10-13 desktop follow-up: user reported a successful Windows release APK
build/install/launch on Pixel_8_API_36. The desktop HTTPS probe with the public CA
and Schannel best-effort revocation returned expected anonymous native-session 401. Native Retry stored access reports Sign in to continue (absent stored token).
Actual sign-in still failed. The installed React Native 0.83.10 uses
abort-controller 3.0.0, whose AbortSignal has no static timeout method; the previous
transport therefore threw before fetch. Authored mobile transport now uses
AbortController with a seven-second timer cleared on every completion. Focused
checks execute success/timeout/HTTP-denial paths with the installed native abort
polyfill; mobile port checks, lint, typecheck and formatting pass. This is runtime
compatibility regression evidence, not a successful patched-device sign-in. The
desktop must copy the correction into the acceptance app and rebuild. Full
device/storage and remaining multi-replica acceptance are still pending.

2026-10-13 resumption (Asia/Manila, +08:00): native ingress private-interface
readiness passes with the user-provided public mkcert root: sign-in 200, browser
CSRF 200, missing native credential 401 and browser/native confusion 403, with
verified TLS/no-store. Its certificate matches localhost and the private key.
The earlier loopback CSRF 400 comes from the existing all-trusted-source-chain
rejection; representative socket-source probes pass without weakening that policy.
The live browser readiness probe now uses an ephemeral Chromium tunnel and passes
alongside the separate ingress on workspace 3444; its previous failure was a
test-tunnel port collision. Canonical identity/action/migration snapshots remain equal.

Separate ignored `com.myims.responder.acceptance` staging is delivered, with an
exact-host public CA plugin, cleartext denial and storage write/delete/pause controls
around the actual adapter. Typecheck, Expo Android prebuild and Hermes export pass.
Generated manifest/resource and bundle transport-secret checks pass. Native-port
tests verify the controls' marker/quarantine/retry placement; those remain injected
port evidence, not OS/device results. The first isolated export could not resolve
Expo through the dependency junction; explicit Metro dependency/watch paths correct
it and the subsequent export passes. See
[Windows desktop execution](../runbooks/staff-native-acceptance.md).

User declared Windows and serial emulator-5554; private ADB host/port is not
configured. Server has no Android SDK/JDK/ADB client. Native APK build/install,
emulator trust/storage/UI, A/B switching, reset/revoke/outage and expiry evidence
remain pending. Focused `./dev exec pnpm check:staff-auth --browser` passes,
exit 0, including C-01–04/08, issuer/recipient A-02/07, owner races/recovery,
keyboard/axe/reflow and secret diagnostics. Final `./dev check` passes, exit 0,
including all ordinary builds, client secrecy scans, audit/worker/storage/identity,
platform/draft/staff HTTP/browser/credential, limiter and session recovery checks.
Normal Android/iOS bundles exclude acceptance fault-control labels and the CA
resource name. Live companion readiness passes after the ordinary rebuild.
The unit remains blocked on actual native acceptance; no child or parent
completion is claimed.

Current checkpoint 2026-10-13, Asia/Manila (+08:00): reported native device
acceptance and final full Docker check have passed. Unit and parent are complete. The earlier preparation-only checkpoints above are
historical and do not describe the current device state.

## Delivered implementation

- Exact three-field browser sign-in, named bounded staff auth forwarding,
  server-checked canonical protected shell and real administrator issuer integration.
- Canonical qualified-owner mounted work, hide/focus/overlay behavior, callback epochs,
  explicit same-owner reauthentication, foreign-owner clearing and uncertain logout retry.
- Native HTTPS authentication/current-session/logout consumer and Expo SecureStore
  adapter with authenticated namespace, pending-operation quarantine, bounded flights,
  orphan reconciliation, replacement and confirmed server revocation/local cleanup.
- Reusable staff TLS ingress with browser/native channel separation and private
  upstreams; private launcher, guides, transport/storage contract and recovery runbook.
- Non-shipping incident form/write aliases and real-service browser acceptance;
  deterministic JavaScript native port/failure acceptance with explicit OS limits.

## Acceptance boundary

| Criterion | Evidence/state                                                                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Actual operator draft/setup/exchange, draft sign-in denial and real staff issuer login pass focused production HTTPS browser acceptance                                                                                                                                                                                     |
| C-02      | Production Next HTTPS, canonical qualified owners, source/origin/CSRF/cookie/no-store/safe-return and cross-plane denial pass focused browser acceptance                                                                                                                                                                    |
| C-03      | Browser logout/response-loss retry and reset pass; serial full-run staff HTTP regressions pass A/B revocation, authority mutations, stale restoration and response-loss boundaries                                                                                                                                          |
| C-04      | Mounted same/foreign-owner recovery, dialog hiding, actual browser idle deadline, reset recovery, guarded expired submissions and late callback fencing pass focused browser acceptance                                                                                                                                     |
| C-05      | Reported Android release app on Pixel_8_API_36 passes trusted HTTPS, protected token persistence/restart and canonical native.responder owner on B; boundary/leakage checks pass automated ports and real TLS checks                                                                                                        |
| C-06      | Reported Android protected-storage quarantine/recovery passes injected write/delete/interruption, cancellation, authenticated resume, retained-token reset denial and fresh replacement; real server revocation and JavaScript orphan/callback checks pass. Physical locked reads and OS-generated failures are not claimed |
| C-07      | Reported Android 24-hour idle and original seven-day absolute expiry deny with B HTTP 401. Real backend A/B clock/activity/rotation and passive-deadline checks pass; device time was not changed                                                                                                                           |
| C-08      | Shared 11 UI and integrated keyboard/axe/reflow checks pass; reported Android controls, fingerprint, status/retry and secret clearing paths pass. Native automated accessibility audit is not claimed                                                                                                                       |
| C-09      | C-01–08 and all parent criteria pass; final full `./dev check` exits 0. Guides/runbooks/index/tracker are synchronized and fixture cleanup verified. Declared local/device limits remain.                                                                                                                                   |

## Parent reconciliation

| Parent criterion | Result / remaining condition                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01            | Approved G-01–06 contracts and handoff guide retained; no policy change                                                                                       |
| AC-02            | Real operator draft/setup/recipient exchange and ordinary draft sign-in denial pass                                                                           |
| AC-03            | Approved state/permission matrix, password bounds, action expiry/cancel/reissue/single use and foreign-target denial pass                                     |
| AC-04            | A/B lifecycle races, audit/database rollback, lost-response reconciliation and stale password/session denial pass                                             |
| AC-05            | Distinct tenant-qualified same-username owners and generic ineligible/wrong-credential denial pass                                                            |
| AC-06            | Shared limits, source qualification, verifier capacity/races and PostgreSQL/Redis failure regressions pass                                                    |
| AC-07            | Production HTTPS cookies, CSRF/origin/proxy/no-store/safe returns and both cross-plane directions pass                                                        |
| AC-08            | Reported actual Android protected storage/TLS, B owner, restart, injected failure/replacement and cleanup pass with declared evidence limits                  |
| AC-09            | A/B backend revocation/reset/mutations/restore, browser retry and reported Android normal/lost-response logout/reset pass                                     |
| AC-10            | Backend lifetime/rotation, browser owner recovery and reported Android idle/absolute expiry pass                                                              |
| AC-11            | Browser accessibility/issuer/recipient and reported Android status, cancelled authentication and uncertain-response/storage recovery pass                     |
| AC-12            | Complete parent matrix passes; current full Docker graph exits 0, reported native evidence is recorded, documentation synchronized and exact fixture retired. |

## Commands and limits

- `./dev exec pnpm check:staff-auth --mobile`: pass, JavaScript port boundary only.
- `./dev exec pnpm --filter @myims/responder-mobile build`: pass, Android/iOS
  Hermes bundle export only; no APK/device storage execution.
- `./dev exec pnpm --filter @myims/command-center-web build`: pass; final full
  graph also builds the current source and all other applications.
- `./dev exec pnpm check:ui`: all 11 tests pass. Shared labels append “(required)”;
  corrected new selectors to match their accessible names. Restored the public
  credential exchange main landmark after removing its previous shared root shell.
- `./dev exec pnpm check:staff-auth --browser`: pass, exit 0, actual production
  Next/ordinary HTTP A/B HTTPS and real issuer/recipient exchange. Recipient
  exchanges use separate unauthenticated browser contexts; staff cookies are
  correctly rejected by the public exchange boundary. Shared required labels,
  modal background accessibility and settled-response retry timing are accounted
  for in fixture selectors/waits without changing production policy or deadlines.
- The first `./dev check` passed lint/format/typecheck/builds, foundation/storage/
  audit/identity/platform/draft/staff HTTP and credential API regressions, then
  stopped at the new browser fixture. Initial concurrent focused runs also had
  barrier/response timing failures. These runs are not counted as full passes.
  A formatting-only restart was also needed after updating this checkpoint.
- Final serial `./dev check`: pass, exit 0, including lint/format/typecheck/all
  builds, runtime/database/audit/workers/storage/identity/bootstrap, client artifact
  scans and full identity/session/platform/draft/credential/staff HTTP/browser
  and limiter/lifetime/recovery regression graph.
- Documentation relative links and whitespace checks pass at the checkpoint.

Browser fixtures use isolated migrated PostgreSQL/runtime grants, authenticated
Redis, two independent ordinary Nest HTTP processes, production Next applications,
actual HTTPS and socket-derived client attribution. The non-shipping writer alone
uses the existing test HTTP graph with canonical guard/transaction/audit enforcement.
Temporary localhost certificates and explicit Chromium test-only trust exceptions
do not establish actual native TLS trust. No production activation/readiness is claimed.
No secret-bearing screenshots/traces/logs are captured by staff browser acceptance.
Only fixture-owned databases, keys, certificates, processes and containers are removed.

## Resume conditions

The later user-authorized local browser recipient composition is now running:
`https://127.0.0.1:3444/credentials` via desktop SSH to server loopback 3102.
`./dev staff-https-check` passes the actual retained-CA/hostname TLS path, recipient
and staff CSRF contexts, denial probes, private-network isolation, ordinary
artifact secrecy, hydrated Chromium form and unchanged identity/action/migration
snapshots. No code/password was submitted. The platform stack remains ready.
See the [local companion runbook](../runbooks/staff-development-https.md).
This browser development CA and one-backend composition do not satisfy native
Android trust, A/B device evidence or actual OS protected-storage criteria.

Later desktop troubleshooting confirmed bootstrap HTTP 401 on **Set credentials**.
Clean live requests pass; ordinary workspace cookies reproduce the denial before
exchange. Recipient bootstrap now distinguishes blocked browser sessions (401),
request boundaries (403) and unavailable service, without weakening cookie/CSRF
policy. The companion is rebuilt and ready; real Chromium verifies the denial message,
cleared secrets and zero exchange requests with a synthetic workspace cookie.
The full Docker pass above predates this message-only follow-up; targeted
command-center lint, ordinary build and `./dev staff-https-check` pass for the
follow-up. Canonical snapshots remain unchanged and the platform stack stays ready.

A subsequent recipient-host isolation fix addresses persistent localhost cookie
collisions: recipient `https://127.0.0.1:3444`, staff `https://localhost:3444`, same
SSH tunnel and retained CA. A separate private leaf covers both names; the old
recipient address redirects to the IP host. Only exchange/assets are served on
that host; staff/native consumers deny. Real Chromium proves localhost workspace
cookies do not reach the recipient (bootstrap 200); deliberate workspace cookies
on the recipient still deny before exchange and clear inputs. Live
`./dev staff-https-check` and `./dev exec pnpm check:staff-auth --browser` pass.
Host-loopback recipient/staff CSRF return 200 with trusted CA/hostname, the old
recipient page returns 307 and platform remains 200. Canonical snapshots are equal;
no real code/password was submitted. Changed scripts lint/format and doc links/
whitespace pass. The full Docker pass above predates this scoped ingress fix;
actual native OS evidence is still outstanding.

Review/prepare the Android document: desktop OS/ADB serial/build, a reachable exact
HTTPS origin with native-trusted certificate chain, screen lock/biometric setup,
native development/release app installation, private A/B switching and reproducible
storage/restart/locked/write/delete/revoke/reset/expiry evidence. Complete C-05/06
and native portions of C-07/08, then reconcile all parent AC-01–12 and rerun required
checks before marking c or parent complete. General activation, persistent incident
drafts, full responder journeys and production rollout stay with later units.

2026-10-13 UTC diagnostic follow-up: the user reports four approved biometric
prompts and uncertain access. The separate acceptance app now retains the last
ten finite storage-operation, HTTP-status and app-state messages after dialogs
close. It does not record credential/token values, headers or error contents.
Focused lint, staged TypeScript and mobile port checks pass, including trace
token-omission coverage. Deadline expiry and app-state invalidation are still
unconfirmed; desktop reproduction with this trace remains required.
