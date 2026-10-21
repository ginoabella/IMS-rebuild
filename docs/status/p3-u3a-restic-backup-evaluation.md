# P3-U3a disposable Restic fallback evaluation

**Subsequent owner decision — 2026-10-21 (Asia/Manila, +08:00):** Docker Restic +
append-only Rest Server is now selected for development and production. Timed
COMPLIANCE retention is deferred as a future enhancement, not an initial acceptance
blocker. See the [current authoritative backup requirements](../architecture/backup-platform.md).
The evaluation below preserves its original assertions and tested scope; platform
approval does not authorize retained execution or establish production readiness.

Evaluated 2026-10-21 (Asia/Manila, +08:00). This is an evaluation artifact, not
installation authorization. No retained services, credentials, data or scheduled
jobs were accessed or changed. The [machine evidence](p3-u3a-restic-evaluation-evidence.json)
records the latest result; individual setup/diagnostic and final runs remain in
[disposable runs](p3-u3a-disposable-runs/).

Final full workflow run `50e036ff-5e25-4d41-8180-939097ffb800` passed **26/26
checks**, including native Raft restore. It captured a 20,505-byte synthetic
snapshot and seven separate audit records. All exact fixture containers, the
data volume, network and private temporary directory were confirmed absent
afterward. The harness exited 0; Python syntax and repository whitespace checks
also passed. No fallback acceptance is claimed beyond this tested boundary.

Restic with append-only Rest Server is a viable small backup-specific alternative
when the requirement is protection against a compromised backup client deleting
or overwriting existing repository data. It does **not** implement S3 Object Lock,
COMPLIANCE mode or a server-enforced timed retention policy. It cannot satisfy a
non-negotiable timed COMPLIANCE requirement. Select it only with an explicit
decision accepting append-only protection and separately controlled maintenance.

Final native workflow run [50e036ff](p3-u3a-disposable-runs/50e036ff-5e25-4d41-8180-939097ffb800.json)
passed **26/26 checks**, exit 0, including fresh native Raft restore. All exact
containers, storage volume, internal network and temporary synthetic-key files
were confirmed absent afterward. This passes the declared append-only probe;
it does not change the missing timed COMPLIANCE capability above.

## Software and deployment

