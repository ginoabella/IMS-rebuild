# Progress Tracker

Last reconciled: 2026-10-16 (Asia/Manila, +08:00).
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
Production, live apply and tenant calling readiness remain with later units.

Phase 1 foundation units P1-U2–U6 and Phase 2 units P2-U1–U4 are complete within
their verified boundaries. Early draft tenant creation P4-U1a is complete under
the approved delivery-order exception. P1-U1 remains deferred outside approved
scoped handoffs. Full PBX administration/live apply, completed tenant onboarding, operational response and
production readiness remain to be delivered.

## In Progress

None.

## Latest Completed Checkpoint — P3-U2c / parent P3-U2

- **Status:** completed within conditionally approved private development; 2026-10-16 15:33 +08:00 (Asia/Manila).
- **Requirement:** [C-01–07](feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md), parent AC-01–11; [final evidence](../docs/status/p3-u2c-evidence.md).
- **Delivered:** protected inventory/profile/credential browser, bounded named forwarding, exact passive observation composition, operator-bound mounted recovery and explicit uncertainty/version review. PBX detail links to **Manage extension inventory**.
- **Verification:** combined inventory/real credentials/browser, PBX registry/observation/browser, platform auth, durability, full `./dev check`, all 12 shared UI checks and final automatic-token-cleanup credential rerun passed, exit 0. Actual SIP REGISTER/expiry-zero and service outages are distinguished from injected faults in the evidence.
- **Preservation/cleanup:** exact original Asterisk configuration/routing/object/running baseline restored; no calls, fixtures or lock remain. Generations accounted for, temporary tokens revoked/removed, disposable databases/containers absent. Ordinary canonical node/version and empty inventory preserved; platform/staff HTTPS ready and health checks passed, backend live/ready 200.
- **Handoff:** [browser contract](../docs/architecture/extension-inventory-browser.md), [operator/recovery guide](../docs/runbooks/extension-inventory-browser.md). P3-U4/U5, P4 and P8 retain routing, live apply/recovery/revocation, allocation, tenant readiness and browser calling. Production and the Phase 3 gate remain incomplete; no expanded PBX permissions or deployment approval is claimed.

## Completed

All listed parent/child units are complete within their declared scope. Linked
final evidence records commands, acceptance results, environment and limitations;
the history preserves their full earlier checkpoints.

| Unit | Verified outcome | Evidence |
| --- | --- | --- |
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

