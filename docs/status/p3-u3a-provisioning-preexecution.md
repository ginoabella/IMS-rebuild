# P3-U3a — Provisioning preparation and recovery pre-execution report

Prepared 2026-10-19 (Asia/Manila, +08:00). **Historical pre-execution review;
P3-U3a remains in progress.** The user subsequently approved the succession design,
explicitly authorized one operation and confirmed fresh protected human custody.
That operation executed on 2026-10-19 at 06:13 UTC, with verified recovered-root
revocation, independent succession, exact old-admin policy retirement and normal
restoration in a 27.04-second guarded window. See the authoritative
[execution evidence](p3-u3a-recovery-execution.md) for actual backup, inventory,
handoff, restoration and remaining acceptance. The one-time authorization is
consumed; this historical report does not authorize another recovery.

The sections below retain the review's preparation evidence and requested gates
as they stood before execution. Historical uninstalled/unverified/pending-approval
statements are superseded only by the actual execution evidence, not by inference.

## Concise readiness summary

**Tested:** final documented custody check (no usable custodian found); six real
disposable deadline/interruption/failure scenarios and exact cleanup; all 14
preparation checks; refusal of unapproved recovery and human setup; endpoint
read-only isolation; exact normal/recovery Compose comparison and protected
restoration baseline. The final complete `./dev check` passed, exit 0, on October 19 at approximately
02:32 UTC, including both corrected browser/API fixtures and the remaining
credential, staff, session and PBX registry checks. No remaining failure in that
required pipeline is reported. Earlier failed runs are retained below.

**Prepared and assigned:** the user accepted personal custody of dedicated
`platform-owner-custodian`; reviewed 15-minute human maintenance sessions and
fixed issuer replacement roles remove the need for routine root credentials.
The exact handoff plan, setup helper and explicit human login/logout helper exist;
no account/password/auth setup is installed.

**Unverified until an authorized window:** usable unseal custody, privileged whole-
server ACL/token/lease and endpoint-policy inventory, consistent provider/audit
backup, real new ACL/lease/import/issuer tests, successor independence, old-admin
retirement and actual retained restart/unseal/restoration without data loss.
A guard hard kill, host/daemon failure or unexpected privileged fact requires
manual containment/review; no automatic recovery/remediation is authorized.

**Subsequent outcome:** the separately authorized operation executed after fresh
custody verification and the mandatory real backup/inventory gate. The recovered
root and temporary human sessions were revoked, independent successors verified,
and normal protected configuration restored. Endpoint regressions passed; the later real token-lifetime escalation finding
blocks provisioning acceptance pending separate review. Trunk owner/database/HTTP
acceptance remains incomplete. See the execution record.

## October 19 review response and current readiness

The user withheld recovery authorization pending seven additional checks. No root
recovery, provider restart, listener enablement, privileged policy mutation or
administrative revocation is authorized by that review response or performed here.

