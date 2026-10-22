# P3-U3a retained development bootstrap execution

October 22, 2026, Asia/Manila (+08:00). **Installation and both encrypted backup
retrievals and administrator password handoff succeeded. P3-U3a incomplete.**

Operation `d6550071-561a-4339-bc15-50a5b22ac43d` ran once under the owner's explicit corrected-package
approval, digest `76ac9c1e4e280427145290dbd08569175e3b618486ef094ef93e1bb7e5d2fbc4`. The owner prepared fresh staging;
actual private metadata/current provider/repository/network/mount checks passed
before the launcher. The [machine execution record](p3-u3a-bootstrap-execution-d6550071-561a-4339-bc15-50a5b22ac43d.json)
and [consumed request](../../infra/backup/bootstrap-request.json) preserve exact
events, identities and receipt/hash bindings. The original staging-parent refusal
and narrowly scoped correction remain in the [execution request](../planning/p3-u3a-bootstrap-execution-request.md).

## Verified result

- Existing initialized repository verified before isolation; no reinitialization.
- One root-generation attempt; complete live pre-state review passed with 88
  reads, 59 policies, fourteen role configurations and one existing entity.
- Native pre-change capture and independent audit encrypted offline, handed off
  as ciphertext, uploaded and retrieved before any provisioning write.
- All nine exact writes acknowledged, with ten live host/source/candidate/backup
  checks. Native readback and maintenance login/denial/self-revocation acceptance
  passed. The existing custodian account/password/configuration was preserved.
- Root revoked and lookup 403 verified. Normal TLS/HCL/mount/network protection
  restored, unsealed active health and anonymous generation 405 verified.
  Isolation-to-protected-restoration: **43.496 seconds** against 840 seconds;
  this is not a joint recovery RTO. Guard cancelled, normal restart policy
  restored, root helper and temporary bootstrap containers removed.
- Separate post-cleanup audit and scoped post-install snapshot encrypted, uploaded
  and independently retrieved. The scoped snapshot identity self-revoked/403.
- Final Docker metadata confirms normal provider mounts/network/hardening and
  running state. All 67 pinned source artifacts remain unchanged after execution.

| Backup | Restic snapshot | Retrieval |
| --- | --- | --- |
| Pre-change | `6d148334bb5dc2ce93de43f6cd71c8df485b940828dc3514717476b6a19175a3` | Exact four files; ciphertext and receipt hashes/lengths match |
| Post-install | `c51f8a679a86d29265af9b4588b1f76d537e7cacb09ce1bc75e660bd60015324` | Exact four files; ciphertext and receipt hashes/lengths match |

The separate snapshots are in the already initialized repository
`8f2337728f88192a57301f5ee51e405a6625955054c15079675fbdf907b8da6b`. Retrieval verification performed no repository writes,
provider API access or decryption. Uploads necessarily wrote their new snapshots.

## Handoff complete and next work

The owner ran the exact administrator helper and reported
`maintenance-password-handed-off`, source preserved and no password printed.
Independent metadata-only verification confirms UID/GID 1002, mode-0700 parent,
and a regular, single-link mode-0600 password file at the approved target. The
password was not read. [Separate handoff evidence](p3-u3a-bootstrap-maintenance-handoff.json)
closes the pending handoff recorded in the original, preserved execution JSON.
Do not rerun staging, the consumed executor or the successful password handoff.

No timer, continuous audit collector, retention/prune or production was activated.
Source capture, ciphertexts, receipts, isolated snapshot credentials and safe
operation records remain preserved; no cleanup was authorized. No application,
PostgreSQL, Redis or Asterisk changes were made.

The [operator commands](p3-u3a-backup-operations.md) now implement status, run-now,
attended rotation and local failure reporting, with disposable native verification.
Next is attended retained command acceptance without activating a schedule. Independent fresh
archive decryption (owner-held private key stays outside this workspace), isolated
OpenBao/PostgreSQL joint recovery and generation reconciliation, measured RPO/RTO
and agreed alerts/capacity/rotation operations still precede scheduling/readiness.
Trunk/gateway definition/lifecycle/two-HTTP acceptance and existing renewal HTTP
500, fractional-expiry and browser findings remain unfinished. See the
[operations runbook](../runbooks/p3-u3a-development-backup.md) and
[feature spec](../../context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md).
