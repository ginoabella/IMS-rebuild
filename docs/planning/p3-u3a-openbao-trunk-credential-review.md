# U3A-04 — Reuse OpenBao for isolated trunk credentials

Prepared 2026-10-16 (Asia/Manila, +08:00). **Approved by the user on
2026-10-19 (Asia/Manila, +08:00) for the stated controlled private-development
scope. Implementation and verification remain outstanding.**

The proposal wording below is retained as the approved decision record. The
OpenBao review supersedes the initial staged authenticated-scope hold; its
concrete profile/provisioning prerequisites and exclusions still apply.

Owners: [P3-U3a](../../context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md),
[parent G-03 and conditional lifecycle refinement](../../context/feature-specs/p3-u3-trunks-gateways-and-dids.md),
[initial U3A review](p3-u3a-definition-contract-review.md).

## Recommendation

Reuse the existing OpenBao server as the protected storage platform for a separate
telephony-owned trunk/provider credential lifecycle. Add a dedicated KV-v2 mount,
provider identity, policies, custody, protected importer, verifier worker and
canonical PostgreSQL binding metadata. Do not reuse endpoint tokens, endpoint
credential records or endpoint lifecycle handlers. A separate secret-management
product or second OpenBao server is unnecessary for the approved private-development
boundary; a shared server still has shared infrastructure administration and failure.

**Feasible from source review; not yet implemented or verified for trunks.**
Existing endpoint approval does not authorize the new access. Resolve the proposal
before dependent a implementation, then deliver the focused lifecycle refinement
required by the parent before claiming authenticated a acceptance. The existing
IP-peer staging proposal is optional; approval here can replace its G-03 hold,
but does not by itself approve remaining G-01/G-04 product choices.

## 1. Current repository findings

| Inspected source | Finding and implication |
| --- | --- |
| [Compose credentials topology](../../infra/docker/compose.credentials.yaml), [server HCL](../../infra/openbao/server.hcl) | Pinned OpenBao 2.7.1/digest, persistent single-node Raft, verified-TLS listener, no published ports/UI, read-only container filesystem and retained data/audit volumes. Same server can host the proposed additional mount; this does not establish production HA/custody |
| [Provisioner](../../scripts/provision-endpoint-credentials.mjs) | Only `myims-endpoint` KV-v2 and endpoint policies/tokens are provisioned. Worker has installation-qualified create/read; cleanup has separate read/metadata/destroy. Runtime tokens use one-hour TTL/24-hour maximum and omit the default policy |
| Same provisioner | `endpoint-development-admin` can write `endpoint-*` policies, including itself, and has generic token creation with sudo. It is a privileged platform trust principal, not a robust boundary against a separate lifecycle administrator. It must not be used as the new trunk administrator |
| [Endpoint provider](../../services/backend/src/modules/telephony/adapters/credentials/openbao.ts) | Exact installation/extension/operation/generation metadata, generated hex passwords, create-only CAS=0 and exact version-1 reads. It is endpoint-specific, not a generic carrier import adapter |
| [Endpoint handler](../../services/backend/src/modules/telephony/adapters/jobs/credential-handler.ts) | Durable reservation precedes provider I/O; authority/version checks repeat in finalization. Provider I/O occurs outside the business transaction. These patterns are reusable, not the endpoint handler itself |
| [Worker entrypoint](../../services/backend/src/entrypoints/worker/main.ts), [delivery engine](../../services/backend/src/infrastructure/worker/delivery.ts) | Only ordinary and endpoint consumers exist. Claim filtering explicitly distinguishes the endpoint work type and checks its installation. Adding a trunk work type without changing this filter could let ordinary workers claim it |
| [Credential migration](../../infra/database/migrations/20261016000000_endpoint_credentials/migration.sql) | Endpoint operations retain immutable generation/intent evidence; `myims_runtime` can mutate lifecycle status columns. This is not a distinct database owner identity for a future trunk attestation |
| [Runbook](../runbooks/endpoint-credentials.md), [isolation checks](../../scripts/check-endpoint-isolation.mjs) | Private provider/database networks and UID 1003 custody isolate endpoint material from ordinary processes. Recorded checks cover endpoints, not trunk policies/paths/import/binding |

