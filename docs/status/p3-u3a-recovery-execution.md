# P3-U3a — Authorized recovery execution checkpoints

2026-10-19 (UTC). **Single authorized recovery and handoff executed; security acceptance blocked by a token-lifetime finding. P3-U3a remains incomplete.**

## Authority and limits

The user explicitly authorized one isolated controlled-development OpenBao recovery
operation, including the approved [custodian succession design](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-custodian-succession-review.md),
subject to every checkpoint in the [readiness report](p3-u3a-provisioning-preexecution.md)
and the final execution request in the conversation. This supersedes earlier
pending-approval wording; it does not establish that prerequisites or acceptance
have passed. No second recovery or material scope change is authorized.

Use a valid existing platform custodian instead of recovery if one is available.
The existing endpoint administrator remains excluded as provisioning authority.
Only reviewed installation policies, roles, restricted issuers and the dedicated
`platform-owner-custodian` account may be installed. No live SIP, PBX operation
change, real carrier contact or production deployment is authorized.

## Historical prerequisite checkpoints

- Read-only documented custody metadata: `custodian.token` and `bootstrap.json`
  absent; seal and CA files present. The endpoint administrator file is present
  but excluded and was not read or used. Restricted issuer file absent.
- `.local/platform-custody`, `.local/openbao-custodian` and
  `.local/trunk-credentials` are absent. No claim is made about external custody.
- The reviewed metadata diagnostic exited 0 in a disposable network-disabled,
  read-only container as UID/GID 1003, with read-only custody and helper mounts.
- The retained provider remains running with the original Raft/audit and read-only
  configuration/TLS mounts. No provider restart or network change was performed.
- The user subsequently supplied `private/openbao-custodian.password`. The file
  was regular, non-symlink, mode 0600, UID/GID 1002, Git-ignored and untracked.
  Its value meets the prepared helper's format when its single final line ending
  is omitted from a maintenance copy; no secret content was printed.
- **Custody finding:** the running workspace bind-mounts the checkout, and its
  application processes use UID 1002. Owner-only permissions therefore did not
  isolate this proposed password from those processes. This establishes access
  capability, not evidence of a read or compromise. No custodian account exists yet.
- Containment relocated the exact original file to
  `/home/gino/.openbao-custodian/password`, preserving its bytes and ownership.
  The new directory is mode 0700 and the file remains mode 0600. The checkout
  path is absent, and Docker mount inspection confirms that no running container
  mounts the new location. No application container was restarted or modified.
- An initial attempted destination under `.local/share` was rejected because
  existing parents were group-writable. No source move, permission change or
  destination creation occurred in that attempt. The successful destination is
  directly under the verified owner-controlled, non-group-writable home directory.

## Fresh password custody confirmed and operation executed

The user confirmed replacement with a freshly generated random password at
`/home/gino/.openbao-custodian/password` and a separate personally retained copy.
Recheck passed: regular, non-symlink, single-link owner-only file, UID 1002,
directory/file modes 0700/0600, compatible value after omitting the one final line
ending from the maintenance copy. No running container mounts this path. No
password content was printed; the original file remains unchanged.

The prior custody stop is resolved. A fresh metadata-only documented custodian
check still found no custodian/bootstrap; endpoint admin remains excluded. Read-only
PostgreSQL check returned zero active endpoint operations and zero pending cleanup.
The resolved custody prerequisite allowed the single authorized operation recorded
below. Earlier unused/unstarted statements in historical checkpoints do not override
this executed state.

A manual read-only `recovery-backup.mjs` helper now saves a provider-native snapshot,
checks archive/checksum integrity offline, separately preserves protected audit
records and captures privileged inventory. It omits bearer IDs from token metadata.
`recovery-checkpoint.mjs` requires an operation-matched, recent backup/inventory
review marker before either recovered-root provisioning helper can write.
Fixture evidence and actual retained execution evidence must remain distinct.

## Mandatory gates during the single authorized operation

