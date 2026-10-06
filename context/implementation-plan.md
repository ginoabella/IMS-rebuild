# MyIMS Implementation Plan

## Purpose and source of requirements

Deliver MyIMS as a new multi-tenant emergency response system, starting with an
empty application and database and ending with a verified operational launch.
The central journey is intake, incident creation, dispatch, responder acceptance
and progress, monitoring, closure, and retained timeline and audit history.

Product requirements come from [project-overview.md](context/project-overview.md).
Implementation must follow [architecture.md](context/architecture.md),
[ui-context.md](context/ui-context.md),
[code-standards.md](context/code-standards.md), and
[ai-workflow-rules.md](context/ai-workflow-rules.md).
This plan defines delivery order; it does not override those documents.
Actual delivery state belongs in [progress-tracker.md](context/progress-tracker.md).

## How to use this plan

- Each phase delivers an observable outcome. Each numbered unit delivers one
  focused capability, including its required contracts, persistence, backend,
  interface, checks, and documentation.
- Every unit starts as **planned**. No application capability has been verified
  in the current repository. Creating this plan does not complete a unit.
- A unit's starting state is the verified result of its listed dependencies.
  P1-U1 starts with the existing project context and no application code.
- Follow phase order and unit order within each phase. Listed dependencies name
  capabilities that must be verified before starting that unit. A blocked unit
  may be bypassed only for independent work under the workflow rules.
- Before starting, record the unit ID, requirement, scope, acceptance criteria,
  status, and required check procedure in the progress tracker. Resolve any
  decision gate affecting that unit first.
- A unit is complete only when its result and acceptance criteria pass its
  required checks. Feature completion includes the actual user journey; a
  schema, endpoint, or screen alone does not establish feature completion.
- After each meaningful change, update the tracker with reproducible evidence,
  limitations, blockers, and the remaining work. Update authoritative context
  whenever an approved decision changes documented behavior.

## Requirements applied throughout delivery

- Keep platform authority separate from tenant staff authority. Derive tenant
  access from authenticated backend state, never from a client-selected tenant.
- Enforce tenant ownership, role checks, concurrency rules, and actor-attributed
  audit at every sensitive boundary, including sockets, jobs, files, and exports.
- Keep canonical data in PostgreSQL/PostGIS, sessions in shared Redis, and live
  call state and raw recordings in Asterisk. No replica-local authoritative state.
- Commit business changes before external effects. Use durable, idempotent jobs
  and an outbox for reliable publication; reload canonical state after gaps.
- Deliver the specified dark UI, shared tokens and components, usable layouts,
  keyboard access, clear statuses, and preserved form values on validation errors.
- Add domain schema and contracts with the unit that owns them. Avoid creating
  speculative feature tables or parallel sources of truth in foundation work.
- Provide a short required-check command for each phase and a complete release
  check command. Record actual commands when the workspace exists; command names
  and execution results are not established by this plan.
- Test critical journeys against real PostgreSQL/PostGIS and shared services.
  External fixtures prove their declared boundary; required live integration
  checks remain incomplete until performed against controlled real services.

## Delivery checkpoints

| Checkpoint | Phases | Required outcome |
| --- | --- | --- |
| Runnable foundation | 1–2 | Fresh startup, baseline schema, shared sessions, and separate identity planes. |
| Administration ready | 3–4 | Browser-managed and verified Asterisk configuration, tenant onboarding, and verified staff extension assignment. |
| First-release journey verified | 5–7 | Staff intake through responder completion and incident closure, with audit and cross-replica recovery checks. |
| Extended channels and tools verified | 8 | Approved public entry points and operational extensions reuse the canonical workflow. |
| Operational launch approved by evidence | 9 | Measured nonfunctional targets, production recovery, provisioning, and launch rehearsals pass. |

Phase 7 is an acceptance checkpoint, not permission to begin operational use.
Public channels and later tools remain separately tracked requirements. Before
launch, resolve which Phase 8 units are required for that deployment; deferred
units remain explicitly incomplete.

## Phase 1 — Establish the runnable foundation

**Outcome:** A fresh clone starts a reproducible runtime, applies the baseline
schema, exposes health, and runs the foundation checks.

### P1-U1 — Define delivery contracts and decision gates

- **Goal:** Make the first-release behavior and acceptance examples precise.
- **Scope:** Product contracts, acceptance matrix, decision records, and tracker.
- **Dependencies:** Existing project context.
- **Result and acceptance:** Document approved role permissions, incident and
  assignment transitions, closure rules, responder eligibility, category and
  priority behavior, and credential flows. Record unanswered decisions without
  inventing behavior. Identify each affected unit and its resume condition.
- **Verification:** Review every overview requirement against this plan and the
  acceptance matrix. Confirm unresolved questions have an owner and affected units.

### P1-U2 — Create the workspace and quality checks

- **Goal:** Establish one reproducible TypeScript workspace.
- **Scope:** `pnpm` workspace, application/package skeletons, backend entry-point
  boundaries, strict TypeScript, linting, formatting, build graph, CI, and docs index.
- **Dependencies:** P1-U1's agreed foundation scope.
- **Result and acceptance:** Required applications and shared packages have clear
  ownership. HTTP, worker, telephony, and deployment entry points remain distinct.
  Lockfile-based install and dependency-ordered checks work from a fresh clone.
- **Verification:** Run install, lint, typecheck, and build in a clean checkout;
  confirm starting one backend entry point does not start the others.

### P1-U3 — Start shared services and the baseline database

- **Goal:** Provide the local runtime on which all later units depend.
- **Scope:** Compose, PostgreSQL/PostGIS, Prisma/SQL migrations, separate session
  and realtime Redis services, typed configuration, and backend health endpoints.
- **Dependencies:** P1-U2.
- **Result and acceptance:** A documented command starts the database and backend,
  applies baseline migrations, and reports liveness/readiness. Missing or invalid
  configuration fails clearly. Migration execution is coordinated, not repeated
  by every HTTP replica. Feature schema remains owned by later units.
- **Verification:** Rehearse fresh startup, migration rerun, shutdown/restart,
  invalid configuration, and dependency-unavailable readiness behavior.

