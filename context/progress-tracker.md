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
P2-U1a/b/c and parent P2-U1 are complete and verified: canonical storage,
role/admission/version contracts and secure initial operator bootstrap.
P2-U2a/b/c and parent P2-U2 are complete and verified: shared lifecycle/fencing,
canonical HTTP guards, distributed admission and integrated controlled recovery.
P2-U3a/b and parent P2-U3 are complete and verified: platform HTTP/browser
access, logout and canonical-owner isolated reauthentication. Staff sign-in,
evidence authorization and production decisions remain pending.
P4-U1a-1 is complete: the protected atomic draft registry API and durable receipt
workflow are verified; P4-U1a-2 browser delivery and parent acceptance remain next.
Protected traffic/capacity validation remains mandatory before production.
Follow the agreed [build, review, improve process](ai-workflow-rules.md#build-review-improve):
small working steps, routine choices handled by the agent, user feedback on results,
and short questions only when a feature needs a decision.
The user requested a simpler process and to start building on 2026-10-04; this
authorizes routine foundation choices, not approval of proposed product rules.


## Completed

- P4-U1a-1 atomic draft creation/protected registry API: canonical owner ports,
  immutable operator-scoped receipt and qualified administrator linkage,
  authority-locked same-connection creation/audit, durable replica retries and
  protected uncached list/detail. A-01–08, complete identity/bootstrap, full
  Docker graph including audit/session/platform HTTP/browser regressions and
  all five client scans passed, exit 0. Local migration and health passed.
  Completed 2026-10-07 13:50 +08:00 (Asia/Manila); see [API evidence](../docs/status/p4-u1a-1-evidence.md).
  Browser child 2, parent acceptance, credentials, activation and PBX remain pending.

- DEV-PLATFORM-HTTPS implementation and automated verification: approved private
  SSH/HTTPS console, retained private CA/TLS/authentication material, exact
  origin/proxy configuration, lifecycle commands and Windows/macOS trust runbook.
  Real-stack security/browser and restart/preservation checks passed; existing
  operator and shared containers/data retained. User confirmed working Windows
  access/sign-in on 2026-10-07; macOS and explicit refresh/logout checks remain
  unconfirmed. See
  [evidence and handoff limits](../docs/status/platform-development-https-evidence.md).

- P2-U3b browser access/isolated reauthentication and parent P2-U3: real HTTPS
  Next/Nest composition, protected console, cookie/CSRF proxy, keyboard sign-in,
  confirmed/retryable cross-replica logout and same-owner in-memory work recovery.
  Protected dialogs hide/release focus; foreign-owner shell/work state clears.
  B-01–08, A-01–09, parent AC-01–11, complete session/full Docker checks,
  nine normal UI regressions and all five client scans passed, exit 0.
  Completed 2026-10-07 09:11 +08:00 (Asia/Manila); see [combined evidence](../docs/status/p2-u3b-evidence.md).

- P2-U3a platform authentication HTTP boundary: real tenantless credentials,
  bounded typed verifier, shared pre-verification limits, canonical version-bound
  web issuance, declared Secure cookie consumers, trusted proxy/Origin and
  context-bound CSRF, passive current-session/logout and cross-replica durable
  single-session revocation. A-01–09, focused HTTP/HTTPS Chromium, identity/
  bootstrap/session regressions and full Docker checks passed. See
  [a evidence](../docs/status/p2-u3a-evidence.md). b and parent are subsequently complete.

- P2-U2c distributed admission/integrated recovery and parent P2-U2: approved
  independent source/identity limits, bounded expiring atomic Redis registries,
  trusted proxy extraction, protected 429/503 and new-operation reconnection without
  write replay. C-01–07, all a/b regressions, parent AC-01–11, complete focused and
  full Docker checks passed. See [combined evidence](../docs/status/p2-u2c-evidence.md).
  Production realistic traffic/capacity review and U3/U4/Phase 2 transport remain.

- P2-U2b canonical HTTP authority and guards: current primary canonical versions,
  frozen plane-qualified principals/approved grants, explicit global route policy,
  safe 401/403/503, post-success conditional renewal and typed transactional owner
  locks. B-01–07, real two-HTTP-replica authority/lifecycle checks and full Docker
  checks passed. See [b evidence](../docs/status/p2-u2b-evidence.md).
  c and parent are subsequently complete; browser/mobile sign-in remain U3/U4.

- P2-U2a shared session lifecycle and durable recovery fencing: approved web
  60-minute/12-hour and mobile 24-hour/7-day policy, qualifying activity only,
  fixed absolute deadline through rotation, audited PostgreSQL generation/
  revocation fencing, bounded Redis scripts/configuration/maintenance and
  independent-process real-service expiry/race/uncertain-write/stale-restore
  checks. A-01–07, final focused and full Docker checks passed. See
  [lifecycle evidence](../docs/status/p2-u2a-evidence.md). c and parent are subsequently complete.

- P2-U1c secure initial operator bootstrap and parent P2-U1: approved scoped
  D-05 policy, protected input/private hashing, atomic system audit/provenance,
  independent process races and durable interruption/commit-response-loss recovery;
  C-01–08, parent AC-01–11 and full Docker checks passed. See
  [integrated evidence](../docs/status/p2-u1c-evidence.md).

- P2-U1b approved role bundles and creator-closure grant, canonical plane-specific
  admission snapshots, isolated credential ports and atomic authority-version/audit
  mutations: B-01–07, focused real-PostgreSQL a/b checks and full Docker checks
  passed. See [P2-U1b evidence](../docs/status/p2-u1b-evidence.md).

- P2-U1a canonical identity stores and ownership constraints: approved D-05
  storage states, tenant/staff/operator separation, immutable ownership, audited
  qualified repositories and runtime grants; focused real-PostgreSQL and full
  Docker checks passed. See [P2-U1a evidence](../docs/status/p2-u1a-evidence.md).

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

None.

## Unit Checkpoints

### P4-U1a — Draft tenant creation and initial administrator

- **Status:** in progress at parent level; backend child 1 is complete, browser child 2 remains planned (2026-10-07, Asia/Manila, +08:00).
- **Requirement/scope:** [feature spec](feature-specs/p4-u1a-draft-tenant-creation-and-initial-administrator.md); protected list/create/detail, atomic draft tenant and unset first administrator, platform audit and durable retry recovery.
- **Dependencies:** completed P2-U1/U2/U3 and P1-U4/U5; no P2-U4 or Phase 3 prerequisite under the approved delivery-order exception.
- **Acceptance/checks:** AC-01–11; `./dev exec pnpm check:draft-tenant --api` is implemented and verified. Browser/combined selectors remain with child 2. Real database/runtime grants, Redis, two HTTP replicas, HTTPS browser journey and retained foundation/auth regressions plus `./dev check` are required during implementation.
- **Review/split:** adopted 2026-10-07 (Asia/Manila, +08:00); sequential [P4-U1a-1 atomic creation/protected API](feature-specs/p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md) and [P4-U1a-2 browser journey/integrated handoff](feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md). Child 1 is verified complete; child 2 is planned. Scoped staff target integration preserves one connection, actor/correlation and poison while retaining existing consumers.
- **Remaining:** child 2 browser implementation and combined parent acceptance/evidence. Credential setup remains P2-U4/P4-U1b; activation remains P4-U3. Draft staff admission remains denied.
- **Verification:** backend A-01–08 and required regressions pass; see child 1 evidence. Browser and complete parent verification remain pending.

### P4-U1a-1 — Atomic draft creation and protected registry API

- **Status:** complete; verified 2026-10-07 13:50 +08:00 (Asia/Manila).
- **Requirement/scope:** [child spec](feature-specs/p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md); owned create/read ports, protected API, same-connection target integration, durable receipt, transactional audit and admission denial.
- **Dependencies:** completed P2-U1/U2/U3 and P1-U4/U5; recheck their evidence before starting.
- **Acceptance/checks:** A-01–08 cover parent AC-01–08/10/11 at the backend boundary and session regressions. Final `./dev exec pnpm check:draft-tenant --api`, complete `check:identity-foundation` and `./dev check` passed, exit 0. The full graph includes existing audit/outbox, platform HTTP/HTTPS browser, session/admission/recovery and all five client scans.
- **Delivered:** protected POST/GET `/platform/tenants` and GET `/platform/tenants/:tenantId`; canonical owner creation/reads, strict bounded normalization, operator/request fingerprint receipts, qualified immutable linkage, one authority-locked creation commit and both owner audit facts. Expiring staff target handles share connection/poison and unfinished scopes prevent commit; only the canonical code constraint yields code conflict. Read pagination defaults to 25/max 100 with UUID keysets. Reads are passive; create is operational.
- **Evidence:** [acceptance/commands/limits](../docs/status/p4-u1a-1-evidence.md) and [API/DTO/receipt/migration/handoff contract](../docs/architecture/draft-tenant-registry-api.md). Local additive deployment and live/ready 200 passed. The initial full check found one stale identity migration count; corrected to eight, focused reruns and final full graph passed.
- **Remaining/handoff:** no child 1 work remains. Child 2 must implement declared Next forwarding, owner-bound browser form/list/detail and combined parent verification. P4-U1a/P4-U1 and the staff gate remain incomplete.

### P4-U1a-2 — Operator browser creation and integrated handoff

- **Status:** planned; split adopted and specification created 2026-10-07 (Asia/Manila, +08:00).
- **Requirement/scope:** [child spec](feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md); protected tenant list/form/detail, explicit forwarding, owner-bound attempt recovery and complete parent acceptance.
- **Dependencies:** verified P4-U1a-1 and delivered P2-U3b/P1-U4 browser/UI foundation.
- **Acceptance/checks:** B-01–08, child 1 A-01–08 and parent AC-01–11. Proposed browser/combined `check:draft-tenant` selectors, existing regressions and final `./dev check`; new commands not implemented.
- **Remaining/handoff:** all browser implementation and integrated checks. P4-U1a completes only with both children verified; credential setup, later onboarding and activation stay with P2-U4/P4-U1b/P4-U3.

### DEV-PLATFORM-HTTPS — Private development console access

- **Status:** implementation and automated verification complete;
  2026-10-07 10:20 +08:00 (Asia/Manila). User subsequently confirmed working Windows
  access/sign-in; macOS and explicit refresh/logout checklist confirmation remain
  pending.
- **Scope/approval:** user approved private `https://localhost:3443` through SSH to
  server loopback 3101, retained existing data/shared services/operator and no
  public console or disposable authentication environment. See the
  [approved decision](../docs/planning/platform-development-https-access.md).
- **Implemented:** Docker workspace HTTPS ingress, private normal Next/Nest
  processes, persistent owner-only CA/TLS/authentication secrets, exact origin and
  proxy peers, publication guard, prepare/start/status/stop/check commands and
  Windows/macOS trust instructions.
- **Verification:** final `./dev platform-https-check` passed, exit 0, including
  real CA/hostname checks, cookie/CSRF/session denial, request/source rejection,
  cross-container private-listener isolation, normal browser presentation and
  client secret/fixture exclusion. Host loopback TLS CSRF probe returned 200.
  Stop/restart retained original operator, shared credentials and all private
  material; normal backend/UI/Next builds, scoped ESLint, shell syntax, formatting,
  Compose/docs-link and whitespace checks passed.
- **Handoff:** [server/Windows/macOS runbook](../docs/runbooks/platform-development-https.md)
  and [evidence/limits](../docs/status/platform-development-https-evidence.md).
  Test-started console stopped; existing seven development containers retained
  and shared services healthy. No migration, bootstrap or fixture provisioning
  ran. P2-U3 stays complete; U4/production remain planned.

### P2-U3 — Platform operator sign-in

- **Status:** complete; 2026-10-07 09:11 +08:00 (Asia/Manila).
- **Requirement/scope:** [feature spec](feature-specs/p2-u3-platform-operator-sign-in.md); tenantless credential verification, cookie/CSRF HTTP boundary, protected console, logout and identity-isolated expiry/reauthentication.
- **Acceptance/checks:** A-01–09, B-01–08 and parent AC-01–11 passed. Focused browser, combined platform, complete session and final full Docker commands passed, exit 0; latest full run reran the complete parent/session matrix.
- **Split:** adopted 2026-10-06; sequential [a HTTP boundary](feature-specs/p2-u3a-platform-authentication-http-boundary.md) and [b browser access/reauthentication](feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md), both complete and verified.
- **Dependencies:** complete P2-U1/U2 and P1-U4; existing Nest authority and approved lifetime/limiter policies preserved.
- **Remaining:** none within this unit. Phase 2 staff/mobile journeys and production infrastructure/traffic gates remain pending.
- **Verification/handoff:** [combined evidence](../docs/status/p2-u3b-evidence.md) maps every parent criterion, exact commands and limits; [operator guide](../docs/guides/platform-operator-access.md), [browser contract](../docs/architecture/platform-browser-access.md) and [runbook](../docs/runbooks/platform-authentication.md) record bootstrap/ingress prerequisites, recovery and future form integration.


### P2-U3a — Platform authentication HTTP boundary

- **Status:** complete; 2026-10-06 14:02 +08:00 (Asia/Manila).
- **Requirement/scope:** [a spec](feature-specs/p2-u3a-platform-authentication-http-boundary.md); credential verification, shared sign-in/session/logout, explicit cookie channel, CSRF and origin/source contract.
- **Dependencies:** verified P2-U1/U2 and P1-U4; recheck evidence before implementation.
- **Acceptance/checks:** A-01–09; `./dev exec pnpm check:platform-auth --http` includes A/B production adapters and HTTPS Chromium probe; identity/session regressions and `./dev check` are required.
- **Implemented:** named backend sign-in/current-session/logout, bounded typed verifier, explicit cookie consumers and shared-secret/context-bound CSRF transport. Contract: [HTTP boundary](../docs/architecture/platform-authentication-http.md).
- **Handoff:** tested endpoints, safe session/error DTOs, exact proxy/origin/source/CSRF requirements, logout retry procedure and real-service fixtures documented in [contract](../docs/architecture/platform-authentication-http.md), [runbook](../docs/runbooks/platform-authentication.md) and [evidence](../docs/status/p2-u3a-evidence.md). Console/proxy/reauthentication is subsequently delivered and verified in b; deployment origin/proxy/TLS and production traffic/capacity are prerequisites.
- **Verification:** A-01–09 passed; final focused `./dev exec pnpm check:platform-auth --http` and complete `./dev check` passed, exit 0, including identity/bootstrap, all session/admission/recovery, production module wiring, HTTPS Chromium and all five client scans. Links/format/launcher/whitespace and precise fixture teardown verified.

### P2-U3b — Platform browser access and isolated reauthentication

- **Status:** complete; 2026-10-07 09:11 +08:00 (Asia/Manila); started 2026-10-06 (Asia/Manila, +08:00).
- **Requirement/scope:** [b spec](feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md); protected browser console/sign-in/logout, narrow transport, same-operator unfinished-work recovery and complete parent acceptance.
- **Dependencies:** verified P2-U3a A-01–09 and P1-U4 shared primitives.
- **Implemented:** backend-validated dynamic server layout; exact trusted-ingress cookie/CSRF proxy; distinct accessible sign-in and safe returns; confirmed/retryable logout; expiry/outage hiding; coalesced canonical restoration reads and rendered-owner callback guards. Mounted non-secret work resumes only for its canonical owner; identity switch/confirmed logout clears work and shell state. Protected portal scope hides dialogs/menus and releases focus traps. Build-selected TypeScript paths exclude the verification form from shipping output while including it in the isolated test build.
- **Acceptance/checks:** B-01–08, a's A-01–09 and parent AC-01–11 passed. Focused browser/default platform/complete session commands passed; final `./dev check` reran all HTTP/browser/admission/lifecycle/recovery checks and passed, exit 0. Final normal UI suite passed all nine checks. All five built-client scans, links, format, launcher syntax, whitespace and precise fixture cleanup passed.
- **Remaining:** none within b. Retention is in memory during the mounted journey; refresh/process loss and durable incident drafts remain P5-U4. Staff/mobile and production TLS/HA/capacity gates remain pending.
- **Handoff:** [evidence](../docs/status/p2-u3b-evidence.md), [operator guide](../docs/guides/platform-operator-access.md), [browser/form contract](../docs/architecture/platform-browser-access.md) and [runbook](../docs/runbooks/platform-authentication.md). Phase 3 receives protected composition/current canonical owner; P2-U4 receives reusable cookie/CSRF patterns without staff authority or policy approval.

### P2-U2 — Shared session store and authorization guards

- **Status:** complete; 2026-10-06 11:12 +08:00 (Asia/Manila).
- **Requirement:** [parent specification](feature-specs/p2-u2-shared-session-store-and-authorization-guards.md); AC-01–11.
- **Implemented:** a shared lifecycle/durable recovery fences, b canonical HTTP
  authority/transaction guards and c approved distributed admission plus integrated
  failure/recovery. All three sequential children are complete.
- **Approval:** scoped lifetimes/activity/selective fencing and c limiter policy
  are approved. The protected 120/minute default and 8,192-counter ceiling retain
  mandatory realistic traffic/combined memory validation before production.
- **Verification:** complete focused `./dev exec pnpm check:session-foundation`
  and `./dev check` passed, exit 0, using actual Redis/PostgreSQL/runtime grants
  and independent HTTP processes. [Central evidence](../docs/status/p2-u2c-evidence.md)
  maps every parent AC to c's checks and [a proof](../docs/status/p2-u2a-evidence.md)/
  [b proof](../docs/status/p2-u2b-evidence.md). Health live/ready HTTP 200; exact
  fixture cleanup, client sentinels and docs/launcher checks passed.
- **Remaining:** none within parent scope. U3 platform sign-in/logout,
  cookie/CSRF and isolated reauthentication are subsequently verified. U4 owns
  staff sign-in/credential lifecycle, mobile transport and isolated recovery.
  Production HA/TLS/joint-store rollback and Phase 2 gate remain incomplete.

### P2-U2c — Distributed rate limits and integrated recovery handoff

- **Status:** complete; 2026-10-06 11:12 +08:00 (Asia/Manila).
- **Requirement:** [c specification](feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md); C-01–07 and parent AC-01–11.
- **Approval:** [section 1](../docs/planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy)
  approved with realistic polling/operator/future mobile traffic and capacity gates.
- **Implemented:** typed pre-verification admission; independent source/identity
  fixed windows, bounded 8,192-field expiring Redis registries, hashed identities,
  validated config/proxy extraction, finite private metrics, protected 400/429/503
  and bounded new-operation reconnection without ambiguous write replay.
- **Verification:** focused `--limits`, complete default and full Docker passed,
  exit 0, including a/b regressions, barriers, ACL/OOM/response-loss/timeout, actual
  Redis restart/stale restore and interrupted primary recovery on both HTTP
  replicas. Full registry measured 876,709 bytes. Health/cleanup and docs passed;
  [evidence](../docs/status/p2-u2c-evidence.md) records corrected fixture assertions
  and exact results. Hosted CI remains unexecuted locally.
- **Handoff:** [admission contract](../docs/architecture/distributed-admission.md)
  and [integrated operations](../docs/runbooks/session-foundation.md) define U3/U4
  issuance/renew/revoke/errors, restore quarantine/fencing, private credentials,
  noeviction/capacity and mandatory production traffic review.
- **Remaining:** none within c. Excluded credential-recovery/public-intake/socket
  limiter policies, browser/device journeys and Phase 2 acceptance remain pending.

### P2-U2b — Canonical authority validation and HTTP guards

- **Status:** complete; 2026-10-06 09:48 +08:00 (Asia/Manila).
- **Requirement:** [b specification](feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md); B-01–07.
- **Implemented:** current canonical frozen principals/actor mapping, explicit
  global plane/permission guards, generic 401/403/retryable 503, post-success
  conditional renewal, typed transaction authority locks and separate two-process
  HTTP fixture graph. Public health works during dependency failure.
- **Contract:** [canonical HTTP authority](../docs/architecture/canonical-http-authority.md);
  [verification runbook](../docs/runbooks/canonical-http-authority.md).
- **Verification:** focused `./dev exec pnpm check:session-foundation --authority`
  and final `./dev check` passed, exit 0. Final combined authority/lifecycle suite
  includes post-handler renewal outage. B-01–07, a regressions, canonical identity,
  five-client leakage and required Docker checks passed. Documentation consistency,
  relative links, formatting, launcher syntax and whitespace verified. See
  [b evidence](../docs/status/p2-u2b-evidence.md).
- **Remaining:** none within b. c receives guards/principals/errors/transaction ports
  and HTTP fixtures; c/parent/limits are subsequently complete. Sign-in and
  production decisions remain incomplete. U3/U4 own credential channels and expired-work preservation.

### P2-U2a — Shared session lifecycle and recovery fencing

- **Status:** complete; 2026-10-06 08:53 +08:00 (Asia/Manila).
- **Requirement:** [a specification](feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md); A-01–07.
- **Prepared:** [scoped D-05 review and durable generation fencing design](../docs/planning/p2-u2a-session-contract-review.md).
  Section 1 is approved with web 60-minute/12-hour and mobile 24-hour/7-day idle/absolute
  lifetimes and explicit successful authorized activity, excluding passive polling.
  Section 2 chooses selective durable fencing without revoking other devices.
- **Prerequisites:** read required context, P2-U1/P1-U3 evidence and existing
  plane-qualified authority/configuration boundaries;
  `./dev exec pnpm check:identity-foundation --authority` passed, exit 0,
  including real migrations/runtime grants, version races and unavailable paths.
- **Approval:** user explicitly approved revised lifetimes/activity and durable
  fencing on 2026-10-06. Expiry/reauthentication must hand off preservation of
  unfinished incident work to P2-U3/U4. Unrelated product decisions remain pending.
- **Implemented checkpoint:** typed backend lifecycle and canonical bridge, bounded
  approved configuration, strict schema/plane records, audited durable generation
  fences with migration/grants, conditional Redis scripts and trusted runtime.
  Isolated Redis/PostgreSQL independent-process fixture and full Docker wiring
  are added; focused lifecycle suite passed, exit 0: strict issuance/records, deadline/TTL
  caps, barrier races, real response loss/OOM/timeouts, audit rollback/interruption,
  actual Redis restart and restored-record fencing. Final audited cleanup, real
  PostgreSQL COMMIT-response loss, physical TTL expiry and full Docker checks
  passed, exit 0; final lint/format/links/whitespace passed. See
  [A-01–07 evidence](../docs/status/p2-u2a-evidence.md).
  Local trusted migration and live/ready HTTP 200 passed; seven migrations,
  zero session/identity seeds and no session fixture databases remain.
- **Handoff:** b receives typed lookup/lifecycle and canonical bridge, conditional
  renewal and fencing; c receives bounded failure/restore/restart fixtures/settings.
  P2-U3/U4 must verify expiry/reauthentication with preservation and isolation of
  unfinished incident work. a alone does not establish HTTP/sign-in acceptance; b/c and parent are now
  verified separately. Sign-in and Phase 2 remain incomplete.

### P2-U2 implementation sub-units

| Unit | Status | Scope and verification |
| --- | --- | --- |
| [P2-U2a — Shared session lifecycle and recovery fencing](feature-specs/p2-u2a-shared-session-lifecycle-and-recovery-fencing.md) | complete | Lifecycle, expiry/rotation/revocation and recovery fencing; A-01–07 with real-service independent-process checks. |
| [P2-U2b — Canonical authority validation and HTTP guards](feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md) | complete | Canonical principals, plane/permission guards and transactional authority boundary; B-01–07 with two HTTP replicas after a. |
| [P2-U2c — Distributed rate limits and integrated recovery handoff](feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md) | complete | Distributed limits, integrated outage/restore checks and combined parent handoff; C-01–07 and parent AC-01–11 after a/b. |

Parent completion requires all children and AC-01–11. The split preserves
top-level plan IDs and Phase 2 order; each child includes its own checks/docs.

### P2-U1c — Secure operator bootstrap and foundation handoff

- **Status:** complete; 2026-10-05 17:04 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1c specification](feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md).
- **Scope:** protected credential input, private hashing, explicit trusted deployment
  bootstrap, durable atomic provenance and combined identity verification/handoff.
