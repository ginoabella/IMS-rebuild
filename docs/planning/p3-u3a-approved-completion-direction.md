# P3-U3a — Approved completion direction and implementation plan

Decision recorded: 2026-10-20 (Asia/Manila, +08:00).
Source: owner's **MyIMS P3-U3a — Security Simplification and Completion Direction
Approval**, accepting the [October 20 proposal](p3-u3a-security-simplification-and-completion-proposal.md)
with the conditions below. Direction approval is complete. The first separately
approved capability session stopped at the display-name check and was revoked/403.
The separately approved second session passed corrected identity and all ten
capabilities after native disposable workflow testing; revocation/403 confirmed.
[Current findings](../status/p3-u3a-retained-capability-session-2.md). Both limited
authorizations are consumed. Retained remediation execution is **not approved**.
P3-U3a remains in progress and incomplete.
This record controls current planning; historical proposals and evidence retain
their original scope and results.

## Approved direction and limits

1. Retain OpenBao, separate endpoint/trunk mounts and installation identities,
   protected custody, importer/verifier/cleanup separation and canonical ownership.
   Tenant/installation isolation, confidentiality, least privilege, fail-closed
   authorization, auditability and recoverability remain mandatory.
2. Keep a **3,600-second initial runtime lease** and **86,400-second configured
   explicit maximum**. Adopt the validated complete-array constraints as the
   hardening candidate; adoption authorizes local preparation, not retained writes.
   Validate effective token/entity/group/auth/role authority and issued attributes.
   No immutable server-wide ceiling against a trusted administrator is claimed.
3. Develop bounded same-token reconciliation after transient renewal failures and
   controlled replacement before maximum expiry. HTTP 500, malformed/uncertain
   replies and invalid authority never constitute successful renewal or extend
   local authority. Pause consumption until independently valid authority is
   established within the original deadline; expired or revoked authority cannot
   resume. Validate replacements before switching; account for prior tokens and
   bounded overlap. Retained token issuance/replacement remains a later gate.
4. Provider timing limitations may be documented and conditionally accepted only
   with proven conservative consumption controls. Preserve raw 500 and expiry
   counterexamples. No acceptance pass or provider fix is implied. Numeric clock
   bounds/margins in the test prototype remain experimental; establish defensible
   clock assumptions, restart behavior, immutable issuance origin and pre/post-call
   deadlines before protected runtime use. Never consume expired authority.
5. Prefer stable, separately controlled backup and maintenance capabilities using
   existing authorized mechanisms. Any new or expanded retained privilege needs
   separate approval. The nine-write temporary-ticket/pre-backup proposal remains
   an unapproved contingency, not the routine path or an approved exception.
6. Local owner/grants/worker/definitions/binding/claim/adoption, policy-helper and
   lifecycle implementation may proceed with disposable services and approved
   non-disruptive verification. Do not wait for retained administration to finish
   independent local work; retained credentials/data are not disposable fixtures.
7. Distinguish local development, retained security remediation, P3-U3a end-to-end
   acceptance and production readiness. Preserve failed evidence and negative
   tests. Local completion alone cannot establish retained security or a acceptance.
8. Use direction review, named retained access and concrete retained execution as
   the principal gates. Routine reversible local work needs no repeated approval.
9. This decision grants no retained access/custody discovery, privileged policy or
   role changes, token issuance, restart, root recovery, restoration, live SIP/PBX
   activation or production deployment.

## Conditional transaction-timing amendment

**Approved in principle; pending implementation and real transaction/failure
acceptance. Not accepted for runtime use.** A verification completed under valid
provider authority may produce an owner attestation usable within the approved
60-second freshness interval even if that provider access token subsequently
expires. Freshness starts at the authorized verification, not token expiry; expiry
never restarts or extends the interval. This does not extend the provider token or authorize another provider
request. A late, failed or uncertain response cannot create a successful proof.

At transaction finalization, the database independently revalidates current
business authority, exact owner, installation, credential generation, expected
versions/verification epoch, eligibility, replay protection and 60-second freshness
using database time. Claim/association/history/audit remain atomic under the
approved lock order. Provider I/O stays outside the business transaction. Unknown,
stale, retired, cleanup-pending, mismatched or invalidated proof fails closed.

Implement and pass real PostgreSQL/provider tests for: valid verification followed
by provider-token expiry and finalization within freshness; finalization beyond
freshness; delayed/lost verification responses; revocation or business authority
change; wrong owner/installation/generation; duplicate/concurrent replay; restart,
clock uncertainty, database interruption and audit/constraint rollback. Document
which revocation invalidates provider authority versus current canonical authority;
never infer that a successful old proof overrides a current canonical denial.
No runtime activation of this amendment precedes recorded passing evidence.

## Focused implementation sequence

These are checkpoints within P3-U3a and its existing lifecycle refinement, not new
product units. Work on one cohesive local checkpoint at a time; independent local
work may continue while the separately gated retained track waits.

