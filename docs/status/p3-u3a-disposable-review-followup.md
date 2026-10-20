# P3-U3a — Disposable investigation and maintenance rehearsal

2026-10-20 (Asia/Manila, +08:00). **P3-U3a remains incomplete. Retained execution is not authorized.**

## Authority and scope

The user's nine-point follow-up accepts the complete-array constraint as the
baseline candidate for further testing and authorizes isolated investigation,
rootless maintenance design rehearsal and non-disruptive preparation. It does not
authorize the three pre-backup writes, retained login/custody discovery, retained
policy/role/token/storage changes, restart, root recovery, SIP/PBX activation or
production deployment. No existing snapshot reader or maintenance identity was
assumed or sought in protected custody.

The same pinned OpenBao 2.7.1 image, private internal network, ephemeral TLS,
no published ports, no named volumes and tmpfs Raft fixture described in the
[original report](p3-u3a-disposable-lifetime-validation.md) were used. Newly
initialized root seeds synthetic scenarios and performs fixture janitor cleanup;
it is never recovered. The actual successful maintenance sequence uses native
human authentication, the constrained endpoint issuer and its maintenance ticket.
Fixture root setup and interrupted-fixture janitor operations are explicitly
recorded and are not proposed retained privileges.

Reproduction: `python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array`.
The command remains diagnostic and exits 1 when it observes the retained
HTTP-500 renewal and absolute-expiry assertions. This is not a clean lifecycle acceptance pass.
[Current machine evidence](p3-u3a-disposable-lifetime-evidence.json) and its
operation-specific archive retain the actual statuses and cleanup results.

## Effective permissions and inventory

The disposable tests demonstrate these results; they are not a retained inventory audit:

| Assignment or path                                                               | Excessive explicit maximum request    |
| -------------------------------------------------------------------------------- | ------------------------------------- |
| Ordinary exact issuer alone                                                      | Denied in the 14-path matrix          |
| Additional exact-path widened token policy                                       | 200; explicit maximum 172,800 seconds |
| Additional exact-path deny policy                                                | 403                                   |
| Less-specific wildcard widened policy                                            | 403 in this tested overlap            |
| Additional generic creation permission, requesting an inherited issuer policy    | 200; explicit maximum 172,800 seconds |
| Native userpass entity assigned the widened identity policy                      | 200; explicit maximum 172,800 seconds |
| Native userpass entity inheriting that policy through an internal identity group | 200; explicit maximum 172,800 seconds |

These counterexamples require privileged assignment of extra authority. They prove
that caller policies, direct entity policies, group policies and alternative token
creation paths are part of the security boundary. A single token policy is not
sufficient evidence of a single effective policy. Exact deny also does not make
arbitrary other paths safe. No immutable server-wide 24-hour ceiling is claimed.

The runtime issuance helper previously checked only the caller's token-policy
array. It now additionally refuses identity policies or a period on the caller
and returned token. A native identity with the expected sole token policy plus
an extra identity policy is refused by the actual CLI before output token/accessor
files are created. Normal exact requests remain unchanged. This is inventory
hardening, not a substitute for provider constraints or a claim that privileged
writers cannot alter the inventory. The fixed-issuer preflight still requires its
original exact policy bodies and must not be bypassed for retained deployment.

Any future execution needs an independently reviewed, exhaustive inventory of
assigned token/entity/group policies, policy bytes, auth mappings, roles, accessors,
leases and alternative issuance paths. Missing or unexpected facts stop the
operation before changes; no automatic repair or expanded custody search follows.

## Renewal HTTP 500 and acceptance

