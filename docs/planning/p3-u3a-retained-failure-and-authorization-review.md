# P3-U3a — Retained failure plan and proposed maintenance authorization

2026-10-20 (Asia/Manila, +08:00). **Draft for separate review, not an execution request or authorization.**
The current permission is investigation, disposable testing and non-disruptive
verification only. No retained login, custody search, privileged inventory capture,
policy/role/token change, networking/storage change, restart, restore, root recovery,
SIP/PBX activation or deployment is performed by this document.

The owner replied that they cannot yet verify or answer whether an existing
snapshot/maintenance mechanism is available, and requested inclusion in the
approval review. This records **unverified availability**, not absence and not
approval of the exception. The decision is explicitly held for review below.

## Backup-first authority and alternatives

The reviewed native human policy can list/accessor-inspect/revoke tokens and
create/read/update `endpoint-*` and `trunk-*` policies/roles. It cannot snapshot,
delete those objects, read arbitrary identity/group/auth mappings, or edit its own
`platform-deployment-maintainer` policy. Its token's effective identity-policy
list is not a complete current inventory of all entities/groups/future login
mappings. These facts come from reviewed source and disposable evidence, not a
fresh retained authority audit.

Therefore **the known human mechanism alone cannot satisfy backup-first**. That
is not evidence that no other authorized snapshot reader, scheduled backup or
maintenance principal exists. Their existence and availability remain unknown;
current restrictions prohibit expanding protected custody discovery. It would be
incorrect to justify the bootstrap exception by declaring those alternatives
absent. Before requesting the exception, the owner must either provide an existing
independently authorized route or document why the practical routes below are
unavailable or insufficient. An independently authorized inventory reader/export
is also needed before any bootstrap; no extra inventory privilege is silently added.

| Practical route | Backup-first and operational risk | Current disposition |
| --- | --- | --- |
| Existing authorized native snapshot reader plus exact policy maintainer | No pre-backup grant changes; encrypted full snapshot and administrative custody still require protection | Preferred. Owner supplies/attests the identities, authorized custody and available scope; not sought or assumed here |
| Existing snapshot reader plus current human prefix authority, with a new ticket created only after backup | Obtain the native snapshot/audit gate first, then approve temporary maintenance policy/role/grant entirely after backup; an already-existing maintenance identity is not required for this route | Practical preferred alternative if a reader is available. It needs an exact post-backup-only manifest, not the pre-backup exception |
| Existing independently managed backup/maintenance job or operator | Can satisfy the gate only if authorized to obtain a new compatible native snapshot, preserve audit and prove freshness/integrity/restoration prerequisites | Owner may supply evidence/access through the already authorized workflow; do not change that job or assume its snapshot is current |
| Existing backup artifact | Avoids new privilege, but an old pre-succession or pre-revocation snapshot can revive authority and does not meet the new current-state backup gate | Not a substitute without an explicit change to the gate and separately reviewed reconciliation |
| New three-write, five-minute rootless bootstrap | No retained restart or storage change, but creates snapshot authority and a minting route before a fresh backup; interruption can leave objects or unknown tickets | Conditional exception candidate only; exact scoped draft is linked below; absence of a better route is unestablished |
| Offline volume copy or filesystem snapshot | A running copy is not automatically a consistent native Raft backup; quiescence/shutdown and validated storage semantics can introduce downtime | Not authorized. No filesystem copy or provider shutdown is performed |
| Upgrade/repair/migrate to another provider or restore to new retained storage | Could address provider defects but introduces version/custody/material/lease migration and cutover risk | Separate project/approval, not a fallback under maintenance permission |
| Wait without changing retained authority | No new privilege or mutation; known lifetime weakness and ordinary token expiry/reprovisioning constraints remain | Current safe default while authority/acceptance prerequisites are unmet |

An existing snapshot reader alone can be sufficient to avoid the exception: after
its backup and audit checkpoints are valid, the known human's prefix authority
can create a maintenance-only policy/role and constrained issuer grant. That
variant has no need to grant the ticket snapshot access or perform a later
snapshot-to-maintenance elevation; all temporary privilege writes happen after
backup. It still needs explicit authorization and a reviewed variant manifest,
and does not supply the missing complete inventory by itself. No automatic route
switch or credential discovery is authorized by this comparison.

