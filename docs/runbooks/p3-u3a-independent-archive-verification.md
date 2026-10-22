# Independent snapshot and audit archive verification

October 22, 2026, Asia/Manila (+08:00). This step exports only ciphertext and
public receipts from the exact previously verified post-install repository
snapshot, then verifies decryption and internal integrity on the owner's machine.
It does not restore OpenBao, use the seal, reconcile PostgreSQL or activate a
schedule. Keep the private recovery key on its existing owner-controlled machine.

## Exact source and first command

**Current retained export is complete and independently hash/custody verified:**
`f870564b-45b5-4b34-a5c9-949df4a35194`. [Export evidence](../status/p3-u3a-retained-verification-export.json).
Continue with the owner-run Windows steps below; do not rerun the export.
Off-host copy and owner-key decryption are still pending.

The [public verification request](../planning/p3-u3a-fresh-backup-verification-request.json)
binds repository ID, Restic snapshot, the original execution evidence hash,
two ciphertext hashes/lengths and both public receipt hashes. It selects snapshot
`c51f8a679a86d29265af9b4588b1f76d537e7cacb09ce1bc75e660bd60015324`,
from bootstrap operation `d6550071-561a-4339-bc15-50a5b22ac43d`.
This is the pinned installation checkpoint, not an automatic selection of a
newer routine backup or proof that an RPO target has been met.

The expected SHA256 of the exact public request bytes is:

```text
2a0f686e9097a72ab6875273aaf6b6cd8c05c8488bc0323cbba93e84343c222b
```

From the server's project directory, preview with
`python3 scripts/backup-host/export-backup-verification.py`. To retrieve and hand
off the ciphertext in a new, private owner directory:

```sh
sudo env PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/export-backup-verification.py --export
```

The export uses only the private TLS repository network and read-only file client
credentials. Restic runs `cat config`, exact `ls` and `dump` with `--no-lock` and
`--no-cache`; no repository lock, initialization, upload, prune or OpenBao access.
It requires the exact four snapshot files and independently verifies retrieved
hashes/lengths and receipt bindings before handing off five files (including the
public request). The host copy checks custody, copies through anchored directory
descriptors and creates owner UID/GID 1002 mode-0600 files under mode-0700 custody.
It never reads an age identity, seal or plaintext snapshot.

Successful output is `ciphertext-verification-exported`, with `ownerDirectory`
and `requestSha256`. Preserve that sanitized output. Source staging remains in
`/srv/myims-backup-development/verification-exports/<export-id>`; owner ciphertext
is in `/home/gino/.myims-backup-verification/<export-id>`. Both are fresh paths;
no earlier output is overwritten or deleted. On failure, the report identifies
possible partial paths; retain them for review. Read-only retrieval may be run
again into a new UUID directory after diagnosing the failure. No automatic retry
is performed, and an old directory is never repaired or reused.

## Owner-run offline verification

Prerequisites on the owner's computer: Node.js 22 or newer and the existing `age`
executable on PATH. The verifier is JavaScript using Node built-ins and the
existing snapshot integrity parser; no package installation is needed. The
Windows path is prepared but requires actual owner execution for acceptance.
The existing private key file should retain its already verified account-only
custody. The Node verifier does not audit Windows ACLs. It checks regular,
single-link key input and additionally checks private mode/owner on POSIX.

On Windows PowerShell, create a fresh working directory. The command below
already selects the verified export. Use your established SSH host
alias if it differs from `helicalsvr`:

```powershell
$VerificationRoot = Join-Path $env:USERPROFILE ('MyIMS-Archive-Verification-' + [guid]::NewGuid().ToString())
$null = New-Item -ItemType Directory -Path $VerificationRoot
$null = New-Item -ItemType Directory -Path "$VerificationRoot\scripts\backup-recovery" -Force
$null = New-Item -ItemType Directory -Path "$VerificationRoot\scripts\openbao" -Force
scp -r "gino@helicalsvr:/home/gino/.myims-backup-verification/f870564b-45b5-4b34-a5c9-949df4a35194" "$VerificationRoot\bundle"
scp "gino@helicalsvr:/home/gino/projects/IMS-rebuild/scripts/backup-recovery/verify.mjs" "$VerificationRoot\scripts\backup-recovery\verify.mjs"
scp "gino@helicalsvr:/home/gino/projects/IMS-rebuild/scripts/backup-recovery/request.mjs" "$VerificationRoot\scripts\backup-recovery\request.mjs"
scp "gino@helicalsvr:/home/gino/projects/IMS-rebuild/scripts/openbao/recovery-snapshot.mjs" "$VerificationRoot\scripts\openbao\recovery-snapshot.mjs"
```

Stop if any copy fails; do not continue with partial input. Disconnect networking
before the verification command if you want an OS-level offline run. The verifier
itself makes no network or repository requests. The key remains at its current
local path; do not copy it into the bundle, server, workspace or chat:

```powershell
$RecoveryIdentityFile = Read-Host 'Full path to your existing private age key FILE (not its contents)'
node "$VerificationRoot\scripts\backup-recovery\verify.mjs" `
  --request "$VerificationRoot\bundle\verification-request.json" `
  --request-sha256 "2a0f686e9097a72ab6875273aaf6b6cd8c05c8488bc0323cbba93e84343c222b" `
  --bundle "$VerificationRoot\bundle" `
  --identity "$RecoveryIdentityFile"
if ($LASTEXITCODE -ne 0) { throw 'Archive verification stopped; preserve inputs for review.' }
```

The same Node invocation works on an owner-controlled POSIX machine with its local
paths. Save any JSON report outside the bundle directory. The bundle must contain
exactly the five declared input files; additional scripts/reports are rejected.

The verifier checks the separately supplied request digest and exact bundle
members, ciphertext and receipt hashes before invoking age. Verified ciphertext
bytes are passed to age over stdin; decrypted archives go only to memory.
Strict bounded tar parsing rejects links, traversal, duplicate/extra entries,
invalid checksums, sizes, padding and incomplete end blocks. No archive is
extracted and no plaintext file is written. Internal manifests bind every member.
Snapshot metadata/state SHA256, receipt and token-cleanup binding are checked;
the separate audit archive must contain complete valid JSON lines and its bound
hash. Wrong keys and tampering fail with a sanitized message.

Success prints `independent-archive-integrity-verified`. Share only that JSON
result, never private key or archive contents. Success establishes decryption and
integrity for this exact pair. It explicitly reports sealed-checksum cryptographic
verification, native restoration, audit continuity and joint PostgreSQL recovery
as unproven. A compatible isolated native restore using independently held seal
material, matching PostgreSQL recovery point/generation reconciliation, measured
RPO/RTO and operational acceptance remain before scheduling/readiness.

## Implementation evidence

The [verification evidence](../status/p3-u3a-independent-archive-verification.md)
records focused wrong-key/tamper/archive tests and disposable TLS/Raft OpenBao plus
authenticated TLS/append-only Restic retrieval and actual age decryption. The
fixture owns its own keys, provider, repository and outputs. Native fixture
success does not replace owner off-host execution or retained administrator
handoff acceptance. No retained export or owner private-key use occurred during
implementation.
