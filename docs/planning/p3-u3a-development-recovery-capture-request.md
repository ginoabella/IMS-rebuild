# P3-U3a — Development native-backup and metadata-capture recovery request

October 21, 2026 (Asia/Manila, +08:00). **Completed October 22: native capture, protected restoration, encryption, ciphertext handoff, upload and retrieved-hash verification. This request is closed; P3-U3a remains incomplete.**
[Operation request manifest](../../infra/backup/recovery-capture-request.json).

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

## Approved bounded sequence (host prerequisites still apply)

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
The exact remaining controller preflight is listed below. Owner approval now covers bounded retained recovery/capture and one-time exact
repository initialization, subject to the remaining host prerequisites. Keep every
provisioning/policy/auth/role/user/custodian/production/cleanup authorization false.

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
| `restoration-helper` | UID/GID 1003; exact seal/CA and reviewed one-shot helper read-only; no audit/capture/token/client mounts | Only normal provider network, manual profile; default passive `verify-protected`, explicit `unseal` only after the root finisher |
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
branches are approved administrator actions, gated on successful capture/root cleanup
and protected restoration; **do not run them before those technical prerequisites**.
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
claim of full host-executor acceptance. The owner accepted the bounded capture metadata scope and approved the operation/
repository initialization on October 22. Full effective-authority review remains
outside this capture and is still required before later identity provisioning.
No privileged execution is requested until that procedure is concrete and verified.


Final image verification: 51/51 guarded Restic/native restore checks and 11/11
actual helper/capture/handoff checks passed for the pinned image, with exact
cleanup. The bundled archive/audit/snapshot suite passed 35/35; host handoff
synthetic tests passed 6/6. [Native helper evidence](../status/p3-u3a-recovery-capture-handoff-evidence.json).

## Approved continuation — October 22, 2026 (+08:00)

The owner explicitly approved this development native-backup and metadata-capture
recovery request. That approval covers its one operation, one root-generation
attempt, maximum 840-second isolation and one-time initialization of the exact
repository if uninitialized. The existing capture-only metadata scope is accepted;
it remains insufficient for effective-authority review or identity provisioning.
No second permission request is needed for these approved steps. Earlier draft
references to future approval are historical; technical preconditions still apply.
Approval has **not been consumed**: no retained seal key, root recovery, provider
API, repository operation or host staging mutation occurred in this continuation.

The native disposable fixture now uses real Compose recreation with a persistent
synthetic Raft volume, preserving the operation label/restart=no across recovery
and normal-network replacement. The actual finisher verifies root revoke/403;
restoration uses a one-shot unseal and active TLS health/anonymous generation 405
before deadline cancellation. All **15 checks passed**, including complete archive,
decryption, separate post-restoration audit and exact cleanup. The detached watcher
exited and its exact directory was removed. This verifies component composition in
the synthetic graph; it does not establish a complete retained host executor,
retained seal usability, repository initialization or joint PostgreSQL recovery.
[Reproducible evidence](../status/p3-u3a-recovery-capture-handoff-evidence.json).

The new manual [restoration overlay](../../infra/docker/compose.openbao-restoration.yaml)
must be applied over the ordinary base/credentials graph. It retains deadline
ownership while returning to normal HCL, TLS, volumes and network, with restart=no.
Keep that overlay until the same operation's finisher has confirmed revocation,
normal TLS health and anonymous 405 pass, then cancel the guard. Only after those
checks restore the ordinary restart policy in place. Keep the closed operation
label as historical metadata; do not recreate merely to remove that label, which
would cause another seal/unseal cycle. Assert the guard before and
after each recreation; any expired/uncertain guard fences further provider startup.
The new [one-shot helper](../../scripts/openbao/recovery-unseal.mjs) is mounted
read-only into capture-helper, adjacent to its pinned protected-file implementation.
It reads only the mounted exact seal file; one TLS unseal POST at most per
invocation, no mutation retry, bounded passive health polling, sanitized output.
`verify-protected` never reads the key and never sends an unseal request.
A separate manual `restoration-helper` has only the normal provider network and
read-only seal/CA/helper mounts. It defaults to `verify-protected`; its explicit
`unseal` invocation is for restoration after the root finisher. It receives no root
tmpfs, audit, staging or backup-client mounts. The isolated capture helper never
joins the normal network.