- **Approval:** user approved [review sections 1–2](../docs/planning/p2-u1c-bootstrap-contract-review.md)
  and instructed implementation to continue; scoped D-05/P1-U1 handoff recorded
  in product contracts. Later D-05 policies remain pending.
- **Implemented:** bounded hidden/file input and salted private scrypt, explicit
  `./dev bootstrap-operator`, PostgreSQL singleton provenance/serialization,
  active/ready initial versions 1/1 and atomic trusted system audit. Reruns preserve
  credentials/versions; conflicts fail; lost commit response reports uncertainty.
- **Acceptance:** C-01–08 and parent AC-01–11 passed. Prerequisite a/b recheck,
  final combined `./dev exec pnpm check:identity-foundation` and full `./dev check`
  passed, exit 0. Independent actual command races, forced audit rejection,
  precommit process/database termination, real commit-response-loss recovery,
  hidden PTY confirmation, protected-input/hash bounds and client sentinels passed.
- **Operational check:** actual Docker launcher rejects protected weak input with
  fixed invalid-input/exit 1; local stores/provenance remain empty with six migrations.
  Live/ready HTTP 200; no identity/bootstrap fixture databases remain. Documentation
  links/formatting and whitespace checked. See [evidence](../docs/status/p2-u1c-evidence.md),
  [contract](../docs/architecture/canonical-operator-bootstrap.md) and
  [runbook](../docs/runbooks/operator-bootstrap.md).
