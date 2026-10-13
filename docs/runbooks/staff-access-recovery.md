# Staff access verification and recovery

Read [transport contract](../architecture/staff-authentication-http.md),
[consumer contract](../architecture/staff-access-consumers.md) and
[Android preparation](../planning/p2-u4c-android-emulator-preparation.md).

## Checks

```text
./dev exec pnpm check:staff-auth --browser
./dev exec pnpm check:staff-auth --http
./dev exec pnpm check:staff-auth --mobile
./dev exec pnpm check:staff-auth
./dev exec pnpm check:ui
./dev check
```

Browser selection runs the integrated operator/recipient/staff
production Next HTTPS composition. `--lifecycle` additionally reruns a's complete real-service lifecycle and browser acceptance. HTTP selection reruns b's independent A/B
adapters, lifetime/version/channel/source/CSRF/outage checks. Mobile selection runs
JavaScript controller and injected storage-port failure checks only; its successful
exit does not satisfy C-05/06. The combined selector runs the existing complete
session/credential/browser/HTTP foundation graph; full Docker checks include all
required foundation regressions. Native OS evidence is a separate mandatory step.

Automated HTTPS fixtures own temporary localhost certificates and Chromium's
explicit test-only certificate exception. They do not prove public/native certificate
trust. Actual native HTTPS must validate the declared hostname/chain without a
verification bypass. Active identities are isolated fixtures; general activation
and production deployment remain separate. Fixture incident writes and UI aliases
are disabled in ordinary builds.

## Recovery

On browser expiry, keep the page mounted and explicitly sign in. Work resumes only
for the same canonical tenant/staff. Refresh/closed tab/crash loses mounted work.
On 503 or unknown access, hide data, stop submissions and use explicit Retry access.
No heartbeat/polling counts as activity. A credential reset requires fresh authentication.
If logout is uncertain, keep protected interaction blocked and retry sign-out;
canonical revocation and cookie cleanup must both be confirmed before completion.

On native storage failure, keep authority hidden. Complete the device authentication
prompt, then explicitly retry sign-out/storage cleanup if quarantined. Interrupted
writes retain a protected marker; it prohibits adoption on restart. Reconcile the
retained or orphan token using server logout, then delete/verify protected token and
marker. A failed deletion cannot restore authenticated presentation. If storage stays
locked or its flight remains pending, wait for OS settlement/unlock and retry; do
not change to plaintext or disable authentication. Process-loss undisclosed tokens
expire under existing deadlines and must not be falsely claimed as revoked.

Do not auto-replay sign-in, password replacement or operational writes after outages.
Collect only finite outcomes, timestamps, build/OS, source topology and replica;
never log token/cookie/password/capability/CSRF/proxy material or dump storage.
Native missing trust/build/device access holds c/parent completion; record precise
resume conditions in the tracker and evidence document.
