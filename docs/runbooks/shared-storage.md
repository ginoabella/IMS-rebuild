# Shared storage development operations

Owner: MyIMS development maintainer. Approved provider: Garage 2.3.0 in local
Docker; see the [storage ADR/contract](../architecture/shared-storage.md).
P1-U6a owns this adapter environment; P1-U6b owns reference issuance and expiry.

## Setup and checks

Use the repository's existing Docker workspace on Linux with a local Docker Engine,
Compose, registry/package access and permission to use its Unix socket. No host
Node, Garage runtime, domain or HTTPS certificate is needed.

```sh
./dev up
./dev status
./dev exec pnpm check:storage
./dev storage-deployment-check
./dev check
```

`up` generates local secrets only once, starts Garage alongside the existing shared
services and provisions private resources before application startup. The trusted
one-shot Node container runs host Docker CLI commands; it mounts the local Docker
socket and executable only for provisioning/deployment checks. Application containers
and the workspace have no Docker socket. This helper currently targets local Linux
Docker paths/group permissions; Docker Desktop, rootless/remote engines and other
host architectures are unverified.

Garage owns named `garage-meta` and `garage-data` volumes. The backend endpoint is
`http://garage:3900`; optional host access is `http://127.0.0.1:3900`, configurable
with `MYIMS_STORAGE_PORT`. Only the S3 API is published on loopback. RPC stays inside
the provider container; website and administrative HTTP listeners are disabled.
The ordinary `./dev down` retains provider data and secrets.

`./dev storage-provision` reruns private bucket/key provisioning. HTTP processes
never provision. Runtime read/write credentials access `myims-artifacts` without
bucket ownership or bucket-creation privileges. Garage combines object writes and
deletes in its bucket-write grant; the adapter exposes no deletion or list method.
Fixture and denied credentials use `myims-storage-fixtures` only and never mount in
the runtime backend. Cleanup is test tooling, not an application retention policy.

## Settings and secrets

| Setting                             | Value / limits                                                  |
| ----------------------------------- | --------------------------------------------------------------- |
| `STORAGE_ENABLED`                   | `false` by default; explicitly `true` for a storage consumer    |
| `STORAGE_ENDPOINT`                  | Trusted service origin; no credentials, path, query or fragment |
| `STORAGE_LOCAL_HTTP`                | `true` permits HTTP only for `garage` or loopback hosts         |
| `STORAGE_BUCKET`                    | `myims-artifacts` for runtime                                   |
| `STORAGE_REGION`                    | `garage`                                                        |
| `STORAGE_CREDENTIALS_FILE`          | `/run/secrets/storage_runtime`                                  |
| `STORAGE_MAX_BYTES`                 | 8 MiB default; maximum 16 MiB                                   |
| `STORAGE_CONCURRENCY`               | 4 default; maximum 16; excess calls return busy                 |
| `STORAGE_TIMEOUT_MS`                | 5000 default; maximum 30000; one operation-wide deadline        |
| `STORAGE_ATTEMPTS`                  | 2 default; maximum 3, including the first attempt               |
| `STORAGE_REFERENCE_ENDPOINT`        | Explicit consumer-reachable origin; required for references     |
| `STORAGE_REFERENCE_DEFAULT_SECONDS` | 120 default; 1–300; hard lifetime ceiling is 300                |

Enabled configuration/credential failures stop HTTP before it listens; disabled
entry points need no storage credentials. Foundation HTTP has no artifact consumer,
so storage does not affect HTTP readiness. Liveness stays process-only. Consumers
use explicit `loadStorageConfig`, `GarageStorage` and close on shutdown.

Secrets are generated under ignored `.local/shared-services`: `garage-rpc-secret`,
`storage-runtime.json`, `storage-fixture.json`, `storage-denied.json`. Credential
JSON contains only generated access key ID and secret access key. The host directory
is owner-only; mounted credential files are readable by the non-root runtime.
Preserve the originals with provider volumes. Startup refuses replacement if storage
volumes exist and required secrets are missing. Restore files from the development
operator's retained originals; do not regenerate identities against existing data.

## Reference issuance and expiry

Use the owning consumer's `ArtifactAccess` service with a trusted tenant actor,
opaque artifact ID, canonical ownership resolver and read-permission port. Never
pass a request's tenant ID/object key directly to the provider adapter. The owning
module persists internal object references alongside canonical metadata; signed URLs
are temporary delivery data and must never be saved in metadata, logs or tickets.

Compose supplies `STORAGE_REFERENCE_ENDPOINT=http://garage:3900` for Docker
consumers and a 120-second default. If a consumer runs on the host, explicitly sign
for its reachable `http://127.0.0.1:<published port>` origin instead. Backend access
can continue using the internal Garage origin. External consumers require HTTPS.
Do not rewrite a URL's signed Host/path/query or expose the service publicly as a
routine development setup change. The application accepts neither a request-supplied
signing endpoint nor arbitrary provider keys.