The exception trades three tightly enumerated pre-backup writes for availability
of the backup itself. It cannot offer the same rollback assurance as an existing
reader, and its initial snapshot can contain a temporary ticket. The authorized
human already has powerful prefix administration; the manifest does not turn
human approval into an immutable provider boundary. No exception is recommended
for immediate execution while inventory, existing-route availability, durable
restore prerequisites and runtime/helper compatibility remain unresolved.

### Decision explicitly submitted for review

The owner is asked to review the alternatives and the conditional scope, not to
approve an immediate operation on an unsupported claim that no reader exists.
Availability of an existing authorized mechanism remains an execution gate.
Approval of this document as design evidence would authorize no custody search,
retained login or configuration write. Any later authority-verification request
must identify the mechanism/custody boundaries, exact permitted reads and any
session issuance/revocation before it can be approved; none are inferred here.
If that verification establishes a usable snapshot reader, prefer the fully
post-backup maintenance variant. If practical routes are shown unavailable, the
owner can separately weigh the exact three-write exception and the manual-review
states in this proposal. If availability remains unknown, execution stays blocked.

## Exact proposed scope, distinct from security acceptance

The [retained authorization draft manifest](p3-u3a-retained-maintenance-authorization-draft.json)
is generated from the accepted [rehearsal manifest](p3-u3a-rootless-maintenance-rehearsal-manifest.json),
with a new proposed operation UUID, exact temporary names/paths, full baseline and
bootstrap bodies/hashes, ticket request/role, final base64 bodies and cleanup
paths. It contains no credentials. Reserving a name is not creating an object.
The original three expected hashes are still historical baselines; current
matching and absence of temporary objects must be established by independently
authorized inventory before any retained action. An unknown or mismatched object
stops execution rather than being overwritten.

If the owner later approves this exact draft after its prerequisites are met:

1. One attended native human session, maximum 900 seconds, and one existing
   separately authorized endpoint issuer may mint at most one operation ticket.
   No generic issuance, issuer credential replacement, new administrator, auth
   change or root recovery is included. Password/token custody is protected and
   never passed through argv, environment, logs or application mounts.
2. The separately approved exception would allow precisely three pre-backup
   configuration writes: create the snapshot-only policy; create its exact role;
   append the complete-array, literal five-field `300s` ticket grant to the known
   endpoint issuer body. No material-policy, existing role or ordinary lease change.
3. Obtain a **new** native snapshot and an independently captured audit prefix
   through a complete-record boundary, durable exclusive writes, fsync, hashes,
   bounded validation and later append preservation. Verify separate seal/TLS
   custody and isolated restore/decryption prerequisites. The disposable tmpfs
   rehearsal does not prove durable storage or decryption. Both snapshot and audit
   checkpoints are mandatory; neither alone authorizes elevation.
4. With both checkpoints valid, one exact temporary-policy elevation grants read
   only through three native policy aliases, exact base64-constrained updates to
   the three target policy paths, self lookup/revoke, and deletion only of the
   operation's role/policy. Before each update, compare exact recognized current
   bytes/hash; endpoint's pre-write body includes the approved ticket append.
   Write and independently read back all three final bodies. No automatic rollback.
5. Perform the separately bounded validation in the draft: at most the 14 exact
   positive issuance requests and their 434 known parameter-negative requests.
   Successful outputs are test-only, stored privately and revoked with exact
   accessor accounting. An unexpectedly issued negative token is revoked and
   stops acceptance; it does not widen the test budget. No temporary issuer is
   installed as retained custody, no material import or SIP contact occurs, and
   ordinary existing tokens/leases are not revoked to force a pass.
6. Remove the exact temporary role, then its policy, using the still-live ticket;
   afterward the still-authorized human revokes the known ticket accessor and
   verifies accessor absence. A 403 self lookup caused by policy deletion alone
   is not revocation proof. Revoke owned test tokens and the human session, verify
   all temporary issuance grants are absent, and remove only owned private files.

