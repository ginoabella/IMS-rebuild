# P1-U1 draft acceptance matrix

**Documentation review only.** These scenarios are specified, not executed.
Proposed rules depend on approval of their decision IDs. Owning units implement
runnable checks and record evidence. Real PBX/device/database checks cannot be
completed by fixture-only demonstrations.

## Behavior examples

| ID | Given / action | Expected observable result | Decision / proof units |
| --- | --- | --- | --- |
| A-01 | Fresh checkout; install and run root checks | Locked install, dependency-ordered lint/typecheck/build and isolated entry points | F-01/F-02; P1-U2 |
| A-02 | Start local shared services, migrate twice, restart; then remove DB | Reproducible schema; safe rerun; liveness/readiness distinguish unavailable dependencies | Existing plan; P1-U3 |
| A-03 | Same username in tenants A/B; login and try foreign/other-plane IDs | Correct tenant identity; same-tenant duplicates reject; foreign and other-plane access deny | D-01/D-05; P2-U1–P2-U4 |
| A-04 | Replica A login; replica B request; revoke/reset/change role/suspend; Redis outage | Shared access, revoked authority rejected everywhere; outage returns retryable unavailability | D-05/D-06; P2-U2, P7-U2 |
| A-05 | Tenant admin has no operational role; try dispatch and shared PBX edit | Both denied; canonical staff creator may close without an additional dispatcher role; dispatchers may close under closure rules | D-01; P4-U4, P5-U6–P5-U7 |
| A-06 | Setup/reset exchange; expired/reused/reissued token; last-admin disable | Approved credential handoff; no URL/log leakage; invalid token rejected; last admin retained | D-05; P2-U4, P4-U4 |
| A-07 | Operator saves PBX revision; validation/apply fails; observer loses lease | Save stays desired only; failed apply restores known-good; stale owner cannot publish/apply | D-09; P3-U1–P3-U5 |
| A-08 | Two tenants on one PBX; overlapping allocation; pending/foreign extension assignment | Exclusive ownership; only verified tenant inventory assigned; trusted calls map correctly | D-09; P4-U2/P4-U5, P7-U1 |
| A-09 | Voice-disabled activation; voice-enabled activation without verification; suspension with active work | Disabled voice may activate; premature readiness rejected; proposed drain policy enforced | D-06/D-09; P4-U3 |
| A-10 | Category disabled after use; create/change category with disabled/foreign ID | History remains; new selection rejects; unrelated edit with unchanged historical reference works | D-04; P5-U1/P5-U6 |
| A-11 | Inbound call without location; enter meaningful draft; refresh; concurrent stale save | Trusted phone/defaults shown; last saved work restored; conflict preserves user input | D-07; P5-U3–P5-U4 |
| A-12 | Search/double-click or numeric location entry; invalid axes; provider outage | Correct coordinates replace defaults; invalid input rejects; draft survives outage | D-07; P5-U5–P5-U6 |
| A-13 | Convert same draft twice concurrently; stale edit; close with active assignment | One incident; conflict feedback; forbidden closure rejects without side effects | D-02/D-07; P5-U6 |
| A-14 | Two dispatchers assign one responder; inactive/foreign/unavailable responder; cancelled reassignment | One active assignment wins; ineligible IDs reject; permitted reassignment preserves history | D-03; P5-U2/P5-U7 |
| A-15 | Assigned responder accepts → en route → on scene → completes; repeats/skips/foreign commands | Valid sequence and actor history; exact retry safe; invalid or unauthorized commands reject | D-03; P6-U1–P6-U2 |
| A-16 | Share foreground location; deny permission; background; stale/rate/replay cases | Approved states and limits; correct tenant; no background tracking; assignment actions still work | D-08; P6-U3 |
| A-17 | Two staff and responder on different replicas; interrupt broker/replica; reconnect | Canonical convergence; no foreign delivery; surviving HTTP replica serves traffic | Existing invariants; P6-U4/P7-U2 |
| A-18 | Committed/rolled-back mutation; duplicate job; interrupted worker; complete journey | Only commits publish; idempotent recovery; actor-attributed timeline and audit explain history | Existing invariants; P1-U5/P7-U1 |
| A-19 | Retrieve shared object from two processes; expired/foreign reference; provider fails | Shared access boundary works; unauthorized/expired references deny; failures visible | D-10; P1-U6/P8-U1–P8-U2 |
| A-20 | Approved public channels/tools and launch rehearsals | Same canonical ownership/workflow; each extension and measured launch target has its own evidence | D-11–D-13; P8/P9 |

## Overview coverage review

| Overview requirement group | Planned proof / examples |
| --- | --- |
| Goal 1 and core journey steps 4–8: intake through retained closure | A-10–A-18; P5–P7 |
| Goal 2 and steps 1–3: PBX before onboarding and verified staff extensions | A-07–A-09; P3–P4 |
| Goal 3: tenant/role/plane isolation at every boundary | A-03–A-06, A-08, A-13–A-19; P2/P4/P7 |
| Goal 4: shared sessions, realtime and interruption recovery | A-04/A-17/A-18; P2/P6/P7 |
| Goal 5: incremental checks and maintained documentation | F-02; unit tracker and docs checks in every unit |
| Core step 9 and public web/mobile/SMS/voice features | A-20; P8-U3–P8-U7 |
| Evidence/recordings, browser calling, recovery, dashboards/reports/exports, retention | A-19/A-20; P8-U1–P8-U2, P8-U8–P8-U11 |
| Success criterion 1: fresh startup/schema/health | A-01/A-02; P1-U2–P1-U3, P7-U3 |
| Success criterion 2: tenant-qualified identity/planes | A-03; P2-U1–P2-U4, P7-U1 |
| Success criterion 3: browser PBX apply/recovery/attribution | A-07/A-08; P3, P4-U2, P5-U3 |
| Success criterion 4: two tenants, routing and extension exclusivity | A-08/A-09; P4, P7-U1 |
| Success criterion 5: intake, refresh, closure, mobile progress | A-11–A-16; P5/P6/P7-U1; creator closure grant approved for P2-U1b; D-02/D-03 safeguards remain with owning units |
| Success criterion 6: cross-replica convergence/reconnect | A-17; P6-U4, P7-U2 |
| Success criterion 7: shared revocation/outage/surviving replica | A-04/A-17; P2/P4/P7-U2, P9-U2–P9-U3 |
| Success criterion 8: retained actors and runnable documented milestones | A-18; P1-U5, all feature units, P7-U1–P7-U3 |
| Success criterion 9: measured nonfunctional and recovery targets | A-20; D-13, P9-U1–P9-U3 |
| Success criterion 10: provisioning/smoke/restore/rollback before launch | A-20; D-13, P9-U4–P9-U5 |

The review maps every overview goal, core-flow step, feature group and success
criterion. Detailed extension/production examples stay in their owning units once
D-10–D-13 are answered. Phase 7 acceptance does not authorize operational launch.
