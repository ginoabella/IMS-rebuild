# Local recipient and staff HTTPS

Prepared and started 2026-10-12, Asia/Manila (+08:00), on the existing development
installation. Browser address: **https://127.0.0.1:3444/credentials**. This is a
private development composition, not production hosting or Android acceptance.

## Connect from your desktop

Keep the platform tunnel on port 3443 running. Open another desktop terminal and run:

```text
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3444:127.0.0.1:3102 gino@203.177.64.131
```

Keep that terminal open. Open **https://127.0.0.1:3444/credentials** in your
browser. It uses the same MyIMS development CA as the platform page; if that
CA was already imported and trusted on your desktop, no new CA is needed. Certificate
hostname and trust checks remain enabled. Follow the existing
[desktop CA/tunnel instructions](platform-development-https.md) if it is not trusted.

Enter the issuer's code in **Handoff code**, choose **New password**, repeat it in
**Confirm password**, and select **Set credentials**. Wait for **Credentials set.**
Use 15–128 characters and at most 512 UTF-8 bytes; preserve case, spaces and Unicode
exactly in both fields. Setup codes expire after 24 hours and are single use. Do not
put the code in the URL or send it/passwords in chat. Your code has not been consumed
by the deployment checks. See the [handoff guide](../guides/staff-credential-handoff.md)
for uncertain results, expired codes and explicit verified reissue.

The dedicated recipient IP hostname cannot receive the platform/staff cookies
issued on `localhost`. The previous localhost recipient address redirects here. Successful setup
does not sign you in or activate a draft tenant. Ordinary staff sign-in is at
**https://localhost:3444/sign-in**, and a draft administrator remains denied until
the separate activation workflow permits admission.

## Server lifecycle

From the project directory:

```text
./dev staff-https-start
./dev staff-https-status
./dev staff-https-check
./dev staff-https-stop
```

`start` runs detached in the existing workspace; repeating it while live returns the
existing status. `./dev staff-https` instead runs the same supervisor in the foreground
and can be stopped with Ctrl+C. Startup builds the normal backend/UI/command-center
applications with fixtures disabled, checks private ports and database readiness,
and starts the HTTPS listener. It performs no migration, setup exchange, identity
creation, tenant activation or platform restart. Stop affects only its owned child
processes. It must be started again after workspace shutdown/recreation.

| Component               | Configuration                                                                 |
| ----------------------- | ----------------------------------------------------------------------------- |
| Desktop staff origin    | Exactly `https://localhost:3444`                                              |
| Desktop SSH destination | Server `127.0.0.1:3102`                                                       |
| HTTPS ingress           | Workspace port 3002, existing host-loopback publication                       |
| Next command center     | Workspace `127.0.0.1:3004`, unpublished                                       |
| Ordinary Nest backend   | Workspace `127.0.0.1:4002`, unpublished                                       |
| Database/Redis          | Existing runtime credentials and canonical shared services                    |
| Recipient origin        | Exactly `https://127.0.0.1:3444`                                              |
| TLS                     | Private companion localhost/IP leaf signed by retained development CA         |
| Transport material      | Private `.local/staff-development-https/auth.json`, mode 0600, directory 0700 |
| Control                 | Private owner-only Unix socket in that directory                              |

Port 3002 normally belongs to the public-web development app. It was unused when
this composition started and supplies an existing **loopback-only** publication;
stop this companion before running `./dev public`. The currently public host port
3100 is not used for secret submission. No Docker workspace recreation or new public
port is needed. Next receives only its server-only transport configuration, not
database/Redis/deployment credentials. Staff and exchange proxy/CSRF secrets are
separate and distinct from the platform's secrets. The browser ingress overwrites
trusted source/proof headers and the native channel accepts only its three named
routes. All private backend/Next listeners remain inaccessible from other containers.

The check command validates the real trusted CA/hostname, no-store recipient page,
secure host-only CSRF contexts, unauthenticated/protected and forged-channel denial,
direct-listener denial, normal client artifact secrecy and hydrated recipient form.
It uses a temporary workspace TCP tunnel and a Chromium test-only leaf SPKI pin;
Node separately proves CA/hostname validation. Your desktop must use actual CA trust.
It creates no fixture account or session and never submits a setup code/password;
canonical identities, credential actions and migration snapshots must remain equal.
The separate network probe verifies private listeners from the backend container.

## Android continuation

This gives the browser a working endpoint while Android preparation continues.
It does not make the development CA trusted by an Android app. Android native trust
must be separately declared and verified; do not turn off TLS or storage authentication.
The desktop tunnel can carry the same hostname/port bytes via `adb reverse`, but a
native development/release build still needs a valid trust configuration and real
SecureStore success/failure/restart evidence. This local supervisor currently runs
one backend replica; native A/B acceptance also needs the declared independent
second replica/switch procedure. Continue the
[Pixel_8_API_36 preparation document](../planning/p2-u4c-android-emulator-preparation.md).

P2-U4c and parent P2-U4 remain incomplete pending actual native acceptance.

## Recipient bootstrap troubleshooting

If **Set credentials** fails before exchange, inspect only the status number of
`GET /credential-actions/csrf` in the browser Network tab. Do not share its response
body, cookies, headers, setup code or password. A 401 means the browser context
cannot perform public exchange. First open the dedicated recipient address
`https://127.0.0.1:3444/credentials`. Platform/staff cookies issued on `localhost`
will not reach this hostname. Any deliberately copied workspace cookie on the
recipient host is still rejected; use a fresh recipient browser context in that
case. The client states that the code has not been submitted.

A bootstrap 403 shows a blocked request/address message; verify the exact
`https://127.0.0.1:3444/credentials` origin and its tunnel. A service failure retains
the unavailable/retry message. Failed bootstrap clears secret inputs and never
sends an exchange or consumes a code. A failure after the exchange request instead
uses the separate uncertain-outcome procedure in the handoff guide.