| Review item                 | Evidence and remaining boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Existing custodian first | Final documented custody recheck: no `custodian.token` or `bootstrap.json`; `.local/platform-custody`, `.local/openbao-custodian` and `.local/trunk-credentials` absent. Existing endpoint admin excluded and unused. Metadata only; no seal contents read. Repeat immediately before any eventual execution and use a valid supplied custodian instead.                                                                                                                                                                                                                                              |
| 2. Detached deadline guard  | Real disposable Docker acceptance passed, exit 0: timeout before deadline, exact operation selection with a surviving different-operation decoy, launcher SIGKILL survival, watcher SIGTERM stopping its target, hard-killed/dead/zombie watcher readiness refusal (target requires manual resolution), unavailable Docker reporting uncertainty, duplicate targets refusing a guessed stop. All targets used network `none`, no ports, no volumes, read-only filesystem and dropped capabilities. Exact fixture cleanup passed. No retained service was targeted.                                    |
| 3. Future administration    | Concrete [custodian succession proposal](../planning/p3-u3a-custodian-succession-review.md): human login, 15-minute maximum maintenance sessions, two exact restricted issuer replacement roles, no routine root/admin bearer credential. The exact plan and manually gated setup helper are prepared, with scope/refusal tests; explicit setup approval is required. The user accepted personal custody; prepared account is `platform-owner-custodian`. Live login/ACL/TTL and issuer replacement proofs gate retirement inside the authorized window; no successor account is currently available. |
| 4. Complete pipeline        | Final complete `./dev check`: passed, exit 0, approximately 02:32 UTC. Earlier rerun exited 1 at a draft mixed-policy fixture; its explicit same-window baseline correction passed focused A-01–08 and then the complete graph. Both fixture corrections preserve security assertions; no application runtime source changed.                                                                                                                                                                                                                                                                         |
| 5. Restoration              | Protected mode-0600 `.local/endpoint-fixtures/p3-u3a-restoration-baseline.json` records original container/start time, exact image/user/restart, Raft/audit volume identities, read-only TLS/config sources, public certificate/config hashes, network IDs/aliases and no ports. Read-only endpoint isolation rerun passed. Configuration restoration is prepared; actual retained restart/unseal/data integrity and privileged endpoint policy/lease baselines cannot be proved without the authorized window.                                                                                       |
| 6. Unexpected privilege     | Stop and require separate review. Prepared provisioning now reads all expected policies/roles before any write, preserves exact matches, creates only absent objects and rejects differing or unknown role fields. Read-only fixture checks cover this refusal. This does not replace the privileged whole-server token/ACL/lease inventory required before execution.                                                                                                                                                                                                                                |
| 7. Readiness                | Tested safeguards and deferred live proofs are separated below. P3-U3a stays in progress. Ready to request explicit execution authorization; no operation is authorized by this report. The new succession setup must be explicitly included. Live-window safeguards below remain unverified, not waived.                                                                                                                                                                                                                                                                                             |

Reproducible guard demonstration: run `node scripts/openbao/check-recovery-deadline.mjs`
on the trusted Docker host. It uses only operation-labelled disposable containers;
it never mounts credentials, retained volumes or the Docker socket into its test
containers. Private evidence is `/tmp/p3-u3a-deadline-final.log` and `.exit`.
The guard now reports its non-secret watcher PID for interruption testing. It
cannot survive its own SIGKILL, host loss or Docker daemon failure. Those failures
require manual intervention; detached operation is not a high-availability
supervisor or a guaranteed stop during a host/daemon outage.

Preserving existing volumes and exact mounts avoids intentional data deletion;
this is not an unconditional data-loss guarantee or a tested backup restore. No
live Raft filesystem copy is claimed as a consistent backup. Before privileged
writes in an authorized window, inventory and protect exact original endpoint
policy bodies/token-role/lease facts, plus a consistent provider snapshot and
separately preserved audit data through trusted custody. If a required consistent
backup or restoration prerequisite cannot be established, stop before mutation.
Do not alter endpoint material ACLs or revoke endpoint worker/cleanup leases.
Restoring original endpoint **material** policy bodies must not restore the
retired administration escalation. Failure before cutover preserves existing
administration; failure after approved revocation cannot recreate revoked tokens.

## Necessity and existing custodian check

No usable platform custodian credential was found in documented deployment custody.
The dedicated trunk/custodian directories are absent. Read-only metadata inspection
of endpoint custody found no `custodian.token` and no `bootstrap.json`. The existing
`admin.token` is present but belongs to excluded endpoint administration; it was
not read, tested, repurposed or used to mint credentials. The source/bootstrap
contract confirms root self-revocation and bootstrap-file removal after setup.

Recovery is necessary to proceed **with the credentials currently available in
these documented locations**. If an authorized platform custodian is supplied
through protected custody before execution, check and use it instead. There is
no claim that all possible external custody locations were searched. Never ask
for a token, seal key or SIP password in chat.

