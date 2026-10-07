# P2-U4 — Tenant staff sign-in and credential lifecycle

## Status and purpose

- **Status:** in progress; G-01–06 approved 2026-10-07 (Asia/Manila, +08:00), a complete, b/c planned. Parent acceptance remains incomplete.
- **Requirement:** [Phase 2, P2-U4](../implementation-plan.md#p2-u4--deliver-tenant-staff-sign-in-and-credential-lifecycle); tenant-qualified access and credential recovery from the project overview.
- **Goal:** let the intended staff member set credentials, sign in through the command center or protected mobile boundary, and sign out; make credential replacement invalidate previous authority across replicas.
- **Completion boundary:** approved initial-administrator setup from a real P4-U1a draft, setup/reset/recovery journeys, active-tenant authentication, protected browser/mobile transport, and isolated expiry recovery pass the acceptance matrix. Setting credentials never activates a tenant.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
This spec follows the approved delivery-order exception: completed P4-U1a precedes
P2-U4; Phase 3 follows. P4-U1b/P4-U3 retain completed onboarding and activation.

**Policy approval, 2026-10-07 (Asia/Manila, +08:00):** the user approved
[credential review sections 1–6](../../docs/planning/p2-u4a-credential-contract-review.md).
G-01–06 are resolved; its precise matrix, draft-ready reset exception, policies
and limits supersede the earlier unapproved recommendations. Runtime acceptance
remains incomplete.

## Starting state and dependencies

Require verified P2-U1, P2-U2, P1-U4/P1-U5 and P4-U1a. Reuse P2-U3's delivered
password-verification and secure browser patterns without importing platform
identity or granting platform sessions staff authority. Recheck linked evidence
and actual owner interfaces before coding.

Existing capabilities:

- [Canonical identities](../../docs/architecture/canonical-identity-storage.md) and [authority/admission](../../docs/architecture/canonical-authority-admission.md): immutable staff tenancy, normalized identifiers, private credential reads, fixed roles, coherent `unset`/`ready` metadata and audited versioned mutations. These private mutations are not public recovery authorization.
- [Shared sessions](../../docs/architecture/shared-session-lifecycle.md), [HTTP authority](../../docs/architecture/canonical-http-authority.md) and [distributed admission](../../docs/architecture/distributed-admission.md): canonical guards, version-bound issuance, durable revocation fences, explicit channels, trusted sources and fail-closed limits.
- [Platform HTTP](../../docs/architecture/platform-authentication-http.md) and [browser access](../../docs/architecture/platform-browser-access.md): bounded verifier, cookie/CSRF and identity-bound mounted work. Staff consumers and command-center composition remain to be delivered.
- [Draft registry handoff](../../docs/architecture/draft-tenant-registry-api.md): committed `{tenantId, administrator.id}` from immutable creation provenance. The administrator has exactly `tenant_admin`, active account, unset credentials; draft tenancy still denies ordinary staff admission.

The command-center app currently provides the shell; responder mobile provides a
skeleton. Neither establishes production staff authentication or secure device
storage. Controlled active-tenant fixtures can verify sign-in without claiming an
operator-facing activation workflow.

## Decision gates before dependent implementation

[Product contracts, D-05/D-06](../../docs/planning/p1-u1-product-contracts.md#5-d-05--credentials-and-administrator-safeguards)
now record the scoped setup/reset/recovery and draft-setup approval in the credential review. Bootstrap
password approval applies only to bootstrap; existing session/limiter approvals
must not be reopened or silently extended to recovery traffic.

| Gate | Required decision | Original recommendation; approved review now governs |
| --- | --- | --- |
| G-01 — Setup/reset authority | Who issues setup/reset, for which target roles and tenant/account states; scope of platform-assisted recovery and last-admin safeguards. | Platform operator initiates first-admin setup and verified last-admin recovery through narrow qualified workflows; tenant admin initiates same-tenant staff setup/reset. No general platform staff-management or impersonation grant. |
| G-02 — Draft setup | Whether the first administrator may set credentials while draft, and eligibility at issue and exchange. | Permit initial-admin setup only for the canonically linked draft administrator; issue no ordinary session. Active tenants use the normal approved setup/reset path; suspended/retired targets deny. |
| G-03 — Password policy | Staff setup/reset bounds, confirmation and exact-byte semantics. | Reuse bootstrap's 15–128 code points / 512 UTF-8 bytes, spaces/Unicode, no composition rule, and prohibited malformed/NUL/line-break input; confirm password in UI. |
| G-04 — Capability policy | Setup/reset lifetime, reissue/cancel, outstanding-token count, sessions affected and time of invalidation. | Single-use opaque tokens, 24-hour setup / 30-minute reset, one outstanding action per target, reissue cancels earlier action; successful exchange advances authentication version and invalidates all prior sessions. Explicitly decide whether reset issuance itself revokes access. |
| G-05 — Recovery and handoff | Verified-person procedure, authorized issuer, secure out-of-band channel and lost-token/lost-response recovery. | Administrator-mediated recovery; no email/SMS self-service or new delivery service. Token disclosed once to issuer for approved secure handoff; no token in URLs. Lost disclosure requires explicit reissue. |
| G-06 — Abuse and retention | Independent issue/exchange/recovery limits, lookup dimensions, failure responses and capability retention/cleanup. | Finite shared source/target limits and generic invalid-capability errors; approve budgets and retention before dependent implementation. Existing sign-in budgets do not authorize these policies. |

Resolve these gates in a focused review and record scoped approval in the owning
product contracts and tracker. Spec preparation and independent foundation review
can proceed; unresolved behavior blocks only dependent implementation. Splitting
the work does not resolve these decisions. General last-admin role/disable policy
belongs to P4-U4; this unit must resolve any safeguard directly affected by its
credential commands. Platform-operator credential recovery remains outside P2-U4.

## Scope and ownership

| Boundary | Allowed work |
| --- | --- |
| Identity | Staff sign-in/current-session/logout use cases; approved setup/reset capability persistence, issue/reissue/exchange and recovery authorization; qualified credential mutation, verifier reuse and shared session integration. |
| Tenancy | Narrow canonical admission/status reads and transactional revalidation for credential actions; no lifecycle transition endpoint. |
| Platform | Narrow initial-admin setup/recovery authorization and P4-U1a detail action using canonical provenance; preserve separate operator authority and owner ports. |
| HTTP/contracts | Bounded DTOs, explicit staff-cookie/mobile-bearer consumers, CSRF/origin/source rules, declared errors and safe canonical session metadata. |
| Command center | Exactly three sign-in identity fields, credential exchange screens, protected shell, logout and identity/tenant-bound expiry recovery using shared UI. |
| Responder mobile | Minimal staff authentication consumer and protected-storage integration sufficient to prove token delivery, use, logout and expiry; no dispatch or responder-profile workflow. |
| Checks/docs | Real-service two-replica checks, actual browser/device boundary evidence, user/operator guides, recovery runbook and tracker. |

Exclude staff creation/role management, tenant activation/voice readiness, PBX,
incident persistence, dispatch, public authentication, social login/MFA, automatic
email/SMS delivery, production HA and general platform-account recovery. Necessary
owner-port changes must preserve existing consumers and receive focused regression
checks. Add only feature-owned schema; no second identity or session store.

## User journeys

1. Operator opens an existing draft tenant detail, targets its linked administrator and initiates the approved setup action. Display tenant code/username and clear credential-versus-activation status. No password is chosen by the operator.
2. Issuer completes the approved verified-person handoff. Recipient enters the capability and new password in a dedicated setup/reset form; a capability is not an ordinary session or a tenant selector. Success confirms credential setup and grants no draft access. Approved policy determines subsequent active-tenant sign-in; never silently activate.
3. Active staff enters exactly **Tenant code**, **Username**, **Password**. Canonical normalized code/username select the tenant and staff; exact password verification establishes a fresh shared staff session.
4. Authorized issuer initiates a qualified reset/recovery. Recipient replaces credentials through the approved exchange. Existing web/mobile sessions on every replica become invalid; fresh sign-in requires the new password.
5. Logout revokes the selected session across replicas, preserving other devices unless the approved command explicitly revokes all. Expiry hides protected work and blocks submissions; same canonical tenant/staff reauthentication restores mounted unfinished values.

## Credential capability and transaction contract

Specify named issue/reissue/cancel/exchange consumers and errors before coding,
including the approved issuer/target/state matrix and abuse policy. Administrative
requests target `{tenantId, staffId}`; never reset by username alone. Initial-admin
selection loads canonical creation provenance rather than guessing by name, role,
or creation order. A bearer setup capability supplies only its stored qualified
target and purpose; reject attempts to change tenant, user or purpose in exchange.

Generate unpredictable opaque randomness and store only hashed token lookup plus
minimal purpose, qualified target, expected authority versions, issuer attribution,
expiry and consumed/cancelled state. Store no plaintext token or password. Use
PostgreSQL for durable single-use coordination and feature-owned grants/constraints;
Redis continues to own sessions and approved shared limits. Apply the approved
retention policy without speculative cleanup or recoverable token storage.

Revalidate issuer permission, target role/account/credential state and canonical
tenant state under compatible owner transaction locks. Draft setup requires a
narrow separate capability-authorized path; never weaken ordinary staff admission
or synthesize staff authority from a platform principal. Successful consumption,
credential hash/state/timestamp replacement, authentication-version advancement
and required actor-attributed audit commit atomically on one connection. Audit
issuer and recipient-capability action without pretending an unauthenticated
recipient already owns a staff session. Required failure poisons and rolls back
the transaction.

Expiry, cancellation, reissue, concurrent consumption and target/version changes
must not yield two successful credential replacements or restore stale authority.
Bind expensive password hashing to a bounded verifier/hasher capacity; perform it
outside long-held locks where possible and revalidate proof/versions at commit.
Use primary canonical version checks to invalidate all earlier sessions even if
Redis cleanup fails; cleanup cannot be the sole revocation guarantee. Canonical
rollback leaves old credentials/session eligibility intact under the approved
issuance policy. Never declare success before confirmed outer commit.

Invalid/expired/consumed/wrong-purpose capabilities return a declared generic
failure without identifying the user. Dependency/hash capacity failure is retryable
unavailable, distinct from invalid credentials. Lost responses report uncertainty;
never automatically replay a password write or redisclose a token. Provide an
explicit safe reissue/reconciliation path under approved policy.

## Staff authentication and transport

Accept bounded JSON with exactly tenant code, username and password as identity
fields; transport metadata is separate and cannot supply tenant/role authority.
Reuse canonical ASCII normalization and bounds. Preserve password bytes, spaces,
case and Unicode form. Reject malformed input and extra identity/authority fields.

Apply approved shared sign-in admission before canonical lookup/private reads/hash
work: independent 60/source and 10/tenant-qualified identity per 900 seconds,
counting admitted success/failure/downstream errors without refund. Derive source
through trusted socket/proxy rules. Unknown tenant/user and ineligible/malformed
credentials take the bounded dummy-verification path. All invalid tenant, username,
password, tenant/account status and credential combinations return exactly
`Invalid credentials`; no tenant directory or reason enumeration. Hash overload,
Redis/database failure or uncertain issuance returns retryable 503, not mismatch.
Bind verified password to its authentication version and recheck current staff and
tenant authority at issuance; concurrent reset, role/status change or suspension
must prevent stale proof becoming current authority.

Browser consumers use a distinct host-only Secure/HttpOnly/SameSite staff cookie,
explicit staff channel and exact trusted origin/proxy configuration. Reuse approved
CSRF lifecycle patterns for sign-in, logout and cookie-authenticated mutations;
capability exchange must also have declared forgery protection. Tokens are absent
from browser JSON, URLs and script storage. Reject duplicate/malformed cookies,
conflicting bearer/cookie credentials and cross-plane credentials. The protected
command-center shell derives canonical staff/tenant/roles server-side; navigation
and redirects do not establish authority. Use bounded same-origin forwarding,
`Cache-Control: no-store` and safe local return paths. Declare actual HTTPS topology;
existing platform ingress alone does not prove staff deployment.

Mobile uses explicit authenticated HTTPS bearer delivery and consumption, with no
cookie fallback. Only its declared successful sign-in response may deliver a token;
never include it in URLs, logs, deep links, analytics, exceptions or snapshots.
Consume through Expo-compatible protected device storage, never AsyncStorage or
plaintext files; define locked/unavailable storage behavior, incomplete write
cleanup, app restart, token replacement and confirmed logout deletion. Failed
storage must not leave the UI authenticated; reconcile/revoke any issued orphan
without falsely confirming logout. Native transport does not disable browser CSRF.
Prove storage on the declared device/OS boundary; mock storage verifies a port only.
P6-U1 retains full responder app and supported-device product scope.

Retain approved web 60-minute idle/12-hour absolute and mobile 24-hour idle/7-day
absolute lifetimes. Session reads, polling, health and an open app are passive;
only successful authorized operational activity renews, within the original
absolute deadline. Rotation preserves original creation/absolute lifetime.
Logout uses confirmed durable single-session revocation with idempotent absent
retries, declared forgery/channel checks and rejection of live foreign-plane tokens.
Unavailable/lost responses cannot falsely claim revocation; no local fallback.

## Unfinished work, UI and failures

Bind retained work to canonical `{tenantId, staffId}`, never typed login values,
username, cookie presence or session ID. Hide values/release protected focus while
identity is unknown/expired; block every expired submission, including late callbacks.
Same-owner reauthentication restores mounted values; different tenant/staff identity
or explicit logout clears them. Fence callbacks by owner/epoch and never replay
writes automatically after recovery. Password reset requires fresh authentication
and the same isolation checks before exposing retained work.

Use a non-shipping incident-form fixture to prove the handoff now. Actual durable
incident drafts belong to P5-U4; no refresh/crash/offline persistence guarantee is
introduced here. Reuse shared dark tokens/forms, labels, keyboard/focus handling,
responsive reflow, accessible non-color status and duplicate-submit bounds. Keep
code/username and nonsecret values through validation; clear passwords/capabilities
at safe lifecycle boundaries and never persist them for reauthentication.

Document 400 validation, generic 401 invalid credentials/expired session, 403
plane/permission/Origin/CSRF denial, declared generic capability failure, approved
conflicts, bounded 429 retry timing and retryable 503. Exclude passwords, hashes,
tokens, cookies, capability lookups, CSRF/proxy secrets and raw identity input from
logs/audit/metrics/test artifacts. Use finite outcome codes and correlation IDs.

## Acceptance and required verification

| ID | Observable result and required proof |
| --- | --- |
| AC-01 | G-01–06 approved and recorded; named issuer/target/state/transport/error contracts and handoff guide agree. Dependencies and original policy limits remain intact. |
| AC-02 | Real P4-U1a draft handoff targets its qualified linked first admin. Approved setup produces ready credentials, no ordinary staff session, activation or PBX effect; actual draft sign-in returns `Invalid credentials`. |
| AC-03 | Setup/reset/recovery issue and exchange enforce approved permissions and state matrix, exact password policy, expiry, cancellation/reissue, single use and wrong-purpose/foreign-target denial. No listing rediscloses a token. |
| AC-04 | Two-replica exchange/reissue/reset races and required database/audit failures prove one atomic result, monotonic versions and safe lost-response recovery. Old passwords/sessions deny on A/B and stale Redis restore cannot resurrect them. |
| AC-05 | Same normalized username in two active tenants authenticates as distinct owners. Unknown/inactive/draft/suspended/retired/disabled/unset and wrong-password combinations give the same denial; malformed/hostile fields grant no authority. |
| AC-06 | A/B share source and qualified-identity limits before verification; trusted proxy spoofing, verifier exhaustion, lookup/issuance races and Redis/database failure cannot mint authority or disclose identity. Existing limiter/verifier regressions pass. |
| AC-07 | Actual HTTPS browser accepts staff cookie; sign-in/logout/mutation/exchange forgery checks, no-store/proxy/safe returns, duplicate/conflicting channels and both cross-plane directions pass. |
| AC-08 | Actual declared native storage/transport proves successful mobile sign-in, protected request on another replica, restart retrieval, storage failure/replacement and confirmed logout cleanup; no token leakage or plaintext fallback. |
| AC-09 | Logout on B invalidates on A with safe duplicate/absent retry and preserves other devices. Credential replacement invalidates all affected devices; roles/account/tenant changes deny canonical stale authority. Renewal/revocation/restore regressions pass. |
| AC-10 | Approved web/mobile expiry and passive activity rules hold. Real browser fixture retains unfinished values only for the same canonical tenant/staff, blocks expired/late submissions, hides foreign work and clears on logout; rotation cannot extend absolute lifetime. |
| AC-11 | Setup/reset/sign-in/logout/error/expiry UI and operator handoff are usable with keyboard, labels, focus and narrow reflow. Dependency outages and uncertain responses show safe recovery without automatic stale-write replay or false success. |
| AC-12 | Full parent matrix, relevant identity/session/platform/draft regressions and Docker checks pass; guides, runbooks, evidence, docs index and tracker describe actual commands and browser/native limits. Phase 2 is claimed only after its complete gate passes. |

Use real PostgreSQL/PostGIS with runtime grants, session Redis, independent HTTP
processes A/B, production Next HTTPS and declared native secure-storage consumers.
Use isolated synthetic active tenants/staff and a genuine draft-creation journey;
clean only fixture-owned records. Barrier/clock fixtures prove races/deadlines
without long sleeps. Exercise committed credential replacement and actual stale
session restoration, not only mocked versions.

Provisionally add `./dev exec pnpm check:staff-auth` with lifecycle/HTTP/browser/mobile
selectors; command and selectors are not established by this spec. Record actual
procedures at implementation. Run relevant existing `check:identity-foundation`,
`check:session-foundation`, `check:platform-auth`, `check:draft-tenant` and final
`./dev check`. Native secure-storage acceptance needs reproducible device evidence;
a Node mock or Expo build alone does not satisfy AC-08. Missing device/configuration
keeps that boundary incomplete. Production TLS/HA/capacity and full responder
operations remain separate. Documentation-only preparation needs link, consistency,
acceptance coverage and whitespace review, not runtime execution.

## Review and adopted implementation sub-units

**Conclusion: split into three sequential sub-units.** Durable credential
capabilities, staff authentication transports and actual consumer recovery each
have a distinct verifiable result. Keep each security boundary cohesive; do not
split atomic token consumption from credential/version/audit changes, cookies from
CSRF, or UI delivery from its integrated acceptance.

The user adopted the split and requested child specs on 2026-10-07 (Asia/Manila,
+08:00). The split originally approved delivery structure only. The user subsequently
approved G-01–06 through the credential review; a is complete and b/c remain planned. Parent completion requires every criterion.

| Unit | Scope and starting state | Result, verification and parent ownership |
| --- | --- | --- |
| [P2-U4a — Qualified credential lifecycle and administrator handoff](p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md) | Verified foundations/P4-U1a and resolved G-01–06. Capability schema/owner ports, authorized issue/reissue/exchange/recovery, bounded hashing, atomic version/audit and narrow platform draft-detail/setup UI plus recipient exchange UI. | Complete issuer-to-recipient setup/reset journey with real draft provenance and A/B race/failure proof. Owns AC-01–04 and lifecycle portions of AC-09/11/12. Proves draft admission denial canonically; b/c add actual sign-in denial. Does not claim ordinary staff access. |
| [P2-U4b — Staff authentication HTTP and transport boundaries](p2-u4b-staff-authentication-http-and-transport-boundaries.md) | Verified a; canonical staff verifier/issuance, cookie/CSRF, mobile bearer delivery, shared limits, current-session/logout, declared origin/proxy and HTTP failure recovery. | Real active-staff sign-in/request/logout across A/B plus secure browser transport probe; prove actual draft sign-in denial. Owns AC-05–07, backend AC-09/10/11 and scoped AC-12. Provides c tested DTOs/channels and device-storage port contract; no fixture issuer becomes production auth. |
| [P2-U4c — Command-center and mobile access with isolated recovery](p2-u4c-command-center-and-mobile-access-with-isolated-recovery.md) | Verified a/b. Actual protected command-center composition, sign-in/logout and owner-bound unfinished-work recovery; native protected token consumer/storage; guides and full integrated matrix. | Actual browser and declared native access journeys, storage failure/restart/logout, accessible UI and same-owner/foreign-owner expiry checks. Owns AC-08, consumer AC-02/07/09, browser AC-10/11 and complete AC-12; reruns AC-01–12. |

Every criterion has an owner; c retains full parent responsibility rather than
becoming a testing-only unit. a deliberately includes its handoff/exchange UI so
credential lifecycle completion is reviewable as a working journey. b owns all
HTTP correctness before c consumes it. Further splitting the mobile boundary is
reasonable only if device acceptance cannot share c's delivery window; it must
remain a required P2-U4 child, with explicit dependencies and acceptance ownership.

Review corrections incorporated: draft setup is a separately authorized exception,
not weakened admission; platform recovery grants require scoped approval; version
changes are the authoritative cross-replica credential revocation boundary; existing
sign-in limits do not define recovery limits; one-time disclosure must account for
response loss; secure mobile storage needs native evidence; unfinished incident
work is proven without prematurely implementing incident drafts.
