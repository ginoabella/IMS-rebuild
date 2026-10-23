# P3-U3c — Operator resource browser and integrated handoff

## Status and purpose

- **Status:** planned; child specification prepared 2026-10-16 (Asia/Manila, +08:00), in the user-adopted a → b → c sequence. Application implementation has not started.
- **Requirement:** [P3-U3 parent scope, gates and AC-01–11](p3-u3-trunks-gateways-and-dids.md).
- **Goal:** deliver the authenticated operator journey for trunks, gateways and DIDs, with clear desired-state status, safe validation/conflict/removal recovery and integrated acceptance evidence.
- **Completion boundary:** the real secure console completes create/list/detail/edit/status/removal against a/b's protected backend; browser recovery, accessibility and every parent criterion pass. Desired resource management does not establish routing, live connectivity/apply, tenant allocation or voice readiness.

Read [AGENT.md](../../../../../../AGENT.md) and its required context before implementation.
The parent defines shared policy and scope; c composes verified owners rather than
creating alternate authority, data, credential or dependency services.

## Starting state and dependencies

Require verified [P3-U3a definitions](p3-u3a-protected-trunk-and-gateway-definitions.md)
and [P3-U3b DID/lifecycle](p3-u3b-did-inventory-and-dependency-safe-resource-removal.md),
including actual real-service evidence, stable DTO/routes/errors, expected versions,
creation retry receipts, exact credential-reference boundary, DID normalization
and resource-removal coverage/history/recovery rules. All applicable parent
G-01–04 decisions must be resolved and referenced before consuming their behavior.

Recheck current platform/browser authority and reuse the
[inventory browser contract](../../../../../architecture/extension-inventory-browser.md),
[PBX browser contract](../../../../../architecture/pbx-browser.md), existing secure
Next-to-Nest forwarding, shared UI primitives and mounted operator-bound work
container. Preserve existing PBX/inventory journeys and same-origin session/CSRF
boundaries. c adds no new origin, ingress or authentication store.

No new product decision is needed for routine page/layout/route composition.
If a required field, default, normalization, relationship or removal outcome is
undefined, return to the owning gate rather than deciding it in a browser form.
New credential provisioning/rotation remains outside this child and requires the
parent's conditional split refinement before dependent integration.

## Scope and ownership

Own platform-console resource list/create/detail/edit/status/removal views,
PBX-detail navigation, bounded named forwarding, safe client state, validation/
conflict/uncertainty feedback, mounted recovery, accessibility, operator guide,
combined checks and parent reconciliation. Extend shared UI only where needed.

a/b remain authoritative for data, normalization, relationships, versions,
credentials, dependencies and mutations. Next handlers parse/forward allowed
transport only; pages never query PostgreSQL, access provider material, connect
to Asterisk, trust submitted authority or implement alternative business rules.

No raw-config/secret editor, browser persistence, tenant allocator, route/group
builder, live test-call/apply/rollback control, new observation collector or
unsupported trunk registration/health dashboard. P3-U4/U5/P4 retain those later
capabilities. Preserve reference files and existing controlled PBX resources.

## Required operator journey

1. From an authorized PBX detail page, open the canonical node's resource area. Show bounded/paginated trunk, gateway and DID lists, navigation to details and clear empty/loading/unavailable states. Keep the current node visible.
2. Create a trunk with the approved typed settings and safe reference selection. Preserve valid non-secret fields when validation fails; do not offer unsupported modes or material-entry/reveal controls.
3. Create a gateway using eligible canonical relationships under G-01, then a DID using eligible ingress and G-02 number input. Show canonical saved values after success; rejected input stays available for correction.
4. Open details and edit permitted settings or desired status using the version actually reviewed. Revalidate stale selections server-side; provide reload/review for conflicts without silently replacing entered work.
5. Request desired removal of a DID, gateway or trunk. Show affected resource, retained-history meaning and known blockers. Confirm the reviewed action explicitly; backend rechecks version/dependencies. Explain unknown safety coverage and safe retry/review. Never offer forced cascade, automatic detach or tenant ownership clearing.
6. Return to current canonical detail/list after a confirmed result. Preserve the original safe outcome separately from a fresh canonical read where retries return immutable receipts. Explain that saved/disabled/removed desired state is pending later live configuration work.

