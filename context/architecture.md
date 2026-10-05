# Architecture Context

This document defines the target architecture and implementation guidelines for
MyIMS (Imergency Management System).

This is a new system built from a fresh application and database foundation.
Database schema migrations manage its schema evolution throughout development
and deployment.

## Product and Architectural Shape

MyIMS is a multi-tenant emergency response platform for LGUs and emergency
service organizations. Its five experiences are platform administration,
command center operations, tenant administration, responder mobile operations,
and public intake.

All channels converge on one operational journey:

```text
request received -> incident created -> responder assigned
  -> responder accepts and progresses -> command center monitors
  -> incident closed -> timeline and audit retained
```

Use a modular monolith with one backend codebase and separate process entry
points. Organize code by business capability and use case. Maps, telephony,
public channels, and reports extend the canonical incident and dispatch model.
Horizontal scaling is required from the foundation: replicate process entry
points while keeping authoritative state in shared backing services.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Language and workspace | TypeScript + `pnpm` workspaces | Shared language and dependency management across applications, backend, and packages. |
| Task graph | One dependency-aware build/test graph | Consistent lint, typecheck, test, and build execution. Optional `turbo` provides ordering and caching only; package behavior cannot depend on it. |
| Web | Next.js | Separate command center, platform console, and public intake applications. |
| Mobile | Expo React Native | Responder and public mobile applications. |
| Backend | NestJS | Business modules, HTTP/WebSocket transport, and independent runtime entry points. |
| Database | PostgreSQL + PostGIS | Canonical transactional and geographic data. |
| Persistence | Prisma and module-owned SQL repositories | Database access, constraints, migrations, and transactions. |
| Durable jobs | `pg-boss` on PostgreSQL | Retryable external work and background execution. |
| Sessions and rate limits | Redis in a separate service/container | Shared expiring sessions and atomic distributed rate-limit counters. |
| Realtime fanout | Separate production Redis deployment | Deliver tenant-scoped notifications across backend replicas. |
| Telephony | Asterisk | SIP, WebRTC, live call state, and raw recordings. |
| Mapping | MapLibre + approved OpenStreetMap-compatible tiles | Incident and responder map rendering. |
| Local runtime | Docker Compose | Reproducible development and single-host scaling checks. |
| Production runtime | Scheduler or managed container platform, selected by ADR | Multi-host replicas, load balancing, health-based routing, rolling updates, and autoscaling. |
| Shared web UI | `packages/ui-web` | Shared primitives and design tokens; reuse proven accessible patterns. |



## Development service containers

Development PostgreSQL/PostGIS, session Redis, realtime Redis and Asterisk run in
Docker Compose, without installing those service runtimes on the host. Application
processes run through pnpm inside a separate Docker workspace by default. Node,
pnpm, dependency volumes and build caches are isolated from host installations.
Git/editor/browser and mobile devices or emulators remain on the host. The
[development runbook](../docs/runbooks/development-container.md) defines launch
commands, ports and workstation portability. The
[shared-services runbook](../docs/runbooks/shared-services.md) defines local ports,
volumes, bootstrap configuration and pinned images. Asterisk runtime bootstrap
does not complete PBX administration or live telephony verification in Phase 3.

The development backend runs in a separate container with runtime-only secrets
and read-only source/dependencies. `./dev up` builds and migrates through the trusted
workspace/deployment path before starting the backend. Prisma owns versioned SQL
migration history; deployment locking covers schema application and runtime
credential provisioning, and HTTP never migrates. The baseline installs PostGIS
and grants a limited `myims_runtime` role access to migration metadata; domain
schemas/grants belong to their owning units. Typed configuration fails clearly
before startup. `/health/live` is process-only, while `/health/ready` checks the
baseline/PostGIS and both authenticated Redis services with bounded timeouts.
See the [backend runbook](../docs/runbooks/backend-foundation.md).

P1-U5a adds explicit same-connection transaction handles, module-owned append-only
SQL audit and immutable PostgreSQL outbox intent with separately mutable handoff
status. The [write contract](../docs/architecture/transactional-audit-outbox.md)
defines attribution, safe metadata/logging, grants and the P1-U5b handoff. Runtime entry points never migrate. P1-U5b adds independent pg-boss workers,
transactional queue/outbox handoff, retained results/receipts and a durable sample
destination. The [worker contract](../docs/architecture/durable-worker-delivery.md)
defines queue ownership, scoped idempotency and runtime grants;
[worker operations](../docs/runbooks/durable-workers.md) defines startup/settings.
P1-U5c adds integrated real-database recovery checks to the foundation/CI sequence
and shares the bounded worker shutdown policy with its process fixture. Database
interruption uses an isolated test-only connection proxy; the production topology
is unchanged. Identity authorization, live adapters and retention policies remain
with their owners.

