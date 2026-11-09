# P4-U2-DEV-b verification ledger

**Complete: B-01–07 passed, 2026-11-09 (Asia/Manila, +08:00).** Approved ordinary
preparation is deployed and retained. Child c and integrated parent acceptance
remain incomplete; setup availability does not establish tenant calling readiness.

The user authorized the [dedicated DEV-02/03 setup](../planning/p4-u2-dev-b-preparation-review.md)
with “Approve the dedicated setup” and the bounded
[fixture issuer replacement](../planning/p4-u2-dev-b-fixture-issuer-replacement.md)
with “Approving the issuer replacement”. Both were fulfilled within that scope:
no role/policy broadening, root recovery or retained endpoint credential rotation.
The exact [request](../planning/p4-u2-dev-b-manifest.json),
[capability declaration](../planning/p4-u2-dev-b-capabilities.json) and
[operational runbook](../runbooks/persistent-controlled-calls.md) are published.

## Accepted implementation and verification

| Criterion | Final evidence                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01      | Target/request-bound preview and canonical preparation; version/owner/source/port/capability checks. Isolated rejection/race scenarios passed; ordinary preview preceded supported provisioning.                                                                            |
| B-02      | Immutable request, 66 steps, 16 version facts and 11 cases. Actual canonical lost-ack recovery and concurrency passed in rehearsal; ordinary concurrent exact prepare/reconcile recovered the same IDs without additions. Changed requests conflict.                        |
| B-03      | Three actual OpenBao generations associated and material-verified through the scoped protected worker; protected consumer verified the exact published set. Missing/expired custody blocks availability. No material exposed through HTTP/Next or safe reports.             |
| B-04      | Commands ended; actual helper restarted while Asterisk survived; new instance blocked the old start; explicit new start restored all 11 cases. Independent normal private-console reads passed after restart. No ordinary grants/tests/results or evidence renewal.         |
| B-05      | Actual SIP answer followed by participant SIGKILL retained unknown/no replay; active stop drained naturally, native restart and custody loss denied fresh dispatch. AGI installs a 30-second natural channel deadline before permitted admission. Actual live suite passed. |
| B-06      | Exact retained-resource inventory below; supported stop/disable/reconcile and reviewed apply/absence-proof handoff published. Fixtures/access/counter table cleaned exactly. Full loaded-path removal remains c's applied-runtime acceptance.                               |
| B-07      | Actual ordinary console lists A's eight and B's three safe cases; isolated browser covers stopped/disabled selection, authority/CSRF/input rejection, recovery, keyboard/axe and reflow at 320/768/1440. Required affected and full checks passed.                          |

All commands below completed with exit 0 on the final implementation. SQL rehearsal
uses synthetic fixture custody only; ordinary provider custody and native/network
checks are separate actual proofs.

