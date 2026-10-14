# Protected PBX desired registry — P3-U1a

Implementation contract under [approved connectivity policy](../planning/p3-u1a-connectivity-contract-review.md).
Acceptance state is recorded in [evidence](../status/p3-u1a-evidence.md), not inferred
from this document. Registry state is desired connectivity, never observed health.

## Identity and ownership

`pbx_nodes.id` is the permanent registry record ID. `installation_id` identifies
the controlled PBX installation through a deployment-established UUID. Aliases,
DNS names, addresses, port, transport and credentials do not establish physical
identity. Restart, reprovision of the same installation and credential rotation
preserve its installation UUID. Equivalent aliases resolve to one catalog profile
and installation UUID; a PostgreSQL unique constraint allows one registered node
per installation across HTTP replicas and profiles. Unknown identities reject.
Trusted deployment must not label the same installation with different UUIDs;
runtime DNS cannot prove physical uniqueness.

Many independent installations can coexist. Catalog/profile data controls each
host, port, supported transport and credential vocabulary. The local Asterisk
22.10.1/AMI-TLS 5039/`asterisk` endpoint and protected files are a development
profile. Registry transport contracts and SQL do not hardcode that version,
port, host or provider. A new protocol needs an approved profile and its own
code-owned connection adapter, not a registry redesign. The delivered destination
adapter implements `ami-tls` only.

There is no tenant ID, LGU association, extension allocation or ownership inference
in these records. Multiple tenants may later share one PBX; the future explicit
association/allocation contract governs those links. Switching a record to another
approved installation is a connectivity edit, subject to uniqueness, version and
invalidation; it does not rewrite either installation's permanent deployment UUID.
Credential alias replacement or material rotation does not change either identity.

## Protected API and normalization

| Consumer / DTO                       | Route                                           | Result                              |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------- |
| createPbxNode / CreatePbxNodeRequest | POST `/platform/pbx-nodes`                      | 201 new; 200 original-result replay |
| listPbxNodes / PbxNodeListDto        | GET `/platform/pbx-nodes?limit=25&after=<UUID>` | 200                                 |
| getPbxNode / PbxNodeDetailDto        | GET `/platform/pbx-nodes/:nodeId`               | 200                                 |
| editPbxNode / EditPbxNodeRequest     | PATCH `/platform/pbx-nodes/:nodeId`             | 200 committed desired state         |

All use existing `platform-cookie`, current platform plane/operator permission,
trusted peer/proxy source, exact HTTPS Origin and shared admission. Writes require
session CSRF plus locked canonical authority revalidation on their mutation
transaction. Reads are passive and never renew sessions. Successful operational
writes use existing conditional renewal. All responses use no-store. c will own
named Next forwarding and browser composition; no generic proxy or UI is added.

Create accepts only `requestId`, `displayName`, `management` and `credentialAlias`.
Management accepts only `targetAlias`, `transport`, `port`. Edit replaces requestId
with positive safe-integer `expectedVersion`. UUIDs normalize lowercase. Name
bounds: 800 raw / 200 trimmed UTF-16 units; reject controls and malformed surrogate
text. Aliases trim/lowercase ASCII, 128 raw / 64 canonical characters matching
`[a-z0-9][a-z0-9-]*`. Unknown fields, plaintext credentials, arbitrary addresses,
URLs, provider locations and client actor/role/tenant/ownership fields reject.
Catalog target membership, profile transport/port and target-qualified credential
alias membership are mandatory. The existing JSON parser bounds bodies to 4096
bytes and validates UTF-8. List permits only limit (1–100, default 25) and after
(UUID), with indexed ascending UUID keyset pagination and at most limit + 1 rows.
Detail/edit reject query fields; reads use a primary repeatable-read snapshot.

Safe node DTO: id, installationId, displayName, management (canonical targetAlias,
host, transport, port, tlsServerName), credentialAlias, version, ISO timestamps,
createdBy/updatedBy operator references, and b's passive `PbxObservationDto` (or `observation:{kind:'not_available'}` before observation exists). Immutable create receipts preserve the original save result.
Detail/create/edit wrap `{node}`; list wraps `{items,nextCursor}`. Desired save
never resolves credentials or connects; no connection/health success is inferred.

Errors: 400 fixed field keys/messages; 401 absent/expired/revoked or malformed
credential channel; 403 wrong plane/current authority/proxy/Origin/CSRF/source;
404 valid missing ID; 409 fixed `target_conflict`, `request_conflict`,
`stale_version`, `intent_expired`; 429 existing shared limits; 503 sanitized
backing-service/required-write/unknown-COMMIT outcome with Retry-After 1. Existing
safe authentication/body-parser failures are reused. Exceptions and submitted
values never enter diagnostics.

## Transactions, replay and retention

Telephony owns `pbx_nodes` and `pbx_create_receipts`; existing owners supply
Transaction, canonical authority, AuditWrite and OutboxRepository. One transaction
holds the operator SHARE authority lock and a namespaced operator/create/request
advisory lock. It inspects the immutable receipt, serializes target UUID ownership,
creates desired state, appends one safe actor audit, awaits any required handoff
intent and stores the original safe result before commit. No external I/O occurs
in the transaction. Required handoff failures poison the handle even if caught.
Unexpected uniqueness/audit errors are unavailable, never mislabeled conflicts.

