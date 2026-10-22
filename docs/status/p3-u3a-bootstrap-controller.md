# P3-U3a guarded bootstrap controller rehearsal

October 22, 2026, Asia/Manila (+08:00). Owner instructed continuation of controller
implementation and rehearsal. This checkpoint adds an inactive controller core
and provisioning core, exercised with disposable services. **No retained root,
provider mutation, restart, credential read, repository operation or activation.**
P3-U3a remains incomplete.

## Implemented behavior

[Controller core](../../scripts/backup-host/bootstrap-controller.py) sequences
exclusive preparation, independent deadline, isolation/unseal, one root recovery,
pre-state review, native capture, offline encryption, existing-repository upload
and read-only ciphertext retrieval before installation. Its gate checks operation,
repository, snapshot ID, separate capture/audit receipt bindings, exact lengths and
retrieved hashes, zero prior provisioning writes and a maximum 900-second age.
It rechecks elapsed freshness immediately before calling the installer.

An exception after recovery always invokes the same-operation finisher. Successful
revocation permits normal TLS/configuration/network restoration and confirmed
health/anonymous-generation 405 before guard cancellation. An uncertain finisher
or restoration instead requests containment and leaves the guard active. Partial
installation does not replay, roll back or generate another root. A separate
post-cleanup audit runs after restored protection, and successful installation
continues with scoped snapshot capture.

The controller also validates the prior closed operation label against recorded
revocation/restoration/guard closure and exact current provider name, image,
mounts, network, restart policy and hardening. Its exclusive fsynced journal stores
safe event/index metadata and refuses reuse of an operation directory.

[Provisioning core](../../scripts/openbao/bootstrap-provision.mjs) accepts only the
nine exact reviewed write paths, a matching plan digest, explicit pre-state review
and root self-identity. It rechecks status and SHA256 of each pinned pre-state
response's data, excluding changing request-envelope IDs. A failed pre-state read
prevents writes. Before every write it invokes the freshness adapter and persists
a before-send marker; successful acknowledgment is separate. SecretID/accessor
output goes only to a protected-storage adapter. The ninth request receives a
separately generated protected password. Neither password nor provider responses
are returned as a host result.

These are reusable orchestration/provisioning components, not a retained launcher.
The only wired adapters in this checkpoint are explicitly marked disposable-only.
The fixture's reviewed pre-state uses synthetic unconstrained issuer policies,
full synthetic role responses and empty identity entity/group inventories; it is
not acceptance of the retained mappings, aliases or policy pre-state. Do not feed
the fixture adapter retained custody or change its `fixtureOnly` binding.

## Real and injected verification boundaries

The native harness creates unique private networks, volumes, TLS, seal custody,
Restic credentials and an append-only TLS Rest Server. It initializes its own
empty repository during fixture setup, before controller execution. The controller
then starts from that existing repository. Helpers verifying OpenBao use the
`endpoint-secrets` SAN; the host's initial synthetic bootstrap uses the fixture
CA with IP hostname comparison disabled, as in the earlier controller fixture.

Successful native execution exercises actual Compose isolation/replacement,
unseal/root generation, capture helpers, offline age packaging, ciphertext-only
fixture handoff, Restic upload/retrieval, exact provisioning core, maintenance
login/denials/policy readback/revocation, root revoke/403, protected restoration,
restart policy and scoped post-install snapshot. The fixture copies only ciphertext
between its temporary custody domains; the descriptor-anchored retained handoff
adapter is not installed by this rehearsal.

The partial-write run injects response loss **after a native POST has committed**.
This is controlled response loss, not a naturally occurring network outage.
Before-send/acknowledgment records preserve the uncertain write index; no subsequent
write or scoped post-install capture may run. Native cleanup and restoration still
run. Unit fault tests additionally cover every one of the nine lost/rejected write
positions, failed journal persistence, failed credential custody, stale/mismatched
backup proof, changed pre-state, failed root cleanup/restoration and refused replay.

The existing independent deadline acceptance uses separate network-none disposable
containers: actual timeout, launcher SIGKILL, watcher SIGTERM, dead/zombie watcher
readiness rejection, unavailable Docker uncertainty and duplicate-target refusal.
It proves the guard's containment behavior independently; it does not simulate
all those failures during the complete OpenBao installation flow.

