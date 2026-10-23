# P3-U3a backup operator commands

October 22, 2026, Asia/Manila (+08:00). Status, explicit run-now and attended
credential rotation are implemented after the completed bootstrap/handoff.
Scheduling, independent recovery readiness and P3-U3a remain incomplete.

## Failed-operation local inspection complete — October 23, 2026 (+08:00)

The owner successfully ran the administrator-only inspector. [Exact report](p3-u3a-backup-operation-local-inspection.json).
Snapshot/encrypted/spool/receipt directories are empty, only the staged audit
remains (2 files / 477,406 bytes), and the journal records no upload stage.
The attempt has no cleanup result. Preserve pending/journal/staged evidence;
this report does not close the operation or authorize another run. Local
inspection is complete; next prepare the separately authorized guarded mount
correction, then evidenced closure and verified replacement under the repair gates.

## Snapshot login expiry diagnosed — October 23, 2026 (+08:00)

Actual audit issuance TTL was 300 seconds: the AppRole mount ceiling clipped the
requested 30-day SecretID. The failed operation reached login after expiry.
[Diagnosis](p3-u3a-backup-secretid-expiry-diagnosis.json) and
[exact proposed correction / required execution gates](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-backup-secretid-ttl-correction.md).
Local status and capture cutoff now account for the source-bound initial mount
ceiling, with **14/14** focused checks passed. Routine replacements continue to
require actual 30-day TTL verification before adoption. The previous 30-day-only
status output is historical and was misleading for this initial generation.
Do not retry or rotate yet: the mount is unchanged and this exact operation remains
pending until attended reconciliation. The proposed mount correction requires a
new authorized guarded package, not reuse of consumed bootstrap authority.

## Retained run-now unconfirmed — October 23, 2026 (+08:00)

The owner's first `run-now --execute` returned `operation-unconfirmed` with
`details-suppressed`; [exact output](p3-u3a-backup-operations-run-now-unconfirmed.json).
Completion, failure phase and side effects are unknown. Do not retry, rotate or
clear pending records. Next obtain read-only administrator status and reconcile
its exact operation evidence. Agent cannot read root-owned runtime evidence
because sudo requires interactive authentication. Scheduling remains inactive.

## Retained acceptance checkpoint — October 23, 2026 (+08:00)

Owner-reported administrator status passed: host metadata verified, no pending
operation, no age cutoff/reminder and no attention flag. The last successful backup
is still the bootstrap snapshot whose owner Windows integrity verification passed.
[Administrator status report](p3-u3a-backup-operations-admin-status.json).
This status performs no provider login or repository query. Next run one attended
`run-now --execute` from the project root, then inspect its result before rotation.
If it fails or leaves pending state, preserve the operation and diagnose it;
no automatic retry or pending-state removal. Routine backup/rotation acceptance
and scheduling readiness remain incomplete.

## Commands and boundaries

