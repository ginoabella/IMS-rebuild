# Private development Platform Console HTTPS

Owner: development maintainer. Approved on 2026-10-07 for private access through
SSH at **https://localhost:3443**. The console uses the existing development
database, shared Redis services and the operator already created with
`./dev bootstrap-operator`.

The user confirmed working Windows access/sign-in on 2026-10-07 after following
the certificate and tunnel steps. macOS instructions are documented below but
have not been exercised on a Mac. Refresh and confirmed logout remain checklist
items unless separately reported.

## Which terminal to use

| Terminal                                                       | What runs there                                         | Keep open while browsing? |
| -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------- |
| Development server terminal                                    | `./dev platform-https`                                  | Yes                       |
| Windows PowerShell or macOS Terminal on your computer          | Certificate download, fingerprint check and trust setup | Only during setup         |
| Separate Windows PowerShell or macOS Terminal on your computer | SSH tunnel                                              | Yes                       |

Certificate setup is needed once per computer/user for this CA. For later visits,
keep the server console running, open the tunnel and browse to the same address.
Do not close an already running `./dev platform-https` to install a certificate or
open the tunnel; use another terminal. Stop an old tunnel before starting another
on the same local port.

## Start on the development server

Use an SSH/server terminal:

```sh
cd /home/gino/projects/IMS-rebuild
./dev status
./dev platform-https-prepare
./dev platform-https
```

Keep the last command running. Wait for `Platform HTTPS ready` before opening the
browser. It builds the ordinary backend, UI package and console, then starts the
private processes. Build output and request bodies are omitted from launcher logs.
The existing Docker workspace and shared services must already be running; this
procedure does not run `./dev up`, migrations, bootstrap or fixture provisioning.

If a normal `./dev platform` process is running, stop it in its own terminal with
Ctrl+C first. Do not run another console build or `./dev check` while this console
is running; they share its normal `.next` output. Start is idempotent while this
launcher is running: another invocation prints its status without another build.

The launcher checks the **running** workspace port mapping. It requires container
port 3001 to be published only at server loopback port 3101. The repository default
is `MYIMS_WEB_BIND=127.0.0.1` and `MYIMS_PLATFORM_PORT=3101`. It refuses a public
binding or different port. No firewall/NAT opening is needed. Any existing public
command-center preview remains a separate application.

In another server terminal, use:

```sh
cd /home/gino/projects/IMS-rebuild
./dev platform-https-status
./dev platform-https-check
```

The check exercises real TLS, CSRF, session denial, origin/source rejection,
absent-session logout and the normal browser sign-in page. It never enters an
operator username/password or creates an identity. See verification limits below.

## Transfer and trust the public certificate on Windows

Run these commands in **Windows PowerShell on your own computer**, using the same
Windows user who opens Edge or Chrome. Windows OpenSSH provides `scp` and `ssh`;
enable the Windows OpenSSH Client optional feature if they are unavailable.

Run each line **from top to bottom**, pressing Enter after each. Initialize the
variables before commands that use them; dispose `$sha` only after displaying the
fingerprint. If PowerShell shows `>>` because a pasted command is incomplete,
press Ctrl+C and enter the complete lines again without copying prompt text.

Download only the public CA certificate:

```powershell
$caPem = Join-Path $env:USERPROFILE 'Downloads\myims-development-ca.crt'
$caDer = Join-Path $env:USERPROFILE 'Downloads\myims-development-ca.cer'
New-Item -ItemType Directory -Force (Split-Path $caPem) | Out-Null
scp gino@203.177.64.131:/home/gino/projects/IMS-rebuild/.local/platform-https-ca.crt "$caPem"
Test-Path $caPem
```

Enter your SSH password if prompted. Continue only after `scp` succeeds and
`Test-Path` returns `True`. Decode the downloaded public certificate:

```powershell
certutil -f -decode "$caPem" "$caDer"
```

Wait for `CertUtil: -decode command completed successfully` before continuing.

Use your actual SSH address if the documented development server address changes.
Do not download `.local/platform-https`, `ca.key`, `server.key` or `auth.json`.

