# P2-U3 — Platform operator sign-in

## Identity, status and requirement

- **Unit:** P2-U3, Phase 2 — Establish identities, shared sessions, and access boundaries.
- **Status:** in progress; a complete and verified, browser child b remains planned, 2026-10-06 (Asia/Manila, +08:00).
- **Requirement:** [P2-U3 in the implementation plan](../implementation-plan.md#p2-u3--deliver-platform-operator-sign-in), separate tenantless platform console access, and overview success criteria 2, 7 and 8 within this unit's boundary.
- **Dependencies:** complete P2-U2 (including a/b/c) and P1-U4; reuse complete P2-U1 operator credentials/bootstrap and P1-U5 audit conventions.
- **Result:** A provisioned operator signs in through the platform browser application, enters its protected console, signs out across replicas, and reauthenticates after expiry without losing or transferring unfinished work.

This specification defines intended behavior. Existing session/browser-foundation
checks do not prove this feature. The user adopted the two-unit split on
2026-10-06. The linked child specifications define the implementation sequence;
a is complete and verified; b remains planned. Parent completion requires both children.

## Sources and verified starting state

Follow [overview](../project-overview.md), [architecture](../architecture.md),
[UI context](../ui-context.md), [code standards](../code-standards.md),
[workflow](../ai-workflow-rules.md), and [delivery state](../progress-tracker.md).
Reuse these delivered contracts and their evidence:

- [Operator bootstrap/credential contract](../../docs/architecture/canonical-operator-bootstrap.md) and [P2-U1 evidence](../../docs/status/p2-u1c-evidence.md).
- [Canonical admission](../../docs/architecture/canonical-authority-admission.md), [HTTP authority](../../docs/architecture/canonical-http-authority.md), and [distributed admission](../../docs/architecture/distributed-admission.md).
- [Session lifecycle and reauthentication handoff](../../docs/architecture/shared-session-lifecycle.md), [recovery operations](../../docs/runbooks/session-foundation.md), and [P2-U2 integrated evidence](../../docs/status/p2-u2c-evidence.md).

P2-U1 supplies a tenantless canonical operator store, normalized username lookup,
active/ready admission, private credential reads, supported scrypt verification,
and a trusted bootstrap command. P2-U2 supplies shared issuance, canonical guards,
fixed lifetimes, durable lineage fences, revocation, trusted source extraction,
and distributed limits. P1-U4 supplies shared primitives and a distinct platform
shell. The platform home is currently a foundation preview, not protected access.

Current guards accept bearer credentials for foundation fixtures and reject
cookies. `IdentityHttpModule` does not export a sign-in/logout application service.
The bootstrap verifier returns false for both password mismatch and internal/busy
hash failures. Browser auth must integrate these boundaries deliberately rather
than interpreting existing fixtures as production cookie support.

## Scope and ownership

| Boundary | Responsibility |
| --- | --- |
| Backend `modules/platform/` | Operator sign-in/logout use cases, candidate/private credential ports, safe outcomes and platform HTTP adapters. |
| Backend `modules/identity/` | Reuse shared lifecycle/admission/principals; narrowly extend guard credential extraction for declared cookie consumers while retaining existing bearer consumers. |
| Password infrastructure | Reuse exact supported hash/byte semantics; expose bounded verification outcomes that distinguish mismatch from unavailable capacity/failure. |
| `packages/contracts/` and `packages/config/` | Named platform auth DTOs; validated server-only origin/cookie/CSRF/transport configuration. |
| `apps/platform-console-web/` | Sign-in form, protected server composition, same-origin transport if used, logout, expiry/reauthentication and isolated unfinished-work handling. |
| Checks/docs | Real browser and two-HTTP-replica checks, operator guide, transport contract, recovery handoff, evidence and tracker. |

Keep controllers thin. PostgreSQL and Redis stay authoritative; Next.js forwards
requests and composes UI, without authenticating passwords or minting sessions.
No identity duplication, new session service or speculative business tables.

Out of scope: operator creation/reset/recovery/MFA, tenant staff sign-in and mobile
storage (P2-U4), PBX/tenant management (Phases 3–4), incident persistence/draft
conflicts (P5-U4), sockets, public intake and production hosting/HA (Phase 9).
An expiry fixture can exercise unfinished form state without shipping a fake PBX
or incident workflow. Actual incident draft UX remains with its owning units.

## User journey

1. An unauthenticated operator opens the console or a protected deep link and
   reaches the platform sign-in screen. Preserve only an allowlisted local return
   destination; reject external, scheme-relative or sign-in-loop destinations.
2. The form has **Username** and **Password**, with no tenant identity field.
   Use accessible labels and password-manager autocomplete. Normalize username
   using the established ASCII rule; preserve password bytes exactly.
3. Valid credentials create a fresh tenantless web session. The browser receives
   an HttpOnly cookie and enters the protected console; it receives no token JSON.
4. Protected pages, direct API requests and any Server Actions enforce backend
   authority. Hiding navigation or checking cookie presence is insufficient.
5. Logout confirms shared revocation, clears the cookie and returns to sign-in.
   The former token fails on either replica, including another open tab.
6. At idle/absolute expiry, protected submissions stop and unfinished values remain
   behind reauthentication. Only the same canonically authenticated operator may
   resume that work. Another identity receives its own clean console.

## Authentication use-case contract

Bound the JSON body and raw fields before expensive work; reject unknown identity
fields, malformed text and unpaired Unicode surrogates. Username uses canonical
normalization/bounds. Password transport supports the existing bootstrap credential
representation (15–128 code points, maximum 512 UTF-8 bytes and its prohibited
characters), without trimming, case conversion or Unicode normalization. This
compatibility does not define future password setup/reset policy.

After transport/CSRF validation, call `Admission.signIn` with a trusted extracted
source and platform-qualified normalized username **before** candidate lookup,
private credential reads, verification or issuance. Approved ceilings are source
60 and identity 10 attempts per 900-second fixed window. Both dimensions count
valid attempts, including downstream failure/success; logout/success grants no
refund. Use established 429/Retry-After and unavailable 503 behavior.

Load platform candidate authority and credential material through existing owner
ports. Verify only the supported version/parameters using constant-time derived-key
comparison. Use an equivalent bounded dummy verification path for unknown/denied
identities so status/hash availability is not exposed through an obvious fast path.
Do not promise mathematically identical network timings. Bound per-process hash
concurrency/memory and reject excess work with retryable 503; do not queue plaintext
passwords. Malformed stored hashes grant no authority and yield the generic denied
result. Internal verifier failure/capacity exhaustion is unavailable, not mismatch.

Before issuance, require current eligible canonical authority and matching verified
credential authentication version; a password/account change between lookup and
issuance cannot authenticate against new credentials using an old proof. Reuse
P2-U2's trusted issuance recheck. Login creates fresh randomness and lifetime, never
adopts a client token or promotes staff authority. Rotation/renewal retains the
original creation time and absolute deadline.

| Outcome | Transport behavior |
| --- | --- |
| Malformed/invalid submitted identity input | Bounded 400, generic `Invalid credentials`; no identity lookup or issuance. |
| Unknown operator, wrong password, disabled/unset/ineligible operator | 401, identical `Invalid credentials` body; no identity/status disclosure. |
| CSRF/origin failure | 403, generic access denial; no credential work or mutation. |
| Shared limit exhausted | 429 and bounded `Retry-After`; no verification/issuance. |
| Database, Redis, fence, hash capacity or internal verification unavailable | Retryable 503 and `Retry-After: 1`; no usable authority or success claim. |
| Valid protected session with wrong identity plane | Existing 403; no platform data. |

All auth/protected responses are `no-store`; sanitize errors and diagnostics.
Credentials, cookies, plaintext tokens, lookup hashes, CSRF secrets and raw identity
input never enter URLs, logs, audit, metrics or client bundles. Audit existing
lifecycle mutations under their established actor contract; do not duplicate those
events or attribute failed login to an unverified operator. Record bounded security
outcomes/correlation without sensitive input.

## HTTP, cookies and CSRF

Define named contracts for sign-in (POST), current session (GET, passive), logout
(POST), and bounded CSRF bootstrap where needed. Exact route names are a routine
implementation choice documented before coding. Session reads expose only required
canonical operator identity/plane and safe expiry metadata. No GET mutates authority.

Use a single declared platform browser credential channel: a distinct host-only
Secure/HttpOnly cookie, `Path=/`, no `Domain`, explicit `SameSite=Lax` for a
same-origin design. Prefer a `__Host-` name. Cookie expiry cannot exceed the server
absolute deadline; Redis/canonical checks still enforce idle and revocation.
Never expose the token to JavaScript, localStorage or sessionStorage. Reject
duplicate/malformed auth cookies and conflicting cookie/bearer credentials rather
than silently choosing one. Preserve foundation bearer contracts with explicit
route/channel selection; staff tokens supplied to a platform consumer cannot grant
platform access. Arbitrary tenant/role headers or body fields never create a principal.

Use an explicit same-origin browser boundary, preferably a narrow Next.js proxy to
the existing NestJS HTTP process. Validate deployment origins and configure trusted
proxy hops; forwarding must preserve a trustworthy client source for shared limits.
The proxy forwards only required headers/cookies, propagates safe Set-Cookie and
errors, and never exposes backend service credentials. Session validation remains
in NestJS on every protected request. No wildcard credentialed CORS or generic
open proxy. Direct backend browser access, if selected, must meet the same declared
origin/cookie/source guarantees.

Protect **login as well as logout and all cookie-authenticated mutations** against
CSRF: validate exact allowed Origin and a bounded unpredictable CSRF proof bound
to browser/session context, including the pre-authentication context for login.
SameSite alone is insufficient. Specify proof issuance, validation, rotation after
login/session replacement and invalidation on logout; do not make the auth cookie
JavaScript-readable. Missing/foreign/ambiguous origins or missing/wrong/replayed
context proofs fail before work. New expired-session login can obtain a fresh
pre-authentication proof. Server Actions and proxy endpoints enforce the same
boundary, not a bypass around backend guards.

Development/browser checks must use a documented secure context that actually
accepts Secure cookies. Do not silently disable Secure for remote HTTP previews.
Production origin/cross-site deployment behavior, if unknown, remains an explicit
configuration/deployment prerequisite rather than an invented allowance.

## Logout, failures and reauthentication

Logout revokes only the selected platform session through P2-U2 durable fencing;
other devices remain unaffected. Handle repeat logout of an already absent/invalid
platform session as an idempotent clear-cookie success after CSRF/channel checks.
A live foreign-plane credential is denied. Confirm required revocation writes
before reporting success; Redis/database outage or uncertain writes returns 503,
not a falsely successful global logout. Preserve a retry path, and do not renew
logout or passive session reads. Browser cookie removal alone is not revocation.

A lost sign-in response does not permit token reconstruction or automatic replay
of ambiguous issuance. The user may perform a new sign-in. A lost logout response
can be retried through the idempotent revocation boundary. No local session fallback.

Use approved web 60-minute idle/12-hour absolute limits. Polling, health checks,
heartbeats and an open tab do not renew. Successful authorized operational activity
alone may renew idle within the original absolute deadline. Protected 401 pauses
submission and prompts reauthentication; 403 indicates denied access, and 503
shows retryable unavailability without treating it as expiry or discarding work.

Preserve unfinished non-secret operational form values during the reauthentication
flow, preferably in the still-mounted application state. Bind them to the last
validated canonical platform operator ID, never a typed username. Hide retained
values during authentication and from another operator; restore only after the
backend returns the same identity. Clear passwords after each attempt. Explicit
logout clears that identity's in-memory unfinished work. Cross-tab invalidation,
back navigation and identity switches cannot reopen protected data from cached UI.
Do not persist operational values in browser storage or add draft tables/retention
rules without the owning feature's policy. Reload recovery and durable incident
draft behavior remain P5-U4; U3 must preserve values through its supported expiry
flow and provide a reusable integration contract. Resume requires an explicit
user submission under current authority, never automatic replay of stale writes.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Contract fixes named consumers, input/errors, cookie/channel/CSRF/source topology, existing policies and pending deployment prerequisites; owner boundaries contain no duplicated session or credential store. |
| AC-02 | Real provisioned operator can authenticate; username normalization and exact password space/case/Unicode semantics work. Unknown, wrong, disabled, unset and malformed stored credential deny generically. Hash saturation/internal failure returns 503; dummy verification and bounded work are checked. |
| AC-03 | Shared pre-verification source/identity limits apply across A/B, including unknown identities and valid attempts. Proxy spoofing/invalid fields cannot bypass admission; 429/503 causes no issuance. |
| AC-04 | Actual browser receives accepted Secure/HttpOnly/host-only/SameSite cookie; token is absent from JSON, URLs, logs, storage and bundles. Duplicate/conflicting channels deny; staff/platform isolation holds with real shared sessions. |
| AC-05 | Login/logout and representative protected mutation reject missing/wrong/foreign/context-mismatched CSRF and Origin. Safe passive reads do not mutate. Proxy/Server Actions cannot bypass enforcement. |
| AC-06 | Direct/deep-link console access, API calls and server-rendered reads require current backend authority. Cookie presence alone, hostile tenant/role input and browser-back caching grant none; canonical disable/credential-version changes reject both replicas, including a lookup/issuance race. |
| AC-07 | Sign-in on A works on B; logout on B revokes on A. Duplicate/absent logout is safe, live wrong-plane credentials deny, and concurrent renewal cannot restore logout. Actual stale Redis restoration retains durable revocation. |
| AC-08 | Idle/absolute expiry are enforced; passive polling cannot renew and rotation cannot extend absolute lifetime. Browser retains unfinished fixture form values through same-operator reauthentication, blocks expired submissions, hides values from another operator and clears them on explicit logout. |
| AC-09 | Redis/database interruption, write rejection and lost issuance/revocation responses produce safe 503/uncertain behavior without token fallback, false logout or automatic stale-write replay. Retained valid state recovers; absent sessions require sign-in. |
| AC-10 | Sign-in/error/retry/logout/reauthentication UI uses shared dark primitives, keyboard/focus/labels, accessible statuses and responsive reflow. Username/operational values survive validation as appropriate; passwords clear and duplicate clicks are bounded. Safe local return paths reject open redirects. |
| AC-11 | Focused browser/real-service two-replica suite, P2-U2 regressions and required Docker checks pass; guide, contract, runbook, reproducible safe evidence, docs index and tracker reflect the actual delivered boundary. |

Use real PostgreSQL/runtime grants and session Redis with two independent HTTP
processes. Browser acceptance must exercise the real platform application and
chosen secure origin/proxy, not mocked auth or fixture-only token issuance.
Use isolated synthetic operators/staff and fixture-owned resources; no bootstrap
secrets in commands/artifacts. Barrier/clock fixtures prove races/deadlines without
long sleeps. A non-shipping form fixture proves the reauthentication handoff;
actual future feature drafts remain separately unverified.

Provisionally add `./dev exec pnpm check:platform-auth` for the complete HTTP and
browser matrix. This command does not exist at spec creation. During implementation
record its actual procedure, run existing `./dev exec pnpm check:session-foundation`
and `./dev check`, and retain results/limitations. Production TLS/HA/capacity and
staff journeys remain pending; P2-U3 alone does not complete the Phase 2 gate.
Documentation-only preparation requires consistency, coverage, links and whitespace
checks, without application runtime verification.

## Review and adopted implementation sub-units

**Review conclusion: split into two sequential sub-units.** Credential/HTTP
security can be proven as a foundation boundary; browser entry and isolated
reauthentication need their own complete user journey. Each sub-unit owns its
checks and documentation, with full parent regression in b. Do not split cookies
from CSRF or postpone backend failure/race checks to a later testing-only unit.

| Unit | Starting state and scope | Result / parent acceptance ownership |
| --- | --- | --- |
| [P2-U3a — Platform authentication HTTP boundary](p2-u3a-platform-authentication-http-boundary.md) | Verified P2-U1/U2/P1-U4; credential verifier outcomes/bounds, sign-in/session/logout use cases, explicit cookie channel, CSRF, source/origin configuration and necessary guard/module integration. | Real-service A/B HTTP sign-in/session/revocation with browser cookie/CSRF transport probe. Owns AC-02–07 and backend portions of AC-01/08/09/11. Foundation completion does not claim the console journey. |
| [P2-U3b — Platform browser access and isolated reauthentication](p2-u3b-platform-browser-access-and-isolated-reauthentication.md) | Verified a; actual app/proxy/server access composition, sign-in/logout UI, safe returns, expiry/unavailable handling, identity-bound unfinished-work handoff and full integrated guide/checks. | Actual browser journey on a's secure transport, identity switching and retained form values. Owns AC-10, browser portions of AC-01/04–06/08/09, and combined AC-11; reruns every AC-01–11. |

All parent criteria have an owner. a is complete and verified;
b remains planned. Child completion does not approve new product policies. Keep the
P2-U3 top-level delivery order; P2-U4 and Phase 3 require their listed dependencies.

The review identified these required integration fixes and limits:

- Replace fixture-only bearer extraction with explicit consumer transport policy, preserving existing isolation/error/renewal contracts and their regressions.
- Distinguish hash overload/failure from wrong credentials, and bound expensive unknown-user verification; rate limits alone do not bound concurrent hash memory.
- Bind verified credential versions to issuance and preserve durable logout fencing; a browser redirect or cleared cookie is not evidence of shared revocation.
- Enforce login CSRF and proxy/source trust together; confirm real Secure-cookie acceptance in the declared browser environment.
- Preserve operator form state without implementing incident drafts early; prove same-identity resume and foreign-identity non-disclosure in the browser.

No new product decision is required for the already approved lifetimes, limiter
budgets or supported credential compatibility. The implementation owner resolves
route/proxy/CSRF details within these constraints and documents them. Ask for a
focused deployment decision only if actual required origins or cross-site behavior
cannot be established, or a draft persistence request changes the existing scope.