Rendered retained recovery/restoration/capture graphs passed no-port, exact
label/network/mount count and read-only checks. Metadata-only Docker inspection
found the provider still running on the normal network with the expected pinned
image and no recovery-operation label. No provider API was used for this check.
The eight host custody/preparation tests and four unseal fault groups passed;
scoped ESLint and the full workspace lint passed. Changed supported files passed
Prettier; `git diff --check`, Python syntax and local documentation links passed.
`./dev check` stopped at `format:check`: 19 untouched documentation/evidence files
have existing Prettier issues (including `docs/README.md`,
`docs/architecture/backup-platform.md` and older disposable evidence). None was
modified by this continuation. The remaining stages passed separately with
`./dev exec sh -c 'pnpm typecheck && pnpm build && pnpm check:entrypoints && pnpm check:config'`:
all workspace typechecks/builds, four process-boundary checks and six configuration
tests. The aggregate `./dev check` still fails at the existing formatting baseline.

### Administrator staging command (completed; do not rerun)

The shell runs as `gino` (UID 1002), and `sudo -n true` reports interactive
authentication required. The approved layout is root-owned outside the checkout;
this step needs the owner's authenticated host terminal. From the repository root:

```sh
sudo python3 scripts/backup-host/recovery-handoff.py --prepare --operation-id 24096f3d-bf41-4ec2-9e12-95e2057c115d
```

Expected status: `empty_staging_prepared`. This creates only the six exact declared
directories, refuses an existing operation or unsafe root, changes no existing
object, reads no credential contents and makes no Docker/network/provider request.
Partial preparation is preserved for review; do not retry it automatically or
remove it. Return the sanitized JSON status only; no password or key is needed in
chat. This is an execution-access dependency, not a request to approve the scope
again. The historical plan-only command still changes nothing.

After staging, finish the attended host preflight before isolation: verify fresh
source/config hashes and exact provider graph, prepare temporary HCL exclusively,
check audit size <=128 MiB and empty capture/archive destinations, validate client
credential custody/TLS and repository state, then create an operation-bound tmpfs
confirmation immediately before recovery. Never start an 840-second isolation
window while waiting for administrator input. Staging alone authorizes no new
attempt and consumes no recovery approval. Repository init/upload/retrieval,
retained capture and full host-controller acceptance remain unfinished.

## Attended controller ready — October 22, 2026 (+08:00)

The owner reported successful exact empty staging preparation. Independent mounted
metadata checks verified all three output leaves empty/0700/1003:1003, exact seal
file metadata (without key contents), and an approximately 8-MiB audit below the
128-MiB cap. Backup metadata checks verified private client ownership/modes, empty
spool/receipts and the matching protected backup public recipient, with no network
requests or private credential reads.

The manual [attended controller](../../scripts/backup-host/execute-development-capture.py)
now has exclusive, fsynced host operation fencing and uses the existing helper
image plus the read-only reviewed initializer source. Its preflight requires exact
source hashes, current provider/service/mount/network/hardening, pilot capacity,
empty staging, available unconsumed approval, and native evidence matching the
actual controller and initializer sources. No default startup integration exists.
The [initializer](../../scripts/backup/repository-initialize.mjs) refuses existing
configuration or a previous operation intent, verifies TLS/anonymous and wrong-repo
denial, persists intent before one Restic init, then verifies repository ID/version
and an empty snapshot set. Unknown initialization keeps the shared repository fence
and intent for attended reconciliation; there is no mutation retry.

