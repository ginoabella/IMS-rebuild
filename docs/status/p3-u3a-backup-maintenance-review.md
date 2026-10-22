# P3-U3a approved operating model: exact rotation candidate

October 22, 2026 (Asia/Manila, +08:00). The owner approved the
[next-step document](../planning/p3-u3a-backup-authority-next-step.md).
The simpler operating model is adopted: `gino` is the attended operator, the
existing custodian stays in place, and routine rotation uses separate credentials.
This checkpoint implements the document's requirement to prepare a new exact
rotation policy before retained installation. **P3-U3a remains incomplete.**

## Reviewable result

The [exact review artifact](../planning/p3-u3a-backup-maintenance-review.json)
contains three privileged-policy replacement bodies, their historical captured
hashes and proposed hashes, fourteen role configurations/issuance requests, and
the new `platform-backup-rotation` policy and human-user configuration.
The offline generator refuses changed capture bindings or a generator baseline
that disagrees with the historical comparison. Historical hashes are prerequisites
for reconciliation; they do not establish current live pre-state.

The separate `platform-backup-maintainer` account uses the existing
`platform-custodian` userpass mount with a separately protected password and a
900-second explicit session maximum, no default policy and no periodic token.
Its policy permits exactly seven paths: snapshot-role RoleID read, SecretID
issuance, accessor lookup/destroy, self lookup/revoke and self capabilities.
SecretID issuance requires `ttl: "720h"` and `num_uses: "1000"`; extra parameters
reject. The string representation of the use count is deliberate and native
readback confirms 1,000 uses. Accessor operations require only the accessor field;
values remain private and are validated by the role-specific native endpoint.

This policy replaces the older manifest's broad maintenance candidate for future
implementation. It has no ACL installation/editing, auth/role editing, generic
issuance, material read, snapshot/restore or password-management grant. The existing
custodian still has its previously documented indirect escalation possibilities;
this checkpoint does not change or establish isolation of that account.

## Native verification and limits

Run `python3 scripts/backup-evaluation/check-backup-maintenance.py` from the trusted
Docker host. It creates a unique internal network and pinned OpenBao 2.7.1 dev
fixture with synthetic credentials, no published ports or retained bind mounts.
Synthetic root/passwords exist only for the disposable fixture; failures suppress
private response data. Cleanup removes its exact container, anonymous volumes and
network. It makes no requests to retained OpenBao or backup storage.

[Sanitized native evidence](p3-u3a-backup-maintenance-evidence.json): **12/12 groups
passed**, including exact SecretID lifetime/use-budget readback, denied omissions,
TTL/use overrides and extra parameters, denied installer/role/material/snapshot
operations, exact accessor request shape, snapshot-only workload policy/300-second
lease bound, replacement login before old-accessor retirement, old login denial,
self-revoke/403 for both human and workload, and fixture isolation/cleanup. Three additional groups verify all fourteen exact
role issuance requests through the three replacement policies, bounded initial
leases and rejected lifetime/policy/extra-parameter changes. Child issuance tokens
are revoked by the fixture administrator; scoped issuers self-revoke/403. Material
access for those child policies is outside this fixture.

Initial disposable runs exposed two candidate representation errors: JSON numeric
use counts failed ACL matching, and `"*"` did not accept an arbitrary accessor
value. The corrected candidate uses the tested string count and an empty value
list for the named accessor parameter. OpenBao documents that an empty value list
permits any value for that named parameter while unlisted parameters reject:
[policy parameter constraints](https://openbao.org/docs/concepts/policies/).
A subsequent disposable run passed the rotation groups. No retained settings changed.

This HTTP dev fixture verifies native ACL/AppRole/userpass behavior. It does not
prove TLS/Raft snapshot capture, sustained expiry, complete role aliases, retained
issuance/lifetime fixes, atomic file custody/replacement, repository retrieval,
fresh independent decryption, or joint PostgreSQL/OpenBao recovery. The candidate's
replacement sequence is an operator contract, not an installed rotation command.
SecretID destruction prevents new logins; it does not promise revocation of
already issued tokens. Those tokens require self-revocation or bounded expiry.

## Remaining installation boundary

Operating-model approval does not fill unknown credentials or override its
backup-first requirement. No verified current installer session or independent
OpenBao authorization route is available in this checkpoint. Existing host/Docker
access alone does not establish that route. Do not use the custodian's policy
prefixes to manufacture installer access, read application tokens as a substitute,
or reuse the consumed root recovery approval.

Next establish current complete mappings/identity contributions, all native role
fields and effective allow/deny capabilities through an independently authorized
attended route. Compare live pre-state to these exact remediation hashes and stop
on unexplained differences. Then bind a fresh pre-change backup/audit checkpoint,
operation ID, window, exact artifacts, protected password/RoleID/SecretID output
custody and partial-state handling. If no direct route exists, the approved model
calls for preparing one guarded bootstrap with fresh evidence and revocation;
that bootstrap has not been executed or implicitly authorized by this artifact.
Scheduling still requires joint recovery acceptance, confirmed alerts and capacity.

Local checks also cover artifact regeneration, historical-binding rejection and
rotation/installer separation. The original captured-authority evidence and older
installation manifest remain historical; this candidate does not mutate them.

Validation: **16/16** focused offline/current-generator and existing custodian/
trunk-preparation tests passed. Scoped ESLint, changed-file Prettier, artifact
regeneration, evidence/source SHA256, local link targets and diff whitespace were
checked. Full application suites were not rerun for this isolated deployment
review/fixture change; the existing full-graph formatting limitation remains.
