# P3-U3a independent archive verification implementation

October 22, 2026, Asia/Manila (+08:00). **Read-only export and owner-run offline
verification implemented; retained ciphertext export and owner custody verified.
Owner Windows copy/decryption passed October 23, 2026 (+08:00); P3-U3a incomplete.**

Use the [owner runbook](../runbooks/p3-u3a-independent-archive-verification.md).
The owner has now completed the administrator-only ciphertext export. The owner also completed off-host Windows decryption and integrity verification;
see the [owner-reported result](p3-u3a-owner-archive-verification.json). No additional bootstrap
approval is requested or reused. No retained repository/key/provider access took
place during implementation; the public default plan reads only source evidence.

## Retained export completed

The owner ran the exporter and reported `ciphertext-verification-exported` for
operation `f870564b-45b5-4b34-a5c9-949df4a35194`. Independent verification
matched all five owner files to the pinned request/ciphertext/receipt hashes and
exact ciphertext lengths; UID/GID 1002, directories 0700, regular single-link files
0600. No private key, plaintext or provider was accessed for that check.
[Export evidence](p3-u3a-retained-verification-export.json). Protected source
preservation and zero repository writes are recorded from the operator report.
Owner verification is complete; preserve the export and do not rerun it.

## Delivered

- Generated a [public exact-source request](../planning/p3-u3a-fresh-backup-verification-request.json)
  from the preserved completed bootstrap execution evidence. It binds the precise
  post-install snapshot, repository, original operation and both ciphertext/receipt
  hashes. SHA256: `2a0f686e9097a72ab6875273aaf6b6cd8c05c8488bc0323cbba93e84343c222b`.
- Added a default-plan host exporter and repository-network-only retriever. They
  require exact snapshot membership and hashes using read-only no-lock Restic
  operations; no repository init/upload/prune, provider or private-key input.
- Added exclusive ciphertext-only owner handoff, private custody checks, anchored
  file descriptors, streaming hash checks, fsync and preservation of source/partial
  paths. Each explicit export gets fresh UUID directories; no overwrite or repair.
- Added a portable Node owner verifier requiring an independently supplied request
  hash, exact bundle files, matching ciphertext/receipts, real age decryption and
  strict bounded in-memory archive parsing. No archive extraction or plaintext file
  output. Snapshot receipt/checksums and audit JSON-line integrity are verified.
- Explicitly retain unproven sealed-checksum cryptography, native restore, audit
  continuity, joint PostgreSQL reconciliation and recovery-readiness boundaries.
  Private age material stays on the owner's machine and is never pasted/imported
  into this server. The Windows instructions require owner execution for acceptance;
  this implementation does not claim tested Windows ACL/runtime behavior.

## Verification

- **8/8** focused Node groups in the pinned network-disabled tools image: actual
  age decrypt, wrong request/hash/key, extra or symlinked inputs, path traversal,
  links/duplicates/truncation/checksum rejection and internal snapshot/audit failures.
  Initial fixture setup used a public umask; corrected the fixture to private 077
  without changing the existing archive implementation, then all groups passed.
- **5/5** focused host groups: exact public-source binding, nonadministrator refusal
  before Docker/filesystem changes, changed request refusal, exclusive/hash-bound
  handoff, symlink and wrong-digest refusal. Host custody identity changes are mocked
  in these local tests; actual administrator directory creation/handoff remains
  retained acceptance, not proven by mocked ownership.
- **12/12** [native groups](p3-u3a-backup-recovery-verification-native.json),
  operation `d2ef84b3-0a5a-4451-a7ae-0abffa3813ff`: synthetic TLS/Raft OpenBao plus authenticated
  TLS append-only Restic, actual scoped snapshot and independent audit encryption,
  exact read-only ciphertext export, followed by network-disabled actual age decrypt
  and native snapshot/audit integrity verification using a separately mounted fixture
  key. All exercised source hashes match. Every fixture container, volume, network,
  key/private directory and deadline watcher was removed.
- Scoped ESLint/Prettier, Python syntax, public request regeneration/binding,
  source preservation, local links and diff whitespace verified. All 67 consumed
  bootstrap source artifact hashes are unchanged. No application code changed;
  full application suites were not rerun for this deployment-only unit.

Reproduce:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/export-backup-verification.test.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-host/export-backup-verification.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/backup-evaluation/check-bootstrap-controller.py --recovery-verification
```

The Node groups run in the pinned tools image with `/scripts` mounted read-only,
network none, private tmpfs and `node --test /scripts/backup-recovery/verify.test.mjs`.
They use only synthetic keys and inputs.

## Remaining acceptance

Owner-reported Windows verification passed at 2026-10-23 07:48:47 +08:00
(Node v24.22.1). The report matches the pinned request, repository, snapshot and
both archive identities; snapshot integrity and 5,593 audit records passed.
No plaintext was written and no provider/repository access was reported.
[Sanitized evidence](p3-u3a-owner-archive-verification.json) records the exact report
and [Windows paths](../runbooks/p3-u3a-independent-archive-verification.md#recorded-windows-locations).
The private key was not handled by the agent. Windows ACL audit and OS-level
network disconnection were not independently established. This verifies the exact
installation checkpoint, not freshness, native restore or disaster-recovery RTO.

Retained status/run-now/rotation acceptance, isolated compatible OpenBao native
restore using independently held seal material, matching PostgreSQL recovery point
and generation reconciliation, measured RPO/RTO and agreed alerts/capacity/rotation
operations still precede scheduling. Existing renewal HTTP 500, fractional-expiry,
browser and trunk/gateway acceptance findings remain open. No timer/production or
retained restore/prune/provider modification was activated or performed.
