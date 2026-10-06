# P2-U2a session lifecycle contract review

Prepared 2026-10-06, Asia/Manila (+08:00). **Approved 2026-10-06, Asia/Manila (+08:00), with web idle revised to 60 minutes.**
The user explicitly approved the scoped D-05 policy and durable recovery design
under the [a specification](../../context/feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md).

## 1. Scoped D-05 decision: lifetimes and activity

The user approved these defaults for both tenant and platform web consumers, and for
later supported authenticated mobile consumers:

| Consumer | Idle lifetime | Absolute lifetime |
| --- | --- | --- |
| Web | 60 minutes | 12 hours |
| Mobile | 24 hours | 7 days |

At either deadline, require a fresh sign-in. Successful authorized backend
operations renew idle expiry, capped at the original absolute deadline.
Denied, failed or unavailable operations do not renew. Merely keeping an app
open, polling health, or background heartbeat traffic does not renew. An owning
consumer must explicitly mark an operation as qualifying activity after successful
authorization and execution; b supplies this outcome through the lifecycle port.
Authorized operational reads and writes qualify; passive polling does not.
Rotation preserves creation time and the original absolute deadline and requires
matching current canonical authority. A fresh verified login starts a new lifetime.

Configuration can shorten these approved lifetimes; it cannot exceed their
per-consumer approved ceilings. Fixtures can use short explicit lifetimes without
turning those fixture values into product defaults. Mobile transport/storage,
web cookies/CSRF, sign-in, setup/reset, limiter budgets and unrelated D-05 decisions
remain with their owning units.

## 2. Recovery design selected for implementation

Use minimal durable per-session generation fencing in primary PostgreSQL.
Redis remains the only shared expiring session-record store. PostgreSQL keeps a
random lifecycle ID, current generation/revoked state and retention deadline;
it stores no bearer token, token lookup hash, credential, roles or session payload.
Each Redis record carries its lifecycle ID and generation. Every usable lookup
checks this durable fence; a missing fence or generation mismatch denies, and a
failed fence read returns unavailable. Never cache a successful fence check as
future authority.

Serialize rotation/revocation on the corresponding fence row. Commit durable
invalidation before Redis replacement/deletion. Only one rotation can advance
the expected generation; losers get conflict with no replacement token. A failed
or uncertain Redis write after durable invalidation leaves the old token invalid;
return unavailable, and recover access through fresh sign-in. Revocation is
idempotent, but success requires both its durable write and Redis cleanup to be
confirmed. Lost issuance responses grant no fallback access. Renewal is conditional
on the exact record/generation and cannot recreate a missing record.

A restored old Redis record still refers to an old generation or revoked fence.
Reject it before returning usable authority. This preserves other devices'
sessions: no global session reset is required. Do not change account/tenant
versions merely to implement single-session fencing. Canonical account/tenant
invalidation continues to commit existing authentication/authority versions before
bounded Redis cleanup. HTTP enforcement of those versions belongs to b.

The implementation must define and verify the ordering of fence checks, row
locks and conditional Redis scripts, including delayed renewal/replacement after
revocation. The normal concurrent-request boundary applies: an already validated
operation may be in flight; sensitive writes need b's transactional authority
check. No atomic PostgreSQL/Redis transaction is claimed.

The metadata migration and explicit runtime grants belong to identity and the
existing deployment path. Runtime processes never migrate. Apply existing
transaction/audit conventions to required canonical metadata writes; audit only
allowlisted operation facts/correlation IDs, never tokens or lookup hashes.
Retention must cover each token's immutable absolute deadline, including rotated
predecessors. Use primary PostgreSQL UTC time for authoritative lifecycle deadline
checks and retention. Redis TTL is bounded by the earlier deadline; implementation
must account for command transit and expiry clock behavior, and fail closed on
invalid time/configuration. Do not clean a fence while any associated token could
still be within its absolute lifetime. Cleanup is an indexed bounded batch, with
no request-time key scan. Missing fence rows always deny even after cleanup.

Controlled recovery restores Redis while primary PostgreSQL fencing remains
current. PostgreSQL unavailability gates all session access; recovery interruption
keeps access unavailable until durable checks can succeed. A joint rollback of
PostgreSQL and Redis is outside this guarantee and requires a separately controlled
invalidate-all recovery before admitting traffic. No arbitrary production HA or
multi-store rollback guarantee is claimed.

## 3. Implementation and verification

Reuse plane-qualified canonical authority ports and their eligible/denied/
unavailable outcomes. Trusted issuance follows credential verification, reloads
eligible authority and compares verified authentication/tenant versions. Generate
32 cryptographically random bytes per token, use bounded canonical encoding and
hashed Redis lookup keys, and strictly validate schema-versioned plane records.
Return typed issued/found/renewed/rotated/revoked, invalid/conflict and unavailable
outcomes without internal details. Return plaintext only with confirmed issuance
or rotation; losing or uncertain callers receive no token.

Add bounded server-only policy/command settings, authenticated session Redis
access and noeviction/capacity configuration. No realtime fallback, local session
cache, automatic write retry after an uncertain result, public issuer or HTTP/UI
implementation belongs to a.

Implement `./dev exec pnpm check:session-foundation --lifecycle` with isolated real
Redis/PostgreSQL resources and two independent processes. Verify A-01–07: strict
records/tokens, idle/absolute boundaries and retained expired keys, TTL caps,
conditional renewal, barrier-controlled revoke/renew and rotation races,
authentication/capacity/timeouts/disconnects, real lost-response writes, and actual
pre-revocation/pre-rotation records restored against current durable fences.
Verify failed/interrupted recovery and precise fixture teardown, then run
`./dev check`. Record evidence/runbook and b/c handoffs before marking a complete.

Approval is recorded; lifecycle acceptance remains subject to implementation and verification.

## 4. Expiry and reauthentication handoff

P2-U2b exposes generic expired/invalid authentication outcomes. P2-U3/U4 own
reauthentication UI and transport: preserve unfinished incident drafts through
expiry and reauthentication, without submitting work under expired authority or
exposing it to a different signed-in identity/tenant. Fresh sign-in starts a new
lifetime; rotation never extends the original absolute deadline. Passive polling
must not keep an operational session alive. No UI behavior is implemented by a.