| Check                                                                                           | Result / retained local receipt                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev tenant-calls rehearse`                                                                   | 27/27, `/tmp/p4-u2-dev-b-rehearsal-catalog-2.log`.                                                                                                                                                                                                                         |
| `./dev exec node --test scripts/tenant-call-preparation-inspect.test.mjs`                       | 2/2; real READ ONLY/wrong-target rejection.                                                                                                                                                                                                                                |
| `./dev exec pnpm check:tenant-routing --live`                                                   | Actual SIP/RTP, stop/drain, loss/unknown/no replay, native-instance reconstruction and passive packets; `/tmp/p4-u2-dev-b-tenant-live-final-2.log`.                                                                                                                        |
| `./dev exec pnpm check:tenant-routing --browser`                                                | Full isolated browser, new stopped and terminal-disable assertions, grant timestamps preserved; `/tmp/p4-u2-dev-b-final-browser.log`.                                                                                                                                      |
| `./dev exec pnpm check:pbx-revisions`                                                           | Full default focused/native/provider/isolation/HTTPS graph; `/tmp/p4-u2-dev-b-durable-pbx-revisions.log`.                                                                                                                                                                  |
| `./dev exec pnpm check:extension-inventory`                                                     | Full default provider/fault/native/browser checks; `/tmp/p4-u2-dev-b-remaining-inventory.log`. Exact fixture tokens revoked/files removed, generations destroyed and ordinary baseline restored.                                                                           |
| Trunk/gateway, tenant allocation/bindings, platform/staff HTTP, shared authority                | Full affected suites passed; durable results and historical checkpoints below retain command boundaries.                                                                                                                                                                   |
| Focused credential/staff browser and platform HTTP                                              | Passed after deterministic synchronization/TTL corrections described below.                                                                                                                                                                                                |
| `./dev check`                                                                                   | Entire normal graph passed: lint/format/types/build/config/entrypoints, foundation/durability/storage/identity/isolation and full session/API/browser/fault/registry cleanup. `/tmp/p4-u2-dev-b-completion-normal.log`; local `completion.state=completed`, normal exit 0. |
| `./dev pbx-live-check`, `./dev health`, `./dev platform-https-check`, `./dev staff-https-check` | All passed after ordinary provisioning/restart; live/ready 200, PostgreSQL and both Redis services up; actual normal private HTTPS browsers.                                                                                                                               |

Earlier failures remain in the historical checkpoints below. The full session graph
needed a 45-minute default deadline; selected suites retain 25 minutes and timeouts
are explicit. Short-expiry Redis reserves command timeout from TTL, so its 2/4-second
fixture uses 500 ms. Browser fixtures now await hydration and canonical persisted
state between navigation/cross-section edits. Final reruns retained the original
assertions; these failures are not counted as passes.

## Ordinary deployment and preservation

Target node `bcb9d21c-96cd-4975-bd68-314b588a23a9`, node version 1, installation
`58adb785-5384-41ce-9c72-ccda6ea554db`. Preparation request
`86e0cc54-7843-4f30-9aef-41eb7f3c1b1c`; responsible operator
`0d22ae3e-6760-4a6e-9a4c-ffc3c08c0ce2`, authentication version 1.

The additive migration `20261108000000_tenant_call_preparation` was applied and
its immutable file checksum independently verified. The quiet native image and
existing backend/protected consumer were refreshed, retaining the same Compose
project, volumes and private placement. Both ordinary private HTTPS builds reached
READY using existing authority/certificates. Capability revision 2 was applied
through the supported command: identity/material limits 71/64, arrays preserved.
No new service, public listener, static configuration or module was introduced.

Final exact comparison passed: artifact/known-good
`e6ee0b86-da28-4ba9-bf42-a6c6e985c341`, original baseline
`add6bfc1-ee2f-42a7-a68a-5cdba67b95d7`, unmanaged digest
`f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`, all three
historical artifacts/static custody, 20 pins, all nine reference hashes and the
eight-file current profile preserved. Exact loaded/protected match, all ten
required capabilities loaded, zero channels/unresolved work, no profile blockers.
Final native/canonical/runtime epoch 14 and routing generation 12 are fresh;
generation 7 was the starting observation, not an unchanged final value.

Exact preservation over 76 tracked tables passed (`originalRowsPreserved=true`,
`failures=[]`). All four original allocated claims and their disabled generation-unset
extensions remain unchanged, as do original tenants, trunk/gateway v4, profiles,
revisions, artifacts and pins. Declared additions: two tenants/two staff, one
profile/version, three extensions/credential operations, one trunk, one gateway/source,
two DIDs, two inbound/two outbound rules, two allocation claims/history and eleven
cases. No new groups, group members, reservations, route authorizations, revisions,
artifacts, pins, verification grants, test intents/results or trunk credentials.
Operational audit/receipts/session fences and explicitly volatile ownership/proof
rows are accounted separately by the preservation report.

Named-custodian GET-only consumer access measured 86,398 seconds (requested maximum
86,400), configuration updates 0. Worker access measured 3,599 seconds,
configuration updates 0; its token naturally expired before final reconciliation.
Protected material remains retained and current consumer custody was true at the
last status read. Expiry requires supported scoped access replacement, never
invented custody or unrequested endpoint rotation.

## Exact retained resources for c

The following IDs/versions are actual canonical outcomes, not generated planning
placeholders. Both tenants are voice-enabled drafts, version 2, authority version 1.

| Resource        | Actual identity / version                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant p4-dev-a | `0e1d45a7-6afb-4621-afd3-68b45c5d450a` / v2, authority v1                                                                                        |
| Tenant p4-dev-b | `cfb6a7fe-80ef-4ec5-95bb-fbbb97f2d9d0` / v2, authority v1                                                                                        |
| Extension 7702  | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` / v3; generation `55538fe0-3f5f-4da6-bb9d-d2dd02f1202b`; operation `7f528a6f-8fad-4722-9585-7aa809a31376` |
| Extension 7703  | `3f2691ab-5bbd-478c-860a-87cc111fd07f` / v3; generation `404780b0-ce0d-4a8a-bfeb-5f398561fcac`; operation `6539b0c1-7e06-4ef5-98df-67bcdef4a8e3` |
| Extension 7701  | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` / v3; generation `9a1724c3-4e60-4691-821f-333797f82827`; operation `fbea8509-f56f-4888-b6d3-7b20b087fd58` |
| claim           | `a0833478-4166-44cc-956d-9de1e17e7f7a` / v1                                                                                                      |
| claim           | `c19f5b62-0f84-41df-a769-5432697217bc` / v1                                                                                                      |
| did             | `0c869e2f-4b1e-42f7-b0b5-948e9b785e5e` / v2                                                                                                      |
| did             | `5b32b89f-343b-4e48-abc6-9915e8325e8a` / v2                                                                                                      |
| gateway         | `ef4ca480-4a0c-453b-9c0b-f2e210ce05bc` / v2                                                                                                      |
| inbound         | `719df50c-c2fe-483e-ad17-df820eaff5f1` / v2                                                                                                      |
| inbound         | `95ec29a3-df4c-460d-9d89-31d50a47cf16` / v2                                                                                                      |
| outbound        | `666a2cab-2637-4690-b032-86fe64788e01` / v2                                                                                                      |
| outbound        | `fe6da3ae-5f64-4d73-8729-8099b3b79d14` / v2                                                                                                      |
| profile         | `adbbcb75-fe04-4034-8569-4f072a83ebe4` / v1                                                                                                      |
| trunk           | `ae5b4537-47c2-4b54-86c4-a51391a59014` / v2                                                                                                      |

7701 belongs to A, 7702 to B; 7703 remains unallocated. All three generations are
associated/material-verified. A uses inbound 5557701/outbound 5558701, B uses
5557702/5558702. Trunk UDP sink is 127.0.0.4:20020, gateway source 127.0.0.2,
caller 127.0.0.3, inbound sink 20021; ulaw, anchored symmetric RTP/rport. Actual
private RTP range 10020–10039 is inside the reviewed 10000–10100 envelope. Sockets
exist only during an explicit bounded call. No ordinary call was made.

| Case UUID                              | Tenant | Direction / kind            | Source UUID                            | Expected destination UUID / outcome                | Readiness required |
| -------------------------------------- | ------ | --------------------------- | -------------------------------------- | -------------------------------------------------- | ------------------ |
| `0c2a9c3e-7bd0-5e54-afc5-f1ec32137e54` | A      | outbound / routing          | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` | none / denied                                      | no                 |
| `14b63c9b-e6bb-5ff2-a9da-c04ec0f88f04` | A      | outbound / ordinary-draft   | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` | none / denied                                      | no                 |
| `1c13ad37-8da9-5369-a8db-ade2eec28fde` | A      | outbound / routing          | `95915cd2-e78e-5aa1-a7f0-72fdad13c657` | none / denied                                      | no                 |
| `212936d0-69a3-50e7-a5c7-80f600980beb` | A      | outbound / unpermitted      | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` | none / denied                                      | no                 |
| `51b3c440-255c-5674-a581-0b043b3e7e46` | B      | inbound / routing           | `ef4ca480-4a0c-453b-9c0b-f2e210ce05bc` | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` / permitted | yes                |
| `7a15758c-22b1-5567-a347-167249e5daa6` | A      | outbound / ambiguous-source | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` | none / denied                                      | no                 |
| `91aeb952-255e-55f9-aa67-6b0b86eb94f8` | B      | outbound / routing          | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` | none / denied                                      | no                 |
| `a1454ea0-b54b-553f-a922-2c7d6025afe4` | A      | outbound / routing          | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` | `ae5b4537-47c2-4b54-86c4-a51391a59014` / permitted | yes                |
| `bff537b4-d1cb-5347-a509-266e8923a5a3` | A      | inbound / routing           | `ef4ca480-4a0c-453b-9c0b-f2e210ce05bc` | `5c91cc6b-414e-4b34-b237-4c53e8f1447e` / permitted | yes                |
| `d14aa1a6-bfe2-5a1f-a4ff-30f6dc9f37fe` | B      | outbound / routing          | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` | `ae5b4537-47c2-4b54-86c4-a51391a59014` / permitted | yes                |
| `ff23d9c4-54b9-53f1-a2a7-135d4c6260db` | A      | outbound / routing          | `3f2691ab-5bbd-478c-860a-87cc111fd07f` | none / denied                                      | no                 |

A's inbound/outbound route IDs are `719df50c-c2fe-483e-ad17-df820eaff5f1` /
`666a2cab-2637-4690-b032-86fe64788e01`; B's are
`95ec29a3-df4c-460d-9d89-31d50a47cf16` /
`fe6da3ae-5f64-4d73-8729-8099b3b79d14`. All are version 2. The unknown-source
case intentionally has no extension row. Case enablement is immutable plus
append-only disable; changed definitions require reviewed new preparation.

## Restart, ordinary console and zero-traffic proof

Four canonical lifecycle events were retained without replay or timestamp renewal:

| Version / action | Request UUID                           | Created at (+08:00)     |
| ---------------- | -------------------------------------- | ----------------------- |
| 1 / start        | `4b373487-8830-4244-b4b0-4069d3094f71` | 2026-11-08 22:28:23.954 |
| 2 / stop         | `4e1fce76-f800-4243-82e2-10b26b675f04` | 2026-11-08 22:28:52.477 |
| 3 / start        | `74017e04-7b9c-4bc2-8c76-b39c677e3da3` | 2026-11-08 22:29:20.499 |
| 4 / start        | `d6d33544-eb24-4db0-bdb5-ac4a1e46717f` | 2026-11-08 22:30:35.661 |

The exact v1 retry retained the same event/timestamp. Stop v2 retained all eleven
cases but made them unavailable with `participants_stopped`. Start v3 bound native
instance `e84b80b8-b5d6-4357-8b7d-952a3778a910`. Actual supported helper refresh
reported `executorRefreshed=true`, `pbxProcessPreserved=true`. Instance changed to
`f9f38a88-7b28-47ef-8eec-826d700888fa`, epoch remained 14. Before explicit start,
all cases were unavailable solely with `native_restarted`, custody still true.
Explicit start v4 restored all eleven, blockers empty. A status read more than nine
hours later retained exactly v4 and all eleven available. Next mutation uses
expected version 4 and a new UUID; a fresh helper instance requires explicit start.

`./dev exec node scripts/check-tenant-call-preparation-console.mjs docs/planning/p4-u2-dev-b-manifest.json`
passed against the ordinary private HTTPS service after commands ended and helper
restart. It used a bounded temporary canonical PostgreSQL/Redis session, created
2026-11-08 22:31:07 +08:00 and revoked 22:31:27 +08:00; no manual password sign-in
is claimed. A's eight/B's three exact cases were visible. Responsive keyboard/axe
checks passed and A's 320/1440 screenshots were manually viewed. Readiness truthfully
remained `incomplete`: `runtime_not_current`, `inbound_verification_required`,
`outbound_verification_required`. No grant or test action was submitted.

Counter-only observation `b5670cf2-a569-47b2-95d7-a3297eb96c73` began before
ordinary preview/provisioning/lifecycle/reads/helper restart. It survived the
helper-only refresh in the same native network namespace. Final counts were
INVITE 0, REGISTER 0, RTP packets 0, including the interval more than nine hours
later and final health/HTTPS checks. Stopping that exact observer returned the same
zero counts; subsequent status was `not_observing`, counts null. Null is not a
new zero observation. No listener, packet capture or traffic verdict was added.
The canonical preparation remains started at v4; only the observer was removed.

## c handoff and cleanup boundary

c must use these exact resources to complete tenant-owned bindings/permissions,
capture/review/apply the full graph and establish current runtime readiness before
actual approved calls. c owns grant/expired/revoked/stale-source/cross-ingress
acceptance and parent AC-01–12 reconciliation. This report creates no grants,
authorizations, intents or results: all four ordinary collections were empty in
the final bounded read-only canonical snapshot. Keep the retained review-2 artifact
until a separately reviewed supported apply; preparation availability does not
silently install routing or freeze the current artifact forever.

For cleanup, follow the runbook's exact inventory: explicitly stop/disable through
new request IDs/current lifecycle version, drain/resolve active or unknown work,
revoke applicable grants, remove c-owned desired bindings/permissions, then capture,
review and apply a complete graph omitting the paths. Independently prove loaded
absence before releasing pins or allocation/material. If proof/apply is blocked,
retain pinned resources and report the blocker. Do not erase immutable cases,
receipts, grants/results or unrelated tenants; no volume pruning or rebaseline.
B-06 publishes this integration; c still must demonstrate actual loaded-path removal.

Safe detailed receipts are retained under `.local/verification/p4-u2-dev-b/`:
`rows-before.json`, `rows-after.json`, `profile-final.json`,
`final-preservation-comparison.json`, `ordinary-inventory.json`, `handoff-facts.json`,
`status-resumed.json`, `ordinary-console-proof.json`, `ordinary-console/`,
`observation-final.json`, `observation-stop.json`, `observation-after-stop.json`,
`final-{pbx-live-check,health,platform-https,staff-https}.log` and durable completion
results. These ignored local receipts contain no credential material in safe
reports; protected issuer/access custody remains in its existing protected store.

## Historical implementation checkpoints

The following checkpoints are retained verbatim as chronological evidence. Their
intermediate pending states, starting facts and failed attempts are superseded by
the final acceptance above and must not be read as current delivery status.

Started 2026-11-08 (Asia/Manila, +08:00). **In progress; B-01–07 are not yet
accepted and ordinary setup has not been deployed.** The additive schema is applied;
ordinary process refresh, real provisioning and persistence acceptance remain
pending. Parent/c remain incomplete.
The user approved the [dedicated DEV-02/03 definition](../planning/p4-u2-dev-b-preparation-review.md)
with “Approve the dedicated setup”. The checked-in
[request](../planning/p4-u2-dev-b-manifest.json) and
[credential-limit declaration](../planning/p4-u2-dev-b-capabilities.json) are
reviewed intent, not evidence that their resources/versions already exist.

## Starting facts

Passive ordinary inspection at 2026-11-08 05:13–05:17 +08:00 confirmed node
`bcb9d21c-96cd-4975-bd68-314b588a23a9`, installation
`58adb785-5384-41ce-9c72-ccda6ea554db`, artifact
`e6ee0b86-da28-4ba9-bf42-a6c6e985c341`, current static digest
`f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`, owner/native
epoch 13 and routing generation 7. Exact loaded/protected configuration matched,
all ten required modules were loaded, 20 pins and original baseline/recovery
profiles remained, channels/pending work were zero and scoped read access was
available. No static profile upgrade was needed.

Four original allocated claims refer to disabled, generation-unset extensions.
They remain excluded from the approved additions. The two new tenant codes and
7701–7703 were free; no current gateway used the proposed private sources, no
existing trunk used the controlled sink, and passive UDP/UDP6 inspection found
20020/20021/20022 unbound. These observations are not reservations.

The real capability row was revision 1 with both credential-size limits null.
The supported revision-2 declaration preserves its existing arrays and declares
the required 71-character identity / 64-character material support only after
isolated SIP/provider proof. New canonical IDs and generations have not yet been
reported because they have not been provisioned.

## Command/result checkpoints

| Command/check                                                             | Result and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev pbx-profile status NODE INSTALLATION`                              | Passed passive delivered-profile/custody inspection; no effects or calls. Exact facts above.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `./dev exec node --test scripts/tenant-call-preparation-inspect.test.mjs` | 2/2 passed: target/input rejection, actual PostgreSQL READ ONLY enforcement, wrong-target isolation and unchanged canonical reads.                                                                                                                                                                                                                                                                                                                                                                                               |
| Focused Docker ESLint/Prettier and console TypeScript                     | Passed at implementation checkpoints; final complete graph remains pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `./dev tenant-calls rehearse`                                             | Expanded isolated-copy checkpoint passed all 23 checks: full canonical prerequisite flow and eleven cases with explicitly synthetic fixture provider, actual canonical commit acknowledgement loss, concurrent repeats, one credential intent, changed payload denial, runtime write denial, immutable provenance, stop/disable, instance/custody gating and result preservation. Exact owned database removed; zero ordinary/provider/call effects. Final rerun follows the final authority/capability and admission hardening. |
| `./dev exec pnpm check:tenant-routing --live`                             | Initial full live suite passed actual SIP/RTP, required denials, grant behavior, unknown outcome/ownership loss, native retirement interruption, reallocation and baseline recovery/cleanup. This checkpoint preceded the added natural channel deadline.                                                                                                                                                                                                                                                                        |
| Subsequent participant-loss live checkpoint                               | Actual child participant reached SIP answer, was killed and retained an unknown result. The fixture then failed an incorrect replay-status expectation (expected 202; canonical replay is 200). Corrected; natural drain was not claimed from that failed attempt. Expanded active-stop/native-instance/passive-packet coverage is pending.                                                                                                                                                                                      |
| `./dev health`                                                            | Ordinary backend live/ready 200 with PostgreSQL and both Redis services up. No ordinary call has been placed.                                                                                                                                                                                                                                                                                                                                                                                                                    |