1. Repeat custodian, custody, quiescence, baseline and restoration-prerequisite
   checks immediately before execution. Use a valid authorized custodian if found.
2. Require one operation UUID, exact approved manifests, isolated TLS-preserving
   networking and the tested detached guard. Assert readiness immediately before
   enabling recovery. Preserve the maximum 15-minute recovery-enabled window.
3. After obtaining authorized access, but **before any policy, auth, role, issuer
   or administrative changes**, obtain and protect a consistent provider-native
   Raft snapshot and separately preserved audit data. Verify completion, protected
   custody and restoration prerequisites for original configuration, volumes,
   certificates and network attachments. A live filesystem copy is not a substitute
   for a consistent Raft backup. This gate has not been executed or passed.
4. If the backup gate fails, abort privileged implementation. If inventory reveals
   an unexpected privileged ACL, token, policy or lease, stop for separate review.
   Perform only authorized containment, known recovered-root revocation and
   restoration; never automatically remediate extra principals or repeat recovery.
5. Install only approved succession/provisioning objects. Revoke recovered root
   and verify revocation, then independently test fresh human login and restricted
   issuer functionality. Only after successful independent succession may the
   exact reviewed old endpoint administrator be retired. Preserve it on failure.
6. Restore and verify normal protected configuration, TLS, network isolation,
   retained storage and audit settings. Cancel the guard only after verified root
   revocation and normal restoration. Reconcile uncertainty before resuming work.
7. Record actual handoff, restoration, endpoint continuity/regressions and real
   ACL/token results. Required PostgreSQL/Redis, HTTP A/B, cross-installation,
   import/verification and recovery/cleanup race acceptance remains outstanding.
   Do not mark P3-U3a complete until all required acceptance passes.

No backup, privileged lifecycle, succession or restoration success is claimed by
this prerequisite-only checkpoint. Earlier passing preparation/full-pipeline
results remain historical evidence in the readiness report, not execution proof.

## Actual execution — 2026-10-19 (UTC)

- Operation `56550aa4-2823-4b3c-a610-14a8f8094969` used the existing explicit
  authorization exactly once. No second recovery is authorized.
- The guard was armed with a 14-minute limit. Isolation began at 06:13:07.931 UTC;
  normal restoration was verified at 06:13:34.970 UTC: **27.04 seconds** within
  the bounded window. The guard was cancelled only after verified root revocation
  and normal restoration. Temporary helper/network were removed.
- Before provisioning writes, a real provider-native Raft snapshot passed offline
  archive, metadata and SHA-256 integrity checks. Separate mode-0600 audit data and
  privileged inventory were preserved in owner-only custody at
  `/home/gino/.openbao-custodian/operations/56550aa4-2823-4b3c-a610-14a8f8094969/`.
  Snapshot index/term: 1249/16. Snapshot SHA-256:
  `3c460f0658d15943ed6ab6796001b5d563666d7368c384359f97201c649fbaa3`.
  This is backup integrity and restoration-prerequisite evidence, not a performed
  snapshot restore. Restoring this pre-retirement snapshot would require separate
  privileged review and reconciliation of the earlier authority state it contains.
- Exact inventory review accepted 46 stored policies: the pinned-image default,
  original reviewed legacy administrator, and exact generated endpoint material
  policies. There were no token roles, one active token (the operation's recovered
  root), and zero leases. **No active old-administrator accessor existed to revoke.**
  No unexpected principals were rewritten or remediated.
- Installed only the approved two-installation provisioning plan and succession
  additions: 13 planned policies, 14 token roles, the `platform-custodian` userpass
  mount and `platform-owner-custodian` account. Existing endpoint material policies
  were preserved byte-for-byte. No source password or application response contains
  the human credential; no unrestricted routine bearer token was installed.
