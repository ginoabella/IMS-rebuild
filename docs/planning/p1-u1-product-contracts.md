# P1-U1 proposed product contracts

**Partial approval recorded.** D-01 and the scoped D-05/D-06 eligibility/admission
contract were approved for P2-U1b on 2026-10-05 (Asia/Manila, +08:00), with creator
closure as stated below. Other behavior remains a recommendation.
Existing architecture invariants remain mandatory. Decisions and unit gates are
listed in the [foundation review](p1-u1-review-draft.md).

## 1. D-01 — Permissions

Approved fixed roles `tenant_admin`, `call_taker`, `dispatcher`, `responder`: one
to four distinct roles, any nonempty combination, no duplicates/custom/platform
roles. Separate tenantless operators have `platform_operator` authority.
Fixed permission bundles combine only within the canonical tenant. See the
[approved P2-U1b review](p2-u1b-contract-review.md). Grants
combine only within the account's tenant. Tenant administrator authority does not
implicitly grant dispatch or closure of another creator's incident. Backend authorization is decisive.

| Action | Platform operator | Tenant admin | Call taker | Dispatcher | Responder |
| --- | --- | --- | --- | --- | --- |
| Shared PBX infrastructure and tenant registry/lifecycle | Yes | No | No | No | No |
| Staff/roles, categories, responder profiles, tenant extensions | No | Own tenant | No | No | No |
| Operational incident queues/details/timeline | No | Only with operational role | Own tenant | Own tenant | Assigned incident's operational subset |
| Own intake drafts; create incident | No | Only with call-taker role | Yes | No | No |
| Edit open incident and correct saved location | No | Only with operational role | Yes | Yes | No |
| Dispatch, cancel assignment | No | Only with dispatcher role | No | Yes | No |
| Close incident | No | Creator, or with dispatcher role | Creator | Own tenant | Creator |
| Accept/progress/complete assignment | No | Only with responder role | No | No | Own assignment |
| Set own availability/share own foreground position | No | Only with responder role | No | No | Yes |
| Set another responder's availability | No | Yes, audited reason | No | Yes, audited reason | No |

Incident closure is permitted for the canonical staff creator without requiring
an additional dispatcher role, and for dispatchers within their tenant. Both paths
remain subject to D-02/D-03 closure-state, outstanding-work, audit and other
safeguards. This grant approval does not approve those later safeguards. No
platform impersonation is approved.
Responders receive required dispatch details, not the tenant's full incident list
or unrestricted reporter/audit data. Exact mobile field disclosure must be approved
before P6-U1. Evidence, recording and recovery permissions remain later gates.

## 2. D-02 — Incident states and closure

Recommend canonical incident states `open` and `closed`; expose assignment progress
separately rather than inventing duplicate incident progress states.

| Command | Starting condition | Result |
| --- | --- | --- |
| Create from draft | Valid tenant-owned draft and enabled category | One open incident; draft marked converted atomically |
| Edit/correct location | Open incident, authorized actor, current version | Version increments; timeline and audit retained |
| Close | Open, creator or dispatcher permission, no nonterminal assignment, closure reason | Closed with actor/time/reason |
| Repeated close | Same idempotency key and payload | Original success; no duplicate history |
| Reopen/edit closed | Closed | Reject; reopening deferred pending separate approved requirement |

Closure may occur with no assignments, with a required reason (for example,
resolved without dispatch). Outstanding work must first be completed or cancelled.
Closing does not implicitly cancel work. Preserve history and references; no hard
delete. A stale write reports conflict with canonical reload while preserving
unsaved input. Same idempotency key with different payload rejects as conflict.

## 3. D-03 — Assignments and responder eligibility

Recommend one active assignment per responder, multiple responders per incident,
and no concurrent nonterminal duplicate of the same incident/responder pair.
Eligibility requires active tenant, open incident, active same-tenant staff account
with responder role and linked active responder profile, declared availability,
and no nonterminal assignment. A socket connection or GPS permission is not an
eligibility requirement. Online/offline delivery state must remain visible.