SQL fixture proof is explicitly separate from real provider custody and actual
native/process/network proof. Synthetic metadata is restricted to exact owned
fixture databases; the ordinary preparer invokes existing real credential APIs
and the designated scoped provider worker only.

## Remaining acceptance

All B-01–07 remain pending final reconciliation. Complete the final isolated
SQL/concurrency and actual SIP/process-loss/stop/restart tests; full real-provider,
revision/native, browser, inventory/trunk, allocation/binding and platform/staff
regressions; ordinary additive migration and guarded consumer/native/HTTPS refresh;
approved exact provisioning; independent ordinary-console persistence; actual normal
helper restart and passive zero-INVITE/REGISTER/RTP proof; exact original-row and
profile/reference preservation; and `./dev check`.

The [runbook](../runbooks/persistent-controlled-calls.md) defines preview, preparation,
credential, status, start/stop/restart, reconcile and disable contracts. c receives
the actual retained identities, desired ownership/permission blockers and cleanup
inventory only after these checks pass. No grant, readiness, ordinary call, loaded
path removal, parent AC-09 or production pass is inferred from provisioning.

## Final isolated verification and schema checkpoint

The final isolated SQL rehearsal and full tenant-routing live rerun both passed,
exit 0. All 23 SQL checks include final authority/capability/resource fact guards.
Actual SIP/RTP proves stop preserves an admitted call and blocks selection;
same-process native monitor reconstruction invalidates prior instance admission
without calls, grant renewal or result-age changes; actual participant SIGKILL
after SIP answer drains through its initial 30-second deadline; unknown blocks
another attempt and exact retry/reconciliation never redial or refresh completion.

