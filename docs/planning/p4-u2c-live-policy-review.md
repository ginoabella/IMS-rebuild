# P4-U2c live routing policy review

Prepared 2026-11-04 (Asia/Manila, +08:00). **Owner-approved in chat, 2026-11-04 (Asia/Manila, +08:00).**
The owner approved the ALLOC-04/05/final ALLOC-06 proposals below and instructed
implementation to continue. Approval establishes policy, not implementation or
acceptance. Concrete live target identities must still be recorded before calls.

The [child spec](../../context/feature-specs/p4-u2c-verified-tenant-routing-and-integrated-handoff.md)
requires resolution of [ALLOC-04/05/final ALLOC-06](../../context/feature-specs/p4-u2-allocate-inventory-and-verify-tenant-routing.md#decisions-required-before-dependent-implementation).
The request to implement the spec starts the unit; the spec explicitly leaves
these product and environment decisions open. Existing a/b approvals remain in
force, including shared gateways, exclusive tenant DIDs/rules/groups, explicit
outbound permissions and denial without fallback.

## Observed implementation boundary

- `captureSnapshot` currently captures infrastructure in one SQL statement, with
  allocation/binding/permission eligibility explicitly unavailable.
  `RevisionSnapshot` uses `review-2` and `deny-unbound-1`. Preserve this historical
  interpretation when adding a versioned tenant-aware contract.
- The canonical `TenantRouteEligibility` port supplies consistent desired facts;
  it establishes neither live admission nor verified readiness.
- The [P3-U5 runtime contract](../architecture/pbx-revisions.md) retains installed,
  in-flight and rollback pins. Canonical completion releases pins only for an
  affirmatively rejected revision with no artifact. Superseding a verified
  artifact therefore does not currently enable installed-resource reallocation.
- [Integrated P3-U5 evidence](../status/p3-u5c-evidence.md) proves bounded synthetic
  development calls and recovery. It explicitly does not prove tenant calling or
  authorize unrestricted destinations. Reuse its custody and physical fencing.

## Approved ALLOC-04 — Controlled tests and current evidence

Use the existing private-development Asterisk profile and isolated, run-owned
acceptance fixtures. Keep ordinary retained data and the verified baseline intact.
Before any call, record an owner-approved manifest identifying the exact
installation/node, two tenant UUIDs, controlled authenticated endpoint/ingress
identities, exact destination allowlist and responsible destination owner. Keep
credentials in existing protected custody; safe references alone enter evidence.
The concrete manifest is still missing; existing probe numbers are not approval.

Permit only operator-triggered inbound and outbound tests plus explicitly reviewed
negative isolation cases. Allow one test at a time per installation, maximum
two call legs, a 30-second call deadline and natural completion; no forced hangup,
public/emergency/PSTN destinations or arbitrary AMI/CLI controls. Deadline expiry
leaves the intent uncertain and blocks conflicting work until reconciliation.
Use actual authenticated SIP ingress and independently observed destination results;
local-channel resolver probes alone cannot prove ingress isolation.

Commit actor/request-bound intent before dispatch and never automatically redial
an uncertain dispatch. Reconcile the original attempt using trusted runtime facts;
if its outcome cannot be proved, retain unknown. A new attempt requires explicit
operator review after prior activity is proven absent. Exact duplicate requests
recover the same result; changed intent conflicts.

Use a 24-hour maximum evidence age, using server time, with immediate
invalidation for relevant allocation/binding/permission/resource/credential or
tenant authority changes, verification-grant expiry/revocation, installation or
artifact changes, pending/unknown work, drift, failed apply or unavailable safety
facts. Require current positive inbound and outbound results for each voice-enabled
tenant, matching exact validated/applied/verified provenance. Required negative
cases must pass the integrated acceptance matrix. Registration is separate.
Voice-disabled means voice not required; `not_configured` remains incomplete.

## Approved ALLOC-05 — Explicit temporary draft verification

Require an audited operator grant for one draft tenant, exact installation,
reviewed artifact and manifest endpoint/destination subset. Use a maximum
30-minute nonrenewing lifetime. Neither tenant existence nor voice preference
creates a grant. Staff sign-in and ordinary draft traffic remain denied.

The trusted boundary must enforce grant expiry before each test admission,
including after owner restart and during dependency outages. Client clocks and
stale compiler bytes cannot extend admission. Stop new admissions on expiry,
revocation, semantic change or loss of authority; allow existing bounded calls to
finish naturally and retain unknown activity as a blocker. Remove verification
paths through an explicit reviewed apply, verify their absence and record cleanup.
Expiry alone cannot claim successful removal from loaded configuration. These
controls must be proved against real Asterisk before enabling draft tenant paths.
No production verification mode or tenant lifecycle action is proposed.

## Approved final ALLOC-06 — Explicit superseded-artifact retirement

Desired-only release remains as approved. To prove reallocation of previously
installed stock, implement a narrow, separately reviewed retirement operation for
an exact superseded artifact. This changes recovery eligibility within the approved narrow boundary.

Retain immutable artifact bytes, ownership history and provenance. Retire only
recovery eligibility and associated pins after all checks pass under the canonical
node lock and native fence: the artifact is neither installed, verified current,
known-good, initial baseline, in flight, pending nor referenced by any retained
recovery chain; a reviewed verified replacement omits the retiring resource;
required recovery targets remain usable; actual active-call state is affirmatively
quiet with admission fenced. Unknown state or unavailable dependencies defer.
No resource/material deletion, general pruning or forced call termination.

Before coding, extend the child boundary with acceptance for atomic audited
retirement, duplicate/lost-response recovery, native/SQL interruption, concurrent
recovery/apply/release, rejection of retired recovery targets and preserved
required rollback targets. No pins may clear before affirmative durable native
and canonical agreement. Then rerun desired/assignment/runtime dependency checks
for release and a new allocation; late original provenance retains its original
owner. Future assignment-writer races remain an explicit U5 limitation.

## Approval and continuation

The owner approved all three proposals in chat. Record the protected manifest
for real controlled ingress/endpoints/destinations and permitted access before
call dispatch. The owner also supplied `reference/asterisk_config/rtp.conf`:
RTP 10000–10100 with `strictrtp=no`. The current development bootstrap uses
10020–10039 with matching loopback Docker publication. The reference informs
media debugging; changing host publication or weakening RTP source checks is
not necessary for capture and must be justified by actual controlled media checks.

After resolution, synchronize the authoritative parent/child policy and architecture
contracts before dependent code. Deliver capture/compiler, protected apply,
verification/readiness and retirement/reallocation as one integrated operator path.
Define the short integrated Docker command during implementation; no new runnable
verification command exists yet. Run all child-required actual API/browser/live,
concurrency, affected regression and full checks, preserve ordinary runtime and
publish exact acceptance evidence. C-01–08 and parent completion remain open.
