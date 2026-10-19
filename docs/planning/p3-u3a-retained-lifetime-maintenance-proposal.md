# P3-U3a — Retained lifetime maintenance and backup proposal

2026-10-19 UTC. **Design review only. No retained execution authorization.**
The previous single recovery authorization is consumed. This proposal neither
requests nor permits repeat root recovery. The disposable test authorization
permits preparing this document, not performing the steps below.

## Proposed changes and decision gates

The [original manifest](p3-u3a-token-lifetime-hardening-manifest.json) failed normal
array-form issuance in the pinned provider. The [array-form candidate](p3-u3a-token-lifetime-hardening-array-manifest.json)
preserves the same three policy names, exact 14 paths, capabilities, installations,
five required parameters, TTLs and renewability. Its only body change from the
original proposal is `"policies" = [["exact-policy-name"]]` instead of
`"policies" = ["exact-policy-name"]`. Runtime requests remain unchanged.

Read the [disposable evidence report](../status/p3-u3a-disposable-lifetime-validation.md)
before approving either design or execution. A deliberately privileged overlapping
policy widened the maximum, and accelerated renewal encountered a provider error.
These observations must remain visible in the decision; they are not replaced
with application-only enforcement. No retained acceptance has passed on the
strength of a disposable test.

Future execution must pin all three current policy hashes and role/userpass/auth
configuration, check active identities and identity policies, reject unexpected
overlap or extra privileges, and use independently fresh maintenance sessions.
No policy/role repair on inventory mismatch is authorized. Keep endpoint/trunk
material policies, existing tokens, leases and installation boundaries unchanged.
Any proposed temporary privilege is additional scope requiring explicit approval.

## Missing authority and the backup dependency

The existing custodian can update `endpoint-*` and `trunk-*` policies/roles. It
cannot update `platform-deployment-maintainer`: that exact path explicitly denies
access. It also cannot read `sys/storage/raft/snapshot`. Those denials were tested
in the disposable matching configuration; no retained login was performed here.
No currently available credential with either missing authority is assumed.

**The original backup-before-privileged-change gate cannot currently be satisfied
using the custodian alone.** Creating a new backup reader through its approved
prefix maintenance permissions would itself make privileged policy/role changes
before obtaining the snapshot. Do not call that preparation unprivileged or
silently treat a prior snapshot as a fresh consistent backup.

Preferred route: an already authorized, separately protected snapshot-reader and
an already authorized narrowly scoped policy maintainer, if independently verified
and made available by the owner. Do not search protected custody or assume those
principals exist under the present disposable-only authorization. If unavailable,
retained execution remains blocked unless the owner explicitly approves a separate
backup-access bootstrap exception and its exact manifest. No automatic fallback.

## Narrow rootless bootstrap option for separate design approval

This is a concrete sequence to refine and rehearse before an execution request,
not a ready-to-run privileged script. Use one operation UUID, protected files only,
an operator-held 15-minute non-renewable human session, no persistent maintenance
bearer, and a maximum five-minute non-renewable orphan ticket token.

1. Recheck authorized existing backup/maintenance authority first. Stop if any
   unexpected token, policy, role, identity mapping or lease is found.
2. If the owner separately approves the backup-access exception, create exactly
   one `endpoint-maintenance-<operation>` policy and same-named token role. Its
   initial authority is **read-only** `sys/storage/raft/snapshot`, self lookup and
   self revocation. Its role allows only that policy, service/orphan tokens,
   no default/root/identity policies, no period, no renewal, 300-second explicit
   maximum. Temporarily append one exact creation path to the existing endpoint
   issuer policy with all five required/literal constraints, complete-array policy
   matching, `ttl`/`explicit_max_ttl` both `"300s"`, and no extra fields. This is
   exactly three bootstrap writes, not a generic creation or administrator grant.
   The ticket may be issued only during the explicitly approved attended window.
3. A separate protected helper uses the existing endpoint issuer only to mint
   that exact ticket; the human session is not attached to it. Verify its actual
   sole policy, orphan status, 300-second maximum, no renewal/period/identity
   policies and forbidden generic issuance before use. Keep its known accessor
   privately for exact revocation. No secret value travels in environment/argv.
4. Obtain the native consistent Raft snapshot and preserve the separate audit
   data as below. **No hardening or maintenance-policy elevation before the
   verified backup checkpoint.** If this fails, revoke the ticket, remove only the
   temporary creation grant, preserve inventory/evidence and stop. The two now
   non-issuable temporary policy/role objects remain for separate cleanup review:
   the custodian has no delete grant, and the failed backup checkpoint forbids
   automatically elevating the ticket for cleanup. Do not invent a delete grant.
