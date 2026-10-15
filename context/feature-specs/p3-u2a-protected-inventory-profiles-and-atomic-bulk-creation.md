# P3-U2a — Protected inventory, profiles and atomic bulk creation

## Status and purpose

- **Status:** planned; child spec prepared 2026-10-15 (Asia/Manila, +08:00). The user adopted the a → b → c split; implementation has not started.
- **Requirement:** [P3-U2 parent scope, gates and acceptance](p3-u2-extension-inventory-and-endpoint-profiles.md).
- **Goal:** establish canonical unallocated SIP/WebRTC inventory and reproducible endpoint profiles through protected individual/bulk APIs.
- **Completion boundary:** real PostgreSQL and two HTTP replicas prove valid inventory creation, profile versioning, atomic bulk operations, safe retries, versioned edits/disable and platform-only access. Credentials may remain unset. No browser, live configuration or tenant-allocation completion is claimed.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
The parent owns shared contracts and AC-01–11; this child specializes the inventory
foundation without approving pending product policy.

## Starting state and gates

Require verified P3-U1 a/b/c and its [final evidence](../../docs/status/p3-u1c-evidence.md).
Reuse the canonical [registry](../../docs/architecture/pbx-registry.md),
[observation boundary](../../docs/architecture/pbx-observation.md), platform guards,
transactional audit/outbox, deployment-owned migrations and runtime grants.

Resolve parent G-01 before dependent number/profile schema and validation:
number syntax, canonicalization/leading zeros, allowed/excluded ranges, profile
scope, fields/defaults and node compatibility. Resolve G-03's runtime namespace
portion before persisting generated endpoint/auth/AOR identities. Record approved
examples and treatment of existing unmanaged identifiers; do not assume the
reference endpoint number is a trusted runtime key. Remaining live mapping checks
belong to c. Missing G-02 does not prevent a from delivering unset credentials.

The user-supplied [working configuration](../../reference/asterisk_config/)
provides candidate SIP/WebRTC settings. Do not import raw configuration, passwords,
network addresses, shared `local-users` routes, public ingress or trunks. Preserve
the reference unchanged. Its contact/transport/media settings require G-01 review.

## Scope and ownership

Own telephony inventory/profile migrations and grants, repositories/use cases,
small shared transport contracts, protected list/detail/profile/create/bulk/edit/
disable/re-enable endpoints, durable intent receipts, denial/eligibility contracts
and focused checks/documentation. Route names and SQL structure follow existing
conventions; define the concrete API/error contract before coding clients.

b owns credential setup/reset, provider integration and its durable operation
state. a provides an exact extension/version transaction contract and safe unset
credential representation; add only metadata required by a's actual consumer.
c owns browser/proxy workflows and passive inventory-to-observation mapping.

Exclude allocation/assignment tables, tenant mutations, endpoint deletion/number
moves, route/revision/compiler schemas, PBX control and speculative workers.
Desired save cannot trigger a live install/reload, credential issuance or calling.

## Canonical inventory and profile behavior

Persist immutable extension/node identity, canonical number, kind, selected
profile version, desired enabled/disabled status, optimistic version, timestamps
and actor attribution. New records are unallocated with credentials unset and
readiness not established. Reject client-provided tenant/staff ownership,
registration/readiness flags, route contexts and internal runtime identities.

Enforce canonical number uniqueness in PostgreSQL for the entire PBX node across
SIP/WebRTC, profiles and disabled records. Equivalent installation aliases cannot
create separate namespaces. Distinct genuine nodes may reuse a number. Validate
canonicalization consistently for individual input, expanded bulk sets and reads.
Disabling retains identity, number reservation and history; re-enable is a desired
change only. Neither action proves PBX disconnection or readiness.

Profiles expose typed, allowlisted kind/transport/media/codec/contact behavior.
Reject incompatible combinations, unsupported node capabilities, raw configuration
and section/directive injection. Separate PBX management transport from endpoint
signaling transport. Secret material, network/certificate deployment values and
tenant route contexts are not profile fields.

Store immutable selected profile versions or an equivalent auditable safe
snapshot. A profile edit creates a reproducible version without silently changing
existing extensions. Any offered adoption is explicit, expected-version checked
and audited. Reject removal of referenced profiles if removal is exposed; profile
deletion is not required. Keep list/detail results bounded and paginated.

Availability, administrative status, credentials, readiness and runtime facts are
separate dimensions. Available means platform stock, never ready to call. Reserved,
allocated and assigned states must eventually come from their canonical owners;
do not implement fake writable states or duplicate staff associations here.
Expose a narrow eligibility result that denies unallocated/disabled inventory;
registration is not an input that can grant ownership. A fixture may prove future
consumer denial but must not be described as delivered P4 assignment enforcement.

## Atomicity, retries and concurrency

