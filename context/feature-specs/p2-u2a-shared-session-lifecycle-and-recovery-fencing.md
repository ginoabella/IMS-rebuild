# P2-U2a — Shared session lifecycle and recovery fencing

## Status and purpose

- **Status:** complete; 2026-10-06 08:53 +08:00 (Asia/Manila), A-01–07 passed.
- **Evidence:** [lifecycle acceptance and limits](../../docs/status/p2-u2a-evidence.md).
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U2 parent scope and acceptance matrix](p2-u2-shared-session-store-and-authorization-guards.md).
- **Goal:** provide one shared, atomic opaque-session lifecycle for both authority planes.
- **Completion boundary:** trusted backend consumers create, read, renew, rotate
  and revoke sessions across independent processes; expiry, races and stale Redis
  restoration cannot resurrect revoked or replaced tokens.

The user adopted the three-spec split. The parent owns shared scope, exclusions,
AC-01–11 and decision gates; this spec owns lifecycle and recovery fencing.
The split does not approve pending product policies or start runtime implementation.

## Starting state and dependencies

Recheck verified P2-U1 and P1-U3 using the parent's evidence links. Reuse the
canonical plane-specific authority ports, monotonic authentication/tenant authority
versions, authenticated session Redis connection and bounded configuration/health
infrastructure. P1-U5 transaction/audit conventions apply to any required canonical
metadata writes. Do not replace the identity stores or add a session-manager service.

The user approved the [scoped D-05 lifecycle/recovery contract](../../docs/planning/p2-u2a-session-contract-review.md)
on 2026-10-06 (Asia/Manila, +08:00): web 60-minute idle/12-hour absolute,
mobile 24-hour idle/7-day absolute. Only successful authorized operational activity
renews; passive polling, health, heartbeats and merely open apps do not. Renewal
and rotation preserve the original verified-sign-in absolute deadline. Durable
PostgreSQL generation/revocation fencing is approved. Owning UI/transport units
must support reauthentication without unnecessary loss of unfinished incident
work. Unrelated policies and P1-U1 remain deferred outside approved handoffs.

## Scope and ownership

Allowed changes: `modules/identity/` lifecycle domain/application ports and Redis
adapter, server-only validated lifecycle/timeouts settings, necessary Redis access
and capacity configuration, minimal module-owned recovery metadata if required,
isolated real-service fixtures, focused check wiring and lifecycle documentation.

Use the existing session Redis, not realtime Redis. Redis owns shared expiring
session records; PostgreSQL retains canonical identity facts. Any recovery metadata
must serve a documented fencing requirement, with bounded cleanup and explicit
migration/grant ownership. Avoid speculative authentication tables or general
administration commands. Runtime processes never migrate.

Out of scope: HTTP guards/principals (b), rate limits and integrated HTTP recovery
(c), credential verification/sign-in/logout endpoints or UI (P2-U3/U4), credential
setup/reset, mobile storage, sockets and production HA deployment. a may use
trusted fixture issuers but must not expose a public token-minting endpoint.

## Token, record and creation contract

Generate opaque tokens with at least 256 bits of cryptographic entropy. Plaintext
is returned once to the trusted transport caller and never persisted, logged,
audited or put in a URL. Store only cryptographic hashed lookup keys; exclude those
hashes from diagnostics too. Bound input before hashing, reject malformed tokens
and never accept a client-selected token as a new session identifier.

Use bounded schema-versioned records with plane, canonical identity ID,
authentication version, creation time, idle/absolute deadlines and lifecycle
state/generation. Staff records require canonical tenant ID and tenant authority
version; platform records are tenantless. Reject mixed-plane fields, invalid
versions, malformed timestamps and unknown schema versions. Store no passwords,
password hashes, usernames, tenant codes or unnecessary personal data. Stored role
snapshots are never authoritative.

Creation is a backend-only operation invoked after credential verification by the
owning sign-in unit. Reload eligible canonical authority and ensure its versions
match the verified snapshot before issuing a session. A stale supplied DTO does
not prove authentication. Return typed issued, invalid/conflict or unavailable
outcomes without internal details. Fresh login gets a new token; no process cache
is an authoritative session source.

## Atomic lifecycle and recovery contract

