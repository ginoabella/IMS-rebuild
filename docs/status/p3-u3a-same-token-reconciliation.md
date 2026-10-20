# P3-U3a — Experimental bounded same-token reconciliation

Checkpoint: 2026-10-20 (Asia/Manila, +08:00), within approved local checkpoint 1.
The candidate remains investigation-only, with no production or retained helper
imports and no runtime activation. This is not completion of checkpoint 1 or P3-U3a.

The existing deadline candidate now distinguishes a recoverable uncertain renewal
from terminal identity, clock, expiry or revocation failure. Failed/lost/malformed
renewal pauses consumption. A separate bounded self-lookup of the same token may
resume consumption only after validating the original accessor, issuance time,
creation time, exact policy, no identity policies/period, service lease attributes
and original configured maximum. Lookup requires the previous conservative lease
and original absolute deadline still to be valid before and after I/O. It cannot
resurrect expired authority. HTTP 403/404, changed identity, invalid attributes,
clock failure and expired authority are terminal.

The candidate permits two lookup attempts over its lifetime by default (the
experimental configuration refuses more than three), bounds each I/O request,
passes an abort signal, excludes concurrent reconciliation, and discards late
results. Another renewal failure during lookup invalidates that lookup's result.
An uncertain or failed lookup leaves consumption paused and cannot alter either
deadline. A successful lookup is capped by both reported expiry and observed TTL,
with the existing proposed clock/safety margins; the original absolute bound never
moves. No issuance, renewal, credential search, token swap or replacement occurs in
the reconciliation method. The trusted test composition supplies a lookup closure
bound to the existing token; independent identity checks reject a different token.

Verification:

- `./dev exec node --test scripts/openbao/authorization-deadline.test.mjs scripts/openbao/authorization-reconciliation.test.mjs`:
  exit 0, 15 test groups. Covers normal renewal and bounded skew, original origin,
  lost/500 renewal and lookup, malformed/revoked/overlapping/periodic/wrong identity,
  two-attempt exhaustion, expiry during lookup, clock loss, concurrent lookup,
  superseding failure, late timeout completion, shorter observed lease and
  reconciliation near the original maximum after normal renewals.
- Scoped Docker-workspace ESLint and Prettier passed; whitespace check passed.
- `python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array --review-deadline`:
  [sanitized immutable run](p3-u3a-disposable-runs/1d71a4dd-4e17-4e1d-aa55-cf7680fcf453.json).
  The fresh pinned OpenBao 2.7.1 fixture performs a real renewal, deliberately
  discards its acknowledgement, pauses admission and then reconciles through a
  separate real self-lookup of the same token. Reconciliation and deadline probe
  passed: 18 admitted operations, ten denials, first denial at 5,091 ms against
  the six-second scaled maximum. No operation was admitted beyond the maximum.
  All 14 issuance positives/434 negatives, ten normal helper cases, maintenance
  rehearsals and provider regressions also completed.
- Overall disposable suite remains exit 1: native near-expiry HTTP 500 and a
  49 ms successful-renewal expiry overrun were preserved as acceptance failures.
  Application admission evidence does not turn these assertions into passes.
- Cleanup verified: 58 known tokens revoked, 19 already expired, zero known
  remaining; exact fixture containers, internal network and temporary TLS/audit
  directory removed; zero named volumes created. Trunk regression accounts for
  its own children separately.

An additional disposable native-name probe is preserved in
[run e31d6ef7-ce65-4095-8c2b-58d926c34040](p3-u3a-disposable-runs/e31d6ef7-ce65-4095-8c2b-58d926c34040.json).
For the fresh fixture's custom `platform-custodian` userpass mount and synthetic
named custodian, `customMountPrefixMatches` is true and
`defaultUserpassPrefixMatches` is false. This demonstrates native custom-mount
prefixing and identifies the default `userpass-` prefix assumption as incorrect
for that fixture. No raw display-name field or retained identity was inspected or
emitted by this probe. It does not retroactively verify retained session identity
or authorize another retained login.

The repeated same-token reconciliation/deadline probe passed with 21 admitted
operations, eight denials and first denial at 5,735 ms, before the six-second
maximum. All 14 positives/434 negatives and ten normal helper cases completed.
The overall run remains exit 1, preserving native HTTP 500 and 34–642 ms expiry
overruns. Cleanup again verified 58 revoked, 19 already expired, zero known
remaining and exact fixture teardown. Both immutable run artifacts retain their
original failure results; the convenience latest-evidence JSON points to this
second run. No required native failure was suppressed or reclassified.

Clock bounds, restart trust, immutable-origin persistence, composition/token
binding, process ownership and business transaction acceptance remain unaccepted
for runtime use. No 24-hour soak, real deployment clock guarantee or current
canonical business finalization is claimed. Pre-maximum replacement, restart-safe
state, canonical owner/grants/API integration and the conditional transaction
timing acceptance remain outstanding. No retained access or backup/maintenance
implementation occurred in this checkpoint.
