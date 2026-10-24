# P3-U4a implementation evidence

Status: completed within approved private development, October 24, 2026
13:14 +08:00 (Asia/Manila). A-01–06 passed. Parent P3-U4 remains incomplete.
The user explicitly approved R-01/R-04/R-05 in the implementation conversation;
see the [recorded policy](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md).

Implemented group/member/fallback/reservation persistence, shared namespace
protection for individual/bulk inventory, protected APIs, desired console and
advisory previews. [Operator guidance](../runbooks/ring-groups.md) and the
[namespace/reference contract](../architecture/ring-groups.md) document the actual
workflow, approved policy and b/c handoff. All child acceptance rows passed.

Focused command added: `./dev exec pnpm check:routing`.
The launcher uses isolated real PostgreSQL/Redis stores, production HTTP A/B and
actual HTTPS Next browser, with an unreachable PBX and no live telephony adapter.
`./dev exec pnpm check:extension-inventory --inventory` passed, exit 0: existing
namespace/ownership/bounds, audit/receipt rollback, replica races/independent progress,
HTTP/COMMIT loss replay, profile/status/version behavior, access and provider denial.
Backend/console typechecks and focused ESLint passed.

`./dev exec pnpm check:routing` passed, exit 0. Real PostgreSQL/A/B API checks
cover defaults/bounds/ordered 1–32 members, fallback cycles/invalid destinations,
namespace exact/prefix/length/leading-zero intersections, existing/disabled claims,
eligible release/retained UUIDs, all four required race classes, no-op/stale/replay,
audit/receipt rollback, strict bindings/keys and access denial. Trusted ownership
fixtures reject mixed-tenant reachable graphs and unallocated inventory.
Actual HTTPS browser checks cover navigation/resource selectors, group/reservation
CRUD/status/removal, advisory preview, blocker navigation, retained field values
and focus, exact lost-create retry, stale and uncertain-edit canonical review,
keyboard, 320/390/768/1440px reflow, axe and a held response across logout. Existing
platform browser checks also pass: same-owner mounted reauthentication retention,
identity isolation, A/B logout, outage and response loss, CSRF/channel/ingress denial.

The browser caught a preview epoch-capture bug, now fixed and covered: capture
occurs after canonical access revalidation. Initial test-fixture mistakes and a
concurrent sign-in transport timeout preceded the passing run; the affected DID
keyboard fixture now explicitly waits for its Edit control to become enabled; none is counted
as a pass. Launcher cleanup removed the isolated PostgreSQL/Redis stores.
Affected commands passed, exit 0:

- `./dev exec pnpm check:trunk-gateways`: trunk/gateway/DID API and real HTTPS
  browser, credential metadata/adoption and TLS command simulator boundaries.
- `./dev exec pnpm check:pbx-nodes`: registry, observation and actual browser;
  controlled Asterisk baseline/observer custody restored, no calls.
- `./dev exec pnpm check:extension-inventory --browser`: actual inventory/profile/
  bulk/status/credential/recovery browser, real OpenBao and controlled exact-key
  observation. Two owned synthetic generations destroyed; temporary worker/cleanup
  tokens revoked/removed and the PBX baseline restored.
- Latest `./dev exec pnpm check:routing`: also explicitly verifies removed fallback
  rejection after UUID replacement, a same-tenant reachable fallback graph, and
  group plus reservation form reflow/axe at all four widths.
- `./dev exec node --test scripts/openbao/provisioning-preflight.test.mjs scripts/openbao/custodian-succession-plan.test.mjs`:
  all nine checks passed; read-only drift refusal and constrained native roles remain.

Final normal `./dev check` passed, exit 0: lint/format, all workspace typechecks/
builds, entrypoint/configuration boundaries, database foundation, audit/outbox and
worker recovery, storage, identities, platform/staff HTTP/browser, credential
recovery, distributed limits, Redis interruption/response loss and PBX registry.
`./dev migrate` completed through trusted deployment. The ordinary backend was
restarted and the existing HTTPS supervisor stopped/restarted using
`node scripts/platform-https.mjs start` in the existing Docker workspace; ordinary
backend/UI builds contain no fixture alias. `./dev platform-https-status` returned
ready. `./dev platform-https-check` passed, exit 0, including private listeners,
secret/fixture exclusion, real CA/host/cookie/CSRF, PATCH forwarding and hostile
origin/source/bearer rejection. `./dev health` returned live/ready 200 with database,
session Redis and realtime Redis up. Existing operator identity, migration history
and shared credentials remain intact; personal operator sign-in remains private.

