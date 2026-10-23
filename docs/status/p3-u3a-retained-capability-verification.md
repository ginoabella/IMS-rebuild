# P3-U3a retained capability-verification findings

2026-10-20 (Asia/Manila, +08:00). Source: owner's **Approval of Limited Retained
Custodian Capability Verification**, authorizing the single attended session in the
[reviewed request](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-authority-verification-request.md).

## Current follow-up

The owner accepted the final evidence and closed the named capability-verification
checkpoint as successfully completed on October 20 (+08:00). The existing named
custodian functions with its intended restricted permissions on the verified paths.
No authority expansion or repeat check is authorized. This closes only the bounded
checkpoint, not privilege inventory, backup readiness, or P3-U3a.

The owner separately authorized a second bounded session after full disposable
workflow testing. It **passed all identity and ten-path capability comparisons**,
with acknowledged self-revocation and final lookup 403. Both limited authorizations
are consumed. [Current expected-versus-observed report and limits](p3-u3a-retained-capability-session-2.md).
Separate backup/maintenance availability remains unknown; retained remediation is
unapproved. The original preflight block and first-session display-name stop below
remain historical. The [handoff follow-up](p3-u3a-custodian-handoff-followup.md)
records the compatible parser correction and unchanged credential bytes.

## Original preflight outcome

**Blocked before authentication.** The exact already documented protected password
handoff exists with expected owner-only directory/file permissions and is excluded
from every running container's mounts. Its bytes fail the format check used by the
existing human-session helper. This is a local input-validation difference, not an
OpenBao authentication rejection or proof that the password is invalid.

The isolated verifier refused before its first network request. A subsequent
network-disabled diagnostic returned validation booleans only: isolated private
tmpfs and exact input readability passed; documented password format failed.
No normalization, credential replacement, alternative-account search or custody
discovery was attempted. Password contents and detailed properties are omitted.

- Login attempts: **0**. Sessions issued: **0**. Capability-query batches: **0**.
- Identity, assigned policies, identity policies, period and bounded session
  attributes: **unobserved**; no current retained result is claimed.
- All ten enumerated capabilities: **unobserved**. The expected policy denies
  snapshot access and maintainer self-edit, permits issuer-policy maintenance,
  policy/role/accessor listing and auth metadata read, and denies entity/group
  listing. These are source expectations only; no provider confirmation occurred.
- Cleanup: **no session requested**, so session revocation and denial confirmation
  are not applicable. The ephemeral helper exited and was automatically removed.
- Separate backup job, snapshot reader or maintenance operator: **availability
  unknown, not absent**, as explicitly reported by the owner. No search authorized.

The one authorized login has not been used. Resume requires the owner to review
the exact documented protected handoff and make the existing account's input
available through that same protected mechanism; never send it in chat. Do not
guess transformations or change account credentials. Recheck exact input isolation
before proceeding under the original one-login/900-second/no-retry limits.

## Prepared verifier and checks

`scripts/openbao/verify-custodian-capabilities.mjs verify-once` is an explicit
maintenance action using the same named userpass endpoint, protected-file reader,
private provider URL and verified CA as the existing session helper. It holds the
session in memory only, issues no children or renewals, and never prints tokens or
accessors. It permits one self lookup, one exact ten-path capability batch, then
one self revoke and one confirmation lookup. Unexpected identity or authority
stops observation and triggers cleanup. Denial without acknowledged revocation
is uncertain cleanup. Each request has a five-second timeout; no retry is built in.
The helper mounts only its source, exact password, CA and private tmpfs, with no
application source/secrets or provider storage. Docker logging is disabled.

Docker workspace verification: `node --test
scripts/openbao/verify-custodian-capabilities.test.mjs` passed all seven test groups.
They cover exact request scope, identity/privilege/bounds mismatches, lost login
responses, unexpected login attributes, capability errors and uncertain cleanup.
The verifier tests are included in `pnpm check:trunk-preparation`; the final
combined preparation run passed all 26 tests. Scoped ESLint, Prettier and
`git diff --check` passed. These verifier cases are simulated transport tests; they do not prove retained TLS/authentication,
effective policy composition, complete inventory, backup durability or restoration.

## Sustainable mechanism recommended for separate review

Prefer a stable backup route and separately controlled attended maintenance over
the temporary-ticket/pre-backup-write contingency. First allow the owner to identify
an existing route; its availability remains unknown. If no suitable route can be
made available, review one explicit lasting-capability design:

1. A dedicated scheduled backup identity with native Raft snapshot read and only
   its necessary self-management rights, outside application mounts. Pair it with
   a host-controlled job that separately preserves the append-only audit stream.
   Use protected storage outside the application host, exclusive writes, checksums,
   retention and a recorded isolated restore exercise with separately held seal/TLS
   prerequisites. Snapshot access is sensitive; restrict its custody accordingly.
2. Keep the existing short-lived attended human login for reviewed maintenance.
   Any missing policy-writer/full-inventory authority must be an explicitly
   reviewed, separately controlled deployment capability with named exact targets;
   the maintainer cannot authorize editing its own denied policy. Preserve
   installation/runtime isolation and exclude generic token/root/restore powers.
3. Before any policy change, require a verified fresh native backup and separate
   audit preservation, independently authorized effective inventory, exact reviewed
   body hashes, writer exclusion, validation and explicit partial-state cleanup.

This recommendation grants no new authority and creates no principal or job.
Names, scope, responsible custodian, access mechanism, destination, backup cadence,
RPO/RTO and restore evidence belong in the concrete review package. No snapshot,
inventory, policy/role write, issuer access, renewal, restart, restoration or live
SIP/PBX activity occurred. Retained lifetime/provider acceptance remains failed;
P3-U3a remains incomplete. Independent local implementation continues.
