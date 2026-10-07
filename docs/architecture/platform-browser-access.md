# Platform browser access and unfinished-work integration

P2-U3b composes the [backend HTTP contract](platform-authentication-http.md) in
`apps/platform-console-web`. NestJS remains the sole credential, session,
canonical identity and permission authority. The app has no identity database
connection or token issuer. No Server Actions are used.

## Ingress and named consumers

The HTTPS ingress and private Next listener share a distinct random 256-bit hex
`PLATFORM_AUTH_INGRESS_SECRET`. Ingress must validate the exact configured Host,
reject foreign/missing Origin on mutations, permit only same-origin/none fetch
metadata on safe navigation, strip incoming `X-Myims-Ingress`, `X-Myims-Client-IP`,
`X-Myims-Path`, `X-Platform-Proxy`, Forwarded and X-Forwarded-For and browser-asserted forwarding host/scheme/hop headers, then overwrite
its secret header, canonical socket client IP and pathname. It supplies the
configured HTTPS host/scheme metadata for Next URL handling while preserving the
browser mutation Origin exactly. Never expose the Next
listener publicly. Its source check requires both secret equality and a single
valid IP; absent or malformed configuration/source fails closed with 503. The
secret authenticates this explicitly private ingress hop; it is not a browser
credential. Additional ingress hops require deployment-controlled source validation.

Next receives exact `PLATFORM_AUTH_ORIGIN`, private canonical origin
`PLATFORM_AUTH_BACKEND_URL`, backend `PLATFORM_AUTH_PROXY_SECRET`, and its ingress
secret through protected server-only environment. All secrets must remain absent
from NEXT_PUBLIC settings, client bundles, request logs and artifacts. Backend
proxy peers/trusted limiter proxies must include Next's actual socket address.
Backend CSRF secret remains backend-only. HTTPS deployment/secret provisioning
are prerequisites; the normal HTTP preview is not an authentication deployment.

`/platform/auth/[consumer]` forwards only GET csrf/session and POST sign-in/logout,
with no query destination, bounded 4096-byte mutation body, cookie, CSRF,
content type, original exact mutation Origin, validated client IP and server proxy
proof. It rejects bearer headers. Safe GETs validate fetch metadata and supply the
configured Origin. Client-asserted proxy/source/principal/role headers never enter
the backend request. It propagates only the declared Secure/HttpOnly/host-only
cookies, fixed DTO/status, bounded Retry-After and no-store. There is no general
backend proxy. Future consumers need an explicit named route and backend policy.

## Protected presentation and errors

The dynamic console layout calls current-session with no-store for every server
render. No cookie-presence check grants access. Missing sessions redirect to a
separate sign-in page; `X-Myims-Path` permits only delivered local `/` and
`/ui-preview` returns. Other return values, including encoded paths and external
URLs, fall back to `/`. Protected pages and routes do not share a data cache.

Sign-in has exactly labelled Username/Password fields, native autocomplete,
shared dark primitives, pending lock and accessible focused errors. Only username
is normalized. Password is cleared when an attempt begins; issuance never retries
automatically. Success reloads current canonical identity before navigation/resume.
401, 403, 429 and 503 have distinct messages; bounded Retry-After blocks explicit
sign-in, protected access and logout retries without a polling loop. Logout hides presentation immediately but claims
success only after backend revocation confirmation. An unavailable/uncertain
logout exposes explicit retry. Invalid/absent logout obtains fresh pre-auth CSRF.

The mounted client boundary hides and makes content inert on authority loss,
pagehide, visibility loss, route transitions and invalidation signals. It validates
on mount, pageshow, focus/visibility restoration and before fixture submission.
An expiry deadline timer hides content without sending a heartbeat. Epoch guards
reject delayed prior validation results. Concurrent restoration events share one
in-flight read; invalidation during that read discards its result and requires a
fresh read before presentation. This does not retry issuance or submissions. No
passive polling renews a session.

The shared presentation-only `OverlayScope` places console dialogs and menus
inside the protected boundary. Immediate hiding therefore includes portalled
content; inactive scope closes its focus and pointer traps so reauthentication is
reachable. Same-owner recovery restores requested dialog presentation. A confirmed
identity switch remounts the entire shell and clears its local presentation state.
BroadcastChannel carries only invalidate/logout signals, never identities, tokens
or form values. Logout signals clear memory only after current backend validation confirms an
absent session, so delayed signals cannot erase a valid workspace. Lost signals
still require backend
validation on restoration/actions. Signals do not establish authority.

## Future form contract and supported lifetime

`useOperatorWork()` exposes the validated `operatorId`, `values`, `record(values)`,
`authorize()` and `rejectAccess(error)` inside
`ConsoleAccess`. `RetainedWork` binds values to the last backend-validated canonical
operator ID. Form callbacks remain bound to the rendered canonical owner and
cannot repopulate cleared work while access is hidden. Hidden forms remain mounted on 401/403/503. Same-ID reauthentication
restores memory; a confirmed identity switch clears values and remounts
the entire shell, including local dialog and navigation state. Confirmed explicit logout
clears memory. Protected actions must still use a declared backend consumer;
`authorize()` is a presentation check, not permission to bypass canonical backend
mutation guards. Forms report a protected 401/403/429/503 through
`rejectAccess(new AccessError(status, retryAfter))`, which immediately hides and
blocks the workspace while retaining values. After successful qualifying activity,
a passive `authorize()` read can reload updated deadlines. Never automatically
replay a prior submission after resume.

Forms whose inputs live in dialog content must record non-secret values in the
owner-bound application state outside that content; inactive dialog content can
unmount to release its focus trap.

The small app-owned record currently holds one form's string fields. Extend it
only for a delivered form; no draft framework, browser storage, tables, retention
policy or durable incident persistence was added. Refresh/process loss discards
memory. P5-U4 owns real incident drafts and conflicts. The verification-only form
is compiled solely by `PLATFORM_AUTH_BROWSER_BUILD=1` into the isolated
`.local/platform-auth-next` output. The selected TypeScript configuration resolves the verification module before
constructing the client graph;
normal builds resolve the same typed import to an empty server component. A runtime
setting cannot enable the form or add its module to normal output. The private browser process uses that
separate output and TypeScript configuration. It records explicit authorized
submission count locally and performs no operational writes.

The real-app harness uses production Next output, ephemeral HTTPS localhost TLS,
real provisioned synthetic credentials, PostgreSQL/runtime grants, session Redis
and two independent backend HTTP processes. TLS ingress/balancer/fault controls
and accounts are isolated test infrastructure. Production TLS/HA/capacity and
staff/reset/mobile journeys remain separate acceptance boundaries.
