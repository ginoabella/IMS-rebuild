# P2-U4a — Credential lifecycle acceptance evidence

Status: complete, 2026-10-08 00:18 +08:00 (Asia/Manila). A-01–08, focused API/HTTPS lifecycle, all 10
existing UI regressions and final `./dev check` passed, exit 0.

Policy: [approved G-01–06](../planning/p2-u4a-credential-contract-review.md).
Implementation: [qualified credential lifecycle](../architecture/qualified-credential-lifecycle.md).
Procedure: [staff handoff guide](../guides/staff-credential-handoff.md).
Operations: [lifecycle runbook](../runbooks/staff-credential-lifecycle.md).

## Acceptance coverage

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01      | Explicit user approval of the recommended issuer/state matrix, draft-ready recovery exception, exact password policy, expiry/reissue/cancel, verified-person handoff, independent budgets and retention; scoped D-05/D-06 updates.                                                                                                                                                                                                                           |
| A-02      | Actual protected HTTP draft creation and immutable qualified linkage; exchange stores coherent exact-byte scrypt credentials/authentication version 2, preserves draft status and ordinary canonical admission denial. Actual production HTTPS operator create/detail/issue and recipient keyboard exchange also passed, with no ordinary staff cookie.                                                                                                      |
| A-03      | Operator linked-administrator qualification; sole-ready-admin recovery; authorized existing-session tenant issuer; self/foreign/wrong-plane and hostile selector/enum rejection; issuer role/version changes fence outstanding actions.                                                                                                                                                                                                                      |
| A-04      | Exact password boundaries/Unicode, expiry, single use, cancellation and explicit reissue; status cannot redisclose codes; actual bounded hasher saturation, shared source/issuer/target/capability limits (including unknown staff cancellation across A/B without mutable lookup), allocation ceiling and Redis response loss.                                                                                                                              |
| A-05      | Independent production Nest replicas with actual PostgreSQL/runtime grants and Redis; controlled hash/commit barriers exercise concurrent exchange, cancellation, reissue and suspension. Required audit/SQL/hash failures roll back. Physical precommit process kill leaves credentials unchanged and action pending. Lost issue/exchange COMMIT responses return unavailable and reconcile through canonical status/explicit reissue.                      |
| A-06      | Failed replacement preserves old credentials and session authority; committed reset advances version and invalidates preexisting web/mobile records on both replicas, including real restoration of saved Redis records.                                                                                                                                                                                                                                     |
| A-07      | Declared separate HTTPS exchange/staff cookie/CSRF/proxy/Origin boundaries; actual operator/recipient and existing-session staff issuer browser owner isolation, keyboard labels/focus, Axe, 1440/768/390/320 reflow, lost-response uncertainty without replay, page-hide secret clearing, late disclosure fencing and browser-storage/URL/diagnostic exclusion passed.                                                                                      |
| A-08      | Backend/web compilation, repository lint/format/typechecks, six configuration tests (including credential consumer isolation), all production builds and all 10 existing UI regressions passed; full Docker runtime regressions passed, exit 0, including audit/outbox/worker recovery, storage/identity/bootstrap, session/limiter/platform/draft HTTP and HTTPS browser checks and all five shipping-client scans. Guide/runbook and b/c handoff recorded. |

## Verification commands

- `./dev exec pnpm check:staff-auth --api`: focused real PostgreSQL/runtime-grant,
  Redis and independent HTTP-replica lifecycle acceptance.
- `./dev exec pnpm check:staff-auth --lifecycle`: the API matrix plus actual
  temporary HTTPS production Next operator/recipient and staff issuer checks; passed, exit 0.
- `./dev exec pnpm check:ui`: all 10 existing production UI/return-path tests passed, exit 0.
- `./dev check`: required lint/format/types/builds/config/entrypoints,
  foundation/audit/worker/storage/identity/bootstrap and deployment/session/
  platform/draft regressions, lifecycle checks and all five client scans; passed, exit 0. The final combined run also verified the new password boundaries and unknown-cancel budget checks.

Tests avoid secret-bearing screenshots/traces, retain only safe diagnostics, and
remove owned disposable databases, authenticated Redis containers and temporary
HTTPS listeners/certificates. Earlier development iterations corrected fixture
clock coherence, tenancy version snapshots, process-kill cleanup and bounded
barrier waits. Browser access restoration, uncertain-response feedback, stable mounted issuer
recovery across canonical detail reloads, bounded response streaming, target-change
disclosure clearing, page-hide secret clearing and staff heading semantics were
hardened before the passing focused run. The harness respects Retry-After and
reports only safe accessibility rule IDs on failure.

## Scope and handoff limits

The tenant-admin issuer browser uses controlled existing-session fixtures.
P2-U4b adds real staff sign-in/logout and draft/old-password sign-in denial;
P2-U4c integrates the protected command-center shell, real issuer access and native
storage/device verification. Parent P2-U4 remains incomplete.

Temporary automated HTTPS acceptance does not configure a persistent recipient
origin on this installation. Follow the runbook for complete declared consumer
configuration. Existing user-owned private platform HTTPS services are retained.
No activation, PBX, incident draft, general staff-management, email/SMS delivery,
public self-service recovery or ordinary staff session issuance is added.
