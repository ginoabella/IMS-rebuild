# P2-U3b — Platform browser access and isolated reauthentication

## Status and purpose

- **Status:** complete; 2026-10-07 09:11 +08:00 (Asia/Manila). B-01–08 and parent AC-01–11 passed; see [combined evidence](../../docs/status/p2-u3b-evidence.md).
- **Requirement:** [P2-U3 parent scope and acceptance matrix](p2-u3-platform-operator-sign-in.md).
- **Goal:** deliver the actual operator browser sign-in/logout journey and preserve unfinished work across expiry with canonical identity isolation.
- **Completion boundary:** a provisioned operator enters a protected platform console through the real app, signs out across replicas, and reauthenticates to recover only their own retained form values; the complete parent AC-01–11 matrix passes.

The user adopted the two-unit split on 2026-10-06. b owns the browser application,
its transport composition and isolated reauthentication, together with integrated
parent acceptance. It cannot use mocked authentication or defer required browser
security/access checks to Phase 3.

## Starting state and dependencies

Require verified [P2-U3a](p2-u3a-platform-authentication-http-boundary.md), including
A-01–09, documented endpoints, cookie/CSRF/source topology, logout retry behavior,
real-service fixtures and safe evidence. Recheck P1-U4 shared primitives/shells and
[UI conventions](../../docs/architecture/web-ui-foundation.md).

Reuse a's transport and backend authority; do not change credential, session,
limiter or CSRF policies to simplify the UI. The platform home remains a foundation
preview until protected server/browser composition is implemented and verified.
Approved web lifetime remains 60-minute idle/12-hour absolute; passive traffic does
not renew and rotation cannot extend the original absolute deadline.

## Scope and ownership

Allowed changes: platform app sign-in/protected layouts and feature components,
a narrow same-origin proxy if selected in a's contract, server auth composition,
logout/expiry/error handling, identity-bound in-memory form-state integration,
named consumer DTO usage, actual browser checks, operator guide and full parent
evidence/docs/tracker. Extend shared primitives only when required by this journey.

NestJS remains authoritative for credentials, sessions, canonical status/version
and permissions. Next.js neither queries identity tables nor mints tokens. Proxy
or Server Actions validate/forward through a's contract and never bypass it.
Backend corrections required by integration remain within a's documented boundary
and need focused regressions; do not silently weaken accepted behavior.

Out of scope: PBX/tenant management screens, fake operational features, staff or
mobile authentication, operator reset/recovery/MFA, durable incident drafts or
browser-storage retention, sockets and production infrastructure. A non-shipping
operational form fixture verifies the state-preservation contract; P5-U4 owns real
incident draft persistence/conflicts and its actual user journey.

## Browser entry and protected console

Unauthenticated root/deep-link access reaches a distinct platform sign-in page.
It contains exactly Username and Password identity fields and identifies the
platform console clearly. Normalize only username; password bytes retain a's
semantics. Use shared dark theme/form/button/status primitives, visible labels,
`username`/`current-password` autocomplete and accessible errors/focus handling.

Preserve username on invalid credentials or service failure; clear password after
each attempt. Pending submission prevents duplicate clicks; statuses distinguish
invalid credentials, rate-limit retry, access denial and temporary unavailability
without exposing identity/status existence. Do not automatically retry ambiguous
sign-in issuance. Honor bounded `Retry-After` without generating request loops.

Obtain valid pre-authentication CSRF context through a's named contract. Successful
login receives an HttpOnly cookie and fresh authenticated CSRF context, then enters
the console. Token/cookie material never enters JavaScript, URLs, storage, client
bundles or diagnostics. CSRF proof may be consumed through its declared non-secret
transport channel; do not expose the authentication cookie to obtain it.

Return destinations are allowlisted local console paths: reject external origins,
scheme-relative/encoded redirect tricks and sign-in loops. Without a safe return,
use the platform home. No unfinished operational values appear in query strings.

Protect server-rendered pages/layouts, server reads, direct API calls and any
Server Actions through current backend validation. Cookie presence alone or
client-side redirects/navigation do not establish access. Use no-store for
protected fetches/responses; avoid shared protected-data caching. A valid staff
session yields denied platform access and cannot enter the console.

## Same-origin transport and logout

If a chose a Next.js proxy, implement only its named consumers and required header
forwarding. Propagate safe Set-Cookie, no-store, Retry-After and fixed errors;
preserve exact Origin/CSRF semantics and a trustworthy source/proxy chain.
Do not accept arbitrary destinations, forward client-asserted principals or leak
backend service credentials. Apply the same contract to Server Actions if used.
Actual direct-backend/proxy requests are included in acceptance.

Expose a clear logout action in the protected shell. Use POST with authenticated
CSRF; a confirms durable single-session revocation before cookie clearing/success.
Then clear retained in-memory work and protected presentation and return to sign-in.
Use a's fresh pre-authentication CSRF retry contract for repeated/absent logout.

If logout is unavailable or uncertain, show retryable feedback and do not claim
success across replicas. A separate local UI hide may protect presentation, but
it cannot be presented as confirmed shared logout. Cross-tab signals may promptly
hide invalidated content; tokens/operational values never travel in those signals,
and backend validation remains authoritative if signals are lost.

## Expiry and isolated unfinished-work contract

