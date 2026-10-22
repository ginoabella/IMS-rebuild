# P3-U3a current installer-route review and bootstrap handoff

October 22, 2026, Asia/Manila (+08:00). Owner explicitly approved the next-step
plan again and instructed continuation. That authorizes this fresh bounded
read-only review and guarded-bootstrap preparation; historical session/recovery
approvals remain consumed. **Read-only review complete; P3-U3a incomplete.**

## Retained result

Operation `9ee70f51-7deb-42c5-8693-31416618bd2c` used the documented unchanged
custodian handoff, pinned helper image, private provider network and verified TLS.
The sole session ran 13:35:30.468–13:35:31.598 Manila, **1.13 seconds**. Its policy,
username/path/display name, orphan service-token attributes, no identity policies
and 900-second explicit maximum all passed. One acknowledged self-revoke and a
subsequent 403 confirmed cleanup. Helper and temporary public CA copy were removed.
No token/accessor persisted. [Hash-bound sanitized evidence](p3-u3a-current-installer-route.json).

One batch queried **31 exact capability paths**. All four snapshot-installation
paths, rotation policy/user installation, native snapshot access and the current
custodian's own policy are denied. The custodian therefore cannot perform the
required installation directly. Endpoint/trunk policy and role mutation authority
remains as previously documented, including its indirect escalation possibilities;
no prefix-based workaround was used. Other independently held installer credentials
remain unknown, not proven absent. No alternative credential discovery occurred.

Fourteen native role bodies were read. All nine configured fields compared per
role match the candidate. Full responses were hashed, with only field names and
comparison outcomes exported. Six additional native fields remain to be reviewed:
`allowed_entity_aliases`, `explicit_max_ttl`, `name`, `path_suffix`, `period`,
`token_no_default_policy`. Fetching complete bodies does not establish acceptance
of those values or complete current identity composition.

The two readable issuer policy hashes match their historical captured pre-state
and differ from proposed constrained replacements. The custodian's own policy,
its user mapping and identity entity/group mappings are denied, so this review
cannot establish the third policy or complete authority. Do not attempt writes
on that basis. These are explicit root-bootstrap pre-state gates.

There were exactly **21 provider requests**: one login, self lookup, one capability
batch, fourteen role reads, two policy reads, self revoke and denial lookup. No
renewal, issuance, snapshot, policy/auth/role/user mutation, unseal, restart,
recovery, cleanup of retained artifacts or application/PBX action occurred.

## Preparation now available

The [generated guarded-bootstrap preparation](../planning/p3-u3a-guarded-bootstrap-preparation.json)
binds this current session to the reviewed candidate and enumerates **nine exact
provisioning writes**: three issuance-policy replacements, four snapshot identity
writes, and the separate rotation policy/user. Private password and SecretID
outputs are deliberately absent. The generator refuses changed authority, role
configuration differences, changed policy baselines, unknown cleanup or candidate
drift. It has no network access or retained executor.

The sequence uses a new operation and one guarded root generation, captures a
fresh native snapshot and independent audit, encrypts offline, uploads ciphertext
to the already initialized repository and verifies retrieval **before the first
provisioning write**. It preserves the existing custodian account, grants no routine
installer privileges to rotation, and revokes root/403 before confirming normal
TLS configuration, network, mounts, health and anonymous generation 405. A separate
post-cleanup audit and scoped post-install snapshot follow. Root never becomes a
routine backup dependency. Repository initialization is excluded.

The existing capture controller cannot be reused unchanged: it is capture-only,
hard-bound to a consumed operation, initializes a repository, revokes root before
encryption/upload, and expects no previous operation label. The retained provider
now carries the closed capture label. Implement a new operation-specific guarded
controller with explicit current-label reconciliation, an existing-repository
upload path, backup-first gating, exclusive protected output custody and fault
containment. Preserve the old controller and its evidence; do not flip its old
approval flags or treat ordering-only checks as integrated acceptance.

The [controller implementation/rehearsal checkpoint](p3-u3a-bootstrap-controller.md)
now implements the orchestration/provisioning cores and disposable adapters.

Required next preparation is completion of the retained host wiring for that exact
controller, including partial-write/lost-response handling and deadline expiry.
Then pin the new operation ID, time window, artifact hashes, fresh staging and
protected credential handoff. The next-step plan explicitly requires a separately
approved guarded bootstrap; no root execution is authorized by these generated
preparation files. Do not request execution approval while those pieces remain
unimplemented. Scheduling remains behind fresh independent decryption, isolated
joint PostgreSQL/OpenBao recovery, measured targets and confirmed alert/capacity
acceptance.

## Verification and repeatability

- `./dev exec node --test scripts/openbao/review-installer-route.test.mjs scripts/openbao/backup-bootstrap-plan.test.mjs`
- `python3 scripts/openbao/check-installer-route.py` creates a fresh disposable TLS/Raft fixture only.
- `./dev exec node scripts/openbao/backup-bootstrap-plan.mjs` emits the offline preparation JSON; it performs no provider actions.

The native TLS fixture passed **8/8 assertions**, including exact 21-request audit
order, configured role comparisons, exact policy hashes, no private output and
complete fixture/network/key cleanup:
[immutable native evidence](p3-u3a-disposable-runs/20d12a4e-acfb-4fd1-84ef-81c9002d77d1.json).
An initial disposable run stopped because the review expected read-only access on
endpoint/trunk role paths; the already approved custodian policy grants
create/read/update there. The expectation was corrected to that documented policy,
not expanded. Both fixture sessions revoked/403; no retained access occurred until
the native assertions passed.

The retained launcher used an exclusive fsynced host intent at
`.local/installer-route-review/<operation>/intent.json` before login. Source hashes,
image, credential metadata, owned-session result and cleanup are committed in the
sanitized evidence. The temporary launcher is not an installed routine command;
rerunning a session requires its own fresh scope rather than this closed intent.

Final checks: **15/15** focused review/bootstrap-plan and existing custodian/
maintenance regression tests passed; scoped ESLint, changed-file formatting,
Python syntax, local links, retained source SHA256 bindings and diff whitespace
passed. Full application suites were not rerun for this bounded deployment review;
no application runtime changed. Existing lifetime/HTTP/browser findings remain open.