Show distinct desired state, safe reference availability, dependency result and
passive node health. Existing endpoint contact coverage cannot prove trunk
registration, gateway reachability or DID readiness. Do not render invented
applied/live/ready badges from a successful save or infer zero calls from PBX
outage. Source blockers from b rather than approximating them from visible lists.

## Forwarding and access contracts

Enumerate exact method/resource combinations for trunk/gateway/DID lists,
creation, details, versioned edits/status, approved safe selections and removal.
Reuse a/b DTO names and finite error reasons. Bound canonical UUIDs, query keys,
page size/cursors, body size, response stream and error details before forwarding.
A catch-all adapter, if used, dispatches this allowlist only; it is not an arbitrary
backend proxy. Reject unknown methods/paths/fields and unsafe destinations.

Existing backend guards validate current platform authority on every protected
read/write. Preserve exact HTTPS Origin, trusted proxy peer, cookie channel,
CSRF and no-store rules at each hop. User-selected node/resource IDs are targets,
never authority. Staff/public, revoked/expired and forged-ownership requests reject.
No sensitive data enters shared web caches, prefetch output or public pages.

Reads are passive and cannot renew sessions, start observers or trigger mutations.
Database/session outage denies work with safe retry copy; PBX-only outage leaves
safe desired management available while unknown removal safety still blocks.
Do not expose raw exceptions, provider paths, credentials or raw Asterisk text.

## Mounted work and uncertain results

Reuse mounted non-secret work bound to canonical operator, node, resource and
workflow identity. Keep editable fields, reviewed versions/selections, immutable
creation attempts and explicit uncertainty state qualified by authority/workflow
epoch. Fence late completions after navigation, expiry, logout, identity switch
or replacement workflow; old results cannot populate another operator/resource.

Authority loss hides/inerts protected values and blocks writes. Explicit
same-operator sign-in can restore mounted safe work. Confirmed logout or foreign
identity clears it; full refresh/process loss has no durable-draft guarantee.
Store no work in localStorage/sessionStorage, URL parameters or server drafts.
Do not retain secrets or renew sessions through polling.

For uncertain creation, lock the original payload/intent and offer explicit exact
same-intent retry or canonical review. Changed input requires deliberate resolution
of the uncertain attempt before a new intent; an error does not prove rollback.
For uncertain edits/status/removal, require explicit canonical reload/review before
another action, using b's qualified recovery for an exact removal outcome. Never
silently retry an altered payload, delete a replacement identity or replay writes
on sign-in, refresh, reconnect or passive data load.

A stale-version or dependency conflict preserves safe unsaved fields but marks
them for review against current canonical state. Clearly distinguish rejected,
confirmed saved, still unknown and currently unavailable outcomes. Expired intents
follow a/b's safe recovery guidance; no automatic fresh key.

## Interface and accessibility

Use shared dark CSS tokens, typography, form/table/dialog primitives and text
status labels from the [UI context](../../../../../../context/ui-context.md). Keep compact desktop
scanning and narrow-width reflow without clipped controls or hidden errors.

