# Platform authentication HTTP operations

The [transport contract](../architecture/platform-authentication-http.md) owns
route/channel/CSRF semantics. P2-U3a delivers backend access; P2-U3b must implement
and verify the actual console proxy, protected pages/Server Actions and isolated
unfinished-work reauthentication. The existing foundation console remains a preview.

## Deployment prerequisites

Configure the four `PLATFORM_AUTH_*` settings together on every backend replica.
All absent/empty disables browser authentication; partial or malformed settings fail
startup with a fixed configuration error. Use one exact HTTPS origin, exact proxy
socket peers also listed in `LIMITER_TRUSTED_PROXIES`, and distinct cryptographically
random shared 256-bit hex proxy/CSRF secrets. Supply secrets through deployment's
protected server-only configuration; never a NEXT_PUBLIC variable, browser bundle,
command-line argument, access log or artifact. Compose forwards the optional settings
from its private root environment. No default credential, operational operator seed,
public backend exception or wildcard CORS is provided.

Keep NestJS network access private. TLS terminates at the declared browser origin.
The owning Next.js proxy must strip client proxy/forwarding fields, derive the client
source from explicitly trusted ingress, append its trusted chain, and add the shared
`X-Platform-Proxy` proof. It forwards only the four named auth paths/methods and
later explicitly declared protected cookie consumers, preserving Set-Cookie and safe
response status/Retry-After/no-store. Preserve browser Origin on mutations; reject
missing/foreign/ambiguous Origin locally too. Safe GETs need validated same-origin
navigation before the proxy supplies backend Origin. No backend service secret or
auth token appears in JSON; only the session proof may reach client memory.

## Browser and retry sequence

1. GET `/platform/auth/csrf` (200) obtains proof and an HttpOnly pre-auth cookie.
2. POST `/platform/auth/sign-in` with exactly username/password JSON, content type
   application/json, original Origin and `X-Platform-CSRF` proof. Success (201)
   sets the platform cookie, clears pre-auth context and returns safe session DTO.
3. GET `/platform/auth/session` (200) validates current canonical authority and
   returns the current proof/expiry DTO; polling remains passive. A rotated token
   requires fetching its new session proof; the original absolute expiry remains.
4. POST `/platform/auth/logout` with session proof (201) clears both cookies only
   after confirmed durable revocation and Redis deletion. Another device is retained.
5. After a cleared/expired/invalid cookie, obtain fresh pre-auth proof through GET
   csrf, then repeat POST logout. This retry bypasses no authority/foreign-plane
   check and creates no session. Duplicate logout retaining the former cookie and
   proof also succeeds after invalidation. A live session requires its session proof.

On 400/401 show generic Invalid credentials. CSRF/origin/wrong-plane failures are
403; shared limits are 429 with bounded Retry-After. Dependency/hash capacity/failure
is 503 with Retry-After 1. Never automatically replay sign-in or a possibly committed
write. A new explicit sign-in can recover lost issuance responses. Logout 503 must
retain its cookie and must not claim success; explicitly retry it. A durably revoked
session may already be unusable after an uncertain response. Sensitive operational
writes may have committed before failed renewal: reload canonical owning state and
use its duplicate-request contract, not an inferred rollback. Existing
[session recovery](session-foundation.md) controls stale restoration, no reconstruction
and limiter quarantine; no transport change weakens those procedures.

## Reproducible verification

Use the existing Docker workspace and real shared PostgreSQL grants. Before the
browser-dependent checks, install the pinned Playwright browser and its system
libraries in that workspace:

```sh
./dev exec pnpm exec playwright install chromium
docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml exec -T --user root workspace pnpm exec playwright install-deps chromium
./dev exec pnpm check:platform-auth --http
./dev exec pnpm check:identity-foundation
./dev exec pnpm check:session-foundation
./dev check
```

The default session suite/full check includes platform HTTP and secure browser
acceptance. CI installs the browser before that suite. No host Node installation
is required. Checks create a uniquely named disposable database, dedicated bounded
Redis container, independent HTTP processes and a non-shipping narrow HTTPS probe.
The probe uses an ephemeral self-signed localhost certificate and Chromium's
certificate exception; Secure/HttpOnly/SameSite/host-only behavior and
`isSecureContext` are checked without weakening cookie flags. It is backend transport
evidence, not certification of production TLS or b's actual app proxy. Fixtures use
real passwords and actual production auth adapters/module wiring; trusted session
issuance remains private IPC for regression/foreign-plane fixtures only. No fixture
route or identity ships. Output contains fixed checks/correlations, never proof,
password, raw username, token/cookie or identifying lookup hash. Exact owned fixture
resources/certificate directory are cleaned; failures remain incomplete.
