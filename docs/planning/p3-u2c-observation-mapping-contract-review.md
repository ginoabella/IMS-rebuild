# P3-U2c runtime mapping and controlled acceptance — review for approval

Prepared 2026-10-16 (Asia/Manila, +08:00). **Status: conditionally approved by the user, 2026-10-16 (Asia/Manila, +08:00).**
Approval authorizes implementation and controlled private-development verification, not an acceptance pass.

Decision owner: user, under D-09 and [parent G-03](../../context/feature-specs/p3-u2-extension-inventory-and-endpoint-profiles.md#decisions-required-before-dependent-implementation).
Requirement: [P3-U2c C-01–07](../../context/feature-specs/p3-u2c-operator-inventory-browser-and-integrated-handoff.md),
especially C-03/C-04 and parent AC-07/08.

## 1. Decision requested

Approve sections 2–6 for controlled private development on the existing approved
Asterisk installation. Sections 7–8 describe the implementation and verification
that would follow approval. This resolves c's remaining G-03 mapping/access gate;
it does not complete c or the parent.

| Decision | Proposed value | Practical effect |
| --- | --- | --- |
| G03-01 identity | Exact canonical node, permanent installation UUID and stored generated endpoint key | A number, display name, alias or contact cannot establish an inventory match |
| G03-02 coexistence | Keep unmanaged endpoints, trunks and public ingress outside inventory; block on an unexplained generated-namespace collision | Existing runtime configuration is never adopted, overwritten or removed to obtain a pass |
| G03-03 coverage | Reuse fenced PJSIP dynamic-contact projection and backend freshness authority | Only current, complete, covered facts can establish registered/unregistered status |
| G03-04 controlled fixtures | Allow exact, temporary, no-call endpoint/auth/AOR fixtures for disposable inventory identities, using independent random test passwords | Prove positive/negative mapping without applying inventory profiles or delivering b's credentials |
| G03-05 trusted test operations | Permit fixture-only PJSIP reloads and one bounded controlled PBX stop/start for outage acceptance, with restoration | These operations belong to the trusted acceptance launcher; HTTP/browser/observer permissions stay unchanged |
| G03-06 evidence and cleanup | Record exact safe identities, live versus injected results, owned-resource cleanup and restored runtime health | Missing live/browser evidence or incomplete cleanup keeps acceptance incomplete |

The main tradeoff is temporary disruption of the existing development Asterisk
while loading/removing fixtures and exercising outage recovery. Run acceptance
exclusively, with no operational calls or concurrent observation fixture suite.
The fixture's SIP authentication proves observation behavior only. It does not
prove that saved endpoint profiles, b's desired credentials, WebRTC media or
future tenant routing work in Asterisk.

Suggested approval wording:

> Approve sections 2–6 and G03-01–06 of the P3-U2c runtime mapping and controlled acceptance review for the existing private development installation. Proceed with implementation and verification under sections 7–8. Keep production, credential delivery, inventory live apply and tenant calling readiness separately gated.

Approval may include amendments. Record the user's exact scope and date here
before dependent implementation; do not treat preparation or silence as approval.

## 2. Existing approvals and target boundary

Retain the existing installation UUID and approved catalog target for the private
Compose Asterisk 22.10.1. Resolve its exact identity through the deployment-owned
catalog and canonical registry when acceptance starts; do not invent another
installation UUID to bypass an existing registry record. Evidence must identify
the exact node/installation pair, catalog alias and pinned runtime version used.
A disposable acceptance database may hold a test registry row for that same
installation; it does not change the ordinary database's canonical ownership.

Existing approvals remain authoritative:

- [a's G-01 and generated namespace approval](p3-u2a-inventory-contract-review.md): number policy, node-scoped immutable profiles, disabled/unallocated new stock and generated identities.
- [b's conditional G-02 approval](p3-u2b-credential-contract-review.md): asynchronous setup/reset/status, retained generations, private provider access and no recipient delivery.
- [P3-U1b observation policy](p3-u1b-observation-contract-review.md): verified AMI-TLS, action allowlist, development timing/bounds and the acknowledged broader upstream `system` permission.
- [P3-U1c browser contract](../architecture/pbx-browser.md): canonical authority, narrow forwarding, passive reads and mounted same-operator recovery.

Reuse the existing services, networks, TLS verification and protected material.
No new service, observer, management listener, AMI grant or provider identity is
requested. Do not print catalog-private addresses, raw configuration or secrets
in approval/evidence documents. Preserve every file in
[reference/asterisk_config](../../reference/asterisk_config/) unchanged.

## 3. Exact identity and collision handling — G03-01/02

For a canonical inventory row, remove UUID hyphens and lowercase hexadecimal.
The approved internal keys remain:

| Object | Exact key |
| --- | --- |
| Endpoint | `ims-e-<installationUuidWithoutHyphens>-<extensionUuidWithoutHyphens>` |
| Auth | `ims-a-<installationUuidWithoutHyphens>-<extensionUuidWithoutHyphens>` |
| AOR | `ims-r-<installationUuidWithoutHyphens>-<extensionUuidWithoutHyphens>` |

Each key is 71 ASCII characters. Join only the row's canonical node/installation
and exact stored endpoint key against observations from that same node. Auth/AOR
keys are internal consistency/collision checks, not alternate observation lookup
fields. Reject inconsistent identity bindings; never fall back to number matching.
Generated keys remain absent from browser inputs and inventory transport DTOs.

Before installing any acceptance fixture, inspect the controlled target through
trusted deployment access. Establish that every proposed endpoint/auth/AOR key is
absent and record the exact owned key set in a private fixture manifest. A matching
key that predates this manifest is a collision, even if its number or settings
appear compatible. Stop dependent mapping acceptance, preserve the existing
objects, record a safe conflict and require investigation. Do not rename existing
objects, choose replacement inventory identities automatically or infer ownership.

Numbered reference endpoints, differently qualified generated keys, trunks,
public ingress and identifiers without a canonical inventory association remain
unmapped. An unexplained object in the installation's generated namespace blocks
coexistence acceptance until resolved. The manifest authorizes only test fixture
provenance; it is not a new production ownership or apply ledger.

Matching identity establishes which runtime fact is being presented. It cannot
prove who installed that configuration, its desired/profile/credential generation
or tenant calling eligibility. P3-U5 must repeat collision checks and establish
live installation/version provenance before actual application.

## 4. Registration meaning and independent desired state — G03-03

Reuse [the shared passive projection](../architecture/pbx-observation.md).
Compose bounded inventory pages on the backend, with inventory identity and node
projection read consistently. Read each node projection once per page rather
than querying Asterisk or opening a connection per extension. Preserve desired
node version, epoch, sequence, ownership, reconciliation, coverage and age.
The existing 30-second database-time freshness authority remains unchanged.

| Observation condition | Required presentation |
| --- | --- |
| Fresh complete covered snapshot, current node version and ownership, exact endpoint with dynamic contact | Observed registered; show contact counts and observation age separately |
| Same qualification, exact endpoint present with zero dynamic contacts | Observed unregistered; endpoint present, zero dynamic contacts |
| Same qualification, exact endpoint absent | Endpoint absent from covered snapshot; no observed registration, not installed by this save |
| Reachable node and complete covered snapshot with zero dynamic contacts across all endpoints | Successful empty registration result; distinguish endpoint presence from contact absence |
| Partial/unsupported coverage, reconciling, disconnected, missing/lost ownership, old node version/epoch, missing or stale snapshot | Explicit unknown, historical or stale registration; retained facts cannot establish current absence or health |
| Unmanaged endpoint or number-only match | Unmapped; never create inventory or infer a tenant |

Only complete covered snapshots may establish absence. A failed/truncated list
must not become an empty healthy snapshot. Client elapsed time may demote a
previously current result; it cannot promote unknown/historical data. Reload must
preserve the backend's uncertainty rather than infer unregistered from no row.

Keep availability, desired administrative status, safe credential status and
registration separate. Profile/credential saves do not make an old registration
verify new generations. Disable/reset does not claim disconnection or old-password
revocation. Valid inventory/profile management remains available during PBX-only
outage when database/session dependencies are healthy. No observation grants
allocation, assignment, readiness or credential access.

## 5. Isolated acceptance fixtures and allowed operations — G03-04/05

Use disposable PostgreSQL/runtime-grant and shared-session Redis fixtures with
independent HTTP A/B and the existing secure platform browser harness. Bind all
test records and process controls to one unique acceptance run. Establish a
trusted exclusive fixture lock before touching the controlled Asterisk; fail if
another suite owns the target or the fixture include contains unowned data.
The existing launcher uses `/tmp/myims-pbx-fixture.conf`; extending it must not
overwrite another run's file. Do not run observation suites concurrently.

Perform these steps through trusted acceptance tooling, never product requests:

1. Record a safe baseline of unmanaged endpoint/auth/AOR identities and routing
   invariants without retaining secret-bearing configuration. Create disposable
   inventory through real protected APIs. Inspect that saving individual/bulk,
   profile, credential and desired-state changes installed no endpoint/auth/AOR
   or usable route. Keep this evidence separate from later fixture installation.
2. Select exact disposable SIP inventory identities, prove all their generated
   keys absent, and record fixture ownership. Install minimal endpoint/auth/AOR
   sections in the owned fixture include. Use a dedicated no-call context with
   no reachable dialplan entries, no tenant context, no public ingress, no trunk
   association and no outbound route. Do not create a dialplan or make calls.
3. Generate independent random fixture-only passwords in trusted test tooling.
   They are not b's provider material or an approved delivery mechanism. Confine
   them to protected fixture configuration and private REGISTER test processes;
   exclude them from HTTP/web, URLs, screenshots, logs and published evidence.
   Preserve HTTP/observer/ordinary-worker exclusion from the endpoint provider.
4. Run the existing bounded fixture-only `module reload res_pjsip.so` operation
   for installation/removal. Use private SIP REGISTER and expiry-zero clients
   to establish exact registered, endpoint-present/unregistered and empty-contact
   cases. Preserve the approved `removeExisting=false` policy; do not silently
   change the saved profile to accommodate a fixture. Record any fixture settings
   separately from desired profile settings.
5. Leave an unrelated no-call endpoint unmapped and verify that even an identifier
   resembling an inventory number cannot match. Collision/foreign-installation
   and malformed identity faults use isolated fixtures without overwriting
   existing target objects. Verify ordinary unmanaged identity/routing invariants
   remain unchanged after setup and cleanup.
6. Exercise one controlled Asterisk stop/start with restoration to prove PBX-only
   outage behavior and fresh reconciliation. Use deterministic isolated snapshot,
   epoch/version/ownership and response-loss controls for other fault cases;
   label those results injected. Reuse previously approved regression fixture
   controls within their original scope. No new observer account rotation or
   general configuration/reload command surface is introduced by c.

The positive live registration proof is PJSIP/SIP dynamic-contact observation.
WebRTC inventory/profile creation and UI coverage remain required, but these
fixtures do not prove WSS signaling, DTLS-SRTP, ICE/media, real WebRTC client
registration or the approved profiles' eventual runtime installation. Static
contacts, chan_sip and outbound trunk registrations remain unsupported/unknown.

## 6. Cleanup, failure and evidence — G03-06

Always unregister owned contacts and stop test clients/processes; remove only
manifest-owned fixture sections, then reload and verify their objects are absent.
Remove the exact fixture file only when owned and empty. Restore the target's
prior running state and release the exclusive lock after cleanup checks. Preserve
unmanaged endpoints, shared tenant routes, catalog/installation identity, provider
custody and persistent shared-service volumes.

Use b's existing exact-generation fixture cleanup and material accounting for
credential checks; this proposal does not change retirement or destruction policy.
Drop only the run's disposable database/Redis/container resources, close its
observer children and remove its private temporary files. Restore any temporarily
interrupted acceptance or ordinary HTTPS processes and verify normal health.

If inspection, ownership, cleanup or restoration is uncertain, stop dependent
acceptance, retain a protected recovery manifest and record the exact safe
resource IDs plus the resume action. Do not delete unknown objects or report a
pass because a best-effort cleanup ran. Published evidence contains safe IDs,
finite outcomes and commands only; scan actual fixture passwords and other
sentinels against rendered output, bundles, URLs, diagnostics and recovery state.

Report separately: actual Asterisk observations, real PostgreSQL/Redis/OpenBao/
HTTP/browser checks, injected faults and future-owner fixtures. Missing controlled
access, required coverage or browser evidence leaves c/parent incomplete.

## 7. Implementation and verification after approval

Record approval/amendments and synchronize the parent/c contracts, passive
composition contract, operator runbook and tracker before dependent code. Recheck
a/b evidence and real protected API boundaries; preserve their semantics.

Implement named narrow forwarding, actual individual/bulk/profile/edit/credential/
disable journeys and exact operator/workflow-bound mounted recovery. Preserve
immutable intents, explicit retries, stale reload/review, safe retained values,
expiry hiding, foreign-operator isolation and confirmed-logout clearing. No
browser-storage drafts, secret forms, automatic replay or passive renewal.

Establish these procedures during implementation; the browser selection and
combined procedure below are proposed, not existing recorded passes:

```sh
./dev exec pnpm check:extension-inventory --browser
./dev exec pnpm check:extension-inventory
```

Rerun existing owner selections and affected regressions in their documented
modes, including real-provider credentials:

```sh
./dev exec pnpm check:extension-inventory --inventory
./dev exec pnpm check:extension-inventory --credentials
./dev exec pnpm check:pbx-nodes --registry
./dev exec pnpm check:pbx-nodes --observation
./dev exec pnpm check:pbx-nodes --browser
./dev exec pnpm check:platform-auth
./dev exec pnpm check:durability
./dev exec pnpm check:ui
./dev check
```

The combined inventory command must reconcile all owner and integrated results;
its present default inventory-only behavior is not a combined pass. Document
actual commands, return codes, run identities, cleanup and limits in c's evidence.

| Criteria | Required evidence |
| --- | --- |
| C-01/02; AC-02–05 | Real browser/API individual SIP/WebRTC, bulk atomicity/revalidation, profile versioning/adoption, desired edits, credential operation recovery and disable/re-enable |
| C-03; AC-07/08 | Exact mapped live positive/negative/empty cases, unchanged unmanaged objects, save-before-fixture absence, collision rejection and separately injected freshness/epoch/coverage faults |
| C-04/05; AC-06/09/10 | HTTP A/B platform authority, session/CSRF/origin/channel/no-store, PBX-only and session outages, explicit uncertainty recovery, same/foreign identity and logout/sentinel checks |
| C-06; AC-10 | Actual screens: keyboard/focus/labels, announcements, loading/empty/error/retry and desktop/tablet/narrow/zoom layouts |
| C-07; AC-01/11 | All parent/child criteria reconciled, a/b regressions valid, full Docker graph passed, guides/contracts/index/tracker updated and exact cleanup verified |

## 8. Completion and later-unit boundaries

Approval permits controlled implementation/testing; c and parent P3-U2 remain
incomplete until all required criteria and real-service evidence pass. It does
not approve production, general phone credential delivery, a compiler/apply/
reload UI, live credential activation/revocation or tenant voice readiness.

P3-U4 owns routing/groups and generated contexts. P3-U5 owns default-deny live
rendering, runtime collision/provenance rechecks, exact profile/credential apply,
external fencing, verification, rollback and revocation proof. P4-U2/P4-U5 own
allocation/readiness/tenant isolation/staff assignment. P8-U8 owns browser calling
and any approved short-lived endpoint access. This review changes none of those
ownership boundaries or the Phase 3 gate.

## Recorded conditional approval — 2026-10-16

The user approved sections 2–6 and G03-01–06, and authorized sections 7–8,
exclusively on the existing approved private development Asterisk. Preserve all
existing endpoints, trunks, dialplans, routing, installation identities,
configuration references and unmanaged resources; never overwrite, adopt or
remove them for acceptance. Before fixture reloads or controlled stop/start,
verify exclusive target access, absence of operational calls/conflicting tests,
a verified baseline and a documented recovery procedure. Associate every fixture,
credential, registration and process with a unique run; restore and verify the
original service state. Collisions, uncertain ownership, incomplete cleanup or
failed restoration stop dependent acceptance and require preserved recovery
information and reporting. Distinguish actual registration, real-service checks
and injected faults. Inventory, PBX observation and future live deployment remain
separate; fixtures do not prove provisioning, WebRTC, credential activation or
tenant calling readiness. P3-U2c/parent remain incomplete until every applicable
criterion passes with evidence. Production deployment, live endpoint application,
general credential delivery, tenant routing activation and expanded PBX management
permissions remain unauthorized. These conditions override proposed procedures
where stricter.