### P1-U4 — Establish web primitives and the operations shell

- **Goal:** Give feature units a consistent, accessible interface foundation.
- **Scope:** `packages/ui-web`, shared design tokens, Tailwind/shadcn conventions,
  and platform/command-center shells.
- **Dependencies:** P1-U2; existing UI context.
- **Result and acceptance:** Shared typography, surfaces, forms, tables, dialogs,
  focus states, loading/error/empty states, and compact layouts follow the UI
  context. Platform and command-center navigation have distinct homes.
- **Verification:** Review representative components at desktop, tablet, and
  narrow widths; check keyboard navigation, labels, focus, contrast, and reflow.

### P1-U5 — Establish transactional audit and durable execution

- **Goal:** Make committed changes traceable and external execution retryable.
- **Scope:** Audit module, transaction conventions, PostgreSQL outbox, `pg-boss`
  worker entry point, structured logging, and correlation identifiers.
- **Dependencies:** P1-U3.
- **Result and acceptance:** A sample committed action retains actor attribution
  and queued work; a rolled-back action publishes nothing. Workers safely retry
  duplicate execution, record failures, and recover after interruption. Secrets
  and unnecessary personal data are absent from logs and audit payloads.
- **Verification:** Integration checks for commit/rollback, duplicate jobs,
  worker restart, exhausted retries, and append-only audit behavior.

### P1-U6 — Establish shared file storage access

- **Goal:** Provide a shared storage boundary before evidence features use it.
- **Scope:** Object-storage adapter, typed configuration, access ports, and ADR.
- **Dependencies:** P1-U3; approved storage provider and access decision.
- **Result and acceptance:** The adapter stores and retrieves test artifacts from
  shared storage. Backend access supports tenant-checked expiring references;
  artifacts are not tied to an HTTP replica's disk. Feature-specific upload and
  retention behavior remains in P8-U1.
- **Verification:** Check access across two processes, reference expiry, missing
  objects, unauthorized access, and provider interruption without exposing secrets.

**Phase gate:** Fresh-clone startup and required foundation checks pass; setup,
configuration, health, and recovery procedures are documented.

## Phase 2 — Establish identities, shared sessions, and access boundaries

**Outcome:** Platform operators and tenant staff authenticate through separate
authority planes, with shared session enforcement across backend replicas.

### P2-U1 — Implement canonical identities and tenancy admission

- **Goal:** Establish the identity and ownership rules needed by administration.
- **Scope:** Platform identity store, tenant registry/admission rules, staff
  identities, role contracts, credential metadata, and trusted bootstrap command.
- **Dependencies:** P1-U1, P1-U3, P1-U5.
- **Result and acceptance:** Tenant codes are immutable, normalized, and globally
  unique. Staff belong to exactly one tenant; normalized usernames are unique
  within that tenant. Platform identities are tenantless. Bootstrap creates an
  initial operator securely and is safe to rerun; test tenants remain fixtures.
- **Verification:** Real database constraints, same username in two tenants,
  duplicate rejection within one tenant, normalization, and bootstrap rerun checks.

### P2-U2 — Implement the shared session store and authorization guards

- **Goal:** Enforce the same session authority on every HTTP replica.
- **Scope:** Redis session adapter, opaque tokens, canonical status/version
  validation, expiry/rotation/revocation, distributed rate limits, and guards.
- **Dependencies:** P2-U1, P1-U3.
- **Result and acceptance:** Only hashed token lookup keys are stored. Idle and
  absolute expiry apply. Concurrent renewal cannot recreate a revoked session.
  Canonical role, account, credential, and tenant-status changes invalidate stale
  authority. Redis failure denies session-dependent operations with a retryable
  service-unavailable response. Platform and staff routes reject the other plane.
- **Verification:** Two-replica checks for session reuse, expiry, concurrent
  revoke/renew, version mismatch, rate limits, Redis outage, and restored stale data.

### P2-U3 — Deliver platform operator sign-in

- **Goal:** Let an operator enter the separate platform console securely.
- **Scope:** Platform authentication use cases, endpoints, sign-in UI, and logout.
- **Dependencies:** P2-U2, P1-U4.
- **Result and acceptance:** Tenantless operator sign-in establishes a protected
  platform session. Web cookies and CSRF protection follow architecture rules.
  Invalid credentials do not reveal account existence; staff sessions cannot enter
  platform management. Logout revokes access on every replica. Approved P2-U2a
  expiry/reauthentication behavior preserves unfinished operational work with
  identity isolation; renewed or rotated tokens never extend absolute lifetime.
- **Verification:** Browser sign-in/logout, protected routes, invalid input,
  CSRF rejection, expiry/reauthentication with retained unfinished work,
  and cross-plane/cross-replica authorization checks.

### P2-U4 — Deliver tenant staff sign-in and credential lifecycle

- **Goal:** Let tenant-qualified staff set credentials, sign in, and sign out.
- **Scope:** Staff authentication, setup/reset/recovery contracts, command-center
  sign-in UI, and protected mobile token delivery/storage boundary.
- **Dependencies:** P2-U2, P1-U4; approved credential recovery flow from P1-U1.
- **Result and acceptance:** Staff sign-in uses exactly tenant code, username,
  and password as identity fields. All invalid identity/status combinations return
  `Invalid credentials`. Credential actions target tenant-qualified user IDs,
  expire as specified, and revoke affected sessions across replicas. Mobile tokens
  never appear in URLs or logs and use protected device storage when consumed.
  Approved P2-U2a expiry/reauthentication preserves unfinished incident drafts
  with identity/tenant isolation and blocks expired submissions; passive polling
  cannot avoid expiry and rotation cannot extend the original absolute lifetime.
- **Verification:** Same username under two tenant codes, setup/reset/recovery,
  expired/reused credentials, suspended users/tenants, logout, replica checks,
  and expiry/reauthentication without unnecessary loss of unfinished incident work.

**Phase gate:** Identity-plane isolation and shared-session acceptance checks
pass using two HTTP replicas; authentication and recovery guides are available.

## Phase 3 — Deliver Asterisk administration before tenant onboarding

