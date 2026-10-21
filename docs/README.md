# MyIMS documentation

Authoritative context: [overview](../context/project-overview.md),
[architecture](../context/architecture.md), [UI](../context/ui-context.md),
[standards](../context/code-standards.md), and
[workflow](../context/ai-workflow-rules.md).
Delivery order: [implementation plan](../context/implementation-plan.md).
Observed state: [current progress tracker](../context/progress-tracker.md).
Historical checkpoints: [progress tracker history](../context/progress-tracker-history.md).

P1-U1 review documents (draft, awaiting approval):

- [Foundation scope, P1-U2 handoff and decision register](planning/p1-u1-review-draft.md)
- [Proposed permissions and product contracts](planning/p1-u1-product-contracts.md)
- [Acceptance examples and overview coverage](planning/p1-u1-acceptance-matrix.md)

P1-U2 workspace construction and its required checks are complete.
See [verification evidence](status/p1-u2-evidence.md). See [local setup and checks](../README.md)
and [foundation decisions](architecture/workspace-foundation.md). Operational
features and their guides remain pending. The tracker records actual check results.

Development: [Docker workspace runbook](runbooks/development-container.md)
and [verified results and limits](status/development-container-evidence.md).

Shared infrastructure: [Docker services and Asterisk bootstrap](runbooks/shared-services.md).

Backup platform: [approved Restic architecture/security requirements](architecture/backup-platform.md)
and [minimal installation plan and remaining approval gates](planning/p3-u3a-backup-installation-approval-package.md).
Platform selection is approved; retained execution and production readiness remain gated.

Backend foundation: [startup, migrations and health](runbooks/backend-foundation.md)
and [P1-U3 verification evidence](status/p1-u3-evidence.md).

Web foundation: [P1-U4 feature spec](../context/feature-specs/p1-u4-web-primitives-and-operations-shell.md),
[shared UI conventions](architecture/web-ui-foundation.md) and
[preview and browser checks](runbooks/web-ui.md).

P1-U4 is complete; see [verification evidence and limits](status/p1-u4-evidence.md).

Durability foundation: [P1-U5 parent overview and acceptance matrix](../context/feature-specs/p1-u5-transactional-audit-and-durable-execution.md).
P1-U5a/b/c and the parent acceptance matrix are verified and complete.

Separate P1-U5 implementation specs:

- [P1-U5a — Transactional audit and outbox](../context/feature-specs/p1-u5a-transactional-audit-and-outbox.md)
- [P1-U5b — Durable worker delivery](../context/feature-specs/p1-u5b-durable-worker-delivery.md)
- [P1-U5c — Recovery verification and operational handoff](../context/feature-specs/p1-u5c-recovery-verification-and-operational-handoff.md)

- [Transactional audit/outbox write contract](architecture/transactional-audit-outbox.md)
- [P1-U5a verification evidence](status/p1-u5a-evidence.md)

- [Durable worker delivery contract](architecture/durable-worker-delivery.md)
- [Durable worker runbook](runbooks/durable-workers.md)
- [P1-U5b verification evidence](status/p1-u5b-evidence.md)
- [P1-U5c integrated recovery evidence](status/p1-u5c-evidence.md)

Shared storage foundation: [P1-U6 parent overview and acceptance matrix](../context/feature-specs/p1-u6-shared-file-storage-access.md).
Local Garage provider/setup is approved; P1-U6a is complete and verified.
P1-U6b access is approved: 120-second default, hard 300-second maximum;
implementation and combined recovery verification are complete; parent P1-U6 is complete.

Separate P1-U6 implementation specs, in the adopted sequence:

- [P1-U6a — Shared storage adapter and configuration](../context/feature-specs/p1-u6a-shared-storage-adapter-and-configuration.md)
- [P1-U6b — Tenant-checked references and recovery verification](../context/feature-specs/p1-u6b-tenant-checked-references-and-recovery-verification.md)

- [Shared storage ADR/adapter contract](architecture/shared-storage.md)
- [Storage setup and recovery runbook](runbooks/shared-storage.md)

- [P1-U6a acceptance evidence and limits](status/p1-u6a-evidence.md)

- [P1-U6b access/recovery and parent acceptance evidence](status/p1-u6b-evidence.md)

