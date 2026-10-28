# P4-U1b-2 — Service area and default intake coordinates

**Status:** Complete within approved private development, 2026-10-28
(Asia/Manila, +08:00). B-01–07 passed under user-approved ONB-02;
[final evidence](../../docs/status/p4-u1b-2-evidence.md).

Parent: [P4-U1b — Tenant onboarding configuration](p4-u1b-tenant-onboarding-configuration.md).
The parent owns shared behavior, ONB-01–03 and AC-01–11. This child owns operator
geography authoring, canonical PostGIS persistence and the intake configuration
handoff; it does not deliver incident intake.

## Goal and starting state

The platform operator opens a saved draft, authors its approved service area and
default intake coordinates, saves, and reloads the same canonical geography.
Invalid geometry/coordinates and stale saves cannot corrupt saved configuration.

Start after verified
[P4-U1b-1](p4-u1b-1-resumable-registry-editing-and-contacts.md).
Reuse its detail/edit composition, authority/status checks, version/lock policy,
transactional audit and durable attempt recovery. PostgreSQL/PostGIS already
exists; geography feature schema and an operational map/search service are not
assumed to exist. Follow [architecture ownership](../architecture.md): locations
owns geography, tenancy owns organization admission, platform orchestrates.

## Decisions and dependencies

Parent ONB-02 is resolved by the user-approved
[geography policy](../../docs/planning/p4-u1b-2-geography-policy-review.md),
2026-10-28 (+08:00). That exact contract governs dependent geography work. The
[D-07 recommendations](../../docs/planning/p1-u1-product-contracts.md#7-d-07--intake-location-and-drafts)
are not approval. Record configuration authority, representation, authoring UI,
requiredness/unset behavior, WGS84 coordinate policy, exact geometry/size limits,
containment and edge semantics, and outside-area handling. Preserve ONB-03's
approved edit eligibility from child 1.

The approved contract uses prepared administrative and optional barangay GeoJSON
uploads, a local boundary preview and explicit default coordinate entry. Both
service area/defaults are optional; barangays require an area. Validity,
containment, clearing, confirmation, 4,096-position and byte/feature/ring/component
bounds are specified exactly in ONB-02. No external tiles/search provider is used.

## Scope and expected result

- Add locations-owned canonical service-area/default-coordinate persistence with
  qualified tenant association, suitable PostGIS types/SRID and database validation
  under ONB-02. Add only necessary additive migrations/constraints/runtime grants.
  Existing drafts stay explicitly unconfigured; never backfill invented geography.
- Extend bounded shared DTOs and named detail/save consumers through owner ports.
  Platform code must not directly update location tables. Keep a single canonical
  geography source and return the complete version set needed for safe editing.
- Provide usable service-area authoring and labeled longitude/latitude controls
  inside the actual tenant detail, with saved/unsaved/error feedback. Show absent
  area/defaults clearly. The coordinate pair saves or clears atomically. Reject
  malformed, oversized, non-finite, incomplete, out-of-range and unsupported-SRID
  input, silent axis swapping, and invalid topology under the approved rules.
- Apply exact approved bounds and containment behavior, including polygon boundary,
  holes and multiple components where supported. Reject invalid geometry rather
  than silently repairing or clipping it; do not invent warnings/acknowledgments
  where the approved policy requires rejection. Zero is a valid coordinate value.
- Reuse child 1's section save, actor/target/version checks, consistent tenant-first
  owner locking and same-connection audit/receipt. Coordinate tenant and geography
  versions so stale edits cannot overwrite either owner. Preserve name, contacts,
  administrator metadata and credential eligibility when saving geography.
- Provide a narrow tenant-qualified canonical read port for future intake to obtain
  configured defaults/area or explicit unconfigured state with versions. Document
  longitude/latitude order, SRID, units, validity, missing-state behavior and access
  boundary. Reject unknown/foreign tenant references using trusted caller context;
  no public or generic client-selected tenant authority is introduced.
- Reuse owner/target-bound mounted work and uncertainty handling. Validation and
  stale conflicts preserve input; explicit recovery cannot restore old geometry
  over later saves. Access/owner/target changes fence delayed reads and writes.

Reads stay passive/no-store and mutations retain platform-cookie/permission,
source/Origin/CSRF/shared admission checks. Bound coordinate/geometry payloads,
result sizes and validation work. Audit records allowlisted change identifiers,
not raw geometry or contact data. Prepared administrative/barangay GeoJSON
uploads, canonical barangay persistence, side-by-side preview and payload-bound
ownership confirmation are explicitly approved. No speculative events, jobs, other file imports,
public map provider, incident drafts or coordinate application to existing work.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Actual operator browser authors, saves, clears where allowed and reloads approved area/defaults across replicas. Real PostGIS and DTOs preserve approved geometry, SRID and coordinate order; existing unconfigured drafts remain explicit.                                                             |
| B-02 | Reject incomplete/non-finite/out-of-range pairs, malformed/oversized/wrong-SRID/invalid geometry and forbidden clearing. Exercise zero, coordinate extremes, axes and approved containment/edge/hole/component rules. Errors preserve values; no silent repair.                                         |
| B-03 | Real A/B stale geography and cross-section races, including target status/operator authority changes, preserve canonical values and approved eligibility. Inject geometry/audit/receipt failure: all attempted section writes roll back with actual runtime grants; earlier name/contact saves survive. |
| B-04 | Exact-attempt retries, concurrency and lost/uncertain responses preserve one change/audit and explicit recovery. Changed-input/foreign-operator attempts reject, and later canonical edits cannot be replaced by an old recovered result.                                                               |
| B-05 | Canonical intake read port returns configured or missing state with correct tenant/version/axis semantics. Foreign/unknown context and direct unauthorized API/Next calls deny; dependency failures cannot fabricate defaults or authority. This proves configuration handoff, not incident fallback.   |
| B-06 | HTTPS geography journey passes keyboard/focus/error/reflow checks and same-owner reauthentication, owner/target switch, delayed callback and outage recovery. Child 1's registry/edit and existing credential panel remain working with no secret leakage or implicit activation.                       |
| B-07 | Focused real PostGIS/shared Redis/two-replica/API/production Next checks, affected registry/credential/identity/session regressions and `./dev check` pass. Publish exact geography/consumer contract, operator procedure, commands/results/cleanup and child 3 handoff.                                |

Covers parent AC-03 and geography portions of AC-05/06/09/10/11. Extend the focused
selector from child 1; record exact commands rather than claiming an unimplemented
command exists. Retain `./dev exec pnpm check:draft-tenant` and applicable
`./dev exec pnpm check:staff-auth --lifecycle` coverage. Use real PostGIS for spatial
claims; fixture ports alone cannot establish a future intake or live provider.

## Completion and handoff

Complete only after B-01–07 pass and decisions/evidence are recorded in the tracker.
Hand child 3 complete canonical detail, tested geography/version/save contracts and
operator workflow. Hand P5-U4/U5 the approved canonical read port and missing-state
contract; they still own fallback copying, confirmation and location correction.
Voice preference, integrated onboarding and parent completion remain child 3.
