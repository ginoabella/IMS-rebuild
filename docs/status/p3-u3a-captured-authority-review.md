# P3-U3a development captured-authority review

Reviewed October 22, 2026. Owner requested the recommended read-only authority
review and documentation for development, operation and maintenance. This review
used the historical inventory offline; it performed no login, provider request,
credential read, policy change or recovery. **Installation remains blocked;
P3-U3a remains incomplete.**

Start with the [operations runbook](../runbooks/p3-u3a-development-backup.md).
The [machine-readable comparison](p3-u3a-captured-authority-review.json) records
exact policy hashes, compared role fields and explicit limits.

## Evidence and findings

Source: capture operation `24096f3d-bf41-4ec2-9e12-95e2057c115d`, inventory
captured at `2026-10-22T00:44:01.416Z` (08:44 Manila), SHA256
`6336a674908adeb6dc6c098e81a79e31f1c7ea03b87d7b4f4f484082bf411ede`.
The pinned helper had no network, a read-only root filesystem, no capabilities,
UID/GID 1003 and only the inventory/public review source mounted read-only.
No seal, password, token, snapshot or live provider volume was mounted.

| Finding                                         | Evidence and consequence                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedicated backup identity absent from capture   | No `platform-backup/` auth mount or `platform-raft-snapshot-reader` policy. This is historical evidence, not a current live absence check.                                                                                                                                                                                                                                                                                   |
| Scoped material policies match                  | All ten generated endpoint/trunk worker, importer, verifier and cleanup policies for the two retained installations match exact bytes. This does not approve other historical policies.                                                                                                                                                                                                                                      |
| Three privileged policies differ                | `endpoint-restricted-issuer`, `trunk-restricted-issuer` and `platform-deployment-maintainer` differ from current generators. Their captured token-create grants have no required/allowed request-parameter constraints: six endpoint, six trunk and two custodian grants are unconditional `update` statements. Corresponding proposed generators constrain each request. This is substantive, rather than whitespace alone. |
| Fourteen token roles match the fields compared  | Policy allow/deny lists, globs, orphan, renewable, explicit maximum, period and type match generator configuration. Additional native response fields/aliases remain outside this comparison; this is not complete role verification or lifetime acceptance.                                                                                                                                                                 |
| Inventory is incomplete for effective authority | Capture contains 59 policy bodies, 14 roles, one token and zero leases. The sole captured token was the operation root, subsequently revoked/403 in the completed operation evidence. Userpass users, user-policy mappings and identity entities/groups were not captured. No current principal's effective capabilities have been established here.                                                                         |
| Direct installer route remains unestablished    | The intended custodian policy has no dedicated backup policy/auth installation grant. Its endpoint/trunk policy-writing powers create indirect escalation possibilities; do not claim provider-enforced isolation or use those powers as a workaround. Root recovery is consumed, and no replacement installer is approved.                                                                                                  |

The policy finding is consistent with the earlier retained lifetime issue. It
does not establish the cause of HTTP 500, current policy state, exploitability,
or resolution of expiry/browser findings. Names-only metadata reviews and the old
pre-succession fail-closed inventory checker remain historical evidence; neither
is a substitute for this comparison or current effective-authority verification.

## Recommendation and work sequence

1. Preserve the completed native backup and custody records. Re-running capture,
   initialization, transfer or upload is outside this review.
2. Review exact remediation bodies for the three privileged policies against
   the captured pre-state and earlier lifetime contract. Identify and explicitly
   authorize an installer independently of application/runtime identities.
3. Establish current mappings, identity contributions, complete role fields and
   effective capabilities through a separately bounded read-only request before
   any write. Stop on additional authority; do not expand scope automatically.
4. Finalize the [disabled minimal installation proposal](../planning/p3-u3a-backup-authority-next-step.md),
   including credential rotation authority, protected outputs, backup freshness,
   partial-state handling and exact approved artifacts. No automatic recovery or
   broad maintenance account is included.
5. Obtain separate execution approval for concrete reviewed changes, run the
   approved native acceptance, and only then consider scheduling. Independently
   demonstrate fresh decryption and isolated joint-store recovery before claiming
   recovery readiness.

## Verification

The offline reviewer binds both SHA256 and operation ID before comparison. Its
focused tests cover changed bytes, wrong operation, malformed/incomplete input,
missing configuration, unconditional issuance detection and private-token output
exclusion. The retained run reproduced ten exact policy matches, three differences
and fourteen role-field matches. Raw policy bodies and token accessors are absent
from the committed report. Code/generator hashes accompany that report so later
generator changes cannot silently redefine this historical comparison.

This work does not change application behavior or claim new provider, restore,
production, HTTP or browser acceptance.

Validation passed: two focused test groups, scoped ESLint, changed reviewer/report/
runbook formatting, local documentation link targets, all four review-source
hashes, candidate snapshot-policy hash, disabled installation flags, consumed
capture authorization and diff whitespace. Application suites were not rerun for
this offline tool/documentation change; earlier full-graph formatting limitations
remain recorded in the tracker.
