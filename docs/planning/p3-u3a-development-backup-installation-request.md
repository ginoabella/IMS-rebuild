# P3-U3a — Consolidated development backup installation request

Prepared 2026-10-21 (Asia/Manila, +08:00). **Owner approved the bounded development
host/storage installation, now independently verified running. Separate native
backup/custody and operational gates remain pending.** See the [current approval/execution record](../status/p3-u3a-development-backup-installation.md). The owner accepted the architecture and
documentation and authorized preparation and disposable verification. Preserve
`platform-owner-custodian` exactly as it is. Neither consumed login is reusable.
The [backup security contract](../architecture/backup-platform.md) remains
binding; timed COMPLIANCE retention is a deferred enhancement, not a blocker.

## Artifacts and exact deployment boundary

The [review manifest](../../infra/backup/review-manifest.json) pins the prepared
source hashes and tested image ID; it is not executor input.

Use the separate [Compose project](../../infra/backup/compose.yaml), project name
`myims-backup-development`, and [tooling Dockerfile](../../infra/backup/Dockerfile).
The Dockerfile-specific allowlist sends only backup helpers and the offline native
snapshot validator into the build. No source credentials, application dependencies
or existing service configuration enters the image. Initial target is linux/amd64.
Rest Server 0.14.0, Restic 0.19.1 and Node 22.23.3 are digest-pinned; age 1.3.2's
release archive is SHA-256-pinned using the [official release asset](https://github.com/FiloSottile/age/releases/tag/v1.3.2).
Record the locally built image ID in the installation authorization; do not
silently rebuild/retag an approved deployment with different source.

| Service/profile | Exact purpose and access |
| --- | --- |
| `rest-server` / `retained-install` | Sole long-running repository service; native TLS 1.3, bcrypt authentication, `--private-repos`, `--append-only`, reviewed `--max-size`; external `repository` volume at `/data`, read-only server auth/TLS mounts only. No host ports. |
| `archive` / `manual-archive` | Short-lived offline helper; validates a native Raft snapshot and complete separate audit records, bundles recovery references and member hashes, age-encrypts before output. Input read-only; ciphertext spool writable; public recipient only. Network `none`. |
| `audit-collector` / `manual-audit` | Short-lived separate collector; exact audit directory read-only, cursor state and encrypted spool writable, public recipient only. Network `none`; no provider bearer. |
| `uploader` / `manual-upload` | Short-lived Restic client; encrypted spool and repository credential files read-only, safe upload receipts writable, repository network only. No audit source, native snapshot, age identity, provider bearer, repository filesystem or Docker socket. Also permits bounded `check`/`check-data`; no initialization, forget, prune or restore subcommand in the wrapper. |

All services use the explicitly approved numeric UID/GID, read-only roots, dropped
capabilities, no-new-privileges, bounded tmpfs/memory/processes and bounded local
logs. All use `restart: no`. Every service is behind a profile. Normal `./dev up`
and a backup-project `up` without profiles start none of them. The server must be
started explicitly after authorization; a reboot does not reactivate it by policy.
No scheduler or notification sends anything in this checkpoint.

## Host paths, volume and custody to approve

The administrator created the dedicated non-login service identity
`myims-backup-development`, **UID/GID 12010**. The exact installed account/service
and isolation are independently verified. The supervisor running Docker
is a separately protected host administrator: Docker access is effectively host
administrative authority, not a restricted backup-client permission. Helpers
receive no Docker socket. Do not add MyIMS application identities to that authority.

The approved installed host root is
`MYIMS_BACKUP_ROOT=/srv/myims-backup-development`. The original 2-GiB controlled
pilot cap is not full retention acceptance. Set `MYIMS_BACKUP_UID`, `MYIMS_BACKUP_GID`,
`MYIMS_BACKUP_REPOSITORY_BYTES`, `MYIMS_BACKUP_AUDIT_SOURCE`,
`MYIMS_BACKUP_VOLUME` and `MYIMS_BACKUP_ROOT` in a non-secret owner-controlled
Compose environment file. Secrets must not be placed in that environment file.

| Artifact/path | Ownership, content and boundary |
| --- | --- |
| External volume `myims-backup-development_repository` | Set `MYIMS_BACKUP_VOLUME` to this exact proposed name after approval; initialize ownership to the approved helper UID/GID. Compose refuses to create a missing external volume. Only Rest Server mounts it; independently unlocked administrators control filesystem maintenance. Never mount existing Garage or MyIMS data here. |
| `/srv/myims-backup-development/server-auth/htpasswd` | Bcrypt record for `uploader`; 0700 directory/0600 file, service-readable; storage admin controls replacement. Secret password is not in argv/env at retained provisioning: use an attended protected-input mechanism. |
| `/srv/myims-backup-development/server-tls/{server.crt,server.key}` | Exact leaf certificate with DNS SAN `rest-server`, protected private key, reviewed issuing CA and expiry/renewal owner. Clients validate CA and hostname. Private key absent from clients. |
| `/srv/myims-backup-development/client/{repository.url,repository.password,ca.crt}` | Service-readable owner-only credential files. URL is `rest:https://uploader:<percent-encoded-secret>@rest-server:8000/uploader/`; the authenticated URL and Restic password are never in Docker environment/argv/logs. Independently escrow repository password and recovery access outside the failed OpenBao/host. |
| `/srv/myims-backup-development/public/recipient.txt` | Reviewed public age recipient only. Private identities and their unlocking inputs stay on two independently held protected recovery copies outside every helper mount. No retained key generated here. |
| `/srv/myims-backup-development/snapshot-input/{snapshot.snap,audit.jsonl,recovery.json}` | Protected 0700/0600, no symlinks, exactly these members. Supplied only by a separately approved native capture route; never copy a live Raft directory. `recovery.json` has only `configurationRevision` and `postgresRecoveryReference`, safe bounded coordination references. Private TLS/seal material and credentials are excluded. |
| `/srv/myims-backup-development/audit-state` | Exclusive collector lock and atomic durable cursor; 0700/0600. An uncertain stale lock requires reviewed reconciliation, never automatic lock breaking. |
| `/srv/myims-backup-development/encrypted-spool` | Unique `.age` ciphertext and integrity receipts only; 0700/0600. Candidate 1 GiB cap, 128 MiB per source file, bounded helper tmpfs. Shared spool lock prevents concurrent archive capacity races. No automatic deletion. |
| `/srv/myims-backup-development/receipts` | Safe completion time, command, snapshot ID and archive hashes; separate repository-operation lock. Protect receipt history independently before relying on it for production retention decisions. |
| `MYIMS_BACKUP_AUDIT_SOURCE` | Exact provider audit directory **still to be identified under separate approval**. Read-only mount includes owner-reviewed `segments.json`, an ordered list of original closed segments then active file. Rename/create rotation only; no copy-truncate. No provider data-volume mount. |

The internal network is `myims-backup-development_repository`; only Rest Server
and uploader attach. It is not a MyIMS/provider/application network and exposes
no host port. Snapshot capture through an existing authorized provider route is a
separate process; these helpers have no provider connectivity. Same-host source
and repository loss is accepted only for development. Production requires the
separate physical server/NAS and independent recovery-copy/safeguard gate.

## Controlled first-backup operation for later approval

1. Name the independently authorized installer, backup operator, audit owner,
   storage administrator and recovery custodian; supply existing route metadata
   and separately approve any protected pre-state/effective-authority reads.
   Keep the current custodian and its restrictions unchanged. Creating a new
   snapshot identity still needs the exact separate OpenBao provisioning approval
   and backup-first gate. The four-write bootstrap exception remains unapproved.
2. Review and approve the exact Compose/env/source hashes, image ID, host identity,
   paths, volume, quota, TLS certificates, public recipient fingerprints,
   credential handoff/escrow and permitted network. Only then provision host/storage
   artifacts and start the exact `rest-server` service/profile. No application
   services, listeners, provider mounts or policies change in this step.
3. Initialize the repository once under attended, separately approved custody;
   record its repository ID. Initialization is deliberately absent from the routine
   wrapper. Verify anonymous/wrong-repository access and existing-data overwrite/
   deletion/forget/prune denial, including after restart. Only lock-file deletion
   is an accepted protocol exception. Keep full-access maintenance off this network.
4. Through the named separately authorized capture route, obtain a native snapshot
   and safe deployment reference, account for/revoke its token and confirm denial,
   and preserve audit records through token cleanup. Confirm approved identity,
   scope/lifetime and exact source ownership. No root token or old recovery token
   may substitute. This checkpoint does **not** implement or authorize that retained
   capture/login route; its native identity/rotation/lost-reply acceptance remains
   required before scheduling.
5. Run the offline `archive` helper on the controlled input, then separately run
   `audit-collector` on the reviewed ordered segment list and `uploader` on the
   ciphertext spool. Require manifest/hash/Restic commit receipts. Failure preserves
   prior repository data; do not retry authentication or repair policies. An
   uncertain upload must be reconciled against receipt/snapshot IDs before calling
   the run successful. Only after successful isolated recovery may the fresh set
   satisfy a later privileged operation's backup-first freshness gate.
6. Review exact plaintext staging cleanup and encrypted-spool housekeeping as their
   own operation, with owned paths and successful receipts. Helpers perform no
   source or remote data cleanup. Ordinary clients never prune. A full spool or
   repository is a stopped/alerted backup, not permission to delete older sets.

Commands here refer only to the separate Compose file/profiles; the installation
authorization must name its approved environment-file path explicitly. No retained
command from this plan has been run. Attended initialization, startup, capture,
retrieval/restore and cleanup are distinct approvals with explicit boundaries.

## Scheduling and operational ownership

| Proposed operation | Exact schedule/behavior to review | Owner/evidence still required |
| --- | --- | --- |
| Snapshot + archive + upload | `myims-openbao-backup.timer`: minute 10 of every hour, UTC and Manila; `Persistent=false`; concurrency one, no catch-up/login retry burst; 600-second job plus 60-second exact-token cleanup allowance. Pre-change fresh set at most 15 minutes old at first write. | Named native capture operator/helper, tested AppRole/rotation or existing-route evidence and full supervisor/timer artifacts. These are not delivered/installed by this checkpoint. |
| Separate audit forwarding | Propose a 60-second poll of `audit-collector`, followed by uploader independently of hourly snapshot capture. Poll continues even while no snapshot runs; candidate audit-forwarding lag alert at 120 seconds. Retain closed files until their ciphertext and upload receipts are verified. | Audit owner must approve/test rotation hook and ordered `segments.json`, acknowledgement and source-retirement procedure; bounded real workload/lag measurement and scheduler implementation remain acceptance work. |
| Repository verification | Weekly `check`; monthly `check-data` (`restic check --read-data`); verify after maintenance/storage change. Wrapper timeout 540 seconds, outer supervisor/cleanup bounds apply; overrun alerts, no silent expansion. | Backup/storage owner; size/throughput measurement and bounded scheduler artifacts pending. |
| Rotation | AppRole input candidate: 30-day/1,000-use SecretID, rotate at least seven days early; 300-second tokens. Separately attended REST auth, repository password and age-recipient changes with predecessor recovery preserved. | Named credential/custody owners and native successor-test/revoke/lost-reply evidence. No job can expand its own grants. |
| Capacity/freshness/failure alerts | Any failed helper or missed run, TLS/credential expiry, audit gap, uncertain cleanup/commit or quota exhaustion. Candidate 75-minute snapshot incident threshold; propose 70% warning/85% critical repository/spool thresholds, subject to measured growth/response time. | Named on-call recipient and existing approved notification channel; delivery/ack escalation and capacity probe still need implementation/testing. Helpers emit sanitized stage/status and nonzero exit only; they are not a complete alerting system. |
| Retention and maintenance | Candidate hourly 30 days, monthly 12 months, audit at least 13 months. Separately attended exact selection against trusted receipts/times and recovery needs; repository check after separately approved pruning. | Separately controlled storage administrator; preserved independent copy/safeguard and suspicious-snapshot review. No pruning task exists here. |
| Restore exercises | Before readiness, quarterly thereafter and after relevant changes. | Named joint OpenBao/PostgreSQL recovery owner and independent age/seal custodians; approved measured targets and exercise authorization. |

The owner accepted initial development operational responsibility and selected
`itsg.notification@sscgi.com` for alerts. Microsoft 365 SMTP submission at `smtp.office365.com:587` with STARTTLS is
selected; administrator checks verified configuration, TLS and authentication,
and the owner confirmed inbox receipt of the labeled manual test. Automatic
backup-event alert integration remains unverified. Independent recovery custody remains unestablished; host-administrator execution is selected. Other operational
assignments remain pending confirmation. The repository owner may nominate named
people; this document does not silently appoint them. The encrypted spool and
receipt directory are finite and lack automatic housekeeping; long-term unattended
operation is not accepted until reviewed housekeeping, monitoring, failure
notification and cadence/rotation integration pass. No systemd units are installed
or enabled and no standing OpenBao privilege is created.

## Isolated recovery and reconciliation acceptance

Under a separately authorized exercise, retrieve the exact verified encrypted
snapshot set and intervening audit archives using independently recoverable Restic
credentials. Use a recovery host with no ordinary application, retained database,
provider, SIP or PBX connectivity. Verify repository data and outer/member hashes,
decrypt with each independent age-key copy, and reject wrong-key/corrupt archives.
Preserve original separate audit records and boundary/chain manifests.

Restore/unseal a fresh pinned OpenBao instance with independently supplied seal
custody. Restore PostgreSQL to the reviewed coordinated recovery point using a
real database backup. Compare exact node/installation/owner/binding/generation/
version-1 material, reservations, associations and pending work. Missing or
mismatched data remains unavailable. Review authority revived from the snapshot
against later revocation/administrative records before any reconnect. Measure
actual recovery point and elapsed recovery time against the agreed targets
(candidate private-development RPO two hours/RTO four hours); record interruptions,
credential recovery and exact disposable teardown. Native OpenBao restoration
alone is not PostgreSQL reconciliation or production readiness.

## Approval disposition

The platform/accepted limitation and continued disposable/local implementation are
approved. Bounded development storage installation is now approved; see the current execution
record. Exact existing OpenBao installer authority and
snapshot identity, backup-first prerequisites, private-key/seal availability,
real capture/audit source, operational owners/settings, independent recovery
custody, joint restore scope and any cleanup remain pending. The exact Docker
artifacts can now be reviewed; hourly/continuous operational activation still needs
its missing source/supervisor/rotation/alerting acceptance. No production deployment,
privilege expansion, root recovery or custodian change is requested by implication.
P3-U3a remains incomplete. See the [checkpoint evidence](../status/p3-u3a-restic-development-artifacts.md)
for tested boundaries and the separate trunk lifecycle progress.

## Current continuation checkpoint

[Read-only installed-state verification](../status/p3-u3a-development-storage-verification.json)
confirms the administrator-created storage service and uninitialized repository.
[Snapshot source candidate](../status/p3-u3a-snapshot-source-candidate.md) now has
disposable native TLS/AppRole/denial/revocation and end-to-end recovery evidence,
under a separate image/review manifest with retained execution disabled. It is not
attached to the real provider or installed as a job. Native authority/backup-first,
independent credential/key custody, actual audit integration and joint recovery
acceptance remain the next dependencies. Manual SMTP configuration, verified TLS,
authentication, submission and owner-confirmed inbox delivery have passed;
automatic backup-event alert integration remains pending. Do not rerun the completed host installer.
