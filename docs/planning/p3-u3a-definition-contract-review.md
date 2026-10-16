# P3-U3a — Trunk and gateway contract review for approval

Prepared 2026-10-16 (Asia/Manila, +08:00). **Draft; no product decision or
implementation is approved by this document.**

Requirement: [P3-U3a](../../context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md),
[parent gates G-01/G-03/G-04 and AC-01–11](../../context/feature-specs/p3-u3-trunks-gateways-and-dids.md).
Read under [AGENT.md](../../AGENT.md) and its six required context documents.

## 1. Recommendation and approval boundary

**Recommend approving the proposed G-01 and a-scoped G-04 policies below for
controlled private development, with a staged G-03 decision.** Start independent
IP-peer definitions only after explicit approval. Hold authenticated definitions
until a real protected binding owner and exact-reference contract are approved.
Do not declare all of a complete while its authenticated-binding acceptance is
outstanding. This is a proposed staging choice inside a, not a replacement for
the adopted a → b → c sequence or an approved reduction of acceptance criteria.

A trunk represents an external SIP service connection. A gateway represents a
trusted inbound source. This permits a standalone hardware gateway and shared
outbound provider trunks without forcing every gateway to have a trunk.

| Decision | Recommended policy | Approval consequence |
| --- | --- | --- |
| U3A-01 / G-01 meanings | `sip-peer` trunks with explicit inbound/outbound/both direction; `sip-provider` or `sip-device` inbound gateways; zero or one trunk per gateway, zero or many gateways per trunk | Establishes resource and relationship semantics in section 3 |
| U3A-02 / G-01 compatibility | Revisioned deployment-approved connection and source selections; initial UDP/RTP private-development profile, fixed safe fields and exact IP sources | Establishes sections 3–4; installs no listener and authorizes no external traffic |
| U3A-03 / G-03 independent scope | Initial authentication `ip-peer`, credential binding `not_required`; reject password/registration modes until their separate contract exists | Allows independent work; authenticated A-04 remains pending |
| U3A-04 / G-03 authenticated scope | Require an identified protected material owner and exact versioned binding before accepting any authenticated definition; use section 5 as the decision checklist | This recommendation alone does not approve a provider, owner implementation, token, supplied-secret flow or authenticated API |
| U3A-05 / G-04 portion | Create disabled/version 1; immutable IDs/node/kind/direction and initial structural selections; permit name and qualified desired-status changes | Establishes section 6; removal and later structural adoption remain separately gated |

Suggested scoped approval wording:

> Approve U3A-01, U3A-02, U3A-03 and U3A-05, sections 3–4 and 6, for controlled
> private development. Proceed with independent IP-peer definitions using the
> technical and verification contracts in sections 7–9. Keep authenticated
> definitions and full P3-U3a completion pending U3A-04's concrete binding review.

If authenticated trunks are required in the first implementation increment,
resolve section 5 first instead of using this staging option. Neither choice
is inferred from silence. G-02 DID policy, b's removal policy, browser delivery,
PBX apply, calls, tenant allocation/readiness and production remain with their
owners. The parent explicitly assigns these product decisions to the user;
this review requests decisions rather than recording approval.

## 2. Requirements checked and evidence limits

| Required starting point | Repository finding | Effect |
| --- | --- | --- |
| Verified P3-U1 | [Integrated evidence](../status/p3-u1c-evidence.md) records C-01–07/parent AC-01–11, protected registry, canonical installation identity and real-service checks | Reuse its identity/authority/receipt patterns; recheck affected behavior during implementation |
| Existing inventory patterns | [Inventory contract](../architecture/extension-inventory.md) and `InventoryStore` expose transaction-bound node/capability/version patterns | Reuse patterns, without making endpoint profiles authoritative for trunks |
| Current secret owner | [Endpoint credential contract](../architecture/endpoint-credentials.md) grants OpenBao access only to the dedicated endpoint lifecycle | No established trunk reference selector/binding owner was found in the inspected telephony files/contracts |
| Current resources | Telephony source/contracts contain registry, observation, inventory and endpoint credentials; no canonical trunk/gateway APIs were found | New domain contracts and persistence are needed; no delivered trunk behavior is claimed |
| Future dependency facts | Routing, allocations and configuration revisions belong to later owners | Unknown structural/status safety must reject; no empty adapter or speculative future tables |

