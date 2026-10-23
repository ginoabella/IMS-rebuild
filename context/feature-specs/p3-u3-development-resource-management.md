# P3-U3 — Trunks, gateways and DIDs: development delivery

Approved direction: October 23, 2026, Asia/Manila (+08:00). The owner explicitly
approved simplifying the design, prioritizing a working platform and moving
unnecessary security/operational complexity out of this feature. The owner also
authorized archiving superseded documentation. P3-U3 and a/b/c completed within approved private development on 2026-10-24
(+08:00); [final DEV-01–07 evidence](../../docs/status/p3-u3c-evidence.md) records
the runtime acceptance boundary. This document defines the requirements.

## Authority and goal

This is the replacement P3-U3 parent specification. Its current a/b/c children
replace the earlier a/b/c and a-1 credential-lifecycle scopes. It takes precedence over those historical documents
and their linked design reviews for current development. Earlier execution records
remain historical evidence; consumed approvals cannot be replayed.

Deliver a working platform-console journey to create, view, edit, enable/disable
and remove desired trunks, gateways and DIDs. Use the existing NestJS backend,
PostgreSQL, shared platform sessions and Next.js console. Keep the running OpenBao
installation and use ordinary trusted administration for credential setup.

P3-U3 saves desired settings. P3-U4 owns routing, P3-U5 owns compilation/live apply
and verification, and P4 owns tenant allocation/readiness. Saving or enabling a
definition does not connect a carrier, reload Asterisk or make a tenant voice-ready.

## Practical baseline

- Keep platform sign-in and current permissions, node/installation ownership,
  existing CSRF/session behavior and basic secret redaction. Environment/network
  controls supplement these application checks; they cannot replace record ownership.
- Validate typed fields and references; use database constraints, expected versions,
  normal transactions and existing actor audit. Preserve existing working features.
- Keep credentials in OpenBao and out of resource responses, logs and browser state.
  Supply credentials through a trusted setup command; resource forms select a label.
- Use one practical human development administrator and only the service identities
  actually needed. Routine administration must have a documented supported path,
  without recovering root for ordinary configuration changes.
- Backups and operational hardening are a separate workstream. Their readiness,
  rotation automation, joint restore and measured RPO/RTO do not gate desired CRUD.

Production deployment, live PBX changes, deletion of retained backups and broad
administrative changes to existing services are not performed by this spec edit.
Their actual implementation needs a concrete migration consistent with this model.

## Resource behavior

Every resource has a server UUID, canonical installation/node association, name,
enabled flag (default false), integer version, timestamps and actor attribution.
Installation association is immutable. Names are trimmed, 1–80 characters, and
case-insensitively unique per installation/resource type among nonremoved records.
Reject controls, malformed text, unknown fields and raw configuration fragments.

| Resource | Initial behavior |
| --- | --- |
| Trunk | External SIP connection; direction `inbound`, `outbound` or `both`. Typed remote host/IP, SIP port, supported transport/media/codecs and authentication choice. No tenant assignment or outbound permission implied. |
| Gateway | Inbound SIP source: `sip-provider` linked to one inbound-capable trunk, or `sip-device` optionally standalone. Same-installation links only. Exact IP source addresses identify ingress; labels/caller ID never establish source identity. |
| DID | Called-number inventory linked to one gateway on the same installation. Multiple DIDs can share a gateway. No route destination or tenant allocation is stored here. |

Preserve the accepted basic private-development profile: UDP/RTP, codecs `ulaw`
and/or `alaw`, direct media false, symmetric RTP and force-rport true. Other
transports/media can be added when their real consumer supports them. Operators
enter typed connection settings directly; a separately maintained deployment
selection catalog and per-selection capability attestations are not prerequisites.
Validate a host/IP and numeric port, not an arbitrary URL or configuration string.
Saving performs no DNS lookup, network probe or PBX access.

