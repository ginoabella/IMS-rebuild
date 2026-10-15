# P3-U2a inventory/profile evidence

Completed 2026-10-15 15:01 +08:00 (Asia/Manila). **A-01–07 passed** within the
conditionally approved controlled-development inventory/profile boundary.
Parent P3-U2, endpoint credentials, browser/live mapping, PBX apply and production
acceptance remain separate and incomplete.

Requirement: [P3-U2a](../../context/feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md).
Policy: [conditional approval of Sections 2–4](../planning/p3-u2a-inventory-contract-review.md).
Contracts: [API/transactions/handoffs](../architecture/extension-inventory.md),
[deployment and recovery runbook](../runbooks/extension-inventory.md).

## Environment and proof boundary

Docker workspace, Node 22.23.3, real PostgreSQL/PostGIS deployment migrations and
restricted `myims_runtime` grants, authenticated shared Redis and independent
production Nest HTTP A/B processes with actual canonical sessions. Synthetic
node/capability declarations and unreachable fixture PBX destinations prove the
desired-management/namespace boundary. They do not prove live PBX coexistence,
registration, transport/media readiness, browser inventory or tenant calling.

Concurrency barriers use real row/table/advisory locks and pg_stat_activity.
Audit/receipt failures are injected PostgreSQL constraints. The PostgreSQL
protocol proxy drops a real COMMIT acknowledgment after server commit; HTTP loss
separately discards a real successful response. Neither is a simulated successful
persistence port. Provider lifecycle is not implemented or substituted by fixtures.

## Acceptance reconciliation

| Criterion | Verified result                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | Approved number/profile/namespace policy, exact named DTO/routes, limits, fixed safe errors, 30-day receipt retention and b/c contracts documented. Explicit shorter municipal policy revision and production/contact-review boundaries retained. No later-unit allocation/route/credential/apply schema or PBX control adapter.                                                                                                                                             |
| A-02      | Runtime-granted SIP/WebRTC creation/read/edit; canonical cross-kind/profile/disabled/alias collisions; distinct-node reuse; immutable generated 71-character keys; exact actor/plane/target audit. Audit/receipt failure rolls back individual, bulk, profile create and profile version writes.                                                                                                                                                                             |
| A-03      | Bounded deterministic preview/commit, malformed/range/oversize/internal duplicate/collision rejection, actual profile/capability dependency changes, overlapping whole-set races and independent non-overlapping progress. Concurrent same/conflicting intents, owner scoping, immutable original-result replay, expiry/pruning and actual HTTP/COMMIT loss produce one business result/audit. Fifty-row result/audit identifies the exact set; conflict details cap at ten. |
| A-04      | Immutable profile settings/history and pinned extensions; explicit adoption, stale/no-op behavior and version-create replay. Invalid kind/codec/signaling/media/raw-field combinations and unsafe/foreign-node references reject. Direct runtime SQL also rejects injected settings, wrong transport/media, duplicate codecs and contact replacement. Large profile lists stay within byte bounds and paginate without missing/duplicate IDs.                                |
| A-05      | Versioned enable/disable/adoption races retain identity, number reservation, creator/time and audit history. Unallocated eligibility always denies; disabled adds its own reason. Forged ownership/readiness/internal identities reject. Real transaction-bound b lock checks exact node/extension/version and blocks a concurrent desired edit until release. No credentials/readiness/calling or external work is granted by saves.                                        |
| A-06      | Every route on HTTP A/B denies absent/staff/revoked/expired authority and forged channel/Origin/CSRF/cookie/bearer inputs. No-store, passive preview/GET session preservation, current operator revalidation under a held transaction, PostgreSQL/Redis failure, body/query/list/error bounds and safe DTO/audit/receipt/process output pass.                                                                                                                                |
| A-07      | Focused real-service inventory, registry, isolated authority/lifecycle, staff browser, foundation/audit/durability/storage/identity and the complete Docker graph passed. Contracts/runbook/index/spec/tracker reconciled, exact fixtures removed and ordinary HTTPS restored/checked. b/c/P3-U5/P4 handoffs and limits remain explicit.                                                                                                                                     |

## Actual commands and results

All final commands below passed, exit 0:

