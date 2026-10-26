# PBX revision capture, live execution and recovery

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

`review-2` produces a deterministic typed, nonmaterialized plan; `deny-unbound-1`
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
Unsupported capability is an error. Live validation, exact material and calling
eligibility remain explicit diagnostics independent of local structural success. Diagnostics are bounded to 512 entries with explicit truncation, while
failure state remains independent of diagnostic truncation.

Browser DTOs contain source UUID/version/name, safe exact credential references,
finite diagnostics and field-level change names. Internal endpoint and route keys
stay server-side. Diff compares immutable source semantics against a selected
same-node revision; additions/removals/edits and credential-reference changes are
separate. A missing baseline is an empty _review comparison_, not an empty runtime.
Without a verified baseline, runtime is explicitly `no_verified_runtime`, drift
`unknown`. Live detail compares against the actual verified artifact snapshot or
the independently captured empty initial baseline, never registration or capture
history. This comparison is independent of the optional historical baseline.

## Validation and b handoff

Validation stores revision ID, compiler/policy versions, exact evaluated dependency
UUIDs/versions, a digest of all evaluated safe source facts, actor/time and bounded
diagnostics. Dependency digests include availability, profile settings and source
identities rather than only version counters. Detail recomputes applicability
against a fresh consistent primary snapshot. A changed source never updates the
snapshot, and an older validation cannot claim current applicability. Local
structural success is independent of unavailable live validation and eligibility
blockers; neither implies readiness.

The live boundary performs acceptance-time revalidation, protected exact
materialization, actual runtime/in-flight/recovery pins and mutation blockers,
initial verified baseline, external fencing, installation, independent probes and
verified recovery. Offline success alone leaves Apply unavailable until the native
executor has a fresh heartbeat and independently established baseline.

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

## P3-U5b implementation boundary

The owner approved U5-01–05 and the scoped nftables/NET_ADMIN addendum in the
[policy record](../planning/p3-u5b-live-policy-review.md). These approve controlled
private development, not production acceptance. The approved private profile is
active with an independently verified initial baseline. B-01–08, affected/normal
checks and retained refresh/preservation passed. C later completed parent/Phase 3
acceptance under the same approved development scope; see [b evidence](../status/p3-u5b-evidence.md)
and [integrated c evidence](../status/p3-u5c-evidence.md).

Protected immutable staging and exact-version GET-only material consumption live
in the telephony `adapters/live` boundary. Public HTTP/Next and ordinary workers
receive no provider token/material; workers only mark committed intent delivered.
The candidate renderer derives fixed Asterisk syntax from canonical typed snapshots
and keeps every ordinary endpoint/trunk ingress context denied before onboarding.
Unsupported live profiles or unrepresentable exact material fail before selection.

A dedicated native helper inside the existing Asterisk container owns mutation.
Its root-owned durable `pbx-live-data` filesystem volume mounts at
`/var/lib/myims-pbx`: private control/journal/staging below `control`, restricted
Asterisk-readable complete sets below `managed`, and temporary isolated validator
work below `validators`. The parent is root owned and not writable by Asterisk.
This avoids placing privileged helper paths under Asterisk's writable library
directory. The existing PBX database/library/configuration volumes remain distinct.
This required protected artifact volume is not a new database or service, and
does not establish backup readiness.

