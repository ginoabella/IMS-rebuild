# P3-U3a — Backup authority preparation and simplified handoff

2026-10-21 UTC. Owner accepted the preparation plan and asked for assistance with
the custody requirements. **No retained recovery/provisioning is authorized.**

## Ready for the administrator

Run just this command:

```bash
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/check-development-readiness.py --install-public-recipient
```

The helper checks metadata of the exact seal, Restic and SMTP credential files.
It opens no secret contents, uses no network or Docker API, initializes no
repository and changes no OpenBao state. It creates only the supplied public age
recipient if absent, with root ownership, service group and mode 0440. It accepts
an identical protected existing file and refuses a different key or symlink.
Default invocation without the flag creates no file. Administrator execution is now owner-confirmed: `local_checks_passed`, matching
public recipient already installed (`installedNow=false`) and protected.

Four disposable tests passed: no default write, exclusive public installation and
repeat preservation, refusal to overwrite another recipient, and file/directory
symlink rejection. These tests use temporary files under the current UID; actual
root ownership is checked by the future administrator run, not claimed tested here.

Owner is the intended seal-key custodian. Storage on another host is the owner’s
requested planning assumption, not proof of transfer, separate protection or
recoverability. Restic credential escrow remains unverified. No agent export or
private-key read was performed. The administrator output is the next local
checkpoint; independent custody and any retained recovery stay separate gates.

## Disposable backup-before-provisioning evidence

Command:

```bash
python3 scripts/backup-evaluation/check-restic.py --development-artifacts --backup-first-provisioning --tools-image sha256:26377e0cd9b334596febb35685363ad108ef4ba0e2f81f8958a82bc009c92743
```

Final **39/39 passed**, exit 0, operation
`17af92f6-cde0-4648-99cd-a6574aaf3bc2`.
[Immutable run](p3-u3a-disposable-runs/17af92f6-cde0-4648-99cd-a6574aaf3bc2.json),
[latest machine evidence](p3-u3a-backup-first-provisioning-evidence.json).

The fixture validates native Raft snapshot/separate audit, age archive/manifests,
actual Docker helpers, TLS append-only Rest Server/Restic, client overwrite/delete/
forget denial, restart, archive retrieval/decryption and isolated native Raft
restore **before** checking target absence and issuing exactly the four manifest
backup provisioning POSTs. It reads back the snapshot-reader policy, 300-second
AppRole role/mount bounds and SecretID limits; revokes the temporary fixture
installer and confirms 403 before an independent AppRole capture/revoke/403.
A fresh encrypted post-provision snapshot and separate audit increment are then
committed and repository data checked. All exact fixture containers, volume,
network and temporary keys/directories were removed. No retained mounts or
credentials were involved. Original retained service and tooling tags unchanged.

The earlier run `98fb3674-df87-4673-9042-ece516aed0bb` failed before provisioning
because the pre-state probe attempted GET on an auth-enable path that supports
no such read. The corrected probe uses `GET sys/auth` to establish mount absence.
Failed evidence is preserved and cleanup passed.

This rehearsal begins with a newly initialized synthetic installer. It does **not**
exercise root generation/recovery, the retained seal key, a recovery listener
transition, whole current effective-authority inventory, independently held
recovery keys or joint PostgreSQL restoration. Therefore a complete retained
recovery request is **not execution-ready**. No four-write pre-backup exception
has been accepted; the fixture enforces backup-first order. Existing native token
renewal HTTP 500/expiry, retained lifetime and browser findings remain unresolved.
P3-U3a remains incomplete.

## Independent age check prepared for later assistance

[Challenge ciphertext](p3-u3a-age-decryption-challenge.age) contains only an
innocuous random message encrypted to the owner-supplied public recipient.
[Metadata](p3-u3a-age-decryption-challenge.json) records hashes; no private key
was generated/read and no backup/seal data was included. Decryption must take
place on the independently held private-key machine. It has not been performed
and is not an administrator action required by the single command above.

[Accepted preparation plan](../planning/p3-u3a-backup-authority-establishment-plan.md),
[disabled preparation manifest](../../infra/backup/authority-preparation-review.json).


## Administrator local-readiness result — October 21 (Asia/Manila, +08:00)

Owner reported `local_checks_passed`. The existing public recipient matches and
has the expected protected permissions. Seal, Restic password, REST credential
and SMTP password metadata checks passed. The command read no secret contents,
made no network requests, did not initialize the repository and made no OpenBao
changes. Independent custody and retained recovery readiness remain false.
The next assisted checkpoint is decryption of the innocuous age challenge on the
independent private-key computer; owner confirmed Windows; [PowerShell instructions](../runbooks/backup-key-check-windows.md) are prepared, with owner execution pending.


