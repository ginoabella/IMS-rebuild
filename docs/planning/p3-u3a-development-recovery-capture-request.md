# P3-U3a — Development native-backup and metadata-capture recovery request

October 21, 2026 (Asia/Manila, +08:00). **Draft; not execution-ready or approved.**
[Disabled request manifest](../../infra/backup/recovery-capture-request.json).

## Why this separate operation is needed

The owner has verified recovery of the Restic credentials and a separately wrapped
OpenBao seal copy on Windows. Native key usability against the provider is still
untested. No independently usable OpenBao installer is established; the current
human custodian correctly denies snapshot and self-policy access. Existing root
and limited-session approvals are consumed.

The existing offline inventory reviewer describes the **pre-succession** deployment
(one token auth mount and zero token roles). It cannot approve today's two auth
mounts, named human and 14 token-role configuration. Do not weaken it or mark today's
state verified from policy names. A complete current-state/provisioning review is
not yet established.

Recommend separating the first real native backup/current metadata capture from
identity installation. This request proposes **capture only**: no new policy,
authentication mount, role, user or SecretID. The four previously reviewed backup
identity writes remain a later separately approved operation. This avoids applying
privileged changes under an unreviewed current-state assumption, but means this
capture alone does not establish an ongoing backup identity or rotation authority.

## Proposed exact boundary

- Development provider only, proposed operator `gino` as attended trusted Docker
  host administrator. No production, Asterisk, PostgreSQL/Redis service change,
  application deployment, issuer rotation or current-custodian login/change.
- One recovery operation ID, one root-generation attempt, maximum 840-second
  provider isolation window. Existing detached deadline guard must be armed and
  assert-ready before configuration change and must target only the exact labeled
  recovery provider. It stops that container if the deadline/launcher fails; it
  does not revoke root, restore configuration or unseal automatically.
- Temporary isolated internal network, no host ports, same pinned OpenBao image,
  same Raft/audit volumes and TLS files. Offline prepared temporary HCL changes only
  `disable_unauthed_generate_root_endpoints` from true to false. Ordinary HCL stays
  unchanged. Provider-dependent credential operations will be unavailable during
  isolation; no application permission/fallback is relaxed.
- Mount only the exact existing seal file/CA into the attended helper, read-only;
  root credentials and OTP stay in protected ephemeral memory/tmpfs. No key/token
  in argv/env/log/chat/application mounts. Provider key usability is tested by the
  specifically approved unseal/quorum step, not by an extra preliminary login.

## Proposed sequence under future approval

1. Recheck source/config/image/mount/network hashes, custody acknowledgements,
   operator ownership, repository credential protection, pilot capacity and exact
   working directories. Prepare a fresh operation-bound confirmation only after
   approval; never reuse historical confirmations or root files. All path/volume
   ownership must be concrete before this draft becomes execution-ready.
2. If still uninitialized, initialize exactly the approved Restic repository once
   using the escrowed file credentials and verified TLS, with no policy changes.
   Stop on an unexpected existing repository/configuration rather than replacing
   it. Initialization requires explicit inclusion in final operation approval.
3. Arm/assert the independent deadline guard; isolate/recreate only the provider
   with the prepared recovery overlay. Manually unseal using the exact existing
   seal key and wait for healthy active TLS service before one root-generation
   attempt. Confirm root identity. If unseal fails, do not reinitialize, rekey or
   try other keys/accounts; restore the protected configuration and report that
   the provider may remain sealed pending owner intervention.
4. Run the existing operation-bound native capture helper: snapshot <=128 MiB,
   <=30 seconds, offline Raft archive/hash verification, exact separate audit file
   preservation, bounded administrative metadata capture. Before capture, refuse
   an audit/input larger than the archive helper's 128-MiB per-file bound. Preserve
   raw captured metadata in owner-only operation custody; no secret KV API reads.
   Capture the helper's stated scope (mount/auth/audit configuration, policy bodies,
   token-role configuration, token accessor metadata and lease metadata). This is
   **not** a complete identity/group/auth-user effective-authority inventory or an
   authorization to provision. Root self metadata excludes its bearer token ID.
5. Cancel the owned generation attempt, revoke root and confirm lookup 403, using
   the same operation's finisher even if capture fails. Restore normal protected
   HCL/TLS/network/mount/restart settings and unseal only under this operation's
   approved restoration scope. Confirm root-generation anonymous 405 and safe
   readiness before cancelling the guard. Unknown issuance/revocation or failed
   restoration remains an incident; no second generation attempt or automatic
   privilege remediation is authorized.
6. Through separately reviewed host-only staging (no provider network in archive
   helper), encrypt snapshot, recovery-reference/inventory metadata and separately
   preserved audit with the installed **backup** age recipient. Upload through
   the isolated backup network and verify receipts/retrieved ciphertext SHA256.
   Preserve an independent audit increment through root cleanup and restoration.
   Ordinary backup clients never prune or delete; uncertain commits are reconciled
   by receipt/snapshot ID rather than repeated authentication.
7. Record exact source/audit/ciphertext/Restic IDs and timing. Off-host retrieval,
   decryption and isolated native restore coordinated with PostgreSQL and credential
   generation reconciliation remain later acceptance work; do not mark readiness
   complete from successful capture. Manual recovery-key checks do not substitute
   for actual recovery of this fresh backup.

## Failure and retained artifacts

If capture/inventory is incomplete, perform only known-root cleanup and protected
restoration; do not install anything or patch policy to make a gate pass. Preserve
exact partial artifacts and uncertainty. The guard can stop a provider but cannot
prove revocation, configuration restoration or safe unseal. No live-volume copy,
root reuse, broad cleanup or destructive rollback is permitted.

