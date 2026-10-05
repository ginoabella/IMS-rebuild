# P1-U1 foundation scope and delivery recommendations

Status: **Product recommendations remain draft.**

Update: the user requested a simpler process and to start building on 2026-10-04.
P1-U2 foundation work is now authorized under the existing architecture; detailed
P1-U1 product review is deferred. The review-ID response process below is optional
and does not block routine foundation work. See the progress tracker.
Prepared: 2026-10-04, Asia/Manila (+08:00).
Decision owner: project owner (user). Draft preparation and consistency checks: Codex.

## Recommendation and review choices

Approve the foundation boundary in sections 1–3 to prepare P1-U2. Review the
product recommendations in the [contract draft](p1-u1-product-contracts.md)
separately. Record each decision as approved, modified, or deferred; silence is
not approval. The [acceptance matrix](p1-u1-acceptance-matrix.md) defines proposed
proof and maps all overview requirements to delivery units.

This draft follows the existing overview, architecture, UI context, standards,
workflow, and implementation plan. Those remain authoritative. Proposed product
rules below do not change them until approved and synchronized.

### 1. Foundation agreement F-01

**Recommended scope:** one TypeScript/pnpm modular-monolith workspace, the five
existing application boundaries, four shared packages, and one backend codebase
with four independent entry points. Keep canonical state in the already specified
shared services. Add feature contracts and schema only in their owning units.

| Boundary | P1-U2 deliverable | Later owner |
| --- | --- | --- |
| `apps/platform-console-web` | Minimal Next.js application, buildable placeholder | Platform sign-in P2-U3; PBX P3; onboarding P4 |
| `apps/command-center-web` | Minimal Next.js application, buildable placeholder | Shell P1-U4; staff sign-in P2-U4; tenant operations P4–P6 |
| `apps/public-web` | Minimal Next.js application, buildable placeholder | Public intake P8-U4 |
| `apps/responder-mobile` | Minimal Expo application and documented startup/build boundary | Responder journey P6 |
| `apps/public-mobile` | Minimal Expo application and documented startup/build boundary | Public intake P8-U5 |
| `services/backend` | NestJS skeleton; separate HTTP, worker, telephony, deployment roots | Runtime P1-U3; jobs P1-U5; telephony P3 |
| `packages/contracts` | Package/export structure; no speculative domain schemas | Domain-grouped schemas in owning units |
| `packages/config` | Shared configuration package structure | Validated runtime configuration P1-U3 |
| `packages/ui-web` | Buildable shared web package boundary | Tokens, components, shells P1-U4 |
| `packages/testkit` | Buildable test-support boundary | Real-service fixtures alongside owning units |
| `infra/*` | Preserve documented ownership; explain directories | Compose/database P1-U3; production P9 |
| `docs` | Documentation index, setup and check instructions | Guides/runbooks with each delivered unit |

Observed starting state: context documents and empty directories; no manifests,
lockfile, source, migrations, or verified runtime. `services/api`, `packages/ui`,
and `packages/shared` are empty legacy directories outside the target architecture.
Recommend removing these empty directories when creating P1-U2 to avoid duplicate
ownership. Recheck that they are still empty before removal.

P1-U2 includes strict TypeScript, ESLint, Prettier, dependency-ordered scripts,
lockfile-based installation, CI, package exports, and a root README. Recommend
pnpm's dependency-aware recursive graph initially; optional Turbo is unnecessary
for this small starting workspace. Root checks should run through the same scripts
locally and in CI. Select compatible supported runtime/framework/tool versions
when implementing P1-U2, check official documentation, and pin the runtime and
package manager plus dependency resolutions. This draft does not select versions.

No authentication, business tables, database migration, Redis integration, PBX
connection, map provider, file provider, production platform, operational UI,
or domain behavior is implemented in P1-U2. Placeholder pages must say that the
capability is pending; scaffolding must not resemble a working emergency system.

### 2. P1-U2 acceptance agreement F-02

Starting condition: the user has explicitly agreed F-01 and F-02, and that agreement
is recorded in the tracker. Acceptance criteria:

1. A fresh checkout installs using the pinned package manager and frozen lockfile.
2. Every listed application/package participates in strict typechecking and its
   applicable lint/build checks. Workspace dependencies resolve by declared exports.
3. The graph builds dependencies before consumers; individual package checks work
   without dependence on a caching tool. CI runs the documented root check sequence.
4. Starting HTTP starts only its listener. Worker and telephony skeletons start no
   listener or other entry point; the deployment command runs and exits. Do not
   start placeholder real jobs or observers. A runnable smoke procedure verifies
   process separation and records that external integration is still pending.
5. Each web application renders its placeholder. Expo skeletons have a documented,
   reproducible bundling check; native device acceptance and signing remain later
   work. Do not silently skip mobile checks in the root graph.
6. Documentation states prerequisites, installation, checks, local app startup,
   entry-point ownership, and current limitations. No secrets are committed.

