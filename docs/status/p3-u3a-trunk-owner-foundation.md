# P3-U3a — Canonical trunk owner database foundation

Checkpoint: 2026-10-20 (Asia/Manila, +08:00). Local foundation within approved
checkpoint 2 and lifecycle L-01; neither L-01 in full, A-04 nor P3-U3a is complete.
No retained provider/custody access or shared database migration occurred.

Added deployment migration
`20261020000000_trunk_credential_owner_foundation`, an exact-reference read port
and its SQL adapter. They are not wired to an application, command or worker.

The migration creates a separate restricted NOLOGIN owner capability role with no
memberships. Deployment stops for unexpected role flags or **any** membership
edge into or from that role. NOLOGIN/NOINHERIT alone does not prevent `SET ROLE`:
real tests demonstrate runtime assumption after an intentionally added membership,
then verify the migration refuses it. Tests also cover reverse and other-member
edges and an unexpected login flag. These mutations occur only in the disposable
cluster; no shared roles were created or changed.

Deployment-only peer scopes declare node/installation/peer/purposes. They are an
owner foundation awaiting canonical definitions/capability integration, not a new
public peer API or independent runtime source-selection mechanism. New binding,
generation and reservation records have restrictive composite keys; provider
material version is fixed at 1. A binding lock serializes monotonically increasing
generation ordinals. A partial unique index permits one active preparation per
binding. Immutable provenance, terminal reservation states and history cannot be
rewritten/deleted/truncated through normal SQL, including deployment SQL with the
protection triggers enabled.

`myims_runtime` receives only an explicit non-secret reference view. It cannot
read the owner base tables, insert intent/attestation records, alter provenance,
change eligibility or perform cleanup. The owner capability can insert bounded
reservation facts/history and append audit; it cannot install peer declarations,
write endpoint operations, override database-recorded timestamps/transaction
markers or change immutable facts. No principal login, membership, provider token,
verification/claim/adoption function or cleanup permission is provisioned.

Every reservation insertion/state transition requires matching immutable history
and application audit **in the same transaction**. Audit must match exact
operation, binding, generation, platform actor, correlation and event/state; it
must have platform identity plane and no tenant/system attribution. Protected
trigger-generated audit transaction markers and database-default history markers
support savepoints. Old matching audit UUIDs cannot satisfy a later transition;
ordinary runtime/owner writes cannot forge transaction markers. Missing or
tenant-scoped audit rejects and rolls back affected owner/history/audit/marker
records together. The migration does not change historical audit table columns
or historical migration files.

Captured operator authentication/node/peer/owner versions are immutable
**provenance**, not independently validated admission. Current operator authority,
node/capability versions and the full canonical lock order still need the owning
reservation/finalization transactions. There is no usable reserve command or
successful qualification in this foundation. The read port returns immutable
facts for exact node/installation/binding/generation and never selects "latest";
it does not establish freshness, availability or eligibility.

Verification:

- `python3 scripts/check-trunk-owner-foundation.py`: real PostgreSQL/PostGIS 17
  acceptance in one fresh network-none, read-only-root, tmpfs-data container.
  Applies all 15 repository SQL migration sources, checks role/grant boundaries,
  exact scope/purpose and ordinal constraints, retained provenance, successful
  atomic reservation through a savepoint, old audit UUID rejection, tenant-scoped
  audit rejection, missing-initial-audit rollback and conflicting preparation
  rollback, then tests existing-role membership/flag hazards. Source migration
  application is real SQL; this fixture does not run Prisma migration bookkeeping.
  [Latest sanitized evidence](p3-u3a-trunk-owner-foundation-evidence.json).
  Final [immutable passing run](p3-u3a-disposable-runs/a2bf30e6-7238-433f-bd77-88e70f1fe8e6.json).
- `./dev exec pnpm build:backend`: exit 0; config/contracts/backend compiled.
- Scoped Docker-workspace ESLint and Prettier for both owner TypeScript files:
  passed. `git diff --check`: passed.
- Exact disposable container removal verified; zero named volumes, host ports or
  retained mounts. No shared database, shared role, OpenBao or PBX was contacted.

Earlier fixture attempts remain archived, including a wrong native foreign-key
truncate-denial expectation and a temporary initialization server disconnect
during a historical migration. The harness now waits for the final server's TCP-loopback readiness.
Historical migrations were unchanged. Earlier passing pre-savepoint and final
protected-marker runs are also retained in `p3-u3a-disposable-runs`.

Remaining: authority-checked intent/receipt APIs and protected reserve command,
verification/attestation owner and independently scoped installation principals,
worker/process/custody isolation and queue exclusion, real protected provider
import/read integration, retry/results/tombstone lifecycle, retirement, exact
same-transaction claim/adoption and cleanup races, 60-second timing acceptance,
HTTP A/B acceptance and full affected regressions. The SQL read adapter compiled;
its actual class invocation against PostgreSQL is not independently exercised by
the psql-only fixture. Full Prisma deployment/default graph and endpoint/queue/API
regressions were not rerun here. Native provider HTTP 500/expiry failures and the
unresolved browser recovery finding remain unchanged. Backup/maintenance work
remains design-only and no experimental runtime control was activated.
