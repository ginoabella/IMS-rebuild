# Owner-run Windows setup: a separate age encryption key for seal-key escrow.
# This does not generate/change an OpenBao key or contact any service.
param([string]$CustodyFolder = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$stage = 'age_keygen_tool'
$folder = $null
function Invoke-KeygenChecked {
    param([string]$Binary, [string[]]$NativeArguments)
    # Windows PowerShell treats redirected native stderr as ErrorRecords. age-keygen
    # reports its public recipient there even on success. Capture it in this local
    # scope, then enforce the actual native exit code; never print raw output.
    $ErrorActionPreference = 'Continue'
    $output = @(& $Binary @NativeArguments 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'Keygen exited unsuccessfully' }
    return $output
}
try {
    $keygenBinary = (Get-Command age-keygen -CommandType Application -ErrorAction Stop).Source
    $stage = 'private_directory'
    $newFolder = [string]::IsNullOrWhiteSpace($CustodyFolder)
    if ($newFolder) {
        $folder = Join-Path $env:USERPROFILE ('MyIMS-OpenBao-Seal-Custody-' + [guid]::NewGuid().ToString())
        $null = New-Item -Path $folder -ItemType Directory
    } else {
        $folder = [IO.Path]::GetFullPath($CustodyFolder)
        if ([IO.Path]::GetDirectoryName($folder) -ine [IO.Path]::GetFullPath($env:USERPROFILE) -or
            [IO.Path]::GetFileName($folder) -cnotmatch '^MyIMS-OpenBao-Seal-Custody-[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -or
            -not (Test-Path -LiteralPath $folder -PathType Container) -or
            (((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'Unexpected resume directory' }
    }
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    if ($newFolder) {
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
    }
    $actualAcl = Get-Acl -LiteralPath $folder
    if (-not $actualAcl.AreAccessRulesProtected) { throw 'Directory inheritance still enabled' }
    $rules = @($actualAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -cne $identity.Value -or
        $rules[0].AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { throw 'Unexpected directory access' }
    $stage = 'separate_escrow_encryption_key'
    $identityFile = Join-Path $folder 'seal-escrow-identity.txt'
    $identityCreatedNow = $false
    if (-not (Test-Path -LiteralPath $identityFile)) {
        $null = Invoke-KeygenChecked -Binary $keygenBinary -NativeArguments @('-o', $identityFile)
        $identityCreatedNow = $true
    }
    if (-not (Test-Path -LiteralPath $identityFile -PathType Leaf) -or
        (((Get-Item -LiteralPath $identityFile -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'Unexpected identity file' }
    $keyRules = @((Get-Acl -LiteralPath $identityFile).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    if ($keyRules.Count -ne 1 -or $keyRules[0].IdentityReference.Value -cne $identity.Value -or
        $keyRules[0].AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { throw 'Unexpected private key access' }
    $stage = 'public_recipient'
    $recipientOutput = @(Invoke-KeygenChecked -Binary $keygenBinary -NativeArguments @('-y', $identityFile))
    if ($recipientOutput.Count -ne 1 -or $recipientOutput[0] -cnotmatch '^age1[0-9a-z]{58}$') {
        throw 'Public recipient unavailable'
    }
    $recipient = $recipientOutput[0]
    $recipientFile = Join-Path $folder 'seal-escrow-recipient.txt'
    if (Test-Path -LiteralPath $recipientFile) {
        if (-not (Test-Path -LiteralPath $recipientFile -PathType Leaf) -or
            (((Get-Item -LiteralPath $recipientFile -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or
            (Get-Content -LiteralPath $recipientFile -Raw).Trim() -cne $recipient) { throw 'Existing public recipient mismatch' }
    } else {
        Set-Content -LiteralPath $recipientFile -Value $recipient -Encoding Ascii
    }
    [ordered]@{
        status = 'separate_seal_escrow_recipient_prepared'
        publicRecipient = $recipient
        custodyFolder = $folder
        identityCreatedNow = $identityCreatedNow
        privateKeyPrinted = $false
        openbaoSealKeyRead = $false
        openbaoChanges = $false
        sealCopyCreated = $false
    } | ConvertTo-Json -Compress
} catch {
    [ordered]@{status='stopped';stage=$stage;custodyFolder=$folder;privateKeyPrinted=$false;automaticRetry=$false} | ConvertTo-Json -Compress
    exit 1
}