- **Review corrections:** fixed strict indexed-access/import errors and refreshed
  activity statistics within the fixture's held transaction before lock observation.
  Final focused/full runs passed; no production transaction guarantee weakened.
- **Remaining:** none within c/parent. P2-U2–U4 own sessions/guards/sign-in;
  reset/delivery/recovery/last-admin and production readiness remain gated.

### P2-U1b — Role contracts and canonical tenancy admission

- **Status:** complete; 2026-10-05 15:32 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1b specification](feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md).
- **Scope:** approved role persistence, private plane-specific authority snapshots,
  canonical admission and atomic authority-version/audit mutations.
- **Required acceptance/checks:** B-01–07; focused real-PostgreSQL checks with a regressions,
  independent connection/concurrency checks and full `./dev check`.
- **Completed:** read AGENT.md, feature spec and mandatory project context;
  inspected a's evidence, storage contract, migration, transaction handle and
  existing owner repositories. Re-ran a's real-PostgreSQL prerequisite successfully.
- **Prerequisite recheck:** `./dev exec pnpm check:identity-foundation --storage` passed,
  exit 0: fresh/rerun migrations, ownership, qualified collisions, runtime grants,
  audit/version rollback and safe unavailable/sentinel checks. This earlier
  recheck covers a; final combined verification is recorded below.
