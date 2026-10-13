# P2-U4c Android emulator preparation

Prepared 2026-10-12, Asia/Manila (+08:00), for user review and setup.
This records prerequisites, not completed device acceptance.

2026-10-13 update (Asia/Manila, +08:00): desktop is Windows, serial
`emulator-5554`. The separate mkcert ingress is declared at
`https://localhost:3444`; verified server routing/trust is ready, but Android
trust/install/storage evidence is pending. Follow the concrete
[Windows desktop execution and isolated fault-build instructions](../runbooks/staff-native-acceptance.md).
No private ADB tunnel is currently configured.

The [local recipient/staff browser companion](../runbooks/staff-development-https.md)
is now running for staff at `https://localhost:3444` through desktop SSH forwarding to server
loopback port 3102. It reuses the platform development CA; actual Android trust of
that CA, the native build and device storage evidence are still unverified.

## Declared target

| Item | Current value / needed information |
| --- | --- |
| AVD | `Pixel_8_API_36` on your desktop |
| Android | API 36, extension `36-ext17`; record the actual OS/build below |
| Desktop OS | Windows (user declared 2026-10-13) |
| ADB serial | `emulator-5554` (user declared; connection still unverified) |
| App | MyIMS Responder, Expo SDK 55; native development or release build |
| HTTPS origin | `https://localhost:3444`, separate mkcert ingress; desktop reverse/tunnel and native trust still need verification |
| Storage | Expo SecureStore, namespace `myims.responder.staff.v1`, device authentication required |
| Evidence | Not yet collected; C-05/06 and full C-09/parent acceptance remain pending |

The server cannot reach an AVD using its name alone. The simplest arrangement
is for you to run the native steps on your desktop and report the nonsecret
results. If you want server-driven ADB testing, use a private SSH tunnel for the
ADB server; do not publish ADB to the Internet. Confirm that arrangement and its
local port before configuring it. No ADB connection has been established here.

## Prepare the desktop and emulator

1. Install Android Studio, SDK/platform tools for API 36, and a compatible JDK.
   Start `Pixel_8_API_36` in Device Manager. Keep one emulator selected for this check.
2. Run the following on your desktop. Commands work in PowerShell and Bash.

   ```text
   adb devices -l
   adb -s emulator-5554 shell getprop ro.build.version.release
   adb -s emulator-5554 shell getprop ro.build.version.sdk
   adb -s emulator-5554 shell getprop ro.build.version.security_patch
   adb -s emulator-5554 shell getprop ro.build.fingerprint
   ```

   Replace `emulator-5554` with the reported serial. Share only the AVD/serial,
   desktop OS, Android release/API and build information; no credentials.
3. Configure a screen lock and enroll a fingerprint in Android Settings.
   Use the emulator's fingerprint controls to complete authentication prompts.
   An emulator without usable authentication must remain blocked by the app;
   do not turn off `requireAuthentication` to obtain a passing result.
4. Prepare a current checkout with its frozen pnpm lockfile. The normal repository
   builds/checks use Docker. Native compilation runs on the desktop that owns
   Android Studio and the emulator.

## Choose and prepare HTTPS

Provide an exact staff HTTPS origin, for example `https://staff.dev.example:3444`.
The name is illustrative, not a configured endpoint. It must resolve from the
emulator, and its certificate must match that hostname and have a chain trusted
by the native app. A trusted public certificate is the preferred straightforward
option. A private CA requires a separately declared Android trust configuration
and evidence; installing a CA in the desktop browser alone is insufficient.

Keep hostname and certificate validation enabled. No HTTP fallback, certificate
verification bypass, permissive trust-all handler or browser-cookie authentication
is permitted. Expo Go is insufficient for proving the configured native build and
protected-storage behavior; use a development or release app build.

For private access, a desktop SSH forward can connect a reachable server-private
ingress to a desktop loopback port:

```text
ssh -N -L 3444:SERVER_PRIVATE_INGRESS_ADDRESS:SERVER_PRIVATE_INGRESS_PORT USER@SERVER
adb -s emulator-5554 reverse tcp:3444 tcp:3444
```

