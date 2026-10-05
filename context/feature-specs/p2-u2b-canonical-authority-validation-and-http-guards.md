# P2-U2b — Canonical authority validation and HTTP guards

## Status and purpose

- **Status:** planned.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U2 parent scope and acceptance matrix](p2-u2-shared-session-store-and-authorization-guards.md).
- **Goal:** enforce current canonical session authority on every protected HTTP request.
- **Completion boundary:** two HTTP replicas accept the same valid session, derive
  identical canonical principals and reject stale, foreign or insufficient authority
  without bypassing checks when Redis or PostgreSQL is unavailable.

The adopted split retains shared scope and gates in the parent. b owns canonical
validation, request principals, plane/permission guards and HTTP error mapping.
This spec does not authorize future sign-in or administration journeys.

## Starting state and dependencies

Require verified [a](p2-u2a-shared-session-lifecycle-and-recovery-fencing.md), including
its approved lifecycle policy and tested recovery fence. Recheck P2-U1's canonical
operator/staff `byId` ports, eligibility rules and monotonic versions. Reuse the
approved role grants from the [authority contract](../../docs/architecture/canonical-authority-admission.md).
Do not invent permissions or interpret fixture roles as policy approval.

Existing HTTP health endpoints remain explicitly public. No existing shell or
bootstrap command proves authenticated HTTP access. P1-U1 remains deferred outside
approved handoffs; b must not approve setup/recovery or tenant lifecycle effects.

## Scope and ownership

Allowed changes: `modules/identity/` application validation/principal ports and
NestJS guards, HTTP registration and explicit route metadata, safe response mapping,
necessary backend-only DTOs, representative transactional authority fixtures,
two-replica HTTP checks, contract/evidence and consumer handoff documentation.

Consume platform and tenancy authority through typed ports. Do not query another
module's tables directly or duplicate registry/role state. Reuse a's lifecycle
adapter; b supplies authorization success/failure before conditional renewal.

Out of scope: limiter implementation/source extraction (c), new credential/sign-in/
logout endpoints/UI, cookie/CSRF or device-storage journeys (P2-U3/U4), administrative
feature routes, sockets and production ingress deployment. Fixture issuer/routes
remain separate from production wiring and expose no public session creation.

## Canonical validation and principal contract

Read the shared session and then current primary PostgreSQL authority for every
protected request. Platform lookup uses its operator ID; staff lookup uses the
record's canonical tenant ID and staff ID. Require active account, ready credential,
valid approved authority and positive matching authentication version. Staff also
require active tenant and matching tenant authority version.

Missing/malformed canonical facts, unknown roles or any stale version reject the
session. Reenable, role restore and tenant reactivation cannot revive older tokens.
Unavailable canonical reads grant no authority and do not become missing-record
or invalid-credential responses. Do not cache authority across requests in a way
that bypasses canonical status/version checks.

Construct a discriminated principal from the canonical result, including its plane,
identity, tenant qualification and current role grants. Derive audit actor context
from that principal using existing conventions. Request headers/body/route tenant
IDs and Redis role snapshots cannot supply or change authority. A resource tenant
parameter must match permitted ownership; it is never an alternative principal.

A platform session cannot enter staff routes; a staff session cannot enter platform
routes, even with identical usernames or misleading IDs. Platform tenant management
remains a platform-plane operation and does not create tenant-staff authority.

## Guard and transactional boundary contract

Require explicit public/protected and plane/permission metadata; no permissive
fallback for unclassified feature routes. Keep public health functional. Use the
approved permission bundles, with thin controllers invoking owning use cases.
Resource ownership and domain restrictions remain with the application service.

Reject absent/malformed/expired/revoked/stale sessions with bounded generic 401.
Reject valid wrong-plane or insufficient-permission sessions with 403. Redis or
canonical database failure returns retryable 503 and performs no protected work
or renewal. Avoid secret/internal-error/account-existence disclosure. c integrates
429 for distributed limits; do not implement a local placeholder limiter here.

Renew only after authorized successful activity under a's policy, using its atomic
conditional operation. A request paused before revocation must not recreate the
session afterward. Renewal races/failures follow the documented unavailable
contract rather than falsely reporting a successful renewal.

Document that authorization is checked at a request boundary, and an already
validated request may be in flight when canonical status changes. Sensitive writes
must revalidate current authority at their transaction boundary using established
module/transaction conventions. Prove a representative fixture serializes the
relevant authority change against the write, or rejects a changed expected version;
a second unsynchronized read alone does not establish that guarantee. Do not
promise cancellation of completed work or a PostgreSQL/Redis distributed transaction.

Document explicit credential-channel handling for future transports. Conflicting
cookie/bearer inputs cannot be chosen ambiguously. P2-U3/U4 must implement secure
cookies, CSRF and authenticated mobile transport/device storage; fixture bearer
checks here do not establish browser or device acceptance.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| B-01 | Contract defines canonical lookup/version checks, discriminated principal, permissions, route classification, errors, renewal timing and transactional boundary. Existing approved grants are reused. | AC-01 authority portion |
| B-02 | Trusted fixture issuance on HTTP replica A works on B with the same principal. Same-named staff in two tenants remain isolated; hostile tenant/role/identity fields do not alter scope. Platform and staff routes reject the other plane. | AC-03 |
| B-03 | Real canonical role/account/credential changes and draft/suspended/retired tenant states invalidate old sessions on A/B. Role restore/reenable/reactivate do not revive them. Database outage yields 503 with no authority/renewal. | AC-06 |
| B-04 | Guards enforce explicit plane/permission policy and safe canonical audit attribution; resource ownership remains enforced by representative use cases. Public health works; missing metadata cannot create unguarded feature access. | AC-07 route/principal portion |
| B-05 | A barrier-controlled sensitive-write race against canonical authority change proves the documented transactional boundary. Denied/failed/unavailable requests do not renew; late renewal cannot undo revocation. | AC-07 transaction portion; AC-04 HTTP activity integration |
| B-06 | Restore Redis snapshots from before canonical role/status/credential changes and tenant suspension/reactivation. Canonical versions and a's recovery fence deny them on both replicas, including same-role restoration. | AC-10 canonical-version portion |
| B-07 | Focused two-HTTP-replica checks, a regressions and required Docker checks pass. Diagnostics contain no token/hash/credential sentinels; docs/evidence explain fixtures, consumer transport limits and c handoff. | AC-11 scoped checks/docs; AC-02 HTTP leakage regression |

Use two independently running HTTP replicas sharing actual Redis and PostgreSQL
with real runtime grants. Fixture issuers/controllers must be absent from production
module graphs. Use isolated resources, independent connections and barriers for
mutation races. A direct guard unit test or two calls to one process cannot prove
cross-replica authority. Clean up only fixtures belonging to the current run.

Add a documented authority selection to the provisional
`./dev exec pnpm check:session-foundation`; its final command/selection is determined
during implementation. Run focused checks, a regressions and `./dev check` and
record results. This documentation task requires consistency/link/whitespace checks.

## Completion and handoff

Complete b only when B-01–07 pass. Hand
[c](p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md) reusable guards,
principals, consistent HTTP errors and two-replica protected fixtures. Keep limiter
integration and comprehensive HTTP outage/recovery proof with c. b completion does
not establish sign-in, browser CSRF, mobile storage or parent completion.
