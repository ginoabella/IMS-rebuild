# Fenced PBX observation

P3-U1b implements the [conditionally approved local policy](../planning/p3-u1b-observation-contract-review.md).
The upstream AMI observer account has `system` action permission and is **not
strictly read-only at the PBX**. Only the application adapter's fixed Login,
Logoff, Ping, PJSIPShowEndpoints and PJSIPShowContacts actions are reachable.
No arbitrary action, CLI, control, originate, reload or configuration method is
exposed by the observation port, API or engine. Production deployment/security,
HA, multi-PBX capacity and operational settings need separate approval.

## Replaceable boundary and process composition

`application/observation-ports.ts` owns `PbxObservationAdapter`,
`PbxObservationSession`, `ObservationStore` and `PbxOwnership`. The adapter opens
an approved profile with an opaque credential alias and cancellation signal;
it returns a session providing bounded complete registration snapshots, finite
failures, a transport-ended signal and close. No protocol command argument,
credential or raw event crosses that port. Engine, SQL store, HTTP projection
and future UI depend on these contracts rather than AMI message structure.

AMI framing, TLS verification, action allowlist, provider resolution and
registration-event ordering live in `adapters/observation`. Production can
replace this adapter/provisioning with an approved stricter PBX interface or
security boundary while preserving ownership, persistence and DTO semantics.
No additional coordination service exists. HTTP wires the atomic registry hook
and passive projection only; ordinary workers retain their existing delivery
composition. Only the independent telephony entry point starts an observer.
It requires explicit `approved-local-development` activation and fails safely
without protected runtime configuration and database access.

## Ownership, transactions and retained state

One `pbx_ownership` row per canonical node persists epoch metadata permanently.
Acquisition increments the epoch and uses database-time expiry; concurrent
contenders serialize on the desired node. Renewal requires matching incarnation,
epoch, current desired version and unexpired lease. Expired renewal fails;
reacquisition increments the epoch even for the same process. Release changes
only the matching incarnation/epoch; it never removes epoch metadata or releases
a successor. Runtime cannot delete lease or observation rows, change node keys, override initial epoch metadata or perform DDL. Column-scoped grants and the generation trigger also reject unexpired takeover and expired same-epoch renewal through direct SQL.

All ownership/observation mutations follow registry → observation → ownership
row locking. `fenced(token, callback)` checks incarnation, epoch, desired version
and expiry on the same `Transaction` used by the callback, then checks expiry
again before commit. Publication also checks its local cancellation signal before
and after the callback/SQL fence, rolling back queued healthy writes or intents
if renewal/transport loss cancels them while database authority is still valid. Required-write failure poisons/rolls back the transaction.
Observation sequences advance by one within an epoch; duplicate/older writes
and gaps reject. The engine relinquishes a rejected generation and reacquires
a complete snapshot rather than applying a delta across a gap. Queued consumers must invoke the same fence on their application
transaction. The acceptance-only consumer/outbox fixture proves this boundary;
there is no speculative shipping realtime consumer.

The registry's installed `ObservationDesiredChanges` hook creates coordination
rows in the create transaction. Connectivity edits clear current ownership and
invalidate the projection in the version/audit transaction; old-version writes
reject after commit. Name-only changes requalify matching versions without
replacing ownership. In-flight prior-version snapshots reject and reconcile
under the current version. If discovery races an edit before acquisition, the
engine releases a token whose version differs from the discovered descriptor
and reloads before any connection. Authority and audit failure roll back the entire edit.

`pbx_observations` stores one latest bounded projection per node. A complete
snapshot replaces all previous registrations, including obsolete facts and an
explicitly empty collection. Partial/error/overflow snapshots never replace
facts. Failure/reacquisition retains last-known facts as historical and requires
reconciliation. No indefinite raw event history, caller/media/recording data,
contact URI/address, user agent, auth name or tenant ownership is stored.

## Registration, ordering and freshness

Supported coverage is PJSIP dynamic contact presence and contact status;
registration does not mean voice readiness or tenant attribution. Static contacts
cannot prove a dynamic registration. Endpoint identifiers remain unmapped, never
creating inventory or ready extensions. Facts contain only a bounded ASCII endpoint identifier (128 characters),
registered flag, dynamic-contact count and reachable-contact count.

