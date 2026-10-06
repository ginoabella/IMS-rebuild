# Shared session, authority and admission operations

Contracts: [lifecycle/fences](../architecture/shared-session-lifecycle.md),
[canonical HTTP authority](../architecture/canonical-http-authority.md),
[distributed admission](../architecture/distributed-admission.md).

## Private access and service expectations

Use the existing private session Redis endpoint and primary PostgreSQL runtime
credentials from protected runtime files. Deployment/fixture administration has
separate owner credentials; HTTP receives no Docker socket or owner access. Never
put passwords/tokens in commands, URLs, shell history, evidence or metric labels.
Use protected secret files/private stdin/IPC and finite operation/outcome metrics.
Session/realtime Redis remain different services with no fallback.

Local session Redis has finite 128 MB maxmemory, `noeviction`, authenticated
private networking and AOF `everysec`. Isolated acceptance uses AOF `always` and
an owned anonymous data volume; this improves deterministic fixture restart and
does not establish production acknowledged-write durability. Runtime connects
only after confirming finite positive maxmemory/noeviction. Production credentials,
network access, TLS, persistence, ACL least privilege and failover topology require
production review; local development HTTP is not production TLS acceptance.

ACLs need the client's authenticated handshake/connection metadata and selected
Redis database, capacity `CONFIG GET` access, and bounded session commands
`GETRANGE`, `SET`, `DEL`, `EVAL`, `TIME`, `GET`, `EXISTS`. Admission additionally
needs `HGET`, `HLEN`, `HSET`, `PTTL`, `PEXPIREAT` within its explicit namespace.
The script checks write-command authorization before state allocation. Redis's
`redis.acl_check_cmd` requires the pinned supported Redis version. If capacity
settings cannot be read under the configured ACL, initialization fails closed;
do not broaden all commands to conceal that failure. Administration-only
`CONFIG SET`, ACL mutations, `SHUTDOWN`, snapshot inspection and fixture teardown
must not be granted to ordinary HTTP consumers.

At most four limiter registry keys exist, each with at most 8,192 identifying
fields plus one policy field and a fixed window TTL. Registry saturation is 503;
allowance exhaustion is 429. Monitor finite admitted/limited/invalid/unavailable
operation counts from `Admission.metrics()` (aggregate both replicas), process command deadlines/concurrency, Redis used/peak memory,
OOM/write failures, registry field counts/TTL and session load. Inspect counts,
not raw fields or identifying hashes. Fixture evidence measures full-registry
representation; production must include sessions, AOF/replication buffers and
headroom in capacity sizing. Never enable eviction to make these checks pass.

The existing Docker environment forwards these settings from `.env`; `.env.example`
lists approved defaults. Changes require a coordinated paused rollout and bounded
registry expiry, then `./dev up`/owning deployment recreation. Set actual trusted
proxy addresses explicitly; do not mark a client-controlled network trusted merely
to make forwarding headers work. Validate effective values without printing the
full environment or credentials.

## Failure symptoms and response

- 429 with bounded `Retry-After`: stop retrying until the fixed window ends;
  successful sign-in/logout does not reset budgets. No handler/verifier/renewal
  runs for that rejection. Shared NAT use can reach the source allowance.
- Generic retryable 503: Redis disconnect, timeout, authentication/ACL, capacity
  failure, canonical/fence unavailability or uncertain required write. Confirm
  shared services and capacity; never report unknown writes as successful.
- Generic 401: expired, absent, revoked, malformed or stale session. Lost session
  data requires fresh verified sign-in; there is no reconstruction from memory.
- 403: plane/grants or owning resource denial. Preserve canonical tenant isolation.

A failed Redis operation closes that connection. A later new operation establishes
one bounded authenticated/capacity-validated connection; an ambiguous write is
never replayed and offline queues are disabled. Current PostgreSQL fences and
canonical versions remain mandatory after reconnection. A committed sensitive
write can precede renewal failure; clients reconcile canonical state using their
own duplicate-request rules. Do not assume response loss means rollback.

## Controlled restore, quarantine and fencing

1. Close external session-dependent admission before restoring any data. Keep
   health reachable under its declared behavior. Record exact backup identities,
   captured times and primary PostgreSQL state privately. Health PING/readiness
   does not prove restored session authority.
2. Confirm current primary PostgreSQL canonical authentication/tenant versions
   and durable session lineage generations/revocations. They must not have rolled
   back with Redis. If their freshness is unknown, **keep admission closed** and
   use a separately reviewed invalidate-all procedure; this foundation does not
   authorize joint-store rollback or production failover.
