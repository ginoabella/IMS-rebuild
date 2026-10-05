# Progress Tracker



## Current Goal

Deliver MyIMS according to [implementation-plan.md](implementation-plan.md),
using its nine phases and numbered implementation units. The delivery plan exists;
P1-U2 is complete: workspace, app skeletons and required quality checks pass.
P1-U3 is complete: shared services, baseline migrations, typed backend
configuration and health are verified. P1-U4 is complete: shared web primitives
and distinct platform/command-center shells are verified. P1-U5a transactional audit/outbox and P1-U5b durable worker delivery are complete;
P1-U5c recovery verification/operational handoff and parent P1-U5 are complete.
P1-U6a shared storage adapter/configuration is complete with user-approved local
Garage. P1-U6b tenant-checked references/recovery and parent P1-U6 are complete:
120-second default, hard 300-second ceiling and full local acceptance verified.
Real identity/evidence authorization and later production decisions remain pending.
Follow the agreed [build, review, improve process](ai-workflow-rules.md#build-review-improve):
small working steps, routine choices handled by the agent, user feedback on results,
and short questions only when a feature needs a decision.
The user requested a simpler process and to start building on 2026-10-04; this
authorizes routine foundation choices, not approval of proposed product rules.


## Completed

- P1-U6b and parent P1-U6 tenant-checked GET references and recovery: canonical
  ownership/permission ports, 120-second default/hard 300-second ceiling, real
  Garage expiry/tampering and integrated outage/restart matrix; focused and full
  Docker checks passed. See [P1-U6b evidence](../docs/status/p1-u6b-evidence.md).

- P1-U6a private Garage provider, bounded shared adapter, optional configuration,
  trusted provisioning and same-identity recovery: real-provider independent
  process, restart/outage, privilege and client-sentinel checks plus full Docker
  checks passed. See [P1-U6a evidence](../docs/status/p1-u6a-evidence.md).

- P1-U5c and parent P1-U5 recovery/operational handoff: integrated real-PostgreSQL
  process/outage/drain matrix, focused command, CI wiring and full Docker checks
  passed. See [P1-U5c evidence](../docs/status/p1-u5c-evidence.md).

- P1-U5b durable pg-boss workers, atomic queue handoff, idempotent sample delivery,
  bounded retries and retained outcomes; focused PostgreSQL and full Docker checks
  passed. See [P1-U5b evidence](../docs/status/p1-u5b-evidence.md).

- P1-U5a transactional audit/outbox, trusted attribution, append-only runtime
  protections and safe logging; focused PostgreSQL and full Docker checks passed.
  See [P1-U5a evidence](../docs/status/p1-u5a-evidence.md).

- P1-U4 shared theme, accessible primitives and platform/command-center shells;
  all 12 production browser checks and full workspace/foundation checks passed.
  See [P1-U4 evidence](../docs/status/p1-u4-evidence.md).

- P1-U2 workspace and quality checks; detailed evidence and limitations are recorded
  in its checkpoint below and `docs/status/p1-u2-evidence.md`.

- P1-U3 shared services, baseline migration, typed configuration and backend
  health; complete Docker checks and acceptance rehearsal passed. See
  `docs/status/p1-u3-evidence.md` and its checkpoint below.

- Created the implementation plan from the project overview and required context.
  Each unit defines its goal, scope, dependencies, result/acceptance criteria, and
  verification. The plan maps all ten overview success criteria to delivery units.
  This is documentation completion only, not completion of application units.


## In Progress

None. P1-U6b and parent P1-U6 completed 2026-10-05 10:52 +08:00 (Asia/Manila).

## Unit Checkpoints

### P1-U1 — Delivery contracts and decision gates

- **Status:** deferred by user reprioritization; draft retained, product approval pending.
- **Requirement:** implementation plan P1-U1 and overview goals 1–5.
- **Scope:** foundation agreement, proposed product contracts, acceptance matrix,
  decision register, documentation index and tracker; documentation only.
- **Acceptance:** approved role/transition/closure/eligibility/category/credential
  contracts; every unresolved decision has owner, affected units and resume
  condition; review overview coverage. See the
  [review draft](../docs/planning/p1-u1-review-draft.md).
- **Completed:** reviewable foundation scope and P1-U2 boundary; recommendations
  D-01–D-08; explicit later gates D-09–D-13; acceptance examples and overview mapping.
- **Remaining:** user approval/modifications, synchronize approved authoritative
  context and decision records, reconcile the matrix; then complete or record a
  partial handoff. No recommendations are adopted as approved behavior.
- **Required checks:** documentation consistency and relative-link review, decision
  owner/unit/resume-condition coverage, all ten success criteria mapped. Runtime
  checks do not apply to this draft.
- **Verification:** source context reviewed; Python relative-file-link review passed
  across five documents, D-01–D-13 coverage and all ten overview success-criteria
  mappings passed; `git diff --check` passed. No application/PBX/device behavior verified.
- **Decision gate:** F-01/F-02 foundation agreement before P1-U2. F-03 defines the
  proposed switch if full P1-U1 contracts remain unanswered. User owns decisions.
- **Resume:** incorporate explicit review answers; dependent product units wait
  for their decision IDs. The user has authorized starting the independent P1-U2 foundation. Product
  decisions remain pending and block their dependent features.


### P1-U2 — Workspace and quality checks

- **Status:** complete.
- **Completion date:** 2026-10-04 (Asia/Manila); explicitly confirmed in the tracker at the user's request.
- **Requirement:** implementation plan P1-U2; existing architecture boundaries.
- **Scope:** five application skeletons, four shared packages, independent NestJS
  entry points, pinned pnpm/Node, strict TypeScript, lint/format/build graph, CI, docs.
- **Acceptance:** fresh frozen install; all app/package checks; web placeholder
  rendering; Android/iOS bundle generation; isolated process startup and shutdown.
- **Required checks:** `pnpm install --frozen-lockfile`, `pnpm check`, clean-copy
  rehearsal and web HTTP smoke. Native device integration belongs to later units.
- **Completed:** five apps, four packages, independent backend entry points,
  pinned dependency install, checks, CI definition, setup documentation and decision
  record. `pnpm check` passed in the workspace and a clean source-only copy after
  frozen installation. All three production web HTTP checks passed. Android and
  iOS bundle artifacts exist for both mobile apps.
- **Verification:** see [P1-U2 evidence](../docs/status/p1-u2-evidence.md) for
  commands, environment, clean-copy procedure and limitations.
- **Remaining:** none within P1-U2. CI execution and native-device/operational
  integration have not been claimed. Database/health belong to P1-U3.
- **Decisions:** user requested starting development with a simpler process.
  Follow F-01/F-02's architecture-aligned foundation with pnpm ordering; defer
  P1-U1's product rules. No application behavior is approved by that switch.

### P1-U3 — Shared services and baseline database

- **Status:** complete; 2026-10-04 16:56 +08:00 (Asia/Manila).
- **Requirement:** implementation plan P1-U3 and user request to run shared
  services, including Asterisk, in Docker without installing their runtimes locally.
- **Scope:** Compose, persistence/secrets, PostGIS baseline SQL migration with
  Prisma history, coordinated deployment, typed configuration, backend connections
  and liveness/readiness. Asterisk scope is runtime bootstrap only.
- **Acceptance:** `./dev up` starts database/backend, applies the baseline through
  deployment and waits for readiness. Invalid configuration fails clearly; HTTP
  does not migrate. No feature tables are seeded. Dependencies recover after outage.
- **Required checks:** `./dev up`, `./dev check`, `./dev health`; prior shared-service
  stop/start persistence, authentication and Redis isolation checks.
- **Completed:** four shared services, Docker workspace and separate backend;
  PostGIS migration, restricted runtime role, distinct deployment/runtime secrets,
  configuration validation and bounded dependency health checks. Full workspace
  lint/format/types/builds, entry-point/configuration checks and live foundation
  rehearsal passed. Concurrent migration, rerun, runtime privileges, fresh database,
  each dependency outage/recovery and backend restart all passed.
- **Verification:** [full P1-U3 evidence](../docs/status/p1-u3-evidence.md) and
  [shared-container evidence](../docs/status/p1-u3-shared-services-evidence.md).
  Documented startup rerun with frozen install and automatic backend readiness
  passed. Hosted CI, production HA, native devices and live PBX calls are unverified.
- **Remaining:** none within P1-U3. Domain schemas, sessions, jobs, PBX
  administration and operational features belong to their planned units.
- **Decisions:** loopback service/backend ports, separate Redis services,
  digest-pinned images and deployment-only migrations. Runtime backend mounts
  exclude migration secrets and host credential directory. Product gates remain pending.

### Docker development workspace — Approved foundation increment

- **Status:** complete; P1-U3 overall remains in progress.
- **Requirement:** user's approval to containerize the development platform and document it.
- **Scope:** pinned Node/pnpm workspace, separate dependency/cache volumes, host
  launcher, Dev Containers configuration, Docker-based CI workflow and runbook.
- **Acceptance:** develop/check without host Node/pnpm; source reloads in the web
  app; backend is reachable through its published port; service data is retained.
- **Verification:** complete `./dev check` passed in Docker, web/backend smoke and
  source reload passed, service networking/authentication and credential lifecycle
  passed. [Detailed evidence and limits](../docs/status/development-container-evidence.md).
- **Decisions:** default container web ports 3100–3102 and backend 4100; retain the
  optional host workflow; mobile device/emulator tooling remains external.

### P1-U4 — Web primitives and operations shell

- **Status:** complete; 2026-10-04 18:18 +08:00 (Asia/Manila).
- **Requirement:** implementation plan P1-U4; existing UI context and P1-U2.
- **Scope and acceptance:** [feature spec](feature-specs/p1-u4-web-primitives-and-operations-shell.md)
  defines shared theme, accessible primitives, distinct app shells and AC-01–09.
- **Delivery sequence:** user-approved P1-U4a shared theme, P1-U4b accessible
  primitives, P1-U4c app shells/final integration; all three are complete.
- **Completed:** shared tokens/local fonts, Tailwind/PostCSS pipeline, ESM UI
  exports, native controls and Radix overlays/tabs/menus, interactive previews,
  distinct app-owned navigation/homes, responsive shells, browser checks and CI wiring.
- **Required checks:** `./dev check` sequence and `./dev exec pnpm check:ui`,
  keyboard/contrast/responsive and visual review.
- **Verification:** full workspace and backend-foundation sequence passed with
  logged exit status 0 after terminal interruptions; 12 production browser checks
  passed. Desktop/tablet/narrow, 320px reflow, 200% CSS zoom, invalid-input state,
  focus and reduced-motion checks passed. Documentation links and whitespace passed.
  Commands, artifacts and limits are in [P1-U4 evidence](../docs/status/p1-u4-evidence.md).
- **Decisions:** local Fontsource assets, shared ESM/CSS exports, manual shadcn
  composition conventions, and Webpack development after a stale-route Turbopack
  panic. Use elevated error surfaces and stronger control borders for contrast.
- **Remaining:** none within P1-U4. Authentication, operational data and domain
  actions remain with their later units. Hosted CI, native device/screen-reader
  checks and production accessibility certification are unverified; deferred
  product decisions remain unapproved.

### P1-U5 — Transactional audit and durable execution

- **Status:** complete; 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Requirement:** Phase 1 P1-U5; dependency P1-U3 is complete.
- **Scope and acceptance:** [parent feature spec](feature-specs/p1-u5-transactional-audit-and-durable-execution.md)
  and its a/b/c subunits define AC-01–10.
- **Completed:** atomic sample/audit/outbox writes, trusted context, append-only
  runtime protections, coordinated pg-boss provisioning/handoff, idempotent
  delivery, bounded retries, retained results, process/database recovery and
  bounded drain; operational runbook, architecture decisions and CI integration.
- **Required checks and verification:** `./dev exec pnpm check:durability` and
  `./dev check` passed with exit status 0. Real PostgreSQL/PostGIS and independent
  workers passed the full AC-01–10 matrix. Two Docker replicas reported ready with
  no published ports and drained to exit 0; HTTP health stayed 200. See
  [integrated evidence](../docs/status/p1-u5c-evidence.md) and its retained snapshots.
- **Decisions:** pg-boss 10.4.2/schema 24, shared-transaction handoff, retained
  result/receipt ownership, safe checked-out client errors, awaited public queue
  pull/ack APIs and shared shutdown deadline; see
  [worker contract](../docs/architecture/durable-worker-delivery.md).
- **Remaining:** none within this foundation boundary. Authentication, actual
  adapters, retention/manual recovery permissions and production HA remain with
  their owning units. The isolated connection outage does not prove server crash,
  disk recovery or live PBX/SMS/storage behavior. Hosted CI execution is unverified.

### P1-U5a — Transactional audit and outbox

- **Status:** complete; 2026-10-04 19:11 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5a-transactional-audit-and-outbox.md)
  owns the detailed boundary and scoped parent acceptance criteria.