- **Approved decision:** [P2-U1b contract review](../docs/planning/p2-u1b-contract-review.md)
  sections 1–4 approved, including fixed role names/cardinality/combinations,
  permission bundles and active/ready/active-tenant admission. Creator closure
  needs no additional dispatcher role and remains subject to D-02/D-03 safeguards.
  Recorded in [product contracts](../docs/planning/p1-u1-product-contracts.md).
- **Implemented:** approved role schema/bundles and creator grant, private coherent
  primary snapshot/verifier ports, owner authority mutations, event-specific audit,
  and focused authority selection with storage regressions and client sentinels.
- **Acceptance:** B-01–07 passed. Final focused `--authority` PostgreSQL suite
  includes a regressions; full `./dev check` passed, exit 0. Final runtime source
  lint/typecheck/format and document links/whitespace passed. Local migration,
  zero identity seeds, runtime role grant, live/ready HTTP 200 and fixture teardown
  verified. See [b evidence](../docs/status/p2-u1b-evidence.md) and
  [authority handoff](../docs/architecture/canonical-authority-admission.md).
- **Review corrections:** sparse role arrays and infinite credential timestamps
  deny; restored exact fixture constraints. Updated audit/foundation migration
  count assertions to six; final full rerun passed after the initial audit count
  failure. A focused run overlapped source edits; the rebuilt final run passed.