This is nine planned configuration writes (three bootstrap, one elevation, three
final policies, two temporary deletes), plus explicitly bounded authentication,
issuance/test-token revocation and backup/read operations. An early failure can
stop before nine; containment writes are separately enumerated below and must be
included in the later approval: at most one known-grant removal and one additional
exact delete retry per temporary path. The manifest permits one human session
and one maintenance ticket; test issuance is capped at 14 positives and at most
one unexpected negative token before stopping. No repeat ticket, automatic retry with a fresh
operation, extra grant, root recovery, restart, restore or schema/app deployment
is included. Retained owner/API integration is a separate approval boundary.

The current fixed-issuer replacement helper still expects the old generated policy
bodies and would refuse the hardened bodies. That refusal must remain intact.
Prepare and verify a separately reviewed exact-body-compatible helper before
execution; do not bypass its preflight or claim the direct fixture calls establish
helper compatibility. The experimental application deadline likewise has no
production composition or finalization integration yet.

The manifest's policy hash read and update are separate requests, not an atomic
compare-and-swap. Independently established exclusion of other administrative
writers is a prerequisite for the attended window; an accessor list alone cannot
prove that no new writer can log in. Without that control, the read/write race is
an unresolved overwrite risk and execution must not proceed. Immediate readback
is detection, not a substitute for exclusion.

The five-minute ticket also needs a measured backup/validation/cleanup time budget
against actual protected data size and destination throughput. The small tmpfs
fixture does not establish retained performance or durable storage capacity.
If the remaining deadline cannot cover the next step plus cleanup, stop and
contain rather than extend the ticket or silently shrink the verification matrix.
The operation can leave inert or partly hardened states even with correct clients.

Only the tokens expire automatically. The temporary policy, role and issuer grant
have no lease and do not disappear at five minutes. If the human becomes
unavailable before removing the grant, an existing issuer with that effective
permission can continue minting new tickets during its remaining authority. After
policy elevation those tickets inherit the current maintenance policy. The
one-ticket budget is an authorization limit, not a provider-enforced issuance
quota. Protected issuer custody, attended execution and prompt grant removal
remain essential. A persisting mint grant is **uncontained**, not an inert object;
waiting for one known ticket to expire does not resolve it. Inert-object wording
applies only after grant absence and token/accessor accounting are established.
Unknown issuance or unavailable inventory remains unresolved manual review.

## Failure detection, containment and manual-review states

Every write uses a durable operation intent, exact path and expected old/new hash.
Lost acknowledgment means unknown completion. Inspect current bytes through an
already authorized read path; never replay an unqualified create or blindly restore
an old broad policy. The endpoint issuer may be only the reviewed original body,
original plus exact ticket grant, or final hardened body. On known original-plus-grant,
the approved containment write removes **only that grant**. Final hardened bytes
are preserved; they must not be replaced by the old permissive baseline. An unknown
body or unavailable read requires manual review and no write.

Save an issuance accessor exclusively in protected custody before continuing.
If issuance succeeds but its acknowledgment/accessor persistence is lost, the
human may use its existing accessor-list/lookup authority to identify tokens whose
sole policy is the unique operation policy, whose creation window is exact and
whose other attributes match the approved request. Revoke only uniquely established
owned accessors if the later approval explicitly includes that recovery. Ambiguity,
inaccessible inventory or an unknown accessor stops automatic cleanup. Removing
the mint grant prevents new tickets; waiting 300 seconds alone is not verified
revocation given provider expiry behavior. Recheck under authorized authority or
record unresolved accessors for manual review. Never read arbitrary protected custody.

