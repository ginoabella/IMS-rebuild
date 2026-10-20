# P3-U3a — Security acceptance rationale and authorization-deadline investigation

2026-10-20 (Asia/Manila, +08:00). **Security acceptance and P3-U3a remain incomplete.**
The user's latest review accepts prior disposable design evidence and the
create/read-only reconciliation approach for continued development. It authorizes
investigation and permitted non-disruptive verification, not retained execution.
The separate [retained failure/authorization proposal](../planning/p3-u3a-retained-failure-and-authorization-review.md)
and [exact authorization draft](../planning/p3-u3a-retained-maintenance-authorization-draft.json)
are not execution approvals.

## Acceptance rationale by boundary

| Boundary                        | Supported result                                                                                                                                                   | Remaining condition                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Provider issuance               | Exact complete-array constraints pass all 14 approved paths/434 negative requests in pinned disposable 2.7.1                                                       | Retained policies are not remediated; provider constraints and explicit maximum remain mandatory                         |
| Effective authority             | Token, direct entity and group policies and generic issuance paths can widen authority; strict runtime issuer inventory now rejects extra identity policies/period | Independently authorized complete current retained inventory is unavailable; no immutable server-wide ceiling is claimed |
| Endpoint generation concurrency | Create-only 403 is reconciled only by exact immutable version-1 ownership/material read; worker update privilege stays absent                                      | Retained owner/API regression and real trunk owner/binding integration remain outstanding                                |
| Renewal client behavior         | 500/403/malformed/lost replies do not count as successful renewal; existing adapter validation rejects them                                                        | Real HTTP 500 remains a failing provider acceptance assertion                                                            |
| Absolute provider expiration    | Accelerated native expiry is measured, including an intermittent reported overrun up to 836 ms                                                                     | Not an elapsed 24-hour soak, precise wall-time ceiling or resolved defect                                                |
| Application deadline candidate  | Original issuance, conservative clock margin, immutable absolute deadline and pre/post operation checks are investigated below                                     | Test-only prototype, no runtime/finalization composition, trusted deployed clock bound or product margin approval        |
| Rootless maintenance/backup     | Native snapshot plus separate audit capture, exact-body updates and bounded interruption handling pass disposable rehearsal                                        | No retained execution, pre-backup exception, durable/decryptable backup or automatic cleanup guarantee                   |

Accepted design evidence does not turn these outstanding integration/security
conditions into passes. Application restrictions complement provider enforcement;
they cannot grant missing maintenance authority or repair a retained policy.

## Renewal 500: reproducibility and operational impact

Reproduce with `python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array`
or the separately recorded `--review-deadline` investigation. Both initialize only
fresh isolated fixtures. A six-second absolute / two-second initial token is
renewed directly every 600 ms with a large requested increment. Near the boundary,
the provider can return HTTP 500 with `past_max_ttl`, no `auth`, then eventually 403. The underlying failing assertion remains in every operation that observes
it; the diagnostic command still exits 1. Scheduling/alignment affects exact
responses and whether a reported fractional overrun appears. The accepted
[original follow-up](p3-u3a-disposable-review-followup.md) preserves timestamp
counterexamples and operation archives. A later run without overrun does not
invalidate an earlier counterexample. No retained provider probe was performed.

Operationally, a 500 is a renewal failure, not a normal successful denial and not
immediate token revocation. A lookup can briefly remain live at the old expiry;
the measured failed renewal did not change it. Existing clients reject the 500.
Consumption must pause on failure/uncertainty and keep original work intent;
no fresh generation, accepted credential or extended local lease may be inferred.
Repeated failure can require trusted reprovisioning. Native provider behavior,
its availability impact and the elapsed-lifetime limitation remain open acceptance
items; this investigation does not patch, upgrade or relabel the provider.

## Conservative application deadline candidate

The executable [candidate](../../scripts/openbao/authorization-deadline-candidate.mjs)
and [tests](../../scripts/openbao/authorization-deadline.test.mjs) live under
`scripts/openbao`, with no production entrypoint imports. This prototype targets renewable runtime
provider consumers; its constructor deliberately rejects nonrenewable fixed issuers
and maintenance tickets. Those identities need their own reviewed timing controls.
They use validated
provider self-lookup metadata and fixed trusted test settings:

`absolute = floor(original issuance epoch to seconds) + approved maximum - skew bound - safety margin`

`current lease = provider expire_time - skew bound - safety margin`

`accept only while max(current wall time, initial wall time + monotonic elapsed) < min(absolute, current lease)`