Identity foundation: [P2-U1 feature spec and sub-unit review](../context/feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md).
P2-U1a/b/c and parent P2-U1 are complete and verified.
[Integrated evidence](status/p2-u1c-evidence.md) maps every parent acceptance criterion.
The user adopted three sequential implementation sub-units;
D-05 storage representation is approved for a; b's scoped role/admission contract
is approved with creator closure. Later bootstrap/session policies and scoped
P2-U4a credential setup/reset/recovery policies have their separately recorded
approvals; those approvals do not complete ordinary staff access.

[P2-U1b role and admission contract — review for approval](planning/p2-u1b-contract-review.md)
records the approved scoped D-01/D-05/D-06 decision and creator-closure revision.

[P2-U1c secure operator bootstrap contract — review for approval](planning/p2-u1c-bootstrap-contract-review.md)
records the approved scoped password policy and initial-account handoff.

Separate P2-U1 implementation specs:

- [P2-U1a — Canonical identity stores and ownership constraints](../context/feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md)
- [P2-U1b — Role contracts and canonical tenancy admission](../context/feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md)
- [P2-U1c — Secure operator bootstrap and foundation handoff](../context/feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md)

- [Canonical identity storage contract and scoped D-05 approval](architecture/canonical-identity-storage.md)

- [P2-U1a acceptance evidence and limits](status/p2-u1a-evidence.md)

- [Canonical authority/admission contract and b handoff](architecture/canonical-authority-admission.md)

- [P2-U1b acceptance evidence and limits](status/p2-u1b-evidence.md)

- [Canonical operator bootstrap and credential handoff](architecture/canonical-operator-bootstrap.md)
- [Initial operator bootstrap runbook](runbooks/operator-bootstrap.md)
- [P2-U1c and parent acceptance evidence](status/p2-u1c-evidence.md)

Session foundation: [P2-U2 parent spec and adopted sub-unit review](../context/feature-specs/p2-u2-shared-session-store-and-authorization-guards.md).
P2-U2a is complete and verified under approved lifecycle/recovery policy with
web 60-minute idle lifetime. P2-U2b is complete and verified; c and parent P2-U2 are complete and verified under approved limiter policy. The user adopted three sequential
implementation sub-units; a's lifecycle/recovery policy is approved and limiter
policy is approved subject to production traffic/capacity validation.
Lifecycle completion does not establish protected HTTP access, sign-in or the
Phase 2 authentication gate.

Separate P2-U2 implementation specs:

- [P2-U2a — Shared session lifecycle and recovery fencing](../context/feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md)
- [P2-U2b — Canonical authority validation and HTTP guards](../context/feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md)
- [P2-U2c — Distributed rate limits and integrated recovery handoff](../context/feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md)

[P2-U2a lifetime/activity review and durable recovery design](planning/p2-u2a-session-contract-review.md)
is prepared; the user approved revised section 1 and durable recovery fencing on 2026-10-06.

- [Shared session lifecycle contract and b/c/UI handoffs](architecture/shared-session-lifecycle.md)
- [Session settings, recovery and verification runbook](runbooks/shared-session-lifecycle.md)

- [P2-U2a lifecycle verification evidence and limits](status/p2-u2a-evidence.md)

- [Canonical HTTP authority and transactional boundary](architecture/canonical-http-authority.md)
- [Two-replica HTTP authority verification](runbooks/canonical-http-authority.md)

- [P2-U2b HTTP authority verification evidence and limits](status/p2-u2b-evidence.md)

- [P2-U2c approved limiter policy and production review conditions](planning/p2-u2c-limiter-contract-review.md)

- [Distributed admission contract and U3/U4 handoff](architecture/distributed-admission.md)
- [Integrated session recovery and capacity/traffic gates](runbooks/session-foundation.md)

- [P2-U2c and parent AC-01–11 integrated evidence](status/p2-u2c-evidence.md)

Platform operator access: [P2-U3 feature spec and adopted split](../context/feature-specs/p2-u3-platform-operator-sign-in.md).
P2-U3a/b and parent P2-U3 are complete and verified. Staff/Phase 2 and production gates remain pending.
Separate P2-U3 implementation specs, in the adopted sequence:

- [P2-U3a — Platform authentication HTTP boundary](../context/feature-specs/p2-u3a-platform-authentication-http-boundary.md)
- [P2-U3b — Platform browser access and isolated reauthentication](../context/feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md)