Provide labels/help for approved modes and relationships, accessible field/error
summaries, announced asynchronous results, visible keyboard focus and deliberate
focus return after confirmation or validation. A blocker list is readable with a
keyboard/screen reader and indicates bounded/truncated detail. Status color alone
is insufficient. Distinguish loading/empty/error/conflict/uncertain states without
clearing mounted work. Browser constraints assist entry; backend validation is
still authoritative.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| C-01 | Verified a/b evidence and resolved applicable gates precede integration. Actual browser supports trunk/gateway/DID list/create/detail/edit/status and eligible removal, canonical navigation, validation preservation and bounded blocker feedback. | AC-01/02/03/05/06/09 integration |
| C-02 | Actual secure proxy/API reject wrong-plane, expired/revoked, forged, wrong-node, unsupported-path/method/field and CSRF/origin/channel violations across two HTTP replicas. Body/result/query limits and no-store/passive reads hold; database/Redis/PBX-only outages have distinct safe behavior. | AC-07/08/10 |
| C-03 | Lost creation responses preserve immutable intent/payload and explicit recovery. Stale/uncertain edits/status/removal require canonical review; duplicate or delayed responses cannot clear/change unrelated work, adopt a new version silently or remove a replacement. No automatic replay or fresh intent after uncertainty/expiry. | AC-04/05/09 |
| C-04 | Real browser same-operator reauthentication restores safe mounted work; expiry hides it and denies writes; foreign identity/confirmed logout clears it. Authority/workflow epochs reject late callbacks. Full-refresh limits, absent browser persistence and passive session behavior match existing contracts. | AC-07/09/10 |
| C-05 | Keyboard/focus/labels/error/status announcements, shared dark tokens, zoom/narrow-width reflow and loading/empty/unavailable/conflict states pass actual-browser review. Desired/reference/dependency/node-health states stay distinct; no unsupported live claims or secret controls. | AC-08/09/10 |
| C-06 | Secret sentinels/provider paths/raw configuration are absent from browser output, forwarding/errors, URLs, assets, recovery state and backend audit/receipts. Desired operations make no PBX/credential/call effects; offline PBX never implies safe removal. | AC-06/08/10 |
| C-07 | Combined real-service checks reconcile every parent AC-01–11, rerun a/b integrity checks and affected PBX/inventory/auth/durable regressions, then pass the full Docker graph. Guides/contracts/index/tracker/evidence record commands, limits, ownership/cleanup and later-unit handoffs. | AC-11; final AC-01–10 reconciliation |

## Required checks and evidence

During implementation establish the proposed browser selection
`./dev exec pnpm check:pbx-resources --browser` and combined
`./dev exec pnpm check:pbx-resources`; neither exists or has a passing result yet.
The combined command must include a/b correctness checks and this real browser
journey, not merely build/typecheck or mocked screenshots. Record actual commands
and runtime prerequisites before claiming completion.

Use real PostgreSQL/runtime grants, shared Redis, two independent HTTP replicas,
the actual secure Next/Nest browser path and browser accessibility checks. Exercise
eligible real resource removal, actual owned dependency rejection and defined
unknown-coverage rejection; future allocation/revision/call fixtures remain port
checks only. Run real provider checks only if the approved reference contract
requires that boundary; simulator results cannot prove unavailable integration.

Use controlled fault fixtures/barriers for lost responses and concurrency; label
what was injected. Run affected existing documented PBX/inventory/platform auth/
durability procedures and `./dev check`. Check credential leakage with owned
sentinels without printing material. Remove only owned fixtures, preserve existing
PBX/configuration/secrets/data and record cleanup limitations. CRUD verification
requires no live calls, reload, new PBX permissions or production changes.

Retain criterion-by-criterion a/b/c and parent results, exact environment,
commands/exit codes, real-versus-fixture boundaries, unresolved failures and safe
cleanup in implementation evidence. Documentation preparation itself requires
consistency/link/whitespace checks only and establishes no runtime pass.

## Completion and handoff

Parent P3-U3 completes only when the actual browser journey and all parent
criteria pass. a/b completion cannot substitute for c; c screens cannot substitute
for real data integrity and safe-removal proof. Missing required decisions/access/
checks keep the affected child and parent incomplete.

Publish the resource contract and operator guide explaining desired saves,
validation/conflicts, uncertain results, dependency blockers, credential reference
limits and unavailable/live states. P3-U4 receives canonical resource IDs/versions
and relationship/dependency ports; P3-U5 receives reproducible desired state and
retained references, with separate approval for compiler/apply/rollback. P4 owns
allocation/routing verification/readiness; no tenant becomes voice-ready here.
