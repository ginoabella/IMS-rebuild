# P3-U3a — Disposable dedicated backup-storage evaluation

**Subsequent owner decision — 2026-10-21 (Asia/Manila, +08:00):** Docker Restic +
append-only Rest Server is now selected for development and production. Timed
COMPLIANCE retention is deferred as a future enhancement, not an initial acceptance
blocker. See the [current authoritative backup requirements](../architecture/backup-platform.md).
The evaluation below preserves its original assertions and tested scope; platform
approval does not authorize retained execution or establish production readiness.

2026-10-21 (Asia/Manila, +08:00). Scope: the owner's disposable evaluation request,
plus independently approved application development. **SeaweedFS 4.48 fails the
required retention reliability gate. Do not install it as the accepted immutable
backup destination.** The failure is observed in the Community binary, rather
than inferred from enterprise marketing or a missing documentation claim.

## Software and provenance

The [official latest-release API](https://api.github.com/repos/seaweedfs/seaweedfs/releases/latest)
returned [4.48](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48), published
2026-09-28T15:53:48Z. The [tagged license](https://github.com/seaweedfs/seaweedfs/blob/4.48/LICENSE)
is Apache-2.0. The [tagged README](https://github.com/seaweedfs/seaweedfs/blob/4.48/README.md)
provides official single-container Docker, separate-service Compose and Helm
options. We used the smallest `weed mini` option: one process/container running
master, volume, embedded filer metadata and S3. No external database, Redis,
cluster, orchestration service or enterprise image/license was required.

Tested Linux amd64 image:

```text
chrislusf/seaweedfs:4.48@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d
weed version: version 30GB 4.48 530be3e37 linux amd64
```

Docker pull and image inspection supplied this repository digest; the actual
binary version was executed. This is an exact tested image pin, not a guarantee
about mutable tags, other architectures, later releases or independently
reproducible builds. Versioning, Object Lock configuration, COMPLIANCE retention,
retention updates and legal hold all execute in this Community build. They are
not merely assumed available from enterprise documentation.

Other fixture tooling: existing pinned OpenBao 2.7.1 image
`quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`;
existing host boto3 1.40.72; temporary [age 1.3.2](https://github.com/FiloSottile/age/releases/tag/v1.3.2)
binaries. The downloaded Linux-amd64 age archive matched its GitHub asset digest,
SHA-256 `cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10`.
No host package installation or retained encryption-key generation occurred.

## Reproducible native results

Harness: [check-seaweedfs.py](../../scripts/backup-evaluation/check-seaweedfs.py).
[Latest evidence](p3-u3a-seaweedfs-evaluation-evidence.json) and immutable run files
preserve failed acceptance; no failure was converted into a pass by excluding it.
Run manually with existing boto3 and explicitly located temporary age tools:

```bash
python3 scripts/backup-evaluation/check-seaweedfs.py \
  --age /path/to/age --age-keygen /path/to/age-keygen
```

The harness creates fresh synthetic credentials itself. It accepts no application
endpoint, retained credential, protected custody path or existing storage volume.
Expected exit is **1** while the reproduced retention reliability failure remains.
This command is an evaluation, not a retained installer or scheduled backup job.

| Test | Observed result |
| --- | --- |
| Dedicated bucket and versioning | Bucket created with Object Lock enabled; versioning reads Enabled |
| Bucket default | COMPLIANCE, 30 days; new archive inherits it |
| Upload-only principal | Static identity with no legacy actions; exact bucket policy grants only `s3:PutObject` under `synthetic-backups/sets/*` |
| Uploader negatives | GET, list, another prefix, bucket creation, delete, version delete, retention edit, bucket policy and default-retention edits denied 403 |
| New-object retention override | Uploader's short GOVERNANCE and COMPLIANCE headers denied 403; past date rejected 400 |
| Workflow duplicate | `If-None-Match: *` rejects duplicate PUT with 412 |
| Raw same-key PUT | **200**, creates a new version containing different ciphertext; current version changes; original version and bytes remain protected |
| Admin version delete | 403, including governance-bypass header on a COMPLIANCE object |
| Admin shorten/remove/change mode | Shortening and COMPLIANCE-to-GOVERNANCE denied 403; empty retention rejected 400 |
| Extension | Longer retention accepted/read back; sequential attempt to undo extension denied 403 |
| Default removal | Admin may remove bucket default for future objects; existing object's retention remains and version deletion still denied |
| Versioning/bucket removal | Versioning suspension rejected 409; nonempty bucket deletion 409 with recursive deletion disabled. `BucketNotEmpty` alone is not Object Lock evidence |
| Container restart | Original bytes, retention, uploader denial and admin delete/shorten rejection survive |
| Concurrent metadata updates | **FAIL: successful retention extension and legal-hold ON writes lose acknowledged metadata; details below** |
| Backup and restore | Native Raft snapshot, separate real JSON audit records, age encryption, encrypted integrity manifest, native snapshot checksums and fresh isolated native restore pass |
| Corruption/wrong key | Wrong age identity and changed ciphertext rejected; snapshot mutation changes expected manifest digest |
| Endpoint portability | Exact ciphertext uploaded by the same `upload_archive(endpoint, key, bytes)` function to another SeaweedFS instance with a different data volume; decrypt/restore succeeds |
| Cleanup | Exact fixture containers, private volumes, internal network and private synthetic-key work directory removed, including after failed runs |

The first complete 34-check run was
[166b391e](p3-u3a-disposable-runs/166b391e-1fbd-4713-86ed-8eb893a208bb.json).
The stronger sequential run passed 45 checks with the raw-PUT limitation recorded:
[d12729d2](p3-u3a-disposable-runs/d12729d2-e08f-4e0d-a699-d337293a0237.json).
Those results do **not** override the subsequent native concurrency failure.

## Decisive COMPLIANCE reliability failure

The [tagged retention implementation](https://github.com/seaweedfs/seaweedfs/blob/4.48/weed/s3api/s3api_object_retention.go)
itself describes a read-modify-write race between retention and legal-hold updates
that can overwrite each other's extended attributes. We tested this rather than
assuming sequential denials establish reliable WORM behavior.

For each of 20 independently named object versions with 30-day COMPLIANCE default,
two separate S3 clients start together: one extends COMPLIANCE to 60 days, the
other sets legal hold ON. Both calls must complete successfully before reading
back retention and legal hold. There is no direct filesystem editing, clock
change, expiry wait, governance mode or retention bypass in this test.

In [4bb1d9e6](p3-u3a-disposable-runs/4bb1d9e6-0c59-46a9-90c0-73a75b9b81ea.json),
**3/20 acknowledged extensions were lost and 7/20 legal holds were lost**.
Some subsequent legal-hold reads returned `404 NoSuchObjectLegalHold`. The
remaining 45 checks passed, including endpoint portability and native restore;
acceptance correctly exited 1. These frequencies describe this disposable run,
not a statistical production failure rate. The independent [9284a7f6 repetition](p3-u3a-disposable-runs/9284a7f6-0599-4811-84a7-d79114da3f0a.json)
lost **7/20 retention extensions and 7/20 legal holds**, with both request status
codes explicitly recorded as **HTTP 200**. For example, round 0 requested retention
through December 20, 2026, but read back November 20, 2026. Exact timestamps,
versions and per-round requested/observed metadata are in the evidence. Both
complete runs passed the other 45 checks and removed all exact resources.

A server accepting a longer COMPLIANCE retention and then persisting the older
shorter value under a concurrent API write fails this request's reliability
requirement. Serializing one backup job does not establish exclusion of every
storage administrator or future client. An application-side workaround does not
repair the storage enforcement boundary. Reconsider SeaweedFS only after a pinned
upstream fix passes this reproducer and the other native tests.

There is a separate strict no-key-reuse limitation: S3 Object Lock protects
versions; it does not forbid every same-name upload. The tested uploader can
create a different current version without the conditional header. Tagged
[policy condition extraction](https://github.com/seaweedfs/seaweedfs/blob/4.48/weed/s3api/policy_engine/engine.go)
does not expose `If-None-Match`; no supported mandatory-conditional policy fix was
established. The workflow's 412 is useful, but it is not server-enforced rejection
of an arbitrary unconditional uploader request. Recovery must address an exact
version ID plus independently protected archive digest, never trust “latest”.

## Isolation, workflow and trust limits

The evaluation stack is separate from all MyIMS service networks and volumes.
Only uniquely named, operation-labelled resources are created. One internal
Docker network, two independent SeaweedFS data volumes and two fresh OpenBao
instances suffice for storage/restart/portability/native-restore testing. No
ports are published; the host test orchestrator reaches only inspected private
fixture IPs. Docker's internal network on this host did not assign published-port
bindings, so initial startup attempts were replaced with direct private-bridge
access. Application source, application environments, Garage volumes, retained
OpenBao and protected credentials are never mounted or read.

Mini uses a non-root UID, read-only root filesystem, temporary `/tmp`, dropped
capabilities and no-new-privileges. Admin UI, WebDAV, IAM API, Iceberg, Lance,
auto-bucket creation, recursive nonempty-bucket deletion and telemetry are
disabled. Only S3 is consumed by the host client; mini's master/filer/volume
interfaces still exist on the private fixture network. That network is a trusted
administrative boundary; exposing those interfaces to uploaders would bypass
S3 authorization. Single-container mini shares its internal component bind
configuration, so network isolation/firewalling is essential.

The workflow initializes a fresh Raft provider, writes an unmistakably synthetic
KV value, obtains a native snapshot and captures complete separate audit lines.
A tar bundle contains `snapshot.snap`, `audit.jsonl` and a SHA-256/size manifest;
the whole bundle is age-encrypted before upload. The temporary age identity and
synthetic seal share are distinct and excluded from the bundle. The synthetic storage-admin
credential, separate from the uploader, downloads the exact version; no dedicated
restore-only storage principal is implemented by this fixture. Decryption, manifest validation
and native snapshot checksums precede force restore into another fresh isolated
provider, which unseals with the source fixture's synthetic share and reads the
expected value. Force restore is confined to that exact disposable container.

The test orchestrator holds synthetic administration/encryption capabilities to
verify the workflow. It does not prove deployed snapshot/audit/uploader process
separation, AppRole provisioning or token-cleanup implementation. No retained
AppRole, privileged identity, scheduler, backup service or application service
was installed. Synthetic initialization creates fixture-only bootstrap tokens;
no retained root/recovery or protected credential is used.

This is a bounded audit checkpoint, not implemented continuous audit forwarding,
rotation-gap detection or joint PostgreSQL/OpenBao recovery. Retained seal/TLS/key
custody, measured capacity, RPO/RTO, full service failure recovery and power-loss
behavior remain unverified. Tiny synthetic snapshots are not throughput evidence.
Hashes establish byte integrity; they do not independently authenticate an
attacker-created new archive. Protect archive/version receipts separately and
keep signing/authenticity requirements in the later concrete deployment review.

Host/Docker administrators can stop the container, change its clock/configuration,
edit filer metadata, remove data files or destroy volumes. In fact, exact fixture
volume removal succeeds while its synthetic versions are still under unexpired
retention. S3 COMPLIANCE is not immutable hardware or protection against host
administration. Same-host development also shares disk, malware, power and
administrator failure with MyIMS. Separate physical production storage is required
and still needs separately controlled administrators and recovery copies.

Initial failed startup/audit/race-observation harness attempts remain in the
immutable evidence directory. The pinned provider rejects API-enabled audit;
the fixture now uses supported declarative audit configuration and waits for Raft
leadership. A missing legal hold is now recorded as a failed preservation result,
not an exception that stops remaining restore tests. All exact failed fixtures
were removed. No retained service repair was attempted.

## Production portability and operational complexity

The demonstration uses distinct endpoints and data volumes on one development
host. It proves endpoint/configuration portability, **not** a physically separate
server deployment. Moving the same SeaweedFS archive path to a separate server
would require no snapshot/encryption/archive redesign: change endpoint, CA/TLS,
credential and deployment data-path configuration; retain the same signed S3
PUT mechanism, unique names and independently recorded version/digest receipts.
But portability does not cure this release's retention failure.

Before any production deployment:

1. Place backup storage on a separate physical host and failure domain, with no
   MyIMS Docker socket, source mount, provider key or application credentials.
   Expose authenticated TLS S3 only; firewall master/filer/volume/admin ports and
   verify CA/hostname. The disposable HTTP test does not validate production TLS.
2. Use dedicated storage and measured capacity. A lone mini process/disk has no
   redundancy or HA. At minimum plan mirrored disks, monitoring, UPS and another
   separately administered/offline recovery copy; RAID is not a backup. If
   multi-host SeaweedFS replication is later justified, separately design and
   test data **and filer metadata** redundancy, recovery and failure domains.
   Do not assume enterprise self-healing/recovery features exist in Community.
3. Keep storage administration, retention changes, restore/decryption and ordinary
   uploader credentials apart. Uploader holds ciphertext and upload rights only;
   it gets no age private key, seal material or storage-admin credential. A
   separately authorized verifier confirms exact version/retention acknowledgement.
   Storage administrators can weaken future bucket defaults and are trusted.
4. Maintain trusted time, configuration change review, independent alerts,
   storage quota/freshness monitoring, bounded encrypted spooling, audit continuity,
   key rotation with old-key retention and tested recovery from two independently
   held private-key copies. Monitor arbitrary garbage uploads/storage exhaustion.
5. Keep the proposed 30-day hourly tier and separate 12-month monthly retention
   decision explicit. A 30-day default cannot implement 12-month monthly locking,
   nor may hourly archives be deleted at 48 hours. Capacity arithmetic from the
   installation package is planning only; actual snapshot/audit growth is unknown.
6. Complete separately approved native least-privilege capture/cleanup, audit
   forwarding and joint database/provider restore acceptance, name the installer
   and owners, then review concrete host artifacts before installation approval.

## Fallback and final recommendation

The failure triggers the owner's requested fallback. See the independent
[Restic + append-only Rest Server evaluation](p3-u3a-restic-backup-evaluation.md)
for pinned software, native tests, operation cost and evidence.

**Reject SeaweedFS 4.48 as the accepted immutable backup platform.** Recommend
Restic with one append-only Rest Server as the simpler development backup
candidate if the owner accepts its documented administrative retention boundary.
Keep native snapshot, separate audit, age-encrypted bundle and integrity checks
as the transport-independent capture format. Restic then stores that ciphertext;
its endpoint is deployment configuration when moving to a separate server.

Rest Server append-only is **not S3 Object Lock COMPLIANCE** and supplies no
unshortenable timed retention against its administrator. It therefore cannot be
declared an equivalent pass of the original COMPLIANCE requirement. If that
requirement remains mandatory for development too, **neither tested candidate is
accepted for installation**: require an upstream SeaweedFS fix or a separately
reviewed platform that passes the tests. No weaker retention policy, retained
installation or schedule is activated by this recommendation.

The prior installation proposal and disabled review manifest remain historical
candidate bodies for separate review; their SeaweedFS destination is now subject
to this failed evaluation. The existing installer, backup-first and protected
custody gates are unchanged. No installation approval is requested while the
mandatory requirement has no accepted implementation.

Independent application work completed the
[exact owner-reference adapter checkpoint](p3-u3a-trunk-owner-reference-port.md).
Its build, real PostgreSQL and focused checks pass. P3-U3a remains incomplete;
retained lifetime, native provider timing and integrated/browser findings remain.
