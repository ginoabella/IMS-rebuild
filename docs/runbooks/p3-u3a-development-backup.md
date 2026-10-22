# P3-U3a development backup operations and maintenance

Current checkpoint: October 22, 2026 (+08:00). **Snapshot and maintenance
identities installed; two fresh encrypted backups retrieved; owner password
handoff complete. Scheduling and recovery readiness remain incomplete.**

Current guidance and completed password handoff evidence are in the
[retained execution evidence](../status/p3-u3a-bootstrap-retained-execution.md).
The [operator command guide](../status/p3-u3a-backup-operations.md) now provides
status, explicit run-now and attended rotation, including uncertainty handling
and the disposable-native verification boundary. Start with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py status
```

The [independent archive verification guide](p3-u3a-independent-archive-verification.md)
now provides exact read-only ciphertext export and owner-run offline integrity
verification. Retained export/off-host owner execution is pending; no private key
should be copied to this server.

The [isolated joint-recovery rehearsal](../status/p3-u3a-isolated-joint-recovery.md)
now exercises native PostgreSQL/OpenBao restore and report-only trunk generation
comparison using disposable data. It grants no retained restore or credential-use
authority and does not satisfy complete application recovery or scheduling gates.

Track remaining work in the [progress tracker](../../context/progress-tracker.md)
and [approved operating model](../planning/p3-u3a-backup-authority-next-step.md).

## Current resources and custody

| Resource | Current state / responsibility |
| --- | --- |
| Bootstrap operation | `d6550071-561a-4339-bc15-50a5b22ac43d`; approved execution consumed, nine writes acknowledged, root revoked/403 and protected restoration verified. No replay. |
| Provider | `myims-rebuild-dev-endpoint-secrets-1`; normal TLS/HCL/mounts/private network/restart policy restored, active health and anonymous generation 405 verified. |
| Snapshot identity | Dedicated `platform-backup` AppRole, `platform-raft-snapshot-reader`; no default policy, 300-second token maximum; initial SecretID 30 days/1,000 uses. Custody only in protected operation `snapshot-credentials`, never application mounts. |
| Attended maintenance | `gino`, separate `platform-backup-maintainer` account, 900-second maximum, constrained rotation policy; password handed off to `/home/gino/.openbao-backup-maintainer/password`. Existing custodian account preserved. |
| Plaintext and protected outputs | `/srv/myims-openbao-recovery-development/d6550071-561a-4339-bc15-50a5b22ac43d`; preserve sensitive capture, separate credentials, maintenance output and install state; never copy into checkout/logs. |
| Storage | `myims-backup-development-rest-server-1`; append-only private authenticated TLS, UID/GID 12010, 2-GiB development cap. Same physical host; host-loss recovery unproven. |
| Repository | ID `8f2337728f88192a57301f5ee51e405a6625955054c15079675fbdf907b8da6b`; separate pre/post snapshots and exact four-file retrieval recorded in execution evidence. Already initialized; never reinitialize. |
| Recovery keys | Owner holds separate Windows recovery material; private age key stays outside MyIMS. Fresh ciphertext retrieval does not prove independent decryption or joint recovery. |
| Activation | Status/run-now/attended rotation commands implemented; retained mutation acceptance and recovery/alerts/capacity remain. No timer or continuous audit collector activated. |

The earlier capture operation `24096f3d-bf41-4ec2-9e12-95e2057c115d` is also
closed and consumed. Its [historical evidence](../status/p3-u3a-development-capture-execution.json)
and artifacts remain preserved. Do not repeat old staging/capture/init/upload
commands. The administrator password handoff is complete; do not rerun it. Deletion needs a separate exact cleanup decision.

## Repeatable offline authority comparison

This command is read-only and has no network or provider login. Run from the
repository root as a trusted Docker operator. Review script/generator changes
before rerunning: a changed generator changes the comparison baseline. It emits
sanitized JSON to stdout; save to a new review artifact rather than overwrite
historical evidence. It fails closed if the fixed source digest or operation ID
does not match. Do not replace the source path with a credential/live volume.

```sh
docker run --rm --network none --user 1003:1003 --read-only \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 128m --pids-limit 32 \
  --mount type=bind,src=/srv/myims-openbao-recovery-development/24096f3d-bf41-4ec2-9e12-95e2057c115d/capture/inventory.json,dst=/input/inventory.json,readonly \
  --mount type=bind,src="$PWD/scripts/openbao",dst=/review,readonly \
  --entrypoint node \
  sha256:3abcd3135ba8a4b7c924792f4ecf760ba6b2020f193338cbba91191eae8d67d1 \
  /review/review-captured-authority.mjs
```

Local reviewer checks: `node --test scripts/openbao/review-captured-authority.test.mjs`.
A successful review exit means comparison completed; inspect `status`, blockers,
policy differences and compared role fields. It never establishes current
effective authority or grants execution permission. Leave the earlier
pre-succession inventory checker unchanged.

## Failure handling and maintenance gates

| Trigger                                                         | Operator action                                                                                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline digest/operation mismatch                               | Stop; preserve paths/hashes and investigate source provenance. Do not substitute a different inventory or relax the digest.                                                                                 |
| New policy/role difference                                      | Record hash and compared field names; review against intended contract. Do not auto-remediate, suppress or treat matching names as safe permissions.                                                        |
| Ambiguous upload/provisioning result                            | Preserve receipt/intent; reconcile exact operation and destination read-only under its authorized scope. No automatic retry, repository reinitialization or duplicate credential generation.                |
| Provider health/seal/configuration concern                      | Use the provider incident process and trusted host operator. This runbook authorizes no unseal/recovery/restart. Never reuse the consumed capture approval.                                                 |
| Capacity/freshness/verification failure after future activation | Alert assigned operator, stop affected work and retain evidence. No deletion/prune or credential expansion as a workaround.                                                                                 |
| Credential expiry or rotation needed                            | Before activation, agree rotation owner, authority, lead time and exact replacement/revocation steps. Never log SecretIDs/accessors; verify replacement before controlled old-credential retirement.        |
| Restore exercise                                                | Require independent keys, isolated destination, compatible provider/seal, matching PostgreSQL point and generation reconciliation; measure data-loss/time bounds. Source overwrite is outside this runbook. |

Candidate settings remain **unapproved**: hourly snapshots at minute 10 UTC;
30 days hourly / 12 months monthly / 13 months audit retention; weekly repository
check, monthly full read, quarterly restore; development RPO 2 hours / RTO 4 hours.
They are not active schedules or achieved service levels. Record approved values,
owner, timezone, alert route, failure budget and evidence before activation.
Continuous audit collection is not established by the two captured audit archives.

Ordinary upload credentials must remain unable to overwrite/delete/prune existing
data. Administrative pruning needs separate authority and reviewed retention and
recovery evidence. Production also needs independently administered physical
storage and an additional independently protected copy or reviewed safeguard.

After every approved operation, update the tracker, immutable operation evidence,
custody inventory, installed artifact hashes and this current-state table. Record
test failures and unresolved findings without converting a successful substep into
P3-U3a completion. Fresh decryption, native/joint restore, ongoing authority review,
ongoing operations, trunk/gateway integration and existing lifetime/HTTP/browser
issues remain open.
