# P4-U1b-2 — Proposed ONB-02 geography policy

Status: **approved by the user**, 2026-10-28 (Asia/Manila, +08:00).
The user approved this complete policy after selecting the initial 4,096-position
limit and retaining the existing tenant-code design as display-only context.

This policy resolves ONB-02 for
[child 2](../../context/feature-specs/p4-u1b-2-service-area-and-default-intake-coordinates.md),
including prepared administrative/barangay GeoJSON uploads and canonical barangay
persistence. Incident intake and tenant activation remain outside this decision.

## Proposed operator journey and authority

An authenticated platform operator opens a saved draft tenant's detail and:

1. Uploads a prepared municipality/city administrative boundary (`.json` or
   `.geojson`) as the service area.
2. Optionally uploads the matching barangay FeatureCollection.
3. Reviews a local boundary preview, tenant identity, municipality and barangay
   names, feature counts, validation results and any pending replacements.
   The operator explicitly confirms that the uploaded geography belongs to the
   selected tenant; a filename or GADM identifier is never tenant authority.
4. Enters default intake longitude and latitude explicitly, or leaves both unset.
   Display the point in the preview. Do not infer a centroid or other default.
5. Saves the geography section once. Area, barangays and default coordinates
   commit together, then reload from canonical storage.

All non-draft statuses remain read-only, retaining child 1 eligibility. Tenant
staff cannot configure this section in this unit. Replacing a file stages an
unsaved change; selecting or previewing a file never changes saved configuration.
Show saved/unsaved/error states and identify which file or feature failed.

Use a local SVG boundary preview with labeled barangays and the default point,
plus an accessible barangay list and separately labeled coordinate inputs. The
upload, review, save and clear journey must work by keyboard without interacting
with the preview. No manual vertex editor, file URL fetching, external basemap,
geocoder or new major dependency is proposed. A basemap can be decided separately
if later operational map work requires one.

## Tenant and upload comparison with explicit confirmation

Display the following side by side before an initial boundary upload or boundary
replacement can be saved. Reflow into clearly paired labeled rows on narrow
screens; retain the same information for keyboard and screen-reader users.
Display the existing tenant code in the tenant identity header for reference.
Its current design, generation, immutability and login behavior remain unchanged.
It is not an uploaded geography field or a value to compare with GADM metadata.

| Tenant registry / saved configuration | Uploaded GeoJSON / staged configuration |
| --- | --- |
| Canonical tenant organization display name | Uploaded `NAME_2` municipality name, when present |
| Selected tenant identity | Uploaded `GID_2` identifier, when present |
| Current configured service-area preview, or explicit unconfigured state | Proposed service-area preview |
| Selected tenant's organization name and code | Barangay feature count and accessible names; 27 for the supplied Naga example |

“Selected LGU” refers to the selected canonical tenant, not a new verified LGU
registry field. Display saved barangay count alongside the proposed count when
replacing a collection. Label a retained layer as retained rather than uploaded.
Do not hardcode 27 or treat a feature count as proof of completeness.

For barangay collections, obtain NAME_2/GID_2 from the required consistent feature
properties. For a service-area Feature or single-Feature FeatureCollection,
optionally accept those two allowlisted properties as a pair, subject to the same
string bounds as the barangay metadata. If both files supply them, require exact
agreement. Reject partial or malformed supplied metadata. Bare geometries and
the supplied Naga GeometryCollection do not contain municipality metadata: show
“Not supplied in administrative file” rather than inventing a name/identifier.
If only the barangay file supplies it, label the source explicitly. Retain these
allowlisted municipality values with their canonical layer when supplied so a
reload can show their source. No raw properties or original file are retained.

Require an unchecked confirmation for each staged initial upload or replacement
of the administrative or barangay layer: “I confirm that the uploaded boundaries
belong to [tenant organization name] ([tenant code]).” One confirmation can cover
both staged layers shown together. It is an operator assertion of review, not
independent verification of geographical correctness. No municipality name match,
GADM identifier, filename, feature count or checkbox can replace structural,
spatial, tenant-access or version validation. The spatial checks cannot establish
that otherwise valid coordinates belong to the intended real-world LGU.

Bind confirmation to the canonical operator, tenant, expected versions and exact
staged boundary/metadata set. Reset it when either file/layer changes, files are
removed, target/operator changes, or canonical versions change during reload or
conflict recovery. Defaults-only changes with both boundary layers retained do
not require a fresh upload confirmation. Clearing saved layers remains an
explicit clear action under the existing clearing rules. Same-owner
reauthentication may retain the confirmation only while the reviewed payload and
versions remain unchanged; an uncertain attempt retains its original confirmed
payload for exact-attempt inspection, not automatic resubmission as a new edit.

