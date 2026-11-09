# Persistent controlled-call preparation review

Prepared 2026-11-08 (Asia/Manila, +08:00). **DEV-02/03 approved by the
requesting user on 2026-11-08 (+08:00): “Approve the dedicated setup”.** Child
[b](../../context/feature-specs/p4-u2-dev-b-persistent-controlled-call-preparation.md)
was incomplete when this decision was recorded; B-01–07 subsequently passed on
2026-11-09 (+08:00), with [actual outcomes](../status/p4-u2-dev-b-evidence.md).
The following starting facts and proposed definitions are the historical approval
record. The approval covers the dedicated resources, existing native
helper placement and scoped provider access below. It does not establish a test
pass or authorize automatic calls, unrelated resource changes or parent completion.

## Inspected starting point

Passive inspection at 2026-11-08 05:13–05:17 +08:00 found:

| Fact | Observed value |
| --- | --- |
| Node / version | `bcb9d21c-96cd-4975-bd68-314b588a23a9` / 1 |
| Installation | `58adb785-5384-41ce-9c72-ccda6ea554db` |
| Current artifact | `e6ee0b86-da28-4ba9-bf42-a6c6e985c341` |
| Profile digest | `f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8` |
| Compiler / policy | `review-2` / `deny-unbound-1`; no tenant-runtime readiness |
| Native / canonical epoch | 13 / 13 |
| Routing generation | 7 |
| Profile compatibility | Exact protected/loaded match; all ten required modules loaded |
| Recovery | Original baseline and both historical profiles available; 20 pins retained |
| Activity / outstanding work | Zero channels; no pending revision/profile/retirement/test |
| Provider | Installation GET-only access available; no associated endpoint material to verify |
| Existing tenant resources | Two voice-enabled drafts; four allocated claims; 21 disabled SIP extensions, all without credential generations |
| Existing authorizations / cases | Zero / zero |
| Existing trunk / gateway | One of each; neither uses the proposed private controlled sink/source |

Existing allocated claims are:

| Tenant | Claim | Extension | Number |
| --- | --- | --- | --- |
| `f802894b-f9e6-47a1-9edb-0e3b5772c025` | `998fd624-53c6-40f7-8fdb-1dcb2150c9ee` | `1fc0f843-543a-4a13-b973-a8f808d599eb` | 1000 |
| `f802894b-f9e6-47a1-9edb-0e3b5772c025` | `86fa8470-e9e3-4759-92fa-74d8ff173adf` | `af91cf1b-d8f6-4f00-b5d4-0088fde658ae` | 1001 |
| `225d21bd-516e-4bbb-a3c0-c0673b92eec0` | `9c065559-7f24-4229-85e1-5f340dcace96` | `cf8a0436-b73e-4759-9f12-03443d579780` | 1010 |
| `225d21bd-516e-4bbb-a3c0-c0673b92eec0` | `af8e184f-3b69-41f9-a261-c13b05c1fd76` | `3431c98c-44f3-4eb8-9e11-61108908d4f3` | 1011 |

Each claim and extension is version 1. Allocation prohibits changing their
credential generation/profile. Using these drafts would require an explicit
release/reprovision/reallocation decision and dependency proof; no such change is
included in the recommendation.

## Approved DEV-02/03 decision

Approve dedicated labelled resources on the same retained installation, owned by
the requesting development owner and administered through existing canonical
platform authority:

| Addition | Exact proposed intent |
| --- | --- |
| Two tenants | Codes `p4-dev-a`, `p4-dev-b`; display names `P4 controlled development A/B`; draft, voice enabled; initial administrator `controlled-admin`, with no credential exchange or activation |
| SIP profile | New labelled `P4 controlled development` profile using existing `sip-basic` template; validate actual settings/capability revision before use |
| Three extensions | `7701` for A, `7702` for B, `7703` retained unallocated for denial acceptance; real provider-backed setup before allocation, no reset of existing material |
| Gateway | Label `P4 controlled ingress`; exact private source `127.0.0.2`; shared ingress infrastructure, canonical DID/route ownership remains tenant specific |
| Trunk | Label `P4 controlled sink`; UDP `127.0.0.4:20020`, IP peer, ulaw, anchored RTP, symmetric RTP and force-rport |
| Inbound destinations | A: exact DID `5557701` to extension 7701; B: exact DID `5557702` to extension 7702; direct one-extension destinations, no fallback or multi-member graph |
| Outbound destinations | A: exact `5558701`; B: exact `5558702`; strip 0/add empty prefix to the controlled sink; distinct priorities; explicit shared-trunk classification and per-tenant permission |
| Case custody | Immutable exact setup request/outcome, responsible platform operator/version, node/installation, tenant/resource/claim/permission versions and credential operation/generation IDs in PostgreSQL |
| Execution placement | Embed lifecycle/admission in the existing physically fenced native helper inside the retained Asterisk container; no new Compose service, public listener, host port or ordinary worker dispatch |
| Network / port ownership | Existing native adapter: ingress 127.0.0.2, outbound caller 127.0.0.3, sink 127.0.0.4; trunk sink 20020 and inbound sink 20021; bind only for an explicitly dispatched call, RTP sockets ephemeral on private loopback |
| Storage | Existing canonical telephony tables and additive preparation/lifecycle provenance; existing protected native volume for receipts; existing provider custody/consumer volume; no parallel route catalog |