The passive fixture witnessed 8 INVITE packets, 2 REGISTER packets and 1200 media
packets from explicit calls. Preparation/start/read/native reconstruction preserved
exact counts. Only its uniquely owned counter-only table was removed. This proves
the observer and isolated zero deltas; actual ordinary helper-process restart is
still separate. All exact owned SQL/native fixture resources were cleaned.

Original row hashes for 76 stable public tables and separate retained
profile/reference/AGI fingerprints are captured in ignored private verification
custody. No raw row or material was exported. The additive migration deployment
reported complete; editing launcher help during its running shell caused a
post-migration parser error and prevented the chained regression from starting.
Fresh `sh -n dev` passed. Independent READ ONLY inspection confirmed migration
`20261108000000_tenant_call_preparation` finished, was not rolled back and matches
the source SHA-256. No capability declaration or resource provisioning ran.
The full default PBX revision/native/provider/isolation/browser regression is now
running separately; no reduced mode is substituted.

Its full native interruption/recovery, retained real-provider GET/material/native
verification and deployment isolation stages have passed. The actual HTTPS stage
is still pending completion. The new ordinary-console read tool uses the existing
operator's canonical session lifecycle against real backing stores, revokes its
temporary session, and performs only normal tenant reads. It claims no password
sign-in and is not a fixture replacement; its ordinary run remains pending.

