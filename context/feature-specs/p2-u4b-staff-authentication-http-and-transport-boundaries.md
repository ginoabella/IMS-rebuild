# P2-U4b — Staff authentication HTTP and transport boundaries

## Status and purpose

- **Status:** planned; split adopted 2026-10-07 (Asia/Manila, +08:00).
- **Requirement:** [P2-U4 parent and acceptance matrix](p2-u4-tenant-staff-sign-in-and-credential-lifecycle.md).
- **Goal:** verify tenant-qualified credentials and deliver explicitly separated browser-cookie and mobile-bearer staff sessions with shared logout/expiry enforcement.
- **Completion boundary:** real active staff signs in on replica A, accesses a protected staff consumer on B, and signs out with confirmed revocation on A/B. Actual HTTPS browser transport is proven; full command-center/native consumer journeys remain c.

## Starting state and scope

Require verified [P2-U4a](p2-u4a-qualified-credential-lifecycle-and-administrator-handoff.md)
and completed parent foundations. Recheck a's policy approvals, credential format,
capability/forgery contract and credential revocation evidence. Read mandatory
context and reuse canonical staff candidate/private verifier reads, shared
version-bound issuance, guards, trusted sources, distributed admission, durable
fences and P2-U3's bounded password verifier. No fixture issuer becomes a public
staff authentication endpoint.

Allowed changes: staff sign-in/current-session/logout application use cases and
thin HTTP adapters, strict DTOs, explicit cookie/bearer consumer policy, staff
CSRF/proxy/origin wiring, safe error/session DTOs and necessary verifier/owner-port
integration. Preserve existing platform and bearer consumers through focused
regressions. No new identity/session store, capability policy, staff-management
endpoint, activation, browser shell/draft persistence or native storage implementation.

## Credential verification and canonical issuance

Accept exactly tenant code, username, password as identity fields, with bounded
JSON and canonical ASCII normalization/bounds for code/username. Password semantics
follow a's approved staff policy and preserve bytes, spaces, case and Unicode form.
Reject malformed text and unknown role/user/tenant authority fields. Channel/CSRF
metadata is transport, not another identity field; do not accept client lifetime,
role or tenant ID as authority.

Before lookup, private credential reads, hashing or issuance, apply shared sign-in
admission with trusted source and tenant-qualified normalized identity. Approved
independent dimensions are 60/source and 10/identity per 900 seconds, no refund.
Counter keys must distinguish identical usernames in different tenants and both
identity planes. Malformed/source-invalid requests perform no expensive work.

Unknown tenants/users, draft/suspended/retired tenants, disabled/unset/malformed
credentials and wrong passwords deny with `Invalid credentials`. Use equivalent
bounded dummy hash verification for ineligible candidates rather than an obvious
skipped-hash branch; do not promise identical network timing. Verifier capacity
and internal failure return retryable unavailable, not credential mismatch.

Bind successful proof to qualified staff ID and the authentication version of
verified material. Fresh canonical tenant/staff authority at issuance must reject
concurrent reset/disable/role change/suspension and cannot upgrade old proof to a
new version. Construct canonical tenant/user/roles and channel-specific lifetime
server-side, with fresh opaque randomness. No client token adoption, impersonation
or platform-cookie conversion into staff authority.

## HTTP, browser and mobile contract

Define named browser/mobile sign-in, passive current-session, logout and CSRF
bootstrap consumers before coding, with activity/channel/Origin/source/error rules.
All protected/auth responses are uncached `Cache-Control: no-store`. Return minimal
canonical owner/role/expiry metadata; private hashes/version-proof details remain
server-only. Browser and mobile token delivery must not share permissive fallback.

Browser: distinct host-only Secure/HttpOnly staff cookie, `Path=/`, no Domain,
explicit SameSite under the declared same-origin design; preferably `__Host-` name.
Cookie deadline never exceeds server absolute expiry. Browser responses contain no
token JSON. Exact trusted HTTPS Origin/proxy/source configuration and context-bound
CSRF protect login/logout/mutations. Define CSRF replacement after sign-in/rotation,
expiry and absent-session logout retry. Duplicate/malformed cookies, bearer-cookie
conflicts, old-context proof, missing/foreign Origin and unclassified channels deny.
SameSite alone does not establish forgery protection. a's capability exchange keeps
its independently verified security contract.

Settle actual backend/command-center topology before handoff. Probe a secure browser
context that accepts Secure cookies; declare narrow proxy peers/proof and direct
backend bypass rejection. Existing platform HTTPS ingress cannot silently become a
staff deployment or justify weakened cookie flags. c receives tested forwarding
requirements and integrates the actual command-center application.

Mobile: explicit authenticated HTTPS bearer sign-in/delivery and declared protected
bearer consumers. Only successful mobile sign-in may return the opaque token to
its native consumer. Browser sign-in cannot request mobile delivery to evade CSRF;
consumer classification/origin policy must enforce that boundary. Reject wrong-plane
or conflicting channels. Tokens never appear in URLs, redirects, logs or telemetry.
Define the secure-storage port contract and outcomes for c, including issued-token
revocation/reconciliation when storage fails. b proves the transport, not native
protected storage. Native origin differences cannot disable browser forgery checks.