## Verified prerequisites and limits

| Check                       | Observed result                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Retained provider           | Running pinned OpenBao 2.7.1/digest from the approved review; read-only container root filesystem                                       |
| Verified TLS                | Anonymous provider health returned HTTP 200 using the retained CA                                                                       |
| Normal recovery restriction | Anonymous `sys/generate-root/attempt` returned HTTP 405; normal HCL keeps the disabling switch true                                     |
| Exposure                    | No published provider ports; sole existing attachment is the internal endpoint-credentials network                                      |
| Retained storage            | Original named `/bao/data` and `/bao/audit` volumes attached; config/certificate/key mounts read-only                                   |
| Custody                     | Seal file and CA present with expected protected-file metadata; no seal-key contents read or unseal attempted                           |
| Existing process isolation  | Read-only endpoint isolation regression passed for HTTP/workspace/observers, provider ports and anonymous access                        |
| Canonical work              | Read-only PostgreSQL count: zero active endpoint operations and zero pending endpoint cleanup at this checkpoint                        |
| Credential worker           | No running endpoint credential-worker container in the observed running-container listing                                               |
| Proposed trunk identity     | Host UID/GID 1004 had no passwd/group entry; custody directory not created or chowned                                                   |
| Runtime continuity          | Existing provider/application/PBX containers remain running; no restart, network change, provider mutation or retained schema migration |

Recheck these immediately before execution; counts and container state are point-in-time.
File presence does not prove that the unseal key is usable. Actual unseal and
privileged policy/token inventory require the separately authorized operation.
The new token-role configuration and endpoint cutover are prepared code, not yet
validated against privileged real OpenBao APIs. Unexpected policy/role/lease facts
must stop the operation rather than be guessed or overwritten to make tests pass.

## Prepared implementation

- Exact installation-scoped policy/token-role plans and explicit custodian-only
  provisioning, including an acceptance-only one-second endpoint expiry role.
- Routine restricted issuance with fixed policies, orphan/lease/maximum checks,
  protected token-file inputs and conservative persistence/revocation handling.
- Opt-in endpoint provisioner/fixture-launcher cutover. It is inactive: no issuer
  file or restricted-fixture manifest has been installed. Existing endpoint
  material policies must match byte-for-byte before provisioning proceeds.
- Protected trunk import/exact-generation verification adapter, immutable CAS=0
  writes, changed-material rejection, missing/denied distinction, bounded requests
  and renewal, and private nonserializable token/settings fields. No HTTP or worker
  composition imports it yet.
- Approved [synthetic profile](../../infra/telephony/synthetic-trunk-profile.json),
  no registration, no real carrier/PBX contact.
- A manually invoked tmpfs-only recovery helper. It requires separate recent,
  operation-matched confirmation and refuses a repeated start marker. No confirmation
  has been staged. A refusal test proves the unconfirmed path exits before seal
  access or provider requests; it does not perform recovery.
- A token-free detached `recovery-deadline.mjs` guard, tested only on disposable
  targets and never armed for the retained provider.
  It accepts only a 30-second to 15-minute deadline and targets a single container
  carrying the exact operation label. It starts Docker discovery/stop early enough
  to budget its bounded calls within the window. It never unseals, generates root
  or restores application networking. Pure deadline/ownership tests exercise no
  Docker stop operation. The explicit disposable demonstration above exercises
  real Docker stopping without targeting retained services. A daemon/stop failure
  records uncertainty, not success.
- A manual-only [Compose recovery overlay](../../infra/docker/compose.openbao-recovery.yaml)
  and standalone configuration preparer. Configuration validation passed without
  applying it. The overlay replaces provider networks with one internal recovery
  network, removes ports, retains exact data/audit/TLS mounts and disables automatic
  restart during maintenance. The normal committed HCL remains unchanged and true.
