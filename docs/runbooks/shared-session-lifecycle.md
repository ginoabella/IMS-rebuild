# Session lifecycle operations and recovery

Contract and scope: [shared lifecycle](../architecture/shared-session-lifecycle.md).
This runbook covers backend primitives. P2-U2b supplies
[canonical HTTP guards](canonical-http-authority.md); sign-in/logout UI and
transport acceptance remain P2-U3/P2-U4.

## Settings and startup

Use the existing authenticated session Redis endpoint and protected auth file;
never use realtime Redis or pass secrets through URLs in user-visible output.
`loadBackendConfig` resolves the existing runtime database/session credentials.
Trusted deployment applies `20261006000000_session_fences`; runtime never migrates.

| Setting                         | Default | Ceiling |
| ------------------------------- | ------- | ------- |
| SESSION_WEB_IDLE_SECONDS        | 3600    | 3600    |
| SESSION_WEB_ABSOLUTE_SECONDS    | 43200   | 43200   |
| SESSION_MOBILE_IDLE_SECONDS     | 86400   | 86400   |
| SESSION_MOBILE_ABSOLUTE_SECONDS | 604800  | 604800  |
| SESSION_TIMEOUT_MS              | 2000    | 10000   |
| SESSION_CONCURRENCY             | 4       | 16      |

All values are positive integers; idle cannot exceed absolute. Redis startup checks
require a positive finite maxmemory and noeviction. Local session Redis already
uses 128 MB/noeviction and AOF everysec. Keep memory/capacity monitored; OOM grants
no session issuance/renewal/rotation. The Redis credential needs commands for
bounded record operations, Lua, TIME and read-only CONFIG GET capacity validation.
Production ACL/TLS/HA deployment is not established by local verification.

## Failures and controlled Redis recovery

1. Stop admission or leave session-dependent operations unavailable while Redis or
   current primary fence authority is unavailable. Health connectivity alone is
   not a usable session check; the lifecycle port must check durable fencing.
2. Preserve the current primary PostgreSQL fencing table. Never roll it back with
   an old Redis image while serving session traffic.
3. Restore/start authenticated session Redis with bounded maxmemory/noeviction.
   Reconnect/rebuild trusted session runtimes after connection closure. No write
   retry is authorized by an uncertain result.
4. Check retained valid tokens through the lifecycle on independent processes.
   Restored revoked/replaced tokens must deny; missing tokens require sign-in.
   Interrupted recovery/failed durable reads must remain unavailable.
5. Resume only through verified lifecycle consumers. Never recreate sessions from
   process memory, issue a locally retained replacement, or use realtime Redis.

Acknowledged revocations/rotations remain fenced by current PostgreSQL metadata.
Uncertain issuance/rotation returns no token; the owning sign-in workflow recovers
access. Uncertain revocation reports unavailable and may be safely retried with
the same trusted reference; it never reports false success. Retained records
recover independently of any process cache.

For joint PostgreSQL/Redis rollback, stop traffic and resolve a controlled global
invalidation procedure before opening session-dependent operations. This unit
ships no general administrator reset command and makes no joint-restore/HA claim.

## Bounded maintenance and verification

Later owning internal workflows may call `cleanupExpired(limit)` for 1–100 expired
metadata rows and `cleanupInvalidated` for at most 100 known token/reference pairs
only after canonical version changes commit. Do not scan arbitrary session keys
or delete live fences. Missing fence rows fail closed after cleanup.

Run the focused host command:

```sh
./dev exec pnpm check:session-foundation --lifecycle
./dev check
```

The supported host launcher owns a uniquely named authenticated Redis container
and anonymous data volume; the suite owns a uniquely named disposable PostgreSQL
database with real deployment/runtime grants. Credentials are generated privately
and sent over fixture stdin/IPC. Independent OS processes share those services;
private TCP proxies test real executed writes with lost responses. The fixed
restart marker is consumed by the trusted host launcher to restart only its
Redis container. No fixture listener/issuer is registered in production.

The bare workspace pnpm command needs the isolated launcher's private stdin
configuration; use the host command above. Full Docker/CI checks invoke this
launcher automatically. Teardown terminates fixture children/proxies, drops only
the named fixture database and removes only its Redis container/volume/private
configuration. Interrupted fixtures require inspecting their exact names before
cleanup; never purge operational PostgreSQL/Redis data or broad container patterns.

Owning UI/transport units must preserve unfinished incident work during expiry
and required reauthentication, with identity/tenant isolation and no expired
submissions. This is a required handoff, not a completed UI flow.

P2-U2c's [integrated runbook](session-foundation.md) extends these steps with shared
limits, bounded new-operation reconnection and counter-rollback quarantine.
