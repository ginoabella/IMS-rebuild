# P3-U3a next authority and backup installation review

October 22, 2026. **Operating model approved by the owner; concrete retained execution remains gated below.** This document
supersedes older pending-capture descriptions only for current sequencing. It
does not modify their historical approval boundaries. The capture/upload request
is complete and consumed; it cannot authorize installation or another recovery.

Read the [authority findings](../status/p3-u3a-captured-authority-review.md) and
[operations runbook](../runbooks/p3-u3a-development-backup.md) first.

## Current continuation result

Owner reapproved this plan and continuation on October 22. The [current read-only
installer review](../status/p3-u3a-current-installer-route.md) verified that the
named custodian is denied all backup/rotation installation paths; its sole fresh
session was revoked/403. The [nine-write guarded-bootstrap preparation](p3-u3a-guarded-bootstrap-preparation.json)
now records exact candidate changes, backup-before-write ordering and remaining
controller prerequisites. It is not executable. The [guarded controller core and native rehearsal](../status/p3-u3a-bootstrap-controller.md)
now pass backup-first success and lost-response checks. Complete retained host
adapters and operation packaging before requesting separate root-bootstrap execution
approval; do not reuse the consumed capture controller or initialize the repository.

The [host wiring/post-install rehearsal](../status/p3-u3a-bootstrap-host-wiring.md) is
now complete within its disposable boundary. The [concrete one-time guarded
bootstrap execution request](p3-u3a-bootstrap-execution-request.md) is ready for its
separate root/staging/installation approval. Reapproval of this operating-model
plan alone does not execute that request.

## Minimal installation candidate

### Recommended simpler operating model

Owner requested minimal routine operations and approved this document on October
22. The operating model below is adopted. Exact identity/policy installation and
activation still depend on the concrete evidence specified in this document.

The [exact narrowed rotation and remediation candidate](p3-u3a-backup-maintenance-review.json)
and [native verification/status](../status/p3-u3a-backup-maintenance-review.md)
now replace the older broad maintenance candidate for further implementation.
`gino` is the designated attended operator; a current independent OpenBao
installer authorization route remains unverified.

- Name `gino` as the proposed attended installer/operator. A human name alone
  grants no OpenBao access. Prefer a verified existing authorized route; if none
  can be established, prepare one separately approved guarded bootstrap, with
  fresh backup-first evidence, exact changes and privileged-token revocation.
  Do not keep a root credential or make recovery a routine backup dependency.
- During that bounded installation, reconcile and apply exact reviewed issuance
  constraints to the three affected policies and verify full role configuration,
  positive requests, forbidden parameters and actual token lifetimes. Existing
  HTTP 500/expiry findings remain open until native tests demonstrate resolution.
- Preserve the existing custodian account. Add one separately protected attended
  backup-maintenance account for the same owner, with only reviewed metadata and
  exact backup-role credential-rotation permissions for ongoing use. Exclude
  standing ACL/auth installation edits, generic issuance, KV reads and restore.
  This deliberately narrows the older broad maintenance-policy candidate; prepare
  a new exact policy before requesting implementation, rather than reuse it.
- Use one snapshot-only workload identity and one host timer controlling the
  isolated capture/encrypt/upload stages. Routine jobs never receive either
  human password or maintenance privileges. Configure failure/expiry/capacity
  alerts to the owner's confirmed destination before activation.
- Expose three operator commands: status, run-now and attended credential-rotate.
  These are proposed interfaces, not installed commands. Keep the current
  candidate 30-day SecretID and remind at day 23; validate the use budget against
  the chosen cadence. Automate bounded staging/verification for rotation, but
  require the operator to unlock the maintenance credential. Defer unattended
  rotation authority. Keep restore and administrative pruning separate.