No deletion is proposed: protected plaintext capture staging remains accounted for
until a separately reviewed exact cleanup. Ciphertext spool/receipts remain finite;
no timer/startup activation or unattended operation is approved. Repository pilot
capacity is not long-term retention acceptance. Timed COMPLIANCE retention remains
deferred; existing renewal HTTP 500, expiry timing, retained lifetime policy and
browser findings remain unresolved. P3-U3a remains incomplete.

## Work required before asking for execution approval

The guarded recovery/Restic/native restore regression passed 51/51 on the new
candidate image, operation `502dec41-e8e7-4644-bd75-4b8766b7b766`. Actual native
recover/capture/finish helpers and offline complete-capture/separate-audit handoff
also have disposable evidence. These prove the tested components, not the final
retained-host controller, current effective authority or joint PostgreSQL recovery.
The exact remaining controller preflight is listed below. Keep every retained
recovery/provisioning/initialization flag false until separate final approval.

## Concrete staging and capture artifacts — October 21 (+08:00)

[Manual-only services](../../infra/backup/compose.recovery-capture.yaml) now pin a
separate recovery-capture tools image. Default startup selects no service. None is
included in `./dev`, and no service/host directory has been activated by preparation.

Private staging root is **`/srv/myims-openbao-recovery-development`**, root:root
0700, outside the backup-service-owned `/srv/myims-backup-development`. The proposed
operation `24096f3d-bf41-4ec2-9e12-95e2057c115d` has a root:root 0700 operation
parent and these UID/GID 1003, mode-0700 children: `capture`, `encrypted`,
`encrypted/baseline`, `encrypted/audit-after`. Refuse existing/unexpected objects;
no recursive chown, source replacement or cleanup is proposed. The no-read layout
command is `python3 scripts/backup-host/recovery-handoff.py --operation-id
24096f3d-bf41-4ec2-9e12-95e2057c115d` (one shell line).

| Component | Identity, inputs and output | Network/start behavior |
| --- | --- | --- |
| `capture-helper` | UID/GID 1003; exact seal and public CA files read-only, audit volume read-only, operation capture directory writable, root/OTP only in owner-only `/recovery` tmpfs | Only external internal `myims-rebuild-dev_openbao-recovery`; manual profile, idle until attended commands, restart no, no ports/Docker socket/Raft mount |
| `archive-capture` | UID/GID 1003; seven capture files read-only, only baseline ciphertext output writable, exact backup public recipient read-only | Network none; one manual invocation, restart no; no seal/token/client credentials |
| `archive-audit` | UID/GID 1003; audit volume read-only, only independent audit ciphertext output writable, same public recipient | Network none; one manual invocation after cleanup/restoration; does not establish rotation continuity |
| Administrator handoff | Root host process validates operation/receipt/age header/hash, strict file custody and stable descriptors; exclusive ciphertext/receipt copies into existing backup spool as 12010:12010 mode 0600 | No network, Docker, provider request or credential read; no overwrite, source deletion or automatic retry; partial failure keeps a review fence |
| Existing uploader | UID/GID 12010; ciphertext spool and file credentials read-only, receipts writable | Backup repository network only; no capture/seal/root/private age material; retained initialization/upload still requires final approval |

Only the network-none archive services receive supplemental group 12010 to read
the existing root:12010 0440 **public** recipient. No client credential directory is
mounted. Native fixture verification includes the same public-file custody.

Capture preserves exactly `before.snapshot`, `before.audit.json`,
`audit-configuration.json`, `snapshot-integrity.json`, `inventory-start.json`,
`inventory.json`, `download-complete.json`. The offline helper verifies native
snapshot integrity, operation binding, complete audit JSONL and captured hashes,
then age-encrypts all seven files and an integrity manifest. Separate post-cleanup
audit is another encrypted artifact; both use the existing backup recipient, never
the independent seal-wrapping recipient. Inventory preservation is **not** effective
authority approval. No bearer token or seal/private key belongs in either archive.

The handoff helper's explicit `--handoff` and `--artifact baseline|audit-after`
branches are future administrator actions, **not authorized commands to run now**.
They read only ciphertext/receipt files from these fixed paths. Root-owned staging
and any partial outputs remain accounted for pending exact separately reviewed
cleanup. The 1-GiB spool bound and 2-GiB repository pilot remain finite; reject
oversized captures rather than silently truncating them.

## Remaining concrete preparation before final approval

The capture/archive/cleanup code path, metadata preservation, restricted public
recipient and ciphertext transfer have native disposable evidence. Complete the
retained-host controller preflight: exact empty-directory preparation, one-shot
unseal transport without argv/env key exposure, rendered provider/helper graph,
normal-network restoration while keeping deadline ownership across provider
recreation, safe readiness and anonymous generation denial before guard cancellation.
The 51-check guard rehearsal uses one fixture container across restarts; it does not
prove retained Compose recreation/label handoff. Do not replace that gap with a
claim of full host-executor acceptance. Current metadata review scope and final
owner approval of the bounded operation/repository initialization also remain.
No privileged execution is requested until that procedure is concrete and verified.


Final image verification: 51/51 guarded Restic/native restore checks and 11/11
actual helper/capture/handoff checks passed for the pinned image, with exact
cleanup. The bundled archive/audit/snapshot suite passed 35/35; host handoff
synthetic tests passed 6/6. [Native helper evidence](../status/p3-u3a-recovery-capture-handoff-evidence.json).
