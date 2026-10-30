# P4-U2a implementation and acceptance evidence

Status: complete within approved private development, 2026-10-30 (Asia/Manila,
+08:00). A-01–07 passed within this child's allocation boundary under the
[owner-approved ALLOC-01 and scoped ALLOC-06 policy](../planning/p4-u2a-allocation-policy-review.md),
including draft and active tenant expansion. Parent P4-U2 and b/c remain incomplete.

## Delivered contract

Telephony owns exclusive existing-extension claims, positive versions, retained
per-version ownership history and immutable operator/request receipts. A partial
unique index backstops overlapping selections expanded to existing UUIDs.
Canonical operator and tenant authority precede node/resource locks. Ownership,
history, attributed audit and retry results share one connection and commit.

The [exact API/locking/replay contract](../architecture/tenant-inventory-allocation.md)
and [operator workflow](../runbooks/tenant-inventory-allocation.md) define bounded
individual/range selection, atomic reservation/allocation, promotion, capacity,
history, desired-only release and explicit uncertain-original recovery.
Desired disablement retains ownership; profile/credential boundary changes reject
claimed stock. Saving ownership does not change tenant status, staff assignments,
credentials or calling eligibility.

## Acceptance reconciliation

| Criterion | Verified result                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | Real saved draft/active tenants, canonical inclusive ranges and UUID selection, gaps/duplicates/bounds, disabled stock, 50-stock atomic save, multi-node placement, actual individual/range HTTPS saves and replica reload passed.                                                                            |
| A-02      | Two-replica range/range, individual/range and duplicate-stock races preserve one owner. Direct actual runtime-role INSERT hits the unique constraint; immutable identity/history protections deny writes.                                                                                                     |
| A-03      | Actual inventory profile adoption/disable and namespace/reference writers preserve guards; claimed credential changes deny. Exact combined existing inventory API/provider/HTTPS regression passed, including unallocated workflows.                                                                          |
| A-04      | Held tenant/operator authority/status races, stale versions, concurrent exact retry, changed fingerprints, expired requests, real audit/receipt rollback and lost PostgreSQL COMMIT acknowledgement passed. Browser exact-original recovery and owner/target isolation passed.                                |
| A-05      | Actual desired references and the existing runtime dependency port block release. Retained-pin/unknown-runtime fixtures, pin-read grant loss and stock predating the initial native baseline deny safely. Unreferenced desired-only release retains history. Installed-resource/live-call transfer remains c. |
| A-06      | Wrong plane, cookies, Origin/CSRF, forged authority, extra/unbounded fields and DB/Redis failure deny. Browser keyboard/axe, 320–1440px layouts, desktop 200% zoom, existing 320px + zoom regression, reauthentication and delayed owner/target callbacks passed.                                             |
| A-07      | Focused real-service acceptance, exact inventory/tenant/routing/authority checks, affected revision components and `./dev check` passed as detailed below. Normal migration, ordinary consumer refresh/access, health, cleanup and exact preservation passed.                                                 |

## Commands and evidence

All app builds/checks use the supported Docker workspace. Trusted deployment
orchestrators use the existing pinned Node image and protected isolated mounts.
Durable coordinators record final exits independently of terminal sessions.

