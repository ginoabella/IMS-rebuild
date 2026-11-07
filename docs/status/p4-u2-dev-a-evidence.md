# P4-U2-DEV-a — Completed implementation and retained deployment

Completed 2026-11-07 (Asia/Manila, +08:00). **A-01–06 passed.** The user approved
the [DEV-01 preservation strategy and conditional maintenance effects](../planning/p4-u2-dev-a-profile-transition-review.md#recorded-dev-01-decision).
All isolated recovery rehearsals and required sequential regressions passed before
ordinary profile effects. Parent P4-U2-DEV and b/c remain incomplete.

## Retained result

The same node `bcb9d21c-96cd-4975-bd68-314b588a23a9` and installation
`58adb785-5384-41ce-9c72-ccda6ea554db` now run the reviewed profile under pinned
Asterisk 22.10.1. The original baseline remains
`add6bfc1-ee2f-42a7-a68a-5cdba67b95d7`.

| Fact                           | Before                                                             | After                                                              |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Verified/known-good artifact   | `4b475c04-b573-4cc1-9d86-1c81b65f4060`                             | `e6ee0b86-da28-4ba9-bf42-a6c6e985c341`                             |
| Unmanaged digest               | `ab5af92b12e47751c9e48e3540e0029ae72d93e337d1db1bef6cec5810abce01` | `f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8` |
| Captured revision              | `4b475c04-b573-4cc1-9d86-1c81b65f4060`                             | Same immutable revision; distinct compatible artifact              |
| Compiler/policy                | `review-2` / `deny-unbound-1`                                      | Unchanged                                                          |
| Node version                   | 1                                                                  | 1                                                                  |
| Native/canonical/runtime epoch | 12 at final preflight                                              | 13, all equal                                                      |
| Active channels / pending work | 0 / none                                                           | 0 / none                                                           |
| Retained dependency pins       | 20                                                                 | 20                                                                 |

The six additions are actually Running: `bridge_simple`, `res_speech`, `res_agi`,
`func_channel`, `res_pjsip_header_funcs`, and
`res_pjsip_endpoint_identifier_ip`. All ten required checked capabilities are
loaded. Explicit `autoload=no`, anchored media, exclusion of native RTP bridging,
RTP 10020–10039 and its publications, existing transports/NAT behavior and original
static/reference bytes remain intact. No reference credentials, WebRTC/public
routes, unrestricted local-user paths or external-address placeholders were copied.

The additive migration completed through the already-built Docker deployment entry
point, `./dev exec pnpm db:migrate`. Existing backend/telephony consumers and ordinary
platform/staff HTTPS were refreshed with their retained configuration and material.
The guarded native helper refresh proved the existing Asterisk process survived.
Exact old-profile preflight then had zero blockers. The approved upgrade performed
one quiet host-dispatched Asterisk recreation, followed by fresh independent native
loaded/protected proof and canonical acknowledgement. Network identity, every
retained mount and every published port stayed the same. No ordinary call or
injected fault was used. Effect-free exact reconciliation reports `verified`.

Safe machine evidence: [before expectations](p4-u2-dev-a-expectations.json),
[before preflight](p4-u2-dev-a-preflight.json),
[immutable request](p4-u2-dev-a-deployment-request.json),
[deployment result](p4-u2-dev-a-deployment-result.json),
[after expectations](p4-u2-dev-a-expectations-after.json),
[after preflight](p4-u2-dev-a-preflight-after.json), and
[exact reconciliation](p4-u2-dev-a-reconciled.json).

## Acceptance and verification

| Criterion | Verified result                                                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01      | Trusted passive exact-target/version/artifact/compiler/policy/digest/baseline preflight; actual seven wrong-expectation checks passed both before and after upgrade, preserving protected bytes, ownership, modes, links and mtime with zero calls. Missing custody, drift, unavailable activity/provider and wrong owner/version block effects. |
| A-02      | Sanitized reference/current/proposed comparison, preserved reference manifest and actual loaded module/media/profile verification passed.                                                                                                                                                                                                        |
| A-03      | Actual isolated old/new pair selection and original-baseline restoration passed; approved retained new pair is independently verified. Both original recovery targets retain their exact old static custody and meaning.                                                                                                                         |
| A-04      | Actual helper/PBX/container loss at durable boundaries and separately labelled SQL acknowledgement failure passed, with exact reconciliation/compatible rollback and no uncertain selection replay.                                                                                                                                              |
| A-05      | Active/unknown activity, owner loss/stale owner, node-version drift, competing console/canonical apply/recover/reconcile/retirement and missing custody were fenced safely. No forced hangup, pin deletion or rebaseline.                                                                                                                        |
| A-06      | Actual isolated normal console recovery across profiles, full existing revision/provider/browser/authority regressions, ordinary health/HTTPS, preservation and published operational instructions passed.                                                                                                                                       |

| Required command/check                                   | Result                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:pbx-revisions`                    | Passed full native, process interruption, provider, isolation, integrated console/browser and focused coverage                                 |
| `./dev exec pnpm check:tenant-routing --live`            | Passed                                                                                                                                         |
| `./dev exec pnpm check:platform-auth --http`             | Passed                                                                                                                                         |
| `./dev exec pnpm check:staff-auth --http`                | Passed                                                                                                                                         |
| `./dev check`                                            | Passed complete lint/format/types/build/entry-point/configuration, foundation/durability/storage/identity/session and production browser graph |
| Focused profile tests and tooling lint                   | Six tests passed; ESLint passed                                                                                                                |
| Actual inspection-only native regression                 | Passed before/after; five mutation methods reject and protected metadata stays identical                                                       |
| Exact composition and preservation checks                | Passed before/after                                                                                                                            |
| `./dev health`                                           | Liveness/readiness 200; database and both Redis dependencies up                                                                                |
| `./dev platform-https-check` / `./dev staff-https-check` | Passed ordinary HTTPS, private-network, browser, transport-secret and existing-identity preservation checks                                    |
| `./dev pbx-live-check`                                   | Passed exact original-baseline/current protected and loaded runtime match; zero channels and no pending operation                              |

The required existing commands ran sequentially. Final safe outputs are collected
in the [verification ledger](p4-u2-dev-a-checks.json).

## Recovery proof and preservation

The [actual PostgreSQL/Asterisk matrix](p4-u2-dev-a-rehearsal.json) records **23
unique passed cases**. Its execution field distinguishes the expanded transition
run, corrected eight-case safety rerun and final focused cold-start/version cases;
no uninterrupted 23-case invocation is claimed. Cases cover preparation, static and
managed selection before/after, restart before/after, native proof and acknowledgement,
SQL acknowledgement before/after, separately injected SQL failure, bounded natural
Local-call deferral, unknown activity, owner loss, competing writers, missing
custody, normal console recovery, whole-container loss before first selection and
between static/managed selection, missing established selector and node-version
change before dispatch. Exact source-pair recovery before first selection used no
selection/restart replay. Established missing selection failed closed. The console
case includes two actual native restorations in addition to its host upgrade;
`requiredRestarts` counts host dispatches only.

The separate [network-none compatibility proof](p4-u2-dev-a-compatibility.json)
verified four actual Asterisk starts, old/new exact pair validation, actual added
module loads, rejection of an old-artifact/new-profile mismatch and exact original
pair restoration. Its result alone does not claim SQL/interruption coverage.

[Before](p4-u2-dev-a-preservation-before.json) and
[after](p4-u2-dev-a-preservation-after.json) preservation match all 69 tracked SQL
tables, both original artifact rows, old protected plans/staging/static bytes,
initial baseline/facts, native receipt/sequence and all nine reference-file hashes.
The ledger explicitly excludes volatile ownership/runtime/observation/proof data,
audit/outbox, migration history and the new transition metadata; the new alias is
separate from the two original rows, and the additive nullable artifact column is
normalized in their comparison. Expected changes are the additive schema, immutable
profile intent/custody/compatibility, new artifact alias, operation audit/progress,
and freshly verified runtime/ownership. Tenant/resource/routing configuration,
credentials, pins and historical artifact meaning were preserved.

Initial failures were resolved and rerun: disposable image-default configuration
was replaced only inside owned copies; process inspection uses name/UID without
extra privileges; read-only CLI children have hard deadlines while mutating command
guardians retain their lifetime fence; the existing race hook now intercepts actual
mutating dispatch; and bootstrap observation waits for independent recovery instead
of racing it with a redundant rollback. Expired GET-only provider consumer access
was replaced through the named custodian with zero policy/static updates or
credential rotation, then exact provider/full regression proof passed. Exact owned
fixture databases, containers and labelled/anonymous volumes were removed. No
unscoped pruning or retained custody deletion occurred.

## Operational and downstream handoff

Use the [deployment/status/reconcile/rollback runbook](../runbooks/development-container.md#retained-pbx-profile-transition-and-recovery)
and [revision/recovery contract](../architecture/pbx-revisions.md#p4-u2-dev-a-retained-profile-compatibility-and-transitions).
Keep dated before/after expectations distinct. Status/reconcile cannot replay a
restart. Explicit rollback or existing console recovery selects the target's own
static profile and artifact, followed by a quiet fixed restart and fresh proof.
Startup invalidates stale proof; it never selects a profile, rebaselines or promotes
an old proof. Interrupted first preparation has a protected legacy-pair boot path;
a missing established selector stays closed. Do not rerun bootstrap preparation,
manually load modules, release pins or copy reference secrets.

Child b receives the exact verified profile, all ten loaded prerequisites and both
preserved original recovery targets. **The installed policy is still
`deny-unbound-1`; persistent tenant-aware apply/participants/cases and DEV-02/03
remain b/c work.** Child c owns ordinary-console SIP/audio and integrated parent
acceptance. This unit establishes compatible infrastructure and recovery, without
claiming tenant calling readiness, activation, production readiness or the parent
AC-01–12 pass.