**Outcome:** A platform operator configures and verifies PBX infrastructure and
unallocated extension inventory through the browser, with safe recovery.

### P3-U1 — Register PBX nodes and observe health

- **Goal:** Manage PBX connectivity while preserving one active owner per node.
- **Scope:** Telephony module, platform PBX screens, secret references, telephony
  process, database leases/fencing, health and registration observations.
- **Dependencies:** P2-U3, P1-U5; controlled Asterisk environment and secret access.
- **Result and acceptance:** Operators can register and inspect nodes. Desired
  settings and observed runtime state are distinct. Secret material stays outside
  revisions, audit, and clients. Failover reconciles observations, and a stale
  process cannot publish or apply changes after losing ownership.
- **Verification:** Controlled PBX connectivity, unavailable node, duplicate
  observers, lease loss, stale-owner rejection, restart, and secret-redaction checks.

### P3-U2 — Manage extension inventory and endpoint profiles

- **Goal:** Create usable platform inventory before any tenant reserves it.
- **Scope:** Individual/bulk SIP and WebRTC extensions, endpoint profiles,
  credential setup/reset, inventory constraints, and platform screens.
- **Dependencies:** P3-U1.
- **Result and acceptance:** Numbers are unique per PBX node. Inventory shows
  available, reserved, allocated, assigned, and disabled states as applicable.
  Unallocated extensions cannot carry tenant traffic or be assigned to staff.
  Editing desired configuration does not imply registration or verified readiness.
- **Verification:** Individual/bulk workflows, PBX-wide collisions, concurrent
  duplicates, credential reset, disabled inventory, and unallocated access rejection.

### P3-U3 — Manage trunks, gateways, and DIDs

- **Goal:** Define the infrastructure used by inbound and outbound routing.
- **Scope:** Desired-state records, secret references, validation, and platform UI.
- **Dependencies:** P3-U1.
- **Result and acceptance:** Operators can manage trunks, gateways, and DIDs;
  invalid or conflicting definitions are rejected. Saving changes retains desired
  state without claiming a live apply. Resource dependencies prevent unsafe removal.
- **Verification:** Browser workflows, invalid references, collisions, unauthorized
  changes, dependency-aware removal, and secret-redaction checks.

### P3-U4 — Manage ring groups and dial plans

- **Goal:** Define routing behavior with explicit destinations and precedence.
- **Scope:** Group membership, strategy/timeouts/fallbacks, inbound/outbound rules,
  reserved patterns, destination validation, and platform UI.
- **Dependencies:** P3-U2, P3-U3; approved routing semantics.
- **Result and acceptance:** Invalid destinations, conflicting patterns, unsafe
  group membership, and tenant-crossing bindings are rejected. Tenant attribution
  keys are generated internally from trusted route identities, never phone numbers.
- **Verification:** Routing contract examples, precedence/conflict checks,
  invalid destinations, and generated attribution validation.

### P3-U5 — Review, validate, apply, and recover configuration revisions

- **Goal:** Safely turn desired state into verified live Asterisk configuration.
- **Scope:** Revision compiler, diffs, affected-resource review, durable applies,
  atomic installation, approved reloads, verification, rollback, and progress UI.
- **Dependencies:** P3-U1–P3-U4, P1-U5; approved validation/reload commands.
- **Result and acceptance:** Saving a form never performs an implicit live change.
  Validation precedes apply; apply and verification statuses are recorded separately.
  Only the current fenced owner applies ordered revisions. Failure restores a
  known-good revision. Changes affecting active calls drain or defer under the
  approved policy; unresolved dependencies block deletion or reallocation.
- **Verification:** Live controlled PBX apply, failed validation/reload/verification,
  rollback, concurrent applies, worker interruption, owner failover, and active-call
  handling. A simulator alone cannot complete this unit.

**Phase gate:** Browser configuration and live verification/recovery pass on a
controlled PBX. Operator guides explain desired state, runtime state, and rollback.

## Phase 4 — Onboard tenants and enable tenant administration

**Outcome:** Operators create and activate tenants safely; tenant administrators
manage their people and assign only verified extensions owned by their organization.

### P4-U1 — Deliver tenant registry and onboarding

- **Goal:** Create organizations and their initial administrator through the console.
- **Scope:** Tenant list/search/filter, creation wizard, detail/edit, contacts,
  service area/default intake coordinates, voice setting, and administrator setup.
- **Dependencies:** P2-U1, P2-U3, P2-U4, Phase 3 gate; approved coordinate policy.
- **Result and acceptance:** A wizard creates a draft tenant and initial
  administrator without exposing credentials. Codes cannot be changed; names
  can. Incomplete drafts are retained. Voice-disabled tenants are explicitly
  identified. Configured coordinates are validated and available to intake.
- **Verification:** Browser draft/create/edit/setup journey, duplicate tenant code,
  partial failure/retry, invalid coordinates, and unauthorized registry access.

### P4-U2 — Allocate inventory and verify tenant routing

- **Goal:** Establish exclusive tenant ownership on shared PBX infrastructure.
- **Scope:** Existing extension reservations/ranges, node placement, tenant inbound
  contexts/groups, gateways/DIDs, approved outbound routes, and readiness display.
- **Dependencies:** P4-U1, P3-U5.
- **Result and acceptance:** Two tenants can share one PBX with non-overlapping
  inventory and separate routes. Concurrent allocations cannot double-own numbers.
  Voice readiness requires validated, applied, verified allocations and routes,
  including inbound/outbound test results. Unknown or ambiguous call sources fail
  closed. Reallocation respects existing assignments, routes, and active calls.
- **Verification:** Live two-tenant fixture calls, concurrent allocation, attempted
  cross-tenant routing, unknown sources, failed apply, and premature readiness checks.

### P4-U3 — Enforce tenant lifecycle and admission effects

- **Goal:** Make activation, suspension, and retirement enforceable system behavior.
- **Scope:** Lifecycle use cases/UI, tenancy admission, session invalidation,
  telephony coordination, history, and audit.
