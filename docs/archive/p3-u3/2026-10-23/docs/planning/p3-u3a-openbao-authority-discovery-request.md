# P3-U3a — Bounded existing-authority metadata review request

2026-10-21 UTC. Owner explicitly approved this exact metadata review. **Completed; the one-session authorization is consumed.** No further login or wider reads are authorized. See [results](../../../../../status/p3-u3a-authority-metadata-review.md).

## Problem and useful outcome

Prior accepted verification established that `platform-owner-custodian` cannot
read the native Raft snapshot or edit its own maintainer policy. Separate installer
and backup authority is unknown, not proven absent. Host sudo and Docker access
establish no OpenBao provisioning authority. Prior session approvals are consumed.

Recommend one new attended session using the existing unchanged custodian solely
to collect names of possible existing authority routes. This is a different task
from repeating the closed capability verification; no capability query is proposed.
Names identify candidates for later review, not usable credentials or proof of
effective authority. Do not infer that an admin-sounding name grants access.

## Exact proposed access

Use only the existing documented protected password handoff, private provider
network and verified TLS to `https://endpoint-secrets:8200`. Confirm handoff
permissions and exclusion from application/container mounts without displaying it.
Do not search alternative credential locations. The purpose-built allowlisted helper passed eight synthetic fault groups and seven
native checks before the one retained session; see the linked results. Existing maintenance scripts must not be used as an
unrestricted executor.

| Sequence | Method and path | Purpose |
| --- | --- | --- |
| 1 | POST `auth/platform-custodian/login/platform-owner-custodian` | One login using existing protected handoff |
| 2 | GET `auth/token/lookup-self` | Assert unchanged sole maintainer policy, identity, service token, no identity policies/period and maximum 900-second lifetime |
| 3 | GET `sys/auth` | Allowlist auth mount names/types only |
| 4 | LIST `sys/policies/acl` | Policy names only |
| 5 | LIST `auth/token/roles` | Token-role names only |
| 6 | POST `auth/token/revoke-self` | Revoke the owned session |
| 7 | GET `auth/token/lookup-self` | Confirm 403 after cleanup |

No recursive enumeration, user/entity/group/accessor listing, policy/role body
reads, secret reads, snapshots, auth edits, renewal, token issuance, provisioning,
restart, recovery or custodian change. No new grant. Authentication and owned
session cleanup are the only state-changing requests in this metadata review.
Five-second request deadlines, 60-second work bound and separate 60-second cleanup
allowance; no automatic retries or second login. Stop work on denial, malformed,
oversize, unexpected identity or uncertain response; attempt cleanup for any known
token, report uncertain issuance/revocation without retry or substitute authority.
Keep credentials/token only in protected ephemeral memory; disable container logs;
export only sanitized identity checks, names/types, status and cleanup outcome.

## Decision after review

If names suggest an existing snapshot or installer route, request separately
approved exact policy/role/effective-authority reads and identify its actual human
operator and protected custody reference. Do not fetch or use a candidate secret.
If the review is empty, denied or inconclusive, leave authority unknown. Even a
successful names-only review is not a complete inventory or proof of absence.

Any subsequent provisioning needs an independently authorized existing installer,
verified backup-first evidence, exact reviewed bodies and fresh operation approval.
The proposed snapshot reader remains limited to native snapshot read and owned
session inspection/revocation/capability preflight; no restore, secret read or
policy editing. The four-write pre-backup exception and root recovery remain
unapproved. If no independent installer can be established, return a separate
concrete decision request rather than bypassing the custodian restrictions.

## Current recovery custody

Owner supplied a valid public age recipient and confirms private key storage
outside MyIMS. No private key was requested or handled. Separate backup-host
exclusion, independent recovery-copy count and decryptability are not inferred
from that statement. Public recipient host installation is not yet confirmed.
OpenBao seal/recovery custody stays separate. Manual SMTP delivery is verified.
