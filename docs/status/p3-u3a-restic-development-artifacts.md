# P3-U3a — Development Restic artifact checkpoint

2026-10-21 (Asia/Manila, +08:00). Owner accepted platform/documentation and
continued local/disposable work. **No retained execution or installation.**

Prepared the separate [Docker project](../../infra/backup/compose.yaml),
[pinned tooling build](../../infra/backup/Dockerfile), bounded archive/audit/upload
helpers and [consolidated development installation request](../planning/p3-u3a-development-backup-installation-request.md).
The [review manifest](../../infra/backup/review-manifest.json) pins artifact hashes
and the tested tooling image ID; execution remains disabled. No integration with
normal `./dev up`, no default services, no automatic restart and no installed timer.

## Verified backup behavior

`docker build -f infra/backup/Dockerfile -t myims-backup-tools:development-candidate .`
built the candidate from pinned Node/Restic and SHA-256-verified age 1.3.2. The
Dockerfile-specific context allowlist includes no custody/application data.

`python3 scripts/backup-evaluation/check-restic.py --development-artifacts`
passed **32/32** checks, exit 0. [Immutable passing run](p3-u3a-disposable-runs/b33b839f-6563-4082-b075-f929d7dc1286.json),
[latest machine evidence](p3-u3a-restic-development-evidence.json).
It exercised the actual candidate Compose configuration and helper image:

- Native synthetic OpenBao Raft snapshot plus separate audit; actual archive helper
  verifies native integrity, creates member manifest and age-encrypts before upload.
- Dedicated internal network, no host ports, scoped persistent fixture volume,
  hardened service configuration and file-held repository credentials; real clients
  validate the server's TLS CA and DNS SAN. Untrusted CA rejects without leaking
  credentials in the helper output. Host-side raw protocol probes pin the synthetic
  CA but suppress IP hostname matching; only those probes have that exception.
- Anonymous/other-repository denial; existing config/snapshot/pack overwrite and
  deletion denial, client forget failure, protection after server restart and
  subsequent new backup; lock deletion remains the documented protocol exception.
- Actual separate audit collector and uploader; plaintext spool rejection and
  full-data repository verification through the restricted helper.
- Retrieval from the exact Restic snapshot, archive/member hash verification,
  age decryption and native Raft restoration/unseal into a separate fresh OpenBao
  container with the original synthetic sentinel restored.

All exact containers, network, persistent fixture volume, temporary custody and
synthetic keys were confirmed absent. Only the candidate tooling image/build cache
remain as prepared artifacts. No retained backup service, volume, credential,
OpenBao login/write, PostgreSQL migration or scheduler was activated.

Earlier disposable runs are preserved: `9412862c-cc72-412b-8cd8-8a18015c5aa7`
failed because a Python helper function name collided with a fixture variable;
`574bfa2b-68f5-4049-abdc-8db80abb6f42` reached all functional recovery checks but
failed inspecting already auto-removed helpers; `0a5299c6-5325-4a39-8ec1-0fb8a5f38d5b`
reached functional recovery checks but expected a manual-run label on a Compose
service. The harness now verifies exact native Compose project ownership and
allows absence only for its exact expected auto-removed helper names. All runs
confirmed exact cleanup. Acceptance assertions were not weakened.

## Focused faults and independent trunk work

In the read-only, network-none tooling container, `node --test
/opt/scripts/backup/archive.test.mjs` passed **11/11** groups: complete-line append,
replay and rename/create rotation; truncation, rewritten prefixes, missing inode,
partial closed segments, malformed JSON, symlinks, collector/spool lock conflicts,
encryption failure without cursor advance, wrong key/corrupt ciphertext, bounded
inputs, secret-file permissions, traversal and full-spool refusal. The initial
permission test was corrected to explicitly chmod its synthetic public file after
the fixture umask made the requested mode private. Scoped ESLint/Prettier passed.

Independent trunk work added an inactive atomic terminal adapter, verified in
real isolated PostgreSQL with all 15 migration sources and existing regressions.
[Results and limits](p3-u3a-trunk-reservation-transitions.md). Backend build passed.
No API, worker, provider cleanup or runtime timing integration is claimed.

## Acceptance limits and next gates

The audit cursor advances after durable **local encrypted spooling**, not remote
upload success. Closed source segments and ciphertext must remain until reviewed
upload acknowledgements permit exact housekeeping. The ordered segment list/rename
rotation hook is trusted host integration; arbitrary filesystem loss or malicious
list reordering is not proved safe. Prefix/offset/identity checks detect the tested
faults; the collector does not claim that every possible truncate/regrow race can
be detected. Snapshot input consistency is the separately controlled capture
route's responsibility. Hard-kill leaves locks requiring reviewed reconciliation.

The helpers' sanitized nonzero status is not complete alert delivery. Timers,
continuous audit supervisor/rotation integration, retained snapshot authentication
and rotation, source configuration recovery/independent availability, measured
capacity/lag and spool housekeeping remain unfinished. Native tests use synthetic
fixture authority, not an accepted retained snapshot-only identity. PostgreSQL
recovery references are metadata, not a PostgreSQL backup or proven joint recovery.
The RPO/RTO and production independent-copy/host-compromise safeguards are unproved.

The consolidated request identifies exact proposed services, volume/paths,
credentials/custody, networking/startup, schedules and **unassigned** owners plus
controlled first-backup and isolated joint restore steps. Actual installer,
backup-first and snapshot-identity gates, custody, retained activation, cleanup and
restore permissions still need separate exact approval. The functioning
`platform-owner-custodian` account and its restrictions remain unchanged.

Timed COMPLIANCE retention remains an approved deferred enhancement, not an initial
blocker. Native renewal HTTP 500, expiry timing, retained lifetime policy and
browser-recovery findings remain unresolved. **P3-U3a remains incomplete.**
