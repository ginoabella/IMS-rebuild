# Windows Android staff acceptance

Prepared 2026-10-13, Asia/Manila (+08:00). This is a separate test application,
`com.myims.responder.acceptance`; actual device acceptance is still pending.
Use `Pixel_8_API_36`, serial `emulator-5554`, with a screen lock and enrolled
fingerprint. Android Studio, its SDK/platform tools, a compatible JDK, Node
22.23.3 and pnpm 10.12.1 must be available on the desktop.

## Get the current source and public CA

Use a Windows checkout containing the current implementation, including
`scripts/prepare-staff-native-acceptance.mjs` and `scripts/native-acceptance/`.
These changes are currently uncommitted; pulling an older remote revision does
not supply them. Put only the public mkcert root certificate in
`private/mkcert-rootCA.pem` in the desktop checkout. It must be the root that
issued the ingress certificate. Do not copy the root private key, server TLS key,
staff-access JSON, passwords or any server environment files to the desktop app.

A prepared source ZIP on the server includes the current authored source and
public CA, excluding private server configuration, keys, dependencies and generated
files. From a Windows working directory, obtain a separate test checkout:

```powershell
scp gino@203.177.64.131:/home/gino/projects/IMS-rebuild/.local/staff-native-desktop-source.zip .
Expand-Archive .\staff-native-desktop-source.zip -DestinationPath .\IMS-native-acceptance
Set-Location .\IMS-native-acceptance
```

