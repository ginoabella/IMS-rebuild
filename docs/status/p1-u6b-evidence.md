# P1-U6b tenant-checked references and recovery verification

Completed: 2026-10-05 10:52 +08:00 (Asia/Manila). Status: **B-01–07 and parent
AC-01–09 passed**; P1-U6a remains verified and parent P1-U6 is complete.
Environment: Linux amd64, local Docker Engine 29.8.2 / Compose 5.6.0,
Docker workspace Node 22.23.3 / pnpm 10.12.1. Provider: Garage 2.3.0, pinned
`sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690`.
Server-only AWS S3 client and request presigner: 3.1146.0.

The user explicitly approved the [access contract](../architecture/shared-storage.md#approved-p1-u6b-access-contract),
with a **120-second default and hard 300-second ceiling**. Existing bearer references
remain usable until expiry, including after logout/role/suspension changes; immediate
revocation is not promised. Production hosting/TLS and real evidence/session policy
remain separate decisions.

## Commands and observed results

```sh
./dev up
./dev exec pnpm check:storage
./dev storage-deployment-check
./dev check
./dev health
```

All final commands exited 0. `up` reran private provisioning, frozen installation,
backend compilation, migration and readiness. The focused command now runs both
adapter and access verification. The separate deployment check passed and passed
again within the full check. Full `./dev check` passed lint, formatting, strict types,
all shared/backend/web builds and both mobile platforms' bundles, entry-point and
configuration checks, real-database foundation/audit/outbox/worker recovery, the
combined storage matrix, all five built-client scans and isolated provisioning/restart.
Existing CI foundation/client/deployment steps inherit the expanded checks.
Final HTTP liveness/readiness returned 200; readiness reported all three baseline
dependencies up. No storage health dependency or public artifact route was added.

Captured adapter/fixture/provisioning/provider output was checked for actual keys,
secrets, sensitive content and signed-reference sentinels. The full command output
was independently scanned without printing protected values. Retained evidence
contains no credentials, bytes, signed URLs, query strings or authorization headers.

## P1-U6b acceptance

| ID   | Observed verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | ADR records explicit approval, GET-only bearer mechanism, separate consumer-reachable signing origin, 120-second default, hard 300-second ceiling, forwarding and expiry semantics, no immediate revocation, and later identity/evidence/production gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| B-02 | Canonical fixture map has two distinct tenants and is independent of the request actor. Both retrieve their own artifacts. Foreign attempts in both directions, malformed/unknown IDs, invalid or mismatched canonical references, denied permission and platform actors fail before provider reads/signing. Test doubles verify ownership → permission → provider ordering and raw-port-error sanitization; actual anonymous direct GET returns 403.                                                                                                                                                                                                                                                                                   |
| B-03 | Garage references retrieve exact intended bytes before expiry. Default query lifetime is 120; explicit 300 succeeds; zero, negative, fractional, nonnumeric, null and over-ceiling values fail before provider requests. An actual three-second reference succeeds before expiry, then a new request fails with Garage HTTP 400 after expiry. Object, signature and expiry tampering return 403. GET references reject writes (400/403), preserving bytes. A forwarded bearer works without an issuance actor context; no real logout/role/session enforcement is claimed.                                                                                                                                                              |
| B-04 | Authorized missing objects return safe missing before local signing. Explicit provider interruption produces unavailable; stalled issuance returns timeout; simultaneous issuance returns busy; pre-cancellation reaches no provider. Previously issued URLs fail during outage or stalled body consumption and recover with the same object/bytes. A distinct backend/signing-origin check verifies consumer reachability. Independent reader processes use their own issued reference without receiving bytes through IPC. Scoped listings prove one original artifact per tenant after recovery. The adapter's accepted-write/lost-acknowledgement, read interruption, integrity conflict and same-identity retry checks still pass. |
| B-05 | Missing signing origin fails safely on issuance; malformed/credential-bearing/nonlocal HTTP signing origins and invalid default lifetimes fail configuration validation. Enabled HTTP rejects invalid access settings before listening. Captured failures/logs omit raw port-error, signing-host-secret, actual credential, content, complete URL and signature sentinels. All five client artifact scans exclude added signing configuration, presigner imports and signed-reference markers.                                                                                                                                                                                                                                          |
| B-06 | Fresh isolated provider volumes provision twice, write/read/reference using runtime credentials, stop/start and retrieve exact original bytes through new processes, then provision/read/reference again. Runtime bucket administration and fixture access remain denied; mount inspection excludes provider administration, fixture credentials, local secret directory and Docker socket. Entry-point checks and HTTP health policy remain verified with signing integrated.                                                                                                                                                                                                                                                          |
| B-07 | Focused storage, isolated deployment and full Docker checks exited 0. Parent matrix below is covered; ADR, runbook, decision register, specs and tracker reflect the verified foundation and its limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Parent acceptance matrix

| ID    | Evidence                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Approved provider/private credential model and access/expiry contract in the ADR; B-01.                                                                                                                    |
| AC-02 | Four independent adapter writer/reader processes plus restarted writer; two additional independent reference readers in empty isolated directories; fresh provider restart/reference retrieval; B-04/B-06. |
| AC-03 | Two trusted tenants, canonical ownership and permission ordering, malformed/foreign/unknown/platform denial and real anonymous rejection; B-02.                                                            |
| AC-04 | Exact reference retrieval, actual expiry, method/path/signature/expiry rejection and enforced lifetime bounds; B-03.                                                                                       |
| AC-05 | Distinct safe missing/unavailable/timeout outcomes; verification before local signing and failure of an already-issued reference during interruption; B-04.                                                |
| AC-06 | Accepted write with lost acknowledgement, interrupted reads/issuance/downloads, restored exact bytes at the assigned identity and no duplicate objects or disk fallback; B-04.                             |
| AC-07 | Safe enabled configuration/startup/errors and captured provider/process outputs; actual credentials/content/reference sentinel exclusions and five client scans; B-05.                                     |
| AC-08 | Fresh/rerun provisioning, process/provider restart, runtime privileges/mount separation, entry-point isolation and unchanged health policy; B-06.                                                          |
| AC-09 | Focused command, required full Docker checks, CI wiring and documented setup/expiry/diagnostics/recovery/scoped teardown; B-07.                                                                            |

## Verification corrections and teardown

Initial access checks incorrectly expected HTTP 403 for every rejected request.
Garage returned 400 for expired queries and attempted writes. Checks now accept
400/403 as rejection, verify successful retrieval before expiry, and confirm denied
writes leave exact bytes unchanged; tampering still requires 403. No expiry tolerance
or lifetime increase was introduced.

A Docker workspace refresh interrupted one earlier focused run (exit 137).
The later focused and full runs passed. The two interrupted access fixtures were
identified by exact recorded modification timestamps, matching synthetic fixture
markers, identical bytes and their key digests; only those two exact keys were
removed. Normal check teardown deletes only assigned keys in the current fixture
scopes, and isolated provider checks remove only their uniquely named containers/
volumes. No runtime bucket or unrelated fixture cleanup occurred. Do not refresh
or recreate the workspace while a check is running. Hard-kill leftovers still
require exact-run inspection as documented in the runbook.

## Handoff and limits

Use `ArtifactAccess` with the owning feature's canonical `ArtifactOwnership` and
`ArtifactReadPermission` ports. Persist internal `ObjectReference` metadata, never
signed URLs. Configure a consumer-reachable `STORAGE_REFERENCE_ENDPOINT`; its host
must survive the request path unchanged. Defaults are optional storage, explicitly
enabled consumption, and 120-second references with an unconfigurable 300-second
ceiling. See the [runbook](../runbooks/shared-storage.md) for safe recovery/expiry.

Trusted fixture contexts are not authentication, tenant foreign keys or real
role/session policy. P2/P8-U1 must supply canonical identities/ownership and deny
new issuance after access changes. Existing bearer requests are not reauthorized;
expiry does not withdraw downloaded bytes or cancel an established stream.
Privileged provider writers can overwrite keys; issuance verifies bytes at that
moment but cannot guarantee subsequent availability or immutable provider data.
Local Docker/loopback HTTP proves no externally hosted endpoint, production HA,
TLS deployment, backup/restore, file policy, retention or production recovery.
Hosted CI, browser/device consumers and real identity/evidence workflows were not
exercised. Their separate feature/production gates remain open.
