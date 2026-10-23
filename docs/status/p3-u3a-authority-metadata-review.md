# P3-U3a — Approved OpenBao names-only authority review

2026-10-21 UTC. **Completed, exit 0; approval consumed.**

[Approved scope](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-openbao-authority-discovery-request.md),
[machine evidence](p3-u3a-authority-metadata-review.json).

## Result

One unchanged `platform-owner-custodian` session completed the three approved
metadata operations. Exact identity and 900-second maximum checks passed. Native
work ran from 2026-10-21T05:42:26.447Z to 2026-10-21T05:42:27.364Z.
Self-revocation was acknowledged, subsequent self lookup returned 403, and the
helper and temporary public trust copy were removed. No token was persisted.

| Metadata | Observed |
| --- | --- |
| Auth mounts | 2: `platform-custodian/` (userpass), `token/` (token) |
| Policy names | 60; exact names in machine evidence |
| Token-role names | 14; endpoint/trunk issuance and material lifecycle roles |

No names match the proposed `platform-backup` auth mount,
`platform-raft-snapshot-reader` or `platform-backup-maintenance` policies.
`platform-deployment-maintainer`, `endpoint-development-admin` and the built-in
`root` policy names are present. Names do **not** establish policy contents,
assigned principals, active tokens, credentials or effective installation rights.
Do not infer that an admin-sounding name is usable or that the built-in root policy
means a root token exists. Excluded endpoint admin material was not read or used.
This is not a full privilege inventory. Independently authorized existing installer
and existing backup-first route remain **unestablished, not proven absent**.

No policy/role body, user/entity/group/accessor inventory, secret, snapshot or
provider data was read. No capabilities recheck, renewal, child issuance, policy,
role or auth change, restart, recovery, restore or pruning occurred. Owned login
and self-revocation were the only state-changing requests. Native renewal HTTP
500/expiry, retained lifetime-policy and browser findings remain unresolved.

## Preparation and verification

Eight synthetic groups passed: exact methods/path order, identity/lifetime mismatch,
unexpected login policies, lost login response/no retry, malformed/bounded metadata,
mid-review failure, cleanup uncertainty and empty list versus denied/malformed reply.
Seven native fixture assertions passed against pinned TLS OpenBao 2.7.1, including
the exact seven request paths and operations in its audit stream, empty token-role
list behavior, redacted output and revoked/403 cleanup. [Native evidence](p3-u3a-disposable-runs/7439a1ed-3cbd-45b7-bd27-a425daebfaf6.json).

Earlier fresh fixture attempts failed on setup timeouts, the required declarative
audit configuration or the audit assertion's trailing-slash LIST representation;
all were preserved with exact container/network/key cleanup. Native setup uses a
20-second initialization request timeout; the review retains five-second request
deadlines and 60-second work/60-second cleanup bounds. No retained access occurred
until all prerequisites passed. Scoped lint/format and whitespace checks passed.

Password handoff metadata (owner, 0700 directory, 0600 regular non-symlink
single-link file, no existing container mount) passed. Offline parsing passed.
The documented public CA was readable only as its service UID, so a network-disabled
UID 1003 helper copied that exact **public certificate only** into a temporary
owner-only trust file. UID 1002 then passed offline framing/trust preflight and ran
the review. No root container, provider data volume or TLS private key was used.

## Next concrete authority decision

1. Identify a human/operator and authorization reference for an **existing**
   independent installer from administrative records. This review found no
   established usable installer route; it does not authorize guessing accounts,
   inspecting credentials or logging in again.
2. If an existing installer is identified, prepare exact effective-authority and
   pre-state inspection under separate approval, then the existing reviewed
   snapshot-only provisioning bodies and backup-first operation. Preserve the
   current custodian restrictions and separate recovery custody.
3. If none can be identified, provisioning cannot proceed under current authority.
   Establish whether independently held **OpenBao unseal/recovery** material exists
   (distinct from the new age archive key). Prepare a separate concrete bounded
   recovery/bootstrap decision only after custody, impact, backup-first sequencing,
   failure containment and cleanup are reviewable. No recovery or four-write
   pre-backup exception has been approved by the metadata review.