- [P2-U3b browser implementation and verification evidence](status/p2-u3b-evidence.md)
- [Platform browser access and unfinished-work integration](architecture/platform-browser-access.md)
- [Platform operator sign-in and recovery guide](guides/platform-operator-access.md)
- [Approved private development platform HTTPS access](planning/platform-development-https-access.md)
- [Private development platform HTTPS: server, Windows and macOS commands](runbooks/platform-development-https.md)
- [Private development HTTPS verification and manual test limits](status/platform-development-https-evidence.md)
- [Platform authentication HTTP boundary](architecture/platform-authentication-http.md)
- [Platform authentication operations and browser handoff](runbooks/platform-authentication.md)

- [Platform authentication HTTP acceptance evidence](status/p2-u3a-evidence.md)

## Draft tenant creation

[P4-U1a feature spec and adopted implementation split](../context/feature-specs/p4-u1a-draft-tenant-creation-and-initial-administrator.md)
defines early protected draft creation and its first unset administrator. The
backend API, protected browser and integrated P4-U1a acceptance are verified
complete. Credential setup,
activation and PBX readiness remain with their owning units.

- [P4-U1a-1 — Atomic draft creation and protected registry API](../context/feature-specs/p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md)
- [P4-U1a-2 — Operator browser creation and integrated handoff](../context/feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md)

- [Draft tenant registry API](architecture/draft-tenant-registry-api.md) — protected
  atomic creation, durable attempts, canonical reads and browser handoff.

- [P4-U1a-1 acceptance evidence](status/p4-u1a-1-evidence.md)

- [Protected tenant browser and recovery contract](architecture/draft-tenant-browser.md)
- [Draft tenant operator guide](guides/draft-tenant-creation.md)

- [P4-U1a-2 browser/parent acceptance evidence](status/p4-u1a-2-evidence.md) — verified complete.

Staff access: [P2-U4 feature spec and sub-unit review](../context/feature-specs/p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md).
P2-U4 and a/b/c are complete under the approved policy. Reported Android native
acceptance, production browser acceptance and final full Docker regressions pass. The three-child split is adopted.
[Credential lifecycle contract — review for approval](planning/p2-u4a-credential-contract-review.md)
records the approved G-01–06 decisions.
[Qualified credential lifecycle](architecture/qualified-credential-lifecycle.md)
describes current implementation contracts and verification boundaries.
See the [handoff guide](guides/staff-credential-handoff.md),
[operations runbook](runbooks/staff-credential-lifecycle.md) and
[acceptance evidence](status/p2-u4a-evidence.md).

Separate P2-U4 implementation specs, in sequence:

- [P2-U4a — Qualified credential lifecycle and administrator handoff](../context/feature-specs/p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md)
- [P2-U4b — Staff authentication HTTP and transport boundaries](../context/feature-specs/p2-u4b-staff-authentication-http-and-transport-boundaries.md)
- [P2-U4c — Command-center and mobile access with isolated recovery](../context/feature-specs/p2-u4c-command-center-and-mobile-access-with-isolated-recovery.md)

Staff authentication HTTP: [named transport and c handoff](architecture/staff-authentication-http.md)
and [operations/verification](runbooks/staff-authentication.md). P2-U4b acceptance
is complete; [B-01–09 evidence](status/p2-u4b-evidence.md) records passing focused/full
checks and transport limits. Parent and c are complete.

P2-U4c native preparation: [Pixel_8_API_36 setup and evidence checklist](planning/p2-u4c-android-emulator-preparation.md). Windows Android sign-in/restart/logout and storage fault/cancellation/resume paths have reported device evidence; replica B, reset, response-loss and idle/absolute expiry checks also pass.

[Windows native acceptance execution](runbooks/staff-native-acceptance.md) supplies
the declared mkcert ingress tunnel, separate CA/fault test build and device checks.

Local browser recipient setup: [staff/recipient development HTTPS and desktop tunnel](runbooks/staff-development-https.md) — `https://127.0.0.1:3444/credentials` through private SSH port forwarding, alongside the existing platform console.

Staff consumers: [browser/mobile access guide](guides/staff-access.md), [consumer/storage contract](architecture/staff-access-consumers.md) and [recovery runbook](runbooks/staff-access-recovery.md).

