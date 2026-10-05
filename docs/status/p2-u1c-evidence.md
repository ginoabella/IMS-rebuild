# P2-U1c and parent P2-U1 acceptance evidence

Completed 2026-10-05 17:04 +08:00 (Asia/Manila). C-01–08 and parent AC-01–11 passed.
P2-U1a/b/c and parent P2-U1 are complete within the canonical identity foundation.

Requirements: [c](../../context/feature-specs/p2-u1c-secure-operator-bootstrap-and-foundation-handoff.md)
and [parent AC-01–11](../../context/feature-specs/p2-u1-canonical-identities-and-tenancy-admission.md).
Approval: [bootstrap review sections 1–2](../planning/p2-u1c-bootstrap-contract-review.md).
Implementation/input/hash decisions: [bootstrap contract](../architecture/canonical-operator-bootstrap.md).
Operational procedures: [runbook](../runbooks/operator-bootstrap.md).
Prior focused evidence: [a](p2-u1a-evidence.md) and [b](p2-u1b-evidence.md).

## Commands and environment

Existing Docker workspace, pinned Node 22.23.3/pnpm 10.12.1, real PostgreSQL/PostGIS,
actual trusted deployment and restricted runtime credentials. No new dependency,
service, listener, public route, default credential or production seed is introduced.

| Check                                                                | Result                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite `./dev exec pnpm check:identity-foundation --authority` | Passed, exit 0; a/b storage, admission/version, grant and failure regressions                                                                                         |
| Backend TypeScript check                                             | Passed after correcting relative imports and strict indexed-access checks                                                                                             |
| Bootstrap isolated process suite after backend build                 | Passed, exit 0; all four sanitized PASS groups in check-operator-bootstrap.mjs                                                                                        |
| Focused source/fixture lint                                          | Passed after documenting intentional omission of secret-bearing raw SQL causes                                                                                        |
| `./dev exec pnpm check:identity-foundation`                          | Passed, exit 0; all a/b/c real-database process checks                                                                                                                |
| `./dev check`                                                        | Passed, exit 0: workspace quality/builds, configuration/entry points, foundation/durability/storage, integrated a/b/c, five client scans and isolated provider checks |
| Actual `./dev bootstrap-operator --secret-file` launcher             | Passed: protected weak input rejects with fixed invalid-input and exit 1; zero operational identities preserved                                                       |
| Local deployment state, health and disposable fixture teardown       | Passed: six migrations; zero tenant/staff/operator/provenance seeds; live/ready HTTP 200; no identity/bootstrap fixture databases remain                              |
| Changed-document links and whitespace                                | Passed: changed-document links, formatting and git diff --check                                                                                                       |

Default identity selection runs a storage checks, b authority checks and c's
independent bootstrap fixture. --storage selects a, --authority selects a/b,
--bootstrap selects a/b/c. check:foundation now runs the complete default suite;
./dev check and existing Docker CI inherit it. Hosted CI itself is not run locally.

The a/b suite creates one uniquely named myims_identity_ database and deploys six
migrations fresh/rerun. c creates a separate uniquely named myims_bootstrap_
database, deploys those migrations twice with the real deployment command, and
checks empty canonical stores after migration/general deployment startup. Actual
runtime credentials exercise grants; fixtures use trusted administration only in
their disposable databases. No operator is provisioned in the local operational
database by these checks.

## C-01–08 verification mapping

| ID   | Exact checks / observed boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Approved sections 1–2 recorded in product contracts/review; a/b storage, role/creator and active/ready/active-tenant rules retained. Bootstrap contract records private hash/input mechanics and all later gates.                                                                                                                                                                                                                                                                                                                                                                                                      |
| C-02 | check-operator-bootstrap.mjs first creation/canonical-read phase invokes actual deployment command with deny-listen guard. Assert active/ready, versions 1/1, singleton provenance, tenantless eligible authority and private verifier. Check salted hashes differ and exact password bytes verify; wrong/case/space/Unicode-normalization changes do not. Assert system actor/reason, separate operator UUID target/correlation and exact metadata allowlist.                                                                                                                                                         |
| C-03 | Matching normalized rerun with a different valid password preserves the full canonical account row/hash/timestamps/versions and audit count. Weak rerun input rejects. Different identity, unrelated preexisting username, disabled/unset account and conflicting provenance command each fail safely. Original credential still verifies.                                                                                                                                                                                                                                                                             |
| C-04 | Hold PostgreSQL advisory lock, launch two independent actual command processes and observe both waiting, then release. Matching race returns created/already-created; different-identity race returns created/conflict. Each persists one operator/provenance and one creation audit; winner survives rerun unchanged.                                                                                                                                                                                                                                                                                                 |
| C-05 | Forced audit CHECK rejection leaves no account/provenance/event. Hold audit-table lock after uncommitted identity writes; another connection sees no partial records, then kill the OS process or terminate its database connection. Both rerun safely after rollback. Test-only PostgreSQL frame proxy suppresses a real CommandComplete(COMMIT), closes transport and proves uncertain/nonzero plus durable account/event; rerun keeps original hash and audit count.                                                                                                                                                |
| C-06 | Actual migration/rerun/general deployment startup retain zero identities. Runtime credential command attempt fails and real runtime SQL cannot insert operators or insert/update/delete/truncate provenance. Every bootstrap process uses deny-listen; production command graph starts no HTTP/worker/PBX process or public endpoint. Production identity fixture creation is absent.                                                                                                                                                                                                                                  |
| C-07 | Check missing-schema preflight and policy/code-point/byte bounds, invalid UTF-8/NUL/line breaks, exact spaces/Unicode, unpaired JSON surrogates, unexpected fields, file size/mode/symlink and non-TTY rejection. Reject concurrent hash work and unsupported/cost-inflated hash encodings. PTY tests require hidden confirmation and verify no input echo. Password/hash/identity sentinels are absent from captured output and audit data. Exact caller-owned input stays unchanged; fixture teardown removes its own private directory/database. Built-client scans include c's private imports/encoding/sentinels. |
| C-08 | Combined a/b/c and full Docker results passed, exit 0. Runbook explains first creation, protected modes, reruns/conflicts, interruption/uncertainty, safe diagnostics and precise fixture teardown. Parent matrix below centralizes every criterion.                                                                                                                                                                                                                                                                                                                                                                   |

