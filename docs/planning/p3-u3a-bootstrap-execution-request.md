# P3-U3a one-time guarded development bootstrap execution request

**Latest result:** corrected package explicitly approved and executed once; all nine
writes and both encrypted backup retrievals succeeded. Root revoked, normal
protection restored and guard/helpers closed. Owner password handoff is complete
and its private custody was verified without reading the password. [Execution evidence and next guidance](../status/p3-u3a-bootstrap-retained-execution.md).
The earlier pending statements below describe preparation history; execution
authorization is now consumed and must not be replayed.

October 22, 2026, Asia/Manila (+08:00). **Original package approved; staging correction is ready for review. Execution has not started.** This is the separate
root-bootstrap request required by the approved
[next-step plan](p3-u3a-backup-authority-next-step.md). Earlier plan/preparation
approvals and consumed capture approvals do not authorize this operation. The
owner’s latest explicit approval now authorizes this exact operation and digest.

Approval recorded for package
`07907f91e232a093bd0d125413995d03c8099fa0ae887c5232c9859338eacc85`.
Public source/package validation passed unchanged. Administrator staging is the
remaining prerequisite: `sudo -n true` reports interactive authentication required
in the agent session. The subsequent staging attempt stopped before creating
operation directories; see the correction below. No provider isolation, root
generation or provisioning has started. The attended execution window will be
recorded after staging and the corrected source binding are verified. Original
approval remains unconsumed and bound to the original package digest.

## Exact requested operation

Operation **`d6550071-561a-4339-bc15-50a5b22ac43d`**, attended operator `gino`.
The [source/hash-bound request](../../infra/backup/bootstrap-request.json) contains
the exact nine write bodies, all source hashes, historical policy baseline,
provider/repository identities, staging/output paths and protected handoff.
Its `reviewPackageSha256` binds the reviewable package; execution approval must
refer to that digest, with a separately recorded attended window of at most
15 minutes. Execution source/candidate drift, expired approval, prior work/status
or an already consumed operation refuses execution before provider access.

Approve one guarded development operation that:

1. Creates only this operation's new private staging and ciphertext spools. It
   preserves every previous operation and the already initialized repository.
2. Verifies the exact closed prior operation, provider hardening/mounts/private
   networks, append-only TLS destination and protected input/output metadata.
   Checks the existing Restic repository ID read-only before provider isolation.
3. Arms the independent **840-second** guard, temporarily restarts development
   OpenBao onto its isolated recovery network with generation endpoints enabled,
   reads the existing protected seal only inside the dedicated helper, unseals
   and makes **one root-generation attempt**. Root remains in helper tmpfs.
   Development credential-provider access can be unavailable during this window.
4. Reviews the complete current policy-name/hash baseline (59 captured policies
   plus built-in root name), all fourteen roles and six native extra fields,
   unchanged custodian configuration, user mappings and identity/entity/group/
   alias contributions. The sole existing custodian entity may contribute no
   policy/group authority and must map to its exact userpass mount. Missing,
   changed or additional authority stops before provisioning; no inferred repair.
5. Captures a fresh native snapshot and independent audit; encrypts offline to
   the existing backup recipient, hands off only ciphertext, uploads to the
   existing repository and retrieves/verifies exact ciphertext/receipt hashes.
   No provisioning write before this proof; maximum pre-change age **900 seconds**.
6. Makes the **nine exact provisioning POSTs** in the manifest: three constrained
   issuance-policy replacements; snapshot policy, AppRole mount, role and initial
   SecretID; rotation-only policy and separate `platform-backup-maintainer` user.
   The existing `platform-owner-custodian` account/password/configuration stays
   unchanged. Its existing broad policy-writing capabilities remain a documented
   escalation risk; no claim of provider-enforced isolation is added.
7. Requires a fresh live host guard/source/candidate/backup check before each
   provisioning write. Journals before-send and acknowledgment separately.
   Validates policy/role readback and bounded maintenance login/denials, then
   self-revokes the acceptance session. Password, SecretID/accessor and RoleID
   stay in separate protected custody, outside application mounts and reports.
8. Finally cancels any generation attempt, revokes the owned root and confirms
   403. Restores normal TLS/HCL/mounts/network, unseals once for restoration,
   confirms active health and anonymous generation **405**, then cancels the
   guard and restores the original restart policy/removes the root helper.
9. Encrypts the separate post-cleanup audit, captures a post-install snapshot
   using only the new snapshot identity, confirms its token revoke/403, encrypts
   offline, uploads and retrieves/verifies a **different** Restic snapshot.