No trunk material inventory, opaque-binding selector, dedicated trunk worker,
trunk ACL or trunk operation schema is established by those files. No private
custody/token file was read, no raw material was retrieved, and no live service
or previously recorded acceptance result was reverified during this review.

## 2. Storage and ownership boundary

Use a separate KV-v2 mount `myims-trunk` in the existing server. “Namespace” here
means a dedicated mount and path/ACL domain; it does not require OpenBao's separate
Namespaces feature or changing the endpoint mount.

Proposed private provider layout:
`myims-trunk/data/installations/<installationUuid>/bindings/<bindingUuid>/generations/<generationUuid>`.
This path is infrastructure documentation only: never send it in API responses,
DTOs, browser state, resource rows, outbox payloads or application audit/errors.
Provider audit may contain provider request paths; keep that protected infrastructure
audit separate from application output and never enable raw-value logging.

Each generation has a new key, CAS=0 and provider version 1. Ordinal 1, 2, 3 is the
application generation history, not “latest OpenBao version.” Exact read always
requests version 1 and validates canonical binding/installation/peer/generation/
purpose metadata, schema, non-deleted/non-destroyed state and material bounds.
No update/patch/delete permission for writers; retain metadata to prevent key reuse.
Never copy material from an endpoint key or accept an operator-selected path.
[OpenBao KV-v2](https://openbao.org/docs/secrets/kv/kv-v2/) documents independent
mounts, versioned reads, create/update separation and CAS behavior.

Protected data holds the SIP authentication username, password and exact realm,
and any private registration account identity. These are SIP account credentials;
carrier administration/API keys and provider account purchasing are out of scope.
No secret-derived unkeyed digest is stored in PostgreSQL for low-entropy passwords.
Initial import bounds: username 1–128 ASCII letters/digits or `_.+@-`; password
1–1024 printable ASCII characters, preserved exactly; realm 1–253 printable ASCII
characters constrained by an approved provider profile, no wildcard realm.
Reject controls, malformed data and configuration delimiters where a field's typed
syntax forbids them; never interpolate raw input into a config fragment. A provider
requiring a different credential format needs a reviewed profile revision.

| Principal | Proposed access |
| --- | --- |
| Shared trusted platform custodian | Mount/policy/token-role administration only through reviewed deployment operations; owns server seal/TLS/audit/backup custody. This privileged trust remains common to both lifecycles |
| Trunk scoped issuer | May issue tokens only through exact precreated trunk token roles with fixed installation policies and bounded TTL; cannot edit policies/roles or call unrestricted token-create |
| Trusted trunk importer | Exact installation trunk create/read, no overwrite/list/destroy/endpoint scope; receives material through protected input only |
| Trunk verifier worker | Installation-scoped trunk read only plus necessary self-token lifecycle; no endpoint/write/delete/policy/token-issuance rights |
| Trunk cleanup command | Separate installation-scoped exact read/metadata/destroy capability; no metadata deletion, overwrite or endpoint scope; only mounted for explicit cleanup |
| Endpoint worker/cleanup | Existing endpoint permissions remain unchanged; no trunk mount permissions |
| HTTP/Next/browser/ordinary workers/observer/Asterisk | No trunk provider token, raw-material input, custody mount or new provider access |

Use a distinct host UID/GID and private custody directory for trunk processes,
not UID 1003 or the endpoint custody directory. Give them only their exact token,
CA and database credentials. A dedicated internal trunk-provider network attaches
the retained server and trunk processes; a separate internal database bridge
attaches PostgreSQL and trunk processes. No PBX or public application-network
membership is needed. Network reachability is not authorization. Endpoint and
trunk processes can reach the same server, so reciprocal real ACL denial is required.

Before declaring administrative isolation, retire/revoke the current self-editing
endpoint administrator and any issuer with equivalent privilege; replace routine
issuance with exact restricted token roles. Preserve existing endpoint worker and
cleanup policies/permissions and their orphan token lifetimes. A shared trusted
platform custodian is still able to change both lifecycles: this design isolates
runtime and routine lifecycle roles, not the server root/host/backup administrator.
[OpenBao policy semantics](https://openbao.org/docs/concepts/policies/) support
path-based, deny-by-default authorization; policy names alone do not restrict
what an authorized policy writer can grant.

Provisioning needs an actually authorized trusted platform identity capable of
creating the new mount/roles. The normal protected listener disables root recovery.
Approval of this design does not authorize temporarily weakening it or executing
root recovery. If such access is needed, prepare and approve that exact procedure
separately. Do not reuse the endpoint admin as a shortcut.

## 3. Opaque bindings and canonical owner metadata

Telephony owns a narrow `TrunkCredentialOwner` contract with separate runtime
composition. PostgreSQL stores only non-secret facts:

- Binding UUID, canonical installation/node, deployment peer UUID, supported auth
  purpose set, monotonically increasing owner revision and lifecycle eligibility.
- Immutable generation UUID/ordinal, provider material version fixed at 1, operation
  UUID and originator authority version; owner verification time/expiry and epoch.
- Immutable intent/result tombstones and retained association/adoption history.
  A binding may serve only one trunk identity; the same trunk may use the exact
  generation for both outbound requests and registration when purposes permit it.

Allocate a binding before trunk creation, qualified to node/peer/purposes but
unclaimed. The create transaction atomically claims it for its server-generated
trunk UUID. This avoids requiring clients to choose resource UUIDs or importing
into nonexistent trunk records. Claim reservation and generation eligibility
prevent another trunk racing to take it. Initial gateways remain IP-identified
inbound sources: linked gateways reference the trunk, not another copy of its
secret. A standalone gateway gains no digest authority from this design; future
outbound device connections need explicit G-01 semantics.

Resource selection is only `{bindingId, generationId, generationOrdinal,
materialVersion:1}` plus expected owner revision. No provider name/path/account
password is accepted. Changing a binding head never updates an existing desired
trunk. Select/adopt an exact generation explicitly with expected resource version;
never resolve “current/latest” during a resource commit or later compilation.

Use new owner tables (bindings, immutable generations, operation/retry evidence
and association history) with restrictive node-qualified foreign keys, checks,
unique generation/intent/claim constraints and safe views. Deployment owns schema.
A dedicated database owner role publishes verified eligibility/state. Ordinary
`myims_runtime` cannot mark generations verified/bound-ready, alter provenance or
perform cleanup transitions. Expose only safe reads and narrow audited intent/
claim/adoption operations via scoped ports and, where needed, constrained database
functions with fixed search paths. The resource's same-connection transaction
must be able to claim/adopt without gaining arbitrary owner-state writes.

Do not insert trunk records in endpoint operation tables or repurpose endpoint
`setup/reset` semantics. Share transaction/audit/outbox/queue infrastructure and
small safe transport helpers only where compatibility is verified. No new queue,
DB server, secret-management product or always-listening secret HTTP API is needed.

## 4. Creation, import, rotation, retirement and cleanup

1. **Reserve:** an authorized platform operation commits a non-secret immutable
   import intent, binding/generation IDs, exact node/peer/purposes, actor/authority
   version and receipt. At most one active preparation per binding. No material
   enters HTTP, PostgreSQL, receipts, logs or queue payloads.
2. **Import:** trusted deployment command receives carrier-supplied credentials
   through protected file descriptor/hidden input, never argv/env/URL. It looks up
   the exact reservation, writes that one derived key with CAS=0 and validates
   the resulting version. Input exists only in protected process memory; discard
   it after the attempt. No plaintext spool or durable job payload. A retry uses
   the same key; if an existing value differs from resupplied material, compare
   privately and reject changed reuse. Never overwrite or invent another intent.
3. **Verify:** after import, durable non-secret verification work goes to the
   dedicated worker. It reads the exact generation and validates schema/binding
   outside SQL transactions, then rechecks originator authority/reservation and
   commits verification eligibility/audit/result atomically. A crash after provider
   write is reconciled by exact read. If no write occurred, explicit resupply is
   needed; the queue cannot recreate a carrier password. Persist uncertainty and
   a finite retry budget rather than pretending import succeeded.
4. **Bind:** a's create or explicit credential-adoption transaction locks and
   qualifies the exact owner metadata and claims/adopts the generation. A local
   verified record is not evidence the carrier recognizes that credential.
5. **Rotate:** reserve/import a new key and generation; old generation remains
   pinned until explicit versioned adoption. Old generations/history survive.
   No carrier API call, password reset, live PBX swap or old-secret revocation is
   implied. Carrier-side coordinated rotation and delivery belong to later policy.
6. **Retire:** owner blocks new selection/claims and records history; existing
   references remain visible, with qualification/eligibility explicit. Retirement
   that affects existing references requires dependency checks/version fencing;
   it never silently changes a resource, disconnects a trunk or revokes a password.
7. **Cleanup:** separate trusted cleanup command may destroy exact version 1 of
   terminal never-associated generations aged at least 24 hours, at most 50 per
   run, only with affirmative provenance/dependency checks and serialized claims.
   Mark nonselectable/cleanup-pending before provider I/O; finalize safe outcome
   afterward. Unknown dependencies block. Keep canonical/provider tombstones and
   recheck late writes after uncertain effects. Associated generations are retained
   until P3-U5 and all allocation/rollback owners approve their retirement policy.

Initial real carrier support is **import**, not generation of a password that
would somehow configure the carrier. Controlled acceptance may generate synthetic
credentials locally without contacting a carrier. Actual generated device/provider
credentials and any delivery/reveal require a separate approved recipient flow.

Proposed operational values follow endpoint precedent without reusing its token:
five-second absolute provider deadlines; two verification operations concurrently;
six attempts per budget, exponential 5-second backoff capped at 300 seconds;
explicit audited reconciliation after exhaustion. Trunk tokens use one-hour TTL,
24-hour explicit maximum, renewal before expiry and trusted reprovisioning at
maximum; no default policy. Full safe results 30 days, minimal intent/generation/
association tombstones retained. No automated associated-material destruction.

## October 20 approved direction amendment

The [approved completion direction](p3-u3a-approved-completion-direction.md)
supplements this review: retain one-hour initial runtime leases and 86,400-second
configured explicit maxima; adopt complete-array hardening as the candidate and
develop bounded same-token reconciliation/pre-maximum replacement. Retained
access and execution remain unapproved. The [trunk security contract](../architecture/trunk-credentials.md#conditional-attestation-timing--not-accepted-for-runtime-use)
defines the conditional timing clarification: completed authorized verification
may attest within its original 60-second verification freshness interval even after
provider-token expiry (without extending that interval), with independent current
business authority, exact owner/installation/generation, replay and freshness
checks at database finalization. This is approved in principle only, **not accepted
for runtime use** until implemented and real transaction/failure tests pass.
Historical proposal language below does not override these conditions.

## 5. Exact revalidation in a's business transaction

`qualifyAndClaim(tx, node, peer, trunk, exactReference, expectedOwnerRevision,
expectedResourceVersion, requiredPurposes)` must use the caller's existing
transaction handle. It performs no network or provider call.

Use one shared documented order for imports, binding, adoption, retirement and b:
canonical authority → action-scoped intent → node → deployment capabilities/peer
→ affected trunks sorted by UUID → gateways sorted by UUID → bindings sorted by
UUID → generations/qualification rows sorted by UUID → relationship reservations.
Preparation/finalization must not acquire a binding and then attempt reverse-order
resource locks. b must extend this order explicitly for DID/removal dependencies.

Under these locks revalidate current operator authority, node/installation/peer,
resource/dependency versions, mode/purpose compatibility, exact immutable generation
and provider version, expected owner revision, claim exclusivity, eligibility,
verification epoch, non-retired/non-cleanup state and dependency coverage.
Check owner proof freshness against database time immediately before final writes:
proposed maximum age 60 seconds, with `verifiedAt` and `validUntil` recorded.
Expired/unknown/unavailable qualification returns sanitized retryable unavailable;
wrong qualification/version conflicts or rejects. Resource reference/version,
claim/history and business audit commit atomically. Audit/constraint failure rolls
back all local effects; required owner updates cannot commit independently.

Dedicated worker revalidation may be requested through a bounded committed
non-secret intent; GET stays passive and no-store. If its proof is expired, create/
adopt waits for that protected qualification, not an HTTP secret read. Retire and
cleanup share locks so either the binding commits first and blocks cleanup, or
cleanup makes the generation ineligible and binding fails.

**Limit:** PostgreSQL and OpenBao do not share a transaction. This proves exact
canonical association and a recent owner attestation, not instantaneous remote
material existence at SQL COMMIT. A shared administrator could remove material
or the server could fail immediately after verification. Within the 60-second
window the DTO says “verified as of,” never “currently reachable.” Detection marks
qualification unavailable; expiry does the same even without a new provider call.
If instantaneous remote existence is required, this design cannot promise it.
P3-U5 must requalify exact material at its protected apply boundary. Bound metadata
is never a live successful authentication claim.

## 6. Safe state contract

Keep persisted association, owner eligibility and material qualification distinct.
The UI/API summarizes them without discarding an existing safe association:

| Summary | Meaning / safe output | Mutation behavior |
| --- | --- | --- |
| `not_required` | IP-peer mode, no credential reference | Reject submitted credential selections |
| `missing` | Authenticated definition has no established exact association, or canonical owner confirms selected generation absent | No authenticated create/adopt/enable success. A committed old association remains in safe history if material was later found absent |
| `unavailable` | Owner/DB qualification cannot be obtained, proof expired, provider sealed/denied/unreachable, malformed binding material or uncertain work | Safe fixed reason and retained opaque association when known; no guessed missing or configured result. Reject dependent mutation retryably where appropriate |
| `bound` | Exact canonical desired association to an owner-qualified generation with bounded last-verified attestation | Return opaque reference, generation ordinal, `materialVersion:1`, owner revision and `verifiedAt`/`validUntil`; no registration/activation/readiness assertion |

An imported unclaimed verified generation is `selectable` in the protected owner
catalog; it is not a `bound` resource. A missing selection is a rejected request,
not a successful authenticated definition with fabricated credentials. Imported
but pending/uncertain work is unavailable for binding. Retirement reports separate
`eligibility=retired`, prevents new uses and preserves the association/history.

If the canonical DB is unavailable, return safe 503; do not return invented
per-resource states from process memory. Raw provider status/error/path/token/
username/password never enters the finite error contract. Provider 404 and
access-denied must not be conflated: only an authorized exact lookup establishes
absence. A stored receipt replays its original association result; it does not
claim fresh qualification. Canonical detail provides current safe summary.

## 7. SIP modes and limits

Proposed initial typed dimensions are `authenticationMode=ip-peer|outbound-digest`
and separate `registrationMode=none|outbound`. Registration requires digest and a
reviewed exact registrar/profile selection; digest does not require registration.
One exact generation may support both outbound request and registration auth
only if its approved purpose set explicitly includes both. Registering does not
select an ingress tenant or prove safe inbound attribution.

[Asterisk's outbound registration guide](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-Outbound-Registrations/)
and [Asterisk 22 registration reference](https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Module_Configuration/res_pjsip_outbound_registration/)
separate registration objects from endpoints and describe registration outbound
auth references. This supports separate desired dimensions, not a claim that
current MyIMS code compiles or applies either feature.

Extend the proposed G-01 typed provider/capability contract before code to include
allowlisted registrar/server identity and transport, exact realm and supported
digest algorithm, protected registration identity selection, and safe bounded
timing policy. Proposed fixed initial registration settings: expiration 3600s,
retry interval 60s, max retries 10, permanent auth rejection true, no custom
proxy/header/contact/line-matching overrides. Runtime identifiers are generated;
no caller-entered SIP URI/config fragments. Exact algorithm/module support must
be declared and verified against the pinned Asterisk/PJSIP build before P3-U5
apply; no automatic algorithm downgrade is authorized. Approve a concrete profile
before claiming a valid authenticated compatibility example.

Inbound digest, mutual TLS/client-certificate lifecycle, OAuth/AKA, precomputed
HA1 storage, wildcard realms, credential sharing across trunks/nodes, provider
administration API tokens, account provisioning, browser secret entry/reveal and
carrier rotation integrations remain out of scope. Standalone inbound gateways
continue IP identification; linked gateways do not require their own auth object.
Saving digest/registration definitions sends no REGISTER, call, probe, configuration
write or reload. Asterisk and future protected apply/delivery will eventually need
an approved material boundary; they get no OpenBao token or delivery permission
from this decision. PBX authentication and actual provider reachability remain
future verification, separate from this foundation's storage/binding acceptance.

## 8. New work and acceptance/documentation changes required

| Work | Required change before declaring U3A-04 delivered |
| --- | --- |
| Focused lifecycle child | Add the parent's conditional credential-lifecycle refinement with independent real-provider criteria. Its reservation/import/verification can precede resource creation; a integration must then verify exact claims/adoption |
| Infrastructure | Additional mount/policies/exact token roles, endpoint-admin privilege remediation, distinct UID/custody/network attachments and dedicated trunk-verifier container; retain server/data/audit volumes/TLS and endpoint behavior |
| Domain/schema | Trunk owner ports, bindings/generations/operations/history, safe projections, explicit DB roles/grants, immutable receipts and dependency-qualified cleanup |
| Protected commands | Non-listening platform-authorized reserve/import/reconcile/retire/cleanup commands and safe selection/operation APIs; no general secret upload/reveal endpoint |
| Workers | Dedicated verifier consumer/adapter and installation-scoped claim filter. Update ordinary and endpoint filtering to exclude all reserved secret work types, not just the existing endpoint type. Preserve existing queue, retry and result infrastructure |
| a API | Exact binding selection plus versioned explicit adoption; required-purpose/capability validation, transactional owner qualification/claim, fixed states/errors and no-store reads |
| Parent/child specs | Record approved G-03 scope, lifecycle refinement dependency, revised G-01 auth/registration dimensions and applicable G-04 adoption safeguards; keep parent a/b/c and later-unit boundaries explicit |
| Owner docs | New trunk credential architecture/runbook and protected importer custody/recovery instructions; clarify existing endpoint docs now describe one lifecycle on a shared server and its remediated administration boundary |
| Consumer/evidence docs | Update a review, b/c handoffs, check selections, docs index/tracker and scoped evidence with actual results, commands, cleanup and limitations |

**Proposed replacement for a A-04:** Approved trunk-specific import and protected
qualification establish exact opaque binding/generation/material-version metadata
against real OpenBao. Authenticated create/read/versioned adoption revalidate
canonical authority, owner revision/eligibility and bounded qualification on the
same transaction; missing/unavailable/retired/stale/wrong-node/wrong-peer/purpose
mismatches reject safely. Real ACL/process checks prove reciprocal endpoint/trunk
isolation, no ordinary-process material access and no secret leakage. Duplicate
import, changed reuse, provider/DB failure, interrupted/uncertain writes, retry
exhaustion, cleanup races and explicit generation adoption preserve atomic local
state and retained history. No result implies provider acceptance, registration,
activation or old-secret revocation. External boundary evidence is required;
port fixtures alone do not satisfy A-04.

Also extend A-01 for approved owner/import/TTL/retention contracts, A-02 for composite
reference/grant constraints, A-03 for bind/adopt/retire/cleanup races and rollback,
A-05 for real A/B authorization/CSRF/passive reads, A-06 for no live effects and
unknown dependency denial, and A-07 for full lifecycle/definition regressions.
Reconcile parent AC-01/04/06/07/08/10/11 without weakening DID/browser/removal criteria.

Real acceptance must include: own-generation read success; reciprocal endpoint/
trunk and cross-installation denial; forbidden overwrite/patch/list/destroy and
admin issuance escalation; same-UID/mount/env/process material exclusion; token
expiry/renewal/maximum, TLS/seal/outage/restart; exact-version mismatch and missing
versus denied states; current authority fencing; PostgreSQL grants/constraints;
A/B races with deterministic barriers; response loss; audit rollback; interrupted
import/reconciliation; late provider writes during cleanup; material sentinels
absent from all safe outputs/application audits/outbox/URLs/bundles/logs. Use a
synthetic fixture account, not real carrier authentication or a call. Run affected
endpoint/isolation/PBX/auth/durability checks and full `./dev check` during delivery.

## 9. Conflicts, risks and exact decision requested

- Separate mount/ACLs do not isolate a shared server's root, host administrator,
  TLS custody, Raft volume, backup or provider outage. Private single-node OpenBao,
  one-share development unseal and the 512 MiB server limit remain shared risks;
  capacity/HA/backup/production require separate measured approval.
- Current self-editing endpoint administrator defeats strong administrative
  separation. Remediation must be verified without silently expanding endpoint
  runtime rights or interrupting retained material.
- Current worker filtering and broad runtime metadata grants cannot be copied
  unchanged. The dedicated consumer and restricted attestation owner are required.
- Provider import is an external secret boundary even on an existing server, so
  the parent's focused lifecycle refinement applies. The initial a edit policy
  must explicitly permit protected credential adoption while other structural
  edits retain their dependency gates.
- Association and recent material qualification are not cross-system atomic
  availability. The proposed 60-second proof is explicit and never live readiness.
- Import/rotation does not update the carrier. Existing associated generations
  cannot be cleaned up using a never-associated shortcut; retirement and later
  revocation must preserve rollback/dependency history.

**Exact proposed decision:**

> Approve U3A-04 for controlled private development using the existing OpenBao
> server and a separate `myims-trunk` KV-v2 mount. Approve the isolated trusted
> importer, read-only verifier worker, separate cleanup identity, exact restricted
> token roles, distinct process/custody/network and database-owner boundaries in
> this review, including remediation of the self-editing endpoint administration
> privilege without expanding endpoint worker/cleanup permissions. Approve
> carrier-supplied credential import through protected deployment input only,
> immutable per-generation version-1 keys, opaque exact binding references,
> explicit versioned adoption and 60-second owner qualification with the stated
> cross-system limit. Approve the proposed TTL/deadline/retry/retention and
> never-associated cleanup bounds. Approve outbound digest and optional outbound
> registration as desired configuration only, subject to an approved compatible
> typed provider profile; other authentication modes remain excluded. Prepare
> the focused credential-lifecycle child and synchronize the affected specs and
> contracts before implementation. Require real OpenBao/ACL/process/A-B/transaction
> evidence before declaring a A-04 or U3A-04 delivered. This does not authorize
> root-recovery/listener weakening, carrier API calls, PBX delivery/apply/reload,
> REGISTER/calls, live revocation, production deployment or unrelated G-01/G-04
> decisions.

This decision resolves the design choice if accepted; implementation readiness
also requires concrete approved non-secret provider/capability declarations and
an authorized platform provisioning identity. Runtime completion requires the
new evidence above. No design approval or passing trunk check is recorded yet.

## Review checks

This preparation checks source ownership/topology, upstream product semantics,
local document links, whitespace and coverage of the eleven requested questions.
It does not execute provider/ACL/service tests. Proposed commands and components
must be introduced and verified only during authorized implementation.