3. Restore only the intended session Redis service while quarantined, preserving
   authenticated private access, ACLs, AOF, finite maxmemory and noeviction. Never
   flush unrelated development databases/namespaces. Restart/reconnect affected
   replicas through the bounded validated runtime. No restored record is usable
   merely because it exists.
4. If admission counters may have rolled back, remain quarantined until the
   longest configured window has elapsed after restoration (900 seconds at the
   approved defaults). Verify old registry TTLs have expired before reopening;
   shorter windows/config changes require coordinated rollout. This prevents a
   restored low counter from multiplying the current allowance. A restart with
   retained current AOF is different from arbitrary stale snapshot rollback.
5. Run controlled private probes through **both** HTTP replicas. Current primary
   fences must reject captured revoked/rotated tokens; canonical versions must
   reject pre-change account/role/credential/tenant tokens. Missing keys remain
   absent. A valid independent retained lineage may work only after all canonical,
   fence and limiter checks succeed. Keep tokens/probes out of diagnostics.
6. Interrupt primary access during the probe: both protected replicas must remain
   503 and public live health retain its behavior. Resume only after current
   primary authority and fresh validated admission work. If any probe fails or
   recovery is interrupted, leave admission closed and investigate.
7. Reopen controlled traffic and inspect safe outcomes/capacity. Explain lost
   sessions as reauthentication, preserving unfinished work under the owning
   U3/U4 identity/tenant isolation contract. Recovery is never a local-session
   fallback or an implicit account/tenant reenablement.

Selective per-lineage fencing is the approved reset strategy: acknowledged
revocations and predecessor generations remain invalid, while unrelated retained
sessions need no global reset. Missing fences deny even after bounded retention
cleanup. No authority is granted during an interrupted primary recovery. Owning
sign-in transports must supply private operational probes before production;
fixture-only issuers/protected routes never ship in the production module graph.

## Reproducible checks and teardown

Start the documented Docker workspace/shared services with `./dev up`, then:

```sh
./dev exec pnpm check:session-foundation --lifecycle
./dev exec pnpm check:session-foundation --authority
./dev exec pnpm check:session-foundation --limits
./dev exec pnpm check:session-foundation
./dev check
./dev health
```

`--lifecycle` runs a. `--authority` runs b and a. `--limits` and the default run
c, b and a, including actual Redis shutdown/restart, exact captured record bytes,
primary TCP interruption/recovery, ACL and noeviction writes, ambiguous responses,
HTTP barriers and registry capacity/memory. CI runs the complete default selection.
No suite delivers a password verifier or sign-in/browser journey.

The host launcher creates one uniquely named pinned Redis container, private
random credential/configuration, bounded memory/AOF/noeviction and its owned
anonymous volume. The suite creates one unique `myims_session_` database through
trusted migrations and uses actual restricted runtime grants in independent HTTP
processes. Fixed markers ask the trusted launcher to restart only that container.
All HTTP probes/identities/sentinels and controlled faults are fixture-owned.
Finally, close/kill owned processes, close private relays, remove owned test ACLs,
drop that exact database, and remove that exact container/volume and credential
file. Never run a broad prefix cleanup against unrelated resources. Check failed
runs' exact captured resource identifiers before any manual cleanup.

These checks prove single-host controlled restoration against current primary
PostgreSQL. They do not prove production HA, arbitrary multi-store rollback or
browser/CSRF/mobile/socket acceptance. Hosted CI configuration is present; local
results do not claim hosted CI ran.

## Required production traffic review

Before production, measure representative simultaneous panels/polling and operator
workflows per canonical identity, aggregate mobile traffic sharing that identity,
and peak same-source/NAT traffic. The protected 120/minute identity default and
600/minute source default must accommodate normal expected behavior. If normal
traffic can reach the approved default, bring a proposed appropriate budget back
for review before production; do not knowingly throttle legitimate workflows.
Future transports must preserve this gate and measure actual request traces,
including passive polling. Foundation fixtures do not establish realistic product
traffic, since these workflows/mobile consumers are not delivered yet.

Validate the approved 8,192-field cap and combined session/limiter memory under
measured production cardinality and persistence/replication settings. TLS/HA,
capacity targets/alerts, traffic validation and owning transport probes remain
production gates. Policies for credential recovery, public intake, sockets and
other excluded operations remain their own required decisions.
