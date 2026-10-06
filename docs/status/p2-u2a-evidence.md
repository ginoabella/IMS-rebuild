# P2-U2a lifecycle verification evidence

Completed 2026-10-06 08:53 +08:00 (Asia/Manila). **A-01–07 passed.**
Requirement: [a A-01–07](../../context/feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md).
Approval: [scoped D-05/recovery review](../planning/p2-u2a-session-contract-review.md).
Contract: [lifecycle and durable fencing](../architecture/shared-session-lifecycle.md).
Operations: [settings and controlled recovery](../runbooks/shared-session-lifecycle.md).

## Environment and commands

Existing pinned Docker workspace and real PostgreSQL/PostGIS; actual deployment
and restricted runtime credentials. The trusted host launcher creates a uniquely
named authenticated Redis 8 container on the existing private network, with
bounded 128 MB/noeviction, AOF and an owned anonymous data volume. No production
Redis configuration/data is modified by failure/capacity checks. The suite owns
one uniquely named `myims_session_` database and two or more independent OS
processes. Private fixture stdin/IPC conveys secrets, never URLs or logs.

- Prerequisite `./dev exec pnpm check:identity-foundation --authority`: passed,
  exit 0, before implementation.
- Final focused `./dev exec pnpm check:session-foundation --lifecycle`: passed,
  exit 0, including physical TTL expiry, audited bounded maintenance and real
  PostgreSQL fence COMMIT-response loss.
- Final `./dev check`: passed, exit 0; includes workspace lint/format/typecheck/builds,
  existing foundation/durability/storage/identity suites, five client scans,
  isolated provider checks and the final lifecycle selection.

Local `./dev exec pnpm db:migrate` passed, exit 0; `/health/live` and
`/health/ready` returned HTTP 200. CI has an explicit isolated lifecycle step;
hosted CI is not executed locally. Local deployment contains seven migrations,
zero session fences/identities and zero leftover session fixture databases.
Final source/fixture lint, formatting, lifecycle/new-handoff links and whitespace
passed. Six unchanged repository-root-style source links in the implementation
plan fail a file-relative checker; this pre-existing unrelated documentation
issue is recorded in the tracker, without changing lifecycle acceptance.

## Acceptance mapping

| ID   | Implemented observable checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01 | Approved web 60-minute/12-hour and mobile 24-hour/7-day policy; successful operational activity only; finite defaults/ceilings and invalid configuration checks. Strict ports/errors, primary UTC time, audited fence migration/grants/retention, controlled recovery and unrelated gates are documented.                                                                                                                                                                                                                                                                            |
| A-02 | Independent trusted issuance creates distinct 32-byte random tokens, canonical version mismatch conflicts and mixed-plane supplied facts deny. Redis holds only hash lookup keys and bounded no-role records. Malformed/oversized/noncanonical tokens, unknown schema/fields, mixed planes, invalid versions/deadlines and oversized stored values deny. Captured errors/log/audit and client sentinel scans exclude private material.                                                                                                                                               |
| A-03 | Retained no-TTL records at idle/absolute deadlines deny independently. Redis TTL bounds, successful renewal and original creation/absolute preservation, near-absolute cap, denied/failed/unavailable/passive activity and missing records are checked. Owner-only fixture deadline edits do not become product settings.                                                                                                                                                                                                                                                            |
| A-04 | Hold the actual PostgreSQL lineage lock and observe two independent processes waiting before releasing them. Rotation returns one winner/one tokenless conflict; old tokens deny. Renewal/revocation races settle with revoked authority, late renewal/rotation cannot revive it and duplicate revocation is idempotent.                                                                                                                                                                                                                                                             |
| A-05 | Real Redis write-response-loss proxies let EVAL/DEL execute, suppress responses and confirm durable/Redis effects; issuance/rotation/revocation return unavailable without tokens. Stalled commands are bounded by actual connection teardown. Real noeviction OOM rejects issuance/renewal/rotation. Wrong authentication denies initialization; primary outages deny lookup/issuance/renewal. Real Redis shutdown/restart recovers retained valid records and leaves missing records absent. Real PostgreSQL mutation COMMIT-response suppression and typed cleanup checks passed. |
| A-06 | Capture actual Redis records before rotation/revocation and restore their exact bytes under live current PostgreSQL fences. Both independent processes reject them before returning usable authority, including restored revoked predecessors after actual Redis restart. Missing fence, generation mismatch and unavailable primary authority deny/reject access. Other device lineages remain usable; interrupted primary authority gates recovery.                                                                                                                                |
| A-07 | Fresh/rerun migration, actual restricted grants/early-delete/revival/TRUNCATE rejection, atomic required-audit failure rollback, independent precommit OS interruption, bounded retention maintenance and precise owned-resource teardown. Full Docker checks, final focused selection, all five client artifact scans and runbook/handoffs passed.                                                                                                                                                                                                                                  |

## Corrections and controlled limits

Initial fixture failures were a sentinel assertion that incorrectly searched for
single-digit values inside safe bound messages, inherited credential-file
precedence during disposable migration, and a stalled Redis command whose native
abort signal did not finish the response-loss fixture. Fixed the assertion and
private fixture environment, and added explicit bounded connection teardown to
Redis initialization/commands. No failed run is counted as passing acceptance.

The PostgreSQL fence persists only lifecycle UUID, generation, revoked state and
immutable absolute deadline. Existing transaction/audit mechanics record safe
operation facts; cleanup records only bounded removed count. It never stores
tokens, lookup hashes, canonical identity payloads or credential material.

Controlled Redis restoration assumes current primary PostgreSQL metadata.
A simultaneous rollback of both stores needs separately controlled global
invalidation before traffic, and production HA is not claimed. Previously
validated in-flight operations require b's transactional authority boundary.
This proves lifecycle primitives only; no protected HTTP/sign-in/logout UI,
limiter policy, cookies/CSRF, mobile storage or parent completion is established.

P2-U3/U4 receive the required expiry/reauthentication handoff: preserve unfinished
incident work with identity/tenant isolation while requiring fresh sign-in and
blocking expired submissions. Its user-facing behavior needs owning-unit tests.
