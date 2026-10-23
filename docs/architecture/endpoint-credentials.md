# Endpoint credential lifecycle — P3-U2b

Status: completed with [B-01–07 evidence](../status/p3-u2b-evidence.md),
2026-10-16 (Asia/Manila, +08:00), controlled private development only.
The user's conditional approval of [sections 2–6, G02-01–10](../planning/p3-u2b-credential-contract-review.md)
is authoritative. This document records the verified implementation contract and scoped handoff.

OpenBao is the dedicated endpoint material provider: opt-in private Compose
service, pinned release/digest, verified TLS, persistent Raft, no host ports/UI.
Deployment alone initializes/unseals; owner-only ignored custody is never mounted
in runtime. Revoke initialization root after scoped administration. Worker has
installation-scoped create/read; cleanup has separate read/metadata/destroy.
HTTP/web/ordinary workers/observer/Asterisk have no provider credentials.

Operations commit queued intent before provider calls. Each exact operation owns
one generation and one CAS=0 version-1 key. Passwords are 32 random bytes as 64
lowercase hex characters; stable internal auth identity remains unchanged.
The provider adapter validates exact binding and format without returning material.
Provider calls have five-second deadlines and never occur in business transactions.
Durable operations track uncertain effects before they occur.

Acceptance and finalization authorize through the existing transaction authority
and node → extension inventory version port. One active operation per extension,
operator/action/key fingerprint tombstones and immutable generation ordinals fence
replay/concurrent resets. Final association/version/history/audit/result commit
atomically. Logout/expiry does not cancel accepted intent; canonical account,
permission/authentication-version changes do. Safe status reads are passive.

Use the existing committed-work-v1 queue with registered handlers and filtering
before claim. Credential claims also match the canonical operation installation
to the designated worker installation, so a worker cannot consume another
installation's intent. Six total attempts, exponential five-second backoff capped at 300
seconds, credential concurrency two; exhaustion requires explicit audited trusted
reconciliation of the same generation/key. No automatic fresh execution budget.
Exhausted cleanup also requires an explicit audited `cleanup-retry` command; its
previous attempt count remains in audit before a new finite counter is granted.

Never destroy associated history. Only terminal never-associated material at
least 24 hours old, exact ownership and affirmative dependency checks permits
trusted cleanup, bounded to 50 exact operations. Preserve provider metadata and
canonical tombstones and revisit late writes. P3-U5 owns actual applied/rollback
facts; unknown associated dependencies mean retained_dependency_unknown.

The approved review sections 5–7 define the ordering table, fixed errors, 30-day
full results with indefinite minimal tombstones and protected API. c receives safe
setup/reset/status and immutable operation recovery. P3-U5 receives exact generation
references and retained history, not authority for live activation/revocation.
No phone delivery, reveal, browser screens, live apply or calling is included.

## Caller intent and canonical operation IDs

The request's `operationId` is the caller's immutable key, scoped to canonical
operator/action. The accepted DTO returns `intentId` for that original key and
`operationId` for the server's canonical operation UUID. The provider path is
always derived from the canonical operation, never the caller's submitted UUID.
GET operation recovery uses the returned canonical UUID and requires its exact
originating operator/node/extension. If an acceptance response is lost, repeat
the exact POST with the original caller key and fingerprint to recover that UUID;
never allocate a new intent merely because the response was uncertain.

## P3-U3a disposable concurrency and renewal correction — 2026-10-20

Create-only KV-v2 ACLs may return 403 for a losing CAS-zero create after another
caller creates the path. `prepare` reconciles that write denial only through a
fresh exact version-1 binding/material read. Mismatched, inaccessible, missing or
destroyed generations still fail. Worker update authority remains absent.

Renewal success requires a renewable integral lease of 60–3600 seconds. A failed,
malformed or lost response does not advance the worker's renewal schedule. These
source changes passed disposable adapter/race and TLS fault checks; retained
owner/API integration was not rerun. Provider near-expiry 500 and measured
subsecond absolute-expiry overrun remain failed acceptance findings in the
[follow-up report](../status/p3-u3a-disposable-review-followup.md). No precise,
immutable server-wide 24-hour ceiling or retained deployment is established.

## Approved P3-U3a lifecycle follow-up — 2026-10-20

The [approved completion direction](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-approved-completion-direction.md)
authorizes local bounded same-token reconciliation and pre-maximum replacement
with conservative consumption controls. Preserve the one-hour initial runtime
lease, 86,400-second configured explicit maximum and failed-response rejection.
After transient failure, pause and independently validate remaining same-token
authority before resuming within the original conservative deadline; never infer
renewal success or extend authority from 500/malformed/lost replies. Invalid,
revoked or expired authority stops consumption. This is approved development,
not evidence of runtime integration or retained rollout. Endpoint/trunk isolation,
prior endpoint acceptance limits and documented provider failures remain intact.
