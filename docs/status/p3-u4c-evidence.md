# P3-U4c — outbound rules and integrated routing

Status: completed within approved private development, 2026-10-24 23:50 +08:00 (Asia/Manila).
C-01–06 and parent AC-01–08 passed; A-01–06/B-01–06 retain their published
boundaries. No live apply, actual tenant bindings or calling readiness is established.

The user explicitly approved the recommended desired-state R-03/outbound R-04
policy in the implementation conversation. The [parent decision](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4c-policy--october-24-2026-0800)
records exact/bounded-prefix matching, lower numeric priority, whole-domain strip/add,
original/transformed reservation blocking, initially disabled/unbound rules, no
emergency/service exceptions and no inferred live calling permission.

## Delivered

Telephony-owned `outbound_rules` persist explicit trunk references, approved
patterns/lengths/priorities/transformations, desired status, actors, versions and
retained history. Four stable identities use b's internal generator; keys remain
outside browser DTOs and runtime UPDATE grants. Protected bounded APIs and the
routing console deliver list/create/detail/edit/status/removal and saved-rule preview.

Whole-domain transformation validation handles stripping beyond a fixed prefix,
including an empty remaining fixed prefix. Equal-priority intersecting domains
reject even when disabled; ordered overlaps work, a disabled winner denies and no
match denies. Original and output domains both respect canonical reservations.
Reservation edits check current outbound rules. Canonical node locks, derived
length-specific database domains and exclusion/validation triggers protect competing
writes. Trunk removal/incompatible structure/direction edits include disabled
references; compatible credential-version adoption preserves references.

The actual console completes group → inbound → outbound → reservation creation,
inspection, previews, status changes, disabled-trunk and inbound-group blocker
navigation, and dependency-ordered removal. Existing shared operator-bound input,
version and uncertain-response recovery remain in use. Desired saves/previews
perform no PBX contact, registration, credential retrieval, call or configuration apply.

The [operator workflow](../runbooks/outbound-routing.md) and
[API/reservation/identity/dependency contract](../architecture/outbound-routing.md)
publish limits, commands and the P3-U5/P4-U2/P5-U3 handoff.

## Actual commands and results

All acceptance commands below passed, exit 0, through the existing Docker workspace
with Node 22.23.3, real PostgreSQL/shared Redis, two independent HTTP processes and
actual HTTPS Chromium for browser claims. Controlled PBX checks used the existing
approved development Asterisk and exclusive preservation/cleanup guards.