5. Only after the checkpoint, use the human's existing exact prefix authority to
   replace the ticket policy with narrowly bounded maintenance/cleanup authority:
   read and update only the three named target policy paths; updates constrained
   to their reviewed final bodies; delete only the operation's own temporary
   policy and role. No generic policies, auth/user configuration, token creation,
   root generation, endpoint/trunk material access, lease revocation or snapshot
   restore permission. The ticket remains limited to the same five-minute
   absolute lifetime. Any need to replace an expired ticket requires attended
   human reauthentication and a separately recorded attempt, never recovery.
6. Apply the exact three final bodies with hash comparison immediately before
   each write. The final endpoint body removes the temporary creation grant.
   Independently test fresh human login, fixed issuer replacement, existing issuer
   parameter enforcement, installation isolation and required regressions. Revoke
   only known test issuers/children, never ordinary existing leases to force a pass.
7. Delete the exact temporary role and policy (policy last). Its remaining token
   may lose self-revocation when the policy is deleted; the fresh human session's
   existing `revoke-accessor` authority must revoke that exact known accessor and
   verify failure of subsequent token lookup. Revoke the human sessions and
   remove owned private token files. Keep sanitized audit/evidence and backups.

This option needs further **disposable** proof of parameter matching for complete
policy-body strings containing wildcard paths, native snapshot access, policy
replacement/cleanup races and failure at every bootstrap checkpoint. A literal
policy-body allowlist must not accidentally act as a glob. Do not approve or
implement this option as exact-body bounded authority until those tests pass.
The two prefix-maintenance permissions are already administratively powerful;
this procedure does not claim that provider ACLs enforce human approval or protect
against an intentionally malicious authorized policy writer. The overlap finding
makes that trust boundary explicit. Production identity/approval isolation remains
subject to separate SSO/MFA, workload identity and administrative review.

## Mandatory backup and restoration checkpoint

A future approved operation must protect a **new** consistent native Raft snapshot
of the current post-succession state, plus independently preserved audit data.
Use owner-only protected storage outside application/container source mounts;
write exclusively, enforce bounded sizes/timeouts, flush/sync, record SHA-256,
verify gzip/tar structure, snapshot index/term and archive member checksums. Verify
pinned provider/image compatibility and availability of separately held seal/unseal
and TLS restoration prerequisites through protected custody, without printing them.
Offline archive validation alone is not a restore rehearsal or proof of decryptability.

Preserve original HCL, exact network/alias attachments, TLS files, retained volume
identities, audit configuration and running baseline before the window. Record
how audit copy consistency is established: preserve all audit bytes through a
known boundary, verify stable length/hash or copy after an explicitly approved
quiesce, and retain later appended audit records separately. Never truncate or
replace the active audit file. Do not disable auditing/TLS or publish ports.

An unavailable reader, unstable audit copy, invalid snapshot, missing protected
seal/TLS custody, insufficient storage, unknown inventory or unavailable restore
prerequisite **stops remediation**. The bootstrap exception, if chosen, must
explicitly distinguish its three pre-backup access-acquisition writes from the
later backup-gated hardening writes. If the owner retains a strict prohibition
on all pre-snapshot policy writes, this bootstrap option is unavailable.

Normal rollback is an exact, separately reviewed policy-only restoration using
protected saved prior bodies, with fresh bounded maintenance authority and no
material/token/role changes. Returning to prior bodies reintroduces the lifetime
finding; do not silently roll back to a known weakness. Prefer containment and
review over an automatic rollback. Existing roles and issued token leases should
survive a successful policy-only change; confirm this through scoped regressions.

Full Raft restoration is a distinct disruptive recovery action, **not authorized
by this proposal**. Preserve the original data first, stop application mutations,
restore to an isolated matching provider, validate seal/TLS/audit prerequisites,
identify all token/lease/policy differences and obtain a separately approved
cutover/restoration plan before touching retained storage. A pre-revocation recovery
snapshot could revive prior root/administrator state; it is not an acceptable
automatic rollback source. Even a fresh snapshot can revive temporary bootstrap
tokens or stale leases, so exact reconciliation/revocation and preserved post-backup
audit must be reviewed before resumed service. Never destroy the original volumes
or automatically generate root on failure.

## Scope of the next approval

Review the corrected array matching, observed overlap/expiry limitations, and
whether to authorize a **disposable rehearsal of a specific backup/bootstrap
manifest**, or instead provide an existing authorized snapshot/maintenance route.
Retained execution must await a later exact manifest, verified rehearsal and
explicit approval covering any bootstrap exception, backup gate, administrative
scope, cleanup and restoration risks. There is no root recovery, retained restart,
policy write, token change, SIP/PBX activation or deployment authorized here.
