# P2-U2c — Distributed rate limits and integrated recovery handoff

## Status and purpose

- **Status:** planned.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U2 parent scope and acceptance matrix](p2-u2-shared-session-store-and-authorization-guards.md).
- **Goal:** enforce distributed admission limits and prove the complete shared-session HTTP boundary under failure and recovery.
- **Completion boundary:** requests on two replicas consume one configured allowance;
  session/limiter outages and stale restoration deny access safely; all parent
  AC-01–11 pass with reproducible evidence and an operator recovery procedure.

The user adopted this third sequential implementation unit. The parent retains
shared policies and acceptance; c owns rate limits, integrated recovery and combined
handoff. a/b keep their own required correctness checks and documentation.

## Starting state and dependencies

Require verified [a](p2-u2a-shared-session-lifecycle-and-recovery-fencing.md) and
[b](p2-u2b-canonical-authority-validation-and-http-guards.md), including lifecycle
recovery fencing and two-replica canonical guards. Reuse their fixtures/configuration
and P1-U3 shared services; do not reimplement lifecycle or canonical repositories.

Before product limits are implemented, obtain the parent's scoped limiter policy:
operation coverage, budgets/windows, source/identity dimensions and counting rules.
Prepare a concrete policy proposal when implementation reaches this gate. Do not
turn fixture limits into product defaults. Document trusted proxy configuration;
resolve undefined deployment origins/cross-site behavior only where it affects
this unit. P1-U1 and broader credential/recovery/production decisions stay deferred.

## Scope and ownership

Allowed changes: `modules/identity/` typed limiter port and atomic Redis adapter,
HTTP limiter/error wiring for declared consumers, trusted source extraction,
validated limiter/timeout configuration, combined real-service fixtures/check and
CI wiring, session contract/recovery runbook/evidence and tracker.

Use existing session Redis and bounded namespace/TTL conventions. No local limiter,
realtime Redis fallback, external limiter service, account lockout subsystem or
new sign-in endpoints. Production HA deployment, browser cookie/CSRF journeys,
mobile storage, sockets and public intake remain with their owning later units.

## Distributed limiter contract

Provide a bounded typed limiter port usable before expensive credential verification
and on protected operations according to the approved policy. Each operation/plane
has an explicit namespace. Identity dimensions for staff include normalized tenant
code and username; platform identities are tenantless. Known and unknown identities
use the same limiter/error path, avoiding an existence oracle.

Combine trusted source and identity dimensions as approved. Extract addresses from
the connection and explicitly configured trusted proxy chain; arbitrary forwarding
headers cannot change the key. Define rejection of missing/ambiguous source inputs
and bound all untrusted identity input before normalization/key derivation.

Use an atomic Redis counter/algorithm with bounded TTLs and hashed identifying key
material. Concurrent requests on A/B share one budget; alternating replicas cannot
multiply it. Define boundary/window behavior, failure/success counting and retry
timing. Counter cardinality/resource use must remain bounded under hostile input;
keys cannot persist indefinitely. Metrics expose operation/outcome, not raw
addresses, usernames, tenant codes or lookup hashes.

Return 429 and bounded retry timing when the allowance is exhausted, with no
expensive verification, issuance or protected work after rejection. Redis outage,
timeout, ACL failure or noeviction capacity rejection returns retryable 503; never
admit requests through a process-local fallback. No automatic account disablement,
permanent lockout or guessed limiter defaults. Later P2-U3/U4 consumers reuse the
port and prove their own pre-verification integration.

## Integrated failure and recovery contract

Exercise the full trusted-issuance -> shared session -> canonical guard -> limiter
-> protected fixture path on two HTTP replicas. Apply a/b's error and renewal
contracts; connection/command retries remain bounded and do not conceal ambiguous
writes. Prove read and write failure separately, including Redis noeviction writes
while previously retained keys still exist. No operation reports successful issue,
renewal or revocation when required writes are unconfirmed.