Public age recipient is validated; owner confirms private-key storage outside
MyIMS. Backup-host exclusion, independent recovery-copy count, private-key
possession/decryption and host public-recipient installation remain unverified.
Manual email delivery is verified. Repository initialization, retained capture,
automatic audit/backup scheduling and joint PostgreSQL recovery acceptance remain
pending. P3-U3a remains incomplete; timed COMPLIANCE retention remains deferred.


## Follow-up: owner-named file check — October 21 (UTC)

Owner asked to check `/home/gino/.openbao-custodian/password`. Metadata checks
passed: current-user ownership, 0600 regular non-symlink single-link file, 0700
parent and exclusion from running container mounts. The existing offline
custodian-password parser accepted its framing in a network-disabled UID 1002
helper; content was not displayed, no login occurred and the helper was removed.
This is the documented human custodian password handoff. It does not establish
OpenBao unseal/recovery-key custody or independently authorized installer rights.
No additional files were searched.


## Installation/documentation search — October 21 (UTC)

Owner reports no personally held OpenBao unseal/recovery keys and requested a
repository/documentation review for the installation and possible administrator.
Only source/configuration/documentation was searched; no private custody store,
key contents, administrator token or protected operation archive was inspected.
No login or provider request occurred.

Concrete custody lead: [original initializer](../../scripts/provision-endpoint-credentials.mjs)
uses `/custody` and writes `seal.json` with `initialized.keys_base64[0]`, mode
0600, during first initialization. The [endpoint runbook](../runbooks/endpoint-credentials.md)
maps `/custody` to ignored `.local/endpoint-credentials` under dedicated UID/GID
1003, with one share/threshold one for development. Thus the documented host path is
`/home/gino/projects/IMS-rebuild/.local/endpoint-credentials/seal.json`.
The [October 19 preflight](p3-u3a-provisioning-preexecution.md) recorded seal/CA
file presence; [actual recovery](p3-u3a-recovery-execution.md#actual-execution--2026-10-19-utc)
records successful manual unseal/recovery at that time. Current existence, usability
and independent custody of that key remain unverified; the owner statement does
not prove the installation-managed copy is absent.

Administrator history:

- Initial `endpoint-development-admin` used a protected `admin.token` and a
  24-hour maximum. During October 19 succession, no active old-administrator
  accessor remained and its policy was changed to deny all. A surviving file or
  listed policy name is not usable installation authority. Do not revive or test it.
- `bootstrap.json` held initialization/recovered root temporarily; bootstrap
  revokes root and removes that file. October 19 recovered root was revoked/403.
  Historical root material must not be reused.
- `platform-owner-custodian` is the installed human account, using the external
  password handoff. Its snapshot and self-policy denials remain in effect.
- Endpoint/trunk issuer and worker/cleanup credentials are restricted application
  lifecycle identities. They are not backup/platform installation administrators.
- `platform-raft-snapshot-reader` and `platform-backup-maintainer` remain proposed
  identities; the approved names-only review established no retained installation.

No separately usable named installer was found in reviewed documentation. Recommend
an administrator's **metadata-only** check of the exact `seal.json` path next,
without displaying or copying key bytes. Confirmation of file existence is not
authorization to unseal, restart, generate root or provision anything. If present,
prepare independent custody and a separately approved bounded authority-establishment
plan preserving backup-first sequencing and the current custodian restrictions.
Do not rerun `init`/`bootstrap` or delete volumes/custody to recreate authority.


## Administrator seal-file metadata confirmation — October 21 (UTC)

Owner provided `sudo stat` output confirming the documented `seal.json` is a
regular file, mode 0600, UID/GID 1003:1003. This updates current file-presence
evidence only. Key contents, validity against the provider, independent custody
and any ability to establish administrative authority remain unverified. No agent
key read, login, unseal, restart, recovery or provisioning occurred.
See the [next authority-establishment preparation plan](../planning/p3-u3a-backup-authority-establishment-plan.md).
