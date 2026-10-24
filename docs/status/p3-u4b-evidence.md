# P3-U4b — inbound rules and trusted route identities

Status: completed within approved private development, October 24, 2026
18:36 +08:00 (Asia/Manila). B-01–06 passed. Parent P3-U4 awaits c and final
acceptance; tenant allocation, live apply and operational attribution remain later work.

The user explicitly approved recommended R-02, including initially disabled rules.
The [parent decision](../../context/feature-specs/p3-u4-ring-groups-and-dial-plans.md#approved-p3-u4b-policy--october-24-2026-0800)
records trusted gateway/associated DID or catch-all selectors, exact-first precedence,
canonical plus/leading-zero distinctions and extension/group/hangup destinations.

## Delivered and verified

Telephony-owned `inbound_rules` retain canonical IDs, ingress/destination references,
desired status, versions, actor attribution and internally generated identities.
Protected APIs and the actual routing console implement bounded list/create/detail/
edit/status/removal and saved-rule preview. Unknown fields, unsupported tenant
bindings and supplied runtime keys reject; opaque keys are absent from browser DTOs.

Node serialization, expected versions, operator-scoped receipts and audit are shared
with a. Exact retries, no-ops, stale writes and lost responses preserve their existing
semantics. Nonremoved references, including disabled rules, protect actual DID,
gateway and group mutation paths. Blockers identify the right resource type and
link operators to its management surface.

Two additive migrations are deployed:
`20261024010000_inbound_rules` and
`20261024020000_inbound_historical_associations`. Final review found that a mutable
DID/gateway composite FK would pin ingress even after a rule was removed. Stable
ownership FKs and locked current-association triggers preserve database enforcement
without rewriting retained history. The final real API regression moves a DID to a
new gateway after reference removal and confirms the removed rule's original tuple.
Original applied migration source/history is retained.

## Actual commands and results

All commands below passed, exit 0, through the Docker workspace:

| Command                                                 | Evidence boundary                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./dev exec pnpm check:routing`                         | Real PostgreSQL/shared Redis/two HTTP replicas/HTTPS browser; inbound and all existing group/reservation acceptance, concurrency, recovery, authority and accessibility. Final rerun includes history release and paginated extension selection.       |
| `./dev exec pnpm check:trunk-gateways`                  | Final rerun: actual trunk/gateway/DID APIs/browser, normalization, references, races, safe credential metadata and recovery. Trunk provider command checks use their explicitly labelled SQL/TLS simulator boundary.                                   |
| `./dev exec pnpm check:extension-inventory --inventory` | Inventory/API namespace, atomicity, concurrency, recovery, access and unallocated calling-ineligibility.                                                                                                                                               |
| `./dev exec pnpm check:extension-inventory --browser`   | Actual inventory/profile/credential browser, real controlled provider lifecycle and AMI/SIP observation, mounted recovery, keyboard/reflow/axe; owned fixture material/tokens cleaned and PBX baseline restored.                                       |
| `./dev exec pnpm check:pbx-nodes --registry`            | Real registry API, versions, audit/replay, races, response loss, permissions and safe DTOs.                                                                                                                                                            |
| `./dev exec pnpm check:pbx-nodes --observation`         | Real controlled observation, lease fencing, restart/reconnect and failure handling; existing observer credentials and exact baseline restored.                                                                                                         |
| `./dev exec pnpm check:pbx-nodes --browser`             | Actual browser register/edit/observation/freshness/recovery, node isolation, keyboard/reflow/axe and authority; exact baseline restoration.                                                                                                            |
| `./dev check`                                           | Full lint/format/typecheck/build/process/config, fresh/concurrent/rerun migrations (including both new migrations), foundation, audit/outbox/workers, storage, identities, platform/staff/browser/credentials/limits/sessions and PBX registry checks. |
| `./dev migrate`                                         | Both additive migrations applied to ordinary development through the trusted deployment entry point.                                                                                                                                                   |

Final scoped ESLint/Prettier and the production browser build also passed after the
optional preview-label and test-pagination refinements. Earlier fixture ordering/
pagination assumptions, a corrected SQL string quoting error, and an overlapping-
build sign-in timeout are superseded by the successful final serial results; no
session policy, timeout, authority or acceptance condition was weakened.

Final routing fixtures `myims_session_2b38478d799e` and
`myims-session-check-eac7dc55db59`, and resource fixtures
`myims_session_fa8bbd49a712` and `myims-session-check-d3d7a182a6df`, were removed.
Inventory test generations were destroyed and test tokens revoked/removed. All
controlled PBX guards reported fixtures absent, exact configuration/routing baseline
and original running state restored, and exclusive locks released. No calls occurred.

## Acceptance reconciliation

| ID   | Passing evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Actual inbound CRUD/status/removal; two gateways; associated/wrong-gateway DIDs; exact/catch-all and disabled exact precedence; duplicate/disabled claims; unknown ingress/no match; plus/leading-zero distinctions; direct SQL association rejection.                                                                                                                                                                                                                             |
| B-02 | Unknown/wrong-kind destinations and invalid fallback graphs reject through canonical checks and a's complete graph tests. Disabled inbound references block actual DID selector/removal, gateway structural/removal and group removal paths. A/B DID removal/gateway/number-edit and gateway/group removal races serialize; valid edit-before-create ordering is checked, and subsequent selector edits reject. Removed history retains its tuple while eligible DID edits resume. |
| B-03 | All four internally generated identities match persistence, remain unchanged on rename, differ by installation/replacement UUID and never depend on phone numbers. Actual APIs reject supplied keys. Unknown/unbound/stale/duplicate identities resolve no tenant in explicitly trusted fixtures. No live event attribution is claimed.                                                                                                                                            |
| B-04 | Trusted same-tenant ingress and reachable destinations pass; foreign gateway/DID, mixed members/fallback and unallocated facts reject. Actual tenant-binding input rejects and inventory remains calling-ineligible. These are fixture-only ownership checks.                                                                                                                                                                                                                      |
| B-05 | Actual console creation/inspection/preview/edit/status/removal, real DID blocker navigation, paginated named choices, field focus/input retention, lost create/edit and stale canonical recovery, keyboard, 320/768/1440px form/detail reflow and axe. Shared platform/session/CSRF/plane/logout/outage checks pass. Routing fixtures use unreachable PBX targets and no call adapter.                                                                                             |
| B-06 | Focused real services/A/B API/browser, affected a/resource/inventory/PBX regressions, full normal graph and ordinary deployment/refresh pass. Injected audit and receipt failures roll back rule/identity/receipt state; no-op audit counts stay unchanged; stale and exact/changed-intent replay checks pass. Commands, operator and integration contracts are published.                                                                                                         |

## Ordinary development refresh and preservation

The normal backend was recreated with its existing Compose configuration, dependencies
and runtime-only credentials. The existing HTTPS supervisor was stopped/restarted
through `scripts/platform-https.mjs`; ordinary backend/UI builds contain no fixture
alias. `./dev platform-https-status` returned ready.

`./dev platform-https-check` passed: private listeners, secret/fixture exclusion,
real CA/host/cookie/CSRF, PATCH forwarding, hostile source denial and normal sign-in
presentation. `./dev health` returned live/ready HTTP 200 with PostgreSQL and both
Redis services up. Existing identities, migration history, shared credentials,
endpoint/trunk material, observer credentials, PBX configuration and backups remain
preserved. Existing owner browser sign-in remains a private manual action; no
operator credentials were requested or exposed by this work.

## Handoff and integration limits

[Operator workflow](../runbooks/inbound-routing.md) and
[identity/dependency/API contract](../architecture/inbound-routing.md) document
selectors, serialization, recovery, commands and the shared generator for c.

Trusted ownership fixtures prove their declared deterministic boundary only.
P4-U2 must supply actual canonical tenant bindings/allocation facts; P3-U5 must
compile and preserve verified mappings; P5-U3 must authenticate/reconcile real
events. No allocation tables, event adapter, operational call attribution, compiler
or live routing apply is delivered here. Definitions remain unbound/calling-ineligible.
Saves and previews perform no PBX/provider/credential retrieval or call effects.
R-03, c and final parent acceptance remain outstanding; production is not claimed.
