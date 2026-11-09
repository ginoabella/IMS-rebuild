# Persistent controlled-call preparation

Delivered and accepted, 2026-11-09 (Asia/Manila, +08:00); B-01–07 passed. See
[actual resources, lifecycle and c handoff](../status/p4-u2-dev-b-evidence.md). Use the
[approved dedicated setup](../planning/p4-u2-dev-b-preparation-review.md) and
[exact request definition](../planning/p4-u2-dev-b-manifest.json). Revision 2 in
that definition is applied: the supported
[capability declaration](../planning/p4-u2-dev-b-capabilities.json) preserved all
existing arrays and set the identity/material limits to 71/64. The retained setup
is started at lifecycle version 4; a subsequent lifecycle mutation must use expected
version 4 and a new request UUID. The next actual helper restart requires another
explicit start against its new instance. Setup availability does not establish readiness.

The provisioning worker token had a measured 3,599-second TTL and has naturally
expired. Reissue through the supported named-custodian command when new credential
work is required; preserve the retained generations. Consumer GET-only access was
issued separately with a measured 86,398-second TTL and must likewise be replaced
through its existing scoped path on expiry. Status must report current custody;
this acceptance report cannot extend access or availability.

Run from the repository root through the Docker workspace. There is no new service,
HTTP destination editor or public SIP listener. The existing native helper owns
dispatch; its private sockets exist only during an explicitly requested test.
PostgreSQL owns setup intent/outcomes, immutable cases, lifecycle events and exact
resource versions. Existing protected volumes retain native receipts and provider
custody. HTTP/Next receive case UUIDs and safe availability only.

## Inspect before effects

```sh
./dev tenant-calls inspect bcb9d21c-96cd-4975-bd68-314b588a23a9 58adb785-5384-41ce-9c72-ccda6ea554db
./dev pbx-profile status bcb9d21c-96cd-4975-bd68-314b588a23a9 58adb785-5384-41ce-9c72-ccda6ea554db
./dev tenant-calls status docs/planning/p4-u2-dev-b-manifest.json
./dev tenant-calls preview docs/planning/p4-u2-dev-b-manifest.json
```

`inspect` uses one bounded PostgreSQL READ ONLY snapshot and rejects a mismatched
installation before exposing its inventory. It does not verify provider material
or dispatch availability. `status` reads setup progress and approved case
availability without native/provider transport. `preview` also checks the retained
profile, provider access and passive source/port prerequisites; it never binds a
socket, provisions, issues access, renews a grant or places a call. Missing schema,
unapplied capability limits, stale versions, conflicts and unavailable dependencies
remain blockers. A successful preview is not an effect-time lock or tenant proof.

## Rehearse, then prepare

```sh
./dev tenant-calls rehearse
```

This uses an isolated PostgreSQL copy and deletes only that exact fixture database.
It exercises target rejection, partial setup, canonical acknowledgement loss,
concurrent repeats, immutable records and lifecycle/custody gating. SQL-injected
availability proofs in that fixture do not establish actual provider or native
restart acceptance. The required live/native/provider suites remain separate.

For ordinary zero-traffic proof, use one new observation UUID across the window:

```sh
./dev tenant-calls observe-start docs/planning/p4-u2-dev-b-manifest.json OBSERVATION_UUID
./dev tenant-calls observe-status docs/planning/p4-u2-dev-b-manifest.json OBSERVATION_UUID
./dev tenant-calls observe-stop docs/planning/p4-u2-dev-b-manifest.json OBSERVATION_UUID
```

These commands add/read/remove only their uniquely named counter-only nftables
table in the existing private Asterisk namespace. They create no socket, retain no
packet contents and change no packet verdict or admission rules. INVITE, REGISTER
and RTP counters cover the approved private signaling ports and the reference
10000–10100 media envelope; actual retained RTP remains 10020–10039. Exact start
retry preserves counters. A missing table returns `not_observing` with null counts,
never invented zeros. The live fixture witnesses real SIP/RTP increments before
checking zero deltas across preparation/read/native reconstruction. Keep the window
across helper-only restart, which preserves the network namespace; a recreated
container requires a new observation and cannot inherit an old counter proof.

