# P3-U3a retained-host wiring and complete backup rehearsal

**Latest result:** corrected package explicitly approved and executed once; all nine
writes and both encrypted backup retrievals succeeded. Root revoked, normal
protection restored and guard/helpers closed. Owner password handoff is complete
and its private custody was verified without reading the password. [Execution evidence and next guidance](p3-u3a-bootstrap-retained-execution.md).
The earlier pending statements below describe preparation history; execution
authorization is now consumed and must not be replayed.

October 22, 2026 (Asia/Manila, +08:00). Owner authorized continued host wiring and
post-install verification. **Implementation and disposable rehearsal complete;
retained execution remains disabled. P3-U3a remains incomplete.** The separately
reviewable [execution request](../planning/p3-u3a-bootstrap-execution-request.md)
is now concrete; prior plan approval is not reused as root authorization.

## Delivered behavior

The operation-bound host ports now drive existing-repository verification,
semantic pre-state review, native capture, offline encryption, descriptor-anchored
ciphertext handoff, exact upload/retrieval, all nine writes, acceptance/cleanup,
scoped post-install capture and a separate encrypted post-install backup. A failed
or changed repository ID stops before provider isolation; no initialization path
exists in the new ports/launcher.

A token-free stdio bridge performs **ten fresh host checks**: one after pre-state
qualification and one before each of nine provisioning writes. It verifies the
live independent guard, backup freshness and operation, reviewed source/candidate
bytes and attended window. Wrong operation/sequence, denied health, malformed or
oversize frames, closed stdin and missing completion fail closed. No root token,
password, private response or authentication header crosses this bridge.

The semantic reviewer requires exact current policy-name/body hashes, complete
role fields and approved identity composition. It checks native legacy
`explicit_max_ttl=0` separately from the required nonzero `token_explicit_max_ttl`;
other extra fields/aliases are explicitly checked. Native probes and the complete
fixture established that distinction; no configured maximum was relaxed. The
fixture includes a real previously logged-in custodian entity/alias, then verifies
no additional policy/group contributions or alternate user/mount mapping. Current
retained mappings are still unknown until this reviewer runs under the separately
approved isolated operation; the historical 59-policy baseline is not a live fact.

Snapshot credentials, installation state and the maintenance password have
separate protected directories/mounts. The post-install snapshot process receives
only snapshot credentials; it cannot read the human password. Administrator staging
refuses an existing operation or noncanonical paths. The handoff helper requires
confirmed installation and exclusive owner-only output; it preserves its protected
source and prints no password, hash or length.

The post-install archive revalidates native snapshot integrity and the capture's
owned-token revoke/403 receipt. Its manifest explicitly denies a joint PostgreSQL
recovery claim. A separate verifier accepts only the exact stage's archive kinds,
repository ID, four snapshot files, operation-bound receipts and retrieved hashes/
lengths. The historical capture-only verifier remains unchanged. The common archive
helper only adds operation binding for this new archive kind; existing kinds retain
their prior output behavior.

## Native evidence

[Successful current-source run](p3-u3a-disposable-runs/2fe4b457-8e72-414a-8d5b-ef6df9bd6adc.json)
passed **9/9** assertions, including semantic review of the existing custodian
entity/all role aliases, ten live host guard/freshness checks, independent pre-change
and post-install upload/retrieval with distinct Restic snapshot IDs, root revoke/403,
protected TLS/405 restoration and exact fixture/watcher cleanup.
[Current summary](p3-u3a-bootstrap-host-evidence.json).

[Lost-response run](p3-u3a-disposable-runs/3969266a-3056-4610-a960-0128e04b2431.json)
passed **9/9** assertions. Injection occurs after native mount creation commits
(write index 4); five writes started, four were acknowledged, and six live host
checks completed. No subsequent provisioning write or scoped post-install capture
ran. Root revoke/403, restoration, independent post-cleanup audit encryption and
exact cleanup passed. [Current fault summary](p3-u3a-bootstrap-host-fault-evidence.json).

