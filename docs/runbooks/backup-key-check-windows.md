# Independent age decryption check on Windows

October 21, 2026 (Asia/Manila, +08:00). Run on the Windows computer that holds
the private age identity. No MyIMS/OpenBao credentials or real backup data are
involved; the challenge encrypts an innocuous random message. Keep the identity
on this computer and enter only its file path when prompted.

1. Save [the challenge](../status/p3-u3a-age-decryption-challenge.age) to the Windows
   Downloads folder with filename `p3-u3a-age-decryption-challenge.age`.
2. If `age` is not installed, use PowerShell:

```powershell
winget install --id FiloSottile.age --exact
```

Reopen PowerShell after installation. This is the
[upstream Windows installation method](https://github.com/FiloSottile/age#installation).
If winget is unavailable, stop and request instructions rather than downloading
an unverified executable.

3. In PowerShell, run:

```powershell
$keyFile = Read-Host 'Enter the full path to your private age key FILE (not the key contents)'
$checkOutput = Join-Path $env:TEMP ('myims-age-check-' + [guid]::NewGuid().ToString() + '.txt')
age --decrypt --identity "$keyFile" --output "$checkOutput" "$env:USERPROFILE\Downloads\p3-u3a-age-decryption-challenge.age"
if ($LASTEXITCODE -eq 0) { (Get-FileHash -LiteralPath $checkOutput -Algorithm SHA256).Hash }
```

Return only the displayed SHA256 value, or the age error if decryption fails.
The output is an innocuous challenge file in Windows TEMP. A successful hash
match will be recorded as an owner-executed decryption check, not agent access to
the private key and not proof of all independent copies or production recovery.
Do not post private identity bytes or import the key onto MyIMS.


## Verify the real Restic credential recovery package

After SCP and ciphertext SHA256 match, copy the verifier to Windows PowerShell:

```powershell
scp gino@helicalsvr:/home/gino/projects/IMS-rebuild/scripts/backup-host/verify-restic-recovery-windows.ps1 "$env:USERPROFILE\Downloads\verify-restic-recovery-windows.ps1"
```

Then run:

```powershell
& "$env:USERPROFILE\Downloads\verify-restic-recovery-windows.ps1"
```

Enter only the private age key's file path when prompted. The script validates
the expected ciphertext hash, creates a unique recovery folder under the current
Windows profile, replaces its ACL with inheritable access for the current user
only, verifies the restriction before decryption, and checks the four exact
archive members plus each of three credential files against the internal manifest.
It verifies inherited file ACLs and emits sanitized JSON only. Credentials and
the plaintext tar stay in that restricted recovery folder; no cleanup, network
or repository operation is performed. No seal material is included.

Return only JSON, never any decrypted file contents. If PowerShell policy blocks
the script or a stage fails, return that status/error; do not change machine policy
or repeat decryption automatically. A successful package check does not prove
actual repository access (the repository is still uninitialized).

The verifier is source-reviewed but has not executed on Windows; PowerShell is
unavailable in the Linux development environment. Actual Windows decryption,
ACL and manifest acceptance remain pending the owner run. Permission handling
uses [Windows .NET ACL operations](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-acl),
and integrity uses [Get-FileHash](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash).


## Separate seal-key custody encryption recipient

After Restic escrow passes, the next separate handoff prepares a new encryption
identity on Windows for the OpenBao seal-key export. This is an age wrapping key,
**not a new OpenBao seal key**. It does not rotate or change OpenBao. Keeping the
wrapping identity/folder separate prevents adding seal material to the existing
Restic credential recovery archive. The owner is the designated custodian.

```powershell
scp gino@172.16.7.53:/home/gino/projects/IMS-rebuild/scripts/backup-host/prepare-seal-custody-windows.ps1 "$env:USERPROFILE\Downloads\prepare-seal-custody-windows.ps1"
if ($LASTEXITCODE -eq 0) { & "$env:USERPROFILE\Downloads\prepare-seal-custody-windows.ps1" }
```

The script reuses the directory ACL setup already verified on this Windows
computer, creates a fresh account-restricted `MyIMS-OpenBao-Seal-Custody-<id>`
folder, generates the new age identity there and verifies its inherited file ACL.
It prints the public recipient and folder in sanitized JSON. Keep
`seal-escrow-identity.txt` private and recoverable; return only the JSON public
recipient. A later explicit administrator export will use that public recipient
for a **separate** seal-file package. No seal material is read/copied by this
Windows setup, and no OpenBao/network operation is performed.

The new key-generation script has not yet run on Windows. Do not rerun it after
a successful result; retain that specific identity and its public recipient for
the next handoff. If a stage fails, return the sanitized status instead of posting
any file contents. This prepares encryption custody only, not the seal-key copy
or authority to recover root.


If the first seal setup stops at `separate_escrow_encryption_key`, preserve its
folder: generation may already have succeeded. The corrected helper accepts
`-CustodyFolder '<exact folder from stopped result>'` to reuse an existing identity
and derive its public recipient. Recopy the updated helper before resuming; do
not delete the old folder or run a fresh setup to make the checkpoint pass. Native
exit codes now determine keygen failure, avoiding older PowerShell's treatment of
successful stderr notices. Return sanitized JSON only.


## Verify the separate OpenBao seal recovery package

After the owner-reported ciphertext SHA256 matches, run on Windows:

```powershell
scp gino@172.16.7.53:/home/gino/projects/IMS-rebuild/scripts/backup-host/verify-openbao-seal-recovery-windows.ps1 "$env:USERPROFILE\Downloads\verify-openbao-seal-recovery-windows.ps1"
if ($LASTEXITCODE -eq 0) { & "$env:USERPROFILE\Downloads\verify-openbao-seal-recovery-windows.ps1" -KeyFile "C:\Users\Administrator\MyIMS-OpenBao-Seal-Custody-75d9cfa7-d2ad-41ce-9830-ca9b7941336a\seal-escrow-identity.txt" }
```

This uses the separate seal-wrapping identity, not the working backup age key.
The verifier pins ciphertext SHA256, creates a fresh current-user-only ACL folder,
decrypts and checks exactly `seal.json` plus `manifest.json`, verifies file length/
SHA256/inherited ACL and the known single base64 key-share schema. It prints no
seal contents and makes no network/OpenBao requests. Decrypted seal material and
its plaintext tar remain in the new protected `MyIMS-OpenBao-Seal-Recovery-<id>`
folder, separate from the Restic credential folder. Do not paste file contents.

Return sanitized JSON only. A pass verifies independent encrypted copy recovery;
it does not test the key against OpenBao or authorize unseal/root generation.
The ACL/decryption pattern already passed on this owner's Windows machine for
Restic. This seal-specific variant is source-reviewed; its Windows execution is
pending. The earlier failed wrapping-key folder stays untouched.