## Verified results

- Current-source success run: **9/9** native assertions passed, including actual
  unconstrained-to-constrained synthetic policy replacement, backup-before-write
  execution and scoped post-install capture. [Immutable evidence](p3-u3a-disposable-runs/59b1b7e4-8b4a-471d-9c98-be2a114584ee.json),
  [current evidence](p3-u3a-bootstrap-controller-evidence.json).
- Current-source fault run: **8/8** native assertions passed. Response loss was
  injected after write index 4 (backup auth mount creation) committed. Five writes
  started, four were acknowledged; no sixth write or scoped post-install capture
  ran. Root revoke/403, protected restoration and complete cleanup passed.
  [Immutable evidence](p3-u3a-disposable-runs/3c4fd506-cdd0-4daf-8fe4-4bed8a9660dc.json),
  [current fault evidence](p3-u3a-bootstrap-controller-fault-evidence.json).
- **7/7** controller/proof/journal unit groups and **4/4** provisioning fault
  groups passed (including all nine ambiguous/rejected write positions). Existing
  development-capture controller tests remain separate regression checks.
- Independent native deadline acceptance passed all six behavior groups plus exact
  cleanup; no retained provider target was used.

Earlier disposable attempts are preserved: one rejected an unsupported auth-mount
GET, one hit an incorrectly mounted verifier import, and the first lost-response
run restored protection successfully but its fixture-only output inspection used
the wrong host UID. These fixture issues were corrected; each attempt removed its
exact services, volumes, networks, private fixture and watcher. No retained access
was involved. Current native evidence binds controller, provisioner, fixture adapter
and harness SHA256. No source was changed during the current-source final runs.

## Later host-wiring checkpoint

The [completed shared host wiring and post-install backup verification](p3-u3a-bootstrap-host-wiring.md)
now supersedes the implementation-pending items below. The [concrete execution
request](../planning/p3-u3a-bootstrap-execution-request.md) remains disabled pending
its separate approval and fresh staging. Earlier core-only evidence stays historical.

## Commands and remaining installation work

```sh
python3 scripts/backup-host/bootstrap-controller.test.py
./dev exec node --test scripts/openbao/bootstrap-provision.test.mjs
python3 scripts/backup-evaluation/check-bootstrap-controller.py
python3 scripts/backup-evaluation/check-bootstrap-controller.py --lost-response-after-write 4
node scripts/openbao/check-recovery-deadline.mjs
```

The integrated fixtures are synthetic only. Each run removes its exact containers,
networks, named volumes, private keys/credentials and detached watcher; immutable
per-operation evidence is under `p3-u3a-disposable-runs`.

Before requesting retained execution approval, finish the operation-specific host
adapters/manifest and current-source hashes, fresh staging and password/SecretID
handoff, semantic review of retained identity composition/role aliases, retained
pre-state pinning, and per-write guard-health/freshness wiring. The native fixture
checks elapsed backup/guard deadlines per write; it does not provide the retained
host guard-health bridge. Post-cleanup audit encryption and scoped snapshot capture
are exercised; encrypted post-install snapshot/audit upload and retrieval remain
to be wired as the final host stage. Do not treat the pre-change upload proof as
that post-install proof.

There is no retained executable command or new execution authorization in this
checkpoint. The old capture controller and consumed approvals remain untouched.
Do not reinitialize the retained repository. Scheduling still requires fresh
independent decryption, isolated joint PostgreSQL/OpenBao recovery, measured targets,
alerts and capacity acceptance. Existing token renewal/expiry, HTTP/browser and
trunk/gateway acceptance findings remain open.

Final regression checks: **19/19** Node review/provisioning/custodian groups,
**7/7** new controller groups and **5/5** existing capture-controller groups passed.
Scoped ESLint/Prettier, Python syntax, local links, all final native source hashes
and diff whitespace passed. Generated test bytecode was removed. Full application
suites were not rerun for these inactive deployment components; no application or
retained service graph changed. The previously recorded full-graph formatting
limitation remains separate.
