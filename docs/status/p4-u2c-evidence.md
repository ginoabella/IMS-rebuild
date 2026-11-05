# P4-U2c verified tenant routing evidence

Status: **complete within approved private development**, 2026-11-05 (Asia/Manila, +08:00). C-01–08 and parent AC-01–12 passed.
Scope: approved private development under the [controlled-call and retirement policy](../planning/p4-u2c-live-policy-review.md). No external calls.

## Implemented result

Canonical tenant ownership and permissions now enter versioned immutable capture, review, protected apply and native admission. Operators can grant bounded draft verification, run exact controlled tests, inspect current readiness and recover the same intent after an uncertain response. Native call safety and durable audited retirement protect release and reallocation. Historical artifacts retain their original policy and ownership.

## Child acceptance

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Integrated binding/allocation/revision checks: consistent capture, semantic invalidation, source/apply races, immutable history, exact pins and historical policy compatibility.                                                                                                                                                                                 |
| C-02      | Actual production Next/private HTTPS review, validation and tenant-aware apply; full revision native/material/fence/isolation regression.                                                                                                                                                                                                                        |
| C-03      | Final native run 22: draft and existing active tenants on one real disposable Asterisk, authenticated inbound/outbound SIP, independently observed permitted destinations and bidirectional RTP; actual cross-tenant, unknown, ambiguous, unallocated, stale and unpermitted attempts deny.                                                                      |
| C-04      | Actual ordinary-draft, expiry and revocation denial; exact manifest/nonce admission; HTTPS voice-disabled/not-configured/lifecycle separation. No activation workflow.                                                                                                                                                                                           |
| C-05      | Actual in-call owner loss, exact result epoch fencing and no redial; injected final-outcome loss becomes unknown; explicit quiet reconciliation; generation/freshness/source/dependency invalidation and retained recovery.                                                                                                                                      |
| C-06      | Actual active-call deferral; final SQL failure after durable native tombstone retains pins; actual executor exit 73 with physical guardian, concurrent apply/recovery/release denial, no redispatch and reviewed reconciliation; safe release/new allocation, fresh new-owner calls and stale old-owner denial. Initial/current/recovery bytes/history retained. |
| C-07      | Actual allocation/binding/revision/test/retirement browser, held passive read with keyboard recovery, same-owner reauthentication and exact lost-response recovery; identity isolation, wrong-plane, CSRF/Origin, bounded DTO/opaque-key denial, axe and 320/768/1440 reflow. Narrow/desktop screenshots visually inspected.                                     |
| C-08      | Final command ledger, normal migrations/consumer refresh, health/access, retained PBX verification, exact ordinary-table preservation and owned fixture cleanup; parent reconciliation below.                                                                                                                                                                    |

## Parent acceptance

| Criterion | Integrated evidence                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01     | Existing eligible stock, canonical node/ownership and independent-replica allocation reload.                                                          |
| AC-02     | Two-tenant exclusivity, overlapping individual/range races, inventory mutation and transactional batch rollback.                                      |
| AC-03     | Complete owned inbound/DID/group graphs; foreign/ambiguous/incompatible references rejected.                                                          |
| AC-04     | Explicit outbound permissions/shared trunk, transforms/reservations/priority and actual forbidden-path denial.                                        |
| AC-05     | A/B authority/stale/replay/unknown-commit/rollback, exact attributed receipts; platform-only API/Next.                                                |
| AC-06     | C-01 versioned capture/compiler/pins and original-policy preservation.                                                                                |
| AC-07     | C-03 actual two-tenant shared-PBX SIP/RTP and denied attempts.                                                                                        |
| AC-08     | C-05 actual native interruption/owner loss, uncertain dispatch and reviewed recovery, with no premature readiness/redial.                             |
| AC-09     | Current backend evidence and operator panels distinguish desired intent, registration, validation, apply, live tests, voice preference and lifecycle. |
| AC-10     | C-06 real call/unknown deferral, retirement/reallocation and immutable original provenance. U5 future assignment writers remain outside this unit.    |
| AC-11     | C-07 actual complete responsive keyboard/browser journey and mounted recovery isolation.                                                              |
| AC-12     | C-08 command/preservation ledger and published operator/downstream contracts.                                                                         |