| Command or component                                                                                                                | Final result / local evidence                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:tenant-allocation`                                                                                           | Passed, exit 0; `/tmp/p4-u2a-allocation-final.log` and `.exit`. Final width/store-port changes and initial-baseline release blocker included.                                                                                                                                                       |
| `./dev exec pnpm check:extension-inventory`                                                                                         | Exact combined API/provider/HTTPS command passed, exit 0; `/tmp/p4-u2a-inventory-durable.log` and `.exit`.                                                                                                                                                                                          |
| `./dev exec pnpm check:extension-inventory --credentials`                                                                           | Passed, exit 0 after diagnosed environment repair; `/tmp/p4-u2a-credentials-final.log` and `.exit`.                                                                                                                                                                                                 |
| `./dev exec pnpm check:draft-tenant`                                                                                                | Exact combined API/HTTPS command passed, exit 0; `/tmp/p4-u2a-tenant-durable.log` and `.exit`. Original narrow-screen and reauthentication expectations retained.                                                                                                                                   |
| `./dev exec pnpm check:routing`                                                                                                     | Passed, exit 0; `/tmp/p4-u2a-routing-durable.log` and `.exit`.                                                                                                                                                                                                                                      |
| `./dev exec pnpm check:session-foundation --authority`                                                                              | Passed, exit 0; `/tmp/p4-u2a-authority-durable.log` and `.exit`.                                                                                                                                                                                                                                    |
| Revision native/integrated/retained-provider components                                                                             | Passed sequentially before the wrapper's deployment-precondition failure; `/tmp/p4-u2a-revision-durable.log`. See exact boundary below.                                                                                                                                                             |
| `scripts/check-pbx-live-isolation.mjs` through trusted Docker orchestration                                                         | Passed after ordinary consumer restoration; `/tmp/p4-u2a-isolation-restored.log`.                                                                                                                                                                                                                   |
| `scripts/check-session-deployment.mjs --revisions-browser` through the same trusted Docker launcher                                 | Passed, exit 0; `/tmp/p4-u2a-revision-browser-durable.log` and `.exit`. Includes actual HTTPS/live recovery and owned cleanup.                                                                                                                                                                      |
| `./dev exec node --test scripts/pbx-revisions.test.mjs scripts/pbx-live-protection.test.mjs scripts/pbx-mutation-boundary.test.mjs` | Passed, exit 0; `/tmp/p4-u2a-revision-unit-durable.log` and `.exit`.                                                                                                                                                                                                                                |
| `./dev check`                                                                                                                       | Passed, exit 0; `/tmp/p4-u2a-full-durable.log` and `.exit`. Repository lint/format/types, all production builds, entrypoints/config, foundation/durability/storage/identity, client/deployment isolation and combined real session/platform/staff/credential/onboarding/geography/voice/PBX checks. |
| `./dev migrate`                                                                                                                     | Passed, exit 0; `/tmp/p4-u2a-migration.log` and `.exit`. Additive migration applied normally.                                                                                                                                                                                                       |
| Ordinary backend, platform and staff refresh                                                                                        | Complete; `/tmp/p4-u2a-backend-refresh.log`, container `/tmp/p4-u2a-platform-refresh-sequential.log` and `/tmp/p4-u2a-staff-refresh-sequential.log`.                                                                                                                                                |
| `./dev platform-https-check` / `./dev staff-https-check`                                                                            | Passed, exit 0; `/tmp/p4-u2a-platform-transport.log`, `/tmp/p4-u2a-staff-transport.log` and their `.exit` files.                                                                                                                                                                                    |
| In-container ordinary backend live/ready probes                                                                                     | Both HTTP 200; `/tmp/p4-u2a-backend-health-final.log` and `.exit`.                                                                                                                                                                                                                                  |
| `./dev pbx-live-check`                                                                                                              | Final read-only proof passed; `/tmp/p4-u2a-retained-after.log` and `.exit`.                                                                                                                                                                                                                         |
| Complete normal data/TLS-auth digest comparison                                                                                     | Exact match; `/tmp/p4-u2a-preservation-before-complete.jsonl` and `/tmp/p4-u2a-preservation-after-complete.jsonl`. Final runtime coordinator exit 0: `/tmp/p4-u2a-final-runtime.log` and `.exit`.                                                                                                   |

The original `./dev exec pnpm check:pbx-revisions` wrapper exited 1 at its actual
isolation assertion, because both ordinary telephony replicas had been stopped for
two days while the private live profile remained enabled. Its preceding
`check-pbx-native-boundary`, `check-pbx-live-execution` and retained-provider
components completed successfully, including owned cleanup; the wrapper's
sequential stop-on-error behavior establishes those component exits. Read-only
retained preflight confirmed exact runtime, zero channels and no pending operation.
One existing approved ordinary consumer was restored; unchanged isolation then
passed. The remaining browser and pure components passed separately through the
same trusted launcher paths above. This completes the affected revision component
matrix; the earlier full-wrapper exit is retained as 1, not relabeled as a wrapper
pass. No application source changed between those revision components.

## Real versus injected boundaries

Focused checks use real migrated PostgreSQL/PostGIS with runtime grants, isolated
shared Redis, independent production Nest replicas and production Next/private
HTTPS Chromium. API/browser operations and database constraints/races are real.
Test-owned fault barriers and dependency records are explicitly injected.

An actual audit trigger failure and receipt INSERT grant denial prove atomic
rollback. A real TCP proxy drops PostgreSQL CommandComplete(COMMIT) after receipt
insertion; Redis pause and unavailable-database cases prove denial. Receipt expiry
changes only an owned timestamp, restoring its immutable trigger afterward.
Retained pins are actual rows read through `RuntimeDependencyPort`; their fixture
insertion proves blocking, not active-call release safety. Initial-baseline stock
blocks because that native baseline has no revision snapshot. Missing runtime
identities/times also deny safe-release proof.

Existing revision regressions include real native fencing, natural call drain,
interrupted apply/recovery, renewed-owner takeover, retained rollback pins and
private GET-only canonical provider resolution. Those are regression evidence;
they do not implement tenant live routing or complete c's safe transfer scenario.
No public destination or tenant calling-readiness claim is introduced.

## Findings and resolved environment prerequisites

- Early fixture/build/locking corrections included dependency build order, the
  established 401 bearer contract, separate autocommit lock observation and a
  trigger-only audit failure. A disposable database probe confirmed table-level
  REVOKE also strips column grants; no such audit-table REVOKE remains.
- Existing narrow-screen + zoom regression exposed the new node selector's flex
  minimum width. Width constraints/wrapping fixed it. A later reauthentication
  attempt received forwarded 503 after backend issuance 201 under concurrent
  builds; the unchanged complete sequential tenant suite and full suite passed.
- Both existing provider access tokens returned verified-TLS identity 403. The
  owner separately approved restricted issuer replacement and private read-only
  consumer replacement. Fixed-role, exact existing policy/role preflight,
  nonrenewable 24-hour bounds, protected custody and temporary custodian-session
  revocation passed. Configuration updates: zero. No root recovery, policy/role
  change or stored PBX material change occurred. Logs:
  `/tmp/p4-u2a-issuer-stage.log`, `/tmp/p4-u2a-issuer-install.log` and
  `/tmp/p4-u2a-live-consumer-replacement-final.log`. Initial automatic approval
  rejection preceded authorization and did not execute the rejected action.
- A secret-safe stage/SQLSTATE diagnostic identified EAI_AGAIN before provider
  work: PostgreSQL had lost its documented external endpoint-database attachment.
  Restored that existing internal network/alias without recreating PostgreSQL.
  Fixture/canonical database password bytes compared equal without disclosure.
- Terminal-bound coordinators ended with signal 143 before recording final exits;
  those partial runs are not passes. Detached coordinators completed the exact
  combined inventory and remaining checks with durable exits.
- Two ordinary platform builds reached the existing four-minute deadline under
  concurrent load. The final sequential ordinary refresh passed unchanged. An
  early health probe overlapped the normal tsx dependency-rebuild restart; final
  live/ready probes passed after builds settled.

## Preservation, cleanup and handoff

All eleven retained table digests/counts match: tenants, staff, operators, nodes,
extensions, profiles/profile versions, revisions, live operations, artifacts and
pins. All nine platform/staff TLS or authentication configuration file digests
match. The explicitly approved provider bearer replacements above are separate
from stored PBX material preservation.

The final retained node `bcb9d21c-96cd-4975-bd68-314b588a23a9` still has initial
baseline `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7` and retained revision
`4b475c04-b573-4cc1-9d86-1c81b65f4060`, with exact protected/loaded runtime match,
zero active channels and no pending operation. The unmanaged digest matches the
pre-migration proof. Existing local telephony consumption was restored after its
read-only preflight; unrelated backup work remains untouched.

Owned databases/Redis containers and volumes, native fixture containers/directories,
provider generations and access were cleaned. The combined provider suite accounted
for 26 generations (25 destroyed, one already absent), and its browser suite
removed both owned generations and restored the PBX baseline/running state.
Ordinary platform/staff TLS, cookies, forwarding, denial and presentation checks
passed. Existing operator private manual sign-in remains the established user step.
Latest allocation phone/desktop captures were reviewed; responsive/axe/keyboard and
zoom results are established by the actual browser suites.

b consumes canonical claim identity/state/version, node serialization, reference
and replay/browser recovery contracts. c consumes desired-only release evidence
and installed/in-flight/rollback/unknown blockers; its final ALLOC-06/live-call
policy must preserve retained pins. Parent P4-U2, b/c, activation, staff
administration/assignment and production readiness remain open.
