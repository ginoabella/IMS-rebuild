# P3-U3a — Exact owner reference adapter checkpoint

2026-10-21 (Asia/Manila, +08:00). Independent local work under approved
[completion checkpoint 2](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-approved-completion-direction.md).
P3-U3a remains incomplete. No application runtime was activated or migrated.

The existing `TrunkOwnerReferences` SQL adapter now rejects ambiguous results,
wrong scope, malformed identifiers, invalid versions/ordinals, unsupported
purposes and unknown reservation states. It constructs an explicit safe result
and copies the purposes array so unexpected driver/view columns cannot leak
through this port. Empty results alone return `null`; database errors propagate.
Terminal references remain immutable facts, never proof of qualification,
freshness or current business authority.

The foundation harness now invokes the actual compiled adapter and
`SnapshotDatabase` against real disposable PostgreSQL as `myims_runtime`. This
closes the previously documented untested-class-invocation gap in the
[foundation evidence](p3-u3a-trunk-owner-foundation.md). It verifies the cancelled
exact reference, each independently mismatched node/installation/binding/generation,
denial of base-table reads, denial after snapshot completion and pool recovery
after the real SQL permission failure. Complementary driver/view test doubles
verify malformed/duplicate result rejection, exact projection, array-copy isolation
and database-error propagation; they do not establish live interruption behavior.

Isolation: one uniquely named database in the fresh network-none PostgreSQL
container, all data on tmpfs. A separate non-root, read-only Node runner shares
only that disposable container's network namespace with capabilities dropped and
`no-new-privileges`. It mounts selected compiled code/test source and two existing
dependency volumes read-only. It inherits no workspace service environment,
secrets, retained data mounts or application network. No host ports or new named
volumes are created. Both exact disposable containers were confirmed absent.
The harness requires the already-running Docker workspace and a fresh backend
build; it does not install dependencies or build automatically.

Verification passed:

- `./dev exec pnpm build:backend` (config, contracts, backend).
- `python3 scripts/check-trunk-owner-foundation.py`: all 15 migration sources,
  grants/provenance/audit/terminal/concurrency and role-hazard regressions plus
  actual adapter invocation. [Immutable passing run](p3-u3a-disposable-runs/e4730229-b687-4ca2-bd94-b4d852ac0cb8.json).
- Docker-workspace ESLint for the adapter and new `.mjs` fixture; Prettier;
  Python syntax compilation; diff whitespace review.

Three earlier failed fixture runs remain archived: `7d22e6a7-a11d-47e0-870d-7c1042a78f19`,
`fbfc04cb-57d4-4912-8a87-484512891460`, and
`24c65cf2-52f0-4e91-b79c-d4c505dabde5`. The workspace image's inherited startup
entrypoint attempted UID/ownership setup on intentionally read-only dependencies;
the runner now explicitly executes Node. Those attempts could not change the
dependency mounts. All exact fixture containers were removed after each attempt.

This checkpoint adds no usable reserve command, owner attestation, protected
worker/import composition, provider qualification, HTTP API, claim/adoption or
runtime transaction-timing amendment. Fresh real database interruption, provider
integration, Prisma deployment bookkeeping and the full application graph were
not run. Native provider HTTP 500/expiry failures and the unresolved browser
recovery finding remain unchanged. No retained PostgreSQL/OpenBao/Garage/PBX,
protected credentials, privileged identity or scheduled backup was accessed or
changed.