## Windows decryption passed; next assisted escrow handoff

October 21, 2026 (Asia/Manila, +08:00). The owner-reported plaintext SHA256
`adf8e0a83cdf13fa1cafcd3fe5b5113320f82e59822f0b09cc56bcb436a4a910`
exactly matches the prepared challenge. This verifies this owner-executed Windows
decryption exercise; it does not verify every private-key copy or real joint
recovery. No private key was handled by the agent.

Next host-administrator command, prepared but **not executed**:

```bash
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/export-restic-recovery.py --export
```

Running `--export` explicitly authorizes that local administrator process to read
only `/srv/myims-backup-development/client/repository.url`, `repository.password`
and `ca.crt`. It checks exact mode/UID/GID, regular/single-link files and non-symlink
directories, builds a small archive with integrity manifest in memory, then uses
pinned network-disabled age tooling as UID 1002 with no mounts to encrypt via
stdin. No plaintext archive is written to disk; secret bytes enter no argv/env/log.
No OpenBao seal key, private age key or SMTP password is included.

The exclusive encrypted output is
`/home/gino/.myims-recovery-transfer/restic-recovery.age` (0700 transfer directory,
0600 file, owner 1002:1002), outside the checkout. It refuses an existing output
and does not rotate credentials, initialize a repository or call OpenBao. On
failure, preserve any partial output for review; no retry or cleanup is automatic.
The default invocation without `--export` is plan-only and reads no secret files.
Five synthetic tests passed for exact package membership, metadata/symlink refusal,
plaintext-output rejection, exclusive output and no default read/encryption.
Actual export, Windows transfer and off-host decryption/integrity verification are
pending. Return the exporter JSON only; never paste the recovered credentials.

This handoff covers Restic credential custody only. OpenBao seal custody remains
separate, and no retained OpenBao recovery/provisioning authorization is granted.


## Administrator Restic escrow export — October 21 (+08:00)

Owner-reported administrator execution returned `encrypted_export_created` at
`/home/gino/.myims-recovery-transfer/restic-recovery.age`, ciphertext SHA256
`b1d99286f4bca9ef0ded663aa08f9e476396364e25e12975dc9d6c82c5490314`.
No secret contents were printed and no seal/private age key was read.
Repository initialization and OpenBao changes remain false. Windows/off-host
transfer and package decryption/integrity verification remain pending. The agent
has not opened the real credential archive.

Next, copy the encrypted package from Windows PowerShell and report its SHA256:

```powershell
scp gino@helicalsvr:/home/gino/.myims-recovery-transfer/restic-recovery.age "$env:USERPROFILE\Downloads\restic-recovery.age"
if ($LASTEXITCODE -eq 0) { (Get-FileHash -LiteralPath "$env:USERPROFILE\Downloads\restic-recovery.age" -Algorithm SHA256).Hash }
```

Use the same SSH hostname/address that worked for the challenge transfer. This
transfers only ciphertext; keep the Windows private age key outside MyIMS.


## Windows ciphertext transfer verified — October 21 (+08:00)

Owner-reported SCP completed and Windows SHA256 matched the exported ciphertext:
`b1d99286f4bca9ef0ded663aa08f9e476396364e25e12975dc9d6c82c5490314`.
This verifies the Windows ciphertext copy. Actual package decryption, internal
manifest checks and durable independent storage remain separate from transfer
integrity and are not yet verified. No private key or real credential content was
provided to the agent.


