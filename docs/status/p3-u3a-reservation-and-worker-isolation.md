# P3-U3a — Reservation persistence and worker exclusion

October 21, 2026 (Asia/Manila, +08:00). Authorized independent development only.
**P3-U3a and lifecycle L-01–05 remain incomplete.** No shared migration, retained
provider operation, worker activation or public API deployment occurred.

The inactive `TrunkReservations` adapter creates a generation/reservation/history
and platform audit in one existing transaction for an exact existing binding.
An explicit action-intent lock precedes node/peer admission and binding allocation;
calling reserve without that lock fails. Binding serialization allocates the next
ordinal without granting UPDATE on immutable bindings. The existing database
trigger independently locks the binding and checks ordinals; no migration or grant
was added. An active preparation blocks another request. Exact replay returns the
retained generation/current terminal state without creating another generation or
audit; changed scope, IDs, captured versions or correlation reject. Extra fields,
including credential material, reject before persistence.

This is a lower-level persistence adapter. Captured authentication/node versions
remain provenance; the caller must validate and lock **current** business authority,
then action intent, then canonical node/peer dependencies before reserve. There is
no authenticated reserve command, current-authority admission, provider import,
qualification or claim implemented by this adapter. Never wire it directly to HTTP.

The shared worker now excludes `endpoint.credential.*` and `trunk.credential.*`
from ordinary claims and generic exhausted-job result creation. The existing endpoint
consumer still claims only `endpoint.credential.prepare` for its exact installation.
Dispatch may transport committed non-secret intent; it does not give an ordinary
consumer permission to execute protected work. No trunk work contract/producer,
consumer, queue, installation principal or provider permission was activated.
Malformed ordinary queue jobs retain their existing failure behavior.

## Verification

- `./dev exec pnpm build:backend` compiles actual source.
- `python3 scripts/check-trunk-owner-foundation.py` uses one fresh network-none
  PostgreSQL/PostGIS container and read-only compiled/dependency mounts. It applies
  all 15 existing SQL migrations and preserves existing grants/audit/role regressions.
  Seven actual-adapter reservation groups cover required locking/exact scope/runtime
  denial, missing-audit rollback, identical concurrent replay, changed intent and
  active conflict, terminal replay, distinct-intent ordinal allocation and caller
  mutation while an audit write is pending. The adapter captures scalar intent
  before any await so validation, persistence and receipts use the same facts.
- The same harness provisions real pg-boss in that disposable database. Ordinary
  and endpoint consumers run against real immutable outbox rows. Ordinary delivery
  and invalid-job handling must work while reserved credential jobs remain unclaimed;
  injected exhausted protected jobs acquire no generic results or receipts.
- [Current machine evidence](p3-u3a-trunk-owner-foundation-evidence.json) records
  exact source hashes and cleanup. Fixture role changes, queue schema/jobs and rows
  disappear with the container. No retained networks/data or provider credentials
  are inherited. Scoped lint/format and whitespace checks are separate checks.

Remaining: current-authority protected commands, canonical binding creation,
import/verifier/cleanup composition and installation principals, qualification,
claim/adoption/timing transactions, trunk/gateway APIs, Redis/two-HTTP acceptance,
real retained prerequisites and final affected/full graph. Native renewal HTTP 500,
expiry timing, retained lifetime policy and browser-recovery findings stay open.


Final passing operation: `43d72a6d-dac0-4acb-90cb-d1eea6c0672e` ([immutable evidence](p3-u3a-disposable-runs/43d72a6d-dac0-4acb-90cb-d1eea6c0672e.json)).
All 15 migration sources, seven reservation groups, three queue isolation groups
and prior reference/terminal/grant/audit/role checks passed. Backend build, scoped
lint/format, Python syntax and exact fixture cleanup passed. The full default graph
and HTTP/provider/browser acceptance were not newly established by this checkpoint.