P1-U6a uses user-approved Garage as a single-node S3-compatible Docker service
for development. Garage owns persistent metadata/data volumes; application replicas
use its private endpoint and have no disk fallback. Internal development HTTP is
approved; production hosting/TLS remain pending. P1-U6b uses explicitly approved GET-only
bearer references with a 120-second default and hard 300-second ceiling, issued
after canonical tenant ownership and consumer permission checks. Existing references
remain usable until expiry after logout/role/suspension changes; no immediate
revocation is promised. Fixture ports do not establish real identity enforcement.
See [storage contract](../docs/architecture/shared-storage.md).

## System Boundaries

### Applications

- `apps/command-center-web/` owns tenant staff operations and tenant-scoped
  administration: staff, responders, categories, extension assignment, and
  permitted ring-group/route choices.
- `apps/platform-console-web/` owns platform operator workflows. Its separate
  application reflects a separate identity and authority plane. It delivers
  Asterisk infrastructure management before tenant onboarding and maintenance.
  Tenant creation, organization lifecycle, PBX allocation, and shared telephony
  infrastructure belong to this console.
- `apps/public-web/` owns no-install public intake.
- `apps/responder-mobile/` owns assignment receipt, acceptance, progress, and
  field location sharing.
- `apps/public-mobile/` owns citizen mobile intake and approved public channels.

Applications consume backend contracts. They do not own authoritative lifecycle
rules, tenant authorization, database access, or PBX administration.

### Backend Runtime

`services/backend/` contains one modular backend with these entry points:

| Entry point | Responsibility |
| --- | --- |
| `src/entrypoints/http/` | Public and authenticated HTTP/WebSocket process. |
| `src/entrypoints/worker/` | Durable `pg-boss` jobs. |
| `src/entrypoints/telephony/` | Asterisk observation and trusted publication. |
| `src/entrypoints/deployment/` | Trusted administration commands with no listener. |

Keep their dependency graphs distinct. A shared codebase does not mean every
process starts listeners, workers, and PBX observers together.

### Business Modules

Under `services/backend/src/modules/`, use these capability boundaries:

| Module | Ownership |
| --- | --- |
| `platform/` | Platform operators, tenant registry administration, and platform audit. |
| `identity/` | Tenant staff identities, roles, credentials, authentication versions, and the shared Redis session-store adapter used by backend replicas. |
| `tenancy/` | Canonical tenant admission and lifecycle rules. |
| `incidents/` | Categories, intake drafts, incidents, lifecycle, and timeline. |
| `dispatch/` | Assignments and assignment status history. |
| `responders/` | Responder profiles, staff linkage, lifecycle, and availability. |
| `locations/` | Incident locations, responder observations, saved locations, and geographic boundaries. |
| `public-intake/` | Public request/session handling, replay protection, and canonical incident handoff. |
| `telephony/` | PBX inventory, tenant allocations, extension assignments, ring groups, dial plans, trunks, desired-state revisions/apply/rollback, synchronized calls/recordings, and trusted event receipts. |
| `audit/` | Append-only, actor-attributed operational events. |
| `reporting/` | Approved reports, exports, and consumer-specific read models. |

### Shared Packages, Infrastructure, and Documentation

- `packages/contracts/` owns small, domain-grouped schemas and transport types.
- `packages/ui-web/` owns reusable web primitives and design tokens.
- `packages/config/` owns typed configuration schemas.
- `packages/testkit/` owns builders and integration-test infrastructure.
- `infra/docker/`, `infra/asterisk/`, and `infra/database/` own local runtime,
  PBX, and database assets; `infra/redis/`, `infra/ingress/`, and
  `infra/production/` own shared Redis, load balancing, and production deployment
  and scaling definitions.
- `docs/` owns product contracts, architecture, user guides, runbooks,
  decisions, and current delivery status. `docs/README.md` is the documentation
  entry point for the new system.

## Module Structure and Dependency Rules