| Command                                                                                                                                                                        | Coverage                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:extension-inventory --inventory`                                                                                                                        | Final frozen real PostgreSQL/runtime grants, shared Redis, independent HTTP A/B, rollback/concurrency/idempotency/response loss, exact individual/bulk audit attribution, safe output, 64-KiB list bounds and exact cleanup.                                        |
| `./dev exec pnpm check:pbx-nodes --registry`                                                                                                                                   | Affected registry A-01–07, transactional handoff and private-output regressions. Repeated successfully inside the final full graph.                                                                                                                                 |
| `./dev exec pnpm check:session-foundation --authority`                                                                                                                         | Isolated HTTP authority plus lifecycle/fencing/expiry/backing-store/response-loss recovery. Integrated authority also passed in the final graph.                                                                                                                    |
| `./dev exec pnpm check:staff-auth --browser`                                                                                                                                   | Actual HTTPS staff/credential-browser regression, including reset/same-owner recovery, keyboard/axe/reflow and secret exclusion. Also passed in the final graph.                                                                                                    |
| `./dev exec pnpm check:foundation`                                                                                                                                             | Exact fresh/rerun migrations, dependency recovery, audit/outbox, worker hard-death/real PostgreSQL interruption, storage, canonical identity/authority and bootstrap recovery.                                                                                      |
| `./dev check`                                                                                                                                                                  | Full lint, formatting, type checks, all web/mobile/backend builds, process boundaries, configuration, foundation/audit/outbox/durable recovery, storage/client/deployment, identity and integrated session/authentication/browser/draft/credential/registry checks. |
| `./dev exec pnpm db:migrate`                                                                                                                                                   | Additive inventory migration applied to the controlled development database through its existing deployment owner.                                                                                                                                                  |
| `./dev exec pnpm --filter @myims/backend exec node dist/entrypoints/deployment/main.js declare-endpoint-capabilities /workspace/.local/pbx-catalog/endpoint-capabilities.json` | One reviewed non-secret declaration for the existing canonical controlled installation. No profiles/inventory seeded and no PBX effects. Focused tests also verify identical declaration replay and rejection/rollback of changed non-increasing revision.          |
| `./dev platform-https-check` and `./dev staff-https-check`                                                                                                                     | Restored ordinary supervisors, loopback/private listeners, trusted TLS/CSRF/channel/no-store, safe normal assets and unchanged identities/migrations/credentials.                                                                                                   |
| `./dev health`                                                                                                                                                                 | Live/ready HTTP 200; PostgreSQL and both Redis dependencies up.                                                                                                                                                                                                     |

Verification found and corrected legacy fixed migration counts in foundation,
audit and identity checks. They now compare exact applied names to repository
migrations via `scripts/migration-history.mjs`, preserving fresh/rerun guarantees.
A staff-browser second-context login lacked the foreground/navigation barrier
already used by its main helper; it now waits before password entry, preserving
password clearing and all auth/expiry assertions. Focused and final integrated
runs passed. Earlier simultaneous-load authority attempts hit bounded deadlines;
the unchanged checks passed in isolation and the final integrated run. Production
settings, policies and timeouts were not relaxed.

## Cleanup, restored runtime and limits

The final focused database `myims_session_9a2fad253b9f` and Redis container/volume
`myims-session-check-eee15a39f01f` reported exact removal. Temporary session keys,
catalogs and reviewed fixture declarations were removed by finally paths. The
full graph removed its owned disposable fixtures. Existing installations,
tenants/identities, catalog identity and protected material were retained.

Normal HTTPS supervisors were stopped during shared Next builds as required by
the existing runbook, then restored ready. Platform restoration used a detached
Docker exec after verifying loopback-only publication and unpublished private
ports. Both ordinary HTTPS network checks passed; backend live/ready returned 200.
Normal client assets exclude private transport secrets and verification forms.

Reference files and unmanaged PBX endpoints/trunks/numbering were not modified.
No reload, listener installation, credential provider write or live mapping was
part of P3-U2a. The controlled capability declaration is desired-format policy,
not operational module/listener/media verification. UDP/unencrypted RTP remains
controlled private development only; contact expiry/reconnection/device replacement
and production transport/media need separate verification and approval.

b must authorize and use `InventoryVersionPort.lockUnallocated` on the same
transaction before its separately approved credential/generation/version/audit
changes. G-02/provider lifecycle remains unimplemented. c owns browser forwarding,
mounted recovery/accessibility and exact fresh live mapping/coexistence. P3-U5 owns
rendering, collision checks, apply/recovery and external fencing; P4 owns canonical
allocation/assignment/calling eligibility. No production deployment or live PBX
runtime acceptance is implied by this foundation completion.
