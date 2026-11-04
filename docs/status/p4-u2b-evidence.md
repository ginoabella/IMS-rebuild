# P4-U2b — Tenant route bindings and permissions

Status: complete within approved private development, 2026-11-03 (Asia/Manila,
+08:00). B-01–08, focused/affected/full checks, ordinary refresh/HTTPS and final
retained-state preservation passed. Parent/live readiness remains incomplete.

The owner approved shared gateways with tenant-owned exact DIDs, inbound rules and
ring groups; gateway catch-alls remain platform-only. Outbound classification and
explicit per-tenant permissions follow the approved selection policy. Saved desired
eligibility never establishes installed calling readiness.

Contracts: [policy](../planning/p4-u2b-routing-policy-review.md),
[canonical transport and backend eligibility port](../architecture/tenant-route-bindings.md),
[operator instructions](../runbooks/tenant-route-bindings.md).

## Acceptance evidence

| Gate | Observable evidence                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Actual HTTPS operator selects/binds existing shared gateway/exact DID/group/rule resources, saves and reloads canonical state across replicas. Two tenants share gateway infrastructure with separate owned DIDs. Catch-all binding denies.                                                   |
| B-02 | Complete member/fallback graph validation rejects foreign, wrong-node, missing, disabled and cyclic references atomically. SQL/API self-cycle denial preserves the group. Exact/catch-all and disabled-winner semantics remain; exact hangup is compatible denial with callingEligible=false. |
| B-03 | Two tenants use explicit shared-trunk permissions and own bound routes. Foreign/unpermitted/disabled/no-match paths deny. Tenant filtering precedes priority; transforms and disabled-winner denial pass while node-wide selection remains unchanged.                                         |
| B-04 | Real request-specific barriers serialize ownership saves with group/member edits, allocation release, DID/gateway edits and trunk removal. Permission revoke preserves runtime pins; desired-only release/reclaim retains original history; unbind/rebind preserves route identities.         |
| B-05 | Actual production backend-only snapshot reads canonical allocations, ownership, permission and version facts consistently. Missing/stale/ambiguous facts deny. Caller/fixture maps and opaque identities cannot become public routing authority.                                              |
| B-06 | Real audit/receipt rollback, stale writes, concurrent replay/changed intent, PostgreSQL COMMIT-response loss, exact recovery, held operator revocation, dependency outages, strict bounds, wrong-plane and API/Next CSRF/Origin checks pass.                                                  |
| B-07 | Actual HTTPS selectors, graph/conflict feedback, keyboard/focus, desktop/phone reflow/axe, saved/pending distinction, same-owner recovery and late operator/tenant/node isolation pass. Desktop/phone screenshots were visually reviewed.                                                     |
| B-08 | Focused/affected/full commands, ordinary refresh/HTTPS and final preservation pass. Contracts, operator guidance and exact c handoff are published.                                                                                                                                           |

Focused command: `./dev exec pnpm check:tenant-bindings`, exit 0,
`/tmp/tenant-bindings-focused-final.log` and `.exit`. This includes expanded
lifecycle/held-authority-race cases, actual PostgreSQL runtime grants, shared Redis,
two independent Nest replicas, production Next HTTPS and shared authentication
browser assertions. Isolated database and Redis cleanup reported removed.

## Affected verification

All following results have explicit exit-0 receipts; their logs remain in `/tmp`.

| Command                                                | Log/receipt prefix                 |
| ------------------------------------------------------ | ---------------------------------- |
| `./dev exec pnpm check:routing`                        | `tenant-bindings-routing`          |
| `./dev exec pnpm check:tenant-allocation`              | `tenant-bindings-allocation-retry` |
| `./dev exec pnpm check:trunk-gateways`                 | `tenant-bindings-trunks`           |
| `./dev exec pnpm check:extension-inventory`            | `tenant-bindings-inventory-retry`  |
| `./dev exec pnpm check:draft-tenant`                   | `tenant-bindings-tenants-final`    |
| `./dev exec pnpm check:pbx-nodes --registry`           | `tenant-bindings-registry`         |
| `./dev exec pnpm check:session-foundation --authority` | `tenant-bindings-authority`        |
| `./dev exec pnpm check:platform-auth --browser`        | `tenant-bindings-platform-retry`   |
| `./dev exec pnpm check:pbx-revisions`                  | `tenant-bindings-revisions-final`  |

Affected offline revision/live-protection/mutation tests also passed, 17 tests,
`/tmp/tenant-bindings-revision-unit.log`. Backend/console static checks and changed
source/test ESLint passed. Feature-local documentation links/anchors and whitespace
checks passed. The complete `./dev check` passed, exit 0:
`/tmp/tenant-bindings-full-accepted.log` and `.exit`. Its generic guarded-input
setup correction passed actual idle/absolute retention without refilling work
after expiry.

The existing revision regression uses disposable Asterisk, bounded synthetic Local
calls, actual SQL/native ownership/dispatch/interruption checks and a read-only
retained-version provider consumer. The binding suite introduces no live apply or
calls. Inventory regression uses its existing controlled synthetic credential and
observation boundary; exact owned provider generations/tokens and PBX fixture keys
were removed, with verified baseline and original running state restored.