- [Owner contract](../architecture/trunk-credentials.md) and
  [token/custody/recovery runbook](../runbooks/trunk-credentials.md), including
  manual 24-hour reprovisioning limits, fail-closed renewal and future production
  workload-identity/custodian/HA requirements, which remain separately reviewed work.

A mode-0600 non-secret manifest is prepared at
`.local/endpoint-fixtures/trunk-provisioning-manifest.json`. It includes retained
installation `58adb785-5384-41ce-9c72-ccda6ea554db` and synthetic acceptance
installation `fff38aad-2e3c-4149-aa3f-88f715d1b488`. The plan-only command passed
with 12 exact policies and 12 exact roles. This file does not activate the endpoint
cutover; `restricted-installation.json` and `issuer.token` remain absent.

The separately prepared human handoff plan adds one maintainer policy, two exact
issuer replacement roles and one native auth mount/account: 13 planned policies/14 token
roles for the two-installation setup, plus retirement of only the reviewed
existing old-administrator policy/accessor(s); this is not a complete server inventory. The user accepted personal custody;
account label is `platform-owner-custodian`. The non-secret exact plan is at
`.local/endpoint-fixtures/custodian-succession-plan.json`. No human password,
auth configuration, login token or execution approval file is staged.

These helpers are not a completed owner, credential binding API or secure
administrative cutover. Ordinary/endpoint queue filtering still needs trunk work
support before a new verifier consumer emits or claims trunk jobs.

## Exact execution, impact and restoration plan

The user has supplied the separate explicit single-operation confirmation.
Execute only after all prerequisites, including protected human-password custody,
are ready. The backup gate in the execution checkpoint is mandatory before any
policy, auth, role, issuer or administrative changes:

1. Record one operation UUID and the complete exact installation/policy/role
   manifest, including the retained endpoint installation(s) and separate synthetic
   acceptance installation. Recheck custodian availability, endpoint work counts,
   active consumers and custody. Preserve the original HCL, image, named volumes
   and network-attachment manifest. If another custodian is usable, skip recovery.
   The exact Compose file order for the isolated window is normal `compose.yaml`,
   `compose.credentials.yaml`, then `compose.openbao-recovery.yaml`. Set only the
   non-secret temporary config path through `MYIMS_OPENBAO_RECOVERY_CONFIG`.
   The overlay also requires the non-secret exact operation UUID through
   `MYIMS_OPENBAO_RECOVERY_OPERATION`. Before applying it, arm the prepared detached
   deadline guard on the trusted deployment host and require its ready marker.
   It must survive an interrupted chat/tool process. Immediately before applying
   the overlay, run its `assert-ready` action and require a live watcher, no
   completion/cancellation and remaining time above the stop budget. Do not open the recovery
   listener if the guard cannot be confirmed. Applying/recreating only
   `endpoint-secrets` with `--no-deps` is an execution
   operation and requires the separate confirmation. Restoration omits the last
   overlay and recreates only that provider with its original HCL/networks/mounts/
   restart policy; normal startup never includes the recovery overlay.
2. Pause credential consumers and trusted provisioners; quiesce provider operations.
   Isolate the retained provider and one trusted helper on a temporary internal
   recovery network with the TLS hostname alias `endpoint-secrets`. Disconnect
   normal provider networks for the window. Publish no ports and retain TLS/audit.
3. Use the prepared manual-only overlay and a standalone non-secret configuration
   from `prepare-recovery-config.mjs`, setting only
   `disable_unauthed_generate_root_endpoints = false`. Keep the committed normal
   HCL true. Restart the same retained service and manually unseal using the
   existing protected custody. Use UID 1003 only for this trusted custody holder;
   trunk runtime remains a distinct UID/GID 1004.
