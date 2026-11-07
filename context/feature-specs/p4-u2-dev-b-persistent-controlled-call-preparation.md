# P4-U2-DEV-b — Persistent controlled-call preparation

**Status:** planned; implementation not started.
**Prepared:** 2026-11-07 (Asia/Manila, +08:00).
**Parent:** [P4-U2-DEV — Persistent tenant calling](p4-u2-dev-persistent-tenant-calling.md).
**Split:** adopted by the user on 2026-11-07; dependent environment decisions remain open.

The parent owns common policy, AC-01–12 and final completion. This child owns
persistent manifest/participant preparation and its restart/cleanup lifecycle.

## Goal and expected result

Approved controlled cases and bounded call participants remain available to the
ordinary console after test commands finish and normal services restart. Trusted
setup can be inspected, repeated, stopped or reconciled without duplicate resources,
credential leakage or automatic calls. Setup availability remains separate from
tenant runtime readiness and temporary draft verification grants.

## Starting state and dependencies

Start ordinary deployment after [a](p4-u2-dev-a-retained-pbx-profile-upgrade-and-recovery.md)
passes its compatible-runtime/recovery handoff. Use the existing
[tenant verification contract](../../docs/architecture/tenant-routing-verification.md),
canonical manifest tables, native serial queue, constrained SIP adapter and protected
provider custody. Fixtures that seed synthetic credential metadata remain test-only.

Resolve parent DEV-02 for exact manifest, destinations/owners and participant
process/volume/network placement, and DEV-03 for intended tenant/resource changes,
before deployment or provisioning. Prepare reviewable definitions first. Recheck
DEV-01's delivered profile compatibility rather than reopening its resolved choices.

## Scope and required behavior

- Provide trusted, bounded preparation with explicit target and request identity,
  safe preview/status and supported reconciliation. Validate installation/node,
  tenant/resource/claim/permission versions, source identities, allowed destinations,
  responsible owner, required versus acceptance-only cases and custody references.
  Resolve conflicts without repurposing existing claims or silently retargeting cases.
- Establish approved labelled resource prerequisites through existing canonical
  workflows; complete credential/profile work before allocation where guards require
  it. c completes the full owned route graph and application. Share exact resource
  identities across both steps; never fabricate missing version/credential facts.
- Retain immutable case provenance. Define bounded supersession/disable behavior
  through supported contracts when intent changes; exact reruns recover prior setup
  outcomes. Handle concurrent repeats and ambiguous commit before creating anything
  again. Do not duplicate routing truth in files or a second database.
- Use real provider-backed credential generations and scoped named-custodian access.
  Verify exact custody without logging material. Expiry/revocation/unavailability
  exposes a blocker; no synthetic ordinary credentials, secret copying into HTTP,
  root recovery or unrequested rotation of retained endpoint material.
