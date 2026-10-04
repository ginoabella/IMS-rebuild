# Shared services in Docker

PostgreSQL/PostGIS, session Redis, realtime Redis and Asterisk run in four Docker
containers. Install only Docker Engine and Compose for these services; do not
install their runtimes or CLI tools on the host. The default application workspace
also runs Node/pnpm in Docker; use `./dev up`, `./dev status`, and `./dev down`.
See the [development workspace runbook](development-container.md). The commands
below remain available for developers choosing the optional host Node workflow.

## Start, inspect and stop

From the repository root:

```sh
pnpm services:up
pnpm services:status
pnpm services:check
pnpm services:down
```

`up` downloads the pinned images if needed, generates service passwords once,
starts all four containers and waits for health checks. `check` queries real
PostgreSQL/PostGIS, pings both Redis services, checks Asterisk 22 and verifies its
SIP transport. `down` stops/removes only this Compose project's containers/network;
it retains named data volumes and the generated password. Run `up` again to resume.
The containers are currently running. Starting them again is safe.

Docker and Compose must be available to the current user. The first image download
needs registry access. These scripts add no new application dependencies.

## Connections and persistence

| Service            | Host connection             | Container connection  | Persistence                                 |
| ------------------ | --------------------------- | --------------------- | ------------------------------------------- |
| PostgreSQL/PostGIS | `127.0.0.1:5433`            | `postgres:5432`       | Named database volume                       |
| Session Redis      | `127.0.0.1:6380`            | `session-redis:6379`  | Named volume, AOF every second, no eviction |
| Realtime Redis     | `127.0.0.1:6381`            | `realtime-redis:6379` | Ephemeral notification transport            |
| Asterisk SIP       | `127.0.0.1:5062/udp`        | `asterisk:5060/udp`   | Named PBX data, spool and log volumes       |
| Asterisk RTP       | `127.0.0.1:10020–10039/udp` | Same UDP range        | Media is live runtime state                 |

Host bindings are local development connections; the development workspace uses
Compose service names. The DB name and user are `myims`. Its random password is
in `.local/shared-services/postgres-password`, excluded from Git, with owner-only
file permissions. Compose mounts it as a secret; no password is committed or
printed. Keep that file with the database volume. If the file is missing while
an existing database volume remains, startup refuses to generate a different
password; restore the original file. Deleting volumes is not part of normal stop.

Port overrides: `MYIMS_DB_PORT`, `MYIMS_SESSION_REDIS_PORT`,
`MYIMS_REALTIME_REDIS_PORT`, and `MYIMS_SIP_PORT`. For example:

```sh
MYIMS_DB_PORT=5434 pnpm services:up
```

Use the same overrides for subsequent commands. The RTP range is specified in
both Compose and `infra/asterisk/bootstrap/rtp.conf`; change them together when
an explicit telephony networking decision requires it.

The realtime Redis container stores no canonical history. Reconnect recovery
will reload PostgreSQL state when the realtime feature is implemented. The local
Redis services require separate generated passwords and are bound only to loopback
and the project's Docker network. Each credential is stored in a
`.local/shared-services/*-redis-auth.conf` file inside the owner-only directory,
mounted as a Compose secret. The file itself is readable by the container's Redis
user; the parent directory prevents access by other host users. Preserve these
files when restarting. Production TLS/ACL/HA and operational recovery remain
gated by their owning implementation units.

## Asterisk boundary

Asterisk runs with a minimal PJSIP transport and no endpoints, trunks, tenant routes
or permitted outbound calls. AMI and HTTP/ARI are disabled in this bootstrap.
Configuration is mounted read-only. The image's default entrypoint is replaced
with foreground Asterisk startup so it does not change ownership of host-mounted
configuration. PBX data and recordings/spool remain in Docker volumes.

This proves PBX process availability and transport loading only. P3 owns controlled
management connectivity/secret access, inventory, desired-state compilation,
validation/apply/rollback and live call verification. External phones and public
SIP/media access require an approved networking setup in those units.

## Images and scope

Compose pins PostgreSQL 17/PostGIS 3.5, Redis 8 Alpine and Asterisk 22.10.1 images
by SHA-256 digest. The Asterisk image is maintained by
[andrius/asterisk](https://github.com/andrius/asterisk), rather than an official
Asterisk image. The [PostGIS image](https://github.com/postgis/docker-postgis)
provides the extension in the initial database. Password mounting follows
[Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

Image updates must deliberately change the digest and repeat the service checks.
The current environment is Linux amd64; other host architectures are unverified.
The Compose setup is development infrastructure, not production availability.
Backend connections, baseline versioned migrations, typed runtime configuration
and liveness/readiness are implemented by the [backend foundation](backend-foundation.md). No incident,
identity or tenant schema is created by this increment.
