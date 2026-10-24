# P3-U4b — Inbound rules and trusted route identities

Status: completed within approved private development, 2026-10-24 18:36 +08:00 (Asia/Manila).
R-02 was explicitly approved by the user; B-01–06 passed.
[Final evidence](../../docs/status/p3-u4b-evidence.md),
[operator workflow](../../docs/runbooks/inbound-routing.md) and
[identity/dependency contract](../../docs/architecture/inbound-routing.md).
Sub-unit specification created October 24, 2026 (+08:00); parent acceptance,
actual tenant bindings and live routing remain incomplete.

Parent: [P3-U4 — Ring groups and dial plans](p3-u4-ring-groups-and-dial-plans.md).
Predecessor: [P3-U4a — Groups and reservations](p3-u4a-ring-groups-and-reserved-number-protection.md).
The parent owns shared invariants, routing-policy decisions and AC-01–08.

## Goal and starting state

The operator defines and previews desired inbound routing from trusted gateways/
DIDs to explicit destinations in the console. Trusted route identities are generated
internally and remain separate from phone numbers and future tenant ownership.

Start only after a's A-01–06 are verified. Reuse its groups, reservations,
destination/fallback validation, transactions, versions, recovery and browser
navigation, plus P3-U3's actual gateway/DID resources and dependency checks.
Tenant allocation/bindings, live configuration and operational call ingestion do
not yet exist and are not delivered by this child.

## Decisions and dependencies

R-02 is explicitly user-approved and recorded in the parent and tracker:
trusted gateway/associated exact DID or explicit catch-all, exact DID first,
canonical number distinctions, extension/group/hangup destinations and initially
disabled rules. Carry forward a's resolved R-01/R-04/R-05.

P3-U3's canonical DID distinctions are established: leading zeros and `+` remain
significant, with no country inference. If a different routing normalization is
approved, specify explicit aliases/collision behavior before implementation;
do not silently change inventory normalization or migrate saved DID identities.

## Scope and expected result

- Add telephony-owned desired inbound-rule persistence, constraints, typed contracts
  and protected bounded list/create/detail/edit/status/soft-removal APIs. Rules
  reference a canonical gateway and approved DID selector, with an extension,
  group or hangup destination as decided under R-02.
- Validate that selected DIDs actually belong to the gateway and all references
  share the canonical installation/node. Reuse a's complete reachable-destination
  checks; unknown/removed/wrong-kind resources reject. Disabled dependencies are
  visible and prevent eligibility for eventual apply.
- Enforce the approved selector uniqueness and precedence, including disabled
  desired claims. An advisory preview accepts a trusted gateway selection and
  sample dialled value, explains the winning rule/rejection and reports evaluated
  versions. A number alone never establishes trusted gateway or tenant identity.
- Add actual inbound dependencies to DID/gateway/group edit and removal checks,
  including disabled rules. Protect selector-changing DID edits and gateway
  structural edits that would invalidate references. Compatible edits retain
  intended behavior; no cascade, silent detach or rebinding by reused number/name.
- Generate internal route identities from trusted installation/route identity,
  stable across label edits and distinct for replacements. Own the common identity
  generator here so c can reuse it for outbound rules. Reject client-supplied
  `sourceKey`, context hashes, watch identities and runtime attribution keys;
  keep opaque keys out of editable forms and ordinary browser DTOs.
- Expose a narrow internal identity/compatibility contract for later trusted
  consumers. Unbound routes resolve no tenant. Unknown, stale, conflicting or
  ambiguous mapping facts fail closed; no phone-number fallback. Validate trusted
  tenant binding facts across ingress and every reachable destination using
  explicit fixtures, without inventing allocation tables or a live event adapter.
- Commit rule/reference/identity/version/receipt/audit atomically under established
  node serialization. Preserve expected-version, no-op, exact-create retry and
  canonical reload behavior across replicas and lost responses.
- Deliver actual inbound list/forms/detail/status/removal and preview in the existing
  routing console. Show gateway/DID associations, destination, precedence and
  desired/unbound/unavailable states. Preserve safe form inputs and operator-bound
  session recovery; support keyboard use, responsive layout and actionable blockers.

No Asterisk connection, compiler, live tenant context, call initiation, event
ingestion or readiness claim is permitted by a save or preview. Existing peer
credentials and provider access are unchanged.

## Acceptance and required checks

| ID   | Required working result and evidence                                                                                                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Real PostgreSQL/API/browser inbound CRUD/status/removal follows approved R-02. Cover two gateways, associated/wrong-gateway DIDs, exact/catch-all precedence, duplicate selectors, disabled claims, unknown ingress/no match and significant number distinctions.                                                                            |
| B-02 | Invalid destinations and fallback graphs reject. Actual DID/gateway/group edit/removal blockers include disabled inbound references; concurrent rule-create/reference-edit/removal across replicas cannot leave dangling or silently retargeted routes.                                                                                      |
| B-03 | Generated identities are stable across rename and isolated by installation and replacement UUID. Caller-ID/dialled-number changes do not confer authority. Supplied opaque keys reject; unbound/unknown/stale/ambiguous identities yield no tenant attribution. Label fixture-only mapping checks and future runtime integration explicitly. |
| B-04 | Trusted facts permit same-tenant ingress/reachable destinations and reject foreign ingress or mixed-tenant members/fallbacks. Actual APIs deny unsupported tenant-binding input, and unallocated inventory remains calling-ineligible.                                                                                                       |
| B-05 | Actual console completes inbound creation, inspection, preview, edits/status and dependency-ordered removal. Existing platform/session/CSRF protections, field errors, input retention, stale/lost-response recovery, keyboard access and responsive states pass. PBX-offline operation has no external effects or secret exposure.          |
| B-06 | Focused real PostgreSQL/two-replica/API/browser checks, affected a/resource/inventory/PBX regressions and `./dev check` pass. Record atomic audit/replay/no-op/rollback evidence and publish actual operator commands, identity/dependency contracts and integration limits.                                                                 |

Owns parent AC-02/05 and inbound portions of AC-04/06–08. Use the parent's Docker
check procedure and extend a's focused routing check. Real HTTP/DB/browser evidence
is required; deterministic identity/ownership fixtures prove their declared boundary
and do not prove live call attribution.

## Completion and handoff

Complete b only when B-01–06 pass and the tracker links reproducible evidence.
Hand c inbound management/preview, shared internal identities and actual dependencies.
P4-U2 must supply real tenant bindings and ownership checks; P3-U5 must compile and
preserve trusted mappings in verified configuration; P5-U3 must authenticate and
reconcile real events. Parent P3-U4 remains incomplete pending c and final acceptance.
