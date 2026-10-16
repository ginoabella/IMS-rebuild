# P3-U2c — Operator inventory browser and integrated handoff

## Status and purpose

- **Status:** completed 2026-10-16 within the user’s conditionally approved private development scope; C-01–07 and parent AC-01–11 passed. See [final evidence](../../docs/status/p3-u2c-evidence.md).
- **Requirement:** [P3-U2 parent journey and AC-01–11](p3-u2-extension-inventory-and-endpoint-profiles.md).
- **Goal:** deliver the real platform inventory/profile/credential workflow with trustworthy passive registration presentation and safe operator recovery.
- **Completion boundary:** the secure browser completes individual/bulk/profile/edit/credential/disable journeys through canonical backend authority, and all parent criteria reconcile against integrated evidence. Saving still establishes no live apply or tenant voice readiness.

Read [AGENT.md](../../AGENT.md) and its required context before implementation.
The parent owns shared policy and gates. Screens and integration tests cannot
approve a missing credential handoff or expand PBX permissions.

## Starting state and gates

Require verified [a](p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md)
and [b](p3-u2b-protected-endpoint-credential-lifecycle-and-recovery.md), including
real-service evidence, bounded safe APIs, immutable intents, profile/credential
versions and approved lifecycle decisions. Reuse the P3-U1
[browser](../../docs/architecture/pbx-browser.md) and
[observation](../../docs/architecture/pbx-observation.md) contracts and shared UI.

Parent G-03 was conditionally resolved by the user on 2026-10-16 before dependent mapping and controlled acceptance; its recorded conditions remain mandatory.
The conditionally approved [runtime mapping and controlled acceptance review](../../docs/planning/p3-u2c-observation-mapping-contract-review.md)
is conditionally approved by the user on 2026-10-16; its recorded preservation, exclusive-access, baseline, recovery and cleanup conditions apply. Required decisions:
exact node/installation/runtime endpoint identities, unmanaged namespace collision
handling, supported registration coverage and access to isolated controlled
observations. Recheck the approved G-01 profiles and G-02 credential action/delivery
contracts; do not invent defaults to fill a screen. The user-supplied
[reference](../../reference/asterisk_config/) informs compatibility, not canonical
ownership or permission to overwrite running endpoints. Preserve it unchanged.

## Scope and ownership

Own platform-console pages/features and narrow forwarding for the existing APIs,
passive backend inventory-to-observation composition, operator-bound mounted
unfinished-work handling, focused browser/integration checks, guides and combined
evidence. Compose owner interfaces rather than change a/b semantics for the UI.
Document any necessary compatibility change before implementing it and rerun its
owning checks.

No tenant reservation/allocation/staff assignment UI, browser calling, secret
reveal, raw configuration upload/export, compiler/apply/reload, or new observer.
HTTP/browser reads never issue AMI commands or start per-request PBX connections.
Do not add sockets or browser-storage drafts for this journey.

## Browser journey

1. **Inspect inventory:** choose the canonical PBX and open bounded paginated list/detail views. Show canonical number, SIP/WebRTC kind, selected profile/version, enabled/disabled desired state, ownership availability, safe credential status and independent observation/freshness. Expose clear empty/loading/error/retry states.
2. **Create individually:** choose a compatible approved profile and number, validate and save. A committed extension remains unallocated; credentials may be unset. Show the exact canonical result and saved desired status, without a ready/registered claim.
3. **Create in bulk:** enter supported bounded input, review the deterministic canonical number set/kind/profile and commit one immutable intent. Explain actionable validation/collision errors without silently skipping numbers. Commit revalidation may reject a previously valid preview; preserve permitted values for review.
4. **Manage profiles and desired edits:** create/version/select profiles through a's approved APIs. Make affected-resource/version information visible; editing a shared profile cannot silently update selected versions. Reload/review stale conflicts instead of overwriting. Keep node/number identity immutable.
5. **Manage credentials:** run b's approved setup/reset, show safe operation/generation status and uncertain-result recovery. State that a saved reset awaits live application; it has not disconnected a phone or invalidated its old runtime password. No material enters form drafts, URLs, DOM, storage or telemetry under the current contract.
6. **Disable/re-enable:** submit expected-version actions and retain number/history. Show desired disabled separately from runtime registration. Do not describe a desired disable as immediate PBX disconnection or release of ownership.

