# P2-U4a — Qualified credential lifecycle and administrator handoff

## Status and purpose

- **Status:** planned; split adopted 2026-10-07 (Asia/Manila, +08:00).
- **Requirement:** [P2-U4 parent scope, gates and AC-01–12](p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md).
- **Goal:** deliver approved issuer-to-recipient setup/reset/recovery with durable single-use exchange and qualified administrator provenance.
- **Completion boundary:** an authorized issuer initiates an approved action, safely hands off its capability, and the recipient sets credentials through the real UI; canonical credential replacement invalidates previous authority across replicas. Draft setup grants neither ordinary staff sessions nor activation.

The user authorized child-spec creation, not G-01–06 policy approval or runtime
implementation. The parent remains authoritative for common scope and policies.

## Starting state and decision gates

Require verified P2-U1/U2, P1-U4/U5, P4-U1a and reusable P2-U3 verifier/browser
patterns. Read AGENT.md's required context and recheck existing evidence and owner
interfaces. Reuse [identity authority](../../docs/architecture/canonical-authority-admission.md),
[shared sessions](../../docs/architecture/shared-session-lifecycle.md),
[HTTP authority](../../docs/architecture/canonical-http-authority.md) and
[draft provenance](../../docs/architecture/draft-tenant-registry-api.md).

Resolve all parent G-01–06 before dependent implementation: issuer/target/state
matrix, draft exception, staff password policy, capability lifetime/reissue/cancel
and invalidation timing, verified-person handoff/recovery, abuse budgets and
retention. Record scoped approvals in product contracts and tracker; do not treat
bootstrap or sign-in approvals as credential-recovery approval. If draft setup is
rejected, reconcile affected parent acceptance before coding that path.

## Scope and ownership

Allowed changes: identity-owned capability schema/repositories/use cases, narrow
owner transaction integration and audited credential replacement; tenancy status
reads/locks; platform initial-admin issue/recovery use cases and draft-detail action;
bounded issue/reissue/cancel/exchange HTTP contracts and forgery protection;
recipient exchange UI and an authorized tenant-admin issuer surface using existing
session authority. Include only target lookup needed for this workflow, not a
staff-management screen or new permission bundle.

The tenant-admin issuer surface may be verified using controlled existing-session
fixtures until b/c deliver real sign-in; document that boundary. Operator and
recipient paths must use the actual browser stack. No setup exchange synthesizes
ordinary staff authority. Ordinary staff sign-in/logout and mobile delivery belong
to b; protected command-center shell and native storage belong to c. No tenant
activation, PBX, incident drafts, general account recovery or email/SMS service.

## Working journey and contracts

1. Operator opens a real P4-U1a tenant detail and initiates setup for its canonically linked `{tenantId, staffId}` under the approved state matrix. Show code/username and explain that credentials do not activate the tenant.
2. Authorized issuer sees a new capability once, performs the approved verified-person handoff, and can explicitly reissue/cancel where approved. Protected listings never redisclose secrets.
3. Recipient enters the capability and new password/confirmation on a dedicated form without tokens in URLs. Exchange resolves target and purpose from server state; no client-selected target can redirect it.
4. Confirm only committed success. Draft remains draft with ordinary admission denied. Active-user reset invalidates all prior devices; b/c prove fresh sign-in with the new password.

Define named routes/DTOs, bounded inputs, approved purpose/state errors, rate-limit
keys and origin/CSRF topology before implementation. Administrative issue/recovery
uses explicit declared operator or staff session channels with backend permission
checks. Operator authority is a narrow lifecycle issuer permission, never a staff
principal. Public exchange uses only its capability context and declared forgery
protection; no protected-staff guard requiring prior login. a must settle and prove
exchange topology independently of b's later ordinary staff-cookie wiring.

Use parent-approved password bounds and exact-byte semantics, bounded hasher
capacity, clear validation and generic invalid/expired/consumed/wrong-purpose
capability errors. Hash/internal/dependency failures are retryable unavailable.
Apply approved shared credential-action budgets before lookup/hash work; existing
sign-in budgets do not define them. No account/token existence disclosure.

## Persistence, concurrency and authority

Identity owns minimal PostgreSQL capability records: hashed lookup, purpose,
qualified target, expected versions, issuer attribution, expiry and terminal state.
Add feature-owned constraints/indexes/runtime grants and approved retention only.
Never store plaintext passwords/capabilities or reconstruct a disclosed token.

Lock/revalidate canonical issuer permission and target staff/tenant state through
owner ports. Initial-admin lookup must follow retained creation provenance; a role,
username or first-created row cannot substitute. Draft exception is narrowly
capability-authorized and cannot alter ordinary admission predicates.

