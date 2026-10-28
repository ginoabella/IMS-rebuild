# P4-U1b-2 implementation evidence

Status: complete within approved private development, 2026-10-28
(Asia/Manila, +08:00). B-01–07 passed under approved ONB-02. Focused/combined,
affected/full checks and ordinary migration/refresh/preservation passed.

## Contract and delivered path

The [approved policy](../planning/p4-u1b-2-geography-policy-review.md) authorizes
prepared administrative/barangay GeoJSON upload, tenant/upload comparison,
explicit ownership confirmation, optional WGS84 defaults and 4,096 combined
positions. The existing tenant-code design is unchanged. Locations owns one
canonical PostGIS geography/version with allowlisted metadata; platform uses
owner ports and the existing tenant-first section transaction/receipt recovery.
See the [consumer contract](../architecture/tenant-geography.md) and
[operator procedure](../runbooks/tenant-configuration.md#approved-geography-upload-workflow--p4-u1b-2).

## Acceptance reconciliation

| Gate | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Focused API/HTTPS pass: actual Naga administrative Polygon and 27 barangays upload/save/reload on A/B; initial null configuration and explicit clearing remain distinct with versions.                                                                                                                                                                                                                           |
| B-02 | Six prepared-input contracts and real PostGIS/API/browser cases pass: zero, extremes, near-zero precision, axis order, incomplete/nonfinite/out-of-range pairs, malformed/deep/wrong-SRID/oversized data, topology, holes/boundaries/components, overlap/outside/gaps, exact 4,096 positions and 1,000 small features. Real browser rejects >4 MiB files and >10 MiB named requests without losing prior values. |
| B-03 | Real A/B geography/cross-section and held tenant status/authority/operator races pass. Actual geometry/audit/receipt grant failures roll back tenant/geography versions and all attempted writes; earlier name/contact saves survive. Database CHECK remains the sole spatial validator, and rejected writes poison the outer transaction.                                                                       |
| B-04 | Exact concurrent/foreign/changed-input attempts, actual response loss and PostgreSQL COMMIT acknowledgment loss pass. Original outcome and current canonical detail remain separate; browser recovery displays a later saved point instead of restoring the old result.                                                                                                                                          |
| B-05 | Real canonical intake port checks pass for configured, never configured, cleared, foreign/unknown/stale/nonoperational authority and actual geography SELECT failure. Identity/tenancy are revalidated through owner ports in the same primary snapshot. No intake/fallback endpoint is claimed.                                                                                                                 |
| B-06 | Focused production HTTPS pass: keyboard confirmation/coordinates, error focus and retained values, 320/390/768/1440px reflow, 200% zoom and axe; same-owner reauthentication, version-reset confirmation, owner switch, actual isolated Redis pause/recovery and a held committed response across client target navigation. Affected real credential lifecycle/staff browser regressions also pass.              |
| B-07 | Focused/combined API and production HTTPS browser, affected credential lifecycle and the full normal graph pass with exit 0. Ordinary migration, console refresh, transport/health, preservation and owned cleanup are reconciled below.                                                                                                                                                                         |

## Commands and results

Run in the supported Docker workspace using existing PostGIS, disposable
acceptance databases, shared-per-fixture authenticated Redis, two real Nest
replicas and actual production Next behind HTTPS. No host Node verification.

| Command                                                   | Result                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:draft-tenant --onboarding-api`     | Pass, exit 0. Six input contracts, original draft/registry acceptance, expanded geography/PostGIS/qualified intake and safe diagnostics. |
| `./dev exec pnpm check:draft-tenant --onboarding-browser` | Pass, exit 0. Actual geography journey and retained registry/shared platform browser denial/recovery/429 coverage.                       |
| `./dev exec pnpm check:staff-auth --lifecycle`            | Pass, exit 0. Real credential lifecycle/API and staff/recipient HTTPS regressions.                                                       |
| `./dev check`                                             | Pass, exit 0. Complete normal verification graph.                                                                                        |

The final `./dev exec pnpm check:draft-tenant` combined run also passed, exit 0,
against the final fresh/rerun migration and safe CHECK diagnostics.

Focused console typecheck and lint passed during implementation. Exact final full
graph results supersede those intermediate checks. Persistent shell exit files
are used for final runs because an earlier outer CLI wrapper returned signal 143
while its disposable verification container continued running.

## Spatial sources and limits

Read-only PostGIS inspection of the unchanged Naga reference files reported:
administrative polygon valid; invalid barangays 0; outside barangays 0;
interior-overlap pairs 0. They contain 166 administrative plus 662 barangay
positions, 828 total. This proves the supplied prepared geometry, not current or
official real-world jurisdiction, complete LGU coverage or a live map provider.

Original file SHA-256 values:

- `naga_admin_ADM_ADM_3.json`: `8c547ef3c124117cb531089c7f403afc3ebdc0a86115a7834de85eee0d9463ab`
- `naga_brgy_ADM_ADM_3.json`: `c2fdc0b680ccacc4cd26b8ca06aa13a3a8013db5471fb09b85d65b7bd24b16ee`

Reference JSON is formatter-excluded to preserve its externally prepared bytes.
Raw files are input examples; no normal tenant is automatically assigned Naga.
No original raw-file geography copy is persisted alongside canonical PostGIS.

## Resolved verification findings

The checks exposed and corrected GeoJSON decimal-place rounding near zero;
serialization now preserves float8 values, and the exact 4,096-position
save/reload passes. The maximum-feature test exposed duplicate CHECK work during
UPSERT replacement; owner locking now selects INSERT/UPDATE explicitly and the
single authoritative CHECK validates once. A savepoint supports fixed spatial
field diagnostics after rejection without clearing transaction failure poison.
A fixed SQLSTATE/constraint wrapper prevents PostgreSQL from attaching the whole
rejected row as failing-row DETAIL; the real runtime test asserts DETAIL is absent.

Restored the existing documented Playwright Chromium executable/libraries in the
recreated workspace; standalone launch and actual HTTPS checks now pass. Browser
assertions scope the tenant heading where the approved comparison intentionally
repeats the name, wait for authorized controls before keyboard input, and separate
independent groups' counters only inside the disposable acceptance Redis.
Production admission limits are unchanged.

All probe databases were created for this task and dropped explicitly. The
focused harness drops its exact disposable database and removes its own Redis
container; original shared identities, PBX configuration and runtime stores are
not its cleanup targets. Final ordinary preservation digests, refresh and cleanup
are reconciled below.

## Ordinary runtime, preservation and cleanup

`./dev migrate` passed on the normal development database. The new
`tenant_geography` table contains zero rows: no existing tenant was backfilled.
The existing private platform launcher and detached staff launcher were refreshed
sequentially with fixtures disabled. `./dev platform-https-status` and
`./dev staff-https-status` both reported ready. `./dev platform-https-check` and
`./dev staff-https-check` passed. Live/ready fetches from inside the backend
container returned HTTP 200 with database and both Redis dependencies up. The
cross-container `./dev health` helper could not reach the existing loopback-only
backend listener; the in-container checks verify its configured address.
The normal supervisors remain running for review.

Before migration and again after refresh, server-side counts and SHA-256 digests
of original fields matched for tenants, staff users, platform operators and both
creation/edit receipt stores. The additive geography receipt column was excluded
from that original-field comparison. All five retained private platform HTTPS
files matched their pre-migration hashes; no credentials/verifiers were printed.
The two Naga reference files retain the original hashes above.

Final combined acceptance cleaned up its disposable database and Redis/processes;
all task-created spatial probes were explicitly dropped. The final read-only
inventory contains the normal database and one unclaimed session database without the
new geography table; that unclaimed database and unrelated services were left
untouched. No global Docker cleanup, normal identity replacement, tenant activation,
backup operation or live PBX change was performed.

## Handoff boundary

Child 3 receives complete canonical detail/geography versions, safe section saves,
explicit retry and the upload/review/clear procedure. P5-U4/U5 receive the narrow
trusted-context read contract, longitude/latitude/SRID/units and explicit missing
state. They still own incident draft fallback copying, confirmation and correction.
Voice preference, parent onboarding, activation and production readiness remain
outside this child.
