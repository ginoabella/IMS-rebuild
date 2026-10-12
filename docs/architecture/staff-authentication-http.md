# Staff authentication HTTP contract

P2-U4b, 2026-10-12, Asia/Manila (+08:00). Implements the approved a password
policy and shared U2 lifetimes/admission. Parent and actual c consumers remain separate.

| Named consumer            | Route                              | Channel / activity                                             |
| ------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| Browser forgery bootstrap | GET `/staff/auth/browser/csrf`     | Exact browser Origin/proxy/source, public, passive             |
| Browser sign-in           | POST `/staff/auth/browser/sign-in` | Pre-context CSRF, public, passive                              |
| Browser current session   | GET `/staff/auth/browser/session`  | Staff cookie, canonical staff, passive                         |
| Browser logout            | POST `/staff/auth/browser/logout`  | Session CSRF or absent retry context, passive                  |
| Mobile sign-in            | POST `/staff/auth/mobile/sign-in`  | Attested native HTTPS ingress, no existing credential, passive |
| Mobile current session    | GET `/staff/auth/mobile/session`   | Attested native ingress + mobile bearer, passive               |
| Mobile logout             | POST `/staff/auth/mobile/logout`   | Attested native ingress + optional mobile bearer, passive      |

Protected session metadata uses the existing grant `incident.own.close`, common
to every approved valid staff role. It grants no incident operation here. Other
protected consumers declare their own permissions and activity; operational
mutations must revalidate canonical authority in the transaction before writes.
Non-shipping fixture mutations prove this and post-success conditional renewal.
Legacy explicitly declared bearer consumers retain their existing contract.

Identity input is exactly `{tenantCode,username,password}`, strict JSON, 4096-byte
body ceiling. Tenant code and username follow existing ASCII canonical bounds;
password preserves exact Unicode/bytes/spaces/case under approved 15–128 code-point,
512-byte policy. Shared admission precedes lookup/private-read/hash/issuance:
60/source and 10/tenant-qualified identity per 900-second fixed window, no refund.
Ineligible/unknown/malformed material uses bounded dummy scrypt. Hash capacity or
internal failure is unavailable. Proof binds canonical staff and tenant versions;
issuance rechecks both, never upgrades old proof.

All auth/protected responses are `Cache-Control: no-store`. Browser metadata is
`{plane,tenantId,staffId,roles,consumer,idleExpiresAt,absoluteExpiresAt,proof}`;
mobile current-session omits proof; only successful mobile sign-in adds `token`.
No private hash/version/proof material is returned. Error bodies remain bounded:
400 `Invalid credentials` for input/source, 401 `Invalid credentials` for login
mismatch/status; protected 401 generic authentication required; 403 plane,
permission, Origin/CSRF/channel, including malformed or conflicting staff cookies.
429 uses bounded Retry-After; database/Redis/hash/uncertain writes use 503 and
Retry-After 1. Never include credentials, raw lookup identities, tokens, CSRF,
proxy secrets or lookup hashes in diagnostics.

## Topology and forwarding handoff to c

Staff uses the existing independently configured `STAFF_ISSUER_ORIGIN`, exact
`STAFF_ISSUER_PROXY_PEERS`, `STAFF_ISSUER_PROXY_SECRET`, and
`STAFF_ISSUER_CSRF_SECRET`. Proxy peers must also occur in
`LIMITER_TRUSTED_PROXIES`. The staff authentication and existing staff issuer
share one same-origin staff context; exchange keeps its separate configuration.
Absent configuration denies staff transport; platform ingress is not staff ingress.

Browser topology: HTTPS ingress -> same-origin command-center forwarding ->
private backend. Forward only named routes/methods, bounded JSON and response
metadata/cookies. c owns actual Next integration; b's temporary HTTPS probe forwards
directly to private independent Nest replicas. Its real browser/native socket
source is `::1`; the separately trusted backend proxy peer is `127.0.0.1`, so a
chain of trusted proxies is never mistaken for a client. Require exact ingress Host and
Origin on mutations, safe same-origin Fetch Metadata on reads. Reject any browser
Authorization header before forwarding, so a conflicting channel cannot be silently
stripped into an accepted cookie request. Strip all inbound
forwarding/proxy credentials, derive source from socket, set one
`X-Forwarded-For` and server-owned `X-Staff-Proxy`. Backend validates exact private
peer, shared proof and exact HTTPS Origin, including protected GET. Direct backend
bypass with absent/untrusted proof is denied. Do not expose backend/private peers.

Cookie: `__Host-myims-staff`, host-only Secure/HttpOnly/SameSite=Lax, Path=/,
no Domain, deadline conservatively before server absolute expiry. CSRF bootstrap
sets a signed ten-minute HttpOnly/Secure context cookie and returns a proof bound
to that context plus current credential or absence. Login requires this proof;
success clears pre-context and returns a session-bound proof. Rotation requires
replacement session proof; old proof denies. Logout accepts session proof or
fresh bootstrap proof, but a live session denies pre-context logout. Expired/revoked
and absent retries accept appropriate valid context. Only confirmed durable
revocation clears cookies; uncertain revocation leaves them and returns 503.
Duplicate/malformed cookies, cookie/bearer conflicts and foreign-plane cookies deny.

Mobile topology: HTTPS native endpoint -> exact private ingress peer -> backend.
The ingress must allow only the three mobile routes, reject any Origin, cookies,
Fetch Metadata, browser proxy/CSRF headers, and supply server-only
`X-Staff-Mobile-Proxy` using the staff proxy secret plus socket-derived source.
Backend repeats these checks; successful mobile login accepts no Authorization.
A browser cannot supply this server-only header or satisfy the Origin/Fetch
Metadata exclusions. No CORS exception is added. Mobile protected consumers use
`staff-mobile`, require a mobile session and never accept web cookies/tokens.
Browser cookies cannot request mobile delivery. HTTPS is mandatory at ingress;
its secret attests transport only over the declared private hop.

## Lifecycle and native storage port

Web 60-minute idle/12-hour absolute; mobile 24-hour idle/7-day absolute. Passive
session/logout/polling never renew. Operational success renews conditionally within
original absolute expiry; rotation preserves creation/deadline. Logout revokes one
session durably and preserves another device. Lost responses are uncertain;
explicit retry validates current canonical/fence state, never replays writes or
reconstructs replica-local sessions. Reset/disable/role/suspension deny old sessions,
including physically restored stale Redis records.

`StaffSecureStorage` is a contracts-only native port: save -> stored/failed/uncertain;
read -> found/absent/unavailable; clear -> cleared/failed/uncertain. c implements and
proves device protected storage. Keep issued token only in transient memory until
save confirms stored; never enter protected UI after failed/uncertain save. Explicitly
reconcile/read or revoke the issued session through mobile logout. Failed/uncertain
revoke keeps pending reconciliation without claiming logout or retrying the original
credential write. Clear local storage only after confirmed logout; clear failure
keeps UI locked and pending cleanup. A lost sign-in response requires a new explicit
sign-in; no token recovery or local issuer. b proves transport only.
