# P3-U3a second limited custodian capability-verification session

2026-10-20 (Asia/Manila, +08:00). Source: owner's **Custodian Verification
Follow-up and Second Limited Session Approval**. **Completed within the exact
read-only scope; second authorization consumed.** No further login is authorized.
The [first session](p3-u3a-custodian-handoff-followup.md) remains historical.

Owner acceptance: **named custodian capability-verification checkpoint successfully
completed and closed**, October 20 (+08:00). `platform-owner-custodian` functions
with its intended restricted permissions on the exact verified paths. No expansion
or repeated capability check is authorized. Complete privilege inventory and backup
readiness remain unestablished. The
[consolidated administrative design](../planning/p3-u3a-sustainable-openbao-administration-design.md)
is prepared for separate review only. P3-U3a remains incomplete.

## Prerequisite disposable verification

Before any retained access in this follow-up, nine synthetic parser/verifier test
groups passed, including wrong custom/default display prefix, identity/privilege
mismatch, uncertain login, exact ten-path query, cleanup failure and no retry.
Scoped ESLint/Prettier passed. Final integrated preparation/lifecycle-candidate
verification passed **53 tests** after the retained session; no further provider
access was involved. A fresh native verified-TLS OpenBao 2.7.1 fixture
then exercised the exact corrected `verifyCustodian` workflow with a synthetic
password parsed from CRLF framing: one login, one self lookup, one exact capability
batch, one self revoke and one denial check. The harness asserted all five request
paths in order and the exact ten-path body. All identity checks and ten capability
comparisons passed, revocation/403 confirmed. No assertion was relaxed for native
responses. [Immutable disposable evidence](p3-u3a-disposable-runs/253a426f-5008-4430-aa1d-3d0fc0f76ffe.json).

The broader disposable suite still exited 1 for the existing near-expiry HTTP 500
and 43–650 ms scaled expiry overruns. Those failures did not occur in the bounded
verification workflow and remain acceptance failures. All 14 issuance positives,
434 negatives and existing helper/maintenance regressions completed. Cleanup:
58 other known fixture tokens revoked, 18 already expired, zero known remaining;
the verifier's own session was separately revoked/confirmed. Exact fixture
containers/network/TLS/audit directory removed, no named volumes created.

## Retained session and identity

Rechecked the exact documented handoff's owner, 0700/0600 directory/file modes,
regular/non-symlink/single-link file, and exclusion from every running container
mount. No alternative credential/custody discovery occurred. The original handoff
and account password stayed unchanged. A network-disabled helper verified parsing
and CA readability. Retained access used only the existing private network and
verified TLS, with no published provider port; authentication material never
entered argv, environment, application mounts or evidence. Docker logging disabled.

One `platform-owner-custodian` login through `platform-custodian/userpass` began at
**15:46:06.360 +08:00**; cleanup finished at **15:46:07.340 +08:00**, 0.98 seconds.
[Sanitized machine evidence](p3-u3a-retained-capability-session-2.json).

All expected identity/session assertions passed: exact custom auth login path,
username and display prefix; sole `platform-deployment-maintainer` token policy;
no identity policies or period; orphan service token and expected use count;
899-second remaining TTL, 900-second creation TTL and explicit maximum. The native
renewable flag was true; no renewal was requested or authorized. This flag does
not independently establish permission to renew; that path was outside the batch.

## Expected versus observed capabilities

Exactly one `sys/capabilities-self` request queried these ten paths. Every observed
capability set equaled its expected set; **zero differences**.

| Exact path                                        | Expected             | Observed             |
| ------------------------------------------------- | -------------------- | -------------------- |
| `sys/storage/raft/snapshot`                       | deny                 | deny                 |
| `sys/policies/acl/platform-deployment-maintainer` | deny                 | deny                 |
| `sys/policies/acl/endpoint-restricted-issuer`     | create, read, update | create, read, update |
| `sys/policies/acl/trunk-restricted-issuer`        | create, read, update | create, read, update |
| `sys/policies/acl`                                | list                 | list                 |
| `auth/token/roles`                                | list                 | list                 |
| `sys/auth`                                        | read                 | read                 |
| `identity/entity/id`                              | deny                 | deny                 |
| `identity/group/id`                               | deny                 | deny                 |
| `auth/token/accessors`                            | list, sudo           | list, sudo           |

No queried operation was executed. The only post-observation operation was the
owned session's cleanup: one acknowledged self-revocation, followed by one
`auth/token/lookup-self` returning **403**. **Revoked and denial confirmed.**
The ephemeral helper was removed; no token/accessor files were written. No retry,
replacement login, child token or renewal occurred.

## Limits and next gate

This establishes only the named session's capabilities at that time on the ten
paths. It does not establish complete/effective policy composition or inventory,
backup durability, snapshot/restore readiness, missing authority across all other
principals, or retained lifetime remediation/security acceptance. No snapshot,
policy body, inventory, audit/backup content or additional credential was fetched;
no retained privilege/configuration/storage change, restart, recovery, restoration
or SIP/PBX operation occurred.

Existing separate backup/maintenance authority remains **unknown, not absent**.
The verified custodian cannot capture the native snapshot or edit its own denied
maintainer policy. Any future inventory/backup/maintenance route needs independently
established named scope and approval before use. The owner-approved preferred
architectural direction remains a stable separately custodied snapshot identity
with separate audit preservation, plus separately controlled attended maintenance;
it is for further design review only, not implementation authorization. The
nine-write/pre-backup-ticket contingency remains unapproved.

Independent local work added an inactive controlled-replacement candidate with
25 passing synthetic lifecycle groups; [scope and limits](p3-u3a-controlled-replacement-candidate.md).
It is not activated and has no real replacement/custody/process acceptance. Native renewal/expiry
failures and unresolved browser recovery evidence are preserved. P3-U3a remains
incomplete; no additional retained work is authorized by this result.
