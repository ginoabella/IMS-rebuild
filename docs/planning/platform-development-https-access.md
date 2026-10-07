# Approved private development Platform Console access

Status: approved by the user on 2026-10-07; implementation and automated
verification complete. The user confirmed working Windows access/sign-in on
2026-10-07. macOS verification and explicit refresh/logout checklist confirmation
remain pending.

The [implementation runbook](../runbooks/platform-development-https.md) owns exact
server, Windows and macOS instructions, certificate trust, configuration, startup/shutdown,
troubleshooting and verification limits.

## Approved outcome

Use **https://localhost:3443/sign-in** on the browser computer through an SSH tunnel
to the development server's **127.0.0.1:3101**. Keep the server console and
associated authentication listeners on loopback or internal access. No public
console firewall port or domain is authorized at this stage.

The operator created by the user's successful `./dev bootstrap-operator` is the
account for the final browser test. Preserve the existing development database,
Redis/shared-service configuration, volumes and credentials. This increment must
not run migrations, create another operator or provision a disposable
authentication environment.

SSH provides private connectivity. HTTPS establishes the exact browser origin and
Secure cookie handling required by the delivered authentication contract. The
HTTP preview at `./dev platform` alone does not provide that setup.

## Implementation scope

- Docker-compatible HTTPS ingress on workspace port 3001, published only at host
  loopback 3101. The launcher checks the actual running publication and refuses a
  public binding or published private listeners.
- Normal production Next console on workspace loopback 3003 and a normal Nest
  HTTP replica on workspace loopback 4001. The existing backend container remains
  unchanged; the replica uses the existing database role and Redis services.
- Persistent owner-only development CA, localhost certificate/key and three
  distinct cryptographically random 256-bit authentication secrets under ignored
  `.local/platform-https`. Only a public CA export is transferred to Windows.
- Exact `https://localhost:3443` origin, private backend address, exact Next proxy
  peer and server-only secret configuration. Retain cookie/CSRF/canonical authority
  checks; never enable the browser verification build or a fixture issuer.
- Socket-derived ingress source, stripped client forwarding metadata, overwritten
  ingress headers, Host/Origin/fetch metadata validation and private listener
  boundaries.
- Prepare/start/status/stop/check commands, bounded owned-process shutdown, retained
  files on restart and Windows certificate trust instructions.

The regular HTTP preview and HTTPS ingress cannot use port 3101 simultaneously.
Listener preflight rejects conflicts without killing unrelated processes. The
browser's tunnel port 3443 is a loopback port on Windows, not a public server port.
An alternative port requires a coordinated origin change. Tunnel users can share
server-observed source rate limits; this setup does not prove production attribution
or capacity.

## Verification and handoff

Automated checks must prove certificate chain and hostname validation, rejection
of untrusted certificates, real CSRF response/cookie handling, unauthenticated
session denial, protected console redirection, Host/Origin/fetch/CSRF rejection,
forged metadata handling, private listener isolation, normal browser presentation
and retained identities/migration history/shared credentials.

Lifecycle verification must prove stop/restart reuses TLS and authentication
material and preserves existing operator records and backing-service containers.
No account credential is needed for these checks. Browser presentation on Linux
uses a narrowly pinned verified leaf key; workstation trust is verified manually.

The user confirmed working Windows access/sign-in after following the certificate
and tunnel procedure. The same runbook now includes macOS steps, which remain
unverified on an actual Mac. Refresh, sign-out and renewed access denial remain
checklist items until separately reported. Automated transport checks alone do
not certify the user's password or successful account sign-in.

P2-U3 remains complete. Staff access, PBX/tenant screens and production deployment
remain later work. See the [operator guide](../guides/platform-operator-access.md)
and [authentication runbook](../runbooks/platform-authentication.md).
