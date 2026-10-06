# Distributed admission and integrated session boundary

P2-U2c implements the [approved policy](../planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy)
using session Redis and a/b's canonical/session ports. No sign-in endpoint or
credential verifier ships with this foundation.

## Admission contract

`Admission.signIn` accepts a trusted extracted source, explicit platform/tenant
plane and bounded username (staff also tenant code). Invoke it **before** canonical
lookup, credential verification and issuance. Reuse canonical ASCII trim/lowercase
normalization; raw inputs are bounded before normalization. Known and unknown
identities share the same port, counter and generic response path. A sign-in
consumer must stop on every outcome except `admitted`.

`Admission.protected` receives the validated canonical principal and extracted
source. Global `AuthorityGuard` invokes it after plane/permission validation and
before handing authority to the handler. All declared protected routes share their
plane's protected namespace, including passive reads. Only authorized requests
reach this limiter. The owning handler still checks resource ownership and its
transactional authority. A 429/400/503 invokes no handler or activity renewal.
Public health/foundation routes are explicitly excluded.

| Operation            | Source budget    | Identity budget  | Identity                          |
| -------------------- | ---------------- | ---------------- | --------------------------------- |
| `platform.sign-in`   | 60 / 900 seconds | 10 / 900 seconds | Normalized username               |
| `tenant.sign-in`     | 60 / 900 seconds | 10 / 900 seconds | Normalized tenant code + username |
| `platform.protected` | 600 / 60 seconds | 120 / 60 seconds | Canonical operator ID             |
| `tenant.protected`   | 600 / 60 seconds | 120 / 60 seconds | Canonical tenant ID + staff ID    |

Source and identity are **independent** dimensions; both must admit. Sources cannot
multiply the identity budget; changing identity cannot multiply the source budget.
Platform/tenant and sign-in/protected namespaces are separate. Web/mobile staff
sign-in shares one budget. All syntactically valid admission attempts charge both
counters up to saturation, including downstream failures and limiter rejections;
no refunds or resets on success/logout. Counters never alter account state.
Invalid source/identity inputs allocate no identifying state and run no verifier.
The sign-in transport owns its generic invalid-input presentation.

Windows align to Redis `TIME` UTC epoch boundaries. The request at either budget's
boundary exhausts that allowance; further requests are 429. The next window starts
fresh. A boundary-spanning burst can use two budgets; this is a fixed-window
policy. `Retry-After` is the ceiling of remaining window seconds, at least one,
at most 900 for sign-in and 60 for protected requests. 503 uses `Retry-After: 1`;
401/403 remain a/b's generic outcomes. All protected responses use `no-store`.

## Atomicity, allocation and failure

The typed `DistributedLimiter.consume` port uses operation and two SHA-256 hashes
of length-delimited JSON arrays, never raw identity material. Redis holds one hash
at `myims:limiter:v1:<operation>` per operation. Fields `s:<hash>` and `i:<hash>`
are saturating source/identity counters. One internal `__policy` field records the
source/identity/window/capacity tuple. The entire hash expires at its fixed window
end; identifying fields cannot outlive the window. No per-client Redis keys,
permanent tombstones, session scan or unbounded pruning is needed.

One bounded Lua script checks configuration consistency, cardinality, prior
counts and write permissions, establishes expiry before identifying allocation,
and updates both counters atomically. At most 8,192 identifying fields per
operation are allocated; new identities/sources at capacity return retryable 503.
Existing dimensions remain usable within their budgets. A different policy tuple
on another replica is unavailable, rather than silently interpreting old counts
under new settings. A coordinated admission pause is required for config changes.

Redis scripts do not promise rollback on command failure. Write ACLs are checked
before mutation; expiry is established before counter allocation. No admission is
returned until all required commands confirm. OOM, denied commands, disconnect,
timeout, malformed Redis results and unconfirmed writes are unavailable. Earlier
retained session keys being readable does not permit bypassing failed admission.
`Admission.metrics()` exposes bounded per-process operation/outcome/count snapshots
(maximum 16 series), and the adapter supports a finite metric callback. These
diagnostics never grant admission; shared Redis alone owns allowances. Addresses,
usernames, tenant codes, tokens and identifying hashes are excluded.

The authenticated `SessionRedisConnection` is shared implementation for records
and limiter adapters, with separate connections/concurrency bounds. Connections
validate finite maxmemory/noeviction before use. A failed command closes its
connection and is never replayed. A later new operation may establish a fresh
bounded connection; no offline command queue, process-local state, realtime
fallback or automatic ambiguous write retry exists. Existing durable lineage
fences and canonical versions are still checked on every usable session.

## Trusted source and configuration

`TrustedSource` uses the actual socket peer by default; forwarding headers from
untrusted peers are ignored. `LIMITER_TRUSTED_PROXIES` declares exact addresses or
CIDRs (maximum 32 entries / 2,048 characters). For a trusted peer, require exactly
one valid `X-Forwarded-For` header (at most 1,024 characters / 16 hops), walk right
to left through trusted hops and take the first untrusted address. Missing,
ambiguous, duplicate, malformed and all-trusted chains are invalid. Unsupported
forwarding headers do not define the source. Normalize IPv4-mapped IPv6 and
compressed IPv6; zone identifiers and ports are invalid source addresses. Private
address ranges are not implicitly trusted.

`LIMITER_<PLANE>_<SIGN_IN|PROTECTED>_SOURCE`, `_IDENTITY` and `_WINDOW_SECONDS`
configure each policy; `LIMITER_CAPACITY` configures field capacity. All values
must be positive finite integers and can only shorten/lower approved ceilings.
Defaults are the approved table and capacity 8,192. Connections reuse
`SESSION_TIMEOUT_MS` (2,000 default / 10,000 ceiling) and `SESSION_CONCURRENCY`
(4 default / 16 ceiling). Runtime settings remain server-only. Deployment must
configure real proxy addresses; bearer fixtures do not settle cookie/CSRF origins.

## Recovery and later consumers

Use the [integrated recovery procedure](../runbooks/session-foundation.md). Current
primary PostgreSQL generation/revocation fences and canonical versions quarantine
restored stale session records. Interrupted primary access stays 503; absent
records require new sign-in. Recovery never reconstructs Redis from local memory.
If limiter counters may have rolled back, keep admission closed through the
longest configured window before opening restored traffic. Retained current AOF
restart and arbitrary snapshot rollback have different guarantees. Simultaneous
Redis/PostgreSQL rollback needs separately controlled global invalidation;
production multi-host HA/TLS/failover remains deferred.

U3/U4 reuse trusted issuance after verified credentials, plane-specific ports,
conditional successful-operational renewal, single-session revocation/rotation and
these limiter/error mappings. A write may commit before subsequent renewal fails;
reconcile canonical state and use the owning duplicate-request contract. Web
cookies/CSRF and conflicting credential channels, mobile protected token storage,
expiry/reauthentication with isolated unfinished-work preservation and actual
browser/device acceptance remain U3/U4 work. Password recovery, public intake,
sockets and other operations receive no policy from this approval.

The 120/minute protected identity default is provisional for production capacity:
measure realistic aggregate web polling and operator workflows and future mobile
traffic against both dimensions. If normal traffic can reach it, obtain a revised
budget before production. This foundation has fixture traffic only and cannot
prove future application's normal traffic. The same gate applies to memory and
8,192-counter capacity under the real deployment's session workload. P2-U2 does
not complete the Phase 2 sign-in/transport gate.
