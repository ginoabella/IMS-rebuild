# P3-U3a next authority and backup installation review

October 22, 2026. **Disabled proposal; no execution authorized.** This document
supersedes older pending-capture descriptions only for current sequencing. It
does not modify their historical approval boundaries. The capture/upload request
is complete and consumed; it cannot authorize installation or another recovery.

Read the [authority findings](../status/p3-u3a-captured-authority-review.md) and
[operations runbook](../runbooks/p3-u3a-development-backup.md) first.

## Minimal installation candidate

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
rotation operator or unattended job owner. Those roles remain unassigned pending
explicit owner designation.

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