- **Dependencies:** P4-U1, P4-U2, P2-U2; approved lifecycle/routing effects.
- **Result and acceptance:** Draft/active/suspended/retired transitions follow the
  approved contract. Voice-enabled activation requires readiness; explicitly
  voice-disabled activation needs no PBX allocation. Lifecycle actions retain
  history and explain access/routing effects. Tenant status and PBX apply status
  remain separate, and status changes affect access across replicas.
- **Verification:** Allowed/rejected transitions, voice readiness gates, two-replica
  suspension, failed telephony coordination, and retained audit checks.

### P4-U4 — Manage tenant staff and roles

- **Goal:** Let tenant administrators control staff access in their organization.
- **Scope:** Staff list/create/edit/status, role assignment, credential setup/reset
  integration, permission checks, and tenant administration screens.
- **Dependencies:** P4-U3, P2-U4; approved permission matrix.
- **Result and acceptance:** Administrators manage only their tenant's users.
  Duplicate usernames are rejected within a tenant. Role/account changes and
  credential reset update canonical authorization and invalidate stale sessions.
  Sensitive changes identify the administrator in audit.
- **Verification:** Browser staff administration, duplicate/concurrent writes,
  unauthorized roles, cross-tenant user IDs, and cross-replica revocation checks.

### P4-U5 — Assign verified extensions and permitted telephony options

- **Goal:** Let tenant administrators configure staff calling within platform limits.
- **Scope:** Extension assign/unassign/reassign, allowed group membership and route
  selections, conflict handling, and tenant-facing telephony screens.
- **Dependencies:** P4-U2, P4-U4.
- **Result and acceptance:** Selection includes only verified, unassigned,
  tenant-owned extensions. Pending, disabled, foreign, or already assigned inventory
  is rejected. Concurrent changes cannot duplicate staff assignments. Audit retains
  old/new ownership; tenant administrators cannot edit shared trunks or dial plans.
- **Verification:** Full assignment/reassignment journey, two-replica conflicts,
  invalid inventory states, cross-tenant IDs, and forbidden infrastructure edits.

**Phase gate:** Two tenants are onboarded on one PBX; tenant isolation, verified
extension assignment, lifecycle, and voice-disabled activation checks pass.

## Phase 5 — Deliver staff intake, incident management, and dispatch

**Outcome:** Command-center staff receive a call, preserve intake work, create an
incident at the correct location, and assign an eligible responder with history.

### P5-U1 — Manage incident categories

- **Goal:** Provide tenant-owned categories needed for incident intake.
- **Scope:** Category lifecycle, validation, tenant administration screens, and audit.
- **Dependencies:** P4-U4; approved category rules.
- **Result and acceptance:** Administrators manage only their tenant's categories.
  Disabled categories are excluded from new-intake choices. Sensitive changes
  are actor-attributed and audited. P5-U6 verifies retained incident references.
- **Verification:** Create/edit/disable journey, invalid and foreign category IDs,
  concurrent updates, and enabled-category selection behavior.

### P5-U2 — Manage responder profiles and availability

- **Goal:** Provide tenant-owned responder profiles needed for dispatch.
- **Scope:** Responder profile/staff linkage, lifecycle, availability commands,
  eligibility contracts, administration screens, and audit.
- **Dependencies:** P4-U4; approved responder eligibility and availability rules.
- **Result and acceptance:** Authorized users manage responders and availability
  only within their tenant. Responder/staff linkage cannot cross tenants; lifecycle
  and availability determine dispatch eligibility under the approved contract.
  Changes retain actor-attributed history and reject stale writes as specified.
- **Verification:** Profile/linkage/lifecycle/availability journeys, foreign staff
  IDs, invalid states, concurrent updates, and eligibility behavior.

### P5-U3 — Synchronize trusted calls for staff intake

- **Goal:** Present tenant-owned call metadata from external softphone/hardphone use.
- **Scope:** Trusted Asterisk event receipts, call metadata reconciliation,
  tenant-scoped call feed, and incoming/current call context in the command center.
- **Dependencies:** P4-U2, P4-U5, P3-U1, P1-U5.
- **Result and acceptance:** The correct staff intake context receives the caller's
  phone number. Duplicate events and observer restart preserve consistent metadata.
  Asterisk remains the live-call authority. Unknown/ambiguous sources are rejected;
  caller numbers cannot determine trusted tenant ownership. No browser dialer is
  required for this external-phone journey.
- **Verification:** Controlled inbound calls for two tenants, duplicate/out-of-order
  events, observer interruption/reconciliation, and ambiguous-source rejection.

### P5-U4 — Preserve intake drafts

- **Goal:** Protect meaningful unfinished incident entry during staff work.
- **Scope:** Tenant-owned draft persistence, draft restore/conflict behavior, and
  intake form for reporter, phone, category, priority, and location fields.
- **Dependencies:** P5-U1, P5-U3; approved draft ownership and retention behavior.
- **Result and acceptance:** Caller number populates the phone field. Missing caller
  location uses configured longitude/latitude defaults. Refresh restores saved work;
  validation failures preserve input. Concurrent edits have defined conflict handling,
  and one tenant cannot read another tenant's draft.
- **Verification:** Call-to-draft journey, refresh, validation errors, interruption,
  concurrent edits, missing caller location, and tenant/actor access checks.

### P5-U5 — Search and correct incident location on the map

- **Goal:** Let staff identify a location from the caller's description.
- **Scope:** MapLibre, approved tiles/search integration, location contracts,
  PostGIS persistence, map selection, coordinate validation, and location audit.
- **Dependencies:** P5-U4; approved map search provider and coordinate policy.
- **Result and acceptance:** Staff can search the map and double-click a location
  to replace draft longitude/latitude, including default coordinates. The form and
  map agree. The map has legends/layers and an accessible coordinate-entry
  alternative; unavailable search does not erase the draft.
- **Verification:** Search/selection journey, default replacement, invalid/outside
  bounds behavior as specified, coordinate ordering, draft restore, and
  search/tiles outage checks. Saved-incident corrections are delivered in P5-U6.

### P5-U6 — Create, edit, view, and close incidents

