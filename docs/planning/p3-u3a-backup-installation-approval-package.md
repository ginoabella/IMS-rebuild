# P3-U3a — Minimal backup installation and authority proposal

Updated 2026-10-21 (Asia/Manila, +08:00). **Architecture/requirements decision
recorded; review-only installation plan, no retained execution authorization.**
Source: owner's **P3-U3a — Final Backup Platform Selection for Development and
Production** decision. The existing two-capability OpenBao direction and custodian
restrictions remain unchanged. Unknown operational authority does not mean absent.

## Approved platform and evaluation boundary

**Restic + append-only Rest Server through Docker is selected for both development
and production**, superseding B2/SeaweedFS primary-platform preferences. The owner
explicitly accepts the absence of reliable server-enforced timed COMPLIANCE
retention. Timed immutable retention is a future security enhancement, not a current
acceptance blocker. The [authoritative backup security contract](../architecture/backup-platform.md)
preserves all other custody, recovery and operational requirements.

The [Restic evaluation](../status/p3-u3a-restic-backup-evaluation.md) passed 26/26
disposable native backup/restart/append-only/retrieval/decryption/restore checks.
The [SeaweedFS evaluation](../status/p3-u3a-seaweedfs-backup-evaluation.md) remains
historical evidence of failed concurrent retention/hold enforcement. Neither
report establishes retained installation or production readiness. No retained
service, credential, snapshot identity or schedule was created by this decision.

## Recommended small implementation

Keep `platform-owner-custodian` and its verified restrictions unchanged. Prefer an
existing independently authorized backup job and attended maintenance operator.
Do not repeat either consumed login, inspect protected inventories, or discover
credentials to establish availability. Ask for non-secret operational records.

If no suitable existing mechanism can be established, propose one native backup
AppRole, one separately unlocked attended maintenance account, one host systemd
timer and a separate OS audit collector. Use the current provider and network;
no new scheduler service, database, secret store or OpenBao restart is needed by
this design. Actual host service installation still needs its own approval.

Use one dedicated long-running append-only Rest Server container and persistent
repository volume; run the pinned Restic client in short-lived Docker containers.
Preserve identical age archives, manifests and backup workflow across environments.
Development may share the MyIMS host, accepting shared host/disk/admin failure and
no off-host recovery guarantee. Production requires an independently administered
physical backup server or NAS, restricted ingress, authenticated TLS with CA/name
validation, capacity monitoring and an additional independently protected recovery
copy or equivalent reviewed backup-host-compromise safeguard. Exact endpoints,
volumes, custodians and safeguards are unresolved. Garage remains unchanged.

Ordinary clients have no overwrite/delete/prune access to existing data or storage
mount; separately controlled administrators perform reviewed maintenance. Restic
clients can read repository ciphertext; age private keys remain independently held.
Lock-file deletion is the protocol exception, not permission to delete backup data.
Retained deployment, service activation and OpenBao access need separate approval.

