# P2-U4a credential lifecycle — review for approval

Prepared 2026-10-07, Asia/Manila (+08:00). **Approved 2026-10-07, Asia/Manila (+08:00).**
The user approved all recommended decisions and instructed implementation to continue.
Requirement: [P2-U4a](../../context/feature-specs/p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md),
with [parent G-01–06](../../context/feature-specs/p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md#decision-gates-before-dependent-implementation).

Sections **1–6** resolve the six product gates under the user’s approval. Section 7
records the implementation contract to verify. Approval itself does not claim runtime completion. P2-U4a subsequently completed
A-01–08 and full Docker verification; see [evidence](../status/p2-u4a-evidence.md).
Existing bootstrap, session,
ordinary admission and sign-in limits retain their scoped approvals.

The proposed result is an issuer handing a one-time code to a verified person,
who chooses their own password. Successful exchange replaces credentials and
invalidates every previous session. A draft tenant stays draft and receives no
ordinary staff access.

## 1. G-01 — Who may initiate setup and recovery

All staff targets are canonical `{tenantId, staffId}`. Operators select the initial
administrator through the immutable draft-creation receipt, never by username,
role alone or row order. Staff issuers require a current active-tenant session with
`tenant_admin` and the existing `tenant.manage` grant. Operators require their
current platform session and a narrow lifecycle use case under the existing
`platform_operator` authority; neither receives a new broad permission bundle.

| Issuer | Tenant | Qualified target | Allowed action |
| --- | --- | --- | --- |
| Platform operator | Draft | Receipt-linked initial admin; active account, exactly `tenant_admin`, unset credentials | Initial setup |
| Platform operator | Draft | Same linked admin; active account, exactly `tenant_admin`, ready credentials | Verified recovery/reset, including a lost exchange response |
| Platform operator | Active | Same linked admin; active account, includes `tenant_admin`, unset credentials | Initial setup |
| Platform operator | Active | Same linked admin; active account, includes `tenant_admin`, ready credentials; sole active credential-ready admin | Verified last-admin recovery/reset |
| Tenant admin | Active, same tenant | Another active staff account with valid approved roles and unset credentials | Staff setup |
| Tenant admin | Active, same tenant | Another active staff account with valid approved roles and ready credentials, including another admin | Staff reset |
| Any issuer | Suspended or retired | Any staff account | Denied |
| Any issuer | Any state | Disabled account, foreign target, malformed authority or unqualified provenance | Denied |

Self-issuance is denied. A sole administrator uses the qualified platform recovery
path; it does not reset itself through its staff session. Setup applies only to
unset credentials; reset applies only to ready credentials. There is no reset to
unset, role change, disablement, impersonation or tenant activation.

For active-tenant platform recovery, “sole admin” means exactly one account is
active, credential-ready/coherent and has `tenant_admin`; that account must be the
receipt-linked target. If another such admin exists, that admin provides recovery.
An unset/disabled admin is not counted as an available recovery administrator.
If the last eligible admin is not the linked initial admin, or no eligible admin
exists, this release denies platform recovery; another product decision is needed.
This restriction preserves provenance and avoids general platform staff access.

Count/revalidate recovery eligibility under the tenancy authority lock and
compatible identity owner locks. Participating role/status/credential changes must
serialize with this predicate so concurrent changes cannot bypass it. Revalidate
issuer authority at issue, reissue, cancellation and exchange. An issuer becoming
disabled, losing its role, changing its authentication version, or its tenant
becoming ineligible invalidates an outstanding capability. Ordinary session expiry
alone does not invalidate a previously authorized capability; no issuer session
needs to remain open for the recipient to use it.

**Decision:** approve this matrix, including denial of self-reset and the limited
receipt-linked last-admin recovery boundary, or specify revisions.

## 2. G-02 — Credentials while draft

Permit the receipt-linked draft administrator to set credentials before activation.
Permit verified reset of that same ready draft administrator so an uncertain or
lost exchange can be recovered without activating the tenant. This ready-draft
reset is an explicit addition to the parent's proposed initial-setup exception and
needs approval with section 1.

Both issue and exchange require the matrix above. The target's account, roles,
credential state and tenant authority must remain valid and version-matched.
A change from draft to active invalidates an outstanding draft capability; an
issuer must explicitly issue a new action under the current state.

The exchange creates no ordinary session and cannot alter tenant status, roles,
PBX, extensions or readiness. Ordinary draft admission continues to deny even
with ready credentials. The operator detail shows tenant code, username and
credential state, and explains that activation is a separate action.

**Decision:** approve draft initial setup and narrowly linked draft recovery with
no ordinary access, or identify which draft action should be denied.

## 3. G-03 — Staff password policy

Apply the bootstrap policy to staff setup/reset: **15–128 Unicode code points,
at most 512 UTF-8 bytes**, with spaces and Unicode allowed and no composition
requirement. Reject malformed Unicode, NUL and line breaks. Preserve exact bytes:
no trimming, case changes or Unicode normalization. Backend validates the policy;
the recipient UI also requires an exact matching confirmation. Operators and
staff issuers never choose or receive the recipient's password.

Reuse the private established scrypt format and bounded hashing infrastructure.
Busy hashing capacity or hash/dependency failure is retryable unavailable and
leaves the action unconsumed. Passwords and confirmation are cleared on success,
owner loss, navigation/unmount and uncertain submission. A validation error may
retain them only in the mounted recipient form; never persist them.

**Decision:** approve these staff password bounds and exact-byte semantics.

## 4. G-04 — Capability lifetime, replacement and revocation

- Setup expires **24 hours** after committed issuance; reset/recovery expires
  **30 minutes** after committed issuance. PostgreSQL time decides expiry;
  equality with the deadline is expired.
- Use a purpose-bound opaque code from 32 cryptographically random bytes. Store
  only its hashed lookup and minimal qualified authorization metadata.
- Allow **one outstanding action per target across all issuers and purposes**.
  Initial issue conflicts if an unexpired outstanding action exists. Explicit
  reissue atomically cancels it and creates a new action; the old code then denies.
- An issuer who currently qualifies under sections 1–2 may cancel/reissue an
  existing action for that target, including one created by another qualified
  issuer. Reissue uses current eligibility and purpose; it does not replay the old
  authorization. Repeated cancellation of a known terminal action is harmless.
- Issuance, reissue and cancellation leave the current password and sessions
  unchanged. **Only successful exchange invalidates previous sessions**, by
  atomically incrementing canonical authentication version with credential
  replacement, single-use consumption and required audit.
- Every exchange is a replacement and advances the version, even if the person
  chooses the same password. Concurrent consumption has at most one success.
  Credential/role/account/tenant authority changes invalidate stale actions.

A code is disclosed once after confirmed issuance commit; listings contain only
safe action metadata. Lost issuance response requires explicit authorized reissue.
The server cannot redisclose a code, and the browser never stores it durably.
A lost exchange response is **uncertain**, with no automatic password-write retry.
An authorized issuer may inspect safe canonical credential/action status; it
cannot recover the password. If completion is still unclear or the recipient
needs replacement, verify the person again and explicitly reissue the currently
eligible setup/reset action. For draft-ready targets, section 2 provides reset.

**Decision:** approve these lifetimes, single-action/reissue rules and revocation
at successful exchange rather than at issuance.

## 5. G-05 — Person verification and secure handoff

Before issue or reissue, the authorized issuer must verify the intended person:

1. Match the person's organizational record to the displayed tenant code and
   username. Confirm administrator authorization against an existing organization
   contact/authorization record, rather than contact details supplied solely by
   the requester.
2. Verify identity in person, or through a live call to a previously established
   organizational contact. An unsolicited email/message alone is insufficient.
3. Hand the code directly in person or through the organization's existing
   approved encrypted private channel to that verified person. If no such channel
   is available, use in-person handoff. Do not send it by ordinary email/SMS,
   public chat or a link containing the code.
4. The recipient opens the separately supplied clean HTTPS exchange address and
   types/pastes the code plus their own password and confirmation.

The issuer UI requires an explicit verification/handoff acknowledgment for every
issue/reissue. Store only a finite verification-method code and issuer attribution;
do not collect identity documents, contact details, call recordings or free-text
verification notes. The acknowledgment records the issuer's attestation; software
cannot prove that the human verification occurred.

Platform last-admin recovery additionally verifies the organization's authorized
representative using its established contact record. Lack of an established
record blocks that handoff until the operator establishes it outside this feature.
No new email/SMS/delivery service or public self-service recovery is introduced.
Never paste passwords/codes into support reports. Response-loss recovery follows
section 4 and repeats verification before a new disclosure.

**Decision:** approve this verification and handoff procedure or name the procedure
and secure channel your organization requires.

## 6. G-06 — Abuse budgets and retention

Propose independent shared session-Redis counters in fixed UTC-aligned
**900-second windows**, applied before target/capability lookup and hashing.
Administrative counters run after canonical issuer authentication and alongside
existing protected-HTTP limits. Web/native or replica changes cannot add allowance.

| Operation group | Source allowance | Other independent allowances |
| --- | --- | --- |
| Issue/reissue, including recovery | 60 attempts / window | 20 / canonical issuer; 5 / qualified target |
| Cancel | 60 attempts / window | 20 / canonical issuer; 10 / qualified target |
| Public exchange | 60 attempts / window | 10 / hashed capability lookup |

Source uses existing trusted socket/proxy extraction. Issuer keys include the
plane and canonical ID, with tenant ID for staff. Target keys include tenant and
staff IDs; known and unknown targets use the same path. Purpose and issue/reissue
are not separate allowances. Public exchange derives its capability key from the
bounded opaque code without resolving its target. No account-existence signal is
returned. Keys use hashed identifying material and never appear in diagnostics.

All dimensions are charged atomically up to saturation, including denied and
failed downstream operations, with no refund. Denials do not extend windows.
429 returns a generic response and `Retry-After` of 1–900 seconds until every
exhausted dimension resets. Redis/dependency/counter-capacity failure returns
retryable 503 with `Retry-After: 1`; no local fallback or automatic write replay.
Reuse bounded allocation registries with at most 8,192 active counters per
operation group. Count source/issuer/target dimensions within that group ceiling.
Finite malformed-input rejection happens before identity-derived allocation/hash
work. Fixed windows permit a boundary burst of twice the allowance; shared NAT
clients can exhaust the source budget. Production traffic/capacity validation
remains required; existing sign-in/protected budgets are unchanged.

Retain capability rows until **30 days after terminal transition or expiry**,
whichever first makes the action unusable. Consumption/cancellation sets the
terminal timestamp; otherwise expiry supplies the retention start. Retain the
minimal purpose, qualified target, issuer/method, versions, deadlines and state;
never plaintext code/password. Missing deleted actions still deny exchange.
Use an explicit bounded identity cleanup operation (1–100 eligible rows per
transaction), with required system audit of removed count. No new scheduler or
unsolicited purge workflow. Required audit events retain existing append-only
retention; this proposal does not delete audit or creation provenance.

**Decision:** approve these exact budgets/counting, fixed-window behavior and
30-day capability retention, or supply replacement values.

## 7. Implementation and acceptance after approval

This section records technical choices within the feature boundary. It does not
substitute for approval of sections 1–6. Before runtime work, record the user's
approved sections/revisions in [D-05/D-06 product contracts](p1-u1-product-contracts.md#5-d-05--credentials-and-administrator-safeguards),
synchronize the parent/child specifications and resume the tracker.

Proposed named consumers:

| Consumer | Backend route | Authority |
| --- | --- | --- |
| Initial-admin issue / reissue | POST `/platform/tenants/:tenantId/administrator/credential-actions` with explicit `operation` | Platform cookie, existing operator grant, linked target/matrix |
| Initial-admin status | GET `/platform/tenants/:tenantId/administrator/credential-actions` | Same platform authority; safe metadata only, passive |
| Initial-admin cancel | POST `/platform/tenants/:tenantId/administrator/credential-actions/:actionId/cancel` | Same platform authority/matrix |
| Staff issue / reissue | POST `/staff/credential-actions` | Explicit staff cookie, `tenant.manage`, same-tenant target/matrix |
| Staff action status | GET `/staff/credential-actions/:actionId` | Same staff authority/qualified ownership, passive |
| Staff cancel | POST `/staff/credential-actions/:actionId/cancel` | Same staff authority/qualified ownership |
| Recipient exchange | POST `/credential-actions/exchange` | Capability-only public consumer, declared Origin/CSRF protection |

Issue DTO contains only explicit `operation: 'issue'|'reissue'`,
`purpose: 'setup'|'reset'`, and finite `verificationMethod: 'in_person'|'known_contact_call'`;
staff issuance also contains UUID `tenantId`/`staffId`. Platform target is resolved
from provenance; no client-selected staff ID. Cancel accepts an empty body.
Exchange accepts only `capability` and `password`; target and purpose come solely
from stored authorization. UUID action IDs identify safe management metadata and
are never exchange secrets. Bound the body to 4096 bytes and reject unknown fields.

Recipient form lives at a dedicated `/credentials` page in the command-center
application. Declare exact trusted HTTPS Origin/proxy settings independently of
future staff sign-in. Use a short-lived signed HttpOnly/Secure/SameSite forgery
context and context-bound CSRF header through named bounded same-origin Next
forwarding. This context grants no staff session/authority. Reject conflicting
session/bearer channels, missing or foreign Origin/CSRF and unsafe forwarding.
Administrative mutations reuse their explicit session channels and session-bound
CSRF; all protected and exchange responses are uncached. Verify actual HTTPS
operator/recipient/browser composition, not only HTTP fixtures.

Errors: 400 bounded validation, generic 401 `Invalid capability` for invalid,
expired, consumed, cancelled, stale or wrong-purpose exchange; 401 authentication
required for issuer session loss; 403 access/plane/Origin/CSRF denial; 404 generic
missing authorized management resource; 409 bounded ineligible-state or outstanding
conflict; 429/503 as section 6. Never include target identity in public exchange
errors. Public success returns only confirmed completion, with no session token.

Use owner ports for tenancy status locks, identity target/issuer locks and platform
provenance. Follow a common deterministic lock order compatible with existing
tenant-before-staff locks; serialize sole-admin eligibility with participating
owner mutations. Hash outside long-held locks, then revalidate issuer/target
versions, purpose, state and expiry at commit. Consume, replace coherent
credentials, advance versions and append required audit on one poisoned
transaction/connection; success requires confirmed outer commit.

Audit authenticated issuance/cancellation as the canonical issuer. Record recipient
consumption as a finite system actor such as `identity.credential-exchange`, with a
capability-exchange reason and safe qualified action/issuer attribution; never
invent an authenticated recipient principal. No password, token, lookup hash,
raw identity input or verification-document data enters audit/logs/artifacts.
Use existing audit conventions with narrowly allowlisted metadata.

Acceptance remains [A-01–08](../../context/feature-specs/p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md#acceptance-and-verification):
real draft create/detail/issue/recipient path; hostile qualification and expiry;
independent A/B exchange/reissue/cancel/status races; required SQL/audit rollback;
lost responses; all-device canonical invalidation including restored stale Redis;
Origin/CSRF, owner isolation, accessibility and bounded secrets. The tenant-admin
issuer uses controlled existing-session fixtures until b/c deliver actual staff
sign-in; document that limitation. Finalize the provisional lifecycle selector,
run relevant identity/audit/session/platform/draft regressions and `./dev check`,
and publish evidence, guide, runbook and b/c handoff before claiming completion.