- **Goal:** Turn intake into a canonical incident with retained operational history.
- **Scope:** Incident lifecycle, transactional draft conversion, queue/detail/edit/
  close UI, timeline, actor-attributed audit, and concurrency handling.
- **Dependencies:** P5-U4, P5-U5, P1-U5; approved lifecycle and closure rules.
- **Result and acceptance:** Creating from a draft produces one tenant-owned
  incident with reporter, category, priority, and location. Retry cannot create
  duplicate incidents. Authorized edits/closure retain timeline and audit; stale
  edits conflict clearly. Saved-location correction is an explicit authorized
  backend workflow. Disabled categories cannot be newly selected, while historical
  references remain valid. Closure with assignments follows the approved policy.
- **Verification:** Intake-create-refresh-edit-close browser journey, duplicate
  submission, stale writes, location correction, category history, invalid
  transitions, forbidden closure, and cross-tenant IDs. Verify assignment-dependent
  rules with declared fixtures here; P7-U1 proves closure with actual assignments.

### P5-U7 — Dispatch an eligible responder

- **Goal:** Create an assignment through an authorized dispatcher workflow.
- **Scope:** Dispatch domain/use cases, assignment/history schema, eligibility
  checks, responder selection UI, transactional audit, and notification outbox.
- **Dependencies:** P5-U2, P5-U6; approved assignment/concurrency contract.
- **Result and acceptance:** A dispatcher assigns an active eligible responder
  from the same tenant. Concurrent requests preserve the approved assignment rules;
  inactive/foreign responders and inadmissible incidents are rejected. Assignment
  state, incident history, audit, and pending delivery agree after commit.
- **Verification:** Dispatch journey, two-dispatcher races, duplicate requests,
  invalid availability/status, tenant isolation, and rolled-back notification checks.

**Phase gate:** A controlled call becomes a retained incident with map-corrected
coordinates and a valid dispatch assignment. Staff user guides and checks pass.

## Phase 6 — Complete responder mobile work and synchronized monitoring

**Outcome:** Responders receive and complete work in the mobile app; command-center
sessions on different replicas converge on incidents, assignments, and locations.

### P6-U1 — Deliver responder sign-in and assignment receipt

- **Goal:** Let a responder securely open their assigned work on mobile.
- **Scope:** Expo responder app, protected token storage, responder authorization,
  assignment list/detail, and reconnect/reload behavior.
- **Dependencies:** P2-U4, P5-U7; approved supported mobile environments.
- **Result and acceptance:** A signed-in responder sees only authorized tenant
  assignments. The dispatch result reaches the app through its approved delivery
  contract; reconnect reloads canonical work. Expired/revoked tokens stop access,
  and unavailable connectivity has explicit retry feedback.
- **Verification:** Dispatcher-to-mobile receipt, foreign assignment access,
  session expiry/revocation, restart, and reconnect on supported mobile targets.

### P6-U2 — Accept, progress, and complete assignments

- **Goal:** Complete the responder's operational journey with validated transitions.
- **Scope:** Assignment lifecycle commands, mobile actions/status feedback,
  transactional history/audit/outbox, and conflict handling.
- **Dependencies:** P6-U1; approved transition and completion rules.
- **Result and acceptance:** The assigned responder can accept, report progress,
  and complete work. Repeated or stale commands have defined safe results;
  unauthorized actors and invalid transitions fail. Canonical history attributes
  each change and supports the approved incident-closure policy.
- **Verification:** Full mobile lifecycle, concurrent/repeated commands, invalid
  transitions, revoked authorization, reconnect, and incident closure interaction.

### P6-U3 — Share foreground responder location

- **Goal:** Make authorized foreground field position available to operations.
- **Scope:** Mobile permission/collection UX, authenticated observations, PostGIS
  storage, frequency limits, timestamps, and location freshness contracts.
- **Dependencies:** P6-U1, P5-U5; approved consent/frequency/freshness/retention rules.
- **Result and acceptance:** Foreground sharing records location for the correct
  responder and tenant. Denied permissions, disabled sharing, stale observations,
  and interrupted connectivity have explicit states. Invalid, foreign, duplicate,
  or excessive observations are handled by the approved contract.
- **Verification:** Supported-device permission and foreground checks, bounds/
  timestamp validation, replay/rate limits, connectivity loss, and tenant isolation.

### P6-U4 — Synchronize queues and maps across replicas

- **Goal:** Keep staff and responder views consistent after changes and delivery gaps.
- **Scope:** Redis-backed fanout, tenant-authorized sockets, version/cursor gap
  handling, canonical resync, operational queues/maps, and socket revalidation.
- **Dependencies:** P5-U2, P5-U6, P5-U7, P6-U2, P6-U3, P1-U5, P2-U2.
- **Result and acceptance:** Two staff sessions and one responder session on
  different replicas converge on incident, assignment, availability, status, and
  location changes. Reconnect after replica/broker interruption reloads canonical
  state. Revoked sockets lose authority; cross-tenant subscription/delivery is
  rejected. Load-balancer transport/affinity behavior is explicit and verified.
- **Verification:** Multi-client/two-replica journey, lost/duplicate/out-of-order
  notifications, broker interruption, replica stop, reconnect, session revocation,
  and attempted foreign-room subscription.

**Phase gate:** Dispatch-to-mobile completion, foreground location, and synchronized
staff monitoring pass. Mobile and reconnect procedures are documented.

## Phase 7 — Verify the complete first-release journey

**Outcome:** The staff-to-responder workflow and foundational recovery guarantees
pass a reproducible acceptance matrix; limitations are explicitly recorded.

### P7-U1 — Run the complete two-tenant operational journey

- **Goal:** Prove the first-release product journey across all implemented surfaces.
- **Scope:** Acceptance fixtures, browser/mobile integration checks, and user guides.
- **Dependencies:** Phase 6 gate and all first-release feature units.
- **Result and acceptance:** Onboard two tenants, verify routing, assign staff
  extensions, receive a call, refresh a meaningful draft, correct its location,
  create/edit/dispatch, accept/progress/share location/complete, and close. Timeline
  and audit explain the entire journey with actors. Foreign tenant/role/plane
  requests fail at each relevant boundary.
