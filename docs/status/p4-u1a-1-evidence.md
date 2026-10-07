# P4-U1a-1 — Atomic draft registry API evidence

Completed 2026-10-07 13:50 +08:00 (Asia/Manila). Final focused A-01–08 and required full regression graph passed, exit 0.

The [API contract](../architecture/draft-tenant-registry-api.md) defines the
routes, safe DTOs/errors, activity classification, retention and browser handoff.
No browser journey or parent completion is claimed by this backend unit.

| Acceptance | Real-service proof                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01       | Actual production Nest module on two independent HTTP processes; platform-cookie principal, primary create/list/detail, canonical draft/active/unset states, null verifier/change time, initial versions, immutable receipt and exactly two owner creation audits sharing canonical operator and correlation.                                                                                                                                                     |
| A-02       | Raw/canonical identifier and UTF-16 name bounds, trim/ASCII case normalization, malformed surrogate/control/JSON/body denial, unknown actor/status/roles/tenant/password fields; code collision across all four statuses; immutable code/ownership, distinct tenant IDs sharing administrator username; restrictive receipt grants and qualified FK.                                                                                                              |
| A-03       | PostgreSQL CHECK fault injection at staff/receipt/staff-audit writes and a tenant-audit unique failure that must return 503; exact tenant/staff/receipt/creation-audit counts unchanged on failure and same-attempt retry after rollback. Same backend PID, independent root/child targets, expired/unawaited handles and shared poison after a caught required failure; missing tenant rejects staff scope. Existing consumers run in the full regression graph. |
| A-04       | Hold the receipt table with an owner-only SHARE lock, observe independent process waits through refreshed pg_stat_activity, then release. Identical attempts produce 201/200 with identical IDs; changed canonical input under one request and different same-code requests produce one 201 and one 409. Foreign operator cannot adopt the receipt. Exactly one pair/receipt/two audit facts commit in each race.                                                 |
| A-05       | Destroy actual HTTP response after committed headers; explicitly retry on another process. A PostgreSQL frame proxy lets receipt creation commit but suppresses actual CommandComplete(COMMIT), proving 503 and durable outcome; process replacement and explicit retry return original IDs without repeat writes/audit.                                                                                                                                          |
| A-06       | Actual named backend consumers deny absent/expired/tenant-plane sessions, invalid CSRF/exact Origin/proxy/source, shared-policy mismatch/limit and real connected Redis/database outage. Hold operator mutation before SHARE validation to reject stale authority without writes; hold receipt insert after authority lock to prove disable waits behind commit.                                                                                                  |
| A-07       | Canonical live name/status/roles reads; UUID-keyset stable ordering and complete pagination, default 25/maximum 100, malformed/missing IDs, explicit unavailable provenance. Owner SELECT revocation yields 503 instead of empty/missing success. Private verifier/input/fingerprint/session/CSRF sentinels are excluded from DTOs, audit and independent process logs.                                                                                           |
| A-08       | Canonical owner admission rejects newly saved draft/unset administrator; session issuance rejects without a fence or usable session. No outbox/PBX/activation/setup effect. Handoff is the exact tenant-qualified administrator ID from the receipt.                                                                                                                                                                                                              |

The focused check uses a disposable migrated PostgreSQL database under the real
runtime role, an isolated authenticated persistent Redis container, production
HTTP module wiring, independent Node processes, database barriers and protocol
fault proxies. Trusted fixture issuance supplies controlled platform/staff
sessions; actual credential sign-in and browser/session regressions remain in the
existing integrated regression graph. No production issuer is exposed.

The outer harness tears down only its exact database, Redis container, private
configuration directory, processes and sockets. Receipt protection remains in
force; fixture teardown drops its owned database rather than deleting receipts.
HTTP never migrates. Migration `20261007000000_draft_tenant_receipts` adds only the
qualified staff key and immutable platform receipt with SELECT/column INSERT
grants; tenant UUID primary key supplies bounded registry ordering.

## Command results

- `./dev exec pnpm check:draft-tenant --api` — passed A-01–08 and private diagnostic scans, exit 0.
- `./dev check` — passed on the final implementation, exit 0. This graph owns the existing
  identity/bootstrap, transactional audit/outbox, worker/storage, platform
  HTTP/browser, complete session/admission/recovery regressions and the new API.
- `./dev exec pnpm check:identity-foundation` — passed complete storage, authority and bootstrap recovery checks, exit 0.
- `./dev exec pnpm db:migrate` and `./dev health` — additive local deployment passed, exit 0; liveness/readiness 200 with database and both Redis services up.
- Backend lint, launcher syntax and whitespace checks passed during implementation.

Earlier focused iterations exposed PostgreSQL statistics snapshot retention and
fixture limiter-policy mismatch; both test harnesses were corrected while keeping
production locking/admission behavior. A Redis outage fixture was changed to
interrupt an already connected service so HTTP remains available to prove denial.
The first full graph also exposed an identity history assertion still expecting seven migrations; it now expects eight. The final focused API/identity and full Docker runs passed, superseding those incomplete iterations.

## Handoff and limits

Child 2 consumes POST/GET `/platform/tenants` and GET
`/platform/tenants/:tenantId`, preserves attempt UUID/input for explicit retry and
uses existing owner-isolated reauthentication. It must add its declared Next
forwarding/browser journey and verify the complete parent matrix. Reads are
passive; create is operational. This check establishes backend/database behavior,
not browser accessibility or production HA/capacity. Credentials/staff sign-in
remain P2-U4, organization settings P4-U1b, activation P4-U3 and PBX its own units.
