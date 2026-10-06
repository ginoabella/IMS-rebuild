# MyIMS documentation

Authoritative context: [overview](../context/project-overview.md),
[architecture](../context/architecture.md), [UI](../context/ui-context.md),
[standards](../context/code-standards.md), and
[workflow](../context/ai-workflow-rules.md).
Delivery order: [implementation plan](../context/implementation-plan.md).
Observed state: [progress tracker](../context/progress-tracker.md).

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
is approved with creator closure. Other credential/lifecycle decisions remain pending.

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