The address/port/user/server above must be filled from the declared deployment.
`adb reverse` transports bytes; it does not configure DNS or TLS trust. Retain the
certificate hostname in the app origin and supply matching emulator DNS/host
routing, or use a certificate valid for your selected emulator-reachable address.
The usual `10.0.2.2` address reaches desktop loopback, but a certificate for another
hostname will not validate against it. Do not substitute that IP without a matching
certificate and trust setup. The existing platform SSH URL authenticates platform
operators and is not automatically a staff/native endpoint.

## Server composition to prepare

The feature delivers `scripts/staff-access-https.mjs` and the reusable
`scripts/staff-access-ingress.mjs`. The ingress sends browser requests to the
production command-center Next application and forwards only mobile `sign-in`,
`session`, and `logout` to private ordinary Nest HTTP processes. It derives source
from the socket and supplies the native proof internally. Never put that proof in
the mobile build or desktop command arguments.

Use the existing database/runtime role/session Redis. Configure both ordinary
backend replicas with the same exact `STAFF_ISSUER_ORIGIN`, trusted private peers,
proxy secret, CSRF secret and lifetimes. Include private proxy peers in
`LIMITER_TRUSTED_PROXIES`. Preserve platform/exchange configuration independently.
The Next server additionally needs `STAFF_ISSUER_BACKEND_URL` (the private A/B
upstream) and a distinct `STAFF_ISSUER_INGRESS_SECRET`. Recipient setup/reset
requires its complete `CREDENTIAL_EXCHANGE` group. Private backend/Next listeners
must remain unreachable from browser/device clients.

Create an owner-only configuration file outside tracked source. This is the schema;
replace placeholders with private values, never paste the filled file into chat:

```json
{
  "origin": "https://staff.dev.example:3444",
  "bind": "127.0.0.1",
  "port": 3444,
  "nextUrl": "http://127.0.0.1:3004",
  "backendUrl": "http://127.0.0.1:4002",
  "proxySecret": "64-lowercase-hex-server-only",
  "ingressSecret": "different-64-lowercase-hex-server-only",
  "keyFile": "/private/staff.key",
  "certFile": "/private/staff-chain.pem"
}
```

The launcher requires configuration/key file permissions `0600`. A container-private
bind may use `0.0.0.0`/`::` only in the declared private network without public port
publication. Docker workspace loopback is not host loopback: the SSH destination
must actually reach the chosen ingress. Do not recreate the existing workspace,
change platform hosting, or expose private Next/backend ports to work around this.
Build the ordinary apps with `./dev exec pnpm build:backend`,
`./dev exec pnpm --filter @myims/ui-web build`, and
`./dev exec pnpm --filter @myims/command-center-web build`. Start existing ordinary
backend/Next processes using protected environment files. An owner-only
`.local/staff-access/ingress.env` may contain the nonsecret file reference
`STAFF_ACCESS_CONFIG_FILE=/workspace/.local/staff-access/config.json`.
Then start the ingress:

```text
./dev exec node --env-file=.local/staff-access/ingress.env scripts/staff-access-https.mjs
```

The environment/configuration and routing need to be prepared before this command
can serve the emulator. The local browser companion above is configured and
running; its browser development CA does not establish native Android trust.
The generic ingress command here applies to the separately declared native
composition and is not required to open the browser recipient page.

## Build and launch the native app

For the currently declared Windows/mkcert setup, use the separate
[native acceptance build](../runbooks/staff-native-acceptance.md) instead of the
generic commands below. It supplies scoped CA trust and isolated fault controls.
The generic commands require a certificate already trusted by the native build.

Set only the nonsecret public HTTPS origin before building. From a desktop checkout:

PowerShell:

```powershell
$env:EXPO_PUBLIC_STAFF_AUTH_ORIGIN = 'https://YOUR_DECLARED_STAFF_HOST:3444'
pnpm install --frozen-lockfile
pnpm --filter @myims/responder-mobile exec expo run:android --device emulator-5554
```

Bash:

