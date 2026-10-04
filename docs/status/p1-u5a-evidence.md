# P1-U5a verification evidence

Completed and verified on 2026-10-04 19:11 +08:00 (Asia/Manila) in the existing Docker workspace. Scope is
transactional writes and inspection of durable intent. P1-U5b/c and parent P1-U5
remain incomplete. Implementation follows the
[feature spec](../../context/feature-specs/p1-u5a-transactional-audit-and-outbox.md)
and [write contract](../architecture/transactional-audit-outbox.md).

## Environment and commands

`./dev status` confirmed healthy PostgreSQL/PostGIS, session Redis, realtime Redis,
Asterisk and backend containers, plus the running workspace. Node 22.23.3,
pnpm 10.12.1, PostgreSQL 17/PostGIS 3.5 and existing digest-pinned Compose images
were used. No host service runtimes or new dependencies were installed.

Commands executed:

- `./dev exec pnpm --filter @myims/backend typecheck` — passed.
- `./dev exec pnpm check:audit-outbox` — passed, including the final
  rerun with strict error-code allowlisting and five-character secret sentinel.
- `./dev migrate` — passed; applied audit/outbox to the development database.
- `./dev health` — passed; live and ready return HTTP 200 with all dependencies up.
- `./dev check` — passed, exit status 0: workspace lint/format/types/builds,
  configuration, entry-point isolation and real-database foundation checks.
- Focused ESLint on the added check script and backend write files — passed.
- Changed-document relative-link checks and `git diff --check` — passed.

The focused command builds the backend and creates a uniquely named disposable
`myims_audit_*` database using existing deployment credentials. It runs the actual
deployment entry point twice, then opens a separate owner connection, runtime pool
and independent runtime observer. The owner adds test-only sample/sink tables and
failure constraints in that disposable database. Cleanup closes all clients and
drops only the generated database. No production history is deleted.

## Assertions and observed results

- AC-01: a transaction inserts sample, audit and outbox using one connection. An
  independent runtime connection sees zero sample/audit/outbox/effect rows while
  the transaction is held open. After commit it sees one of each persisted record
  and zero effects. Callback values return only after commit; the handle rejects
  later queries. An explicit rollback and separate database constraints forcing
  audit and outbox INSERT failures each leave zero rows. Caught SQL and required
  validation errors still poison the transaction and roll back sample writes.
- AC-02: platform, staff and system fixtures persist the intended identity plane
  and target scope. Platform identity remains tenantless while target scope remains
  tenant-owned; staff requires a matching tenant; system names its command/reason.
  Caller mutation cannot alter the frozen snapshot. Missing/mismatched scope,
  platform actor tenant, missing system reason, wrong plane, extra actor fields and
  invalid correlation/target shape fail before entering the transaction action.
  Direct SQL under runtime credentials independently rejects invalid combinations
  in both production tables. These are structural fixture checks, not authentication.
- AC-03: actual `myims_runtime` credentials successfully insert via repositories;
  UPDATE, DELETE, TRUNCATE, timestamp override, trigger disable/drop, ownership
  alteration, function replacement, session replication bypass and owner-role
  acquisition fail. Attempting GRANT cannot obtain UPDATE. The owner also cannot
  perform an ordinary audit UPDATE because of the append-only trigger. Runtime
  role retains no superuser/create-role/create-database/bypass-RLS flags. Outbox
  intent changes/deletion/truncation and overriding initial pending state are denied.
- Write-path AC-08: initiating context/correlation match across audit and outbox.
  Payload and metadata contain only contract-approved fields. Synthetic secret,
  token, personal and location sentinels in metadata, work payload and arbitrary
  exception messages/details/codes are rejected or omitted. Captured structured
  logs retain timestamp, level, entry point, operation, correlation, work/attempt
  and safe outcome/code fields. No raw error object or stack is emitted.
- Write-path AC-09: fresh deployment records both versioned migrations; rerun is
  safe. Initial intent is pending and cannot be overridden by runtime INSERT.
  Handoff columns can change to accepted without rewriting audit/intent or adding
  an external effect. Existing configuration checks cover database URLs/secrets,
  pool maximum and bounded dependency timeouts; existing process checks verify
  entry-point isolation. All passed in the full Docker check, including concurrent migrations,
  dependency outage/recovery and backend restart.

## Limitations and handoff

No queue, dispatcher, retry loop or external effect exists in this unit. The
isolated delivery sink remains empty; this proves only the current write boundary.
P1-U5b owns pg-boss provisioning and execution. P1-U5c owns integrated recovery,
final `check:durability`/CI wiring and operational handoff. No public sample route,
identity/tenant/business table, retained-history cleanup or retention period was
introduced. Hosted CI, production HA, actual authentication/permissions, live PBX,
SMS/storage effects and crash/restart delivery are not claimed.

The transaction design uses the same client throughout, following
[node-postgres transaction documentation](https://node-postgres.com/features/transactions).
Runtime column/table grants follow
[PostgreSQL 17 GRANT semantics](https://www.postgresql.org/docs/17/sql-grant.html).
Privileged deployment ownership is maintenance authority, not an application path.
Connection loss around COMMIT can produce an uncertain caller outcome; durable
intent must be inspected before replaying business/external work.