Official current releases checked against the projects' release pages:
[Rest Server 0.14.0](https://github.com/restic/rest-server/releases/tag/v0.14.0)
and [Restic 0.19.1](https://github.com/restic/restic/releases/tag/v0.19.1).
Both use the open-source BSD 2-Clause license:
[server license](https://github.com/restic/rest-server/blob/v0.14.0/LICENSE),
[client license](https://github.com/restic/restic/blob/v0.19.1/LICENSE).
The [tagged server documentation](https://github.com/restic/rest-server/blob/v0.14.0/README.md)
documents the official Docker image, append-only mode, authentication, private
repositories and TLS. No enterprise feature or subscription is required.

Images actually pulled and executed on linux/amd64:

| Component | Pinned image |
| --- | --- |
| Server | `restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5` |
| Client | `restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510` |

The smallest configuration is one long-running server container and one data
volume. Restic runs only while backing up, checking or restoring. No database,
cluster, orchestrator, metrics stack or separate proxy is necessary; the server
supports TLS itself. The fixture used an internal-only Docker network, zero host
ports, bcrypt Basic authentication, `--private-repos`, `--append-only`, dropped
capabilities and a read-only container root. HTTP was confined to that disposable
network; production requires authenticated TLS with certificate validation.

## Native acceptance probe

The [reproducible harness](../../scripts/backup-evaluation/check-restic.py) uses
fresh exact-named, labeled containers, an internal network, a fresh volume and a
private temporary directory. The client runs as the fixture-file owner. The
identity used for age decryption stays outside the client input directory and
is removed during teardown. Only synthetic input enters this test. Two fresh
OpenBao 2.7.1 containers, pinned to
`quay.io/openbao/openbao:2.7.1@sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`,
provide a native Raft snapshot source and isolated restore target. The harness
initializes and unseals the synthetic source, writes a synthetic KV sentinel,
obtains a native Raft snapshot through its API and separately collects JSONL
audit records. It packages snapshot, audit and their integrity manifest together,
then age-encrypts the archive before handing it to Restic. Both Bao storage paths
are fresh tmpfs; their synthetic seal/root material remains in process memory.

Run with previously verified temporary age binaries:

```sh
python3 scripts/backup-evaluation/check-restic.py \
  --age /path/to/verified/age --age-keygen /path/to/verified/age-keygen
```

The probe covers age encryption before backup, dedicated authenticated repository
access, anonymous and other-user repository denial, native Restic backup,
`check --read-data`, raw HTTP overwrite/delete denial for config, snapshots and
data packs, client `forget` denial, retained protection across a server restart,
a new snapshot after restart, second integrity check, isolated retrieval using
`restic dump`, manifest hash verification and successful age decryption. It then
verifies the decrypted snapshot and audit manifest, restores the native Raft
snapshot into the independent fresh Bao target, unseals with the synthetic
source key and checks the original sentinel. Source audit bytes remain separate
from the Raft snapshot and match exactly after the storage round trip.
Repository-level DELETE is unsupported (HTTP 405); object deletes/overwrites are
rejected with HTTP 403. Lock files remain deletable, a deliberate exception
necessary for ordinary repository operation; the probe verifies it explicitly.

Early setup probes exposed a missing writable `/tmp` for bundled `htpasswd` and
host-file ownership with dropped capabilities. A further diagnostic run passed
the security/restore checks but the harness incorrectly expected HTTP 403 for
unsupported repository DELETE instead of HTTP 405. Those failures are preserved;
the fixes add a helper tmpfs, run clients as the source-file owner, and accept
405 only for the unsupported repository-level method. An added raw-pack probe
then required supporting the server's default REST v1 list-of-names response as
well as the REST v2 list-of-objects shape. These fixes do not relax the
required object overwrite/delete checks. Every run records exact cleanup checks.

## Boundaries and production migration

Authenticated Restic writers can read repository data and possess the repository
encryption password. They can create new snapshots and garbage, consume capacity,
and interfere with locks. An independently held age private key keeps archive
plaintext unavailable to the repository writer, provided that key never reaches
the backup client. The test's age identity is synthetic only. No native S3
uploader-only/read-denied capability exists in this design.

The server administrator can disable append-only mode or modify/delete the data
filesystem. Docker/host/root administration therefore bypasses the protection.
There is no retention-until timestamp to shorten/remove and no COMPLIANCE claim.
Append-only data stays until a separately trusted maintenance route removes it.
The [official retention guidance](https://restic.readthedocs.io/en/stable/060_forget.html#security-considerations-in-append-only-mode)
requires care: an attacker can add misleading snapshots, so count-based pruning
can discard legitimate backups. Prefer a reviewed `--keep-within` policy,
server-side trusted time and independent receipt/history validation. Even this
does not preserve good data forever after the accepted window. Run destructive
maintenance from a separately secured host with full access absent from upload
clients, inspect suspicious timestamps/history, and perform a check afterward.
The evaluation does not enable maintenance or scheduling.

Production can retain exactly the same age archives, manifest format and Restic
backup operation while changing the deployment-controlled repository endpoint,
TLS trust and credentials. Move the complete repository, not selected internal
pack files, or initialize a new destination and back up the same age archives.
Keep the repository password and independently held age identities recoverable.
Cross-host migration itself was not executed in this disposable test; the
SeaweedFS probe separately demonstrates an identical archive against a second
independently stored S3 endpoint.

A production host needs separate physical storage and administrative authority
from MyIMS, restrictive network ingress, TLS, monitored capacity/failed backups,
recovery drills, redundant disks and an independent additional backup copy.
Redundant disks alone do not cover host loss, malicious administration or
corruption. Restrict filesystem/Docker access, separate maintenance credentials,
retain independent receipts and keep two independently held age-key copies.
Same-host development has no off-host recovery guarantee. No retained service,
privileged MyIMS identity or scheduler is proposed as already installed.

The final harness also routes SIGTERM into its existing `finally` teardown. This
small post-run cleanup hardening was syntax/handler checked; the 26 native checks
above were not rerun for that hook. Hard kill/host failure cleanup is not claimed.