- **Verification:** Run the automated matrix plus required live PBX and supported
  mobile checks; inspect canonical database history and record environment limits.

### P7-U2 — Verify distributed interruption and recovery

- **Goal:** Prove first-release operation does not depend on one healthy replica.
- **Scope:** Load balancer/Compose scaling checks, sessions, fanout, jobs, PBX
  ownership recovery, runbooks, and failure-injection fixtures.
- **Dependencies:** P7-U1.
- **Result and acceptance:** Stopping one HTTP replica leaves the other serving
  through the load balancer. Shared logout/reset/role/suspension enforcement holds.
  Session-store outage denies protected operations; reconnect restores canonical
  state after broker loss. Duplicate jobs and PBX observer failover preserve data
  and tenant attribution. These checks prove single-host behavior only.
- **Verification:** Reproducible stop/restart, Redis outage/recovery, concurrent
  revocation, job retry, PBX lease/fencing, and reconnect scenarios with assertions.

### P7-U3 — Record first-release acceptance and operator readiness

- **Goal:** Make the delivered milestone runnable and its evidence reviewable.
- **Scope:** Complete check command, docs index/status, staff/mobile/operator guides,
  authentication/realtime/PBX recovery runbooks, and progress tracker.
- **Dependencies:** P7-U1, P7-U2.
- **Result and acceptance:** One documented command runs the first-release matrix.
  Documentation explains supported journeys, setup, troubleshooting, recovery,
  and unresolved limitations. No required live check is represented as complete
  by a simulator, and no production availability is inferred from Compose results.
- **Verification:** Follow documentation from a fresh checkout and reconcile all
  first-release criteria with recorded results and unfinished work.

**Phase gate:** Overview success criteria 1–8 are demonstrated within their
first-release boundary. Operational launch still requires Phase 9.

## Phase 8 — Add public channels and operational extensions

**Outcome:** Each approved extension has its own verified journey and retains the
same tenant ownership, canonical incident model, timeline, and audit guarantees.

### P8-U1 — Attach incident evidence

- **Goal:** Let authorized users add and retrieve incident evidence safely.
- **Scope:** Attachment metadata/upload/access, approved file rules and retention,
  shared object storage, and incident detail UI.
- **Dependencies:** Phase 7 gate, P1-U6; approved evidence access policies.
- **Result and acceptance:** Evidence belongs to its incident's tenant. File access
  uses tenant checks and expiring references; unsafe uploads and foreign requests
  fail. Partial upload/storage failures do not leave falsely available evidence.
  Cleanup follows approved policy and preserves required audit/history.
- **Verification:** Upload/retrieve/expire/delete-policy checks, unsafe files,
  cross-tenant references, storage failure, interrupted upload, and retry.

### P8-U2 — Expose authorized recording references

- **Goal:** Let authorized staff access retained call recording evidence.
- **Scope:** Trusted recording metadata synchronization, call/incident linkage,
  access-controlled references, approved retention behavior, and incident detail UI.
- **Dependencies:** Phase 7 gate, P5-U3; approved recording access/storage policy.
- **Result and acceptance:** Raw recordings remain Asterisk-owned. Synchronized
  metadata links recordings to the correct tenant and call/incident under the
  approved contract. Access is tenant/role-checked and expires as specified;
  unavailable recordings have an explicit state rather than a misleading link.
- **Verification:** Controlled call recording, metadata duplicate/reconciliation,
  valid and foreign access, expired references, missing media, and retention behavior.

### P8-U3 — Establish public intake handoff

- **Goal:** Accept a public request without allowing public selection of a tenant.
- **Scope:** Public entrypoint mappings, request/session contracts, shared rate
  limits, replay protection, and canonical incident creation/enrichment use cases.
- **Dependencies:** Phase 7 gate; approved public ownership and handoff policy.
- **Result and acceptance:** Deployment-controlled mappings resolve one tenant.
  Accepted requests create or enrich the canonical incident according to approved
  rules. Duplicates/replays cannot multiply incidents; unknown/ambiguous mappings
  fail safely. Responses expose neither internal operational data nor a tenant directory.
- **Verification:** Two mapped entrypoints, forged tenant input, duplicate/concurrent
  requests, throttling, mapping failure, and canonical history/audit checks.

### P8-U4 — Deliver no-install public web reporting

- **Goal:** Let a reporter submit a request from a web browser.
- **Scope:** `apps/public-web`, approved reporter/location fields, accessible form,
  public session/submission feedback, and evidence integration if approved.
- **Dependencies:** P8-U3; P8-U1 if attachments are required for this channel.
- **Result and acceptance:** Submission reaches the correct tenant workflow and
  receives only approved public feedback. Invalid input preserves form values;
  refresh/retry follows the public session contract. Public screens cannot open
  internal incidents, responder locations, or staff data.
- **Verification:** Mobile/desktop browser submit, validation/retry, mapping,
  accessibility, rate limits, and internal-data access rejection.

### P8-U5 — Deliver public mobile reporting

- **Goal:** Let citizens submit through the dedicated public mobile app.
- **Scope:** `apps/public-mobile`, approved location/evidence permissions, public
  sessions, reporting UI, and reconnect/retry behavior.
- **Dependencies:** P8-U3; approved mobile targets and citizen request contract;
  P8-U1 if attachments are required.
- **Result and acceptance:** A mobile report reaches the same canonical workflow
  and ownership rules as web intake. Permission denial and interrupted submission
  have explicit feedback. Repeated delivery follows replay/deduplication rules.
- **Verification:** Supported-device submission, permissions, reconnect/replay,
  mapping isolation, and absence of internal operational data.

### P8-U6 — Deliver SMS intake

- **Goal:** Convert approved inbound SMS into canonical requests/incidents.
- **Scope:** Approved SMS provider adapter, authenticated callbacks, trusted number
  mappings, durable processing, replay handling, and staff-visible source context.
- **Dependencies:** P8-U3, P1-U5; approved provider and SMS handling contract.
- **Result and acceptance:** Trusted callbacks resolve tenant ownership through
  deployment mappings and create/enrich incidents as specified. Forged, repeated,
  ambiguous, and failed deliveries have defined outcomes; provider credentials
  never enter clients or audit payloads.