Native initializer/backup/retrieval/decryption/restore regression passed **36/36**;
[initializer evidence](../status/p3-u3a-repository-initializer-evidence.json).
The complete actual controller methods also passed in a fresh synthetic TLS graph:
repository initialization, deadline arm, Compose isolation, one-shot unseal, one
root generation, native capture, same-operation root revoke/403, protected normal
network restoration/unseal/health/anonymous 405, guard cancellation, in-place
restart-policy restoration, helper removal, and both offline encrypted artifacts.
All four integration assertion groups passed, with exact fixture resources and
watcher removed; [controller evidence](../status/p3-u3a-native-controller-evidence.json).
Production preflight/authorization remains specific to the retained development
operation and is checked separately; the fixture never mounts retained resources.
Three initializer fault groups and four controller safety-sequencing groups passed.
Earlier synthetic bootstrap timeouts/ownership/bookkeeping failures remain in the
disposable run history; none involved retained provider access.

The controller keeps the normal provider's closed-operation label after verified
restoration and changes only its restart policy back to `unless-stopped` in place,
avoiding an extra recreation/unseal solely for label removal. Temporary recovery
helper and network are removed after verified root cleanup/restoration. The closed
host intent/config and deadline records remain accounted for. Protected plaintext
staging is preserved; no cleanup/rotation/provisioning or new scheduler is included.
The final execution status is recorded separately in
[operation evidence](../status/p3-u3a-development-capture-execution.json).

## Retained execution completed — October 22, 2026 (+08:00)

Operation `24096f3d-bf41-4ec2-9e12-95e2057c115d` completed native capture and both
encrypted artifacts. Restic initialized exactly once with the escrowed file
credentials; repository ID/version and empty snapshots verified before isolation.
Retained seal usability passed. The one root-generation attempt was followed by
native capture, owned-attempt cancellation, root revoke/403, protected normal
configuration/network restoration, one-shot restoration unseal, TLS active health
and anonymous generation 405. Only then was the independent guard cancelled and
normal `unless-stopped` restart policy restored in place. The closed-operation
label remains historical metadata. Root helper/temporary isolated network were
removed; detached watcher exit independently verified. Normal provider is running
with expected image, read-only root, normal network and no published ports.
Measured isolation-to-protected-restoration was **25.356 seconds**, below 840;
this is not a disaster-recovery RTO measurement.

Independent offline verification checked exact seven source files, private custody,
all source hashes, both ciphertext SHA256/length/age headers and operation-bound
receipts. Source plaintext remains only in the approved protected operation
staging; no source contents or key/token were printed. The separate post-cleanup
audit artifact is preserved without claiming rotation continuity. See
[exact IDs, hashes, sizes, timings and remaining flags](../status/p3-u3a-development-capture-execution.json).
No policy/auth/role/user/SecretID provisioning or custodian change occurred.
Root recovery and repository initialization approvals are consumed and disabled;
**do not rerun the capture controller or initializer**. The approved encrypted
transfer steps remain available, with no new scope approval required.

### Administrator ciphertext handoff (completed; do not rerun)

The only required host-privilege step now copies ciphertext/receipt pairs to the
existing UID/GID 12010 backup spool. `sudo` requires the owner's interactive
terminal authentication. From the repository root run these two commands once:

```sh
sudo python3 scripts/backup-host/recovery-handoff.py --handoff --artifact baseline --operation-id 24096f3d-bf41-4ec2-9e12-95e2057c115d
sudo python3 scripts/backup-host/recovery-handoff.py --handoff --artifact audit-after --operation-id 24096f3d-bf41-4ec2-9e12-95e2057c115d
```

Expected status for each: `ciphertext_handoff_verified`. Return only the two JSON
results. These exact operations read/copy only encrypted files and their receipts,
verify hash/custody/operation binding, preserve source and refuse overwrite. They
make no Docker/provider/repository request and access no seal, root token, private
age identity or client credentials. A partial failure remains fenced for attended
review; do not repeat automatically or delete anything.

