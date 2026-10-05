# P1-U6a shared storage verification

Date: 2026-10-05 (Asia/Manila). Environment: Linux amd64, local Docker Engine
29.8.2 / Compose 5.6.0, Docker workspace Node 22.23.3 and pnpm 10.12.1.
Approved provider: Garage 2.3.0, digest
`sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690`.
Server-only AWS S3 SDK: 3.1146.0. Verification status: **A-01–07 passed**. Final unchanged `./dev check` exited 0,
including focused adapter, client scans and isolated provisioning/restart checks.

## Commands and coverage

```sh
./dev prepare
./dev up
./dev storage-provision
./dev exec pnpm check:storage
./dev storage-deployment-check
./dev exec pnpm check:storage-clients
./dev check
./dev health
```

`up` completed frozen install, backend compilation, migration rerun, private storage
provisioning and backend readiness. Focused adapter, isolated deployment and completed client scan commands returned
exit status 0. The final unchanged full Docker run also returned 0: lint, formatting,
strict types, shared/backend/web builds, Android/iOS bundles, entry-point/configuration
checks, real-database foundation/audit/outbox/worker recovery, focused storage, client
scan and fresh provider provisioning/restart checks all passed. Final backend
liveness/readiness remain 200.

| Criterion | Observed verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | User approved local Garage/Docker, private storage and internal HTTP. [ADR](../architecture/shared-storage.md) records endpoint, credential/resource ownership, Garage permission limits and remaining access/production gates.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A-02      | Four independent OS processes, each with a distinct temporary application working directory, write/read the same scoped reference. Restarted writer retains exact hash and bytes; directory assertions find no application artifact files, and readers receive no artifact bytes through IPC.                                                                                                                                                                                                                                                                                                                                                       |
| A-03      | Malformed scopes/IDs, arbitrary key/options and excess size fail before the isolated proxy sees a request. Actual anonymous GET returns 403; denied key returns safe forbidden; absent object returns safe missing.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A-04      | Forwarder waits for real Garage's successful PUT before dropping acknowledgement. Adapter returns timeout; same-reference read reconciles accepted bytes and repeated write creates no new identity. Stalled real-provider body, explicit unavailable forwarding path and actual refused connection produce bounded failures. Restored access succeeds; scoped listing proves only the two originally assigned identities exist. Cancellation and saturation fail safely. Privileged content replacement is detected as conflict and restored with the original reference/bytes.                                                                    |
| A-05      | Enabled HTTP exits 1 before listening for invalid endpoint, unreadable or malformed credential files; errors omit sentinels. Parser bounds/settings fail safely; disabled storage needs no secret. Captured adapter, child-process, provisioning/provider outputs exclude actual keys/secrets and synthetic content. Completed static client artifact scans cover command center (35 files), platform console (35), public web (18), public mobile (3), responder mobile (3); actual key/secret, content, server storage setting and SDK import sentinels are absent. Client source has no storage/SDK consumer.                                    |
| A-06      | New uniquely named provider volumes/container provision twice, write/read the artifact bucket using the actual runtime identity, stop/start and read from fresh application processes, then provision/read again. Backend mount inspection excludes provider administration, fixture credentials, local secrets directory and Docker socket. Actual runtime cannot create/delete buckets or access fixtures. Secret initialization retains identities and refuses replacement when existing provider volumes lack required secret files. Enabled HTTP with no artifact consumer stays live/ready while its configured provider path is unavailable. |
| A-07      | Focused command is in foundation/CI; isolated provisioning/restart check is in full Docker and CI. [Runbook](../runbooks/shared-storage.md) covers setup, health, same-identity recovery, safe diagnostics and exact-run teardown. Final full Docker, scoped lint/format, relative-file links and whitespace checks passed.                                                                                                                                                                                                                                                                                                                         |

## Failure barriers and safe evidence

Adapter checks use real Garage. Independent processes exchange references/results
through private IPC; artifact bytes are not written to application disks or retained
logs. Unique UUID scope isolates fixture objects. The forwarding proxy is local to
this check and never stops shared services. A lost PUT acknowledgement is released
only after the provider's 200 response; stalled GET headers/body test consumption
cancellation. An explicit 503 forwarding barrier distinguishes unavailable access
from deadline expiry, and a refused local TCP connection verifies transport failure.
The initial reset-based outage barrier could itself reach the shared operation
deadline; it was replaced with the explicit unavailable barrier rather than claiming
that a timeout proves absence. Initial full-check lint found an unused test import;
the import was removed before rerunning checks. An earlier full run finished its
checks but exited 2 because the launcher was edited during execution, shifting its
shell read position. The launcher passed `sh -n dev`; the final unchanged run
passed with exit 0. Client scans attempted before mobile export completion correctly
refused incomplete artifacts; all five completed exports subsequently passed.

Cleanup deletes only exact references under the check's fixture scope. Fresh-provider
checks remove only their uniquely named container/volumes. Local source and ordinary
provider data are retained. Secrets and content never appear in retained evidence.

## Limits and handoff

The typed port, optional configuration, private provisioning and byte-verifying
same-identity recovery contract are available for P1-U6b. Garage combines write/delete
permission and lacks AWS IAM bucket/prefix policies; the runtime adapter exposes no
delete/list/admin operation. A tenant prefix is not authorization. Writes replace the
same key with identical bytes; no conditional-create, exactly-once external effect
or cross-database/provider transaction is claimed.

Storage is not HTTP readiness-critical until an actual HTTP consumer exists.
Single-node provider volumes retain ordinary restart data but do not establish
production HA, power-loss/disk-loss recovery, backup/restore, hosted S3 compatibility,
remote HTTPS reachability, authenticated tenant access, reference expiry/revocation,
file policy or retention. Those decisions and checks remain with P1-U6b and later
units. No hosted CI execution, Docker Desktop/rootless/remote engine or other-host
architecture is verified.
