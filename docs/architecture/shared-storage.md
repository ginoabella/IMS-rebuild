# Shared storage — P1-U6

Date: 2026-10-05 (Asia/Manila). Status: approved development provider/setup;
P1-U6a A-01–07 and P1-U6b B-01–07 verification complete; parent AC-01–09 passed.
See [adapter evidence](../status/p1-u6a-evidence.md) and
[access/recovery evidence](../status/p1-u6b-evidence.md).

The user approved Garage after reviewing Docker deployment, private storage,
separate runtime/provisioning credentials and internal HTTP. This implements the
[P1-U6a boundary](../../context/feature-specs/p1-u6a-shared-storage-adapter-and-configuration.md).

## Provider and deployment

Use Garage 2.3.0 pinned to digest
`sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690`
in a single-node container with durable metadata/data volumes,
a private `myims-artifacts` bucket and S3 Signature V4 path-style requests. Development
uses `http://garage:3900` within Compose, with optional loopback-only host access.
No certificate or domain is required. Disable website serving; administration is
available only through trusted tooling, never HTTP application processes.

Bootstrap secrets live in ignored owner-only `.local/shared-services` files. Runtime
credentials mount separately from Garage RPC/configuration secrets. Runtime can
read/write its bucket but cannot create buckets or administer Garage. Garage's
bucket-level write permission also permits object deletion; it cannot express AWS
IAM operation/prefix policies. The public backend port therefore exposes no delete,
list, provisioning or arbitrary SDK operation. Isolated fixture buckets/keys belong
to trusted test tooling. This is a documented provider capability boundary, not
per-object IAM enforcement or tenant authorization.

## Remaining gates

P1-U6b reference mechanism, client-reachable endpoint, lifetime and revocation
semantics are approved below. Production hosting, TLS, redundancy, backup/restore, file policy and
retention remain with their planned units. Single-node development verifies no
production availability guarantee.

## Approved P1-U6b access contract

Status: explicitly approved by the user; 2026-10-05 (Asia/Manila). The user
confirmed a hard 300-second ceiling with a 120-second default. Implementation and
local provider verification are complete.

- Mechanism: private S3 Signature V4 GET-only bearer references, issued only after
  canonical ownership resolution and consumer permission approval. Platform identity
  alone grants no tenant access. Foreign, unresolved and denied cases share a safe
  forbidden outcome and reach neither provider reads nor signing.
- Host: explicitly configured consumer-reachable signing origin, distinct from the
  backend service origin when necessary. Local foundation verification uses Docker
  or loopback HTTP; external consumers require HTTPS and their own reachable host.
  Preserve the signed host during retrieval; do not rewrite issued URLs.
- Lifetime: default 120 seconds, hard maximum 300 seconds; reject noninteger, nonpositive or excessive
  requested lifetimes. Return explicit expiration information. Actual provider
  expiry and tampering rejection must be verified before claiming completion.
- Revocation: a bearer can forward the reference. Ownership/permission checks at
  issuance do not revalidate later downloads. Logout, role change or suspension
  prevents new issuance through the eventual owning consumer; existing references
  remain usable until expiry. Immediate revocation is not promised. A requirement
  for immediate revocation introduces an authenticated gateway/P2 dependency.
- Availability: signing alone proves no object existence or availability. Authorized
  issuance should verify the resolved object through the existing bounded adapter;
  subsequent retrieval can still fail if availability changes. Missing, unavailable
  and timeout retain distinct safe outcomes. Recovery reuses the assigned identity.
- Sensitivity: never retain signed references as canonical metadata or evidence;
  omit query strings, raw errors, credentials and artifact bytes from diagnostics.

Production hosting/TLS/HA, real identity/session and evidence authorization, file
policy, retention and backup/restore remain gated in their owning later units.

## Typed adapter and object identity

`SharedStorage` exposes assign, bounded write/read/reference issuance, bucket
availability inspection and close. `GarageStorage` implements it with pinned AWS SDK for JavaScript v3
3.1146.0, including the matching S3 request presigner; SDK types stay server-side. Optional `loadStorageConfig` returns undefined
when disabled. A storage consumer explicitly loads configuration and owns closing
its adapter. HTTP validates enabled settings/secret loading before listening; HTTP,
worker and telephony have no artifact consumer in this unit. Storage is therefore
not an HTTP readiness dependency. Liveness remains process-only; adding a real
consumer requires its owning unit to review readiness policy.

Assign takes a trusted UUID v4 scope and nonempty bounded bytes; it creates a random
UUID v4 object ID and records SHA-256 and byte length. The internal key is
`scopes/<scope UUID>/<object UUID>/<SHA-256>`. Filenames, paths, URLs and arbitrary
SDK options cannot select storage locations. All reference fields are validated
before a request. A scope prefix preserves association, not authorization; only
trusted backend callers may use this low-level port. Business owners retain the
reference alongside canonical metadata in their own future schema.

A retry reuses the exact assigned reference and identical bytes. Different bytes
for a reference fail before provider calls. Writes replace the same key with the
same bytes; Garage's last-write behavior is not conditional-create or exactly-once
execution. Concurrent identical retries converge on one identity. Other privileged
writers can overwrite objects; bounded reads and post-write reads verify size and
SHA-256, and successful writes additionally compare complete bytes. External
mutation is a conflict, never successful retrieval of different content.

