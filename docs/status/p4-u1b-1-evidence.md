# P4-U1b-1 — Registry editing and contacts evidence

Status: complete within approved private development, 2026-10-27 09:23
(Asia/Manila, +08:00). A-01–07 passed. Parent P4-U1b/P4-U1 remain incomplete.

The user explicitly approved ONB-01/03 for this name/contact workflow. See the
[parent policy](../../context/feature-specs/p4-u1b-tenant-onboarding-configuration.md#approved-onb-0103-policy--2026-10-26-0800).
The [feature spec](../../context/feature-specs/p4-u1b-1-resumable-registry-editing-and-contacts.md)
owns acceptance; [registry contract](../architecture/draft-tenant-registry-api.md),
[browser contract](../architecture/draft-tenant-browser.md) and
[operator procedure](../runbooks/tenant-configuration.md) describe implementation.

Delivered implementation includes literal code/name search, exact lifecycle filters,
UUID pagination, tenancy-owned optional contacts, draft-only explicit section saves,
row/authority checks, canonical actor audit and separate immutable edit outcomes.
A global attempt UUID binds operator, target, section, expected versions and
canonical-input fingerprint. No contact values enter receipts or audit. Creation
provenance and initial administrator remain immutable. Mounted owner/target/epoch
captures fence callbacks; uncertain writes require explicit original retry.

## Verification

- `./dev exec pnpm build:backend`: passed, exit 0.
- `./dev exec pnpm typecheck`: passed, exit 0.
- Focused ESLint over changed platform/tenancy/contracts/browser/scripts: passed.
- `./dev exec pnpm check:draft-tenant --onboarding-api`: passed, exit 0;
  existing registry A-01–08 and the new editing matrix on real PostgreSQL/runtime
  grants/shared authenticated Redis and independent production Nest replicas.
- `./dev exec pnpm check:draft-tenant --onboarding-browser`: passed, exit 0;
  real production Next/private HTTPS/A/B API journey, including original registry
  and platform browser regressions. The 320/390/768/1440px screenshots, 200% zoom
  and axe checks passed. The 320px editing screenshot was visually reviewed.
- `./dev exec pnpm check:staff-auth --api`: passed, exit 0, including pending
  administrator setup → name/contact edits → actual exchange, retained tenant
  authority, canonical draft admission denial, A/B races, physical interruption,
  audit/hash/COMMIT loss, shared budgets and retention regressions.
- `./dev migrate`: passed, exit 0; deployment-owned
  `20261026000000_tenant_configuration` applied to the ordinary development database.
  Pre/post logical hashes match for original tenant fields, staff, operators and
  immutable creation receipts; new contact columns are excluded from the old-field
  hash. No ordinary tenant configuration write was made by this check.
- Final serial `./dev check`: passed, shell exit 0 recorded independently in
  `/tmp/p4-u1b-1-full-check-final.exit`; log
  `/tmp/p4-u1b-1-full-check-final.log`. All lint/format/typecheck/app builds,
  foundation/durability/storage/identity, five client secret scans, deployment,
  integrated session/API/browser, credential lifecycle and PBX registry checks passed.
  The default graph executes the same registry and credential lifecycle API/browser
  consumers as `check:draft-tenant` and `check:staff-auth --lifecycle`, including
  the new filtered pagination and uppercase UUID regression cases.
- `./dev platform-https-stop` followed by `./dev platform-https`: ordinary console
  refreshed and ready with retained TLS/authentication material and shared stores.
- Final `./dev platform-https-check`: passed, exit 0; private transport, actual
  Chromium presentation, boundaries and identity/migration/shared-credential
  preservation. Log `/tmp/p4-u1b-1-platform-refreshed-check.log`.
- `./dev staff-https-check`: passed, exit 0; ordinary staff/recipient transport,
  actual Chromium and identity/credential-action/migration preservation. Log
  `/tmp/p4-u1b-1-staff-https-check.log`.
- Final `./dev health`: passed, exit 0; live/ready 200, PostgreSQL and both Redis
  services up. Log `/tmp/p4-u1b-1-final-health.log`.
- Final documentation formatting, 34 feature-document link/anchor checks, both
  updated handoff anchors and `git diff --check`: passed. No owned session/storage
  verification containers remain.
- Browser validation found focus loss while detail refresh kept an invalid input
  disabled. The focus request now survives until the control is enabled and
  actually focused. Focused ESLint/platform typecheck passed after this correction;
  actual HTTPS keyboard acceptance passed.

The API matrix verifies case-insensitive Unicode/literal wildcard search, filters,
no-match and invalid queries, trimmed/optional/cleared contacts, immutable extra
field rejection, stale and different-section races, exact concurrent attempt
replay, changed-input/foreign adoption denial, original outcome versus newer detail,
lost HTTP response and injected PostgreSQL COMMIT acknowledgment loss. Revoking real
runtime audit/receipt/contact-write grants proves complete rollback. Held target
status and operator authority changes deny stale writes. Receipt mutation and
plaintext contact leakage are denied/absent. Original registry checks retain
admission denial, passive reads, bounded pagination and creation provenance.

Earlier checkpoints included a storage-ready timeout during overlapping builds
and a tool-session outer status 143 after every matrix passed and Docker recorded
final verifier/launcher exit zero. The final detached serial rerun above completed
with an independent shell status 0 and supersedes both incomplete command results.
The full-run harness removed its owned disposable database, Redis and processes.

## Acceptance reconciliation

All A-01–07 passed. Current real API/HTTPS matrices and affected regressions
passed in the final serial graph on 2026-10-27 (+08:00); ordinary HTTPS refresh
and preservation then passed.

| Criterion | Implementation and real-service proof                                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | `check-tenant-editing.mjs` exercises literal/Unicode search, blank/invalid/no-match criteria and all lifecycle filters. Final review adds matching draft/active fixtures and exact filtered UUID pagination across A/B. `check-tenant-editing-browser.mjs` verifies cursor reset, navigation and delayed old criteria. |
| A-02      | API name/contact bounds, omission/clear and forged-field rejection; HTTPS browser saves, validation/input retention, partial contacts and replica reload. Original administrator/code remain unchanged.                                                                                                                |
| A-03      | API stale/different-section races, held tenant status/authority and operator authority races; real runtime audit/receipt/contact-write grant removal verifies rollback. Credential API checks preserve pending setup/exchange across edits.                                                                            |
| A-04      | Concurrent exact attempt, changed-input/foreign adoption, lost response and injected COMMIT acknowledgment loss; browser explicit original retry shows a historical outcome alongside later canonical values.                                                                                                          |
| A-05      | Direct API session/plane/CSRF/Origin/proxy and malformed/bounded request denials, database/Redis failures; browser same-owner restoration, foreign owner/target switches and delayed callbacks. Existing registry/platform/credential checks retain protected access and disclosure clearing.                          |
| A-06      | Production HTTPS browser checks keyboard/error focus, loading/empty/conflict/recovery, 320/390/768/1440px, 200% zoom and axe. Original create/list/detail/replay and administrator panel remain covered.                                                                                                               |
| A-07      | Published registry/browser contracts, operator procedure and child 2 ports below. Final full graph, ordinary platform HTTPS refresh, platform/staff preservation and backend live/ready 200 passed.                                                                                                                    |

Final review also repaired the documentation index's stale planned/policy-gate
state and linked the configuration procedure and this evidence. No geography,
voice, activation or operational backup implementation was added.

## Environment and cleanup boundary

Commands run through the existing Docker workspace with Node 22.23.3 and pinned
pnpm. Fixtures own disposable migrated PostgreSQL databases, authenticated Redis,
A/B HTTP processes, production Next and private TLS ingress. Faults and barriers are
script-only; no production control endpoint is added. Each harness drops its owned
stores/processes and closes gates/sockets. Screenshots are under ignored
`.local/ui-review`. This proves the controlled private-development boundary;
production HA/capacity and operational tenant readiness remain later work.

## Child 2 handoff

Use `DraftTenantRegistry.byId/list`, `TenantConfigurationOwner.configure`,
`TenantEditReceipts.inspect/save` and `DraftTenants.save` as documented in the registry
contract. Coordinate the canonical tenant version, preserve authority versions for
ordinary edits, and keep operator → attempt → tenant → any owner-specific locks
consistent. Geography must use a locations-owned port on the caller's connection.
Use immutable safe edit outcomes and a fresh current DTO for reconciliation;
never restore historical values from receipts. Extend named protected forwarding
and target-keyed mounted state. ONB-02 remains unresolved. Voice and geography
remain visibly incomplete; parent P4-U1b/P4-U1 and operational readiness are incomplete.

Browser acceptance isolates its independent editing and search/owner groups by
clearing only the protected counter registry in its disposable Redis. Real
per-request distributed admission remains active; existing backend low-limit and
browser 429/Retry-After checks remain enabled and pass. No production budget,
timeout or automatic mutation retry was changed. This is functional acceptance,
not a sustained-load/capacity claim.

Review checkpoint: uppercase UUID detail references now mount canonical lowercase
owner/target work, and save results compare canonical target/request UUIDs. Current
API/browser regression checks for this correction passed in the final serial
full run.
