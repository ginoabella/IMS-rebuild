# Progress Tracker

Last reconciled: 2026-10-26 (Asia/Manila, +08:00).
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
state feeds b’s scoped live apply below; production and tenant calling readiness
remain with later units.
P3-U5a is complete within its offline revision capture/review/validation boundary;
P3-U5b/c, parent P3-U5 and the integrated Phase 3 gate are complete within
approved private development under U5-01–05. Tenant readiness remains Phase 4.

Phase 1 foundation units P1-U2–U6 and Phase 2 units P2-U1–U4 are complete within
their verified boundaries. Early draft tenant creation P4-U1a is complete under
the approved delivery-order exception. P1-U1 remains deferred outside approved
scoped handoffs. Integrated PBX administration acceptance is complete within its
approved development boundary; completed tenant onboarding, operational response
and production readiness remain to be delivered.

## In Progress

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

## Latest Completed Checkpoint — P3-U5c / parent P3-U5 / Phase 3

- **Status:** completed within approved private development under U5-01–05; 2026-10-26 14:23 +08:00 (Asia/Manila). C-01–06, AC-01–10 and the Phase 3 gate passed; [final evidence](../docs/status/p3-u5c-evidence.md).
- **Delivered:** complete interruption/race matrix, 24 actual abrupt native losses, protected-consumer interruptions, concurrent resource acceptance/removal/edit, actual HTTPS normal/failure/recovery and canonical cross-replica/browser reconciliation. Failed-reconciliation ancestry and late canonical-authority checks now preserve ordered recovery and audit every resolved ancestor.
- **Verification:** focused real native/SQL/provider/HTTPS, affected routing/resource/PBX/auth/inventory/provider/browser and durability checks plus full `./dev check` passed, exit 0. Final native/SQL test-only additions and all seven protected-boundary contracts passed.
- **Preservation:** retained current revision `4b475c04-b573-4cc1-9d86-1c81b65f4060`, protected/loaded facts and unmanaged digest unchanged; no active channels/operation. Helper refresh preserved Asterisk PID/start identity. Exact owned fixture/access cleanup, ordinary platform/staff HTTPS and backend live/ready 200 passed.
- **Handoff:** [operator procedures](../docs/runbooks/pbx-revisions.md), [architecture/dependency ports](../docs/architecture/pbx-revisions.md), [machine records](../docs/status/p3-u5c-verification.json). P4-U2/U3 own tenant allocation/readiness/activation; P5-U3 owns authenticated ingress attribution. Production HA/security/backup and the separate pending backup operation remain outside this gate.

## Completed

All listed parent/child units are complete within their declared scope. Linked
final evidence records commands, acceptance results, environment and limitations;
the history preserves their full earlier checkpoints.

| Unit | Verified outcome | Evidence |
| --- | --- | --- |
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
| P4-U1a (1/2) | Atomic draft tenant/administrator creation and actual operator browser workflow. Parent P4-U1 awaits b. | [API](../docs/status/p4-u1a-1-evidence.md), [browser/parent](../docs/status/p4-u1a-2-evidence.md) |
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

1. P4-U1b and remaining Phase 4: complete onboarding, voice allocation/readiness, activation and tenant administration. Use the [P3-U5 handoff](../docs/status/p3-u5c-evidence.md#operator-and-downstream-handoff) for verified provenance/dependency and future eligibility ports. Backup administration remains separate.

This follows the [approved 2026-10-07 delivery-order exception](implementation-plan.md#approved-delivery-order-exception--draft-tenant-creation-first).
Draft credential setup preserves draft status and denies ordinary staff access;
credential setup and controlled active fixtures do not establish tenant activation.

| Phase | Current delivery state | Requirement reference |
| --- | --- | --- |
| 1 | P1-U1 deferred; P1-U2–U6 complete, including delivered children. | [Foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1–U4 and all children complete within verified boundaries. | [Identities/access](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1–U5 and delivered children complete within declared development boundaries; C-01–06, parent AC-01–10 and integrated Phase 3 gate passed under U5-01–05. Tenant readiness remains Phase 4. | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
| 4 | P4-U1a/children complete; P4-U1b and P4-U2–U5 planned; parent P4-U1 incomplete. | [Tenant administration](implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration) |
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
| Downstream tenant calling readiness | P3-U5/Phase 3 completed under approved U5-01–05 [concrete policies](../docs/planning/p3-u5b-live-policy-review.md). P4-U2/U3 must supply trusted tenant allocation/binding, eligibility and verified activation; no tenant calling readiness is approved by development probes. |
| PBX environment/secret/observation policy | P3-U1a has [scoped connectivity approval](../docs/planning/p3-u1a-connectivity-contract-review.md); b has conditional development observation approval under G-01–03 above. P3-U2a's [inventory/profile review](../docs/planning/p3-u2a-inventory-contract-review.md) Sections 2–4 are conditionally approved for controlled development; a’s A-01–07 implementation/verification is complete. G-02 is conditionally approved for development; b's private provider/lifecycle B-01–07 acceptance is complete; c's live mapping is conditionally approved under the [G-03 review](../docs/planning/p3-u2c-observation-mapping-contract-review.md). Production enforcement/HA/secrets and later routing semantics, permitted validation/reload, active-call changes and controlled test destinations must be resolved before their owning P3/P4/P5 units. |
| Operational permissions and lifecycle details | Remaining incident/assignment transitions, closure safeguards, responder eligibility/concurrency and category/priority contracts must be approved before dependent P4/P5/P6 implementation. Creator closure remains subject to those safeguards. |
| Administrator/tenant lifecycle | General last-admin removal/disablement, platform-account recovery and tenant activation/suspension/retirement effects on routes/active work remain with owning P4/later units. Ordinary admission and scoped P2-U4 credential recovery are already approved. |
| Geography/drafts/location | Default-coordinate/service-area policy, tiles/search, persistent draft recovery/conflicts, foreground sharing/retention and supported operational mobile targets must be established before owning units. |
| Evidence/recordings/retention | Real evidence/recording authorization, permitted file limits, retention and production recovery require scoped approval; foundation storage access does not establish feature access policy. |
| Public channels/later tools | Trusted entry mappings, create/enrich handoff, public feedback, SMS/public voice/browser calling, report/export definitions and recovery-action permissions remain pending. |
| Backup operations/readiness | Separate operations workstream: retained installation checkpoint decrypted on Windows; first routine backup failed due to 300-second SecretID TTL and remains pending. Repair access/reconciliation and agree manual backup coverage under the simple model. Scheduling/retained joint restore/RPO/RTO remain incomplete. This does not block independent P3-U3 CRUD. |
| Production acceptance | Scheduler/HA/secrets/joint-store recovery, measured capacity/latency/accessibility/security/RPO/RTO and required Phase 8 launch scope must be established and verified in Phase 9. |

## Verification and Limitations

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

- Pre-existing routing cold-entry return paths are absent from the literal sign-in
  allowlist. P3-U5a adds only its own revisions path; routing follow-up is outside
  this unit and does not affect authenticated routing navigation.

## Recent Session Notes

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