A source-reviewed [Windows verifier and instructions](../runbooks/backup-key-check-windows.md#verify-the-real-restic-credential-recovery-package) are prepared for the owner run. It restricts the output directory before decryption, verifies exact members, manifest hashes and inherited file ACLs, and prints sanitized status only. Windows runtime execution remains pending; no policy bypass or agent private-key/credential read occurred.


## Windows Restic recovery package acceptance — October 21 (+08:00)

Owner executed the verifier on Windows and reported `recovery_package_verified`,
`packageDecryptionVerified=true`, `internalManifestVerified=true`, three credential
files verified, no credential output, no repository-access test and no OpenBao
changes. Protected output is
`C:\Users\Administrator\MyIMS-Restic-Recovery-af6298c6-1797-4025-812a-94926a8e92f1`.
This completes the manual Restic credential recovery-copy checkpoint: matching
off-host ciphertext, successful age decryption, exact file/manifest integrity and
Windows account ACL checks. The agent received only sanitized status, never the
private age key or decrypted credential content.

Actual repository initialization/access and full archive/joint PostgreSQL recovery
remain unverified. The seal file was not included; independent OpenBao seal-key
custody remains the next separate checkpoint. Root recovery and provisioning
remain unauthorized.


A [separate Windows seal-escrow recipient handoff](../runbooks/backup-key-check-windows.md#separate-seal-key-custody-encryption-recipient) is source-prepared using the verified ACL pattern. It generates only an off-host age wrapping identity, not an OpenBao seal key. Owner execution, public recipient, encrypted seal export/transfer/decryption and independent seal custody remain pending. No agent key read or retained recovery occurred.


## Windows seal-wrapping-key setup stop and safe resume — October 21 (+08:00)

Owner reported `stopped` at `separate_escrow_encryption_key`, in
`C:\Users\Administrator\MyIMS-OpenBao-Seal-Custody-fdb1d3a3-92d6-4b95-a36e-1f4253043685`.
No private key was printed. Its creation state is uncertain, since age-keygen
prints its public-recipient notice on stderr even when generation succeeds.
The original helper combined that with ErrorActionPreference=Stop; older Windows
PowerShell can treat redirected native stderr as terminating errors. This is a
likely cause, not confirmed by the sanitized failure alone. See
[Microsoft's native stderr behavior note](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables#erroractionpreference).

Corrected helper captures native output in a function-local Continue scope,
checks the actual exit code and never emits raw native output. Other operations
retain Stop semantics. Added `-CustodyFolder` for exact same-directory resume:
it validates the named profile folder and existing protected ACL without altering
it, reuses any existing identity, refuses reparse points/mismatched public output,
and derives only its public recipient. New key creation occurs only if the
identity is absent; no private file is overwritten or deleted.

The correction is source-reviewed; Windows execution remains pending. No PowerShell
runtime is available locally. Do not claim key creation, seal export or independent
seal custody until the owner-reported resumed result passes. No agent access to
private identity or retained seal contents, provider login or OpenBao change occurred.


Owner-reported same-folder resume reached `public_recipient` then stopped. The
helper therefore passed existing directory/private-file ACL and file-type checks,
but valid public derivation/output is not established. Next diagnostic is the
upstream `age-keygen -y` command on the exact Windows identity file, returning only
its public recipient or diagnostic. Do not display the identity contents or
regenerate a key based on this result. No agent key access/OpenBao operation occurred.


Owner's direct `age-keygen -y` returned `failed to parse input: no identities
found`. The existing file therefore contains no usable age identity. The initial
PowerShell stop may have interrupted creation after file creation but before
writing the identity; exact bytes were not inspected and this cause is not proven.
Preserve that failed folder/file. The next explicit owner action is a fresh run
of the corrected helper **without** `-CustodyFolder`, creating a new protected
folder and identity using the corrected local native stderr handling. No existing
key is overwritten or deleted, no retained seal is read and OpenBao is unchanged.


## Separate seal-wrapping recipient accepted — October 21 (+08:00)

Owner's fresh invocation returned `separate_seal_escrow_recipient_prepared`,
`identityCreatedNow=true`, protected folder
`C:\Users\Administrator\MyIMS-OpenBao-Seal-Custody-75d9cfa7-d2ad-41ce-9830-ca9b7941336a`
and public recipient
`age13k8j7hctfxentgjgd4g30qww3q2rfppz56ve87s7sw9sjmqluc4q9ysrkf`.
Pinned age accepted the public recipient using empty disposable input in a
network-disabled container; no private key or retained seal was accessed.
The earlier failed identity/folder stays historical and is not the active key.

Next explicit host-administrator handoff, prepared but **not executed**:

```bash
sudo python3 /home/gino/projects/IMS-rebuild/scripts/backup-host/export-openbao-seal-recovery.py --export
```

This action reads only the existing installation-managed `seal.json` as root,
checks non-symlink/single-link/0600/UID-GID 1003 custody and the known one-key
base64 schema, builds `seal.json` plus a hash manifest in memory, encrypts via
stdin to the **separate** public recipient with pinned network-disabled age as
UID 1002 with no mounts, and writes an exclusive 0600 ciphertext file under
0700 `/home/gino/.myims-seal-recovery-transfer/openbao-seal-recovery.age`.
The source file remains unchanged. No plaintext archive is written to disk, key
bytes are printed/logged or passed through argv/env. No private age key, Restic
credential or SMTP material is included. No OpenBao API, unseal, restart, root
generation, policy change, repository initialization or deletion is performed.

Six synthetic tests passed: exact seal/manifest membership, credential exclusion,
metadata/symlink refusal, ciphertext-only output, no replacement, no default reads
and malformed schema rejection. Default plan-only mode passed without reading
secrets. Actual seal export and Windows transfer/decryption remain pending.
Return administrator JSON only; key usability against the retained provider
requires the separately reviewed future operation and is not proven by escrow.


## Administrator seal-only encrypted export — October 21 (+08:00)

Owner-reported administrator command returned `encrypted_export_created` at
`/home/gino/.myims-seal-recovery-transfer/openbao-seal-recovery.age`, SHA256
`c837afabc352ea14a8eaa055d2bb599469d32b21d4b44c94bd7795c2662d4a04`.
The administrator process read the existing seal file; no secret contents were
printed, no private age key was read and the source seal file remained unchanged.
OpenBao requests/changes and repository initialization remained zero/false.
The agent received sanitized JSON only. Windows transfer, actual package
decryption/integrity and key usability against the provider remain unverified.

Next Windows PowerShell handoff:

```powershell
scp gino@172.16.7.53:/home/gino/.myims-seal-recovery-transfer/openbao-seal-recovery.age "$env:USERPROFILE\Downloads\openbao-seal-recovery.age"
if ($LASTEXITCODE -eq 0) { (Get-FileHash -LiteralPath "$env:USERPROFILE\Downloads\openbao-seal-recovery.age" -Algorithm SHA256).Hash }
```

Return the hash only. Do not post or display decrypted seal material.


## Windows seal ciphertext transfer verified — October 21 (+08:00)

Owner-reported Windows SCP and SHA256 matched
`c837afabc352ea14a8eaa055d2bb599469d32b21d4b44c94bd7795c2662d4a04`.
A separate seal-only Windows verifier is prepared using the owner-verified account
ACL/decryption pattern. It checks exact seal/manifest membership, hash/length,
ACL and share encoding and emits no key contents; [next command](../runbooks/backup-key-check-windows.md#verify-the-separate-openbao-seal-recovery-package).
Actual seal package decryption/integrity and key usability against the provider
remain unverified. No agent seal/private-key read or OpenBao request occurred.


## Separate off-host seal recovery-copy acceptance — October 21 (+08:00)

Owner-reported Windows verifier returned `seal_recovery_package_verified`,
successful package decryption and internal manifest, one seal file verified,
no seal contents printed and zero OpenBao requests/changes. Protected output is
`C:\Users\Administrator\MyIMS-OpenBao-Seal-Recovery-ebd59182-09f6-471d-a3e2-0cc8fc54f4b4`.
This completes the manual separate seal recovery-copy checkpoint through matching
ciphertext transfer, separate wrapping identity, decryption, file/hash/schema and
account ACL checks. Restic credential recovery-copy acceptance was already verified.
The agent received only sanitized results, not key contents.

Key usability against the retained provider remains untested. Neither custody
checkpoint authorizes provider login, restart/unseal, recovery/root generation,
provisioning, repository initialization, cleanup or automatic scheduling. Next
work is the exact bounded authority-operation preparation/disposable rehearsal
and final review; the existing human custodian restrictions remain unchanged.


## Disposable recovery authority rehearsal — October 21, 2026 (+08:00)

The native recovery candidate passed **51/51 checks**, operation
`4b943f4d-f338-49c1-b534-21979dd53611` ([evidence](p3-u3a-recovery-authority-candidate-evidence.json)).
Only newly created synthetic TLS/Raft nodes, keys, volumes, networks and credentials
were used. Retained keys, credentials, provider APIs, service state and repository
were not accessed. No retained tooling tag was changed.

The rehearsal revoked the fixture's initial root, confirmed disabled root-generation
endpoints, armed the actual independent deadline guard, temporarily enabled fixture
root generation, generated one native root through the synthetic seal quorum and
captured an encrypted native baseline with separate audit. Retrieval, integrity,
decryption and native recovery passed on separate persistent Raft/audit volumes and
an internal restore network verified unable to reach the source. A fresh scoped
reader authenticated to the recovered node and was revoked/403. Only then were the
four manifest backup-identity writes rehearsed on the source fixture. Existing
synthetic custodian policy/configuration stayed unchanged; recovered root was
revoked/403, protected configuration/TLS restored and anonymous generation denied
405 before guard cancellation. The guarded fixture window measured 80.386 seconds
against its 840-second limit; this is not production RTO. Independent snapshot-only
capture and encrypted post-provision backup/separate audit commit passed.

Earlier restore attempts failed on standby HTTP 429. Bounded diagnostic run
`bf7619f3-8d4a-4686-adf8-1f903865a67f` established the specific cause: declarative
audit device `eval/` in the snapshot required `/bao/audit/endpoint.json` while the
restore fixture configured `/tmp/audit.jsonl`. Matching that audit path on the
restore node's **independent** volume fixed activation; the stricter source-network
isolation and active-health requirements were retained. All failed-run evidence
remains historical. Earlier 35/39-check runs did not prove the newly enforced
network-isolated restore boundary; use the new 51-check result for that claim.

Exact fixture containers, all Raft/audit/repository volumes, both networks, private
work directory and deadline watcher/scratch directory were removed and absence
verified. The source hash is embedded in the evidence for reproduction.

The [capture-only request](../planning/p3-u3a-development-recovery-capture-request.md)
is still a disabled draft. Concrete host ownership/staging, bounded administrative
metadata preservation and cross-network handoff remain to verify. Today's effective
policy/entity/group/auth-user authority is not established by the old pre-succession
inventory reviewer or names-only review. No retained root recovery, provider restart,
repository initialization or identity provisioning is authorized. Actual provider
key usability, joint PostgreSQL/generation reconciliation, alert automation and
measured retained RPO/RTO remain pending. Existing native renewal HTTP 500, expiry
timing, retained lifetime-policy and browser-recovery findings remain unresolved.
Timed COMPLIANCE retention remains an approved deferred enhancement. P3-U3a remains
incomplete.


## Host staging, actual capture helpers and independent application work — October 21 (+08:00)

Owner authorized continuing host-procedure preparation and independent application
implementation. Added manual-only capture/archive services pinned to a separate
candidate image; installed development/snapshot image tags remain unchanged.
No retained service or directory was activated. The
[request](../planning/p3-u3a-development-recovery-capture-request.md) now specifies
exact services, host paths, UID/GID/modes, network isolation and handoff.

Private capture staging is outside backup-service ownership under root-owned
`/srv/myims-openbao-recovery-development`. Capture/encryption children use UID/GID
1003 mode 0700; ordinary backup clients receive ciphertext/receipts only. Offline
packaging preserves all seven actual capture files plus an integrity manifest,
with explicit operation/native-snapshot/audit checks and no effective-authority
approval claim. Independent audit packaging covers cleanup records. The restricted
public recipient is readable only through supplemental group 12010 in the
network-none archive helpers; no repository credentials are mounted there.

Native disposable verification invokes the actual recover/capture/finish scripts,
then offline archive/decryption, ciphertext-only host handoff and separate encrypted
audit covering root revocation. The fixture uses its own TLS certificate, seal,
initial/recovered roots, volumes and network; no retained credentials or provider
are contacted. Initial root and recovered root are revoked/403. Provider root/OTP
stay in helper tmpfs, never argv/env or archive. Exact fixture cleanup is verified.
Earlier failed fixture setup/cancellation attempts remain archived; the recovery
listener setting is explicit, and no cleanup requirement was weakened.

The host handoff verifies strict metadata, operation/age header/length/hash,
uses anchored directory descriptors and exclusive writes, refuses replacement and
retains a review fence after partial writes. Six synthetic test methods include
wrong operation/tampering/extra secret/symlink/hardlink/mode rejection, existing
outputs/locks, destination replacement and partial receipt-write containment.
Archive/audit/snapshot tests total 35 passing cases. The separate guarded Restic
regression still requires all 51 native checks against the final image.

This is not a complete retained-host controller. One-shot unseal transport,
exclusive empty-directory preparation and provider Compose recreation with deadline
label ownership through normal restoration still need concrete preflight. The
51-check guard test restarts one fixture container; it does not establish that
recreation boundary. Current effective identity/entity/group/auth-user authority
is still unverified. Keep all recovery/provisioning/initialization flags disabled;
no final execution approval is requested for this incomplete controller.

Independent application work adds reservation creation/replay and reserved-work
queue exclusion; [boundary and evidence](p3-u3a-reservation-and-worker-isolation.md).
It does not activate protected commands, a trunk worker, provider integration,
qualification/claim/adoption or HTTP APIs. Existing native renewal HTTP 500,
expiry timing, retained lifetime and browser findings stay open. Joint PostgreSQL
recovery, retained key usability and measured RPO/RTO remain pending. Timed
COMPLIANCE remains deferred; P3-U3a remains incomplete.


Final frozen candidate evidence: native capture/handoff operation `5353b91f-4f87-4bc8-a9b9-74de988634c2`
passed 11/11, and guarded Restic/native restore operation `502dec41-e8e7-4644-bd75-4b8766b7b766`
passed 51/51. Both used the final pinned separate image and verified exact cleanup;
installed/snapshot tags remained unchanged. These are component/disposable results,
not retained-host controller or production acceptance.