Persist the assigned reference in the owning business decision before external work
when durable recovery is required. This unit adds no metadata table or queue.
If a write fails after execution begins, `writeMayHaveSucceeded` conservatively
remains true. A timeout does not prove absence. Read using the same reference to
reconcile; retry a missing/uncertain write with that reference and the original
bytes. Do not mint another reference. Conflict requires owner investigation; do
not silently accept mismatched bytes. PostgreSQL transactions cannot roll back
provider effects.

## Access service and owning-consumer handoff

`ArtifactAccess` accepts a trusted `ArtifactActor`, opaque UUID v4 artifact ID and
`StorageCall`. The caller owns `ArtifactOwnership.resolve(artifactId)` and
`ArtifactReadPermission.permits(actor, artifactId)`. Ownership resolution never
accepts a request tenant ID. Canonical `tenantId` must match both the trusted actor
and the internal reference's scope; malformed references are denied. This foundation
requires tenant actors; a platform actor has no implicit evidence grant. An owning
feature requiring a future explicit platform grant must define and verify that
policy in its own unit.

Both `read` and `reference` authorize ownership and permission before any provider
operation. Malformed IDs, foreign objects, unresolved ownership and denied reads
share `forbidden`, preventing an ownership/existence oracle. Raw resolver/permission
exceptions become safe `unavailable`. Only an authorized canonical artifact can
expose a provider `missing`, `timeout` or `unavailable` outcome. Snapshot the actor
and validated reference across asynchronous permission checks.

`GarageStorage.reference` is an internal trusted port, like `read`; user-facing
consumers must use `ArtifactAccess`. It verifies the complete bounded object through
the existing adapter before GET signing, using one deadline/retry/concurrency slot.
A missing object is `missing` even though signing itself is local. Signing/retrieval
can still fail after this verification; no reference is an availability guarantee.
The returned `{ url, expiresAt }` is transient sensitive delivery data. Expiration
matches the second-precision SigV4 signing time plus the requested lifetime. Invalid
lifetimes are rejected before provider calls. Garage rejects expired queries with
HTTP 400 in local verification; signature/path/expiry tampering fails with 403.
GET references reject writes (400/403) and the object remains unchanged.

`STORAGE_REFERENCE_ENDPOINT` is explicit; omission supports adapter-only consumers
but causes reference issuance to fail safely with `invalid_input`. It need not equal
`STORAGE_ENDPOINT`: one is consumer reachable, the other serves backend operations.
Neither accepts credentials, paths, queries or fragments. Both require HTTPS outside
approved Garage/loopback HTTP. Compose configures `http://garage:3900` for Docker
consumers; host consumers must select their reachable loopback origin. No proxy
may rewrite the signed Host/path/query. Local checks verify separate backend and
consumer origins with a private forwarding fixture, preserving the signed Host.

`STORAGE_REFERENCE_DEFAULT_SECONDS` defaults to 120 and validates in 1–300.
The 300-second maximum is hardcoded enforcement, not an operator-adjustable ceiling.
Disabled storage remains optional and credential-free; HTTP validates enabled access
settings before listening, but has no artifact consumer or new health dependency.
P8-U1 must supply canonical metadata and real role/session authorization. No fixture
context establishes authentication, tenant foreign keys or production evidence policy.

## Bounds and safe outcomes

Default maximum bytes: 8 MiB (ceiling 16 MiB); concurrent operations: 4 (ceiling 16);
whole-operation timeout: 5 seconds (ceiling 30); attempts: 2 (ceiling 3). Limits are
per adapter/process, not a global cluster budget. A saturated adapter returns
`busy` without queuing. Retries include eligible network/provider availability and
timeout failures, with bounded backoff and one shared deadline across retries,
post-write verification and stream consumption. SDK retries are disabled separately.
Cancellation propagates to requests and body streams; all body streams are destroyed
and adapters close their connection pools. No multipart uploads or disk fallback.

Safe codes: `invalid_input`, `missing`, `forbidden`, `timeout`, `unavailable`,
`cancelled`, `busy`, `conflict`. Provider 404 is missing; authentication/permission
failures are forbidden, service failure is unavailable, and elapsed deadlines are
timeout. Invalid references/settings and unsupported operations never become
provider success. HeadBucket inspection is availability evidence at that moment,
not a guarantee for a later read or write.

Diagnostics use fixed event/operation/outcome fields and a validated opaque UUID
correlation ID, following existing safe structured logging conventions. No raw SDK
exceptions, endpoint, object reference, credential, artifact bytes or signed URL
is logged. No client application receives credentials or SDK administration access.

## References

[AWS SDK presigning](https://github.com/aws/aws-sdk-js-v3/tree/main/packages/s3-request-presigner)
defines the SDK call; provider acceptance is proven against Garage rather than
assuming AWS behavior. [Garage setup](https://garagehq.deuxfleurs.fr/documentation/quick-start/),
[configuration](https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/)
and [S3 compatibility](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)
explain provider deployment and protocol limits. This contract relies on actual
focused checks rather than assuming full AWS feature parity.