Fingerprint is SHA-256 over a bounded ordered normalized payload: installation
UUID, trimmed name, canonical target alias, host, transport, port, TLS name and
credential alias. Equivalent target aliases produce the same canonical request.
Same operator/key/payload returns the original safe creation DTO even after edits;
explicit detail reload returns current state. Changed payload reuse conflicts;
another key/operator targeting the same installation conflicts without adopting a
receipt. Commit acknowledgment loss is unavailable and requires explicit same-intent
retry or canonical reload; changed input never automatically reuses an attempt.

Receipts have a 30-day retry window measured using database time. Retained expired
receipts reject with intent_expired. HTTP has SELECT/INSERT only; deployment may
prune expired receipts, and a trigger prevents updates or early deletion even by
ordinary owner DML. After pruning, same-key replay is no longer guaranteed; callers
must reload expired attempts. Audit/outbox/node history is retained. Receipt result
is bounded to 4096 bytes, contains only the safe DTO, and is linked to its node.
Actor references on desired rows preserve attribution independently of account
lifecycle. Runtime cannot migrate, truncate/delete nodes, change permanent record
attribution/ID or mutate receipts. SQL guards require monotonic version advancement
on changed rows. Deployment owns the migration path.

## Versioned edits and atomic b handoff

Edit acquires current authority, target coordination and node row locks, checks
expected version, then writes only changed canonical state. Stale requests reject
even if otherwise unchanged. A canonical no-op keeps version/audit unchanged.
Changed desired state advances version once and appends its safe business audit.
Name-only edits advance record version without replacing ownership generation;
b must requalify/preserve a matching observation atomically. Connectivity change
(installation/profile/credential alias) invalidates prior observation and ownership
in the same commit. Ambiguous edits require canonical reload before further edits.

`PbxDesiredChangePort.onCreate(tx,node)` and
`onChange(tx,{nodeId,previousVersion,nextVersion,connectivityChanged})` are awaited
through `tx.required` before commit. a wires ObservationNotInstalled, explicitly
exposing unavailable observation. Isolated contract fixtures mutate a fixture
projection and existing durable outbox on that same handle to prove invalidation,
intent rollback and required-failure poisoning. No production observation/lease
schema or speculative handler is installed. b supplies its own projection/lease
adapter and committed reconciliation handler using registry → observation → lease
lock order; old desired versions/ownership cannot remain current after edits.

Until b provides a supported reconciliation consumer, production registry writes
do not enqueue work that existing workers would classify as invalid. b's onCreate
and onChange implementation must insert any required intent on this transaction,
not call an external connector or publish before commit. Existing worker queue
ownership and effect semantics remain authoritative.

## Catalog, secrets and connection destinations

`PBX_CATALOG_FILE` is an optional bounded absolute path to a deployment-owned
non-secret JSON array; absent configuration permits protected reads and rejects
unresolved writes. Invalid supplied configuration fails startup with a fixed
message. Catalog is bounded to 64 KiB / 100 profiles and 32 alternate aliases,
credential aliases and addresses per profile. Fields: installationId, targetAlias,
aliases, host, transport, port, tlsServerName, addresses, credentialAliases. Duplicate
aliases and same exact endpoint assigned to distinct installations reject. Each
profile is frozen. Runtime reload requires a process restart; no user upload or
unrestricted resolver endpoint is provided.

HTTP gets only this catalog. `SecretFileCredentials` is a telephony-only provider
constructed from an approved server-owned alias → protected file map. Web and
ordinary worker graphs receive no material or map. Files must be regular,
owned by the runtime UID, inaccessible to group/other, nonsymlink, and at most
4096 bytes, with exactly bounded username/password strings and no protocol
controls. It rereads on each resolution so protected atomic replacement supports
rotation. Missing/inaccessible/malformed results are fixed secret_missing or
secret_unavailable, without original exception/path/material. b owns disconnect,
rotation detection and reconnect, including TLS trust provisioning. Desired alias
validation succeeds independently of secret availability.

`ExactPbxDestinationPolicy` rechecks current catalog membership and exact profile
identity/host/transport/port/TLS name at connection time, resolves both address
families with finite DNS attempts, and validates the complete returned set against
exact approved addresses. Partial DNS failures cannot authorize a partial set.
Unspecified, loopback, multicast, link-local, IPv4-mapped bypasses and known
metadata destinations reject; explicitly approved controlled private addresses
are allowed. It bounds results to 32, concurrent resolutions to four, deadline to
2000 ms, propagates cancellation and returns fixed denied/unavailable categories.
The connector must use the returned address directly and verify the returned TLS
service name against approved trust, without another DNS resolution. HTTP never
imports this connector/resolver graph. Safe resolver fixtures establish this port
boundary; live AMI authentication/registration remains b.

P3-U1b installs the atomic change hook and passive freshness-qualified list/detail projection described in the [observation contract](pbx-observation.md). Immutable create receipts retain their original save result; explicit detail reads obtain current observations.
