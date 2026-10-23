# Backup SecretID lifetime correction

October 23, 2026, Asia/Manila (+08:00). Preparation only; retained execution is
not authorized by the consumed nine-write bootstrap approval. No retained mount,
role, policy, credential generation or pending operation has been changed here.

## Confirmed problem

The initial snapshot SecretID was issued at 2026-10-22 15:38:26 +08:00 with an
actual TTL of **300 seconds** and 1,000 uses. The auth mount maximum is 300 seconds,
which clips the requested 720-hour SecretID. Next-day `run-now` reached AppRole
login and received an error before snapshot capture. Owner status leaves operation
`ec0b8e2d-49d9-45e3-930e-6b769b58f103` pending. Last successful backup is still the
bootstrap checkpoint already independently decrypted on Windows.
[Diagnosis and provenance](../../../../../status/p3-u3a-backup-secretid-expiry-diagnosis.json).

This was an installation/acceptance defect: the role and requested duration were
checked, but the actual issued lifetime was not checked before initial adoption.
The previous local status age calculation incorrectly assumed 30 days. Local
status and pre-capture checks now derive the initial lifetime from the minimum of
the source-bound mount ceiling and role lifetime. They report the 300-second
bound and refuse expired credentials before login. A status check remains local,
not a live expiry/use-count query. All 14 focused host checks pass.

## Pending evidence checkpoint — October 23, 2026 (+08:00)

Owner capture-state listing returned only attempt
`f581c3c3-b082-468c-a8f5-40083f0df9fe`, started at
`2026-10-22T23:54:11.850Z`, with no result record in the supplied output.
[Exact owner record](../../../../../status/p3-u3a-backup-capture-attempt-unconfirmed.json).
This is not confirmed cleanup and does not prove a token remains active. The
original helper records acknowledged denied login cleanup only for HTTP 401/403;
a generic error alone is not a confirmed denial/cleanup receipt.

A read-only local inspector now collects the exact pending operation's journal,
strictly validated capture attempt/result records and counts/sizes for snapshot,
encrypted, audit, spool and receipt outputs. It never reads credential or snapshot
contents, contacts OpenBao/repository, changes pending records or authorizes retry.
Use from the Linux project directory:

```sh
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/inspect-backup-operation.py ec0b8e2d-49d9-45e3-930e-6b769b58f103
```

The administrator inspection has now completed; do not repeat it for this checkpoint.
[Exact owner-reported result](../../../../../status/p3-u3a-backup-operation-local-inspection.json).
The six-event journal ends at scoped capture start. Snapshot/encrypted/spool/receipt
directories are empty; only two staged audit files (477,406 bytes total) remain.
No upload stage was recorded. Preserve those files and the original pending/journal
records. No cleanup receipt exists, so this does not authorize retry or closure.

Six focused tests passed, covering unchanged inputs,
secret exclusion, private custody, symlink/malformed-journal refusal and denial
before access by nonadministrators. Host ownership is simulated in these tests;
actual administrator inspection now passed through owner execution. Even a complete local report
cannot itself prove provider token cleanup or close the operation.

## Exact target configuration

The proposed sole configuration write is:

```text
POST sys/auth/platform-backup/tune
```

```json
{
  "default_lease_ttl": "300s",
  "max_lease_ttl": "720h"
}
```

Keep the existing role `token_ttl`, `token_max_ttl` and `token_explicit_max_ttl`
at 300 seconds, nonperiodic, service type, no default policy and the exact snapshot
policy only. Keep SecretIDs at 720 hours / 1,000 uses. No role, ACL, custodian or
maintenance permission expansion is proposed. The mount change does not revive
the expired SecretID; a separately verified replacement is required.

The [pinned OpenBao disposable probe](../../../../../status/p3-u3a-secretid-mount-ttl-probe.json)
reproduces clipping. The [correction probe](../../../../../status/p3-u3a-secretid-ttl-correction-native.json)
uses the actual role/policy definitions: initial issued TTL 300; after this tuning,
issued TTL 2,592,000 seconds, 1,000 uses; workload lease and explicit maximum 300,
force-restore denied and workload self-revoke/403 verified. Both network-disabled,
in-memory fixtures were removed. These probes do not prove retained execution,
TLS, restore readiness or pending reconciliation.

## Required implementation and execution gates

1. Local inspection is now recorded: no snapshot output or upload stage; staged
   audit and original attempt/journal preserved. Preserve this exact operation's
   evidence and bind it into the corrective package. Confirm no owned helper
   remains, no snapshot was released and no upload started. Do not infer a confirmed
   token cleanup solely from a generic failed login event. No blind pending removal.
2. Establish a current authorized route for the one tuning write. The installed
   backup maintainer cannot tune mounts; do not broaden it or reuse the consumed
   bootstrap executor. If bounded recovered-root maintenance is necessary, prepare
   a new source-bound guarded package with its own explicit execution approval,
   independent deadline and protected restoration/revoke checks. Capture and
   independently retrieve a consistent encrypted pre-change snapshot/audit before
   the configuration write. The expired AppRole cannot provide that capture;
   the new package must explicitly supply the authorized backup route.
3. Verify exact mount and complete role pre-state, apply the single tune write,
   read back both and prove workload ceilings/denials unchanged. Revoke all owned
   administrative tokens and restore normal protected operation before routine use.
4. Close only the fully reconciled failed operation with a separate durable closure
   record under the operation lock; preserve original status, journal and artifacts.
   Implement/test this attended path before use; no existing clear-pending flag
   exists and manual deletion is not the procedure.
5. Use the installed maintenance account for replacement-before-retirement. Verify
   the actual issued TTL/use count and bounded workload auth before atomic adoption;
   handle an already expired/missing old accessor explicitly with absence evidence
   and old-login denial, preserving uncertainty fences. Confirm human/workload
   self-revoke/403. Do not issue a replacement while the mount still clips its TTL.
6. Run one fresh retained backup using the verified adopted generation and verify
   exact retrieval. Scheduling and recovery/operational readiness remain inactive.

No root execution approval is requested for this preparation document. A concrete
reviewable guarded package and reconciled pending evidence must come first.