- **Completed:** explicit same-connection transaction handle; immutable trusted
  actor/target context; event-specific safe metadata/payload validation; audit write
  port and SQL repository; outbox repository; versioned constraints/indexes/grants;
  safe structured logging/correlation and disposable database fixture checks.
- **Required checks and verification:** `./dev exec pnpm check:audit-outbox` and
  `./dev check` passed with exit status 0. Real PostgreSQL commit/open-transaction
  invisibility, rollback, independent audit/outbox failures, caught-error rollback,
  attribution/SQL constraints, actual runtime INSERT and append-only/bypass denial,
  sentinel exclusion, fresh/rerun migrations and existing configuration/entry-point
  isolation checks passed. `./dev migrate` and `./dev health` passed.
  [Commands, assertions and limitations](../docs/status/p1-u5a-evidence.md).
- **Decisions:** module-owned SQL, frozen actor scope separate from target scope,
  code-owned primitive field allowlists, database timestamps, immutable outbox
  intent and separately mutable pending/accepted handoff. See the
  [write contract](../docs/architecture/transactional-audit-outbox.md).
- **Remaining:** none within P1-U5a. Authentication/domain authorization remain
  with P2/domain units. Worker delivery and integrated recovery/CI wiring are now verified in P1-U5b/c;
  parent P1-U5 is complete.