| Transition | Actor | Conditions |
| --- | --- | --- |
| New → `assigned` | Dispatcher | Eligibility checked in transaction; audit and notification outbox commit together |
| `assigned` → `accepted` | Assigned responder | Current version and active authorization |
| `accepted` → `en_route` | Assigned responder | Explicit progress action |
| `en_route` → `on_scene` | Assigned responder | Explicit progress action |
| `on_scene` → `completed` | Assigned responder | Required completion summary |
| Any nonterminal → `cancelled` | Dispatcher | Required reason; retain progress history |

Recommend no rejection state or responder reassignment command initially: responder
requests assistance/cancellation from dispatch; dispatcher cancels then creates a
new assignment. User review should decide whether field rejection is required.
Terminal states are completed/cancelled. Skipped, reversed and terminal transitions
reject. Exact retries return the committed result; stale/different commands conflict.
A concurrent dispatch race permits only one winning assignment for a responder.
No terminal command automatically closes the incident. Store declared availability
(`available`/`unavailable`) independently; effective eligibility includes active
work, so completing a job does not override a responder's unavailable declaration.

## 4. D-04 — Categories and priorities

Recommend tenant-owned categories with required trimmed name, unique normalized
name per tenant (including disabled entries), optional description, enabled flag,
and version. Admins create/rename/disable/re-enable; referenced categories cannot
be hard-deleted. New incidents and category changes require an enabled same-tenant
category. Unchanged historical references remain valid when disabled. Preserve
category label at incident creation plus the canonical reference for historical
interpretation. No globally seeded taxonomy until approved.

Recommend required explicit priority: `critical`, `high`, `normal`, `low`; no
silent default. These are operational ordering labels, with critical first and
oldest creation first within a priority. No automatic SLA, escalation, category
inference, or responder preemption. Call takers/dispatchers may change open-incident
priority with a reason and audit. User should approve local priority meanings and
any different vocabulary before P5-U4/P5-U6.

## 5. D-05 — Credentials and administrator safeguards

**Partial approval, 2026-10-05 (Asia/Manila, +08:00):** the user approved
P2-U1a account vocabulary `active`/`disabled`, credential vocabulary
`unset`/`ready` and the associated
[storage rules](../architecture/canonical-identity-storage.md). Unset requires
no hash/change timestamp; ready requires both; creation has no state defaults.
That scoped handoff permitted a's persistence constraints. The user subsequently
approved b's eligibility: active account plus coherent ready credential, valid
authority and positive versions, independently in each plane. The
recommendations below, authentication, password policy,
setup/reset tokens, sessions and bootstrap execution remain pending for their
owning units. P1-U1 remains deferred.

Recommend lowercase trim normalization for tenant code and username, preserving
password input exactly. Staff login remains exactly tenant code, username,
password; all invalid identity/status combinations return `Invalid credentials`.
Passwords use approved secure hashing; no password is generated into logs/audit.

Recommend administrator-mediated setup/reset for the first release. Platform
operators initiate the initial tenant-admin setup; tenant admins initiate staff
setup/reset. Use single-use opaque token exchange in the frontend, with no token
in a URL, log or audit. An authorized issuer receives the token once and hands it
to the verified person via an approved secure out-of-band process; ordinary
account listing never reveals it. Store hashed lookup only; propose 24-hour setup
and 30-minute reset expiry. Reissue invalidates previous token; successful reset
atomically revokes sessions and advances authentication version.

Recommend no email/SMS self-service recovery in the first release. Recovery uses
verified tenant-admin assistance; recovery of the last tenant admin uses a trusted
platform workflow; platform-operator recovery uses a deployment command and a
user-designated operator. Define identity verification and the out-of-band handoff
procedure explicitly before P2-U4; this draft does not assume a delivery service.