- **Remaining:** none within b. c owns usable hashing/bootstrap; P2-U2 must reload
  canonical account/tenant status and authority versions. No password/session/
  Redis/socket/PBX or parent completion is claimed. Hosted CI not run locally.
- **Deferred:** P1-U1 remains incomplete; credential policy/bootstrap, setup/reset/
  recovery, lifecycle transitions, PBX and active-work/session effects remain later.

### P2-U1a — Canonical identity stores and ownership constraints

- **Status:** complete; 2026-10-05 14:07 +08:00 (Asia/Manila).
- **Requirement:** [P2-U1a specification](feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md).
- **Scope:** canonical tenant/staff/operator stores, normalization, ownership,
  credential/provenance metadata, versions/grants, qualified audited repositories,
  caller-owned tenant registry port and isolated database/client checks.
- **Acceptance:** A-01–07 passed. See [evidence](../docs/status/p2-u1a-evidence.md)
  and [storage contract](../docs/architecture/canonical-identity-storage.md).
- **Scoped P1-U1 handoff:** user explicitly approved D-05 account `active`/`disabled`,
  credential `unset`/`ready` and associated storage rules for a; no state defaults.
  P1-U1 remains deferred. Roles, admission, authentication, password policy,
  setup/reset tokens, sessions and bootstrap execution remain with later units.
- **Completed:** canonical migration, immutable codes/ownership/IDs, restrictive
  tenant FK, unique namespaces, credential coherence, positive monotonic counters,
  restricted operator/bootstrap writes, plane/tenant-qualified read/write ports,
  atomic audit/stale/no-op semantics and reproducible fixture/check wiring.
- **Verification:** focused PostgreSQL command and final direct suite passed;
  full `./dev check` passed, exit 0. Local trusted migration, live/ready HTTP 200,
  zero identity seeds and no remaining identity fixture databases verified.
  Changed-document links/whitespace reviewed. Hosted CI not executed locally.
- **Remaining:** none within a. b owns role schema/admission and complete authority
  mutation rules; c owns usable password hashing and trusted bootstrap execution.
  Neither parent completion nor authentication/session acceptance is claimed.

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
  partial handoff. P2-U1a D-05 storage and P2-U1b D-01/D-05/D-06
  role/eligibility/admission handoffs are approved; other recommendations remain pending.
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

- **Status:** complete; 2026-10-05 17:04 +08:00 (Asia/Manila); a/b/c and parent acceptance verified.
- **Requirement and scope:** [P2-U1 parent spec](feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md);
  canonical stores/ownership, role contracts/admission and secure operator bootstrap.
- **Sequence:** adopted [a](feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md),
  [b](feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md) and
  [c](feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md), all complete.
- **Acceptance:** A-01–07, B-01–07, C-01–08 and parent AC-01–11 passed.
  Final complete identity command and `./dev check` passed, exit 0. Centralized
  [parent evidence](../docs/status/p2-u1c-evidence.md) maps every criterion to
  exact checks/results and limitations.
- **Handoff:** scoped a/b/c P1-U1 and D-01/D-05/D-06 decisions recorded;
  canonical plane-specific ports, eligibility/versions and private bootstrap
  credentials available to P2-U2. No authentication/session or Phase 2 gate claimed.

## Next Up

