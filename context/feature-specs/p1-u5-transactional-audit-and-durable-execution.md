# P1-U5 — Transactional audit and durable execution

## Status and purpose

This document is the parent overview for the three linked implementation specs.

- **Status:** complete; P1-U5a/b/c verified 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Prepared:** 2026-10-04 18:33 +08:00 (Asia/Manila).
- **Requirement:** [Phase 1, P1-U5](../implementation-plan.md#p1-u5--establish-transactional-audit-and-durable-execution).
- **Goal:** make committed changes traceable and external execution retryable.
- **Completion boundary:** a trusted integration fixture commits a sample change,
  actor-attributed audit and durable work atomically; independent workers execute
  that work safely through duplicates, failures and process interruption.

Authoritative sources are [overview](../project-overview.md),
[architecture](../architecture.md), [UI context](../ui-context.md),
[code standards](../code-standards.md), [workflow](../ai-workflow-rules.md),
and [observed progress](../progress-tracker.md). This specification applies the
existing architecture without adopting deferred P1-U1 product recommendations.
Acceptance criteria below describe required implementation, not verified results.

## Starting state and dependencies

P1-U3 is complete: PostgreSQL/PostGIS, separate Redis services, typed configuration,
deployment-coordinated Prisma/SQL migrations, a restricted `myims_runtime` role,
and backend liveness/readiness exist. P1-U2 provides distinct HTTP, worker,
telephony and deployment entry points and workspace checks. P1-U4 is complete
but contributes no required interface to this backend foundation.

Inspection found an empty worker module with a keep-alive placeholder, no audit
module, no outbox tables and no `pg-boss` dependency. The baseline migration grants
runtime access only to migration metadata; new table permissions belong here.
Recheck that state and prior evidence before implementation. No runtime checks
were repeated while preparing this draft.

P1-U1 remains deferred. Trusted fixture actor references let this unit verify
attribution without creating identity, tenant or incident tables prematurely.
Real actor authentication and feature-specific authorization arrive in their
owning units; a fixture is never proof of those boundaries.

## Scope and ownership

| Boundary | Allowed changes |
| --- | --- |
| `services/backend/src/modules/audit/` | Append-only event contracts, application write port and module-owned SQL repository. |
| Backend infrastructure | Explicit transaction context, outbox persistence/dispatch, bounded execution and structured logging/correlation utilities. |
| Worker entry point | `pg-boss` startup, registered handlers, outbox dispatch, shutdown and recovery. |
| Deployment and database | Versioned audit/outbox SQL, constraints/indexes/grants and coordinated queue-schema provisioning. |
| Shared configuration and testkit | Validated execution settings and integration fixtures with isolated cleanup. Add shared contracts only for an actual consumer. |
| Workspace, Docker and documentation | Required dependency pin/lockfile, worker launch/check wiring, architecture decision, runbook, evidence and tracker. |

Keep feature use cases responsible for their business writes. Audit owns audit
records; infrastructure owns durable transport, not incident or PBX decisions.
Reuse existing database/configuration conventions and deployment locking.
Applications never write audit/outbox/queue tables directly.

Out of scope: identity/session implementations, incident timelines, business
schemas, authenticated sample mutation routes, audit search UI, manual recovery
screens, production monitoring infrastructure, PBX applies, actual Redis socket
fanout, storage and retention-policy implementation. Those remain with their
planned units, including P6-U4, P8-U9, P8-U11 and Phase 9. No web or mobile changes
are required. Do not add a second queue or deployment service.

## Implementation sequence

The user requested three separate feature specs based on the recommended split.
These refine P1-U5 without adding top-level plan units or changing Phase 1 order.
All three subunits are complete and independently/integrally verified.

| Subunit | Dependency | Owned result and parent acceptance coverage |
| --- | --- | --- |
| [P1-U5a — Transactional audit and outbox](p1-u5a-transactional-audit-and-outbox.md) | Verified P1-U3 | Atomic writes, attribution, append-only audit, safe write context; AC-01–03 and write-path portions of AC-08–09. |
| [P1-U5b — Durable worker delivery](p1-u5b-durable-worker-delivery.md) | Verified P1-U5a | Queue provisioning, recoverable handoff, idempotent execution, bounded retries; AC-04–06, end-to-end AC-08 and queue/runtime portions of AC-09. |
| [P1-U5c — Recovery verification and operational handoff](p1-u5c-recovery-verification-and-operational-handoff.md) | Verified P1-U5a/b | Process/database interruption and drain proof, focused command, CI/runbook/evidence; AC-07, AC-10 and integrated confirmation of AC-01–09. |

Detailed contracts live in their owning subunit specs. This parent retains shared
scope and the complete acceptance matrix. Tests and documentation accompany a/b;
c owns the combined recovery proof and final integration. The parent completes
only after all three specs and every parent criterion pass. Retain handoff and
handler idempotency together in b so their crash windows are verified end to end.

## Acceptance and required verification

| ID | Observable result and required check |
| --- | --- |
| AC-01 | Real PostgreSQL commit retains sample change, trusted actor-attributed audit and outbox work; no effect runs before commit. Rollback and forced audit/outbox write failure leave none of them. |
| AC-02 | Invalid actor/scope combinations fail before persistence. Platform actor identity remains tenantless while target scope is retained; tenant staff requires its tenant and system work names its origin. Fixture checks do not claim authentication. |
| AC-03 | Actual runtime-role INSERT succeeds while UPDATE, DELETE, TRUNCATE and attempts to bypass audit protection fail. Privileged test cleanup is isolated from runtime credentials. |
| AC-04 | With workers stopped, committed work persists. Starting a worker delivers it; two dispatchers and a crash in the queue-handoff window lose no work. Handoff status never implies effect success. |
| AC-05 | Sequential and concurrent duplicate jobs yield one durable sample effect. Interruption after sink acceptance before acknowledgement converges using the same idempotency key. Unrelated work/tenant keys remain independent. |
| AC-06 | Eligible failures retry with bounded attempts/backoff, permanent or malformed work fails explicitly, and exhausted retries retain inspectable failure evidence without a successful result. |
| AC-07 | Kill/restart an active worker and interrupt PostgreSQL, then restore them. Pending/in-flight work recovers, completed work does not multiply effects, and failed work remains visible. Graceful shutdown drains or leaves recoverable work within its bound. |
| AC-08 | Initiating actor and correlation remain traceable across writes, dispatch, retries and outcomes. Captured logs, audit and job payloads contain no synthetic secret/personal-data sentinels. |
| AC-09 | Fresh deployment and migration rerun provision tables and queue schema; HTTP and workers never migrate or start another entry point. Invalid settings fail clearly; runtime credentials cannot perform deployment DDL. |
| AC-10 | Required workspace/foundation checks and focused integration command pass in Docker. Documentation covers ownership, guarantees, commands, failure/recovery, retained evidence and limitations. |

Use real PostgreSQL/PostGIS and independent OS worker processes for transactional,
permission, concurrency and restart checks. A deterministic test sink proves the
declared delivery/idempotency boundary; it does not verify Asterisk, SMS, object
storage or production HA. Avoid uncontrolled timing: use explicit barriers and
bounded polling around crash points. Isolate fixtures and never clear real audit
history to reset a test.

During implementation add one short focused check command, provisionally
`./dev exec pnpm check:durability`, and wire it into the foundation check sequence
and CI after its dependencies can be provisioned. P1-U5c added and verified this command.
Run it plus existing `./dev check`; record actual commands, environment, assertions,
results and limits in evidence. Documentation-only preparation requires link,
scope/acceptance consistency and whitespace checks, not runtime tests.

## Decisions and remaining work

No deferred product decision currently blocks this foundation draft. Resolve
compatible dependency version, transaction API, handoff method, durable result
ownership, runtime grants and bounded settings as routine implementation choices;
record lasting decisions and consult current official library documentation before
using version-specific APIs. Do not assume library capabilities from this spec.

Retention periods, user-facing recovery permissions, live external idempotency
and production targets remain with their owning units and decisions. Preserve
audit and failed-work evidence here rather than inventing deletion policy.
Before implementation, record the active subunit, baseline and required checks.
Drafting this document does not start or complete P1-U5 runtime implementation.


## Observed parent completion

All AC-01–10 passed through `./dev exec pnpm check:durability` and `./dev check`
in Docker with real PostgreSQL/PostGIS and independent workers. The
[integrated evidence](../../docs/status/p1-u5c-evidence.md) records commands,
recovery fixes, durable snapshots, operational handoff and limits. Completion
applies to the trusted fixture foundation, not authenticated domain actions,
production HA or live external effects.
