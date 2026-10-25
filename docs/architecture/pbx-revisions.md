# PBX revision capture and review

P3-U5a owns the offline capture → review → validate boundary. The existing
telephony module and primary PostgreSQL store own it; no new process, provider
access, runtime catalog or control permission is introduced.

## Atomic capture and source contract

`POST /platform/pbx-nodes/:nodeId/revisions` accepts only `requestId` and an
optional same-node captured `baselineId`. The platform authority lock precedes
the operator/request advisory lock and canonical node `FOR UPDATE` lock. A single
SQL statement reads node/version, deployment capability, current and referenced
immutable profile versions, extensions and generated endpoint/auth/AOR identities,
current trunks/gateways/source hosts/DIDs, ordered group members/fallbacks,
reservations, inbound/outbound definitions and generated attribution identities.
Exact endpoint generation UUIDs and trunk credential UUID/material-version pairs
are retained with safe availability facts. No provider path, material or material
hash is read or returned. One SQL snapshot also excludes mixed child-row reads
under concurrent desired edits. Canonical writers retain their existing locks.

Collection reads stop at 2,049 rows each before aggregation. Total snapshot sources
are limited to 2,048 and canonical JSON to 4 MiB. SQL deadlines remain the existing
2-second runtime limits. Groups and outbound compilation retain their 512-record
limits. These are explicit rejection bounds, never partial successful captures.
Snapshots contain only explicit module-owned columns; no generic table dumps.

The server assigns UUID, per-node sequence, latest captured parent, selected
baseline, compiler/policy versions and actor/time. Snapshot, audit and scoped
receipt commit together. Thirty-day exact retries recover the original revision;
changed node/baseline fingerprints conflict. Receipt reads are bound to the current
operator and requested node. Review references are historical only: they neither
pin live resources nor block desired removal or credential replacement.

`pbx_revisions`, `pbx_revision_receipts` and `pbx_revision_validations` are append
only by both grants and triggers. Validation never rewrites captured content.

## Compiler and semantic review

`review-1` produces a deterministic typed, nonmaterialized plan; `deny-unbound-1`
preserves deny defaults. It retains profile settings, exact credential references,
generated identities, group strategy/member order/timeouts/fallbacks, exact-before-
catch-all inbound ordering and explicit outbound priority/strip/add domains.
Disabled winners deny; original and transformed reservations remain protected.
Unknown ingress/unmatched outbound/unbound resources deny. No production tenant
allocation, binding or shared-trunk permission is synthesized.

Structural validation checks profiles/capabilities, identities, references,
patterns/transforms/reservations, group cycles, unavailable credentials and work
bounds. It accepts no raw commands, application/context text or filesystem paths.
Labels remain JSON data; configuration control-character injection rejects.
Unsupported capability is an error. Eligibility and U5-01/04/05 are explicit
blockers. Diagnostics are bounded to 512 entries with explicit truncation, while
failure state remains independent of diagnostic truncation.

Browser DTOs contain source UUID/version/name, safe exact credential references,
finite diagnostics and field-level change names. Internal endpoint and route keys
stay server-side. Diff compares immutable source semantics against a selected
same-node revision; additions/removals/edits and credential-reference changes are
separate. A missing baseline is an empty _review comparison_, not an empty runtime.
There is no verified runtime producer in a: runtime is explicitly
`no_verified_runtime`, drift `unknown`. B must replace this with its canonical
verified runtime evidence, never infer it from registration or capture history.

## Validation and b handoff

Validation stores revision ID, compiler/policy versions, exact evaluated dependency
UUIDs/versions, a digest of all evaluated safe source facts, actor/time and bounded
diagnostics. Dependency digests include availability, profile settings and source
identities rather than only version counters. Detail recomputes applicability
against a fresh consistent primary snapshot. A changed source never updates the
snapshot, and an older validation cannot claim current applicability. Local
structural success is independent of unavailable live validation and eligibility
blockers; neither implies readiness.

B owns acceptance-time revalidation, protected materialization under U5-04, actual
runtime/in-flight/recovery pins and mutation blockers, initial verified baseline,
external fencing, installation, live validation/probes and verified recovery.
A adds no Apply endpoint and its browser Apply control is unavailable.

## HTTP and browser boundary

History/detail and exact receipts are platform-cookie protected passive reads;
capture and validation are operational mutations with existing CSRF and canonical
transaction authority. Lists use bounded sequence cursors (1–100, default 25).
Detail supports only `baselineId`. Validation accepts an empty object. Unknown
body/query fields, commands and client-selected authority reject. Named Next
forwarding checks routes, inputs, bounded responses and exact safe output shapes;
successful responses are capped at 32 MiB (including two 4 MiB snapshots’ redacted comparison), errors at 4 KiB, and all reads/results are no-store. HTTP/Next resolve no secrets and issue no PBX calls.

The PBX detail link opens `/pbx-nodes/:nodeId/revisions`. Mounted recovery uses the
existing canonical operator/epoch contract; the exact request and baseline survive
same-owner reauthentication. Canonical results are reloaded and stale callbacks
cannot attach another operator's result. Refresh persistence belongs to neither
this workflow nor the existing mounted recovery contract.