[P4-U1a — Create a draft tenant and its first administrator](implementation-plan.md#p4-u1a--create-a-draft-tenant-and-its-first-administrator),
then P2-U4 staff credential setup/sign-in, Phase 3, and P4-U1b/remaining Phase 4.
The user approved this delivery-order change on 2026-10-07 (Asia/Manila, +08:00).
P4-U1a backend child 1 is complete; [child 2 browser delivery](feature-specs/p4-u1a-2-operator-browser-creation-and-integrated-handoff.md) is next. P4-U1a/P4-U1 remain incomplete; P4-U1b and P2-U4 remain planned.

P4-U1a delivers protected platform list/create/detail with an atomic draft tenant
and first `tenant_admin` identity, unset credentials, and operator-attributed audit.
It depends on completed identity/session/platform/UI/audit foundations, not P2-U4
or PBX readiness. Required acceptance and verification are defined in the
[feature spec](feature-specs/p4-u1a-draft-tenant-creation-and-initial-administrator.md).
Its checkpoint records the adopted two-step split; child 1 provides the verified API/DTO/retry contract and child 2 completes the operator browser journey.

P1-U1 remains deferred outside approved scoped handoffs. P2-U4 must resolve
credential delivery/expiry/recovery and the draft administrator setup contract.
Draft tenants remain denied ordinary staff sign-in; credential setup does not
activate them. Activation and voice readiness remain P4-U3/later onboarding work.
The remaining Phase 2 staff gate stays incomplete.

### Planned units

P1-U1 is `deferred`; P1-U2, P1-U3 and P1-U4 are `complete`; P1-U5 and P1-U6 are `complete` (including P1-U6a/b); P2-U1 and P2-U2 are `complete` (all children complete); P2-U3 is `complete` (a/b complete); other units remain `planned`. Their requirement references,
scope, acceptance criteria, dependencies, and verification are defined in the
linked plan. P1-U2 scaffolding, full P1-U3 foundation and P1-U4 web foundation have been verified.
Create a detailed per-unit checkpoint when that unit starts.

| Phase | Unit IDs | Status | Scope and acceptance reference |
| --- | --- | --- | --- |
| 1 | P1-U1, P1-U2, P1-U3, P1-U4, P1-U5, P1-U6 | P1-U1 deferred; P1-U2/P1-U3/P1-U4 complete; P1-U5/P1-U6 complete | [Runnable foundation](implementation-plan.md#phase-1--establish-the-runnable-foundation) |
| 2 | P2-U1, P2-U2, P2-U3, P2-U4 | P2-U1/P2-U2/P2-U3 complete; U4 planned | [Identities and sessions](implementation-plan.md#phase-2--establish-identities-shared-sessions-and-access-boundaries) |
| 3 | P3-U1, P3-U2, P3-U3, P3-U4, P3-U5 | planned | [Asterisk administration](implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding) |
| 4 | P4-U1 (a/b), P4-U2, P4-U3, P4-U4, P4-U5 | planned; U1a next before P2-U4 | [Tenant onboarding and administration](implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration) |
| 5 | P5-U1, P5-U2, P5-U3, P5-U4, P5-U5, P5-U6, P5-U7 | planned | [Staff intake and dispatch](implementation-plan.md#phase-5--deliver-staff-intake-incident-management-and-dispatch) |
| 6 | P6-U1, P6-U2, P6-U3, P6-U4 | planned | [Responder mobile and monitoring](implementation-plan.md#phase-6--complete-responder-mobile-work-and-synchronized-monitoring) |
| 7 | P7-U1, P7-U2, P7-U3 | planned | [First-release verification](implementation-plan.md#phase-7--verify-the-complete-first-release-journey) |
| 8 | P8-U1, P8-U2, P8-U3, P8-U4, P8-U5, P8-U6, P8-U7, P8-U8, P8-U9, P8-U10, P8-U11 | planned | [Public channels and extensions](implementation-plan.md#phase-8--add-public-channels-and-operational-extensions) |
| 9 | P9-U1, P9-U2, P9-U3, P9-U4, P9-U5 | planned | [Production readiness and launch](implementation-plan.md#phase-9--prove-production-readiness-and-launch-the-new-system) |


## Open Questions

The [decision-gate table](implementation-plan.md#decisions-required-before-dependent-implementation)
identifies the required answers and affected units. Current unresolved areas are:

- Later evidence/recovery permissions, lifecycle transitions, closure safeguards, dispatch concurrency,
  responder eligibility/availability, and category/priority semantics.
- Distributed limiter policy is approved in [c review section 1](../docs/planning/p2-u2c-limiter-contract-review.md#1-approved-product-policy);
  realistic protected traffic and combined session/limiter capacity need production validation;
  production/joint-store recovery remains pending;
  scoped session lifetimes/activity and selective durable fencing are approved.
- Credential setup/reset/recovery (including draft administrator setup),
  administrator safeguards, and tenant lifecycle
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
The user owns approval of all decisions; D-05 storage representation and its
associated rules are approved for P2-U1a; D-01 and relevant D-05/D-06
role/eligibility/admission rules, including creator closure, are approved for b;
c's scoped bootstrap password policy and initial-account handoff are also approved.
Other proposed answers remain pending. P1-U1
is deferred; P1-U2 independent foundation implementation is complete.


## Architecture Decisions

User-authorized independent foundation work follows the existing stack, module
boundaries and shared-state invariants. Routine P1-U2 choices use pnpm ordering,
pinned compatible dependencies and isolated Nest modules; see
[workspace decisions](../docs/architecture/workspace-foundation.md). The scoped D-05 storage
representation handoff and b's scoped role/admission/creator-closure handoff are
approved; c's scoped bootstrap handoff is approved as well. Other P1-U1 product recommendations remain unapproved.


## Verification and Limitations

- P2-U3a/b and parent: A-01–09, B-01–08, parent AC-01–11, focused/combined
  platform, complete session and final full Docker checks passed, exit 0.
  Nine normal UI regressions and shipping fixture/credential exclusion passed.
  [Combined evidence](../docs/status/p2-u3b-evidence.md) records actual HTTPS
  topology, canonical-owner retention, precise cleanup and handoffs. Retention
  remains in memory; durable drafts, staff/mobile and production gates remain.

- P2-U2c and parent: C-01–07, a/b regressions, complete focused and full Docker
  checks passed. Central [AC-01–11 evidence](../docs/status/p2-u2c-evidence.md)
  records topology, safe results, exact cleanup and corrected fixture assertions.
  Mandatory realistic traffic/combined memory, production TLS/HA/joint rollback
  and U4 mobile/socket/reauthentication gates remain incomplete; U3 browser/CSRF
  and isolated reauthentication are subsequently complete.

- P2-U2a: A-01–07 and required focused/full checks passed. Lifecycle document
  links and new UI/transport handoffs passed review. The implementation plan has
  six pre-existing `context/...` source links that resolve incorrectly relative
  to that file; confirmed unchanged in HEAD and retained as an unrelated docs
  follow-up. No lifecycle/spec/runbook/evidence links depend on them.

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

- 2026-10-07 13:50 +08:00 (Asia/Manila) — Completed requested P4-U1a-1. Read instructions/context/spec
  and dependency source/evidence; implemented documented protected create/list/detail,
  canonical owner ports, fixed initial states, shared poisoned target handles,
  immutable qualified receipts and atomic owner audit. Final focused API A-01–08,
  full identity/bootstrap and full Docker checks passed, exit 0, including all
  session/platform HTTP/HTTPS browser regressions and five client scans. Local
  migration and health passed. Corrected a stale migration-count assertion exposed
  by the first full run; final full rerun passed. Recorded evidence/contracts and
  cleared active work. Child 2 and parent/browser acceptance remain pending.

- 2026-10-07 +08:00 (Asia/Manila) — User requested creating the P4-U1a split
  feature specs. Adopted sequential P4-U1a-1 API/database and P4-U1a-2 browser/
  integrated handoff; created detailed child contracts, acceptance criteria and
  parent coverage, linked parent/tracker/index and kept every unit planned.
  Clarified explicit recovery before editing an uncertain creation attempt.
  Documentation links, acceptance coverage and whitespace checked; no runtime
  implementation or tests claimed.

- 2026-10-07 +08:00 (Asia/Manila) — Prepared and reviewed the requested P4-U1a
  feature spec after AGENT.md, mandatory context and source inspection. Defined
  atomic draft/admin creation, per-target audit integration, durable retry receipt,
  protected list/detail/browser contracts and AC-01–11. Recommended two sequential
  sub-units without adopting or starting them. Reviewed documentation consistency,
  local links and whitespace; no runtime checks or feature completion claimed.

- 2026-10-07 11:12 +08:00 (Asia/Manila) — User approved updating the delivery plan
  to create a tenant and its first administrator before staff authentication.
  Split P4-U1 into early draft creation (a) and later onboarding configuration (b),
  added P4-U1a to P2-U4 dependencies, and synchronized Next Up and overview wording.
  Draft admission remains denied; credential setup policy and activation remain
  with their owning units. Reviewed dependency order and documentation consistency;
  no application changes, runtime checks, or new completion claims.

- 2026-10-07 — User confirmed Windows private HTTPS access/sign-in is working.
  Updated the development runbook with sequential PowerShell commands, download
  existence checks, encountered error recovery and terminal lifetime guidance.
  Added macOS certificate download/fingerprint comparison, login-keychain trust,
  SSH tunnel and certificate removal instructions from Apple's documentation.
  Windows success is user-reported; macOS and explicit refresh/logout checks remain
  unconfirmed. Documentation only; running console and shared services untouched.

- 2026-10-07 10:20 +08:00 — Completed approved DEV-PLATFORM-HTTPS implementation
  and automated verification using the existing database, Redis and operator.
  Added persistent private TLS/secrets, exact origin/proxy configuration,
  loopback/internal ingress and normal application processes, lifecycle tooling
  and Windows instructions. Real transport/browser/private-network checks passed;
  restart and original preservation baseline passed. Stopped owned test-started
  console processes and retained shared containers/data. Windows certificate
  trust and actual operator sign-in/logout remain the user's private manual step.

- 2026-10-07 — User requested documentation to review how to enable sign-in after
  successfully creating the initial operator. Prepared the
  [development HTTPS access proposal](../docs/planning/platform-development-https-access.md):
  recommended `https://localhost:3443` through an SSH tunnel to server loopback
  3101, certificate trust, private settings, ingress requirements and verification.
  Documentation only; runtime setup and the user's actual sign-in remain pending.
  Existing development data and bootstrap account are to be retained. P2-U3 stays
  complete; this proposal does not start staff access or production deployment.

- 2026-10-07 09:11 +08:00 (Asia/Manila) — Completed P2-U3b and parent P2-U3. Real production
  Next HTTPS composition, narrow ingress/cookie/CSRF proxy, protected server reads,
  accessible sign-in/logout and canonical-owner in-memory recovery are verified.
  Protected dialogs/menus hide and release focus during expiry; identity switches
  reset the shell. Build-selected TypeScript paths keep the fixture absent from
  shipping bundles and present only in isolated verification output. Final browser,
  complete parent/session/full Docker matrix, nine normal UI tests and all five
  client scans passed, exit 0; owned fixtures cleaned up. Updated guide/contracts,
  evidence/index/specs/tracker and cleared active work. U4 stays planned; Phase 2
  staff, durable drafts and production readiness remain outside this completion.

- 2026-10-06 14:02 +08:00 (Asia/Manila) — Completed P2-U3a A-01–09. Final focused
  auth HTTP/secure Chromium and full Docker checks passed, exit 0; actual
  production module wiring, real canonical credential/version races, independent
  A/B limits, single-session logout/retries, transactional authority, internal
  crypto failure, actual lost writes/stale restoration/recovery and all five
  client scans verified. Preserved bootstrap/bearer/lifecycle policies and
  generic failures; bounded credential pipeline prevents plaintext DB queues.
  Fixed conservative cookie expiry for HTTP-Date rounding and gave real COMMIT
  loss fixtures approved finite timeout headroom without relaxing assertions.
  Recorded contract/runbook/evidence/b handoff and cleared active work. b,
  parent browser journey, deployment prerequisites and production gates remain.

- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U3a at the user's request.
  Read AGENT.md/mandatory context/a and parent specs; rechecked delivered operator
  and combined session evidence. Implemented named auth HTTP contracts, canonical
  credential/version issuance, typed finite scrypt verification, explicit bearer/
  cookie policies, trusted proxy/Origin and stateless context-bound CSRF, passive
  session/logout and durable single-session revocation. Initial focused A/B and
  secure Chromium probe passed. Expanded checks found browser HTTP-Date cookie
  rounding could exceed absolute expiry; corrected the conservative Expires value
  and retained the strict assertion. Final acceptance/regressions/full Docker
  verification remain in progress; no a/parent completion claimed.

- 2026-10-06 (Asia/Manila, +08:00) — User adopted P2-U3a/b split and requested
  child specs. Created sequential HTTP-authentication and browser/reauthentication
  specs with A-01–09, B-01–08 and complete parent AC-01–11 ownership. Updated parent,
  tracker and docs index. Consistency, relative links, coverage and whitespace
  checked; children/parent remain planned with no runtime implementation claimed.


- 2026-10-06 (Asia/Manila, +08:00) — Read AGENT.md, required context and Phase 2;
  prepared/reviewed P2-U3 spec AC-01–11 against delivered operator/session/guard
  boundaries. Recommended two sequential sub-units with complete acceptance
  ownership. Identified bearer-only guard integration, verifier overload/error
  distinction, secure-origin/login CSRF and isolated unfinished-work handoff.
  Linked spec/tracker/index; documentation consistency, links and whitespace
  checked. Split remains proposed and P2-U3 planned; no runtime work claimed.


- 2026-10-06 11:12 +08:00 (Asia/Manila) — Completed P2-U2c and parent P2-U2 under approved
  limiter policy/production review conditions. Final full Docker and standalone
  complete session checks passed, exit 0; C-01–07/all a/b/parent AC-01–11 mapped
  in central evidence. Redis registry memory 876,709 bytes; health live/ready 200,
  exact fixture cleanup and final docs/config/launcher checks passed. Cleared
  active work. Realistic traffic/capacity/HA and U3/U4/Phase 2 gates remain open.


- 2026-10-06 (Asia/Manila, +08:00) — Full Docker check passed, including
  current combined session/limiter/recovery and finite metric privacy checks.
  The subsequent standalone complete rerun exposed an inherited total-key-count
  assertion racing expiry of earlier fixture records. Replaced it with direct
  proof of exactly one newly created expected issuance record. Required final
  complete rerun remains in progress; c/parent are not yet marked complete.


- 2026-10-06 (Asia/Manila, +08:00) — Focused c `--limits` passed, exit 0,
  including a/b regressions, real A/B concurrent admission and TTL/capacity,
  proxy/identity bounds, limiter response loss/ACL/OOM, actual restart/stale
  restore and interrupted primary recovery. Full-size registry measured 876,709
  bytes. Added integrated contract/runbook and preserved mandatory realistic
  traffic/production capacity gates. Complete focused/full Docker verification
  remains in progress; no c/parent completion yet.


- 2026-10-06 (Asia/Manila, +08:00) — Implemented approved typed admission,
  atomic expiring bounded Redis registry, validated policy/proxy configuration,
  trusted source extraction and protected HTTP 400/429/503 wiring. Shared session
  connection handling now reconnects only for new operations without ambiguous
  write replay. Backend build passed; real two-HTTP limiter/outage/recovery fixture
  and combined CI selections are implemented and under verification. c remains
  in progress until required integrated and full Docker acceptance passes.


- 2026-10-06 (Asia/Manila, +08:00) — User approved c review section 1 and
  the 8,192 active-counter ceiling. Resumed implementation. Protected 120/minute
  identity default is subject to realistic web/polling/operator/future mobile
  traffic validation and budget re-review before production if normal behavior
  reaches it. Omitted recovery/public-intake/socket policies remain unapproved.


- 2026-10-06 (Asia/Manila, +08:00) — Prepared the user-requested
  [P2-U2c approval document](../docs/planning/p2-u2c-limiter-contract-review.md).
  Section 1 defines the required policy decision; sections 2–3 document source
  trust/resource bounds and implementation/verification. Existing real-service
  `./dev exec pnpm check:session-foundation --authority` passed, exit 0,
  including lifecycle/recovery regressions and two HTTP replicas. Documentation
  consistency/relative links/formatting/whitespace checked. Independent preparation
  is complete; c is blocked until explicit section 1 approval/revision under the
  parent's limiter gate. No runtime limiter or c/parent completion is claimed.


- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U2c at the user's request.
  Read AGENT.md, required context and child/parent specifications. a/b are
  complete; preparing a concrete limiter policy review and rechecking their
  real-service fixtures. Product limiter coverage/budgets/counting require explicit
  approval under the parent gate; no proposed values or completion claimed.


- 2026-10-06 09:48 +08:00 (Asia/Manila) — Completed requested P2-U2b B-01–07. Canonical
  request principals, explicit global HTTP policies, safe failures, activity renewal
  and transaction owner locks are verified with real two-process HTTP fixtures.
  Initial focused authority/a regressions passed. The first full attempt stopped on
  fixture formatting; corrected formatting and final full Docker run passed, exit 0,
  including the strengthened post-handler renewal outage check. Recorded contract,
  evidence, consumer transport/transaction limits and c handoff; synchronized docs
  and cleared active work. c/parent and sign-in remain incomplete.

- 2026-10-06 08:53 +08:00 (Asia/Manila) — Completed P2-U2a A-01–07 under explicit
  revised D-05/recovery approval. Shared opaque lifecycle, fixed absolute expiry,
  audited minimal durable fencing/retention, bounded conditional Redis and
  independent process barriers are verified. Final focused lifecycle and full
  Docker checks passed, exit 0, including actual Redis/PostgreSQL write-response
  loss, audit rollback/process interruption, physical expiry and actual stale
  record restoration/restart. Local deployment/health and precise fixture teardown
  passed. Updated evidence/runbook/specs/product contracts and required UI/transport
  unfinished-work reauthentication handoff; cleared active work. b/c, sign-in and
  parent completion remain pending.


- 2026-10-06 (Asia/Manila, +08:00) — User approved P2-U2a scoped D-05 and
  durable generation/revocation fencing, revising web idle to 60 minutes while
  retaining web 12-hour absolute and mobile 24-hour/7-day. Activity excludes
  passive polling/health/heartbeats and rotation keeps the original absolute
  deadline. Recorded unfinished-incident preservation as a required P2-U3/U4
  reauthentication handoff and resumed implementation. Typed ports/configuration,
  audited minimal fences/migration/grants, atomic Redis scripts and isolated
  real-service checks are implemented. Focused lifecycle checks passed, exit 0;
  required full Docker verification remains in progress. No a/parent completion yet.


- 2026-10-06 (Asia/Manila, +08:00) — Started P2-U2a as requested, then prepared
  the user-requested [approval document](../docs/planning/p2-u2a-session-contract-review.md).
  Section 1 contains proposed idle/absolute defaults and qualifying activity;
  section 2 selects minimal durable generation fencing that preserves other devices.
  Read required instructions/context/spec and prior evidence; focused real-service
  identity authority check passed, exit 0. Documentation links/whitespace reviewed.
  a remains incomplete and blocked pending explicit section 1 approval/revision;
  no session runtime, lifecycle acceptance or full Docker check claimed.


- 2026-10-05 (Asia/Manila, +08:00) — Adopted the user-requested P2-U2 split and
  created a/b/c feature specs with sequential dependencies, scoped contracts,
  acceptance criteria and complete parent AC-01–11 coverage. Updated parent,
  tracker and docs index. Documentation consistency, relative links, acceptance
  coverage and whitespace checked. All children/parent remain planned; session
  and limiter policies remain pending and no runtime changes/checks are claimed.


- 2026-10-05 (Asia/Manila, +08:00) — Prepared and reviewed the requested P2-U2
  feature spec after reading AGENT.md, required context, Phase 2 and current
  authority/Redis boundaries. Defined lifecycle, canonical guards, shared limits,
  failure/recovery contracts and AC-01–11; recommended three sequential sub-units
  with complete acceptance coverage. Session/limiter policies remain unapproved;
  recovery fencing/reset must be designed before implementation. Documentation
  consistency, relative links and whitespace checked; P2-U2 remains planned.


- 2026-10-05 17:04 +08:00 (Asia/Manila) — Completed P2-U1c and parent P2-U1 under
  approved review sections 1–2. Protected input/private scrypt, atomic PostgreSQL
  bootstrap/provenance/system audit and safe unchanged reruns are verified.
  Independent races, audit rollback, precommit interruption and real COMMIT-response
  loss/PTY/sentinel checks passed. Final combined identity and full Docker checks
  exited 0; actual launcher safe rejection, zero local seeds, health and precise
  fixture teardown passed. Synchronized evidence/contracts/runbook/tracker and
  cleared active work. Sessions/sign-in and broader product/production gates remain.


- 2026-10-05 (Asia/Manila, +08:00) — Started P2-U1c as requested and marked
  in progress. Read instructions/context/spec and a/b evidence. User requested
  a review document; prepared and linked the scoped bootstrap contract.
  Dependent implementation awaits approval of sections 1–2; c and parent remain
  incomplete. No bootstrap runtime changes or completion claim.

- 2026-10-05 15:32 +08:00 (Asia/Manila) — Completed P2-U1b B-01–07 under the user's
  approved role/admission contract and revised creator-closure grant. Implemented
  explicit role constraints, coherent bounded primary snapshots, private verifier
  ports and audited authority mutations. Final focused a/b PostgreSQL checks and
  full Docker rerun passed, exit 0; corrected the legacy audit migration count.
  Local migration, zero seeds, runtime grant, health and fixture teardown passed.
  Recorded evidence/handoff, synchronized context and cleared active work.
  c/bootstrap, password policy, sessions and parent acceptance remain incomplete.

- 2026-10-05 (Asia/Manila, +08:00) — User approved P2-U1b review sections
  1–4 with creator closure independent of dispatcher role, subject to owning
  D-02/D-03 safeguards, and instructed implementation to continue. Recorded the
  scoped P1-U1 handoff in product contracts/review and resumed b in progress.

- 2026-10-05 (Asia/Manila, +08:00) — Created the user-requested P2-U1b
  approval review document with fixed role codes/cardinality/combinations, full
  permission matrix, account/credential and four-state tenant admission matrices,
  scoped P1-U1 handoff and explicit later gates. Linked it from the docs index
  and tracker. Proposal remains unapproved; b remains blocked and incomplete.

- 2026-10-05 14:23 +08:00 (Asia/Manila) — Started P2-U1b at the user's
  request and marked it in progress. Read AGENT.md, mandatory context and spec;
  rechecked storage migration/repositories/transaction/audit contracts and re-ran
  `./dev exec pnpm check:identity-foundation --storage` successfully (exit 0).
  Prepared and asked the spec-required scoped D-01/D-05/D-06 contract decision.
  Independent preparation complete; b is blocked awaiting that decision, with
  no runtime/schema changes or completion claim. P1-U1 remains deferred.

- 2026-10-05 14:07 +08:00 (Asia/Manila) — Completed P2-U1a A-01–07 after D-05 approval.
  Focused real-PostgreSQL checks, full Docker checks, local migration and health
  passed; client sentinels and fixture teardown verified. Recorded evidence and
  storage/registry/credential/provenance handoff, synchronized specs/context and
  cleared active work. b/c and parent acceptance remain incomplete.

- 2026-10-05 +08:00 (Asia/Manila) — Resumed P2-U1a after explicit D-05
  storage representation approval. Recorded its scoped P1-U1 handoff, added
  canonical identity/provenance migration, ownership/version protections,
  qualified audited repositories and caller-owned tenant registry port. Focused
  PostgreSQL checks and lint passed; integrated full Docker checks are running.
  No roles, admission, credential policy, sessions or bootstrap execution added.

- 2026-10-05 +08:00 (Asia/Manila) — Started P2-U1a at the user's request,
  read AGENT.md and mandatory context, inspected existing migration/transaction/
  audit foundations and prepared the storage design. Asked the spec-required
  D-05 representation/scoped P1-U1 handoff decision. User requested reviewing
  first; dependent implementation is held and the unit is blocked, incomplete.
  Documentation links and whitespace checked; no identity runtime checks claimed.

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