P2-U4c [implementation/evidence checkpoint](status/p2-u4c-evidence.md) records C-01–09 and parent AC-01–12 passes, final regressions, cleanup and declared environment/limits; c/parent are complete.
The [native runbook](runbooks/staff-native-acceptance.md#prepared-active-acceptance-fixture)
also describes the user-authorized active test fixture, private credential handoff,
checks and retirement. Real draft-to-active onboarding remains P4-U3 before login.
Its [remaining acceptance procedure](runbooks/staff-native-acceptance.md#remaining-ab-response-loss-reset-and-expiry-acceptance)
defines the private A/B runtime, response-loss and per-session clock controls,
actual issuer/recipient reset and exact desktop tunnel switch. Preparatory backend
and browser checks do not replace the remaining Android results.

PBX node administration: [P3-U1 feature spec and split review](../context/feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md).
P3-U1a is complete within A-01–07 under [approved scoped connectivity policy](planning/p3-u1a-connectivity-contract-review.md); b is complete within B-01–09 under [conditional development observation approval](planning/p3-u1b-observation-contract-review.md), c and parent P3-U1 are complete within their integrated private-development scope. The user adopted the three-unit split on
2026-10-14 (Asia/Manila, +08:00). Controlled observation, protected secret resolution and development settings are
verified against one isolated Asterisk 22.10.1. Broader AMI `system` permissions
are acknowledged; production and live control remain unapproved.

Separate P3-U1 implementation specs, in sequence:

- [P3-U1a — Protected PBX registry and connectivity contracts](../context/feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md)
- [P3-U1b — Fenced Asterisk observation and recovery](../context/feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md)
- [P3-U1c — Operator PBX browser journey and integrated handoff](../context/feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md)

- [Protected PBX registry contract](architecture/pbx-registry.md)
- [PBX registry operations and checks](runbooks/pbx-registry.md)
- [P3-U1a acceptance evidence](status/p3-u1a-evidence.md)

- [P3-U1b approved local observation policy and permission boundary](planning/p3-u1b-observation-contract-review.md) — conditionally approved for isolated development; production remains unapproved.

- [Fenced PBX observation and replaceable adapter contract](architecture/pbx-observation.md)
- [Local observation provisioning, recovery and checks](runbooks/pbx-observation.md)

- [P3-U1b controlled observation and recovery evidence](status/p3-u1b-evidence.md) — B-01–09 and final full Docker graph passed; real and injected evidence distinguished.

- [PBX console browser contract](architecture/pbx-browser.md)
- [Operator PBX guide](runbooks/pbx-operator-guide.md)
- [P3-U1c integrated evidence](status/p3-u1c-evidence.md)

P3-U2: [Extension inventory and endpoint profiles — feature spec and adopted split](../context/feature-specs/p3-u2-extension-inventory-and-endpoint-profiles.md). P3-U2a is complete within conditional controlled-development number/profile/namespace scope; A-01–07 and required checks passed. All a/b/c and parent acceptance criteria passed under their conditional private-development approvals; the working Asterisk reference is unchanged.

[P3-U2a inventory and endpoint profile contract — conditional approval](planning/p3-u2a-inventory-contract-review.md)
records the user’s controlled-development approval of number/range rules,
node-scoped immutable profiles and generated runtime keys, with atomic bulk/retry
contracts. G-02/credential policy and G-03 mapping/coexistence are conditionally approved
for private development; production and live application remain separately gated.

The user adopted P3-U2's sequential a → b → c split on 2026-10-15
(Asia/Manila, +08:00). All three children and parent P3-U2 are complete within conditional private-development scope:

- [P3-U2a — Protected inventory, profiles and atomic bulk creation](../context/feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md)
- [P3-U2b — Protected endpoint credential lifecycle and recovery](../context/feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md)
- [P3-U2c — Operator inventory browser and integrated handoff](../context/feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md)

[P3-U2b endpoint credential contract — conditional development approval](planning/p3-u2b-credential-contract-review.md)
records approved G-02 generation, OpenBao/process access, no recipient delivery,
retention and recovery/cleanup values. Implementation and B-01–07 real-service acceptance
are complete under controlled private development approval.

P3-U2a controlled-development inventory foundation:

- [Inventory/profile API and transaction contract](architecture/extension-inventory.md)
- [Inventory deployment, recovery and checks](runbooks/extension-inventory.md)
- [P3-U2a acceptance evidence](status/p3-u2a-evidence.md)

P3-U2b conditionally approves a dedicated private persistent verified-TLS OpenBao
service for controlled development only. See the [endpoint credential runbook](runbooks/endpoint-credentials.md)
for process isolation, manual unseal, token custody and deferred production review.

[P3-U2b final implementation and acceptance evidence](status/p3-u2b-evidence.md).

[P3-U2c runtime mapping and controlled acceptance — review for approval](planning/p3-u2c-observation-mapping-contract-review.md)
records conditionally approved G-03 identity/coexistence, no-call fixture, freshness,
trusted test operations and cleanup boundaries for the existing private development
installation only. C-01–07 and parent AC-01–11 passed; implementation and
integrated acceptance are complete within that scope. See [inventory browser contract](architecture/extension-inventory-browser.md)
and [controlled acceptance recovery](runbooks/extension-inventory-browser.md).
[P3-U2c evidence](status/p3-u2c-evidence.md) records actual checks, failures and cleanup;
it reconciles all criteria, required regressions and verified restoration.

P3-U3: [Trunks, gateways and DIDs — parent spec and adopted split](../context/feature-specs/p3-u3-trunks-gateways-and-dids.md). The user adopted the sequential a → b → c split on 2026-10-16 (Asia/Manila, +08:00). a is in progress following the 2026-10-19 definition/OpenBao approvals; b/c remain planned. Concrete provisioning/profile prerequisites, DID identity and remaining removal policy stay with their owning reviews.

- [P3-U3a — Protected trunk and gateway definitions](../context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md)
- [P3-U3b — DID inventory and dependency-safe resource removal](../context/feature-specs/p3-u3b-did-inventory-and-dependency-safe-resource-removal.md)
- [P3-U3c — Operator resource browser and integrated handoff](../context/feature-specs/p3-u3c-operator-resource-browser-and-integrated-handoff.md)

- [P3-U3a trunk/gateway contract — approved private development](planning/p3-u3a-definition-contract-review.md) — approved resource/connection and initial lifecycle policies; authenticated integration requires the approved isolated owner and real evidence.

- [U3A-04 OpenBao trunk credential reuse — approved private development](planning/p3-u3a-openbao-trunk-credential-review.md) — approved isolated import/binding lifecycle, administration remediation and transactional qualification; implementation and real evidence outstanding.

- [P3-U3a-1 — Focused isolated trunk credential lifecycle](../context/feature-specs/p3-u3a-1-isolated-trunk-credential-lifecycle.md) — required refinement before authenticated integration.
- [P3-U3a — Recommended provisioning and test provider profile](planning/p3-u3a-provisioning-and-provider-profile-review.md) — plain-language recommendation, exact synthetic profile, protected custody and conditional one-time recovery procedure; profile/provisioning conditionally approved; one recovery operation subsequently authorized with mandatory safeguards.

Trunk preparation: [owner contract](architecture/trunk-credentials.md) and
[token/provisioning runbook](runbooks/trunk-credentials.md). Conditional private-development
approval and a single-operation recovery authorization are recorded. No trunk
lifecycle or definition acceptance is complete yet.

P3-U3a provisioning checkpoint: [recovery pre-execution report](status/p3-u3a-provisioning-preexecution.md)
records custodian availability, preparation checks, exact maintenance/restoration plan
and the separately granted user authorization. The single operation has executed.
The [custodian succession design](planning/p3-u3a-custodian-succession-review.md)
is approved. The [execution checkpoint](status/p3-u3a-recovery-execution.md) records
resolved fresh custody, consistent backup, revoked root, independently verified
succession and normal restoration. Endpoint regressions passed. A subsequent token-lifetime test requires separate
[hardening review](planning/p3-u3a-token-lifetime-hardening-review.md); full owner/API
acceptance remains outstanding and no repeat recovery is authorized.

P3-U3a disposable-only follow-up: [validation evidence and unresolved findings](status/p3-u3a-disposable-lifetime-validation.md),
[complete-array candidate bodies](planning/p3-u3a-token-lifetime-hardening-array-manifest.json),
and [separate maintenance/backup design](planning/p3-u3a-retained-lifetime-maintenance-proposal.md).
Retained remediation is unapproved; P3-U3a remains incomplete.

P3-U3a named custodian capability verification is **owner-accepted and closed**
within its ten-path scope: [final evidence and limits](status/p3-u3a-retained-capability-session-2.md).
The custodian functions with intended restricted permissions; no further login
is authorized. The [consolidated sustainable OpenBao backup and maintenance design](planning/p3-u3a-sustainable-openbao-administration-design.md)
is prepared for separate review; no administrative implementation is authorized.

P3-U3a local owner foundation: [migration/grants/read-port evidence and limits](status/p3-u3a-trunk-owner-foundation.md).
Real isolated SQL checks and backend build passed; authority-checked commands,
protected worker/provider composition and binding/claim/adoption remain unfinished.
No shared database migration or runtime activation was performed.
