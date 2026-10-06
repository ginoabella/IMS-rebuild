# Shared session lifecycle and durable recovery fencing

P2-U2a implements the [approved lifecycle/recovery policy](../planning/p2-u2a-session-contract-review.md).
Approval: 2026-10-06, Asia/Manila (+08:00). Web idle/absolute defaults and ceilings
are 60 minutes/12 hours; mobile defaults and ceilings are 24 hours/7 days.
Configuration may shorten them. Successful authorized operational reads/writes
qualify for renewal; passive polling, health, heartbeats, merely open apps, denied,
failed and unavailable operations do not. The owning consumer supplies that outcome
only after successful authorization and execution. No route or browser integration
is established by a.

## Trusted consumer contract

`sessionRuntime(loadBackendConfig())` constructs the backend-only shared lifecycle
and cleanup adapters. b owns dependency registration and HTTP mapping. Its `close`
method releases database pools and Redis; after a closed/disconnected Redis
connection, rebuild the runtime or reconnect the records adapter. Commands never
retry a write. This factory exposes no listener, verifier or token-minting endpoint.

`issue(verified, consumer)` requires credential verification by P2-U3/U4 before
invocation. The verified plane-qualified snapshot is reloaded through existing
primary canonical ports; mismatched versions conflict, ineligible authority denies
and failed canonical reads return unavailable. A structurally valid DTO is not
proof of credential verification. Staff facts include canonical tenant ID and
tenant authority version; platform facts are tenantless. No roles are stored.

`lookup(token)` returns a validated session record after checking durable generation,
revocation and deadlines. [b's HTTP guards](canonical-http-authority.md) reload
canonical account/tenant authority for every protected operation. `renew(token, reference, activity)` checks canonical
versions again and conditionally advances idle expiry. `rotate(token, reference)`
requires eligible unchanged authority, advances the durable generation and
conditionally replaces the Redis record. Rotation preserves idle deadline,
creation and absolute deadline; rotation is not qualifying activity itself.

`revoke(token, reference)` revokes the whole lineage, including an already rotated
replacement. The reference (lifecycle ID/generation) comes from a trusted backend
lookup, never client input. This explicit reference allows revocation when Redis
has lost the old token's record. Repeated missing-key revocation confirms the
fence and Redis deletion; wrong-token/record reference pairs deny. A stale reference
cannot undo revocation or regain authority. `cleanupInvalidated` accepts at most
100 trusted token/reference pairs after canonical version changes commit; it never
scans Redis. Canonical versions enforce wide invalidation even if cleanup fails.

All ports return bounded typed outcomes: issued/rotated with a one-time token,
found with a validated record, revoked, invalid/conflict or unavailable. Failed or
uncertain writes return unavailable without any token. Losing concurrent rotations
receive no replacement. A lost response requires fresh verified sign-in.

## Storage, time and atomicity

Each token is 32 random bytes in canonical unpadded base64url (43 characters).
Input is bounded and validated before SHA-256 hashing. Redis keys contain only
the cryptographic lookup hash; neither token nor hash appears in diagnostics/audit.
Strict bounded records carry schema/state, plane IDs/versions, consumer, lifecycle
UUID/generation, approved idle duration and UTC millisecond timestamps. Unknown
fields, mixed planes, invalid versions/timestamps/schema and oversized values deny.
Redis GETRANGE bounds returned bytes even for oversized corrupted stored values.

Primary PostgreSQL `clock_timestamp()` is authoritative for creation, activity,
lookup expiry and retention. Both deadlines are checked even if a Redis key has
no TTL. Every Redis Lua write compares the exact previous serialized record,
never recreates a missing record on renewal, and bounds its TTL by the earlier
idle/absolute deadline. TTL also considers Redis TIME and reserves the configured
command-timeout budget for transit. An ahead Redis clock can expire early; a behind
Redis clock cannot extend PostgreSQL authorization. Clock rollback behind record
activity denies. UTC synchronization remains an operating prerequisite; arbitrary
clock rollback is not an HA guarantee. No deadline is slid by rotation.

For one lineage, PostgreSQL session advisory locks serialize operations across
processes. Locks span the durable commit and conditional Redis mutation; collisions
only serialize unrelated UUIDs. Locks, connection waits, SQL and Redis commands
have bounded timeouts. Canonical reads use the existing separately bounded primary
snapshot pool. Exceptions discard uncertain lock connections. OS/connection death
releases locks; queued late Redis writes still require matching Redis state and
cannot make durable revoked/replaced authority usable. Successful mutation results
recheck durable authority after Redis before returning usable records/tokens.
Already validated requests may be in flight; b's sensitive-write transactional
boundary remains required.

`session_fences` is identity-owned minimal recovery metadata: lifecycle UUID,
generation, revoked flag and immutable absolute deadline. It contains no identity
payload, token/hash or credentials. Creation, generation advance and first
revocation use existing same-connection Transaction/AuditRepository conventions.
A system actor `identity.session-fence` with reason `recovery-fencing` records
only the allowlisted created/rotated/revoked operation and a correlation UUID.
Audit failure rolls back the fence write; uncertain commits grant no fallback.
Renewals are not durable metadata writes and do not produce session activity audit.

Migration `20261006000000_session_fences` and explicit runtime grants are deployment
owned. Runtime cannot truncate, disable the trigger, revive revocation, decrease
generation, change IDs/deadlines or delete before the absolute deadline. Retention
includes every rotated predecessor because rotation never changes that deadline.
`cleanupExpired(1..100)` uses the retention index and bounded SKIP LOCKED deletion,
with atomic system audit of the removed count. Cleanup failures return unavailable.
Missing metadata always denies restored records even after cleanup. Cleanup does
not establish authority or run as an unsolicited administration workflow.

## Recovery guarantee and limits

Durable invalidation commits before Redis replacement/deletion. Rotation has one
winner; if Redis subsequently fails, both the predecessor and any uncertain
replacement are unusable to the caller. Revocation confirms success only after
confirmed durable invalidation and Redis deletion. Redis-only deletion, TTL,
tombstones and asynchronous replication are never the recovery proof.

During controlled Redis restoration, current primary PostgreSQL fences reject
actual pre-revocation/pre-rotation records before any usable authority is returned.
Missing/mismatched/revoked metadata denies; unavailable metadata returns unavailable.
Other device lineages remain usable if retained and valid. Redis loss requires new
sign-in for missing records; no process/realtime fallback exists. PostgreSQL and
Redis must not be rolled back jointly while traffic is admitted. A joint rollback
requires a separately controlled invalidate-all recovery; production HA topology
and multi-store backup recovery remain Phase 9.

## Handoffs

b receives the strict lifecycle/lookup port and reference, canonical bridge,
conditional renewal, fencing and bounded unavailable outcomes. c receives the
isolated lifecycle failure/response-loss/restart/restore fixtures and settings.
They must prove their own HTTP/limiter contracts; a does not complete the parent.

P2-U3/U4 own expired-session presentation and reauthentication. Preserve unfinished
incident work across expiry and sign-in, isolate drafts by identity/tenant, and
never submit under expired authority or apply another identity's work silently.
Fresh sign-in resets lifetime; rotation does not. Do not introduce passive traffic
to avoid expiry. Cookie/CSRF/mobile storage and actual incident draft UX stay with
their owning units and acceptance checks.
