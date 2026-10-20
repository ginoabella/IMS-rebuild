# P3-U3a — Local complete-array helper alignment

Checkpoint: 2026-10-20 (Asia/Manila, +08:00). Authorized local checkpoint 1
under the [approved completion direction](../planning/p3-u3a-approved-completion-direction.md).
This checkpoint completes policy-generation/preflight alignment only; P3-U3a and
the remaining lifecycle-helper work are incomplete.

The pure provisioning and custodian plans now share exact-request HCL generation.
Every issuance rule requires all five reviewed parameters, permits only their
exact values, and wraps the entire policy array as an allowed value. Generated
endpoint, trunk and fixed-issuer maintenance policy bytes equal all three reviewed
complete-array candidate bodies. Runtime requests, initial one-hour leases,
configured 86,400-second maxima, acceptance-only one-second roles and role
configuration remain unchanged.

The existing exact-body preflight consumes these generated plans without a
comparison exception. New coverage accepts the complete candidate/readback plus
fixed issuer roles, verifies only reads occur, and rejects scalar policy
constraints, a 48-hour maximum and even whitespace body differences. Existing
preflight rejection of unexpected grants, role fields and unavailable reads stays
intact. Retained policy readback still needs separately approved remediation;
the unchanged retained bodies are expected to fail this candidate preflight.

Disposable validation also verifies generated policy bodies against the reviewed
candidate before fixture installation. Historical original-to-candidate maintenance
rehearsal reconstructs only the original unconstrained issuance blocks inside the
fresh disposable fixture and verifies each immutable historical SHA before writes.
Historical manifests and retained provider policies were not changed.

Verification:

- `./dev exec pnpm check:trunk-preparation`: exit 0; backend/config/contracts
  build and 19 tests passed, including HTTPS adapter and exact-body regressions.
- Docker-workspace Prettier check and scoped ESLint: passed. `git diff --check`:
  passed.
- `python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array`:
  completed, exit 1 because the existing native expiry assertions still fail.
  [Immutable sanitized run](p3-u3a-disposable-runs/2dedf0ac-add6-47e7-8dfe-45e8ef659cf2.json).
  All 14 normal issuance paths passed; all 434 negative requests were denied;
  ten runtime helper cases, native human/fixed issuers, effective identity-policy
  rejection, generic/overlap diagnostics, 20 four-caller endpoint rounds,
  immutable material and trunk regression, backup and maintenance/interruption
  rehearsals completed. Privileged policy composition still demonstrates widening;
  no immutable ceiling against separately privileged authority is claimed.
- Native failures preserved: successful scaled renewals reported expiry
  60, 220 and 290 ms beyond the six-second boundary; near-maximum renewal
  returned HTTP 500. These are acceptance failures, not repaired by policy alignment.
- Cleanup: 58 known tokens revoked, 18 already expired, zero known tokens
  remaining; both exact fixture containers, internal network and temporary
  TLS/audit directory removed; zero named volumes created. The trunk regression
  separately verifies its owned child revocation.

No retained credential, custody, provider, policy, role or token was accessed or
changed by this local checkpoint. No runtime activation of the deadline or timing
amendment occurred. Bounded same-token reconciliation, controlled replacement,
canonical owner/grants/workers, database/HTTP integration and retained security
acceptance remain outstanding. The full default graph was not rerun for this
focused checkpoint; the documented browser failure remains unresolved.
