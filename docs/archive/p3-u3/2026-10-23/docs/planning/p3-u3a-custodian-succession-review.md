# P3-U3a — Custodian succession before root retirement

2026-10-19 (UTC). **Design approved; one-time execution explicitly authorized,
executed once after all gates.** The user's later authorization
covers the approved succession setup within one isolated recovery operation.
The [execution checkpoint](../../../../../status/p3-u3a-recovery-execution.md) records the
resolved fresh human-password custody, actual backup/inventory checks, revoked root,
independent successor proofs and verified normal restoration. No repeat recovery is
authorized. Earlier proposed/uninstalled statements below retain design history;
actual evidence is recorded in the execution checkpoint. A later real token
override failed the maximum-lifetime contract; further work requires the separate
[hardening review](p3-u3a-token-lifetime-hardening-review.md).

## Recommendation for private development

Use a human-controlled OpenBao `userpass` auth mount at `platform-custodian`, with
the dedicated named account `platform-owner-custodian`. The user explicitly
accepted personal custody on October 19, 2026 (“Me, with a dedicated custodian
account”). The subsequent design and single-operation execution approvals cover
this exact account, subject to the required custody and safety gates. Keep its
random password in the human custodian's protected offline/password-manager custody;
never mount it into endpoint/trunk launchers, workers, HTTP, or the repository.
Authentication and password handoff use protected file descriptors/hidden input
inside a trusted maintenance helper with verified TLS. No password/token in argv,
environment, application response, logs or shell history.

Each explicit reviewed maintenance session obtains a service token with only
`platform-deployment-maintainer`, no `root` or `default` policy, 15-minute initial
TTL and 15-minute explicit maximum, no period and no renewal permission. Keep the
token in helper tmpfs, record only its protected revocation metadata, revoke and
verify denial at session end. A new human login is required for another session.
Do not use a durable administrator bearer token, scheduled human login, automated
root recovery or an unattended privileged custodian process.

