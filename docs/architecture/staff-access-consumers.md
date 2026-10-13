# Staff access consumers and isolated recovery

P2-U4c implementation checkpoint, 2026-10-12, Asia/Manila (+08:00).
Native OS/device evidence remains pending. Policies and authoritative stores stay
with [a](qualified-credential-lifecycle.md) and [b](staff-authentication-http.md).

## Browser composition

`apps/command-center-web/app/(staff)` supplies server-checked home and administrator
issuer pages. The server verifies a canonical staff session using the named b
browser channel. Every issuer action also revalidates backend canonical tenant,
target and permission. Sign-in contains exactly three identity fields. Protected
routes are dynamic; auth/issuer responses and ingress protected HTML are no-store.
The public `/ui-preview` renders only static shared-component examples; it has no
operational content or authority. Public `/credentials` remains the approved
capability exchange consumer. Navigation never supplies backend permission.

`STAFF_ISSUER` origin/backend/proxy/ingress configuration is independent of platform
configuration. Ingress overwrites client attribution/path/proof from socket state;
Next accepts that proof and forwards only four named browser auth consumers with
bounded 4096-byte bodies/responses and allowlisted host-only secure cookies.
Browser Authorization, invalid origin/fetch metadata, unsafe returns and queries
deny. Only literal delivered local return paths are accepted. Setup/reset forwarding
continues to use a's separate named contracts. The staff HTTPS ingress rejects
browser credentials on native routes and supplies server-only native proof to
three exact mobile consumers. Private upstreams and TLS deployment are explicit.

Mounted work uses canonical `{tenantId,staffId}`, an owner key and callback epoch.
Unknown/expired authority hides presentation, protected overlays and focus; passive
rechecks never renew. Sign-in/revalidation must reload canonical owner; owner
replacement clears work. Logout uncertainty permanently blocks workspace reuse
until explicit retry confirms revocation. Cross-tab signals can invalidate/hide but
cannot grant authority. A delayed logout signal cannot clear a currently valid
new session merely on the signal's assertion. Passwords/capabilities never enter
retained work. Epochs also fence sign-in after visibility loss/unmount.

The cohesive shell lifecycle is intentionally kept in one state-machine component
(approximately 370 lines): validation, hiding, reauthentication and logout share
one epoch/authority/uncertainty state. Issuer disclosure uses its existing independent
owner-fenced hook, receives hide/restore/logout signals and canonically validates
again before presenting values. Tests compile incident-form and write consumers
through explicit fixture aliases; normal builds use empty/denying implementations.
The test-only transactional writer uses existing canonical guards and runtime grants.
No incident draft or operational workflow ships in this unit.

## Native storage and authority

Expo `expo-secure-store` is pinned by the lockfile to SDK 55's compatible release.
The namespace is `myims.responder.staff.v1`; token and pending-operation marker
live only in OS protected storage. Device authentication is required and iOS uses
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Android encrypted storage/Keystore and iOS
Keychain behavior need their declared OS verification; see
[Expo's platform contract](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/).

Storage operations have a 15-second presentation deadline and one underlying
flight. A timed-out native operation cannot be cancelled reliably: it remains
exclusive until settlement, and the app remains blocked. Writes set a protected
pending marker before replacement, read back the token and remove the marker only
after confirmation. Deletion sets the marker, removes/verifies the token, then
removes/verifies the marker. Restart with a marker blocks adoption. A narrow
`readForRevocation` reads quarantined material only for explicit server logout;
it never establishes presentation authority. Locked/unavailable reads do not
select an owner or fall back to another store.

The controller holds token/orphan/epoch only in transient memory. Successful sign-in
must confirm storage and then current canonical HTTPS session before showing protected
content. Failure revokes the issued orphan explicitly. If revoke/cleanup fails,
retry remains quarantined. A server-confirmed revoke is remembered transiently
so local deletion retries do not require the revoked token. Process restart still
validates any leftover token against canonical authority; revoked/stale tokens deny.
When a process dies before an issued token reaches storage, that undisclosed orphan
cannot be recovered locally and expires under the unchanged backend deadline.
No client reconstructs its token or claims revocation of that unreachable orphan.
When protected storage has no retrievable token, local cleanup explicitly reports
that no stored session was available to revoke; absent-token logout cannot identify
an undisclosed or OS-invalidated orphan.

Replacement first revokes/cleans the previous token; it never keeps using a revoked
predecessor. Current-session reads, foreground checks and an open app are passive.
Idle/absolute timers hide authority, and b retains original absolute deadlines
through rotation. No mobile operational write/rotation endpoint or automatic write
replay is added. Reset/role/status/tenant changes deny retained tokens canonically.
Mobile fetch uses exact HTTPS origin, omitted cookies, bounded deadlines, fixed
routes and generic errors. Tokens/passwords never enter diagnostics, URLs or React
presentation state. Device evidence must include actual storage/restart/locked/fault
and logout behavior; JavaScript failure-port tests and bundle export prove only
those stated boundaries.
