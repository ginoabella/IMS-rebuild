# P4-U1b-3 implementation and acceptance evidence

Status: complete within approved private development, 2026-10-29
(Asia/Manila, +08:00). C-01–07 and integrated parent AC-01–11 passed; child 3,
P4-U1b and P4-U1 are complete within this scope.

## Delivered contract

Tenancy persists explicit `not_configured|enabled|disabled` preference, defaulting
existing/new tenants to not configured. Draft-only voice writes use the existing
protected section command, canonical operator → immutable attempt → tenant locks,
both expected versions, atomic owner audit and immutable safe receipt. The mounted
editor preserves independent section work, fences owner/target callbacks and only
recovers uncertain writes through explicit original retry. Detail separately shows
lifecycle, saved preference, geographic/contact completeness and safe linked
administrator state. Detail/access refresh requests safe credential action state
and clears one-time disclosure; each issue/reissue consumes its verification
acknowledgment. Credential callbacks are fenced across refresh/access generations.

Preference writes preserve credentials, admission, authority version, allocation,
PBX resources, live routes and readiness. Existing immutable administrator linkage,
issuer/recipient transport and approved P2-U4 credential recovery remain authoritative.

## Acceptance reconciliation

All following criteria passed in the controlled private development environment.

| Criterion | Verified result                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Additive default/CHECK/runtime grant; strict enum/extra-field rejection; canonical detail; actual HTTPS independent choice/save/reload. Existing and new drafts start not configured.                                                                                                                                                                                             |
| C-02      | Real A/B voice/cross-section and held version/status/authority races; actual runtime update/audit/receipt grant failures and rollback; concurrent original attempt; lost HTTP response and COMMIT acknowledgment; original receipt versus newer detail; foreign adoption denied.                                                                                                  |
| C-03      | Production HTTPS create → search/filter/resume → contacts → actual prepared Naga geography/default → voice → initial setup → pending-action-preserving voice saves → recipient exchange → status/detail reload. Saved and unrelated unsaved work survives. Existing lifecycle matrix passes ready-draft recovery, invalid target/provenance/role/status/action and shared limits. |
| C-04      | Verification acknowledgment consumed per attempt; refresh/access generation fence; owner/target/unmount clearing; issuance/exchange uncertainty and secret exclusion checks pass. Contacts remain informational without delivery or verification bypass.                                                                                                                          |
| C-05      | Unset and ready draft administrators receive `Invalid credentials` without ordinary sessions. Voice changes preserve draft lifecycle and administrator/configuration fields; setup and opt-out confer no activation or PBX readiness.                                                                                                                                             |
| C-06      | Combined HTTPS journey plus original registry/geography negative, authority/outage/conflict, keyboard/focus, 320–1440px reflow/zoom/axe, uncertainty and owner/target tests pass. Original creation/code/provenance/replay remain verified.                                                                                                                                       |
| C-07      | Every parent criterion below reconciled. Focused API, combined API/HTTPS, affected credential lifecycle and full repository checks pass; operator/downstream contracts published. Final normal runtime reconciliation is recorded below.                                                                                                                                          |

| Parent criterion | Final evidence                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01            | Child 1 A-01–07 consumers rerun: search/filter/pagination/resume and actual integrated find/resume journey.                                                              |
| AC-02            | Versioned name/contact edits, canonical validation, independent unsaved work and immutable normalized code, including batched adjacent contact edits.                    |
| AC-03            | Child 2 B-01–07 rerun against real PostGIS: prepared Naga uploads/confirmation, canonical default/axes, topology, exact caps/precision, clear and qualified intake read. |
| AC-04            | Explicit persisted three-state voice preference; only enabled/disabled are writable, without readiness or PBX effects.                                                   |
| AC-05            | A/B section/version/status/authority races and actual grant rollback protect atomic configuration/audit/receipt state.                                                   |
| AC-06            | Lost HTTP/COMMIT acknowledgment, concurrent exact retry, original receipt versus newer canonical detail and foreign-attempt conflict; explicit recovery only.            |
| AC-07            | Linked issuer/recipient exchange and refreshed safe action status, independent saved/unsaved configuration, ready-draft reset and existing approved recovery.            |
| AC-08            | Unset/ready draft sign-in denial without ordinary sessions or activation; credential/configuration status remains separate from lifecycle.                               |
| AC-09            | Existing auth, CSRF, Origin, proxy, dependency-outage and malformed/forged-input denial matrices rerun for real consumers.                                               |
| AC-10            | Owner/target/unmount/delayed-callback fencing, nonsecret work isolation, keyboard/focus, 320–1440px/zoom and axe checks.                                                 |
| AC-11            | Original create/provenance/replay unchanged; operator guide, downstream voice/geography contracts, regression checks, preservation and owned cleanup.                    |

Prerequisites remain the completed [child 1 evidence](p4-u1b-1-evidence.md),
[child 2 evidence](p4-u1b-2-evidence.md), [P4-U1a](p4-u1a-2-evidence.md),
[P2-U4](p2-u4c-evidence.md) and [Phase 3 handoff](p3-u5c-evidence.md).
The final full graph reruns their affected actual consumers.

## Commands and results

Acceptance uses the supported Docker workspace, pinned Node/pnpm, real migrated
PostgreSQL/PostGIS/runtime grants, isolated authenticated shared Redis, independent
HTTP replicas and production Next/private HTTPS browser. Faults and barriers exist
only in script fixtures with owned disposable stores.