10. Hands the new maintenance password to the owner's separate mode-0600 file
    under mode-0700 `/home/gino/.openbao-backup-maintainer`, through the exact
    administrator-only helper. No password or sensitive derived value is printed;
    no overwrite, automatic retry or source deletion.

The snapshot identity retains the reviewed 300-second explicit token maximum,
30-day SecretID and 1,000-use candidate budget. The rotation account has a
900-second explicit session maximum, no default policy and only the exact
snapshot-role rotation/self-inspection/revocation permissions. No routine
installer policy, root credential or recurring recovery dependency remains.

## Failure scope and exclusions

On uncertain/partial write, stop, preserve the exact journal and protected outputs,
revoke root and restore protection when cleanup is confirmed. Never retry the POST,
issue another root, delete existing objects or perform an automatic ACL rollback.
If revocation/restoration is uncertain, keep containment active; the exact labeled
provider may be stopped by the deadline. Availability then requires attended
reconciliation under separate scope. A committed write with a lost response can
leave a partially installed identity; success is not inferred from an error.

No repository initialization, retained restore, pruning/deletion, production,
existing custodian account/password changes, application/PostgreSQL/Redis/Asterisk
changes, timer, audit collector or scheduled activation is included. Historical
plaintext/ciphertext/receipts and operation records are preserved.

This installs and verifies development backup identities. It does not establish
joint-store recovery readiness, resolve existing renewal HTTP 500/fractional-expiry
or browser findings, or complete P3-U3a. Independent fresh decryption, isolated
PostgreSQL/OpenBao generation reconciliation, measured RPO/RTO and agreed alerts/
capacity/rotation operations still precede any scheduling or readiness claim.

## Review and commands

[Wiring/rehearsal evidence](../status/p3-u3a-bootstrap-host-wiring.md) distinguishes
real native behavior, injected loss and remaining retained-only facts. Native tests
use the same host ports, semantic reviewer, provisioning core, handoff, guard bridge,
archive and upload/retrieval code with synthetic identities/networks/volumes. The
retained-only launcher refuses absent approval and has public packaging/rendering
checks; it has not been run against retained services.

Safe public-package check now (no Docker/provider/custody access):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/execute-bootstrap.py infra/backup/bootstrap-request.json
```

**Approved; administrator staging is pending.** The owner prepares fresh staging from
an authenticated host terminal:

```sh
sudo python3 scripts/backup-host/bootstrap-staging.py infra/backup/bootstrap-request.json --prepare
```

The agent records that approval against the package digest, verifies the actual
fresh staging metadata, records the attended execution window and runs the pinned
launcher with `--execute`. Do not edit flags to substitute for owner authorization.
If code/package hashes changed, reconcile before execution. There is no reason
to reapprove the earlier operating-model plan.

After successful installation, the owner's exact protected handoff command is:

```sh
sudo python3 scripts/backup-host/bootstrap-staging.py infra/backup/bootstrap-request.json --handoff-maintenance
```

It refuses incomplete installation, a changed handoff target, unsafe source/target
custody or an existing target password. No credential should be pasted into chat.

## Staging parent-check correction — October 22, 2026 (+08:00)

The owner's staging attempt refused `unsafe_parent`. The helper incorrectly
required every ancestor to be root-owned, although the installed backup host
preparer intentionally creates `/srv/myims-backup-development` as
UID/GID 12010, mode 0700. Metadata-only inspection confirmed this exact custody,
an empty root-owned mode-0700 `bootstrap` parent, and absence of both operation
directories. No credential contents or provider API were accessed.

The helper now allows only that exact service-owned ancestor with exact UID/GID
12010 and mode 0700. Other ancestors must be real root-owned directories, with
root group and no group/other writes. It validates both complete ancestor chains
before creating any missing parent. Existing host ownership and operation paths,
nine provider writes, guard and cleanup behavior are unchanged. Existing operation
directories still refuse reuse; the empty parent from the failed attempt is safe.

Seven focused package/staging tests pass, including exact-path/custody negatives
and refusal before mkdir. The original owner approval remains recorded against
`07907f91e232a093bd0d125413995d03c8099fa0ae887c5232c9859338eacc85`. The corrected package is
`76ac9c1e4e280427145290dbd08569175e3b618486ef094ef93e1bb7e5d2fbc4`; only the pinned staging helper changed.
Retained/root execution flags remain false until the owner approves this corrected
source binding. No new root attempt or execution window has started. The owner can
rerun the same administrator staging command above; after successful preparation
and acceptance of this correction, the agent verifies staging and continues.
