# P2-U1c secure operator bootstrap contract — review for approval

**Status: sections 1–2 approved, 2026-10-05 (Asia/Manila, +08:00).**
Prepared: 2026-10-05, Asia/Manila (+08:00).
Decision owner: project owner (user).

This document presents the scoped D-05 decision needed to implement
[P2-U1c](../../context/feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md).
P2-U1a storage and P2-U1b roles/admission are complete; their approved contracts
remain in force. The user approved sections 1–2 and instructed implementation to continue. This approval
provides only the bootstrap credential portion of the P1-U1 handoff. P1-U1 and
unrelated product decisions remain deferred.

## 1. D-05 — Initial operator password policy

Approved policy for the password supplied to the trusted initial-operator command:

| Rule | Approved behavior |
| --- | --- |
| Minimum length | 15 Unicode code points |
| Maximum length | 128 Unicode code points and at most 512 UTF-8 bytes; both limits apply |
| Permitted input | Valid UTF-8 text, including spaces and Unicode; reject malformed UTF-8, NUL and line-break characters |
| Composition | No required uppercase, lowercase, digit or symbol mixture |
| Preservation | Preserve exact password bytes; do not trim, lowercase, normalize Unicode or collapse whitespace |
| Confirmation | Hidden interactive input requires a second identical entry; protected automation input supplies the password once |
| Defaults and generation | No default password, automatic password generator or implicit credential delivery |
| Rejected input | Safe fixed validation outcome with nonzero exit; no account, credential, provenance or success audit written |

Code-point counting means a Unicode code point counts once; a visual character
made from several code points counts several times. Valid UTF-8 encoding and the
byte limit also apply. Rejecting line breaks allows a bounded hidden-input and
secret-file format without silently stripping password characters.

Spaces count toward length, including leading and trailing spaces. Operators
should select a unique passphrase and retain it through their approved secret
handling process. Visually similar Unicode strings with different bytes remain
different passwords. The command never prints the password or its hash.

The length minimum permits a long passphrase without mandatory symbol mixtures.
The upper bounds limit input and hashing resource use. This scoped proposal adds
no external password screening service, dictionary/breach-list dependency or
expiry schedule. Broader sign-in/setup/reset password policy remains a decision
for its owning units; this review does not settle it implicitly.

## 2. D-05 — Initial account and scoped handoff

Create the initial operator with these explicit canonical facts:

| Fact | Initial value / rule |
| --- | --- |
| Identity plane | Platform; separate operator store, with no tenant association |
| Username | Existing approved normalization: trim outer whitespace, ASCII lowercase, then validate the canonical identifier |
| Account status | `active` |
| Credential state | `ready`, with a salted verifiable password hash and coherent change timestamp |
| Authority | Existing fixed `platform_operator` authority; no staff roles or tenant membership |
| Versions | Positive initial row/authentication versions; use 1 for each |
| Provenance | One durable initial-bootstrap result in PostgreSQL |
| Attribution | Trusted system actor naming the command and bounded reason, with separate target and correlation reference |