The physical epoch acknowledgment follows a serialized installation queue. Native
startup holds the installation flock as FD 3; a fixed guardian inherits the same
open-file description through actual synchronous Asterisk CLI completion. Mutating
commands write to protected regular files, so helper death cannot break their
stdout pipe and prematurely release the lock. Caller deadlines leave execution
uncertain and never kill/replay a dispatched mutation. Successor acknowledgment
waits for dispatched work to drain. The exact pinned
[PJSIP reload](https://github.com/asterisk/asterisk/blob/22.10.1/res/res_pjsip.c) and
[dialplan reload](https://github.com/asterisk/asterisk/blob/22.10.1/pbx/pbx_config.c)
implementations are synchronous; the isolated actual timeout/helper-death race has passed. Integrated canonical
PostgreSQL owner/dispatch-race proof has also passed; retained-installation
startup/baseline proof has now also passed before private activation. A SQL lease by itself is not a
physical takeover.

Ordinary observation credentials must also lose their alternate control route:
the native TLS observation gateway exposes only Login, Logoff, Ping,
PJSIPShowEndpoints and PJSIPShowContacts, forwarding to loopback-only AMI. Raw
Reload/Command/Shutdown and unknown actions are denied. The old observation
profile's broad system permission is not an accepted live-control bypass.

Actual native/PostgreSQL acceptance, protected exact-provider consumption, executor
wiring, controlled route probes, verified recovery and the HTTPS browser journey
passed the focused command. Final affected/normal checks and retained refresh
also passed. These actual integrated results establish B-01–08 within the approved
scope; helper tests alone do not.

The opt-in native helper and protected telephony consumer communicate over one
root-owned Unix socket volume, mounted only in those two containers. The native
side independently loads delivered immutable SQL intent and checks canonical
ownership; the consumer alone resolves exact retained provider identities. Socket
messages accept only ownership/operation identity and a bounded protected material
envelope. HTTP/Next/ordinary workers receive neither that mount nor provider access.
The native helper has its own scoped SQL execution role, no provider token and no
Docker socket. Its supervisor starts the lifetime-flock child separately; helper
loss preserves PBX calls and fresh children remain excluded by surviving command
guardians. The retained private profile and initial baseline have been verified;
final unit results and scoped limits are recorded in the evidence.

The live consumer's configuration and provider token must live in the dedicated
`pbx-live-consumer` Docker volume, mounted read-only only by telephony. The shared
workspace hosts Next with the host UID, so an owner-only file under its project
bind is insufficient isolation. The new staging custody was protected root-only
when that access check exposed the issue. Neither the consumer volume nor any
provider token is mounted in workspace, HTTP, ordinary workers, or Asterisk.
Trusted one-shot setup receives exact read-only inputs and separate native/config
outputs; it never mounts the project directory or runs Next. Acceptance PBXs receive
only the exact native executor SQL password, never the consumer volume.

The fenced owner reconciles the committed primary `active_operation_id` directly;
ordinary-worker outbox delivery is an idempotent notification/receipt, not an extra
health or authority gate. A missing/exhausted transport notification cannot strand
accepted intent indefinitely. Uncommitted/rolled-back intent is invisible, and
physical admission still rechecks canonical actor, ownership, baseline and sources.
Late notifications never repeat native effects; native attempts remain bounded.

## Interruption reconciliation and downstream handoff

The native journal records pending uncertainty before effects and records the exact
verified outcome before the SQL result is acknowledged. These are separate durable
boundaries. After a native receipt/SQL acknowledgement gap, the owner reads the
physical receipt and finishes that same canonical operation. After a pending
activation/reload/probe gap, it checks exact selected bytes, loaded resources and
probes for the candidate and reviewed baseline; it does not repeat candidate
selection or reload. Failure to prove either retains pending state and the barrier.
Only explicit, audited predecessor reconciliation authorizes restoration. An older
healthy baseline cannot promote the interrupted target. SQL acceptance and physical
ordering must agree before a newer operation can run.

The repeatable [interruption fixture](../../scripts/pbx-live-interruption-fixture.mjs)
uses actual child-process exits around staging, parser validation, selection,
reload, independent probes and SQL finish, including dispatch during probes.
Successors wait for default lease expiry and the actual kernel fence. Protected
consumer cancellation around actual exact-version reads is separately identified
as injected owner loss, rather than an OS crash. Public fixture browsers receive
no material/provider access. Private file controls exist only in the disposable
native browser fixture; production entrypoints contain no fault controls.

P4-U2 must consume immutable revision/resource UUIDs and versions, the verified
artifact's exact provenance, canonical runtime state and actual dependency pins.
Use `RuntimeDependencyPort.assertUnreferenced(tx,nodeId,kind,resourceId)` under the
canonical node lock for future reallocation/removal/retirement. Endpoint generations
and trunk `(credentialId, materialVersion)` pairs remain pinned while installed,
in flight or retained as rollback targets. New desired references never release
old runtime dependencies. Presently verified artifacts remain retained; there is
no general artifact retirement/pruning operation. Only a never-installed rejected
revision can release its pins after affirmative native rejection and a canonical
finish. Unknown state and unavailable providers cannot establish safe release.

P4-U2 also owns the future trusted allocation/binding eligibility port. It must
provide canonical tenant ownership, explicit shared-trunk permission and all
reachable destination ownership before a later compiler/policy version can enable
tenant routing. Current snapshots explicitly mark allocations, bindings and shared
trunk permissions unavailable. A synthetic topology or successful PBX probe is not
that port. P4-U3 remains responsible for voice readiness and activation, considering
verified provenance, pending/unknown work and tenant-owned route tests independently
of the fact a tenant record exists.

P5-U3 must preserve internal inbound `sourceKey`, generated context/route identities
and immutable resource/revision versions, then authenticate actual ingress before
mapping any event to a tenant. Caller number, editable label and client-supplied
keys are never ownership evidence. The present default-deny/unbound context is
not operational attribution. Production security/HA, capacity, operational launch
and joint backup/restore remain with their later owners. The [c evidence matrix](../status/p3-u5c-evidence.md)
records the parent and Phase 3 gate independently from a/b child completion.

An explicit reconciliation can fail before the original pending physical intent is
consumed. A later canonical recovery therefore traverses immutable predecessor
links (at most 128, with strictly decreasing sequence, matching node/installation
and reviewed baseline), resolves them oldest first and checks the actual pending
operation ID. It never substitutes the newest SQL row for an older physical intent.
The current explicitly authorized recovery establishes the baseline for failed
reconciliation ancestors; no candidate apply is replayed. On affirmative final
proof, one canonical transaction marks every still-unknown/failed ancestor recovered
and appends each corresponding audit action. Pins remain retained. An unavailable,
misordered or over-bound ancestry remains unresolved with no bypass.

Reconciliation also checks the current originating operator authority after the
quiet wait, before any restoration effect, after probes and before opening the
barrier. Canonical revocation during the wait retains denial and uncertainty. A
fresh authorized audited intent can resolve that predecessor chain. Mere session
expiry remains independent of committed execution authority.
