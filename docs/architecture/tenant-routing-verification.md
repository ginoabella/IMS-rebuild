# Tenant routing verification contract

P4-U2c completed within approved private development, 2026-11-05 (Asia/Manila, +08:00), under the
[approved policy](../planning/p4-u2c-live-policy-review.md). Acceptance is recorded in
[the evidence record](../status/p4-u2c-evidence.md). This contract does not establish
production readiness or tenant activation.

## Capture, policy and runtime custody

The [revision contract](pbx-revisions.md#p4-u2c-approved-tenant-capture-and-admission-extension)
extends immutable capture with `tenant-routing-1` snapshot/policy and
`tenant-review-1` compiler versions. Allocation rows retain claim UUID, owner,
installation/node, extension, state and version. Authorizations retain their UUID,
version, owner/classification, resource UUID and evaluated dependencies. Tenancy's
invoker-rights SQL port supplies safe status/voice/configuration/authority versions
in the same statement snapshot. Bounded collections reject overflow; capture does
not truncate a successful revision. Safe review/diff/validation and actual pins
include these facts. Historical `review-2`/`deny-unbound-1` snapshots keep their
original meaning and never become tenant calling evidence.

Renderer contexts and source identities are generated from immutable UUIDs.
Tenant endpoint contexts filter explicitly bound outbound rules before priority
selection. Disabled/stale/foreign/unpermitted winners deny without fallback.
Ingress identifies a canonical shared gateway from its exact approved source
addresses, then requires an exact tenant-owned DID/rule and complete owned graph.
Catch-alls, unknown sources and unallocated endpoints do not grant tenant paths.
Numbers, labels, SIP caller ID and client tenant headers never select ownership.

The existing native helper holds the physical flock and shares one bounded serial
queue between apply/recovery, runtime proof, controlled tests and retirement.
A fixed unprivileged AGI client can ask only the local admission socket whether
one path is permitted. It receives no material, database credentials, arbitrary
commands or provider access. Native admission holds the canonical node SHARE lock
while capturing the graph atomically and checking current primary authority,
ownership, installed artifact, semantic digest, owner epoch and fresh independent
runtime proof. Its final one-shot nonce consumption atomically rechecks grant
expiry/revocation, current runtime generation and tenancy-owned facts. Draft admission
consumes one exact manifest-bound dispatched test nonce under a current grant.
Active tenants use the same one-shot test path when a test nonce is present,
without a draft grant. Ordinary active calls retain canonical source/permission
checks. A wrong or replayed test nonce cannot fall through to ordinary admission.
Call-result completion locks the canonical node and requires the exact owner epoch.
A new owner retains old physical receipts but records them as unknown, never current
success, until explicit safety reconciliation; it never redials them.
Failure or uncertainty leaves the dialplan's initialized denial in place.

`routing_generation` changes on relevant canonical runtime transitions and owner
epoch changes, including failed attempts/recovery and retirement. Heartbeat refresh
alone does not change it. Grants, test intents and native proofs bind that exact
generation. Results retain the original physical completion time when reconciling
a lost SQL acknowledgement. No later reconciliation refreshes old evidence age.

## Protected operator API

All routes use canonical platform cookies, platform-operator authority, strict
UUIDs and exact Origin/CSRF for POST. HTTP/Next have no native/provider transport.
Named Next forwarding rejects unknown fields, bearer substitution and queries.
Bodies are at most 4 KiB; successful projections are at most 64 KiB. Reads are
passive and no-store. Errors contain finite reasons and no protocol/material data.

`/platform/tenants/:tenantId/telephony/:nodeId`:

- GET returns explicit readiness/blockers, current artifact/revision, at most 16
  deployment-approved cases, ten grants and 25 recent tests. Exact test provenance,
  expected/observed outcome, destination UUID and current/stale applicability remain
  distinct. Voice-disabled is `not_required`; missing voice intent is incomplete.
- POST `grant`: `{requestId,artifactId,caseIds}` with 1–16 distinct approved cases.
  Only a canonical draft tenant on the current applicable verified artifact may
  receive the nonrenewing 30-minute grant. No staff sign-in/lifecycle change occurs.
- POST `revoke`: `{requestId,grantId}`. Append revocation; never rewrite a grant.
  Revocation/expiry stops new admission and invalidates evidence. Explicit reviewed
  apply and actual absence proof own removal of loaded verification paths.
- POST `test`: `{requestId,artifactId,caseId,grantId}`. `grantId` is null only where
  ordinary active-tenant authority suffices. Commit immutable attributed intent,
  initial progress, audit, exact receipt and outbox notification atomically.
  One queued/dispatching/admitted/unknown test per installation blocks another.
- POST `reconcile`: `{requestId,testId}`. Reconcile unknown activity only after
  actual fenced quiet proof; never dispatch/redial or invent a successful outcome.

Write lock order is operator, operator/request, tenant, canonical node. Exact
30-day receipts recover the original outcome; changed payload conflicts and
expired request IDs never become new attempts. Native consumes committed intent
directly. Ordinary workers record notification receipts and cannot place calls.
A lost dispatch response remains unknown; explicit operator reconciliation and
absence of actual activity are required before a new attempt.

Readiness requires current validation/apply/proof, exact generation and source
facts, required successful inbound/outbound evidence and all approved case results.
Maximum evidence age is 24 hours. Pending/unknown operations, failed/stale evidence,
authority loss, drift and unavailable dependencies cannot promote readiness.
Readiness is separate from registration and U3 lifecycle decisions.

## Controlled adapter boundary

The first trusted adapter supports the owner-approved isolated Docker fixtures:
actual SIP authentication/ingress, destination answer/termination and bidirectional
RTP on fixed private loopback identities inside disposable Asterisk. Trunk sinks
must be `127.0.0.4`, ports 20000–20100; ingress uses the exact approved
`127.0.0.2` source. An inbound case admits one extension directly or a one-member
owned group with hangup fallback and a timeout of at most 15 seconds. The maximum
is two call legs and a 30-second dispatch deadline. SIP transport uncertainty is
not authorization denial. Natural completion preserves existing calls.

Manifest cases are deployment-owned immutable rows; HTTP can select safe case
UUIDs but cannot create destinations, hosts, credentials or raw protocol actions.
The fixture publishes safe installation/node/tenant/case/artifact facts before
calls. Its endpoint material metadata is explicitly synthetic. Real exact-provider
custody remains a separate required existing revision mode; synthetic material is
not evidence of provider integration. No external trunk/PSTN/emergency call,
production environment or general call ingestion is included.

The owner's reference RTP configuration is 10000–10100 with `strictrtp=no`.
Ordinary bootstrap/publication remains the existing loopback 10020–10039 range;
the reference informs media diagnosis without changing ordinary exposure.

## Narrow retirement and release

GET `/platform/pbx-nodes/:nodeId/artifact-retirements` returns 25 recent operations.
POST accepts `{requestId,artifactId,replacementId,resourceId,reconcileId?}`.
`resourceId` identifies an existing extension omitted from the replacement's actual
runtime dependencies. A reconciliation explicitly identifies the current unknown
retirement and repeats the reviewed exact artifact/replacement/resource tuple.

Retirement rejects installed/current/known-good and initial baseline artifacts,
in-flight/required recovery-chain targets and a replacement that still references
the extension. Under the canonical node lock and native physical queue, verify
actual quiet state, required retained recovery bytes and exact replacement runtime.
Write/fsync the native recovery tombstone before canonical audited pin release.
Persist the dispatch owner epoch before native effects. If the executor exits
after dispatch, a subsequent executor records unknown and retains pins; it never
silently redispatches that intent. An explicit reviewed reconciliation creates a
new intent, proves actual quiet state and retained recovery safety, and completes
the audited release under its current fenced epoch.
Keep artifact bytes and immutable ownership history. Retired targets reject at both
canonical admission and native plan loading. Unknown work retains pins and the
operation marker until reviewed reconciliation. No pruning, material destruction
or forced termination is introduced.

Release still rechecks desired/group/binding references, assignments, installed/
in-flight/rollback pins and unknown runtime/test/retirement state through the
canonical dependency port. Disabling or unbinding desired resources alone never
clears old pins. Retire only the exact superseded blockers, then use the existing
versioned release/allocation APIs. Old revisions, claims and test receipts retain
their original owner after reallocation. U5 assignment writers are not implemented;
only the declared dependency/constraint port can be verified here.

## Downstream consumers

U3 consumes current readiness and explicit `enabled`/`disabled`/`not_configured`
voice semantics for its separate activation/lifecycle rules. U5 consumes canonical
owned extension/permission selection and dependency ports; registration alone is
insufficient. The backend-only `InventoryRuntime.evidence` implements
`TenantRoutingEvidencePort.snapshot/read`; `read` composes with a consumer's primary
transaction. It returns readiness and exact runtime provenance, plus only allocated
extensions with current successful inbound destination and outbound source proof.
Each selection carries extension/claim versions, both test IDs and the exact trunk
permission ID/version. Tenant readiness does not prove every allocation was tested.
U5 must recheck selection and dependency ports under its canonical locks; this read
port grants no assignment, lifecycle or ordinary-call authority. P5-U3 must authenticate ingress and preserve exact generated source,
revision, installation and original claim/authorization provenance. No current-owner
lookup may retarget a late historical event to a new tenant.

The deployment manifest distinguishes required readiness cases from acceptance-only
isolation/failure cases. Positive inbound and outbound current proof is always
required for voice-enabled readiness; marking cases optional cannot remove that
rule. A current unexpected permitted isolation attempt blocks readiness. Expiry,
ordinary-draft, ambiguity and stale-source acceptance cases never fabricate
positive evidence. Operators may choose a shorter grant lifetime (1–1800 seconds);
exact retry never extends the original expiry.

An unexpected permitted isolation result blocks all voice-enabled tenants on the
same exact node/artifact/generation. Grant removal, a later inconclusive retest and
pagination of recent results cannot erase that failure. A reviewed runtime change
requires fresh evidence. Test state reflects comparison with the manifest while
the immutable result retains the actual permitted/denied outcome and destination.