1. P3-U3: follow the adopted [a → b → c specs](feature-specs/p3-u3-trunks-gateways-and-dids.md#review-and-adopted-implementation-sub-units), starting with trunk/gateway definitions after applicable G-01/G-03/G-04 decisions. All children remain planned. P3-U4/U5 follow with routing and verified apply/recovery; delivery/live apply/production retain separate approvals.
2. P4-U1b and remaining Phase 4: complete onboarding, voice allocation/readiness, activation and tenant administration.

This follows the [approved 2026-10-07 delivery-order exception](implementation-plan.md#approved-delivery-order-exception--draft-tenant-creation-first).
Draft credential setup preserves draft status and denies ordinary staff access;
credential setup and controlled active fixtures do not establish tenant activation.

| Phase | Current delivery state | Requirement reference |
| --- | --- | --- |
| 1 | P1-U1 deferred; P1-U2–U6 complete, including delivered children. | [Foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1–U4 and all children complete within verified boundaries. | [Identities/access](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1 and P3-U2 with their a/b/c children complete within development scope; U3–U5 and the Phase 3 gate remain incomplete. | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
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
| PBX environment/secret/observation policy | P3-U1a has [scoped connectivity approval](../docs/planning/p3-u1a-connectivity-contract-review.md); b has conditional development observation approval under G-01–03 above. P3-U2a's [inventory/profile review](../docs/planning/p3-u2a-inventory-contract-review.md) Sections 2–4 are conditionally approved for controlled development; a’s A-01–07 implementation/verification is complete. G-02 is conditionally approved for development; b's private provider/lifecycle B-01–07 acceptance is complete; c's live mapping is conditionally approved under the [G-03 review](../docs/planning/p3-u2c-observation-mapping-contract-review.md). Production enforcement/HA/secrets and later routing semantics, permitted validation/reload, active-call changes and controlled test destinations must be resolved before their owning P3/P4/P5 units. |
| Operational permissions and lifecycle details | Remaining incident/assignment transitions, closure safeguards, responder eligibility/concurrency and category/priority contracts must be approved before dependent P4/P5/P6 implementation. Creator closure remains subject to those safeguards. |
| Administrator/tenant lifecycle | General last-admin removal/disablement, platform-account recovery and tenant activation/suspension/retirement effects on routes/active work remain with owning P4/later units. Ordinary admission and scoped P2-U4 credential recovery are already approved. |
| Geography/drafts/location | Default-coordinate/service-area policy, tiles/search, persistent draft recovery/conflicts, foreground sharing/retention and supported operational mobile targets must be established before owning units. |
| Evidence/recordings/retention | Real evidence/recording authorization, permitted file limits, retention and production recovery require scoped approval; foundation storage access does not establish feature access policy. |
| Public channels/later tools | Trusted entry mappings, create/enrich handoff, public feedback, SMS/public voice/browser calling, report/export definitions and recovery-action permissions remain pending. |
| Production acceptance | Scheduler/HA/secrets/joint-store recovery, measured capacity/latency/accessibility/security/RPO/RTO and required Phase 8 launch scope must be established and verified in Phase 9. |

## Verification and Limitations

- Latest required full Docker graph, combined inventory/provider/browser, PBX registry/observation/browser, auth/durable regressions and all 12 shared UI checks passed, exit 0, on 2026-10-16. Final focused real credential cleanup rerun passed. Exact PBX baseline and normal platform/staff HTTPS restoration/health were verified; backend live/ready 200. Hosted CI, production traffic/capacity/TLS/HA and joint backing-store rollback/recovery remain separately unverified.
- Native evidence is reported Windows Android acceptance on Android 16/API 36, patch 2025-04-05. Desktop Node 24.13.1 is outside the supported engine; Docker verification used Node 22.23.3. Secure-storage faults are injected around real OS calls; physically locked reads and exact interruption timing are not claimed. Trusted session-clock activity fixtures do not establish responder operations.
- Mounted web work recovery does not persist through refresh; durable incident drafts belong to P5-U4. Staff authentication is complete; full responder/incident workflows remain future work.
- P3-U1 establishes authenticated registry/observation/browser recovery against one controlled development Asterisk. Live configuration apply/recovery, tenant voice readiness, operational call attribution, production deployment and real multi-PBX HA remain unverified/unapproved.
- Draft creation/credential setup does not activate tenants. Controlled active-tenant fixtures prove authentication only.
- Local Garage is single-node development infrastructure; production hosting/TLS/storage recovery and real evidence authorization remain pending. Foundation tenant/permission fixtures do not prove later feature enforcement.
- Private development platform automated checks and Windows sign-in were verified; macOS and that setup's separately requested manual refresh/logout checks were not confirmed. Later automated platform/staff results remain in their own evidence.
- Previously recorded unrelated follow-up: the implementation plan has six source links using an incorrect relative `context/...` prefix. This cleanup preserves the plan; follow-up remains outstanding.

## Recent Session Notes

- 2026-10-16 (Asia/Manila, +08:00) — Prepared the [P3-U3a contract review](../docs/planning/p3-u3a-definition-contract-review.md) for user approval after checking repository guidance, parent/child gates, existing ports and retained evidence. Proposes resource/connection and initial identity/status/edit policies, independent IP-peer staging, bounded API/retry/dependency contracts and A-01–07 checks. No established trunk credential-binding owner found in inspected contracts/source; authenticated scope requires a concrete G-03 review and possibly the parent's focused lifecycle refinement. All decisions remain pending; a/parent remain planned. Documentation only; no runtime checks or service changes.

- 2026-10-16 (Asia/Manila, +08:00) — User adopted the P3-U3 three-child split; created [a: trunk/gateway definitions](feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md), [b: DID inventory and safe resource removal](feature-specs/p3-u3b-did-inventory-and-dependency-safe-resource-removal.md) and [c: operator browser/integrated handoff](feature-specs/p3-u3c-operator-resource-browser-and-integrated-handoff.md). Each specifies starting state, gates, scope, acceptance and required checks mapped to parent AC-01–11. Parent/index synchronized; documentation consistency, local links/anchors and whitespace reviewed. G-01–04 policies remain unresolved; a/b/c and parent are planned, with no runtime verification or implementation claimed.

- 2026-10-16 (Asia/Manila, +08:00) — Prepared and reviewed the [P3-U3 feature spec](feature-specs/p3-u3-trunks-gateways-and-dids.md). Recommended three sequential sub-units: trunk/gateway foundation, DID inventory and dependency-safe removal, then integrated operator browser. Split remains proposed; G-01–04 resource, DID, credential-reference and lifecycle policies require scoped decisions before dependent implementation. Documentation only; P3-U3 remains planned, no implementation or runtime verification claimed.

- 2026-10-16 15:33 +08:00 (Asia/Manila) — Completed P3-U2c and parent P3-U2 under the conditional private-development G-03 approval. All C/parent criteria, required checks and exact cleanup/restoration passed; [final evidence](../docs/status/p3-u2c-evidence.md). In Progress cleared; detailed earlier checkpoints archived.

- 2026-10-16 10:49 +08:00 (Asia/Manila) — Completed P3-U2b B-01–07 under the user's conditional G-02 private-development approval. Real provider/lifecycle/security/recovery evidence, complete inventory/queue regressions and final full Docker graph passed, exit 0. Fixture material accounted for and exact owned resources removed; normal runtime readiness verified. In Progress cleared. Approved recovery and deferred production/delivery/live-apply boundaries are recorded in [final evidence](../docs/status/p3-u2b-evidence.md). Earlier checkpoints moved to tracker history.

## Tracker Maintenance

Keep this file focused on the active unit, next work, concise completed summaries,
unresolved decisions and material limitations. Update state in place at meaningful
checkpoints; keep only recent session notes needed for the current handoff.
At unit or phase completion, append detailed prior checkpoints/older notes to a
dated section in the history and retain current summaries/evidence links here.
Keep archive entries historical; do not copy obsolete pending states back into the
current tracker. Preserve dates, decision sources and relative-link bases when
moving material. This archive split changes documentation organization only.