## Exact proof and fault boundaries

The [machine-readable ledger](p4-u2c-live-evidence.json) retains exact manifests, artifact/revision/node/installation, tenant, claim/permission versions, test IDs, retirement/reconciliation IDs and final command exits. Final native proof is `check:tenant-routing --live`, local log `/tmp/p4-u2c-live22.log`; final integrated HTTPS proof is `check:tenant-routing --browser`, `/tmp/p4-u2c-regression-tenant-browser.log`. Focused HTTPS run 16 also exited 0 and supplied the visually reviewed screenshots. Failed attempts retain diagnostics and confer no pass.

SIP/RTP traffic, destination observation, active-call deferral, native executor exit and owner lease loss were real. Outcome/final-SQL/HTTP acknowledgement losses were deliberately injected and are labelled in the ledger. SIP fixture endpoint material was synthetic. Full real OpenBao custody/provider and retained-isolation regressions provide separate material evidence; they do not replace the actual call proof.

## Operator and downstream handoff

Use the [operator runbook](../runbooks/tenant-routing-verification.md) and [backend/native contract](../architecture/tenant-routing-verification.md). U3 consumes current readiness and explicit voice preference for its separate lifecycle gates. U5 receives only individually proven allocated extensions, exact claim/permission versions and inbound/outbound test IDs, plus declared dependency ports. No assignment writer or future writer race is claimed. P5-U3 must authenticate operational ingress and preserve original exact provenance; general call ingestion is not implemented. Production rollout and the rest of Phase 4 remain separate.

Ordinary retained static modules/configuration/RTP exposure were preserved. The new prepared/disposable profile includes its documented tenant-admission prerequisites; an older unsupported profile fails safely and is not silently upgraded or rebaselined. The supplied reference RTP configuration was used for diagnosis.

## Final command results

| Command                                          | Exit |
| ------------------------------------------------ | ---- |
| `./dev exec pnpm check:tenant-routing --browser` | 0    |
| `./dev exec pnpm check:draft-tenant`             | 0    |
| `./dev exec pnpm check:extension-inventory`      | 0    |
| `./dev exec pnpm check:trunk-gateways`           | 0    |
| `./dev exec pnpm check:routing`                  | 0    |
| `./dev exec pnpm check:pbx-revisions`            | 0    |
| `./dev exec pnpm check:platform-auth --http`     | 0    |
| `./dev exec pnpm check:staff-auth`               | 0    |
| `./dev check`                                    | 0    |

The final live command and focused browser command also exited 0, as recorded above. The full revision command retained all native, 24 actual interruption, real-provider, isolation, browser and domain modes. Earlier failed setup, rate-window and canonical-reload fixture attempts remain preserved in the machine ledger and [implementation history](p4-u2c-implementation-history.md); none is claimed as a pass.

## Ordinary environment and cleanup

Normal additive migrations passed. All **17** retained canonical/resource/history table fingerprints match the pre-implementation baseline. Backend and affected native/telephony/platform/staff consumers loaded current code; platform/staff HTTPS checks and backend live/ready health passed. The existing Asterisk process, protected/loaded runtime, initial/current recovery references and unmanaged digest were preserved; zero channels and no pending operation were independently verified. No retained static module/RTP configuration or stored credential material was rewritten. Exact owned fixture databases, Redis containers, credential access and disposable PBX containers/directories were cleaned; immutable provider metadata and required artifacts/history remain retained. Sanitized exact facts are in the machine ledger.

The pre-existing unclaimed database `myims_session_426486cb1209` was preserved outside this task’s cleanup boundary, as documented in [prior preservation evidence](p4-u1b-3-evidence.md). Final read-only checks found zero task-owned disposable databases, containers or session-fixture processes.
