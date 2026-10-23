# P3-U3a — Sustainable OpenBao backup and maintenance design

Prepared 2026-10-20; direction approved 2026-10-21 (Asia/Manila, +08:00).
**Design direction only; no retained implementation approval.**
Source: owner's **Acceptance of Custodian Capability Verification Results and Next
Direction**. No retained login, protected inventory/custody access, permanent
credential creation, policy change, backup capture, restart or restore is authorized.
The owner approved the two-capability direction, existing-route preference and
native AppRole fallback for disposable validation. Lifetime/use/rotation values
require practical testing and later configuration approval. See the
[minimal installation-authority and backup package](p3-u3a-backup-installation-approval-package.md)
and its exact review-only manifest. Installer, actual destination and independent
key custody remain unresolved; no backup-first exception is approved. The owner
has not identified these facts and requested recommendations.

This is the consolidated preferred administrative design; earlier temporary-ticket
and pre-backup-write manifests remain historical, unapproved contingencies.

## Decision and verified starting point

Keep the functioning `platform-owner-custodian` account unchanged. Close its named
capability-verification checkpoint as **successfully completed and owner-accepted**:
all expected identity/lifetime assertions and ten capability sets matched, session
revocation was acknowledged and confirmed by 403. Both session authorizations are
consumed. See the [final evidence and limits](../../../../../status/p3-u3a-retained-capability-session-2.md).
The account functions with its intended restricted permissions on the verified
paths; it cannot capture snapshots or edit `platform-deployment-maintainer`.
This is not a complete privilege inventory, ongoing authorization to log in, or
proof of backup readiness. Other backup/maintenance authority is **unknown, not absent**.

Prefer an existing authorized backup job/operator and maintenance route when the
owner independently identifies them through approved operational information.
Accept non-secret principal/job name, responsible custodian, approved mechanism,
snapshot/audit scope, destination and last success/restore evidence. Do not search
credentials or protected inventories. A name or old successful run alone does not
establish usable current authority; exact named access needs its own approval.

If no suitable route can be established, review two stable capabilities: a dedicated
snapshot-only workload identity and separately controlled attended maintenance.
Use one host-managed scheduled job and the existing native provider, not an
additional orchestration service or recurring create/elevate/delete ticket scheme.
Keep application credential consumers, backup and administrative custody separate.

## Capability and control boundaries

Names below are proposals, not existing principals or installed configuration.

| Capability | Proposed authority | Custody and exclusions |
| --- | --- | --- |
| Existing `platform-owner-custodian` | Existing intended restricted permissions only; future attended work separately authorized | Existing protected personal custody; no new snapshot, self-policy or generic administrative grant |
| `platform-raft-snapshot-reader` | `read` on exact `sys/storage/raft/snapshot`; self lookup/revoke; capability self-query for bounded preflight | Dedicated job identity; no secret KV read/list, inventory, child issuance, policy/role/auth edits, snapshot POST/force-restore or renewal |
| Host audit collector | Read only the exact configured audit file/closed segments and safe deployment manifest through OS permissions | No OpenBao bearer or seal key; no audit truncate/replace, provider data-volume access or API audit reconfiguration |
| Archive uploader | Restic backup of age ciphertext to its scoped append-only repository; verify commit/integrity | Can read repository ciphertext; no provider bearer/network, age private/seal keys, data delete/overwrite/prune, maintenance credential or direct storage mount |
| Attended deployment maintenance | Independently authorized metadata inspection and named maintenance targets described below | Separately unlocked human custody; no self-policy/auth edit, generic issuance, material read, restore, root or unattended human login |
| Recovery/restore operator | Only the exact isolated test or incident scope later approved | Offline recovery custody and separate restoration authorization; neither backup nor routine maintenance can restore |

A native snapshot contains the full encrypted cluster state, including endpoint
and trunk material and administrative state; it cannot be scoped to one
installation by granting only this endpoint. Treat possession as highly sensitive,
keep decryption/seal custody separate and do not describe the reader as an ordinary
application role. The lack of a KV-read grant does not make its backup harmless.

