# P3-U3a — Token lifetime finding and proposed hardening

2026-10-19 (UTC). **Disposable validation approved; retained remediation unapproved.**
The one recovery authorization is consumed. This document requests no further root
recovery and does not authorize retained-provider changes.

## Current direction update — 2026-10-20

The owner approved the [completion direction](p3-u3a-approved-completion-direction.md):
complete-array constraints are the hardening candidate; independent local lifecycle,
owner and API development may proceed. Retained access/remediation remains
unapproved and the historical failure below remains unresolved. The earlier
feature-wide stop is superseded for authorized local work only. The transaction
timing amendment is conditional and not accepted for runtime use.

## Observed acceptance failure

After verified root revocation, independent succession, normal restoration and
passing endpoint regressions, the restricted trunk issuer requested a verifier
token with `ttl: "48h"` and `explicit_max_ttl: "48h"` through its approved role.

| Field | Approved contract | Actual response/self-lookup |
| --- | --- | --- |
| Initial lease | Normal requests one hour; maximum bounded by approved lifetime | 86,400 seconds (24 hours) |
| Explicit maximum | 86,400 seconds (24 hours) | **172,800 seconds (48 hours)** |
| Policies | Exact installation verifier only | Exact installation verifier only |
| Orphan / period / identity policies | Orphan, no period, no identity policies | true / 0 / empty |

The token was self-revoked and subsequent lookup returned 403. All other known
test tokens were also self-revoked and verified; zero token files remained.
The unexpected attributes were preserved as [non-secret evidence](../../../../../status/p3-u3a-token-lifetime-finding.json),
then the exact test helper was removed. This test stopped before periodic-token,
material import or provider cleanup tests; no trunk material was written.
Renewal beyond 24 hours was **not** attempted or demonstrated. The reported
explicit maximum itself violates the approved issuance contract and requires
review; do not claim an observed 48-hour elapsed lease or successful longer renewal.

The earlier disposable rehearsal covered ordinary issuance, independent identity
and forbidden operation paths but missed this override. That test should have
preceded retained execution and old-administrator retirement. The old policy is
already retired; it has not been restored or widened. The initial privileged
inventory contained zero active old-administrator accessors.

## Current state and mandatory stop

Recovered root is revoked, temporary human sessions are revoked, and retained
OpenBao is running its original protected HCL/TLS/storage/network configuration.
The dedicated human account remains available through personal custody. Existing
restricted issuers were issued with the expected 24-hour explicit maxima and
remain in protected separate custody. The required real endpoint regressions
passed, including PostgreSQL/Redis, HTTP A/B, provider interruption, cleanup races,
secret-exclusion checks and exact fixture teardown.

No existing role, issuer or policy was modified after the finding. No automatic
repeat recovery, broad revocation or additional privileged login was attempted.
Further provisioning/feature work is blocked by the user's explicit requirement
to stop at an unexpected privileged condition and obtain separate review.
P3-U3a is incomplete; provisioning security acceptance is **not passed**.

## Concrete proposal for review and disposable validation

Use provider-enforced request constraints on the **existing exact token-creation
paths**, in addition to post-issuance checks. The
[proposed manifest](../../../../../planning/p3-u3a-token-lifetime-hardening-manifest.json) contains exact
replacement bodies and expected current body hashes for three policies:

1. `endpoint-restricted-issuer`: six existing exact runtime/expiry paths across
   the two approved installations.
2. `trunk-restricted-issuer`: six existing exact importer/verifier/cleanup paths
   across those installations.
3. `platform-deployment-maintainer`: constrain its two existing fixed issuer
   replacement calls; preserve every other existing path/capability unchanged.

Require all five reviewed issuance parameters and allow only their literal
reviewed values. Normal runtime calls use one-hour TTL, 24-hour explicit maximum,
renewable true and their exact policy. Expiry fixtures use one-second TTL/maximum
and renewable false. Fixed issuer replacement calls use 24-hour TTL/maximum and
renewable false. Every call requires `no_default_policy: true`. Reject additional
parameters, including caller-supplied periods. No new issuance path, namespace,
policy capability, runtime identity or service is proposed in these three bodies.

OpenBao documents required/allowed request parameter constraints, including that
omitted parameters do not receive default-aware validation. These constraints
belong on `auth/token/create/<exact-role>` paths, not KV-v2 data paths, for which
the documentation excludes this mechanism. See the official
[policy parameter constraints](https://openbao.org/docs/2.5.x/concepts/policies/).
This is design support, not evidence that the proposed array/boolean/duration
constraints work on the pinned 2.7.1 server; that requires a disposable rehearsal.

The user subsequently approved **disposable-only validation** with isolated matching
version/configuration, all three exact path sets, actual token attributes, bypass
probes, regressions, cleanup and a separately developed maintenance/backup proposal.
That work is recorded in the [disposable report](../../../../../status/p3-u3a-disposable-lifetime-validation.md).
The original scalar constraint failed normal array-form issuance. A
[complete-array candidate](../../../../../planning/p3-u3a-token-lifetime-hardening-array-manifest.json) passed
14 approved path requests and 434 negative requests, but overlap, expiry-error and
endpoint concurrency findings remain unresolved. Retained acceptance is not passed;
no negative assertion or application-only replacement was used to hide the findings.

## Retained execution prerequisites still requiring design review

This is not a ready-to-execute retained maintenance request. Current human
maintenance cannot modify its own maintainer policy, and the reviewed policy does
not grant authenticated Raft snapshot access. A separately reviewed, narrowly
bounded maintenance/backup mechanism is needed before deploying all three changes.
Do not work around either restriction automatically, grant generic administrator
rights, skip the mandatory consistent backup/separate audit checkpoint, or recover
root again under the consumed authorization.

After disposable validation and review of that maintenance authority, present the
exact retained execution manifest, backup gate, bounded session/isolation plan,
restoration and failure handling for separate approval. Preserve endpoint material
policies/leases and all existing retained data throughout. Production/SIP/PBX
activation remain excluded.

The [maintenance/backup proposal](p3-u3a-retained-lifetime-maintenance-proposal.md)
now distinguishes missing authority, a possible rootless bootstrap and its conflict
with backup-before-change, exact temporary scope, failure cleanup and restoration
risks. Further design/rehearsal and explicit approval are required; this is not a
ready-to-execute retained request.
