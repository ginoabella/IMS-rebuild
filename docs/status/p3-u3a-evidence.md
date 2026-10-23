# P3-U3a — trunks and gateways evidence

Status: **complete**, 2026-10-23 10:29 +08:00 (Asia/Manila). A-01–05 passed within the approved private-development
IP-peer scope. Parent P3-U3 remains incomplete; credentials and DIDs belong to b/c.

## Delivered acceptance

October 23, 2026 (+08:00), reported Enable-denial correction: the ordinary
development HTTPS ingress allowed POST but rejected PATCH, used by status and
edit actions. The integrated browser fixture used a different ingress, so its
passing CRUD checks did not cover this deployment restriction. The ordinary
ingress now allows PATCH and applies POST's exact-origin requirement to it.
The new real-listener regression in `scripts/check-platform-https.mjs` failed
against the old listener and passed after refresh. It proves valid-origin PATCH
reaches the protected route (401 without a session), while missing, foreign and
duplicate origins, bearer requests and unsupported methods remain 403.
`./dev platform-https-check` passed in full, as did focused ESLint/formatting;
backend live/ready returned 200. The refresh preserved existing records and
identities. Authenticated operator Enable retry remains a manual check; no user
trunk was changed by this verification.

| Criterion | Verified result                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | Real PostgreSQL trunk and provider/device gateway CRUD, canonical installation ownership, versions, actor audit, strict settings/auth/input validation, exact IPv4/IPv6 normalization, name/source collisions and cross-installation denial.                                                                                                                                  |
| A-02      | Operator-scoped idempotent creates, concurrent duplicates/name/source claims on independent A/B HTTP replicas, stale/no-op edits, forced audit rollback, reference/removal races, retained soft history and reuse by new UUID. Disabled references block removal; only provider links impose inbound direction.                                                               |
| A-03      | Actual production Next HTTPS/Chromium journey: protected sign-in return, PBX detail navigation, list/create/detail/edit, desired enable/disable, confirmed eligible removal, both gateway kinds, field retention, definite CSRF-denial recovery, stale canonical review, actionable blockers and exact lost-create retry. Keyboard, 320/390/768/1440px reflow and axe passed. |
| A-04      | Actual platform-cookie permissions, direct staff/anonymous/hostile-channel denial, CSRF/Origin checks, passive uncached reads and safe DTOs. Existing A/B logout, expiry, canonical-owner recovery, outage and private-ingress tests passed.                                                                                                                                  |
| A-05      | Offline desired management against unreachable `.invalid` PBX fixture names, with no PBX/provider/material consumer in the save path. No DNS lookup, registration, reload, apply or calls. Focused checks, affected regressions and the normal repository graph passed.                                                                                                       |

Stable [DTO/API and dependency handoff](../architecture/trunks-and-gateways.md)
and [operator guide](../runbooks/trunks-and-gateways.md) are published.

## Actual commands and results

| Command                                                 | Result                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./dev exec pnpm check:trunk-gateways`                  | Final run exit 0; catalog adapter, real PostgreSQL/API and actual HTTPS browser/platform acceptance passed.                                                                                                                                                                          |
| `./dev exec pnpm check:pbx-nodes --registry`            | Exit 0; PBX registry A-01–07, multi-replica/version/idempotency, audit/COMMIT response-loss and access regressions passed. Repeated within the normal graph.                                                                                                                         |
| `./dev exec pnpm check:extension-inventory --inventory` | Exit 0; inventory A-01–07, concurrent writes, pinned versions, rollback/HTTP/COMMIT loss, passive and qualified access regressions passed.                                                                                                                                           |
| `./dev check`                                           | Exit 0; normal lint/format/types/build/entrypoint/config graph, foundation, audit/outbox/durable workers, storage/identity/deployment and full shared-session/auth/browser/credential regressions passed. Includes the unchanged Redis issue/rotate/revoke response-loss assertions. |
| `./dev exec pnpm db:migrate`                            | Exit 0; deployment state complete; additive migration applied to ordinary development.                                                                                                                                                                                               |
| `docker restart myims-rebuild-dev-backend-1`            | Ordinary backend refreshed with verified code.                                                                                                                                                                                                                                       |
| `./dev platform-https-stop`, `./dev platform-https`     | Ordinary console refreshed with retained TLS/auth material; supervisor reports HTTPS ready.                                                                                                                                                                                          |
| `./dev platform-https-status`, `./dev health`           | Ready; backend live/ready HTTP 200, database and both Redis checks up.                                                                                                                                                                                                               |

The final ordinary console build excludes verification fixtures. Additional focused
lint/type/format and documentation checks accompany the implementation.

## Fixture boundaries and cleanup

The focused launcher uses Docker Node 22.23.3, real migrated PostgreSQL with the
runtime role, authenticated disposable Redis, two independent production Nest
replicas and the actual production Next app behind private HTTPS ingress. The
resource page and APIs are shipping code. Existing test-only session controls and
unfinished-note fixture remain isolated to the browser verification output.

Canonical PBX fixture nodes are seeded into the disposable database, including two
distinct installations. Their hosts are deliberately unreachable `.invalid` names.
A deployment catalog declares reserved ingress, and an adapter check covers the
union across installation profiles/aliases. These checks do not establish live PBX
coexistence, SIP traffic, apply, provider integration or voice readiness.

Fault boundaries are explicit: a real PostgreSQL CHECK rejects audit writes;
concurrent HTTP requests exercise actual locks/constraints; a committed HTTP response
is truncated before delivery; one browser request carries an injected invalid CSRF
proof and is rejected by the real backend. Service and session failures in inherited
checks use their existing real-service/proxy/control boundaries.

Final focused database `myims_session_7be568fab8f8` and Redis
`myims-session-check-f2b598045152` were removed and reported by the launcher. The
inventory regression removed database `myims_session_2b866664ecdb` and Redis
`myims-session-check-46b03a3f10f1`. A fatal intermediate Playwright callback left
owned database `myims_session_fbd05e42f73b`; it was explicitly terminated/dropped
and verified absent, with two orphan fixture processes stopped. Ordinary application
data, OpenBao, PBX configuration and the pending backup operation were preserved.

## Resolved verification findings

The initial new-service type import was corrected. Forty pre-existing formatting
failures involved archived documents and historical/machine evidence; explicit
formatter exclusions preserve their bytes. A pre-existing escaped quote lint issue
in hash-bound `review-captured-authority.mjs` is handled by a file-specific allowance
for that quote, with the rule otherwise active. All **67 consumed-bootstrap source
hashes** in `infra/backup/bootstrap-request.json` remain unchanged.

Intermediate fixture issues included startup under competing builds, the inherited
minute-based protected request budget, an ambiguous loading/validation locator and
self-removal of a running Playwright route handler. These were corrected and the
final focused run passed. Its protected fixture uses the existing inventory
one-second window; production limits are unchanged.

The focused resource selector reuses platform A/B/browser/session checks. Unrelated
draft-tenant and generic lifecycle assertions remain in the normal graph, which
passed in full; no assertion was deleted. In particular, the shared response-loss
assertion that failed under competing load passed unchanged in the normal run.

No production, live apply, credential selection, DID or backup/recovery acceptance
is inferred from this IP-peer feature.