4. Stage the user's operation-matched confirmation and recovered root only on
   owner-only helper tmpfs. Run the manual helper once. Keep all key/token/OTP
   values out of argv, environment, output and persistent source. Limit the
   recovery-enabled window to 15 minutes. The deadline guard stops only the tagged
   recovery container on timeout, records the outcome and leaves consumers paused;
   it performs no automatic unseal or root recovery. Restore the disabled listener
   under the controlled failure procedure before reconnecting normal networks.
5. Through the shared trusted custodian, inspect actual privileges. Any unexpected
   ACL/token/lease/policy fact stops the procedure for separate review before
   further privileged writes or revocations. Only already-approved containment,
   known operation-root revocation and protected-listener restoration may continue
   while separate review is pending; do not remediate additional principals. Prepare the
   exact new mount/policies/token roles, preserve existing endpoint material ACLs
   and orphan leases, stage restricted issuers to separate custody and validate
   their exact rights. Require the explicitly approved and tested human custodian
   handoff described in the succession proposal. Prove fresh human login, exact
   limited session identity/TTL, restricted issuer replacement, expected ACLs and
   orphan successors. Cut endpoint issuance over to precreated roles only after
   those checks. Prepare exact old-administrator remediation against the reviewed
   baseline; do not retire it yet. Unknown equivalent privileges or mismatched
   endpoint ACLs stop for separate review. No endpoint material is copied, rotated
   or destroyed by administration remediation.
6. Run the prepared `finish-recovery.mjs <operationUuid>` helper to revoke the
   exact recovered root and cancel any remaining root-generation attempt. Verify
   revocation and remove transient root/OTP/confirmation custody. Now prove fresh
   human login and the orphan restricted successors still work independently of
   recovered root. Only then may the human maintenance session remove self-editing/
   unrestricted issuance from the exact known old administrator policy and revoke
   its exact reviewed accessor(s). Additional equivalent principals require
   separate review, never automatic remediation. Verify existing endpoint orphan
   leases/material policies are preserved. If the handoff fails, preserve the old
   administrator and stop for review; never regenerate root as a retry. No
   unrestricted root remains as a routine renewal mechanism. Keep the deadline
   guard armed through restoration; cancel it only after root revocation and
   normal service restoration are both verified.
7. Remove the temporary override, restart the same provider with the original
   protected HCL, manually unseal and prove verified TLS/health, anonymous root
   denial, unpublished ports and retained audit settings. Restore exactly the original
   normal network attachments and remove temporary recovery helper/network artifacts.
   The reviewed trunk network is a separate subsequent deployment step, not an
   exception to recovery restoration.
8. Run real role/ACL/token/custody checks, endpoint provider/API/isolation regressions
   and exact owned fixture cleanup. Reconcile any paused uncertain work before
   resuming consumers. Do not declare provisioning successful until these pass.
   Continue the owner/database/HTTP A-B/lifecycle acceptance and full P3-U3a work.

Expected impact: provider credential work is unavailable during isolation, restart
and seal/unseal. Both endpoint and trunk lifecycles share that interruption.
Existing endpoint material and lease bounds are retained; lease clocks continue
to run, so a lease reaching its limit requires trusted reprovisioning. Ordinary console/auth/database/
Redis services and Asterisk require no restart or configuration change. The
15-minute limit applies to the recovery-enabled window, not a guarantee that all
subsequent regression/maintenance work finishes within 15 minutes. Consumers may
remain paused longer if restoration or verification fails.

## Exact failure handling

Stop at the first unexpected effect. The detached guard remains armed through
interruption; its operation label prevents stopping the normal restored container.
If Docker discovery/stop is unavailable, treat its outcome as uncertain and retain
isolation for manual resolution. Never treat an unconfirmed deadline stop as a
restored or revoked provider. Restore the disabled root-generation setting,
retain the provider isolated and keep credential consumers paused. Preserve retained
Raft/audit volumes, existing custody and a protected exact operation manifest.
Attempt revocation of a known recovered root and cancellation of this operation's
attempt, recording only safe outcomes. Never overwrite a token file, recreate the
server, delete volumes, fall back to endpoint administration or automatically
regenerate root as a retry.