Before trusting the CA, compare its SHA-256 certificate fingerprint with the
`Development CA SHA256` line printed by `./dev platform-https-prepare` in your
trusted server terminal:

```powershell
$ca = New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $caDer
$sha = [System.Security.Cryptography.SHA256]::Create()
($sha.ComputeHash($ca.RawData) | ForEach-Object { $_.ToString('X2') }) -join ':'
$sha.Dispose()
```

These are fingerprints of the certificate's DER bytes, not the downloaded PEM
file's bytes. They must match exactly. If they differ, stop and confirm the file
and SSH destination before importing it.

After confirming the fingerprint, import it for your current Windows user:

The command uses Microsoft's supported
[certificate import](https://learn.microsoft.com/en-us/powershell/module/pki/import-certificate)
into `Cert:\CurrentUser\Root`. The preceding conversion follows the
[certutil decode reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil#-decode).

```powershell
Import-Certificate -FilePath $caDer -CertStoreLocation Cert:\CurrentUser\Root
```

Accept the Windows certificate confirmation if prompted. This deliberately trusts
your private development CA for that Windows user; its private key stays on the
server. It does not change machine-wide trust and normally requires no elevated
PowerShell. Fully close and reopen Edge/Chrome after importing. Use Edge or Chrome
for this procedure; Firefox or a managed browser may have a separate certificate
policy that requires its own trust configuration.

## Open the SSH tunnel on Windows

In a Windows PowerShell terminal, run:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3443:127.0.0.1:3101 gino@203.177.64.131
```

Keep this terminal open while using the console. A successful tunnel normally
prints no message after SSH authentication. The local port is bound only to your
computer's loopback address. If it says the port is already in use, stop the old
tunnel or other process using 3443; the configured console origin requires this
exact port.

Open **https://localhost:3443/sign-in** in Edge or Chrome. Use `localhost`, not
`127.0.0.1`, the server IP or another port. Do not click through a certificate
warning: verify the certificate import, fingerprint, SSH destination and system
clock instead. The browser must show a trusted HTTPS connection.

## Transfer and trust the public certificate on macOS

Use **Terminal on your Mac**, signed in as the user who opens the browser. The
server startup procedure above is the same for Windows and macOS. Run the shell
commands in order; they run on your Mac, not inside your server SSH session.

Download only the public CA certificate and display its certificate fingerprint:

```sh
mkdir -p "$HOME/Downloads"
scp gino@203.177.64.131:/home/gino/projects/IMS-rebuild/.local/platform-https-ca.crt "$HOME/Downloads/myims-development-ca.crt"
openssl x509 -in "$HOME/Downloads/myims-development-ca.crt" -noout -fingerprint -sha256
```

Enter your SSH password if prompted. Continue only after the download succeeds.
Compare the colon-separated SHA-256 fingerprint with `Development CA SHA256`
printed by `./dev platform-https-prepare` in your trusted server terminal; the
prefix printed by OpenSSL may differ, but the fingerprint bytes must match.
No PEM-to-DER conversion is needed for this macOS procedure. Private CA/TLS keys
and authentication secrets stay on the server.

After confirming the fingerprint, import and trust the CA for your Mac user:

1. Open **Keychain Access** through Spotlight (Command+Space, type Keychain Access,
   then press Return).
2. Select the **login** keychain, then drag
   `Downloads/myims-development-ca.crt` into Keychain Access. Use the login
   keychain for this development setup rather than importing into System.
3. Find **MyIMS Private Development CA** in Certificates and double-click it.
4. Expand **Trust**, set **When using this certificate** to **Always Trust**,
   then close the certificate window and authenticate if prompted by macOS.
5. Fully quit and reopen Safari or Chrome before visiting the console.

This follows Apple's instructions for
[adding certificates to a keychain](https://support.apple.com/guide/keychain-access/add-certificates-to-a-keychain-kyca2431/mac)
and [changing certificate trust](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac).
It deliberately trusts this private development CA in your login keychain.
Firefox or a managed browser may require its own certificate policy configuration.

## Open the SSH tunnel on macOS

In a separate Terminal window on your Mac, run:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3443:127.0.0.1:3101 gino@203.177.64.131
```

Keep this terminal and the server's `./dev platform-https` terminal running.
A successful tunnel normally remains silent after SSH authentication. Open
**https://localhost:3443/sign-in** in Safari or Chrome and use the existing
bootstrap credentials. The address must use `localhost` and port 3443. A trusted
HTTPS connection should load without a certificate warning; complete the browser
checklist below. No public port or domain is required.

For later visits, the trusted certificate stays in your login keychain. Start
the tunnel again if it was closed; do not repeat certificate import unless the
CA changes. Stop the tunnel with Ctrl+C when finished. Closing it does not sign
out or stop the server console.

## Private browser sign-in checklist (Windows and macOS)

1. Enter the username and password you supplied to `./dev bootstrap-operator`.
   The bootstrap correlation ID is not a credential. Keep the password private.
2. Choose **Sign in**. Confirm that the protected Platform Console opens without
   `Service unavailable`. PBX and tenant administration screens remain planned.
3. Refresh the page and confirm that your session still grants console access.
4. Choose **Sign out** and wait for confirmation. Confirm that you return to
   sign-in and that opening the console again requires authentication.

You can report the outcome or generic error text without sharing credentials,
cookies, CSRF proofs, browser network captures or credential screenshots.

## Stop, restart and retained files

Stop the console with Ctrl+C in its server terminal, or run from another server
terminal:

```sh
cd /home/gino/projects/IMS-rebuild
./dev platform-https-stop
./dev platform-https-status
```

This stops only the supervisor's ingress, Next and Nest processes. The existing
backend container, database, Redis, Garage and other shared services keep running.
Shutdown uses a bounded graceful stop and then terminates only owned process
groups. Restart with `./dev platform-https`; it reuses the same TLS material and
authentication secrets. Restart does not reset accounts or revoke existing
sessions. Closing the Windows or macOS tunnel stops access from that computer but does not
sign out or stop the server console. Use the console's Sign out first if desired.

Private files are in ignored `.local/platform-https` (directory mode 700, files
600), owned by the Docker workspace/checkout user. The CA lasts ten years; the
localhost server certificate lasts one year. Only `.local/platform-https-ca.crt`
is exported for workstation transfer. Back up private material securely together
with the existing shared-service secrets; Git does not retain it. Never delete
data volumes or regenerate shared-service passwords as an HTTPS troubleshooting
step.

Missing, partial, incorrectly owned or expired material fails closed. Restore the
complete matching backup when material is lost. For certificate renewal, stop the
console and have the maintainer issue a replacement localhost leaf using the
existing CA and replace the matching server key/certificate together. Retain
`auth.json` and the CA; renewal must not reset authentication secrets or operator
credentials. Changing the CA requires verifying and importing the replacement on
Windows/macOS and removing the old trust.

To remove this CA from your current Windows user's trust store when it is no longer
needed, first load the same public certificate, review its subject/thumbprint,
then remove that exact entry:

```powershell
$ca = New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $caDer
$ca | Format-List Subject, Thumbprint
Remove-Item ("Cert:\CurrentUser\Root\" + $ca.Thumbprint)
```

On macOS, open Keychain Access, select the login keychain and locate **MyIMS
Private Development CA**. Open it and compare its SHA-256 fingerprint with the
same public certificate before deleting that exact certificate from the login
keychain. Authenticate if prompted and quit/reopen the browser. Remove only this
development CA; leave other certificates unchanged.

## Runtime configuration and network boundary

| Component                      | Listener / configuration                                        |
| ------------------------------ | --------------------------------------------------------------- |
| Browser origin                 | Exactly `https://localhost:3443`                                |
| SSH destination                | Server `127.0.0.1:3101`                                         |
| HTTPS ingress                  | Workspace port 3001, published only on host loopback            |
| Normal production Next console | Workspace `127.0.0.1:3003`, unpublished                         |
| Normal Nest HTTP replica       | Workspace `127.0.0.1:4001`, unpublished                         |
| Next backend origin            | `http://127.0.0.1:4001`                                         |
| Nest browser proxy peers       | Exactly `127.0.0.1`                                             |
| Shared stores                  | Existing database runtime role and existing Redis configuration |

The launcher supplies server-only configuration directly to its child processes,
using three retained, distinct random 256-bit hex secrets. Next and Nest share the
proxy secret; Nest holds the CSRF secret; ingress and Next share the ingress
secret. Nest adds the exact Next peer to existing limiter trust entries. Next
receives no database/Redis/deployment credentials. No `NEXT_PUBLIC` secret, test
build flag, browser issuer or fixture account is used.

The separate existing backend container remains unchanged. The additional Nest
process is the same application code and uses the same canonical identities,
shared sessions and rate limits. It has no migration configuration. HTTPS
termination stays inside the existing Docker workspace; private HTTP between its
loopback processes is intentional.

Ingress validates Host, mutation Origin and safe-fetch metadata, derives client IP
from the accepted socket, strips client proxy/forwarding fields and overwrites its
three trusted ingress headers. It forwards no bearer channel, rejects upgrades
and forwards only the existing console's HTTP traffic. The Next authentication
proxy remains restricted to the four declared consumers. Because Docker/SSH can
aggregate client sources, rate limits may be shared among tunnel users; this is
development access, not proof of production client attribution or capacity.

## Verification limits and troubleshooting

Automated Node HTTPS probes use the actual CA with chain and hostname validation
enabled, and reject an untrusted CA and wrong hostname. The Linux Chromium
presentation probe pins only the already verified leaf public key, since its CA
store differs from Node's. It does not prove workstation certificate trust.
The user confirmed Windows access/sign-in is working on 2026-10-07. macOS
certificate trust and browser access remain unverified on an actual Mac. Refresh,
confirmed logout and renewed access denial remain manual checklist items unless
separately reported; automated verification does not know your credentials.

The check uses transient CSRF context and absent-session logout without creating
an account or authenticated session. It compares existing operator/staff/tenant
records, migration history and shared credential files before/after. Request data
and identifying values are not printed. No disposable authentication database or
Redis instance is created.

- `Platform HTTPS: stopped`: run the server startup command and keep it running.
- Listener preflight failure: stop an existing console process in its own terminal;
  the launcher never kills an unrelated process to claim its port.
- Build failure: stop the console and run `./dev exec pnpm build:backend`,
  `./dev exec pnpm --filter @myims/ui-web build` and
  `./dev exec pnpm --filter @myims/platform-console-web build` to diagnose compilation.
- Backend readiness failure: use `./dev health` and `./dev status` to check the
  existing database and Redis services. Do not reset them.
- Tunnel connection refused: confirm server startup completed and the SSH target
  is correct. No public port forwarding is required.
- Browser certificate warning: compare the CA fingerprint and ensure import was
  under the same Windows or macOS user who opens the browser. On macOS, check
  the login keychain entry's Trust settings. Reopen the browser.
- PowerShell null-valued expression or `CertUtil: Missing argument`: initialize
  `$caPem`, `$caDer`, `$ca` and `$sha` in the documented order; do not reverse the
  pasted lines or call `$sha.Dispose()` before computing the fingerprint.
- Windows decode reports file not found: run `Test-Path $caPem`, rerun `scp`,
  and resolve its error before decoding. If the remote public CA is missing,
  run `./dev platform-https-prepare` on the server, then retry the download.
- Browser `Service unavailable`: run `./dev platform-https-check` and report the
  fixed failing phase. Never paste private configuration or browser cookie data.
- Invalid credentials: use the original bootstrap username/password; successful
  transport does not validate the password. Do not bootstrap another account.

See the [operator guide](../guides/platform-operator-access.md),
[authentication contract](../architecture/platform-authentication-http.md) and
[approved setup decision](../planning/platform-development-https-access.md).
