# P1-U6a — Shared storage adapter and configuration

## Status and purpose

- **Status:** complete; 2026-10-05 09:43 +08:00 (Asia/Manila).
- **Prepared:** 2026-10-05 (Asia/Manila).
- **Requirement:** [P1-U6 parent scope and acceptance matrix](p1-u6-shared-file-storage-access.md).
- **Goal:** provide a private shared object-storage adapter that independent backend
  processes can use without relying on application replica disk.
- **Completion boundary:** process A writes a disposable artifact, process B reads
  identical bytes, and restart/interruption checks preserve the documented result.

The user adopted the two-spec split and subsequently approved local Garage with private Docker storage and
internal HTTP; runtime implementation is now authorized. The parent owns shared
scope, exclusions and the complete acceptance matrix; this spec owns the provider
contract. Required behavior below is not verification evidence.

## Starting state and dependencies

P1-U3 provides shared containers, configuration, coordinated deployment and health.
P1-U2 provides entry-point isolation and Docker checks. Existing inspection found no
storage adapter/configuration/service. Recheck those boundaries and prior evidence
before implementation. P1-U5 safe logging conventions can be reused without adding
storage jobs or business schemas.

Depend on the approved provider/setup portion of D-10: provider/API, development
environment, private resources, endpoint, credential source/privileges and transport
policy. Supply operator-managed access if a hosted environment is selected. The
access mechanism and lifetime remain prerequisites for P1-U6b. Neither fixture tenant
IDs nor deferred product proposals constitute provider/access approval.

## Scope and ownership

Allowed changes: backend storage infrastructure and provider port/adapter,
`packages/config`, backend credential loading, trusted provisioning, approved Docker
resources, necessary pinned SDK, isolated testkit/checks and supporting ADR/runbook.
Keep provider-specific types server-side and outside domain contracts.

Do not add access routes, tenant/incident/attachment tables, screens, evidence upload
policy, reference issuance use cases, cleanup schedules or production infrastructure.
P1-U6b owns tenant-checked reference issuance. Business modules will own artifact
metadata, permission and lifecycle; raw recordings remain Asterisk-owned.

## Provider contract

Expose the smallest typed port needed for bounded writes, reads and availability
inspection. Fixture deletion is limited to an isolated test namespace and does not
implement application retention. Exact method shapes follow the approved provider.
P1-U6b adds provider signing support if required by its approved access design.

Resolve endpoint and bucket/container from trusted configuration. Generate opaque
object identities internally and preserve their owning scope. Reject invalid keys or
unsupported operations before provider calls. Untrusted filenames or URLs cannot
select paths, endpoints or SDK request options. A tenant prefix is not authorization;
this low-level port is available only to trusted backend callers.

Bound byte sizes, concurrency, timeout and retry attempts. Retry only eligible
failures, propagate cancellation where supported and release streams/connections.
Document overwrite/conflict behavior and how the adapter verifies the assigned
object identity and bytes after an ambiguous write. A timeout after possible provider
acceptance does not prove absence. Reconcile using the same key rather than blindly
creating another artifact; do not claim universal exactly-once external effects.

Map invalid input, missing objects, forbidden provider operations, timeout and
unavailability into stable safe outcomes. Provider failure is distinct from missing
data and never becomes success. Do not expose raw SDK errors, credential-bearing
endpoints, artifact bytes or secrets in logs/errors/evidence. Use safe correlation
and fixed outcome codes with existing logging conventions.

Storage is external to PostgreSQL transactions. Future business consumers own
metadata state and partial-completion recovery; retryable external work follows
committed-decision/durable-execution conventions where required. This unit does not
add a queue or a sample metadata system.

## Configuration and provisioning

Record the approved provider/setup in a storage ADR under `docs/architecture`,
including local verification limits and the access decisions still pending for b.
Validate required settings before a storage-enabled process starts, with explicit
optional wiring for entry points without a storage consumer. Credentials use
established server-only secret-loading conventions. Clients receive no SDK/admin
credentials.

Provision private resources through trusted deployment tooling with rerun-safe
behavior. HTTP never provisions/migrates, starts workers or obtains administration
privileges. Anonymous direct reads fail. The runtime identity has only required
artifact operations; fixture cleanup uses appropriate isolated credentials.

Record whether storage affects readiness and verify that policy. Liveness remains
process-only. Ordinary stops retain data. Service-managed provider volumes are
acceptable for an approved development service; application replica disk is never
authoritative storage and cannot serve as an outage fallback.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| A-01 | Provider/setup ADR records approved decisions, private resource ownership, privileges, transport, development environment and remaining access/production gates. | AC-01 provider portion |
| A-02 | Independent OS processes with isolated application directories write/read identical fixture bytes; restarting the writer retains access without a shared application filesystem. | AC-02 |
| A-03 | Invalid keys fail before a provider call; actual anonymous direct reads fail. Missing objects have a distinct safe outcome from forbidden operations, timeout and provider outage. | AC-03 private-access portion; AC-05 provider portion |
| A-04 | Interrupt write/read access, restore it and reconcile/retry with the same assigned identity. Correct bytes remain retrievable; no false success, accidental extra artifact or disk fallback occurs. | AC-06 provider portion |
| A-05 | Missing/invalid enabled-storage settings fail safely; credentials and synthetic content sentinels are absent from captured logs/errors/evidence and client-visible configuration. | AC-07 provider portion |
| A-06 | Fresh provisioning and rerun work; provider/process restart retains data. Runtime lacks provisioning privileges, entry-point isolation holds and the documented health policy passes. | AC-08 provider portion |
| A-07 | Focused adapter checks and existing Docker checks pass; ADR, setup/recovery runbook and evidence identify exact commands, environment and limitations. | AC-09 scoped checks/docs; b owns parent integration |

Use the approved real provider or approved local protocol implementation for adapter
checks, with unique namespaces and bounded failure barriers/polling. Test doubles
can verify validation/error mapping, not provider persistence or access enforcement.
Use isolated teardown without deleting other runs' data. Local integration does not
prove hosted-provider availability, production HA or backup/restore.

Add the adapter portion of a focused check command, provisionally
`./dev exec pnpm check:storage`, and provision its resources reproducibly before
appropriate CI/foundation wiring. Run it plus `./dev check` and record evidence.
P1-U6b extends this same command with the complete access/recovery matrix.
Documentation-only preparation needs consistency, link and whitespace checks.

## Completion and handoff

Complete a only when A-01–07 pass and the tracker records evidence and limitations.
Hand b the approved configuration/provisioning, typed storage port, object-identity
and reconciliation contract, safe outcomes, private fixture environment and focused
checks. Adapter completion does not complete parent P1-U6 or tenant authorization.
Provider/setup approval has arrived for local Garage; no hosted access is required.
P1-U6b access approval remains pending. Record/recheck the baseline and active unit before beginning implementation.

A-01–07 passed with focused, fresh-provider, client-sentinel and full Docker checks.
See [implementation evidence and limits](../../docs/status/p1-u6a-evidence.md).