Encrypt bundles with [age public-key encryption](https://github.com/FiloSottile/age).
The job holds only a reviewed recipient/public key. Recommend the owner keep the
private identity in two protected copies on separate off-host media/locations,
with any unlocking password available independently of this host and OpenBao.
Test decryption from each copy in an isolated exercise; retain prior key versions
until dependent archives expire. This adds a command-line utility, not another
secret service. No retained archive key has been generated or read; evaluation-only
synthetic keys were generated and removed. Archive keys and seal/unseal
shares are distinct; neither belongs in the ordinary backup set.

Recommend the repository owner initially be accountable for the destination,
host job, rotation and alerts, pending explicit assignment. Keep storage-admin
and attended-maintenance credentials separately unlocked and absent from the
scheduled job. One person holding these roles is **not independent two-person
control**. Independent custody here means separate from OpenBao, its application
processes and its host; a second trusted recovery custodian remains an owner choice.

## Actual facts still required before installation approval

| Required fact | Current state and proposed resolution |
| --- | --- |
| Existing backup/maintenance route | Unknown; obtain non-secret operator/job name, mechanism, approved scope and recent success/recovery evidence from the owner |
| Installer principal and authority | Unknown; identify an independently authorized existing installer and the authorization reference; custodian is unsuitable |
| Actual backup destination/owner | Restic/append-only Rest Server selected for both environments; exact per-environment TLS endpoint/repository, persistent volume, credentials, host/admin owner, capacity and production independent-copy/safeguard plan remain unresolved |
| Protected encryption custody | Not established; owner names custodian, public recipient fingerprint, two private-copy locations described without secrets and independent unlock procedure |
| Seal/TLS recovery custody | Existing protected arrangements are not re-inspected; name responsible custodian and separately authorize availability verification |
| Host job, audit and rotation owners | Proposed owner responsibility, unconfirmed; name alert recipient and existing notification channel too |
| Audit source and measured capacity | Source configuration describes a separate audit file; actual segment ownership, rotation mechanism, size/rate and destination continuity are unverified |
| Joint PostgreSQL recovery | Owner/recovery point and generation-reconciliation procedure must be named; source migration success is not a database backup |
| Size, duration and budget | Snapshot/audit growth, remote transfer, service quotas and restore throughput are unmeasured; approve limits only after disposable tests and separately authorized retained measurement |

The [review manifest](p3-u3a-backup-installation-review-manifest.json) records these
as unresolved values. It deliberately cannot authorize execution. Destination,
key custody and installer facts must be filled and reviewed **before** retained
implementation approval; a generic provider recommendation cannot substitute.

## Minimal Restic installation plan (review only)

The [consolidated development installation request](p3-u3a-development-backup-installation-request.md)
now names candidate services/profiles, exact proposed paths/volume, custody,
network/startup behavior, schedules, unresolved operational owners and controlled
first-backup/joint-recovery steps. [Docker artifacts](../../infra/backup/compose.yaml)
are prepared and disposable-only; no retained installation is authorized.


1. Prepare reviewed Docker artifacts using the evaluated pins: Rest Server
   `restic/rest-server:0.14.0@sha256:d2aff06f47eb38637dff580c3e6bce4af98f386c396a25d32eb6727ec96214a5`
   and Restic `restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510`.
   These are evaluated candidates, not a claim about latest releases. Require
   `--append-only`, `--private-repos`, protected authentication, validated TLS,
   restricted networking, persistent data, read-only container root and dropped
   capabilities. No job receives a Docker socket or repository filesystem mount.
2. After separate deployment approval, initialize separately scoped development
   and production repositories through attended administration, escrow recoverable
   repository credentials independently, and hand only scoped append-only client
   credentials to the uploader. Keep full-access maintenance off the client path;
   do not disable append-only mode on a client-reachable endpoint for maintenance.
3. Resolve the existing installer/backup-first gates below before any OpenBao
   provisioning; validate necessary snapshot-only identity and rotation in
   disposable services. Capture native Raft plus separate audit/config/manifest,
   age-encrypt, clean up the provider token, then invoke Restic on encrypted output.
4. Verify append-only negatives/restart, TLS/auth isolation, outage/capacity/audit
   alerting, credential rotation and repository integrity in disposable services.
   Candidate operations schedule: weekly repository checks and monthly full data
   reads; retain bounded execution and alerts. Establish production independently
   protected copy/safeguard and verify its recovery before production acceptance.
5. Pass the separately authorized isolated joint recovery exercise below before
   enabling the retained hourly timer/continuous audit collector. Quarterly restore
   exercises and post-maintenance repository verification remain required. All
   retained provisioning, initialization and activation in this plan await approval.

## Exact installation authority and backup-first order

A host administrator's Docker/filesystem access does not establish OpenBao API
provisioning authority. No known authorized installer is established by this
repository's accepted evidence. Do not use recovered tokens, old backups, another
account or a new root operation to fill that gap.

The preferred order under a separately approved operation is:

1. Establish a named existing installer and named backup route from owner-supplied
   metadata. Separately approve exact access and current effective-authority and
   pre-state inspection. Review token, identity/group/auth/role composition; the
   ten-path custodian check does not satisfy this. Stop if scope is incomplete.
2. Preserve a fresh native snapshot, complete separate audit checkpoint, encrypted
   destination acknowledgement and recovery prerequisites **before the first write**.
   The owner accepts same-host Rest Server for development; production requires
   independent backup-host acknowledgement and its reviewed recovery-copy safeguard.
   Platform selection does not waive backup-first order.
   Installation prerequisites and host/storage preparation do not waive this gate.
3. If a new backup identity is necessary, install only the four backup POSTs below;
   read back exact configuration, deliver protected credentials and perform the
   separately approved acceptance run. Preserve a fresh post-provision backup.
4. Install the maintenance policy and new attended user only after the approved-destination
   backup gate. Then separately review/authorize the three policy hardening writes;
   installing maintenance authority does not authorize using it for remediation.
5. Install/enable the reviewed host job only after native tests, exact credential
   custody, destination protection and initial recovery verification pass.

Proposed installer capabilities, scoped to these operations, are:

| Exact path | Operation and necessary capability |
| --- | --- |
| `sys/policies/acl/platform-raft-snapshot-reader` | Read prior/after body, create/update exact reviewed policy (`read`, `create`/`update` as native endpoint requires) |
| `sys/auth/platform-backup` | Enable only the proposed AppRole mount (`update` and root-protected `sudo`); mount TTL config is included in this write |
| `sys/auth/platform-backup/tune` | Read-only exact configuration confirmation (`read`, plus root-protected `sudo` where required); no tune write proposed |
| `auth/platform-backup/role/platform-raft-snapshot-reader` | Read/create/update exact role (`read`, `create`/`update`); no other role |
| `auth/platform-backup/role/platform-raft-snapshot-reader/role-id` | Read exact RoleID into protected host custody |
| `auth/platform-backup/role/platform-raft-snapshot-reader/secret-id` | Generate initial SecretID (`update`), with output only in protected custody |
| `sys/policies/acl/platform-backup-maintenance` | Read/create/update exact maintenance policy after backup |
| `auth/platform-custodian/users/platform-backup-maintainer` | Read/create exact new attended user after backup; existing userpass mount reused without tuning or modifying `platform-owner-custodian` |

This table describes authority an **existing authorized installer would need**;
it does not grant a new installer policy. Native endpoint capabilities and bodies
need pinned disposable validation. Stop on any unexpected existing target rather
than overwriting it. Existing auth-mount compatibility and absence of unreviewed
identity-policy overlap must be established under separate named read approval.
See native [AppRole](https://openbao.org/docs/api/auth/approle/),
[userpass](https://openbao.org/docs/api/auth/userpass/) and
[auth mount APIs](https://openbao.org/docs/api/system/auth/).

If an installer exists but no backup-first route can be established, the **minimum
exception for separate consideration** is exactly four pre-backup POSTs:

1. Create `platform-raft-snapshot-reader` ACL policy.
2. Enable `platform-backup` AppRole with 300-second mount TTL limits.
3. Create its single snapshot-reader role.
4. Generate one initial SecretID for that role.

Then capture and preserve the first verified backup at the approved destination before any
maintenance-policy/user installation or hardening. Exact bodies and policy-body
hashes are in the manifest. No custodian expansion, maintenance pre-backup write,
root recovery, live-volume copy, listener change or restart is included.
This exception would leave the original pre-install state without a verified
backup; that irreducible risk must be explicitly accepted. It is **not approved**.
If no independently authorized installer can be identified, even this exception
cannot run: provisioning authority itself remains unresolved. Do not recommend
an unspecified recovery or bootstrap action as if it were authorized.

## Candidate credential and provisioning manifest

The JSON companion pins the proposed paths and bodies, backup ACL and maintenance
ACL hashes. These are review candidates, not tested configuration. Candidate
bounds are 300-second backup service tokens; 30-day, 1,000-use SecretIDs rotated
at least seven days before expiry; and 900-second attended human sessions. At
hourly cadence, 30 days needs 720 scheduled logins; 280 uses remain for separately
approved tests/pre-change runs. A catch-up burst or retries can consume that
margin, so no automatic authentication retries or catch-up burst is proposed.
Actual native use accounting and rotation must pass practical tests.

The reader has only snapshot GET, self lookup/revoke and self-capability query.
It has no renewal ACL, material read, restore, child issuance or administrative
write. Native `renewable` metadata may still be true; do not claim that an ACL
absence makes the token intrinsically nonrenewable. Check actual issued maximum,
origin, type, policies, identity-policy absence, period and TLS before snapshot I/O.
No default policy or unreviewed entity/group grants are allowed.

The maintenance account's own policy is distinct from the three target issuance
policies it may read/update. It also generates and destroys SecretIDs only for
the exact backup role, using protected accessor lookup/destroy. It cannot edit its
own policy/user, role configuration or auth mount. Rotation retains a protected
old/new credential journal, stages a successor exclusively, tests one login,
accounts for/revokes that token, swaps the host credential atomically, then destroys
only the recorded old SecretID accessor. Lost replies stop for reviewed reconciliation;
SecretID destruction does not revoke previously issued tokens. Rotation ownership
must be assigned before scheduling. A maintenance session may be able to obtain a
backup token by creating a SecretID; this is a trusted attended administrative
capability, not separation against a malicious maintainer.

Policy-body writers remain trusted administrators. A narrow policy path does not
prevent intentionally putting broader grants in that policy. Approved hashes,
writer exclusion and readback detect deviations; they are not a server-wide ceiling.
Protected current authority inventory is a separate operation-specific read scope,
not a new standing wildcard inventory grant in this minimal policy. Its complete
named path/object manifest is still required before retained execution.

## Host workflow, schedule and containment

Propose `myims-openbao-backup.timer` at minute 10 each UTC hour (minute 10 each
Manila hour too), no randomized delay and `Persistent=false`. A missed run alerts;
there is no automatic replay burst. Use one operation lock shared with attended
pre-change backup, concurrency one, no shell-expanded secret arguments, and an
existing host scheduler where possible. No systemd unit or host account is installed.

Proposed `myims-openbao-backup.service` runs at most 600 seconds, followed by a
separate bounded 60-second cleanup/verification allowance. Reserve 60 seconds for
one login, lookup, snapshot GET and owned-token revoke/403 before encryption/upload;
no provider token enters uploader custody. Snapshot GET is bounded to 30 seconds
and 128 MiB. These are initial cutoffs, not measurements; exceeding one alerts
and blocks dependent maintenance instead of expanding it automatically. Cleanup
must run on interruption; if acknowledgement/403 cannot be established, record
uncertainty, stop automatic logins and wait for approved reconciliation or proven
expiry. An outer timeout alone cannot prove token cleanup.

Use separate host permissions for audit collection and upload. Snapshot helper
receives only backup credentials, CA and provider network; audit collector reads
only exact configured file/segments and has no bearer; uploader receives only
encrypted output and destination credential, with no provider connectivity or
archive decryption key. None receives a Docker socket, seal shares, source mount
or application credentials. Trusted host administration remains a trust boundary.

Collect audit continuously, independently of hourly snapshots, forwarding closed
segments and complete line boundaries with inode/offset/hash continuity. The collector should forward encrypted complete segments to the same approved backup
destination independently of the hourly timer, reusing an existing approved host
collector if available. If only hourly upload can be provided, the intervening
audit tail is not yet archived at the destination and continuous forwarding is not
established; present that gap before implementation approval. Audit monitoring
must detect failures between snapshot runs. Preserve records through snapshot
and token cleanup and continue collecting afterward. Never truncate/replace the
active audit file or suppress audit failure. Exact OS source/rotation integration
and gap/truncation tests remain mandatory implementation work.

Use unique run/object names, exclusive writes, 0700/0600 custody, bounded encrypted
staging outside application mounts, fsync and member/hash validation. Final quota
must include measured audit volume; no unbounded spool on an unavailable remote.
Run Restic backup only after provider cleanup; require repository commit and
integrity acknowledgement tied to an independently protected run receipt. Restic
writers can read repository ciphertext and hold the repository password; age
private keys stay absent. Verify append-only configuration and actual existing-data
overwrite/delete/forget/prune denial, with only lock-file deletion excepted. No
maintenance credential or direct data-volume access reaches the job. Mark a set
successful only after all applicable gates pass.

Storage/network/encryption/audit/cleanup uncertainty preserves the prior remote
set, quarantines partial output within its quota, emits safe stage/time/count
status and blocks privileged maintenance. Notify the named owner through an
existing approved channel; this proposal sends no message or notification. Pause
on expiry, exhaustion or rotation uncertainty; no alternate login, policy repair,
known-weaker rollback, restore or root fallback occurs automatically.

## Storage and recovery constraints to approve

Retain the candidate **hourly sets for 30 days plus monthly sets for 12 months**,
with audit covering at least 13 months and the oldest retained snapshot through
present. These are administrative preservation windows pending configuration
approval, not timed immutable locks. The former 30-day COMPLIANCE minimum is no
longer mandatory. Separately controlled attended maintenance reviews trusted
receipts/capture times and suspicious additions before exact forget/prune selection;
never trust attacker-controlled timestamps or snapshot counts alone. Ordinary
clients cannot perform destructive maintenance. Verify recovery sets and the
production independent copy or reviewed equivalent safeguard before separately approved pruning, then check the
repository and record deletions. No destructive command is authorized here.

Budget approximately 720 hourly plus up to 12 monthly snapshots: at the proposed
128-MiB cutoff, 732 full snapshot inputs total about **91.5 GiB**, excluding audit,
configuration, encryption overhead, staging and additional copies. This is planning
arithmetic, not measured Restic repository usage or a deduplication guarantee.
Measure growth, transfer/restore throughput and audit rate before approving quota,
spool and capacity warning/critical thresholds. Review the production recovery
copy/safeguard's independent custody, lag, verification and host-compromise recovery.

Hourly snapshots, a 75-minute freshness incident threshold, two-hour RPO,
four-hour RTO and quarterly exercises remain private-development planning targets.
A pre-change backup should be at most 15 minutes old **at the first write**, with
complete audit and remote acknowledgement; renew that gate through a separately
authorized run if preparation takes longer. No target is an operating guarantee.

Before readiness, separately authorize an isolated recovery exercise: retrieve
one encrypted set with a separately held restore credential; decrypt using each
independent key copy; verify snapshot/audit/config hashes and continuity; restore
and unseal a fresh isolated pinned provider using separately authorized seal
custody; restore the approved PostgreSQL point; compare exact owner/binding/
generation/version-1 material, reservations, associations and pending work.
Missing/mismatched records stay unavailable; never manufacture attestations.
Review authority revived from the snapshot against later preserved administrative
and revocation records before any reconnect. No ordinary clients, SIP/PBX or
retained data volume are reachable from the exercise. Record measured recovery
point/time, wrong/missing-key and mismatch failures, token accounting and exact
teardown. Restore permission and seal access are not conferred by this package.

## Review outcome and continued local work

Platform selection and acceptance of the timed-retention limitation are settled.
Remaining concrete approvals are listed below; none is supplied by this decision.

1. **Deployment and custody configuration:** name each environment's repository/TLS
   endpoint, host, persistent volume, administrator, job/audit/rotation/alert owners,
   allowed network peers, CA/certificate custody and capacity thresholds. Name the
   production additional-copy custodian or equivalent safeguard and its independent
   deletion authority, copy lag and recovery test. Approve public age recipient,
   independent private-key copies, recoverable Restic credentials and separate seal
   custody references without putting secrets in this repository.
2. **OpenBao authority and backup-first gate:** identify an already independently
   authorized installer and existing backup route from non-secret records; separately
   authorize exact access/effective-authority and pre-state inspection. If a new
   snapshot identity is needed, approve the exact manifest bodies only after the
   first-backup gate; the four-write bootstrap exception above remains unapproved
   and needs its own explicit decision if genuinely necessary. No root recovery or
   custodian expansion is included.
3. **Exact installation/activation scope:** review Docker/host scheduler/collector
   artifacts, pinned images, mounts/permissions, TLS/authentication, rollback and
   credential handoff; approve exact retained host/service activation separately.
   This package defines the plan but installs nothing. Production deployment needs
   its own explicit authorization and satisfied production controls.
4. **Operations configuration:** approve tested token/rotation/use limits, cadence,
   administrative retention windows, verification schedule, alerts/response owners,
   capacity/spool budget and measured recovery targets. Destructive forget/prune
   requires separately controlled authority and reviewed operation-specific scope.
5. **Recovery acceptance scope:** explicitly authorize isolated retained archive
   retrieval/decryption, seal access/native restore, PostgreSQL recovery point,
   generation/authority reconciliation and exact teardown. Record measured RPO/RTO
   and additional-copy/safeguard recovery results before production readiness.

Independent canonical owner/grants, worker isolation, provider integration,
definitions, binding, claim/adoption and transaction testing remain authorized.
The [owner foundation](../status/p3-u3a-trunk-owner-foundation.md) is only a local
checkpoint. Retained 48-hour maximum, native HTTP 500/expiry counterexamples,
browser-recovery finding, conditional transaction timing and integrated A/L
acceptance remain unresolved. **P3-U3a is incomplete.**