The snapshot API's GET captures Raft state while POST restores it, so the proposed
backup ACL grants `read` only. Native API behavior must also pass real negative
tests on pinned 2.7.1 before any retained installation. See the
[OpenBao Raft API](https://openbao.org/docs/api/system/storage/raft/).

## Backup identity and credential lifecycle

Reuse an approved existing workload authentication mechanism if suitable. If none
is supplied, the concrete fallback for review is **one native AppRole at a dedicated
backup auth mount with one snapshot-reader role**. This avoids scheduled use of the
human password and daily manual replacement of a permanent backup bearer. AppRole
separates the role identifier from the protected SecretID and can issue bounded
tokens; see [native AppRole authentication](https://openbao.org/docs/auth/approle/).
No new external identity provider is required for this private-development proposal.

Proposed bounds, to validate in a disposable fixture before an exact install plan:

- Each run authenticates once for a service token with only the backup policy,
  no default/identity policies or period, 300-second initial and explicit maximum,
  and no renewal permission. The auth role must actually yield the reviewed
  attributes; helper validation alone is insufficient. No child tokens.
- Keep the role identifier and expiring SecretID in owner-only host service
  credentials outside source, application mounts, environment and logs. Proposed
  SecretID lifetime: 30 days, rotate at least seven days before expiry. A finite
  multi-use SecretID supports the scheduled jobs during that interval; the exact
  use budget must cover cadence and pre-change runs without allowing self-issuance.
  Review fixed source-network restrictions where the actual topology supports them.
- The snapshot-reader cannot mint or rotate its own authentication credential.
  A separately attended, approved operator creates a successor for this exact role,
  stages it exclusively, tests one scoped login, installs it and destroys the old
  SecretID by its protected identifier. Account for all test tokens and confirm
  revocation. Destroying the SecretID is not assumed to revoke previously issued
  tokens: those require exact cleanup or independently established expiry.
- No unbounded bearer or renewable periodic token. Rotation is an explicit
  administrative task, not an automatic grant expansion. Alert on impending
  SecretID expiry; expiry pauses backup and blocks maintenance requiring fresh backup.
- Validate TLS, identity, absence of extra policy/period, type and issued bounds
  before snapshot I/O. Revoke the owned token after download and confirm denial
  before upload/retention processing. A lost authentication reply or uncertain
  cleanup alerts and suspends automatic authentication pending reviewed resolution;
  no blind login retry, alternate credential or root fallback.

These are proposed future standing-job permissions. They do not reuse or extend
either consumed human-session authorization. The existing runtime one-hour initial
leases and 86,400-second configured maxima remain unchanged.

## One scheduled backup job with separate custody

Prefer an existing host scheduler; otherwise propose a systemd timer. It launches
bounded helpers, not a new continuously privileged application service. A trusted
host supervisor may start isolated containers; no helper receives a Docker socket.

1. A snapshot helper receives only the exact backup authentication input, server CA,
   private provider network and a protected output directory. TLS hostname/CA
   verification is mandatory. It downloads a new native snapshot; it does not copy
   a live Raft filesystem or fetch any KV secret. Initial limits can reuse the
   existing 30-second/128-MiB download bounds; size/time growth requires measured
   adjustment in the concrete plan rather than indefinite sessions or disabled TLS.
2. Preserve the exact audit stream separately through the host collector. Capture
   complete newline-delimited records up to recorded inode/byte boundaries, retain
   every intervening closed segment and continue forwarding appended records.
   Record continuity and checksums, including records for the backup and cleanup
   where applicable. Detect rotation, replacement, truncation or gaps; do not
   represent a partial copy as a complete audit checkpoint. Never truncate the
   active log, disable audit, or use copy-truncate as the continuity mechanism.
3. Save safe deployment configuration, image digest/version and required management
   scripts in a recovery bundle. Sensitive TLS/private configuration belongs in a
   separately encrypted protected bundle. Seal/unseal/recovery custody stays
   independent and is never copied into the routine backup set. Record only who
   can supply it and how its availability was verified under separate approval.
4. Write unique files exclusively, enforce 0700/0600 custody, fsync and verify archive
   structure/member checksums/index/term using the existing snapshot-validation
   pattern. These checks prove transfer/integrity, not decryptability or restoration.
   A bounded encrypted staging directory is outside every application/source mount;
   no bearer, SecretID, password or accessor enters its public manifest.
5. After provider session cleanup, a separate uploader with no provider access sends
   age-encrypted artifacts through Restic to the approved append-only Rest Server
   repository (same-host development permitted; independently administered physical
   backup host/NAS required for production).
   Verify remote completion and stored-object integrity before declaring success.
   Keep a protected manifest tying snapshot, audit boundaries, configuration version,
   encryption-key version and upload acknowledgement to one backup run. Public
   status contains time/age, counts and success/failure only.
6. On failure, leave the prior successful remote backup intact, quarantine partial
   artifacts, report the exact failed stage and do not overwrite an earlier set.
   Failed/uncertain backup blocks privileged maintenance; no policy write is used
   to repair backup access during the same run. Resume only within reviewed scope.

OpenBao distinguishes encrypted persisted state from configuration/scripts that
must also be recoverable; current documentation supports external scheduled
snapshots rather than a built-in scheduler. This proposal preserves the existing
single-node setup and does not claim HA. See
[OpenBao backup guidance](https://openbao.org/docs/concepts/storage/).

The configured file audit device's data is outside the Raft data volume in this
repository. Backup the stream explicitly and keep `log_raw=false`; HMAC-obfuscated
logs still contain sensitive metadata. Audit failure must alert rather than be
silently bypassed. A later second audit device is a separately reviewed availability
improvement, not a prerequisite to adding another service now. See
[OpenBao audit behavior](https://openbao.org/docs/audit/).

## Approved Restic storage, retention and operating targets

The owner's final 2026-10-21 (Asia/Manila, +08:00) decision standardizes Docker
Restic + append-only Rest Server for development and production. It supersedes B2
and SeaweedFS preferences. The [authoritative backup security contract](../architecture/backup-platform.md)
defines placement, custody, operations and acceptance. Same-host development
accepts shared host/disk/admin failure risk. Production requires an independently
administered physical backup server or NAS, restricted network, authenticated TLS,
capacity monitoring and an additional independently protected recovery copy or
equivalent reviewed backup-host-compromise safeguard. Garage is unchanged.

The owner explicitly accepts no reliable server-enforced timed COMPLIANCE
retention. Timed immutable retention is a future enhancement, not an initial
acceptance blocker. Ordinary clients cannot overwrite/delete/prune existing data;
lock deletion is the narrow Restic protocol exception. Separately controlled
attended administration reviews preservation windows, trusted capture receipts and
suspicious snapshots before pruning. Server/host administration can bypass
append-only mode and therefore needs separate protection. Writer ciphertext read,
garbage/capacity and lock interference risks remain explicit.

Keep the same native snapshot/separate audit/age-encrypted archives and manifests
across environments. Recoverable repository credentials and independently held
age private keys must survive source/provider/backup-host loss. Retain old key
versions until dependent data expires; keep seal/recovery custody separate.
The [26-check disposable evaluation](../../../../../status/p3-u3a-restic-backup-evaluation.md)
does not establish retained/production acceptance. No retained installation,
additional login, privilege expansion or backup-first exception is authorized.

Recommended initial **private-development proposals**, not approved/measured SLOs:

| Item | Proposed default for review |
| --- | --- |
| Snapshot cadence | Hourly, plus a verified fresh run immediately before approved privileged changes |
| Backup retention | Hourly 30 days plus monthly 12 months as administrative preservation windows; configuration and separately controlled pruning remain unapproved |
| Audit retention | Continuous separate preservation at the approved destination for at least 13 months, covering the oldest retained snapshot through present; production requires independent host/copy protection |
| Backup destination protection | Append-only existing-data overwrite/delete/prune denial; separately controlled administrative deletion. Timed immutable retention deferred, not mandatory |
| Freshness alerts | Missed run or incomplete audit/upload alerts immediately; no successful set at the approved destination for 75 minutes is an incident |
| Recovery objectives | Proposed RPO at most two hours and RTO at most four hours; accept only after timed joint restore exercises |
| Repository verification | Proposed weekly checks and monthly full data reads, plus verification after maintenance/storage change; approve bounded schedule against measured size |
| Restore testing | Before backup readiness is claimed, quarterly thereafter, and after relevant provider/seal/storage/key changes |
| Human/machine access review | Quarterly and upon custodian/role changes; review owned credentials before expiration |

Retained historical snapshots contain old material and authority; the retention
tradeoff, storage budget, responsible custodian and incident response coverage need
owner review. Snapshot cadence alone does not meet RPO when remote upload or audit
continuity fails. None of these targets establishes production readiness.

## Separately controlled attended maintenance

Preserve the existing named custodian's denied snapshot and self-policy paths.
Do not expand it to solve the administrative dependency. Prefer an independently
identified authorized operator. Otherwise review a dedicated attended deployment
identity, with a policy it cannot edit and a credential unavailable to application
and ordinary custodian processes. Separate accounts held by one person do not
create independent two-person control; the design relies on separately unlocked
custody and explicit owner-reviewed changes, and must state that trust boundary.

Reuse an approved human authentication method where available; otherwise a separate
native named-human entry is the small private-development fallback. Propose
900-second service sessions, no default/identity policy/period, no renewal or
generic child creation, explicit self-revocation/confirmation, and no unattended
human reauthentication. Any fresh session or longer window belongs in the later
execution approval. Production human SSO/MFA remains a separate readiness gate.

The initial writer scope is exact: read/update only the three hardening targets
`platform-deployment-maintainer`, `endpoint-restricted-issuer` and
`trunk-restricted-issuer`. No wildcard policy/role write, own-policy edit, auth
remapping, secret read, arbitrary token revocation, root generation or restore.
Read scope for the separately authorized effective-inventory review includes
policy bodies, token-role configuration, entity/group/alias mappings, auth/mount
settings, accessor lookup and lease metadata. The concrete request must enumerate
the paths and limits; do not grant arbitrary `auth/*` or material reads. An
unexpected auth method/object requires review before extending that scope, and
incomplete read scope cannot be labelled a complete inventory.

Routine backup credential rotation may additionally require create/destroy of
SecretIDs for only the exact backup AppRole, with protected identifiers and no
role-config or policy edits. Initial auth mount/role/policy installation, changes
to this maintenance identity, future installations or broader administrative
targets are separate reviewed provisioning operations, not standing wildcard
rights. Treat read-only administrative exports as protected information.

A writer of an issuance policy is a trusted administrator: exact target paths
alone do not prevent intentional grants to other principals through those bodies.
Reviewed immutable body hashes, writer exclusion and post-write checks prevent
mistakes and expose deviations; they are not a cryptographic guarantee against
that administrator. Do not claim an immutable server-wide token ceiling.

## Maintenance and recovery procedures

For a later authorized maintenance operation:

1. Name the responsible operator, exact access mechanism, target paths, prior and
   final body hashes, effect on existing sessions, bounded duration and writer
   exclusion. Independently inspect effective policy/identity/auth/role/lease
   metadata under approved read scope; stop on unexpected authority or partial data.
2. Require a new remotely preserved native snapshot, separate audit continuity,
   integrity manifest and protected seal/TLS recovery prerequisites **before writes**.
   Keep backup capture separate from the short write session so slow transfer does
   not force renewal or rushed changes. Revalidate the operation-specific freshness
   gate immediately before writing; the concrete plan supplies the age bound.
3. Apply only the reviewed named bodies with compare-before-write and exact
   readback. Preserve endpoint/trunk material ACLs, installation boundaries and
   ordinary existing leases. Test normal/negative issuance through separately
   approved test sessions, account for their exact tokens and confirm cleanup.
4. On partial or uncertain writes, preserve observed state and audit, pause the
   affected provisioning route and request precise follow-up. Do not automatically
   restore a known weaker policy, rerun writes, replace authority or restore Raft.
   Session expiry/cleanup uncertainty stops; any new login needs its own authority.
5. Close only after known test/session cleanup, final readback and safe status
   evidence. Native near-expiry 500 and fractional-expiry assertions remain visible
   unless separately resolved or explicitly disposed with proven consumption controls.

For a later authorized isolated restore test or incident:

1. Preserve the failed/current system and its post-backup audit; select a verified
   archive with owner approval and a compatible pinned provider/image/configuration.
   Make a protected recovery workspace isolated from production, SIP/PBX and all
   ordinary clients. Do not overwrite the retained Raft volume to conduct a test.
2. Have independent recovery custody supply the required original seal/unseal
   material and TLS/configuration. Backup alone cannot establish access to a sealed
   restore; see [OpenBao seal/unseal](https://openbao.org/docs/concepts/seal/).
   No automatic force restore, root generation, key replacement or listener weakening.
3. Restore into the isolated target using the exact approved native procedure,
   unseal only under that separate authority and validate decryptability, canonical
   generation/material consistency, identity/policies/leases, isolation and audit.
   Protect any recovered secrets; safe evidence is pass/fail/counts only.
4. Reconcile authority at the snapshot point against preserved later administrative
   records. A restore can revive earlier root/admin/backup tokens, mappings and old
   credentials. Review them before any reconnect; do not assume past revocation
   survives restoration or automatically revoke unrelated ordinary leases.
5. Coordinate with an independently approved PostgreSQL backup/recovery point.
   OpenBao alone is not a consistent MyIMS backup: reconcile owner generations,
   associations and pending imports/cleanup against canonical database records.
   Missing/mismatched generations stay unavailable and fail closed; do not
   manufacture fresh proofs, associations or secret resupply from guessed state.
6. Record measured RPO/RTO, complete teardown and protected token accounting for
   the test. Real cutover, DNS/network/client changes and resumption require a
   separate reviewed incident decision; an isolated restore pass never grants them.

Human password, job SecretID, archive encryption key and TLS key rotation are
distinct operations. Rotate on compromise/custodian change or impending expiry,
verify successor access before retiring known prior credentials, keep necessary
historical archive keys, and never place seal shares in an ordinary rotation job.
If access or keys are missing, preserve evidence and stop for the owner; no
credential discovery, token reuse from backup or recovery fallback is implied.

## Installation dependency and review decisions

The functioning custodian's denials are intentional. Creating either new
administrative capability needs an already independently authorized installer;
this document does not establish one. Existing availability remains unknown.
The backup-first gate cannot be satisfied merely by proposing a new snapshot
identity whose creation would itself be a privileged pre-backup write.

If an existing route cannot be established, the owner must separately review its
exact provisioning/initial-backup dependency and any exception **before** retained
installation. No pre-backup exception or repeat root recovery is recommended for
immediate execution. Keep the known retained weakness visible while this gate is
unresolved; continue local work. Do not silently use the old temporary-ticket plan.

The two-capability direction is now approved, with AppRole accepted for disposable
fallback validation. Rotation/retention configuration and measured recovery
objectives remain pending; planning targets are not operating guarantees.
To prepare any execution request, also supply the named operator/custodian,
existing authorized installer route, actual approved destination and independent
key custody, audit collector access, measured transfer limits and exact immutable
policy/auth/role/body manifest. Those facts are deliberately unresolved here.
Design approval alone permits no retained installation or login.

## Acceptance and local implementation boundary

Before declaring backup/administration ready, pass disposable native tests for
snapshot GET versus denied POST/force-restore/material/admin access; exact workload
and human identity/TTL/overlap/generic-issuance denials; SecretID rotation and lost
login/cleanup; separate audit append/rotation/gap/truncation faults; corruption,
partial upload, encryption-key loss, append-only overwrite/delete/forget/prune denial,
protected administrative retention/deletion and production independent-copy faults;
an isolated full decrypt/unseal/joint-database restore and revived-authority review;
and partial administrative writes, writer exclusion and exact cleanup. Then repeat
only the explicitly approved retained acceptance scope. Existing recovery and
synthetic backup tests are prerequisites, not substitutes for these outcomes.

No backup/admin implementation is delivered by this design. Local P3-U3a work
continues through bounded reconciliation/replacement, canonical trunk owner/grants,
protected worker composition and exact binding/claim/adoption APIs. Runtime
deadline assumptions, durable swap/restart behavior, real PostgreSQL/provider
transaction/failure evidence and the conditional 60-second timing amendment still
need acceptance. Preserve native renewal HTTP 500, subsecond expiry observations,
the retained 48-hour-maximum finding and unresolved browser-recovery failure.
P3-U3a remains incomplete.

Local continuation checkpoint: the [canonical owner database foundation](../../../../../status/p3-u3a-trunk-owner-foundation.md)
is now implemented in source and verified against disposable PostgreSQL, including
grants, provenance and savepoint-safe audit rollback. It is not wired into runtime
and supplies no authority-checked command, verification, worker or claim API. This
local result neither implements this administrative design nor advances retained
backup/security readiness.