## Acceptance reconciliation

| Criterion | Verified result                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01      | Real PostgreSQL/A/B API and HTTPS browser CRUD/status/removal; optional numbers, 1–32 distinct ordered members, strategies/defaults/bounds, explicit terminal fallbacks, direct/indirect cycles and invalid/removed/wrong-node/wrong-kind references.                                      |
| A-02      | Exact/bounded-prefix/length/zero distinctions, existing and disabled claims, individual/bulk/group/reservation collision enforcement, reservation edit conflicts, eligible release and distinct replacement UUIDs; independent SQL exclusion/count constraints.                            |
| A-03      | All four named cross-replica namespace/reference races; exact/changed intent replay, concurrent replay, stale/no-op versions/audit, required audit/receipt rollback and real lost HTTPS create/edit response recovery. Shared inventory regression also covers lost COMMIT acknowledgment. |
| A-04      | Trusted same-tenant reachable graphs pass; mixed members/fallbacks and unallocated facts reject. Actual APIs reject tenant/opaque bindings and inventory stays calling-ineligible. These fixtures are not allocations.                                                                     |
| A-05      | Actual authenticated HTTPS management/preview, named resource selectors and availability labels, blockers, retained inputs/focus, canonical/exact retry, keyboard, both forms at 320–1440px and axe; platform authority/CSRF/channel and mounted owner/logout boundaries.                  |
| A-06      | Focused checks, inventory/resource/PBX regressions, nine maintenance contract tests, full `./dev check`, trusted migration, ordinary HTTPS refresh/security/health, operator/dependency documentation and b/c handoff passed.                                                              |

Existing PBX configuration, stored endpoint/trunk material and backup state are preserved;
test issuer access replacement is documented below. Initial reservation policy seeds
no claims: read-only inspection found the running development dial plan matches
bootstrap's default `_X.` hangup only. Legacy reference dial plans are not imported.
Trusted ownership tests cannot establish actual allocation or calling readiness.

## Verification access maintenance

The first inventory-browser launch stopped before feature checks because the
existing endpoint-fixture issuer returned 403 to verified-TLS `lookup-self`.
The PBX guard reported fixtures absent, baseline/running state restored and its
exclusive lock released. No stored endpoint material was changed by that failed launch.

Used the existing protected named-custodian input and precreated
`platform-endpoint-issuer` role for routine access replacement. Corrected
`issue-lifecycle-issuer.mjs` to preflight only the selected lifecycle's mount,
policies and roles: endpoint replacement must not compare the superseded trunk
lifecycle plan against the subsequently simplified trunk policy. This helper
still refuses missing or different selected policies/roles and never edits them.

Actual trusted commands inside a private Docker maintenance container were
`human-custodian-session.mjs open`, `issue-lifecycle-issuer.mjs endpoint /manifest.json`
and `human-custodian-session.mjs close`. The nonsecret retained manifest includes
installations `58adb785-5384-41ce-9c72-ccda6ea554db` and
`fff38aad-2e3c-4149-aa3f-88f715d1b488`. Human session files stayed in tmpfs.
Verified the staged issuer's exact single `endpoint-restricted-issuer` policy,
orphan/nonrenewable identity and 24-hour explicit maximum; confirmed the prior
issuer was invalid and unchanged before an exclusive staging write/atomic swap
into its existing service-owned protected file. Installed lookup reported
`actualTtlSeconds: 86400`, `configurationUpdates: 0`; the human session was revoked.
Protected staging/accessor evidence remains under ignored owner-only custody.
No policy, auth mount, endpoint KV material, observer credentials or backup state
was changed. No root recovery or consumed bootstrap authorization was used.

## Boundaries and handoff

Verification ran in Docker with Node 22.23.3, real PostgreSQL/shared Redis and
independent production HTTP A/B on one development host. Focused routing uses an
unreachable PBX; its saves/previews have no live adapter. Affected observation
regressions used the previously approved controlled Asterisk, temporary owned
registration fixtures and exact baseline restoration. No routing configuration
apply, reload, call, tenant allocation, activation or production-readiness claim
is made. Mounted drafts do not survive refresh.

P3-U4b receives actual group UUID destinations/fallback checks, dependency/removal
coordination, browser navigation and transaction/recovery conventions. P3-U4c
receives the shared exact/prefix matcher and namespace mutation contract; it must
add actual outbound intersections. R-02/R-03 and b/c remain pending. Future
allocation/apply/rollback owners must register real dependencies before use;
trusted ownership fixtures do not satisfy P4 allocation or live PBX readiness.