This is a source/document review, not a fresh execution of previous acceptance
checks. Existing evidence retains its original environment and limitations.
No PBX, provider, session, database or service state was changed for this review.

## 3. Resource model and relationships — proposed G-01

| Fact | Trunk | Gateway |
| --- | --- | --- |
| Meaning | External SIP service connection, with no tenant allocation or outbound permission implied | Approved inbound source identity, with no tenant route implied |
| Kind | `sip-peer` | `sip-provider` or `sip-device`; no analog driver/hardware provisioning |
| Direction | Required `inbound`, `outbound` or `both`; no default | Fixed `inbound` |
| Connection | Exact deployment connection selection/revision | Exact deployment source selection/revision, including its signaling/media profile |
| Relationship | May have multiple gateways with disjoint approved sources | Optional single `trunkId`; provider gateways require it, device gateways may be standalone |
| Authentication initially | `ip-peer`; no password and no registration | `ip-peer`; binding `not_required` |

A linked gateway must use the same canonical node, compatible profile and
canonical external peer as an inbound-capable trunk. An outbound-only trunk
cannot be an ingress parent. A standalone device gateway needs its own approved
source/peer selection. A gateway cannot link to another gateway. A trunk never
owns an independent competing inbound-source selector: its gateways own ingress.
An inbound trunk without a gateway may be saved disabled as incomplete desired
work; enabling it requires at least one eligible gateway. Enabling a linked
gateway requires its trunk enabled. Disabling a trunk with enabled gateways
rejects until those gateways are disabled explicitly.

Names are 1–80 characters after trimming outer ASCII spaces (maximum 320 raw
characters); reject controls and malformed Unicode. Reserve case-insensitive
ASCII-normalized names per canonical node/resource type, including disabled
records; reject non-ASCII names initially to make normalization deterministic.
Names are labels and never configuration section names.

IDs are server UUIDs. Node/installation association is immutable; equivalent
registry aliases share one namespace. Generate separate internal resource keys
from installation/resource UUIDs with reserved `ims-tr-` and `ims-gw-` prefixes;
clients cannot select keys. Enforce unique attribution in PostgreSQL and review
coexistence before P3-U5 installs anything. Preserve all unmanaged/reference
objects. Do not import, adopt or rename them here.

## 4. Connection, profile and source rules — proposed G-01

Introduce a telephony-owned, deployment-maintained non-secret selection contract,
following the registry/capability ownership pattern. This is proposed new work,
not an assertion that the existing management catalog already supports trunks.
Persist immutable selected snapshots/revisions in the owning desired contract;
a catalog update cannot silently alter saved definitions.

| Setting | Initial recommended policy |
| --- | --- |
| Selection | Canonical installation, peer UUID, connection/source UUID and positive immutable revision; safe aliases resolve to these exact facts |
| Destination | Deployment supplies exact remote IP and SIP port 1–65535; operator chooses a selection, never supplies a host, URL, port or CIDR |
| Ingress | Deployment supplies 1–16 exact IPv4/IPv6 host addresses; canonicalize address equivalence; no wildcard, subnet, hostname, header, username or caller-ID matching |
| Signaling/media | Initial `udp` and `rtp` only for controlled private development; no registration; no implicit TLS/WebRTC compatibility |
| Audio | Ordered nonempty unique subset of `[ulaw, alaw]`, default `[ulaw, alaw]` |
| Media behavior | Direct media false, symmetric RTP true, force rport true; no per-request override |
| Capability | Explicit installation-qualified resource capability revision permits kind/direction/profile/source; missing declaration is unavailable, never assumed from AMI health |
| Deployment bounds | At most 100 connection/source selections per installation, each at most 16 source addresses; catalog at most 64 KiB; reject malformed/duplicate/revision-redefined entries |