Stop/restart session Redis, interrupt canonical PostgreSQL, and pause/interleave
lifecycle requests across replicas. Session-dependent operations return 503 during
unavailability; public health retains its declared behavior. Recovery may serve
valid retained sessions under the declared fence strategy, while lost records
require sign-in. Never reconstruct from memory or use realtime Redis as fallback.

Restore actual captured Redis data from before canonical authority changes,
revocation and rotation. Run a's fencing/reset sequence before allowing traffic;
prove the HTTP guard on both replicas rejects every stale token. Interrupt recovery
to prove the gate remains closed. Document the controlled test topology and its
limits; local restart/restore does not prove a production HA failover topology.

The runbook must state private credentials/network access, ACL/persistence and
noeviction expectations, bounds/capacity visibility, failure symptoms, restore
quarantine/fencing/reset steps, lost-session behavior and safe verification commands.
Record any production TLS/HA/capacity gates without expanding into deployment work.
Do not print tokens, Redis credentials or unnecessary identity data in evidence.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| C-01 | Approved limiter policy and validated config define operations, keys/dimensions, budgets/windows, counting and retry timing. Lifecycle approval, recovery design and later transport/production gates are accurately recorded. | AC-01 combined |
| C-02 | Independent concurrent requests across A/B consume one allowance. Boundary requests, expiry, known/unknown identities, tenant/plane separation and hostile forwarded headers behave as documented. Limit rejection is 429 with no guarded work. | AC-08 |
| C-03 | Redis/limiter disconnect, timeout, ACL and noeviction write failures return retryable 503 with no local/realtime fallback, renewal or falsely successful issue/revoke. Canonical outage preserves b's unavailable mapping. | AC-09 integrated; AC-08 outage portion |
| C-04 | Real restart/restore and interrupted recovery use a's fence/reset, then both HTTP replicas reject old canonical/revoked/rotated records. Lost sessions stay lost; valid retained sessions obey the documented recovery strategy. Ambiguous lifecycle responses grant no fallback authority. | AC-10 integrated; AC-09 recovery portion |
| C-05 | Combined checks rerun AC-02–07, including sensitive data, plane/tenant isolation, expiry, lifecycle races, canonical versions, permissions and transactional authority. No fixture issuer or protected fixture route ships in production wiring. | AC-02–07 regression/integration |
| C-06 | Focused full session check and required Docker checks pass; CI wiring, safe evidence and contract/runbook reproduce every parent criterion, exact environment, fixture cleanup and controlled recovery limitations. | AC-11 combined |
| C-07 | P2-U3/U4 handoff documents trusted issuance, credentials/planes, conditional renewal, revocation, limiter integration and errors; cookie/CSRF/mobile/sockets and Phase 2 gate remain explicitly incomplete. | AC-01/AC-11 handoff |

Use actual shared session Redis/PostgreSQL and two independent HTTP processes with
runtime grants. Isolate capacity/restoration faults in fixture-owned services;
never flush normal development sessions or unrelated databases. Use barriers for
concurrency and bounded deadline fixtures for windows. Fixtures may exercise the
sign-in limiter port without delivering a sign-in endpoint or claiming password
verification/browser acceptance. Test doubles do not prove shared allowances or
HTTP recovery. Clean up only the run's identifiable resources.

Finalize the provisional `./dev exec pnpm check:session-foundation` and documented
child selections, run the complete focused command and `./dev check`, then record
actual results. A command name in this spec does not establish its existence or
success. Documentation-only preparation requires consistency/link/whitespace review.

## Completion and parent handoff

Complete c and parent P2-U2 only when C-01–07, a/b criteria and all parent AC-01–11
pass. Centralize the parent acceptance mapping in the final evidence, with links
to a/b proof rather than duplicate unsupported success claims. Update tracker,
contract and runbook before P2-U3/U4 begin.

The parent establishes session/authorization infrastructure. Actual operator and
staff sign-in/logout, CSRF, credential recovery and mobile storage still require
their own acceptance; neither c nor the parent completes the Phase 2 gate.