The backend must reject a boundary-upload/replacement save without explicit
confirmation. Include confirmation in the existing canonical request fingerprint
so it cannot be changed on an exact-attempt retry. On a successful confirmed
save, append the allowlisted change identifier
`geography_upload_ownership_confirmed` in the same-transaction save audit,
alongside the canonical actor, target, committed versions and existing attempt
correlation. This marker records the operator's assertion; it does not represent
a separate approval workflow or proof of correct jurisdiction. Do not copy
filenames, municipality names, GADM identifiers, raw geometry or free-text
confirmation into audit/receipts. Failed saves leave no committed success marker;
exact retries produce no duplicate audit.

## Existing Naga preparation example

Inspection of [the reference directory](../../reference/map/) found:

| File | Observed structure | Proposed handling |
| --- | --- | --- |
| `naga_admin_ADM_ADM_3.json` | GeometryCollection containing one Polygon, 166 positions | Explicitly extract the single polygonal member as the service area. |
| `naga_brgy_ADM_ADM_3.json` | FeatureCollection of 27 Polygon features, 662 positions total; GID_3/NAME_3 identify barangays, GID_2/NAME_2 identify Naga City | Validate and retain 27 tenant-owned barangay boundaries and their allowlisted identifiers/names. |

Both files contain two-dimensional coordinates consistent with Naga
longitude/latitude and omit a CRS member. Their combined file size is about
44 KB. Structural inspection does not establish PostGIS validity, overlap or
containment; those checks must run before accepting the files. Reference files
remain unchanged and are examples, not automatically loaded tenant configuration.

## Accepted upload formats and canonical storage

Service-area input may be a Polygon/MultiPolygon geometry, a Feature containing
one such geometry, a FeatureCollection containing exactly one such Feature, or
a GeometryCollection containing exactly one Polygon/MultiPolygon member. Reject
multiple members/features, nested collections, null/empty geometry and other
geometry types. Preview the extracted geometry before saving. Wrapper extraction
is explicit format handling; it must not dissolve, repair or alter coordinates.

Barangay input must be a nonempty FeatureCollection. Each Feature must contain a
Polygon/MultiPolygon and a unique nonblank string `GID_3` and `NAME_3`. Require
nonblank string `GID_2` and `NAME_2`, with the same municipality identifier and
name across the collection. The operator reviews that municipality against the
target tenant. Each identifier is at most 200 UTF-16 units and each name at most
200 units; reject surrounding whitespace and control characters. Preserve names
and identifiers as supplied. Duplicate GID_3 values reject; distinct identifiers
may have the same name. Other properties, including `fid` and unrelated GADM
attributes, are ignored and are not persisted. No automatic GADM download or
inferred cross-tenant matching is introduced.

Locations owns one canonical tenant-associated service area, an optional default
point and the current set of barangay geometries/metadata. Store polygonal values
as two-dimensional PostGIS geometry with SRID 4326, preserving Polygon versus
MultiPolygon, component/ring order, winding and numeric coordinates. Store the
default as a two-dimensional Point with SRID 4326. The prepared files are input;
do not retain a competing raw-file geography source or introduce object storage.
The upload filenames are display-only and do not determine ownership.

## Exact coordinate, size and validity rules

- Coordinates are WGS84 longitude then latitude in decimal degrees. Require
  finite numeric longitude [-180, 180] and latitude [-90, 90], inclusive, for
  every position. Zero is valid. Reject extra ordinates, explicit CRS members,
  alternate SRIDs, axis swapping, wrapping, clamping and rounding.
- Maximum 4 MiB UTF-8 per file, 8 MiB combined uploaded JSON, and 10 MiB for the
  complete geography save request, enforced before parsing at each server
  boundary. Retain existing bounds for non-geography fields. Browser checks
  supplement server validation. Bound canonical detail/save/read results by the
  same geography limits and allowlisted metadata.
- Maximum 1,000 barangay features, 256 polygon components per geometry, 2,048
  rings total and 4,096 positions total across service area and barangays,
  including closing positions. Enforce limits before expensive spatial checks;
  reject excessive collection nesting and use bounded database execution.
- Each ring requires at least four positions, at least three distinct vertices,
  exactly matching first/last positions and nonzero area. Require PostGIS-valid
  planar polygon topology: reject self-intersection, invalid holes and invalid
  MultiPolygon component overlap. Either winding is accepted.
- Reject ring segments whose absolute longitude difference exceeds 180 degrees.
  Wrapped antimeridian boundaries are outside this upload contract. Poles are
  numeric endpoints, not special spherical topology. No distance/geodesic
  interpretation is implied.
- Reject malformed, oversized or invalid files without repairing, simplifying,
  snapping, clipping, dissolving or silently dropping features. Correct them in
  the established external GIS preparation process, then upload again.

