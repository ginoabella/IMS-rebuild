# P2-U4c — Command-center and mobile access with isolated recovery

## Status and purpose

- **Status:** planned; split adopted 2026-10-07 (Asia/Manila, +08:00).
- **Requirement:** [P2-U4 parent and AC-01–12](p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md).
- **Goal:** deliver actual tenant-staff browser/native access and preserve unfinished command-center work safely through expiry and same-owner reauthentication.
- **Completion boundary:** issuer/recipient setup/reset, browser staff sign-in/protected shell/logout, native protected token use/storage and isolated expiry recovery work through the real a/b adapters; all parent acceptance passes.

## Starting state and scope

Require verified [a](p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md)
and [b](p2-u4b-staff-authentication-http-and-transport-boundaries.md), including G-01–06
approval, actual draft setup UI and secure HTTP transport probe. Recheck evidence
and actual DTO/proxy/CSRF/source contracts; read mandatory context before coding.
Reuse P1-U4 shared primitives and P2-U3 owner/epoch recovery patterns with qualified
staff identity rather than platform ownership.

Allowed changes: command-center server/proxy composition, exactly three-field
sign-in UI, protected role-aware shell, logout/error/retry and retained mounted-work
handoff; actual tenant-admin setup/reset issuer integration with real staff login;
minimal responder-mobile authentication/protected-storage consumer, tests and guides.
Necessary a/b integration fixes preserve their approved security contracts and
receive targeted regressions. No new policy, identity/session store, activation,
PBX, staff-management workflow, dispatch, durable incident drafts or public intake.

Native OS/device evidence must use a declared reachable HTTPS and protected-storage
configuration. Do not silently weaken TLS or change the broader P6-U1 device product
scope. Missing device/origin configuration holds only dependent work; complete
independent browser work and record native resume conditions without claiming c or
parent completion.

## Browser delivery

Use server-side canonical checks for protected pages, route handlers/actions and
forwarding. Shell/navigation visibility cannot replace backend grants. Ordinary
tenant administrators receive only approved tenant-admin authority; no implicit
incident/dispatch permission. Staff and platform applications keep distinct cookie,
channel and owner contexts even if a deployment hosts both.

Sign-in fields are exactly Tenant code, Username, Password. Preserve nonsecret
values through validation, clear password safely, prevent duplicate submissions,
show generic `Invalid credentials`, bounded throttling and retryable unavailable
states. Use safe local return paths and no-store protected responses. Forward only
named b consumers with bounded headers/bodies; never a generic backend proxy.
Actually prove Secure cookie acceptance, exact Origin, proxy source, CSRF context
replacement and backend bypass protection in the delivered Next HTTPS composition.

Expose a's approved tenant-admin issuer UI through real protected staff access;
qualify every action by backend canonical tenant and target. Preserve operator
initial-admin setup provenance and recipient exchange contracts. A real draft
administrator may set credentials only under approved policy and still receives
`Invalid credentials` at ordinary sign-in. Controlled active fixtures enable access
acceptance without an activation screen or a production readiness claim.

Logout/retry UI distinguishes confirmed revocation from unavailable/uncertain
outcomes. Confirmed logout clears owner work, UI state and browser credential;
uncertainty blocks protected interaction and offers the declared explicit retry.
Browser back/cache, delayed responses and duplicate clicks cannot restore authority.
No automatic setup/password/operational write replay after sign-in or reconnect.

## Isolated unfinished-work recovery

Key mounted retained work by canonical `{tenantId, staffId}` from validated session
metadata. Typed identifiers, username, cookie presence and rotating session IDs do
not establish ownership. Capture an owner/epoch with each callback and discard
results when the epoch/owner changes. Block expired submissions server-side as well
as in UI, including in-flight stale forms and late callbacks.

On expired/unavailable/unknown authority, hide protected values, dismiss or hide
protected dialogs and release focus while retaining appropriate mounted nonsecret
values for possible same-owner recovery. Reauthentication by the same qualified
owner restores work; different staff or same username in another tenant clears it.
Explicit logout clears work even if the next login is the same person. Credential
reset requires fresh authentication and owner checks before exposing retained work.

Use a non-shipping incident-form fixture to prove retention and submission blocking.
Actual server-persisted incident drafts belong to P5-U4. Do not promise refresh,
crash, process-loss or offline durability; document mounted-state limits. Polling,
heartbeats, page visibility and open apps never keep a session alive. Preserve
approved lifetimes and original absolute deadline during renewal/rotation.

## Native delivery and protected storage

Build a minimal actual Expo responder-mobile authentication consumer, sufficient
for sign-in, passive canonical session check/protected request, restart retrieval,
expiry handling and logout. No assignments, operational data or responder-profile
eligibility flows. Consume only b's explicit HTTPS bearer channel; do not use web
cookies or capability exchange as an ordinary session.

Store tokens through an Expo-compatible OS protected-storage adapter, never
AsyncStorage/plain files/URLs/deep links. Define bounded token reads/write/delete,
locked/unavailable-device behavior, interrupted storage writes, stale callback/
identity replacement, process restart and credential-version invalidation. Keep
storage namespace and owner state explicit; never adopt a leftover token solely
because local metadata says signed in. Validate current canonical authority before
showing protected content after restart.