The full default `./dev exec pnpm check:pbx-revisions` subsequently passed, exit 0:
native boundaries/interruption/recovery, retained real-provider material/native
verification, actual deployment isolation, integrated ordinary-code HTTPS workflows,
the new stopped-preparation selection/grant-denial/keyboard/axe/reflow check, and
all 18 focused tests. Required tenant browser, full inventory/trunk,
allocation/binding and authority commands are now running sequentially.

## Resumption and publication race hardening

The required tenant-routing browser command passed with exact owned cleanup.
The subsequent full inventory command passed inventory checks, then failed its
fixture issuer prerequisite; the remaining chained suites did not start.
Read-only named-custodian inspection found exact existing worker/cleanup policies
and roles. The issuer policy also retains the previously installed fixture scope
`fff38aad-2e3c-4149-aa3f-88f715d1b488`, alongside the ordinary installation and its
live-read rule. No policy/role changes were made. A fixed-role replacement preserving
both scopes is prepared in private verification custody; automatic approval review
rejected that replacement without explicit approval for the second scope, so the
action did not execute and the user was asked. Temporary inspection sessions were
revoked. Ordinary resources remain unprovisioned.

Review also found that a consumer check begun before case publication could
otherwise revive an older proof. Publication now invalidates proof under the
exclusive node lock; the consumer's short shared-lock transaction takes a fresh
statement snapshot and compares the exact published set it verified. Provider
transport remains outside transactions. New isolated PostgreSQL coverage checks
invalidation, stale-catalog rejection, actual blocking publication and the three
exact prepared-material reads. Its first lock-observation assertion failed because
PostgreSQL cached activity statistics in that observing transaction; each bounded
poll now clears that statistics snapshot. Final rehearsal and renewed full PBX
regression remain pending; no new acceptance pass is inferred.

