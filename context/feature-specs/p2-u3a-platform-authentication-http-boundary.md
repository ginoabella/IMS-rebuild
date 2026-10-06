# P2-U3a — Platform authentication HTTP boundary

## Status and purpose

- **Status:** planned; prepared 2026-10-06 (Asia/Manila, +08:00).
- **Requirement:** [P2-U3 parent scope and acceptance matrix](p2-u3-platform-operator-sign-in.md).
- **Goal:** authenticate tenantless operators through a secure browser-compatible HTTP boundary and revoke their selected session across replicas.
- **Completion boundary:** real operator credentials create a shared platform web session; declared cookie/CSRF consumers enforce canonical authority and shared limits; confirmed logout invalidates that session on both HTTP replicas.

The user adopted the two-unit split on 2026-10-06. The parent owns shared scope,
policies and AC-01–11; a owns credential verification, auth HTTP, cookie/CSRF and
backend failure/recovery correctness. Completion does not establish the platform
console UI or unfinished-work reauthentication journey, which belong to b.

## Starting state and dependencies

Require verified P2-U1, all P2-U2 children/parent and P1-U4. Recheck
[operator credential/bootstrap evidence](../../docs/status/p2-u1c-evidence.md) and
[combined session evidence](../../docs/status/p2-u2c-evidence.md) before coding.
Reuse canonical platform candidate/by-ID authority and private credential reads,
shared lifecycle/fences, request principals, distributed admission, transaction
authority and audit conventions. No fixture issuer becomes a public auth endpoint.

Read the delivered [operator credential contract](../../docs/architecture/canonical-operator-bootstrap.md),
[HTTP authority contract](../../docs/architecture/canonical-http-authority.md),
[admission contract](../../docs/architecture/distributed-admission.md), and
[session lifecycle](../../docs/architecture/shared-session-lifecycle.md).
Existing guards are bearer-only; current bootstrap verification conflates mismatch
and busy/internal failure. Both integration changes are necessary within a.

## Scope and ownership

Allowed changes:

- Platform application sign-in/current-session/logout use cases and thin NestJS HTTP adapters.
- Reusable password verification outcomes and finite capacity controls, preserving bootstrap compatibility.
- Explicit identity guard credential-channel policy and necessary HTTP module wiring; retain existing bearer fixture behavior and global default denial.
- Named auth contracts, validated server-only cookie/origin/CSRF/source configuration and a bounded browser transport probe.
- Real-service A/B HTTP checks, safe evidence, transport/runbook documentation and b handoff.

Do not query another module's data outside existing typed owner ports. Reuse
P2-U2 session storage/fences and approved limits; no new session store, identity
schema, account lifecycle, password reset/recovery or permissions. Platform app
UI/proxy composition and operator form-state handling remain b. a must settle the
browser/backend topology contract and prove its backend transport boundary before
handoff; it cannot leave CSRF or cookie semantics for b to invent.

## Credential verification and issuance

Accept exactly username/password identity fields in bounded JSON. Reuse canonical
ASCII username normalization/bounds. Reject unknown identity fields, malformed
text and unpaired surrogates. Support the existing bootstrap password format:
15–128 code points, at most 512 UTF-8 bytes and established prohibited characters.
Preserve exact password bytes, spaces, case and Unicode normalization form. This
compatibility does not establish a new setup/reset policy.

After input/CSRF checks, call `Admission.signIn` with platform-qualified username
and a trusted source before canonical lookup, private reads, hash work or issuance.
Both approved fixed-window dimensions must admit: source 60 and identity 10 per
900 seconds. Success/failure and admitted downstream errors consume allowances;
no refund or account lockout. Invalid input/source performs no verifier work.

Load eligible candidate and private material through platform ports. Verify only
the supported versioned scrypt parameters with constant-time key comparison.
Unknown/disabled/unset/malformed-hash candidates follow an equivalent bounded
dummy verification path and return generic denial. Do not expose the cause through
response fields or an obvious skipped-hash path; do not promise identical network
timing. Bound hash memory/concurrency, avoid plaintext queues, and expose typed
match/mismatch/unavailable outcomes. Busy/internal crypto failure maps to 503,
never `Invalid credentials`. Preserve bootstrap behavior and regression coverage.