Each business module follows this structure, adding adapters only when needed:

```text
modules/incidents/
  domain/          entities, state transitions, pure rules
  application/     one use-case service per workflow
  adapters/
    db/            Prisma/SQL repositories
    http/          controllers and request/response mapping
    jobs/          durable job handlers when needed
  incidents.module.ts
```

- Controllers parse transport input, invoke one use case, and map its result.
- Application services coordinate transactions, domain rules, repositories,
  audit writes, and after-commit work.
- Domain rules are deterministic and do not import NestJS, Prisma, React,
  Asterisk, or environment configuration.
- Repositories belong to the module that owns the data. Cross-module access uses
  a small typed port owned by the caller, rather than broad service imports or
  direct queries into another module's tables.
- Commit the durable business decision before external side effects. Record
  external execution status separately and use durable jobs for retryable work.
- Add a projection only for a named consumer. Keep one authoritative model per
  fact; avoid duplicate catalogs, columns, and configuration representations.

Review production files above roughly 500 lines, React components above 300
lines, and contract files above 400 lines. Require a reason or split by use case;
these are review signals, not mechanical limits. Splitting must clarify ownership
and keep the workflow traceable.

## Storage Model

- **PostgreSQL:** Canonical tenants, identities, credentials metadata, incidents,
  categories, drafts, responder profiles, assignments, lifecycle history, public
  requests/sessions, telephony desired state and synchronized metadata,
  append-only audit, and durable `pg-boss` jobs.
- **PostGIS:** Canonical incident geography, responder location observations,
  saved locations, and geographic boundaries. Map interactions correct data
  through explicit backend workflows.
- **Asterisk:** Live signaling/call state and raw recordings. MyIMS persists
  synchronized metadata and access-controlled references, not competing call truth.
- **Redis sessions:** Short-lived shared authentication records and distributed
  rate-limit counters. PostgreSQL retains canonical credentials, roles, status,
  and authentication versions; Redis is not an operational system of record.
- **Redis realtime:** Cross-replica notification delivery, separated from the
  session workload in production. Durable publication uses a PostgreSQL outbox
  and retryable jobs, with canonical resynchronization after delivery gaps.
- **Attachment storage:** Shared object storage, with adapters in the foundation
  and evidence metadata/access workflows. The provider, 
  retention, and recovery details require a documented decision. Access uses
  tenant-checked, expiring signed references, never API replica-local disk.
- **Deployment configuration:** Bootstrap PBX connectivity, secret-store access,
  and allowed validation/reload commands. Editable PBX infrastructure and routes
  are authoritative PostgreSQL desired state, managed through the platform UI.
- **Secret store:** Credential material referenced by desired configuration;
  revisions and audit records contain references, never raw secrets.


Every tenant-owned table has a restrictive foreign key to `tenants`. Shared PBX
numbers are unique by PBX node, not just by tenant. Use consistent lifecycle and
concurrency fields such as `status`, `version`, `created_at`, `updated_at`, and
actor attribution.

Do not duplicate a telephony assignment in both a staff-user column and an
assignment table. Observed Asterisk registration is not desired configuration.
Secrets must never appear in desired-state snapshots or audit payloads.

## Horizontal Scaling and Infrastructure

```text
clients -> TLS load balancer / ingress -> web replicas
                                      -> HTTP/WebSocket replicas
                                           -> Redis session service
                                           -> Redis realtime service
                                           -> pooled PostgreSQL/PostGIS
                                           -> shared object storage
worker replicas -> PostgreSQL / pg-boss -> external integrations
telephony processes -> assigned PBX nodes -> Asterisk / recording storage
```

Web, HTTP/WebSocket, and workers scale independently. Keep authoritative
sessions, files, tenant state, and queues out of replica memory and local disk.
Use consistent signing/encryption configuration from the secret store. Configure
shared Next.js cache/revalidation coordination or disable inconsistent server
caches; all tenant data cache keys include tenant scope. The HTTP process hosts
WebSockets initially; a dedicated realtime entry point requires measured need.

Production begins with at least two HTTP replicas across failure domains and
highly available backing services. Provide readiness checks, resource limits,
graceful shutdown, traffic/connection draining, and rolling deployments. Compose
proves behavior on one host; a production scheduler handles multiple hosts.
A single Redis container is a development setup, not production availability.
Use managed Redis or monitored replication/failover, and shard with Redis Cluster
only when measured throughput/memory requires it. Replication can lose recent
acknowledged writes; document and test persistence and recovery objectives.