- **Verification:** Provider contract checks and controlled live SMS, callback
  authentication, duplicate/retry, outage recovery, and two-tenant mapping checks.

### P8-U7 — Deliver public voice intake

- **Goal:** Feed approved public voice entry points into the incident workflow.
- **Scope:** Trusted public voice route/session handoff, call-to-request linkage,
  durable event processing, and staff-visible intake context.
- **Dependencies:** P8-U3, P5-U3, P4-U2; approved public voice behavior.
- **Result and acceptance:** Calls on approved entrypoints resolve the correct
  tenant and create/enrich canonical work under the defined handoff contract.
  Caller numbers do not confer ownership; unknown/ambiguous sources fail closed.
  Repeated events and observer recovery do not duplicate operational work.
- **Verification:** Controlled live public calls, route ownership, duplicate events,
  unknown sources, interruption/reconciliation, and retained source/audit linkage.

### P8-U8 — Deliver browser calling

- **Goal:** Let authorized staff use the approved browser calling experience.
- **Scope:** WebRTC/SIP client integration, short-lived credential/access flow,
  call UI, audio permissions, reconnect, and verified extension enforcement.
- **Dependencies:** P4-U5, P5-U3; approved client, transport, and credential design.
- **Result and acceptance:** Only authorized staff with ready extensions can call
  through permitted routes. Clients receive no long-lived PBX or administration
  credentials. Call state remains Asterisk-authoritative; permission/connectivity
  failures are visible, and intake linkage preserves tenant ownership.
- **Verification:** Controlled browser calls, permissions, denied routes/extensions,
  credential expiry/revocation, reconnect, and secret-exposure checks.

### P8-U9 — Deliver audit review and operational recovery tools

- **Goal:** Let authorized operators investigate and repair approved failed work.
- **Scope:** Audit search/detail, durable job/apply status, approved retry/reconcile
  actions, permissions, and operational tool screens.
- **Dependencies:** P1-U5, P3-U5, Phase 7 gate; approved recovery-action permissions.
- **Result and acceptance:** Users can trace actor-attributed history and inspect
  failures within their authority. Recovery actions are explicit, idempotent, and
  audited; history cannot be rewritten through the tools. Platform and tenant
  views preserve their distinct authority and visibility boundaries.
- **Verification:** Trace a complete incident and failed job/apply, retry/reconcile,
  duplicate recovery, forbidden actions, and history/tenant isolation checks.

### P8-U10 — Deliver approved dashboards, reports, and exports

- **Goal:** Provide the agreed operational summaries without changing canonical truth.
- **Scope:** Reporting module, named-consumer projections, dashboard/report UI,
  bounded queries, and durable exports where needed.
- **Dependencies:** Phase 7 gate, P1-U5; approved metrics/report/export definitions.
- **Result and acceptance:** Figures match canonical source records under documented
  consistency rules. Reports are tenant/role-scoped, paginated or bounded, and
  resource-limited. Export access preserves tenant ownership and approved retention.
  New read models identify their consumer, owner, and recovery behavior.
- **Verification:** Known-data totals, filter/date boundaries, foreign tenant access,
  projection recovery, large-query limits, duplicate exports, and access expiry.

### P8-U11 — Enforce retention and cleanup policies

- **Goal:** Apply approved data lifetimes without breaking required history.
- **Scope:** Retention configuration/contracts, durable cleanup jobs, attachment/
  recording references, public sessions, drafts, locations, and export artifacts.
- **Dependencies:** Approved retention/legal requirements; each affected feature
  must exist before its cleanup is implemented.
- **Result and acceptance:** Each stored data class has an explicit retention and
  deletion/archive policy. Repeated or interrupted cleanup is safe; required
  timeline/audit and referential integrity remain intact. Cleanup changes are
  observable and respect tenant boundaries and permitted administrative controls.
- **Verification:** Expiry-boundary fixtures, protected history, interrupted/repeated
  cleanup, storage/database partial failure, and cross-tenant safety checks.

**Phase gate:** Each required extension passes its channel-specific journey and
the relevant canonical-workflow regression checks. Deferrals are recorded by unit.

## Phase 9 — Prove production readiness and launch the new system

**Outcome:** Production deployment, initial provisioning, and operational use are
supported by measured targets and successful recovery/rollback rehearsals.

### P9-U1 — Approve production targets and infrastructure decisions

- **Goal:** Define measurable readiness before evaluating production behavior.
- **Scope:** Capacity/latency/accessibility/security/recovery targets and ADRs for
  scheduler, backing-service availability, secrets, pooling, storage, and PBX recovery.
- **Dependencies:** Phase 7 evidence; approved deployment scope and responsible owners.
- **Result and acceptance:** Document concurrent users/sockets, requests/location
  rates, incident throughput, call concurrency, data volume, error/latency budgets,
  RPO/RTO, backup cadence, and accessibility/security criteria. Define which Phase 8
  units are launch requirements. No numerical target is assumed by this plan.
- **Verification:** Review targets for measurability, ownership, and an executable
  check procedure; unresolved targets block dependent readiness approval.

### P9-U2 — Implement the production deployment and observability

- **Goal:** Run the approved architecture across production failure domains.
- **Scope:** Production scheduler/ingress, independent replica groups, at least two
  HTTP replicas, HA backing services, separate session/realtime Redis, shared storage,
  secrets, database pool budgets, health/draining, monitoring, and scaling limits.
- **Dependencies:** P9-U1; selected platform and infrastructure access.
- **Result and acceptance:** Rolling deployment and graceful shutdown preserve
  serving replicas. Redis has approved TLS/ACL/persistence/failover and memory policy.
  Workers/PBX observers coordinate ownership. Next.js caches are shared consistently
  or disabled as appropriate, with tenant-scoped keys. Alerts cover service health,
  resource usage, queue age/depth, connections, and failed external work.
- **Verification:** Staging deployment, rolling update/drain, replica/failure-domain
  interruption, Redis failover, migration coordination, pool budgets, alerts, and
  tenant cache/session/fanout isolation under the deployed ingress configuration.

