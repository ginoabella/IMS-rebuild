# Platform authentication HTTP operations

The [transport contract](../architecture/platform-authentication-http.md) owns
route/channel/CSRF semantics. P2-U3a delivers backend access; P2-U3b composes the actual console proxy,
protected pages and isolated unfinished-work reauthentication. See the
[browser contract](../architecture/platform-browser-access.md) and
[operator guide](../guides/platform-operator-access.md). No Server Actions are used.

## Deployment prerequisites

For the approved private development setup, use the
[server, Windows and macOS HTTPS runbook](platform-development-https.md).
`./dev platform-https` supplies the exact origin and private configuration for its
normal Next/Nest processes using retained private files and existing shared stores.
It does not enable a public domain or production deployment.

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

## Next.js and trusted ingress configuration

Configure server-only `PLATFORM_AUTH_ORIGIN`, `PLATFORM_AUTH_BACKEND_URL` (an exact
private HTTP/HTTPS origin), `PLATFORM_AUTH_PROXY_SECRET` and distinct
`PLATFORM_AUTH_INGRESS_SECRET` on the Next process. The HTTPS ingress must overwrite
its shared-secret header `X-Myims-Ingress`, socket-derived `X-Myims-Client-IP` and
validated path `X-Myims-Path`; strip browser proxy/forwarding fields; validate exact
Host, mutation Origin and safe-navigation fetch metadata. The Next listener and
backend remain private. Missing/invalid settings or ingress metadata returns 503
with no protected presentation. Backend trusted proxy settings name Next's actual
socket IP and source forwarding never comes from browser-asserted headers.

Do not enable `PLATFORM_AUTH_BROWSER_BUILD` in deployment. The verification
harness sets it only for a separate `.local/platform-auth-next` build, enabling a
non-shipping retained-form fixture. Ordinary `.next` builds exclude that form;
runtime environment cannot turn it on. Isolated build caches contain no credentials.
TLS, origin, network access controls and protected secret provisioning remain
production prerequisites; `./dev platform` alone is not secure-origin setup.

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
./dev exec pnpm check:platform-auth --browser
./dev exec pnpm check:platform-auth
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
`isSecureContext` are checked without weakening cookie flags. The HTTP selection keeps that backend transport probe; the browser selection
builds and starts the actual Next application with the same declared secure origin
and production auth adapters. Default platform checks combine both with authority/
lifecycle regressions. Default session/full Docker checks add all distributed
admission/recovery regressions. None certifies production TLS. Fixtures use
real passwords and actual production auth adapters/module wiring; trusted session
issuance remains private IPC for regression/foreign-plane fixtures only. No fixture
route or identity ships. Output contains fixed checks/correlations, never proof,
password, raw username, token/cookie or identifying lookup hash. Exact owned fixture
resources/certificate directory are cleaned; failures remain incomplete.
