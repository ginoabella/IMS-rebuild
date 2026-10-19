# Trunk credential preparation and token operations

Private development only. See the [owner contract](../architecture/trunk-credentials.md)
and [conditional provisioning review](../planning/p3-u3a-provisioning-and-provider-profile-review.md).
P3-U3a remains incomplete. Commands below describe implemented preparation helpers;
no retained-provider provisioning or trunk owner integration has passed acceptance.

## Read-only custodian preflight

Run `scripts/openbao/check-custodian.mjs` in an isolated trusted deployment container
with the selected custody directory mounted read-only at `/custody`, private provider
network access and no token in environment/arguments. `metadata` checks only file
metadata. `custodian.token` or `bootstrap.json` checks availability and, when present,
uses self-lookup/capability APIs and prints only safe booleans. Never use endpoint
administration as a candidate. A positive representative capability result still
requires exact manifest authorization before provisioning. The helper does not
recover root, read seal-key contents or change configuration.

2026-10-19 observed: documented custodian/bootstrap files absent; endpoint admin
file present but excluded; seal/CA files present. Verified-TLS anonymous health
returned 200; root-generation attempt returned 405; no published provider ports.
No claim is made about credentials outside documented custody or the validity of
the excluded endpoint admin. Supply any additional custodian through protected
custody, never chat. Otherwise the conditional recovery design is the fallback,
with the separate single-operation authorization now granted. See the
[execution checkpoint](../status/p3-u3a-recovery-execution.md): human-password
custody is verified, the one-time operation has executed and root is revoked.
Use the native human custodian for reviewed maintenance; no further recovery is
authorized.

## Mandatory backup and succession checkpoints

The single-operation approval does not waive any prerequisite. Before enabling
recovery, verify personally retained human-password custody, safe protected input,
immediate restoration prerequisites and the detached deadline guard. The user supplied a checkout file that was accessible to workspace application
processes. The user replaced it outside container mounts and confirmed separate personal
custody. The single operation executed with verified backup and succession gates;
its authorization is consumed.

After obtaining authorized access, obtain and protect a consistent provider-native
Raft snapshot and separately preserve audit data **before any policy, authentication,
role, issuer or administrative changes**. Verify backup completion and restoration
prerequisites for the original configuration, TLS material, retained volumes and
networks. Do not treat a copy of live Raft files as a consistent backup. If a
required backup or restoration prerequisite cannot be established, abort privileged
implementation; perform only authorized containment, known-root revocation and
restoration. Unexpected privileged inventory also stops the operation for review.

Revoke recovered root and verify revocation before independent fresh human and
restricted-issuer functionality tests. Retire only the exact reviewed existing
administrator after those tests pass; preserve it on failure. No automatic repeat
recovery or extra principal remediation is permitted. Actual backup, succession and normal restoration passed. Endpoint regressions
and full trunk owner/API acceptance remain separately required. See the
[execution checkpoint](../status/p3-u3a-recovery-execution.md) for resume conditions.

## Preparing exact restricted roles

A reviewed non-secret manifest has shape:

```json
{ "version": 1, "installations": ["00000000-0000-4000-8000-000000000001"] }
```

Use actual recorded installation UUIDs, at most 64, no duplicates. Run the plan
command inside the Docker workspace:

```sh
./dev exec node scripts/openbao/provision-restricted-roles.mjs plan /tmp/reviewed-installations.json
```

This command performs no network I/O. The documented UUID is illustrative, not an
approved retained-provider installation. Review generated exact paths, allowed
policies, one-hour worker token request/24-hour maximum and fixed issuer access.

`apply` is trusted deployment only. It requires `/custodian/custodian.token` and
`/custodian/ca.crt`; new issuer outputs go exclusively to protected `/output`.
Stage that output under platform custody, then install each issuer into its own
endpoint/trunk directory with the correct distinct owner and mode. Never mount
platform custody or both lifecycle issuers into a runtime process. Existing endpoint
material policies must match byte-for-byte or the operation rejects. After separate authorization and real role checks, explicit installation of
`issuer.token` into endpoint custody activates the prepared restricted path in
`provision-endpoint-credentials.mjs`. Before that cutover, prepare the non-secret
`.local/endpoint-fixtures/restricted-installation.json` with version 1 and the
precreated acceptance installation UUID. Existing browser fixtures also require
roles for the canonical catalog installation. Update the protected manifest before
issuing new fixture scope; the issuer cannot create policies. The launcher mounts
the prepared helper directory read-only. No issuer file or fixture cutover manifest
has been installed by preparation. This stage does not remove the old administrator.
Partial effects must be reconciled against the exact manifest before another run;
never overwrite retained output tokens or assume provider/SQL atomicity.

