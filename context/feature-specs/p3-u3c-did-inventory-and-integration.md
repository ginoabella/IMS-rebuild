# P3-U3c — DID inventory and integration

Status: planned; replacement sub-unit approved October 23, 2026, Asia/Manila
(+08:00). Follows [a](p3-u3a-trunks-and-gateways.md) and
[b](p3-u3b-simple-trunk-credentials.md).

Parent: [P3-U3 development delivery](p3-u3-development-resource-management.md).
This c adds DID management and completes the already usable resource screens;
it is not the old browser-only child. The parent owns shared rules and DEV-01–07.

## Goal and starting point

The platform operator can manage DID numbers and gateway associations, then
complete the whole trunk/gateway/DID console journey with useful collision and
dependency feedback.

Start from a/b's working APIs, forms and simple credential references. Reuse their
transactions, versions, audit, platform access and soft-removal conventions.

## Scope

- Implement DID schema, constraints, bounded CRUD/status/removal APIs and actual
  list/create/detail/edit/status/removal forms under PBX navigation.
- Apply the parent's exact normalization: strip presentation spaces/hyphens/
  parentheses, preserve leading zeros and `+`, and accept 1–15 ASCII digits with
  an optional leading `+`. No country-code inference. Show canonical values/help.
- Enforce one nonremoved canonical number per installation, including disabled
  records. Multiple DIDs may share a gateway; links remain same-installation.
- Add actual DID references to a's gateway edit/removal checks. A referenced
  gateway cannot be removed or made incompatible. Do not cascade or silently
  detach DIDs. Existing gateway-to-trunk blockers remain effective.
- Allow eligible desired-only resource soft removal with retained IDs/audit.
  Reuse names/numbers only through new identities. Later consumers must add their
  real dependencies before live use; do not invent missing routing/call modules.
- Finish navigation and user feedback across all three resource types. Preserve
  safe values on validation rejection; handle stale/uncertain results through
  request-ID or canonical reload/review conventions already delivered in a/b.

No tenant allocation, route destinations, number purchasing, inbound routing,
live call tests, PBX apply or production operational readiness is delivered here.

## Acceptance

| ID | Working result / verification |
| --- | --- |
| C-01 | Real PostgreSQL/API/browser DID create/read/edit/status/removal follow normalization and same-installation gateway rules. Formatting-equivalent numbers collide; retained leading-zero/plus distinctions match the parent. |
| C-02 | Duplicate creation and reference-versus-removal races preserve constraints/audit. Referenced gateways/trunks reject unsafe removal/edit with useful blockers; removing an eligible DID allows the appropriate later removals. |
| C-03 | Actual console completes trunk → gateway → DID creation, inspection, edits, status changes and dependency-ordered removal, including digest selection from b. Validation/stale/blocker feedback and keyboard/responsive behavior work. |
| C-04 | Existing platform access/session behavior holds, cross-installation and unauthorized requests reject, and outputs remain secret-free. PBX-offline saves have no live effects or readiness claims. |
| C-05 | Integrated evidence reconciles every parent DEV-01–07, reruns affected a/b checks and regressions, and passes the normal repository check. Operator guidance records actual commands, limitations and later routing/apply handoffs. |

Owns DEV-03 and final DEV-01–07 reconciliation. Use real services and the actual
browser; identify fault fixtures and evidence limits. Do not reintroduce exhaustive
security certification, backup scheduling or disaster recovery as acceptance gates.

## Completion and handoff

Complete parent P3-U3 only when a/b/c and all parent DEV criteria pass. Publish
the usable operator workflow and resource/reference contracts for P3-U4 routing,
P3-U5 apply and P4 tenant allocation. Desired records, enabled flags and successful
credential setup are not evidence of live connectivity or tenant voice readiness.
