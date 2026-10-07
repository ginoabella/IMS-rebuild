# Staff credential lifecycle operations

Owning policy: [approved G-01–06](../planning/p2-u4a-credential-contract-review.md).
Implementation: [qualified lifecycle contract](../architecture/qualified-credential-lifecycle.md).
User procedure: [handoff guide](../guides/staff-credential-handoff.md).

Apply deployment-owned migrations with `./dev migrate` before starting updated
HTTP replicas. Migration `20261007010000_credential_actions` requires the existing
identity, audit and draft-provenance migrations. Runtime never migrates and cannot
rewrite action metadata, revive a terminal action or delete retained rows early.
No production fixture accounts/actions are seeded.

## HTTPS consumer configuration

Provide separate complete server-only `CREDENTIAL_EXCHANGE` and `STAFF_ISSUER`
configuration groups. Backend suffixes are `ORIGIN`, `PROXY_PEERS`, `PROXY_SECRET`
and `CSRF_SECRET`. Origins must be exact HTTPS origins, peer addresses must also
be declared under `LIMITER_TRUSTED_PROXIES`, and secrets must be distinct 32-byte
hex values. Missing groups deny the corresponding boundary; partial/invalid groups
fail configuration. Neither is inferred from platform authentication configuration.

The command-center Next process additionally requires each consumer's
`BACKEND_URL` and `INGRESS_SECRET`, plus the same `ORIGIN` and `PROXY_SECRET`.
Use distinct ingress/proxy secrets. The backend URL is the exact private HTTP/HTTPS
origin; it must not contain path/credentials. Keep Next and backend listeners
private. An authenticated TLS ingress must overwrite `X-MyIMS-Ingress`,
`X-MyIMS-Client-IP`, and routing metadata, derive source from its trusted socket,
and strip client-supplied forwarded/proxy/ingress authority. Enforce exact public
host/Origin and browser fetch topology. Platform detail actions retain the existing
platform group. Never publish secret values in diagnostics or setup examples.

Recipient and issuer cookies should use separate browser contexts when sharing a
host. An ordinary staff/platform cookie is deliberately rejected by capability
exchange; the recipient context contains only the signed exchange forgery cookie.
Staff issuer session metadata is passive and carries a proof, never the opaque
session token. This unit supplies an existing-session issuer consumer, not staff
sign-in or a production native storage implementation.

The focused checks below supply actual separate temporary HTTPS operator/recipient
origins, isolated production Next outputs, exact proxy/ingress configuration,
independent production Nest replicas, PostgreSQL runtime grants and authenticated
Redis. They remove owned temporary processes/certificates/database/Redis fixtures.
They do not change the user's existing private platform HTTPS supervisor or imply
that a persistent recipient ingress has been configured on this installation.
Use approved deployment configuration when hosting that recipient app; no public
plaintext secret-submission endpoint is provided as a fallback.

## Verification and recovery

- `./dev exec pnpm check:staff-auth --api`: capability/state/authority/password,
  real A/B races, rollback, committed version invalidation, stale Redis restoration,
  dependency/COMMIT-response loss and bounded retention checks.
- `./dev exec pnpm check:staff-auth --lifecycle`: the API matrix plus real HTTPS
  operator create/detail/issue, recipient exchange and controlled staff issuer UI.
- `./dev check`: full existing foundation/audit/storage/identity/session/platform/
  draft regressions, all five client artifact scans and lifecycle/browser checks.

Session Redis admission failure denies new credential actions with retryable 503.
Primary/audit/hash capacity failure cannot claim committed success. Reconnect allows
new operations; it never replays issue/exchange/cancel. Check canonical status and
follow explicit verified reissue after lost responses. Credential replacement
invalidates old authentication versions on every replica even when Redis deletion
fails or stale records return. Do not jointly restore PostgreSQL and Redis under
admitted traffic; existing recovery quarantine/invalidate-all policy still applies.

Use the explicit identity `CredentialActions.cleanup(1..100)` maintenance port for
eligible rows only. It audits removed count in the same transaction and returns
unavailable on required failure. No scheduler or blanket deletion is installed.
Terminal actions retain their rows until 30 days after the earlier terminal/expiry
instant; immutable audit/creation provenance retain their existing policy. Cleanup
of a missing action never makes its code valid again.

Debug using finite outcome codes and correlation/action IDs in authorized records.
Never paste passwords, capabilities, lookup hashes, cookies, CSRF/proxy/ingress
secrets or identity inputs into support output. Browser acceptance deliberately
avoids secret-bearing traces/screenshots and sanitizes failures.