The candidate numeric **proposal**, not approved operational configuration, is
86,400 seconds maximum, a two-second bound on consumer/provider clock offset,
three additional seconds of safety and a five-second request budget. Subtracting
five seconds and flooring the original issue time avoids relying on subsecond
provider rounding. The origin is taken from `creation_time` and checked against
`issue_time`; it is not login/lookup/renewal/process-start time. Renewals can extend
only the current lease, never the immutable absolute bound. Restart requires
fresh validated metadata for the same token and retains its original origin.
The exact approved policy name must be supplied by trusted composition. Unexpected
explicit maximum, extra policy, identity policy, period, orphan/renewable attributes,
changed accessor/origin/policy or malformed timestamps fail closed.

The monotonic anchor prevents a local backwards wall change from extending an
already established interval. Forward/backward divergence over 250 ms, monotonic
regression and loss of clock-health attestation pause the candidate. A wall-time
jump caused by suspension also fails the modeled check. These are injected clock
models; no universal guarantee about host suspend/clock behavior or deployed
clock synchronization is inferred. A boolean `healthy` supplied by a fixture is
not real attestation. Deployment needs an independently trusted, fresh bound on
clock offset/drift and a recovery policy for clock-health loss. Unknown/unbounded
clock skew cannot be made safe by choosing an arbitrary margin.

With a continuously valid ±2-second offset bound, five-second subtraction and
less than one second of origin flooring, the admission/finalization cutoff is
roughly 3–8 seconds early. Reserving a full five-second operation budget stops
starting such requests roughly 8–13 seconds early. This is a small predictable
loss at a 24-hour boundary, rather than a new 24-hour budget on each renewal.
Tests also retain the ordinary one-hour lease and 20-minute renewal cadence.
This calculation is conditional on the stated bounds; it is not a measured
production SLA or a guarantee against an untrusted provider clock. These bounds
describe the computed deadline: a renewal attempted with fewer than 60 seconds
of native lease can also fail the existing conservative minimum-lease check and
pause earlier, especially on restart/late renewal. That availability impact must
be reviewed along with the clock margin rather than hidden in the five-second
calculation.

Pre-admission rejects insufficient remaining budget without starting external
work. Requests receive cancellation and an absolute bounded timer; completion is
rechecked so a late response or blocked event loop cannot be accepted after the
candidate deadline. Cancellation does not undo a remote side effect. Durable exact
intent/generation reconciliation remains necessary. A real integration must check
at consumer admission, after provider response and at canonical owner transaction
finalization, with a deadline enforceable through commit/uncertain acknowledgment.
An adapter-only preflight cannot prove no late database finalization. This owner
and transaction integration is not implemented or claimed by the prototype.

Failed, lost or malformed renewal latches the prototype paused: it cannot infer
new authority from a 500 or an old successful lookup. This deliberately favors
safety. Healthy-clock, timely-renewal simulations do not show premature failures,
but a transient mid-lease error or clock anomaly will pause otherwise live work.
Before production, approve and test bounded same-identity reconciliation or trusted
reprovisioning, without clearing/advancing the original deadline. No automatic
paused-state reset is implemented. The 250 ms divergence cutoff is itself
unvalidated operational configuration: the clock tests show that a one-second
correction can pause work even while still inside the proposed two-second offset
bound. Fixed-offset simulations also do not qualify 24-hour drift/slew. This is
an explicit remaining availability limitation, not evidence that avoidable service
failures have been eliminated. Thus the investigation establishes conditional
safety and ordinary-cadence availability, not absence of all avoidable outages.

The boundary is MyIMS consumption of its provider credential. It does not revoke
the raw OpenBao token, impose a global provider ceiling, erase stored SIP material,
expire desired bindings or alter staff/browser sessions. Direct use outside the
protected consumer bypasses the candidate, so process isolation and effective
provider policy inventory remain mandatory. No SIP/PBX activation was attempted.

## Verification scope and remaining approvals

The complete default `./dev check` graph was read before execution. Its default
session selection uses disposable Redis/database fixtures and desired PBX registry
checks; endpoint/provider and PBX observation/registration selections require
explicit flags. Imported launcher modules do not execute those privileged paths
in the default graph. No provider-specific flag was supplied. The graph includes
workspace lint/format/typecheck/build/config/entrypoint checks, foundation and
durability, storage/reference/client checks, isolated storage deployment, and
default shared session/auth/credential/draft/browser/desired-registry regressions.
The final command results and distinct extra checks are recorded below.

Retained endpoint credentials/lifecycle integration (`--credentials` and
`--inventory-browser`), real retained trunk issuance/import/qualification,
PBX observation/registration tests, provider recovery/restart/restore, identity
custody discovery and new owner/binding SQL/Redis/two-HTTP completion are excluded
or outstanding. They must not be described as covered by the default graph or a
six-second prototype. Separately approved ordinary shared-service fixture tests
do not authorize access to retained OpenBao.