The real direct HTTPS fixture reproduces error classification `past_max_ttl` with
no `auth` response near the six-second accelerated maximum. The pinned provider's
[CalculateTTL implementation](https://github.com/openbao/openbao/blob/v2.7.1/sdk/framework/lease.go)
truncates current and starting times to seconds and returns an error when its
calculated maximum valid TTL is nonpositive. The observed error and timing match
that provider boundary behavior. The fixture uses direct requests and does not
manufacture the 500; acceleration makes this subsecond boundary easy to reach.
This supports a provider rounding/error-path explanation, not an arbitrary
24-hour timing equivalence or a claim that the HTTP status has been fixed.

The [first completed timestamp probe](p3-u3a-disposable-runs/e9f4682b-02fc-4fb2-88c6-614e0c795c0f.json)
found an additional **failed absolute-expiry assertion**.
The original issue time was `2026-10-19T23:51:49.128278085Z`, so its six-second
boundary was `23:51:55.128278085Z`. Successful renewals produced reported expiry
up to **836 ms later**. At 6,136 ms elapsed the 500 left the previous expiry
`23:51:55.641066846Z` unchanged and lookup still returned 200; the next probe at
6,762 ms returned 403. The observed failed renewal did not extend the stored
expiry, but a prior successful renewal had already allowed a subsecond overrun.
Nine lookup observations retain positive overrun failures, including the unchanged
expiry after the 500. This is consistent with second-granularity TTL calculation;
it is not proof that all versions or real 24-hour tokens have the same bound.
The six-second boundary assertion remains failed, and no immutable precise
24-hour ceiling or immediate revocation at failed renewal is claimed. There was
no elapsed 24-hour soak.

Both adapters are tested through a local TLS fault server against 500, 403,
missing `auth`, invalid/zero/short/excessive/fractional/string lease values,
nonrenewability and a dropped response. Each rejects renewal. The endpoint adapter
now validates a renewable integral lease of 60–3600 seconds before accepting
renewal, matching the existing trunk adapter's conservative threshold. Its worker
advances its renewal schedule only after awaited success. These local fault tests
prove client handling; actual provider expiry remains the separate real fixture
measurement. No failed or uncertain response is treated as a renewed credential.
The HTTP 500 and subsecond absolute-expiry overrun remain visible failing
assertions pending separate acceptance or remediation.

## Endpoint concurrency and immutable generations

The cause is the unchanged **create/read-only worker ACL**: writing an existing
KV-v2 path requires update authority, even with CAS zero. A losing concurrent
create can therefore receive 403 before a normal CAS-conflict response. A direct
POST to an existing generation reproduces 403. Giving workers update permission
would undermine immutability and was not done.

`prepare` now reconciles only a write's access-denied result through an independent
exact-generation read. It succeeds only if version 1, all ownership fields,
generation ID, material grammar and nondestroyed state verify. A missing,
inaccessible, mismatched or destroyed generation still fails. No token/policy
change, overwrite or second material version is used to resolve the race.

The real-provider probe repeats 20 rounds with four concurrent prepares, exact
replays and content-digest/version comparisons, mismatched-generation rejection,
prepare versus two concurrent cleanups, exact cleanup retry, destruction
verification and failed recreation. It retains the actual intermediate cleanup
errors; cleanup can lose a read/destroy race and must reconcile/retry rather than
claim unconditional first-attempt success. Every final metadata record must show
only version 1 destroyed. Cross-installation, overwrite/destroy/create denials
and the existing trunk regression are preserved. This is adapter evidence;
canonical owner SQL/Redis/two-HTTP acceptance remains outstanding.

## Exact rootless manifest and backup authority

The [rehearsed manifest](../planning/p3-u3a-rootless-maintenance-rehearsal-manifest.json)
contains the exact fixture operation, ticket role/request, snapshot-only policy,
issuer append, final maintenance policy, three original hashes, expected
bootstrap-augmented endpoint hash, exact final hashes and base64 request bodies.
Its fixture operation ID is evidence, not a reserved retained operation. A future
retained manifest needs a new operation and fresh, authorized inventory.

The ordinary human performs exactly three pre-backup configuration writes:
create the operation's snapshot policy, create its role, and append one constrained
creation path to the endpoint issuer. The five request fields are mandatory;
only the exact sole policy, `300s` TTL and explicit maximum, default suppression
and nonrenewability are accepted. Eight tested parameter variations reject.
The resulting orphan token has one policy, no identity policies, no period,
no renewal and a 300-second explicit maximum. These three writes remain an
unapproved privilege exception; successful disposable tests do not authorize them.

Before elevation the ticket can obtain the native Raft snapshot and perform
self lookup/revocation. It cannot restore a snapshot, create tokens, edit policies,
access material, change mounts or revoke other tokens. The archive passes existing
bounded gzip/tar, metadata and member-checksum validation; truncated archive
injection rejects. Archive validation does not prove seal-key availability or
restorability. A separate synthetic audit capture is rehearsed: owner-only exclusive tmpfs
files are synced, hashed and read back; complete-record byte boundaries and
unchanged prefixes are checked while later audit appends are copied separately.
The actual copy verifier rejects a corrupted saved audit copy; truncated snapshot,
existing destination and unavailable storage injections also reject. This proves
the fixture mechanism, not retained durable storage or retained audit capture.

After the snapshot gate, the human replaces the operation policy with exact
maintenance authority. Writes use `sys/policies/acl/<three exact names>` and require
one exact base64-encoded policy body. Base64 has no glob metacharacter; provider
readback must match decoded bytes and SHA-256. Raw HCL exact-body and one internal
wildcard substitution were also tested: the exact body succeeded, the substitution
was denied. No raw-body wildcard bypass is claimed from that probe.

Read authority uses the three exact native `sys/policy/<name>` aliases. This is
necessary because `required_parameters = ["policy"]` on the constrained modern
write paths would also block a parameterless read. The ticket itself reads and
checks the exact pre-write body hash, writes the approved encoding and verifies
readback. For endpoint, the immediate pre-write hash includes the reviewed
bootstrap grant; the original baseline is separately checked before bootstrap.
The other two hashes remain the original approved baselines. Final endpoint
replacement removes the temporary issuance path, including for already-issued
endpoint issuer tokens.

Cleanup authority permits deletion only of the operation's role and policy.
Concurrent role deletion returns 204 twice. Policy deletion removes the ticket's
own lookup/revoke permissions, so the fresh native human revokes the exact saved
accessor and verifies accessor lookup failure. A 403 lookup after deleting a policy
alone is never sufficient evidence of token revocation. Generic issuance, role
changes, unrelated policy changes, material access, snapshot restore and arbitrary
accessor revocation remain denied to the maintenance ticket.

Preferred backup route remains an existing independently authorized snapshot
reader plus narrowly scoped maintainer, made available by the owner. Their
existence has not been checked. If unavailable, strict backup-before-any-change
rules make bootstrap unavailable until the user approves that exact exception.
Native snapshot capability also exposes the entire encrypted provider snapshot;
backup custody, seal material and separately preserved audit require independent
protection. No seal material belongs with the snapshot or application mounts.

## Interruption, expiration and restoration

Fault injection stops after each of 12 real checkpoints: policy creation, role
creation, grant addition, ticket issuance, verified native snapshot, separate audit verification, elevation,
each of the three target writes, role deletion and policy deletion. Containment
restores only the known issuer body, prevents reminting and revokes each known
ticket by accessor. Neither a native snapshot alone nor an audit copy alone permits elevation.
Pre-backup failures have zero hardening writes and no elevation.
Inert objects left after interruption are explicitly recorded; fixture root is
used only as a janitor afterward. That janitor is not a rootless retained cleanup
proof. An interrupted retained attempt stops for review rather than automatically
minting a new ticket, elevating before backup or rolling back a partial hardening.
A separate one-second nonrenewable fixture rejects renewal and snapshot reads
after expiry; a full elapsed 300-second ticket soak was not performed.

The following restoration procedure is a proposal for separately authorized work:

1. On a mismatch, expired authority, uncertain write or failed backup, stop and
   preserve exact intent/accessor metadata and audit. Remove the known temporary
   issuance grant with existing authorized human authority where available; revoke
   known tickets and verify their accessors. Do not revoke ordinary leases.
2. Determine actual current bytes through separately authorized reads. Record
   each target as original, reviewed intermediate or final; an unrecognized value
   prohibits automated continuation. A failed acknowledgment is not proof of no write.
3. Prefer completing a reviewed partial hardening after fresh authority and a
   valid backup over automatic policy rollback. Reverting exact prior bodies
   reintroduces the lifetime weakness and needs separate review and approval.
4. Full Raft restoration is a separate disruptive operation. Preserve original
   storage/configuration/audit, restore first into an isolated matching provider,
   prove separately held seal/TLS prerequisites and decryption, compare identities,
   policies, accessors and leases, and obtain an explicit cutover plan. No root
   generation, retained restore or original-volume destruction is implicit.
5. A snapshot can revive temporary tickets or previously revoked authority.
   Reconcile/revoke exact revived accessors, preserve post-backup audit and verify
   installation isolation and leases before separately approved resumed service.

## Verification and final prerequisites

Final operation `99feb613-a70f-4809-8396-afedd5d45666` ran
`2026-10-19T23:57:14.810Z`–`2026-10-19T23:57:43.770Z` (UTC; 2026-10-20 in Asia/Manila). It completed all scenarios and exited 1 for the reproduced HTTP 500. The final
run did not reproduce a positive expiry overrun; the prior timestamp operations
retain that failure (up to 836 ms), which remains unresolved. All 14 positive requests and 434 negative requests passed;
10 hardened issuance-helper cases, 20 four-caller endpoint race rounds, the
unchanged trunk provider regression, native snapshot/exact-body maintenance,
12 interruption checkpoints and accelerated ticket expiry completed. Existing
endpoint and trunk token expiry/maxima/policies and 24 non-target material-policy
or role records were verified unchanged across the rootless policy transition. The worker
accounted for 58 revoked and 18 already-expired tokens, with zero known tokens
remaining; the trunk subprocess independently cleans its four children. Both
owned containers, private network and temporary TLS/audit directory were removed.
The final machine evidence is authoritative for counts, operation identity,
responses and teardown. Focused preparation checks pass 18/18, including the
expanded HTTPS renewal faults. Focused ESLint and Python syntax checks passed; final formatting/link/whitespace
review passed for changed source/artifacts; all local links in the affected
reports, contracts, runbook, spec and tracker resolve, and `git diff --check` passes. Intermediate failed fixture runs are
retained in the operation archive; their setup/assertion corrections are not
silently represented as clean passes.

Full `./dev check`, retained endpoint SQL/Redis/HTTP integration, real retained
trunk import/ACL qualification and owner/binding two-replica acceptance were not
run. These are still required for their respective acceptance boundaries. No
retained credentials, provider/storage changes, restart/recovery, SIP activation
or deployment occurred in this investigation.

Before any separate execution request: resolve the known 500 and subsecond absolute-expiry acceptance questions;
review effective policy composition and the helper/client changes; provide an
existing authorized backup/maintenance route or explicitly approve the three-write
exception; refresh and approve exact policy/identity/role/accessor/lease inventory;
validate protected backup capacity, native snapshot and independent audit capture;
prove seal/TLS and isolated restoration prerequisites; approve the exact operation,
interruption/inert-object handling and accessor cleanup; and schedule outstanding
retained/full integration checks under explicit authority. Until then, retained
remediation and P3-U3a completion remain blocked.
