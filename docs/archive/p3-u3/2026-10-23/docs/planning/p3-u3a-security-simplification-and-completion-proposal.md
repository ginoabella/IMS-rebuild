# MyIMS P3-U3a — Security Simplification and Completion Proposal

Prepared: 2026-10-20 (Asia/Manila, +08:00).

**Status: direction approved with conditions on 2026-10-20; not an execution authorization.**
The [approved decision and implementation plan](p3-u3a-approved-completion-direction.md)
records the owner’s conditions and supersedes pending-direction language below.
The transaction-timing clarification remains conditional pending implementation
and real transaction/failure acceptance; named retained access/execution remain
unapproved. The original proposal follows for traceability.

**Original proposal scope:** P3-U3a remains
incomplete. This document records the consolidated recommendation requested by
the owner. It does not approve retained OpenBao access, custody discovery,
privilege changes, live integrations, recovery or production operations. Existing
approved contracts remain authoritative until proposed amendments are accepted.

## Recommendation

Keep the credential architecture and simplify its operating model. The shortest
safe path is to fix issuance constraints, establish one sustainable backup and
maintenance route, and complete the missing trunk owner and API integration.
Provider expiry precision should receive a bounded acceptance decision rather
than drive continuing rearchitecture.

Tenant and installation isolation, credential confidentiality, least-privilege
runtime access, fail-closed authorization, auditability and recoverability remain
mandatory. The configured maximum remains **86,400 seconds (24 hours)**.

This proposal follows review of [AGENT.md](../../../../../../AGENT.md), its required context,
the [progress tracker](../../../../../../context/progress-tracker.md), approved credential
reviews, current adapters/helpers and the latest evidence. The architecture review
was read-only: no retained OpenBao access, custody discovery or privilege changes
were performed. Creating this document changes documentation only.

## Architecture to preserve

Keep one OpenBao server with separate endpoint/trunk mounts, installation-scoped
runtime identities, protected custody, and separate importer, verifier and cleanup
permissions. HTTP, web and ordinary workers continue without provider credentials.

Preserve immutable generations, exact version-1 reads, canonical ownership,
atomic association/history/audit, bounded retries and conservative cleanup. These
controls address concrete isolation, disclosure and recovery failures.

