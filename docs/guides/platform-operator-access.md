# Platform operator access

A deployment administrator must first provision the initial operator using the
[secure bootstrap procedure](../runbooks/operator-bootstrap.md) and configure
the HTTPS console and private proxy through the
[authentication runbook](../runbooks/platform-authentication.md). Use the exact
configured console address. The ordinary HTTP foundation preview does not support
operator authentication. No default account or password is supplied.

For this development repository, the
[private HTTPS setup runbook](../runbooks/platform-development-https.md)
provides exact server, Windows and macOS instructions, certificate trust, the SSH tunnel
and the final browser test using your bootstrap credentials. The approved address
is `https://localhost:3443/sign-in`; use `./dev platform-https` on the server.

## Sign in and sign out

Open the console or its UI preview link. Enter Username and Password, then choose
Sign in (keyboard Enter works). Username ignores outer whitespace and casing;
password preserves exact spaces, case and Unicode bytes. A successful sign-in
opens the protected console. Choose Tenants to create and revisit draft organizations;
see the [draft tenant guide](draft-tenant-creation.md).

Invalid credentials preserves username and clears password. Access denied means
platform operator access is required. Too many requests displays a retry interval;
wait before trying again. Service unavailable or response uncertain requires a
new explicit attempt after recovery; the console never assumes sign-in succeeded.

Choose Sign out in the console shell. The workspace hides while the backend
confirms revocation across replicas. Confirmed success returns to sign-in and
clears this workspace's unfinished memory. Other device sessions remain separate.
If sign-out is not confirmed, use Retry sign out. Hidden content is not evidence
of confirmed shared logout; an uncertain response can already have revoked access.

## Expiry and unfinished work

Web sessions expire after 60 minutes idle or 12 hours absolute. Passive reads and
an open tab do not extend the session. When protected submission receives 401,
the console hides unfinished non-secret values and asks for sign-in. Use the same
operator to resume values still held in this mounted workspace. Review and submit
explicitly after recovery; the previous attempt never replays automatically.
A different operator receives a clean workspace. Explicit logout clears values.

Denied access and service outages block actions and offer recovery feedback without
silently deleting unfinished work. Retry access reloads current backend authority.
Returning to a hidden tab or using browser history also requires validation before
protected content is shown. Cross-tab signals accelerate hiding but do not replace
backend checks.

The tenant creation form retains values and unresolved attempts in mounted memory.
PBX administration and durable incident drafts remain later work. Refreshing, closing the tab
or losing the browser process loses in-memory values; real incident recovery and
conflicts belong to P5-U4. Account recovery/reset and staff access are separate units.