Gateway source addresses are canonicalized IPv4/IPv6 host addresses. Reject overlap
between nonremoved gateways on the same installation, including disabled records.
Reserve known unmanaged ingress supplied by the existing deployment configuration.
No wildcard/header/caller-ID source matching or automatic adoption of unmanaged PBX
objects. Later apply validates actual coexistence with the PBX configuration.

IP-peer authentication requires no credential and reports `not_required`.
Outbound digest uses a selected credential reference. Optional outbound registration
is desired configuration only, requires digest and explicit registrar/realm, and
retains the previously selected 3600/60/10 registration/retry settings. No inbound
digest or other authentication scheme is implied. An enabled flag expresses operator
intent; it is not a readiness state or a mutually dependent activation protocol.

### DID normalization

Trim outer whitespace and remove ordinary presentation spaces, hyphens and
parentheses. Accept an optional single leading `+` followed by 1–15 ASCII digits.
Preserve leading zeros and the presence of `+`; do not infer country codes or
equivalence between national and international forms. Match the resulting canonical
string exactly. Document this behavior beside the form.

Enforce one nonremoved DID per canonical installation/number, regardless of gateway
or enabled state. The same number on different installations is allowed. Examples:
`+63 (2) 8123-4567` and `+63281234567` collide; `0281234567` is a distinct explicit
form. Future routing must deliberately handle any desired alternate-number forms.
Changing a number or ingress uses the same reference/version checks as other edits.

### Edits, removal and failure handling

Use existing bounded list/create/detail/edit/status/removal API conventions.
Creates reuse the established request-ID/idempotency pattern. Changes and audit
commit together. Reject stale versions, invalid links and duplicate identities
with useful errors; a canonical no-op does not create a business change.

Removal is soft removal with retained IDs/audit. Block currently implemented
references: DIDs referencing a gateway and gateways referencing a trunk. Show
actionable blockers; do not cascade or silently detach references. Serialize
reference creation and removal using the existing transaction/locking pattern.
Removed names/numbers may be reused by a new UUID; old references never retarget.

New records in this unit are desired-only and cannot have been applied by this
unit. Their removal does not need speculative active-call/rollback/tenant checks
from modules that do not yet exist. Before later modules use these resources,
those modules must register their real dependencies and block removal accordingly.
Any actual known applied/allocated use must block destructive structural changes;
this is not permission to fabricate empty dependency results for existing consumers.

Reads remain passive. If a write response is lost, use its existing request ID or
reload canonical state. Ordinary validation/login failures are recoverable after
correction. Do not introduce a permanent workflow lock for every failure. Keep a
reconciliation fence only when a write's effect is genuinely unknown; provide a
supported diagnosis/resume action for that case. No silent destructive retry.

## Simple credential setup

A trusted development command imports/updates trunk material in the existing
OpenBao trunk namespace and records selectable nonsecret metadata in PostgreSQL.
Reuse existing owner storage/helpers where practical; do not require the unfinished
reservation/attestation/cleanup-worker system to be completed first.

The application needs a stable credential ID, label, installation, supported auth
purpose, actual material version and administrative availability. The setup command
must confirm storage before publishing a selectable version. An incomplete import
reports a useful error and cannot appear successfully configured. An uncertain
provider write is reconciled against its exact identity before another write.

Resource saves validate the selected ID/version, installation, purpose and active
metadata in their normal database transaction. No 60-second owner proof, separate
claim/adoption handshake, generation ordinal or extra database attestation identity
is required. Adopt a different credential version through an explicit versioned
resource edit; existing definitions retain their selected version.

Use the existing OpenBao KV versioning and retain versions referenced by definitions.
No automatic credential destruction or orphan-cleanup worker is needed for P3-U3.
HTTP and Next do not need OpenBao access or receive material. The trusted setup
command and later actual apply consumer are the only new material consumers.

Development service credentials should have a practical operator-managed lifetime
with expiry warnings and a supported replacement command. Fresh workload login on
token expiry is ordinary operation; a token-renewal protocol is not a feature
prerequisite. Verify actual issued lifetimes against mount limits during setup.
Choose concrete lifetimes in runtime configuration during that implementation,
rather than making exact short-lived token limits a P3-U3 acceptance goal.

