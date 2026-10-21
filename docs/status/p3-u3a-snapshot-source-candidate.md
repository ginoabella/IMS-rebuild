# P3-U3a — Snapshot-only source candidate and installed storage verification

2026-10-21 (Asia/Manila, +08:00). Continued authorized local/disposable work.
**The source helper is inactive; retained OpenBao provisioning/capture remains gated.**

## Installed development storage

The administrator-created `myims-backup-development` account (UID/GID 12010) and
Rest Server are now independently verified. The [read-only verifier](../../scripts/backup-host/verify-development-storage.py)
checks the exact pinned running server image, non-login identity, nonprivileged
container, memory/process bounds, dropped capabilities, no-new-privileges,
read-only root, bounded tmpfs, exact volume/read-only auth/TLS mounts, internal-only
network, no published ports, append-only/private-repository/TLS settings and 2-GiB
pilot cap. The service-scoped client validates the TLS CA/hostname, authenticated
access, anonymous/wrong-repository denials and an **uninitialized** repository.
It makes zero repository writes. [Installed-state evidence](p3-u3a-development-storage-verification.json).

The original installed tooling image remains unchanged. No repository init,
source credentials, real snapshot, timer, retained restore/prune, OpenBao login or
custodian change was performed by this continuation. The service's exact public
age-recipient path was checked as UID 12010 and is absent; no private-key or
alternative custody search occurred. Root-only installation/SMTP files were not
read by bypassing host authentication.

## Inactive native snapshot source

Added [source helper](../../scripts/backup/snapshot.mjs) under a separately tagged
`myims-backup-tools:snapshot-candidate` image, with its own
[review manifest](../../infra/backup/snapshot-candidate-review.json). It has no
Compose service, provider-network attachment or startup/runtime entrypoint in the
retained installation. The candidate:

- Reads only protected AppRole input and public TLS CA files; fixed verified TLS
  origin is `https://endpoint-secrets:8200`. No token/password is accepted via
  argv/environment or written to output/status.
- Uses one login; validates exact snapshot policy, no identity-policy additions,
  service type, 300-second explicit maximum, issued/remaining bounds, no period,
  exact AppRole path/role metadata and exact read versus denied capabilities.
- Captures only native snapshot GET, bounded to 30 seconds/128 MiB, with existing
  offline Raft/member/hash verification. It never copies a live volume or reads
  KV material. Audit capture remains separate and includes token cleanup records.
- Confirms its owned token's self-revocation and subsequent lookup 403 **before**
  durable snapshot output. Known unexpected tokens are still cleaned up. A denied
  status carrying token metadata is not treated as proof of no issuance.
- Durably journals the attempt before login. Lost/malformed login replies,
  uncertain revocation or still-live lookup leave a fence preventing another
  login. No blind authentication retry or stale-lock breaking. A clean, observed
  failure records its cleanup status without claiming an uploaded backup.
- Holds the exclusive capture lock through authentication, snapshot validation,
  cleanup and durable output; output/journal failure remains a failed operation.
  No automatic source/journal cleanup is included.

The caller/supervisor still needs exact source placement, quota/housekeeping,
clock/lease/rotation acceptance and safe assembly of native snapshot, independent
audit and configuration/PostgreSQL recovery references. A valid source receipt is
not archive encryption, remote commit or joint recovery acceptance. Captured native
snapshots can revive authority on restore; later audit/revocation reconciliation
remains mandatory before reconnecting any restored instance.

## Verification

Final full native run [ebb98134](p3-u3a-disposable-runs/ebb98134-10c8-4855-a6d4-490ea64dd9a7.json)
passed **35/35** checks, exit 0. [Machine evidence](p3-u3a-snapshot-source-evidence.json).
The exact reviewed policy/AppRole bodies were provisioned only in a fresh pinned
OpenBao 2.7.1 fixture, using synthetic root/seal state. The new helper itself
received only the snapshot role's inputs, not fixture root/seal credentials.
Its real TLS/AppRole capture and revoke/403 succeeded. A separate fixture token
was directly denied native restore, force-restore, KV read, child issuance and
renewal; its revocation/403 was verified too.

The same run exercised actual candidate archive/audit/uploader helpers, Rest
Server append-only denials and restart, wrong-CA/plaintext rejection, full-data
repository check, archive retrieval/decryption/integrity and isolated native
OpenBao restore/unseal with the original synthetic sentinel recovered. Source
audit records remained separate and included capture/cleanup activity. Fixture
raw host probes trust their synthetic CA but disable IP hostname matching; actual
source/Restic helpers validate their DNS names. The fixture's shared internal
network does not prove a retained provider/uploader network composition.

All exact fixture containers, network, data volume and private directory/keys
were confirmed removed; the installed development storage was unchanged.
Earlier source runs `69ce5945-7137-4ce2-b2a5-a3ae7ae352c8` (34 checks),
`2d2ebd72-6212-46ee-90aa-b5e50a53f72f` are earlier revisions, not final acceptance.
Run `e3b0e343-78ee-4cdf-9682-9fe2db8c4ef6` passed the source checks but failed with
a transport error during a large raw TLS pack mutation probe. The negative probe
now sends a small **different-content** overwrite attempt and requires HTTP 403
plus original bytes unchanged after each attempted overwrite/delete. The failed
run and cleanup remain archived; the transport failure is not relabeled a pass.

The final candidate image also passed **15/15** synthetic source fault groups:
known-token cleanup, excess/malformed identity and capabilities, wrong maximum,
corrupt/unavailable snapshot, lost login/revoke, contradictory or malformed denial,
still-live cleanup, exclusive locks, invalid input and output failure. Those tests
prove helper contracts, not native provider outage/timing behavior. Scoped
ESLint/Prettier and Python syntax checks passed.

Reproduce disposable verification:

```sh
docker build -f infra/backup/Dockerfile -t myims-backup-tools:snapshot-candidate .
python3 scripts/backup-evaluation/check-restic.py --development-artifacts \
  --snapshot-candidate --tools-image myims-backup-tools:snapshot-candidate
```

## SMTP and outstanding gates

A credential-free connection verified `smtp.office365.com:587`, trusted STARTTLS
negotiated as TLS 1.3 and advertised AUTH. [Network evidence](p3-u3a-smtp-connectivity.json).
Seven synthetic mail-helper tests pass, including explicit notification tests and
failure sequencing. `--send` requires an explicit event. No mailbox authentication,
email submission or mailbox receipt has been verified by this session. The
administrator may validate the root-only configuration and then run the documented
`notification_test`; the password remains outside chat/source/argv/environment.

Existing independently authorized OpenBao installer/backup-route reference,
backup-first/snapshot identity provisioning, independent age public recipient and
private-key copies, recoverable repository credentials, real audit integration,
scheduler/rotation/alert/housekeeping and joint PostgreSQL recovery with generation
reconciliation/measured RPO/RTO remain unresolved. The 2-GiB quota is a development
pilot boundary, not full retention acceptance. No timed COMPLIANCE requirement is
reintroduced. Native renewal HTTP 500/expiry timing, retained lifetime-policy and
browser-recovery findings remain unresolved. **P3-U3a remains incomplete.**
