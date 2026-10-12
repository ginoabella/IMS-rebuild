# Staff authentication HTTP operations

Requirement: [P2-U4b](../../context/feature-specs/p2-u4b-staff-authentication-http-and-transport-boundaries.md).
Routes/DTOs, configuration, ingress forwarding, errors, lifecycle and native-storage
outcomes: [transport contract](../architecture/staff-authentication-http.md).

Use the existing Docker workspace, runtime PostgreSQL grants and session Redis.
No new migration, identity or session store is required. Configure a complete
independent `STAFF_ISSUER` group and exact trusted peers; absent configuration denies
staff transport. Exchange retains independent `CREDENTIAL_EXCHANGE` configuration.
This unit does not turn the platform development ingress into a staff deployment.
P2-U4c must integrate its actual same-origin command-center/native consumers with
the tested forwarding requirements. Production TLS/HA/traffic capacity remains pending.

Provision Chromium and its Linux libraries using the existing
[HTTPS browser prerequisites](platform-authentication.md#reproducible-verification) before the
first run on a fresh workspace. Run `./dev exec pnpm check:staff-auth --http`. This selector creates a disposable
migrated database and isolated authenticated Redis, uses runtime-role connections,
independent Nest HTTP processes, real a setup/reset and temporary TLS Chromium/native
probes. Test-only barriers, shorter lifetimes, dependency proxies and mutation routes
remain outside shipping HTTP. Fixtures remove only their own database/container/keys
and temporary certificates. No account or token details are printed.

Regress a using `./dev exec pnpm check:staff-auth --lifecycle`; foundation/identity/
session/platform/draft checks are included in final `./dev check`.

For 401, reauthenticate with tenant code/username/password; do not reconstruct a
session from local memory or Redis backups. Draft/disabled/unset/suspended/retired
identities receive the same login error. For 403 inspect declared channel, exact
Origin/private proxy peer and CSRF context without copying secrets into reports.
For 429 wait the bounded Retry-After. For 503 keep authority unknown and retry only
an explicit new read/action. Do not automatically replay authentication, mutation,
credential exchange, or logout writes.

Browser logout clears credentials only after confirmed durable revocation. If the
response is lost or 503, retain the cookie and show uncertainty; explicit retry uses
session proof, or bootstrap a fresh absence/expired-session context. A live session
rejects pre-context logout. Mobile logout follows the secure-storage port outcomes
in the contract. Revocation preserves another device. Credential reset invalidates
all staff devices; stale Redis restoration remains denied by current versions/fences.

Rollback by removing staff ingress/configuration and restarting normal HTTP replicas;
this disables transport without removing canonical credentials, audit or other devices.
Do not weaken Secure/HttpOnly/Origin/CSRF settings for HTTP preview access. Maintainer
owns backend transport diagnostics; c owns actual browser/native integration.