Define a consistent time basis and validate finite configured bounds. A session
fails at either idle or absolute deadline even if Redis retains the record. TTL
must not exceed the earlier deadline. Authorized successful activity may renew
idle expiry only to the original absolute deadline. Renewal never changes creation
or absolute lifetime. Denied/failed/unavailable activity does not renew; b supplies
that authorization result through the lifecycle port.

Use atomic conditional lifecycle operations. Renewal of missing, expired,
revoked or wrong-generation records cannot recreate them. Concurrent rotations
have one winner, invalidate the prior token and return no replacement token to
losers. Duplicate/delayed requests cannot restore an earlier state. Rotation must
use eligible current authority; it cannot upgrade a stale session snapshot.

Single-session revocation is shared and idempotent. Confirm success only after
all required writes succeed. Account/tenant-wide invalidation relies on canonical
version changes committed before Redis cleanup; no request performs an unbounded
key scan. Expose bounded cleanup/invalidation hooks for later owning workflows,
without implementing lifecycle administration or password reset early.

Document how acknowledged revocations and rotations survive restoration of an
older Redis snapshot. Redis-only deletes/tombstones and asynchronous replication
are insufficient proof. Choose durable fencing or a recovery sequence that
invalidates all sessions before restored data can serve traffic. Gate access until
the fence/reset is established. If the choice changes behavior for other devices,
resolve that product decision before dependent implementation. Define metadata
retention sufficient to cover every affected token's absolute lifetime.

Bound commands/timeouts/retries and handle partial writes or uncertain responses.
Lost issuance/rotation responses grant no fallback authority; sign-in recovers lost
access. Revocation with an uncertain response cannot be reported as successful.
Redis authentication failure, capacity/noeviction write rejection and interruption
produce unavailable outcomes. Never reconstruct records from memory, use realtime
Redis as fallback or renew a session after a failed canonical read.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| A-01 | Lifecycle contract records approved defaults/activity, time basis, typed ports/errors, recovery strategy and pending unrelated gates. Any necessary migrations/grants and metadata retention are explicit. | AC-01 lifecycle portion |
| A-02 | Trusted issuance creates distinct bounded random tokens; Redis stores hashed lookup keys only. Wrong-plane/malformed/oversized records and tokens deny. Token/hash/credential sentinels do not leak through errors, logs, audit or client artifacts. | AC-02 |
| A-03 | Real Redis expiry checks cover idle and absolute boundaries, retained expired keys, TTL bounds and renewal capped by original absolute lifetime. Failed/denied/unavailable activity cannot renew. Lost records require new sign-in. | AC-04 lifecycle portion |
| A-04 | Independent processes race renewal/revoke and concurrent rotations with barriers. Revocation wins against late renewal; one rotation wins, losers receive no new token and the old token fails across processes. | AC-05 |
| A-05 | Disconnect, timeout, authentication/capacity write failure and uncertain create/rotate/revoke responses return unavailable without false success or local/realtime fallback. Valid retained records recover under the declared strategy; missing records stay missing. | AC-09 lifecycle portion |
| A-06 | Restore actual records captured before revocation/rotation. Fencing/reset rejects old tokens before service resumes; interruption during recovery keeps access denied. Document the controlled restoration boundary and avoid an untested HA claim. | AC-10 lifecycle portion |
| A-07 | Focused real-service lifecycle checks and required Docker checks pass; evidence/runbook cover settings, protected credentials, fixture cleanup, safe recovery and b/c handoff. | AC-11 scoped checks/docs |

Use actual session Redis and PostgreSQL/runtime grants with two independent
processes. Fixtures own isolated services/databases/namespaces and clean up only
their resources. Use barriers and bounded deadline fixtures instead of long sleeps.
Test doubles cannot establish lifecycle atomicity or stale-restore guarantees.

Implement a documented lifecycle selection of the provisional parent command
`./dev exec pnpm check:session-foundation`. This command/selection does not exist
at spec preparation. Run focused checks and `./dev check`, recording actual results.
Documentation-only preparation requires link, consistency and whitespace review.

## Completion and handoff

Complete a only when A-01–07 pass. Hand
[b](p2-u2b-canonical-authority-validation-and-http-guards.md) the typed session
lifecycle/lookup port, validated plane records, conditional renewal and recovery
fence. Hand [c](p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md)
the failure/restore fixtures and configuration through b's verified HTTP integration.
No a completion claim establishes protected HTTP access, sign-in or parent completion.
