# Protected extension inventory and endpoint profiles

P3-U2a implements [the child requirement](../../context/feature-specs/p3-u2a-protected-inventory-profiles-and-atomic-bulk-creation.md)
under the user's 2026-10-15 conditional approval of
[inventory contract Sections 2–4](../planning/p3-u2a-inventory-contract-review.md).
This is controlled private development. UDP/unencrypted RTP, contact recovery,
production deployment and runtime acceptance are not approved for production.

## Policy and ownership

Numbers are JSON strings of at most 32 raw characters; trim only outer U+0020.
Canonical numbers match `[1-9][0-9]{3,5}` in 1000–899999. `" 1001 "` becomes
`"1001"`; `"01001"`, `"911"`, tabs, Unicode digits and `"900000"` reject.
This initial convention can change only through explicitly approved policy
revision, including shorter municipal plans. No per-request override exists.

PostgreSQL reserves `(node_id, number)` across SIP/WebRTC, profiles and disabled
records. The existing registry reserves one node per installation, including
catalog aliases; genuine nodes may reuse numbers. Extension UUID, node,
installation, number, kind and all runtime keys are immutable. The installation
foreign key prevents moving a node's existing inventory to another installation.
Profiles belong to a node and kind, with case-insensitive current-name uniqueness.
Names are 1–80 trimmed UTF-16 units, at most 320 raw units; controls and malformed
Unicode reject. Profile edits append immutable versions; dependent extensions stay
pinned until explicit expected-version adoption. No deletion or number release.

New stock has `availability=available`, desired `administrativeStatus=disabled`,
`credentials={kind:'unset'}`, `readiness={kind:'not_established'}` and
`observation={kind:'not_available'}`. Enablement changes desired status only.
`inventoryEligibility(status)` always denies unallocated stock, adding `disabled`
when applicable. Registration is deliberately absent from this port's inputs.
There are no allocation, staff-assignment, credential, route or apply tables here.
Future P4 owners must extend the canonical lock/eligibility contract when they
introduce ownership. This is not delivered P4 assignment enforcement.

Runtime identifiers use lowercase UUIDs with hyphens removed: endpoint
`ims-e-<installation>-<extension>`, auth `ims-a-…`, AOR `ims-r-…`. Each is 71 ASCII
characters, constraint-checked, unique and server-generated. They are internal
mapping keys, omitted from transport DTOs. Never adopt numbered/unmanaged entries,
reference trunks or pre-existing generated keys. Reference files remain unchanged.
c must check exact installation/node/generated endpoint mapping and coexistence;
P3-U5 must recheck collisions before application. Nothing here contacts the PBX.

## Typed profiles and capabilities

`packages/contracts/src/extension-inventory.ts` defines named DTOs and requests.
Code-owned `sip-basic` and `webrtc-basic` templates implement the exact approved
settings in contract Section 3. Clients may choose only a nonempty unique ordered
subset of the kind's codecs and `maxContacts` 1–5. All other settings are fixed,
including `removeExisting=false`. `settings` input is strictly
`{codecs,maxContacts}`; a profile version requires it. Initial profile creation may
omit it for template defaults. There are no per-extension settings overrides.

SIP: UDP/unencrypted RTP, ulaw/alaw, default one contact. WebRTC: WSS/DTLS-SRTP,
opus/ulaw/alaw, default five contacts, ICE/AVPF/RTCP mux and fingerprint/actpass.
Management AMI-TLS does not establish endpoint transport compatibility. Credentials,
certificates/listeners, network values, caller identity, contexts and arbitrary
configuration cannot be profile fields.

`InventoryStore.capability` is the telephony typed compatibility port. Its real
adapter reads deployment-owned `endpoint_capabilities`, keyed by installation UUID
and positive increasing revision. Bounded reviewed declarations list kinds,
signaling, codecs and media. Declaring `webrtc` + `wss` + `dtls-srtp` means support
for the complete fixed WebRTC media-feature bundle above; SIP support likewise
means its fixed template bundle. These are desired-format declarations, not
observed operational module/media readiness. Unknown declarations return safe 503;
unsupported combinations return 400. Runtime has SELECT and a trigger-protected
identity UPDATE grant solely needed for SHARE locking, never declaration writes.

