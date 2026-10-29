# Draft tenant configuration

For a step-by-step test with expected results, use the
[P4-U1b manual testing guide](../guides/p4-u1b-manual-testing.md).

In the platform console, open **Tenants**, search a saved organization's code or
name, optionally select a lifecycle filter, and open **View**. Search treats `%`,
`_` and backslashes literally; blank search lists all records. Pages have 25 rows.
Changing search/filter starts at the first page. Reload restores committed values.

While the tenant is draft, edit **Organization name** or **Organizational contact**
and use that section's Save button. The permanent code and original administrator
remain unchanged. Other lifecycle statuses are readable. Name is required, trimmed
and bounded to 200 UTF-16 units. Contact name/email/phone are independently optional;
blank clears. Partial contacts show incomplete. Contacts are informational and do
not verify identity or authorize delivery. Geography and voice are covered below.

A conflict preserves your input. Reload detail to see the current version, then
explicitly discard the affected section to adopt it and make your changes again.
An uncertain outcome retains the original request; restore access and choose
**Retry original name/contacts save**. It recovers the original outcome and loads
current values, which may include later edits. Do not assume failure means nothing
committed. Writes never replay automatically. Unsent work survives same-owner
reauthentication in the mounted page; refresh/navigation discards it. Sign-out or
another operator clears work. Keep using the original administrator credential
panel and its required person-verification process; setup does not activate a draft.

Deploy the additive migration through `./dev migrate` before updated HTTP code.
Receipts are immutable and have no runtime cleanup. No jobs or external effects
are created. Architecture, bounds and ports are in the
[registry contract](../architecture/draft-tenant-registry-api.md).

Run `./dev exec pnpm check:draft-tenant --onboarding-api` and `--onboarding-browser`
for focused real-service checks, `./dev exec pnpm check:draft-tenant` for the combined
registry regression, affected credential checks, then `./dev check`. The fixtures
own and drop disposable stores and processes; they do not mutate ordinary tenant
records or establish production acceptance.

## Approved geography upload workflow — P4-U1b-2

This workflow is implemented under
[approved ONB-02](../planning/p4-u1b-2-geography-policy-review.md) and verified
within private development; see [acceptance evidence](../status/p4-u1b-2-evidence.md).

Prepare municipality/city service-area and optional barangay GeoJSON in the
established external GIS process. Do not alter coordinates merely to make a
failed upload appear successful. Select the intended draft tenant and check its
organization name and existing tenant code. Upload the administrative `.json` or
`.geojson` (one Polygon/MultiPolygon, or approved single-member wrapper), then
optionally upload its barangay FeatureCollection. Files are limited to 4 MiB each,
8 MiB combined, and 4,096 combined closing positions. Barangays require valid
GID_3/NAME_3 and consistent GID_2/NAME_2 metadata. The Naga reference demonstrates
a one-Polygon GeometryCollection plus 27 barangay features; it is not automatic
production configuration or evidence of complete/current jurisdiction.

Compare the saved and proposed previews, uploaded municipality metadata/source,
barangay names/counts and selected tenant. Missing administrative metadata is
shown explicitly. Tenant code remains the existing registry/login code; GADM IDs
are uploaded geographical metadata. Confirm that the uploaded boundaries belong
to the selected tenant. This records operator review, not independent jurisdiction
verification. A changed upload/target/operator/canonical version resets confirmation.

Enter default longitude and latitude explicitly, or leave both blank. Defaults
must be inside/on the configured service area when it exists; hole interiors
are outside. Save geography once, then reload to inspect canonical configuration.
One blank coordinate is invalid. No default point is inferred from the boundary.

Clear barangays independently, clear service area and barangays together, or
clear the default pair; review and save the entire intended section. Invalid
geometry, outside slivers, overlap or excessive complexity must be corrected in
GIS preparation. The application never clips, repairs or simplifies the upload.

On validation/conflict, staged input stays available. Reload current detail and
explicitly discard the section to use that canonical configuration before editing
again. After an uncertain save, reauthenticate as the same operator if necessary
and explicitly retry the original geography save. It reconciles the original
receipt and reloads current data, including later saves. Do not submit a new
replacement while the original result is uncertain. Staged uploads do not survive
page refresh; committed geography does. Other operators/targets cannot recover
another owner's mounted work. No geography save changes activation or credentials.

Verification uses `./dev exec pnpm check:draft-tenant` (including prepared-file
contracts, real PostGIS/A/B API and production HTTPS browser),
`./dev exec pnpm check:staff-auth --lifecycle`, and `./dev check`.
Exact commands, results, cleanup and remaining limitations belong to the evidence.

## Voice preference and administrator handoff — P4-U1b-3

Create a draft, then use the registry's code/name search and lifecycle filter to
resume its detail. Save organization, contacts and geography independently. In
Voice preference, explicitly choose Voice enabled or Voice disabled and save.
Not configured is incomplete, including for tenants created before this feature.
Reload detail to see saved lifecycle, preference, geography/contact completeness
and receipt-linked administrator state. Unsaved mounted sections remain editable;
their original versions intentionally conflict if another save changed the row.
Discard only the reviewed section to use loaded canonical values before a new save.

For an uncertain configuration save, restore access as the same operator and use
Retry original voice save. The recovered version is historical; current detail is
canonical. Never submit replacement input until the original outcome is reconciled.

Verify the actual administrator against established organization records for every
issue/reissue and acknowledge the approved secure handoff. Contact edits neither
verify identity nor send anything. The existing issuer chooses setup for eligible
unset credentials and the approved linked reset path for ready-draft recovery.
Hand the one-time code directly to the verified person and give the clean HTTPS
credentials-page address separately. The recipient chooses their password; the
operator never receives or selects it. Keep codes/passwords out of URLs, storage,
reports and configuration. Check credential status or reload detail after exchange.
Previously saved configuration and unrelated unsaved edits survive this refresh.

Lost issuance requires safe status and an explicit newly verified reissue; it cannot
redisclose a code. Lost exchange stays uncertain under the
[credential recovery procedure](staff-credential-lifecycle.md). Never replay a code
or password automatically. Failed credential operations leave configuration intact.
Draft staff sign-in remains denied whether credentials are unset or ready. Preference,
credential exchange and opt-out do not activate tenants or establish PBX readiness.
P4-U2 allocation/routing and P4-U3 lifecycle supply their own gates.