`reference(actor, artifactId, call, lifetimeSeconds?)` checks ownership/permission,
then verifies object bytes and signs GET only. It returns transient `{ url, expiresAt }`;
omitting the lifetime uses 120 seconds, and invalid/noninteger/nonpositive values
or values above 300 fail with `invalid_input` before provider calls. Configuration
can lower/change the default within 1–300 but cannot raise the hard ceiling.
Missing signing configuration also fails safely. Authorized missing objects return
`missing`; malformed/foreign/unresolved/denied ownership returns the same `forbidden`.
Permission/ownership dependency exceptions return `unavailable` without raw errors.

A bearer can forward/download the URL until expiry. Later logout, role change or
suspension must prevent new issuance in the real owning consumer but do not revoke
an already-issued URL. There is no immediate revocation or authenticated download
gateway in this foundation. A new request after expiry fails (Garage reports 400
for expiry locally; signature/object/expiry tampering reports 403). Expiry does not
withdraw downloaded bytes or cancel a stream already started. Fetch a fresh reference
only through renewed authorization; never extend an existing query manually.

## Outage and ambiguous-write recovery

Inspect `./dev status` and safe `storage_operation` event codes first. Provider
failures never become missing data or successful writes. No application disk serves
as a fallback. Keep bytes and credentials out of tickets, logs and retained evidence.
Avoid verbose SDK/RPC dumps or printing CLI key details, which include credentials.

Retain the assigned object reference before the write. On interruption, reconnect
and read that same reference. Correct bytes reconcile an accepted write even if its
acknowledgement was lost. A missing read allows a retry with the exact same reference
and original bytes; an unavailable/timeout read proves neither presence nor absence.
Retry within the configured bounds and escalate continuing failure to the maintainer.
A conflict requires investigation of identity/bytes or another privileged writer.
Never allocate a replacement identity merely because a response timed out.

Reference issuance uses the same operation-wide timeout/retry/concurrency limits
and cancellation as reads. An unavailable provider yields `unavailable`; a stalled
read/issuance yields `timeout`; saturation yields `busy`. None returns a reference
as success. A previously issued reference can also fail during provider interruption;
signing is no promise of availability. Restore provider access, read the original
identity and request a fresh authorized reference if needed. No file or metadata
identity changes and no replica-local fallback are part of this recovery.

The owning business module will maintain metadata/partial-completion state and use
committed-decision/durable-execution conventions when required. This infrastructure
unit supplies no automatic retry job, metadata recovery table or cleanup schedule.

## Verification isolation and rollback

`check:storage` uses independent OS processes with separate temporary working
directories and one unique fixture scope. A private forwarding proxy creates bounded
write-acknowledgement, read-stream and availability barriers; the shared service
remains running. Only exact assigned keys from that run's fixture scope are deleted.
No runtime artifact bucket cleanup occurs. The access matrix adds two independent
trusted tenant scopes, explicit platform/denied/unknown cases, GET-only and expiry/
tampering checks, distinct signing-host reachability and interrupted issuance and
reference downloads. Its subprocesses retrieve through their own issued reference
and return only digest/length, never bytes or URLs. The fixture ownership resolver
uses a canonical map independent of the requesting tenant ID.

`storage-deployment-check` creates uniquely named provider containers/volumes,
provisions fresh private buckets twice, writes through the workspace, stops/starts
the isolated provider and reads through fresh processes. It removes only its own
container/volumes. It also checks runtime mount separation and retained-secret
initialization. Full `./dev check` includes both check paths and scans completed client builds
with `./dev exec pnpm check:storage-clients` for credential/content/configuration
and SDK import sentinels. CI invokes all three paths too. The client scan requires
completed web/mobile builds and is separate from the focused adapter command.

If interrupted by a hard kill, a fixture scope or uniquely named
`myims-storage-check-*` container/volume may remain. Inspect the exact failed run's
identities before manual teardown; never use broad bucket/volume deletion or
`down -v`. No periodic cleanup policy is introduced. Normal stops preserve data.
Rollback application changes without deleting Garage volumes/secrets; an older
Compose configuration will not manage those retained resources automatically.

Local checks do not establish hosted-provider compatibility, authenticated tenant
access, remote reference reachability, production HA, backup/restore or retention.
Garage single-node data depends on this host. HTTPS for externally reachable
consumers remains a deployment gate. The approved foundation reference policy uses
a 120-second default, hard 300-second ceiling and expiry without immediate revocation;
real ownership/session/role enforcement remains with P2/P8 consumers.