Budget PostgreSQL connections across every replica, use a compatible pooler,
index tenant-scoped queries, paginate results, and bound report cost. Optional
read replicas serve stale-tolerant reports; authorization and read-after-write
flows use the primary. Additional API replicas do not scale database writes.

Define and load-test concurrent users/sockets, request and location-update rates,
incident throughput, call concurrency, and data volume. Scale using latency,
CPU/memory, socket counts, and queue age/depth within replica and connection
limits. Apply tenant/user/IP limits with shared atomic counters, worker
concurrency budgets, and bounded fanout to contain noisy tenants.

### Distributed Realtime and Work Coordination

Publish committed changes through a PostgreSQL outbox and durable jobs, then
broadcast through a Redis-backed adapter to tenant-authorized sockets on all
replicas. Pub/Sub is not durable history: clients detect gaps with versions or
cursors and reload canonical state after reconnect or broker interruption.
HTTP authentication needs no sticky routing. Socket.IO HTTP long-polling still
requires load-balancer affinity despite the Redis adapter; WebSocket-only
transport removes polling affinity only when network/client support is verified.

Workers compete for `pg-boss` jobs and assume retries can duplicate execution.
Use idempotent handlers and database uniqueness/transaction rules. Coordinate
scheduled jobs, migrations, and PBX applies rather than executing them once per
HTTP replica. One active observer/configuration publisher owns each PBX node
through a database-backed lease with fencing and revision ordering; prevent
stale owners from applying configuration, deduplicate events, and reconcile
on failover.

Asterisk scales independently through additional PBX nodes and explicit tenant
placement/SIP routing. API scaling does not migrate active calls. Document PBX
failover, registration recovery, media capacity, and recording availability.

## Auth and Access Model

### Tenant Staff

Every staff identity belongs to exactly one tenant. Each tenant has an immutable,
globally unique normalized `tenant_code` and an editable `display_name`. The
organization name is not a login identifier.

The staff login form contains exactly these identity fields:

```text
Tenant code
Username
Password
```

Normalize tenant codes and usernames by trimming whitespace and applying one
documented case rule, preferably lowercase. Preserve display casing separately
only if needed. Enforce database uniqueness:

```text
UNIQUE (tenants.normalized_code)
UNIQUE (staff_users.tenant_id, staff_users.normalized_username)
```

Resolve the active tenant by normalized code, resolve its active staff user by
normalized username, verify the password and credential state, then construct a
session from database-loaded tenant ID, user ID, and roles. Return the same
`Invalid credentials` response for invalid tenant, username, password, tenant
status, or user status.

Reload canonical tenant and role data when constructing or refreshing sessions.
After login, a client-supplied tenant ID is never authorization authority.
Credential setup, reset, recovery, audit, and administrative updates must target
a tenant-qualified user ID, never a username alone.

P2-U1a implements the canonical tenant, staff and separate operator stores with
database ownership/normalization constraints, restrictive grants and audited
storage repositories. D-05 storage representation is user-approved: account
`active`/`disabled`, credential `unset`/`ready`, with no state creation defaults.
The [identity storage contract](../docs/architecture/canonical-identity-storage.md)
defines ASCII normalization/bounds, plane-qualified reads, version protections,
caller-owned tenancy registry port and deployment-only bootstrap provenance.
Role persistence, admission, password policy, authentication and bootstrap
execution remain with b/c and their decisions; sessions remain P2-U2.

### Shared Session Management

The identity module creates, validates, renews, and revokes sessions through a
Redis session-store adapter shared by all backend replicas. Redis runs in a
separate service/container; a custom session-manager application is unnecessary
initially.

Issue random opaque tokens and store only hashed lookup keys. Web sessions use
Secure, HttpOnly, appropriately configured SameSite cookies and CSRF protection;
mobile tokens use protected device storage and authenticated transport. Tokens
never appear in URLs or logs. Records contain identity plane, canonical user and
tenant IDs (tenantless for platform operators), authentication version, creation
time, idle expiry, and absolute expiry. Enforce TTL and absolute lifetime, rotate
on login/privilege changes, and renew/revoke atomically so concurrent requests
cannot recreate revoked sessions.

