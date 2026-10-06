# P2-U2c distributed limiter contract review

Prepared 2026-10-06, Asia/Manila (+08:00). **Section 1 approved 2026-10-06, Asia/Manila (+08:00).**
The user approved separate dimensions, budgets, fixed windows, counting and
fail-closed behavior. The 120/minute protected identity default must be validated
against realistic web/passive-polling/operator and future mobile traffic; if
normal behavior can reach it, bring an appropriate budget back for review before
production. The 8,192 active-counter ceiling may proceed subject to memory and
production-capacity validation. Credential-recovery/public-intake/socket and other omitted
policies remain with their owning units.
Requirement: [c specification](../../context/feature-specs/p2-u2c-distributed-rate-limits-and-integrated-recovery-handoff.md).
The [parent limiter decision gate](../../context/feature-specs/p2-u2-shared-session-store-and-authorization-guards.md#decision-gates-and-review-findings)
requires explicit approval of operation coverage, budgets/windows, dimensions and
counting before dependent implementation; that approval is now recorded above. Approval of implementation or the split
does not approve these values. Existing a/b lifecycle policy remains unchanged.

## 1. Approved product policy

Apply the following independent source and identity budgets. A request must have
allowance in both dimensions. An identity budget is shared across sources; a
source budget is shared across identities within the same operation/plane.
Pairing source and identity into one key would let changing either multiply the
allowance, so the approved policy uses separate counters.

| Operation namespace | Source budget | Identity budget | Identity material |
| --- | --- | --- | --- |
| Platform sign-in | 60 attempts / 15 minutes | 10 attempts / 15 minutes | Normalized operator username; no tenant |
| Tenant staff sign-in | 60 attempts / 15 minutes | 10 attempts / 15 minutes | Normalized tenant code and username |
| Platform protected HTTP | 600 requests / minute | 120 requests / minute | Canonical operator ID |
| Tenant protected HTTP | 600 requests / minute | 120 requests / minute | Canonical tenant ID and staff ID |

Source means the validated client address from section 2. Sign-in budgets apply
before identity lookup, password verification or session issuance. Known and
unknown identities take exactly the same limiter path; the limiter never checks
account existence. Tenant and platform counters are separate. Staff web/mobile
sign-in shares the tenant sign-in budget; opening another client or HTTP replica
does not provide another allowance.

Protected HTTP budgets apply after successful canonical plane/permission
validation and before any handler/protected work. All explicitly protected HTTP
routes consume the plane's common protected budget, including passive polling and
later logout/rotation routes. Reads and writes share this budget. Public health
and the public foundation route are excluded. Unauthorized/invalid-session
requests do not reach this protected limiter and do not consume its counters;
session validation and dependency timeouts retain their existing fail-closed
behavior. No password-reset, credential-recovery, public-intake or socket budget
is implied: their owning units must declare and obtain their own policy.

Count every valid admission attempt, successful or failed, up to counter
saturation. Both dimension counters are charged even when one rejects. At the
allowance boundary, exactly the configured number of requests may be admitted;
subsequent requests receive 429. Neither successful sign-in nor logout resets
counters. Downstream failure does not refund an admission. A rejected request
runs no password verification, session issuance, protected handler or activity
renewal. This is temporary throttling with no automatic account disabling or
permanent lockout. Shared NAT clients can exhaust the source allowance; the
approved higher source budget reduces, but does not eliminate, that tradeoff.

Use fixed windows aligned to Redis UTC epoch time: 15-minute sign-in windows and
one-minute protected windows. At the boundary a new allowance begins; a burst
spanning two windows can admit up to twice a budget. No rolling-window guarantee
is claimed. Rejected requests return a generic 429 with `Retry-After` as the
ceiling of seconds until all exhausted dimensions' windows end, bounded to
1–900 seconds for sign-in and 1–60 seconds for protected traffic. Denials do not
extend the window. Dependency/capacity failures return generic retryable 503 with
`Retry-After: 1`, never admission through a local or realtime fallback.

These are approved validated server-only product defaults. Configuration
may lower budgets/windows within positive finite bounds; increases beyond the
approved values require a new decision. Small explicit fixture values prove
concurrency/expiry and are never copied into defaults. A configuration change
requires a coordinated admission pause and rollout across replicas so different
window/budget settings cannot multiply admission.

## 2. Implementation decisions and resource bounds

These are implementation choices within c's authorized boundary, documented for
review; section 1 records the approved product decision.

Use the connection peer by default with an empty trusted-proxy list. Ignore
forwarding headers from an untrusted peer. Support only an explicitly configured,
bounded list of trusted proxy addresses/CIDRs and `X-Forwarded-For`; walk from the
connection peer toward the client, stopping at the first untrusted address.
Require one bounded, valid chain from trusted peers; reject missing, duplicate,
malformed, too-long or ambiguous chains. Reject missing/invalid socket addresses.
Normalize equivalent IPv4/IPv6 address encodings. Do not infer trust from private
address ranges, and do not accept `Forwarded`, `X-Real-IP` or arbitrary identity
headers as substitutes. Concrete production ingress addresses remain deployment
configuration; no deployment origin or cookie/cross-site decision is needed for
the bearer fixtures.

Before normalization, require bounded string inputs: tenant code at most 128 raw
bytes and username at most 256 raw bytes, then reuse canonical ASCII normalization
with 64/128-character normalized bounds. Bound the entire source chain and its
number of hops before parsing. Invalid identity/source input returns a bounded
invalid-input outcome without password verification or identity-derived keys.
The later sign-in transports own their generic validation/error presentation.

Use session Redis, an explicit versioned namespace per operation/plane/dimension,
SHA-256 hashes of unambiguously encoded identifying material and atomic bounded
scripts. Neither raw material nor hashes enter metric labels, logs or errors.
Expose only the finite operation and admitted/limited/invalid/unavailable outcomes.
Counters saturate at their configured allowance and expire at the fixed window
end; rejected traffic cannot make a key permanent. No request-time session scan
is permitted.

A bounded atomic allocation registry (implemented as one expiring hash per operation) limits active identifying counters to 8,192
per operation, shared across replicas. Registry maintenance/work and TTLs must be
bounded; no key is allocated when the cap cannot be confirmed. Cap exhaustion
returns retryable 503. This is an approved technical capacity ceiling, subject to
real memory checks, rather than an additional request allowance. Combine it with
the existing finite 128 MB/noeviction Redis service; OOM/ACL/timeouts must fail
closed even when earlier session keys can still be read. Document actual measured
fixture memory and production capacity validation still required.

Reuse session command timeout/concurrency bounds (2 seconds/default, hard
10 seconds; concurrency 4/default, hard 16). Never automatically retry an
ambiguous counter or lifecycle write. Close broken connections and establish a
fresh, bounded, authenticated/capacity-validated connection before recovery;
reconnection itself grants no authority. Do not silently replay queued commands.

## 3. Integrated acceptance and implementation plan

Reuse a/b ports, primary PostgreSQL fences, canonical repositories and private IPC
issuers. Extend their uniquely owned real Redis/PostgreSQL/two-HTTP-process
fixtures; production HTTP must never import fixture routes or token issuers.

- C-01/02: validate approved policy/configuration, shared A/B concurrency at the
  boundary, expiry, normalization, known/unknown identities, tenant/plane
  separation, source spoofing, hostile cardinality and no work after 429.
- C-03: separate read/write failures, disconnect, timeout, ACL and noeviction;
  retained reads do not authorize work whose admission/required writes fail.
  Verify no false issue/renew/revoke success and canonical outage mapping.
- C-04: actual captured stale data and Redis restart, revoked/rotated/canonically
  changed sessions rejected by both HTTP processes, lost sessions absent and
  interrupted recovery denied until current primary fences/canonical checks work.
- C-05/06: rerun all a/b acceptance, complete focused session command and
  `./dev check`; finalize child selections/CI and exact teardown/evidence.
- C-07: publish U3/U4 port/transport/error handoff and private-network/credentials,
  ACL/AOF/noeviction/capacity and restore quarantine/fence verification runbook.

Central evidence will map parent AC-01–11 to c's actual results and a/b proof.
Neither c nor the parent is complete until every required check passes. Retained
sessions may recover only against current primary PostgreSQL fences and canonical
versions. Joint rollback of Redis/PostgreSQL needs separately controlled global
invalidation; production TLS/HA/capacity remains a later gate. Browser sign-in,
CSRF, mobile storage, sockets, unfinished-work reauthentication UI and the Phase 2
gate retain their owning units and required acceptance.