```bash
export EXPO_PUBLIC_STAFF_AUTH_ORIGIN='https://YOUR_DECLARED_STAFF_HOST:3444'
pnpm install --frozen-lockfile
pnpm --filter @myims/responder-mobile exec expo run:android --device emulator-5554
```

Use the selected ADB serial, record the generated application ID/build/version,
and rebuild if the origin changes. Expo's SecureStore plugin is configured in
`apps/responder-mobile/app.json`; its authentication policy is not an optional
fallback. The implementation uses Android encrypted storage backed by Keystore,
with authenticated access and bounded calls. Platform storage behavior follows
[Expo SDK 55 SecureStore documentation](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/).

## Required acceptance procedure

Use isolated controlled **active** tenant/staff fixtures with real a-issued
credentials, two independent backend HTTP replicas A/B and the declared TLS
composition. A genuine draft administrator may set credentials but must still
receive `Invalid credentials` at ordinary sign-in. Do not activate a real tenant
for testing or treat fixtures as production readiness.

| Step | Action | Required outcome |
| --- | --- | --- |
| 1 | Fresh start with absent token | Sign-in form, no protected presentation |
| 2 | Enter Tenant code, Username, Password; authenticate storage prompt | Token stored only by SecureStore; canonical protected request succeeds |
| 3 | Select backend B after login on A; tap Check access | Same canonical qualified owner, original absolute deadline |
| 4 | Force-stop app and reopen it | Protected content remains hidden until stored token passes canonical HTTPS validation |
| 5 | Background app; lock device or cancel storage prompt; return | Protected content hidden; unavailable storage blocks access and offers explicit recovery |
| 6 | Reject storage write after successful server issuance using declared native fault harness | No authenticated UI; orphan session explicitly revoked; unresolved response remains uncertain |
| 7 | Interrupt app during storage replacement/write | Protected pending marker blocks restart adoption; explicit sign-out reconciles retained token before cleanup |
| 8 | Sign out on B; repeat after a controlled lost response | No false success; Retry sign out revokes on A and preserves another device |
| 9 | Force a native delete failure after confirmed server revocation | Local access quarantined; explicit cleanup retry; restart cannot resurrect revoked authority |
| 10 | Reset credentials through real administrator issuer/recipient UI | Old stored tokens deny on both replicas; fresh password sign-in required |
| 11 | Test approved idle/absolute expiry using controlled backend clock | Open app/checks do not renew; protected access stops at expiry; rotation keeps original deadline |
| 12 | Try browser credential on native channel and native token on browser channel | Both deny; no cookie/capability fallback |

Steps 6/9 require a declared native fault harness and actual OS-storage evidence;
JavaScript mocks only prove the port. Do not claim those steps passed from a bundle
export. The harness may inject failures around the actual native SecureStore adapter
in a test build, but it must preserve the real-storage success/restart boundary and
record exactly which failure was simulated. No test fault switch ships in the app.

Do not record request bodies, cookies, authorization headers, passwords, tokens,
capabilities, full storage contents or unredacted device logs. Record finite outcome
codes, replica, platform/build, storage availability and observed state transitions.
Use synthetic nonsecret values if screenshots are necessary, and exclude secrets.

## Nonsecret evidence to return

```text
Desktop OS:
AVD / ADB serial: Pixel_8_API_36 / ...
Android release / API / extension: ... / 36 / 36-ext17
Android build / security patch:
App application ID / build / version:
Exact HTTPS origin (no credentials):
TLS certificate hostname / trust method:
Backend A/B switch procedure:
Screen lock / fingerprint setup:
Storage success / restart / locked or cancelled prompt results:
Interrupted write / failed write / deletion fault method and results:
Logout / response-loss retry / reset / expiry results:
Remaining failures or missing setup:
```

Once the configuration is reachable and these results are reproducible, resume
C-05/06/07 and the integrated acceptance matrix. Until then, P2-U4c and parent
P2-U4 remain incomplete regardless of independent browser/JavaScript checks.

The browser recipient page is now `https://127.0.0.1:3444/credentials`,
separate from the staff hostname to isolate workspace cookies. This recipient
host does not expose native staff authentication routes and is not the native app origin.
