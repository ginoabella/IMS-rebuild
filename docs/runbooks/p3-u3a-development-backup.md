# Development backup operations

Updated October 23, 2026, Asia/Manila (+08:00).
The owner approved the [simpler development model](../../context/feature-specs/p3-u3-development-resource-management.md).
Backup repairs and operational readiness are separate from P3-U3 feature delivery.

## Current state

- Existing OpenBao, Restic and append-only Rest Server are retained. Scheduling is
  inactive. No repository, key, snapshot, credential or staged output was deleted.
- The installation checkpoint was encrypted, uploaded and retrieved. Owner Windows
  verification successfully decrypted the snapshot/audit and checked integrity.
  [Owner report](../status/p3-u3a-owner-archive-verification.json).
- The first routine `run-now` failed: its initial SecretID was issued for **300
  seconds**, despite requesting 30 days. The auth mount maximum clipped its TTL.
  The local status/age check has been corrected; the retained mount is unchanged.
- Failed operation `ec0b8e2d-49d9-45e3-930e-6b769b58f103` remains pending. No snapshot
  was written or upload stage recorded; two audit files (477,406 bytes) remain
  staged. Cleanup has no confirmation receipt. [Inspection](../status/p3-u3a-backup-operation-local-inspection.json).
- Routine backup/rotation acceptance, native retained restore, coordinated PostgreSQL
  recovery and measured RPO/RTO remain incomplete. These are operational follow-ups,
  not blockers to independent trunk/gateway/DID CRUD.

## Available command

From the Linux project root, local administrator status is read-only:

```sh
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py status
```

Existing backup and rotation commands remain fenced by the pending operation.
Do not retry them or manually delete pending records. The next operational repair
must provide supported reconciliation and a sustainable administrator path under
the simpler model. The old proposal to build another guarded root package is
paused; it is not the next P3-U3 task. Manual encrypted backup remains the intended
development workflow once this access/configuration problem is repaired.

## Owner Windows paths

- Backup identity: `C:\MyIMS-Recovery\myims-age-identity.txt`.
- Passphrase-encrypted identity copy from command history:
  `C:\MyIMS-Recovery\myims-age-identity.escrow.age` (current recoverability not rechecked).
- The separate OpenBao seal wrapping identity remains in its existing Windows
  custody folder; do not substitute it for the backup identity.

[Completed verification instructions and exact working directory](p3-u3a-independent-archive-verification.md#recorded-windows-locations)
remain available. Keep private keys on Windows; copy only ciphertext/public reports.

## Operational follow-up

Use one practical development administrator, a usable snapshot service credential,
and clear status/backup/replacement/reconciliation commands. Verify actual issued
TTL, retain encryption/integrity checks and preserve existing backups. Treat known
login rejection as a recoverable error; preserve uncertain write outcomes until
reconciled. No root recovery should be needed for ordinary maintenance once the
administrator migration is implemented.

Agree scheduling/retention/alerts and production recovery requirements in their
operational milestone. No proposed cadence is active. Historical design/review
material is in the [P3-U3 archive](../archive/p3-u3/2026-10-23/README.md);
[backup architecture](../architecture/backup-platform.md) defines current scope.