OpenBao supports native human username/password authentication and configurable
hard token lifetime caps. See the [2.7 userpass API](https://openbao.org/docs/api/auth/userpass/)
and [policy model](https://openbao.org/docs/concepts/policies/). These document the
mechanism; they do not establish a successful installation or ACL test here.

## Separate routine and administrative work

| Work | Authorized mechanism after successful setup |
| --- | --- |
| Runtime renewal | Existing exact installation importer/verifier/cleanup token, one-hour request and 24-hour maximum; no policy or role writes |
| Runtime replacement before/at maximum | Existing restricted lifecycle issuer calls only precreated exact installation roles; safe stage/validate/swap/revoke procedure |
| Restricted issuer replacement | Human maintenance session calls two precreated exact issuer roles, each allowing only its existing lifecycle issuer policy, no default/root, orphan, nonrenewable and explicit maximum 24 hours |
| New installation | Reviewed non-secret manifest and human maintenance session create exact policies/roles and add only exact new issuance paths; run real cross-installation/forbidden-operation/endpoint regressions before use |
| Policy/role maintenance | Reviewed change and human maintenance session; compare current privileged inventory with expected baseline before any write; preserve endpoint material ACLs and orphan leases |
| Human account mapping/auth/maintainer-policy changes | Separate security administration review; routine issuers and the maintenance token cannot change this auth mount, account mapping or maintainer policy |

The proposed maintainer ACL permits metadata/policy/token-role inventory (accessor listing has sudo only on that exact path), reviewed
endpoint/trunk policy and role maintenance, exact issuer-role calls, and only
manifest-qualified accessor inspection/revocation in the trusted helper. It grants
no KV material read/write/destroy, generic token creation, root generation,
seal/unseal, mount destruction, auth configuration or audit/TLS administration.
Creation of a new secret mount remains separate security administration, not a
routine installation operation.

**This human custodian is privileged.** A policy/role writer can indirectly grant
more privileges; prefix ACLs and absence of the literal `root` policy do not make
that human unprivileged. Human review and offline custody are part of the trust
boundary, not a provider-enforced approval system. Restricted routine principals
must be denied every such path. Do not describe this as privilege isolation from
the platform custodian. There is no existing MFA-backed identity provider in this
private setup; the password-only human mechanism is a private-development
limitation, not production readiness. Production needs separately reviewed human
SSO/MFA, audited approval and short-lived workload identity.

## Prepared routine human session helper

`scripts/openbao/human-custodian-session.mjs open` performs an explicit fresh
login for the assigned account using `/human/password` and `/trust/ca.crt`, never
an existing admin token. Run only in a trusted maintenance helper with private
provider access and an owner-only `/session` tmpfs. It keeps the returned token
and accessor only there, validates policy/orphan/TTL/maximum, and prints safe
status only. `close` revokes that exact session, verifies denial and removes its
files. Missing custody refuses before password or provider access. Neither command
configures authentication, edits policies or recovers root. No runtime/issuer
calls it. The real successful-login path remains unverified until account setup.

A known login response that cannot be stored triggers exact self-revocation;
failed revocation preserves any owned revocation metadata and reports uncertainty.
A lost login response is uncertain: stop, preserve helper state and use reviewed
custodian inventory; do not blindly log in again or overwrite session custody.
An expired/denied close that cannot verify revocation similarly requires reviewed
reconciliation. At the 15-minute maximum, a fresh reviewed human session uses new
helper tmpfs; no renewal or unattended reauthentication bypasses the limit.

For issuer replacement, `issue-lifecycle-issuer.mjs endpoint|trunk <reviewedManifest>`
uses only that active human session and its fixed `platform-<lifecycle>-issuer`
role. It reads/computes the exact existing policy/role manifest first; missing,
different or unknown facts stop without configuration writes. It stages only a
validated orphan, no-default, nonrenewable issuer with a 24-hour hard maximum
into owner-only `/output`. Existing outputs are never overwritten. Then trusted
custody separately validates/installs/swaps the staged issuer and revokes only the
prior reviewed accessor. Keep known uncertainty if any step fails. No mount,
policy, role or generic token creation is performed by this replacement command.
Its missing-custody refusal is checked; real role behavior is a window acceptance
gate, not proven by the pure test.

## Required handoff and failure gate

The recovered root may configure the exact human auth mount/account, maintainer
policy and two fixed issuer roles **only if this addition is explicitly approved
with the recovery execution request**. This is new proposed setup, not a claim
that an administrator already exists. Do not silently add it to the earlier
approved two-installation provisioning manifest.

Before retiring recovered root, prove a fresh human login, exact policy/TTL/
maximum, denied direct self-mapping/auth/maintainer-policy writes, and restricted
issuer replacement with verified orphan identities. Retain exact protected setup/
accessor manifests. Revoke the recovered root with the finisher, then prove the
human login and restricted successors still work. **Only after that independent
handoff succeeds** may the human maintenance session retire the exact old endpoint
administrator under the reviewed baseline; it has the required endpoint-policy
and manifest-qualified accessor rights. Never try to prove independence before
performing root revocation. Failure preserves the old administrator pending review.

Verify old administrator remediation against the expected approved baseline only.
If any privileged token, policy, lease or ACL differs unexpectedly, stop and seek
separate review; do not revoke extra principals or rewrite unexpected configuration.

If the handoff cannot be installed and verified within the recovery window, stop
provisioning, revoke the known recovered root, restore the original disabled
listener and preserve the existing administrator pending separate review. Do not
claim a successful cutover or extend the window. If revocation/restoration is
uncertain, keep provider isolation and consumers paused under the failure plan.
If human login is later unavailable, stop new provisioning; keep valid runtime
leases within their limits. Lost/locked custodian access requires separate security
review, never an automatic second recovery. Existing valid authorized custodian
access always takes precedence over recovering root.

The exact non-secret ACL/account settings and issuer roles are prepared in
`scripts/openbao/custodian-succession-plan.mjs`, with a pure scope/lifetime check.
The named human account is an explicit input to the reviewed plan. The exact
non-secret plan for `platform-owner-custodian` is saved mode 0600 at
`.local/endpoint-fixtures/custodian-succession-plan.json`. Together with the
two-installation plan, setup comprises 13 policies, 14 token roles and one new
native auth mount/account. This additional policy/two-role/auth setup must be
explicitly covered by execution approval. A manual setup helper, `scripts/openbao/setup-custodian-succession.mjs`, is
prepared. `plan <username>` has no provider access. Its `apply <operationUuid>`
requires a matching, less-than-five-minute-old protected
`/recovery/custodian-succession-approved.json` with exactly `operationId`, `username`
and `approvedAt`, the matching recovery-start marker, helper tmpfs, the separately
held `/human/password` file, and the recovered root file. It refuses preexisting
handoff objects and outputs. No approval/password has been staged. Negative
acceptance proves refusal before credential/provider access. It validates a fresh
login's identity/TTL/maximum and expected denied capabilities, then reports only
preparation; issuer replacement/maximum/revocation-independence proofs still gate
success. Known successor custody is preserved on failure for exact revocation;
unknown issuance is uncertain, never silently retried. The permanent human
password is not created or printed by this helper.

The auth setup is not installed or verified against retained OpenBao. Before
execution, verify that this same user holds the protected password and can
perform the fresh login. No password file or account has been created. Approval of the architecture is not evidence of
installation; fresh-login, ACL, lifetime and issuer-successor tests remain required
inside an authorized window before administrator retirement.

## Protected password file representation — October 20 clarification

The [October 19 execution record](../../../../../status/p3-u3a-recovery-execution.md#fresh-password-custody-confirmed-and-operation-executed)
already omitted one final line ending from the maintenance copy without rewriting
the owner's file. `custodian-password.mjs` now makes that exact framing contract
shared by setup, manual-session and limited-verification helpers: one 43–128-byte
ASCII letters/digits/underscore/hyphen credential, optionally followed by one LF
or CRLF. No trimming, embedded/repeated whitespace, BOM, non-ASCII or credential
normalization is accepted. Protected-file framing may occupy at most 130 bytes;
the credential length/security requirements are unchanged. See the
[compatibility and single-session outcome](../../../../../status/p3-u3a-custodian-handoff-followup.md).
The original handoff and account password were preserved.