Profile creation/versioning and extension preview/commit check the exact declared
revision. Mutations hold compatible SHARE locks on node/capability/profile head
until commit; profile version writers take UPDATE on the head. Trusted declaration
updates serialize with those locks and must advance revision. Profiles are never
silently seeded on startup. See [deployment procedure](../runbooks/extension-inventory.md).

## HTTP contract

Root: `/platform/pbx-nodes/:nodeId`. All routes require current canonical
`platform-cookie` authority, operator permission, trusted source/proxy, exact
Origin/channel rules and `Cache-Control: no-store`. All POST/PATCH routes enforce
CSRF, including passive preview. Mutations transactionally revalidate authority.
GETs and preview do not renew sessions or start observers. Existing distributed
admission applies; database/Redis failure safely denies access. PBX availability
and management-secret availability are irrelevant to desired inventory saves.

| Method / suffix                                      | Request → response                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| GET `extensions`                                     | strict `limit`, `after` → `ExtensionListDto`                       |
| GET `extensions/:extensionId`                        | no query → `ExtensionDetailDto`                                    |
| POST `extensions`                                    | `CreateExtensionRequest` → `ExtensionDetailDto`                    |
| POST `extensions/bulk-preview`                       | `PreviewExtensionBulkRequest` → `ExtensionBulkPreviewDto`          |
| POST `extensions/bulk`                               | `CreateExtensionBulkRequest` → `ExtensionBulkResultDto`            |
| PATCH `extensions/:extensionId`                      | `EditExtensionRequest` → `ExtensionDetailDto`                      |
| PATCH `extensions/:extensionId/status`               | `SetExtensionStatusRequest` → `ExtensionDetailDto`                 |
| GET `endpoint-profiles`                              | strict `limit`, `after` → `EndpointProfileListDto`                 |
| GET `endpoint-profiles/:profileId/versions/:version` | no query → `EndpointProfileDetailDto`                              |
| POST `endpoint-profiles`                             | `CreateEndpointProfileRequest` → `EndpointProfileDetailDto`        |
| POST `endpoint-profiles/:profileId/versions`         | `CreateEndpointProfileVersionRequest` → `EndpointProfileDetailDto` |

GET profiles includes current `nodeVersion` and safe `capability` declaration (or
null), allowing c to construct initial profile requests without inferred support.
Profile details contain version-specific name/settings/creator/time plus current
`headVersion`; extension details contain pinned `{id,version}`, actor/time fields
and the independent dimensions above. Reads never resolve credentials or raw
configuration. Cross-node resource IDs return safe 404. Unknown nested/body/query
fields reject, including ownership, identity, readiness and internal runtime keys.
UUIDs normalize lowercase. Version inputs are positive integers through 2147483647;
version path values are strict decimal strings.

`InventoryDependencies` contains exact `profileId`, `profileVersion`,
`expectedProfileHead`, `expectedNodeVersion`, `expectedCapabilityRevision`.
Create/preview/adoption require all five. Profile create/version require node and
capability expectations; version-create also needs `expectedVersion` for head.
Status edits need only expected extension version and `administrativeStatus`.
All mutation/preview queries must be empty. New intent writes return 201, immutable
original-result replay 200; reads/preview/edits return 200. A canonical no-op leaves
business version/audit unchanged. An intent-bearing no-op profile version retains
its result receipt without adding a business audit.

400 returns fixed `fieldErrors`; 404 returns fixed missing-resource text. 409
reasons: `number_conflict`, `request_conflict`, `stale_version`,
`dependency_changed`, `profile_name_conflict`, `inventory_ineligible`,
`intent_expired`. Number conflicts include at most ten canonical numbers, total
and truncated flag. Existing safe 401/403/429/503 contracts apply; 503 includes
`Retry-After: 1`. Oversized or malformed JSON uses existing bounded parser errors.
No request, configuration, provider path, database detail or stack trace is echoed.

## Atomicity, bounds and recovery

