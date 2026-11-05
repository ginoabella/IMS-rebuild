# P4-U2c implementation and verification history

Historical checkpoints superseded by the [final acceptance evidence](p4-u2c-evidence.md). Pending states below describe their original checkpoint.

# P4-U2c implementation and integrated evidence

**In progress — C-01–08 and parent completion remain open.**
Started 2026-11-04 (Asia/Manila, +08:00). Owner approved
[ALLOC-04/05/final ALLOC-06](../planning/p4-u2c-live-policy-review.md) and isolated
Docker SIP endpoint/destination fixtures. The supplied RTP reference is reviewed;
ordinary RTP exposure/configuration has not been widened.

## Verified checkpoints

- Initial documentation: Docker Prettier, ten local link targets and whitespace
  passed. This established no application/runtime result.
- Actual `check:tenant-bindings` run: the new two-tenant canonical SQL/API capture,
  immutable history, exact ownership, permission-revocation invalidation and safe
  DTO review passed. Existing binding API/race/HTTPS sections also passed. The
  enclosing launcher later failed shared platform-auth browser sign-in with 503;
  the whole command is **not passed**. Owned database/Redis fixtures were cleaned.
- Focused Node checks for tenant ownership/readiness/version policy and existing
  revision/native-custody/physical-fence behavior: **22 tests passed**, zero failed.
  This is domain/contract evidence, not actual call evidence. The maintenance
  ordering regression passed in the later 22-test rerun; final source checks remain.
- Intermediate backend builds and console type checks passed before subsequent
  implementation changes. Final stable-source checks remain required.

## Live attempts and limits

The first three `check:tenant-routing --live` attempts stopped in isolated fixture
setup: an already-closed SQL client, a fixture codec-capability mismatch, and an
explicit UUID/text parameter conflict. Those setup errors were corrected. Each
launcher removed its exact owned database/container/directory; no live success or
baseline restoration is inferred from failed setup.

The next attempt reached revision capture/validation but runtime apply rejected
ordinary-role SQL with 42501. The pin upsert had unnecessarily included the new
native-only retirement column. It now uses the original allowed pin columns;
retired apply targets reject explicitly. No broader tenant/operator write grant
was introduced.

The first complete native run (`check:tenant-routing --live`, local log
`/tmp/p4-u2c-live10.log`) passed actual authenticated inbound and outbound calls for
two tenants on the same disposable Asterisk, independently observed destinations
and bidirectional RTP. Actual cross-tenant, unallocated and unknown sources denied.
Exact request replay recovered receipts without redial; grant revocation invalidated
readiness and denied new intent. Reviewed initial-baseline recovery and owned fixture
cleanup passed. The controlled static module profile needed AGI speech dependencies,
the correct `CHANNEL(endpoint)` source accessor and `bridge_simple.so`; ordinary
retained configuration and RTP publication were preserved.

The expanded run (`/tmp/p4-u2c-live11.log`) passed ordinary draft-traffic denial but
exposed duplicate From headers being admitted. Explicit duplicate identity/admission
header rejection is now enforced by the fixed AGI and native admission contract.
The corrected expanded matrix passed in `/tmp/p4-u2c-live14.log`, including actual
ambiguous-header, ordinary-draft and expired-grant SIP denial, and a successful real
SIP/RTP call whose final outcome was deliberately replaced with unknown. That injected
result-loss blocked readiness and new calls; exact retries did not redial. Explicit
operator reconciliation proved actual native idle and recorded failure, never success.
Required initial-baseline recovery and exact cleanup passed. Safe artifact/case/test
references are retained in [machine-readable evidence](p4-u2c-live-evidence.json).
Earlier intermediate runs stopped at type errors in
the newly extracted shared evidence projection; no call pass is inferred from them.

Automatic approval review earlier rejected proposed persistent executor UPDATE(id)
grants on tenant/operator tables. That action was not applied. The replacement
uses the owner-provided read-only primary-snapshot authority port.

The new native fixture's endpoint metadata/material is explicitly synthetic. Actual
SIP/RTP behavior will be reported independently from required real-provider exact
custody checks. Existing P3 probes or injected resolver/provider responses cannot
substitute for C-03.

## Acceptance reconciliation

Focused final revision/browser run (`/tmp/p4-u2c-revisions-browser-focused16.log`)
exited 0. It passed actual HTTPS tenant-aware apply; both draft tenants' real
positive and forbidden calls; exact lost-grant response and same-owner
reauthentication; readiness/revocation; wrong plane, CSRF and bounded opaque-input
denial; actual retirement, lost-reply exact recovery and retired-target denial;
axe, 320/768/1440 reflow and reviewed initial-baseline restoration. Shared platform
authority checks and exact database/Redis cleanup passed. Narrow and desktop
screenshots were visually reviewed. Final integrated/affected/full checks and
ordinary HTTP consumer refresh still remain.

