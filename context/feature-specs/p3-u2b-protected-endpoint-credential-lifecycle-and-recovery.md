# P3-U2b — Protected endpoint credential lifecycle and recovery

## Status and purpose

- **Status:** planned; child spec prepared 2026-10-15 (Asia/Manila, +08:00) under the adopted a → b → c sequence.
- **Requirement:** [P3-U2 parent credential contract and acceptance](p3-u2-extension-inventory-and-endpoint-profiles.md).
- **Goal:** associate and reset protected endpoint credentials with exact canonical extension generations, with recoverable retries and sanitized status.
- **Completion boundary:** the approved provider/reference flow and protected API prove setup/reset, version fencing, audit, retry and interrupted-operation recovery. Desired credential configuration grants no live activation or revocation. Browser integration belongs to c.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
The parent owns shared G-01–03 and AC-01–11. Adoption of this split does not select
a secret provider, approve credential delivery or authorize PBX control.

## Starting state and decision gate

Require verified [P3-U2a](p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md),
including canonical extension/profile identity, real runtime grants, unallocated
eligibility denial, safe API fields, intent receipts and transaction/version ports.
Recheck P3-U1's protected secret and observation boundaries and existing
[transactional audit](../../docs/architecture/transactional-audit-outbox.md) and
[durable execution](../../docs/architecture/durable-worker-delivery.md) contracts.

Resolve parent G-02 before dependent provider/schema/lifecycle implementation:

- Generation versus supplied-reference setup; required entropy/material format and endpoint compatibility.
- Provider, protected aliases, allowed read/write processes and runtime provisioning/access.
- Phone-recipient handoff, any explicitly approved one-time delivery, expiry and recovery after response loss. No browser password entry/reveal is implied.
- Credential generations, old-secret retention/retirement, concurrent reset semantics, receipt lifetimes and abandoned-material cleanup.
- Failure/reconciliation ordering across provider and PostgreSQL, including provider/database outage and cleanup interruption.

Record the approved contract and real access needed to resume. P3-U1's management
credential file reader is not a writable endpoint-secret service. Staff password
hashing/setup tokens and delivery approvals do not define SIP credential behavior.
Do not select a new provider or copy reference passwords to bypass this gate.
Routine API/adapter composition follows existing conventions.

## Scope and ownership

Own narrow endpoint-secret provider ports and approved adapter integration,
credential operation/generation metadata needed by actual consumers, protected
setup/reset/status APIs, transaction/version checks, idempotent recovery and
necessary jobs in the existing worker boundary, plus checks and documentation.
Introduce durable jobs only where the selected lifecycle requires them; no new
queue/service or replica-local authoritative operation state.

Reuse a's inventory and authority instead of duplicating identities or profiles.
Do not implement browser screens, live Asterisk credential writes, compilation/
reload, operational calling, tenant allocation/assignment or raw configuration
export. P3-U5 owns live credential installation/verification and rollback; c owns
operator interaction and safe status presentation. P8-U8 owns browser calling.

## Credential and operation contracts

Target every action by immutable extension ID and expected desired version.
Revalidate current platform authority, unallocated inventory and dependencies
on the same transaction as the final association/version/audit. A client number,
PBX alias or provider path cannot select another extension or credential.

Setup changes an unset desired credential association to an approved protected
reference. Reset creates a new desired generation; never overwrite the old
material in place while calling it a new version. Record only opaque safe
reference/version metadata, operation identity, sanitized status/failure category,
timestamps and attribution. No shared default or number-derived password.

Commit the association, desired-version advance, actor audit and required durable
intent atomically. Old credential metadata/history remains attributable under the
approved retention contract. Credential state is independent of enabled/disabled,
ownership, registration and applied readiness. A configured desired reference
means usable protected material exists; it does not mean a phone can register.

Bind retries to canonical operator, action, extension, expected generation/version
and a canonical safe fingerprint. Same operation/payload returns one original
result without generating another secret or audit; conflicting reuse rejects.
Concurrent resets from the same expected version cannot both advance it. Define
how a caller finds an uncertain committed operation without reissuing a new reset.
Retain enough durable evidence to resolve provider preparation versus database
commit after restart; receipt expiry must not cause blind rotation replay.

A stale edit/reset must not overwrite a successor. Any delayed job/callback checks
its exact operation and expected generation before association, retirement or
cleanup. Never delete a successor's material using an older operation's cleanup.
Use existing worker transaction/idempotency conventions and finite retry/backoff;
a permanent provider validation failure is not an unbounded retry loop.

## Provider ordering and recovery

Use the G-02-approved flow, not both speculative integrations:

- **Generated material:** prepare protected material using the durable operation identity; ensure duplicate preparation resolves to the same generation. Commit a usable reference and audit only after preparation succeeds. Reconcile abandoned/uncommitted preparation safely after rollback, interruption or uncertain commit.
- **Existing reference:** validate the approved alias and required material existence/access through a protected provider port. Reject arbitrary paths/URLs and association of another endpoint's material under the approved ownership rules. Do not return resolved material merely to validate the reference.