| Checkpoint | Deliverable | Exit evidence |
| --- | --- | --- |
| 1. Policy and lifecycle helpers | Generate complete-array bodies and matching exact-body preflight together; retain mismatch rejection. Implement bounded same-token reconciliation, conservative deadlines and validated pre-maximum replacement using disposable credentials. | Existing 14 positive paths/434 negatives and ten helper cases; effective-policy/identity/generic-issuance denial; malformed/500/lost renewal, revoked/expired token, replacement failure/overlap, restart and clock uncertainty checks. Preserve native provider failures separately. |
| 2. Canonical lifecycle owner | Deployment-owned schema, grants/functions, immutable generations, reservations, provenance, history/results/tombstones and scoped owner attestation. Dedicated protected verifier/import/cleanup composition and queue filtering exclude ordinary/endpoint workers and wrong installations. | Real disposable PostgreSQL grants/direct SQL denials, audit rollback, exact OpenBao version-1/CAS-zero import and read, process/custody isolation, interruption/retry and claim/cleanup/late-write races; L-01–05. |
| 3. Definitions and exact binding | Trunk/gateway validation and protected bounded APIs; same-transaction qualify/claim/adoption with expected versions, canonical authority and replay protection. Implement conditional timing amendment behind an inactive boundary until its acceptance passes. | Real PostgreSQL, Redis and two HTTP replicas; A-01–07 and timing matrix above; staff/forged/cross-installation/expired/revoked denials, lost-response replay, stale edits and atomic rollback. Secret sentinels excluded from all safe outputs. |
| 4. Retained remediation, separately gated | Establish named existing backup/maintenance route, current effective inventory, backup/audit and recovery prerequisites. Prepare exact hardening bodies/hashes, duration, writer exclusion, readback, validation, cleanup and partial-state handling for approval before retained execution. | Approved named access followed by approved concrete execution package; backup before changes, preserved endpoint permissions/material/ordinary leases, exact test-token accounting. No automatic privilege expansion, rollback, restore or root fallback. |
| 5. Integrated acceptance | Synthetic protected import → exact verification → canonical qualification → HTTP A/B binding/adoption, with retained security prerequisites satisfied. Resolve timing disposition and browser-recovery visibility failure; complete recovery proof and affected regressions. | Real lifecycle L-01–05 and a A-01–07, isolation/failure/recovery checks, focused regressions and final complete ./dev check. Required failures must pass or have an explicitly approved disposition with proven compensating controls. |

Checkpoints 1–3 do not require retained administration. The retained remediation
package can be prepared while local integration proceeds. The existing browser
full-graph failure stays recorded: focused/default-session reruns passed, but the
cause is unresolved. Do not weaken its lost-issuance fault precondition.

## Acceptance boundaries and remaining decisions

| Boundary | Current status | Gate to advance |
| --- | --- | --- |
| Local implementation/disposable verification | Authorized; implementation and integration outstanding | Required focused checks per checkpoint; no additional ordinary local approval |
| Retained authority verification | Owner-accepted and successfully closed within named ten-path scope; intended restricted custodian permissions function; revoke/403 confirmed; both authorizations consumed | [Current findings and limits](../status/p3-u3a-retained-capability-session-2.md); separate backup/maintenance availability unknown; further access needs approval; no custody search |
| Retained security remediation | Not authorized; 48-hour maximum finding unresolved | Current effective inventory and backup-first route, then exact reviewed execution package; separately approve any new/expanded lasting privilege |
| Transaction timing | Approved in principle only | Implementation plus real transaction/failure evidence before runtime acceptance |
| Provider timing disposition | Conditional only; 500/overrun remain failures | Proven conservative consumption controls and explicit documented disposition; preserve raw assertions |
| P3-U3a end-to-end | Incomplete | All applicable A/L criteria, retained prerequisites, recovery proof and final graph |
| Production/live integrations | Excluded | Later owning-unit approvals and measured readiness, HA/custody/clock/capacity/joint recovery/RPO/RTO |

Both named-access authorizations have been consumed within their limits; the
second session established the ten current capability sets, with confirmed cleanup. The principal remaining approval decision is the concrete retained
execution package. Missing existing authority may require a
separately reviewed lasting privilege decision within that package. Recovery,
restoration, live activation and production remain outside both gates unless
expressly authorized in their own later scope.

Owner follow-up on October 20 accepts the stable snapshot backup identity and
separately controlled attended maintenance authority as the preferred direction
for further design review only, with no implementation authorization.

## Accepted checkpoint and administrative design review — October 20

The owner accepted the named verification evidence and closed that checkpoint
successfully. Do not repeat capability checks or expand the functioning custodian
without new approval. This is neither full inventory nor backup readiness.
The [consolidated sustainable administration design](p3-u3a-sustainable-openbao-administration-design.md)
is prepared for separate review and supersedes the older temporary-ticket route
as the preferred direction. No retained login, credential creation, protected
inventory access, policy change or backup/maintenance implementation is authorized.
Independent local lifecycle/owner/grants/workers/binding work continues, with the
native renewal/expiry and integration acceptance failures preserved.
