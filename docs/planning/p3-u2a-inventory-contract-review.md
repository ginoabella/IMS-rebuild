# P3-U2a inventory and endpoint profile contract — review for approval

Prepared 2026-10-15 (Asia/Manila, +08:00). **Status: Sections 2–4 conditionally approved for controlled private development by the user on 2026-10-15; implementation under Sections 5–7 authorized.**

Requirement: [P3-U2a](../../context/feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md).
Decision owner: user, under D-09 and [parent G-01–03](../../context/feature-specs/p3-u2-extension-inventory-and-endpoint-profiles.md#decisions-required-before-dependent-implementation).
P3-U1 is recorded complete in [integrated evidence](../status/p3-u1c-evidence.md).
P3-U2a is complete within its A-01–07 controlled-development boundary; see [final evidence](../status/p3-u2a-evidence.md). The user approved the initial 1000–899999 convention,
node-scoped immutable profiles, generated identities, removeExisting=false and
disabled/unset stock. Future municipal plans require explicit policy revision.
UDP/RTP is controlled private development only; production transport/media and
registration recovery/expiry/reconnection/replacement require separate review.
Unmanaged resources/reference files remain unchanged. Saving/enabling grants no
credentials, live configuration, readiness or calling eligibility. A-01–07,
including real PostgreSQL/concurrency/rollback/regressions, remain required.
G-02/P3-U2b, P3-U2c and P3-U5 are separate approval/implementation boundaries.
This approval is not production deployment or runtime acceptance evidence.

## 1. Decisions requested

Recommend approving sections 2–4 for the controlled development installation:

| Decision | Recommended value | Effect of approval |
| --- | --- | --- |
| G-01 number policy | ASCII decimal strings, 4–6 digits, numerical range 1000–899999; reject leading zeros; trim outer ASCII spaces only | Establishes one canonical PBX-wide number namespace and deterministic bulk expansion |
| G-01 profile scope | Node-scoped reusable profiles, immutable versions, explicit adoption | Keeps node compatibility local and prevents profile edits from changing existing extensions |
| G-01 initial profiles | `sip-basic`: UDP/RTP, ulaw then alaw, one contact; `webrtc-basic`: WSS/DTLS-SRTP, opus then ulaw then alaw, five contacts | Establishes desired settings only; network listeners, certificates, credentials and apply remain separately owned |
| G-01 contact replacement | `removeExisting=false` for both profiles | A new registration must not evict an existing contact automatically when the limit is reached |
| G-03 namespace | Server-generated endpoint/auth/AOR keys derived from immutable installation and extension UUIDs | Separates managed inventory from numbered/unmanaged reference endpoints |
| Child boundary | Credentials remain `unset`; new stock defaults to desired `disabled` | a can complete without selecting G-02's endpoint-secret provider or delivery policy |

The range leaves short emergency/service codes and the 900000–999999 block outside
inventory. This is a proposed product convention, not a claim that these blocks
are formally reserved by an existing dial plan. P3-U4 must review actual routing
and special patterns before live apply. Other ranges require an explicit policy
revision; no per-request range override is offered.

Approval wording: **“Approve sections 2–4 of the P3-U2a inventory contract review
for controlled development, including number range, node-scoped profiles,
contact behavior, disabled/unset defaults and generated runtime namespace;
proceed with P3-U2a using sections 5–7.”**

The parent explicitly requires user-owned G-01 and applicable G-03 decisions before
dependent implementation. G-02 credential lifecycle, c's live coexistence checks,
P3-U5 deployment/apply and production policy remain with their owners. Approval
here does not establish those outcomes.

## 2. Number, identity and inventory policy — G-01

| Field or rule | Recommended contract |
| --- | --- |
| Number representation | JSON string only; at most 32 raw characters; trim U+0020 at either end; resulting string matches `[1-9][0-9]{3,5}` and integer value is 1000–899999 |
| Rejected syntax | JSON numbers, leading zeros, Unicode digits, tabs/newlines, signs, decimal points, embedded spaces, `+`, `*`, `#`, dial-pattern symbols and separators |
| Canonical examples | `"1001"` and `" 1001 "` both become `"1001"` and collide on the same node; `"01001"`, `"911"`, `"900000"` and `"1e4"` reject |
| Uniqueness | Database unique `(canonicalNodeId, canonicalNumber)` across SIP/WebRTC, profiles and disabled records; resolve node identity through the existing registry |
| Separate installations | Genuine distinct nodes may both have `1001`; equivalent aliases of one installation cannot establish another namespace |
| Immutable fields | Extension ID, node ID, number and endpoint kind; no number moves or kind conversion in a |
| Initial state | `availability=available` (unallocated platform stock), `administrativeStatus=disabled`, `credentials={kind:'unset'}`, `readiness={kind:'not_established'}`, version 1 |
| Desired changes | Enable/disable and explicit compatible profile-version adoption, each using expected extension version; no delete, number release or ownership fields |
| Eligibility | Always deny staff assignment/tenant calling for unallocated stock; include `disabled` as an additional reason when applicable; registration cannot grant eligibility |

Inventory availability and administrative status are independent: a disabled
extension remains unallocated stock with its number reserved. A desired enable
does not configure credentials, install an endpoint, connect a phone or prove
readiness. Until c, runtime mapping is explicitly unavailable in a's DTOs.

## 3. Endpoint profiles and node compatibility — G-01

Profiles belong to a canonical PBX node and endpoint kind. Use stable profile IDs,
a head version and immutable version rows. A version stores its complete safe
typed settings. Names are 1–80 trimmed characters, maximum 320 raw characters;
reject controls/malformed Unicode and enforce case-insensitive name uniqueness
within the node. Offer no deletion in a.

### Initial templates and allowed settings

| Typed setting | `sip-basic` | `webrtc-basic` |
| --- | --- | --- |
| Kind | `sip` | `webrtc` |
| Endpoint signaling | `udp` | `wss` |
| Media encryption | `none` (controlled private development only) | `dtls-srtp` |
| Ordered audio codecs | `[ulaw, alaw]` | `[opus, ulaw, alaw]` |
| Maximum dynamic contacts | 1 | 5 |
| Remove existing contacts | false | false |
| Direct media | false | false |
| RTP symmetric / force rport | true / true | true / true |
| Rewrite contact | true | false |
| ICE / AVPF / RTCP multiplexing | false / false / false | true / true / true |
| Use received media transport | false | true |
| DTLS verification / setup | Not applicable | `fingerprint` / `actpass` |

Allow profile versions to choose a nonempty unique ordered subset of their
kind's codec list, and maximum contacts 1–5. Other combinations/booleans above
remain fixed in this first contract. Profile labels are editable through a new
version; kind/node are immutable. No per-extension raw setting overrides.

Templates are code-owned safe defaults, explicitly instantiated per node by
an audited profile-create operation. Do not silently seed editable desired data
on application startup. Every extension must select a committed profile version.
Profile edits require the expected head version, create a new immutable version,
and leave existing extensions pinned. Adoption is a separate explicit extension
edit with expected extension version and exact new profile version; no mass
adoption endpoint is required.

The working [reference](../../reference/asterisk_config/pjsip.conf) supplies codec,
media and contact-count candidates. Two deliberate differences need approval:
use WSS rather than its WS example, and disable automatic contact replacement
rather than copying `remove_existing=yes`. Keeping old contacts can require
expiry or later approved operational intervention before a phone reconnects.
UDP and unencrypted SIP media are development choices requiring separate review
before production. WSS selection creates no listener or certificate deployment.

Asterisk documents the WebRTC settings and contact-limit behavior in its
[WebRTC guide](https://docs.asterisk.org/Configuration/WebRTC/Configuring-Asterisk-for-WebRTC-Clients/)
and [Asterisk 22 PJSIP reference](https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Module_Configuration/res_pjsip/).
These support the setting meanings; the defaults above are our proposed policy.
Exact pinned-version behavior still requires controlled verification in c/P3-U5.

### Compatibility boundary

Use a bounded deployment-owned, non-secret node capability declaration, keyed by
installation UUID and revision, through a telephony-owned typed port. Declare
approved desired kinds, signaling, codecs and media features for the controlled
Asterisk 22.10.1 installation. Do not infer support from management AMI-TLS,
observed endpoint names, a browser field or a reachable node. Missing/unsupported
capabilities reject profile selection safely. Other installations need their own
approved declaration; the domain must not hardcode one Asterisk version.

Validate at profile creation/versioning, preview and extension commit; revalidate
the declaration revision at the commit boundary. This establishes desired-format
compatibility only. c verifies its live mapping/coexistence boundary; P3-U5 must
verify modules, codecs, listeners, trust/media deployment and isolation before
apply. Profile fields exclude bind/public addresses, ports, certificate paths,
credentials, auth policy, caller identity, route contexts, trunks and arbitrary
Asterisk directives. Preserve every reference file unchanged.

## 4. Generated namespace and coexistence — G-03 portion for a

Generate UUIDs server-side. Let `i` be the installation UUID with hyphens removed
and `e` the extension UUID with hyphens removed, both lowercase hexadecimal:

| Internal identity | Format |
| --- | --- |
| Endpoint | `ims-e-<i>-<e>` |
| Auth object | `ims-a-<i>-<e>` |
| AOR | `ims-r-<i>-<e>` |

Each key is 71 ASCII characters, within the existing observation identifier limit
of 128. Enforce uniqueness and immutable key attribution in PostgreSQL; clients
cannot select or edit these keys. Credential reset changes future material
generation, not these stable identities; b must approve the auth username/material
contract under G-02. A key is not a password or an ownership grant.

c joins only exact canonical node/installation and generated endpoint keys,
qualified by existing freshness/coverage rules. Never join by number alone.
Existing numbered endpoints and reference trunks remain unmanaged; do not adopt,
overwrite, rename or import them. A conflicting existing generated key is a
coexistence failure requiring investigation, never automatic adoption. a proves
namespace behavior with declared fixtures; c must inspect the controlled target
and prove exact mapping and unchanged unmanaged entries before claiming live
coexistence. P3-U5 must repeat collision checks before any installation.

## 5. Atomic bulk, retry and technical bounds

These are proposed routine implementation contracts under the approved policy.

| Item | Recommended value/behavior |
| --- | --- |
| Bulk input | One node, kind and exact profile version per operation; either explicit `numbers` or inclusive `{start,end}` range, never both; range uses step 1 and the same number validator |
| Expansion | 1–50 canonical numbers; reject internal duplicates before deduplication; sort numerically for preview, fingerprint, locks and result order |
| Preview | Advisory POST read; returns exact canonical numbers, kind, profile ID/version/head, node desired version and capability revision; no durable write or session renewal |
| Commit dependencies | Submit those expected dependency versions with the input; lock/revalidate current authority, node, profile head/version and compatibility; changed dependency returns conflict even if the selected old version still exists |
| Request/result bounds | Existing 4096-byte JSON body ceiling; mutation/preview/list output at most 64 KiB; immutable bulk receipt safe result at most 16 KiB; validate before committing |
| Pagination/errors | Default 25, maximum 100; UUID keyset cursor; at most 10 conflict/validation details plus total count and truncated flag; fixed safe field messages |
| Atomic result | All requested records plus one operator business audit and receipt commit together, or none; never skip collisions or choose substitutes |
| Audit set | Sorted exact extension UUIDs (maximum 50), node/profile references, count and fixed change enums; fit existing audit metadata limits; no raw requests/configuration |
| Locking | Same per-node/number coordination for individual/bulk; sorted number locks, then constraint-protected inserts; compatible shared dependency locks, no exclusive whole-node/global bulk lock |
| Intent identity | Caller UUID scoped to canonical operator and operation: individual create, bulk create, profile create and profile-version create |
| Fingerprint | SHA-256 over bounded canonical node/input, sorted number set, kind, profile/dependency versions and relevant typed fields; do not hash arbitrary raw JSON |
| Replay | Same key/canonical payload returns original safe result with no duplicate audit; changed payload conflicts; inspect receipt before current dependency validation so an old committed operation can still replay |
| Receipt lifetime | 30 days using database time, aligned with registry; retained expired key rejects `intent_expired`; only trusted deployment may prune after expiry; audit/inventory/version history retained |

Bulk receipts return operation ID, node ID, exact `{id,number,version}` results
and selected profile/version, rather than duplicating full detail DTOs. Replay
returns this original result even after later edits; detail reload reads current
state. Individual and profile receipts similarly retain their original safe result.
After receipt pruning the same-key guarantee has ended; expired attempts require
canonical reload/review rather than resubmission.

Edits/adoption/status changes require positive safe-integer `expectedVersion`.
Stale requests reject even when input otherwise matches. A canonical no-op leaves
version/audit unchanged; a changed record increments once. Lost create COMMIT
responses require explicit immutable-intent retry or canonical reload; uncertain
edits require reload before further mutation. No automatic replay of changed data.

Required outbox work must share the existing transaction when a real consumer
needs it. a requires no PBX publication, speculative handler or observer refresh
intent. Forced required-write rollback is tested through the established owners.

## 6. Protected API and b/c handoffs

Proposed route root: `/platform/pbx-nodes/:nodeId`.

| DTO / consumer | Method and suffix |
| --- | --- |
| `ExtensionListDto` / list | GET `/extensions` |
| `ExtensionDetailDto` / detail | GET `/extensions/:extensionId` |
| `CreateExtensionRequest` / individual create | POST `/extensions` |
| `PreviewExtensionBulkRequest` / advisory preview | POST `/extensions/bulk-preview` |
| `CreateExtensionBulkRequest` / atomic commit | POST `/extensions/bulk` |
| `EditExtensionRequest` / profile adoption | PATCH `/extensions/:extensionId` |
| `SetExtensionStatusRequest` / disable or re-enable | PATCH `/extensions/:extensionId/status` |
| `EndpointProfileListDto` / profiles | GET `/endpoint-profiles` |
| `EndpointProfileDetailDto` / exact version | GET `/endpoint-profiles/:profileId/versions/:version` |
| `CreateEndpointProfileRequest` / create | POST `/endpoint-profiles` |
| `CreateEndpointProfileVersionRequest` / version edit | POST `/endpoint-profiles/:profileId/versions` |

Create/version-create returns 201 new or 200 original-result replay; preview,
reads and edits return 200. Define small domain-grouped strict schemas and reject
unknown body/nested/query fields, forged ownership/runtime/readiness fields,
credential material and raw configuration. UUIDs normalize lowercase. Cross-node
resource IDs never operate on the other node; return safe 404.

Use existing current `platform-cookie` authority, trusted channel/source, CSRF
and exact Origin policy, no-store and admission limits. Preview is an authorized
passive operation with no activity renewal, while still enforcing POST channel/
CSRF policy. Protected GETs never start observers or renew sessions. Mutations
revalidate canonical operator authority in their transaction. Reuse safe
401/403/429/503 behavior; a PBX outage alone must not block desired inventory work.

Errors: 400 fixed validation fields, 404 missing resource, 409 fixed reasons
`number_conflict`, `request_conflict`, `stale_version`, `dependency_changed`,
`profile_name_conflict`, `inventory_ineligible`, `intent_expired`; oversized bodies
reuse the existing parser status. Unsupported combinations are validation errors;
missing compatibility configuration is safe unavailable. Unknown COMMIT or failed
required writes return sanitized 503 with `Retry-After: 1`.

Safe extension DTOs contain IDs, canonical number/kind, pinned safe profile
reference/version, separate availability/status/credential/readiness dimensions,
version, ISO timestamps and actor references. a reports observation mapping
`not_available`; c supplies qualified passive observations. Never expose provider
locations, secrets, protocol payloads or raw reference configuration.

Provide b a transaction-bound inventory port that locks the exact node/extension,
checks expected desired version and unallocated/dependency eligibility, and
updates credential reference/generation metadata plus version through existing
transaction/audit owners. b defines its credential schema/provider details after
G-02 approval; a adds no speculative provider operation tables. Serialize edits,
disable/adoption and later credential mutations on the same extension row.
Future allocation owners must share this coordination contract and be checked
through owner ports; do not add fake allocation/assignment tables now.

c receives these DTO/routes, advisory preview/dependency tokens, original-result
replay, conflict and uncertain-edit recovery contracts. Browser forwarding remains
named and narrow, with canonical operator-bound mounted recovery. c owns browser
acceptance and real observation mapping; a's fixtures cannot establish them.

## 7. Resume and acceptance plan

After explicit approval, record the scoped G-01/G-03 decision and synchronize
the implementation contract before dependent schema/validation work. Establish
the controlled node's non-secret capability declaration without installing
listeners, changing reference files or provisioning credentials.

| Criterion | Required proof during implementation |
| --- | --- |
| A-01 | Approved policy/examples, exact DTO/routes/bounds/errors/retention and b/c contracts documented |
| A-02 | Real PostgreSQL/runtime grants, HTTP A/B individual creation, equivalent-node and cross-kind/profile/disabled collisions, independent-node reuse and audit rollback |
| A-03 | Bounded preview, dependency-change conflicts, atomic overlap races, concurrent same-intent replay, conflicting reuse and actual committed-response loss; non-overlapping operations can progress independently |
| A-04 | Immutable profile history, explicit adoption/stale rejection, node incompatibility and configuration-injection rejection |
| A-05 | Disable/re-enable retains number/history; unallocated/disabled eligibility denies, forged readiness/ownership rejects, no PBX effects |
| A-06 | Actual platform/staff/revoked/expired sessions on HTTP A/B, channel/CSRF/Origin/no-store, database/Redis failure, passive reads and bounded secret-free output |
| A-07 | Focused suite, affected registry/auth/audit regressions and full Docker graph; safe evidence, runbook, index, tracker and exact fixture cleanup |

Establish `./dev exec pnpm check:extension-inventory --inventory` during
implementation; it is proposed, not a current verified command. Run required
affected checks and `./dev check` and record actual results. Namespace and
future-owner fixtures prove only their declared ports; live coexistence belongs
to c, credential lifecycle to b, and applied isolation/readiness to P3-U5/P4.

This review checkpoint requires documentation consistency, local links and
whitespace checks only. No runtime tests or new implementation are claimed.
