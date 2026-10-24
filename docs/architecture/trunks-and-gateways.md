# Desired trunks, gateways and DIDs

P3-U3a implements the IP-peer portion of the [replacement parent](../../context/feature-specs/p3-u3-development-resource-management.md).
These definitions are passive desired state. No resource operation resolves DNS,
probes a destination, accesses OpenBao, contacts Asterisk or performs registration,
reload, live apply, routing or tenant allocation.

`packages/contracts/src/trunk-gateways.ts` publishes DTOs and create/edit/status/removal
inputs. Resources have immutable node/installation UUID ownership, server identity,
name, desired enabled flag (false initially), version and actor/timestamp fields.
Trunks accept inbound/outbound/both, host/IP, numeric SIP port, UDP/RTP, ulaw/alaw,
direct media false, symmetric RTP/force-rport true and `ip-peer` authentication.
IP-peer credential status is `not_required`. P3-U3b adds desired outbound digest,
optional registration and explicit selected versions; see the
[simple credential contract](trunk-credentials.md) and its acceptance state.
Gateway kinds are `sip-provider` (requires an inbound-capable trunk) and `sip-device`
(optional trunk). Links must belong to the same canonical installation/node.

The PostgreSQL owner is the telephony module: `sip_trunks`, `sip_gateways`,
`sip_gateway_sources`, `sip_dids` and `sip_peer_receipts`. The additive migration retains all
existing tables and credentials. Restrictive ownership foreign keys, typed checks,
partial case-insensitive name indexes and exact source indexes back application
validation. Runtime has no resource DELETE or receipt UPDATE permission. Soft
removal retains UUIDs, actor attribution, settings, last sources and audit history.
Removed records remain available by ID but leave current lists and uniqueness claims.
Removed UUIDs never retarget when names/addresses are reused.

Source inputs accept 1–32 exact IP hosts. IPv6 compresses to canonical form;
IPv4-mapped IPv6 normalizes to IPv4 so alternate spellings collide. Subnets,
zone IDs, DNS names and wildcard matching reject. Disabled gateways retain claims.
The existing nonsecret PBX catalog accepts optional `unmanagedIngress: string[]`
per installation (up to 100 exact addresses). It reserves those addresses during
save. Omission means no deployment-declared unmanaged sources; it does not assert
live PBX coexistence. Existing bootstrap has no configured ingress peers; P3-U5
must check actual coexistence before apply.

All writes revalidate platform authority in their transaction and acquire the
canonical node row `FOR UPDATE` before reading references or changing resources.
Independent HTTP replicas therefore serialize name/source claims, gateway links,
trunk edits and removals. `PeerRepository.blockers` is the narrow dependency boundary:
current nonremoved gateway references block trunk removal and connection-setting
changes, including disabled gateways. Switching a provider-referenced trunk to outbound-only
also rejects; device links impose no provider-only direction restriction. Name-only, compatible inbound-direction and outbound credential/version/registration
edits can proceed. Outbound credential adoption does not change gateway ingress identity.
P3-U3c extends this boundary with actual nonremoved DID references (including
disabled DIDs), which block gateway removal and changes to kind, trunk or source
addresses. Name and desired-status changes remain compatible. DID creation and
ingress edits take the same node lock before validating a nonremoved gateway.
Database foreign keys also enforce the exact gateway/node/installation identity.
No applied-use, allocation, active-call or routing owner exists in this resource
model today; those owners must register real dependencies before consuming IDs.

The same transaction commits resource/version, sources, actor audit and create
receipt. Canonical no-ops retain version and produce no business audit. A create
request UUID is scoped to the operator across all three resource types and installations.
An advisory transaction lock coordinates its SHA-256 canonical-intent receipt;
same intent replays its original result, changed intent returns `request_conflict`.
Receipts expire after 30 days and return `intent_expired`; no cleanup job is added.

## HTTP and browser contract