The user selected an initial limit of 4,096 positions on 2026-10-28
(Asia/Manila, +08:00). This accommodates the supplied Naga example's 828 total
positions; it does not establish suitability for every LGU. If a prepared dataset
exceeds the limit, report the allowed and supplied counts and leave saved
configuration unchanged. Do not truncate or simplify the uploaded boundaries.

The limit may be raised later after reviewing a representative larger dataset
and verifying PostGIS validation, browser rendering, request/result bounds and
concurrent saves. Keep the initial numeric cap consistently enforced across
browser, server and database validation. Raising it requires coordinated updates
to those checks, any affected database constraints, tests and documentation;
existing canonical geometry need not be transformed or reimported solely because
the cap increases. No automatic increase or per-upload bypass is proposed.

These are initial import limits, not a claim that every LGU's unsimplified
GADM dataset fits. Exceeding a limit produces an explicit validation error; the
system does not silently simplify an uploaded boundary.

## Containment, replacement and clearing

A service area and default pair are optional. Barangays are optional but require
a service area. Existing tenants remain explicitly unconfigured; no reference
file or default coordinate is backfilled.

Every barangay geometry must be fully covered by the service area using
PostGIS ST_Covers(area, barangay). Barangay interiors must not overlap one
another; shared edges/vertices are allowed. Gaps are allowed, and complete
municipality coverage is not inferred or required. There is no automatic union
of barangays into a service area. Containment uses exact stored coordinates,
with no tolerance or snapping; reject outside slivers for external correction.

When both area and default point exist, require ST_Covers(area, point). Exterior
and hole boundaries are allowed; hole interiors are excluded. Any valid component
may cover the point. Outside-area defaults reject without an acknowledgment
override. Defaults need not belong to a barangay where the collection has gaps.
With no service area, any otherwise valid default pair is allowed.

A save carries the complete desired geography section. Keeping a saved layer
preserves it; explicitly replacing the barangay collection replaces the full set,
never merges it. Replacing an area revalidates retained barangays and defaults
against the new area. An area replacement does not silently discard them.

Two empty default inputs clear the pair; one empty input rejects. Barangays can
be cleared independently. Clearing the service area while barangays remain
rejects; the operator must explicitly clear both in the same save. Clearing area
and barangays can retain an explicitly submitted valid default. All three may
be explicitly cleared together. Validation/conflicts preserve staged values and
leave canonical data unchanged. An empty barangay FeatureCollection is an error;
use the explicit clear action instead.

## Versions, recovery and canonical consumer boundary

Reuse tenant-first locking, complete tenant/geography version checks, canonical
actor revalidation, same-connection audit and immutable exact-attempt receipts.
One geography version covers the area, barangay set and default point; a stale
save cannot overwrite any of them. Platform orchestrates through locations-owned
ports. Preserve other tenant sections and administrator/credential metadata.
Audit/receipts record allowlisted change identifiers, not raw geometry or uploaded
properties. Do not log uploaded content.

Retain owner/target-bound mounted staged work, including bounded parsed upload
content, through same-owner reauthentication. Fence delayed file reads, validation,
loads and saves on owner/target changes. Explicit uncertain-response recovery
must check the original attempt and reload current canonical data; never restore
an old uploaded set over later edits. Staged uploads are not durable across page
refresh; committed geography is durable and reloadable.

The narrow future-intake read port returns tenant-qualified canonical area and
default point, explicit missing state and required versions under trusted caller
context. Barangay labels/boundaries are configuration data; future incident
classification or barangay-selection behavior remains with its owning unit. No
public geography endpoint, generic client-selected tenant authority, automatic
incident fallback or coordinate application to existing work is introduced.
Unknown/foreign context denies; dependency failures never fabricate geography.

## Implementation and acceptance under approval

After approval, record ONB-02 in the parent specification and amend child 2's
current no-file-import boundary to explicitly include these prepared GeoJSON
uploads, barangay persistence and the upload/review workflow before implementation.
Synchronize architecture/consumer documentation and the tracker. Approval of this
proposal does not approve unrelated file import or map-provider integration.

Extend B-01–07 with the actual Naga file structures and real PostGIS validity,
containment, shared boundaries, overlaps, gaps, invalid-feature rejection,
replacement/clear atomicity, bounded uploads and stale/recovery races. Verify
side-by-side comparison, absent municipality metadata, conflicting file metadata,
confirmation resets, direct saves without confirmation, exact-payload binding and
one atomic allowlisted confirmation audit marker. Preserve
the shared Redis, two-replica, protected API/production HTTPS browser, affected
registry/credential/session regressions and ./dev check requirements. Publish the
exact accepted file contract and operator preparation/upload procedure.

Approval establishes the product contract. Child 2 remains incomplete until
implementation and B-01–07 verification pass; the tracker records actual progress.