The expected routine is checking status/alerts, one attended monthly rotation and
scheduled recovery exercises. The owner may hold both human roles while their
credentials remain separate. One-time installer powers must not remain attached
to the rotation account. Scheduling follows successful credential/access tests,
fresh backup retrieval/decryption and isolated joint-store recovery acceptance;
all cadence/retention/RPO/RTO numbers remain proposals until approved and measured.

Exact candidate bodies remain in `backupProvisioning` of the
[review-only manifest](p3-u3a-backup-installation-review-manifest.json).
That manifest is not an executor input; its older unresolved facts must be
reconciled against the completed capture and actual custody evidence.

| Order | Candidate POST | Review boundary |
| --- | --- | --- |
| 1 | `sys/policies/acl/platform-raft-snapshot-reader` | Snapshot read plus self lookup/revoke/capabilities only. Policy SHA256 `ab94f14956e6a7a9a1574c4d524f31154378eec7a4fbad76c4912640e18fd2ff`. |
| 2 | `sys/auth/platform-backup` | Dedicated AppRole mount; default and maximum lease 300 seconds. |
| 3 | `auth/platform-backup/role/platform-raft-snapshot-reader` | No default policy; 300-second service-token explicit maximum, nonperiodic; bound SecretID, 30-day lifetime and 1,000 uses. These remain candidate settings. |
| 4 | Same role `/secret-id` | SecretID/accessor written only to approved protected custody; never reports, argv, environment or application mounts. |

The broader maintenance policy/user in the older manifest is excluded from this
minimal candidate. The three existing privileged-policy changes require their
own explicit review and authorization. Preserving the human custodian does not
mean proving that its policy-writing authority cannot escalate privileges.

## Required concrete evidence before requesting execution

| Work item | Required result / accountable owner |
| --- | --- |
| AUTH-01: privileged policy reconciliation | Reviewer compares exact captured and proposed policy hashes, all issuance parameters and existing lifetime findings; owner approves exact intended changes. No normalization or overwrite of unexplained differences. |
| AUTH-02: installer | Owner names principal, mechanism, independent custody and authorization reference. Verify current complete roles/mappings and allowed/denied capabilities through separately authorized read-only verification; no runtime-token reuse or policy-prefix workaround. |
| AUTH-03: backup-first freshness | Operator identifies protected pre-change snapshot, separate audit continuity, independent keys/seal and verified destination. October 22 upload proves retrieval, not indefinite freshness or restore readiness. New capture needs its own authorized route. |
| OPS-01: credential lifecycle | Owner names rotation operator and grants only reviewed rotation paths. Establish protected RoleID/SecretID storage, atomic replacement, verification and old-accessor retirement procedure. Four installation writes alone do not create rotation authority. |
| OPS-02: job acceptance | Name job/audit/alert owners, destination/network/TLS/capacity, exact hashed artifacts and activation scope. Verify positive snapshot access, denied secret/admin access, self-revocation/403 and bounded failure behavior in the approved native environment. |
| REC-01: recovery acceptance | Recovery owner independently decrypts fresh retrieved archive, restores isolated OpenBao and matching PostgreSQL point, reconciles generations and measures RPO/RTO. No restore against retained service. |

Development host administration is currently performed by owner `gino` through
the trusted Docker/host boundary. This does not establish an OpenBao installer,
rotation operator or unattended job owner. The approved model designates `gino` as attended operator and rotation owner;
current OpenBao credentials/authority and job/audit/alert ownership still require
verification before installation or activation.

Before any approved write, record exact pre-state, operation ID, source hashes,
time window, outputs and postconditions. On ambiguous response or partial success,
stop, preserve evidence and reconcile read-only; never retry provisioning or root
generation automatically. Do not delete pre-existing objects or broaden ACLs to
complete the operation. Partial-state remediation must be included explicitly in
that operation's authorization.

Activation, timers, audit collectors, retention/pruning, production placement and
custodian expansion are outside this proposal. The next executable request must
replace remaining unknowns with concrete evidence and exact scope, rather than
reuse a historical approval flag.