Run from the project root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py status
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py run-now
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py credential-rotate
```

Status reads sanitized operation evidence and current Docker metadata.
An unprivileged invocation reports `runtimeState: administrator-required`; it
never treats hidden root-owned records as absent. Use administrator status for
the current generation, pending state and last successful routine backup. It does
not read credentials, log into OpenBao, query the repository or test live provider
health. With administrator access and no routine operation yet, it reports the bootstrap's verified retrieval;
afterward it reports the last successful routine backup independently of the last
rotation/failure. Remaining SecretID use count is explicitly unknown. Verified 30-day generations use a day-23
rotation reminder and day-30 capture cutoff. The initial generation is additionally
bounded by the source-bound bootstrap auth mount maximum (300 seconds); its
reminder/capture cutoff cannot exceed that lifetime. These are conservative local
issuance/lifetime bounds, not live expiry assertions. `attentionRequired` reports host uncertainty,
inaccessible runtime state, a pending/failed operation or a due rotation reminder.
It does not assert achieved freshness, RPO/RTO or readiness.

The other two invocations above print plans only. Explicit mutations require an
attended host administrator, not an OpenBao root token:

```sh
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py run-now --execute
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py credential-rotate --execute
```

Do not paste either password, SecretID or accessor into chat. Use administrator status for the complete local report:

```sh
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.py status
```

These commands are development-only. There is no scheduler activation, root
generation, provider restart/unseal, repository init, restore, pruning or external
notification send. Existing consumed bootstrap inputs/approvals and historical
artifacts are preserved.

## Execution and failure behavior

The root-owned runtime directory is
`/srv/myims-openbao-recovery-development/backup-operations`. Both mutations take
one nonblocking host lock. Each operation has a fresh UUID, private directories,
fsynced pending intent and status/journal. Concurrent runs refuse. A leftover
pending operation blocks both mutations, including after process death. Failure
records are local and sanitized; alert delivery remains unestablished.

Run-now checks the protected provider, private networks, pinned dependencies and
append-only TLS storage, then checks the already initialized repository ID. It
captures an independent audit archive and uses only the current snapshot AppRole
for snapshot capture. The capture token is revoked/403 before snapshot release.
Encryption is offline, handoff is ciphertext-only, and upload/retrieval uses only
the repository network and file-based client credentials. Success requires the
exact four ciphertext/receipt files with matching retrieved hashes/lengths.
It reuses the existing verified snapshot/audit archive formats and verifier;
that reuse does not run the bootstrap controller or issue root.

Rotation mounts the owner's password file only inside a dedicated helper, without
repository credentials, seal or installer material. Its first bounded maintenance
session issues one exact 30-day/1,000-use SecretID, persists private replacement
material and validates metadata, workload policy/lifetime/denials and workload
self-revoke/403. Maintenance self-revoke/403 is required before adoption.
An atomic fsynced active-generation pointer then adopts the verified replacement.
A second bounded maintenance session retires the prior accessor, verifies its
absence and old-login denial, and self-revokes/403. Snapshot helpers receive only
the generation's RoleID/SecretID/CA directory; accessor and human password custody
remain separate. Previous generation files remain preserved.

No uncertain issuance, login, retirement or upload is retried automatically. A
lost issuance reply leaves the previous generation active. A lost retirement
reply preserves the adopted replacement and records reconciliation pending;
there is no automatic rollback. On interruption, tokens can remain until their
300/900-second explicit expiry if cleanup cannot be confirmed; success is never
reported for that state. A helper may still be finishing when its host client
times out. Check the exact operation/helper and pending journal before any
attended reconciliation. There is no force, retry, clear-pending or repair flag.
Do not delete pending state to bypass this gate or regenerate credentials blindly.

## Verification and remaining work

Final verification: **14/14 native groups**, **11/11 host tests**, **6/6 rotation
tests**, plus **17/17** existing package/controller/bridge regressions passed.
Scoped ESLint/Prettier, Python syntax, local links and diff whitespace passed.
The final native operation is `8fd8fa7c-29f3-48ff-907c-3804ddff8db6`; all pinned exercised source
hashes match and all fixture containers, volumes, networks, private files and the
deadline watcher are removed. The [retained metadata-only status](p3-u3a-backup-operations-status.json)
verified the protected host and correctly reports that private runtime status
requires administrator access. All 67 consumed-bootstrap artifact hashes remain
unchanged. Full application suites were not rerun for this deployment-only unit.

The [native fixture evidence](p3-u3a-backup-operations-native.json) records the
TLS/Raft OpenBao and authenticated TLS/append-only Restic checks, exact source
hashes and fixture cleanup. The fixture runs a synthetic bootstrap to prepare its
own identities, then exercises the actual operator backup/rotation methods and
helpers: run-now, verified replacement/adoption/retirement, and a second retrieved
backup using the new identity. Host ownership changes use a fixture-only helper
because the driver is unprivileged; retained administrator execution and its
actual filesystem custody remain a separate attended acceptance boundary.

Focused host tests cover concurrent exclusion, durable uncertainty fences,
exclusive/atomic records, credential age refusal, preservation of the last backup,
and adoption ordering under lost issuance/retirement replies. Rotation tests cover
one exact issuance, wrong workload bounds, uncertain cleanup, retirement/old-login
denial and input refusal. Mocks verify failure contracts; the successful provider
and repository path is native. No retained backup login/rotation/upload was run
for this implementation. Retained status is metadata-only.

Reproduce:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/backup-operations.test.py
docker exec -w /workspace myims-rebuild-dev-workspace-1 node --test scripts/backup-operations/rotation.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-evaluation/check-bootstrap-controller.py --operator-commands
```

Next are attended retained command acceptance, independent fresh archive
decryption with owner-held recovery material, isolated PostgreSQL/OpenBao joint
recovery and generation reconciliation, measured RPO/RTO and agreed
alerts/capacity/rotation operations before any schedule. No cadence or retention
proposal becomes active through these commands. Existing renewal HTTP 500,
fractional-expiry, browser and trunk/gateway acceptance findings remain open.
