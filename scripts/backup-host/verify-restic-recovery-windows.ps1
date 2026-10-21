# Owner-run Windows verification only. No network, repository or OpenBao calls.
# Real credentials remain in the new account-restricted local recovery folder.
param(
    [string]$Ciphertext = (Join-Path $env:USERPROFILE 'Downloads\restic-recovery.age'),
    [string]$KeyFile = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$stage = 'tools_and_ciphertext'
$folder = $null
try {
    $ageBinary = (Get-Command age -CommandType Application -ErrorAction Stop).Source
    $tarBinary = (Get-Command tar -CommandType Application -ErrorAction Stop).Source
    $expectedHash = 'b1d99286f4bca9ef0ded663aa08f9e476396364e25e12975dc9d6c82c5490314'
    if ((Get-FileHash -LiteralPath $Ciphertext -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedHash) {
        throw 'Ciphertext mismatch'
    }
    if ([string]::IsNullOrWhiteSpace($KeyFile)) {
        $KeyFile = Read-Host 'Full path to your private age key FILE (not its contents)'
    }
    if (-not (Test-Path -LiteralPath $KeyFile -PathType Leaf)) { throw 'Key file unavailable' }
    $stage = 'private_recovery_directory'
    $folder = Join-Path $env:USERPROFILE ('MyIMS-Restic-Recovery-' + [guid]::NewGuid().ToString())
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
    $archive = Join-Path $folder 'restic-recovery.tar'
    & $ageBinary --decrypt --identity $KeyFile --output $archive $Ciphertext 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Age decryption failed' }
    $stage = 'archive_members'
    $members = @(& $tarBinary -tf $archive 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Archive listing failed' }
    $expected = @('ca.crt', 'manifest.json', 'repository.password', 'repository.url')
    if ($members.Count -ne 4 -or (($members | Sort-Object) -join '|') -cne ($expected -join '|')) {
        throw 'Unexpected archive members'
    }
    & $tarBinary -xf $archive -C $folder 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
    $stage = 'manifest_and_file_integrity'
    $manifest = Get-Content -LiteralPath (Join-Path $folder 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.version -ne 1 -or @($manifest.files.PSObject.Properties).Count -ne 3) { throw 'Invalid manifest' }
    foreach ($name in @('ca.crt', 'repository.password', 'repository.url')) {
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
    [ordered]@{
        status = 'recovery_package_verified'
        packageDecryptionVerified = $true
        internalManifestVerified = $true
        credentialFilesVerified = 3
        recoveryFolder = $folder
        credentialsPrinted = $false
        repositoryAccessTested = $false
        openbaoChanges = $false
    } | ConvertTo-Json -Compress
} catch {
    # Never emit exception text, credential file contents or native command output.
    [ordered]@{status='stopped';stage=$stage;recoveryFolder=$folder;credentialsPrinted=$false;automaticRetry=$false} | ConvertTo-Json -Compress
    exit 1
}