Available means unallocated platform inventory. Reserved/allocated/assigned facts
must come from future canonical owners when delivered; do not provide writable
status selectors or fabricate those states from fixtures. No tenant calling,
assignment or credential access is granted by registration or profile choice.

## Observation composition and coexistence

Use an exact approved inventory-to-runtime mapping qualified by canonical node/
installation identity; a number match alone is insufficient. Internally generated
endpoint/auth/AOR keys are not user-entered routing fields. Unmanaged reference
endpoints, public ingress and trunks remain unmapped. Never create inventory or
infer a tenant from observations, caller IDs or contacts.

Compose bounded inventory pages with P3-U1's shared projection. Preserve node
desired version, epoch, sequence, current ownership, coverage, reconciliation and
age semantics; use the existing backend freshness authority. Only a fresh complete
covered snapshot can establish observed presence/absence. Partial/unsupported,
stale/historical, disconnected or ownership-lost data cannot be displayed as an
authoritative unregistered/healthy/ready fact. A reachable node with zero dynamic
contacts differs from unknown coverage. Registration is not verification of the
selected desired/profile/credential generation.

Show last-observed age/status and desired changes independently. A profile or
credential save must not relabel old registrations as evidence of the new
configuration. Node reconfiguration must not reuse observations from an obsolete
node version/ownership epoch. Unknown observations remain explicit after reload;
PBX outage must not make valid inventory/profile management unavailable when its
own database/session dependencies remain healthy.

Controlled acceptance inspects that saved inventory did not install a usable
endpoint/route. Use approved isolated observation fixtures for positive registered
and unregistered cases; record exactly how they map without enabling production
calling or importing reference ownership. New saved inventory need not register
before P3-U5 exists. Live target evidence and injected snapshot faults must be
reported separately; fixtures alone cannot prove actual Asterisk observation.

## Authority, uncertainty and recovery

Every backend/proxy request uses current canonical platform authority. Use named,
narrow same-origin forwarding; reject arbitrary upstream paths and user-selected
roles/tenant IDs. Preserve existing cookie/channel/CSRF/origin/no-store and
safe-error behavior, including direct backend requests. Staff, expired/revoked
sessions and shared-session outages deny protected operations on both replicas.
All reads are passive and cannot renew a session through polling.

Bind mounted permitted input, previews and immutable mutation intents to the exact
canonical operator and workflow instance. Prevent duplicate submissions. After an
ambiguous response, offer an explicit same-intent retry or canonical reload/review
using a/b receipts. A changed form or bulk preview requires a new reviewed intent;
never automatically replay on reconnect or reauthentication. Stale edits need
canonical reload/review; unchanged input does not authorize overwriting a newer
version.

Expiry hides protected values and blocks submissions. Same-operator recovery may
restore retained non-secret mounted work explicitly; a foreign operator cannot
see it. Confirmed logout clears it. No durable refresh recovery is promised and
no browser storage or server draft store is introduced. Secrets never become
recoverable UI work. Approved recipient handoff, if G-02 changes this boundary,
requires synchronized parent/c contracts before dependent implementation.

## UI and accessibility

Use existing dark tokens and shared primitives with readable compact forms and
tables. Keep primary actions/errors and critical status visible; show text rather
than color alone. Support keyboard navigation, visible focus, semantic labels,
accessible bulk preview/error/result announcements and deliberate dialog focus
return. Preserve allowed form values on validation/conflict. Reflow list/detail,
bulk review and profile forms at desktop/tablet/narrow widths and zoom without
hiding warnings or forcing avoidable page-wide horizontal scrolling.

## Acceptance and required verification