| Interrupted state | Authorized containment in a later approved window | Cleanup limit / separate manual review |
| --- | --- | --- |
| Before any write, inventory mismatch or no backup route | Stop; revoke an owned human session if present; preserve safe evidence | No new grant, repair or escalation |
| Snapshot policy only, or policy plus role without grant | No ticket has been deliberately issued; leave objects unused | Human lacks delete. Inert objects remain for separate cleanup approval; do not elevate without backup to delete them |
| Grant present; issuance absent or uncertain | Remove only the known append; account for uniquely owned accessors as above | Unknown response/accessor or incomplete inventory requires manual review; no automatic replacement ticket |
| Ticket issued; snapshot or audit copy fails, corrupts or is unstable | Remove known grant, revoke known ticket accessor, retain evidence; do not elevate | Policy/role may remain inert. No root or extra delete grant; unknown revocation stays unresolved |
| Snapshot valid, audit gate not valid | Same as failed backup; snapshot alone permits no elevation | Preserve protected artifact; do not relabel it a complete backup |
| Both backup gates valid; elevation result uncertain | Human reads exact temporary policy and compares initial/final manifest bytes | If known elevated ticket is still valid, approved cleanup-only delete is possible; unknown bytes or expired ticket require review |
| One/two target bodies committed, or acknowledgment lost | Read exact target states, stop further issuance; preserve committed hardening and remove grant only if still present | Continuing or policy rollback requires a separately reviewed decision. Old bytes reintroduce the vulnerability; no automatic partial rollback |
| All targets final; temporary role delete uncertain | Read exact role/target state; with valid delete authority retry deletion of only that known role | If ticket expires/revokes, human cannot delete the objects; leave inert and seek separate cleanup authority |
| Role gone, policy still present | If ticket still valid, delete exact policy, then revoke known accessor with human | If ticket is unusable, no fixture root fallback; remaining policy requires manual review |
| Policy deleted; self lookup/revoke now 403 | Human revokes the saved exact accessor and verifies authoritative accessor lookup failure | 403 alone is insufficient; if human expired/unavailable, revocation is unresolved until separately authorized follow-up |
| Ticket expires or revokes during maintenance; human remains live | Stop target writes, remove known mint grant if necessary, verify/revoke known accessors | Do not remint, append a new grant or elevate another identity. Inert/partial state remains for review |
| Human expires, process/host lost, storage unavailable or authority/clock uncertain | Stop; preserve operation/backup/audit metadata and observed state | Automatic cleanup cannot be promised. Fresh attended authority and an explicit continuation/cleanup approval are required |

Containment authority is limited to the known issuer grant removal and exact owned
accessor revocations, plus temporary role/policy deletion when both backups were
verified and an existing ticket still has that delete permission. It does not
include deleting material, revoking ordinary leases, changing auth/groups/users,
repairing unknown policies, or granting a replacement cleanup identity. No row
depends on initialization root. The disposable fixture's janitor is not an
available retained recovery mechanism.

## Restoration boundary and prerequisites for a later request

Normal failure response is stop, qualify exact current state, contain known ticket
issuance and preserve evidence. Policy-only rollback is a separate, exact prior-body
change with independent authorized maintenance; it reintroduces the lifetime
finding. Full Raft restore is disruptive and excluded. A future restoration plan
must first preserve original volumes/config/audit, restore into an isolated matching
provider, prove independently held seal/TLS custody and decryption, enumerate
revived credentials/accessors/leases, retain post-backup audit, and separately
approve cutover and exact revocation. Never automatically restore or generate root.

A retained execution request remains premature until the owner establishes the
existing-route decision, independently authorized current complete inventory,
reviewed maintenance timing and exact-body-compatible helper, explicit residual
provider-failure disposition,
protected durable backup/audit capture and isolated restore prerequisites, sufficient
attended time/authority and explicit tolerance of manual-review/inert-object states.
The proposed operation does not itself satisfy real trunk owner/binding HTTP/SQL,
retained integration or production security acceptance.

Maintenance authorization and end-to-end security acceptance are separate decisions.
A later narrowly scoped policy hardening can be reviewed while production
application-deadline/finalization integration is unfinished, if the owner explicitly
accepts the remaining native 500/precision risks for that maintenance-only action
and all authority/backup/inventory/timing prerequisites above are satisfied. It
would not authorize runtime rollout, calling or an acceptance-pass claim.
Production clock calibration, application recovery/finalization composition and
required real integration remain separate prerequisites for security acceptance,
not an invented requirement to deploy the prototype before improving provider
request constraints.
