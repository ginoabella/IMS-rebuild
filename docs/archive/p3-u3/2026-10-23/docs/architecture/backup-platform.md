# MyIMS backup platform and recovery requirements

Approved 2026-10-21 (Asia/Manila, +08:00), by the owner's **P3-U3a — Final
Backup Platform Selection for Development and Production** decision. This is the
authoritative backup platform/security contract, read with
[architecture context](../../../../../../context/architecture.md). It supersedes the earlier
Backblaze B2 and SeaweedFS primary-platform preferences and mandatory timed S3
Object Lock COMPLIANCE retention. All other backup-security and recovery gates
remain in effect. The [installation package](../planning/p3-u3a-backup-installation-approval-package.md)
contains the minimal plan and remaining concrete approvals.

## Selected platform and accepted limitation

Use **Restic + append-only Rest Server through Docker in both development and
production**. Preserve the same age-encrypted archive, integrity-manifest format
and Restic backup workflow; environment-specific repository endpoints, TLS trust,
storage placement and credentials are deployment configuration. Keep environments'
repositories, identities and credentials separately scoped. Garage remains
application object storage and is unaffected by this decision.

The owner explicitly accepts that append-only Rest Server does not provide
reliable server-enforced timed COMPLIANCE retention. **Timed immutable retention
is a future security enhancement, not an initial development/production acceptance
requirement or a blocker to independent application development.** Do not describe
append-only protection as S3 Object Lock or as protection against the backup-server
administrator disabling it or deleting underlying storage.

Ordinary backup clients must be unable to overwrite, delete, forget or prune
existing backup data. Restic lock-file removal is the narrowly scoped protocol
exception; it does not authorize deletion of snapshots, packs, indexes, keys or
repository configuration. Writers can read repository ciphertext, add misleading
snapshots/garbage, consume capacity and interfere with locks. Keep age private
keys out of writer custody and monitor capacity and trusted backup receipts.

Destructive repository maintenance requires separately controlled administrative
authority, absent from ordinary backup clients. Review expiry and deletion against
trusted receipts, capture times and recovery needs before any forget/prune run;
client-supplied snapshot times/counts alone are insufficient. No unattended pruning
is authorized by this decision. A server/host administrator remains a trusted
boundary and requires separate protection.

## Deployment and custody

| Environment | Required placement and protection |
| --- | --- |
| Development | A separate Rest Server container and persistent backup volume may share the MyIMS development host. Shared host, disk and administrator failure can destroy both source and backup; this establishes no off-host recovery guarantee. |
| Production | An independently administered physical backup server or NAS, restricted network access, authenticated TLS with certificate/hostname validation, monitored capacity, and at least one additional independently protected recovery copy or an equivalent reviewed safeguard against backup-host compromise. RAID or another volume under the same administrator alone is insufficient. |

The production safeguard must have a named custodian, separate deletion authority,
a reviewed copy/verification cadence and lag, recoverable credentials, and tested
recovery when the primary backup host is unavailable or compromised. This remains
a concrete readiness gate; no copy or equivalent safeguard is established here.

Preserve native OpenBao Raft snapshots through the snapshot API, never live-volume
copies. Preserve the separate audit stream with rotation/offset/hash continuity,
including records through snapshot token cleanup. Keep safe deployment/version
metadata and integrity manifests. Package and age-encrypt archives before Restic
upload; repository encryption is additional protection, not replacement for age.

Retain recoverable Restic repository passwords and transport/recovery credentials
in protected custody independent of the failed OpenBao/source host. Hold age
private decryption keys independently of backup clients and repository admins,
with two tested protected copies in separate locations. Retain old key/password
versions while dependent archives/repositories remain. Record only public
fingerprints and non-secret custody references in repository documentation.
OpenBao seal/unseal/recovery custody remains separate and outside routine archives.
Archive decryption does not replace access to the appropriate seal/recovery keys.

## Operational controls

The controls below are mandatory; numeric settings are proposals needing separate
configuration approval and measurement. They are not guarantees or activation
instructions.

| Control | Initial plan and required evidence |
| --- | --- |
| Cadence | Hourly native snapshots; continuous separate encrypted audit forwarding; a fresh verified pre-change set at most 15 minutes old at the first privileged write. One lock/concurrency one, no missed-run replay burst or blind login retries. |
| Retention | Candidate: hourly sets for 30 days plus monthly sets for 12 months; separate audit for at least 13 months covering the oldest retained snapshot through present. These are reviewed administrative preservation windows, not server-enforced timed locks. Final policy and capacity need approval. |
| Alerts | Failed/missed snapshot, audit gap/forwarding failure, encryption/upload/verification or cleanup uncertainty, expiry/rotation failure and capacity exhaustion must alert a named owner through an approved channel. Candidate freshness incident threshold: 75 minutes. Set capacity warning/critical limits and bounded spool from measured growth and response time before activation. |
| Rotation | Separately controlled rotation of OpenBao snapshot identity inputs, Rest Server authentication, Restic repository passwords and age recipients; stage/test successors, journal the change, retire exact old credentials only after verification, retain recovery material for older data. No self-expansion by the backup client. |
| Administrative access | Restrict host/Docker/filesystem and maintenance access; separate attended credentials from job custody. No writable repository mount or maintenance endpoint reachable by ordinary clients. Protect and review administrative activity and backup receipts independently. |
| Repository verification | Candidate: weekly repository check, monthly full data read/verification, and verification after maintenance or storage change. Record failures and selected snapshot/archive integrity; check alone does not prove restore. Tune bounded schedule to measured size before activation. |
| Restore exercises | Before readiness, quarterly thereafter and after relevant provider/seal/storage/key changes; isolated end-to-end retrieval/decryption/native restoration with measured recovery point and elapsed recovery time. |
| Pruning | Separately approved attended window; verify trusted receipts and preservation windows, inspect suspicious additions/timestamps, confirm recoverable sets and production independent copy, exclude concurrent work, review exact forget/prune selection, then verify repository and record deletions. An uncertain prerequisite stops pruning. |