The corrected final rehearsal subsequently passed all **27** checks, exit 0, with
exact fixture cleanup. Its race uses a real blocked PostgreSQL shared lock and a
second publication before releasing that lock, then invokes the actual consumer
commit and confirms the older checked catalog cannot restore proof. The current
catalog requires three material reads through the real resolver with an explicitly
synthetic fixture provider. No ordinary or real-provider effects occurred. The
full default PBX regression is now running again for the final custody code.

The later network interruption ended that run after recovery/verify-during and
before a final exit result; its owned native/container fixtures were removed.
It is not counted as a completed pass. A detached, uniquely locked sequential
runner now records each exact command's exit result in private verification
custody, starting with the full default PBX command, then the remaining unaffected
trunk/allocation/binding/authority and normal checks. Provider-dependent inventory
and ordinary provisioning remain pending the explicit issuer-scope decision.

The completed required tenant-browser run's unavailable-case screenshots were
independently reviewed at 320px and 1440px: warning text and UUID provenance wrap
within the panel, keyboard focus is visible, and the existing automated disabled
option/action, axe and 320/768/1440 reflow assertions passed. This is isolated UI
evidence; independent ordinary tenant-page proof still requires real provisioning.

## Approved fixture access restored

The user explicitly approved: “Approving the issuer replacement”. The earlier
rejected command had also prevented its local manifest write, so the first resumed
preflight still saw the single-installation definition and correctly rejected it.
After writing the approved two-installation manifest, the unchanged exact preflight
and fixed-role issuer command passed. The prior token was independently invalid
(GET lookup 403), the new restricted orphan/nonrenewable issuer has a maximum
24-hour lifetime, policy/role updates were both zero, and the temporary named
custodian session was revoked. No retained endpoint material changed. The full
inventory command is now queued behind the independent sequential runner; it will
not overlap the other integration suites. Actual ordinary provisioning remains
pending completion of these required checks.