- Recovered root was self-revoked and subsequent lookup returned 403. A fresh human
  login then demonstrated the exact 900-second maximum, and both fixed issuer
  replacement roles issued independently functioning orphan/nonrenewable issuers
  with 24-hour hard maxima. Each issuer created and revoked scoped runtime test
  tokens for both approved installations; forbidden generic issuance, policy/role
  access, opposite-lifecycle and unapproved-installation issuance returned 403.
- The two initial root-issued restricted issuers were revoked after replacement.
  Replacement files were staged and checked durably before retiring the old
  administrator policy. That exact policy was changed to deny all; there were zero
  active old-administrator accessors. Its retained credential file was not read or
  repurposed. Temporary setup/fresh human sessions were revoked and verified.
- Endpoint issuer custody is under existing UID/GID 1003 custody; new separate
  trunk custody is UID/GID 1004, mode 0700 with mode-0600 files. Only newly created
  staging objects received ownership changes through network-disabled metadata-only
  helpers. Existing endpoint file ownership/permissions were not changed.
- Original protected HCL, pinned image, user, read-only root, Raft/audit/TLS mount
  identities, network ID/aliases, restart policy and no published ports were
  verified after restoration. TLS health returned 200 and anonymous root-generation
  access 405. Read-only endpoint isolation regression passed.
- Real endpoint provider/API/lifecycle regressions passed, exit 0, including
  PostgreSQL/Redis, HTTP A/B, real outage/restart/seal/unseal/expiry and cleanup
  races. Owned fixture teardown accounted for 26 generations (25 destroyed, one
  already absent), revoked scoped tokens, removed token files and removed the
  disposable database. Provisioning security acceptance is blocked as below. Trunk owner/PostgreSQL/Redis/HTTP A/B integration,
  durable lifecycle/cleanup races and complete P3-U3a acceptance remain outstanding.

Protected operation ledger: `.local/endpoint-fixtures/p3-u3a-operation.json`.
Sanitized execution log: `/tmp/p3-u3a-authorized-operation.log`.
Disposable rehearsal log: `/tmp/p3-u3a-recovery-fixture-final.log`; actual pinned TLS
OpenBao backup, review gate, succession, independent issuer/runtime checks, known
synthetic administrator retirement and protected export passed with exact cleanup.
All 18 focused preparation checks passed. Earlier complete `./dev check` evidence
remains preparation/baseline evidence; it is not a new post-execution pipeline run.

## Mandatory stop after post-operation lifetime test

The real restricted trunk issuer accepted a request for 48-hour TTL/explicit
maximum. The issued token's initial TTL was 86,400 seconds, but its reported
explicit maximum was **172,800 seconds**, violating the approved 86,400-second
maximum contract. The exact test token was self-revoked/403; all four other known
runtime test tokens were also revoked/403, and zero token files remained. The
non-secret [finding evidence](p3-u3a-token-lifetime-finding.json) was saved and the
exact test helper removed. No trunk import or periodic-token test had begun.
No claim is made that renewal beyond 24 hours was demonstrated.

Stopped under the user's unexpected-privilege review condition. No policy/role
remediation, repeat recovery or further privileged login was attempted. Root
remains revoked, provider restoration verified and the old policy remains retired.
The earlier rehearsal missed this override before retirement; that was a gap in
pre-execution verification. Endpoint regressions passed, but **provisioning is not
accepted and P3-U3a is not complete**. The
[hardening review](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-token-lifetime-hardening-review.md) includes
concrete request constraints for review/disposable validation and identifies the
unresolved backup/maintenance authority prerequisites before any retained changes.

The user subsequently authorized disposable-only validation. The
[follow-up evidence](p3-u3a-disposable-lifetime-validation.md) records the failed
original array constraint, corrected 14-path/434-negative matrix, privileged
overlap counterexample, expiry HTTP 500 and direct endpoint concurrency failure.
The [maintenance/backup proposal](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-retained-lifetime-maintenance-proposal.md)
is for separate design review. No retained remediation or further recovery was
performed; this historical operation's authorization remains consumed.
