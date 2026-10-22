# P3-U3a development backup operations and maintenance

Current checkpoint: October 22, 2026. **One-time capture/upload complete;
unattended backup and recovery readiness incomplete.** Track work in the
[progress tracker](../../context/progress-tracker.md), review the
[authority findings](../status/p3-u3a-captured-authority-review.md), and use the
[approved model and gated installation direction](../planning/p3-u3a-backup-authority-next-step.md)
for remaining authority/installation work. The [exact narrowed rotation candidate
and native verification](../status/p3-u3a-backup-maintenance-review.md) supersedes
the older broad maintenance candidate; no rotation command is installed yet.

## Resources, custody and completed operation

| Resource            | Current state / responsibility                                                                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operation           | `24096f3d-bf41-4ec2-9e12-95e2057c115d`; root recovery, repository initialization, capture and upload consumed. No automatic retry.                                                                                                                                               |
| Provider            | `myims-rebuild-dev-endpoint-secrets-1`; protected configuration restored, root revoked/lookup 403. No dedicated backup identity installed by the completed operation.                                                                                                            |
| Capture source      | `/srv/myims-openbao-recovery-development/<operation>/capture`; root-protected enclosing directories, capture UID/GID 1003. Contains sensitive plaintext; preserve, do not copy into checkout or log.                                                                             |
| Storage             | `myims-backup-development-rest-server-1`; append-only, private authenticated TLS, UID/GID 12010, 2-GiB development cap. Same physical host accepted for development; host-loss recovery unproven.                                                                                |
| Repository          | ID `8f2337728f88192a57301f5ee51e405a6625955054c15079675fbdf907b8da6b`, version 2. Snapshot `e259689800a00c5a42109a9c8e72a49a6a908bc659ea79a3f9dc0b1ca0d10582`.                                                                                                                   |
| Custody             | Owner holds separate Windows recovery material; archive private age key stays outside MyIMS. Prior Windows package checks do not prove decryption of this fresh uploaded archive. Passwords, seal material and repository credentials remain outside reports/application mounts. |
| Operating ownership | `gino`: current trusted host administrator and human custodian owner. Capture helper UID 1003 and upload UID 12010 are execution identities, not unattended operational ownership. Installer, rotation/job/audit/alert/recovery owners need explicit assignment.                 |

The [operation evidence](../status/p3-u3a-development-capture-execution.json)
records both ciphertext hashes, upload receipt and exact four-file read-only
retrieval verification. Source plaintext, ciphertext spool, receipts, closed host
intent/config/executed source and closed deadline record remain accounted for.
Deletion requires a separate exact cleanup decision after recovery/custody review.
Do not repeat old staging/handoff/capture/init/upload commands.

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
P3-U3a completion. Fresh decryption, native/joint restore, effective authority,
ongoing operations, trunk/gateway integration and existing lifetime/HTTP/browser
issues remain open.