Security acceptance still needs a disposition for 500/precise-expiry behavior,
reviewed deployment clock bounds and deadline/finalization integration, compatible
strict fixed-issuer helper, independently authorized current effective inventory,
retained remediation and required real integration. The owner must establish
whether an existing backup/maintenance mechanism is available before the exception
can be justified. A reader alone can avoid the pre-backup exception by allowing
a separately approved maintenance ticket to be created entirely after backup;
an existing maintainer is not also necessary for that alternative. The failure plan identifies inert/partial states requiring
manual review without fixture root. None of these prerequisites authorizes
retained execution merely by being documented.

## Completed investigation checks

- `./dev exec node --test scripts/openbao/authorization-deadline.test.mjs` and the
  five existing preparation test files: **26/26 pass**, including eight deadline
  groups and the 18 preparation checks. The model tests cover 41 offsets from
  −2,000 to +2,000 ms, normal 20-minute renewal, restart/short lease, clock faults,
  policy/identity mismatch, failed renewal, late results and request cancellation.
- `python3 scripts/openbao/check-token-lifetime-hardening.py --candidate array --review-deadline`:
  operation `50e2eb4c-965c-4e29-ae7d-6928b650cd66`, 2026-10-20
  `00:15:47.948Z`–`00:16:34.227Z` (UTC). The separate
  [machine evidence](p3-u3a-disposable-deadline-evidence.json) records a passed
  deadline probe: 20 guarded admissions/renewals, first denial at 5,605 ms against
  six seconds; provider lookup still 200 at 6,121 ms while application admission
  was denied. The guarded callback is an admission/completion probe, not a
  canonical owner transaction or credential import. The normal raw probe preserved eight positive-overrun observations
  (up to 669 ms) and one HTTP 500. **Overall diagnostic exit 1**, as required;
  neither native failure is relabeled a successful denial.
- The same disposable run repeated all 14 issuance positives/434 negatives, ten
  ordinary helper cases, 20 concurrency rounds, unchanged trunk provider checks,
  snapshot/audit and interruption scenarios. It accounted for 58 revoked and
  19 already-expired known tokens, zero remaining; its trunk subprocess accounts
  for its own four children. Owned helper/provider containers, internal network
  and temporary TLS/audit storage were removed. The accepted original rehearsal
  evidence/manifest remain distinct from this experimental result.
- Pure validation of the new authorization draft checked original, augmented and
  final policy hashes, exact base64 decoding, the 300-second request/sole-policy
  role and nine planned configuration writes. No provider was contacted.

The [verification ledger](p3-u3a-nondisruptive-verification.json) records each
command separately. All **12 shared UI checks passed**, exit 0. The complete
default graph exited 1 as detailed below; a complete default session-stage rerun
subsequently passed, exit 0. This composite evidence is not a clean full-pipeline
pass. The separate desired inventory A-01–07 regression
(`./dev exec pnpm check:extension-inventory --inventory`) passed, exit 0, and
reported removal of its isolated database and Redis fixtures. No retained
provider or live PBX selection is included.

The owner subsequently confirmed they cannot yet verify availability of an
existing snapshot/maintenance mechanism and asked that it be included in the
approval review. The proposal records that uncertainty explicitly. It does not
justify or approve pre-backup writes by treating uncertainty as absence.

## Full-graph failure and separate reruns

The complete `./dev check` attempt exited **1** in the default session stage:
`check-credential-browser.mjs` could not see **Check credential status** after the
lost-issuance response and **Retry access**. Static/build/config, foundation,
durability, storage/reference/client/deployment, identity/bootstrap and preceding
platform/staff/draft/credential checks had passed. This is a separate browser
failure, not an OpenBao 500 and not evidence caused by the test-only deadline
candidate, which has no application imports.

A focused `./dev exec pnpm check:staff-auth --browser` rerun passed without an
application change. That does not establish a root cause or justify discarding the
full-graph failure. The fixture now retains only sanitized HTTP status/expiry and
visibility diagnostics on failure and additionally requires the deliberately lost
issuance response to have been a committed HTTP 201. No timeout, session lifetime,
negative denial or recovery assertion was relaxed. The full default session-stage
rerun also passed, exit 0, including the strengthened committed-201 precondition,
remaining session durability/fault tests and desired PBX registry checks. The
initial visibility failure is currently non-reproducing, with root cause still
unresolved. Both retry passes and the original failure remain separately reported.