A failed protected-storage write must not leave authenticated UI or plaintext
fallback. Clear in-memory authority and use b's explicit orphan-session revocation/
reconciliation procedure; unresolved revoke failure remains uncertain. Rotation or
replacement cannot extend original absolute lifetime; failure cannot leave the app
using a revoked token. Confirm server logout before claiming revocation; delete
local token and owner work, and handle failed deletion by quarantining local access
and explicit retry rather than resurrecting authority. Expiry/reset blocks use even
if protected storage retains a now-invalid token. No silent write replay on reconnect.

Prove real OS storage behavior and authenticated transport on the declared device
or emulator matrix; a JS mock/build only proves its stated port/compilation boundary.
Record platform/OS/app build, storage availability behavior and restart/logout
procedure without token artifacts. Device diagnostics, analytics, screenshots,
exceptions and logs must contain no token/password/capability.

## UI, failures and documentation

Use shared dark tokens/components on web, readable mobile styling, semantic labels,
keyboard/focus/reflow, adequate touch targets, accessible status and reduced-motion
behavior. Keep retry/error messages useful without revealing identity existence or
internal details. Preserve nonsecret values appropriately; secrets are not retained
in draft recovery or persistent app/browser storage except the protected mobile
session token.

Publish staff access and setup/reset guides, operator verified-person handoff guide,
transport/proxy/native storage contract and recovery runbook. Document exact
commands, configuration prerequisites, owner-bound retention limits, uncertain
logout/storage recovery, draft denial and activation ownership. Synchronize docs
index/tracker and parent acceptance with reproducible safe evidence.

## Acceptance and verification

| ID | Required proof | Parent coverage |
| --- | --- | --- |
| C-01 | Actual operator draft creation/setup and recipient exchange integrate with a. Actual tenant-admin login reaches its approved issuer surface; foreign tenants/roles/planes deny. Draft credential setup retains draft and actual sign-in denial. | AC-01–03 integrated; AC-02 consumer |
| C-02 | Production Next HTTPS command center signs distinct tenants with same username into canonical owners; protected shell/server/actions use b channels, CSRF/origin/source/no-store and safe returns. Browser back and cross-plane channels grant nothing. | AC-05/07 consumer |
| C-03 | Browser logout/retry on B revokes A, clears owner work only under correct lifecycle behavior and preserves another device; reset/role/account/tenant changes deny stale web/mobile use. Lost responses/outages never falsely confirm or replay. | AC-04/09 consumer; AC-11 recovery |
| C-04 | Real browser form fixture retains mounted values after same-owner expiry/reset reauthentication, hides them while unknown and clears for foreign staff/tenant or logout. Late callbacks and expired submissions deny; no password/capability retention. | AC-10 browser |
| C-05 | Actual declared native device/storage consumer signs in, uses token on B, retrieves safely after restart and validates canonical owner; browser/mobile channel confusion and plaintext/log/URL leakage deny. | AC-08 transport/storage |
| C-06 | Native storage locked/failure/interrupted write/replacement/logout deletion and orphan revocation paths keep authority blocked until safe recovery; reset invalidates retained tokens. Confirmed logout revokes server and cleans storage without stale callback resurrection. | AC-08 failures; AC-09 native |
| C-07 | Browser/native approved idle/absolute lifetimes hold; passive polling/open app does not renew, rotation cannot extend deadline and outages do not reconstruct sessions or replay writes. | AC-10 integrated; AC-11 |
| C-08 | Setup/reset/sign-in/logout/expiry/retry screens and guides meet labels/focus/keyboard/reflow/touch/status criteria; actual issuer handoff is usable and no secret enters client diagnostics/artifacts. | AC-11 UI |
| C-09 | A-01–08, B-01–09, C-01–08 and every parent AC-01–12 pass; full required regressions/Docker checks, documented native evidence and guides/runbooks/index/tracker are complete with honest limits. | AC-12 full parent |

Use real PostgreSQL/runtime grants/Redis, two production HTTP processes, production
Next HTTPS and actual native protected storage. Exercise real staff sign-in and
issuer workflows; a fixture issuer cannot substitute for completed browser access.
Isolated active fixtures do not establish activation. Use deterministic barriers/
clock controls for races/deadlines and safe controlled outages/response loss.

Provisionally use `./dev exec pnpm check:staff-auth --browser`, `--mobile`, and
combined `./dev exec pnpm check:staff-auth`; commands/selectors are not yet established.
Native device procedures may be separate required evidence rather than a Docker
command. Record actual procedures/results, rerun a/b and relevant identity/session/
platform/draft checks, and final `./dev check`. Link/consistency/coverage/whitespace
checks suffice only for documentation preparation.

## Completion and next handoff

Complete c/parent only when C-01–09 and AC-01–12 pass, including native storage
acceptance. Record unresolved configuration/device failures and resume conditions;
independent browser verification does not mark parent complete. Phase 2 additionally
requires its combined two-replica isolation/shared-session gate and recovery guides.
Hand later Phase 3/4 and P5/P6 units canonical staff access, tested owner-recovery
integration and explicit mounted/native limitations. Activation, durable drafts,
full responder journeys and production readiness remain with their owners.