### P1-U5b — Durable worker delivery

- **Status:** complete; 2026-10-04 19:45 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5b-durable-worker-delivery.md)
  owns the detailed boundary and scoped parent acceptance criteria.
- **Completed:** pinned pg-boss 10.4.2, deployment-owned schema provisioning,
  atomic queue/outbox handoff, independent worker, retained results/receipts and
  durable sample sink. Worker settings and runtime grants are bounded.
- **Completed verification:** real PostgreSQL handoff crash barriers, two OS
  workers, restart-safe sink acknowledgement, duplicate delivery, bounded retry,
  terminal failures, scoped keys and safe logging passed. Audit/outbox regressions
  passed; two runtime-only Docker replicas reported ready with no published ports.
  Added worker contract, settings/startup/recovery runbook and safe status command.
- **Verification:** `./dev exec pnpm check:worker-delivery`,
  `./dev exec pnpm check:audit-outbox`, frozen install and `./dev check` passed
  with exit status 0. Timeout exhaustion, isolated PostgreSQL connectivity
  interruption/backoff, actor/correlation traces, sentinel exclusion and runtime
  permissions passed. Both Docker replicas drained and exited 0; HTTP remained ready.
  Scoped lint/format, documentation links and whitespace passed.
  [Commands, assertions and limitations](../docs/status/p1-u5b-evidence.md).
