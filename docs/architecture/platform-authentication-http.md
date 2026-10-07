# Platform authentication HTTP boundary

P2-U3a implements the backend boundary; P2-U3b composes the actual Next.js proxy
and UI through the [browser contract](platform-browser-access.md). All routes live under `/platform/auth`. Responses use `no-store`.

| Route           | Channel and result                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/csrf`     | Cookie channel, passive. Creates a ten-minute pre-authentication context and returns `{proof}`. May replace a previous context.                                                                      |
| POST `/sign-in` | Exactly username/password JSON, at most 4096 bytes. Pre-authentication proof required. Success 201 returns canonical session DTO and a replacement session proof.                                    |
| GET `/session`  | Declared platform cookie, canonical guard, passive. Success 200 returns plane, operator ID, idle/absolute expiry and session proof.                                                                  |
| POST `/logout`  | Cookie channel, session proof for live sessions; fresh pre-authentication proof for absent/invalid retry. Success 201; durable selected-session revocation must confirm before clear-cookie/success. |

The auth cookie is `__Host-myims-platform`, Secure, HttpOnly, SameSite=Lax,
Path=/, no Domain, Expires bounded by the server absolute deadline. It never enters
JSON. Expires reserves one second before the absolute deadline for browser
HTTP-Date rounding compensation; canonical server deadlines still apply.
The pre-auth cookie `__Host-myims-platform-csrf` has the same flags and a
600-second expiry. Proofs use HMAC-SHA256 with a shared server-only 256-bit secret:
pre-auth binds random nonce, expiry and current auth-cookie context; session proof
binds the exact opaque token (therefore rotation/replacement invalidates proof).
No authoritative replica-local CSRF state or additional storage exists. Login
clears the pre-auth cookie. Logout clears both cookies only after confirmed writes.
Proofs are returned only to the same-origin caller and sent in `X-Platform-CSRF`.
Expired/cleared contexts recover through a fresh GET csrf, followed by explicit
sign-in/logout. GETs never renew sessions. CSRF proofs and credentials are excluded
from telemetry and artifacts. Simultaneous requests already admitted can finish;
this contract does not promise cancellation of requests in flight.

The deployment topology is HTTPS browser -> narrow same-origin Next.js proxy ->
private NestJS replicas. Enable with `PLATFORM_AUTH_ORIGIN` (exact HTTPS origin),
`PLATFORM_AUTH_PROXY_PEERS` (comma-separated exact socket addresses, max 32),
`PLATFORM_AUTH_PROXY_SECRET` and `PLATFORM_AUTH_CSRF_SECRET` (distinct 64-character
lowercase hex secrets). All four must be supplied together; all absent/empty
means disabled.
Every backend cookie request requires exact Origin and `X-Platform-Proxy` shared
secret from an allowed socket peer. Those peers must also be explicitly trusted
in `LIMITER_TRUSTED_PROXIES`; X-Forwarded-For is then parsed by existing bounded
trusted-source extraction. No wildcard CORS, remote HTTP exception, browser-held
proxy credential or generic proxy is supported. In b the proxy must strip incoming
proxy/forwarding headers, derive client source from its trusted ingress, forward
only the named paths/methods, and preserve cookies/Set-Cookie. For safe GETs it must
validate same-origin browser navigation and supply the configured Origin. For
mutations it must preserve and validate the browser Origin, never manufacture it.
Backend network access must remain private. Production origin/ingress addresses,
TLS and secret provisioning are deployment prerequisites, not inferred from previews.

Bearer fixture consumers explicitly declare `channel: 'bearer'`. Protected
policies with no credential channel deny before authentication. Cookie consumers must explicitly declare
`channel: 'platform-cookie'`; unclassified routes still deny. Cookie consumers
reject Authorization, duplicate/malformed auth or context cookies, oversized
cookie headers and duplicate security headers. Platform cookies cannot authorize
staff policy. Every cookie mutation checks topology/Origin/proof before handler
work; principal/grants and shared protected admission remain canonical.

Input 400 and denial 401 use `Invalid credentials`. CSRF/origin/wrong plane 403;
limits 429 with bounded Retry-After; database/Redis/fence/hash failure 503 with
Retry-After 1. Sign-in admission precedes candidate/private reads/hash/issuance.
One admitted credential pipeline is reserved per auth service, including bounded
DB waits, and one asynchronous scrypt runs per process (160 MiB maxmem). Excess
work returns 503 without queueing plaintext. Unsupported/unknown/ineligible material runs supported
dummy work and denies. Verified credential version must match candidate and trusted
issuance recheck. New login uses new randomness/lifetime. Lost write responses
remain unavailable and are never automatically replayed. Existing lifecycle audit,
transaction authority and recovery fencing remain authoritative.