| Command                                                                             | Result and local execution record                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm --filter @myims/contracts build`                                   | Passed.                                                                                                                                                                                                                                                                                                 |
| `./dev exec pnpm build:backend`                                                     | Passed.                                                                                                                                                                                                                                                                                                 |
| `./dev exec pnpm --filter @myims/platform-console-web typecheck`                    | Passed.                                                                                                                                                                                                                                                                                                 |
| `./dev migrate`                                                                     | Passed, exit 0, both additive migrations applied normally. `/tmp/p4-u1b-3-migrate.log`, `/tmp/p4-u1b-3-migrate-final.log`.                                                                                                                                                                              |
| `./dev exec pnpm check:draft-tenant --onboarding-api`                               | Passed after final validator migration, exit 0. `/tmp/p4-u1b-3-api-final.log` and `.exit`.                                                                                                                                                                                                              |
| `./dev exec pnpm check:draft-tenant`                                                | Passed, exit 0. Combined real API/HTTPS prior-child and voice matrices. `/tmp/p4-u1b-3-combined.log` and `.exit`.                                                                                                                                                                                       |
| `./dev exec pnpm check:staff-auth --lifecycle`                                      | Passed, exit 0. Expanded integrated HTTPS journey, credential/session recovery and draft denial. `/tmp/p4-u1b-3-lifecycle.log` and `.exit`.                                                                                                                                                             |
| `./dev platform-https-stop` / `./dev platform-https` / `./dev platform-https-check` | Refreshed; final status ready and transport passed, exit 0. `/tmp/p4-u1b-3-platform-transport.log` and `.exit`.                                                                                                                                                                                         |
| `./dev staff-https-stop` / `./dev staff-https-start` / `./dev staff-https-check`    | Refreshed; ready and transport passed, exit 0. `/tmp/p4-u1b-3-staff-transport.log` and `.exit`.                                                                                                                                                                                                         |
| `./dev check`                                                                       | Passed after final source/migration changes, exit 0. `/tmp/p4-u1b-3-full.log` and `.exit`. Includes formatting/lint/types/builds, foundation/storage/identity, deployment/secret checks, platform/staff/session/credential recovery, original draft/editing/geography/voice API/HTTPS and PBX registry. |

The onboarding selectors select the extended focused API/browser matrices; the
combined command and full graph run those same consumers. No separate successful
standalone browser command exit is claimed. Detached sequential runners recorded
independent exits; no parallel-build fixture timeout is treated as a pass.

## Findings corrected before final acceptance

Actual HTTPS testing exposed render snapshots overwriting the synchronous mounted
work ref during adjacent contact edits. Configuration/geography editors now advance
that ref through initialization/patches and merge inputs with current work. A batched
adjacent-field browser regression passes. The strict Next forwarding allowlist now
includes only the named voice section/field; actual HTTPS forged-input checks pass.
Browser upload fixtures wait for canonical reload to enable their controls.

The first full run hit the existing 2-second geography CHECK statement timeout at
1,000 valid features. Additive migration
`20261029010000_tenant_geography_validation_cost` caches original geometry features,
streams metadata with ordinality and validates identical municipality metadata once.
It retains every ONB-02 predicate, original feature identity/order, 4,096-position
and 1,000-feature caps and the same timeout. Direct corrupted final-feature metadata,
extra keys, differing municipality, duplicate ID and invalid label regressions pass.
The final focused API and complete graph passed after this migration. No previously
applied migration was edited. Early forwarding/selector/fixture and timeout failures
are superseded by the final recorded runs, not omitted from the diagnosis.

## Preservation and handoff

Both additive migrations were applied normally. Platform and staff HTTPS were
refreshed with final compiled code and report ready; both supported private HTTPS
transport checks passed, exit 0. Backend in-container live/readiness returned 200.
The backend's loopback-only listener is checked from its own container; bindings
were not widened for cross-container health tooling.

Final counts/logical row digests match the pre-migration baseline for all six
normal tables: tenants (excluding only the new voice column), staff, operators,
creation receipts, edit receipts and geography. All four normal tenants have
`not_configured`. All five retained HTTPS-file hashes match. Original Naga
administrative/barangay source SHA256 values remain
`8c547ef3c124117cb531089c7f403afc3ebdc0a86115a7834de85eee0d9463ab` and
`c2fdc0b680ccacc4cd26b8ca06aa13a3a8013db5471fb09b85d65b7bd24b16ee`.

Owned acceptance containers/databases/processes were cleaned up. The normal
`myims` database and pre-existing unclaimed `myims_session_426486cb1209` were
retained; no unrelated service, identity or database was removed. Temporary
validator probes used rolled-back transactions and temporary functions only.
During normal refresh, starting before the old platform shutdown completed removed
the replacement control socket. The exact task-owned replacement was stopped;
a restart after complete shutdown restored the supported control endpoint.
Final platform status and transport passed; no helper code or TLS was changed.

Final local runtime records: `/tmp/p4-u1b-3-platform-refresh-final.log`,
`/tmp/p4-u1b-3-platform-transport.log` and `.exit`,
`/tmp/p4-u1b-3-staff-transport.log` and `.exit`, and
`/tmp/p4-u1b-3-preservation-after-final.txt` compared with the captured baseline.
The current tracker removes child 3 from in progress and records scoped parent
completion; intermediate results remain in tracker history.

[Operator procedure](../runbooks/tenant-configuration.md#voice-preference-and-administrator-handoff--p4-u1b-3)
and [voice downstream contract](../architecture/draft-tenant-registry-api.md#p4-u1b-3-voice-preference-contract)
define explicit choice/recovery and P4-U2/U3 gates. P5-U4/U5 retain the
[qualified canonical geography contract](../architecture/tenant-geography.md).
P4-U2/U3 allocation/readiness/lifecycle, P4-U4/U5 administration and the Phase 4
gate remain incomplete. These controlled Docker/private HTTPS results establish no
live Asterisk call, new native-device acceptance, operational intake, production HA
or general lifecycle/administration readiness.
