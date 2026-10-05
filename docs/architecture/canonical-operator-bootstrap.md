# Canonical initial operator bootstrap — P2-U1c

The [approved review sections 1–2](../planning/p2-u1c-bootstrap-contract-review.md)
provide c's scoped D-05/P1-U1 handoff. a's
[storage contract](canonical-identity-storage.md) and b's
[authority/admission contract](canonical-authority-admission.md) remain authoritative
for their delivered boundaries. Unrelated P1-U1 decisions remain deferred.
Acceptance results belong to the [integrated evidence](../status/p2-u1c-evidence.md).

## Approved credential and identity contract

Passwords have 15–128 Unicode code points and at most 512 UTF-8 bytes. Spaces and
Unicode are permitted without composition requirements. Reject malformed UTF-8,
NUL, CR/LF, NEL and Unicode line/paragraph separators. Preserve exact bytes,
including outer spaces and Unicode normalization form. There is no generator,
default password, breach-screening service or credential delivery feature.
Hidden interactive entry requires identical confirmation; protected automation
input supplies one password. This policy is scoped to initial operator bootstrap;
broader setup/reset/login policies remain with their owners.

Initial canonical facts are explicit: tenantless platform operator, normalized
username under a's ASCII contract, active account, ready credential with coherent
change timestamp, fixed platform_operator authority, row/authentication versions
1/1. No staff role or tenant association is added. Later authentication must use
canonical plane-specific snapshots and private verification; creation is not login.

## Private hash representation and bounds

Use Node 22's asynchronous built-in scrypt with N=131072, r=8, p=1, 16 random salt
bytes and 32 derived key bytes. Each operation sets maxmem=160 MiB; working memory
is approximately 128 MiB. Encode a versioned algorithm/parameter prefix followed
by fixed-length lowercase hexadecimal salt and key fields. Store only that encoded
hash in the canonical operator credential column; it is absent from general DTOs.

Node 22 supplies scrypt without adding a native dependency. These parameters follow
[OWASP's scrypt guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt);
[Node's crypto API](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
defines the memory option and asynchronous primitive. Reject overlapping hash work
within a process rather than queueing plaintext passwords. Each command accepts
one input and exits; independently launched trusted commands each have that bound.
This does not establish capacity for a later public authentication service.

Verification accepts only this exact version/parameter set and field lengths.
Unknown/malformed hashes return false before hashing; stored input cannot select
arbitrary expensive parameters. Compare derived bytes with timingSafeEqual.
Correct/wrong-password and case/space/Unicode-normalization differences are checked
using synthetic credentials. Clear derived-key buffers and consumed input buffers
where practical. JavaScript strings/native internals cannot be guaranteed erased.

## Protected command boundary

`src/entrypoints/deployment/main.ts bootstrap-operator` dispatches explicitly to
the existing deployment process. It opens no listener, worker, PBX observer or
session store. Migration, HTTP and general deployment startup do not bootstrap.
The [runbook](../runbooks/operator-bootstrap.md) owns the exact Docker commands.

Use existing typed deployment/runtime connection settings and resolved credential
files. Require both URLs to name the same database endpoint, the runtime URL to
use myims_runtime, and the trusted URL to use another role. Preflight checks actual
operator/provenance INSERT privileges, the completed canonical-authority migration
and the required operator columns. No schema mutation or migration occurs here.

Protected file input is a UTF-8 JSON object containing exactly username/password
string fields. Bound the entire file to 4096 bytes, open without following
symlinks and require a regular file owned by the command UID with no group/other
permissions. Validate the open descriptor and bound actual reads, preventing a
replacement/growth race from bypassing checks. Reject unpaired JSON surrogates.
Input passwords are decoded as text and re-encoded to exact UTF-8; JSON escapes
represent their characters and are not literal password bytes. The caller owns
file retention/removal; bootstrap does not delete an operator-managed secret.

Interactive mode hides both identity input and password input, bounds each field
to 512 input bytes and each prompt to 120 seconds, and restores terminal mode on
success, invalid input, Ctrl+C/Ctrl+D, EOF or handled SIGTERM/SIGHUP. Username
normalization is separate from password handling. Transient read/confirmation
buffers are cleared where practical. No input contents are passed in argv or
printed. Raw input and protected file errors become one fixed invalid-input result.

## Atomic creation and safe rerun

Hash validated input before the creation transaction. Use P1-U5's explicit
Transaction handle with a one-connection trusted pool, a PostgreSQL transaction
advisory lock (846258114), a 10-second lock timeout and existing singleton/foreign-key
provenance constraints. Pool connections are bounded to 2 seconds; statements to
15 seconds and client query waits to 17 seconds. Resources close on command exit.

Under the lock, read and lock durable provenance and its canonical operator.
A matching username requires this command's provenance, active/ready coherent
credential, supported hash and positive versions. It returns already-created,
preserving account, hash, authority, timestamps, versions and creation-audit count.
Validate policy on every invocation; a newly supplied valid password cannot reset
or verify the existing credential and is never substituted into it. Concurrent
runtime status/credential changes serialize against the locked operator row.

A different identity, conflicting/inconsistent provenance, an unrelated existing
username, disabled/unset/malformed existing bootstrap account or unsupported hash
returns conflict. Do not adopt, repair, reset or reactivate an account. PostgreSQL
uniqueness still prevents a concurrent unrelated insert from duplicating a username.

First creation inserts operator/credential and singleton provenance, then appends
one platform.operator.bootstrapped event on the same transaction. Its trusted
system actor is deployment.bootstrap-operator with initial-operator-provisioning
reason. Target is the generated operator UUID; correlation is an independent UUID.
The metadata allowlist contains only created outcome and versions 1/1. Username,
password and hash never enter audit metadata or diagnostics. Runtime grants forbid
operator INSERT and every provenance write; no public endpoint exposes bootstrap.

## Failure recovery and downstream handoff

A precommit failure or forced audit failure rolls back account, credential and
provenance with no success event. If all writes are ready but commit transport
fails, emit uncertain with nonzero exit. Suppress raw SQL exceptions and generic
transaction rollback diagnostics for this command; a lost response cannot justify
claiming rollback. Rerun checks durable provenance and either creates after a real
rollback or reports the committed result without rotating credentials.

Command outcomes contain only deployment entry point, command name, fixed state
and correlation UUID. Expected states are created/already-created (exit 0) and
invalid-input/conflict/failed/uncertain (exit 1). A killed process may have no
outcome; absence of an outcome does not prove absence of commit.

P2-U2 receives separate canonical identity/authority ports, private verifier ports,
monotonic status/version rules and the secure initial operator foundation. Redis
sessions, guards, cross-replica revocation and platform/staff sign-in remain P2-U2–U4.
Reset/delivery/recovery/last-admin/lifecycle policies, real production provisioning
and the Phase 2/production gates remain pending. Fixtures verify their declared
boundary only; no native-device or two-replica authentication is inferred.