## Future custodian handoff gate

The previous phrase “authorized shared platform custodian” did not establish a
credential capable of replacing restricted issuers after 24 hours. See the concrete
[custodian succession proposal](../planning/p3-u3a-custodian-succession-review.md).
It recommends human login and maximum 15-minute maintenance sessions, with exact
issuer replacement roles, separate reviewed installation/policy changes and no
routine root or generic issuer rights. This auth setup is approved and covered by the single-operation authorization,
and installed, with verified protected human-password custody and independent
post-root-revocation login/issuer checks.
Verified root revocation and independent human/issuer tests precede old-admin
retirement; failed succession preserves the existing administrator.
The exact plan and gated setup helper are prepared. A separate explicit
`human-custodian-session.mjs open`/`close` helper uses protected password/CA inputs
and `/session` tmpfs, validating the 15-minute maximum without an existing admin
credential. Both human helpers refuse absent custody/approval before any provider
access. Success paths require real verification after approved account setup;
no current script silently creates the account or logs in unattended.

## Token lifetime and failure behavior

**Acceptance blocked:** the current role setting must not be presented as a proved
24-hour ceiling. A real 48-hour request returned a 48-hour explicit maximum with
24-hour initial TTL. The test token was revoked/403 and further provider work
stopped. The policy below remains the required contract; see the
[hardening review](../planning/p3-u3a-token-lifetime-hardening-review.md) before
any changes. Normal helper validation alone does not establish provider enforcement.


Runtime importer/verifier/cleanup token requests use one-hour TTL, a 24-hour
explicit maximum, fixed installation policy, orphan service tokens and no default
policy. Cleanup is mounted only for an explicit maintenance run. The verifier
must renew before work and schedule renewal at the earlier of 20 minutes or half
its returned remaining lease; a shortened final lease never permits a 20-minute
blind interval. `OpenBaoTrunkProvider.renew` asks for one hour and returns the granted
seconds, rejecting invalid, nonrenewable or less-than-60-second grants. It cannot
extend the approved 24-hour maximum.

A renewal/authorization/availability failure pauses new provider work, preserves
canonical intents and returns sanitized unavailable. Verification must not extend
owner proof without a successful exact read. Expired proofs reject dependent
binding/adoption; no local credential cache substitutes for provider authority.
After a lost import response, reconcile the exact reserved key before resupply.
The adapter alone is not yet a durable lifecycle worker.

At the maximum lifetime, trusted deployment uses the exact precreated role to
issue a replacement. Stage it to a new mode-0600 file, validate identity/policy/
installation/lease, install by atomic rename and restart only the dedicated
consumer to load it. Then revoke the old token by its protected accessor and remove
old custody files after confirmed revocation. Preserve uncertainty if issuance,
installation or revocation fails. Never broaden rights, fall back to endpoint
credentials or run automated root recovery. Fixed-file Docker mounts may retain
the old inode; restart/recreate the dedicated consumer after atomic replacement.

Restricted issuer tokens themselves expire at their explicit 24-hour maximum.
Before expiry, an authorized shared platform custodian must issue a successor with
only the exact issuer policy; validate/stage/swap/revoke under protected deployment.
If that custodian is unavailable, stop provisioning and report the access dependency.
Do not pretend that a restricted issuer can renew indefinitely or reissue itself.
Preserve existing endpoint orphan worker/cleanup leases during administration changes.

For production, establish a separately reviewed workload-identity/short-lived
issuance mechanism, monitored lease renewal, audited custodian succession and
emergency access, HA/seal custody and joint PostgreSQL/provider backup recovery.
Those are production prerequisites and proposals, not an approved or implemented
production service. The private development one-share seal and manual 24-hour
custodian handoff do not establish production operations.

## Required verification before success