After both handoffs, the existing separately isolated UID/GID 12010 uploader can
commit the ciphertext spool using file credentials, followed by receipt/snapshot-ID
and retrieved-ciphertext SHA256 verification. Those remaining transfer steps are
already approved. No retained repository upload has yet happened; there is no
Restic backup snapshot ID for this capture yet. Off-host fresh-backup decryption,
isolated native restore coordinated with PostgreSQL and credential-generation
reconciliation, current effective-authority review and ongoing backup operations
remain later acceptance work. No plaintext staging cleanup is authorized.

Completed evidence is also protected from accidental controller replay: the consumed
operation was invoked again solely to verify immediate preflight refusal with no
provider access and an unchanged execution-evidence SHA256. A small reporting fix
ensures refused preflight never replaces completed evidence; all five controller
safety groups pass. The exact controller source used for the real operation is
preserved in its closed host operation directory and matches the recorded native
rehearsal/execution SHA256. No second root attempt or repository init occurred.

## Capture/upload request complete — October 22, 2026 (+08:00)

Both owner-executed ciphertext-only handoffs returned `ciphertext_handoff_verified`
with the exact original archive IDs/hashes. Independent no-network verification
confirmed four spool files, expected capture-operation binding, immutable ciphertext
hashes/lengths, private backup-service custody and no previous upload receipt.
A fresh exclusive `upload-started.json` was fsynced in the closed host operation
directory before calling the existing pinned uploader once; uncertain upload is
fenced from retries and must reconcile the known receipt/snapshot instead.

The UID/GID 12010 uploader used only the backup network and file credentials; no
capture/audit/seal/root/private age mounts or application/provider network.
Durable receipt `42aec76d-652e-4150-94a1-31c26910e02e` confirms snapshot:

```text
e259689800a00c5a42109a9c8e72a49a6a908bc659ea79a3f9dc0b1ca0d10582
```

The [read-only verifier](../../scripts/backup/verify-upload.mjs), mounted separately
into the same pinned tools image, checked the exact repository ID and upload
receipt against the two expected original archive hashes. `restic ls --json`
confirmed exactly four file paths. Bounded streaming `restic dump` retrieval
verified both ciphertext SHA256/lengths and both receipt SHA256/lengths, with
`--no-lock`, no cache, clean environment, file credentials and TLS CA/hostname
verification. No retrieved bytes, credential contents or plaintext were printed;
there was no age decryption, repository write or OpenBao API access in verification.
The current retained snapshot provided the real-service verification of this
read-only helper; scoped ESLint/Prettier passed. Exact upload/verifier containers
are absent and the provider remains running on its normal topology.

[Execution evidence](../status/p3-u3a-development-capture-execution.json) records
repository/receipt/snapshot IDs, helper source hash, all original and retrieved
hashes, source timing, consumed approvals and explicit limitations. Protected
plaintext staging, ciphertext spool, receipts, durable host fences/config/executed
source and closed deadline records are preserved; no cleanup/prune/delete occurred.
All steps of this approved capture/upload request are now complete. Do not rerun
root recovery, repository initialization, upload or either administrator handoff.

This verifies storage and retrieval of the encrypted current native capture plus
independent cleanup audit. Fresh-backup off-host retrieval and age decryption,
isolated native restore coordinated with PostgreSQL and credential-generation
reconciliation, measured RPO/RTO and ongoing backup identity/rotation/scheduling/
audit continuity/alerts remain acceptance work. Captured metadata remains owner-only
and is not approval of effective authority or of snapshot identity provisioning.
No policy/auth/role/user/SecretID write, custodian change, application deployment,
PostgreSQL/Redis or Asterisk change, production action or plaintext cleanup was
performed. **P3-U3a remains incomplete.**
