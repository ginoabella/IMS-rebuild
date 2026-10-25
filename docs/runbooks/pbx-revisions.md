# Review and validate PBX desired revisions

Open **PBX nodes → PBX detail → Configuration revisions**. Choose a captured
baseline if useful, then **Capture desired state**. Capture saves an immutable
copy; desired edits made later appear as stale source feedback on that revision.

Inspect the source versions, affected-resource links, credential references and
semantic changes. Select **Compare baseline** after changing the baseline selector.
History and baseline choices use bounded pages. With no selected
baseline, new captures compare against an empty review comparison. The page
separately reports that verified runtime and drift evidence are unavailable.

Select **Validate offline** to record structural diagnostics against the captured
inputs. A passed local result does not establish live validation, calling
eligibility or readiness. Unallocated stock and unbound routes remain denied.
U5-01, U5-04 and U5-05 are live-command/material/fixture blockers for later work.
After a desired change, capture and review a fresh revision. B will revalidate at
apply acceptance; no Apply operation is available in this unit.

If capture loses its response, use **Recover capture receipt**. If the receipt
was not committed, **Retry exact capture** reuses the same request and baseline.
Do not start a new capture while that request is unresolved. After session expiry,
sign in as the same operator and reload canonical results. Another operator does
not inherit retained work. Mounted recovery does not survive a full page refresh;
revision history remains authoritative and retained in PostgreSQL.

For service/offline errors, restore access and **Reload revisions**. A snapshot
limit or fingerprint conflict requires canonical review; never work around it by
changing the unresolved request's values. No operation on this page contacts the
PBX, secret store or provider, installs configuration, reloads or originates calls.

Run `./dev exec pnpm check:pbx-revisions` for deterministic compiler contracts,
isolated real PostgreSQL/shared Redis, two HTTP replicas and actual HTTPS browser
acceptance. See the [snapshot/compiler contract](../architecture/pbx-revisions.md)
and [feature acceptance](../../context/feature-specs/p3-u5a-revision-capture-diff-and-validation.md).