## Findings and corrections

Intermediate failures are retained rather than treated as passes:

- Client directive/feedback placement, JSONB key normalization and advisory submit
  behavior were corrected before successful focused acceptance. Recovery fixture
  identity/restoration assertions were corrected; database-forbidden cycles are
  verified by rejection rather than bypassing constraints.
- Expanded desired-only revoke exposed UUID/text SQL parameter inference in the
  retained-runtime release query. Explicit casts fixed it; actual PostgreSQL query
  execution and complete lifecycle acceptance then passed.
- Race barriers now match the fixture database and the exact writer's granted
  request advisory lock, avoiding unrelated waiting connections.
- Tenant presentation expected eight cards; it now explicitly verifies all nine,
  including useful binding summaries and retained mounted disclosure state.
- Allocation passed its exact sequential rerun after an earlier late-auth failure
  during concurrent build activity. No auth assertions or policy were relaxed.
- Platform geography fixtures now separate completed outage work from final clearing
  in fixture-owned Redis and await restored reads. Production limits and dedicated
  rate-limit assertions remain unchanged. Final clearing has a direct HTTP-200
  assertion. Inventory expiry scenarios now await the restored canonical reload
  before expiring the replacement session. Exact complete platform/inventory retries
  passed after these fixture sequencing corrections.
- Earlier full runs failed in geography and generic idle-expiry setup after all
  preceding phases passed. Focus validation's network completion can precede React's
  ready commit. The generic fixture now waits for accepted local setup before
  injecting expiry; retention/recovery assertions never refill the input. Final
  full-project verification then passed, exit 0. An earlier platform run was
  interrupted (143), with no pass claimed for it.

## Provider maintenance and preservation

Both preexisting provider accesses returned HTTP 403 over verified TLS. The owner
explicitly approved [scoped replacement](../planning/p4-u2b-provider-access-recovery.md).
Fixed-role endpoint issuance passed exact read-only preflight. Issuer custody
remains UID 1003, mode 0600, nonrenewable, maximum 86400 seconds. The temporary
900-second custodian session was revoked. Installation-scoped read-only consumer
replacement used a guard rejecting policy/role writes and reported
configurationUpdates=0. Installed issuer/accessor copies matched staging; owned
staged credentials were removed. No credential versions or PBX configuration were
changed by access replacement. Receipts:
`/tmp/tenant-bindings-issuer-stage.log`, `tenant-bindings-issuer-install.log`,
`tenant-bindings-consumer-replacement.log`, `tenant-bindings-issuer-stage-cleanup.json`.

The additive migration passed ordinary `./dev migrate` and isolated deployments.
Ordinary backend restart/live/ready and production platform build/HTTPS refresh
passed at the earlier checkpoint. Final ordinary backend/platform/staff refresh and HTTPS verification passed.
Before deployment, twelve retained table digests and five platform access-file
digests were recorded without contents. Twelve tables still match after complete
inventory/native regressions. Independent `./dev pbx-live-check` passed again:
original baseline `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7`, retained revision
`4b475c04-b573-4cc1-9d86-1c81b65f4060`, exact protected/loaded runtime match,
zero active channels, no pending operation, unchanged unmanaged digest.
Final twelve-table and five platform access-file comparisons match exactly:
`/tmp/tenant-bindings-data-before.jsonl` versus `tenant-bindings-data-after.jsonl`,
and `tenant-bindings-access-before.json` versus `tenant-bindings-access-after.json`.
Final retained baseline: `/tmp/tenant-bindings-baseline-after.log`/`.exit`, exit 0.
Backend live/ready returned 200 after restart; the immediate startup probe reported
unavailable before the successful ready probe. Ordinary platform production rebuild
and supervisor refresh passed; `./dev platform-https-check` passed, exit 0
(`/tmp/tenant-bindings-final-https.log`/`.exit`). Staff's pre-refresh check failed its
recipient recovery-message assertion after client builds changed; ordinary staff
refresh and exact `./dev staff-https-check` retry then passed, exit 0
(`/tmp/tenant-bindings-final-staff-https-retry.log`/`.exit`). Both supervisors report
ready. Staff native device/trust and production/HA acceptance remain separate.

## Source review and c handoff

Application authorization, eligibility, release and repository responsibilities are
separate. The browser shares one owner/epoch recovery state machine; its cohesive
322-line panel retains related selection/preview/reconciliation controls, with saved
records/navigation split out. No generated source, opaque route identities or live
compiler versions changed.

Child c must consume `TenantRouteEligibilityPort.snapshot()` (primary repeatable-read)
or `read()` inside its canonically locked capture transaction; preserve tenant,
node/installation, resource/authorization/allocation versions and explicit permission
facts. Missing/stale/incompatible facts deny. Structural writers use the same node
serialization and bounded navigable blockers. Desired revocation preserves installed,
in-flight and rollback dependencies. c owns new snapshot/compiler versions, tenant
live enforcement, verified apply, actual route tests/readiness and final reallocation
proof. Parent P4-U2, c, activation, assignment and ingestion remain incomplete.