Define and verify a state/ordering table covering request validation, preparation,
association commit, reconciliation and retirement. If the provider is unavailable,
report a safe retryable/pending/failure result consistent with canonical state;
never mark missing material configured. Audit/database failure rolls back the
association; any remaining prepared material is tracked for safe cleanup rather
than silently leaked or exposed. Cleanup is idempotent, bounded and ownership
checked, including when provider deletion or database acknowledgement fails.

Do not retire material still required by an applied or rollback revision. P3-U5
must later supply those dependency facts; b cannot claim old live credentials
revoked because a desired reference changed. Until approved safe retirement can
be established, retain the dependency and report its limitation rather than
claiming immediate destruction. Test live-apply dependency behavior through a
named owner-port fixture only; it is not live P3-U5 proof.

## Authority, material access and delivery

Setup/reset/status routes require canonical platform authority and existing
channel/CSRF/origin/no-store rules on HTTP A/B. Tenant staff and client-selected
ownership cannot access material or actions. Recheck authority at final commit;
a queued system continuation records its originating actor and durable intent
without fabricating a new operator session. Define whether an approved operation
continues after originator revocation in G-02 before implementing that case.

Only processes needed by the approved lifecycle may resolve material. HTTP/UI
receives safe operation and generation status, not management secrets or long-lived
endpoint passwords. A provider worker may receive a narrow protected capability
if G-02 authorizes it; do not broaden all HTTP/worker/observer mounts. Never write
material to outbox/job payloads, retry receipts, audit, desired snapshots, URLs,
logs/errors or browser recovery state.

Any phone-recipient handoff must use G-02's explicitly approved protected channel
and response-loss/expiry rules. If that decision requires a changed browser-facing
contract, synchronize the parent/c spec before implementation; the present spec
authorizes no secret reveal endpoint. No staff setup-token reuse or client browser
calling credentials are included.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| B-01 | G-02 provider/material/access/delivery/retention decisions and operation ordering/recovery table are recorded. API/errors/receipt lifetimes and P3-U5/c handoffs are documented; management secrets/staff credentials remain separate. | AC-01 credentials |
| B-02 | Approved real provider/reference setup/reset works for the exact extension; a usable protected reference, desired generation/version and actor audit commit atomically. Unset/missing/denied/provider failure never appears falsely configured. | AC-05 setup/reset |
| B-03 | Same-intent replay and conflicting reuse, two-replica reset races, stale expected versions and lost provider/COMMIT responses yield one correct desired generation and one business audit. Delayed completion cannot replace a successor. | AC-05 concurrency/retry |
| B-04 | Provider preparation, database/audit rollback, restart, provider outage and interrupted cleanup recover under the approved state table. Abandoned material stays tracked until safe cleanup; duplicate cleanup never removes active/successor/rollback-required material. Injected dependency cases are qualified. | AC-05 recovery; AC-09 cleanup |
| B-05 | Platform-only setup/reset/status enforcement passes on HTTP A/B, including staff, revoked/expired/forged authority, CSRF/origin/channel/no-store and session-store outage. Unallocated status grants no tenant credential/calling access; desired reset is not reported as live revocation. | AC-06/07 credentials |
| B-06 | Sentinel scans prove no material in DTOs, receipts, desired/revision metadata, audit/outbox/jobs, logs/errors, URLs or client contracts. Real provider access is restricted to approved processes; protected recipient handoff, if required, passes its approved contract without secret evidence capture. | AC-09 credentials |
| B-07 | Focused provider/database/HTTP checks, affected a/auth/durable regressions and full Docker graph pass. Safe evidence/runbook/index/tracker document real versus injected checks, cleanup and outstanding live-apply/browser boundaries. | AC-11 scoped |

Establish the proposed `./dev exec pnpm check:extension-inventory --credentials`
selection during implementation; it is not an existing command or recorded pass.
Use real PostgreSQL/runtime grants, shared Redis, two HTTP replicas and the approved
protected endpoint provider. Fault injection proves ordering/failure cases, not
provider integration by itself. Use deterministic barriers and isolated material;
record only safe IDs/results and exact fixture-owned cleanup. Run a regressions,
affected auth/durable checks and `./dev check` with actual recorded commands.
Missing required provider access or lifecycle decisions keeps b incomplete.

Documentation preparation needs consistency, coverage, links and whitespace only.
Complete b only when B-01–07 pass. Hand [c](p3-u2c-operator-inventory-browser-and-integrated-handoff.md)
the approved safe actions/status/errors, immutable intent/recovery contract,
material-exclusion rules and delivery limitations. Hand P3-U5 exact generation
references and retention dependencies; b does not establish live activation,
revocation, tenant readiness or parent completion.
