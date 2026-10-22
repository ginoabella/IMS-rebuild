# Isolated PostgreSQL/OpenBao recovery rehearsal

October 22, 2026, Asia/Manila (+08:00). **Fixture-only paired capture, encrypted
round trip, native restores and report-only generation reconciliation implemented.**
This does not authorize retained restore, credential activation or scheduling.
Owner-side decryption of the retained export is still pending independently.

## Implemented boundary

`scripts/backup-evaluation/check-joint-recovery.py` creates only fresh UUID-labeled
PostgreSQL and OpenBao fixtures. It accepts no retained target, key, source path,
network or volume arguments. PostgreSQL containers have network none and tmpfs
data. OpenBao instances use independent private internal networks, TLS, separate
Raft/audit volumes, no published ports, and generation endpoints disabled.
Only configuration and public source scripts are mounted from the checkout;
no retained credentials/data, Docker socket or application environment is mounted.

The fixture applies every actual repository SQL migration and the existing trunk
owner foundation acceptance seed. Its `_prisma_migrations` table is the same
minimal fixture metadata stub used by the owner foundation checks; this does not
test deployment migration history. The retained owner reference is a **cancelled
reservation**, preserving canonical node, installation, binding, peer, generation,
operation, ordinal/version and purposes. It is not a usable trunk credential.

The fixture writes corresponding synthetic KV-v2 version-1 material using CAS=0,
configures bounded read-only recovery authentication, then revokes its initial
root/403 before capture. With all fixture writers quiescent, it captures an actual
PostgreSQL custom-format dump and native Raft snapshot and binds both hashes to
one fixture checkpoint. The independent audit is included. A network-disabled
helper uses a fresh synthetic age key, encrypts the bundle, decrypts it, validates
strict members and every internal hash, and returns the verified synthetic bytes
to the private driver. Plaintext archives exist only in helper tmpfs or process
memory; restored data belongs only to the fresh fixture stores.

The matching PostgreSQL dump is restored with native `pg_restore`, including
actual schema, data, roles/grants and audit records. Custom roles are restricted
to the migration-created `myims_` scope and preserve their login/inheritance flags;
superuser/create-role/create-database/replication/bypass-RLS authority is refused.
The restored runtime reads the safe owner view while direct generation-table
reads and escalation to the owner role still deny with SQLSTATE 42501.

OpenBao restores use exactly one force-restore POST per newly initialized,
scope-checked fixture target, then restart, reject a wrong seal and unseal with
the **source fixture seal**. Force is required for the target's initially different
seal; it bypasses the snapshot sealed-checksum gate. Successful unseal/read is
native evidence for this synthetic dataset, not a separate cryptographic check
of `SHA256SUMS.sealed`, or authority for a retained force restore. The target's
discarded initial root is verified denied. Fresh 60-second scoped logins perform
read-only verification and always self-revoke/403; force restore and policy writes
deny for that reader. Cross-network TCP probes cannot reach the source.
Raw-IP host fixture probes trust the synthetic certificate with hostname matching
disabled; this is not production client TLS verification acceptance.

Restore can revive tokens present in the snapshot. The driver checks all known
owned sessions on each clone, self-revokes any still live, and confirms subsequent
lookup 403. It does not use these transported sessions for installation or data
verification. Only fresh scoped authentication verifies data. This accounts for
known fixture sessions, not unknown real tokens, accessors, leases or workers.

## Report-only reconciliation and fault checks

`scripts/backup-recovery/reconcile.py` is a pure comparator with no connections,
plaintext secrets, writes or repair. It requires explicit inventory completeness,
strict safe projections and unique exact installation/binding/generation keys.
It compares every provider material identity field, current KV version, deletion
and destroyed state. Node/owner revision and reservation state come from PostgreSQL;
node identity is not invented as an additional provider envelope field.
Malformed or incomplete inputs cannot turn absence into a successful comparison.