- **Decisions:** atomic handoff through pg-boss same-connection adapter; scoped
  tenant/work-type keys; queue owns scheduling, retained outcomes own execution
  facts; no automatic retention cleanup. See the
  [worker contract](../docs/architecture/durable-worker-delivery.md) and
  [runbook](../docs/runbooks/durable-workers.md).
- **Remaining:** none within P1-U5b. Combined recovery rehearsal, integrated
  `check:durability`/CI wiring and parent completion are now verified in P1-U5c.

### P1-U5c — Recovery verification and operational handoff

- **Status:** complete; 2026-10-04 20:18 +08:00 (Asia/Manila).
- **Scope, dependencies and acceptance:** [feature spec](feature-specs/p1-u5c-recovery-verification-and-operational-handoff.md)
  owns AC-07/10 and integrated confirmation of AC-01–09; a/b were reverified.
- **Completed:** focused command/foundation/CI wiring; controlled SIGKILL at
  handoff/execution/accepted sink; real PostgreSQL connectivity outage at three
  boundaries; completed/exhausted state and attribution across restart; successful
  and forced bounded drains; safe snapshots and operational owner/escalation docs.
- **Recovery fixes:** safe errors for checked-out database clients; awaited public
  pg-boss fetch/complete/fail and consumer/dispatch drain before pool close;
  shared deadline; startup queue capability checks. Preserved a/b contracts.
- **Verification:** `./dev exec pnpm check:durability` and full `./dev check` exited
  0. Final drain exited 0 in 183ms; stalled drain exited 1 at 7014ms and recovered
  with one effect/receipt. Both Docker replicas reported ready without ports,
  drained/closed connections and exited 0. HTTP live/ready stayed 200; development
  backlog was empty. Scoped lint/format, relative links and whitespace passed.
  [Evidence and limitations](../docs/status/p1-u5c-evidence.md).
- **Remaining:** none within P1-U5c. Fixture sink/local connection interruption
  does not prove production HA, PostgreSQL host/disk recovery or live adapters.
  Audit/failures remain retained; manual retry and retention policy are deferred.

### P1-U6b — Tenant-checked references and recovery verification

- **Status:** complete; 2026-10-05 10:52 +08:00 (Asia/Manila); parent P1-U6 complete.
- **Requirement:** [P1-U6b spec](feature-specs/p1-u6b-tenant-checked-references-and-recovery-verification.md);
  B-01–07 and parent AC-01–09.
- **Scope:** caller-owned ownership/permission ports, tenant-checked access,
  approved reference signing/configuration and integrated recovery verification.
- **Preparation:** read AGENT.md, required context and storage specs; inspected
  existing Garage adapter/configuration, fixtures, ADR and runbook. P1-U6a
  evidence was complete at the initial preparation checkpoint; final checks also
  reverified the adapter foundation with access integrated.
- **Verification:** B-01–07 and parent AC-01–09 passed. `./dev up`, focused storage,
  isolated storage deployment and full `./dev check` exited 0; all five client scans,
  independent reference readers, provider/process restart, runtime privileges and
  unchanged health policy passed. Final live/ready are 200. Garage expiry returns
  400; tampering returns 403. [Evidence](../docs/status/p1-u6b-evidence.md).