Active/ready eligibility and platform authority already have approval under
[b's review](p2-u1b-contract-review.md#3-d-05--account-and-credential-eligibility).
This proposal explicitly applies them to first bootstrap creation. Provisioning
does not sign the operator in, create a session or prove later authentication.

Approval of sections 1–2 resolves c's remaining scoped product gate. Retain a's
approved storage/ownership rules and b's D-01/D-05/D-06 role/admission rules,
including creator closure. Record approval in
[authoritative product contracts](p1-u1-product-contracts.md#5-d-05--credentials-and-administrator-safeguards)
before dependent implementation resumes.

## 3. Implementation commitments after approval

The original implementation request authorizes completing c after the policy is
resolved. These commitments follow its specification; they are not completed
runtime behavior or additional product approval requests.

### Protected input and hashing

Extend the existing listener-free deployment entry point with an explicitly
selected bootstrap command. Migration, HTTP and general startup never bootstrap
implicitly. Document the exact Docker launcher and protected-input format in the
implementation runbook.

Support hidden interactive input and a protected secret-file input for automation.
Keep username/password contents out of argv, logs, diagnostics and examples;
only an input-mode selector or secret-file path may appear in invocation arguments.
Bound reads, validate file protections and the input format, and reject unexpected
or oversized input without echoing it. No plaintext credentials enter committed
settings or client bundles. Clean temporary buffers/files where practical; make
no guarantee of complete memory erasure. Operator-managed persistent secret
sources remain under their owner's control.

Select an appropriate salted password-hashing algorithm with encoded parameters,
bounded cost and concurrency. Exact algorithm/parameters are routine technical
choices to document and verify during implementation. Hash before opening the
creation transaction. Keep hashing primitives and verifier material private;
prove correct/incorrect password verification and exact-byte preservation with
synthetic fixtures.

### First creation, rerun and conflicts

Use PostgreSQL serialization and uniqueness constraints to create the operator,
credential, provenance and system audit together in one transaction. Check required
schema/settings before writing. Actual runtime credentials cannot insert the
bootstrap account or modify bootstrap provenance; no public endpoint wraps it.

Proposed validation flow: validate protected input and the password policy on
every invocation before the transactional decision. A valid newly supplied
password on a matching rerun is not compared with, or substituted for, the
existing credential. Hashing remains bounded and outside the creation transaction.
A matching rerun returns a safe already-created outcome and preserves the original
hash, status, authority, versions and creation audit count.

| Canonical result | Command behavior |
| --- | --- |
| No prior provenance and no conflicting requested username | Create one initial operator atomically |
| Matching provenance and eligible initial operator | Already-created outcome; no mutation or new creation event |
| Different requested initial identity | Safe conflict, nonzero exit |
| Requested username belongs to an unrelated account | Safe conflict; never adopt it |
| Conflicting or inconsistent provenance | Safe conflict; never repair or replace it implicitly |
| Existing bootstrap operator is disabled or otherwise ineligible | Safe conflict; never reactivate or reset it |

Independent matching processes must converge on one creation and one existing
result. Different-identity races cannot create two initial operators. An unrelated
preexisting account grants no bootstrap authority and does not become the initial
operator merely because its username matches.

### Failure and durable recovery

A failure before commit leaves no partial account, credential, provenance or
creation audit. Forced audit failure rolls back creation. Connection loss during
commit produces a safe uncertainty outcome; transport failure never proves that
PostgreSQL rolled back. Rerunning inspects canonical provenance and resolves the
durable result without password rotation or duplicate creation.

Bootstrap provides initial provisioning only. Conflicts or an ineligible existing
operator require investigation and a separately approved later recovery procedure.
This command cannot be used for password reset, reactivation or operator recovery.

### Verification and handoff

Run C-01–08 with real PostgreSQL and independent OS command processes, including
concurrency barriers, precommit interruption, audit failure and controlled
commit-response loss. Retain a/b regressions and runtime-grant/ownership checks.
Verify synthetic secret/hash/identity-input sentinels are absent from diagnostics,
audit metadata, published evidence and all client bundles.

Complete `./dev exec pnpm check:identity-foundation` and `./dev check`, wire the
combined checks into the existing foundation/CI sequence, and document exact
commands/results. Keep parent AC-01–11 evidence centralized. Fixture teardown
removes only uniquely identified disposable resources; operational bootstrap and
migrations create no fixture tenants/staff.

Mark c and parent P2-U1 complete only after their full acceptance checks pass and
tracker/contracts/runbook/evidence agree. Bootstrap success does not complete the
Phase 2 authentication gate or establish production readiness.

## 4. What remains deferred

| Deferred contract / capability | Owner/unit |
| --- | --- |
| Sign-in, sessions, expiry, guards and cross-replica revocation | P2-U2–U4 |
| Broader password setup/reset policy, credential delivery, token exchange/lifetimes | D-05; P2-U4/P4 |
| Operator recovery, identity verification and recovery authorization | D-05; later trusted recovery workflow |
| Last-administrator safeguards and account-management workflows | D-05; P4 owners |
| Tenant lifecycle transitions, activation/routing and active-work effects | D-06; P4/telephony owners |
| Production organizations, staff, PBX provisioning and deployment readiness | Later provisioning/production units |
| Other unresolved P1-U1 product contracts | Existing decision register and owning units |

## 5. Review response

The user approved sections 1–2 and instructed implementation to continue.
The approved review response was:

> Approve the P2-U1c bootstrap contract in sections 1–2, including the scoped
> D-05/P1-U1 handoff. Continue implementing P2-U1c.

To revise it, name the section and desired rule, such as the minimum length or
permitted characters. Sections 3–4 document the implementation and downstream
boundaries. Sections 1–2 are approved; c remains incomplete until its acceptance checks pass.