Candidate RPO is at most two hours and RTO at most four hours for private-development
planning. Agree production targets and measure both against coordinated recovery;
hourly scheduling alone proves neither. Size staging, repository capacity and
additional-copy lag using measured snapshot/audit growth and restore throughput.

## Development artifact checkpoint

The [separate candidate Compose project](../../../../../../infra/backup/compose.yaml) and
[installation request](../../../../../planning/p3-u3a-development-backup-installation-request.md)
implement offline native-snapshot validation/age packaging, separate cursor-based
audit capture and authenticated TLS Restic upload with file-held credentials. All
services require explicit profiles, an existing external volume and approved
paths/UID/GID/quota; no automatic restart, default MyIMS integration or retained
activation occurs. The collector requires reviewed rename/create rotation and an
ordered segment list; missing continuity stops it. Its cursor proves local durable
encrypted spooling, not remote upload success. The bounded spool is never pruned
automatically. Capture identity, scheduling/alerting/rotation/housekeeping and joint
retained recovery acceptance remain separate unfinished gates.

The owner subsequently approved the bounded development installation. The
administrator-created account and isolated Rest Server are verified running;
[installed-state evidence](../../../../../status/p3-u3a-development-storage-verification.json)
confirms TLS CA/hostname validation, anonymous/other-repository denial and zero
repository writes. The repository is uninitialized. The 2-GiB pilot quota is not
accepted full retention capacity. No timer, real native capture, pruning or restore
is enabled. SMTP reachability/STARTTLS is verified independently of mailbox
credentials and delivery; the alert helper requires an explicit event for sending.
The actual installed public recipient path is empty, so independent age/key custody
remains an actionable prerequisite.

An inactive snapshot-only AppRole candidate validates issued scope and denied
capabilities, obtains a bounded native snapshot, confirms owned-token revoke/403
before output, and journals uncertain attempts to block subsequent logins. Its
exclusive lock spans authentication, capture, cleanup and durable output. It is
built/tested under a separate image tag; the installed tooling tag and provider
remain unchanged. Retained provisioning and clock/rotation/supervisor/joint-recovery
acceptance remain gated.

## Acceptance and authority

The [disposable Restic evaluation](../../../../../status/p3-u3a-restic-backup-evaluation.md)
records 26/26 checks including native Raft restore. Preserve its scope: synthetic
fixtures, not retained installation, cross-host migration or production acceptance.
Required checks before readiness include:

1. Verified authenticated TLS and repository isolation; ordinary-client raw
   overwrite/delete/forget/prune denial for existing data, including after restart;
   no client route to maintenance authority or storage filesystem.
2. Snapshot-only OpenBao authority, correct identity/lifetime and negative access
   checks; credential rotation, lost replies, interruption and exact token cleanup.
   Separate audit append/rotation/gap/truncation and bounded outage/capacity alerts.
3. Retrieve an archive with independently recoverable credentials, verify Restic
   and archive manifests, decrypt with each independent age-key copy, reject wrong
   keys/corruption, and restore/unseal a fresh isolated native OpenBao instance
   using separately authorized seal custody.
4. Coordinate the approved PostgreSQL recovery point with OpenBao; reconcile exact
   owner/binding/generation/version-1 material, reservations, associations and
   pending work. Missing/mismatched state remains unavailable. Review authority
   revived from snapshots against preserved revocation/administrative history
   before reconnecting; never manufacture attestations.
5. Measure RPO/RTO and verify the production additional copy or reviewed equivalent
   under primary-backup-host loss/compromise, plus restricted network, capacity,
   alerting, administrative separation and reviewed retention/pruning procedures.

Existing installer authority, backup-first ordering and necessary snapshot identity
provisioning are **separate approval gates**. Preserve `platform-owner-custodian`
restrictions and both consumed session authorizations. This decision grants no
privilege expansion, protected inventory access, retained login/backup service
activation, production deployment, destructive cleanup or root recovery. Isolated
retained restoration and seal access also require explicit scope-specific approval.
No pre-backup exception is approved. Independent P3-U3a implementation and disposable
verification continue; P3-U3a remains incomplete until applicable security and
end-to-end acceptance checks pass.


### Development recovery capture staging

Private recovery capture staging uses administrator-owned
`/srv/myims-openbao-recovery-development`, outside the backup-service-owned root.
Its operation directories are root:root 0700; only exact capture/encryption children
are owned by the isolated OpenBao helper UID/GID 1003. Backup clients and the uploader
receive ciphertext and receipts only. An attended host handoff uses protected file
and directory descriptors, exclusive writes and operation/hash checks to transfer
ciphertext into the backup spool as UID/GID 12010. This layout grants no OpenBao
recovery or service activation authority. Timers and cleanup remain separately gated.