| Command                                                 | Result and boundary                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:routing`                         | Final pass includes all retained a/b API/browser checks, outbound C checks and the complete integrated HTTPS graph journey, authority/session recovery, keyboard, 320–1440px reflow and axe.                                                                                          |
| `./dev exec pnpm check:trunk-gateways`                  | Real resource/API/browser regressions; actual credential-version adoption while a disabled outbound rule references the trunk. Existing provider-command checks retain their declared SQL/TLS simulator boundary.                                                                     |
| `./dev exec pnpm check:extension-inventory --inventory` | Namespace/ownership/profile/atomicity/access, independent races, no tenant calling eligibility and lost-response recovery.                                                                                                                                                            |
| `./dev exec pnpm check:extension-inventory --browser`   | Inventory/profile/credential browser, real controlled provider lifecycle/observation, mounted recovery, keyboard/reflow/axe and exact cleanup.                                                                                                                                        |
| `./dev exec pnpm check:pbx-nodes --registry`            | Canonical registry/API, versions/audit/replay, races, access and safe output.                                                                                                                                                                                                         |
| `./dev exec pnpm check:pbx-nodes --observation`         | Controlled observation/lease fencing, authentication, disconnect/restart/reconnect and database-loss recovery.                                                                                                                                                                        |
| `./dev exec pnpm check:pbx-nodes --browser`             | Real HTTPS registry/observation/freshness/recovery, owner/node isolation, keyboard/reflow/axe and exact PBX restoration.                                                                                                                                                              |
| `./dev storage-deployment-check`                        | Scoped mount-check correction plus real isolated provisioning/rerun/restart/bytes, secret initialization preservation and secret exclusion.                                                                                                                                           |
| `./dev check`                                           | Final complete pass: lint, format, types, all builds, process/config checks, fresh/rerun/concurrent migrations, foundation/audit/outbox/workers/storage/identities, client secret exclusion, storage deployment, platform/staff/browser/credentials/limits/sessions and PBX registry. |
| `./dev migrate`                                         | Additive `20261024030000_outbound_rules` applied through the trusted deployment entry point.                                                                                                                                                                                          |

Initial console type/directive and blocker-label assertions were corrected. The
added positive journey fixture initially selected the protected unmanaged address;
the API correctly rejected it and the fixture now uses an unused address. The first
full run exposed an unchanged blanket `.local` mount assertion after the previously
approved PBX catalog mount had become present. The check now allows only its exact
bind source/destination with `RW:false`; custody/provider administration, fixture
credentials and Docker socket exclusions remain. No runtime mount/grant/configuration
was changed to satisfy the check. Focused storage deployment and the complete normal
rerun passed. No acceptance condition was removed.

Final routing fixtures `myims_session_45e1950997e8` and
`myims-session-check-49cb0cb7e34b` were removed. The final focused rerun explicitly
checks reuse of an already-removed trunk and the inclusive maximum prefix length.
These final test-only assertions passed scoped lint/format after the successful
full graph; application code stayed unchanged. Fresh fixture output was built after
the credential suite's different test alias, avoiding stale browser artifacts. All affected fixture stores and
controlled PBX guards reported cleanup/restoration. Inventory's two owned endpoint
generations were destroyed and temporary tokens revoked/removed. Existing observer
credentials, exact PBX baseline/original running state and exclusive locks were
preserved/restored. No routing apply or calls occurred.

## Child acceptance

| ID   | Passing evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Exact/prefix boundaries, significant zeros, equal-priority disabled claims, ordered overlaps, no match, invalid syntax/newlines, strip underflow, empty/oversized output and actual CRUD/status/removal/browser preview. Direct SQL overlap independently rejects with the exclusion constraint.                                                                                                                                                                                               |
| C-02 | Original/output reservation intersections; stripping beyond the fixed prefix cannot bypass protection. Existing rules reject new/edited reservations. Actual A/B rule/reservation create and reservation-edit races serialize; a's extension/group/reservation namespace races and constraints still pass.                                                                                                                                                                                     |
| C-03 | Same-installation trunks work; inbound-only, unknown, foreign and removed/racing trunks reject. Disabled references block actual removal/connection/direction changes. A/B pattern create/edit, reference create/reassignment/removal/direction races, stale writes, exact/conflicting replay, no-op audit/version retention, forced audit rollback and lost-create/edit recovery pass. Compatible credential adoption with a real outbound reference passes the affected resource regression. |
| C-04 | Persisted keys match b's generator, survive rename and differ by replacement UUID. Trusted fixture facts permit eligible same-tenant/installation ownership with explicit shared-trunk permission; foreign tenant/installation, unavailable and unauthorized shared trunks deny. Actual APIs reject supplied tenant bindings and opaque keys. Definitions stay unbound/calling-ineligible.                                                                                                     |
| C-05 | Actual HTTPS group → inbound → outbound → reservation journey, previews, status and ordered removal; disabled outbound trunk blocker and inbound group blocker inspection/navigation. Retained input/field focus, stale/unknown response recovery, shared session/owner fencing, wrong-plane/CSRF denial, keyboard, responsive layouts and axe pass. Unreachable `.invalid` targets prove desired routing has no live adapter dependency.                                                      |
| C-06 | Final focused and all affected checks plus complete `./dev check` passed. Operator/API/identity/dependency/permission handoffs are published. Ordinary migration, backend/HTTPS refresh, transport checks and health passed.                                                                                                                                                                                                                                                                   |

## Parent AC-01–08 reconciliation

[A-01–06](p3-u4a-evidence.md) and [B-01–06](p3-u4b-evidence.md) retain their approved
private-development boundaries; the final focused run repeats their affected
routing/API/browser/namespace/dependency checks alongside c.

| Parent criterion | Reconciled evidence                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01            | a group/member/order/timeout/fallback/cycle/namespace validation and browser; retained focused a tests pass.                                                                                                                                                            |
| AC-02            | b trusted gateway/associated DID/catch-all, exact-first precedence, wrong/unknown ingress, significant plus/zero distinctions and browser; retained b checks pass.                                                                                                      |
| AC-03            | C-01/02 outbound grammar, full-domain transformations, priority, overlaps, boundaries/no match and reservation protection.                                                                                                                                              |
| AC-04            | a/b reachable allocation fixtures and c explicit route/shared-trunk permission fixtures; all HTTP bindings remain unsupported and stock stays ineligible.                                                                                                               |
| AC-05            | b/c persisted internal identities, installation/replacement isolation, rename stability and independence from dialled/caller input. Unknown/stale/ambiguous/unbound resolution remains fail-closed at b's trusted boundary; actual P4/P5 integration is still required. |
| AC-06            | Retained namespace/ingress/destination races and new outbound pattern/reservation/trunk races across actual HTTP replicas, atomic rollback/audit/receipts, versions/no-ops/replay and response recovery.                                                                |
| AC-07            | Final integrated actual HTTPS graph, blocker navigation and ordered removal, all a/b/c forms/previews/status, recovery/authority, keyboard/reflow/axe.                                                                                                                  |
| AC-08            | Desired routing remains PBX-offline/passive; focused, affected and normal Docker checks pass; operator and downstream contracts are published with declared limits.                                                                                                     |

## Ordinary refresh and limits

The additive migration applied through `./dev migrate`. The backend was recreated
using its retained Compose/.env/observation configuration with `--no-deps` and
reported healthy. `./dev platform-https-stop` / `./dev platform-https` rebuilt and
restarted the ordinary console/backend with no fixture alias. `./dev
platform-https-status` returned ready. `./dev platform-https-check` passed private
listener/secret exclusion, real HTTPS host/cookie/CSRF/PATCH behavior, hostile
forwarding/direct-listener denial and sign-in presentation. `./dev health` returned
live/ready HTTP 200 with PostgreSQL and both Redis services up.

Existing identities, migration history, endpoint/trunk material, observer credentials,
PBX configuration and backups remain preserved. Existing operator browser sign-in
remains a private manual action; no operator password was requested or exposed.

Trusted in-memory tenant-permission facts establish compatibility rejection only;
no real allocation/binding, live attribution or voice readiness is delivered.
Audit/receipt/response-loss faults are injected around real transactions/HTTPS;
controlled session clocks, second-node and provider simulators retain their
original declared boundaries. No production HA, load/capacity, hosted CI, native
OS/device, recording, call/media, backup/restore or production-readiness pass is claimed.

P3-U5 receives desired graphs, stable identities, resource versions, locking and
actual dependency rules, plus exact trunk/selected credential-version references.
It owns revision diffs, compilation, permitted commands, fenced apply, active-call
handling, verification and rollback dependencies. P4-U2 owns canonical tenant
bindings/allocations and explicit outbound permissions; P5-U3 owns authenticated
source/mapping/version reconciliation. Parent completion grants no live tenant
routing and does not complete the Phase 3 gate.
