# P4-U1b-1 — Resumable registry editing and contacts

**Status:** Complete within approved private development, 2026-10-27 09:23
(Asia/Manila, +08:00). A-01–07 passed under approved ONB-01/03, including real
A/B API/HTTPS browser, affected credential/session regressions, full `./dev check`
(exit 0), ordinary HTTPS refresh and data preservation.
[Final evidence](../../docs/status/p4-u1b-1-evidence.md).

Parent: [P4-U1b — Tenant onboarding configuration](p4-u1b-tenant-onboarding-configuration.md).
The parent owns shared behavior, ONB-01–03 and AC-01–11. This child owns registry
search/filter and versioned name/contact editing through the actual browser.

## Goal and starting state

An authenticated platform operator finds a saved draft, opens its canonical detail,
edits its name and approved organizational contacts, and reloads committed values.
The immutable code, original administrator and draft access restrictions survive.

Start from completed P4-U1a, P2-U4 and the scoped Phase 3 gate. Recheck the
[registry API](../../docs/architecture/draft-tenant-registry-api.md),
[browser recovery](../../docs/architecture/draft-tenant-browser.md) and
[credential lifecycle](../../docs/architecture/qualified-credential-lifecycle.md).
Reuse existing list/detail/creation, tenancy's versioned rename, canonical platform
sessions, transaction/audit, protected admission and shared UI. A repository rename
method alone does not establish this operator workflow.

## Decisions and dependencies

Parent ONB-01 and ONB-03 were explicitly resolved by the user for this child’s
name/contact workflow on 2026-10-26 (+08:00). The
[parent’s approved policy](p4-u1b-tenant-onboarding-configuration.md#approved-onb-0103-policy--2026-10-26-0800)
owns the contact fields, limits, clearing and draft-only writes. Search/read work
remains independent. ONB-02 belongs to child 2 and remains unresolved. Approval of
the split alone did not approve the recommendations; the subsequent explicit user
policy approval authorizes this implementation.

## Scope and expected result

- Extend the named list consumer and `/tenants` with trimmed, case-insensitive
  literal code/name search and exact lifecycle filter. Parameterize and escape
  wildcard input, bound queries and result sets, retain stable UUID pagination
  (25 default, 100 maximum), and preserve the unfiltered API. Reset cursors when
  criteria change; ignore delayed results from older criteria/owner captures.
- Extend canonical detail and `/tenants/<UUID>` with name/contact fields and
  explicit section saves. Preserve existing safe administrator metadata and issuer
  panel. Missing provenance remains unavailable; never select a replacement admin.
- Validate the name using existing trim and 1–200 UTF-16-unit bounds. Apply approved
  contact limits and omitted/clear semantics. Codes, lifecycle, administrator,
  roles, credentials, geography and voice cannot be mutated through these commands.
- Tenancy owns organization/contact persistence. Platform coordinates through
  narrow owner ports. Add only necessary contracts, additive migrations, indexes
  and least-privilege runtime grants; preserve existing drafts and creation receipts.
- Commit each section's changes, row version, required canonical-actor audit and
  retry outcome on one transaction/connection. Preserve unrelated fields. Keep
  authority versions unchanged for ordinary configuration edits, with P2-U4
  compatibility checks. Recheck operator, target status and expected versions
  before commit; use established lock ordering and bounded waits.
- Establish the parent's durable edit-attempt/reconciliation convention for all
  children. Bind attempt to operator/target/section/expected versions/input; reject
  changed input and foreign adoption. Same-attempt concurrency produces one change
  and audit. Audit or receipt failure rolls back all attempt writes. Keep these
  receipts separate from immutable creation provenance and free of contact values.
- Preserve input on validation/conflict. Uncertain outcomes retain the captured
  attempt for explicit original retry/reconciliation; no automatic mutation replay.
  A recovered earlier result must not overwrite later canonical edits. Distinguish
  saved, unsaved, pending, conflict, failed and uncertain presentation.
- Use canonical operator plus tenant UUID and epoch to fence mounted work/results.
  Same-owner reauthentication retains only nonsecret work; logout/owner switch
  clears it. Target switches cannot transfer form values, pending attempts or
  delayed callbacks. Access loss hides protected work/focus. Refresh restores
  committed data, not unsent edits.

All reads/writes retain the parent's platform-cookie/permission, trusted source,
Origin, mutation CSRF, no-store and shared-budget boundaries. Reads stay passive;
actual saves use approved operational activity. Document exact named methods,
DTOs, body/query bounds and error reasons before coding. Contact values are neither
identity verification nor code-delivery authorization; exclude raw values from
logs, audit and receipts. No jobs, delivery service, geography, PBX or activation.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Real HTTPS operator searches code/name, combines all lifecycle filters, paginates and opens/resumes a draft. Verify literal wildcard/Unicode handling, blank/no-match/invalid queries, page bounds and stale-result fencing; omitted filters retain old behavior.                        |
| A-02 | Browser name/contact edits follow ONB-01/03 and reload on another replica. Test requiredness/bounds/clear semantics, explicit incomplete contacts and invalid input retention. Immutable code, forged lifecycle/admin and extra fields reject at backend and Next.                       |
| A-03 | Two real HTTP replicas race stale and different-section saves plus eligibility/authority changes. No lost updates or stale-authority commit; unrelated fields survive. Audit/receipt/write failures roll back with real runtime grants.                                                  |
| A-04 | Concurrent exact-attempt replay and injected lost/uncertain responses produce one logical change/audit. Changed-input/foreign-operator attempts conflict. Explicit recovery distinguishes the original result from later canonical state; no automatic replay.                           |
| A-05 | Absent/expired/wrong-plane/forged authority, CSRF/Origin/source failures and malformed/unbounded requests deny. Database/Redis outage fails closed. Session/owner/target switches and delayed callbacks isolate work; one-time credential disclosure retains existing clearing behavior. |
| A-06 | Actual browser exercises keyboard/focus, errors, loading/empty/conflict/recovery and 320–1440px reflow. Existing administrator panel and P4-U1a create/list/detail/replay remain working with unset credentials and draft admission denied.                                              |
| A-07 | Focused real PostgreSQL/shared Redis/A/B API and production Next/private HTTPS checks, affected identity/platform/session/credential regressions and `./dev check` pass. Publish edit/search contract, operator guidance, commands/results/cleanup and child handoff.                    |

Covers parent AC-01/02 and registry/contact portions of AC-05/06/09/10/11.
Implement the parent's focused API/browser selector and record exact names/flags;
no new selector exists merely because this spec names a required procedure.
Retain `./dev exec pnpm check:draft-tenant` and affected credential coverage.
No mock-only proof satisfies transaction, concurrency or browser claims.

## Completion and handoff

Complete only after A-01–07 pass with reproducible evidence and tracker updates.
Hand child 2 safe canonical detail, configuration version/lock policy, atomic save,
edit-attempt recovery, protected forwarding and owner/target-bound browser patterns.
Leave geography and voice visibly incomplete without inventing default values.
Parent P4-U1b/P4-U1 and operational readiness remain incomplete.
