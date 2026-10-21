# P3-U3a — Isolated terminal reservation adapter checkpoint

2026-10-21 (Asia/Manila, +08:00). Independent local implementation under the
owner's continuation instruction; **P3-U3a remains incomplete**.

Added the inactive [database adapter](../../services/backend/src/modules/telephony/adapters/db/trunk-reservation-transitions.ts)
for reserved-to-cancelled/failed transitions. It requires a platform-operation
transaction context with matching target, original actor/correlation and exact
node/installation/binding/generation/operation. It locks only the exact reservation,
updates terminal state, appends retained history and writes safe binding/generation
audit in the same transaction. Only the same terminal outcome is replayable;
opposite terminal outcomes reject. Errors poison the existing transaction.

The real isolated harness passed all 15 migration sources and prior owner/grant/
provenance/audit/ordinal/membership/reference checks, plus the actual compiled
adapter with the existing `Transaction` and `AuditRepository`. It verified:

- Missing audit fails the independent deferred constraint at commit, rolling back
  both terminal transition and history.
- Wrong node/installation/binding/generation, actor/correlation and target fail
  safely; the actual runtime database role cannot access the protected adapter.
- Two concurrent transactions return one change and one replay; a later replay
  creates no duplicate audit/history. The opposite terminal state is rejected.

Passing [immutable run](p3-u3a-disposable-runs/1c6abae0-e9e2-4daa-8482-71bce1bfdd41.json).
The earlier run `a7415a7f-de52-47f9-a702-51bd75d28a13` failed in the fixture's
final evidence query because a shared SQL parameter mixed UUID and text types;
an explicit cast corrected the fixture. Both exact fixture containers were removed
in each run. No named data volumes or host ports were created; selected existing
dependency volumes were mounted read-only. No retained database/provider access.

Backend build and scoped formatting/lint passed. This remains an uncomposed owner
persistence step. It does not authenticate/authorize current business commands,
provision a usable owner login, cancel provider work, remove material, qualify or
claim/adopt a binding, install workers or expose HTTP. No migration/grant expansion
or runtime entrypoint change. Future callers must check current authority and
coordinate provider cleanup independently. Real renewal HTTP 500/expiry timing,
retained lifetime-policy and browser-recovery findings remain unresolved.