## Shared lifecycle, failures and safety

Use approved web 60-minute idle/12-hour absolute and mobile 24-hour idle/7-day
absolute lifetimes. Current-session/logout/polling are passive; successful authorized
operational activity may renew only within original absolute expiry. Rotation
retains original verified-sign-in creation/absolute deadline. Test a non-shipping
protected mutation with canonical transaction revalidation; do not build incidents.

Logout confirms durable single-session revocation before claiming success/clearing
the credential, preserves another device and accepts safe duplicate/absent retries
under declared channel/forgery policy. Live foreign-plane credentials deny. Lost
revoke response or dependency failure remains uncertain/retryable, not successful
local logout; no automatic write replay or replica-local session reconstruction.

Map bounded invalid input to 400 with generic `Invalid credentials`, invalid
identity/status/password to indistinguishable 401, protected unauthenticated access
to generic 401, channel/permission/Origin/CSRF to 403, shared throttling to bounded
429 and database/Redis/hash capacity or uncertain writes to retryable 503. Preserve
existing Retry-After conventions. Restored stale Redis must remain behind current
canonical versions/durable fences. Logs/audit/artifacts exclude credentials,
cookies/tokens, identifying lookup hashes, raw code/username and CSRF/proxy secrets.

## Acceptance and verification

| ID | Required proof | Parent coverage |
| --- | --- | --- |
| B-01 | Named transport/DTO/CSRF/proxy/source/error/lifecycle contracts agree with approved a policy, default denial and consumer-channel classification; secure-storage handoff is explicit. | AC-01 transport; AC-12 scoped |
| B-02 | Real credentials authenticate same username under two tenant codes as distinct owners; normalization/exact password bytes work. All invalid tenant/account/credential/status combinations deny generically, including a's credential-ready draft and replaced old password. | AC-02 sign-in denial; AC-05 |
| B-03 | A/B share approved source/qualified-identity admission before verifier work; spoofed forwarding, hostile input, dummy hash paths and busy/internal verifier outcomes cannot mint authority or enumerate identities. | AC-06 admission |
| B-04 | Barrier-controlled password-proof/issuance races with reset/role/account/tenant changes cannot mint current authority from stale facts. Real database/Redis failure, write rejection and lost issuance responses fail safely. | AC-06 issuance; AC-09 canonical |
| B-05 | Actual HTTPS browser transport accepts staff cookie; login/logout/mutation CSRF/Origin/context lifecycle, bypass rejection, no token JSON, no-store and duplicate/conflicting/cross-plane channels pass. Capability-exchange regressions pass. | AC-07 HTTP |
| B-06 | Declared HTTPS mobile delivery yields only a staff bearer token with approved mobile lifetime; cookie/browser consumer confusion and cross-plane use deny. Token/header/log/error scans pass; c's secure-storage failure contract is documented. | AC-08 transport prerequisite |
| B-07 | Session on A works on B; logout on B revokes on A, preserves another device and supports safe absent retries. a's credential replacement invalidates web/mobile sessions; renew/revoke races and stale restore cannot undo it. | AC-04 integrated revocation; AC-09 |
| B-08 | Web/mobile idle/absolute expiry, passive reads/polling and conditional operational renewal hold; rotation cannot extend lifetime. Dependency/lost-response recovery never reports false logout or replays writes. | AC-10 backend; AC-11 backend |
| B-09 | Focused A/B real-service/HTTPS probe checks, a lifecycle and relevant identity/session/platform/draft regressions plus Docker checks pass; evidence/runbook/tracker and c handoff are complete. | AC-12 scoped |

Use production auth adapters, real PostgreSQL/runtime grants and shared Redis with
independent HTTP processes, isolated synthetic tenants/staff and genuine a setup.
Use barrier/clock fixtures, actual stale restoration and controlled dependency/
response-loss faults. HTTPS Chromium cookie transport is required; mocked cookie
headers are insufficient. Mobile HTTP fixture proves only transport.

Provisionally use `./dev exec pnpm check:staff-auth --http` including secure browser
transport probe; selector is not yet established. Record actual commands and run
relevant existing foundation/auth/draft checks plus final `./dev check`. No native
storage or full command-center completion claim. Documentation-only checks are
consistency, links, coverage and whitespace.

## Completion and handoff

Complete only when B-01–09 pass. Hand [c](p2-u4c-command-center-and-mobile-access-with-isolated-recovery.md)
tested routes/DTOs, proxy/Origin/CSRF/source configuration, safe errors, explicit
logout retry/uncertain-state behavior, canonical owner metadata, mobile secure-storage
port outcomes and reproducible a/b fixtures. c owns actual browser/native consumers,
owner-isolated unfinished work and full parent regression. Parent remains incomplete.
