# P3-U2b endpoint credential lifecycle contract — review for approval

Prepared 2026-10-16 (Asia/Manila, +08:00). **Status: proposed; awaiting user review and approval. No implementation or provisioning authorized by this document alone.**

Requirement: [P3-U2b](../../context/feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md).
Decision owner: user, under D-09 and [parent G-02](../../context/feature-specs/p3-u2-extension-inventory-and-endpoint-profiles.md#decisions-required-before-dependent-implementation).
Starting evidence: [completed P3-U2a](../status/p3-u2a-evidence.md), its [approved policy](p3-u2a-inventory-contract-review.md) and [transaction/version port](../architecture/extension-inventory.md#bc-handoffs).

## 1. Decisions requested

Recommend approving sections 2–6 for controlled private development, with sections 7–9 defining implementation and verification. Every value below is a proposal, including operational limits. Approval would resolve b's scoped G-02 policy; completion still requires real provider access and B-01–07 evidence.

| Decision | Recommended value | Practical effect |
| --- | --- | --- |
| G02-01 generation | Server-generated, independent 32 random bytes encoded as 64 lowercase hexadecimal characters; 256 bits of entropy | No supplied passwords, shared defaults, number-derived secrets or arbitrary reference input |
| G02-02 provider | One dedicated OpenBao service, KV v2, persistent single-node Raft storage, private verified TLS | Explicitly approves the first writable endpoint-secret provider and a new development service; existing management-secret files remain separate |
| G02-03 process access | Dedicated credential-worker process using the existing worker entry point/queue; HTTP and ordinary workers have no provider credentials | HTTP accepts and reports safe operations; credential work runs asynchronously with a narrow provider identity |
| G02-04 phone handoff | No phone-recipient delivery or one-time reveal in b, including CLI reveal | b establishes protected desired material only; real phone provisioning needs its owning unit's approved delivery contract |
| G02-05 generations | Immutable material per operation/generation; setup only when unset; reset only when configured; one active operation per extension | Concurrent resets cannot rotate twice from one expected version |
| G02-06 authority after enqueue | Continue after session expiry/logout; cancel before association if the originating operator is disabled, loses authority or changes authentication version | A committed intent survives a browser disconnect, but an account/security change fences unfinished mutation |
| G02-07 receipt retention | Full safe result for 30 days; minimal operation/key/fingerprint/outcome and generation history retained without automatic pruning | An expired operation ID can never silently become a fresh reset |
| G02-08 material retirement | Retain all successfully associated generations during b; no automatic age-based destruction | A desired reset cannot destroy material that a future live/rollback revision may require |
| G02-09 abandoned material | Eligible after 24 hours and terminal non-association, with exact ownership and dependency checks; retain cleanup tombstones | Failed preparations are recoverable and eventually cleaned without deleting successors |
| G02-10 bounds | 5-second provider request deadline; 6 attempts total, exponential delay from 5 seconds capped at 5 minutes; concurrency 2 per credential-worker process | Bounded retries through existing pg-boss; exhausted work needs explicit trusted reconciliation |

Main tradeoffs: OpenBao adds a service, storage, TLS and seal/access administration. Asynchronous setup/reset returns an operation to inspect rather than an immediate configured result. No phone can be configured through this unit's UI/API. Retaining associated generations consumes storage until P3-U5 supplies trustworthy retirement dependencies. These are deliberate scope choices for approval.

Suggested approval wording:

> Approve sections 2–6 of the P3-U2b credential contract review for controlled private development, including OpenBao provisioning, dedicated credential-worker access, generated credentials, no recipient delivery, authority continuation, retention and recovery limits. Proceed with P3-U2b using sections 7–9. Production and live PBX application remain separately gated.

The [feature gate](../../context/feature-specs/p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md#starting-state-and-decision-gate) requires: “Resolve parent G-02 before dependent provider/schema/lifecycle implementation”. This review supplies the concrete proposal for that approval; no dependent implementation starts during document preparation.

## 2. Material, identity and provider — G02-01/02

Use the generated-material flow only. Generate with the runtime cryptographic random generator inside the credential worker. Recoverable SIP material belongs encrypted in OpenBao; staff password hashes/tokens, AMI credentials and Garage references are unrelated and cannot be reused.

Use the existing immutable generated auth-object key (`ims-a-<installation>-<extension>`) as the proposed SIP authentication username. Keep it stable across resets; generation changes the password only. Keep it internal to protected consumers in b. Validate the 71-character username and 64-character hexadecimal password against the controlled node's reviewed capability declaration; fail unsupported combinations. This is a desired-format contract, with actual phone/client and Asterisk authentication verification owned by later delivery/apply units.

| Provider item | Proposed development contract |
| --- | --- |
| Deployment | Separate opt-in Compose service `endpoint-secrets`; normal persistent server mode, no ephemeral dev mode; pin an exact reviewed release/image digest during implementation |
| Storage | Dedicated persistent Raft volume; OpenBao owns encrypted material and storage keys; PostgreSQL owns operations, generations and references only |
| Transport | Private Compose-network HTTPS on service port 8200, verified development CA and hostname; no published host port or public UI; no TLS verification bypass |
| Initialization/seal | Explicit trusted deployment initialization and manual unseal; development-only 1-share/1-threshold custody in ignored owner-only provisioning files, separate from runtime mounts; no application auto-initialization/unseal |
| Bootstrap authority | Revoke the initialization root token after configuring scoped administration; no root token or unseal material in HTTP, worker, observer, web or Asterisk processes |
| Access bootstrap | Deployment provisions separate renewable scoped worker and cleanup tokens through owner-only runtime files; 1-hour initial token TTL, 24-hour maximum lifetime; renew before expiry, explicit reprovisioning at maximum lifetime |
| Mount | One dedicated KV-v2 mount `myims-endpoint`; no reuse of management material or a second application material store |
| Internal location | Server-derived `installations/<installationUuid>/extensions/<extensionUuid>/operations/<operationUuid>`; clients cannot submit paths, URLs, aliases or locations |
| Immutable value | Password plus exact installation/extension/operation/generation binding; one value at KV version 1, create-only CAS=0; no updates or patches |
| Desired reference | Opaque application generation UUID with internal provider location/version mapping; APIs expose safe generation identity, never location or provider capabilities |
| Diagnostics | Provider request/response body tracing disabled; provider audit uses protected storage and default sensitive-value HMAC/redaction, never raw logging; sentinel verification includes it |

OpenBao documents [KV-v2 CAS and deletion semantics](https://openbao.org/docs/secrets/kv/kv-v2/) and [persistent Raft storage](https://openbao.org/docs/configuration/storage/raft/). These support the proposed adapter; our path convention, TTLs and lifecycle are project policy. CAS=0 allows creation only for a previously absent key. Soft deletion is reversible; cleanup must explicitly destroy the owned version. Preserve metadata/tombstones rather than deleting metadata and permitting key reuse.

The provider implements the architecture's endpoint-secret-store slot; it does not replace canonical PostgreSQL state or expand the existing read-only management-file adapter. Approval explicitly permits this new service/storage integration. Before code depends on it, synchronize [architecture](../../context/architecture.md) and the shared-service/deployment runbooks with the approved scope.

Single-node storage and 1-of-1 seal custody are development concessions. Preserve the provider volume, seal custody and PostgreSQL data during ordinary stops. A sealed/unavailable provider blocks credential work safely. Joint backup/restore, HA, production seal custody, token automation and production hosting require separate approval; no disaster-recovery objective is claimed here.

## 3. Material access and phone delivery — G02-03/04

| Process | Allowed access |
| --- | --- |
| HTTP replicas A/B | Existing PostgreSQL/Redis authority plus safe operation/generation metadata; no OpenBao token, password resolution, provider request or material mount |
| Platform/command-center/public web and mobile | Safe permitted DTOs only; no material, provider identity, URL or hidden reveal response |
| Dedicated credential worker | Narrow create/read of this installation's endpoint operation paths, sufficient to reconcile ambiguous preparation; no destroy, metadata deletion, policy administration, management credentials or PBX connectivity |
| Ordinary durable worker | No endpoint-provider token; does not fetch/consume credential work when not configured as its designated consumer |
| Cleanup command | Explicit trusted deployment execution with separate scoped read/metadata/destroy authority and canonical database checks; no bulk mount deletion |
| Telephony observer and Asterisk | No new credential-provider access in b; existing AMI identity/mounts unchanged |
| Future P3-U5 apply process | Not provisioned by b; later reviewed read-only access to exact approved generations, with live fencing and dependency tracking |

The credential worker is an independently configured process of the existing worker boundary, not a new application service or queue. Preserve the existing `committed-work-v1` queue, outbox handoff and handler registration. Since the queue is shared, implement and test consumer selection so ordinary workers cannot claim credential jobs and exhaust them as unknown work, and credential workers cannot steal unsupported ordinary work. Keep provider resolution behind a narrow port; never serialize its result into jobs or return it to HTTP.

Worker permissions cover an installation's paths, not an individually brokered capability for each operation. A compromised credential worker could read that installation's stored endpoint credentials. Narrow application ports do not eliminate this provider-level exposure; this is the development access scope being requested. Runtime checks must still bind every read/write to the exact durable operation.

**Recipient decision: none in this unit.** No password entry, download, reveal, email/SMS, copied clipboard secret, terminal output, bearer link or one-time recipient token is implemented. There is therefore no recipient expiry or response-loss exchange to recover. HTTP response loss recovers safe operation status only. This leaves parent/c's existing no-secret browser contract intact. Do not provision a test phone from these credentials as an implicit extension of approval; real phone provisioning and P8-U8 client access need separate delivery approval before their dependent work.

## 4. Authority, generations and retries — G02-05/06/07

Every request targets canonical node and immutable extension IDs and supplies an immutable caller operation UUID, positive expected extension desired version and expected credential generation UUID (or null for setup). Reject client-selected actor, ownership, provider and material fields. Canonicalize an allowlisted safe fingerprint over action, node, extension, desired version and expected generation.

Setup requires an unset association; reset requires an existing configured association. Both enabled and disabled unallocated stock may be configured, subject to the same eligibility/dependency port. Reset allocates a new immutable generation UUID and monotonically increasing generation ordinal; abandoned ordinals are never reused. Only successful association advances the extension desired version, exactly once.

Reserve one active operation per extension in PostgreSQL. A second distinct operation while preparation is active receives `credential_operation_pending` without creating material. Concurrent retries with the same canonical operator/action/key and fingerprint return the original operation. Changed payload/key reuse conflicts. After any terminal failure, a new operation requires explicit canonical reload/review and a new intent; replay of the old intent returns its old outcome.

Enqueue and final association each use current canonical authority checks and the existing node → extension transaction locking order. Reuse `InventoryVersionPort.lockUnallocated` rather than parallel eligibility logic. Capture the originating operator ID, authorization/authentication version and target/dependency versions in the durable intent. Final worker association rechecks current canonical operator status, permissions and captured security version under the identity/platform owner's transaction port, then the exact inventory version, current generation, node identity and dependency eligibility.

An already accepted intent may complete after session expiry or confirmed logout. It requires no fabricated session or worker Redis admission. Operator disablement, authority loss or authentication-version change before final association cancels it and schedules its prepared material for cleanup. Re-enabling the operator cannot revive a cancelled operation. Once association commits, subsequent revocation does not reverse history or destroy material. Status requests always require a new/current authorized platform session; receipt recovery remains scoped to the originating canonical operator.

The association transaction commits the usable reference, generation history, extension version increment, one actor-attributed setup/reset business audit, original safe result and required durable intent together. Operational progress is separate from the successful-change audit. Preserve originating operator attribution and executing system context through the existing audit/outbox contracts; no invented operator session. Failed/queued preparations never masquerade as completed resets.

| Evidence | Proposed retention |
| --- | --- |
| Full original safe operation result/receipt | 30 days from terminal completion, measured by database time; unresolved operations never expire into new work |
| Minimal key tombstone | Retain operator/action/key, canonical fingerprint, target, operation/generation IDs, outcome and timestamps without automatic pruning |
| History | Retain generation associations, operation/cleanup evidence, audit/outbox and durable results; no runtime history purge |
| Expired replay | `intent_expired`, with safe canonical recovery guidance; never regenerate material or reuse the key |

This intentionally strengthens a's receipt-pruning boundary for external credential effects. Receipt expiry cannot remove the deduplication evidence needed to prevent blind reset replay. Trusted deployment may compact full expired results, preserving the minimal tombstone and all retained owner history.

## 5. Provider ordering and recovery

Persist the durable operation and outbox before contacting OpenBao. External calls remain outside application database transactions. Prepared material is not yet desired configuration. State names below are proposed safe enums; they describe durable facts rather than inferring success from an HTTP timeout.

| Stage / interruption | Canonical result and required recovery |
| --- | --- |
| Validation/authority/eligibility fails | No operation/material/change; safe fixed error |
| Accept transaction | Commit `queued` operation, reserved generation and outbox atomically; no desired version advance; return safe 202 only after known commit |
| Accept COMMIT response lost | 503 is uncertain; same intent/status lookup on primary recovers original queued operation; no new key or second generation |
| Prepare | Worker reloads committed intent, checks terminal/version/authority fences, generates candidate and creates exact provider key with CAS=0 |
| Duplicate prepare / provider response lost | Resolve the same exact key; validate binding, version and material format inside provider adapter; use existing value, never overwrite it; confirmed absent key may be created, while uncertain/unreadable key stays unresolved |
| Provider failure | Remain pending/retrying with fixed failure category; current association unchanged; no falsely configured new generation |
| Prepared then worker restart | Reload exact operation and provider key, prove usable material and bindings, then retry final association; never prepare a second key |
| Final association | Reauthorize and lock exact unallocated/versioned inventory in one transaction; verify operation is active, expected generation/dependencies unchanged and provider preparation proven; commit all association/audit/result facts atomically |
| Final database/audit failure | Roll back every association fact; retain operation/prepared-material ownership for bounded retry or terminal cleanup |
| Final COMMIT response lost | Inspect operation, association, audit/result on primary before any new provider action; a committed association returns original result; database unavailability keeps outcome unknown and prevents cleanup |
| Stale edit, successor, changed dependencies or revoked operator | Terminal `cancelled`/`conflict`; no association; only the losing operation's prepared key becomes cleanup eligible |
| Provider material missing after association | Report `material_unavailable` on protected verification/reconciliation; never silently recreate or substitute a different password at the same generation; mark desired material health degraded without claiming live revocation |
| Destroy response or cleanup acknowledgement lost | Inspect exact provider version and canonical operation; idempotently finish destroy/record acknowledgement, retaining metadata and database tombstone |

`configured` records a proven usable protected association at commit; a historical flag does not promise uninterrupted provider availability. Return last verification time and separate safe material health (`verified`, `unknown`, `unavailable`). Passive HTTP reads use canonical persisted facts and do not resolve secrets or perform provider calls; worker reconciliation updates health. Provider outage never changes a prior association into unset or fabricates readiness.

Serialize prepare/finalize/cleanup for an operation through existing database coordination and exact-operation fences. A stale worker must not associate after cancellation. A provider request may finish after a database connection is lost; its potential key is already durably tracked. Cleanup must revisit terminal operation keys, including keys initially observed absent, and reconcile any late preparation. Keep destroyed-key provider metadata so CAS=0 cannot recreate it. Test delayed provider completion against terminal cleanup explicitly; elapsed time alone is never proof that no write occurred.

Use pg-boss as the retry scheduler, with 6 total attempts and 5-second exponential backoff capped at 300 seconds. Permanent validation/binding/ACL failures stop immediately. Each provider call has a 5-second deadline; timeout means unknown outcome until read reconciliation. Limit credential consumers to 2 concurrent operations per process; no process-local authoritative state. After exhaustion retain `needs_reconciliation`; no periodic process automatically resets the attempt budget. A trusted, audited deployment reconciliation command may inspect/requeue the same operation with a fresh bounded execution budget, preserving key/generation and rechecking authority before association. It cannot convert cancellation into a fresh reset.

## 6. Retirement and abandoned-material cleanup — G02-08/09

Retain every successfully associated generation in b, including superseded desired generations. There is no password expiry or scheduled rotation in this unit. Enabled/disabled state, reset, session logout and inventory observation never establish that an old live credential is revoked or no longer needed.

P3-U5 must later provide canonical dependency facts for applied revisions, in-flight apply, rollback candidates and release of those dependencies. Until that port is real and approved, associated-generation retirement is `retained_dependency_unknown`. Test dependency checks with a named owner-port fixture and identify the injected boundary; do not implement speculative apply tables or claim live rollback proof.

Only never-associated material may be destroyed in b. Eligibility requires a terminal operation that can no longer finalize, age at least 24 hours after terminal resolution, exact provider ownership binding, no canonical association/history requiring retention, and an affirmative dependency decision. Unknown dependency state blocks destruction. In b, real never-associated operations are eligible only where canonical history proves the generation was never exposed to a revision consumer; otherwise retain. Current, successor and ever-associated generations always deny this cleanup path.

Run cleanup explicitly through trusted deployment, in batches of at most 50 exact operations, using the same per-operation coordination as preparation. Require an exact fixture/installation scope; no provider-wide listing/deletion command. Destroy only version 1 of the derived operation path, keep provider metadata, and record safe destruction/acknowledgement status. Six total attempts with the same backoff apply to transient cleanup failure; exhaustion remains visible as `cleanup_required` for explicit recovery. Terminal cleanup records remain inspectable on later sweeps to catch late provider writes. No count, TTL or deletion acknowledgement permits deleting a successor's different key.

Provider destruction does not prove erasure from retained backups, storage media or a previous live Asterisk configuration. Backup retention and live revocation are separately owned policies. No production destruction guarantee is inferred.

## 7. Proposed protected API and consumer handoffs

Routine route names and schemas may follow repository conventions while preserving these policy contracts. Route root: `/platform/pbx-nodes/:nodeId/extensions/:extensionId`.

| Route | Proposed behavior |
| --- | --- |
| POST `/credentials/setup` | Strict `{operationId, expectedVersion, expectedGenerationId:null}`; 202 new accepted operation, 200 terminal original result, 202 still-pending replay |
| POST `/credentials/reset` | Strict `{operationId, expectedVersion, expectedGenerationId}` with exact current UUID; same replay behavior |
| GET `/credentials` | Safe current desired generation/status, independent material health/verification timestamp and active operation summary |
| GET `/credential-operations/:operationId` | Originating-operator-scoped recovery/status for exact node/extension/operation; unknown/foreign target returns safe 404 |

Require current platform-cookie authority, existing trusted channel/source, CSRF/exact Origin and no-store rules on HTTP A/B. Staff, forged ownership, expired/revoked sessions and session-store outage deny. Protected reads/polling are passive and never renew sessions. Session admission failure returns established 503; provider outage alone leaves inventory/status reads usable with qualified health.

Keep existing 4096-byte request ceiling; safe operation result at most 16 KiB, at most 10 fixed validation details. DTOs allow operation/action/state, canonical target IDs, expected/resulting desired versions, safe generation IDs/ordinals, timestamps, retryability/fixed error category and originating attribution where already permitted. Exclude password/hash, auth username/runtime key, provider locations, tokens, raw exceptions and request/configuration text. Jobs/outbox carry only safe IDs and allowlisted metadata, with canonical intent reloaded by the handler.

Errors: established 400/401/403/404/429/503 and fixed 409 reasons `request_conflict`, `stale_version`, `dependency_changed`, `inventory_ineligible`, `credential_state_conflict`, `credential_operation_pending`, `intent_expired`. Asynchronous outcomes distinguish `provider_unavailable`, `provider_access_denied`, `material_invalid`, `material_unavailable`, `originator_revoked`, `needs_reconciliation`, `cleanup_required`; never forward provider text. Unknown request COMMIT returns sanitized 503 with existing retry guidance, not a claim of rollback.

`c` receives safe setup/reset/status and immutable same-intent recovery. It preserves exact operator-bound mounted work, explicit retries and independent desired/observed/applied state. It receives no secret form/reveal/handoff. P3-U5 receives exact protected generation references, immutable auth identity and retention constraints; it owns installation, verification, runtime revocation and rollback. P4 owns allocation/assignment eligibility; P8-U8 owns later client credentials. None is implemented by b.

## 8. Required access and resume conditions

After approval, record the exact approved sections/date and any amendments here; synchronize authoritative architecture and provider/runbook contracts before dependent code. Then provision the private service, reviewed exact image digest, persistent volume, TLS trust, seal/admin custody, narrow worker/cleanup identities and isolated test prefix. Pinning and adapter details are engineering work; inability to meet an approved security/access contract requires resolving the discrepancy before proceeding.

Verify with real provider policy denials that HTTP, web, ordinary worker and observer cannot resolve material, and that the credential worker cannot destroy or administer policy. Establish typed provider configuration, actual token renewal/expiry and sealed/outage recovery. Confirm designated consumers can share the existing queue without consuming unsupported work. Missing service/access or unresolved decisions keep b planned/incomplete; an in-memory provider is not a substitute for this gate.

## 9. Acceptance and document verification

| Criterion | Required implementation evidence |
| --- | --- |
| B-01 | Approved G02-01–10, access matrix, API/error/retention contract, state table and c/P3-U5 handoffs |
| B-02 | Real OpenBao create/read policy, usable exact generation plus real PostgreSQL/runtime-grant atomic version/audit/result; unset/missing/denied/provider failures stay truthful |
| B-03 | HTTP A/B duplicate/conflicting intents, concurrent reset arbitration, stale edits, lost provider/COMMIT responses, expired-key tombstones and delayed worker fences produce one association/audit |
| B-04 | Provider/database/audit failure, restart/seal/token expiry, cleanup interruption, late writes, destroy/acknowledgement loss, successor retention and injected apply dependencies; no untracked prepared material |
| B-05 | Platform-only routes on both replicas, CSRF/Origin/channel/no-store, forged/staff/revoked/expired authority, Redis outage, enqueue-to-commit account revocation and approved logout/expiry continuation |
| B-06 | Sentinels absent from DTOs, receipts, audit/outbox/jobs, revisions, logs/errors/provider audit, URLs and client contracts; real process/provider ACL denials; no recipient output |
| B-07 | Focused real-service checks, affected inventory/auth/audit/durable regressions and full Docker graph; safe evidence/runbook/index/tracker and exact fixture cleanup |

Establish `./dev exec pnpm check:extension-inventory --credentials` during implementation; it is proposed, not an existing recorded pass. Use real PostgreSQL/runtime grants, shared Redis, independent HTTP A/B and OpenBao with isolated fixture material. Existing `--inventory`, affected documented authority/durable commands and `./dev check` remain required. Record exact commands/results and distinguish real integration from injected provider faults and future-owner dependency fixtures.

For this review draft, checks are source consistency, G-02/B-01–07 coverage, relative links and whitespace only. No runtime test, service provisioning, credential generation, approval or feature completion is claimed.