The architecture already acknowledges a shared trusted host/server administrator.
Making its 24-hour policy immutable against that administrator would require a
substantially different trust model. OpenBao authorization depends on effective
policy composition, including identity policies; a policy name alone cannot
establish isolation. See the [OpenBao policy documentation](https://openbao.org/docs/concepts/policies/).

## Recommended simplifications

### Issuance and token replacement

Keep the configured maximum at 86,400 seconds. Deploy the tested complete-array
request constraints on exact issuance paths, validate issued attributes, and
reject unexpected policies, periods or issuance routes. The 48-hour explicit
maximum is a genuine security defect requiring retained remediation; it is
separate from fractional expiry timing.

Retain one-hour runtime leases and the existing renewal cadence. Prepare
replacement credentials with a bounded overlap before the original token's
maximum, using the existing trusted issuance model. Validate the replacement
before switching and account for the exact prior token. Automated retained
replacement remains separately authorized work.

### Renewal failures and availability

Treat near-expiry HTTP 500 as a failed renewal. Never extend local authority from
that response. Prefer rotation before that condition arises.

For mid-lease transient failures, permit bounded same-token reconciliation against
independently verified remaining authority rather than permanently stopping an
otherwise valid consumer. Expired, revoked, malformed or unverified authority
still stops consumption. This behavior requires implementation and verification;
it is not a claim about current runtime recovery.

### Conservative consumption deadlines

Use a conservative consumption deadline without building a clock-attestation
subsystem. Validate original issuance and current lease metadata, reserve a
measured safety margin, use monotonic elapsed time, and check before and after
provider calls. Re-establish the original deadline after restart. Clock
uncertainty that could invalidate the margin pauses the affected consumer.

The proposed two-second clock bound, three-second margin and 250-ms divergence
threshold are experimental settings, not established operating requirements.
Unknown clock skew cannot be made safe by choosing an arbitrary margin.

Expiry tolerance must not become permission to use an expired token. MyIMS must
stop consuming it conservatively. An application guard does not revoke the raw
token or prove an exact server-wide ceiling. Accelerated observations do not
establish a universal bound or replace qualification at normal lifetimes.
OpenBao documents the intended explicit-maximum semantics; repository evidence
records the observed precision limitation. See the
[token API](https://openbao.org/docs/api/auth/token/).

### Provider-token validity and owner qualification

A provider token authorizes a provider request. It does not determine the lifetime
of stored SIP material or an existing desired association. A completed, authorized
verification can produce a short-lived owner attestation. The database transaction
must independently check current business authority, exact identity, eligibility
and the approved 60-second freshness window.

**Proposed contract clarification:** remove any additional requirement that the
database commit precede expiry of the token used for that completed verification.
Late or uncertain provider responses must still reconcile safely. This is a
recommendation for review, not an implemented relaxation or acceptance pass.

## Sustainable OpenBao administration

Prefer an existing authorized operator, snapshot reader or backup job. Availability
is currently **unknown**. The reviewed custodian alone lacks the required snapshot
and self-policy maintenance capabilities.

Use two stable administrative capabilities:

- **Backup:** native Raft snapshot access, protected separate audit preservation,
  restricted storage and separately held seal/recovery custody.
- **Maintenance:** named human authentication with reviewed policy/role scope and
  audit; changes to its own authority remain separately reviewed.

Reuse existing capabilities wherever they satisfy this model. If capabilities are
missing, propose one narrowly scoped, lasting administrative arrangement for
separate approval. Avoid routinely creating temporary policies, issuer grants and
tickets, then elevating and deleting them. No such privilege expansion is
authorized by this proposal.

Keep existing 15-minute human sessions for ordinary commands. Capture backup
before the short write phase and allow fresh authentication between checkpoints.
If measured work needs longer authority, submit one bounded duration with the
concrete maintenance package. A five-minute ticket should not dictate backup
throughput or force rushed cleanup. OpenBao recognizes that snapshot operations
can need longer timeouts; see the [Raft snapshot API](https://openbao.org/docs/api/system/storage/raft/).

The existing nine-write temporary bootstrap remains a contingency proposal. Its
persistent minting grant and incomplete cleanup states make it a poor routine
maintenance model. Unknown existing backup authority is not evidence that the
bootstrap exception is necessary.

## Consolidated decision matrix

“Local” means implementation and disposable verification. “Retained” means
authorized changes or testing against retained OpenBao. Neither implies production
approval. Complexity is a qualitative estimate, not a delivery commitment.

| Unresolved issue | Actual security / availability risk | Recommended resolution | Complexity | Blocking boundary |
| --- | --- | --- | --- | --- |
| 48-hour explicit maximum | Excessive renewable lifetime despite a 24-hour initial TTL | Apply exact parameter constraints; verify actual token attributes | Low | Retained issuance and end-to-end acceptance; local work can continue |
| Scalar versus array constraints | Original constraint rejects legitimate requests | Adopt tested complete-array form; preserve negative tests | Low | Retained remediation |
| Overlapping token/entity/group policies and generic issuance | Additional authority can bypass intended constraints | Review effective issuance authority before maintenance; reject unexpected composition and control subsequent changes | Medium | Retained remediation and acceptance |
| Near-expiry renewal 500 | Renewal interruption and unnecessary worker outage | Record failed renewal; rotate earlier; bounded reconciliation where authority remains independently valid | Low–medium | Revised failure handling before acceptance; provider patch need not block local work |
| Measured subsecond expiry overrun | Provider may briefly accept a token beyond the nominal boundary | Accept only as a documented measured limitation with conservative MyIMS consumption controls; preserve counterexamples | Medium | Timing disposition and consumer integration before acceptance |
| Experimental clock/deadline controls | Unproven assumptions and overly sensitive pauses | Use established host clock monitoring and a measured margin; remove arbitrary permanent pause thresholds | Medium | Protected consumer acceptance; production clock qualification later |
| Fixed-issuer helper expects old policy bodies | Secure preflight rejects hardened configuration and obstructs replacement | Update authoritative policy generation and exact-body preflight together; retain mismatch rejection | Low | Retained rollout |
| Endpoint concurrent create returns 403 | Duplicate workers can report failure despite an identical completed generation | Keep exact immutable-read reconciliation; verify through owner/API integration | Low | Integration acceptance |
| Existing backup/inventory authority unknown | Safe maintenance prerequisites cannot be established | Verify a named existing route under explicit access authorization; no broad custody search | Medium | Retained remediation only |
| Temporary ticket/elevation/deletion sequence | Expiry mid-operation, persistent mint grant and residual objects | Prefer stable named maintenance capability and checkpointed execution | Medium once; lower ongoing | Retained maintenance design |
| Backup durability, decryptability and restoration | Archive may be unusable; restore can revive authority | Current native snapshot plus audit, protected custody and isolated recovery proof; no automatic restore | Medium | Recovery prerequisites before retained work; restore proof before end-to-end acceptance |
| Missing trunk canonical owner, grants, worker filtering and binding APIs | False qualification, unauthorized claims or wrong worker consumption | Complete approved lifecycle owner and definition integration | Substantial, essential | P3-U3a completion |
| Browser visibility failure in full graph | Possible recovery defect; current evidence is composite | Bounded investigation with strengthened diagnostics, then final full graph; preserve original failure | Low–medium | Final acceptance until required behavior is demonstrated |
| HA, production identity/custody, capacity, joint recovery and operational targets | Outages, privileged compromise and unproven recovery at operational scale | Complete measured production readiness work in its owning units | Substantial | Production only |

## Requirements by delivery stage

### Safe private development now

Continue local implementation, disposable testing and authorized non-disruptive
verification. Preserve confidentiality, isolation, canonical authorization, audit
and exact cleanup. Do not use retained authority or data to compensate for missing
disposable fixtures. The retained lifetime finding does not block independent local
owner/API work, but it prevents a retained security-acceptance claim.

### Before end-to-end P3-U3a acceptance

Resolve issuance hardening, effective authority, helper compatibility, timing and
renewal handling; establish the authorized backup/maintenance route; and complete
the protected trunk owner and definitions integration. Demonstrate required real
provider, PostgreSQL, Redis, two-HTTP-replica, isolation, interruption and recovery
outcomes. Provide recovery proof and required regressions, including the final
complete graph. Preserve earlier failed evidence and explain its disposition.

Use the approved synthetic digest-only profile. Credential qualification is not
carrier acceptance, live registration, PBX activation or tenant calling readiness.

### Before production

Complete the separately owned production identity/custody, HA, clock, capacity,
monitoring, joint-store recovery, RPO/RTO and operational readiness requirements.
Single-node private development evidence does not establish production readiness.
Live integrations and production operations retain separate authorization.

## Shortest safe completion path

1. **Continue local work:** finish compatible policy generation/helpers, bounded
   renewal recovery and deadline behavior. Implement canonical trunk owner,
   restricted grants, worker exclusion, claim/adoption and definitions APIs using
   disposable real services. Do not wait for retained administration to finish
   independent implementation.
2. **Resolve administrative access once:** identify the existing authorized backup
   and maintenance route. Prepare a concrete change package after its available
   authority is known.
3. **Perform one authorized retained maintenance campaign:** backup/inventory,
   exact hardening, readback, issuance/isolation checks and cleanup. Preserve
   ordinary endpoint permissions, material and leases.
4. **Complete synthetic end-to-end acceptance:** protected import → exact
   verification → owner qualification → HTTP A/B claim/adoption. Cover authority
   changes, interruption, cleanup races and secret exclusion without carrier/PBX
   contact.
5. **Run focused regressions and a final complete graph:** record timing and
   browser-failure dispositions honestly. Mark P3-U3a complete only when its
   required outcomes pass.

This path does not require provider migration, a second secret store, repeated
root recovery or indefinite investigation of the same accelerated expiry edge.
Preserve raw provider failure assertions; any revised acceptance criteria must be
explicitly approved and must verify the compensating controls.

## Consequential approval gates

One direction decision and two retained-operation gates are recommended:

1. **Direction review:** accept the simplification approach and proposed
   acceptance-contract clarifications. Routine authorized local implementation,
   disposable testing and non-disruptive verification continue without repeated
   permission requests. Synchronize authoritative contracts after approval.
2. **Named retained access:** authorize specific existing-principal access to
   establish inventory, backup and maintenance availability, including necessary
   session issuance and cleanup. This does not authorize privilege expansion.
3. **Concrete retained execution package:** approve exact remediation, any
   unavoidable lasting administrative capability changes, bounded continuation
   and cleanup, and synthetic retained acceptance together. Unknown states or
   additional privileges return for review.

Live integrations, disruptive recovery and production operations retain their
separate future authorization boundaries. This proposal does not approve any of
these gates by recording them.

## Repository evidence and decision sources

- [Current progress tracker](../../../../../../context/progress-tracker.md)
- [Approved isolated trunk credential review](p3-u3a-openbao-trunk-credential-review.md)
- [Trunk owner architecture and implementation limits](../architecture/trunk-credentials.md)
- [Token-lifetime finding and hardening proposal](p3-u3a-token-lifetime-hardening-review.md)
- [Disposable follow-up evidence](../../../../../status/p3-u3a-disposable-review-followup.md)
- [Latest security rationale and deadline investigation](../../../../../status/p3-u3a-security-acceptance-rationale.md)
- [Retained failure and authorization proposal](p3-u3a-retained-failure-and-authorization-review.md)

P3-U3a remains incomplete. Its core delivery work can proceed locally while
retained authority is resolved; document creation does not change acceptance or
authorization state.