Check canonical PostgreSQL status and authentication version on protected
requests. Stored roles cannot preserve privileges after a role change, reset,
or suspension. Revoke affected sessions across replicas and reject version
mismatches, including stale records restored by failover. Existing sockets
revalidate periodically and before sensitive commands and disconnect when
revoked.

Use private networking, TLS, ACLs, persistence, monitored failover, bounded
memory, `noeviction`, and capacity alerts for session Redis. Handle write failures
explicitly and separate sessions from evictable caches and realtime traffic in
production. Redis outage returns retryable service-unavailable errors for
session-dependent operations; do not bypass authorization or fall back to local
sessions. Lost sessions require sign-in again. Test recovery and failover limits.

### Platform Operators and Public Intake

Platform operators use a separate identity store and tenantless sign-in. Platform
tokens cannot access tenant routes, and staff tokens cannot access platform routes.

Public callers cannot choose an arbitrary tenant. Resolve public tenant ownership
only through a deployment-owned entrypoint mapping. Public intake must apply
throttling and replay protection and expose neither a tenant directory nor
internal operational data.

Validate, tenant-scope, role-check, and audit every sensitive mutation. Apply
tenant and role boundaries across HTTP, WebSockets, exports, and file/recording
access. Clients never receive database credentials, PBX administration credentials,
raw Asterisk configuration, or another tenant's data. Browser calling must not
expose long-lived client PBX credentials.

## Telephony Architecture

Support shared Asterisk nodes while preserving tenant ownership:

```text
tenant gateway or DID -> tenant-specific inbound context
  -> tenant ring group -> tenant-owned extensions

tenant endpoint context -> approved shared or tenant-specific outbound trunk
```

A tenant can have its own gateway, DID, and extension range on a shared node.
Approved outbound trunks may serve multiple tenants; tenant contexts and route
bindings preserve attribution.

| Authority | Owned facts |
| --- | --- |
| Deployment configuration and secret store | Bootstrap connectivity, secret material/access, and allowed validation/reload commands. |
| PostgreSQL desired state | PBX nodes, trunks, gateways, DIDs, profiles, secret references, extension inventory, tenant ranges/reservations, endpoints/staff assignments, ring groups, dial plans, reserved patterns, tenant route bindings, and configuration revisions/validation/apply/rollback results. |
| Asterisk runtime | Live calls, registration observations, and raw recordings. |
| MyIMS synchronized metadata | Trusted call/recording observations and event receipts, with explicit reconciliation. |

The backend compiler produces versioned Asterisk includes, validates them,
installs them atomically, reloads approved components only, verifies the result,
and restores the previous known-good revision on failure.

Generate `sourceKey`, context hashes, watch identities, and runtime attribution
keys internally from deployment-controlled route identities. Tenant administrators
select business concepts rather than entering opaque keys. Never infer trusted
source identity from a phone number. Unknown or ambiguous events fail closed.

### Asterisk and Tenant Management UI

Deliver Asterisk management in the platform console before tenant management.
Operators manage PBX connectivity/health, individual and bulk SIP/WebRTC
extensions, credential setup/reset, ring-group membership/strategy/timeouts and
fallbacks, inbound/outbound dial rules and precedence, trunks, gateways, and DIDs.
Validate number collisions, destinations, and tenant isolation before applying.
Show desired configuration separately from observed registration/live state.

Provision extensions into platform inventory before tenants exist. Unallocated
extensions cannot carry tenant traffic or be assigned to staff. Tenant onboarding
reserves existing inventory, establishes ownership and routes, and makes only
verified extensions available to users. Display available, reserved,
tenant-allocated, assigned, and disabled states.

The tenant UI includes list/search/filter, a creation wizard, detail/edit,
initial administrator setup, immutable code, editable name, contacts, service
area, and draft/active/suspended/retired lifecycle. Explain access/routing effects
and retain history. Capture voice enablement, extension capacity/ranges and PBX
node, inbound gateway/DID and ring groups, approved outbound trunks/rules,
endpoint profiles, pending/failed revisions, and inbound/outbound test results.
Drafts can remain incomplete; voice readiness requires validated, applied,
verified allocations/routes. Explicitly voice-disabled tenants can activate
without PBX assignments.

Tenant administrators select verified unassigned extensions owned by their
tenant, with audited assign/unassign/reassign and conflict checks. They manage
permitted group membership and approved route choices, not shared trunks or
infrastructure dial plans. Pending/disabled extensions cannot be assigned as
ready for calling. Additional inventory is created through Asterisk management.

