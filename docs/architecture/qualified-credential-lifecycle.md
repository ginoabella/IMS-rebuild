# Qualified staff credential lifecycle — P2-U4a

Implementation and A-01–08 acceptance complete, 2026-10-08 00:18 +08:00 (Asia/Manila).
See [verified evidence and scope limits](../status/p2-u4a-evidence.md).
The [approved review](../planning/p2-u4a-credential-contract-review.md) owns G-01–06.
The [feature spec](../../context/feature-specs/p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md)
owns A-01–08; implementation does not imply verified completion.

Identity owns PostgreSQL `credential_actions` and feature-only grants, qualified
foreign keys, hashed lookup, expected staff/tenant/issuer versions, purpose,
verification method, deadlines and immutable terminal state. A partial unique
index enforces one pending action per qualified target; expired pending actions
are cancelled atomically before replacement. No code/password is stored. Trigger
and column grants prohibit redisclosure/reconstruction, metadata rewriting and
premature deletion. Retention starts at the earlier terminal/expiry time, plus
30 days. Explicit cleanup removes 1–100 rows with required system audit.

`CredentialActions` coordinates use cases through caller-owned persistence and
transaction ports. Tenancy owns the exclusive tenant lock/status read; platform
owns immutable receipt linkage and canonical operator locking. Identity owns
staff qualification, capability and credential writes. Platform linkage resolves
only the immutable qualified target for the shared budget key; mutable staff,
action and password work follows credential admission. No username/role search
selects an initial administrator. Management guard admission also precedes this
bounded immutable binding resolution. Staff action-ID management resolves only its
tenant-qualified immutable target IDs before cancel admission; it does not read
mutable action metadata or lookup hashes there. Unknown cancel bindings consume
the same source/issuer budget path with an unlinked target sentinel.

Platform issuer lock precedes tenancy. Staff paths lock tenancy exclusively before
issuer/target rows. Staff creation, rename and authority mutation reuse the same
narrow tenancy lock port before their own row write. This serializes the last-admin
predicate with participating owner mutations, including another admin becoming
ready, and preserves tenant-before-staff ordering. Sensitive existing SHARE
transactions remain bounded by normal statement/lock timeouts; a deadlock/timeout
is unavailable with rollback. No ordinary admission predicate is relaxed.

Exchange uses capability-authorized system context, never a fabricated authenticated
recipient. It checks current issuer/target/purpose/version/expiry, releases locks
before bounded scrypt work, then revalidates under locks. It re-reads terminal state
after acquiring tenancy to fence concurrent cancellation/reissue. Password
replacement, authentication/row version advancement, consumption and required
audit share one poisoned transaction/connection. Confirmed outer commit is required.
Every ready replacement gets a fresh salted hash and advances canonical authority.
All prior sessions deny canonical version checks regardless of Redis deletion or
stale record restoration. Issue/reissue/cancel do not revoke current sessions.

Audit issuance/cancellation retains its authenticated canonical actor. Consumption
uses `identity.credential-exchange` / `capability-exchange`, a qualified staff target,
and allowlisted action UUID, issuer UUID/plane, purpose and verification-method
codes. The audit foundation adds a strict UUID field rule for these references;
no arbitrary string payload is introduced. Attribution survives capability cleanup.

`RedisCredentialBudgets` uses one bounded expiring hash per issue/cancel/exchange
group, atomic source/issuer/target counting, saturation, fixed 900-second windows
and an 8,192-counter ceiling. Failure cannot fall back or replay an ambiguous write.
Approved source/issuer/target values remain in the review, independently of existing
protected/sign-in limits. Public exchange admits before capability lookup/hash work.

The declared platform routes and DTOs follow review section 7. Recipient exchange
and forgery context are public `/credential-actions/exchange` and
`/credential-actions/csrf`. Staff issuer routes use explicit `staff-cookie`, existing
`tenant.manage` and current canonical admin qualification; `/staff/credential-actions/session`
returns only qualified owner IDs and a session-bound proof for this narrow consumer.
There is no staff sign-in endpoint or fixture token issuer in production.

Browser configuration is independent: `CREDENTIAL_EXCHANGE_{ORIGIN,PROXY_PEERS,
PROXY_SECRET,CSRF_SECRET}` and `STAFF_ISSUER_{ORIGIN,PROXY_PEERS,PROXY_SECRET,
CSRF_SECRET}` are optional complete validated HTTPS boundary groups. Absence denies
these consumers. Proxy peers must be explicitly trusted by the existing limiter
configuration. Each Next app consumer additionally requires its own `BACKEND_URL`
and `INGRESS_SECRET`. Private Next listeners rely on ingress overwrite of source
and ingress-proof headers. Public ingress must enforce exact host/Origin and strip
forwarded/proxy/ingress authority supplied by clients.

The recipient command-center `/credentials` form receives a short-lived signed
Secure/HttpOnly/SameSite forgery context, never staff authority. A context-bound CSRF
header and exact Origin/proxy boundary protect exchange without prior login.
Platform mutations use existing platform cookie/CSRF; staff issuer mutations use
`__Host-myims-staff` and `X-Staff-CSRF`. Staff/exchange MACs are namespace separated;
existing platform proof behavior is preserved. Ambiguous/bearer/foreign-plane
cookies deny. Named Next forwarding bounds body sizes/timeouts, rejects extra
queries and unknown consumers, disables caching and never converts channels.

Operator forms use existing canonical-owner captures and clear one-time disclosure
on unknown/expired/foreign authority or unmount. Recipient forms clear secrets on
committed success and uncertainty and never replay automatically. Staff issuer
forms require canonical-owner revalidation before writes, hide protected focus/work
on unavailable access, retain nonsecret mounted work for the same owner and clear
foreign-owner values. One-time code display is never persistent browser state.

Public validation is 400; invalid/expired/consumed/cancelled/stale capabilities are
401 `Invalid capability`; forgery/permission is 403; protected missing action 404;
issue conflict 409; shared limits 429; dependency/hash/uncertain commit 503.
POST successes currently use Nest's 201; GET status/context uses 200. No public
exchange failure identifies the target. Status returns only safe action metadata
and credential state, allowing explicit reconciliation/reissue after response loss.

`./dev exec pnpm check:staff-auth --api` selects the focused real-service API matrix;
`--lifecycle` includes production Next/HTTPS operator/recipient and staff issuer
checks. The host launcher provisions an isolated authenticated Redis container;
checks own a disposable migrated PostgreSQL database and independent HTTP
processes. Private IPC barriers/faults exist only in script fixtures. Parent
ordinary staff sign-in, command-center protected shell and native device storage
remain b/c; controlled existing staff sessions cannot claim those boundaries.