Run real own-generation/reciprocal/cross-installation ACL checks, forbidden role/
policy/default-policy/TTL escalation, token renewal/maximum/expiry, TLS/seal/restart
and process/custody denial. Preserve exact cleanup/accessor manifests. Then execute
endpoint provider/isolation regressions, canonical owner database/Redis/HTTP A-B
integration, authority/response-loss/audit rollback and import/cleanup races, followed
by affected PBX/auth/durability checks and `./dev check`. Record actual results and
injected boundaries. None of these are waived by a passing pure-plan check.

## Manual recovery helper boundary

`scripts/openbao/recover-custodian.mjs <operationUuid>` is prepared for a separately
confirmed, isolated recovery window only. Never run it during ordinary startup or
acceptance. It refuses to read seal custody or contact the provider without an
owner-only `/recovery/confirmed.json` containing that exact operation UUID,
`executeRecovery: true` and a `confirmedAt` timestamp less than five minutes old.
The trusted deployment owner may stage that file only after the user's additional
confirmation. `/recovery` must be container tmpfs, and an existing start marker
blocks another generation attempt. No confirmation file has been staged here.

The helper assumes that isolation, temporary listener configuration and manual
unseal were separately performed under the confirmed procedure. It does not do
those operations. It keeps recovered root only in protected tmpfs for the scoped
provisioning window. The operator must run `finish-recovery.mjs <operationUuid>` in the same isolated
helper to revoke that exact root and cancel any remaining
attempt. The finisher verifies self-lookup denial before removing the root token
and records only a non-secret revocation marker; it still requires restoration.
Remove transient material, restore the protected listener and verify
restoration before reconnecting normal provider networks. Preserve the normal
committed HCL and retained volumes throughout.

A lost recovery response can leave an uncertain administrative-token effect. Stop,
keep the provider isolated and protected custody retained, restore the disabled
root-generation setting and report the exact uncertain step. Do not regenerate
root or reconnect workers as an automatic retry. Any token-inventory investigation
needed to resolve an unknown recovered token must be explicitly reviewed before
claiming revocation/cleanup. A failed recovery is never successful provisioning.

Before any confirmed recovery listener is opened, arm the token-free detached
`recovery-deadline.mjs start <operationUuid> <deadlineIso>` on the trusted deployment
host and require `deadline_armed`. Immediately before applying any recovery
overlay, run `recovery-deadline.mjs assert-ready <operationUuid> <stateDirectory>`
and require `deadline_ready`; it refuses expired/cancelled/completed state or a
missing watcher. A previous ready marker alone never authorizes opening a listener. Supply the same UUID in the manual overlay's
`MYIMS_OPENBAO_RECOVERY_OPERATION` label. The watchdog has no provider token or
seal material and stops only one exactly tagged recovery container on deadline,
allowing bounded Docker discovery/stop time within the 15-minute window. It never
unseals or generates root. It writes only a safe outcome; a failed Docker stop is
uncertain and requires manual isolation/resolution. Do not arm it during normal
startup or ordinary checks. No retained-provider watchdog has been armed; only disposable guard tests ran.

Keep its private state directory until the operation is reconciled. Cancel with
`recovery-deadline.mjs cancel <operationUuid> <stateDirectory>` only after verified
root revocation AND normal restoration. Its detached process survives an interrupted
chat/tool process; host failure and Docker-control failure still require manual
recovery. The recovery container's `restart: no` prevents automatic reopening on
host restart. Preserve the exact normal image/mount/network/restart-policy baseline.

## Explicit disposable guard demonstration

Run `node scripts/openbao/check-recovery-deadline.mjs` on the trusted Docker host.
This check creates only network-none, no-volume/no-port disposable containers with
unique operation labels. Real timeout, exact selection, launcher SIGKILL survival,
watcher SIGTERM, hard-kill readiness refusal, unavailable Docker and
ambiguous-label failure reporting passed. Readiness checks process start identity
and rejects dead/zombie watchers; a killed watcher cannot stop its target.
The check removes exact owned fixtures. It never targets retained OpenBao.
A detached guard cannot survive its own SIGKILL, host loss or daemon failure;
uncertainty requires manual isolation/restoration, never a success claim.

Unexpected privileged policy/token/lease/ACL facts stop execution and require
separate review. Provisioning preflight compares all expected existing policies
and roles before any write and refuses mismatches/unknown role fields; it is not
a substitute for the separately required privileged whole-server inventory.
