# P1-U6 — Shared file storage access

## Status and purpose

- **Status:** parent overview for two adopted implementation specs; implementation
  in progress; P1-U6a complete, local Garage setup approved, P1-U6b access decision pending.
- **Prepared:** 2026-10-05 08:24 +08:00 (Asia/Manila).
- **Requirement:** [Phase 1, P1-U6](../implementation-plan.md#p1-u6--establish-shared-file-storage-access).
- **Goal:** provide one shared object-storage boundary before evidence features use it.
- **Completion boundary:** independent backend processes store and retrieve a
  disposable test artifact from the same provider; a trusted access context can
  obtain an expiring reference only after the artifact's tenant ownership is checked.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md),
and [progress](../progress-tracker.md). Acceptance below describes required
behavior, not observed implementation. This draft does not approve D-10 or start
runtime implementation.

## Starting state and dependencies

P1-U3 is complete: shared containers, typed configuration, deployment-coordinated
migrations, restricted runtime credentials and backend health exist. P1-U2
establishes separate entry points and Docker checks. P1-U5 is complete and supplies
safe correlation/logging plus durable execution conventions for future consumers.
P1-U6's required plan dependency remains P1-U3; it need not introduce jobs merely
because the worker foundation exists.

Source inspection found no object-storage adapter, storage configuration or
storage service in the current foundation. Configuration is owned by
`packages/config` and backend infrastructure; lasting foundation decisions currently
live under `docs/architecture`. Recheck source and previous evidence before
implementation. No runtime checks were repeated for this draft.

P2 identities/tenancy and P8 evidence metadata do not yet exist. Use an isolated,
trusted fixture mapping artifact IDs to tenant IDs for foundation verification.
Do not create tenant, incident or attachment tables to make this fixture work.
Fixture ownership checks prove the access-port contract, not authenticated HTTP
authorization or database tenant foreign keys. Real consumers must resolve
canonical ownership and enforce their role/session policies in their owning units.

## Scope and ownership

| Boundary | Allowed changes |
| --- | --- |
| Backend infrastructure | Small object-storage port, provider adapter, tenant-checked reference access service, safe error mapping and bounded calls. |
| `packages/config` and backend configuration | Validated storage settings and server-only credential loading using established conventions. |
| Deployment / Docker | Approved provider provisioning, private bucket/container and credentials; local shared service only if required by the approved decision. |
| `packages/testkit` and backend checks | Isolated artifacts, trusted ownership fixtures, two-process access, expiry and interruption checks. |
| Workspace / CI / documentation | Necessary pinned SDK, focused check wiring, storage ADR, runbook, evidence and tracker. |

Business modules retain authoritative artifact ownership, metadata, permissions
and lifecycle. Infrastructure translates authorized operations into provider calls.
Keep provider types and credentials out of domain contracts and client bundles.
Use `packages/contracts` only if an actual transport consumer needs a schema;
foundation-only interfaces may remain backend-owned.

Out of scope: public upload/download routes, browser/mobile screens, incident
attachments, file-type/size policy, malware scanning, recording synchronization,
public reporter access, production HA/capacity, retention schedules and cleanup
jobs. P8-U1 owns evidence upload/metadata/access workflows, P8-U2 owns recording
references, P8-U11 owns retention and Phase 9 owns production recovery objectives.
Raw recordings remain Asterisk-owned. There is no replica-local disk fallback.

## Contract ownership

Detailed implementation contracts live in the child specs:

- [P1-U6a](p1-u6a-shared-storage-adapter-and-configuration.md) owns provider
  operations, object identity, ambiguous-write reconciliation, configuration,
  private resource provisioning and adapter verification.
- [P1-U6b](p1-u6b-tenant-checked-references-and-recovery-verification.md) owns
  ownership/permission ports, reference issuance, expiry/revocation semantics,
  sensitive-reference handling and combined recovery verification.

Both inherit this parent's scope and exclusions. References must be tenant-checked
before issuance; credentials and signed references remain sensitive. Private shared
storage never falls back to application replica disk. Foundation fixtures do not
prove real identity, evidence access or production readiness.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Approved storage/access ADR records the provider, credentials, endpoint, private access, expiry/revocation semantics, development setup and remaining production decisions. No pending proposal is represented as approved. |
| AC-02 | Process A writes known fixture bytes; independent process B retrieves the same bytes from shared storage. Restart A and repeat successfully without a shared application filesystem. |
| AC-03 | Two trusted tenant fixtures receive only their own artifacts. Foreign, missing ownership, invalid key and denied-permission cases fail before provider reads/signing; direct anonymous access is denied. |
| AC-04 | An authorized reference retrieves the intended bytes before expiry and fails on a new request after expiry. Altered object/signature/expiry fails; excess or invalid requested lifetime is rejected or bounded according to the documented contract. |
| AC-05 | Missing object produces the defined missing outcome; unavailable provider and timed-out requests produce bounded, safe failures. Signing alone is never described as proof that an object exists or is retrievable. |
| AC-06 | Interrupt provider access during write/read, restore it and retry/reconcile with the assigned object identity. Retrieved bytes remain correct; no false success or silent disk fallback occurs. Ambiguous write outcomes follow the documented recovery contract. |
| AC-07 | Invalid/missing enabled-storage configuration fails safely. Credentials, synthetic sensitive artifact content and signed references are absent from captured logs/errors/evidence and client-visible configuration. |
| AC-08 | Fresh setup and provisioning rerun work; ordinary service/process restart retains artifacts. Provisioning privileges are unavailable to HTTP runtime; entry-point isolation and the documented health policy hold. |
| AC-09 | Focused storage checks and existing required Docker checks pass. Runbook covers setup, safe diagnostics, expiry, outages, recovery and isolated teardown; evidence records the provider/environment and limits. |

Use the approved real provider or approved local implementation of its protocol
for adapter integration. Test doubles may verify access ordering and error mapping;
they do not prove provider signing, expiry or availability. Run two independent OS
processes with isolated application directories. Use unique fixture namespaces and
bounded polling/barriers for interruption and expiry; never delete another run's data.
Expiry means rejection of new requests after expiry, not withdrawal of bytes already
downloaded or guaranteed cancellation of an established stream.

During implementation add a focused command, provisionally
`./dev exec pnpm check:storage`, and integrate it into appropriate foundation/CI
checks after resource provisioning is reproducible. Run it and `./dev check`;
record actual commands, assertions, results and limitations in evidence. Local
protocol checks do not prove a hosted provider, production HA, backup/restore or
authenticated evidence access. Documentation preparation requires consistency,
relative-link and whitespace review, not application runtime tests.

## Implementation sequence

The user adopted **two sequential implementation units** within P1-U6. Provider integration
can be verified independently from the access-policy boundary. Keep access issuance,
expiry and failure/recovery proof together so the second unit demonstrates the
complete foundation path. Tests and documentation accompany both; a separate
documentation-only implementation unit is unnecessary.

| Unit | Starting dependency and scope | Expected result / verification |
| --- | --- | --- |
| [P1-U6a — Shared storage adapter and configuration](p1-u6a-shared-storage-adapter-and-configuration.md) | Verified P1-U3 plus approved provider/setup decision; ADR, provider adapter, typed settings, private resources and provisioning. | Real-provider two-process write/read and restart, private access, safe configuration/errors and write reconciliation. Owns AC-01 provider portions, AC-02, provider portions of AC-05–08 and its focused checks/docs. |
| [P1-U6b — Tenant-checked references and recovery verification](p1-u6b-tenant-checked-references-and-recovery-verification.md) | Verified P1-U6a plus approved access/expiry decision; access ports, ownership fixture, signing, expiry, integrated outage checks and final handoff. | Authorized artifact reference works; foreign and expired access fail; outage recovery and sensitive-data checks pass. Owns AC-01 access portions, AC-03–04, integrated AC-05–08 and AC-09. |

These specs refine P1-U6 without changing top-level plan IDs or Phase 1 order.
The split itself did not approve D-10. Subsequent explicit user approval selected
local Garage with private Docker storage and internal HTTP; P1-U6a is complete
and P1-U6b remains planned. The parent completes only after both child specs and every AC pass. Completion of a proves provider integration;
it does not imply completion of tenant-checked access or the parent. Do not split
provider writes from their ambiguous-outcome recovery, or signing from ownership
checks and expiry verification.

## Decision gate and next implementation step

The user owns [D-10](../../docs/planning/p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation).
Before dependent implementation, record the approved storage provider/development
environment, private access and credential model, reference delivery mechanism,
maximum lifetime and revocation expectations in a storage ADR. Operator-supplied
access is required for a hosted environment; no credentials or infrastructure
availability are assumed. Local Garage setup is now approved in the
[storage ADR](../../docs/architecture/shared-storage.md); numerical lifetime and
revocation remain pending for P1-U6b.

D-10 also includes later file-policy, retention and recovery decisions. P1-U6 does
not implement those behaviors; record their remaining gates for P8-U1–U2, P8-U11
and P9-U1 rather than silently choosing defaults. Provider/access approval permits
the foundation only, not those later product decisions. If approval requires a
capability from a later unit, record the dependency and resume condition before
implementation rather than replacing it with a fixture claim.

Local Garage provider/setup is approved and P1-U6a is complete with
[verified evidence](../../docs/status/p1-u6a-evidence.md).
P1-U6b waits for its access decision; recheck the baseline, record the active
unit and required checks, and begin the adopted first implementation boundary.
