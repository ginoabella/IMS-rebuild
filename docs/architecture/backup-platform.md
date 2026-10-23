# Backup platform — development and operational scope

Updated October 23, 2026, Asia/Manila (+08:00), following the owner's approved
[P3-U3 simplification](../../context/feature-specs/p3-u3-development-resource-management.md).
Backups are operational work, independent of trunk/gateway/DID feature completion.

Retain the existing Docker Restic/append-only Rest Server and age-encrypted archive
format. Preserve repositories, stored backups, custody files and owner-held recovery
keys. Manual encrypted backups and a documented recovery procedure are the current
development direction; new scheduling, rotation automation, continuous audit and
comprehensive joint recovery exercises are deferred operational work.

Current limitation: the first routine backup failed because its initial AppRole
SecretID was actually issued for 300 seconds. Its pending operation and staged audit
are preserved. The installation checkpoint was independently decrypted on Windows.
A working routine backup, active schedule, measured RPO/RTO and retained joint-store
restore are not established. See the [current operations guide](../runbooks/p3-u3a-development-backup.md).

Production placement, capacity, monitoring, independent recovery copies and tested
restoration still need an operational deployment decision and evidence. Development
feature acceptance does not assert production backup readiness. No backup retention,
pruning, provider restart, root recovery or credential migration is executed by this
documentation change. An environment administrator remains responsible for actual
backup coverage and for explicitly communicating any accepted development data-loss risk.

The [previous detailed backup contract](../archive/p3-u3/2026-10-23/docs/architecture/backup-platform.md)
is preserved as operational design history and future hardening input, not a P3-U3
implementation gate.
