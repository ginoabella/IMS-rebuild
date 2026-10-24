# P3-U4 — Manage ring groups and dial plans

Status: in progress; P3-U4a and P3-U4b completed October 24, 2026 within
approved private development. B-01–06 completed at 2026-10-24 18:36 +08:00 (Asia/Manila).
R-01/R-02/R-04/R-05 are approved below; R-03 remains unresolved for c.
Parent acceptance and live routing remain incomplete.

## Goal and requirements

A platform operator defines ring groups and inbound/outbound dial rules through
the console, with explicit destinations, predictable precedence, reserved-number
protection and internally generated attribution identities. Saving retains desired
state; P3-U5 owns compiling, applying and verifying live Asterisk configuration.

Sources: [Phase 3](../implementation-plan.md#phase-3--deliver-asterisk-administration-before-tenant-onboarding),
[project scope](../project-overview.md), [telephony architecture](../architecture.md#telephony-architecture),
[workflow rules](../ai-workflow-rules.md), [UI conventions](../ui-context.md) and
[code standards](../code-standards.md). Contributes to overview success criteria
3 and 8; does not complete the Phase 3 gate.

## Starting state and dependencies

- P3-U1 registry/observations, P3-U2 inventory/profiles/credentials and P3-U3
  trunks/gateways/DIDs are recorded complete within private development in the
  [tracker](../progress-tracker.md). Recheck their relevant contracts at implementation.
- Reuse existing platform sessions, CSRF/proxy checks, canonical node/installation
  identities, PostgreSQL transactions, versions, request receipts and actor audit.
- Existing [resource dependencies](../../docs/architecture/trunks-and-gateways.md)
  cover gateway-to-trunk and DID-to-gateway references. P3-U4 must add its actual
  consumers, including disabled definitions, before relying on those resources.
- Current inventory is unallocated and calling-ineligible. Tenant allocations and
  route bindings do not yet exist. P4-U2 owns binding desired infrastructure to
  tenants; P4-U3 owns activation/readiness; P5-U3 owns trusted call-event ingestion.
- The [reference dial plan](../../reference/asterisk_config/extensions.conf) is
  illustrative legacy configuration. Its shared contexts, numbers and caller-ID
  handling are not approved tenant-isolation or reserved-number defaults.

## Scope and boundaries

Add telephony-owned desired records and constraints, deterministic routing
validation, typed contracts, protected APIs and real platform-console workflows
for groups, inbound rules, outbound rules and reserved patterns. Add only the
dependency changes required in existing resource/inventory operations.

No live PBX/provider access, new service, credential retrieval, reload, revision
compiler or durable apply worker is needed. Revision diffs/apply/rollback belong
to P3-U5. Tenant provisioning/permissions, staff assignment, browser calling,
voicemail, IVR, queues, recording and operational public intake remain with their
owners. Preserve existing runtime configuration, secrets and backup operations.

## Decisions required before dependent implementation

The user owns these product-policy decisions. R-01/R-04/R-05 are explicitly
approved in the record below; R-02 is approved below; R-03 remains a recommendation requiring an answer
before affected c implementation. Record decisions here and in the tracker. Splitting does not resolve a
missing policy decision.

| ID   | Recommended contract / question to resolve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Affected work and resume condition                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-01 | Groups have an optional dialable number using the existing 1000–899999 extension convention, unique against extensions and other groups on the installation. Permit 1–32 distinct same-node inventory members, including disabled stock in desired definitions. Strategies: simultaneous or ordered sequential; timeout 5–120 seconds, default 20, per attempt (one attempt for simultaneous, one per member for sequential). Busy/unavailable/no-answer advances; exhaustion hangs up or uses one explicit extension/group fallback. Reject fallback cycles. | a and later destination consumers; confirm numbering, limits, disabled-stock behavior, strategy, timeout and fallback semantics.                                                                 |
| R-02 | Inbound rules select one trusted gateway plus one exact DID associated with it, or an explicit gateway catch-all. Exact DID wins; one catch-all per gateway; unknown DID without a catch-all rejects. Preserve P3-U3's exact canonical number distinctions, including leading zeros and `+`; no implicit aliases. Destination: extension, ring group or hangup.                                                                                                                                                                                               | b; approved October 24, 2026 below, including initially disabled rules.                                                                                                                       |
| R-03 | Outbound rules use exact numbers or a literal digit prefix with explicit minimum/maximum total digit length (1–15); exclude raw Asterisk patterns, regex and arbitrary dial-plan text. Lower numeric priority wins within a scope; overlapping equal-priority rules reject. Destination: one outbound-capable trunk; optional explicit strip-count/add-prefix transformation, validated for nonempty bounded output. No match denies.                                                                                                                         | c; confirm pattern language, priority, overlap policy, number transformations and allowed call classes, including emergency/international/service numbers. No default broad outbound permission. |
| R-04 | Maintain installation-scoped reserved exact numbers or bounded prefixes with a purpose. Block intersecting dialable groups, extension creation/bulk creation and outbound rules. Disabled definitions retain claims; removal releases a claim only when references allow it. Establish the actual bootstrap/unmanaged/service/emergency reservations by reviewing the controlled installation; do not import legacy examples as defaults.                                                                                                                     | a owns namespace protection; c adds outbound overlap. Confirm initial reservations, management authority and conflict policy before either consumer ships.                                       |
| R-05 | Create unbound infrastructure definitions before tenants. An unbound group/rule cannot be applied as a tenant route or establish call ownership. A later tenant binding must validate all members, fallbacks, ingress ownership and outbound permission against canonical allocation facts. Shared outbound trunks are allowed only through explicit tenant permissions.                                                                                                                                                                                      | All children and P4-U2 handoff; confirm template-to-binding behavior and tenant compatibility contract. P4-U2 must implement real allocation checks before tenant/live use.                      |

### Approved P3-U4a policy — October 24, 2026 (+08:00)

The user explicitly approved R-01/R-04/R-05 in the implementation conversation.
R-01 uses the recommended values above, including initially disabled groups.
R-04: platform operators manage exact ASCII digit numbers or literal digit prefixes
with explicit minimum/maximum total lengths 1–15. No reservation enable switch.
Intersecting reservations and existing extension/group claims reject, including
disabled claims. Referenced groups cannot be removed. Start with no seeded
reservations: read-only inspection of the running development dial plan confirmed
only the bootstrap default `_X.` hangup rule. Legacy reference examples are not
imported. No emergency/service policy or outbound permission is inferred.
R-05: definitions remain unbound/calling-ineligible; reject tenant-binding inputs.
Future binding must validate every reachable member/fallback against trusted
canonical allocations. R-02 was subsequently approved for b below; R-03 remains unresolved for c.

Routine choices such as file names, endpoint names and pagination implementation
follow existing conventions without a separate approval gate. P3-U5's permitted
commands, active-call policy and test destinations remain separate decisions.

### Approved P3-U4b policy — October 24, 2026 (+08:00)

The user explicitly approved recommended R-02 in the implementation conversation:
trusted gateway plus associated exact DID or explicit gateway catch-all; exact DID
wins; unmatched numbers reject without a catch-all. Preserve canonical leading
zeros and `+`, without aliases or country inference. Destinations are extension,
ring group or hangup. New rules start disabled. R-03 remains unresolved.

## Desired-state contract

The following structural rules apply regardless of the selected routing policy:

- Each group/rule/reservation has a server UUID, immutable canonical installation
  and node ownership, safe display fields, expected-version edits and actor/time
  attribution. Desired enabled state is distinct from runtime readiness; recommend
  disabled initial group/rule creation. Exact limits/defaults are confirmed above.
- Membership and destinations reference resource IDs, never editable endpoint
  strings, phone-number identities or raw context/application text. Reject missing,
  removed, wrong-kind, cross-node and cross-installation destinations. A gateway's
  DID must actually reference that gateway; an outbound trunk must support outbound.
- Under R-05, unbound definitions may reference platform inventory for planning.
  Disabled members/resources are visibly unavailable; they never become silently
  eligible for apply. Operational tenant binding requires all reachable members
  and destinations to satisfy canonical ownership and eligibility, not just the
  first destination. Do not allocate inventory or accept client-supplied tenant
  authority to make P3-U4 usable.
- Validate the complete fallback graph, including indirect cycles and destination
  edits. Group membership is ordered only when the approved strategy uses order;
  duplicate members reject. Bound graph size and traversal work.
- Validate pattern intersections by the approved grammar and direction/scope.
  Inbound DID precedence and outbound priority are distinct. Disabled definitions
  retain collision claims so enabling cannot expose a hidden conflicting route.
- Validation preview is advisory and reports the evaluated resource versions.
  Every mutation revalidates current dependencies transactionally. Offline PBX
  operation must remain possible; validation makes no live reachability claim.

## Attribution and tenant isolation

Generate `sourceKey`, context hashes, watch identities and runtime attribution
keys internally from trusted installation/route identities. Identity must be stable
across a label edit and different for a replacement route UUID. Never derive
trusted identity from caller ID, a dialled number alone, user-entered tenant IDs
or a browser-supplied context/key. Keep opaque runtime keys out of editable forms.

P3-U4 owns route identity generation and deterministic validation contracts.
Unbound identities have no tenant attribution. P4-U2 must establish exactly one
canonical tenant mapping per ingress binding and validate its reachable ownership;
P3-U5 must preserve the mapping in generated configuration. P5-U3 must authenticate
the event source and reconcile unknown, stale or ambiguous identities without
guessing ownership. Template selection alone grants no tenant access.

Test compatibility rules using explicitly trusted allocation facts at a narrow
boundary. Such fixtures prove rule rejection, not delivered allocation, live call
attribution or tenant readiness. Until real allocation/binding ownership exists,
reject unsupported tenant-binding inputs rather than fabricating successful checks.

## Persistence, dependencies and recovery

- Extend the current telephony module and module-owned PostgreSQL migrations;
  use constraints for ownership/uniqueness and one canonical desired model.
  Commit mutation, membership/destination changes, version, audit and any create
  receipt atomically. Canonical no-ops retain existing no-op behavior.
- Use the existing canonical node lock for dependency/namespace writes. Reconcile
  inventory's existing lock order explicitly before adding group-number and
  reserved-pattern checks; extension/bulk creation must share the same exclusion
  rule. Prove races across two HTTP replicas, not just sequential validation.
- Add blockers to actual resource edit/removal paths: memberships/fallbacks,
  inbound gateway/DID references and outbound trunk references. Block removal or
  structural changes that invalidate those references; do not cascade, silently
  detach or retarget when a number/name is reused. Return bounded actionable
  blocker IDs/names. Define compatible desired-status changes separately from
  structural changes; disabled dependencies prevent apply eligibility.
- Soft removal retains identity/audit and releases only eligible claims. Future
  allocation/apply owners must add real binding, in-flight and rollback dependencies
  before using these IDs. Do not build speculative active-call tables here.
- Reuse expected-version conflicts, operator-scoped request receipts, exact-create
  retry and canonical reload for lost/uncertain responses. Preserve safe inputs;
  offer review before retrying an uncertain edit. Reuse identity-bound mounted
  recovery, without promising refresh-persistent drafts or adding permanent locks
  for ordinary validation/session errors.

## Platform browser journey

From PBX detail, open routing and manage groups, inbound rules, outbound rules
and reservations. Each implementation increment includes its usable list,
create/detail/edit/status/removal workflow and relevant dependency feedback.
Reuse the dark shared UI, safe same-origin proxy and protected backend reads.

Show the group members/order, timeout meaning and fallback; show inbound
gateway/DID matching and outbound priority/pattern/transformation in business
terms. Select existing resources by name/number with availability warnings.
Provide a bounded advisory route preview that explains the winning rule or
rejection and states that unbound routes have no tenant ownership. Previewing
must not originate a call, contact a destination or change configuration.

Lists need loading/empty/error states and bounded pagination. Preserve form values
and focus field errors; provide keyboard access, labelled controls, narrow-screen
reflow and useful stale/version/reference feedback. Label saved work as desired
configuration, and show disabled/unbound/unavailable conditions in text.

## Acceptance and required verification

| ID    | Required working result and evidence                                                                                                                                                                                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Real PostgreSQL/API/browser group management follows approved R-01/R-04/R-05, including membership order, limits, timeouts, graph cycles, duplicate numbers and invalid destinations.                                                                                                                                   |
| AC-02 | Inbound rules enforce approved selectors and exact-versus-catch-all precedence. Test two gateways, wrong-gateway DIDs, duplicate selectors, unknown ingress and significant plus/leading-zero distinctions.                                                                                                             |
| AC-03 | Outbound rules follow approved grammar, transformations and priority. Overlap detection covers equal-priority rejection, permitted ordered overlaps, boundaries, no match and reserved-number intersections.                                                                                                            |
| AC-04 | Same-tenant reachable graphs pass compatibility validation; mixed-tenant members/fallbacks, foreign ingress and unauthorized shared-trunk use reject using trusted allocation fixtures. Actual APIs reject unsupported bindings and supplied opaque attribution keys. Unallocated inventory remains calling-ineligible. |
| AC-05 | Generated route identities are stable across rename, isolated by installation and replaced UUID, and independent of caller/dialled numbers. Unknown/ambiguous identities cannot resolve a tenant. Record the P4/P5 runtime integration still required.                                                                  |
| AC-06 | Concurrent create/edit/reference/removal and extension/group/reservation races across replicas preserve canonical constraints and audit. Rollback publishes no successful mutation; retries, stale writes and lost responses recover through existing conventions.                                                      |
| AC-07 | Actual console completes group → inbound → outbound creation, inspection, preview, edit/status and dependency-ordered removal. Validation, session recovery, wrong-plane/CSRF denial, keyboard use and responsive states work without secret exposure.                                                                  |
| AC-08 | PBX-offline saves/previews work and perform no external effects. Affected inventory/resource/auth regressions and the normal Docker check pass. Publish operator guidance, dependency contracts, commands, evidence limits and the P3-U5/P4-U2/P5-U3 handoff.                                                           |

Use deterministic contract tests plus real PostgreSQL and the actual HTTPS browser
against existing shared sessions; include two HTTP replicas for concurrency/access
claims. Scope external fixtures explicitly. Live call tests are not required for
desired-state completion and cannot substitute for P3-U5's later live acceptance.

The focused routing check established by a and extended by b is
`./dev exec pnpm check:routing`, using isolated real services and the HTTPS browser.
Required existing checks are the affected
`check:extension-inventory`, `check:trunk-gateways` and `check:pbx-nodes` pnpm scripts
inside that workspace, plus `./dev check`. Documentation-only preparation requires
formatting, local-link and consistency review, without starting services or tests.

## Review and adopted implementation split

**Delivery split: three sequential feature increments**, adopted by the user on
October 24, 2026 (+08:00) when requesting the three child specs. Groups,
inbound selection and outbound matching have distinct workflows and failure cases.
Each child should include schema/contracts, backend, browser, focused checks and
documentation for its own usable result. Shared validation belongs with its first
consumer; do not defer all UI or all dependency protection to a final child.

| Implementation unit                                                                                               | Starting state and focused result                                                                                                                                                        | Acceptance ownership                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [P3-U4a — Ring groups and reserved-number protection](p3-u4a-ring-groups-and-reserved-number-protection.md)       | Completed P3-U2/U3; R-01/R-04/R-05 resolved. Deliver group/member/fallback management, reservations and extension/group namespace races, destination validation and browser workflow.    | AC-01; group/reservation portions of AC-04–08.                             |
| [P3-U4b — Inbound rules and trusted route identities](p3-u4b-inbound-rules-and-trusted-route-identities.md)       | Verified a; R-02 resolved. Deliver gateway/DID selectors, inbound destinations, attribution identities, actual ingress dependency blockers and browser preview/management.               | AC-02/05; inbound portions of AC-04/06–08.                                 |
| [P3-U4c — Outbound rules and integrated routing handoff](p3-u4c-outbound-rules-and-integrated-routing-handoff.md) | Verified a/b; R-03 resolved. Deliver outbound grammar/precedence/transforms, reserved-pattern intersections, trunk blockers and browser workflow; reconcile the complete parent journey. | AC-03; outbound portions of AC-04/06–08 and final AC-01–08 reconciliation. |

Review findings: desired templates must not bypass unallocated-inventory denial;
existing resource removal checks must gain actual routing references; reservations
must participate in extension bulk creation; generated identities must not imply
tenant ownership before P4-U2. These requirements are included above. No separate
credential, backup, infrastructure or security-certification sub-unit is needed.

All three child specs are created. P3-U4a is completed within approved private
development under the explicit R-01/R-04/R-05 policy recorded above;
[A-01–06 evidence](../../docs/status/p3-u4a-evidence.md) and the operator/dependency
handoff are published. P3-U4b B-01–06 are completed under approved R-02;
[inbound evidence](../../docs/status/p3-u4b-evidence.md) and the shared
[identity/dependency contract](../../docs/architecture/inbound-routing.md) hand off
to c. R-03 remains unresolved and c is planned. Parent
P3-U4 remains incomplete until every parent criterion passes. Routing-policy
approval, implementation, live apply and production readiness are separate states.