Capture original rows before ordinary changes and verify only declared additions:

```sh
./dev exec node scripts/tenant-call-preparation-preservation.mjs before NODE_UUID INSTALLATION_UUID BEFORE.json
./dev exec node scripts/tenant-call-preparation-preservation.mjs after BEFORE.json docs/planning/p4-u2-dev-b-manifest.json AFTER.json
```

Use private project-local output paths and retain the original file. PostgreSQL
exports hashes, not raw rows. The comparison preserves every original stable row,
enumerates exact desired additions and permits only the declared capability-limit
change and listed volatile ownership/proof tables. Pair it with passive exact
profile/baseline/reference inspection; additive provisioning cannot be checked by
requiring obsolete global table fingerprints to remain identical.

After their proof and before ordinary setup, deploy the additive migration and
the reviewed limits through the existing trusted commands:

```sh
./dev migrate
./dev exec node services/backend/dist/entrypoints/deployment/main.js declare-endpoint-capabilities docs/planning/p4-u2-dev-b-capabilities.json
```

Retain all previous artifact/static-profile bytes, the original baseline and
unrelated rows. Capability revision 2 preserves the observed kinds, signaling,
codecs and media and declares only the required 71-character generated identity
and 64-character material support; actual isolated SIP/provider verification must
precede this declaration. No reference files or retained endpoint material change.

```sh
./dev tenant-calls worker-access docs/planning/p4-u2-dev-b-manifest.json
./dev tenant-calls prepare docs/planning/p4-u2-dev-b-manifest.json
./dev tenant-calls credentials docs/planning/p4-u2-dev-b-manifest.json
./dev tenant-calls reconcile docs/planning/p4-u2-dev-b-manifest.json
```

Preparation stops at each committed credential intent until its exact provider
generation is associated and verified. Repeat the `credentials` / `reconcile`
pair as each of the three extensions reaches that boundary. The designated
credential process uses only the installation's existing worker role and private
provider/database networks; it has no native/PBX listener or Docker socket.
`worker-access` uses `platform-owner-custodian` and the protected host password,
checks the existing exact role, replaces its token and revokes known predecessors.
It changes no policy, role, stored endpoint material, auth mount or root access.
Expired/denied/unavailable access blocks progress. `.new` / `.previous` custody
must be reconciled exactly; never delete protected files to bypass uncertainty.

Every canonical create and credential request retains a deterministic request
identity. Step input is committed before its supported effect and outcome
acknowledgement. Exact reruns return durable outcomes; a changed payload conflicts.
Lost acknowledgements use existing canonical receipts or the exact one-version
status transition; they never create replacement resources. Interrupted authorised
prerequisites remain inventoried for reconciliation. An expired canonical receipt
with no retained setup outcome is a blocker, not permission for a new request ID.

Keep the original manifest after acceptance. The manifest file is a request
definition, not a second authoritative route database; actual identities and
versions come from canonical outcomes. `status` enumerates safe step/resource IDs
and the final retained inventory. c uses those same identities to complete route
ownership/permissions, capture/review/apply and establish tenant proof. Provisioning
alone cannot grant calling or mark any endpoint ready.

## Start, stop and restart

Use a newly generated lifecycle request UUID and the exact latest event version
from `status` (zero before the first event):

```sh
./dev tenant-calls start docs/planning/p4-u2-dev-b-manifest.json REQUEST_UUID EXPECTED_VERSION
./dev tenant-calls stop docs/planning/p4-u2-dev-b-manifest.json REQUEST_UUID EXPECTED_VERSION
./dev tenant-calls restart docs/planning/p4-u2-dev-b-manifest.json REQUEST_UUID EXPECTED_VERSION
```

These placeholders are lifecycle identities/version checks, never destinations or
commands. Exact retry reuses the same pair and returns the prior event. A different
payload or stale version conflicts. Restart is an explicit new start event bound
to the current native process instance and owner epoch. A native restart changes
that instance and blocks prior admission even if its canonical lease survives.
Queued/dispatching/admitted/unknown work blocks start; unknown activity requires
the existing controlled-test reconciliation, never redial.