Both runs use actual TLS/Raft OpenBao, a TLS append-only Rest Server, age/Restic,
real Compose isolation/restoration and the shared host adapters. Only resource
identities/custody, the initial synthetic policy baseline and the explicit fault
wrapper differ from retained use. Each fixture initializes its own empty repository
before the controller starts; the controller uses it as an existing repository.
Complete source SHA256 maps are checked unchanged throughout each final run.

Earlier disposable attempts found a native role-alias expectation mismatch and a
post-install archive umask issue. The corrected archive now establishes private
creation permissions and restores its caller's mask; a focused encrypt/decrypt test
covers operation/cleanup/integrity bindings. Earlier failed fixtures still revoked
root/restored protection and removed exact resources. Evidence remains under the
per-operation status directory; no retained operation was attempted.

## Package and remaining boundary

[Operation manifest](../../infra/backup/bootstrap-request.json), operation
`d6550071-561a-4339-bc15-50a5b22ac43d`, pins the nine bodies, provider/repository,
59 historical policy hashes, artifacts, protected staging, a new operation namespace
and exact administrator password handoff. Its review digest is distinct from
mutable approval/consumption/window fields. The launcher checks regenerated public
packaging and source hashes, then requires an exact digest-bound owner approval,
unconsumed operation, fresh staging and a window no longer than 900 seconds before
Docker/custody/provider execution. Default invocation is public validation only.

The retained-specific constructor/staging renderer has local refusal/replay and
mount-separation checks; retained provider execution is intentionally untested.
The native rehearsal substitutes fixture provider/seal/network/volume identities
and initializes only its own repository during setup. It does not establish current
retained policy/mapping state, actual new staging, actual maintenance handoff, fresh
independent decryption, joint recovery or scheduling readiness.

The owner has approved the single concrete bootstrap request and its exact review
digest. Administrator staging is pending because this agent session requires
interactive sudo authentication. After the owner runs the reviewed staging command,
continue with the already-prepared agent preflight/execution and a fresh bounded
window; no repeat approval is required. Stop on current-state differences rather than normalize/overwrite them.
No new root execution or provider access is authorized by this status document.

Final checks: **38/38** archive/capture/snapshot/handoff tests in the pinned,
network-disabled tooling container; **24/24** Node authority/provisioning/guard
regressions in the Docker workspace; **15/15** host controller/bridge/package
checks. Scoped ESLint/formatting, Python syntax, source/digest bindings and local
links passed. Public package validation passed with provider/custody access false;
owner execution approval is now recorded, while staging remains false and the
operation remains unconsumed/unstarted. Full application suites were not rerun
for these deployment-only changes; the existing unrelated full-graph formatting
limitation remains recorded.

## Staging parent-check correction — October 22, 2026 (+08:00)

The owner's staging attempt refused `unsafe_parent`. The helper incorrectly
required every ancestor to be root-owned, although the installed backup host
preparer intentionally creates `/srv/myims-backup-development` as
UID/GID 12010, mode 0700. Metadata-only inspection confirmed this exact custody,
an empty root-owned mode-0700 `bootstrap` parent, and absence of both operation
directories. No credential contents or provider API were accessed.

The helper now allows only that exact service-owned ancestor with exact UID/GID
12010 and mode 0700. Other ancestors must be real root-owned directories, with
root group and no group/other writes. It validates both complete ancestor chains
before creating any missing parent. Existing host ownership and operation paths,
nine provider writes, guard and cleanup behavior are unchanged. Existing operation
directories still refuse reuse; the empty parent from the failed attempt is safe.

Seven focused package/staging tests pass, including exact-path/custody negatives
and refusal before mkdir. The original owner approval remains recorded against
`07907f91e232a093bd0d125413995d03c8099fa0ae887c5232c9859338eacc85`. The corrected package is
`76ac9c1e4e280427145290dbd08569175e3b618486ef094ef93e1bb7e5d2fbc4`; only the pinned staging helper changed.
Retained/root execution flags remain false until the owner approves this corrected
source binding. No new root attempt or execution window has started. The owner can
rerun the same administrator staging command in the execution request; after successful preparation
and acceptance of this correction, the agent verifies staging and continues.