Proposed commands (to be implemented and verified in P1-U2):
`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm build`, and `pnpm check:entrypoints`.
These commands do not exist yet and have not passed. Define `build` to cover web,
backend/packages, and Expo bundle generation; explain platform-specific limits.
Record the actual clean-checkout procedure and results in the tracker.

### 3. Handoff and P1-U1 completion agreement F-03

P1-U1 requires approved operational and credential contracts to be fully complete.
Approving only the foundation agreement does **not** complete all of P1-U1.

Recommend permitting P1-U2 after F-01/F-02 approval through a documented switch:
record P1-U1's unfinished decisions, owners and resume conditions; mark it blocked
if required answers remain unavailable, and activate P1-U2 only with its agreed
foundation scope. This follows P1-U2's explicit dependency on the agreed foundation
scope and the workflow's independent-work rule. Do not claim P1-U1 is complete or
implement unresolved product choices during scaffolding.

If the user approves all product contracts now, synchronize the authoritative
context, record approved decisions, review the matrix, complete P1-U1's documentary
checks, and then start P1-U2 normally when implementation is requested.

P1-U1 completion requires: an approved permissions matrix, incident/assignment
transitions, closure and eligibility rules, category/priority behavior, credential
flows, and decision records; overview coverage reviewed; every unanswered decision
has an owner, affected units, and a resume condition. Runtime proof belongs to the
units implementing each contract.

## Decisions to record before dependent implementation

Unresolved decisions below remain **pending user review**. The scoped D-05
storage handoff for a and D-01/D-05/D-06 handoff for b are approved; see the
[P2-U1b contract review](p2-u1b-contract-review.md). The user owns approval; Codex
records approved outcomes and verifies implementation. Infrastructure credentials
and access must be supplied by a user-designated operator; none is assumed.

| ID | Decision / recommendation reference | Affected units | Resume condition |
| --- | --- | --- | --- |
| F-01 | Workspace boundary, package ownership and graph above | P1-U2 | User agrees or edits the foundation scope |
| F-02 | Scaffolding acceptance and check procedures above | P1-U2 | User agrees the acceptance boundary |
| F-03 | Partial P1-U1 handoff above | P1-U1, P1-U2 | User agrees the switch or approves all P1-U1 contracts |
| D-01 | Role matrix, contract section 1 | P2-U1, P4-U4, P5–P6 | Approved for P2-U1b: fixed combinations/grants and creator closure; see scoped review |
| D-02 | Incident lifecycle and closure, section 2 | P5-U6–P5-U7, P6-U2 | Approved transitions and closure safeguards |
| D-03 | Assignment/eligibility/concurrency, section 3 | P5-U2, P5-U7, P6-U1–P6-U2 | Approved responder eligibility and terminal states |
| D-04 | Categories/priorities, section 4 | P5-U1, P5-U4, P5-U6 | Approved category validation and priority meanings |
| D-05 | Credentials and administrator safeguards, section 5 | P2-U4, P4-U1, P4-U4 | Approved delivery, expiry, recovery and last-admin policy |
| D-06 | Tenant lifecycle, section 6 | P2-U1, P4-U3, P5–P6 | Admission approved for b; outstanding-work, transitions and routing effects remain pending |
| D-07 | Coordinates/drafts, section 7 | P4-U1, P5-U4–P5-U6 | Approved default ownership, bounds, draft persistence/conflicts; map provider chosen |
| D-08 | Mobile/location policy, section 8 | P6-U1–P6-U3 | Supported targets and consent/frequency/freshness/retention agreed |
| D-09 | PBX environment and policy | P3-U1–P3-U5, P4-U2–P4-U3, P5-U3 | Controlled PBX, secret references, allowed commands, routing precedence, active-call policy and test destinations supplied/approved |
| D-10 | Shared files and evidence | P1-U6, P8-U1–P8-U2, P8-U11, P9-U1 | Local Garage/Docker private storage with internal HTTP approved 2026-10-05; GET-only bearer access approved with a 120-second default, hard 300-second ceiling and no immediate revocation; allowed files, real evidence authorization, retention and production recovery still pending. See [storage ADR](../architecture/shared-storage.md). |
| D-11 | Public channels and launch scope | P8-U3–P8-U7, P9-U1 | Mapping/handoff/feedback, SMS/voice provider contracts and deployment scope approved |
| D-12 | Later tools | P8-U8–P8-U11 | Browser calling credential flow, recovery permissions, report/export definitions and retention approved |
| D-13 | Production readiness | P9-U1–P9-U5 | Platform/HA, measurable capacity/latency/security/accessibility/RPO/RTO, recovery and accountable operators agreed |

Recommend deferring D-09–D-13 until their owning units, retaining explicit gates.
Do not choose providers, retention obligations, or numerical production targets
without the deployment's operational requirements. These deferrals do not block
P1-U2. Foreground location retention in D-08 also needs an explicit decision.

## Review response format

A review can use: `F-01/F-02/F-03: approve`, followed by decisions to approve,
modify, or defer (for example, `D-03: allow two responders per incident, keep one
active assignment per responder`). Approval applies only to the named decisions.
The next work is to record that response, synchronize approved contracts, and
establish P1-U2's active scope when implementation is authorized.