Consume the action, replace coherent credential hash/state/timestamp, increment
authentication version and append safe required audit atomically on one connection.
Preserve authority-lock ordering and transaction poison. A recipient capability
provides evidence of the authorized action; audit must distinguish its consumption
from a previously authenticated staff actor. Define this attribution within existing
audit conventions before coding. No invented authenticated principal.

Compute expensive hashes outside long-held locks where possible and revalidate
versions/purpose/expiry on commit. Concurrent exchange, cancellation, reissue,
credential/status/role change or tenant suspension cannot restore stale state or
produce two successful replacements. All prior sessions fail canonical version
checks on both replicas even if Redis deletion fails or stale records are restored.
Required database/audit failure rolls back consumption and credential changes.
Approved reset-issuance policy governs any earlier revocation effects.

Lost issue response cannot redisclose a token; recover by explicit authorized
reissue. Lost exchange response is uncertain and must not automatically replay a
password write; provide approved reconciliation/reissue behavior. Success requires
confirmed outer commit. Plaintext tokens/passwords, lookup hashes and raw identity
inputs stay out of logs/audit/metrics/artifacts.

## UI and failure behavior

Use shared dark components, keyboard labels/focus, responsive reflow, accessible
status and bounded duplicate submissions. Retain nonsecret inputs on validation;
clear secret inputs at safe lifecycle boundaries. Issuer work belongs to its
canonical owner: expiry/outage hides it, same-owner recovery may restore mounted
nonsecret work, foreign-owner/logout clears it, and late callbacks are fenced.
One-time token display never becomes durable browser state or a replayable receipt.
No automatic issuance/exchange replay after reauthentication or dependency recovery.

## Acceptance and verification

| ID | Required proof | Parent coverage |
| --- | --- | --- |
| A-01 | G-01–06 approvals, issuer/state matrix, password/capability policy, verified-person handoff and declared forgery/error/budget/retention contracts agree with product docs. | AC-01 |
| A-02 | Real P4-U1a create/detail/setup/recipient browser path targets the linked first admin, produces coherent ready credentials and retains draft status; no session, activation or PBX effect. Canonical ordinary admission denies. | AC-02 lifecycle |
| A-03 | Approved operator/tenant-admin authority and target/state combinations enforce qualification and least privilege; hostile IDs/purpose, foreign tenants, wrong planes, issuer changes and unapproved recovery deny. | AC-03 authority |
| A-04 | Password policy/exact-byte checks, expiry, single use, reissue/cancel, limits and generic capability errors pass. No list/retry rediscloses a capability; busy hash capacity is unavailable. | AC-03 lifecycle |
| A-05 | Real A/B consumption/reissue/cancel/version/status races produce one allowed atomic result. Required SQL/audit failure rolls back; lost issue/exchange response follows declared safe recovery. | AC-04 atomicity |
| A-06 | Credential replacement advances canonical versions, invalidates preexisting web/mobile sessions on A/B and prevents stale Redis restoration from reviving authority; failed transaction preserves precommit facts. | AC-04 revocation; AC-09 lifecycle |
| A-07 | Actual operator/recipient and declared tenant-admin issuer UI enforce channel/Origin/CSRF and owner isolation, keyboard/focus/reflow, safe uncertainty and secret exclusion. Fixture-issued tenant-admin session limitation is explicit. | AC-07 exchange; AC-11 lifecycle |
| A-08 | Focused lifecycle/browser checks, relevant identity/audit/session/platform/draft regressions and Docker checks pass; guide/runbook/evidence/tracker and b/c handoff are accurate. | AC-12 scoped |

Use actual PostgreSQL/runtime grants and Redis with independent HTTP processes;
real operator and recipient HTTPS browser paths; isolated active staff/session
fixtures for reset and authorized tenant-admin issuer checks. Use barriers and clock
fixtures for races/expiry; test actual stale session restoration and lost responses.
Do not claim ordinary staff authentication from fixtures.

Provisionally select `./dev exec pnpm check:staff-auth --lifecycle`; command/selector
is not yet established. Record actual commands at implementation, run relevant
existing foundation/auth/draft regressions and final `./dev check`. Documentation
preparation requires consistency/link/coverage/whitespace checks only.

## Completion and handoff

Complete only when A-01–08 pass. Hand b/c approved policy, migration/grants, safe
qualified DTOs, exchange/error/forgery contracts, actual credential format,
revocation evidence, UI consumers and recovery fixtures. b adds real sign-in denial
for drafts and old passwords; c replaces issuer session fixtures with actual staff
browser access and verifies full integrated journeys. P2-U4 remains incomplete.