Use the [approved expiry handoff](../../docs/architecture/shared-session-lifecycle.md#handoffs).
A protected 401 blocks further submission and starts reauthentication while keeping
unfinished non-secret values in the still-mounted application state. Hide those
values behind authentication rather than unmounting/resetting them on redirect.
Bind retained work to the last validated canonical operator ID, never the typed
username, display casing or cookie presence.

After login, load canonical current-session identity. The same operator may resume
retained values and must explicitly submit under current authority. Another
operator receives a clean workspace with no prior values or protected content;
clear prior retained state on confirmed identity switch. The current authenticated
identity is the only resume authority. No stale submission automatically replays.

Treat 403 as denied access and 503 as retryable service unavailability; neither
silently erases unfinished work or becomes a misleading password error. A service
outage blocks protected actions and shows recovery feedback. Do not generate
background polling/heartbeats/renewal to avoid expiry. A genuinely fresh sign-in
starts a new lifetime; a rotation preserves the existing absolute deadline.

Explicit successful logout clears the identity's retained work. Browser history,
back/forward restoration and cross-tab identity changes cannot reveal protected
cached presentation or transfer work. Revalidate before restoring a retained page,
and hide protected content while authority is unknown. Test both cooperative tab
signals and missing/delayed signals; these never substitute for backend checks.

Provide a small reusable app integration contract for future forms: record the
canonical owner, retain/hide state on authentication loss, permit same-owner
resume, and clear on confirmed logout/identity switch. Avoid speculative form
frameworks or shared persistence infrastructure. Keep operational values out of
localStorage/sessionStorage and do not add draft tables or retention rules.
Refresh/process-loss recovery and real incident conflict handling remain with P5-U4;
this unit proves preservation during its supported expiry/reauthentication flow.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| B-01 | Actual secure-origin platform app consumes a's named cookie/CSRF contracts with trusted source forwarding. Browser accepts the required cookie flags; tokens are absent from client storage/JSON/URLs/logs/bundles. Proxy, direct backend and any Server Actions enforce Origin/CSRF/channel checks. | AC-01 browser; AC-04–05 integration |
| B-02 | Browser signs in using a real provisioned operator, reaches protected root/deep links, and signs out. Server-rendered reads/direct APIs require backend authority; staff sessions, forged tenant/role fields, stale versions and cookie-only checks cannot admit users. | AC-02 browser integration; AC-06 browser |
| B-03 | Sign-in through A works through B; logout through B denies A and other tabs. Confirmed logout clears work; retry/absent logout works, while outage/uncertain response retains truthful retry feedback. Parent races/stale-restore revocation checks remain passing. | AC-07 integration; AC-09 logout UI |
| B-04 | Idle and absolute expiry each pause submission and retain fixture form values. Same canonical operator resumes those values; different operator sees none. Reauthentication is not an automatic stale-write replay, polling does not renew, and rotation cannot extend absolute lifetime. | AC-08 browser |
| B-05 | 401/403/429/503 and lost issuance/logout responses render distinct safe states. Unavailability does not discard work or create local authority; recovery requires current canonical validation and absent sessions require sign-in. | AC-09 browser |
| B-06 | Form/logout/reauthentication works by keyboard with labels, deliberate focus, accessible status and contrast/reflow at desktop/tablet/narrow widths. Username survives invalid input, password clears, duplicate clicks are bounded and malicious return paths cannot redirect off-site. | AC-10 |
| B-07 | Back/forward restoration, tab invalidation and identity switches cannot expose cached protected data or another operator's retained values, including missing/delayed tab signals. Document in-memory lifetime and future form integration without claiming durable drafts. | AC-06 caching; AC-08 isolation |
| B-08 | Complete platform HTTP/browser suite reruns every parent AC-01–11; session regressions and required Docker checks pass. Guide, transport/recovery runbook, safe evidence, docs index and tracker map actual results and remaining limits. | AC-11 combined; all parent regressions |

Use the real app build and a's actual auth adapters with PostgreSQL/runtime grants,
session Redis and two independent HTTP processes. Browser checks must route real
requests through the selected secure origin/proxy; mock cookies, fixture-only token
issuers and one process receiving two calls are insufficient. Test real browser
cookie acceptance and prohibited cookie/channel behavior. Use isolated synthetic
operators/staff, fixture-owned form state and precise cleanup.

Use bounded clocks/barriers for expiry and races; do not wait for full production
lifetimes. The non-shipping form fixture proves in-memory preservation, not actual
PBX/incident persistence. Prevent sensitive request headers/passwords/tokens from
browser trace, screenshots, network artifacts or shared test output.

Provisionally add `./dev exec pnpm check:platform-auth --browser` and make
`./dev exec pnpm check:platform-auth` run the combined parent matrix, including a's
HTTP/secure transport checks. These commands/selections do not exist at spec
creation. During implementation record final commands/results and run existing
`./dev exec pnpm check:session-foundation` plus `./dev check`. Documentation-only
preparation requires consistency/link/coverage/whitespace checks.

## Completion and handoff

Complete b and parent P2-U3 only when B-01–08, a's A-01–09 and every parent criterion
pass. Publish an operator guide for bootstrap prerequisite, sign-in, logout,
expiry/reauthentication and outage recovery, plus safe evidence naming environment,
secure origin/topology, commands, results and material limitations.

Hand Phase 3 protected platform composition/current canonical principal and the
unfinished-form integration contract. Hand P2-U4 reusable cookie/CSRF patterns
without granting staff authority or deciding staff setup/reset/mobile policy.
Keep the Phase 2 gate incomplete until its remaining staff journey checks pass.
Production origins/HA/TLS/capacity and real incident draft recovery remain explicitly
unverified outside this boundary; never infer them from browser/Compose results.