Reports identify missing material, material without an owner, mismatched identity,
non-version-1 data, deleted or destroyed material. They never echo extra fields or
secret material. `runtimeUseAllowed` is **always false**, including a perfect match.
Matching provenance proves neither current business authority nor lifecycle
eligibility, accepted binding, claim/adoption freshness or carrier usability.
This component is not wired into application admission or a retained restore tool.

After checkpoint capture, the native fixture deliberately writes version 2 and
an orphan generation into the source. The normal pair hash gate rejects pairing
that later snapshot with the older PostgreSQL dump **before restore**. A separate
negative-test clone intentionally restores the mismatched snapshot to exercise
post-restore detection against real KV state. That explicit fixture fault injection
is not a bypass/resume path for a rejected retained checkpoint.
The correct clone still matches the older checkpoint; the negative clone reports
both version drift and an orphan; the source retains its later changed state.

Cleanup checks exact creation ownership labels before deleting any container,
volume or network; pre-existing volume/network names refuse. Public evidence
records hashes, safe reports, timing and cleanup, never a dump, seal, token,
password or material hash. All private fixture resources and temporary keys are
removed on normal completion and caught failure. Abrupt driver death is not
fault-rehearsed; do not infer that it cleaned up. Reconcile exact UUID-labeled
fixture resources before any manual cleanup.

## Verification and remaining acceptance

Final result: **11/11 native groups** and **8/8 focused groups** passed.
Final native operation: `d7bc6241-4cde-4b18-91b7-ad004b56e41a`. All exercised source
hashes match. All fixture containers, volumes, networks and private key/config
directories were removed. Scoped ESLint/Prettier, Python syntax, local links and
diff whitespace checks passed; all 67 consumed-bootstrap artifacts are unchanged.
Full application suites were not rerun for this deployment-only fixture step.

Observed paired capture/encryption/decryption: **3.868s**.
Fresh target provisioning, both restores, positive/negative reconciliation and
isolation checks: **62.385s**. These are fixture
exercise timings, not service-level recovery measurements. The known restored
sessions checked/revoked on each clone are recorded in the machine evidence;
no token value is present in the report.

Run from the project root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-recovery/reconcile.test.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-evaluation/check-joint-recovery.py
```

The [native evidence](p3-u3a-joint-recovery-native.json) and per-operation records
under [disposable runs](p3-u3a-disposable-runs/) preserve results. Focused checks
cover exact/terminal identity matching without activation, every identity-field
mismatch, missing/orphan/version/deletion/destruction cases, duplicates, unknown
secret fields/type errors, incomplete inventories, checkpoint hash/operation/scope
binding and refusal to clean up foreign resource labels.

The first native attempt caught a fixture setup error: initial root revocation
also revoked the mutation token needed for the deliberate post-checkpoint fault.
The fixture now explicitly creates that narrowly scoped mutation token as a
300-second orphan before revoking root, then revokes it after generating drift.
Failed-run resources were removed and their failure evidence preserved.

This unit proves only the disposable migration-owned trunk foundation path.
It does not include Restic transfer in the joint exercise; the separately tested
encrypted archive retrieval/decryption path remains a distinct composition
boundary. It does not prove whole-application recovery, active credential binding,
all endpoint/trunk/worker/outbox reconciliation, historical transaction-fence
behavior after logical PostgreSQL restore, complete real lease/accessor handling,
off-host key availability, continuous audit or application restart/admission.

Observed fixture capture and restore/reconciliation times include fresh target
provisioning and the negative test. They are not an achieved production RPO/RTO or
the proposed two-hour/four-hour objectives. A production-quality checkpoint needs
an independently proven coordinated write boundary, complete dependency and
credential-generation inventories, compatible retained restore/seal handling,
post-restore authority fencing and operator approval of exact target scope.
Scheduling remains inactive. Existing renewal HTTP 500/fractional-expiry/browser,
focused lifecycle and trunk/gateway/two-HTTP acceptance remain open.

The owner's next independent action remains the
[filled-in Windows copy and offline verification steps](../runbooks/p3-u3a-independent-archive-verification.md#owner-run-offline-verification)
for the already exported retained ciphertext. No private key should be sent here.
