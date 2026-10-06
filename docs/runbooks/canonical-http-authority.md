# HTTP authority verification and handoff

Run from the host in the existing Docker workspace:

```sh
./dev exec pnpm check:session-foundation --authority
./dev exec pnpm check:session-foundation --lifecycle
./dev check
```

`--authority` runs real two-process Nest HTTP authority checks followed by a's
lifecycle regressions. `--lifecycle` retains a-only checks. Omitting the selection
runs all a/b/c checks, including the final session step of `./dev check`. The launcher creates
an authenticated, bounded isolated Redis container; the suite creates/migrates a
unique PostgreSQL database and applies actual runtime grants. Issuance and barriers
travel over private fixture IPC, never HTTP. Replicas use independent canonical
connections and shared services; resource fixture writes/audits use the runtime
role. Trusted administration creates disposable canonical fixtures and performs
malformed-fact checks only inside that database.

The checks cover same-named staff in two tenants, platform/staff separation,
permission and resource ownership, hostile identity/tenant/role input, public
health/unclassified routes, generic authentication errors, denied/failed/passive
activity, conditional successful renewal, canonical mutation/restore invalidation,
sensitive-write barriers, revocation fencing and actual isolated transport outages.
Only current-run Redis container/database fixtures are removed. Diagnostic and
HTTP-response scans reject token/hash/credential sentinels. Existing client scans
continue to exclude backend identity/session material.

For production consumers, import `IdentityHttpModule` through the HTTP graph,
classify every route with `HttpAccess`, read `requestPrincipal` and invoke the
owning use case. Use `principalActor` only after authorization. Enforce ownership
and sensitive-write transaction revalidation in that use case. Operational routes
must map failed application outcomes to unsuccessful HTTP outcomes before renewal.
There is no public issuer, administrative route or sign-in transport in this unit.

During session dependency failure, protected requests return retryable 503 and
health stays public. Restart a replica whose bounded Redis connection closed;
recovery must continue consulting canonical versions and durable fencing. See
[contract and transport limits](../architecture/canonical-http-authority.md) and
[existing lifecycle recovery operations](shared-session-lifecycle.md).
Distributed limits and integrated reconnect/recovery acceptance remain P2-U2c.

The [integrated session runbook](session-foundation.md) adds approved shared limits,
`--limits`, automatic bounded new-operation reconnection and restore quarantine.
