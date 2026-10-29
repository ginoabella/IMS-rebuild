# P4-U1b-3 — Voice preference and integrated onboarding handoff

**Status:** Complete within approved private development, 2026-10-29 (Asia/Manila, +08:00).
C-01–07 and integrated parent AC-01–11 passed; see [final evidence](../../docs/status/p4-u1b-3-evidence.md).

Parent: [P4-U1b — Tenant onboarding configuration](p4-u1b-tenant-onboarding-configuration.md).
The parent owns shared behavior, ONB-01–03 and AC-01–11. This child owns explicit
voice preference and the complete browser onboarding/credential handoff acceptance.

## Goal and starting state

The operator creates a draft, finds/resumes it, saves organization/geography/voice
configuration, hands off initial-administrator setup, and reloads canonical state.
Credential exchange can finish while the tenant remains draft and ordinary staff
sign-in stays denied. Voice preference is independent of live readiness.

Start after verified
[P4-U1b-1](p4-u1b-1-resumable-registry-editing-and-contacts.md) and
[P4-U1b-2](p4-u1b-2-service-area-and-default-intake-coordinates.md).
Consume their actual contracts/evidence, not speculative DTOs or test substitutes.
Recheck completed P4-U1a/P2-U4/Phase 3 prerequisites and the
[approved credential policy](../../docs/planning/p2-u4a-credential-contract-review.md),
[implemented lifecycle](../../docs/architecture/qualified-credential-lifecycle.md)
and [draft registry](../../docs/architecture/draft-tenant-registry-api.md).
The detail already has an administrator issuer panel; reuse it.

## Decisions and dependencies

ONB-01/02 must be resolved and verified in children 1/2. Apply ONB-03's approved
writable-status/field policy to voice saves, including status races. Do not infer
permission for active-tenant voice changes. P2-U4's approved purpose, eligibility,
verification, expiry, single-use, disclosure, budgets and recovery policies remain
authoritative; this child does not reopen them or approve general tenant lifecycle.

## Scope and expected result

- Add tenancy-owned persisted voice preference with explicit **not configured**,
  **voice enabled** and **voice disabled** states. Existing tenants and new
  P4-U1a drafts start not configured; missing data is not opt-out. Only an explicit
  operator choice records enabled/disabled. Add necessary additive migration,
  constraints, safe DTOs and runtime grants without inventing PBX allocations.
- Provide working voice choice/save/detail presentation. Use child 1's protected
  versioned section commands, atomic required audit/receipt, consistent locks,
  conflict/retry semantics and owner/target-bound work. Preserve geography,
  contacts, original administrator and credential actions. Invalid enum, forged
  lifecycle, readiness, allocation and PBX-binding fields reject server-side.
- Compose the full saved detail with separate lifecycle, voice, geographic/contact
  completeness and safe credential/action state. Missing configuration remains
  explicit. Voice saves cannot apply PBX state, teardown routes, run calls,
  declare readiness, activate a tenant or create ordinary staff sessions.
- Keep setup attached to immutable receipt-linked tenant-qualified administrator
  provenance. Unavailable provenance stays unavailable; no username/role lookup
  may guess the target. Reuse the existing issuer, recipient and status consumers.
- Refresh safe credential status after exchange/explicit reload while preserving
  unrelated mounted configuration edits. Initial setup requires eligible unset
  credentials; ready-draft recovery follows the approved linked reset path.
  Status/role/issuer/target changes, suspended/retired/disabled targets, expired or
  used/cancelled actions and outstanding-action conflicts retain existing outcomes.
- Retain person-verification/handoff acknowledgment for every issue/reissue.
  Contact edits do not establish verified identity or an automatic delivery
  channel. One-time codes clear on uncertainty/access or owner loss/unmount and
  never enter ordinary DTOs, URLs, browser storage, edit receipts, logs or retained
  configuration. Operators never choose or receive passwords.
- Keep configuration-write recovery separate from credential recovery. Lost
  issuance uses safe status plus explicit verified reissue; lost exchange stays
  uncertain and follows P2-U4's recovery. No automatic code or password replay.
  A failed setup operation leaves previously committed configuration intact.
- Deliver integrated operator guidance and handoff contracts. P4-U2/U3 consume
  canonical voice preference and their own allocation/readiness/lifecycle gates;
  P5-U4/U5 consume the verified geography read boundary. Neither this UI nor a
  controlled active-tenant fixture establishes operator activation or intake.

Retain the parent's exact-origin/trusted-source/platform-cookie/CSRF, shared budgets,
no-store/passive reads and canonical mutation fencing. Use shared dark UI and
accessible independent section feedback. Add only named forwarding consumers and
necessary safe returns; never a generic proxy. No general staff administration,
new credential mechanism, external delivery service, live Asterisk or lifecycle UI.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01 | New and existing drafts display not configured. Explicit enabled/disabled choices save and reload across replicas, remain distinct from lifecycle/readiness and preserve other sections. Reject unknown/missing-required enum and forged readiness/PBX/status input under ONB-03.                                              |
| C-02 | Real A/B version/status/authority races, audit/receipt failures and concurrent/lost-response attempts preserve one atomic voice change with usable explicit recovery. No stale overwrite, automatic retry, foreign-operator attempt adoption or duplicate audit.                                                               |
| C-03 | Real production HTTPS operator-to-recipient setup/exchange updates only the linked administrator and safe credential status, preserving saved and unrelated unsaved configuration. Exercise ready-draft recovery, invalid provenance/target/role/status, action expiry/reuse/cancel/reissue and shared limits.                 |
| C-04 | Issuance/exchange uncertainty follows approved credential recovery; codes/passwords never persist or leak. Access/owner/target switches, unmount and delayed callbacks clear disclosures and isolate nonsecret work. Contact fields cannot bypass human verification or trigger delivery.                                      |
| C-05 | Ready and unset draft administrators both receive `Invalid credentials` on ordinary staff sign-in and no ordinary session. Configuration, credential exchange and voice opt-out confer no activation, allocation, live apply, tenant voice readiness or route teardown.                                                        |
| C-06 | Combined browser create → search/filter → resume → edit contacts/geography/voice → setup/exchange → refresh passes with P4-U1a immutable code/provenance/replay preserved. Negative authority/forgery/outage/conflict paths and keyboard/focus/320–1440px states pass across all sections.                                     |
| C-07 | Reconcile every parent AC-01–11 using children and final integrated evidence. Focused API/browser/combined checks, existing registry/credential/session/platform/identity regressions and final `./dev check` pass. Publish operator/downstream contracts, exact commands/results/limitations/cleanup and final tracker state. |

Owns parent AC-04/07/08 and integrated AC-01–11. Extend the focused selector from
child 1; record actual implemented flags. Required regressions include
`./dev exec pnpm check:draft-tenant`,
`./dev exec pnpm check:staff-auth --lifecycle`, affected identity/session/platform
procedures and `./dev check`. Use real migrated PostgreSQL/PostGIS/runtime grants,
shared Redis, independent HTTP replicas and production Next/private HTTPS.
No live Asterisk calls or new native-device acceptance is required here; fixtures
cannot prove downstream operational readiness or production HA.

## Completion and handoff

Complete child 3 only after C-01–07 pass, both prior children remain verified,
parent AC-01–11 are reconciled and combined P4-U1a/b onboarding evidence passes.
Only then may P4-U1b and parent P4-U1 be marked complete. Record reproducible
commands, environment, cleanup, limitations and remaining Phase 4 work.
P4-U2 allocation/routing, P4-U3 lifecycle, P4-U4/U5 administration and the Phase 4
gate remain incomplete until their own criteria pass.
