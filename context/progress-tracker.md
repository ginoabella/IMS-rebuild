# Progress Tracker

Last reconciled: 2026-11-09 (Asia/Manila, +08:00).
This file records current delivery state. Detailed earlier checkpoints and session
notes are preserved in [progress-tracker-history.md](progress-tracker-history.md).
Required behavior belongs to the [implementation plan](implementation-plan.md),
feature specs and authoritative context; verification evidence belongs to
[docs/status](../docs/status/). Historical intermediate failures or pending states
do not override the final results summarized here.

## Current Goal

Deliver MyIMS incrementally under the agreed
[build, review, improve process](ai-workflow-rules.md#build-review-improve).
P3-U2a inventory/profile foundation is complete under conditional development
approval, following completed P3-U1 registry, observation and operator browser.
P3-U2 and its a/b/c sequence are complete within conditional private-development
scope, including the integrated browser and controlled observation journey.
P3-U3 and a/b/c are complete within approved private development, including the
integrated trunk/gateway/DID console and final DEV-01–07 acceptance.
P3-U4 and a/b/c are complete within approved private development: desired groups,
reservations, inbound/outbound rules and integrated routing acceptance. Its desired
state feeds scoped live apply; production remains separate and verified tenant
calling readiness is delivered by P4-U2 below.
P3-U5a is complete within its offline revision capture/review/validation boundary;
P3-U5b/c, parent P3-U5 and the integrated Phase 3 gate are complete within
approved private development under U5-01–05. Tenant readiness remains Phase 4.

Phase 1 foundation units P1-U2–U6 and Phase 2 units P2-U1–U4 are complete within
their verified boundaries. Early draft tenant creation P4-U1a is complete under
the approved delivery-order exception. P4-U1b and all three children are complete within approved private development,
including integrated configuration/credential handoff and parent P4-U1 acceptance.
P1-U1 remains deferred outside approved scoped handoffs. Integrated PBX administration
and tenant onboarding acceptance are complete within their development boundaries.
Exclusive desired allocation and canonical desired route bindings/permissions are complete in P4-U2a/b. Tenant-aware live routing/readiness and pin-safe reallocation are complete within P4-U2; activation, operational response and production readiness remain separate.

## In Progress

None. P4-U2-DEV-b is complete; P4-U2-DEV-c remains planned.

## Development Follow-up — P4-U2-DEV

- **Completed:** a's retained profile upgrade/recovery (A-01–06) and b's persistent controlled-call preparation (B-01–07), with approved DEV-01–03 effects fulfilled. [a evidence](../docs/status/p4-u2-dev-a-evidence.md), [b evidence](../docs/status/p4-u2-dev-b-evidence.md).
- **Retained state:** same node/installation and original baseline; artifact `e6ee0b86-da28-4ba9-bf42-a6c6e985c341`, digest `f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`, compiler/policy `review-2` / `deny-unbound-1`; current epoch 14, routing generation 12, 20 pins and all ten required capabilities. Approved preparation remains started at lifecycle v4 with eleven available cases at final observation.
- **Next boundary:** c owns the complete tenant-owned route graph/application, ordinary-console SIP/RTP/grant verification and actual loaded-path cleanup/parent acceptance. Tenant readiness remains incomplete. Historical P4-U2 acceptance and separate activation/production gates are unchanged.
- **History:** [prior handoff and completion checkpoints](progress-tracker-history.md#2026-11-09--p4-u2-dev-b-completion-and-prior-handoff). [Supported commands](../docs/runbooks/persistent-controlled-calls.md).

## Separate Operational Follow-up

**Operational follow-up, outside the feature gate:** owner Windows archive
verification passed. Existing failed backup `ec0b8e2d-49d9-45e3-930e-6b769b58f103`
remains pending after an expired initial SecretID (actual TTL 300 seconds). Local
inspection found no snapshot/upload, only staged audit; cleanup has no receipt.
[Exact report](../docs/status/p3-u3a-backup-operation-local-inspection.json).
No retry, closure, mount correction, credential replacement or scheduler activation
was performed. Prepare practical administration/reconciliation under the simpler
model when addressing operations; do not resume the old guarded-root design as the
next feature task. [Current backup guide](../docs/runbooks/p3-u3a-development-backup.md).

Documentation cleanup archived **24** superseded documents, repaired links and
preserved **five** script-referenced Markdown files plus all **67** consumed-bootstrap
source hashes. Current-document formatting and whitespace checks passed; no new
missing local target paths. Six pre-existing implementation-plan link errors remain.
Execution evidence and script/hash-bound inputs are preserved.
[Archive and file map](../docs/archive/p3-u3/2026-10-23/README.md).
All pre-simplification chronological checkpoints are in
[tracker history](progress-tracker-history.md#2026-10-23--p3-u3-superseded-design-and-operational-checkpoints).
This specification/archive step establishes no new runtime or production pass.

## Latest Completed Checkpoint — P4-U2-DEV-b

B-01–07 passed, 2026-11-09 (Asia/Manila, +08:00). Approved dedicated drafts,
three real provider-backed endpoint generations and eleven immutable cases are
retained on the original installation. Exact/concurrent retries, stop/start,
actual helper restart with explicit fresh-instance start, and independent normal
console reads passed. Preparation/read/restart observed zero INVITE/REGISTER/RTP;
no ordinary grant, test, result or authorization was created. Original canonical
rows, retained artifacts/baseline, 20 pins and reference/profile bytes are preserved.
All required focused/live/browser/provider/affected checks, complete `./dev check`,
and final ordinary health/PBX/private HTTPS checks passed. Exact isolated fixtures
and the passive observer were cleaned; the approved preparation remains started.
[Final evidence and exact resource/case/cleanup handoff](../docs/status/p4-u2-dev-b-evidence.md).
Child c owns full route application, ordinary calls, loaded-path removal and parent
acceptance; setup availability is separate from tenant readiness.

## Completed

All listed parent/child units are complete within their declared scope. Linked
final evidence records commands, acceptance results, environment and limitations;
the history preserves their full earlier checkpoints.

| Unit | Verified outcome | Evidence |
| --- | --- | --- |
| P4-U2-DEV-b — Persistent controlled-call preparation | B-01–07 passed: immutable canonical setup, real scoped credentials, exact retry/reconciliation, bounded participant lifecycle, restart/console persistence, zero passive traffic and exact ordinary preservation. | [Final evidence](../docs/status/p4-u2-dev-b-evidence.md) |
| P4-U2-DEV-a — Retained profile upgrade/recovery | A-01–06 passed: passive exact preflight, durable fenced profile transition/compatible recovery, 23 isolated scenarios, approved retained deployment, full checks and preserved original baseline/history. | [Final evidence](../docs/status/p4-u2-dev-a-evidence.md) |
| P4-U2c / parent P4-U2 — Verified tenant routing | C-01–08 and AC-01–12 passed: exact tenant-aware runtime, bounded actual tests/readiness, audited retirement/reallocation, integrated regressions and ordinary preservation. | [Final evidence](../docs/status/p4-u2c-evidence.md) |
| P4-U2b — Tenant route bindings and permissions | B-01–08 passed: shared gateways/exact owned DIDs, complete inbound graph ownership, explicit outbound permissions, consistent canonical eligibility, atomic audit/recovery, mutation races, actual API/HTTPS, affected/full checks and ordinary preservation. | [Final evidence](../docs/status/p4-u2b-evidence.md) |
| P4-U2a — Exclusive tenant inventory allocation | A-01–07 passed: exclusive existing stock for draft/active expansion, atomic audit/replay, guarded boundaries, safe release blockers, real API/HTTPS, affected/full checks and ordinary preservation. | [Final evidence](../docs/status/p4-u2a-evidence.md) |
| P4-U1b-3 / P4-U1b / P4-U1 | C-01–07 and parent AC-01–11 passed: explicit voice preference, integrated protected configuration/credential handoff, actual API/HTTPS, affected/full checks and ordinary runtime preservation. Approved private development. | [Final evidence](../docs/status/p4-u1b-3-evidence.md) |
| P4-U1b-2 — Service area and default intake coordinates | B-01–07 passed: prepared uploads/confirmation/defaults, canonical PostGIS and qualified intake read, atomic versions/audit/recovery, real API/HTTPS, affected/full checks and ordinary preservation. | [Final evidence](../docs/status/p4-u1b-2-evidence.md) |
| P4-U1b-1 — Registry editing and contacts | A-01–07 passed: search/filter/pagination, versioned draft name/contact saves, atomic audit/retry outcomes, real API/HTTPS recovery, affected/full checks and ordinary preservation. | [Final evidence](../docs/status/p4-u1b-1-evidence.md) |
| P3-U5c / parent P3-U5 / Phase 3 | C-01–06 and AC-01–10 passed: full declared interruption/race matrix and actual integrated HTTPS recovery, affected/full checks, exact cleanup and retained-runtime/ordinary service preservation. Approved private development only. | [Final evidence](../docs/status/p3-u5c-evidence.md) |
| P3-U5b — fenced live apply and verified recovery | B-01–08 passed: exact durable intent/pins, real physical fencing, protected material/atomic installation, independent verification and guarded verified recovery with actual HTTPS. All affected/normal checks, refresh and owned cleanup passed. | [Final evidence](../docs/status/p3-u5b-evidence.md) |
| P3-U5a — revision capture, diff and validation | A-01–06 passed within the offline boundary: immutable atomic snapshots/receipts, deterministic safe compiler/diff, qualified local validation and actual protected HTTPS recovery/review. Affected/full checks and ordinary refresh passed. | [Final evidence](../docs/status/p3-u5a-evidence.md) |
| P3-U4c / parent P3-U4 | C-01–06 and AC-01–08 passed: outbound patterns/priorities/transforms, original/output reservation protection, actual trunk dependencies, generated identities and complete integrated HTTPS journey; affected/full checks and ordinary refresh passed. | [Final evidence](../docs/status/p3-u4c-evidence.md) |
| P3-U4b — inbound rules and trusted route identities | B-01–06 passed: desired inbound APIs/browser/preview, internal identities and fixture-only ownership checks, actual dependency protection, atomic recovery and retained history; normal check and ordinary HTTPS refresh complete. | [Feature evidence](../docs/status/p3-u4b-evidence.md) |
| P3-U4a — groups and reservations | A-01–06 passed: desired group/member/fallback/reservation APIs/browser, shared namespace races, atomic audit/recovery and dependency-safe removal; normal check and ordinary HTTPS refresh complete. | [Feature evidence](../docs/status/p3-u4a-evidence.md) |
| P3-U3c / parent P3-U3 | Canonical DID APIs/browser, gateway dependencies and integrated trunk/gateway/DID management; C-01–05 and DEV-01–07 passed, normal check and ordinary HTTPS refresh complete. | [Integrated evidence](../docs/status/p3-u3c-evidence.md) |
| P3-U3b — simple trunk credentials | Protected trusted OpenBao import/replacement, exact-write recovery and actual digest/desired registration browser selection/adoption; B-01–05 passed, normal check and ordinary HTTPS refresh complete. | [Feature evidence](../docs/status/p3-u3b-evidence.md) |
| P3-U3a — trunks and gateways | IP-peer APIs and actual operator browser CRUD/status/removal; A-01–05 passed with atomic audit, versions, idempotency and dependency/source protection. | [Feature evidence](../docs/status/p3-u3a-evidence.md) |
| P3-U3a named custodian capability checkpoint | Owner accepted and successfully closed 2026-10-20 (+08:00); exact identity/lifetime and ten capabilities matched, intended restricted permissions function, revoked/403; both authorizations consumed. Does not establish whole-server privilege inventory or backup readiness. | [Scoped evidence and limits](../docs/status/p3-u3a-retained-capability-session-2.md) |
| P1-U2 | Workspace, isolated app/process skeletons and reproducible quality graph. | [Workspace evidence](../docs/status/p1-u2-evidence.md) |
| P1-U3 | Shared services, PostgreSQL/PostGIS baseline, deployment-owned migrations, typed configuration and backend health. Asterisk is bootstrap only. | [Foundation evidence](../docs/status/p1-u3-evidence.md) |
| P1-U4 | Shared dark UI primitives and distinct platform/command-center shells. | [UI evidence](../docs/status/p1-u4-evidence.md) |
| P1-U5 (a/b/c) | Transactional append-only audit/outbox, durable worker delivery and integrated recovery/operational handoff. | [a](../docs/status/p1-u5a-evidence.md), [b](../docs/status/p1-u5b-evidence.md), [parent/c](../docs/status/p1-u5c-evidence.md) |
| P1-U6 (a/b) | Approved local Garage adapter and tenant-checked expiring GET references with shared-provider recovery. | [a](../docs/status/p1-u6a-evidence.md), [parent/b](../docs/status/p1-u6b-evidence.md) |
| P2-U1 (a/b/c) | Canonical identities/ownership, approved role/admission contracts and secure initial operator bootstrap. | [a](../docs/status/p2-u1a-evidence.md), [b](../docs/status/p2-u1b-evidence.md), [parent/c](../docs/status/p2-u1c-evidence.md) |
| P2-U2 (a/b/c) | Shared session lifecycle/durable fencing, canonical HTTP authority, distributed admission and controlled recovery. | [a](../docs/status/p2-u2a-evidence.md), [b](../docs/status/p2-u2b-evidence.md), [parent/c](../docs/status/p2-u2c-evidence.md) |
| P2-U3 (a/b) | Separate platform HTTP/browser sign-in, cross-replica logout and same-owner mounted reauthentication recovery. | [a](../docs/status/p2-u3a-evidence.md), [parent/b](../docs/status/p2-u3b-evidence.md) |
| P4-U1a (1/2) | Atomic draft tenant/administrator creation and actual operator browser workflow. Parent P4-U1 completed with b; see final integrated evidence above. | [API](../docs/status/p4-u1a-1-evidence.md), [browser/parent](../docs/status/p4-u1a-2-evidence.md) |
| P2-U4 (a/b/c) | Qualified credential lifecycle, staff HTTP/browser access and declared native secure-storage/recovery acceptance. Completed 2026-10-13 17:20 +08:00. | [a](../docs/status/p2-u4a-evidence.md), [b](../docs/status/p2-u4b-evidence.md), [parent/c](../docs/status/p2-u4c-evidence.md) |
| P3-U1a | Protected desired PBX registry/API, canonical identity, safe aliases/destinations, atomic audit/retry/versioned edits and b handoff; A-01–07 complete. | [Registry evidence](../docs/status/p3-u1a-evidence.md) |
| P3-U1b | Controlled development observation, replaceable AMI-TLS adapter, durable ownership/fencing and reconciled freshness; B-01–09 complete. | [Observation evidence](../docs/status/p3-u1b-evidence.md) |
| P3-U1c / parent P3-U1 | Secure operator register/inspect/edit, identity-bound uncertainty recovery and real integrated registry/observation/browser acceptance; C-01–07 and AC-01–11 complete. | [Combined evidence](../docs/status/p3-u1c-evidence.md) |
| P3-U2a | Protected inventory/profile APIs, immutable selections/identities, atomic bounded bulk creation, versioned status/adoption, audit/idempotency and unallocated denial; A-01–07 complete. | [Inventory evidence](../docs/status/p3-u2a-evidence.md) |
| P3-U2b | Protected desired credential lifecycle, private OpenBao, exact-generation recovery, worker/process isolation and conservative cleanup; B-01–07 complete for private development. | [Credential lifecycle evidence](../docs/status/p3-u2b-evidence.md) |
| P3-U2c / parent P3-U2 | Protected inventory/profile/credential browser, identity-bound recovery, exact passive mapping and controlled integrated acceptance; C-01–07 and AC-01–11 complete within private development. | [Combined evidence](../docs/status/p3-u2c-evidence.md) |
| DEV-PLATFORM-HTTPS | Approved private SSH/HTTPS console access, real-stack verification and Windows user-confirmed sign-in. | [Development evidence](../docs/status/platform-development-https-evidence.md) |

Latest completed P2-U4 checkpoint: C-01–09 and parent AC-01–12 reconciled;
focused browser/limits checks and final `./dev check` passed, exit 0. Reported
Android results and injected fault boundaries remain qualified below. Temporary
acceptance runtime/control socket were removed, fixture tenant retired and existing
t001 unchanged; backend live/ready returned HTTP 200 at that checkpoint.
These are retained results, not a claim that fresh checks ran during this cleanup.


## Next Up

1. Implement the planned [P4-U2-DEV adopted sequence](feature-specs/p4-u2-dev-persistent-tenant-calling.md#split-assessment-and-adopted-implementation-order), continuing with c's ordinary-console two-tenant calling and integrated acceptance after completed a/b. DEV-02/03 are approved and b's exact resource/case handoff is published. The user-tested [Asterisk configuration reference](../reference/asterisk_config/) must inform profile/media compatibility without copying secrets or bypassing canonical tenant admission.
2. After ordinary-environment P4-U2 manual review, P4-U3 readiness/activation, consuming completed P4-U2a/b/c allocation, bindings and verified-routing evidence, then P4-U4/U5 tenant administration. Consume the [completed onboarding handoff](../docs/status/p4-u1b-3-evidence.md), explicit voice preference and canonical geography contracts, and the [P3-U5 handoff](../docs/status/p3-u5c-evidence.md#operator-and-downstream-handoff). Backup administration remains separate.

| Unit / state | Requirement, scope and acceptance | Dependencies / required checks |
| --- | --- | --- |
| [P4-U2 — Allocate inventory and verify tenant routing](feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md) — complete | a/b/c and integrated AC-01–12 passed within approved private development. | [Final evidence](../docs/status/p4-u2c-evidence.md); activation remains P4-U3. |


| Sub-unit / state | Scope and acceptance | Dependencies / required checks |
| --- | --- | --- |
| [P4-U2a — Exclusive tenant inventory allocation](feature-specs/p4-u2a-exclusive-tenant-inventory-allocation.md) — complete | Complete operator allocation workflow, exclusive stock/ranges, dependency blockers and atomic audit/replay; A-01–07. | P4-U1/P3-U5; ALLOC-01 and scoped ALLOC-06 approved. Real PostgreSQL/Redis/two-replica/API/HTTPS races, affected checks and `./dev check`. |
| [P4-U2b — Tenant route bindings and permissions](feature-specs/p4-u2b-tenant-route-bindings-and-permissions.md) — complete | Inbound ownership, explicit outbound/trunk permissions, trusted canonical eligibility port and browser; B-01–08. | a; ALLOC-02/03 and binding-scoped ALLOC-06 approved, including shared gateways and platform-only catch-alls. Real API/browser/reference races, affected allocation/resource/routing checks and `./dev check`. |
| [P4-U2c — Verified tenant routing and integrated handoff](feature-specs/p4-u2c-verified-tenant-routing-and-integrated-handoff.md) — complete | C-01–08 and parent AC-01–12 passed. | Actual native/SIP/RTP/API/HTTPS, affected/full checks and ordinary preservation passed; [evidence](../docs/status/p4-u2c-evidence.md). |

This follows the [approved 2026-10-07 delivery-order exception](implementation-plan.md#approved-delivery-order-exception--draft-tenant-creation-first).
Draft credential setup preserves draft status and denies ordinary staff access;
credential setup and controlled active fixtures do not establish tenant activation.

| Phase | Current delivery state | Requirement reference |
| --- | --- | --- |
| 1 | P1-U1 deferred; P1-U2–U6 complete, including delivered children. | [Foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1–U4 and all children complete within verified boundaries. | [Identities/access](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1–U5 and delivered children complete within declared development boundaries; C-01–06, parent AC-01–10 and integrated Phase 3 gate passed under U5-01–05. Tenant readiness remains Phase 4. | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
| 4 | P4-U1 and P4-U2 with all children complete within approved private development; P4-U3–U5 planned; Phase 4 gate incomplete. | [Tenant administration](implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration) |
| 5 | P5-U1–U7 planned. | [Staff intake/dispatch](implementation-plan.md#phase-5--deliver-staff-intake-incident-management-and-dispatch) |
| 6 | P6-U1–U4 planned. | [Responder/monitoring](implementation-plan.md#phase-6--complete-responder-mobile-work-and-synchronized-monitoring) |
| 7 | P7-U1–U3 planned; integrated operational acceptance outstanding. | [First-release verification](implementation-plan.md#phase-7--verify-the-complete-first-release-journey) |
| 8 | P8-U1–U11 planned; launch requirements/deferred channels still to be resolved. | [Extensions](implementation-plan.md#phase-8--add-public-channels-and-operational-extensions) |
| 9 | P9-U1–U5 planned; no production-readiness/launch claim. | [Production/launch](implementation-plan.md#phase-9--prove-production-readiness-and-launch-the-new-system) |

## Deferred Unit — P1-U1

- **Status:** deferred by user reprioritization since 2026-10-04, outside approved scoped handoffs.
- **Scope/requirement:** [delivery-contract review and decision register](../docs/planning/p1-u1-review-draft.md), proposed product contracts and acceptance matrix; documentation only.
- **Delivered:** reviewable draft contracts, decision IDs D-01–D-13 and overview success-criteria mapping. Scoped role/admission/bootstrap/session/limiter/credential approvals are recorded in their owners below.
- **Remaining/resume:** incorporate explicit answers for remaining product decisions, synchronize authoritative context and reconcile the acceptance matrix. Dependent features wait for their applicable decision; independent work can proceed under existing authorization.
- **Required checks:** documentation consistency/links, decision owner/affected-unit/resume coverage and all ten overview criteria mapped. A draft does not establish product approval or runtime behavior.

## Decisions and Open Questions

The user owns product-policy approvals. Use the authoritative
[product contracts](../docs/planning/p1-u1-product-contracts.md) and
[decision-gate table](implementation-plan.md#decisions-required-before-dependent-implementation)
for their scope; creating a spec does not approve a proposal.

### Recorded approvals retained

- October 28, 2026 (+08:00): user approved the complete [ONB-02 geography policy](../docs/planning/p4-u1b-2-geography-policy-review.md), including prepared uploads, explicit ownership confirmation, optional WGS84 area/defaults and the initial 4,096-position cap. Existing Tenant Code remains unchanged and display-only in this comparison.

- October 24, 2026 (+08:00): user explicitly approved recommended R-03 and outbound R-04 treatment: exact/bounded ASCII digit prefixes, lower priority wins, equal-priority overlaps reject including disabled claims, whole-domain strip/add validation, reservations blocking original and transformed domains without emergency/service exceptions, initially disabled/unbound definitions and no inferred live calling permission. [Authoritative decision](feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4c-policy--october-24-2026-0800).

- October 24, 2026 (+08:00): user explicitly approved recommended R-02, including initially disabled inbound rules, trusted gateway/associated DID or catch-all, exact-first precedence, canonical plus/zero distinctions and extension/group/hangup destinations. [Authoritative decision](feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4b-policy--october-24-2026-0800). R-03 is approved for c in the record above.

- October 23, 2026 (+08:00): user explicitly approved the prepared P3-U3b OpenBao
  migration and synthetic checks for installation
  `58adb785-5384-41ce-9c72-ccda6ea554db`, including named-custodian login, the scoped
  setup role/policy/issuance rule and service-token installation. It is now installed.
  The same supported command replaces routine access, verified nonrenewable with
  a 24-hour actual lifetime and `configurationUpdates: 0`; do not treat that initial
  migration as a pending approval gate again. Endpoint material, backups and PBX
  configuration remain preserved. [Working administration path](../docs/runbooks/trunk-credentials.md).

- October 23, 2026 (+08:00): owner approved the recommended development simplification
  and documentation archive. The replacement spec supersedes earlier P3-U3 design
  requirements below; earlier executed/consumed authorizations remain historical.

- P3-U3a U3A-01–05 and isolated OpenBao trunk lifecycle design: both reviews explicitly approved 2026-10-19 for controlled private development. The synthetic profile, separate custody and restricted provisioning are conditionally approved in the [provisioning review](../docs/archive/p3-u3/2026-10-23/docs/planning/p3-u3a-provisioning-and-provider-profile-review.md). The user subsequently approved the custodian design and explicitly authorized one isolated recovery operation subject to the final request and mandatory safeguards; fresh protected custody was confirmed and the single operation has now executed with verified restoration; the superseded credential-lifecycle acceptance was not completed. That historical boundary does not change the replacement IP-peer unit's completion. Live effects remain excluded.

- D-01 and scoped D-05/D-06 role/eligibility/admission, creator-closure grant, identity representation and bootstrap password/provenance contracts: [identity review](../docs/planning/p2-u1b-contract-review.md) and [bootstrap review](../docs/planning/p2-u1c-bootstrap-contract-review.md).
- Shared session lifetimes/activity and selective durable fencing: [approved lifecycle review](../docs/planning/p2-u2a-session-contract-review.md). Web 60-minute idle/12-hour absolute; mobile 24-hour idle/7-day absolute; passive reads do not renew and rotation does not extend absolute lifetime.
- Independent distributed sign-in limits: [approved limiter policy](../docs/planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy). Production load/capacity is separately outstanding.
- Scoped staff setup/reset/recovery, linked draft-administrator setup/reset exception, password/capability/revocation/handoff/budget/retention rules: [approved credential review sections 1–6](../docs/planning/p2-u4a-credential-contract-review.md). These are resolved within P2-U4; general administrator removal and tenant transitions are not thereby approved.
- Local Garage/shared reference access: [storage contract](../docs/architecture/shared-storage.md), GET-only references with 120-second default/300-second ceiling; existing references may survive authority changes until expiry.
- P3-U1b G-01–03: [conditional local observation approval](../docs/planning/p3-u1b-observation-contract-review.md), including replaceable adapter/material isolation, broader AMI permission disclosure and development-only limits. Production and expanded permissions/control require separate approval.
- P3-U2a G-01 and the G-03 namespace portion: [conditional inventory/profile approval](../docs/planning/p3-u2a-inventory-contract-review.md), Sections 2–4; initial number convention, immutable node-scoped profiles, generated identities and disabled/unset stock. Production security/contact recovery and b/G-02, c and P3-U5 remain separate.
- P3-U2b G02-01–10: sections 2–6 conditionally approved 2026-10-16 for controlled private development only. OpenBao, dedicated worker, no delivery/live apply, retained generations and bounded recovery; production HA/key custody/backup/token/security, retention/destruction and worker access scope require separate review.
- P3-U2c G03-01–06 and sections 2–6: conditionally approved 2026-10-16 for the existing private development Asterisk only, with preserved existing resources, exclusive/no-call checks, verified baseline, documented recovery and exact cleanup. C-01–07 and parent AC-01–11 passed within that scope; future live apply/production remain separate.
- Existing architecture/runtime and early draft delivery order remain adopted; implementation decisions are documented in [architecture](architecture.md) and [docs/architecture](../docs/architecture/), not duplicated here.

### Unresolved for dependent work

| Area | Affected work and resume condition |
| --- | --- |
| Persistent development tenant calling | P4-U2-DEV [DEV-01–03](feature-specs/p4-u2-dev-persistent-tenant-calling.md#decisions-before-dependent-implementation): DEV-01 is approved and a completed its retained deployment. DEV-02/03 dedicated resources, private participants in the existing helper and scoped provider access were approved on 2026-11-08 (+08:00); [exact definitions](../docs/planning/p4-u2-dev-b-preparation-review.md). b completed B-01–07 and approved ordinary preparation on 2026-11-09 (+08:00); parent/c remain incomplete. |
| Tenant allocation/routing policy | P4-U2 [ALLOC-01–06](feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md#decisions-required-before-dependent-implementation) now have owner approval for ALLOC-01 and a's scoped ALLOC-06, including draft/active expansion ([policy](../docs/planning/p4-u2a-allocation-policy-review.md)). On 2026-11-03 the owner approved [b’s routing policy](../docs/planning/p4-u2b-routing-policy-review.md) with shared gateways and tenant-owned DIDs/rules/groups, plus outbound selection and binding-scoped release as proposed. All b gates are resolved. The owner approved controlled tests, draft verification and c’s narrow installed-resource retirement on 2026-11-04, followed by isolated Docker SIP fixtures; see the [approved c policy](../docs/planning/p4-u2c-live-policy-review.md). |
| Downstream tenant calling readiness | P3-U5/Phase 3 completed under approved U5-01–05 [concrete policies](../docs/planning/p3-u5b-live-policy-review.md). P4-U2/U3 must supply trusted tenant allocation/binding, eligibility and verified activation; no tenant calling readiness is approved by development probes. |
| PBX environment/secret/observation policy | P3-U1a has [scoped connectivity approval](../docs/planning/p3-u1a-connectivity-contract-review.md); b has conditional development observation approval under G-01–03 above. P3-U2a's [inventory/profile review](../docs/planning/p3-u2a-inventory-contract-review.md) Sections 2–4 are conditionally approved for controlled development; a’s A-01–07 implementation/verification is complete. G-02 is conditionally approved for development; b's private provider/lifecycle B-01–07 acceptance is complete; c's live mapping is conditionally approved under the [G-03 review](../docs/planning/p3-u2c-observation-mapping-contract-review.md). Production enforcement/HA/secrets and later routing semantics, permitted validation/reload, active-call changes and controlled test destinations must be resolved before their owning P3/P4/P5 units. |
| Operational permissions and lifecycle details | Remaining incident/assignment transitions, closure safeguards, responder eligibility/concurrency and category/priority contracts must be approved before dependent P4/P5/P6 implementation. Creator closure remains subject to those safeguards. |
| Administrator/tenant lifecycle | General last-admin removal/disablement, platform-account recovery and tenant activation/suspension/retirement effects on routes/active work remain with owning P4/later units. Ordinary admission and scoped P2-U4 credential recovery are already approved. |
| Geography/drafts/location | ONB-02 configuration policy is approved and child 2 B-01–07 is complete within private development. Operational tiles/search, incident draft recovery/conflicts, foreground sharing/retention and supported operational mobile targets remain decisions for their owning units. |
| Evidence/recordings/retention | Real evidence/recording authorization, permitted file limits, retention and production recovery require scoped approval; foundation storage access does not establish feature access policy. |
| Public channels/later tools | Trusted entry mappings, create/enrich handoff, public feedback, SMS/public voice/browser calling, report/export definitions and recovery-action permissions remain pending. |
| Backup operations/readiness | Separate operations workstream: retained installation checkpoint decrypted on Windows; first routine backup failed due to 300-second SecretID TTL and remains pending. Repair access/reconciliation and agree manual backup coverage under the simple model. Scheduling/retained joint restore/RPO/RTO remain incomplete. This does not block independent P3-U3 CRUD. |
| Production acceptance | Scheduler/HA/secrets/joint-store recovery, measured capacity/latency/accessibility/security/RPO/RTO and required Phase 8 launch scope must be established and verified in Phase 9. |

## Verification and Limitations

- P4-U2c C-01–08 and parent AC-01–12 passed, with exact real/injected boundaries and future U3/U5/P5/production limitations in the [final evidence](../docs/status/p4-u2c-evidence.md).

- P3-U5c C-01–06, parent AC-01–10 and integrated Phase 3 gate passed within approved private development. Focused/affected/full Docker checks, final resource races, exact cleanup, retained current revision preservation, helper refresh and ordinary HTTPS/health passed. [Evidence and declared real/injected limits](../docs/status/p3-u5c-evidence.md). Tenant readiness/attribution and production gates remain later work.

- P3-U5b B-01–08 passed 2026-10-26 05:47 +08:00: final actual native/SQL/provider/HTTPS acceptance, all affected regressions and full normal Docker graph passed, exit 0. Ordinary HTTPS/backend refresh, transport/health, independent retained baseline preservation and exact owned cleanup passed. [Evidence and limits](../docs/status/p3-u5b-evidence.md). C/parent/Phase 3 were subsequently completed at the checkpoint above.

- P3-U5a A-01–06 passed 2026-10-25 07:50 +08:00: final focused real PostgreSQL/Redis/A/B API/HTTPS workflow, five compiler contracts, affected regressions and full normal graph all passed. Ordinary migration/refresh, platform/staff HTTPS preservation and backend live/ready 200 passed. [Evidence and limits](../docs/status/p3-u5a-evidence.md). Local validation alone establishes no live coverage/readiness; b’s later scoped materialization/apply/pin/recovery proof is recorded above. Tenant bindings remain P4-U2.

- P3-U4b B-01–06 passed 2026-10-24 18:36 +08:00: real PostgreSQL/shared Redis/two-replica/API/HTTPS routing and resource checks, inventory API/browser, PBX registry/observation/browser and full normal graph passed. Final routing/resource reruns cover historical DID association release and paginated selectors. Both migrations and ordinary backend/HTTPS refresh passed; live/ready 200. [Evidence and declared fixture/integration limits](../docs/status/p3-u4b-evidence.md). No tenant bindings, live routing apply or call attribution is delivered.

- P3-U4a A-01–06 passed 2026-10-24 13:14 +08:00: real PostgreSQL/shared Redis/two HTTP replicas/HTTPS browser, all four namespace/reference races, recovery/authority, 320–1440px/axe, affected inventory/resource/PBX regressions and final `./dev check`, exit 0. Ordinary migration/HTTPS refresh and health passed; fixture stores/material/access cleaned and PBX baseline restored. [Evidence and scoped maintenance](../docs/status/p3-u4a-evidence.md). No routing apply/calls or tenant allocation/readiness.

- P3-U3c C-01–05 and parent DEV-01–07 passed 2026-10-24 (+08:00): real OpenBao/PostgreSQL/A/B API/HTTPS browser, affected regressions and final `./dev check`, exit 0. Ordinary console refreshed/ready, HTTPS checks passed and live/ready 200. [Integrated evidence and limits](../docs/status/p3-u3c-evidence.md). No routing/live apply, calls or tenant voice readiness.

- P3-U3b B-01–05 passed October 23, 2026 (+08:00): real OpenBao/import-to-browser checks, affected regressions and final unchanged `./dev check`, exit 0. Ordinary HTTPS console ready; transport/browser checks passed and backend live/ready 200. [Scoped evidence](../docs/status/p3-u3b-evidence.md).

- P3-U3a A-01–05, real PostgreSQL/A/B API/HTTPS browser checks, affected registry/inventory regressions and full `./dev check` passed October 23, 2026 (+08:00). Ordinary development backend and console were refreshed and are ready (live/ready 200). [Current scoped evidence](../docs/status/p3-u3a-evidence.md).

- Prior P3-U2 checkpoint: full Docker graph, combined inventory/provider/browser, PBX registry/observation/browser, auth/durable regressions and all 12 shared UI checks passed, exit 0, on 2026-10-16. Final focused real credential cleanup rerun passed. Exact PBX baseline and normal platform/staff HTTPS restoration/health were verified; backend live/ready 200. Hosted CI, production traffic/capacity/TLS/HA and joint backing-store rollback/recovery remain separately unverified.
- Native evidence is reported Windows Android acceptance on Android 16/API 36, patch 2025-04-05. Desktop Node 24.13.1 is outside the supported engine; Docker verification used Node 22.23.3. Secure-storage faults are injected around real OS calls; physically locked reads and exact interruption timing are not claimed. Trusted session-clock activity fixtures do not establish responder operations.
- Mounted web work recovery does not persist through refresh; durable incident drafts belong to P5-U4. Staff authentication is complete; full responder/incident workflows remain future work.
- P3-U1 establishes authenticated registry/observation/browser recovery against one controlled development Asterisk. U1 itself establishes no live apply/recovery or tenant voice readiness. B’s scoped live proof is recorded above; operational call attribution, production deployment and real multi-PBX HA remain future work.
- Draft creation/credential setup does not activate tenants. Controlled active-tenant fixtures prove authentication only.
- Local Garage is single-node development infrastructure; production hosting/TLS/storage recovery and real evidence authorization remain pending. Foundation tenant/permission fixtures do not prove later feature enforcement.
- Private development platform automated checks and Windows sign-in were verified; macOS and that setup's separately requested manual refresh/logout checks were not confirmed. Later automated platform/staff results remain in their own evidence.
- Previously recorded unrelated follow-up: the implementation plan has six source links using an incorrect relative `context/...` prefix. This cleanup preserves the plan; follow-up remains outstanding.

## Scoped follow-up

- Pre-existing allocation preview copy prints a literal version-expression suffix instead of the version value (`apps/platform-console-web/app/allocations/node.tsx`). Confirmed in the baseline source while reviewing compact-selector screenshots. Numeric selection/preview identities and server version checks still work; correcting that separate preview-copy issue remains follow-up.

- Pre-existing routing cold-entry return paths are absent from the literal sign-in
  allowlist. P3-U5a adds only its own revisions path; routing follow-up is outside
  this unit and does not affect authenticated routing navigation.

## Recent Session Notes

- 2026-11-07 (Asia/Manila, +08:00) — User adopted the P4-U2-DEV split and requested child specs. Created [a: retained profile upgrade/recovery](feature-specs/p4-u2-dev-a-retained-pbx-profile-upgrade-and-recovery.md), [b: persistent controlled-call preparation](feature-specs/p4-u2-dev-b-persistent-controlled-call-preparation.md), and [c: ordinary-console calling/integrated acceptance](feature-specs/p4-u2-dev-c-ordinary-console-calling-and-integrated-acceptance.md), each with goal, dependencies, scope, child acceptance, verification and handoff. Parent AC-01–12 map to 21 child criteria, with final media/path-removal/live acceptance explicitly retained by c. Updated parent/plan/navigation/current tracker; DEV-01–03 remain unresolved and all children planned. User-tested Asterisk reference preserved. Documentation only; no implementation, service changes or calls.

- 2026-11-07 (Asia/Manila, +08:00) — Prepared the requested [P4-U2-DEV feature spec](feature-specs/p4-u2-dev-persistent-tenant-calling.md) with AC-01–12, retained-profile/recovery requirements, persistent controlled-call custody/lifecycle, ordinary-console proof and DEV-01–03 environment decisions. Recommended three sequential sub-units; split not adopted and no child specs created. Included the user's working `reference/asterisk_config/` as required profile/media compatibility input, with sanitized comparison and actual SIP/audio regression requirements; reference bytes preserved. Updated plan/navigation/parent/tracker. Docker specification/index formatting, scoped local links/anchors, acceptance/split/decision coverage review and diff whitespace checks passed; tracker/plan retain their formatter-excluded style. Documentation only; no deployment, calls or new runtime acceptance.

- 2026-11-05 (Asia/Manila, +08:00) — Added the [complete P4-U2 manual test guide](../docs/guides/p4-u2-manual-testing.md), with M01–M20, AC-01–12 mapping, exact UI actions, prerequisites, two-tenant/live/recovery/retirement/cleanup checks and an owner sign-off template. Current acceptance fixtures auto-clean and provide no persistent manual live session; the guide explicitly leaves unprepared live cases blocked. Owner manual review remains pending before P4-U3. Guide formatting, 45 scoped local links, M01–M20/AC-01–12 coverage and diff whitespace passed. Documentation only; no new runtime checks or live calls are claimed.

- 2026-11-05 (Asia/Manila, +08:00) — P4-U2c and parent P4-U2 completed within approved private development. Required real two-tenant/live/API/browser/native/provider/authentication and final full checks passed; ordinary consumer refresh, exact preservation and owned cleanup passed. Removed c from in progress; next feature is P4-U3. [Evidence](../docs/status/p4-u2c-evidence.md).

- 2026-11-03 (Asia/Manila, +08:00) — `UI-TENANT-COLLAPSED-CARDS` complete, per user request. All eight Tenant details cards start collapsed with useful summaries and accessible arrow controls. Operator/tenant-bound page state retains open/closed choices through same-owner tab-return checks; form contents stay mounted. Pending/dirty/error feedback stays visible when collapsed; credential summaries never disclose handoff codes. New tenants/operators and document reload start collapsed. Added shared disclosure primitive, page provider, UI guidance and production-browser presentation coverage. Focused Docker format/lint, shared UI build, console TypeScript and isolated/ordinary production builds passed. Actual-page checks passed eight initial summaries, 44px/keyboard controls, mounted drafts, focus/pageshow/tab-return retention, collapsed validation feedback, document reset and 320–1440px/axe; desktop/phone screenshots reviewed. Presentation uses fixture reads/validation. Full platform browser/session suite, separate real credential/staff browser acceptance and allocation API/HTTPS workflow passed, exit 0 with fixture cleanup; platform/allocation launcher exits independently confirmed with docker wait. Updated existing workflow tests to open cards after navigation/operator replacement. Earlier credential runs timed out at save/denial confirmations; temporary sanitized tracing confirmed successful saves and retained cards, and isolated rerun passed; tracing removed. Normal console rebuilt/refreshed, final HTTPS checks passed, backend live/ready 200 and staff HTTPS ready. Diff whitespace passed. No backend/schema, authentication policy or live PBX changes.

- 2026-11-03 (Asia/Manila, +08:00) — `UI-ALLOCATION-SELECTOR` complete, per user request. Tenant detail individual choices sort numerically across stock pages and use a bounded-height responsive grid, 25 choices per page, with full-PBX number-prefix search. Choices/count persist across searches/pages; blocked/claimed stock and the existing 50-item cap remain visible/enforced, with explicit preview before save. A separate read-only numeric stock-page query preserves mutation/claim UUID ordering. Next/backend strictly validate the optional prefix and scope cursors to the exact node. Added operator and API guidance. Focused Docker Prettier/ESLint, console TypeScript and isolated/ordinary production builds passed. Real `./dev exec pnpm check:extension-inventory --inventory` passed (exit 0), including new allocation-stock numeric/mixed-length pagination across replicas, full-stock prefix/exact/no matches, cursor isolation, invalid/duplicate query rejection and passive read checks; owned fixtures removed. Actual tenant-card checks passed with 302 fixture stock choices, cross-page/filter selections and full preview, blocked stock, cap/clear, bounded height/44px targets at 320–1440px and axe. Desktop/phone screenshots visually reviewed. Those presentation reads/previews are fixtures; real Next prefix-allowlist probes passed, with no ownership/PBX writes. Full platform browser/session suite and cleanup passed, exit 0 captured from its launcher with `docker wait`; the original terminal ended with 143 but the complete container log/result were retained. Normal backend and console refreshed; final `./dev platform-https-check` passed, backend live/ready returned 200 and staff HTTPS remains ready. Diff whitespace passed. No schema, ownership policy, credential, authentication or live PBX configuration changes. A separate pre-existing preview version-copy typo is recorded under Scoped follow-up.

- 2026-11-03 (Asia/Manila, +08:00) — `UI-INVENTORY-DISCLOSURE-RETENTION` complete, per reported tab-return regression. Native details lost their open state when access revalidation cleared/refetched rows. Expanded extension IDs now live in existing canonical operator/node-bound mounted inventory work, and controlled disclosures preserve both expanded and deliberately collapsed rows through revalidation and reload. Node/operator replacement and confirmed logout clear this state with the rest of the work; hard document reload still starts collapsed. Updated the browser contract. Focused Docker Prettier/ESLint, console TypeScript, isolated and ordinary production builds passed. Production-browser regression passed multiple open/closed rows across focus, hidden/visible transitions, persisted pageshow, actual tab switching with explicitly dispatched restoration events for headless Chromium, and explicit list reload; fresh node visits start collapsed. Existing keyboard/Inspect, 320–1440px and axe checks passed. Inventory reads in this presentation check are fixtures, not live PBX/credential verification. Full `./dev exec pnpm check:platform-auth --browser` and owned fixture cleanup passed, exit 0 (also captured from the launcher using `docker wait`). Normal console rebuilt/refreshed, final `./dev platform-https-check` passed, backend live/ready returned 200 and staff HTTPS remains ready. Diff whitespace passed. No browser persistence, authentication policy, backend/schema or live PBX changes.

- 2026-11-03 (Asia/Manila, +08:00) — `UI-INVENTORY-COMPACT` complete, per user request. Extension inventory now sorts numerically across pages, resolving the existing UUID cursor to the node-owned immutable number. Rows start collapsed with key status visible; native right/down triangle disclosures reveal profile/version/observation and the existing Inspect action. Updated inventory API/browser contracts. Focused Docker ESLint/Prettier, console TypeScript, real `./dev exec pnpm check:extension-inventory --inventory` and isolated/ordinary production builds passed. API coverage includes mixed 4/5-digit ordering across pages and absent/foreign-node cursors; fixtures removed. Actual-console presentation checks passed Enter/Space expansion/collapse, Inspect, 320–1440px reflow and axe, with desktop/phone screenshots visually reviewed; these use fixture inventory reads and establish presentation only, with no live PBX/credential operations. The full `./dev exec pnpm check:platform-auth --browser` launcher passed, exit 0 with cleanup; its initial terminal ended with 143, so the continuing launcher log was recovered and `docker wait` confirmed its actual result. A browser-test lint reference to DOM globals was corrected and focused lint passed. Ordinary backend restarted, normal console rebuilt/refreshed, final `./dev platform-https-check` passed, backend live/ready returned 200 and staff HTTPS remains ready. Diff whitespace check passed. No schema, credential, session policy or live PBX configuration changes.

- 2026-11-03 (Asia/Manila, +08:00) — `UI-PLATFORM-SIGNOUT` complete, per user request. Replaced Foundation preview in the Platform console top-right bar with the Lucide logout icon on every authenticated page; removed the shared page-level Sign out button. Icon has an accessible name, tooltip, keyboard focus, 44px target and pending state, using the existing logout/retry flow. Other shell consumers retain their default presentation. Updated operator guidance. Docker focused ESLint/Prettier, shared UI build, console/command-center/public TypeScript, isolated production build and full `./dev exec pnpm check:platform-auth --browser` passed (exit 0), including new icon placement/absent page-button assertions and existing keyboard, uncertain-response, replica logout, onboarding and access regressions. Ordinary console refresh initially hit its build deadline during concurrent verification; sequential retry passed and the updated console is ready. Final `./dev platform-https-check`, backend live/ready 200, staff HTTPS ready and diff whitespace checks passed. No backend/schema/authentication behavior changes.

- 2026-10-30 (Asia/Manila, +08:00) — P4-U2a complete within approved private development, including active-tenant expansion. A-01–07, final focused/affected/full checks, normal migration/refresh and exact preservation passed. Removed a from in progress; parent/b/c and Phase 4 remain incomplete. [Final evidence](../docs/status/p4-u2a-evidence.md); [checkpoints](progress-tracker-history.md#2026-10-30--p4-u2a-implementation-and-verification-checkpoints).

- 2026-10-30 (Asia/Manila, +08:00) — Compact PBX cards (`UI-PBX-CARDS`) complete, per user request and UI card guidance. Registry nodes now use a responsive grid; saved settings and observation facts use aligned label/value rows. Detail connection/observation cards share a row when two 28rem cards plus gap fit, otherwise stack; detail navigation wraps together. Existing facts, badges, warnings and read/edit logic retained. Docker Prettier, console ESLint/TypeScript and ordinary production rebuild passed. Temporary Chromium presentation review of actual registry/detail components with production CSS and fixture reads passed current/stale/unavailable/long-value cases at 1440/960/768/390/320px, label/value alignment, card reflow, expanded endpoint wrapping, 200% zoom, axe and narrow-container-on-desktop checks. Desktop/phone screenshots visually reviewed. The temporary reviewer substitutes access/read adapters and the edit form; this establishes presentation only, not live PBX integration or form behavior. An initial reviewer setup error was corrected to use an explicit Playwright context. Final ordinary HTTPS checks passed; backend live/ready 200 and platform/staff HTTPS ready. No backend/schema or live PBX configuration changes.

- 2026-10-30 (Asia/Manila, +08:00) — Documented the user-approved compact information-card convention in [UI context](ui-context.md#cards--detail-summaries): aligned label/value rows, related cards sharing a row based on available container width, wrapping and accessible narrow-screen reflow. The tenant summaries are the reference for future card work. Documentation only; reviewed consistency with the implemented layout and existing responsive/accessibility guidance. Diff whitespace check passed; no new application/runtime verification claimed.

- 2026-10-30 (Asia/Manila, +08:00) — Tenant summary compact layout (`UI-TENANT-SUMMARY`) complete, per user request. Scope: tenant and initial-administrator summary cards only; aligned label/value rows, cards side by side when their container fits two 28rem columns plus gap, otherwise stacked. Long values wrap without hiding information. Console ESLint/TypeScript, Prettier and isolated production build passed. Existing real HTTPS browser review reached detail/maximum-detail/editing/geography/voice captures at 1440/768/390/320px; desktop and phone detail screenshots visually reviewed, with responsive overflow/zoom checks exercised. The terminal sessions ended with signal 143 while Docker processes continued, so no final whole-suite exit result is claimed. Ordinary refresh initially exceeded its four-minute build timeout; sequential retry completed and platform HTTPS reports ready. Final `./dev platform-https-check` passed, backend live/ready returned 200, and staff HTTPS remains ready. No backend/schema or authorization changes; prior scroll-retention edits preserved.

- 2026-10-30 (Asia/Manila, +08:00) — Platform tab-return scroll follow-up complete after resuming from the laptop disruption. Preserved invisible/inert workspace height and owner-bound same-resource tenant detail during fresh reads; reveal now waits for the validated session/ready context commit. Final affected ESLint/TypeScript, isolated and ordinary production builds, complete focused onboarding browser suite (exit 0), ordinary HTTPS check and backend live/ready 200 passed. Regression covers exact scroll and unsaved input during/after focus, visibility and cached pageshow checks, plus existing recovery/isolation/authentication paths. Normal platform console refreshed; staff HTTPS remains ready. [Evidence and scope limits](../docs/status/platform-scroll-retention-follow-up.md). Manual desktop tab-return confirmation remains with the user; no hard-refresh draft recovery, backend/schema or authorization change.

- 2026-10-29 (Asia/Manila, +08:00) — P4-U1b manual-test upload follow-up complete: reproduced picker-focus access revalidation silently dropping boundary selections, then added mounted selection queuing/fenced rereads and visible accepted filenames. Updated the manual guide. Final focused onboarding browser suite passed, exit 0, including new picker-before-selection/during-read regressions, Naga save/reload, validation and existing authentication checks. Affected ESLint, console TypeScript, isolated/ordinary production builds and normal HTTPS/health checks passed; ordinary console refreshed and staff HTTPS preserved. One intermediate later-auth 503 during concurrent rebuild passed on sequential rerun without authentication changes. [Evidence and native-dialog limit](../docs/status/p4-u1b-upload-follow-up.md). No backend/schema/policy changes; desktop manual retry remains the user confirmation.

- 2026-10-29 (Asia/Manila, +08:00) — User adopted the P4-U2 split. Created the three [child specifications](feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md#review-and-adopted-sub-unit-implementation), each with goal, dependencies, backend/browser scope, acceptance, required verification and handoff. Updated parent, navigation and planned tracker entries. Docker Prettier, 27 spec-local links/anchors, 23 child acceptance IDs, parent coverage/handoff review and diff whitespace checks passed. ALLOC-01–06 remain unresolved; parent and children remain planned. Documentation only; no code, service/data changes or new runtime acceptance.

- 2026-10-29 (Asia/Manila, +08:00) — Prepared and reviewed the [P4-U2 feature specification](feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md): AC-01–12, ALLOC-01–06 policy gates, canonical ownership/binding ports, versioned tenant-aware compiler integration, exact live two-tenant proof and runtime-pin-safe reallocation. Recommended three sequential vertical sub-units (allocation; bindings/permissions; live verification/integrated handoff); no child specs created or split adopted. Spec/index Docker Prettier checks, 12 spec-local links/anchors, acceptance/decision/split coverage and diff whitespace checks passed; tracker retains its formatter-excluded style. Documentation only; P4-U2 remains planned, with no service/data changes or runtime acceptance.

- 2026-10-29 (Asia/Manila, +08:00) — Added the requested [P4-U1b manual testing guide](../docs/guides/p4-u1b-manual-testing.md): desktop access, all three onboarding parts, expected results, credential exchange/draft denial, independent work, validation/conflict/clearing, reporting and optional automated checks. Documentation only; implementation completion is unchanged and no new manual runtime pass is claimed.

- 2026-10-29 (Asia/Manila, +08:00) — P4-U1b-3, P4-U1b and P4-U1 completed within approved private development. C-01–07 and parent AC-01–11, final focused/combined/credential/full checks and normal runtime preservation passed. Removed child 3 from in progress. [Final evidence](../docs/status/p4-u1b-3-evidence.md); [intermediate checkpoints](progress-tracker-history.md#2026-10-29--p4-u1b-3-implementation-and-verification-checkpoints). P4-U2–U5 and Phase 4 gate remain incomplete.

- 2026-10-28 (Asia/Manila, +08:00) — P4-U1b-2 completed under approved ONB-02. B-01–07, focused/combined/affected/full checks, ordinary migration/HTTPS refresh and preservation passed. Removed the feature from in progress; child 3 remains planned. Final acceptance recorded in [evidence](../docs/status/p4-u1b-2-evidence.md). Earlier proposal and intermediate checkpoints are in [history](progress-tracker-history.md#2026-10-28--p4-u1b-2-policy-and-implementation-checkpoints).

- 2026-10-27 09:23 +08:00 (Asia/Manila) — P4-U1b-1 completed within approved private development under ONB-01/03. Closed filtered A/B pagination coverage and stale navigation/status gaps; all A-01–07, real API/HTTPS browser, affected credential/session and final full checks passed. Ordinary console refreshed; platform/staff preservation and backend live/ready 200 passed. [Final evidence](../docs/status/p4-u1b-1-evidence.md); [intermediate checkpoints](progress-tracker-history.md#2026-10-27--p4-u1b-1-implementation-and-verification-checkpoints). Children 2/3 and parent remain incomplete; resolve ONB-02 before geography.

- 2026-10-26 (Asia/Manila, +08:00) — User adopted the P4-U1b split. Created the three [child specs](feature-specs/p4-u1b-tenant-onboarding-configuration.md#review-and-adopted-sub-unit-implementation) with goals, dependencies, browser/backend scope, acceptance, checks and handoff. Updated parent/navigation and planned tracker entries. Reviewed child-to-parent acceptance coverage and boundaries; formatting, 40 local links/heading anchors, sequential dependency/acceptance checks and diff whitespace passed. ONB-01–03 remain unresolved; all implementation remains planned. Documentation only, with no application/service/data changes or new runtime acceptance.

- 2026-10-26 (Asia/Manila, +08:00) — Prepared and reviewed the [P4-U1b feature spec](feature-specs/p4-u1b-tenant-onboarding-configuration.md), including AC-01–11, existing P2-U4 setup reuse, explicit voice preference, geography/contacts/edit-policy gates and a recommended three-sub-unit vertical split. Recommendation only; child specs are not created and implementation remains planned. Spec/navigation formatting, 16 local links/heading anchors, acceptance/split/gate coverage and diff whitespace checks passed. The tracker retains its existing formatter-excluded style. Documentation only; no application, service or data changes, and no new runtime acceptance.

- 2026-10-26 14:23 +08:00 (Asia/Manila) — P3-U5c, parent P3-U5 and scoped Phase 3 gate completed. All C-01–06/AC-01–10 criteria reconciled; focused/affected/full checks and final concurrent resource races passed. Exact cleanup, retained current revision, helper-only refresh and ordinary HTTPS/health verified. Removed c from in progress; next feature is Phase 4. [Evidence](../docs/status/p3-u5c-evidence.md); intermediate checkpoints retained in [history](progress-tracker-history.md#2026-10-26--p3-u5c-implementation-and-verification-checkpoints).

- 2026-10-26 05:47 +08:00 (Asia/Manila) — P3-U5b completed under approved U5-01–05 and scoped capability/access authorizations. Final native/SQL/provider/HTTPS and all affected/normal checks passed; ordinary refresh, independent retained baseline preservation and exact fixture/access cleanup passed. Removed b from in progress; c/parent/Phase 3 remain incomplete. Detailed intermediate checkpoints moved to [history](progress-tracker-history.md#2026-10-26--p3-u5b-implementation-and-verification-checkpoints).

- 2026-10-24 23:50 +08:00 (Asia/Manila) — P3-U4c and parent P3-U4 completed within approved private development. C-01–06 and AC-01–08 passed; final real routing/integrated API/browser, all affected regressions, full normal check, migration and ordinary HTTPS/health passed. Exact fixture cleanup and controlled PBX restoration verified. [Evidence](../docs/status/p3-u4c-evidence.md), [operator workflow](../docs/runbooks/outbound-routing.md) and [downstream contract](../docs/architecture/outbound-routing.md). Live apply/bindings/attribution remain later work.

- 2026-10-24 18:36 +08:00 (Asia/Manila) — P3-U4b completed under explicit R-02 approval. B-01–06, final real routing/resource API/browser reruns, affected inventory/PBX regressions and full normal graph passed. Added a historical-association constraint correction and exercised actual paginated selectors; final migrations/ordinary HTTPS refresh and health passed. [Evidence](../docs/status/p3-u4b-evidence.md) and [operator handoff](../docs/runbooks/inbound-routing.md). Parent/c and R-03 remain incomplete; tenant bindings/live apply/attribution remain later work.

- 2026-10-24 13:14 +08:00 (Asia/Manila) — P3-U4a completed under explicit R-01/R-04/R-05 approval. A-01–06, focused real PostgreSQL/A/B API/HTTPS browser, affected inventory/resource/PBX regressions and full normal check passed. Ordinary backend/HTTPS refreshed and healthy. Fixed preview epoch capture and keyboard fixture timing; routine invalid endpoint test-issuer replacement used existing native custody/role without policy changes. [Evidence/limits](../docs/status/p3-u4a-evidence.md) and [operator handoff](../docs/runbooks/ring-groups.md). Parent/b/c, live apply and tenant readiness remain incomplete; backup work remains separate.

- 2026-10-24 (Asia/Manila, +08:00) — User requested the three P3-U4 sub-unit specs. Created [a: groups/reservations](feature-specs/p3-u4a-ring-groups-and-reserved-number-protection.md), [b: inbound/identities](feature-specs/p3-u4b-inbound-rules-and-trusted-route-identities.md) and [c: outbound/integration](feature-specs/p3-u4c-outbound-rules-and-integrated-routing-handoff.md), each with dependencies, browser/backend scope, acceptance, checks and handoff. Linked the adopted split from parent/navigation; parent and children remain planned. R-01–05 remain unresolved. Formatting, local links/heading anchors, child acceptance coverage and diff whitespace checks passed. Documentation only; no application, service or data changes.

- 2026-10-24 (Asia/Manila, +08:00) — Prepared and reviewed the [P3-U4 feature spec](feature-specs/p3-u4-ring-groups-and-dial-plans.md), including acceptance, unresolved routing policies and a proposed three-increment split with a browser workflow in each. Reviewed allocation boundaries, generated attribution, existing dependency blockers and extension/reservation races. Spec formatting, local-link/heading checks and diff whitespace checks passed. Documentation only; no feature implementation, service changes or new runtime verification. P3-U4 remains planned; standalone child specs remain to be written if the split is adopted.

- 2026-10-24 00:09 +08:00 (Asia/Manila) — P3-U3c and parent P3-U3 completed: DID inventory/forms and real dependency blockers, C-01–05/DEV-01–07, integrated real-service/browser acceptance and full normal check passed. Fixed validation focus after disabled submissions; retained its browser assertion. Ordinary HTTPS refreshed and healthy; operator and downstream dependency handoffs published. Earlier a/b/start-c checkpoints are in [history](progress-tracker-history.md).

- 2026-10-23 (+08:00) — P3-U3a Enable-denial follow-up completed: ordinary
  development HTTPS ingress now permits PATCH with the same exact-origin check
  as POST. New real-listener regression failed before the fix and passed after
  console refresh; foreign/missing/duplicate origins, bearer and unsupported
  methods remain denied. `./dev platform-https-check`, focused ESLint and
  formatter passed; backend live/ready 200. Existing identities/data preserved;
  authenticated operator retry remains manual. [Evidence](../docs/status/p3-u3a-evidence.md).

- 2026-10-23 10:29 +08:00 (Asia/Manila) — P3-U3a completed: real desired IP-peer API/browser, A/B races/audit/access/recovery and full normal graph passed; additive development migration and console refresh completed. Current evidence and API/operator handoff published; b/c and parent remain incomplete.

- 2026-10-23 (Asia/Manila, +08:00) — Owner approved the recommended replacement
  sub-units. Created concise a: trunks/gateways, b: simple credentials and c:
  DID/integration specs, each with actual browser work, scope, checks and handoff.
  Aligned parent/plan/navigation/tracker. New children are planned; old specs remain
  archived. Documentation-only work, with no service/code/data changes.

- 2026-10-23 (Asia/Manila, +08:00) — Owner approved the simpler P3-U3 model and
  cleanup/archive of unneeded documents. Published one replacement spec, archived
  obsolete designs, consolidated current architecture/operations/navigation, and
  preserved machine evidence, source-bound inputs and runtime data. This is a
  documentation transition; feature APIs, administrator migration and operational
  repairs have not been executed. Earlier detailed checkpoints moved to history.

## Tracker Maintenance

Keep this file focused on the active unit, next work, concise completed summaries,
unresolved decisions and material limitations. Update state in place at meaningful
checkpoints; keep only recent session notes needed for the current handoff.
At unit or phase completion, append detailed prior checkpoints/older notes to a
dated section in the history and retain current summaries/evidence links here.
Keep archive entries historical; do not copy obsolete pending states back into the
current tracker. Preserve dates, decision sources and relative-link bases when
moving material. This archive split changes documentation organization only.