The adapter correlates each list with a distinct ActionID, validates bounded
frames/list counts and requires complete snapshots. Older ActionIDs are ignored;
duplicate entries, missing completion, unknown list events/count gaps, overflow
and registration-change notifications during acquisition reject the snapshot.
It reconnects/resnapshots rather than assuming an event order it cannot prove.
Only the pinned version's exact authenticated `No endpoints found` and
`No Contacts found` responses represent authoritative empty lists; all other
errors remain failures. See the pinned
[endpoint source](https://github.com/asterisk/asterisk/blob/22.10.1/res/res_pjsip/pjsip_configuration.c)
and [contact source](https://github.com/asterisk/asterisk/blob/22.10.1/res/res_pjsip/pjsip_options.c).

List/detail reads use database time to derive age and current ownership without
starting observers or renewing sessions. `freshness` is `unknown` without a
successful snapshot, `stale` at the 30-second threshold, `current` only for the
matching desired version/current epoch/unexpired owner/reachable complete
snapshot within that threshold, otherwise `historical`. Connection,
reconciliation, ownership, coverage, failure and age remain separate DTO fields.
A reachable complete empty collection differs from unavailable/unknown data.
Transport loss wakes idle observation immediately. Renewal uncertainty/database
loss/edit/expiry/shutdown cancels I/O and blocks local publication; conditional
SQL remains the final guard for a paused process. Reacquisition always reconciles.

## Development resource limits and material access

Validated settings: freshness 30s; cadence 5s; lease 15s; renewal 3s; database
connect/statement/lock 2s each; DNS/connect/login/query 2s each; complete snapshot
8s; four concurrent node sessions, one snapshot per node; retry 1/2/4/8/10s
(maximum, one attempt per cycle while active); drain 5s; forced credential
reconnect 60s; frames 16KiB; snapshot stream 1MiB; 1,000 endpoints/4,000 contacts.
Relationships and hard cardinality limits are validated before startup.

Every connect/reconnect resolves current protected credentials and validates
DNS answers against the approved catalog, pinning the actual socket address and
verifying TLS service name/CA. Missing/inaccessible provider material has finite
sanitized states with no retained credential fallback. No protocol payload or
provider exception text is logged. Failed nodes cannot block healthy-node loops.

The explicit Compose observation overlay mounts the runtime credential/CA only
into telephony and server key/account only into Asterisk. The general workspace
masks `.local/pbx-observation` with a private empty tmpfs; backend/worker mounts
omit it. The development CA signing key stays root-owned. The explicit isolated Asterisk logger profile excludes AMI notice messages containing authentication identifiers; MyIMS retains finite sanitized system/node/epoch diagnostics. Production security monitoring is separately unapproved. Trusted deployment
and the acceptance harness alone provision/test protected material. Acceptance
fixtures use private stdin/IPC and process-private mode-0600 files, then remove
those files. No secret is supplied to HTTP children, APIs, ordinary workers or
web applications. Evidence separates fixture privileges from runtime grants.

## P3-U5 and c handoff

c consumes `PbxObservationDto` through protected existing list/detail endpoints,
with explicit current/stale/historical/unknown semantics and separate coverage.
Saving desired state never establishes health. Browser delivery is described in the [PBX browser contract](pbx-browser.md).

P3-U5 must reuse the ownership port and same-transaction fence for persisted
work, but **a pre-call database check cannot revoke an already issued external
PBX command**. External stale-epoch enforcement, ordered revisions and active-call
policy are required before live apply. No mutating PBX adapter is wired in b;
its observation/outbox tests do not establish live apply safety.

## Inventory consumer — P3-U2c

The [inventory browser](extension-inventory-browser.md) composes this same passive
projection inside its primary inventory read snapshot. It matches only exact
persisted endpoint/auth/AOR consistency bindings qualified by canonical node and
installation, reading one node projection per bounded page. Covered current
presence, zero contacts and endpoint absence remain distinct; other coverage,
age, desired-version, epoch or ownership conditions remain unknown. The consumer
never connects to AMI, starts an observer, discovers inventory ownership or
verifies a selected profile/credential generation. Browser elapsed time uses a
monotonic clock only to demote old facts. No projection or observation policy is
replaced by this composition.
