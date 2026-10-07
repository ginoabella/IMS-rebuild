# P4-U1a-2 — Operator browser and integrated parent evidence

Status: complete, 2026-10-07 16:00 +08:00 (Asia/Manila). B-01–08,
child 1 A-01–08 and parent AC-01–11 passed. All required final commands exited 0.

The [browser contract](../architecture/draft-tenant-browser.md) documents the
named forwarding boundary, owner/epoch fencing, mounted recovery lifetime and
exact selectors. The [operator guide](../guides/draft-tenant-creation.md) explains
how to try the protected workflow and its later credential/activation handoff.

## Acceptance coverage

| Child criterion | Implemented real-service verification                                                                                                                                                                                                                                                                                                                                                                                           | Parent coverage           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| B-01            | Production Next/HTTPS, real provisioned scrypt operator sign-in, two independent production Nest HTTP modules, runtime-granted PostgreSQL canonical draft/admin/linkage/two creation audits; detail/list and cross-replica refresh.                                                                                                                                                                                             | AC-01, AC-08              |
| B-02            | Local bounds/grammar, positive 64/128/200 limits and focus without input loss; real backend field rejection/focus; duplicate code and distinct tenant-qualified administrator IDs sharing username; unknown actor/status/role/tenant/password fields.                                                                                                                                                                           | AC-02, AC-03              |
| B-03            | Consecutive submission events yield one pending write. HTTPS ingress truncates a real committed 201; exact original UUID/input explicitly retries on the other replica, one receipt/two audits, no edited replacement. Same-owner reauthentication and client navigation preserve attempt without automatic replay.                                                                                                             | AC-05, AC-06              |
| B-04            | Real Next consumers reject absent/tenant-plane sessions, foreign Origin/invalid CSRF/bearer override, unknown parameters/duplicates/unbounded pagination and arbitrary destination. Direct private listener with absent/forged ingress/source/proxy/actor/role headers fails closed. Child 1 retains canonical transaction/authority races.                                                                                     | AC-07                     |
| B-05            | Actual connected session Redis pause crosses its command deadline; backend outage hides/blocks work. Same-owner expiry recovery retains values/attempt, foreign owner/logout clears them. HTTP proxy holds real committed mutation/read responses across owner switch; only fresh authorized canonical reads may present saved state. Existing protected overlay/logout/tab/expiry regressions run on production HTTP replicas. | AC-09, AC-06              |
| B-06            | Actual 25-row browser pagination, max-100 API bounds and UUID order; exact owned unlinked pagination fixtures removed after the first read to yield a genuinely empty next page. Missing UUID detail, unavailable provenance and owner-only SELECT revocation return distinct safe outcomes; restored access reloads canonical data. Protected cache headers/passive session checks remain covered.                             | AC-08                     |
| B-07            | Semantic form/table, keyboard Enter, local and backend error focus, Axe and retained list/detail/form images at 1440/768/390/320 widths and CSS 200% zoom. No browser storage values, credentials/setup/activation/PBX controls. Shipping bundle/private diagnostic scans and all five client scans passed.                                                                                                                     | AC-10, AC-11              |
| B-08            | A-01–08 rollback/race/ambiguous-commit/admission regressions, complete identity/bootstrap/audit/session/platform checks, literal safe-return/UI regressions and final full graph.                                                                                                                                                                                                                                               | AC-01–11, including AC-04 |

The browser results above passed on the final combined, standalone and full runs.
Parent AC-04 is established by child 1's real same-connection fault/rollback tests;
AC-05/06 combine its race/COMMIT-loss proof with the actual browser recovery path.
This child makes no credential setup or ordinary staff HTTP sign-in claim.

## Commands and observed results

- `./dev exec pnpm check:draft-tenant --api`: passed A-01–08 and independent
  diagnostic scans, exit 0.
- `./dev exec pnpm check:draft-tenant --browser`: passed B-01–07, existing
  console regressions and diagnostic scans, exit 0. Initial iterations
  found the old authentication-only HTTP fixture lacked tenant routes; browser
  checks now start production `HttpModule` replicas. Corrected a fixture UUID/text
  audit comparison and replaced a Playwright delayed-response control with the
  actual HTTP proxy. Backend error focus now waits for inputs to re-enable.
  A passive expiry timing race in the harness now triggers the existing
  page-return check instead of clicking a form that may already be hidden.
- `./dev exec pnpm check:draft-tenant`: passed A-01–08, B-01–07, existing
  production platform browser regressions and diagnostic scans, exit 0.
- `./dev check`: full required graph passed, exit 0: lint/format/types, all
  production builds, entrypoints/config, audit/outbox/worker recovery, storage,
  identity/bootstrap, all five client scans, deployment and complete HTTP/platform
  HTTPS browser/session/limiter/draft API regressions.
- `./dev exec pnpm check:ui`: all 10 production UI/safe-return tests passed, exit 0.
- Focused console typecheck, source/harness lint, formatting and launcher syntax
  passed during implementation and again in the final full graph.

Earlier long tool sessions ended with signal status 143 during the lifecycle
suite; they were not recorded as successful. The final serial supervisor retained
individual command exit statuses and logs independently of the tool session and
completed the unchanged full graph with exit 0. Browser build deadlines now stop
the entire owned compiler process group, preventing orphan builds after timeout.
Local retained backend live/ready returned 200; database and both Redis checks were up.

## Fixture cleanup and limits

The existing outer launcher creates a disposable migrated database under the real
runtime grants and an isolated authenticated persistent session Redis container.
Its exact database/container/private temporary configuration, process groups and
sockets are removed in `finally`. HTTP never migrates or receives deployment
credentials. Fault response gates release on teardown. SELECT grants restore in
`finally`; empty-page deletion targets only exact fixture UUIDs with no receipt or
staff linkage. Receipt protection remains enforced; database teardown drops the
owned fixture database rather than deleting receipts. Final checks left no owned
session fixture containers or verification processes. Normal shared service data,
operator credentials and development CA/TLS/authentication material are retained.

Non-shipping production verification output stays under ignored
`apps/platform-console-web/.local/platform-auth-next`; review snapshots are under
ignored `.local/ui-review/draft-*`. The normal output excludes the verification
work form. TLS/fault controls prove a controlled local HTTPS and two-process
boundary, not production hosting, backing-service HA, traffic/capacity or staff
credential delivery. Unfinished work lasts only while mounted memory survives;
saved canonical tenants/linked administrator IDs remain durable.

P2-U4 owns tenant-qualified credential delivery/expiry/recovery/draft setup access,
P4-U1b owns later onboarding UI and P4-U3 owns activation/readiness including the
explicit voice-disabled path. Credential setup does not activate a tenant.
P4-U1 and Phase 2 remain incomplete until their separate required work passes.