Block removal/disablement of the last active credential-ready tenant administrator.
Staff cannot grant platform roles. Propose 30-minute idle/12-hour absolute web
sessions and 24-hour idle/7-day absolute mobile sessions, with server-side canonical
checks and cross-replica revocation as already required. These lifetimes need
review for long command-center shifts. Exact password policy and setup/reset UI
must be approved with this decision before dependent implementation.

## 6. D-06 — Tenant lifecycle

**Scoped approval for P2-U1b, 2026-10-05 (Asia/Manila, +08:00):** ordinary
staff eligibility requires canonical active tenant, active account, ready
credential, valid approved roles and positive versions. Draft, suspended and
retired deny ordinary admission; platform eligibility is tenant-independent.
Missing/malformed authority denies; canonical read failure is unavailable, with
no authority. No draft setup exception, transition/PBX/active-work effects or
session policy is approved by this handoff.

Recommend draft → active; active → suspended; suspended → active; draft/suspended
→ retired. Retired is terminal. Only active tenants admit ordinary staff sessions.
A narrowly scoped setup token can set initial credentials while draft without
providing operational access. Activation requires a credential-ready administrator,
valid defaults, and verified telephony when voice-enabled.

Recommend blocking planned suspension/retirement while nonterminal assignments
or active calls exist; closure/cancellation and call drain happen first. Suspension
revokes sessions immediately at commit; desired routing changes are separately
queued and observed. A failed PBX apply must show failure, never falsely claim
routing disabled. If emergency suspension during active response is needed, it
requires an explicit access/routing/continuity policy before P4-U3. Preserve tenant
history and immutable codes; reactivation does not revive old sessions.

## 7. D-07 — Intake location and drafts

Recommend platform operators configure default coordinates during onboarding;
tenant admins may edit their own default with audit. Store longitude/latitude in
WGS84 and validate finite longitude [-180,180], latitude [-90,90]. Never silently
swap axes. Recommend warning plus acknowledged reason for locations outside the
service area, preserving reports near boundaries. Provider selection and operational
map/search availability remain pending; no public tile/geocoder assumption.

Caller number populates the phone field from trusted call metadata; missing number
is shown as unknown, never fabricated. Missing caller location copies configured
defaults and marks them as default/unconfirmed. Search/double-click replaces the
coordinates; accessible numeric entry provides the same explicit correction.
Incident creation may retain unconfirmed defaults with an explicit warning rather
than losing emergency intake; confirmation requirement needs user review.

Recommend server-persisted drafts owned by tenant and author, autosaved after a
short idle interval, with visible saving/saved/failed status. Refresh restores the
last server-confirmed revision. Do not promise recovery of unsent edits during an
outage; show pending changes and block navigation with an accessible warning.
No cross-user draft editing initially. Version conflicts preserve local input and
require reload/reconciliation, never silent last-write-wins. Conversion is atomic
and idempotent. Draft expiry is deferred until retention is approved; no automatic
purge or expiry is assumed. Exact required reporter/location fields need approval
before P5-U4; allow unknown caller identity where emergency operations require it.

## 8. D-08 — Mobile and foreground position

Recommend Android and iOS responder targets, with supported OS/device versions
chosen before P6-U1. Use explicit user-enabled foreground-only sharing, platform
permission feedback, and clear off/denied/offline/stale states. Location permission
denial does not prevent assignment acceptance/progress. No background tracking.

Propose at most one location observation per 10 seconds while foreground sharing
is enabled and an assignment is active; display stale after 60 seconds without an
accepted update. Store observed/received timestamps, coordinates and accuracy;
reject impossible coordinates and excessive/replayed observations. Reconnect
reloads work; do not replay an offline trail or lifecycle commands silently.
Choose allowed clock skew, precise field disclosure, device test matrix and
location retention before implementation. No retention period is approved here.