Bind successful verification to the canonical operator ID and authentication
version of the verified credential. Recheck eligibility/version through trusted
P2-U2 issuance before returning usable authority. A concurrent credential/account
change must not turn an old password proof into a current-version session. Login
issues new randomness and a new web lifetime; never adopt client token/role/tenant
fields or upgrade a staff session into platform authority.

## Transport, cookie, CSRF and authority contract

Document named POST sign-in/logout, passive GET current-session, and any bounded
CSRF-bootstrap consumer before coding. Route names are an implementation choice.
Keep token JSON absent; expose only required canonical operator/plane and safe
expiry metadata. All auth/protected responses are `Cache-Control: no-store`.

Use a distinct host-only Secure/HttpOnly platform cookie, `Path=/`, no `Domain`,
explicit `SameSite=Lax` for the same-origin design, preferably a `__Host-` name.
Cookie expiry cannot exceed server absolute expiry. Reject duplicate/malformed
auth cookies, bearer/cookie conflicts and wrong declared channels. Canonical guards
still validate on every protected request and enforce plane/grants; platform
cookies cannot authorize staff routes. Retain explicit bearer consumers without
creating a permissive fallback for unclassified routes.

Validate exact allowed Origin and unpredictable bounded CSRF proof for login,
logout and cookie-authenticated mutations. Bind login proof to pre-authentication
browser context and protected proof to its session context. Define issuance,
replacement after sign-in/rotation, invalidation after logout and expiry recovery.
Old-context proofs cannot authorize a new session. SameSite alone is insufficient;
the auth cookie stays HttpOnly. Missing/foreign/ambiguous Origin or missing/wrong
proof fails before credential work or mutation. If proof metadata is shared, keep
it minimal within the existing services; no replica-local authoritative CSRF state.

Document the same-origin browser/backend topology, accepted origins, required
headers and trusted proxy hops. Prefer a narrow Next.js proxy implemented in b;
a's backend must reject attempts to bypass the declared origin/channel/source
boundary. Preserve trusted source extraction through proxy hops without trusting
client forwarding fields. No generic proxy, wildcard credentialed CORS or backend
credentials forwarded to clients. a's probe uses a secure context that actually
accepts Secure cookies; no remote-HTTP exception silently weakens the flags.

Current-session reads and logout are passive: do not renew. Successful authorized
operational activity alone may renew within the original absolute deadline.
Cookie presence, typed usernames, request tenant/role fields or stored role
snapshots cannot supply authority. Sensitive writes retain canonical transactional
revalidation; test a representative mutation with existing fixture conventions.

## Logout and failures

Use single-session durable revocation, preserving other devices. Return successful
logout/clear-cookie only after required writes confirm. Repeated absent/invalid
platform-session logout is idempotent after CSRF/channel checks; a live foreign-plane
credential is denied. Explicitly support safe retries after the first cookie/proof
has been cleared through a fresh pre-authentication CSRF context when necessary.
Do not require a valid protected-session guard for the already-absent retry path;
that path cannot mint authority or mutate a foreign-plane session.

Map invalid input to bounded 400 `Invalid credentials`; unknown/wrong/ineligible
credentials to identical 401 `Invalid credentials`; CSRF/origin or valid wrong-plane
access to 403. Reuse 429 with bounded retry timing and retryable 503 with
`Retry-After: 1` for unavailable database/Redis/fence/hash capacity. Protected
unauthenticated access retains P2-U2's generic 401 mapping.

Lost issuance/revocation responses and partial writes cannot be called success or
automatically replayed. New sign-in is an explicit recovery operation; repeat
logout uses the idempotent revocation boundary. No local session reconstruction.
Restore stale Redis records only behind canonical versions/durable fences and the
existing [recovery procedure](../../docs/runbooks/session-foundation.md).

