# Progress Tracker

Last reconciled: 2026-10-15 (Asia/Manila, +08:00).
This file records current delivery state. Detailed earlier checkpoints and session
notes are preserved in [progress-tracker-history.md](progress-tracker-history.md).
Required behavior belongs to the [implementation plan](implementation-plan.md),
feature specs and authoritative context; verification evidence belongs to
[docs/status](../docs/status/). Historical intermediate failures or pending states
do not override the final results summarized here.

## Current Goal

Deliver MyIMS incrementally under the agreed
[build, review, improve process](ai-workflow-rules.md#build-review-improve).
The next implementation is P3-U2 extension inventory under Phase 3 Asterisk
administration, following completed P3-U1 registry, observation and operator
browser delivery. The adopted a → b → c sequence is complete.

Phase 1 foundation units P1-U2–U6 and Phase 2 units P2-U1–U4 are complete within
their verified boundaries. Early draft tenant creation P4-U1a is complete under
the approved delivery-order exception. P1-U1 remains deferred outside approved
scoped handoffs. Full PBX administration/live apply, completed tenant onboarding, operational response and
production readiness remain to be delivered.

## In Progress

None. P3-U1c and parent P3-U1 completed 2026-10-15 09:32 +08:00 (Asia/Manila).

## Current Unit Checkpoint — P3-U1

- **Status:** parent P3-U1 and a/b/c complete within approved development registry/observation scope; reconciled 2026-10-15 09:32 +08:00 (Asia/Manila). Phase 3 remains incomplete.
- **Requirement:** [P3-U1 AC-01–11](feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md) and [c C-01–07](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md).
- **Delivered a:** protected desired registry, canonical installation identity, safe aliases/destinations, transactional audit/receipts, versioned edits and atomic observation handoff; [A-01–07 evidence](../docs/status/p3-u1a-evidence.md).
- **Delivered b:** independent AMI-TLS observation, durable leases/epochs/fencing, complete reconciliation, freshness and sanitized failures; [B-01–09 evidence](../docs/status/p3-u1b-evidence.md). The upstream account has broader `system` permissions than the fixed application allowlist and is not strictly read-only at the PBX.
- **Delivered c:** actual secure list/register/detail/connectivity edit, bounded named forwarding, current backend authority, owner-bound immutable create intent/fingerprint/epoch, uncertain-edit canonical reload/review, passive desired/runtime states and accessible responsive presentation; [browser contract](../docs/architecture/pbx-browser.md), [operator guide](../docs/runbooks/pbx-operator-guide.md), [C-01–07/parent evidence](../docs/status/p3-u1c-evidence.md).
- **Verification:** combined `./dev exec pnpm check:pbx-nodes`, durable/process regressions, full `./dev check`, all 12 shared UI tests and final `--browser` selection passed, exit 0. Real AMI/SIP, disconnect/reconnect, ownership/freshness and reference/target recovery are separated from injected faults and synthetic second-target evidence. Final maximum-name/keyboard/axe/reflow and secret-exclusion checks passed.
- **Cleanup/runtime:** exact task database/Redis/PBX fixtures removed; existing installation/catalog/material/tenant routes retained. Both normal HTTPS supervisors restored ready and network checks passed; backend live/ready HTTP 200. An older October 7 disposable database without PBX schema was identified read-only and preserved.
- **Approval/boundary:** existing scoped G-01/G-02 and conditional G-01–03 local-development approvals unchanged. One real controlled installation was tested; production deployment/secrets/HA/capacity and strict PBX-side read-only enforcement remain unapproved. Registry save establishes neither live apply nor tenant voice readiness.
- **Handoff:** P3-U2 consumes canonical node/installation identity, safe registry/observation ports and freshness/coverage semantics. P3-U5 must deliver external stale-epoch fencing and ordered configuration revisions; a pre-call database check cannot revoke an issued PBX command. Tenant allocation/activation and the remaining Phase 3 gate stay incomplete.
- **Documentation:** guide/contracts/runbooks/index, every parent criterion, local links, consistency and whitespace reconciled. Historical intermediate checkpoints are archived; final results are authoritative.

| Unit | Status | Boundary and acceptance |
| --- | --- | --- |
| [P3-U1a — Protected PBX registry and connectivity contracts](feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md) | complete | A-01–07; [registry evidence](../docs/status/p3-u1a-evidence.md). |
| [P3-U1b — Fenced Asterisk observation and recovery](feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md) | complete | B-01–09; conditional development approval; [observation evidence](../docs/status/p3-u1b-evidence.md). |
| [P3-U1c — Operator PBX browser journey and integrated handoff](feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md) | complete | C-01–07 and parent AC-01–11; [combined evidence](../docs/status/p3-u1c-evidence.md). |

### Prerequisites for dependent P3-U1 work

| Gate | Required condition and resume evidence |
| --- | --- |
| G-01 — Controlled observation environment | Resolved for isolated development: existing Asterisk 22.10.1, verified private AMI-TLS and cleaned-up no-call registration fixtures. AMI `system` is broader than read-only; the application enforces its fixed allowlist. Production PBX-side enforcement remains unapproved. |
| G-02 — Secret resolution | Resolved for isolated development: protected exact-file provider/opaque aliases, dedicated telephony mounts and fresh lookup on reconnect/rotation verified. Production secrets management requires separate review. |
| G-03 — Observation policy | Resolved for isolated development: approved validated limits, complete reconciliation and passive stale/historical/unknown semantics verified. Exact values are in the b contract/evidence; production capacity/HA/recovery requires separate review. |

Resolve only the gate portions needed by the current child. Routine SQL/routes/
adapter choices follow existing conventions. Routing/reload/active-call policy
remains with later units; P3-U5 must prove external stale-owner fencing before
live apply is enabled. Missing live access cannot be replaced by simulator evidence.

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
| DEV-PLATFORM-HTTPS | Approved private SSH/HTTPS console access, real-stack verification and Windows user-confirmed sign-in. | [Development evidence](../docs/status/platform-development-https-evidence.md) |

Latest completed P2-U4 checkpoint: C-01–09 and parent AC-01–12 reconciled;
focused browser/limits checks and final `./dev check` passed, exit 0. Reported
Android results and injected fault boundaries remain qualified below. Temporary
acceptance runtime/control socket were removed, fixture tenant retired and existing
t001 unchanged; backend live/ready returned HTTP 200 at that checkpoint.
These are retained results, not a claim that fresh checks ran during this cleanup.

## Next Up

1. P3-U2: extension inventory using the completed P3-U1 identity/observation handoff.
2. P3-U3–U5: trunks/gateways/DIDs, routing, then verified apply/recovery and external fencing.
3. P4-U1b and remaining Phase 4: complete onboarding, voice allocation/readiness, activation and tenant administration.

This follows the [approved 2026-10-07 delivery-order exception](implementation-plan.md#approved-delivery-order-exception--draft-tenant-creation-first).
Draft credential setup preserves draft status and denies ordinary staff access;
credential setup and controlled active fixtures do not establish tenant activation.

| Phase | Current delivery state | Requirement reference |
| --- | --- | --- |
| 1 | P1-U1 deferred; P1-U2–U6 complete, including delivered children. | [Foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1–U4 and all children complete within verified boundaries. | [Identities/access](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1 and a/b/c complete within development scope; P3-U2–U5 and the Phase 3 gate remain incomplete. | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
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
- Existing architecture/runtime and early draft delivery order remain adopted; implementation decisions are documented in [architecture](architecture.md) and [docs/architecture](../docs/architecture/), not duplicated here.

### Unresolved for dependent work

| Area | Affected work and resume condition |
| --- | --- |
| PBX environment/secret/observation policy | P3-U1a has [scoped connectivity approval](../docs/planning/p3-u1a-connectivity-contract-review.md); b has conditional development observation approval under G-01–03 above; production enforcement/HA/secrets and later routing semantics, permitted validation/reload, active-call changes and controlled test destinations must be resolved before their owning P3/P4/P5 units. |
| Operational permissions and lifecycle details | Remaining incident/assignment transitions, closure safeguards, responder eligibility/concurrency and category/priority contracts must be approved before dependent P4/P5/P6 implementation. Creator closure remains subject to those safeguards. |
| Administrator/tenant lifecycle | General last-admin removal/disablement, platform-account recovery and tenant activation/suspension/retirement effects on routes/active work remain with owning P4/later units. Ordinary admission and scoped P2-U4 credential recovery are already approved. |
| Geography/drafts/location | Default-coordinate/service-area policy, tiles/search, persistent draft recovery/conflicts, foreground sharing/retention and supported operational mobile targets must be established before owning units. |
| Evidence/recordings/retention | Real evidence/recording authorization, permitted file limits, retention and production recovery require scoped approval; foundation storage access does not establish feature access policy. |
| Public channels/later tools | Trusted entry mappings, create/enrich handoff, public feedback, SMS/public voice/browser calling, report/export definitions and recovery-action permissions remain pending. |
| Production acceptance | Scheduler/HA/secrets/joint-store recovery, measured capacity/latency/accessibility/security/RPO/RTO and required Phase 8 launch scope must be established and verified in Phase 9. |

## Verification and Limitations

- Latest required full Docker graph passed, exit 0, confirmed 2026-10-15 09:24 +08:00; shared UI and final PBX browser checks also passed. Hosted CI, production traffic/capacity/TLS/HA and joint backing-store rollback/recovery remain separately unverified.
- Native evidence is reported Windows Android acceptance on Android 16/API 36, patch 2025-04-05. Desktop Node 24.13.1 is outside the supported engine; Docker verification used Node 22.23.3. Secure-storage faults are injected around real OS calls; physically locked reads and exact interruption timing are not claimed. Trusted session-clock activity fixtures do not establish responder operations.
- Mounted web work recovery does not persist through refresh; durable incident drafts belong to P5-U4. Staff authentication is complete; full responder/incident workflows remain future work.
- P3-U1 establishes authenticated registry/observation/browser recovery against one controlled development Asterisk. Live configuration apply/recovery, tenant voice readiness, operational call attribution, production deployment and real multi-PBX HA remain unverified/unapproved.
- Draft creation/credential setup does not activate tenants. Controlled active-tenant fixtures prove authentication only.
- Local Garage is single-node development infrastructure; production hosting/TLS/storage recovery and real evidence authorization remain pending. Foundation tenant/permission fixtures do not prove later feature enforcement.
- Private development platform automated checks and Windows sign-in were verified; macOS and that setup's separately requested manual refresh/logout checks were not confirmed. Later automated platform/staff results remain in their own evidence.
- Previously recorded unrelated follow-up: the implementation plan has six source links using an incorrect relative `context/...` prefix. This cleanup preserves the plan; follow-up remains outstanding.

## Recent Session Notes

- 2026-10-15 09:32 +08:00 (Asia/Manila) — Completed P3-U1c and parent P3-U1 after combined real-service/browser/ownership acceptance, durable/process regressions, full Docker graph, shared UI and final maximum-name browser checks. Exact owned fixtures removed; older unrelated database preserved. Normal platform/staff HTTPS ready, their network checks passed and backend live/ready returned 200. P3-U2/U5 handoff documented; configuration apply, tenant voice readiness and production remain incomplete.

## Tracker Maintenance

Keep this file focused on the active unit, next work, concise completed summaries,
unresolved decisions and material limitations. Update state in place at meaningful
checkpoints; keep only recent session notes needed for the current handoff.
At unit or phase completion, append detailed prior checkpoints/older notes to a
dated section in the history and retain current summaries/evidence links here.
Keep archive entries historical; do not copy obsolete pending states back into the
current tracker. Preserve dates, decision sources and relative-link bases when
moving material. This archive split changes documentation organization only.
