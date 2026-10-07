# P2-U3b platform browser access evidence

Completed 2026-10-07 09:11 +08:00 (Asia/Manila). B-01–08, a’s A-01–09 and parent
AC-01–11 passed; all required final checks passed, exit 0.

Requirement: [browser unit](../../context/feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md)
and [parent AC-01–11](../../context/feature-specs/p2-u3-platform-operator-sign-in.md).
Prerequisite: [P2-U3a HTTP evidence](p2-u3a-evidence.md), including actual backend
credentials, canonical races, distributed limits, durable revocation and failures.
Implementation: [browser contract](../architecture/platform-browser-access.md),
[HTTP contract](../architecture/platform-authentication-http.md),
[operator guide](../guides/platform-operator-access.md) and
[deployment/recovery runbook](../runbooks/platform-authentication.md).

## Environment and procedure

Existing pinned Docker workspace, real isolated PostgreSQL database/migrations
and runtime grants, dedicated bounded session Redis, two independent backend HTTP
processes with actual production authentication adapters. Operators are provisioned
synthetically in the fixture-owned database with actual private password hashes;
there is no browser mock sign-in or shipping fixture issuer. Staff-only negative
fixtures use real shared sessions through private IPC.

The browser selection compiles production Next output separately under
`.local/platform-auth-next`, with a separate generated fixture TypeScript config.
Only this non-shipping build includes the unfinished-work form. Ordinary `.next`
builds resolve the typed verification import to an empty server component before
Next constructs the client graph. The real narrow app proxy receives HTTPS ingress
traffic, validates ingress/source and forwards through a private selector to A/B.
Ingress derives source from the actual browser socket (::1); the trusted backend
proxy socket is 127.0.0.1. This separates client/proxy address classes without
weakening the all-trusted-chain rejection. TLS uses an ephemeral localhost
certificate and Chromium's explicit certificate exception; Secure/HttpOnly/
SameSite/host-only flags remain enforced. This is local topology verification,
not production TLS certification.

Headless Chromium tab focus/visibility events are not consistent. Missing-signal
restoration explicitly dispatches a persisted `pageshow` event through the actual
mounted listener, verifies synchronous hiding, then awaits real backend canonical
validation. Cooperative tab invalidation and real history navigation remain browser
checks; no authentication responses are mocked.

Fixture response-loss controls truncate actual committed sign-in/logout replies
after starting the response, withholding cookies and the complete DTO. Closing
before any response bytes lets Chromium transparently retransmit a POST, so the
fixture tests ambiguity after response delivery begins and bounds client attempts;
backend outage selection uses a closed endpoint. Expiry checks alter structurally
valid fixture records/deadlines under the owner-only trigger bypass, then require
actual canonical backend denial. Absolute fence trigger is always restored in
finally. No production lifetime is shortened or passive renewal introduced.

No screenshots, traces, HARs or request-header artifacts are produced by auth
checks. Browser failures report only phase, source line and named route/status,
because Playwright exception details can contain credential fill values. Captured
Next diagnostics are checked against sensitive sentinels. Launcher owns exact
Redis/database/process/certificate cleanup; ignored build caches hold no runtime
credentials. No operational account or secret is seeded.

## Acceptance mapping

| Browser ID | Concrete implemented check                                                                                                                                                                                                                                                                            | Parent coverage             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| B-01       | Actual HTTPS Next proxy and accepted Secure/HttpOnly cookie, empty document.cookie/storage, safe DTOs, conflicting bearer/duplicate/malformed-cookie denial, private listener rejection; a retains direct-backend Origin/CSRF/channel/security scans.                                                 | AC-01, AC-04–05             |
| B-02       | Provisioned operator signs in to root/deep UI preview, A-issued cookie works through B, SSR/API deny revoked/status-changed cookies and real staff sessions. a/authority regressions retain version/hostile-field/permission races.                                                                   | AC-02, AC-06                |
| B-03       | B confirms logout and A rejects; outage/lost logout exposes truthful explicit retry, including fresh pre-auth CSRF when absent. a/lifecycle regressions retain other-device isolation, concurrent renewal and actual stale restore fencing.                                                           | AC-07, AC-09                |
| B-04       | Idle/absolute fixture deadlines hide values and pause submission; an open dialog hides synchronously, releases focus and resumes only for the same owner. Different-owner shell reset and zero replay are checked. Passive records stay identical; a/lifecycle retain fixed absolute rotation checks. | AC-08                       |
| B-05       | Actual expired 401, wrong-plane 403, exhausted real allowance 429, closed-backend 503 and committed lost responses produce distinct safe UI; work survives outage and explicit recovery reads cannot replay writes.                                                                                   | AC-09                       |
| B-06       | Label/autocomplete/focus/keyboard checks, direct duplicate-submit bound, password clear/username retention, actual axe/reflow at 1440/768/390/320, local deep-link return and external fallback. UI regression tests cover encoded/scheme-relative/sign-in-loop return tricks.                        | AC-10                       |
| B-07       | Browser history, cooperative tab invalidation, delayed logout signals and disabled BroadcastChannel identity switches hide cached presentation and clear foreign-owner work; backend restoration/action checks remain authoritative. Documented in-memory lifetime and owning-form hook.              | AC-06, AC-08                |
| B-08       | Final browser/default/session/full Docker commands, built-client exclusion, UI regression checks, guide/contracts/index/tracker and cleanup evidence passed below.                                                                                                                                    | AC-11 and complete AC-01–11 |