Reuse lifecycle audit attribution without duplicate events. Failed credentials
are never attributed to an unverified operator. Credentials, tokens/cookies,
lookup hashes, CSRF secrets and raw identity inputs are excluded from logs,
audit, exceptions, metrics and artifacts. Security outcomes use finite codes and
independent correlation IDs.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| A-01 | Named contracts specify transport/channel, origins/proxy/source, CSRF context lifecycle, input/errors and existing policies; no duplicated authority/storage. Document b integration and deployment prerequisites. | AC-01 backend |
| A-02 | Real credentials authenticate with canonical username normalization and exact password byte semantics. Unknown/wrong/disabled/unset/malformed hashes deny generically. Dummy verification runs within finite capacity; hash busy/internal failure yields 503. Bootstrap regressions pass. | AC-02 |
| A-03 | A/B sign-in attempts share independent source/identity limits before verification, including unknown identities/success/failure. Invalid fields/source and spoofed proxy chains cannot bypass controls; 429/503 issues no session. | AC-03 |
| A-04 | Secure browser probe accepts host-only Secure/HttpOnly/SameSite cookie; no token JSON/storage/log/bundle leakage. Duplicated/malformed/conflicting channels deny; real staff/platform sessions cannot cross planes. Existing bearer guards regressions pass. | AC-04 transport |
| A-05 | Login/logout/representative protected mutation reject missing/wrong/foreign Origin and context-mismatched CSRF. Old context cannot authenticate a replaced session; safe GETs remain passive. Direct backend access cannot bypass the declared topology. | AC-05 backend |
| A-06 | Canonical disable/credential-version change rejects on A/B; barrier-controlled lookup/verification/issuance race cannot authenticate using stale proof. Hostile tenant/role fields and cookie presence confer no authority; transactional mutation checks remain intact. | AC-06 backend |
| A-07 | Session issued on A works on B; logout on B rejects on A, preserves another device and supports duplicate/absent retry. Foreign-plane logout denies; renewal race/stale Redis restore cannot undo revocation. | AC-07 |
| A-08 | Idle/absolute deadlines and successful operational renewal apply; session reads/logout/polling do not renew, rotation preserves absolute lifetime. Real Redis/database outage, write rejection and lost-response checks fail safely and recover without reconstruction/replay/false logout. | AC-08 backend; AC-09 backend |
| A-09 | Focused A/B real-service checks, secure browser transport probe, session and bootstrap regressions, and required Docker checks pass. Safe evidence/contract/runbook/tracker describe actual limits and b handoff. | AC-11 scoped |

Use real PostgreSQL/runtime grants and session Redis with independent HTTP
processes. Exercise production auth adapters, not fixture-only issuance. Synthetic
identities/resources and non-shipping mutation fixtures must be isolated and cleaned
precisely. Use barriers and bounded clock fixtures for races/deadlines; verify
actual stale record restoration and fault/response-loss boundaries.

Provisionally add `./dev exec pnpm check:platform-auth --http`, including a's secure
browser transport probe, plus existing identity/session regressions and
`./dev check`. This selection does not exist at spec creation; record final commands
and results during implementation. A mock cookie header is not browser acceptance.
Documentation-only preparation requires consistency/link/coverage/whitespace review.

## Completion and handoff

Complete a only when A-01–09 pass. Hand
[b](p2-u3b-platform-browser-access-and-isolated-reauthentication.md) tested endpoints,
transport/proxy/CSRF/source requirements, canonical session DTOs, typed errors,
logout retry procedure, real-service fixtures and safe evidence. b must prove the
actual app proxy/Server Actions and reauthentication journey and rerun all parent
criteria; no backend correctness check is deferred to b.

Resolve routine route/proof/configuration choices within the parent contract.
Unknown required origins/cross-site behavior blocks only dependent deployment
wiring until established. Existing policy approval is not reopened; production
HA/TLS/traffic capacity and account recovery remain outside this unit.