A lost generation/issuance response is uncertain. Preserve protected recovery state
and report whether token identity, issuance or revocation is unknown. Any additional
token-inventory investigation needed to account for an unknown administrative token
requires explicit review; it is not an automatic second recovery. Do not restore
normal network access/resume workers or claim cleanup until that uncertainty is
resolved and the protected listener/TLS/ACL/lease checks pass. Partially prepared
new roles/mounts remain inventoried; do not delete retained or associated material
to reverse an incomplete administration change.

## Verification results

- `./dev exec node --test scripts/openbao/trunk-preparation.test.mjs`: seven checks
  passed, exit 0, including local HTTPS exact import/replay/changed reuse,
  lost-import-response recovery, denied/missing/malformed states, file permissions,
  scope/role bounds and refusal of unconfirmed root recovery. HTTPS provider behavior
  is a fixture, not real OpenBao import/ACL/token evidence.
- `STORAGE_HOST_PROJECT_ROOT=/home/gino/projects/IMS-rebuild node scripts/check-endpoint-isolation.mjs`:
  passed, exit 0, against retained services. This is read-only partial endpoint
  isolation evidence, not new role/lease or provider lifecycle acceptance.
- Retained PostgreSQL read-only operation/cleanup counts and provider TLS/health/
  disabled-root/ports/volume metadata checks passed as recorded above.
- The existing session acceptance migration subprocess now uses owner-only
  temporary password files and password-free environment URLs, with exact cleanup
  on exit, to honor the credential-handling condition during endpoint regressions.
- Initial `./dev check` before the browser fixture correction: exit 1 in the final session/platform browser stage. Lint,
  formatting, typecheck, all builds, entrypoint/config checks, foundation,
  durability, storage, identity, storage-client/deployment, HTTP authority and
  platform HTTP checks passed. The draft browser passed. Platform browser
  expiry/canonical-owner retained-note recovery timed out at
  `scripts/check-platform-browser.mjs:603` (`toHaveValue`); no green complete-graph claim was made at that checkpoint. The initial focused rerun was interrupted without a recoverable exit result.
  The saved-log focused rerun also exited 1 at the same retained-notes assertion.
  The fixture now settles navigation/focus authority checks and asserts notes are
  captured before injecting expiry, retaining all recovery assertions and adding
  boundary-specific diagnostics. The rerun completed with exit 0, including draft
  and platform browser checks, real A/B logout/outage recovery, shared-session
  response-loss/expiry/fencing and owned fixture cleanup. No platform UI/session
  runtime source changed. A complete rerun after the browser correction passed all browser/authority/
  platform/staff checks but exited 1 later at the draft API mixed-policy registry
  assertion (`check-draft-tenants.mjs`, original line 776: 200 versus expected
  503). The fixture assumed an earlier 60-second registry had not expired; it now
  seeds a normal-policy request within a real Redis window before testing
  conflicting-policy denial. No runtime limiter code changed. Focused verification
  passed A-01–08, exit 0. The subsequent final complete rerun passed, exit 0.
- `./dev exec pnpm check:extension-inventory --credentials-api`: passed, exit 0.
  Existing endpoint/inventory API boundaries used real PostgreSQL/runtime grants,
  shared Redis, independent HTTP A/B, immutable enqueue/replay/conflict, authority/
  staff/forged-channel/CSRF/Origin/no-store checks and no premature configured state.
  Real pg-boss selection isolated ordinary versus endpoint consumers and installation
  A/B using an injected no-effect handler. Provider execution was not checked.
  Disposable database `myims_session_00bf1d9001ed` and its Redis fixture were removed;
  no OpenBao credential provisioning or PBX contact occurred.
