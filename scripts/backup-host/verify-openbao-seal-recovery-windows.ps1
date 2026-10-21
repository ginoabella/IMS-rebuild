# Owner-run Windows verification only. No network, repository or OpenBao calls.
# Seal material remains in the new account-restricted local recovery folder.
param(
    [string]$Ciphertext = (Join-Path $env:USERPROFILE 'Downloads\openbao-seal-recovery.age'),
    [string]$KeyFile = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$stage = 'tools_and_ciphertext'
$folder = $null
try {
    $ageBinary = (Get-Command age -CommandType Application -ErrorAction Stop).Source
    $tarBinary = (Get-Command tar -CommandType Application -ErrorAction Stop).Source
    $expectedHash = 'c837afabc352ea14a8eaa055d2bb599469d32b21d4b44c94bd7795c2662d4a04'
    if ((Get-FileHash -LiteralPath $Ciphertext -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedHash) {
        throw 'Ciphertext mismatch'
    }
    if ([string]::IsNullOrWhiteSpace($KeyFile)) {
        $KeyFile = Read-Host 'Full path to your private age key FILE (not its contents)'
    }
    if (-not (Test-Path -LiteralPath $KeyFile -PathType Leaf)) { throw 'Key file unavailable' }
    $stage = 'private_recovery_directory'
    $folder = Join-Path $env:USERPROFILE ('MyIMS-OpenBao-Seal-Recovery-' + [guid]::NewGuid().ToString())
    $null = New-Item -Path $folder -ItemType Directory
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true, $false)
    $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $identity,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        $inheritance,
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $folder -AclObject $acl
    $actualAcl = Get-Acl -LiteralPath $folder
    if (-not $actualAcl.AreAccessRulesProtected) { throw 'Directory inheritance still enabled' }
    $rules = @($actualAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -cne $identity.Value -or
        $rules[0].AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { throw 'Unexpected directory access' }
    $stage = 'age_decryption'
    $archive = Join-Path $folder 'openbao-seal-recovery.tar'
    & $ageBinary --decrypt --identity $KeyFile --output $archive $Ciphertext 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Age decryption failed' }
    $stage = 'archive_members'
    $members = @(& $tarBinary -tf $archive 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Archive listing failed' }
    $expected = @('manifest.json', 'seal.json')
    if ($members.Count -ne 2 -or (($members | Sort-Object) -join '|') -cne ($expected -join '|')) {
        throw 'Unexpected archive members'
    }
    & $tarBinary -xf $archive -C $folder 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
    $stage = 'manifest_and_file_integrity'
    $manifest = Get-Content -LiteralPath (Join-Path $folder 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.version -ne 1 -or @($manifest.files.PSObject.Properties).Count -ne 1) { throw 'Invalid manifest' }
    foreach ($name in @('seal.json')) {
        $entry = $manifest.files.PSObject.Properties[$name].Value
        $file = Join-Path $folder $name
        $item = Get-Item -LiteralPath $file -Force
        if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or
            $item.Length -le 0 -or $item.Length -ne $entry.bytes -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or
            (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'File integrity mismatch' }
        $fileRules = @((Get-Acl -LiteralPath $file).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
        if ($fileRules.Count -ne 1 -or $fileRules[0].IdentityReference.Value -cne $identity.Value -or
            $fileRules[0].AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { throw 'Unexpected file access' }
    }
    $stage = 'seal_share_schema'
    $seal = Get-Content -LiteralPath (Join-Path $folder 'seal.json') -Raw | ConvertFrom-Json
    if (@($seal.PSObject.Properties).Count -ne 1 -or $null -eq $seal.PSObject.Properties['key'] -or
        $seal.key -isnot [string]) { throw 'Unexpected seal schema' }
    $share = [Convert]::FromBase64String($seal.key)
    if ($share.Length -notin @(32, 33)) { throw 'Unexpected seal share encoding' }
    [ordered]@{
        status = 'seal_recovery_package_verified'
        packageDecryptionVerified = $true
        internalManifestVerified = $true
        sealFilesVerified = 1
        recoveryFolder = $folder
        sealContentsPrinted = $false
        keyUsabilityAgainstProviderVerified = $false
        openbaoRequests = 0
        openbaoChanges = $false
    } | ConvertTo-Json -Compress
} catch {
    # Never emit exception text, seal file contents or native command output.
    [ordered]@{status='stopped';stage=$stage;recoveryFolder=$folder;sealContentsPrinted=$false;automaticRetry=$false} | ConvertTo-Json -Compress
    exit 1
}