- **Decision:** user approved GET-only bearer references, explicit reachable host,
  expiry without immediate revocation, a 120-second default and hard 300-second
  maximum. See [storage ADR](../docs/architecture/shared-storage.md#approved-p1-u6b-access-contract).
- **Required checks:** focused `./dev exec pnpm check:storage`, deployment/client
  checks and `./dev check`; two trusted tenants, deny-before-provider ordering,
  actual provider expiry/tampering and interrupted access recovery.
- **Implementation checkpoint:** caller-owned ownership/permission ports and access
  service, explicit signing host/configuration and adapter GET signing with bounded
  byte verification exist. Trusted two-tenant, independent-process, expiry/tampering
  and access interruption checks extend the existing focused command.
- **Remaining:** none within b or parent P1-U6. P2/P8 must provide real identity,
  canonical metadata and role/session authorization; external HTTPS, production HA,
  file policy, retention and recovery remain with their owning units. Issued bearers
  remain valid until expiry; no immediate revocation, public route or schema added.

### P1-U6a — Shared storage adapter and configuration

- **Status:** complete; 2026-10-05 09:43 +08:00 (Asia/Manila).
- **Requirement and scope:** [P1-U6a spec](feature-specs/p1-u6a-shared-storage-adapter-and-configuration.md);
  private shared provider adapter, bounded operations, configuration, trusted
  provisioning, isolated checks and supporting ADR/runbook. P1-U6b and business
  artifact metadata/access workflows remain outside this unit.
- **Acceptance and required checks:** A-01–07; approved setup ADR, real-provider
  independent-process access, restart/interruption and same-identity recovery,
  private access, safe configuration/outcomes, provisioning/privileges/health;
  `./dev exec pnpm check:storage` and `./dev check` after implementation.
- **Completed preparation:** read AGENT.md, required application context and
  parent/child storage specs; inspected configuration and secret loading,
  deployment/Docker/check wiring. At the starting baseline there were no storage
  settings, provider service or adapter in the inspected boundaries.
- **Decision:** user explicitly approved Garage after reviewing the local Docker,
  private bucket, separate credentials and internal HTTP proposal. No hosted
  environment or HTTPS facility is required for this unit.
- **Implementation checkpoint:** pinned Garage 2.3.0, persistent private provider,
  trusted provisioning, separate runtime/fixture credentials, optional validated
  settings, bounded S3 adapter and safe same-identity write/read verification exist.
  Independent OS processes have empty isolated working directories; readers
  receive no artifact bytes through IPC. Actual enabled-HTTP startup/health checks, input
  validation, private access, ambiguous write and integrity-conflict recovery pass.
- **Verification:** A-01–07 passed. `./dev up`, `./dev exec pnpm check:storage`,
  `./dev storage-deployment-check`, `./dev exec pnpm check:storage-clients` and
  final `./dev check` exited 0. Full checks include existing configuration,
  entry-point, database/audit/outbox and worker recovery regressions. All five
  client builds exclude actual credential/content/configuration and SDK import
  sentinels. [Evidence and limits](../docs/status/p1-u6a-evidence.md).
- **Handoff and remaining:** none within a; typed port, approved private setup,
  safe outcomes, same-identity recovery and runbook are available to b. Garage's
  coarse bucket write/delete permission is documented; tenant access, signing,
  lifetime/revocation, production hosting/TLS/HA, backup and retention remain gated.

### P2-U1 — Canonical identities and tenancy admission

- **Status:** planned; parent and three child specs prepared, implementation pending.
- **Requirement and scope:** [P2-U1 parent spec](feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md);
  canonical stores/ownership, role contracts/admission and secure operator bootstrap.
- **Sequence:** [P2-U1a](feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md),
  [P2-U1b](feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md),
  [P2-U1c](feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md);
  user adopted the split on 2026-10-05. All children remain planned.
- **Acceptance and checks:** parent AC-01–11; child A-01–07, B-01–07 and C-01–08.
  Provisional identity-foundation command plus `./dev check` during implementation;
  documentation consistency, relative links, coverage and whitespace checked now.
- **Remaining and gates:** record the relevant P1-U1 partial handoff and resolve
  D-01/D-05/D-06 portions before dependent implementation. No runtime work or
  identity/session acceptance has been performed. Split approval does not approve
  pending product rules.

## Next Up

[P2-U1 — canonical identities and tenancy admission](implementation-plan.md#p2-u1--implement-canonical-identities-and-tenancy-admission).
The [P2-U1 feature spec](feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md)
is prepared and reviewed, with AC-01–11 and an adopted three-sub-unit sequence:
canonical stores/constraints, role contracts/admission, and secure operator
bootstrap. Child specs are prepared; runtime implementation has not started. P1-U1 remains
deferred; record its relevant partial handoff and resolve D-01, D-06 and the
identity/bootstrap portion of D-05 before dependent implementation.
P1-U6a/b and parent AC-01–09 are complete. The
[storage contract](../docs/architecture/shared-storage.md) and
[verified evidence](../docs/status/p1-u6b-evidence.md) are available to later consumers.
Product/session decisions remain owned by the user; ask one focused question when
starting the next dependent feature. No Phase 2 implementation has started.

### Planned units

P1-U1 is `deferred`; P1-U2, P1-U3 and P1-U4 are `complete`; P1-U5 and P1-U6 are `complete` (including P1-U6a/b); the other 44 units remain `planned`. Their requirement references,
scope, acceptance criteria, dependencies, and verification are defined in the
linked plan. P1-U2 scaffolding, full P1-U3 foundation and P1-U4 web foundation have been verified.
Create a detailed per-unit checkpoint when that unit starts.

| Phase | Unit IDs | Status | Scope and acceptance reference |
| --- | --- | --- | --- |
| 1 | P1-U1, P1-U2, P1-U3, P1-U4, P1-U5, P1-U6 | P1-U1 deferred; P1-U2/P1-U3/P1-U4 complete; P1-U5/P1-U6 complete | [Runnable foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1, P2-U2, P2-U3, P2-U4 | planned | [Identities and sessions](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1, P3-U2, P3-U3, P3-U4, P3-U5 | planned | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
| 4 | P4-U1, P4-U2, P4-U3, P4-U4, P4-U5 | planned | [Tenant onboarding and administration](implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration) |
| 5 | P5-U1, P5-U2, P5-U3, P5-U4, P5-U5, P5-U6, P5-U7 | planned | [Staff intake and dispatch](implementation-plan.md#phase-5--deliver-staff-intake-incident-management-and-dispatch) |
| 6 | P6-U1, P6-U2, P6-U3, P6-U4 | planned | [Responder mobile and monitoring](implementation-plan.md#phase-6--complete-responder-mobile-work-and-synchronized-monitoring) |
| 7 | P7-U1, P7-U2, P7-U3 | planned | [First-release verification](implementation-plan.md#phase-7--verify-the-complete-first-release-journey) |
| 8 | P8-U1, P8-U2, P8-U3, P8-U4, P8-U5, P8-U6, P8-U7, P8-U8, P8-U9, P8-U10, P8-U11 | planned | [Public channels and extensions](implementation-plan.md#phase-8--add-public-channels-and-operational-extensions) |
| 9 | P9-U1, P9-U2, P9-U3, P9-U4, P9-U5 | planned | [Production readiness and launch](implementation-plan.md#phase-9--prove-production-readiness-and-launch-the-new-system) |


## Open Questions

The [decision-gate table](implementation-plan.md#decisions-required-before-dependent-implementation)
identifies the required answers and affected units. Current unresolved areas are:

- Operational permissions, lifecycle transitions, closure, dispatch concurrency,
  responder eligibility/availability, and category/priority semantics.
- Credential setup/reset/recovery, administrator safeguards, and tenant lifecycle
  effects on access, routes, and active work.
- Default coordinate configuration, service-area behavior, map tiles/search,
  draft ownership/conflicts, mobile targets, and foreground-location policies.
- Controlled PBX access, secret management, routing semantics, validation/reload
  commands, active-call changes, and live test destinations.
- Real evidence/recording authorization, allowed files, retention and production
  recovery policies; local Garage setup and foundation reference lifetime/revocation
  contract are approved.
- Public channel mappings/handoff/feedback, SMS provider, voice behavior, browser
  calling design, report definitions, and permitted recovery actions.
- Production platform/HA decisions, measurable readiness/recovery targets, owners,
  and which later extensions are required for the initial operational deployment.

These questions block dependent implementation. Proposed answers and gates are
listed in the [P1-U1 decision register](../docs/planning/p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation).
The user owns approval of all decisions; no proposed answer is approved. P1-U1
is deferred; P1-U2 independent foundation implementation is complete.


## Architecture Decisions

User-authorized independent foundation work follows the existing stack, module
boundaries and shared-state invariants. Routine P1-U2 choices use pnpm ordering,
pinned compatible dependencies and isolated Nest modules; see
[workspace decisions](../docs/architecture/workspace-foundation.md). Product
recommendations in P1-U1 remain unapproved.


## Verification and Limitations

- P1-U2: frozen install and full `pnpm check` passed in the workspace and clean
  source copy. Web HTTP smoke and both mobile platforms' bundle artifact checks
  passed. Hosted CI and native devices were not exercised. At that checkpoint, no
  database, sessions, jobs, PBX or operational feature was implemented. P1-U3 now
  has shared containers, baseline migration, backend connectivity and health;
  domain features remain pending.

- P1-U1 draft: relative-file-link checks passed across five changed/new documents;
  decision IDs D-01–D-13 and overview criteria 1–10 are present. Manual consistency
  review confirmed proposed behavior is marked pending and each gate lists the
  owner, affected units and resume condition. `git diff --check` passed. These are
  documentation checks, not proof of product behavior or user approval.

- Initial inspection found context files and empty directories. P1-U2 has now
  added runnable application skeletons; operational features remain pending.
- Reviewed the plan against the overview, architecture, UI context, code standards,
  and workflow rules. Checked unit IDs, dependency references, Markdown file links,
  and coverage of all ten overview success criteria.
- P1-U2 runtime/build checks verify scaffolding only. No live PBX, native-device,
  multi-replica, operational workflow or production acceptance is claimed.


## Session Notes

- 2026-10-05 +08:00 (Asia/Manila) — Created the user-requested P2-U1a/b/c
  child feature specs with sequential dependencies, detailed contracts, scoped
  acceptance criteria and parent AC-01–11 coverage. Updated parent, tracker and
  docs index to record the adopted split. Documentation consistency, relative
  links, acceptance coverage and whitespace checked; all units remain planned.
  Product decisions and runtime implementation remain pending.

- 2026-10-05 +08:00 (Asia/Manila) — Prepared and reviewed the P2-U1 feature
  spec after reading AGENT.md, required context, Phase 2, existing specs and
  source boundaries. Defined canonical ownership/normalization, role/admission
  ports, authority versions, credential metadata and secure retry-safe bootstrap;
  recommended three sequential sub-units with AC-01–11 coverage. P1-U1 partial
  handoff and relevant D-01/D-05/D-06 decisions remain pending. Documentation
  consistency, relative links and whitespace checked; no runtime changes/checks
  or Phase 2 completion claimed. P2-U1 remains planned.

- 2026-10-05 10:52 +08:00 (Asia/Manila) — Completed P1-U6b and parent P1-U6
  after explicit approval of GET bearer access, a 120-second default and hard
  300-second ceiling. Added tenant ownership/permission ports, bounded verified
  reference issuance, reachable signing configuration and real Garage access/
  expiry/tampering/recovery checks. Focused, fresh provider and full Docker checks
  passed; all five client scans and live/ready 200 passed. Corrected rejection
  expectations for Garage HTTP 400 without weakening lifetime enforcement. One
  workspace refresh interrupted an earlier check; its two verified exact fixtures
  were removed, and final runs passed. Added evidence/runbook/ADR handoff and
  cleared active work. Real identity/evidence and production gates remain open.

- 2026-10-05 (Asia/Manila) — Started P1-U6b at the user's request and marked it
  in progress. Read repository instructions and required context; inspected a's
  adapter/configuration and verification boundaries. Prepared a concrete pending
  access proposal in the storage ADR and asked the required D-10 decision. The
  spec explicitly forbids inferring access approval from provider/spec approval.
  Recorded the unit as blocked after independent preparation; resume upon explicit
  access-contract approval or revision. Relative-file links and whitespace passed;
  no runtime implementation or acceptance completion is claimed.

- 2026-10-05 09:43 +08:00 (Asia/Manila) — Completed P1-U6a after explicit Garage approval.
  Implemented pinned private provider, runtime/fixture credential separation,
  validated optional configuration and bounded adapter with verified bytes and
  same-identity recovery. Focused, fresh-volume/restart and all five client scans
  passed; final full Docker check exited 0. The earlier full run ended with a shell
  parse error because the launcher was edited while running; the unchanged rerun
  passed. Added ADR/runbook/evidence and cleared active work. P1-U6b remains planned
  with access/lifetime/revocation approval pending; parent P1-U6 is incomplete.

- 2026-10-05 +08:00 (Asia/Manila) — Started P1-U6a at the user's implementation
  request and marked it in progress. Read required context and storage specs;
  rechecked P1-U3 evidence and configuration, runtime secrets, deployment and
  Docker/check boundaries. No storage adapter/configuration/provider exists.
  Provider/setup approval remains an explicit prerequisite in the requested spec;
  asked the focused setup question and recorded blocked/resume conditions.
  No runtime implementation or storage acceptance checks are claimed. Tracker
  relative-file links and `git diff --check` passed.

- 2026-10-05 +08:00 (Asia/Manila) — Split P1-U6 into two child feature specs at
  the user's request. Parent retains shared scope and AC-01–09; a owns adapter,
  configuration and provisioning, b owns tenant-checked references and combined
  recovery verification. Updated tracker/index links. Documentation consistency,
  relative links, acceptance coverage and whitespace checks passed. Both units
  remain planned; provider/access D-10 remains pending.

- 2026-10-05 08:24 +08:00 (Asia/Manila) — Drafted the P1-U6 storage feature spec
  from AGENT.md, required context, Phase 1 and existing source boundaries.
  Recommended two implementation units with explicit acceptance coverage;
  provider/access D-10 remains pending, and evidence/retention stay in Phase 8.
  Documentation consistency, relative-file links and whitespace checks passed.
  P1-U6 remains planned; no runtime checks or implementation were performed.

- 2026-10-04 20:18 +08:00 (Asia/Manila) — Completed P1-U5c and parent P1-U5. Focused
  durability and full Docker checks passed AC-01–10. Corrected checked-out
  connection errors and unawaited pg-boss acknowledgements; verified queue
  readiness, process/database recovery, retained terminal states and bounded
  drain. Two Docker replicas exited 0; HTTP stayed ready. Saved safe snapshots,
  runbook and evidence; cleared active work. P1-U6 requires its storage decision.

- 2026-10-04 19:45 +08:00 (Asia/Manila) — Completed P1-U5b. Atomic pg-boss handoff,
  independent workers, restart-safe sample sink, scoped keys, bounded retries and
  retained failures passed focused real-PostgreSQL checks. Frozen install,
  audit/outbox regressions and full `./dev check` passed. Verified two Docker worker
  replicas, graceful exit 0 and independent HTTP health; added contract, runbook
  and evidence. Cleared active work. P1-U5c remains planned; parent remains incomplete.

- 2026-10-04 19:11 +08:00 (Asia/Manila) — Completed P1-U5a. Transaction-bound
  audit/outbox writes, structural attribution, append-only grants/trigger and safe
  metadata/logging passed focused real-PostgreSQL checks. Full `./dev check`,
  deployment migration and health passed. Added write/handoff contract and evidence;
  cleared active work. P1-U5b/c remain planned and parent P1-U5 remains incomplete.


- 2026-10-04 18:40 +08:00 (Asia/Manila) — Split P1-U5 into three separate feature specs at the user's
  request. Parent now holds shared scope and acceptance matrix; a/b/c own detailed
  contracts and sequential verification boundaries. Updated tracker/index links.
  Documentation link, acceptance coverage and whitespace checks passed;
  runtime implementation remains planned.

- 2026-10-04 18:33 +08:00 — Drafted P1-U5 feature spec from repository guidance,
  Phase 1, required context and current backend/migration boundaries. Recommended
  three sequential subunits with explicit transaction, delivery and recovery
  checks. Relative-file links, acceptance coverage and whitespace checks passed.
  Documentation only; P1-U5 and its proposed subunits remain planned.

- 2026-10-04 18:18 +08:00 — Completed the approved three-subunit P1-U4 sequence.
  Shared theme/primitives and distinct operations shells passed 12 production
  browser checks, contrast/keyboard/visual review and the full workspace/backend
  foundation checks. Terminal connections interrupted earlier attempts; final
  Docker-detached check logged exit status 0. Updated spec, UI guide, runbook,
  evidence and CI. Operational/authentication features remain pending; P1-U5 is next.

- 2026-10-04 17:18 +08:00 — Drafted P1-U4 feature spec from repository guidance,
  Phase 1 and existing UI skeletons. Recommended three sequential subunits with
  explicit acceptance/check boundaries. Documentation only; P1-U4 remains planned.

- 2026-10-04 16:56 +08:00 — Resumed and completed P1-U3. Full `./dev check`
  passed after correcting README formatting; fresh/concurrent/rerun migration,
  restricted runtime role, backend restart, configuration failures and individual
  dependency outages/recovery passed. `./dev up` rerun and backend health passed.
  Recorded evidence and synchronized runbooks/tracker. P1-U4 is next; operational
  features and deferred product decisions remain pending.

- 2026-10-04 — User requested marking P1-U2 completed. Confirmed its existing
  complete status and added an explicit completion date to its checkpoint.
  P1-U3 remains in progress. Documentation-only update; whitespace check passed.

- 2026-10-04 — Corrected server preview access: the workspace had localhost-only
  binding and no application process. Added a separate command-center bind setting
  and explicit root `.env` loading in launchers. This server selects public port
  3100 only; other workspace/service ports remain local. Started the command-center
  preview in Docker and verified HTTP 200 at `172.16.7.53:3100`. Added LAN/public
  development origins. Public access depends on the firewall's TCP 3100 forwarding
  to this LAN address. The public URL also returned HTTP 200 from this server;
  an independent external browser remains unverified.

- 2026-10-04 — User approved the complete Docker development workspace and requested
  documentation. Added Docker-only host launcher, isolated dependencies/caches,
  non-root workspace, optional VS Code integration and Docker CI commands.
  Full Docker check, application/source-reload smoke, networking and credential
  checks passed. Updated setup, architecture, workflow and verification docs.
  Hosted CI, VS Code UI, other operating systems and native devices are unverified.
  P1-U3 remains in progress for baseline migrations and backend health.

- 2026-10-04 14:39 +08:00 — Shared-container increment verified: four healthy services,
  restart persistence, Redis isolation and authenticated host access passed.
  Corrected Compose mount resolution and Redis credentials during checks.
  Temporary fixtures removed; generated secrets ignored by Git. P1-U3 remains
  in progress for backend connections, baseline migrations and health.

- 2026-10-04 14:35 +08:00 — User requested shared services in Docker and explicitly included
  Asterisk. Added four digest-pinned containers, local bindings, data volumes,
  automatic database secret, health checks and root commands. Service startup and
  queries passed. P1-U3 remains in progress; backend/migrations/health are pending.

- 2026-10-04 14:18 +08:00 — User explicitly adopted the build, review, improve process.
  Added it to the authoritative workflow rules and linked it from the current
  goal. Retained unit boundaries, verification and dependent-decision handling.
  Documentation consistency and whitespace checks passed; no runtime code changed.

- 2026-10-04 14:13 +08:00 — User resolved the port 3000 conflict by stopping its container
  and confirmed the command-center development page returns HTTP 200. Added the
  exact remote host `203.177.64.131` to command-center `allowedDevOrigins` to
  permit development resources/hot reload. No ports changed. Focused lint,
  typecheck, formatting and `git diff --check` passed; remote browser retest requires
  restarting the user-owned dev process.

- 2026-10-04 13:59 +08:00 — Completed P1-U2. Workspace and clean-copy checks passed,
  including all web/mobile builds and four isolated backend process checks.
  Production web HTTP smoke passed. Updated setup/docs and recorded evidence.
  P1-U1 product decisions remain deferred; P1-U3 is next.

- 2026-10-04 +08:00 — User requested a simpler process and to start building.
  Deferred P1-U1 product review, activated independent P1-U2 under the existing
  architecture, and began scaffold/check implementation. No product draft adopted.

- 2026-10-04 13:14 +08:00 — Prepared P1-U1 foundation review, proposed product
  contracts, acceptance matrix and decision gates. Added docs index and corrected
  tracker links to the implementation plan. User review pending; P1-U2 remains
  planned and no runtime capability is claimed.

- 2026-10-04 11:31 +08:00 — Created `implementation-plan.md` with nine phases and
  50 planned units, phase gates, unresolved decisions, and success-criteria mapping.
  Linked the plan from this tracker and recorded the unimplemented starting state.
- 2026-10-04 11:19 +08:00 — Completed documentation cleanup: removed the obsolete delivery-plan dependency from `AGENT.md` and the unused phase heading from this tracker. Reviewed all repository documents; the delivery-plan file is absent and no numbered delivery stages remain. Documentation consistency checks passed; runtime tests are not applicable.