Configuration UI supports revision diffs, affected-resource review, validation,
apply progress, verification, and known-good rollback. Saving does not imply an
active PBX change. Resolve assignments/group/route dependencies before deleting
or reallocating resources; drain or defer changes affecting active calls.

### Administration Dependency Flow

```text
platform operator configures PBX nodes, trunks, dial plans, and ring groups
  -> provisions available extensions
  -> creates tenant and reserves its telephony inventory
  -> applies and verifies tenant contexts, groups, and routes
  -> tenant administrator creates staff and assigns verified extensions
```

The tenant creation UI invokes tenancy and telephony use cases through typed
ports. Tenant activation and PBX apply status remain distinct: a saved tenant
or allocation does not imply a successfully applied configuration. Concurrent
allocation/assignment requests are resolved by database constraints and
transactions, preserving PBX-wide number uniqueness and preventing duplicate
staff assignments across backend replicas.

## Invariants

1. Every operational record belongs to one canonical tenant; all access preserves
   that ownership.
2. Platform and tenant staff identities and authority remain separate.
3. Staff belong to exactly one tenant; usernames are unique within that tenant,
   and tenant codes are immutable, normalized, and globally unique.
4. Sensitive mutations are backend-validated, tenant-scoped, role-checked, and
   audited with actor attribution.
5. PostgreSQL owns canonical application data; PostGIS owns canonical geography.
6. Every accepted intake channel reuses the canonical incident workflow.
7. Asterisk owns live call state and raw recordings; synchronized metadata never
   becomes a parallel authoritative call model.
8. Retryable external work uses durable jobs and follows a committed business
   decision, with execution status recorded independently.
9. Public entrypoint configuration determines tenant ownership; public input
   cannot select arbitrary tenants.
10. Clients cannot access database/PBX administration secrets, raw PBX
    configuration, or another tenant's data.
11. Each fact has one authoritative model. New projections require a named
    consumer and defined consistency behavior.
12. Realtime clients resynchronize with canonical backend state after reconnect;
    stale client state cannot decide operational truth.
13. Telephony configuration uses approved infrastructure, generated attribution,
    validation, verification, and rollback. Ambiguous event sources fail closed.
14. Initial provisioning and deployment preserve tenant ownership, referential
    integrity, and audit records. Operational launch requires verified smoke
    checks, backup/restore, and deployment rollback procedures.
15. HTTP replicas share Redis sessions; authority is checked against canonical
    status/version and never falls back to local sessions during outages.
16. Asterisk inventory precedes tenant onboarding and user extension assignment;
    tenant ownership and verified configuration precede tenant calling.
17. Distributed work is idempotent and coordinated; PBX ownership is fenced,
    and replica-local state never becomes authoritative.

## Delivery and Verification Guidelines

Deliver one usable vertical slice at a time. For each feature, write the journey
and acceptance examples, update contracts and decisions, add required persistence,
implement pure rules/use cases, implement adapters, add transport, and build the
smallest UI that completes the journey. Finish with checks and documentation.

Verification covers domain behavior, real PostgreSQL/PostGIS constraints and
transactions, producer/consumer contracts, use cases with deterministic external
ports, critical browser/mobile journeys and accessibility, controlled disposable
PBX routes, and fresh-schema/schema-upgrade/backup-restore/deployment-rollback
scenarios. Prefer behavior assertions
over source-text assertions. Each milestone has one short required-check command;
the release command runs the complete matrix. Include realistic multi-tenant
load, cross-replica session expiry/revocation, Redis outage/failover, socket
reconnect/resync, duplicate jobs, PBX ownership failover, rolling deployments,
and database connection budgets. Measure isolation, latency, errors, queue age,
and recovery against documented targets.

Maintain structured logging, typed configuration, consistent errors, health
checks, shared storage adapters, reproducible Compose startup, and CI from the
foundation. Maintain scaling/failover and Redis session-recovery runbooks.
A milestone ends with a runnable user outcome, automated checks, and updated documentation.

Architecture documents describe current truth; ADRs explain lasting decisions;
user guides explain browser/mobile actions; runbooks include prerequisites,
commands, verification, rollback, and an owner/escalation point. Keep
`docs/status/current.md` limited to what works, what is blocked, and what is next.
Archive historical implementation notes instead of requiring phase history.