### P9-U3 — Measure load, security, accessibility, and recovery

- **Goal:** Demonstrate agreed targets against the deployed release candidate.
- **Scope:** Representative multi-tenant load tests, critical UI accessibility,
  security review, database/storage/session recovery, and PBX failure rehearsals.
- **Dependencies:** P9-U2 and all features included in launch scope.
- **Result and acceptance:** Measured capacity, latency, errors, noisy-tenant
  containment, queue delay, session/socket behavior, PBX media/registration limits,
  and recovery meet P9-U1 targets. Security/accessibility findings required for
  launch are resolved. Unmet targets keep readiness incomplete.
- **Verification:** Run the approved matrix and retain measurements, environment,
  workloads, failure-injection steps, results, and material limitations.

### P9-U4 — Verify initial provisioning, backup/restore, and rollback

- **Goal:** Prepare a fresh system for real organizations with recoverable changes.
- **Scope:** Trusted provisioning commands, fresh/upgrade migrations, tenant/admin/
  PBX setup, validation reports, backup/restore, deployment rollback, and runbooks.
- **Dependencies:** P9-U2, P9-U3; approved launch configuration and recovery objectives.
- **Result and acceptance:** Provisioning is retry-safe and verifies tenant ownership,
  foreign keys, critical read models, routing, credentials, and actor-attributed audit.
  Restore and deployment rollback rehearsals preserve required data and meet agreed
  recovery targets. This is initial provisioning, not migration from a legacy system.
- **Verification:** Fresh environment provisioning, duplicate/interrupted rerun,
  schema upgrade, controlled inbound/outbound calls, operational smoke checks,
  measured backup restore, and deployment rollback followed by the smoke checks.

### P9-U5 — Complete operational launch handover

- **Goal:** Open the verified release for operational use with accountable support.
- **Scope:** Final release evidence, deployment status, launch checklist, training,
  operator/user documentation, monitoring ownership, and escalation procedures.
- **Dependencies:** P9-U3, P9-U4, Phase 7 gate, and every Phase 8 unit required by P9-U1.
- **Result and acceptance:** The complete release matrix passes in the agreed
  environment. Responsible operators can provision, monitor, recover, and escalate
  using documented procedures. Initial operational smoke checks pass; remaining
  deferred scope is explicit and does not hide a failed launch criterion.
- **Verification:** Rehearse handover/runbooks with the responsible operators,
  execute final smoke checks, and reconcile evidence against all launch criteria.

**Phase gate:** Overview success criteria 9–10 and all deployment-specific launch
requirements pass. Record the release, evidence, owners, and actual launch state.

## Decisions required before dependent implementation

These questions do not prevent creating the plan or starting independent
foundation work. They prevent completing the units that require their answers.

| Decision | What must be established | Affected units |
| --- | --- | --- |
| Operational rules | Exact role matrix; incident/assignment transitions; closure with outstanding work; responder eligibility and concurrency; category/priority behavior. | P1-U1, P4-U4, P5-U1–P5-U2, P5-U6–P5-U7, P6-U2 |
| Credentials and lifecycle | Setup/reset/recovery delivery and expiry; administrator safeguards; tenant lifecycle effects on access, routes, and active work. | P2-U4, P4-U1, P4-U3–P4-U4 |
| Geographic behavior | Who configures default coordinates; valid service-area/bounds behavior; approved tiles/search provider and availability expectations. | P4-U1, P5-U4–P5-U5 |
| Draft and location policies | Draft ownership/recovery/conflicts; foreground sharing consent, frequency, stale thresholds, retention, and mobile support targets. | P5-U4, P6-U1–P6-U3 |
| Telephony environment and policy | Controlled PBX access; secret store; permitted validation/reload commands; route semantics; active-call change policy; test destinations. | P3-U1–P3-U5, P4-U2–P4-U3, P5-U3 |
| Shared files and evidence | Storage provider, allowed files/limits, recording access, reference lifetime, retention, and recovery objectives. | P1-U6, P8-U1–P8-U2, P8-U11, P9-U1 |
| Public channels | Entry mappings; create-versus-enrich handoff; public feedback; mobile targets; SMS provider; public voice interaction; channel launch scope. | P8-U3–P8-U7, P9-U1 |
| Later tools | Browser calling client/credential flow; recovery permissions; metrics/report/export definitions; data retention obligations. | P8-U8–P8-U11 |
| Production acceptance | Scheduler/provider; failure domains; HA strategy; capacity, latency, accessibility, security, RPO/RTO, and PBX failover targets. | P9-U1–P9-U5 |

## Overview success-criteria coverage

| Overview criterion | Planned proof |
| --- | --- |
| 1. Fresh clone, database/backend, schema, checks, health | P1-U2–P1-U3; P7-U3 |
| 2. Tenant-qualified identity and separate authority planes | P2-U1–P2-U4; P7-U1 |
| 3. Browser PBX configuration, verified apply/recovery, safe attribution | P3-U1–P3-U5; P4-U2; P5-U3 |
| 4. Two tenants on one PBX, exclusive extensions/routes, assignment/readiness rejection | P4-U1–P4-U5; P7-U1 |
| 5. Protected intake through mobile assignment completion | P5-U1–P5-U7; P6-U1–P6-U3; P7-U1 |
| 6. Multi-replica convergence and reconnect without foreign delivery | P6-U4; P7-U2 |
| 7. Shared sessions, revocation, denied outage access, surviving replica | P2-U2–P2-U4; P4-U3–P4-U4; P7-U2; P9-U2–P9-U3 |
| 8. Retained actor history, runnable milestones, updated guides | P1-U5; every feature unit; P7-U1–P7-U3 |
| 9. Measured capacity, latency, accessibility, security, backup/recovery | P9-U1–P9-U3 |
| 10. Validated provisioning, smoke, restore, and rollback before launch | P9-U4–P9-U5 |

Public web/mobile/SMS/voice, evidence, browser calling, review/recovery tools,
dashboards/reports/exports, and retention are tracked in Phase 8 even where the
first-release success criteria do not require their complete delivery.
