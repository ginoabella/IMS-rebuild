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