| Criterion | Current evidence / remaining work                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Atomic capture/diff/digest facts and historical policy support implemented; focused real capture/invalidation passed. Final source/apply races and regression rerun remain.                   |
| C-02      | Protected tenant rendering/admission and physical maintenance queue implemented. Actual operator HTTPS tenant-aware apply plus final custody/native proof remain.                             |
| C-03      | Final native run 22 passed actual draft/active shared-PBX inbound/outbound SIP/RTP, all required denied sources, exact provenance and bounded local destinations.                             |
| C-04      | Actual grant expiry/revocation and ordinary-draft SIP denial passed. Reviewed baseline cleanup passed. Final voice-state/browser evidence remains.                                            |
| C-05      | Exact receipts, unknown-call reconciliation, runtime generation/freshness and readiness invalidation implemented. Required actual interruption/owner-loss/drift/recovery matrix remains.      |
| C-06      | Final native run 22 passed actual active-call deferral, unknown retention, executor exit, explicit retirement reconciliation, safe release/new claim, new-owner calls and stale-owner denial. |
| C-07      | Named strict no-store forwarding and owner-bound tenant/revision panels implemented. Final wrong-plane/CSRF/bounds and actual accessible browser/recovery checks remain.                      |
| C-08      | Short integrated command, operator/downstream contracts prepared. Final affected/full checks, ordinary refresh/preservation and parent AC-01–12 reconciliation remain.                        |

Parent AC-01–04 have completed a/b evidence but require the integrated rerun here.
AC-05/06/08/09/10/11/12 remain open for c's final integrated results; AC-07 requires
actual exact two-tenant positive/negative live proof. No parent completion is claimed.

## Handoff

Use the [operator runbook](../runbooks/tenant-routing-verification.md) and
[architecture/API/downstream contract](../architecture/tenant-routing-verification.md).
U3 owns activation/lifecycle; U5 assignment writers remain undelivered and only
the declared dependency/constraint port can be checked. P5-U3 owns authenticated
operational ingestion and must preserve immutable original ownership. Production
readiness remains separately incomplete.

## Retirement and owner-loss checkpoint

Final native run `/tmp/p4-u2c-live22.log` exited 0 with one draft and one
trusted-fixture-seeded active tenant. It includes actual bidirectional SIP/RTP,
all required denied source paths, expected/observed mismatch failure, node-wide
isolation blocking even after grant revocation, actual executor exit after durable
retirement dispatch/tombstone, concurrent apply/recovery/release deferral, explicit
reconciliation, safe reallocation and individually verified extension proofs.
The lease-loss path again fenced old completion and preserved unknown receipts
without redial. Reviewed baseline recovery and exact owned cleanup passed. Exact
safe IDs are retained as `finalNativeRun` in the machine-readable evidence.
Browser and remaining final regressions are still running; this is not completion.

The sequential integrated browser attempt passed binding and allocation API/race/
HTTPS suites, then exposed a historical fixture assumption that disabled endpoints
always receive runtime pins. The new policy intentionally omits them. The existing
acceptance-only revision fixture now enables one endpoint through its canonical
API before capture, still proves actual pinned structural-removal denial, and
also checks that disabled stock is unpinned. Its separate native browser node is
unchanged. The whole integrated browser command is being rerun; no final pass is
inferred from the successful constituent sections.

Focused reproduction identified a live-panel concurrency bug: passive polling
could silently discard an enabled explicit recovery click. The action now waits
for the bounded passive read and rechecks the captured operator context before
continuing. The native browser fixture deliberately holds the passive read while
pressing keyboard recovery, checks that no write overtakes it, then requires the
exact recovery request after release. This final UI change requires its browser
and full check reruns. Failed focused runs retain sanitized source locations and
local screenshots; they confer no tenant-routing acceptance.

The isolated native runs in `/tmp/p4-u2c-live17.log` and
`/tmp/p4-u2c-live18.log` passed actual unpermitted SIP denial, active-call
retirement/release deferral, durable native tombstones with an injected final-SQL
failure and unchanged pins, exact replay and explicit reconciliation, retired
recovery rejection, desired dependency blockers, canonical release/new allocation,
new-owner inbound/outbound SIP/RTP and stale old-owner denial. Original claims and
revision ownership remained immutable. Required baseline recovery and owned cleanup
passed. Run 18 additionally revoked the native lease during a successful real call:
old-owner result completion failed, the new owner retained its physical receipt as
unknown without redial, and explicit native idle reconciliation recorded failure.
Safe exact references are in the machine-readable evidence above.

Normal migrations completed. Before/after hashes matched all 17 ordinary
canonical/resource/history tables. The retained native check passed exact protected
and loaded runtime, initial/current recovery references, unchanged unmanaged digest
and zero active calls. Native helper-only refresh then passed: helper PID changed
from 8 to 177986 while Asterisk remained PID 7. Post-refresh retained verification
again matched the exact protected/loaded runtime and recovery references, unchanged
unmanaged digest and zero calls/no pending operation. Ordinary HTTP consumers still
require their final refresh/check.

The first `./dev check` completed with exit 0, including lint/format/types/build,
entrypoints/config and real foundation/storage/session/PBX checks. A final small
negative-ingress bound and fixture case were added afterward; final-source checks
remain required. The integrated browser attempt stopped in shared wrong-password
sign-in when backend 401 exceeded Next's forwarding deadline under concurrent load;
its owned fixtures were removed. It did not reach the new tenant-aware HTTPS flow.
Sequential browser and all specifically required regressions remain open.