The candidate codes do not exist. Namespace checks found 7701–7703 free; passive
UDP/UDP6 socket inspection found 20020/20021/20022 unbound. These observations are
not reservations. Recheck number, DID/rule, source, socket and canonical version
conflicts immediately before committing/effecting setup. The source query checked
all current canonical gateways on this node; loaded-profile proof remains separate.
Bind failures must block dispatch before any SIP is transmitted.

New resource IDs, versions, capability facts, provider generations and exact
material custody **do not exist yet**. Record actual supported-workflow outcomes
under fixed request identities; a final exact manifest must resolve those outcomes
before cases become available. Never fill them with invented UUID/version facts.
b creates prerequisites; c completes bindings/permissions and applies the full
owned graph using these same resources. An incomplete graph remains unavailable.

The named custodian is the existing `platform-owner-custodian`, with the existing
protected host password and verified TLS. Reuse exact installation-scoped worker
issuance and GET-only native-consumer roles, verify actual scope/TTL and retain
material on expiry. If worker access needs replacement, prepare/review a bounded
named-custodian issuance path using existing roles, preserving issuer rules. Do
not recover root, broaden existing roles or issue synthetic credential metadata.
Approval of this proposal includes ordinary scoped access replacement needed for
these new generations; it does not authorize unrequested endpoint rotation.

## Case definitions and lifecycle to implement after the decision

Each tenant has required positive inbound destination and outbound source cases.
Acceptance-only cases cover cross-tenant sources in both directions, unallocated
7703, unknown source, unpermitted rule, ambiguous source, ordinary draft traffic,
expired/revoked grant and stale source. Resolve exact route/source/destination
identities from canonical outcomes and keep each tenant below the existing
16-case limit. No external/PSTN/emergency destination is allowed. Every call stays
within two legs, the existing inbound timeout bound and 30-second dispatch deadline.

Preparation must validate the whole approved request before resource effects,
record durable step identities, recover concurrent repeats/ambiguous commits and
reject changed payloads. Subsequent unexpected guards become visible blockers;
retain completed owned prerequisites for exact reconciliation instead of undoing
canonical history or creating replacements. Cases remain immutable; add a bounded
append-only disable/supersession contract rather than updating `enabled`, which
the current database immutability trigger prohibits.

Start/restart enables only this manifest's dispatch after current native ownership,
exact runtime proof, canonical facts and custody checks. The existing helper and
durable desired setup survive test-command exit and ordinary restart; individual
SIP/media sockets exist only during explicit tests. Startup/status/preparation
never send REGISTER/INVITE, issue grants or renew old results. Stop gates both
new intent acceptance and final nonce admission; active work drains naturally and
unknown work remains blocked until supported reconciliation. Implement safe case
availability/blockers in the existing no-store console read, preserving all
platform/CSRF/mounted recovery behavior.

Keep Asterisk's retained RTP range 10020–10039 and current strict-RTP setting;
private participant media must remain compatible with those bounds. Preserve the
reference's anchored-media behavior through direct-media denial and exclusion of
native RTP bridging. Real isolated SIP/RTP proves compatibility before ordinary
use; passive inspection alone cannot do so.

Cleanup owns only the additions above. Stop participants, revoke relevant grants
and append case disablement; preserve desired state, credentials, audit and exact
setup/test history. For actual loaded-path removal, c captures/reviews/applies a
replacement omitting those paths and independently proves absence in loaded
dialplan/PJSIP under fresh native ownership. Runtime pins and historical recovery
targets remain until existing reviewed retirement/release contracts prove removal
safe. Retain blocked resources; never delete whole tenants, prune volumes or claim
that participant stop proves loaded-path removal.

## Resume and completion conditions

The user selected the dedicated setup above. Reinspect the target and real
provider access on resumption. Complete durable preparation/lifecycle, real
provider setup, isolated fault/race/restart rehearsal, approved ordinary setup,
console persistence and all B-01–07/required regressions before marking b complete.
No B acceptance pass or parent completion is claimed by this review.

### Credential capability prerequisite discovered during implementation

Read-only inspection found capability revision 1 retains SIP/WebRTC, UDP/WSS,
opus/ulaw/alaw and none/DTLS-SRTP declarations, with both credential-size limits
unset. The [reviewed additive declaration](p4-u2-dev-b-capabilities.json) preserves
those existing settings, advances to revision 2 and declares the exact required
71-character generated identity / 64-character material support. The
[request definition](p4-u2-dev-b-manifest.json) expects that future revision; it is
not evidence of application. Use the existing declaration workflow only after
isolated actual SIP/provider verification. This is part of the approved dedicated
profile/credential prerequisites and introduces no retained credential rotation.

The bounded generated catalog contains eleven initial cases: required inbound and
outbound for each tenant; cross-tenant outbound in each direction; and A's
unallocated, unknown, ambiguous, ordinary-draft and unpermitted cases. Expiry,
revocation, stale-source and cross-tenant ingress remain c's actual conditional
acceptance scenarios. They must not be presented as unconditional denial cases
on an otherwise permitted route. No readiness or actual call result is inferred
from this catalog.