## Parent criterion coverage

| Parent ID | Integrated verification                                                                                                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01     | Named backend/browser contracts, exact ingress/source/Origin/CSRF configuration, private listener rejection and no browser identity store or issuer.                                                                                                        |
| AC-02     | a's real credential, normalization/exact-byte, generic denial, dummy verification, saturation/internal-failure and canonical issuance races; B-02 actual normalized keyboard sign-in.                                                                       |
| AC-03     | a's independent A/B pre-verification source/identity budgets and spoof/invalid-field rejection; B-05/06 unknown-identity real 429, bounded Retry-After and zero automatic requests; complete session admission regressions.                                 |
| AC-04     | a's prohibited cookie/bearer channels and safe DTOs; B-01 accepted host-only Secure/HttpOnly/SameSite cookie, exact browser DTO, empty document.cookie/storage and URL/client-bundle/diagnostic exclusion.                                                  |
| AC-05     | a's missing/foreign/context-mismatched CSRF/Origin and representative protected mutation checks; B-01 actual narrow proxy mutation denials and unchanged passive records. No Server Actions are introduced.                                                 |
| AC-06     | a/HTTP authority canonical disable/version, permissions, hostile fields and lookup/issuance races; B-02/07 actual SSR/deep link/API/staff denial, no-store responses, history and signal-independent restoration.                                           |
| AC-07     | a/lifecycle A/B logout, absent retry, wrong-plane, renewal ordering and actual stale Redis restore; B-03 A-issued cookie through B, B logout denied on A and tab hiding.                                                                                    |
| AC-08     | a/lifecycle bounded idle/absolute, conditional activity and fixed rotation cap; B-04/07 actual mounted non-secret work retention, same canonical owner recovery, different-owner clearing and confirmed logout/local feature reset.                         |
| AC-09     | a/lifecycle real primary/Redis outage, write rejection, committed response loss and stale restoration; B-03/05 safe 401/403/429/503, actual committed truncated replies, truthful logout retry, fresh absent-session CSRF and zero stale submission replay. |
| AC-10     | B-06 shared dark primitives, keyboard sign-in/reauth/logout, focused errors/retry, password clearing and duplicate bound; axe and desktop/tablet/narrow reflow; normal UI return-path and shared-foundation regressions.                                    |
| AC-11     | Required commands below, normal build fixture exclusion, complete identity/session/storage/worker regressions, guide/contracts/runbook/docs index/tracker and fixture-owned cleanup.                                                                        |

## Final command results

| Command                                         | Result                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:platform-auth --browser` | Passed, exit 0, after final isolated module selection: complete actual browser matrix and lifecycle/recovery tail.                                                                                                                                                          |
| `./dev exec pnpm check:platform-auth`           | Passed, exit 0: combined parent HTTP/HTTPS/browser matrix. The complete matrix also reran inside final full Docker verification.                                                                                                                                            |
| `./dev exec pnpm check:session-foundation`      | Passed, exit 0: authority, platform HTTP/browser, distributed admission and lifecycle/recovery. The same complete command reran inside final full Docker verification.                                                                                                      |
| `./dev exec pnpm check:ui`                      | Passed, exit 0: all nine normal-build regressions on final shipping output.                                                                                                                                                                                                 |
| `./dev check`                                   | Passed, exit 0, on final implementation: lint/format/typecheck, all shipping builds, entrypoints/configuration, foundation/durability/storage/identity/bootstrap, all five client scans, storage deployment and complete integrated session/authentication/recovery matrix. |

Normal shipping output excludes all three verification-form text sentinels, as
well as identity/storage credential/configuration/import sentinels. The isolated
build positively verifies the real form through its actual browser journey.
Changed documentation links, launcher syntax and whitespace checks passed.
Owned database/Redis/process/certificate and provider fixtures were cleaned up;
no operational account or secret was seeded. Temporary diagnostics were removed.

Implementation verification corrected post-render retry focus and coalesced
restoration reads while retaining backend limits/timeouts. A focused iteration
observed a committed sign-in with an unavailable browser response; subsequent
focused, combined, complete-session and final full-browser runs passed. Issuance
was never automatically retried. Hydration-disabled inputs and explicit POST
prevent early native credential submission into URLs. Application alerts exclude
Next's route announcer. Protected overlay scope contains portals and releases
focus traps during reauthentication.

The first full run caught Next retaining an imported client fixture despite a
disabled render branch. Final build selection uses TypeScript paths: normal
configuration resolves an empty server component, isolated configuration resolves
the real form before graph construction. Configuration-generating harness changes
invalidate the isolated build fingerprint. Both build paths and final client
exclusion were verified without bypassing the scan.

## Limits and handoff

No PBX/tenant screens, durable incident drafts, browser-storage persistence,
account reset/recovery/MFA, staff/mobile authentication, sockets or production
infrastructure are delivered. Refresh/process loss discards memory. P5-U4 owns
real incident draft recovery/conflicts; Phase 3 receives current canonical principal
composition and the small form hook. P2-U4 receives reusable cookie/CSRF transport,
with no staff grant or setup/reset/mobile policy inferred. Production origins,
trusted ingress network controls, TLS/HA/capacity and the remaining Phase 2 staff
gate remain unverified.