- Initial preparation rerun: all seven original checks passed, including refusal of unconfirmed
  recovery/finalization and preservation of normal HCL during config preparation.
  Targeted changed-file lint passed. Effective Compose overlay validation passed
  without applying it. Normal backend live/ready returned HTTP 200; read-only
  custody recheck confirms the restricted endpoint issuer remains absent.

Outstanding required evidence includes real privileged OpenBao role/token tests,
reciprocal and cross-installation denial, actual import/verification, endpoint
provider regressions under restricted issuance, owner grants/Redis/two HTTP replicas,
recovery/interruption/cleanup races and all a acceptance. No such result is inferred
from preparation. P3-U3a stays in progress and the parent remains incomplete.

## Follow-up preparation evidence

- `node scripts/openbao/check-recovery-deadline.mjs`: final hardened guard passed
  all six real disposable-container scenarios plus exact cleanup, exit 0.
  `assert-ready` rejects completed/expired/cancelled state, dead/zombie watchers
  and process-start identity mismatch. No retained-provider guard was armed.
- `./dev exec node --test scripts/openbao/trunk-preparation.test.mjs scripts/openbao/provisioning-preflight.test.mjs scripts/openbao/custodian-succession-plan.test.mjs`:
  all 14 preparation checks passed, exit 0. Includes three read-only privileged
  configuration preflight checks, human plan scope/lifetime and unapproved human
  setup/session refusal before custody/provider access, in addition to the original seven. The extra human-session and issuer-replacement checks refuse
  missing protected custody before password or network access.
- Targeted `eslint scripts/openbao` and changed-file formatting checks passed.
  Preparation scripts added after the full pipeline's initial lint phase were
  checked separately; no application/backend runtime source changed in this review.
- Effective normal/recovery Compose comparison against the protected restoration
  baseline passed, including exact retained volume names, TLS/config sources,
  image/user/restart and network names. This was configuration-only; nothing applied.

## Final complete-pipeline result and execution request

`./dev check` completed **exit 0** at approximately 2026-10-19 02:32 UTC.
Private saved evidence: `/tmp/p3-u3a-complete-check-final.log` and `.exit`.
This includes lint, formatting, type checks, all builds, entrypoint/configuration,
foundation/durability/storage/identity/deployment, HTTP A/B/platform/staff/browsers,
draft API, credential lifecycle, session recovery and PBX registry checks.
The earlier rerun's mixed-policy fixture failure is preserved in
`/tmp/p3-u3a-final-full-check.log` (exit 1); focused corrected draft API acceptance
passed A-01–08 (`/tmp/p3-u3a-draft-api-final.log`, exit 0). The final whole graph
passed with both fixture corrections and all prepared helper source included.
No known failure remains in the required pipeline. This does not establish the
new OpenBao owner/binding/HTTP integration or complete P3-U3a.

**Requested, not granted:** authorize one isolated, manually controlled recovery
operation under this exact plan, including the separately specified
[custodian succession setup](../planning/p3-u3a-custodian-succession-review.md)
for the user-owned `platform-owner-custodian` account, reviewed exact policy/role
provisioning and retirement of only the known old administrator after independent
handoff proof. Recheck existing custodian availability and quiescence immediately
before execution; use a valid appropriately authorized custodian instead of
recovering root if available. Stage the human-held protected password before
opening a listener. No approval/password/recovery execution marker is staged now.

Expected impact remains two provider restarts/manual unseals and unavailable
credential operations during maintenance. Limit the recovery-enabled window to
15 minutes with the tested detached guard and immediate pre-apply readiness check.
Actual unseal, consistent backup, privileged inventory, new ACL/token/lease and
independent human/issuer handoff proofs remain gated to that window. Missing
prerequisites or unexpected privileged findings stop the procedure for separate
review; only approved containment/known-root revocation/restoration may continue.
Do not reconnect consumers or declare success on uncertain restoration. No live
SIP, carrier/PBX activation or production deployment is requested.