The protected telephony consumer checks exact current-artifact provider custody
on a bounded five-second loop. Its safe proof is valid for at most 15 seconds and
binds owner/source digest. Native receives no provider token. Dispatch additionally
requires current canonical facts, independently verified loaded runtime and all
existing grant/nonce/authority checks. Availability and tenant readiness remain
separate; `review-2` cannot establish tenant readiness. Reads and lifecycle commands
never extend call-result timestamps, issue grants or send REGISTER/INVITE.

The consumer checks exact read-only scope even when the current artifact contains
no credentials, then verifies each published preparation's three actual associated
generations as well as the current artifact. An empty older artifact cannot hide
expired access or missing prepared material. The fixed AGI client sets the initial
30-second natural deadline only for an admitted controlled nonce; process loss
therefore retains unknown evidence while the call drains within its original bound.

Case publication invalidates the prior custody proof under the node's exclusive
lock. The consumer commits only the exact published preparation set whose material
it checked, using a short shared node lock and a fresh SQL snapshot after that
lock. A GET sequence started before publication cannot restore the older proof.
Provider transport remains outside these transactions.

Refresh the ordinary protected HTTP/Next and native/consumer code **before**
publishing cases. The new immutable cases must never be exposed to an old process
that lacks preparation admission checks. The AGI change belongs to the existing
native image; helper-only JavaScript refresh does not update that image asset.
Deploy its reviewed image through normal quiet service lifecycle while there are
zero eligible tests, grants, pending/unknown work and active channels. Preserve the
same installation, selected profile, protected data/control volumes and original
baseline. No static `.conf`, module capability or reference file changes are needed.
Recheck exact loaded profile, health, instance/owner and custody after the refresh.

After preparation/start and completion of the fixture commands, independently read
the ordinary tenant pages through the normal private HTTPS ingress:

```sh
./dev exec node scripts/check-tenant-call-preparation-console.mjs docs/planning/p4-u2-dev-b-manifest.json
```

This issues a temporary canonical session for the manifest's existing operator
using the real PostgreSQL/shared Redis lifecycle, then revokes it on exit. It does
not perform or claim a password sign-in. It checks retained case IDs, safe available
cases with incomplete readiness, no grant/test creation, keyboard/axe/reflow and
private screenshots. It runs no fixture server and submits no call or grant intent.

Stop prevents new intent selection, dispatch and final nonce admission under the
existing canonical node locks. Active calls complete naturally; results, unknown
work, desired state, cases and audit remain. Helper/provider loss fails closed.
For expired read-only consumer access use the existing named-custodian replacement
`./dev pbx-live-access INSTALLATION_UUID`, then the documented normal consumer
refresh. Do not rotate associated endpoint material to repair access.

## Disable and cleanup ownership

```sh
./dev tenant-calls disable docs/planning/p4-u2-dev-b-manifest.json REQUEST_UUID EXPECTED_VERSION
```

Disable is terminal for this preparation and appends case disablement without
rewriting case provenance or historical results. A changed request cannot silently
reuse its IDs or retarget cases. Review changed intent and explicit resource reuse
before a successor definition; do not change the accepted manifest or regenerate
request IDs to work around a conflict.

The intentional retained inventory is the two dedicated drafts, their initial
unset administrators, one labelled profile, three real credential generations and
extensions, two allocation claims, gateway/trunk, two DIDs and four desired rules,
approved cases, setup/lifecycle/audit/credential/test history and any later c
bindings/artifacts/pins. Preserve unrelated tenants, claims, peers, credentials,
reference bytes, volumes, original artifacts/profiles and the baseline. Retain the
capability declaration as an intentional addition unless separately reviewed.

Stopping participants, disabling cases and revoking grants do not remove loaded
paths. c must capture a replacement omitting the exact verification paths,
review/validate/apply it through normal custody/native fencing and independently
prove their absence in loaded dialplan/PJSIP. Keep pinned resources when runtime
or recovery ancestry prevents removal. Use existing reviewed artifact retirement,
dependency checks and versioned release only after actual absence proof; never
delete whole tenants, prune volumes, force hangup or clear pins. Parent AC-09 is
not passed by preparation or disablement.