## Parent AC-01–11 coverage

| Parent | Exact owning checks and evidence                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01  | a A-01, b B-01, c C-01: approved normalization/states/roles/admission/bootstrap policy, scoped P1-U1 handoffs and deferred decisions reconciled in product contracts and three architecture handoffs.                                                                               |
| AC-02  | check-identity-foundation.mjs storage phase / A-02: all tenant statuses, canonical code/global collisions, immutable codes, retired-code collision, restrictive ownership and empty migration seeds.                                                                                |
| AC-03  | Storage A-03: same staff username under two tenants, same-tenant collision, tenant-qualified repositories, non-null/restrictive FK, foreign/missing tenant IDs and independent namespace collision barriers.                                                                        |
| AC-04  | A-04/A-06 and check-identity-authority.mjs B-02/B-06: distinct tenantless operator/staff stores, explicit planes/identical UUID fixtures, foreign-qualified/wrong-plane denial, unsupported roles. c C-06 proves actual command/runtime separation and no public bootstrap surface. |
| AC-05  | Storage A-05 canonical ASCII/Unicode/whitespace/boundary SQL checks and c C-02/C-07 exact password-byte/Unicode preservation and protected-input bounds.                                                                                                                            |
| AC-06  | Authority B-02/B-03: canonical candidate/by-ID plane-specific snapshots, all 16 staff/four operator eligibility combinations, coherent primary reads, malformed roles/versions/timestamps, unreachable/interrupted/timed-out PostgreSQL denial without fallback.                    |
| AC-07  | Authority B-04/B-05: row/authentication/tenant-authority version rules, stale/no-op/invalid/foreign mutations, audit rollback, integer exhaustion, independent coherent snapshot/concurrent restoration and suspend/reactivate behavior.                                            |
| AC-08  | c C-02/C-03/C-04 actual creation/hash/audit, unchanged reruns, conflicting identity/provenance/ineligible account and independent matching/different-identity command races.                                                                                                        |
| AC-09  | c C-05/C-06 forced audit rollback, precommit process/database interruption and real committed-response-loss recovery, migration/startup zero seeds and disposable-only fixtures.                                                                                                    |
| AC-10  | Storage A-06, authority B-06 and c C-07: actual runtime grants/ownership/append-only audit/restrictive history and sentinel exclusion in private/general DTOs, errors, audit metadata, command output and all five client bundles.                                                  |
| AC-11  | Passing combined identity command and full ./dev check, exact protected-input operational launcher/runbook, version/credential handoffs, centralized matrices and observed limitations.                                                                                             |

## Review corrections and limits

Strict TypeScript initially caught relative import and indexed-access errors; they
were corrected before runtime verification. The first interruption fixture polled
pg_stat_activity inside its held transaction and reused cached statistics. Added
pg_stat_clear_snapshot before each barrier observation; both precommit interruption
checks now pass. No production lock/transaction guarantee was weakened.

The bootstrap command reports only fixed outcomes/correlation UUIDs and suppresses
raw SQL exception causes and transaction rollback diagnostics, which can contain
secret input or falsely imply rollback after transport loss. Ambiguous commit is
proved against a real PostgreSQL committed event, not by a mock callback.

This proves canonical identity/provisioning within P2-U1. It does not prove sign-in,
Redis sessions/guards, cross-replica revocation, native mobile login, real
organization/PBX provisioning, hosted CI execution, production HA/readiness or the
Phase 2 authentication gate. P1-U1 remains deferred outside its approved scoped
handoffs. Delivery/reset/recovery/last-admin and broader lifecycle decisions stay
pending. Operational creation requires operator-supplied protected input; no
production password is generated or fixture account adopted by these checks.
