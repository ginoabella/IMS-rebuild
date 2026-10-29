# Tenant geography configuration and intake handoff

Approved [ONB-02](../planning/p4-u1b-2-geography-policy-review.md) owns policy.
This contract describes implementation; the [evidence](../status/p4-u1b-2-evidence.md)
records acceptance separately.

## Canonical owner and values

Locations owns `public.tenant_geography`, restrictive FK `tenant_id` to tenants.
One row holds `service_area` Polygon/MultiPolygon, optional `default_point` Point,
ordered barangay GeometryCollection and parallel allowlisted metadata. All
geometry is two-dimensional WGS84, SRID 4326, decimal degrees, longitude first.
GeoJSON serialization retains full float8 precision, including coordinates near
zero; the precision setting must not silently round canonical values.
Neither uploaded files nor JSON metadata duplicate canonical coordinates.

No row returns `{version:0,srid:4326,area:null,barangays:[],defaults:null}`. Explicit
clearing retains a row and increments its version. Existing tenants are not
backfilled. A configured default never implies a configured area, or vice versa.
Barangays require a covering area; they may leave gaps and share edges but cannot
overlap interiors. Point containment uses ST_Covers, including exterior/hole
boundaries and excluding hole interiors. No tolerance, repair or simplification.

The shared contract caps all area/barangay closing positions together at 4,096,
1,000 features, 256 components per geometry, 2,048 rings, and approved coordinate
bounds. PostGIS database constraints independently enforce spatial validity,
SRID/dimensions, cardinality and containment. A local boundary preview adds no
external provider or geographical ownership authority.

## Named platform detail and save consumers

Existing protected GET `/platform/tenants/:tenantId` returns
`tenant.geography: {version,srid,area,barangays,defaults}` together with tenant
`version` and `authorityVersion`. Reads use a primary repeatable-read snapshot,
remain passive and no-store. Listing tenants does not load geometry.

Existing protected POST `/platform/tenants/:tenantId/configuration` accepts:

```json
{
  "requestId": "immutable-attempt-uuid",
  "expectedVersion": 1,
  "expectedAuthorityVersion": 1,
  "section": "geography",
  "expectedGeographyVersion": 0,
  "ownershipConfirmed": false,
  "values": { "area": null, "barangays": [], "defaults": [0, 0] }
}
```

Area is `{geometry,municipality}`. Municipality is null or
`{municipalityId,municipalityName}`. Each barangay is
`{id,name,municipality,geometry}`. Raw upload wrappers are explicitly parsed by
shared `serviceAreaUpload`/`barangayUpload`; canonical `geographyValues` validates
the complete desired section again at the backend boundary. Original file input
is limited to 4 MiB per file/8 MiB combined in the browser; canonical requests
are independently bounded to 10 MiB before parsing in Next/Nest and by structural
limits after parsing. No raw file is forwarded or retained. Non-geography saves
retain the 4 KiB bound. No new generic proxy or upload endpoint is added.

The backend requires confirmation when a non-null area/nonempty barangay set
changes. The browser also requires a fresh confirmation for every staged upload,
even identical geometry. Confirmation participates in the immutable request
fingerprint. Changed operator/tenant/payload on a prior request UUID conflicts.
Lock order: canonical operator SHARE, attempt advisory lock, tenancy UPDATE,
locations UPDATE. Draft status and all expected versions are checked; geography
increments both tenant and geography versions without changing authority version,
name, contacts, initial administrator or credential eligibility.

A single database CHECK performs spatial validation on each write. Under the
tenant lock, the owner chooses INSERT or UPDATE explicitly; UPSERT must not
duplicate the expensive CHECK on replacements. A savepoint permits bounded
file/feature diagnostics after a rejected CHECK while retaining the outer
transaction failure poison, so ignored failures cannot commit partial writes.
The CHECK wrapper raises a fixed SQLSTATE 23514/constraint diagnostic without
PostgreSQL failing-row DETAIL, preventing rejected geometry/metadata from being
printed in database error details. Runtime acceptance asserts that DETAIL is absent.

Owner writes, locations audit and immutable platform receipt share one connection
and transaction. Success retains the original outcome with `geographyVersion`
and returns a separate fresh `current` detail. Exact recovery never paints old
receipt geometry over later canonical state. Locations audit metadata is allowlisted
change identifier and committed versions, with canonical actor/target/correlation;
raw geometry, names, GADM IDs and original files never enter audit/receipts/logs.
400 preserves input on validation; 409 preserves input on stale/eligibility/attempt
conflict; uncertain/503 requires explicit original-attempt recovery.

## Narrow future-intake port

`IntakeGeography.read(principal, tenantId)` is an internal application port with no
HTTP/Next/public route. The caller must supply a trusted RequestAuthority tenant
principal. It rejects a foreign target, platform identity, unknown staff/tenant,
nonactive admission, stale authentication/tenant authority, incoherent credentials
or missing canonical `incident.create` permission. Identity and tenancy owner ports
revalidate authority in the same primary snapshot as the geography read. Client
JSON, uploaded GADM identifiers and claimed roles do not establish authority.

A found result contains canonical tenant ID, tenant version/authority version and
`geography: {area,defaults,version,srid}`. Missing configuration returns the explicit
null values and zero/cleared version above. Unknown/foreign authority returns
`denied`; read/dependency failure returns `unavailable` without defaults. Barangay
configuration remains available in protected platform detail; this narrow intake
port does not introduce incident classification or public geographical lookup.

P5-U4/U5 still own copying defaults into incident drafts, unconfirmed state,
confirmation and correction. Child 3 owns voice preference/integrated onboarding;
this save neither activates a tenant nor establishes operational readiness.

### Integrated onboarding validation cost correction

Migration `20261029010000_tenant_geography_validation_cost` retains the same ONB-02
CHECK predicates, 4,096-position/1,000-feature bounds and 2-second statement timeout.
It extracts each original feature once for per-feature and pair validation, streams
metadata once, and validates municipality structure/labels once before requiring
all subsequent municipality objects to be exactly equal. This changes validation
work only; it does not repair geometry, relax labels/ownership or persist a second
representation. The maximum-feature API check and direct final-feature null/forged/
different municipality, duplicate ID and invalid-label checks cover this boundary.
Apply it through the normal migration path before running updated replicas.
