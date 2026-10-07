# P4-U1a-2 — Operator browser creation and integrated handoff

## Identity, state and requirement

- **Unit:** P4-U1a-2, second sequential child of P4-U1a.
- **Status:** complete; B-01–08, child 1 A-01–08, parent AC-01–11 and required checks verified 2026-10-07 16:00 +08:00 (Asia/Manila). See [completion evidence](../../docs/status/p4-u1a-2-evidence.md).
- **Requirement:** [parent spec](p4-u1a-draft-tenant-creation-and-initial-administrator.md) and [P4-U1a delivery plan](../implementation-plan.md#p4-u1a--create-a-draft-tenant-and-its-first-administrator).
- **Goal:** Give the operator the protected browser create/list/detail journey with explicit retry recovery and complete parent verification.
- **Dependencies:** verified [P4-U1a-1 API/database workflow](p4-u1a-1-atomic-draft-creation-and-protected-registry-api.md), delivered P2-U3b browser access/work isolation and P1-U4 UI. Recheck child 1 evidence/contract before starting.
- **Result:** The operator creates and revisits a real saved draft through the console, recovers validation/uncertain responses safely, and preserves mounted work only for the same canonical operator.

Follow the parent and [project workflow](../ai-workflow-rules.md). This child
includes the integrated P4-U1a acceptance checkpoint; it does not implement
credential setup, activation or the remaining onboarding configuration.

## Starting state and scope

Child 1 supplies verified backend create/list/detail consumers, canonical
validation, receipt replay/conflict semantics and linked administrator IDs.
P2-U3b supplies protected server composition, exact-origin cookie/CSRF transport,
`ConsoleAccess`, `useOperatorWork()`, private ingress and safe return handling.
P1-U4 supplies shared accessible dark UI primitives and platform navigation.

Allowed changes: platform console tenant routes/navigation, list/form/detail
components, explicit Next forwarding consumers, delivered-form state integration,
shared transport types only where required, browser/integrated checks, operator
instructions and evidence. Backend changes are limited to fixes required by the
verified contract, with child 1 regressions rerun; do not expand its scope.

Exclude edit/search/filter/contact/geographic/voice features (P4-U1b), credentials
(P2-U4), lifecycle actions (P4-U3), PBX work, general staff management, browser
calling, public intake and durable unfinished-draft storage.

## Browser journey and presentation

1. Add **Tenants** to the protected platform navigation. List canonical organizations with name, normalized code, lifecycle status and detail action. Provide pagination using child 1's bounds and stable ordering.
2. Show loading, empty and retryable error states. Empty state offers **Create tenant**. A read failure cannot look like a successfully empty registry.
3. Show a focused creation form with labelled **Tenant code**, **Organization name**, and **Administrator username** fields. Explain permanent code, draft status, and later credential setup/activation.
4. Validate with the same field grammar/bounds as child 1. Preserve values, render safe field/global errors, focus the first invalid field and prevent repeated clicks while pending. Client validation grants no backend authority.
5. **Create draft tenant** submits the exact DTO. Confirm only 201/new or 200/confirmed replay, then show the canonical saved detail.
6. Detail shows organization name/code/status, linked administrator username/role/account/credential state and **Credentials not set** for the new draft. Explain ordinary staff sign-in remains unavailable. No setup/edit/activate/voice action is delivered here.
7. Refresh, navigate away/back or open a valid detail link: read the saved canonical state through the protected backend. Missing data or unavailable administrator provenance has explicit presentation.

Reuse tokens and shared primitives, readable text badges, semantic tables/forms,
keyboard navigation, visible focus, accessible feedback and responsive reflow.
Review desktop, tablet/narrow widths and zoom. Do not expose request receipt
internals, database technology or implementation-unit IDs in product UI.

## Named forwarding and protected composition

Extend the existing narrow Next boundary with only child 1's named create/list/
detail methods and bounded parameters. Verify the private ingress/proxy contract,
trusted client source, canonical cookie channel and exact mutation Origin/CSRF.
Forward no arbitrary URL, role/actor header, bearer override or backend secret to
the browser. NestJS authorizes every request; `authorize()` is presentation gating,
not a replacement for backend guards. Use `no-store` for protected data and
server rendering. No Next database connection or second identity/session store.

Allow safe local returns for delivered tenant list/create/detail paths only.
Validate the actual accepted path grammar; deny external/scheme-relative URLs,
encoded bypasses and sign-in loops. Preserve existing platform return behavior.
401/403/429/503 flow through existing access handling with bounded Retry-After.
Render 400 field errors and 409 conflict messages distinctly from access loss.
Never turn an unavailable backend read/write into a successful page/result.

## Attempt lifecycle and uncertain outcomes

Keep form values and attempt context in owner-bound mounted memory. Generate one
UUID for each logical submission; canonical retry semantics remain backend-owned.

| Event | Browser behavior |
| --- | --- |
| First explicit submission | Capture input/attempt under the currently rendered canonical owner; disable repeated submission while pending. |
| Definitive validation or conflict | Preserve editable fields and safe errors. A changed submission uses a fresh UUID. |
| Network response loss or unavailable/uncertain creation | Retain the original UUID and submitted values. Offer explicit retry of that attempt; show no success without confirmation. |
| User edits after an uncertain outcome | Keep the original attempt recoverable. Resolve it before creating a replacement attempt, so editing cannot conceal an already committed draft. |
| Explicit retry of an uncertain attempt | Send the original UUID and original canonical-equivalent input. A 200 replay opens the original linked draft; no new creation claim. |
| Confirmed save | Release finished form/attempt state and navigate to the saved canonical resource. |
| Refresh/process loss | Unfinished memory may disappear; saved drafts remain visible through canonical list/detail. Do not promise cross-refresh input recovery. |

Do not automatically replay writes on reconnect, reauthentication, mount or
visibility restoration. A database receipt supports explicit retry; it does not
justify an automatic browser retry loop. List/detail reloads must also respect
Retry-After and cannot renew sessions through passive background activity.

## Canonical owner and session recovery

Reuse `useOperatorWork()`/`ConsoleAccess` and minimally extend their typed state
for this delivered form. Bind values, request UUID, captured uncertain input and
async callbacks to the backend-validated operator ID. Keep no passwords/tokens/
CSRF secrets or form values in localStorage/sessionStorage.

Before submission, use the existing presentation authorization flow, then call
the protected backend consumer. On protected access error, call the existing
access rejection path: hide/inert the workspace, release protected overlay focus
traps and block further submissions. Non-secret work stays mounted in memory.

Same-canonical-operator reauthentication restores values and attempt context for
explicit continuation. A different identity or confirmed logout clears them and
remounts the shell. Late reads/mutation responses from the old owner cannot
repopulate work, navigate the new owner's session or display an old result.
If an old owner's write committed before authority changed, its durable draft
remains canonical; only a newly authorized list/detail read may present it later.
No callback may infer owner equality from username alone.

Post-success activity can reload deadlines through passive authorization, using
the existing contract. Passive session polling must not defeat expiry and token
rotation must not extend absolute lifetime. Preserve existing protected dialog,
logout uncertainty and reauthentication behavior.

## Acceptance and integrated checks

| ID | Criterion | Parent coverage |
| --- | --- | --- |
| B-01 | Real HTTPS operator uses navigation, creates a draft, sees canonical saved detail/list and refreshes/revisits it. Verify linked administrator states and audit in PostgreSQL. | AC-01, AC-08 |
| B-02 | Invalid identifiers, bounds and unknown transport fields fail safely. Browser preserves inputs, shows/focuses errors and handles duplicate code. Distinct tenants can reuse the administrator username. | AC-02, AC-03 |
| B-03 | Pending lock prevents duplicate clicks. Inject committed response loss; explicit original-attempt retry opens one saved pair without duplicate audit. Changed input cannot conceal an unresolved attempt; no automatic replay. | AC-05, AC-06 |
| B-04 | Direct Next forwarding rejects absent/foreign-plane sessions, forged proxy/source/actor/role data, invalid Origin/CSRF and arbitrary destinations. Backend authority and child 1 race checks still pass. | AC-07 |
| B-05 | Expiry/Redis outage hides and blocks form/overlays. Same-owner reauthentication restores inputs/attempt; identity switch/logout and delayed callbacks cannot transfer work/results. No write resumes automatically. | AC-09, AC-06 browser |
| B-06 | Bounded pagination, unavailable read, missing detail, unavailable creation provenance and canonical reload have clear states; stale protected data is not served from caches. | AC-08 |
| B-07 | Keyboard/focus/zoom/reflow and status feedback pass. Browser/client/log scans reveal no credential material, protected proxy secrets or verification fixtures. Draft screen grants no setup/session/activation/PBX capability. | AC-10, AC-11 |
| B-08 | Rerun child 1 A-01–08, relevant platform/identity/session/audit regressions and final full check. Evidence maps every parent AC and guides specify later handoff/limitations. | AC-01–11, including AC-04 backend rollback |

Implemented and verified commands: `./dev exec pnpm check:draft-tenant --browser` for this
boundary and `./dev exec pnpm check:draft-tenant` for combined child/parent checks.
Both selectors passed, exit 0. The [browser contract](../../docs/architecture/draft-tenant-browser.md) documents actual selectors; include the combined check
in the owning required check graph and run final `./dev check`.

Use production Next output in a controlled HTTPS browser harness that accepts
Secure cookies, real provisioned synthetic operator credentials, primary
PostgreSQL with runtime grants, real session Redis and two independent HTTP
processes. Exercise real forwarding and fault controls; do not substitute mock
API success for the integrated create journey. Fixtures and TLS controls prove
their declared local boundary, not production hosting/HA or real staff sign-in.
Retain existing auth/browser/safe-return regressions and record exact fixture
cleanup, commands, results and limits. Runtime results and limitations are recorded in [completion evidence](../../docs/status/p4-u1a-2-evidence.md).

## Completion and downstream handoff

Complete this child and P4-U1a only when B-01–08, child 1 A-01–08, parent AC-01–11
and required checks pass. Update evidence, tracker, docs index and operator guide
with a simple way to try the workflow and its actual supported recovery lifetime.

Hand off canonical tenant ID/code and tenant-qualified administrator ID/username
through safe authenticated detail contracts. P2-U4 owns the credential delivery,
expiry/recovery and draft setup decision; P4-U1b owns its later onboarding UI
integration. Credential setup does not activate a tenant. P4-U3 owns activation
and readiness gates, including the explicit voice-disabled path. Parent P4-U1
and Phase 2 remain incomplete until their separate required work is verified.