These are proposed product limits for desired data. UDP/RTP is a private-development
choice, not a production security decision. Actual destinations must be reviewed
and populated by deployment before dependent valid-operation acceptance. Examples
below use documentation-only identities/addresses and grant no network access.
Do not copy reference credentials, broad bridge ingress or contexts into defaults.

Reserve each canonical source address across all gateways on one installation,
including disabled definitions and alternate aliases. Do not distinguish ingress
by transport, source port or display name in this first policy. Database uniqueness
on installation/address prevents replica races; reject an entire overlapping
source set atomically. Conflicts with known unmanaged/deployment-owned sources
also reject; missing deployment source-coverage declaration blocks selection.
This declaration qualifies desired validation only; P3-U4/U5 must verify actual
trusted runtime attribution and coexistence before apply.

Multiple outbound trunks may select one provider destination with different
explicit purposes/names; this confers no independent ingress claim. Multiple
DIDs may later share one gateway if G-02 permits it. Two gateways cannot claim
the same source even when they refer to different provider accounts. More complex
shared-IP discrimination requires a later explicit policy revision.

| Example | Expected result |
| --- | --- |
| Outbound `sip-peer` trunk selecting approved peer A, UDP/RTP, IP-peer auth, disabled | Valid; no gateway or credential required |
| Enabled inbound/both trunk A with an enabled `sip-provider` gateway using peer A and a disjoint approved source set | Valid after ordered desired-status changes; no routing or live claim |
| Standalone disabled `sip-device` gateway selecting approved source `192.0.2.10` | Valid without a trunk; address is illustrative only |
| Provider gateway without trunk; gateway linked to outbound-only or wrong-node trunk | Reject |
| Two gateways use `192.0.2.10` through different aliases, including a disabled first gateway | Conflict; first reservation remains |
| Two outbound definitions use peer A without creating new ingress claims | Valid shared-provider case |
| Submitted password, arbitrary SIP URL, caller-ID selector, raw context, `sourceKey`, tenant ID or claimed ready status | Reject unknown/forbidden input |
| Digest authentication or outbound registration selected initially | Reject unsupported mode; do not silently downgrade |

## 5. Authenticated references — G-03 remains a specific approval gate

IP-peer mode means no material is required. It must report
`credentialBinding={kind:'not_required'}` rather than configured, available or
registered. Reject any credential field in that mode.

For authenticated definitions, the following decisions and artifacts are still
required before dependent code. They cannot be derived from endpoint approval:

| Required decision | Recommendation / resume artifact |
| --- | --- |
| Authentication modes | Review outbound SIP digest and any registration as separate explicit modes; do not presume inbound digest or mutual TLS is covered |
| Existing material | Identify the actual protected owner and an existing trunk-specific material inventory; none is established by this review |
| Safe selection | Owner-issued opaque binding UUID plus exact immutable generation/version, qualified to installation, peer and authentication purpose; no arbitrary provider paths or client existence claims |
| Establishment | Protected owner verifies exact material association outside business transactions; only canonical committed owner metadata can establish a selectable binding |
| Commit qualification | Resource mutation locks/revalidates owner eligibility/version on the same transaction; stale, wrong-node, removed or incompatible bindings reject |
| Safe availability | Distinguish `missing` (binding absent), `unavailable` (owner cannot qualify), and `bound` (exact desired association only); neither proves material delivery, live registration or revocation |
| Access and recovery | Document provider/path ownership privately, process ACLs, deadlines, durable ordering, retries, uncertain effects, reconciliation, generation retention and cleanup before approving external work |

If the owner requires new provisioning, rotation, provider identities or supplied
material handoff, refine an additional focused lifecycle child under the parent's
conditional refinement before authenticated resource/browser work. Do not extend
endpoint worker tokens or create a nominal always-successful reference service.
If a genuinely existing reference owner is identified, review its exact contract
and real boundary evidence instead. HTTP, Next and ordinary workers receive no
material/provider token under either initial or pending policy.