The preparation command prints the public root SHA256 fingerprint for comparison
with the server copy. The acceptance app bundles that public root for the exact
configured hostname. Its network configuration disallows cleartext and preserves
hostname/chain validation; other domains use Android system trust. This app uses
a separate application ID and does not alter the ordinary responder application.
See [Android network security configuration](https://developer.android.com/privacy-and-security/security-config)
and [Expo config plugins](https://docs.expo.dev/config-plugins/plugins/).

## Connect to the declared native ingress

The native ingress runs on workspace private address **172.18.0.7:3444** at this
checkpoint. The host verified its sign-in page with the mkcert root and hostname,
HTTP 200. The workspace IP can change after container recreation; recheck it then.
This endpoint uses different TLS material from the browser companion on host 3102. Its CA must match the acceptance build.

If the old desktop SSH terminal already forwards local 3444 to server 3102,
stop that terminal with Ctrl+C first. Keep platform port 3443 separate. Open a
PowerShell terminal and keep this native tunnel running:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3444:172.18.0.7:3444 gino@203.177.64.131
```

In another PowerShell terminal, from the desktop repository root:

```powershell
adb devices -l
adb -s emulator-5554 reverse tcp:3444 tcp:3444
$env:EXPO_PUBLIC_STAFF_AUTH_ORIGIN = 'https://localhost:3444'
pnpm install --frozen-lockfile
pnpm --filter @myims/contracts build
node scripts/prepare-staff-native-acceptance.mjs private/mkcert-rootCA.pem
pnpm --dir .local/staff-native-acceptance exec tsc --noEmit
pnpm --dir .local/staff-native-acceptance exec expo run:android --variant release --device emulator-5554 --no-bundler
```

Add Android SDK `platform-tools` to PATH if PowerShell cannot find `adb`.
The release variant embeds JavaScript and needs no Metro HTTP connection.
The app name is **MyIMS Native Acceptance**. The staging command refuses to
overwrite an existing acceptance directory. Preserve previous evidence and move
that directory aside before preparing a fresh source/origin/CA build. Rebuild if
any of those inputs change. Generated Android files are owned by Expo; do not
edit them manually.

No Android APK was compiled on the server: it has no JDK/Android SDK. Server-side
TypeScript checking, Expo Android prebuild and Hermes export establish preparation
and compilation boundaries only; the Windows build/install still needs verification.

## Exercise real storage and controlled failures

Use isolated active acceptance fixtures with credentials issued through the real
credential workflow. An ordinary draft administrator remains ineligible to sign
in. Do not activate a real tenant for this test. The current ingress targets one
backend; independent replica B and controlled expiry/response loss still need a
declared fixture arrangement before full acceptance.

First leave **Clear fault** selected. Sign in, approve the protected-storage
prompt, and select **Check access**. Protected UI must appear only after real
SecureStore and canonical HTTPS validation. For process restart:

```powershell
adb -s emulator-5554 shell am force-stop com.myims.responder.acceptance
adb -s emulator-5554 shell monkey -p com.myims.responder.acceptance -c android.intent.category.LAUNCHER 1
```

The restarted app must validate the stored token before showing protected UI.
Cancel the authentication prompt or lock the emulator to verify blocked access
and explicit recovery. Do not disable storage authentication.

The test controls wrap actual `expo-secure-store` calls in a staged copy of the
same production adapter. They simulate precisely these failure boundaries:

| Control                    | Procedure and expected result                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reject next token write    | Arm before sign-in with no stored token. The actual protected pending marker is written, then the token write is rejected. Authenticated UI stays hidden; the controller revokes the issued orphan and clears storage, or remains quarantined if revocation fails.                                                                                                                                                                              |
| Reject next token deletion | Sign in normally, arm, then sign out. Server revocation occurs first; the actual marker persists and deletion is rejected. UI remains blocked; explicit cleanup retry removes retained token/marker. Restart cannot restore revoked authority.                                                                                                                                                                                                  |
| Pause next token write     | Start with no stored token, arm, sign in, and wait for the pause message. The actual marker exists; token write is held indefinitely. Force-stop promptly, before the adapter's 15-second deadline, and relaunch. Restart must refuse token adoption. Explicit cleanup clears the marker. If process loss prevented orphan revocation, that unreachable issued token expires server-side and the restarted app cannot claim to have revoked it. |
| Clear fault                | Disarm the next injected fault. It does not release an already paused operation; force-stop that test process.                                                                                                                                                                                                                                                                                                                                  |

The injected write/delete rejections are simulated failures around real OS storage,
not proof that Android itself generated those failures. Record that distinction.
The success, restart, marker and authentication-prompt checks require real native
execution. No test controls or CA plugin are imported by the normal responder app.

Continue all twelve steps in the [Android acceptance matrix](../planning/p2-u4c-android-emulator-preparation.md#required-acceptance-procedure),
including A/B access/revocation, response-loss retry, reset, approved idle/absolute
deadlines, channel isolation and native UI. Record only finite outcomes, build,
replica and state transitions. No tokens, passwords, capabilities, headers,
storage dumps or unredacted device logs belong in evidence.

## Optional private server-driven ADB

Desktop execution does not require an ADB tunnel. For later server-driven checks,
start the desktop ADB server and keep this separate terminal open:

```powershell
adb start-server
ssh -N -o ExitOnForwardFailure=yes -R 127.0.0.1:5038:127.0.0.1:5037 gino@203.177.64.131
```

This exposes the desktop ADB server only at server loopback 5038. Do not bind ADB
publicly. Report `127.0.0.1:5038` and `emulator-5554` after the tunnel is running.
No such ADB connection is currently configured or verified.

## Server readiness commands

```text
./dev staff-https-check
./dev exec node scripts/check-staff-access-https.mjs private/staff-access-config.json private/mkcert-rootCA.pem
./dev exec pnpm check:staff-auth --mobile
```

The configured ingress checker chooses the workspace interface for an unambiguous
socket client when bound to a wildcard address. Loopback-only source chains can
deliberately deny with 400 under the existing trusted-proxy policy. A loopback
probe's 400 alone does not establish an ordinary client CSRF failure. Public CA
validation, sign-in page, browser CSRF and native/browser channel denial passed
through the private-interface path at this checkpoint. Full device acceptance
and P2-U4c/P2-U4 completion remain pending.