## Delivery and acceptance

The owner approved the following replacement sub-units on October 23, 2026
(+08:00). Each includes its backend, browser work and acceptance; browser delivery
is not postponed to a final browser-only unit. This parent owns shared rules and
overall DEV acceptance; children own their scope, checks and handoff.
Old child names/acceptance IDs are historical and do not map to the new scopes.

| Increment | Deliver and demonstrate |
| --- | --- |
| [P3-U3a — Trunks and gateways](p3-u3a-trunks-and-gateways.md) | Working IP-peer trunk/gateway APIs and browser forms, including edit/status and unused soft removal. DEV-01 and resource portions of DEV-04–07. |
| [P3-U3b — Simple trunk credentials](p3-u3b-simple-trunk-credentials.md) | Trusted OpenBao setup/replacement command and credential selection in the existing trunk forms. DEV-02 and credential portions of DEV-04–07. |
| [P3-U3c — DID inventory and integration](p3-u3c-did-inventory-and-integration.md) | DID APIs/browser, gateway associations/collisions, extended dependency removal and the integrated operator journey. DEV-03 and final DEV-01–07 reconciliation. |

| Criterion | Required evidence |
| --- | --- |
| DEV-01 | Real PostgreSQL CRUD, constraints and audit work for valid trunks/gateways; invalid combinations, cross-installation links, duplicate sources and stale writes reject. |
| DEV-02 | Real trusted OpenBao setup publishes a selectable credential version; missing/unavailable references fail clearly. Saved responses/logs do not expose secrets. IP-peer has no credential requirement. |
| DEV-03 | DID normalization, uniqueness, ingress changes and soft removal behave as defined, including duplicate/reference races and retained audit. |
| DEV-04 | Existing platform authentication and permission checks apply on the actual API/browser path. Wrong-plane/unauthorized changes reject. Version conflicts and lost responses have usable recovery. |
| DEV-05 | Actual console journey creates, inspects, edits, disables and removes eligible resources, with useful validation/blocker states and basic keyboard/responsive behavior. |
| DEV-06 | Saves work with PBX offline and cause no live apply/call/registration. No desired save is labelled connected, applied or voice-ready. |
| DEV-07 | Focused real-service tests, affected regressions and the normal repository check pass. Include existing multi-replica transaction/session coverage where the change affects it; do not create a separate exhaustive security certification gate. |

Do not remove tests for still-required behavior to obtain a pass. Update tests
that encode explicitly superseded requirements and record why. Functional failures
that affect delivered workflows remain failures; deferred hardening findings are
not retrospectively marked fixed. Parent completion requires the working browser
and all DEV criteria, not completion of backup administration.

## Transition and cleanup

Retain databases, OpenBao, credentials, working backups and existing endpoint flows.
Reuse useful code; leave unfinished legacy workers inactive. Do not drop tables,
delete secrets or remove runtime scripts merely because their old spec is archived.
During implementation, retire an unused component only after checking actual
callers/deployment and providing a concrete reversible change.

Archive superseded design/review documents with an index and repair links. Keep
machine evidence, source-hash-bound documents and operational key locations intact.
The existing pending backup operation stays preserved. Its TTL bug and manual
recovery are an operations follow-up, not a reason to block independent feature work.
The Windows owner archive-decryption check is complete; scheduling and retained
routine backup acceptance remain incomplete. No new root-recovery package is the
next P3-U3 task.

P3-U3a's IP-peer API/browser is complete within private development; see its
[acceptance evidence](../../docs/status/p3-u3a-evidence.md). P3-U3b's simple
credential setup/selection is also complete within private development; see its
[final evidence](../../docs/status/p3-u3b-evidence.md). P3-U3c DID/integration and
parent DEV-01–07 acceptance are complete within approved private development; see
[final integrated evidence](../../docs/status/p3-u3c-evidence.md). Production security,
automated backup rotation, continuous audit collection and disaster-recovery
acceptance remain explicit later operational work.