A-04's authenticated selection/binding and missing/unavailable checks remain
unmet until that decision and implementation are verified. Partial approval here
must not be reported as full G-03 resolution or full a completion.

## 6. Desired lifecycle — proposed a-scoped G-04

Creation uses explicit server default `disabled`, version 1, immutable IDs and
ISO timestamps plus canonical creator/updater attribution. Desired status is
`enabled` or `disabled`; neither establishes connected/applied/ready state.
No removal endpoint is added in a; disabling retains identities and reservations.

Allow display-name edits and qualified status transitions with expected version.
Keep kind, direction, selected connection/source revision, codecs, node and trunk
association immutable in this initial increment. Structural PATCH attempts reject
rather than replacing a selected definition. Approval of this policy deliberately
limits initial edits; if structural adoption is needed, review its dependency
coverage before exposing it. Future compilation consumes exact saved versions.

Status checks include owned relationships and narrow owner-provided dependency
facts. Unknown required applied/in-flight/rollback/allocation safety rejects.
Canonical never-applied/unallocated provenance can qualify only when backed by
real controlled ownership paths, not the absence of future tables. A no-op after
successful version/authority validation preserves version/audit. Stale versions
reject even if requested values now match. Any real change increments once with
one business audit in the same transaction.

## 7. Proposed technical API, retry and concurrency contract

These are implementation recommendations under the approved product policy.
Record the final interfaces in owner architecture documentation before consumers.

Route root `/platform/pbx-nodes/:nodeId`:

| Method/suffix | Request / result |
| --- | --- |
| GET `/resource-selections` | Bounded safe deployment choices/revisions and capabilities; no material/provider location |
| GET `/trunks`, `/gateways` | Separate typed paginated lists |
| GET `/trunks/:trunkId`, `/gateways/:gatewayId` | Canonical typed detail |
| POST `/trunks`, `/gateways` | Immutable create intent plus typed definition and expected dependency revisions |
| PATCH `/trunks/:trunkId`, `/gateways/:gatewayId` | Expected version plus display name |
| PATCH `/trunks/:trunkId/status`, `/gateways/:gatewayId/status` | Expected version, desired status and relevant expected relationship versions |

Strict create DTOs contain `requestId`, `displayName`, allowed kind/direction,
exact connection/source selection, allowed codec subset, `authenticationMode`,
optional qualified `trunkId` and applicable dependency tokens. Initial status is
server-owned. UUIDs normalize lowercase. Reject unknown nested/body/query fields,
unsafe Unicode/controls and configuration fragments. Cross-node IDs return safe
404. Expose no arbitrary configuration or credential input. Return 201 on new
create, 200 on original-result replay, reads, edits and status changes.

Safe detail includes canonical IDs, name/kind/direction, pinned safe selections,
relationship/version, desired status, binding dimension, version/timestamps and
actor references. Applied/readiness are `not_established`; resource observation
is `not_available`. Selection metadata and DTOs exclude provider locations, raw
configuration and secret material. They never infer health from node contacts.

| Bound / outcome | Proposed contract |
| --- | --- |
| Input/results | Existing 4096-byte JSON write ceiling; detail/list/selection results at most 64 KiB; immutable create receipt at most 16 KiB |
| Queries | Only `limit` and UUID keyset `after`; default 25, max 100; stable immutable UUID ordering; node and resource IDs required by route |
| Errors | 400 fixed field validation (including unsupported modes); 404 missing/wrong-node; 409 `name_conflict`, `source_conflict`, `request_conflict`, `stale_version`, `dependency_changed`, `dependency_blocked`, `intent_expired`; 503 `dependency_unavailable` or safe database/session/commit-uncertainty outcome |
| Existing transport | Preserve established 401/403/413/429 behavior; retryable 503 includes `Retry-After: 1`; at most 10 safe error/blocker details plus total/truncated |
| Receipt | Operator/action/request UUID scoped; canonical SHA-256 fingerprint including normalized selections and expected revisions; same-key/same-input returns original safe receipt without new audit |
| Retention | 30-day receipt lifetime using database time; retained expired intents reject; deployment-only pruning after expiry; audit/history retained |
| After pruning | No same-key guarantee remains; canonical review required before a new creation attempt. Never automatically resubmit an expired intent |