The durable full default PBX command subsequently passed, **exit 0**, for the
final custody implementation: native interruption/recovery, actual retained
provider/native checks, isolation, actual HTTPS tenant/stop/recovery behavior and
all 18 focused tests. Its exact exit record is retained in private verification
custody; remaining independent commands run sequentially.

Final UI review identified a selected case that disappears after terminal
disablement: the prior availability-only expression did not reject a missing
case. The action now requires a matching current eligible case. An actual HTTPS
regression appends fixture disablement, confirms the selected option disappears
and the action remains disabled, and checks that reads preserve grant timestamps.
It is queued after the other integration checks; the full normal check will also
compile/lint this final UI code. Native/custody implementation is unchanged by
this UI correction.

The durable sequential runner has now recorded exit 0 for full PBX revisions,
full trunk/gateways, allocation, bindings, platform-auth HTTP and staff-auth HTTP.
Staff coverage includes real credentials, cross-replica logout, proof/reset races,
shared limits, response loss, idle/absolute expiry and cookie/bearer transport.
Shared authority, full normal checks, full inventory and final terminal-case
browser acceptance remain pending. Ordinary provisioning has not started.

Shared authority subsequently recorded exit 0. The full normal command passed
lint/format/types/builds, entrypoints/configuration, foundation/durability/storage,
identity and broad platform/staff/draft/onboarding/geography/voice/credential
API/HTTPS coverage. Its default session launcher then reached the fixed 25-minute
host deadline after both credential frontend builds and browser checks passed,
before final session fault tests finished. It returned exit 1 and is not a pass.
No owned session fixture process/container remained. The default complete graph
now has an explicit bounded 45-minute deadline; selected suites retain 25 minutes,
and deadline termination has its own diagnostic. No acceptance assertion was
removed. A durable sequential runner now executes full inventory, final browser,
then the entire `./dev check` again; previous successful independent commands stay
recorded. Ordinary provisioning remains pending these results.

The resumed **full** `./dev exec pnpm check:extension-inventory` passed, exit 0.
This includes real OpenBao generation/association, acknowledgement/COMMIT loss,
reset/expiry/revocation/restart and cleanup faults, material exclusion and actual
HTTPS/native inventory observation. Final cleanup revoked fixture access, removed
its token files, destroyed both associated fixture generations and independently
confirmed native fixture absence, original baseline/running-state restoration and
lock release. The final tenant-routing browser command is running next.

That browser command passed both new preparation assertions, including terminal
disablement with retained selection and unchanged grant timestamps. Its later
retirement journey timed out waiting for validation because a capture click after
navigation preceded hydration: the failure screenshot shows history loaded but no
selected revision, and the captured transport shows no capture POST. The later
navigation now uses the same history/network-idle wait as the first capture. This
is test synchronization only. Focused lint/format passed. Full browser and full
normal commands are rerunning sequentially; the failed command is not counted as
an acceptance pass. Its exact SQL/Redis/native fixtures were removed.

