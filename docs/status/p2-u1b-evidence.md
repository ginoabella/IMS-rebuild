# P2-U1b verification evidence

Completed 2026-10-05 15:32 +08:00 (Asia/Manila). B-01–07 passed.
Requirement: [P2-U1b](../../context/feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md).
Contract: [canonical authority/admission](../architecture/canonical-authority-admission.md).
Approval: [review sections 1–4](../planning/p2-u1b-contract-review.md), with the
user's revised canonical-creator closure grant. Unrelated P1-U1 decisions remain
deferred. a/b are complete; c and parent P2-U1 remain incomplete.

## Commands and environment

Existing Docker workspace and real PostgreSQL/PostGIS, using actual restricted
runtime credentials and the existing trusted deployment path. No new dependency,
provider, runtime or public fixture route was introduced.

- `./dev exec pnpm --filter @myims/backend typecheck` — passed.
- `./dev exec pnpm exec eslint scripts/check-identity-authority.mjs services/backend/src/modules/identity services/backend/src/modules/platform services/backend/src/modules/tenancy services/backend/src/infrastructure/database/read-snapshot.ts` — passed on final implementation.
- `./dev exec pnpm check:identity-foundation --authority` — passed on the finished
  source, exit 0, including a regressions and malformed-timestamp checks.
- `./dev check` — final rerun passed, exit 0: workspace lint/format/types, all
  web/mobile/backend builds, entry-point/configuration checks, foundation
  outage/recovery, audit/outbox, worker recovery, Garage storage/access/expiry,
  integrated a/b identity checks, all five client scans and fresh isolated
  provider provisioning/restart checks.
- `./dev exec pnpm db:migrate` — passed on local development after verifying its
  staff store empty. Read-only follow-up confirmed six completed migrations,
  zero canonical tenant/staff/operator seeds and runtime role-column UPDATE grant.
- `./dev health` — live and ready HTTP 200; database and both Redis services up.
- Trusted read-only teardown verification — no `myims_identity_*` databases remain.
- Changed-document relative-file links and `git diff --check` — passed.

The `--authority` selection includes a's storage regressions, then b's checks in
the same uniquely named disposable `myims_identity_*` database. Default selection
also runs both; `--storage` remains a-only. Existing `check:foundation`/Docker CI
now selects authority. Fixtures deploy all six migrations twice, use the actual
runtime role for reads/writes/grants, and close clients/drop only their database.
Trusted fixture administration injects malformed rows and audit failures locally.

## Acceptance coverage

| ID   | Verification                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Explicit user-approved fixed role names, one-to-four distinct combinations, permission bundles and active/ready/active-tenant admission. Creator closure needs no additional dispatcher role; D-02/D-03 safeguards remain with owners. Role migration has no defaults/backfill and preserves a's constraints.                                                                                                                                                       |
| B-02 | Same username in two tenants and operator store; identical UUIDs in staff/operator stores. Candidate normalization and by-ID qualification select only their plane/tenant. Foreign IDs, wrong plane, extra client tenant/role/authority fields and missing records deny. General snapshots omit hash/username/tenant association for operators; separate private verifier ports contain hashes.                                                                     |
| B-03 | All 16 tenant/account/credential combinations and four operator combinations. Only active/active/ready/valid staff is eligible; operators remain independent of tenant lifecycle. Unknown stored role mixtures and infinite credential timestamps deny. Pure rules cover invalid versions and malformed authority. Actual connection termination, unreachable connection and bounded statement timeout yield unavailable; fresh reads recover.                      |
| B-04 | Staff role/status/credential and operator status/credential commands advance row/authentication versions with one audit. Ready-hash replacement also advances authority. Tenant status changes advance row/tenant authority. Expected-version stale, invalid, foreign and no-op commands preserve facts/versions/audit. Forced audit failures roll back each staff mutation category plus operator and tenant writes. Integer exhaustion rolls back.                |
| B-05 | Independent repeatable-read reader pauses after loading the tenant while separate writers commit role/version and tenant-status/version changes; the reader returns the complete old snapshot. Independent readers during an uncommitted role write see old committed authority. PostgreSQL lock observation proves a competing privilege restoration waits, then returns stale. Suspend/reactivate advances tenant authority twice and old snapshots remain stale. |
| B-06 | a regressions retain qualified targets, restrictive ownership, actual runtime grants, deployment-only operator creation/provenance and append-only audit. b checks exact audit metadata keys and monotonic old/new versions; role-set metadata uses fixed enum codes. Synthetic identity/hash sentinels are absent from snapshots, diagnostics and audit; built client scans include b sentinels and private adapter import exclusions.                             |
| B-07 | Combined focused suite, a regressions and full Docker checks required. The architecture contract records admission matrix, primary repeatable-read/timeouts, mutation/version/audit semantics, migration behavior and c/P2-U2 handoff. All required checks passed; commands and limits are recorded here.                                                                                                                                                           |

## Final review corrections

The new sixth migration required updating both foundation and audit regression
count assertions. The initial full run identified the missed audit assertion;
it was corrected before the full rerun, which passed with exit 0.

Role validation now rejects sparse arrays instead of allowing missing entries to
survive an array iteration. Creator closure requires the canonical creator flag
to be exactly true. PostgreSQL supports infinite timestamps; canonical authority
and verifier reads explicitly reject those malformed ready credentials. The
trusted malformed-role fixture restores the exact original migration constraint.

A focused check overlapped final source edits and used the previously compiled
backend, so its new infinite-timestamp assertion failed. Source inspection
confirmed the finished predicates, and a fresh build/recheck passed, exit 0. The
failure did not leave a fixture database or authorize malformed credentials in
the final source. The corrected final focused result is recorded above.

## Handoff and limitations

c receives approved tenantless operator eligibility, private credential material,
plane-specific snapshots, bounded coherent read transactions, atomic mutation/
audit contracts and the combined a/b fixtures/checks. P2-U2 must freshly validate
canonical status and versions, including tenant authority, instead of trusting
cached session roles. Integer maximum is readable; a further increment safely
fails and does not reset/wrap.

The migration intentionally fails on a populated staff table rather than assigning
implicit roles; such a deployment requires an explicit reviewed per-account role
migration. The local a foundation was verified with zero production identities.
No new identities are seeded by b.

No password verification/usable hashing, sign-in, Redis sessions or revocation,
CSRF/guards, sockets, PBX effects, lifecycle/role-management UI, bootstrap command
or two-replica authentication is proved. Persistence actor/target validation does
not authenticate actors; later owning use cases must authenticate/authorize before
using the trusted transaction. Hosted CI was not run locally. P1-U1, c and parent
P2-U1 remain incomplete.
