# P2-U4c implementation and evidence checkpoint

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

2026-10-12, Asia/Manila (+08:00). Unit and parent are **incomplete**;
P2-U4c is blocked on declared native-device preparation and acceptance.
The user requested the [Android preparation document](../planning/p2-u4c-android-emulator-preparation.md)
for desktop `Pixel_8_API_36`, API 36 / 36-ext17. No device connection, trusted native
HTTPS origin, native app installation or actual OS-storage evidence is claimed.

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

| Criterion | Evidence/state                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Actual operator draft/setup/exchange, draft sign-in denial and real staff issuer login pass focused production HTTPS browser acceptance                                                  |
| C-02      | Production Next HTTPS, canonical qualified owners, source/origin/CSRF/cookie/no-store/safe-return and cross-plane denial pass focused browser acceptance                                 |
| C-03      | Browser logout/response-loss retry and reset pass; serial full-run staff HTTP regressions pass A/B revocation, authority mutations, stale restoration and response-loss boundaries       |
| C-04      | Mounted same/foreign-owner recovery, dialog hiding, actual browser idle deadline, reset recovery, guarded expired submissions and late callback fencing pass focused browser acceptance  |
| C-05      | Native transport/storage code and Android/iOS JS bundle exports pass; actual declared Android OS/TLS/restart evidence pending                                                            |
| C-06      | JavaScript controller/injected adapter failures, interrupted-marker behavior, orphan revoke uncertainty, replacement and deletion retry pass; actual OS failure/restart evidence pending |
| C-07      | Serial staff HTTP idle/absolute/rotation regressions and actual browser idle deadline pass; native-device evidence pending                                                               |
| C-08      | All 11 shared UI checks and integrated issuer/staff keyboard/axe/reflow checks pass; actual Android UI evidence pending                                                                  |
| C-09      | Final full Docker/regression graph passes, exit 0; device evidence incomplete; no child/parent/Phase 2 completion                                                                        |

## Parent reconciliation

| Parent criterion | Result / remaining condition                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AC-01            | Approved G-01–06 contracts and handoff guide retained; no policy change                                                             |
| AC-02            | Real operator draft/setup/recipient exchange and ordinary draft sign-in denial pass                                                 |
| AC-03            | Approved state/permission matrix, password bounds, action expiry/cancel/reissue/single use and foreign-target denial pass           |
| AC-04            | A/B lifecycle races, audit/database rollback, lost-response reconciliation and stale password/session denial pass                   |
| AC-05            | Distinct tenant-qualified same-username owners and generic ineligible/wrong-credential denial pass                                  |
| AC-06            | Shared limits, source qualification, verifier capacity/races and PostgreSQL/Redis failure regressions pass                          |
| AC-07            | Production HTTPS cookies, CSRF/origin/proxy/no-store/safe returns and both cross-plane directions pass                              |
| AC-08            | Blocked: actual native OS storage/transport, restart, write/replacement failure and logout cleanup evidence                         |
| AC-09            | Backend A/B revocation, reset/mutations/restore and browser retry pass; native device logout evidence pending                       |
| AC-10            | Backend lifetime/rotation and mounted browser same/foreign-owner recovery pass; native device expiry evidence pending               |
| AC-11            | Real browser issuer/recipient/staff accessibility and uncertain-response recovery pass; native UI/storage recovery evidence pending |
| AC-12            | Full Docker regressions pass and guides/index/tracker delivered; complete parent matrix remains blocked on native evidence          |

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