| ID | Observable result/check | Parent coverage |
| --- | --- | --- |
| C-01 | Actual secure browser completes list/detail, individual SIP/WebRTC creation, bulk preview/atomic commit, profile management/selection/adoption if offered, desired edits and disable/re-enable through real APIs. Validation/conflicts preserve safe input; exact results and independent desired states are visible. | AC-10 journey; AC-02–04 integration |
| C-02 | Approved setup/reset/status works through the browser without secret output or automatic replay. Duplicate/uncertain operations resolve to b's canonical generation; saved reset/disable does not claim live revocation/readiness. | AC-05 integration; AC-10 credentials |
| C-03 | Controlled Asterisk observation maps exact trusted endpoints only. Registered/unregistered/empty coverage, unmanaged identifiers, stale/historical/disconnected/partial data and old node epochs/versions present correctly; desired changes cannot turn observations into readiness. No live endpoint/route is installed by save. | AC-08; AC-07 live-save boundary |
| C-04 | Real sessions on HTTP A/B enforce platform-only backend/proxy/page authority, CSRF/origin/channel/no-store and narrow forwarding. Staff/forged/revoked/expired access and session-store outage deny; passive reads do not renew. PBX-only outage leaves safe desired management usable. | AC-06; AC-08 outage |
| C-05 | Same-operator mounted expiry recovery, foreign identity isolation, logout clearing, changed-intent rejection, stale-edit review and uncertain bulk/reset responses pass without auto-replay or browser storage. Sentinel scans exclude secrets/raw configuration from rendered output, client bundles, URLs, recovery state and diagnostics. | AC-09/10 recovery |
| C-06 | Keyboard/focus/labels, bulk error/status announcements, loading/empty/error/retry and desktop/tablet/narrow/zoom layouts pass on actual screens using shared tokens. Availability/disablement/credentials/readiness/registration are distinct and understandable. | AC-10 accessibility/status |
| C-07 | Integrated parent AC-01–11 and child A/B/C matrices reconcile, affected PBX/auth/durable regressions and full Docker graph pass. Safe evidence, operator guide, owner contracts, index and tracker record exact commands/results, real versus injected checks, gates/limits and cleanup. | AC-01/07/09/11 integrated |

The implemented `./dev exec pnpm check:extension-inventory --browser` selection
and combined `./dev exec pnpm check:extension-inventory` procedure passed; exact
commands and outcomes are recorded in the [final evidence](../../docs/status/p3-u2c-evidence.md). Use real
PostgreSQL/runtime grants, shared Redis, independent HTTP A/B, the existing secure
platform browser environment and controlled Asterisk passive observation. Exercise
race/response-loss paths through their real owner APIs with deterministic faults.
Run a/b focused checks, documented affected PBX/auth/durable regressions, applicable
shared UI checks and `./dev check`; record actual commands and outcomes.

Missing controlled observation, approved credentials or required browser evidence
keeps c/parent incomplete. Document exact fixture ownership, remove only owned
test records/material and restore touched acceptance processes without changing
shared tenant routes. Documentation preparation requires consistency, coverage,
local links and whitespace only.

## Parent completion and later-unit handoff

Complete c and parent P3-U2 only when C-01–07 and every parent criterion pass,
with a/b evidence still valid. Record remaining Phase 3/P4 work explicitly:

- P3-U4 consumes safe endpoint/profile identities and dependency checks; it owns route/group semantics and generated tenant contexts.
- P3-U5 consumes exact profile/credential generations, protected runtime access and retention dependencies. It owns default-deny rendering for unallocated inventory, external fencing, live install/reload/verification, rollback and credential revocation proof.
- P4-U2/P4-U5 consume canonical unallocated stock and explicit eligibility; they own exclusive allocation, verified readiness, live tenant isolation and staff assignment rejection. P3-U2 fixtures are not that proof.
- P8-U8 owns any browser calling client and approved short-lived endpoint access; this administration journey delivers no calling credentials.

No P3-U2 completion establishes live apply/recovery, tenant voice readiness,
operational calling, production capacity or the Phase 3 gate.

## Approved b handoff boundary — 2026-10-16

The [conditionally approved G-02 review](../../docs/planning/p3-u2b-credential-contract-review.md)
authorizes safe asynchronous setup/reset/status and exact immutable intent recovery;
it authorizes no phone delivery, reveal or password-entry browser contract. b uses
opaque generation/operation IDs, separate material health and retained history;
configured desired state is not live activation/revocation. b has passed real B-01–07 acceptance within private development; c may consume
that verified API/intent handoff. c passed C-01–07 and parent AC-01–11 under conditionally approved G-03 within private development.