The subsequent exact full `./dev exec pnpm check:tenant-routing --browser`
passed, exit 0, including binding/allocation prerequisites, actual native/HTTPS
tenant routing, both preparation assertions, unchanged grant timestamps and the
later reviewed retirement/recovery. The hydration wait resolved that failure.
Exact SQL/Redis/native fixtures were removed. The complete `./dev check` rerun is
now running with the explicit bounded default-suite deadline correction.

During that longer run, a fresh passive ordinary inspection still found exact
protected/loaded configuration, original artifact/baseline, zero channels and no
pending work, but ordinary GET-only provider access was unavailable. The supported
`./dev pbx-live-access 58adb785-5384-41ce-9c72-ccda6ea554db` replacement passed,
exit 0, using the existing named custodian and protected consumer volume: actual
TTL 86,398 seconds, explicit maximum 86,400 and zero configuration updates.
No endpoint material was rotated. Native inventory-observation restoration had
advanced routing generation from 7 to 9 while retaining artifact/profile/baseline;
generation equality is not claimed. Actual ordinary resource provisioning remains
pending the full normal result.

The next complete normal run returned exit 1 in an existing platform-auth expiry
fixture: real issuance returned 503 instead of 201 under its 100-ms command
deadline. This was not the host launcher deadline. That fixture tests retained
2-second idle / 4-second absolute expiry, not transport faults; its command budget
now uses the supported 2,000-ms production setting while preserving those lifetime
assertions and the separate injected transport-fault tests. Focused lint/format
passed. The affected platform HTTP suite and entire normal command are rerunning
sequentially. Full inventory, tenant browser and native/custody passes remain
recorded; no ordinary prerequisite resource has been provisioned.

That first fixture-budget adjustment was itself invalid for this short policy:
Redis reserves one command timeout from TTL, so a 2,000-ms budget under a
2,000-ms idle cap deterministically leaves no TTL. The focused run failed at the
same issuance assertion. Corrected to a bounded **500 ms**, preserving the original
2-second idle / 4-second absolute assertions and leaving positive reserved TTL.
This is test configuration only; production session behavior is unchanged.
The failed log is retained separately; affected platform HTTP and full normal
commands are rerunning sequentially.

With the valid 500-ms reserved-TTL budget, the complete affected
`./dev exec pnpm check:platform-auth --http` passed, exit 0, including the original
short-expiry assertions, real SQL/Redis loss/restart tests and owned cleanup.
The entire `./dev check` command is now running again.

That normal run passed the corrected expiry boundary and continued through
platform/staff browser, limiter, draft/onboarding/geography/voice and credential
API checks. It later returned exit 1 at the existing combined-onboarding browser
voice-save assertion, after successful geography save. Authentication/detail reads
remained 200 with normal session lifetime; no deadline termination occurred.
Added bounded configuration-response statuses and a screenshot restricted to this
pre-credential phase for diagnosis. The existing focused staff/credential browser
suite is running; the normal run is not counted as a pass and ordinary resources
remain unprovisioned.

The focused `./dev exec pnpm check:staff-auth --browser` subsequently passed,
exit 0, including the same combined geography/voice configuration, recipient
exchange, owner-isolated recovery, late callbacks, logout, keyboard/axe/reflow and
safe diagnostics. The onboarding failure did not reproduce; no product behavior
was changed. Bounded status/pre-credential diagnostics remain. The full normal
command is running again; its earlier failed runs remain recorded.

The next full normal run reproduced the same cross-section boundary earlier:
configuration responses were contacts 200 then geography 409, and the restricted
pre-credential screenshot confirmed geography conflict with current authentication.
The previous failure had reached voice after geography saved. Both edits could
race a neighboring save's scheduled canonical-detail update. The browser journey
now explicitly reloads canonical detail after contacts and geography, verifies
the persisted contact/coordinate, then edits the next independent section.
This preserves actual save/conflict assertions and adds persistence checks;
production optimistic-version guards remain unchanged. Focused lint/format passed.
Focused credential browser and the entire normal command are rerunning sequentially.

With those reloads, the next focused run returned 200 for contacts, geography and
voice and passed the new persisted-field checks. It later timed out waiting for
ordinary draft sign-in denial after a fresh recipient navigation. Both such
recipient navigations now wait for network idle before filling/submitting; the
unchanged denial assertion remains, with bounded sign-in statuses added to safe
failure diagnostics. Focused browser then full normal validation are rerunning;
the failed focused run is retained separately.

The synchronized focused credential/staff browser command then passed, exit 0,
including all three 200 section saves and persisted reloads, both real draft
sign-in denials, credential exchange, owner isolation/recovery, late callbacks,
logout and keyboard/axe/reflow. The complete normal graph is running next.