Bulk has one node/kind/profile and either `numbers` or inclusive step-one
`range:{start,end}`, never both. Expand 1–50 canonical numbers, reject duplicates
before deduplication, sort numerically. Preview is advisory and writes nothing.
Commit revalidates dependencies and conflicts. Any invalid row, collision,
dependency change or required-write failure rolls back the entire set. Individual
creation uses the same path. Never skip conflicts or choose substitute numbers.

Lock order: canonical authority → scoped intent → node SHARE → capability SHARE →
profile head SHARE (UPDATE for version writers) → sorted node/number advisory
locks for creation, or exact extension UPDATE for edits. Profile name locks use
PostgreSQL lowercase folding. Final unique/FK constraints protect persistence.
Unrelated numbers on one node share dependency locks and can commit independently.
Audit and durable intent use the same existing Transaction handle. There is no
external-effect consumer, outbox item, observer refresh or speculative worker.

Every actual business change adds one `telephony.inventory.desired-changed` audit.
Target is node-scoped `extension-inventory`; metadata carries fixed change enum,
node/profile/version, desired version, count and exact sorted UUIDs as
`extension1`…`extension50`. This uses the existing flat typed audit contract and
4096-byte metadata bound without extending the audit owner. The 50-row audit
identifies the entire committed set, with no secrets or raw requests.

JSON body ceiling 4096 bytes; output ceiling 64 KiB. Lists use UUID keyset order,
default 25/max 100 and may shorten a page to fit the byte ceiling. `nextCursor`
continues after the last included ID. Error detail is bounded; one fixed validation
field at a time. Receipts cap safe result at 16 KiB before commit and in SQL.
Bulk receipts store operation ID, node/profile/version and exact `{id,number,version}`
items; individual/profile receipts store their original safe detail response.

Intent UUID keys are scoped by canonical operator and operation
(`extension-create`, `bulk-create`, `profile-create`, `profile-version`). SHA-256
fingerprints cover canonical allowlisted fields, sorted numbers, exact node and
dependency versions. Receipt inspection precedes current dependencies: unchanged
canonical replay returns the original result even after later edits. Changed
payload conflicts. Expiry is 30 days using database time; a retained expired key
returns `intent_expired`. Only trusted deployment can prune expired receipts;
inventory, profile history and audit remain retained. Once pruned, the guarantee
has ended; canonical reload/review is required before any new operation.

Lost create/profile/bulk COMMIT or HTTP responses require explicit retry of the
same immutable intent or canonical reload/review. A 503 does not prove rollback.
Changed data must use a new reviewed operation. Uncertain non-intent edits require
canonical reload/review, never automatic replay. Re-enabling does not disconnect
or reconnect devices, issue credentials, establish readiness or permit calling.

## b/c handoffs

`InventoryVersionPort.lockUnallocated(tx,nodeId,extensionId,expectedVersion)` checks
canonical node, locks the exact node-qualified extension FOR UPDATE, rejects stale
version/missing/foreign-node resources and enforces current unallocated inventory.
b must first authorize its principal on the same transaction. It must retain this
row lock while updating its approved credential generation/reference plus desired
version and audit through the existing transaction. No provider metadata or
credential-operation schema is invented here before G-02. Future allocation
owners must use the same node → extension lock and add their canonical ownership
checks to this port; they may never clear foreign ownership to allow mutation.

c receives these safe DTOs/routes, dependency tokens, bounded preview, original
receipt replay and uncertain-edit recovery behavior. c owns named forwarding,
actual browser accessibility/recovery and exact passive observation joins.
Generated keys remain internal. P3-U5 owns default-deny rendering, live collision
checks/apply, media/listener/trust verification and external fencing. P4 owns
allocation/assignment and real tenant calling eligibility. a completion establishes
none of those outcomes. [Verification evidence](../status/p3-u2a-evidence.md).

P3-U2b's [conditional development approval](../planning/p3-u2b-credential-contract-review.md)
now defines G-02. Its implementation reuses this exact version port and adds safe
configured generation IDs to inventory DTOs. [Credential lifecycle](endpoint-credentials.md)
records the separate provider/worker boundary. b remains incomplete until its real
acceptance evidence passes; this addendum does not authorize c or P3-U5 progression.