Check original receipts after current authority/node qualification but before
current mutable dependency validation, so exact replay survives later edits.
Changed key reuse conflicts. Dropped COMMIT acknowledgement is uncertain: exact
intent retry or canonical review only. Uncertain edits require reload/review.
Required data, relationship reservations, receipt, version and audit commit or
roll back together. Runtime grants deny migration, receipt rewriting and audit
mutation; no speculative outbox job is needed for passive desired saves.

Proposed common lock order: canonical authority → scoped create intent when
present → canonical node → deployment selection/capability rows → trunks sorted
by UUID → gateways sorted by UUID → source reservations sorted by address.
Gateway create/status and trunk status use the same order. Source uniqueness and
restrictive node-qualified foreign keys remain database-enforced. b must extend
this order for DID relationships/removal without reverse resource acquisition.
Document exact transaction-aware locks, versions, eligibility and dependency
coverage/unknown outcomes for b; do not let consumers query private tables.

Use current platform-cookie authority, exact trusted channel/peer/Origin, CSRF,
shared admission and no-store on every response. Mutations revalidate canonical
authority inside their transaction. Passive reads never renew sessions, start
observers or perform network/secret work. PBX downtime alone permits safe desired
operations; PostgreSQL/Redis failure denies protected work without local fallback.

## 8. Acceptance and implementation resume checklist

| a criterion | Required proof / present disposition |
| --- | --- |
| A-01 | Explicit approval recorded for applicable gates; final routes/DTOs, bounds/errors, retention and b/c handoffs published. This document is a proposal only |
| A-02 | Real PostgreSQL/runtime grants, valid trunk/standalone and linked gateway examples, disabled/alias/source/name races, wrong-node and injection rejection |
| A-03 | Independent HTTP A/B same-intent concurrent replay, changed/expired reuse, committed-response loss, stale edits, relationship/status races and forced audit/constraint rollback |
| A-04 | Initial `not_required` is verified; authenticated exact binding/missing/unavailable/process isolation and required real-provider evidence remain pending section 5 |
| A-05 | Real platform/staff/revoked/expired sessions on A/B; forged facts, CSRF/Origin/channel/no-store, bounded passive reads and database/Redis outage denial |
| A-06 | Offline PBX desired operations, no network/secret/live effects, exact-version invalidation, b transaction/dependency ports and unknown safety rejection |
| A-07 | Focused real-service checks, affected registry/inventory/auth/durability regressions, full Docker graph, evidence/runbook/index/tracker and owned fixture cleanup |

After approval, synchronize the child/owner contracts and tracker with the exact
approved scope before schema/validation code. Recheck existing interfaces and
baselines, define deployment selections/capabilities, and establish
`./dev exec pnpm check:pbx-resources --definitions`. **That command is proposed,
does not exist yet and has no passing result.** Use real PostgreSQL/runtime grants,
shared Redis, independent HTTP A/B and deterministic barriers/fault fixtures.
Run the affected documented PBX/inventory/platform-auth/durability modes and
`./dev check`; record actual commands, real versus injected boundaries and cleanup.
No PBX write, reload or call is required for definition acceptance.

b receives IDs/versions, eligibility, relationship/dependency locks and retry/error
contracts. c receives safe DTOs, named API routes and canonical uncertainty recovery.
P3-U4/U5/P4 retain routing, trusted attribution, apply/rollback and tenant readiness.
Do not mark a or the parent complete from staged IP-peer API delivery.

## 9. Review verification

Documentation-only review: check local links, whitespace, consistency with parent
and child gates, and A-01–07 coverage. No runtime tests were run or claimed for
this preparation. Approval remains pending; no provider access or deployment
change was requested or performed.
