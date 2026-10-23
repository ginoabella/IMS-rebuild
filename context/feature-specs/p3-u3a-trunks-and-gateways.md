# P3-U3a — Trunks and gateways

Status: **complete**, 2026-10-23 10:29 +08:00 (Asia/Manila), within approved private-development IP-peer scope.
[A-01–05 evidence](../../docs/status/p3-u3a-evidence.md) records the real PostgreSQL,
API/browser, regression and normal-check results. Replacement approved October 23,
2026 (+08:00). Parent P3-U3 remains incomplete.

Parent: [P3-U3 development delivery](p3-u3-development-resource-management.md).
The parent owns shared resource rules and DEV-01–07. This child replaces the old
a scope: it delivers a usable IP-peer feature, including its browser, before
credential setup or DID management. Archived child requirements do not apply.

## Goal and starting point

An authenticated platform operator can create, inspect, edit, enable/disable and
remove unused IP-peer trunks and gateways from the existing console.

Reuse the PBX registry's canonical installation identity, existing telephony
module, PostgreSQL repositories/migrations, platform sessions, transaction audit
and UI primitives. Inspect actual interfaces before coding. Do not wait for the
unfinished credential owner, backup repair or operational hardening work.

## Scope

- Define the minimum typed contracts, tables, constraints and APIs for parent
  trunk/gateway fields, directions, connection settings and exact source addresses.
- Implement bounded lists/details, idempotent create, expected-version edits and
  status changes, and soft removal with actor audit in the same transaction.
- Enforce installation ownership, names/source uniqueness and valid relationships.
  A provider gateway needs a same-installation inbound-capable trunk; a device
  gateway can be standalone. Existing gateway references block trunk removal or
  an incompatible structural edit. Disabled records still count as references.
- Add PBX navigation and actual list/create/detail/edit/status/removal screens.
  Show validation and blocker messages, preserve safe input on rejection and
  provide canonical reload/review for stale or uncertain outcomes.
- Support IP-peer only in this increment, with credential status `not_required`.
  Digest and registration choices remain unavailable until b implements them.
- Keep a narrow reference-validation/removal check that c can extend for DIDs.
  Check actual current dependencies; do not build speculative future-owner tables.

Follow the parent's simple desired-state enabled flag. It does not require a
live probe or a circular gateway/trunk activation sequence. Save never performs
DNS resolution, provider access, PBX writes, registration, reload or calls.

## Acceptance

| ID | Working result / verification |
| --- | --- |
| A-01 | Real PostgreSQL CRUD, versions and actor audit work for valid trunks and both gateway kinds; malformed settings, cross-installation links, duplicate sources/names and unsupported auth reject. |
| A-02 | Duplicate creates, stale edits, audit failure and reference-versus-removal races preserve one consistent result. Soft removal retains history; referenced trunks cannot be removed or made incompatible. |
| A-03 | Actual platform console completes create/list/detail/edit/enable/disable/removal. Validation, stale reload and blockers are actionable; basic keyboard access and narrow-width layout work. |
| A-04 | Existing platform permissions/session/CSRF behavior holds on API and browser paths. Wrong-plane/unauthorized requests reject; reads remain passive and outputs contain no secrets. |
| A-05 | PBX-offline desired management works; saves have no live effects or connected/applied/readiness claims. Focused real-service checks, affected regressions and the normal repository check pass. |

Owns DEV-01 and the trunk/gateway portions of DEV-04–07. Record actual commands,
results and fixture boundaries; documentation preparation is not a runtime pass.
Use real PostgreSQL and the real browser/API path, reusing existing session and
multi-replica checks where affected. No backup/recovery certification prerequisite.

## Handoff

[b](p3-u3b-simple-trunk-credentials.md) extends these same records/forms with
credential selection. [c](p3-u3c-did-inventory-and-integration.md) adds DID
references to gateway edit/removal checks and completes parent acceptance.
Publish stable DTOs, expected-version/error behavior and the working operator
workflow. a can complete as an IP-peer feature; parent P3-U3 remains incomplete.
