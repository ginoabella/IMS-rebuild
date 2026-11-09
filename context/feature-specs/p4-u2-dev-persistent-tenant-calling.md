# P4-U2-DEV — Persistent tenant calling in the development environment

**Status:** partially implemented; children a/b are complete with approved retained deployment and dedicated setup, c remains planned and parent acceptance is incomplete.
**Prepared:** 2026-11-07 (Asia/Manila, +08:00).
**Requirement:** development deployment follow-up to [P4-U2](p4-u2-allocate-inventory-and-verify-tenant-routing.md), supporting the [Phase 4 journey](../implementation-plan.md#phase-4--onboard-tenants-and-enable-tenant-administration).
**Authorization:** the user requested the feature specification, then adopted the
three-sub-unit split and requested the child specifications on 2026-11-07
(Asia/Manila, +08:00). The user subsequently requested a's implementation and
approved its preserved-profile strategy and conditional quiet maintenance effects.
DEV-02/03 dedicated setup was subsequently approved on 2026-11-08 (+08:00), with
the exact resource/destination and existing-helper placement in the
[b review](../../docs/planning/p4-u2-dev-b-preparation-review.md). Child b completed B-01–07 on 2026-11-09 (+08:00);
[actual preparation evidence](../../docs/status/p4-u2-dev-b-evidence.md). Parent
acceptance and child c remain incomplete. See also the
[recorded DEV-01 decision](../../docs/planning/p4-u2-dev-a-profile-transition-review.md#recorded-dev-01-decision).

## Goal and expected result

A platform operator uses the ordinary private development console to configure,
apply and verify two draft tenants on the existing retained Asterisk installation.
Approved controlled cases remain available after acceptance commands exit and
after normal service restarts. An explicit console action places an actual bounded
SIP call, observes the destination and bidirectional RTP, and retains exact evidence
under the existing tenant-routing contract. No disposable acceptance server must
remain running to make the normal operator journey work.

This delivers persistent verification capability, not permanently valid readiness
or unrestricted calling. Grants still expire within 30 minutes, evidence ages and
invalidates normally, and ordinary draft calls/staff sign-in stay denied.

## Sources and starting state

Read [project context](../project-overview.md), [architecture](../architecture.md),
[UI conventions](../ui-context.md), [code standards](../code-standards.md),
[workflow](../ai-workflow-rules.md) and [tracker](../progress-tracker.md).
Reuse the [revision/recovery contract](../../docs/architecture/pbx-revisions.md),
[tenant verification contract](../../docs/architecture/tenant-routing-verification.md),
[approved controlled-call policy](../../docs/planning/p4-u2c-live-policy-review.md),
[P4-U2 completion evidence](../../docs/status/p4-u2c-evidence.md) and
[manual guide](../../docs/guides/p4-u2-manual-testing.md).

The 2026-11-07 inspection of the ordinary environment found:

| Fact                         | Observed state                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Retained node                | `bcb9d21c-96cd-4975-bd68-314b588a23a9`                                                          |
| Installation                 | `58adb785-5384-41ce-9c72-ccda6ea554db`                                                          |
| Installed policy/compiler    | `deny-unbound-1` / `review-2`; retained runtime verified                                        |
| Health/access                | Backend live/ready 200; platform/staff HTTPS ready                                              |
| Retained runtime             | Exact protected/loaded match; zero channels; no pending operation                               |
| Tenant state                 | Two voice-enabled drafts; three retired tenants                                                 |
| Routing configuration        | Four claims; zero route authorizations, controlled cases, test intents or tenant runtime proofs |
| Loaded prerequisites checked | `res_agi`, `func_channel`, `res_pjsip_header_funcs`, `bridge_simple` absent                     |

These are historical observations to recheck before deployment, not target IDs or
counts to hardcode into business logic. Claims must be inspected for current
state/ownership; their count does not establish four eligible allocated endpoints.

P4-U2a/b/c remain complete within their recorded scope. Their actual SIP/RTP tests
used disposable installations and synthetic endpoint material, then cleaned up.
`scripts/prepare-pbx-live.mjs` includes newer module prerequisites for prepared
profiles but is not a safe retained-profile migration. All retained static `.conf`
bytes participate in the unmanaged digest; rerunning preparation or loading modules
by hand does not establish valid upgrade/recovery provenance.

## User-tested Asterisk configuration reference

On 2026-11-07 (Asia/Manila, +08:00), the user identified
[`reference/asterisk_config/`](../../reference/asterisk_config/) as a working
configuration already tested in this environment. Treat that as user-reported
working evidence and a required compatibility input. It is not a claim that this
session reran its calls or that those files equal the retained managed runtime.
Preserve the original reference bytes; do not deploy the directory wholesale.

Record a sanitized comparison of the reference, current retained static profile
and proposed upgraded profile before implementation effects. Relevant observed
settings include:

- `modules.conf`: `autoload=yes`, with `bridge_native_rtp.so` excluded to keep
  Docker extension-to-extension media anchored in Asterisk; other excluded modules
  remove unused database/export/audio backends. Translate needed capabilities to
  the managed profile's explicit module policy rather than copying autoload.
- `rtp.conf`: RTP `10000–10100`, `strictrtp=no`. The retained development publication
  remains `10020–10039`; document actual media/binding behavior and justify any
  proposed difference. This reference does not itself authorize broader exposure.
- `pjsip.conf`: UDP and WebSocket transports, external-address placeholders,
  `direct_media=no`, symmetric RTP and NAT/contact handling. Resolve actual topology
  through deployment configuration; preserve trunk-specific differences instead
  of applying one global contact rewrite rule.
- `extensions.conf` and the SIP reference also contain local-user, gateway and
  public-WebRTC paths. Use their working transport/media behavior as compatibility
  evidence; tenant ownership, explicit permissions and draft admission must still
  come from generated canonical configuration. Reference endpoints, numbers and
  gateway addresses do not become approved test destinations or tenant authority.

Do not copy reference passwords/AMI credentials into the spec, reports or generated
client payloads. Use existing exact-material custody. Verify the selected SIP/audio
behavior with actual controlled calls and record any deliberate deviation from the
working reference, including its reason and regression result. WebRTC/public voice
paths remain outside this follow-up's acceptance.

## Scope and boundaries

- Extend existing trusted deployment tooling, Docker configuration and native
  execution boundary with explicit retained-profile preflight, upgrade and recovery.
  Keep the existing canonical installation/node and shared services as the target;
  any replacement-installation alternative requires DEV-01 resolution below.
- Provide persistent development configuration and lifecycle commands for exact
  controlled manifests and call participants, using the existing native serial
  queue and constrained SIP adapter wherever possible. Persist canonical cases in
  the existing telephony model; keep secrets in existing protected custody.
- Configure approved resources through existing platform workflows: eligible
  extensions, profiles/credentials, allocation, complete owned inbound graphs and
  explicit outbound route/trunk permissions. Complete credential/profile work before
  allocation where current guards require it. Never override guards with fixture SQL.
- Use existing capture/review/validate/apply, draft grants, test/reconcile, readiness,
  recovery and retirement/release workflows. Add UI/API behavior only where needed
  to expose a truthful preparation blocker or complete this journey.
- Publish a repeatable ordinary-console walkthrough and deployment runbook,
  including safe manifest identifiers, start/status/stop/reconcile, provider access
  maintenance, cleanup and verified rollback instructions.

No new platform identity, duplicate routing catalog, general SIP destination editor,
provider credential delivery to HTTP/Next, or unrestricted PBX command endpoint.
No automatic calls on setup, startup, restart, page reads or readiness polling.
Existing ordinary workers cannot place calls. The implementation must declare the
process/volume/network ownership of persistent participants before deployment;
adding a separate deployment service is a decision, not an incidental test change.

P4-U3 activation/lifecycle, P4-U4 staff management, P4-U5 assignments, P5-U3 operational
call ingestion, desktop/browser softphone support, external trunks/PSTN/emergency
destinations, production rollout and backup-operation repair are outside this unit.
P4-U2-DEV does not claim that controlled draft calls establish ordinary staff calling.

## Required behavior

### Retained-profile transition and recovery

Preflight records canonical identity, current/initial/known-good artifacts and
recovery ancestry, protected bytes/digests, profile/module capabilities, pins,
custody references, owner epoch, active calls and unknown/pending work. Compare
exact expected versions/digests immediately before effects. Drift, missing custody,
missing recovery data or unavailable safety proof blocks the transition.

Define an explicit profile transition retaining both old and new static bytes and
their association with every recoverable artifact. Historical artifacts keep their
original compiler/policy and unmanaged digest. Never rewrite their bytes, clear
pins or recapture the initial baseline to bypass verification. If current recovery
cannot restore the old profile with its artifact, extend that contract under DEV-01
before changing the retained configuration. Ordinary revision rollback alone must
not be presented as static-profile rollback.

Use canonical/native fencing and affirmative quiet proof; defer for active calls
or unknown activity, without forced hangup. Recheck quiet state at the effect
boundary. Make interruption before/after static selection, restart, native proof
and canonical acknowledgement recoverable by exact operation reconciliation.
An uncertain transition remains blocked; startup must not declare the target
verified or blindly repeat effects. Prove both upgrade and restoration on an
isolated copy first, then execute the reviewed ordinary transition. Required
recovery targets must remain demonstrably usable throughout.

### Persistent manifests and call participants

Trusted preparation validates an exact installation/node, two tenant UUIDs,
resource/claim/permission versions, source identities, case/destination allowlist,
responsible owner and custody references. Cases have immutable provenance;
changed intent creates new cases and disables superseded admission through the
supported contract. Exact reruns reuse their prior result; conflicts and ambiguous
commits require inspection/reconciliation rather than duplicate provisioning.

Use current adapter limits as the starting proposal: private ingress `127.0.0.2`,
trunk sink `127.0.0.4:20000–20100`, one extension or a one-member owned group with
hangup fallback and timeout at most 15 seconds, at most two legs and a 30-second
dispatch deadline. These addresses are inside the Asterisk environment. Establish
port/source coexistence with retained gateways and endpoints before selecting them.
Do not silently broaden host bindings, RTP publication or RTP source checks.

Persistent tooling must use real provider-backed credential generations and exact
material verification for the ordinary installation. The synthetic credential
metadata writers in `scripts/prepare-tenant-routing-fixture.mjs` remain test-only.
Expired provider access is a visible blocker; use the existing named-custodian
replacement path without silently rotating stored endpoint material.

Start/stop/status operations preserve canonical cases, desired resources and audit.
Restart restores availability only after fresh ownership/runtime proof; it never
renews grants, refreshes old result timestamps, clears unknown work or places calls.
Stop disables new controlled dispatch and drains/defer active work naturally.
Removing loaded verification paths requires reviewed apply and actual absence proof;
stopping a participant or revoking a grant alone cannot claim that cleanup.

### Normal console acceptance

The ordinary console lists the approved cases for each tenant. An operator completes
owned allocation and route configuration, captures a new `tenant-routing-1` /
`tenant-review-1` revision, reviews the diff and applies it through existing custody
and native fencing. Fresh independent proof and exact current validation must precede
any eligible grant/test; an old `review-2` artifact cannot count as tenant proof.

For each draft, an explicit bounded grant authorizes only selected manifest cases.
Run one installation-wide test at a time. Prove inbound destination and outbound
source for each extension exposed as verified, not merely one call per tenant while
presenting every claimed endpoint as ready. Required cross-tenant, unallocated,
unpermitted, unknown/ambiguous and stale-source cases deny through actual SIP.
Transport errors are unknown/failed evidence, never proof of authorization denial.

Retain actual destination, bidirectional media observation and exact provenance.
Readiness follows existing generation, authority, semantic-change and 24-hour age
rules, plus grant expiry/revocation. Show unavailable, stale and unknown blockers.
Exact lost-response recovery must not redial. Ordinary draft traffic remains denied.
After restart, require fresh proof and any newly necessary explicit grants/calls.

## Decisions before dependent implementation

Creating this spec does not resolve the following environment-policy decisions.
Existing P4-U2 policies remain approved within their original isolated scope.
Routine implementation choices that preserve that scope do not need new approval.

| ID     | Decision and recommendation                                                                                                                                                                                                                                                                                                                                                                                     | Required before                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| DEV-01 | Approve a versioned transition of the retained static profile with exact old/new profile custody, artifact-compatible recovery and a defined maintenance window. Recommend preserving the existing node/installation and original baseline; design/rehearse that path first. If it cannot preserve recovery, present an explicit replacement-installation/migration proposal rather than silently rebaselining. | Any retained static configuration mutation, module-load effect or restart for the upgrade. |
| DEV-02 | Approve persistent controlled participants and their exact ordinary-environment manifest, resource/destination owners and execution placement. Recommend reusing the existing private adapter limits and container boundary, with no additional public ports or automatic traffic. Identify any necessary deployment component separately.                                                                      | Installing persistent participants/cases or dispatching ordinary-environment calls.        |
| DEV-03 | Identify whether to use the two existing voice-enabled drafts and eligible stock or labelled dedicated development tenants/resources. Recommend dedicated resources on the existing installation where number/source/port checks allow it; inspect the four current claims without repurposing them implicitly. Record exact allowed canonical changes and restoration/retention expectations.                  | Provisioning, binding or applying tenant test resources.                                   |

The user authorized parent and child specification preparation. Policy proposals above are
review inputs, not an approval request to stop this documentation work. Before
implementation crosses a decision boundary, present its concrete reviewed result
and resolve only decisions not already authorized in the session.

## Acceptance criteria

| ID    | Required observable result                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Read-only preflight identifies the exact retained target and all recovery/custody/safety prerequisites. Wrong target, drift, active/unknown work and unavailable dependencies block effects without changing state.                                                                                                                                                                                                                                     |
| AC-02 | Reviewed static-profile upgrade succeeds on the retained installation after isolated rehearsal. Original bytes/history/baseline and every required recovery target remain intact; actual loaded module capabilities and protected configuration match the new recorded profile. Sanitized comparison with the user-tested Asterisk reference explains module/media/NAT differences, and selected SIP/audio behavior passes actual compatibility checks. |
| AC-03 | Actual upgrade interruption and explicit rollback/reconciliation restore a coherent old or new profile/artifact pair. No false verification, blind effect replay, pin deletion, forced hangup or silent rebaseline occurs.                                                                                                                                                                                                                              |
| AC-04 | Persistent preparation is bounded, idempotent and target-bound; conflicting/uncertain setup has a truthful recovery path. Real credential custody is verified; manifests and participants survive completed checks and normal restarts without synthetic credential rows in ordinary storage.                                                                                                                                                           |
| AC-05 | Both tenants have non-overlapping eligible allocations, complete owned inbound graphs and explicit outbound permissions. Ordinary HTTPS capture/review/validation/apply installs an exact tenant-aware revision and establishes fresh runtime proof.                                                                                                                                                                                                    |
| AC-06 | Actual console-triggered inbound and outbound SIP/RTP succeeds for both tenants with independent destination/media observation. Every extension exposed as verified carries its own current required evidence.                                                                                                                                                                                                                                          |
| AC-07 | Actual required negative SIP cases deny. Ordinary draft calls/sign-in remain denied; grant expiry/revocation, semantic changes, stale evidence and dependency/authority loss cannot promote readiness. Unexpected permitted isolation blocks the shared runtime under the existing contract.                                                                                                                                                            |
| AC-08 | Lost responses, participant/native restart and owner loss never redial or silently clear unknown work. Existing exact recovery/reconciliation remains usable; status/read operations cause no calls or mutations.                                                                                                                                                                                                                                       |
| AC-09 | Persistent setup start/stop/restart and reviewed cleanup are documented and proven. Required cases remain reusable without a disposable runner. Loaded-path removal is independently verified, unrelated data stays intact and intended retained changes are enumerated.                                                                                                                                                                                |
| AC-10 | Existing retirement/release safeguards still defer for calls/unknown state; a dedicated installed-resource transfer preserves history/recovery and produces fresh new-owner proof with stale-old-owner denial.                                                                                                                                                                                                                                          |
| AC-11 | Existing HTTPS authority, CSRF, no-store reads, owner-bound recovery, keyboard/accessibility and narrow-screen behavior pass. No credentials, raw SIP, SQL administration or arbitrary destinations enter HTTP/Next or reports.                                                                                                                                                                                                                         |
| AC-12 | Focused deployment checks, affected/full regressions and actual ordinary-console acceptance pass with safe evidence, before/after preservation results and operator/U3/U5/P5 handoffs. The documentation distinguishes usable setup, current readiness and future ordinary calling.                                                                                                                                                                     |

## Split assessment and adopted implementation order

**Three sequential sub-units adopted by the user on 2026-11-07 (Asia/Manila, +08:00).**
The profile transition has an independent
recovery contract and maintenance effects; persistent participants have a separate
provisioning/restart lifecycle; final ordinary-console proof depends on both.
One large unit would hide which boundary is safe or still incomplete. Each
unit below has its own observable outcome. Their completion does not substitute
for the parent's live acceptance. Children a/b are complete with approved retained deployment
and DEV-02/03 preparation; c remains planned.

| Unit        | Goal and scope                                                                                                                                                                                                                               | Dependencies and decisions                                                                                          | Acceptance and handoff                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4-U2-DEV-a | Retained PBX profile upgrade and verified recovery: preflight, versioned transition/custody, compatible recovery, isolated interruption rehearsal and reviewed ordinary upgrade. Existing browser apply must still work or truthfully block. | Existing P3-U5/P4-U2 contracts; DEV-01 before ordinary effects.                                                     | AC-01–03 and applicable AC-11/12; hand off exact profile/artifact compatibility, loaded capabilities, preserved recovery and runnable upgrade/status/reconcile/rollback instructions.                               |
| P4-U2-DEV-b | Persistent controlled-call preparation: trusted manifests, real credential references, bounded participants, idempotent setup/status/stop/restart and cases visible in normal tenant detail.                                                 | a's verified compatible runtime; DEV-02/03 before deployment/provisioning.                                          | AC-04/09 and setup/restart portions of AC-07/08/11; hand off actual approved tenant/resource/case IDs, custody/port ownership, availability and restart/cleanup behavior. No live readiness claim from setup alone. |
| P4-U2-DEV-c | Ordinary-console two-tenant calling and integrated acceptance: desired graph completion, capture/apply, grants/calls, negative isolation, recovery, transfer and final runbooks/evidence.                                                    | a/b passing; exact approved manifest, healthy custody/runtime, approved resources and unchanged P4-U2 draft policy. | AC-05–08/10–12 plus integrated reconciliation of AC-01–04/09; hand off reproducible manual workflow and current exact readiness/verified-extension evidence to U3/U5.                                               |

The implementation specifications, in dependency order, are:

1. [P4-U2-DEV-a — Retained PBX profile upgrade and recovery](p4-u2-dev-a-retained-pbx-profile-upgrade-and-recovery.md): A-01–06.
2. [P4-U2-DEV-b — Persistent controlled-call preparation](p4-u2-dev-b-persistent-controlled-call-preparation.md): B-01–07.
3. [P4-U2-DEV-c — Ordinary-console calling and integrated acceptance](p4-u2-dev-c-ordinary-console-calling-and-integrated-acceptance.md): C-01–08.

Each child defines its outcome, scope, decisions, acceptance, required verification
and handoff. Publish actual new command names/arguments during implementation;
the specs distinguish existing regression commands from tooling that does not exist.
Do not add children to the completed P4-U2a/b/c
sequence or change those units' historical acceptance. Prefer finishing this follow-up
before ordinary-environment P4-U3 activation acceptance; code-level lifecycle planning
can still proceed independently where it does not depend on unproved live readiness.

## Required verification and evidence

Documentation preparation requires formatting, local links/anchors, acceptance to
split coverage, source/contract consistency and whitespace checks only.

Implementation must introduce a short documented Docker verification entry point
with separate read-only preflight, isolated rehearsal and explicit approved retained
deployment/acceptance modes. The delivered commands are documented in the
[profile runbook](../../docs/runbooks/development-container.md#retained-pbx-profile-transition-and-recovery)
and [preparation runbook](../../docs/runbooks/persistent-controlled-calls.md).
Child c still owns ordinary-call and integrated acceptance. Keep passive checks separate from mutations.
Use the Docker workspace and existing shared PostgreSQL/Redis/HTTPS services.

Before ordinary effects, retain the sanitized reference/current/proposed profile
comparison, including anchored-media behavior and any RTP/NAT differences, then
rehearse profile upgrade/rollback and process/SQL/result-loss
boundaries on an isolated copy, including active-call deferral, concurrent owner/
apply/recovery attempts and exact restart reconciliation. Then verify the approved
ordinary transition and real console calls with independently observed media and
destinations. Label actual process/network behavior separately from injected faults.

Run sequentially the existing `./dev exec pnpm check:tenant-routing --live` and
`./dev exec pnpm check:tenant-routing --browser`, affected allocation/binding,
draft-tenant, inventory/provider, trunk/gateway, routing, full PBX revision/native/
interruption/provider/isolation and platform/staff authority checks, and `./dev check`.
Retain required existing modes; disposable passes supplement ordinary acceptance.

For ordinary preservation, inventory affected rows/configuration/custody first;
require exact preservation of unrelated data and old immutable artifacts, while
enumerating intended additions/changes. Do not require obsolete global fingerprints
to match deliberate approved provisioning. Adapt the retained-baseline checker to
the approved profile transition without weakening exact protected/loaded verification.
Check `./dev health`, platform/staff HTTPS and retained-runtime safety afterward.

Retain a sanitized command/result ledger and acceptance mapping in `docs/status`,
including approvals, exact target/profile/artifact/tenant/case/test identities,
timestamps, cleanup, recovery rehearsal and declared limits. Protect secrets and raw
protocol material. Record a manual review as pending until actually performed;
automated HTTPS proof cannot fill in the user's manual result cells.

Complete P4-U2-DEV only after AC-01–12 pass in the approved ordinary environment.
Update the tracker, architecture/recovery contracts, development runbooks and manual
guide to reflect the delivered setup. U3 receives current readiness for its separate
lifecycle gates; U5 receives individually verified ownership/version/test facts;
P5-U3 still owns authenticated operational ingestion. No Phase 4 or production gate
is completed by this follow-up alone.

## DEV-01 implementation decision — 2026-11-07 (+08:00)

The user approved the [retained-profile strategy and conditional maintenance
effects](../../docs/planning/p4-u2-dev-a-profile-transition-review.md#recorded-dev-01-decision)
in this implementation session. Preserve the same node/installation and original
baseline, exact old/new static custody and artifact-compatible recovery. Quiet
maintenance effects are authorized only after remaining durable-transition and
recovery rehearsals pass. Those conditions were fulfilled: child a completed
A-01–06 and its verified retained deployment; see the
[final evidence](../../docs/status/p4-u2-dev-a-evidence.md). DEV-02/03 were subsequently approved and child b completed its
[actual ordinary preparation acceptance](../../docs/status/p4-u2-dev-b-evidence.md).
Child c and integrated parent acceptance remain incomplete. Approval alone does
not substitute for runtime proof.
