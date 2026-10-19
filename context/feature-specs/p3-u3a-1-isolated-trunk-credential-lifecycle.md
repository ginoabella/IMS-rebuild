# P3-U3a-1 — Isolated trunk credential lifecycle

Status: in progress, 2026-10-19 (Asia/Manila, +08:00); provider/provisioning primitives and the single recovery/handoff are executed; blocked pending separate token-lifetime review, with owner integration and real acceptance outstanding.
Parent: [P3-U3a](p3-u3a-protected-trunk-and-gateway-definitions.md).
Authority: user's explicit approval of the [OpenBao review](../../docs/planning/p3-u3a-openbao-trunk-credential-review.md).
This is the parent's required focused refinement, preceding authenticated resource
integration. It does not replace a/b/c or weaken a acceptance.

## Starting state and prerequisites

Reuse the retained TLS OpenBao server and existing PostgreSQL/queue/audit owners.
No trunk owner exists yet. Require an authorized shared platform custodian capable
of mount/policy/token-role administration and a concrete approved non-secret
provider profile. The synthetic digest-only/no-registration profile is conditionally approved. Endpoint administration is excluded. Root recovery and listener
weakening require separate exact approval; do not infer them from this review.

## Current acceptance blocker

The authorized recovery/root retirement/restoration and endpoint regressions passed.
A real token request yielded a 172,800-second explicit maximum against the required
86,400-second ceiling; its initial TTL was 86,400 seconds. The exact test token and
all other known test tokens were revoked/403, and the helper was removed. No trunk
import began. Stop under the user's required separate privilege review; see the
[finding and proposed hardening](../../docs/planning/p3-u3a-token-lifetime-hardening-review.md).
The single recovery authorization is consumed. Do not weaken the contract below
or modify roles/policies to make the test pass without separate approval.

## Implementation contract

Implement sections 2–7 of the approved review without changing their limits:
separate `myims-trunk` KV-v2, exact installation token roles, separate importer,
read-only verifier, cleanup and DB attestation identity, distinct UID/custody and
private provider/database networks. Remediate endpoint administrator self-editing
and unrestricted issuance while preserving endpoint runtime rights/material.
Reserve through canonical operator authority; import only via protected descriptor
or hidden input, never HTTP/argv/env/spool. Each immutable generation uses CAS=0
and exact provider version 1. Reconcile uncertain writes with exact reads; changed
resupply rejects privately. Durable work contains only non-secret identity.

Use five-second provider deadlines, concurrency two, six attempts per budget,
5-second exponential backoff capped at 300 seconds, audited explicit reconciliation,
one-hour token TTL/24-hour maximum, renewal and trusted reprovisioning, no default
policy. Retain full results 30 days and minimal tombstones/history indefinitely.
Unknown/missing/expired proofs never become successful bindings. Attestations
expire after 60 seconds by database time. HTTP has no provider token or secret I/O.

Expose narrow same-transaction claim/adoption ports under the lock order in review
section 5. Restrict owner facts with DB roles/functions and immutable provenance.
Retirement fences new selections and preserves old associations; no implicit
adoption or revocation. Cleanup destroys version 1 only for terminal never-associated
generations aged at least 24 hours, at most 50 per run, with affirmative complete
dependency checks, serialized claims, pending-before-I/O and late-write reconciliation.
Associated generations remain retained for later apply/rollback owners.

## Acceptance and verification

- L-01: real PostgreSQL grants separate runtime intent/claim from owner attestation;
  provenance/history/receipts are immutable and audit failure rolls back local work.
- L-02: real OpenBao import and exact-version verification work; changed reuse,
  malformed/missing/denied/sealed/unreachable results are safe and distinct.
- L-03: reciprocal endpoint/trunk/cross-installation ACL denial, forbidden operations,
  issuance escalation, token lifetime, TLS, restart and process/custody isolation pass.
- L-04: authority fencing, response loss, provider/DB interruption, uncertain writes,
  retry exhaustion/reconciliation and cleanup-versus-claim/late-write races pass.
- L-05: sentinels stay absent from safe DTOs/receipts/audit/outbox/logs/URLs/assets;
  exact fixture cleanup and recovery are documented. No carrier or PBX live effects.

Introduce a dedicated reproducible lifecycle check only with its real implementation.
Port fixtures cannot satisfy these external criteria. Run affected endpoint/isolation,
queue/auth/PBX regressions and `./dev check`. Record commands, injected boundaries,
cleanup and limitations in owner evidence. a A-04 additionally verifies actual
HTTP A/B exact claim/adoption against this owner; lifecycle completion alone does
not complete a. No live REGISTER/call/apply/reload or production claim.