All routes require the existing platform-cookie channel, platform operator permission,
source/proxy checks and mutation CSRF behavior. GETs are passive, uncached primary
snapshots. Body/query unknown fields reject. The named Next forwarder bounds bodies
and responses, validates exact DTO shapes and sanitizes errors. No credential material
is accepted or emitted.

Base: `/platform/pbx-nodes/:nodeId/peers/:kind`, where kind is `trunks`, `gateways` or `dids`.

| Method/path         | Behavior                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| GET base            | `items`, `nextCursor`; UUID `after`, limit 1–100, default 25; also bounded to 64 KiB. |
| POST base           | Create with `requestId` and all resource value fields; enabled defaults false.        |
| GET `/:id`          | `{resource}`, including retained soft-removed history.                                |
| PATCH `/:id`        | Full value edit with `expectedVersion`; ownership/enabled cannot be changed here.     |
| PATCH `/:id/status` | `{expectedVersion, enabled}` desired status.                                          |
| POST `/:id/remove`  | `{expectedVersion}` soft removal.                                                     |

Create returns 201, replay/edits/no-ops return 200. Invalid input returns 400 and
field errors; missing/removed mutation targets return 404. Conflicts return 409
with `stale_version`, `name_conflict`, `source_conflict`, `invalid_trunk`, `referenced`,
`reserved_source`, `invalid_credential`, `number_conflict`, `invalid_gateway`, `request_conflict` or `intent_expired`. Reference errors include
up to ten blocker IDs/names. Authority failures use established 401/403 behavior;
service/uncertain transaction failures return 503 without internals.

PBX detail links to `/pbx-nodes/:nodeId/peers`. The console supports paged lists,
create/detail/edit, enable/disable and confirmed removal. Safe input and exact create
attempts use the existing canonical-owner mounted work storage; refresh is not durable
recovery. Callbacks are fenced by operator epoch and active resource scope. Validation
preserves input. Stale/uncertain edits require canonical reload and explicit current
version selection. Unknown creates can retry their exact request ID. Definitive 403/429 rejection releases the attempted mutation and honors bounded
Retry-After; ordinary validation/access correction resumes through existing session
recovery. A 401 may follow a committed write when post-success session renewal
fails, so that outcome retains canonical review/exact-create recovery.

Deployment applies this additive migration through `./dev migrate` before starting
updated HTTP replicas. Rollback can stop the new consumers while retaining tables;
there is no destructive down migration. P3-U3b extends the same trunk DTO/forms and
P3-U3c extends gateway dependencies and delivers DID management; see the
[operator workflow](../runbooks/did-inventory.md).

## DID reference and number contract

DID values are `{name, number, gatewayId}`. Use the same bounded CRUD/status/removal
routes, receipt namespace and audit event (`resourceKind: dids`). DID credential
status is `not_required`; responses contain no credential material. Canonicalization
trims outer whitespace and removes only ordinary spaces, hyphens and parentheses.
An optional leading `+` and 1–15 ASCII digits remain; leading zeros and plus are
significant, with no country inference. Partial unique indexes reserve exact number
and case-insensitive name per installation among nonremoved DIDs, including disabled
records. PostgreSQL independently rejects noncanonical numbers. Lists exclude removed
DIDs; detail/receipt/audit retain the old ID and gateway reference. New identities may
reuse released numbers/names. Later routing must deliberately handle alternate forms.

All three resource types share node serialization and transactional audit. Real
references therefore cannot commit against a concurrently removed gateway/trunk.
Future routing/apply/tenant consumers must add actual dependency checks here before
live use, acquire the same node lock, and never cascade or retarget retained IDs.

P3-U4a adds [group/reservation coordination](ring-groups.md) on the same canonical
node lock, with a database namespace exclusion index shared by extension writes.
It adds no inbound/outbound rule references yet. P3-U4b/c must register their actual
gateway/DID/trunk blockers here before consuming resources; saving unbound groups
establishes no tenant ownership or live use.

P3-U4b registers [actual inbound references](inbound-routing.md) in this boundary.
Disabled rules block DID selector edits/removal and gateway structural edits/removal;
name/status changes remain compatible and node serialization remains mandatory.