Individual and bulk create use the same validation/persistence rules. Bulk input
expands deterministically into an explicit bounded set under G-01's number policy.
Return a safe advisory preview of canonical numbers, kind and profile; revalidate
all inputs and dependencies at commit. Bound request size, expansion, result size
and conflict detail without assuming production capacity.

Bulk commit is all-or-nothing. Internal duplicates, invalid rows, existing
collisions, changed profile/dependencies or audit failure leave no records from
that operation. Reject conflicts rather than skip numbers or choose replacements.
Concurrent overlapping requests commit one valid whole set and reject the other;
non-overlapping requests must not contend through an unnecessary global lock.

Commit business mutation, canonical operator audit and any necessary durable
intent on one existing transaction handle. Audit identifies the exact affected
set within documented bounds, without secrets. No external PBX effects occur.
Runtime cannot perform DDL; migration execution stays with deployment.

Use owner/operation-scoped intent IDs and canonical fingerprints for creates,
bulk operations and retriable profile creation. Same key/payload returns the
original result and one business audit; conflicting reuse rejects. Define receipt
lifetime, expiry and safe error contracts before implementation. Expected-version
checks guard edits, profile adoption and disable/re-enable. Under lost COMMIT
responses, retry immutable intent or reload/review canonical state; never replay
changed input or infer that failure means no mutation committed.

Provide b a transaction-bound extension/version revalidation port so reset cannot
race a desired edit or act on another record. Retain parent restrictions to
unallocated stock; future dependencies must be checked through owner contracts,
not cleared to make an edit succeed. Do not add allocation schema preemptively.

## Security and failure behavior

Every route uses current backend platform authority and existing channel/CSRF/
Origin/no-store rules. Revalidate sensitive authority transactionally. Reject
staff, revoked/expired sessions and forged operator/tenant fields on HTTP A/B.
Shared-session or database failure denies protected work safely. PBX outage alone
does not invalidate desired inventory management or authorize network probes.

Responses, audits, receipts, logs and errors contain only approved safe fields.
No raw configuration, resolved secret, provider path or stack trace is returned.
Reads remain passive and do not renew sessions or start observers.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| A-01 | Applicable G-01/G-03 decisions, named DTO/routes, number/profile rules, bounds, errors/receipt retention and b/c handoffs are documented. Reference examples remain distinct from approved settings; no speculative later-unit schema/control. | AC-01 inventory |
| A-02 | Real runtime grants support individual SIP/WebRTC create/read/edit, with one atomic actor audit. Cross-kind/profile/disabled and equivalent-alias collisions reject, including concurrent replicas; separate nodes may reuse numbers. Audit failure rolls back. | AC-02 |
| A-03 | Advisory bulk preview and atomic commit reject malformed/oversized/internal-duplicate/conflicting sets. Profile changes between preview/commit and overlapping races leave no partial request. Same intent replay, conflicting reuse and committed-response loss produce one business result/audit. | AC-03 |
| A-04 | Selected profile versions remain reproducible. Profile edits do not silently update dependent extensions; explicit adoption rejects stale versions. Invalid kind/transport/media combinations, injection and unsafe references reject. | AC-04 |
| A-05 | Versioned disable/re-enable retains number/history and makes no live-state claim. Eligibility denies unallocated/disabled stock; forged ownership/readiness fields reject. No live provisioning or tenant traffic capability is introduced by a save. | AC-02 edits; AC-07 inventory |
| A-06 | Real sessions on two HTTP replicas prove platform-only authority, CSRF/origin/channel/no-store, revoked/expired/staff denial and safe database/Redis failure. List/body/error bounds and passive reads hold. Safe-output checks exclude secret/configuration leakage. | AC-06/09 inventory |
| A-07 | Focused real-service checks, affected registry/auth/audit regressions and full Docker graph pass. Contract/runbook/evidence/index/tracker record results, fixture cleanup, pending b/c and exact transaction/version handoff. | AC-11 scoped |

Establish the proposed `./dev exec pnpm check:extension-inventory --inventory`
selection during implementation; it is not an existing command or verified pass.
Use real PostgreSQL/runtime grants, shared Redis and independent HTTP A/B. Use
barriers for overlapping races and fault fixtures for audit rollback and actual
response loss. Namespace fixtures prove their declared boundary; c owns controlled
live observation/coexistence verification. Run affected documented PBX/auth/audit
checks and `./dev check`, recording actual commands and cleanup.

Documentation preparation needs coverage, consistency, links and whitespace only.
Complete a only when A-01–07 pass. Hand [b](p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md)
the canonical inventory/profile/intent and transaction/version contracts; hand
[c](p3-u2c-operator-inventory-browser-and-integrated-handoff.md) safe endpoint and
error/forwarding contracts. a completion does not complete credentials, the browser
journey, live apply, tenant readiness or P3-U2.