- Keep participants within approved source/port/call-leg limits and existing native
  dispatch ownership. Check source/port collisions and RTP/media compatibility with
  the [user-tested reference](p4-u2-dev-persistent-tenant-calling.md#user-tested-asterisk-configuration-reference).
  No additional public listener, external/PSTN/emergency destination, general command
  API or new deployment service without the applicable explicit decision.
- Provide start/status/stop/restart behavior. No preparation, restart, read or health
  operation places calls or renews grants. Restart requires current runtime proof
  before dispatch availability and retains unknown work/results. Stopping prevents
  new controlled dispatch, drains/defer active work naturally and preserves cases,
  desired state and audit. Availability may be reported while readiness remains stale.
- Existing tenant detail lists only safe approved cases with truthful unavailable
  reasons. Preserve existing platform authority, no-store reads, mounted recovery,
  CSRF and responsive accessible controls. HTTP selects existing case UUIDs; it
  cannot supply destinations, material, SQL, native commands or raw SIP.
- Define exact cleanup ownership and retained-resource inventory. Grant revocation
  and participant stop do not prove loaded-path removal. Implement/document the
  reviewed apply/absence-proof integration used by c; retain pinned resources when
  safe removal is blocked. No wholesale tenant deletion or volume pruning.

## Acceptance criteria

| ID   | Observable result                                                                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Target-bound preview/setup validates the approved exact manifest and ownership/version/custody facts. Wrong, stale, excessive or incompatible inputs reject without partial unauthorized provisioning; source/port conflicts are explicit blockers.                                            |
| B-02 | Exact reruns and concurrent repeats recover one durable setup outcome; changed payload conflicts. Lost acknowledgements and interrupted provisioning have an exact supported reconciliation path without duplicate cases/resources.                                                            |
| B-03 | Real provider-backed generations and exact material custody work for the ordinary installation. Missing/expired access blocks safely, no synthetic credential rows are inserted and no secret/provider transport reaches HTTP/Next or safe reports.                                            |
| B-04 | Approved cases/participants survive completed test commands and normal restart, and are visible through ordinary tenant detail. Setup/start/status/restart/read places zero calls and renews no grant or evidence timestamp. Fresh ownership/proof gates dispatch; unknown work stays blocked. |
| B-05 | Stop/drain, participant/native loss and unavailable dependencies prevent new unsafe dispatch without terminating active calls or replaying prior calls. Process/volume/network ownership and private source/port bounds match the approved manifest.                                           |
| B-06 | Reviewed cleanup tooling/instructions retain canonical history and unrelated data, enumerate intentional resources and distinguish stopped participants from removed loaded paths. Actual path-removal proof is completed with c's applied runtime.                                            |
| B-07 | Protected console reads expose only eligible safe cases and truthful blockers; wrong-plane/CSRF/input/secret-injection regressions and affected keyboard/reflow/recovery checks pass. Preparation commands, status/recovery instructions and safe evidence are published.                      |

Parent coverage: AC-04; setup/lifecycle portions of AC-07–09/11/12. Final actual
calls, grant denial, loaded-path removal and complete parent AC-09 stay with c.
This child does not claim readiness from provisioning alone.

## Required verification

Define actual Docker preparation/preview/status/start/stop/reconcile commands during
implementation; these commands do not exist yet. Keep read-only inspection explicit
and independent of mutating setup. Use real PostgreSQL, protected provider access,
shared Redis and normal private HTTPS consumers. Rehearse partial/concurrent setup
and restart faults in isolated fixtures before touching approved ordinary resources.

Verify persistence by completing acceptance commands and then independently opening
the ordinary console, restarting approved participants through normal service
lifecycle, and confirming the same canonical cases and exact custody facts remain.
Passive socket/media observation must prove no calls from preparation/restart/reads.
Actual call success is verified by c using this persistent setup.

Run `./dev exec pnpm check:tenant-routing --live`,
`./dev exec pnpm check:tenant-routing --browser`, affected
`./dev exec pnpm check:extension-inventory`, `./dev exec pnpm check:trunk-gateways`,
allocation/binding and platform/staff authority checks, and `./dev check`.
Changes to native execution/custody additionally require full
`./dev exec pnpm check:pbx-revisions`; do not substitute reduced modes.
Run sequentially and confirm normal health/HTTPS/retained-runtime integrity.

## Completion and handoff

Complete b after B-01–07 pass, DEV-02/03 decisions and actual permitted setup are
recorded, persistence/restart proof passes and only declared resources have changed.
Publish safe command/result/provenance and cleanup/reconciliation evidence in
`docs/status`; update the tracker, development/verification runbooks and affected
architecture contracts. Do not mark parent AC-09 fully passed before actual c cleanup.

Hand [c](p4-u2-dev-c-ordinary-console-calling-and-integrated-acceptance.md) exact
installation/profile/tenant/resource/case identities, custody/source/port ownership,
case requirements, availability, known blockers and safe stop/restart/reconcile
instructions. c must use these persistent participants, not replace them with a
disposable acceptance environment.
