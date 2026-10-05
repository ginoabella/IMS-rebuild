# Shared storage — P1-U6a

Date: 2026-10-05 (Asia/Manila). Status: approved development provider/setup;
P1-U6a implementation and A-01–07 verification complete. See
[acceptance evidence](../status/p1-u6a-evidence.md).

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

P1-U6b owns reference mechanism, client-reachable endpoint, lifetime and revocation
approval. Production hosting, TLS, redundancy, backup/restore, file policy and
retention remain with their planned units. Single-node development verifies no
production availability guarantee.

## Typed adapter and object identity

`SharedStorage` exposes assign, bounded write/read, bucket availability inspection
and close. `GarageStorage` implements it with pinned AWS SDK for JavaScript v3
3.1146.0; SDK types stay server-side. Optional `loadStorageConfig` returns undefined
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

[Garage setup](https://garagehq.deuxfleurs.fr/documentation/quick-start/),
[configuration](https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/)
and [S3 compatibility](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)
explain provider deployment and protocol limits. This contract relies on actual
focused checks rather than assuming full AWS feature parity.
