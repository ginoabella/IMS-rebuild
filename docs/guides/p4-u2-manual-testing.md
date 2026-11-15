# Manually test P4-U2 and P4-U2-DEV persistent tenant calling

Use this guide to review implemented **P4-U2a/b/c** and **P4-U2-DEV-a/b/c** before
P4-U3. It includes exact retained setup values, server commands, browser controls,
expected outcomes and evidence to record. The original
[P4-U2 evidence](../status/p4-u2c-evidence.md) and completed
[P4-U2-DEV evidence](../status/p4-u2-dev-c-evidence.md) are implementation results;
they do not fill in your manual review.

### Recommended first retained-setup session

1. Run **M01**, set the server variables in section 3, then complete
   [DM01 profile inspection](#dm01-inspect-the-delivered-profile-and-recovery-history)
   and [DM02 stopped-case discovery](#dm02-verify-retained-cases-while-the-setup-is-stopped).
2. Optionally start [DM07's no-call counters](#dm07-prove-no-call-reuse-stopstart-and-quiet-restart-persistence),
   then complete [DM03 restore/publication/start](#dm03-restore-publish-current-cases-and-start-without-calling).
   Finish the no-call counter window before submitting any calls.
3. Run [DM04 positive calls and exact subsets](#dm04-select-exact-grant-subsets-and-prove-both-tenants-calls),
   [DM05 negative cases](#dm05-exercise-the-prepared-negatives-and-draft-separation)
   and [DM06 expiry/revocation](#dm06-test-actual-expiry-and-revocation-without-a-five-minute-wait).
4. If reviewing maintenance too, use [DM07 restart persistence](#dm07-prove-no-call-reuse-stopstart-and-quiet-restart-persistence)
   and [DM08 transfer/return](#dm08-transfer-7701-to-b-and-return-it-through-current-ui-guards).
   Each requires a quiet window and invalidates earlier readiness.
5. Finish with [DM10 loaded cleanup](#dm10-apply-loaded-cleanup-and-confirm-the-setup-stays-reusable),
   M16/M17 access/layout observations, and section 22's private sign-off.

Other review paths:

| Goal                                          | Path                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Inspect without changing the setup or calling | M01 → section 3 → DM01 → DM02                                                                                         |
| Original allocation/group/routing forms       | Section 3.1 → M03–M11, using separate approved desired-only stock                                                     |
| Exact recovery and fault review               | M15 and [DM09](#dm09-inspect-real-recovery-controls-keep-disruptive-faults-isolated); disruptive faults stay isolated |

All numbered command blocks below are instructions for the tester. Updating this
guide does not run them, change the retained setup or establish a new manual pass.

### Implemented scope only

| Included in this guide                                                                                                                                                                                       | Kept outside the test checklist                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform allocation/reservation, owned bindings, revision review/apply/recovery, controlled SIP/RTP, grants, profile inspection/rehearsal, persistent case lifecycle, retirement/transfer and loaded cleanup | P4-U3 activate/suspend/retire tenant workflows; P4-U4 tenant/staff administration; P4-U5 staff-extension assignment; P5-U3 operational call/incident ingestion |
| Existing controlled private participants, browser accessibility and exact supported recovery                                                                                                                 | Desktop softphone/public browser calling, PSTN/emergency calls, public/WebRTC deployment and a general profile/destination editor                              |

There are no required steps for those later features. Seeing a tenant remain draft
or the absence of an assignment workflow is not a failure of the implemented controlled-call
workflow. Correct-password staff login is not a prerequisite: the retained initial
administrators deliberately have unset credentials.

## 1. Choose the test environment and record results

Choose the applicable review path:

| Part                          | Where to run it                                                                                                                   | What it establishes                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Desired-state manual review   | Ordinary private platform console, dedicated test tenants/resources                                                               | Allocation, bindings, conflicts, review, access, and browser behavior                                                 |
| Controlled live manual review | The approved retained ordinary installation with its persistent case manifest, or a separately approved private test installation | Actual apply, calls, readiness, recovery, retirement, and transfer                                                    |
| Companion verification        | Existing Docker acceptance commands                                                                                               | Repeatable real-service, live, concurrency, interruption, and provider checks; these are automated, not manual passes |

The retained ordinary development installation now has the approved upgraded
static profile and persistent controlled setup. Use the exact
[preparation manifest](../planning/p4-u2-dev-b-manifest.json),
[ordinary acceptance ledger](../status/p4-u2-dev-c-evidence.md) and
[supported preparation/acceptance commands](../runbooks/persistent-controlled-calls.md).
The isolated `--live` / `--browser` suites still remove their fixtures; they do not
populate or renew this ordinary setup. Existing cases remain discoverable after
cleanup, but stopped preparation, disabled paths, expired custody or revoked grants
truthfully prevent calling. Availability does not establish readiness.

DM03–DM08, sections 13–16 and the installed-resource portion of section 19 require
the live prerequisites in section 3 and DM01–DM03. If prerequisites are absent, record **Blocked —
controlled live environment not prepared** and keep that manual sign-off open.
Use the existing approved deployment workflow; never invent credentials, a public
SIP listener, a destination editor or a “keep fixtures” option.

For each test, record **Pass**, **Fail**, **Blocked**, or **Not exercised**, plus:

- Date/time, operator, browser, viewport, tenant code/UUID and PBX node/installation.
- Steps, expected result, observed result, and a screenshot of the relevant state.
- Safe claim/authorization/revision/artifact/test/retirement IDs when applicable.
- For command runs: exact command, exit code, cleanup/restoration result and log path.

Keep passwords, cookies, CSRF proofs, provider tokens, endpoint secrets, raw SIP
messages and unredacted HAR exports out of the report. Store your report in an
ignored local folder, for example `.local/verification/p4-u2-manual/`.

## 2. Open the applications and establish a baseline — M01

From `/home/gino/projects/IMS-rebuild` on the server:

```sh
./dev platform-https-status
./dev staff-https-status
./dev health
./dev pbx-live-check
```

**Expected:** HTTPS helpers report `ready`; backend live/ready return 200 with
PostgreSQL and both Redis services up. For the retained managed PBX, the last
command must verify its protected/loaded runtime, initial/current recovery
references, zero channels and no pending operation. Save these safe baseline facts.
A failure needs investigation before any apply; do not capture a replacement initial
baseline to make the check pass.

Use your existing SSH tunnels and trusted development CA from the
[platform HTTPS guide](../runbooks/platform-development-https.md) and
[staff HTTPS guide](../runbooks/staff-development-https.md). Desktop addresses:

| Purpose                                     | Address                              |
| ------------------------------------------- | ------------------------------------ |
| Platform operator                           | `https://localhost:3443/sign-in`     |
| Staff ordinary sign-in                      | `https://localhost:3444/sign-in`     |
| Administrator credential handoff, if needed | `https://127.0.0.1:3444/credentials` |

If tunnels are not already open, use a separate desktop terminal and your actual
SSH host (replace `YOUR_DEV_HOST`):

```sh
ssh -N -L 3443:127.0.0.1:3101 -L 3444:127.0.0.1:3102 gino@YOUR_DEV_HOST
```

Keep that terminal open. Use the linked CA setup for each origin before continuing;
do not disable certificate checks. The platform and staff certificate/trust setup
may differ. Server Bash commands in this guide run in your other server terminal.

Use your existing operator account. Keep a second browser profile/private window
for access-isolation tests, and two ordinary tabs for stale/concurrent edits.
No migration, database reset or service recreation is needed merely to read this
guide or test the already deployed desired-state screens.

## 3. Choose the retained setup or separate desired-only stock — M02

For the main P4-U2-DEV walkthrough, **reuse the existing setup below**. Do not create
another pair of tenants or run initial provisioning again. These are safe identifiers
and sample field values, not credentials. Read current versions and case UUIDs from
the console/status; versions in past reports are historical.

| Field / resource                                       | Tenant A                                     | Tenant B                                     |
| ------------------------------------------------------ | -------------------------------------------- | -------------------------------------------- |
| Tenant code                                            | `p4-dev-a`                                   | `p4-dev-b`                                   |
| Display name                                           | `P4 controlled development A`                | `P4 controlled development B`                |
| Tenant UUID                                            | `0e1d45a7-6afb-4621-afd3-68b45c5d450a`       | `cfb6a7fe-80ef-4ec5-95bb-fbbb97f2d9d0`       |
| Tenant lifecycle / voice preference                    | Draft / Voice enabled                        | Draft / Voice enabled                        |
| Initial administrator                                  | `controlled-admin`; credentials remain unset | `controlled-admin`; credentials remain unset |
| Extension number                                       | `7701`                                       | `7702`                                       |
| Extension UUID                                         | `5c91cc6b-414e-4b34-b237-4c53e8f1447e`       | `0f6a12d6-d11c-481b-a27d-b7a2c611ce66`       |
| Exact inbound DID / Sample dialled number              | `5557701`                                    | `5557702`                                    |
| DID UUID                                               | `5b32b89f-343b-4e48-abc6-9915e8325e8a`       | `0c869e2f-4b1e-42f7-b0b5-948e9b785e5e`       |
| Current inbound rule at completed handoff              | `e3cf3eed-986a-4472-919a-583ed4e2f46b`       | `95ec29a3-df4c-460d-9d89-31d50a47cf16`       |
| Inbound destination type / resource                    | Extension / `7701`                           | Extension / `7702`                           |
| Exact outbound match / Tenant outbound advisory number | `5558701`                                    | `5558702`                                    |
| Outbound rule UUID                                     | `666a2cab-2637-4690-b032-86fe64788e01`       | `fe6da3ae-5f64-4d73-8729-8099b3b79d14`       |

Shared setup:

| Field                               | Value / interpretation                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| PBX node UUID                       | `bcb9d21c-96cd-4975-bd68-314b588a23a9`                                                      |
| Installation UUID                   | `58adb785-5384-41ce-9c72-ccda6ea554db`                                                      |
| Preparation request / manifest      | `86e0cc54-7843-4f30-9aef-41eb7f3c1b1c`; `docs/planning/p4-u2-dev-b-manifest.json`           |
| Controlled gateway                  | `P4 controlled ingress`; `ef4ca480-4a0c-453b-9c0b-f2e210ce05bc`                             |
| Controlled trunk                    | `P4 controlled sink`; `ae5b4537-47c2-4b54-86c4-a51391a59014`                                |
| Negative-control stock              | `7703`; `3f2691ab-5bbd-478c-860a-87cc111fd07f`; remains unallocated                         |
| Private ingress / caller / sink     | `127.0.0.2:20021` / `127.0.0.3` / `127.0.0.4:20020`, inside the approved server environment |
| Media                               | Anchored bidirectional RTP, `ulaw`, retained RTP range `10020–10039`                        |
| Approved static profile digest      | `f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`                          |
| Original 7701 credential generation | `9a1724c3-4e60-4691-821f-333797f82827`                                                      |
| Original 7702 credential generation | `55538fe0-3f5f-4da6-bb9d-d2dd02f1202b`                                                      |
| Original 7703 credential generation | `404780b0-ce0d-4a8a-bfeb-5f398561fcac`                                                      |

These numbers reach only the approved private participants. They are not PSTN or
emergency destinations, and the loopback addresses are not desktop softphone
settings. The browser chooses existing cases; it does not ask you for SIP passwords,
provider tokens, a destination hostname or raw SIP headers.

At the **2026-11-15 completed handoff**, preparation was stopped at lifecycle version
17, all nineteen historical grants were revoked, the three controlled extensions
and gateway/trunk were disabled, and verification bindings/permissions were revoked.
Sixteen current cases remained retained (A nine/B seven), plus historical disabled
cases. The current/installed/known-good cleanup artifact was
`a6152e67-1a7f-4a87-bb47-b1fda3f22bdd`, epoch 22/generation 64. There were 54
historical results, eleven artifacts and 183 retained pin references in 72 groups.
**These are checkpoint values, not values to force into today's system.** A new
manual session creates new revisions, cases, grants and results; record those IDs.

In particular, A's original inbound rule `719df50c-c2fe-483e-ad17-df820eaff5f1`
was removed during the accepted transfer. Inspect the current rule by DID rather
than reusing that removed UUID. The manifest's original `expectedArtifactId` is
also historical: **keep the accepted manifest unchanged** and use supported
successor publication for current facts.

### Server terminal and private report folder

Run Bash commands below on the development server, not in Windows PowerShell or
inside a browser console. Commands starting with `./dev` use the Docker workspace.
Use one server shell throughout so the variables remain available:

```sh
cd /home/gino/projects/IMS-rebuild
umask 077
p4_manifest=docs/planning/p4-u2-dev-b-manifest.json
p4_node=bcb9d21c-96cd-4975-bd68-314b588a23a9
p4_installation=58adb785-5384-41ce-9c72-ccda6ea554db
p4_manual_run=$(./dev exec node -p 'require("node:crypto").randomUUID()')
p4_manual_dir=".local/verification/p4-u2-manual/$p4_manual_run"
mkdir -p "$p4_manual_dir"
printf '%s\n' "$p4_manual_run" "$p4_manual_dir"
```

Keep the displayed UUID/folder in your private report. A new reviewed session uses
new IDs; recovering an uncertain effect uses its original ID. Do not generate a
new run UUID just to repeat a call whose result is unknown.

`CURRENT_VERSION`, `EXACT_ARTIFACT_UUID` and `YOUR_DEV_HOST` below are placeholders
that must be replaced. For example, if status reports `event.version: 17`, the
next lifecycle command uses `17`; after that command succeeds, read status again.
Never copy 17 from this guide without checking.

### Separate desired-only tests

M03–M11 also cover the original P4-U2 allocation/group/routing forms. Their spare
7300-series stock is **a separate desired-state exercise**, preferably on a
separately approved test node. Do not add it to the retained live setup merely to
complete a form test. Use the detailed samples in [section 3.1](#31-sample-values-for-separate-desired-only-tests).
If you only have the retained three extensions, run DM01–DM10 first; mark
spare-stock/paging/race cases not exercised rather than borrowing unrelated stock.

## DM01. Inspect the delivered profile and recovery history

**Covers:** DEV-a A-01–03/A-06, profile parts of parent AC-01–03. This test inspects
the delivered upgrade; it does not rerun a static-profile migration.

1. Complete M01. Open **PBX nodes**, inspect the exact node in section 3, and record
   the installation, current verified artifact, initial baseline and known-good target.
2. On the server run:

   ```sh
   ./dev pbx-profile status "$p4_node" "$p4_installation"
   ./dev pbx-live-check
   ./dev tenant-calls inspect "$p4_node" "$p4_installation"
   ./dev tenant-calls status "$p4_manifest"
   ./dev tenant-calls preview "$p4_manifest"
   ```

3. Compare the current profile facts with this table and the
   [delivered profile evidence](../status/p4-u2-dev-a-evidence.md):

   | Item                          | Expected                                                                                                               |
   | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | Original initial baseline     | `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7` remains retained                                                                |
   | Static profile digest         | Exact approved digest from section 3, unless a separately reviewed later transition exists                             |
   | Module policy                 | Explicit `autoload=no`; ten required capabilities loaded                                                               |
   | Added module names            | `bridge_simple`, `res_speech`, `res_agi`, `func_channel`, `res_pjsip_header_funcs`, `res_pjsip_endpoint_identifier_ip` |
   | Media                         | Anchored; native RTP bridge excluded; `10020–10039` preserved                                                          |
   | Strict RTP / NAT / transports | Retained approved behavior; no copied reference credentials, public routes or invented external address                |
   | Runtime                       | Exact protected/loaded match; zero active channels; no unresolved operation                                            |

4. Review the sanitized [isolated compatibility result](../status/p4-u2-dev-a-compatibility.json)
   and [23-case profile rehearsal](../status/p4-u2-dev-a-rehearsal.json). Confirm they
   distinguish actual process loss from injected SQL/acknowledgement faults.
5. Record current facts separately from those historical results. Do not apply old
   `docs/status/p4-u2-dev-a-expectations*.json` as if they described today's calling
   artifact. Those snapshots predate the later tenant-aware artifacts.

**Expected:** current runtime and original recovery ancestry are coherent and
unrelated/reference bytes remain preserved. Passive inspection makes no call.
`pbx-profile status` can report `exact_provider_material_probe_required` because
its inspection-only access check does not itself prove every secret value. Check
fresh preparation custody separately; do not erase that diagnostic or treat it as
permission to bypass custody. Status returning output is not an apply-readiness pass.

**If blocked:** record the finite blocker. Expired read-only consumer access is
repaired by the deployment owner through the existing
[scoped access procedure](../runbooks/persistent-controlled-calls.md#start-stop-and-restart),
not by rotating the three endpoints. Missing modules, drift, wrong targets or an
unknown operation must be resolved before live tests.

For deployment-assisted preservation review, optionally capture safe row hashes
and protected artifact/reference metadata before changing the ordinary setup:

```sh
./dev exec node scripts/tenant-call-preparation-preservation.mjs before "$p4_node" "$p4_installation" "$p4_manual_dir/rows-before.json"
./dev pbx-profile preservation before "$p4_node" "$p4_manual_dir/protected-before.json"
```

These are read-only snapshots into your exclusive private report folder. Preserve
them and record intended changes; DM10 captures a final comparison point.

Do not manually kill the retained PBX or downgrade it to reproduce DEV-a faults.
If fresh fault proof is required, DM09 lists the implemented isolated commands.
A general browser profile editor is not part of this feature.

## DM02. Verify retained cases while the setup is stopped

**Covers:** DEV-b B-03/B-04/B-06/B-07 and DEV-c C-07.

1. Keep preparation stopped and grant-free. Run:

   ```sh
   ./dev tenant-calls status "$p4_manifest"
   ```

2. Read `event.action`, `event.version`, `caseGeneration`, `custody`, `blockers` and
   `cases`. `state: prepared` means durable setup exists; **it does not mean started**.
   The event is authoritative for lifecycle: a stopped event has `action: stop`.
   `cases` may include disabled historical rows; do not treat every stored row as
   a currently selectable case.
3. In the browser open **Tenants → p4-dev-a → Tenant route bindings**. Choose the
   exact node under **Routing PBX node**, then find **Verified tenant routing**.
   Repeat for `p4-dev-b` in another tab.
4. Record the current case IDs, their direction, dialled number, kind, expected
   outcome and availability. At the completed handoff, current cases numbered nine
   for A and seven for B. Additional history is expected after another reviewed publication.
5. Confirm unavailable cases remain visible, with **preparation unavailable** or a
   truthful blocker. No grant checkbox starts checked. **Grant verification** is
   disabled with an empty/unavailable subset; **Run controlled call test** cannot
   dispatch an unavailable case.
6. Click **Reload evidence**, switch tabs, return, and refresh the page. Reopen the
   same tenant/node. Compare test IDs/times and existing grant expiries with step 4.

**Expected:** saved setup/cases persist, readiness is **Incomplete**, no new grant
or test appears, and no expiry/result timestamp moves forward. A stopped setup is
an expected baseline, not a missing implementation.

**Record:** preparation request, event version/action, current case generation,
case IDs/count per tenant and unchanged historical result/grant timestamps. Do not
claim zero network traffic from browser inspection alone; DM07 provides counters.

## DM03. Restore, publish current cases and start without calling

**Covers:** DEV-b B-01–04 and DEV-c C-01. This section changes the approved ordinary
setup. Complete DM01/DM02 first, finish other live work, and use only the section 3 resources.

### A. Revoke existing grants and establish a stopped, quiet state

1. In each tenant panel inspect **Draft verification grant**. For every grant owned
   by your review, select it and choose **Revoke selected grant**. Reload evidence.
   Inactive grants remain selectable for inspection/revocation.
2. Read status. If the latest action is `start`, generate a new stop request, use
   that exact current `event.version`, and stop:

   ```sh
   p4_stop_request=$(./dev exec node -p 'require("node:crypto").randomUUID()')
   ./dev tenant-calls stop "$p4_manifest" "$p4_stop_request" CURRENT_VERSION
   ./dev tenant-calls status "$p4_manifest"
   ```

   Skip the stop mutation when already stopped. Do not use terminal `disable` for
   ordinary stop/reuse. Unknown/queued/dispatching/admitted work must be resolved
   first; let active calls finish naturally.

3. Run `./dev pbx-live-check`; require zero channels, no pending operation and exact
   protected/loaded match. A failed quiet/safety check stops this procedure.

### B. Restore the existing desired graph and apply it

If testing zero-call restoration, start DM07's counter-only observation now,
before changing resources, and stop/read it after part D but before DM04 calls.

Choose **one** of the two methods; do not run both just to duplicate the same apply.

**Manual controls:**

1. Open `/pbx-nodes/bcb9d21c-96cd-4975-bd68-314b588a23a9/inventory` on the platform
   origin. Wait for **Canonical extension inventory** to load. Expand extension
   `7701`, choose **Inspect extension 7701**, then **Re-enable desired extension**.
   Repeat for `7702` and `7703`. All three are enabled for the live matrix, but
   `7703` stays unallocated. Do not choose credential setup/reset or profile adoption.
2. Open the node's **Trunks and gateways**, inspect `P4 controlled ingress`, and
   choose **Enable gateway** if disabled. Inspect `P4 controlled sink` and choose
   **Enable trunk** if disabled. Existing private host/port/media settings stay unchanged.
3. Inspect the existing inbound rules by DID. Ensure A's current rule targets
   extension `7701`, B's targets `7702`, and the intended rules are enabled. If a
   structural edit is actually needed, revoke that rule's current inbound binding
   before editing and preview/save it again afterward. The retained live graph
   uses direct extensions, not GA/GB groups from the spare-stock tests.
4. On each tenant open **Tenant route bindings** and select **Routing PBX node**.
   For each row below, choose the named **Authorization**, select the existing
   resource, click **Preview inbound/outbound authorization**, inspect the exact
   tenant/node/resource/version, then **Save inbound/outbound authorization**.
   Already-current authorizations may be retained; stale ones need a fresh review.

   | Tenant / configuration                    | Authorization                            | Existing resource / other field                 |
   | ----------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
   | A / Inbound routes                        | DID ownership                            | DID `5557701`                                   |
   | A / Inbound routes                        | Inbound route binding                    | Current rule for `5557701 → 7701`               |
   | B / Inbound routes                        | DID ownership                            | DID `5557702`                                   |
   | B / Inbound routes                        | Inbound route binding                    | Current rule for `5557702 → 7702`               |
   | A / Outbound routes and trunk permissions | Trunk ownership or shared classification | `P4 controlled sink`; **Shared platform trunk** |
   | A / Outbound routes and trunk permissions | Explicit trunk permission                | `P4 controlled sink`                            |
   | B / Outbound routes and trunk permissions | Explicit trunk permission                | The same shared trunk                           |
   | A / Outbound routes and trunk permissions | Outbound route binding                   | Rule matching exactly `5558701`                 |
   | B / Outbound routes and trunk permissions | Outbound route binding                   | Rule matching exactly `5558702`                 |

5. In A enter **Tenant outbound advisory number** `5558701` and preview; repeat for
   B with `5558702`. Confirm the correct bound rule/trunk and unchanged digits.
   A shared classification alone does not grant either tenant permission.
6. Follow M11/M12 to capture current desired state, review against the actual
   verified runtime, validate, tick the runtime review checkbox and apply once.
   Use **Reload live state** until independently verified. Record the new artifact
   and source/revision. A `202` or pending stage is not a passed apply.

**Assisted alternative:** the existing `restore` stage performs these canonical
HTTPS controls and the reviewed apply. It is automation, not a manual UI pass:

```sh
./dev tenant-calls accept "$p4_manifest" restore "$p4_manual_run"
```

Record `appliedArtifact` from the private journal
`.local/verification/p4-u2-dev-c/$p4_manual_run/restore.json` and verify the same
artifact in the normal console. If the stage fails after accepting an effect,
recover its exact receipt; do not create another run to repeat an uncertain apply.
Use `restore`, **not initial `configure`**, for this retained setup. `configure`
requires the original pre-c artifact and original untouched graph, which no longer
represent the accepted handoff.

**Expected after either method:** desired resources/authorizations and the exact
applied graph are current. No grant or call has been created. Calling cases may
still be unavailable because publication/start are separate.

### C. Export and inspect the successor plan

```sh
./dev tenant-calls plan-successor "$p4_manifest" "$p4_manual_dir/successor.json"
```

Open this private JSON file in your editor. Do not edit the accepted manifest.
Check the following before publishing:

| Plan field                 | Review                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `requestId`                | Newly generated publication request; retain it for exact recovery                                                  |
| `expectedGeneration`       | Current publication generation from status, not the desired next number                                            |
| `expectedLifecycleVersion` | Current stopped event version                                                                                      |
| `expectedArtifactId`       | The exact verified restoration artifact from part B                                                                |
| `expectedSourceDigest`     | Current canonical source; no intervening resource edits                                                            |
| `facts`                    | Same two tenants, original three extension/material generations and approved resource/claim/permission versions    |
| `cases`                    | Only approved private numbers, exact sources, destinations and expected outcomes; at most sixteen cases per tenant |

Plan export is read-only apart from creating its exclusive private output file.
It creates no case publication, grant or call. If the file already exists, inspect
it rather than overwrite it. For a later changed graph, use a new descriptive file
such as `successor-after-transfer.json`; never retarget an uncertain old publication.

### D. Publish, wait for fresh custody and explicitly start

```sh
./dev tenant-calls supersede "$p4_manifest" "$p4_manual_dir/successor.json"
./dev tenant-calls status "$p4_manifest"
```

**Expected:** one new immutable fact set/case generation; prior cases remain in
history but are disabled for new selection. Lifecycle is still stopped. Publication
invalidates the old custody proof; wait for the independent consumer to produce
fresh current proof. Status polling is read-only; do not repeatedly publish to
work around a stale proof.

Once status shows current custody and no unresolved-work blocker:

```sh
p4_start_request=$(./dev exec node -p 'require("node:crypto").randomUUID()')
./dev tenant-calls start "$p4_manifest" "$p4_start_request" CURRENT_VERSION
./dev tenant-calls status "$p4_manifest"
```

Replace `CURRENT_VERSION` with the latest stopped `event.version`. Record that
number as well as `p4_start_request`. As an exact-retry test, repeat the **same**
start command with the **same original number and request UUID**. It must return
the same lifecycle event, not a second event or extended grant/result lifetime.

**Expected:** current event is `start`, bound to this native instance/owner; current
cases are available, both tenants remain draft, and readiness is still Incomplete.
No grant, REGISTER, INVITE or call is caused by restoration, publication or start.
If status reports `native_restarted`/`owner_changed`, inspect current proof and
perform an explicit start for that instance; do not reuse stale admission.

## DM04. Select exact grant subsets and prove both tenants' calls

**Covers:** DEV-c C-02/C-08 and individual extension evidence. Use the current case
generation from DM03, not case IDs copied from the old results ledger.

1. Open A's **Verified tenant routing** and choose **Reload evidence**. Record its
   artifact/revision. Verify every checkbox under **Cases permitted by the new
   grant** starts unchecked on a fresh mount.
2. Check only A's `inbound · routing · 5557701 · expected permitted` case. Record its
   case UUID, source gateway UUID and expected destination extension UUID from your
   reviewed plan. Confirm **1 cases selected**. Choose **15 minutes**, then
   **Grant verification** once. Reload evidence; record the new grant ID/expiry.
3. Select that grant under **Draft verification grant**, and the exact case under
   **Controlled call case**. Click **Run controlled call test** once. Wait for a
   terminal result; use **Reload evidence** for current progress. A test is bounded
   by the adapter's 30-second dispatch deadline, with bounded completion/recovery.
4. Record test ID, finished time, expected/observed outcome, state, revision/artifact,
   `current provenance` and **observed destination**. Require the inbound destination
   to equal A's extension UUID, not merely display number 7701.
5. Before granting more cases, select A's different outbound permitted case while
   keeping the one-case inbound grant. Submit once. Expect a current-subset grant
   denial before dispatch, not a second SIP call. An admission rejection is not a
   passed negative SIP result. No new executed test/result should appear.
6. Select the original grant and **Revoke selected grant**. Choose **Clear grant
   selection**, select A's two positive cases only, set **15 minutes**, grant once
   and record that new grant. Run inbound then outbound sequentially.
7. Repeat the two-positive subset grant and sequential calls for B. Use the table:

   | Tenant | Direction / case dialled number | Source to identify    | Required observed destination                         |
   | ------ | ------------------------------- | --------------------- | ----------------------------------------------------- |
   | A      | Inbound / `5557701`             | Controlled gateway    | Extension UUID `5c91cc6b-414e-4b34-b237-4c53e8f1447e` |
   | A      | Outbound / `5558701`            | Extension `7701` UUID | Trunk UUID `ae5b4537-47c2-4b54-86c4-a51391a59014`     |
   | B      | Inbound / `5557702`             | Controlled gateway    | Extension UUID `0f6a12d6-d11c-481b-a27d-b7a2c611ce66` |
   | B      | Outbound / `5558702`            | Extension `7702` UUID | The same approved trunk UUID                          |

8. Have the approved participant/observer confirm the destination and bidirectional
   RTP in each positive call. Keep safe observation IDs and results, not raw SIP or
   audio/credential dumps. The UI summary alone is not independent RTP evidence.
9. Revoke each batch grant when done. Granting, selecting, reloading and reading
   must not call on their own. Only one unresolved installation-wide test may run;
   do not open concurrent call jobs in the other tenant tab.

**Expected:** each tested extension has its own current inbound/outbound evidence,
with the exact owned claim/resource versions. Record readiness separately and
complete DM05 even if the panel already says Ready after required positive proof.
A Ready summary is not evidence that every negative scenario was exercised, that
another extension was individually proved, or that any extension was assigned to staff.

## DM05. Exercise the prepared negatives and draft separation

**Covers:** DEV-c C-03. Grant only the exact reviewed negative subset for this
batch, with a lifetime such as **15 minutes**. Identify cases by UUID, kind, source
and dialled number; several rows intentionally share the same dialled number.

| Select from current reviewed plan                         | Sample / source                                          | Expected                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| A cross-tenant inbound                                    | `5557702`, A case against B's inbound graph              | Actual denied; no B endpoint destination                                    |
| B cross-tenant inbound                                    | `5557701`, B case against A's inbound graph              | Actual denied; no A endpoint destination                                    |
| A foreign outbound source                                 | `5558701`, source extension `7702`                       | Actual denied; no outbound trunk destination                                |
| B stale former-owner source after completed A→B→A history | `5558702`, kind **stale source**, source `7701`          | Actual denied; old B claim does not regain authority                        |
| Unallocated outbound source                               | `5558701` or `5558702`, source `7703`                    | Actual denied although this controlled endpoint has material and is enabled |
| Unknown source                                            | A's reviewed unknown-source case / `5558701`             | Actual denied; number/header cannot invent ownership                        |
| Ambiguous source                                          | Kind **ambiguous source**, each tenant's outbound number | Actual denied; no guessed tenant                                            |
| Ordinary draft                                            | Kind **ordinary draft**, each tenant's outbound number   | Actual denied outside the controlled nonce/grant admission path             |

1. For each case click **Run controlled call test** once, await its definite result
   and record expected denied / observed denied. Require no foreign destination.
2. Confirm each tenant still shows **Draft** and **Voice enabled**. Inspect its
   initial administrator: `controlled-admin` still has unset credentials.
3. Do not establish/reset administrator credentials as a prerequisite for this
   walkthrough. No successful ordinary staff login or staffed extension assignment
   is a required test here. An optional sign-in attempt with deliberately invalid
   credentials can show denial, but it cannot prove correct-password lifecycle denial.
4. Compare actual denied SIP results with pre-dispatch UI grant rejection from
   DM04. Keep them as separate observations. An unknown/timeout or transport fault
   is not an authorization-denial pass.
5. Revoke the negative batch grants after recording results.

**Expected:** prepared negatives deny under current provenance. A denied expectation
may have a successful test state because denial is the intended result. If an
isolation case is unexpectedly permitted, stop testing and retain the blocker; a
revoke must not erase that runtime failure. Do not deliberately corrupt retained
routing to manufacture an unexpected-permitted scenario; use isolated coverage.

If a case is not in the current approved plan, record not exercised/needs current
publication; do not invent a raw sender, destination or case in the browser.

## DM06. Test actual expiry and revocation without a five-minute wait

**Covers:** DEV-c C-04. This uses the implemented **expiry** case. It intentionally
waits at the controlled admission boundary and then attempts real SIP under the
changed condition. Do not substitute a normal positive case or another tenant's case.

### Expiry during an admitted controlled test

1. Revoke other grants for the expiry-case tenant. **Clear grant selection** and
   select only the available case whose kind is **expiry** (normally A, outbound
   `5558701`). Set **Verification lifetime → 10 seconds (expiry verification)**.
2. Click **Grant verification**, reload evidence, record the grant and displayed
   expiry, then promptly select it and the expiry case.
3. Click **Run controlled call test** before the grant expires. Wait for the result.
   Record the finished time relative to expiry and the actual denied outcome with
   no destination. It must not promote readiness.
4. If you missed the window and the UI rejected before dispatch, record that as
   grant admission denial; it is not the in-flight expiry test. After resolving the
   prior request, use a newly reviewed grant for a fresh explicit attempt.
5. Revoke the old grant explicitly even if already inactive; preserve its times.

### Revocation while the bounded case is waiting

1. Select only the same available expiry case and issue a new **10 seconds** grant.
   Select it and submit one test promptly.
2. After the intent is recorded and controls become available, click **Revoke
   selected grant** while that test is still waiting. Do not wait for natural expiry.
3. Reload evidence. Require actual denied, no destination, inactive grant and a
   finished time **before its original expiry** to attribute this result to revoke.
   If it finished after expiry, record timing inconclusive for the revoke scenario.
4. Keep history; do not change the server clock or stored timestamps. Ten-second
   grants and the 24-hour evidence ceiling test different requirements.

For timing assistance, the implemented companion command is:

```sh
./dev tenant-calls accept "$p4_manifest" conditions "$p4_manual_run"
```

It creates the exact short grants, observes dispatch and revokes its own grants.
Its result is automated ordinary-environment proof, not a manual click result.

## DM07. Prove no-call reuse, stop/start and quiet restart persistence

**Covers:** DEV-b B-02/B-04/B-05 and DEV-c C-04/C-07.

### Counter-only observation of restore/publication/start/reads

For strongest proof, start this observation **before DM03** and do not submit any
DM04–DM06 calls until you have stopped and recorded the window:

```sh
p4_observation=$(./dev exec node -p 'require("node:crypto").randomUUID()')
./dev tenant-calls observe-start "$p4_manifest" "$p4_observation"
./dev tenant-calls observe-status "$p4_manifest" "$p4_observation"
```

Perform DM03 restore/publication/start and normal case/evidence reads. Record the
new artifact/case IDs without granting or calling. Then:

```sh
./dev tenant-calls observe-status "$p4_manifest" "$p4_observation"
./dev tenant-calls observe-stop "$p4_manifest" "$p4_observation"
```

**Expected:** zero INVITE, REGISTER and RTP counts across that no-call window, with
no new test or grant and no extension of old result times. The observer stores only
counters, changes no packet verdict and removes only its exact counter table.
If it reports `not_observing`/null or the Asterisk network namespace was replaced,
there is no zero-traffic proof for the missing interval. Start a new explicit window;
do not label missing counters as zero.

### Explicit lifecycle stop/start and exact retry

1. Revoke grants and wait for all calls to resolve. Record current test IDs/times.
2. Read the current lifecycle version and stop with a new request UUID as in DM03-A.
3. Reload both tenant panels: retained current cases become unavailable, and no
   new call can dispatch. Setup/resources/history remain.
4. Wait for current custody and explicitly start using a new request/current stopped
   version. Repeat the exact successful command once, as in DM03-D.
5. Cases may become available again; no grant, call or new result should appear.
   The `restart MANIFEST REQUEST_UUID VERSION` lifecycle command is an explicit
   current-instance start; it does **not** restart Docker/Asterisk itself.

### Normal service restart while quiet

1. Finish the counter window above, revoke all grants, explicitly stop, and require
   `./dev pbx-live-check` to report zero channels/no pending work. Record the verified
   artifact, profile, current owner/instance, case IDs and latest result/grant times.
2. The deployment operator performs a normal quiet service restart using the
   existing retained containers/lifecycle, preserving volumes, installation and
   selected profile. For the exact existing retained containers, after those guards
   pass, the server deployment terminal can use normal Docker restart:

   ```sh
   docker restart myims-rebuild-dev-backend-1 myims-rebuild-dev-telephony-1 myims-rebuild-dev-asterisk-1
   ```

   This restarts application/consumer/native services, not PostgreSQL, Redis or the
   provider. It is a deployment step, not a new browser button or fault injection.
   Do not force-hangup calls, recreate volumes or replace the installation. If the
   container names differ, have the deployment owner identify the actual retained
   services rather than substituting arbitrary containers.

3. Run M01 and `./dev tenant-calls status "$p4_manifest"` again. Wait for real readiness;
   an immediate startup 503 is not a permanent failure or permission to send calls.
4. Before explicit start, cases must remain unavailable for stopped/stale instance
   proof. After fresh custody, start with a new request and current lifecycle version.
5. Reopen A/B in the ordinary console. Cases/history persist; new owner/generation
   and invalidated old readiness are truthful. Old grant/result times do not advance,
   and no read/restart/start redials a call. Finish without a grant or call if this
   is a no-traffic persistence test.

The final accepted implementation also proved a still-unexpired old-generation
15-minute grant is rejected before creating an intent. The existing `restart-grant`
/ `restart-check` stages cover that advanced companion scenario with their same-run
journal. It requires an explicit exact-owned-grant restart guard; it is not part of
this simpler all-grants-revoked manual restart. Do not weaken quiet guards to stage it.

## DM08. Transfer 7701 to B and return it through current UI guards

**Covers:** DEV-c C-06 and parent AC-10. Use M18 for the exact retirement controls.
Run this only as an explicitly planned maintenance exercise after DM04/DM05 results
are saved; it invalidates the earlier call evidence and creates new claim/rule history.

1. **Quiesce.** Revoke both tenants' grants; resolve work; stop preparation using current lifecycle version.

   **Record / expected:** Zero activity, no unknown work; record current artifact R1 and current A rule by DID `5557701`.

2. **Remove loaded endpoint.** Disable desired `7701`; capture/review/validate/apply replacement R2 without that endpoint/material dependency.

   **Record / expected:** 7701 still owned by A; exact native verification of R2; do not release from desired disablement alone.

3. **Retire eligible old pins.** In **Superseded artifact retirement**, select each eligible artifact actually pinning 7701, select **Extension removed from runtime → 7701**, review R2/recovery targets, tick review and **Request exact artifact retirement**.

   **Record / expected:** Only exact eligible superseded targets retire; current/initial/known-good/required recovery targets remain protected; bytes/history retained.

4. **Remove A desired blocker.** Revoke A's current **Inbound route binding**, then remove its current inbound rule for DID `5557701` through **Remove inbound rule → Confirm removal**.

   **Record / expected:** Use the current A rule UUID, not original removed `719df50c…`; retain A's DID ownership.

5. **Release and allocate.** On A **Extension allocation**, **Release extension 7701** once allowed. On B find `7701`, choose **Allocate capacity**, preview and **Save allocation**; re-enable desired extension if needed.

   **Record / expected:** Same extension UUID/material, a new B claim; A's released claim/history unchanged.

6. **Bind B destination.** Revoke B's current inbound binding before editing B's rule. Set **Inbound destination → Extension**, **Destination resource → 7701**, save, preview/save a fresh B inbound binding; retain B outbound permission/rule.

   **Record / expected:** Editing a still-bound rule can reject with a dependency conflict; do not bypass it.

7. **Apply and publish.** Capture/apply the B layout; export a new `successor-after-transfer.json`, inspect/publish it, wait for custody and explicitly start.

   **Record / expected:** New current cases; old selections disabled; no grant or call caused by publication/start.

8. **Prove new ownership.** Grant B's reviewed fresh 7701 inbound/outbound subset, run both; grant A's prepared **stale source** denial case and run once.

   **Record / expected:** Exact B destination/source proof plus actual stale-A denial; B's 7702 lacks individual inbound proof while its route targets 7701.

9. **Quiesce for return.** Revoke grants, resolve work and stop again. Revoke/edit/rebind B's inbound rule back to **7702**.

   **Record / expected:** Revoke before structural edit; record all current versions.

10. **Return guarded allocation.** Disable 7701, capture/apply a replacement omitting it, retire only eligible remaining 7701 pins, then release B's temporary 7701 claim and allocate that same extension back to A.

    **Record / expected:** New A claim; no credential reset, pin edit or reuse of released claim UUID.

11. **Restore A inbound.** Re-enable 7701. Create one new inbound rule on A's existing DID `5557701`, destination **Extension → 7701**, e.g. name `P4 manual A return 20261115`; enable it and preview/save its A binding.

    **Record / expected:** Old removed A rule stays historical; do not create a second live rule for the same DID.

12. **Reapply and retest.** Capture/apply; export/review/publish `successor-after-return.json`; wait/start; fresh grants/calls for A7701 and B7702 in both directions, plus B's **stale source 7701** denial.

    **Record / expected:** Both final individually proved extensions; record new claim/version/test IDs, then revoke grants.

If release/retirement still has blockers, keep the endpoint owned and enumerate
them. A new replacement does not automatically release every older pin. Do not
retire a current/recovery target or delete retained artifacts to get a green report.

The historical `transfer-*`/`return-*` acceptance stages are journaled continuations
of the original accepted chain. Their original A-rule identity is now removed.
**Do not blindly replay that initial transfer automation against today's restored
A rule.** The repeatable manual procedure above discovers the current rule and
uses canonical UI guards; only use a companion continuation whose journal and
current exact prerequisites have been checked by the deployment operator.

## DM09. Inspect real recovery controls; keep disruptive faults isolated

**Covers:** DEV-a A-04/A-05, DEV-b B-02/B-05 and DEV-c C-05/C-08.

For manual recovery, use M15's exact-control table when a genuine uncertain state
exists. Save the original request/operation/test ID before restoring connectivity.
Recover the same intent; never re-click a fresh call to see whether the old call ran.
A UI Offline toggle before submit proves unavailability only, not committed response loss.

For the delivered static-profile transition, inspect the
[immutable deployment request](../status/p4-u2-dev-a-deployment-request.json),
[verified result](../status/p4-u2-dev-a-deployment-result.json) and
[exact reconciliation](../status/p4-u2-dev-a-reconciled.json).
An actual profile rollback must select its compatible artifact **and static profile**;
a plain old managed revision is not a general static downgrade. Use the
[implemented transition/recovery procedure](../runbooks/development-container.md#retained-pbx-profile-transition-and-recovery)
for a separately reviewed operation. Repeating an accepted ordinary upgrade is not
a required manual test of the already-upgraded environment.

For fresh fault coverage, these implemented companion commands create exact owned
isolated copies and clean them up. Run sequentially, outside the live manual session:

```sh
./dev pbx-profile rehearse docs/status/p4-u2-dev-a-expectations.json
./dev tenant-calls rehearse
./dev tenant-calls rehearse-successors
./dev exec pnpm check:tenant-routing --live
./dev exec pnpm check:pbx-revisions
```

They cover profile selection/restart/reconciliation faults, exact setup retry,
successor publication races/authority, actual participant/owner/native loss, unknown
outcomes, quiet reconciliation, and full native/provider/isolation recovery. Read
actual-versus-injected boundaries in their output and the final evidence. They do
not supply a browser-visible keep-fixtures mode or a manual successful call result.

Do not manufacture a fault by editing SQL, altering receipt/result times, killing
ordinary native/database processes or changing protected `.conf` files. If no
uncertain state arises during your manual review, record that recovery row **Not
exercised manually — companion evidence reviewed**.

## DM10. Apply loaded cleanup and confirm the setup stays reusable

**Covers:** DEV-b B-06 and DEV-c C-07/C-08. Finish this after all manual live tests.
Stopping, expiry and revocation alone do not prove native path removal.

1. Save your current results/artifact/claim/case IDs. Revoke all grants owned by the
   review; resolve pending/unknown work and wait for natural call completion.
2. Read status and explicitly stop with a new request and the exact current version.
3. For manual cleanup, on both tenants revoke only the dedicated **Inbound route
   binding**, **Outbound route binding** and **Explicit trunk permission**. Keep
   existing DID ownership and shared-trunk classification. Revoke bindings by
   resource UUID; do not revoke unrelated authorizations.
4. In inventory disable desired `7701`, `7702` and `7703`. Disable the dedicated
   gateway/trunk with **Disable gateway** / **Disable trunk**. Preserve associated
   credentials, claim ownership, DIDs and history.
5. Capture current desired state, inspect the runtime comparison, validate and
   apply the clean replacement once. Wait for independent verification and record
   **that exact new cleanup artifact** as `p4_cleanup_artifact`:

   ```sh
   p4_cleanup_artifact=EXACT_ARTIFACT_UUID
   ./dev tenant-calls verify-cleanup "$p4_manifest" "$p4_cleanup_artifact"
   ./dev pbx-live-check
   ./dev health
   ./dev platform-https-status
   ./dev staff-https-status
   ```

6. Require `ordinary_loaded_cleanup_proved`, zero activity and fresh exact custody.
   The native proof checks the three controlled endpoint/auth/AOR objects and
   gateway/identify removal plus absence of controlled calling paths; harmless
   deny stubs may remain. It enumerates retained pin groups instead of deleting them.
7. Reopen each normal tenant page. Cases and old results remain discoverable but
   unavailable/stale for calling. Readiness is Incomplete; no new grant/test is made.
8. Repeat DM07's normal quiet restart/discovery if reviewing post-cleanup persistence.
   Leave the final environment stopped, grant-free and with disabled verification paths.
9. Record remaining labelled resources and pinned artifact IDs. Preserve original
   baseline/recovery bytes, all unrelated tenants/claims/peers and the three original
   provider generations. Keep private evidence; remove only your own observer counter
   table through `observe-stop` if one remains.

If you captured DM01 preservation snapshots, export the final snapshot pair:

```sh
./dev exec node scripts/tenant-call-preparation-preservation.mjs before "$p4_node" "$p4_installation" "$p4_manual_dir/rows-after.json"
./dev pbx-profile preservation before "$p4_node" "$p4_manual_dir/protected-after.json"
```

Here `before` is the supported snapshot-export action in both invocations; the
output filename labels your before/after review point. It does not assert equality.
Have the deployment reviewer compare original unrelated row hashes, immutable
artifact/reference bytes and the explicitly declared controlled-resource changes,
using the [accepted preservation report](../status/p4-u2-dev-c-preservation.json) as
a format example. New intentional revisions/results/claims are additions, not a
reason to require identical global table fingerprints. Do not substitute the
preparation-only `after` checker for a comparison that permits reviewed route/
status/ownership changes in this calling/transfer exercise.

**Assisted alternative to steps 3–5:**

```sh
./dev tenant-calls accept "$p4_manifest" cleanup "$p4_manual_run"
```

It requires stopped preparation and no active grants. Obtain its exact resulting
artifact from the ordinary console or private `cleanup.json` journal and still run
`verify-cleanup` with that artifact. It preserves DID ownership and shared classification.
Record automated cleanup separately from manual UI cleanup.

If you need a subsequent session, repeat DM03 with a fresh reviewed run and new
publication. Do not use terminal `disable`: it permanently disables this preparation
and is not the routine stop/reuse control. Do not delete tenants/volumes or clear pins.

### Troubleshooting the retained walkthrough

| What you see                                                         | Meaning / next action                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state: prepared` plus `event.action: stop` / `participants_stopped` | Setup exists and is intentionally stopped. Follow DM03; do not create another preparation.                                                             |
| Preview returns `state: retained`                                    | Exact request was already prepared; this is not a duplicate setup or a current calling-readiness proof.                                                |
| Empty case list                                                      | Recheck tenant UUID, node and approved preparation. Do not enter a destination manually.                                                               |
| `protected_custody_unavailable_or_stale` / provider unavailable      | Stop live steps. Deployment owner restores the existing scoped read-only consumer access; preserve endpoint generations.                               |
| `resource_versions_or_authority_stale`                               | Revoke/stop, inspect the changed canonical facts, refresh supported authorizations, review/apply and export/publish a current successor.               |
| `owner_changed` / `native_restarted`                                 | Wait for fresh independent native/custody proof, read the latest lifecycle version and explicitly start for that instance.                             |
| `controlled_work_pending_or_unknown`                                 | Resolve the exact retained work; use **Reconcile call safety** only with actual quiet proof. No new call/run ID as a workaround.                       |
| `preparation_disabled`                                               | Terminal disable was used. Routine `start` cannot undo it; stop this walkthrough and have the owner review supported recovery/replacement.             |
| Lifecycle version conflict                                           | Read status. Recover an uncertain original request exactly; use a new request/current version only for a known new action.                             |
| Grant says Inactive despite future expiry                            | It may be revoked or generation/authority-stale. Inspect provenance; do not extend or reuse it as current.                                             |
| Grant disabled with selected checkboxes                              | At least one selected case may be unavailable/stale. **Clear grant selection**, reload and choose the exact currently available subset.                |
| HTTP 429 / retry interval                                            | Honor the shown Retry-After. Read the original receipt/progress before another mutation; do not poll or submit in a tight loop.                        |
| Original A inbound rule cannot be found                              | Original `719df50c…` is removed. Inspect the current rule for DID `5557701`; do not recreate its UUID or replay initial configure/transfer automation. |
| Retirement/release blocked                                           | Enumerate current/initial/known-good/recovery pins and desired references. Keep the endpoint owned until every required blocker clears.                |
| `unknown` test or transport timeout                                  | Not a denial/success pass. Retain the intent, stop new calls and explicitly reconcile after actual quiet proof.                                        |
| Observer `not_observing` / null counters                             | Missing observation, often after namespace replacement; not zero traffic. Use a new explicitly bounded window.                                         |
| Native cleanup fails although grants are revoked                     | Revocation/stop do not remove loaded paths. Review and verify the clean replacement, then rerun proof for that exact artifact.                         |

## 3.1. Sample values for separate desired-only tests

Run M03–M11 with this separate stock when testing the original allocation/group/
route forms. Use a unique date/run suffix if the example tenant code already exists;
tenant codes are permanent. These are desired-state examples, not an approved
persistent live manifest. Merely creating them does not prepare live calls.

Use new, unmistakably labelled test resources on a node approved for this review.
Record their UUIDs as well as their display numbers. The following are **example
unused inventory numbers**, not real dial destinations. Substitute if occupied;
never borrow another tenant's stock.

| Reference        | Example                              | Intended use                                                         |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Tenant A         | Unique code `p4u2-manual-a-20261115` | Draft, voice enabled                                                 |
| Tenant B         | Unique code `p4u2-manual-b-20261115` | Draft, voice enabled                                                 |
| A1 / A2          | `7300`, `7301`                       | A's enabled extensions                                               |
| B1 / B2          | `7310`, `7311`                       | B's enabled extensions                                               |
| D                | `7320`                               | Desired-disabled allocation test                                     |
| U                | `7321`                               | Unallocated negative control                                         |
| S1 / S2 / S3     | `7330`, `7331`, `7332`               | Never-installed range/race/release stock                             |
| Missing number   | `7333`                               | Deliberately absent inventory                                        |
| GA / GB          | `7340` / `7341`                      | One enabled member A1/B1, hangup fallback                            |
| Shared gateway   | Approved test ingress                | Two distinct exact DIDs, DA and DB                                   |
| Shared trunk     | Approved test trunk                  | Separate explicit A and B permissions                                |
| IA / IB, OA / OB | Labelled inbound/outbound rules      | Exact tenant-owned inbound paths and approved local outbound matches |

1. Create A and B through **Tenants → Create tenant**. Use the
   [onboarding walkthrough](p4-u1b-manual-testing.md) if needed. Set voice explicitly
   enabled and verify both remain draft.
2. Create any missing test inventory through the existing PBX inventory workflow.
   Confirm the node's supported endpoint profile and desired statuses.
3. **Prepare required endpoint credentials/profile adoption before allocation.**
   Claimed stock rejects those operations. For desired-only tests, unset credentials
   are acceptable, but they will not prove live apply/calling readiness.
4. Create the routing definitions when the ownership steps below need them. New
   groups/rules may start disabled; enable them explicitly before compatible binding.
   Allocate members before claiming group ownership. Use only free group numbers.
5. Record pre-test counts and exact resources created. Do not use an active tenant
   merely to avoid draft verification. Active-tenant expansion can be reviewed only
   with a separately approved existing active test tenant; P4-U2 has no activation UI.

### Additional form samples

| Form / field                        | A sample                                    | B sample                                    | Check                                                                               |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Tenant code                         | `p4u2-manual-a-20261115`                    | `p4u2-manual-b-20261115`                    | Use a fresh suffix if occupied; codes are permanent                                 |
| Organization name                   | `P4 manual tenant A 20261115`               | `P4 manual tenant B 20261115`               | Exact **Organization name** create-form field                                       |
| Administrator username              | `manual-admin`                              | `manual-admin`                              | Tenant-qualified; no password/credential setup is required for these draft tests    |
| Voice preference                    | Voice enabled                               | Voice enabled                               | Both remain draft                                                                   |
| Selection method                    | Individual extensions                       | Number range                                | Existing stock only                                                                 |
| Range start / end                   | `7300` / `7301`                             | `7310` / `7311`                             | No missing inventory or foreign claims                                              |
| Group name / number                 | `Manual A group 20261115` / `7340`          | `Manual B group 20261115` / `7341`          | Free group numbers; one member A1/B1 for supported live-shaped graphs               |
| Group strategy / timeout / fallback | Ordered sequential / `10` seconds / Hang up | Ordered sequential / `10` seconds / Hang up | Preview then save; explicitly enable if binding requires it                         |
| Inbound rule name                   | `Manual A inbound 20261115`                 | `Manual B inbound 20261115`                 | Select the separately approved existing gateway/DID; do not duplicate retained DIDs |
| Inbound destination                 | Ring group / GA                             | Ring group / GB                             | Members already allocated to that tenant                                            |
| Outbound match type / digits        | Exact number / `5558301`                    | Exact number / `5558311`                    | Desired-only example numbers; do not dial them                                      |
| Priority / strip / add prefix       | `10` / `0` / empty                          | `20` / `0` / empty                          | Select an approved desired test trunk; no calling permission implied                |
| Tenant outbound advisory number     | `5558301`                                   | `5558311`                                   | Advisory preview only                                                               |
| Invalid range samples               | Start `7332`, end `7330`; `07300`; `900000` | `7330–7333` with 7333 missing               | Reject or show blocking conflict, with no partial save                              |

Use the actual displayed labels/resource UUIDs when a picker truncates names. Wait
for the selected node's stock to load before paging/searching. If a field or action
is disabled, inspect its blocker rather than changing unrelated data to enable it.

## 4. Inspect allocation and explicit voice states — M03

1. Open A, expand **Extension allocation**, select its **PBX node**, and wait for
   saved ownership/stock to load. Record available/reserved/allocated/disabled counts.
2. Inspect the separate ownership, staff assignment, desired status and calling
   verification facts. Open B and select the same node.
3. Expand **Tenant route bindings**, choose **Routing PBX node**, and inspect
   **Verified tenant routing**.
4. Before configuring routes, temporarily compare A's **Not configured**, **Voice
   disabled**, and **Voice enabled** preferences, saving/reloading each in turn.
   Leave enabled for subsequent steps.

**Expected:** claims/counts are tenant/node-specific. Missing voice configuration
is incomplete; disabled voice shows **Voice not required**, not passing call tests.
Enabled voice is incomplete without current evidence. No preference, allocation,
preview or reload activates the tenant or assigns staff.

## 5. Reserve and promote individual inventory — M04

1. On A, use **Individual extensions** to select A1 and A2. Set **Ownership state**
   to **Reserve capacity**, then **Preview selection**.
2. Confirm the preview contains exactly A1/A2 and their desired statuses/versions.
   Choose **Save reservation** once and wait for confirmation.
3. Choose **Reload saved ownership**, refresh the document, and open the same
   saved tenant in the second tab.
4. On A1 then A2 choose **Allocate extension <number>**. Reload both tabs.
5. Reserve D for A while D is desired-disabled. Later enable/disable D through
   inventory, returning it to disabled before revision capture.

**Expected:** one current claim per extension; reserved → allocated is explicit.
Claims persist across reload. Disabled stock can be claimed and keeps ownership
through status changes, but disabled endpoints are omitted from the new live policy.
Reservation never auto-promotes/expires, and none of these actions changes
credentials, tenant lifecycle or assignment.

## 6. Test selection, ranges and atomic conflicts — M05

1. On B select **Number range**, enter B1–B2 and preview/save **Allocate capacity**.
   Both existing enabled extensions should be allocated to B in one batch.
2. Preview S1–missing number (`7330–7333` in the example). Inspect the missing row.
3. Try reversed endpoints and a range of more than 50 numbers. Try a leading-zero
   number and an out-of-bounds number (valid canonical stock numbers are 1000–899999). Do not create stock just to make an invalid input pass.
4. In B, select or preview A1. It must be unavailable/conflicting; no B claim is saved.
5. If stock spans pages, select an available extension, use **More stock**,
   search a full number/prefix with **Find extensions**, and select another result.
   Inspect the total and **Preview selection**, then clear the choices.
6. Use **Show all extensions** to reset search. Page saved claims with **More claims**
   and include released history when available.

**Expected:** missing/conflicting ranges commit nothing; no missing extension is
created. Individual selections cap at 50, numeric order is stable and search covers
all stock. Off-page choices remain selected and appear in preview. Counts cover
all claims, not just the page. If there are insufficient rows to exercise paging
or the 51st selection, record that case not exercised and use companion coverage.

## 7. Race two tenants for the same stock — M06

1. Tab A: preview a reservation of S3 for A; do not save yet.
2. Tab B: preview an allocation of S2 and S3 for B while both are free.
3. Save A's reservation, then save B's already reviewed batch. Alternatively have
   two reviewers save together. Reload canonical ownership in both tabs.
4. Check S2 independently, then repeat with a different free pair if desired.

**Expected:** exactly one tenant obtains S3. B's losing batch does not acquire S2
partially. Conflict feedback retains nonsecret input; a new attempt needs current
ownership and a new preview. Two browser tabs exercise a user-visible race; the
companion command establishes deterministic independent-replica/SQL schedules.
Release the winner's spare claim later through section 10; never delete it in SQL.

## 8. Establish exact inbound ownership — M07

Use **PBX detail → Routing** and the existing
[group](../runbooks/ring-groups.md) / [inbound](../runbooks/inbound-routing.md) forms.

1. Prepare GA with only A1, GB with only B1, an explicit hangup fallback and timeout
   no greater than 15 seconds for the supported live adapter. Enable the groups.
2. Prepare the approved shared gateway, two different associated exact DIDs DA/DB,
   and enabled inbound rules IA → GA and IB → GB. Record every UUID. A gateway
   catch-all, if used for the negative case, is a separate platform-only definition.
3. On A → **Tenant route bindings → Inbound routes**, choose **Authorization**
   **DID ownership**, select DA under **Existing resource**, then **Preview inbound
   authorization** and **Save inbound authorization**.
4. Repeat for **Ring group ownership** GA, then **Inbound route binding** IA.
5. Repeat on B for DB, GB and IB, using the same shared gateway.
6. Reload saved inbound configuration and refresh both tenant details.

**Expected:** the gateway can be shared while DIDs/rules/groups have exact tenant
ownership. All reachable members/fallbacks belong to the same tenant/node. Saved
bindings remain distinct from applied/verified runtime; no call occurs on save.
Exact DID strings retain significant leading zeros and `+`.

## 9. Try forbidden inbound graphs — M08

Try each through the normal preview/save/resource forms on test resources:

| Attempt                                                                                    | Expected                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| B claims A's DA, GA or IA                                                                  | Foreign ownership rejects or selection is unavailable              |
| A claims a group containing B1, U, reserved-only or disabled stock                         | Incompatible reachable destination; no ownership/binding committed |
| A uses a fallback group owned by B                                                         | Entire reachable graph rejects                                     |
| Tenant binds a gateway catch-all                                                           | Rejected; catch-all remains platform-only                          |
| Duplicate exact DID/rule selector, including a disabled existing definition                | Existing claim remains; no duplicate selector                      |
| Cyclic group fallback                                                                      | Rejected by routing validation                                     |
| Edit/remove a currently owned group's members/fallback or referenced DID/gateway structure | Actionable dependency blocker; no silent detach/retarget           |

A selector hiding an ineligible resource is a valid UI outcome. Do not forge IDs
to bypass it. API rejection and cyclic/foreign schedules also have companion checks.
Restore any compatible name/status changes and re-preview affected authorizations.

## 10. Verify dependency-aware desired-only release — M09

1. On A try releasing A1 while GA/IA refer to it. Inspect the blocker or disabled
   action; follow its resource link and confirm the correct resource is shown.
2. Use a spare S1/S3 claim with no group/rule/binding, assignment or runtime reference,
   created after the verified initial baseline and never submitted in live intent.
   Choose **Release extension <number>** and reload released history.
3. Allocate that eligible spare to the other tenant, then inspect both histories.
4. While A1 is claimed, try its profile adoption or credential setup/rotation through
   the ordinary inventory screen. Do not replace its secret to work around denial.

**Expected:** referenced or installed stock stays owned; safe desired-only release
ends the current claim, preserves history and permits a new claim. The extension
UUID is unchanged; claim owner/history are not retargeted. Claimed-stock material
or profile identity changes reject. A missing/unknown runtime safety proof blocks
release, including older stock whose initial runtime dependencies cannot be proven.
Such a blocker is not a reason to clear pins; use section 19 for installed stock.

## 11. Establish outbound permissions and test selection — M10

1. In PBX routing, prepare enabled OA/OB using approved local-only exact numbers
   or bounded digit prefixes, valid priorities/transforms and the test trunk.
   Consult the [outbound form guide](../runbooks/outbound-routing.md).
2. On A → **Outbound routes and trunk permissions**, choose **Trunk ownership or
   shared classification**, select the trunk, set **Trunk ownership** to **Shared
   platform trunk**, preview and save the outbound authorization.
3. Save **Explicit trunk permission** for A, then **Outbound route binding** OA.
4. On B grant its own **Explicit trunk permission**, then bind OB. Classification
   alone never grants B calling permission. Use a separate spare trunk to test
   **Exclusive to this tenant** and foreign-owner rejection if available.
5. For each tenant, enter its approved **Tenant outbound advisory number** and use
   **Preview tenant outbound selection**. Record the selected rule, trunk and transformed number.
6. Revoke only B's explicit permission using its saved authorization's **Revoke**
   action. Preview again, then explicitly restore permission and re-review the binding.
7. With labelled overlapping test rules, verify a lower numeric priority wins;
   disable the winning _bound_ rule and preview again. Restore and re-review it.
8. Try no-match input, equal-priority overlapping definitions, malformed digits,
   and an original/transformed number covered by a reserved-number definition.

**Expected:** each tenant sees only its bound candidates before priority selection.
Missing permission, foreign trunk, disabled winner or unavailable selected trunk
denies without fallback to a lower-ranked route. Equal-priority overlaps and reserved
domains reject at definition validation. Ordinary node-wide preview is still
node-wide/advisory. No preview proves a call or changes the live PBX.

## 12. Capture, inspect, invalidate and validate revisions — M11

1. From **Verified tenant routing**, open **Review revisions, apply and recovery**.
   Record the selected node and existing verified artifact. Choose **Capture desired
   state**, then inspect its **Revision <sequence>** entry.
2. Review allocation owners/claim versions, inbound authorizations, outbound
   permissions, tenant voice/status facts, and the affected resource diff. Record
   the captured revision and comparison baseline IDs.
3. Choose **Validate offline**. Inspect local result, applicability, dependencies
   and whether live apply is available. Validation is not installation or a call.
4. Before applying, change one compatible test dependency in another tab, such as
   a bound rule's desired status. Recheck the old revision's validation/applicability.
5. Restore desired configuration, re-review dependent authorizations, capture a
   fresh revision and validate it. Keep the old capture in history.
6. Inspect a historical old-policy revision if available; do not apply it just to
   perform this check.

**Expected:** relevant edits stale old review/applicability rather than mutating
an immutable capture. Fresh capture includes consistent current facts. Historical
`review-2` / `deny-unbound-1` revisions retain their deny policy; tenant-aware captures
use `tenant-review-1` / `tenant-routing-1`. A missing capability/material dependency
can block apply even when desired-state browser tests passed.

The capture/review portion can run without live prerequisites. Continue to apply
only when section 3's controlled installation is actually prepared.

## 13. Apply the reviewed tenant artifact — M12

**Live environment required.** Confirm zero activity, a known verified runtime,
exact material availability and required recovery targets before continuing.

1. Inspect the runtime comparison against the actual verified artifact, not just
   another captured revision. Tick the **I reviewed the runtime comparison…** box.
2. Choose **Apply reviewed revision** once. Record the operation ID.
3. Use **Reload live state** to follow validation, installation, independent
   verification and any recovery phases until a definite terminal result.
4. In another signed-in tab, reload the same revision/live state.
5. Record the actual verified artifact/revision and baseline/known-good target.

**Expected:** both tabs converge on the same committed operation and independently
verified runtime. Acceptance/pending is not success. Tenant routing is not Ready
merely because the artifact verified. Unsupported modules, stale baseline/authority,
invalid references or unavailable material must not produce a successful unsafe apply.
A required capability failure leaves the retained runtime intact; investigate the
controlled profile instead of rewriting the ordinary baseline.

## 14. Grant and run real two-tenant tests — M13

**Live environment and approved manifests required.** In each tenant's **Verified
tenant routing** panel:

1. Choose **Reload evidence**. Confirm the artifact/revision matches section 13 and
   controlled cases belong to this tenant/node. An empty case list means Blocked.
2. Before granting, select an approved positive case with **No draft grant selected**
   and try **Run controlled call test**. Expect denial with no call dispatch for
   the draft; this is not a passed positive call. In **Cases permitted by the new
   grant**, explicitly check only the approved cases for this batch. None starts
   selected; granting stays disabled for an empty or unavailable selection. Then
   select a **Verification lifetime** adequate for the positive matrix (up to
   30 minutes), then **Grant verification**. Record the grant ID and expiry and
   select it under **Draft verification grant**. Granting alone places no call.
3. Select one **Controlled call case** and choose **Run controlled call test** once.
   Wait for completion, reload evidence, and record expected and observed outcomes,
   test ID/time, current/stale provenance and observed destination UUID.
4. Repeat sequentially for every required case for A and B. Only one unresolved
   call per installation is permitted; do not overlap calls or click fresh retries.
5. Have the controlled endpoint observer independently confirm actual answers,
   exact destinations and bidirectional RTP for positive inbound/outbound calls.
   A caller label, successful OPTIONS/registration or a passing UI status alone
   is not sufficient independent media evidence.

| Case                                                           | Expected real result                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A inbound through DA/IA/GA                                     | Permitted; observed A1 destination and bidirectional media                |
| A outbound through OA and explicit trunk permission            | Permitted; approved local sink and bidirectional media                    |
| B inbound through DB/IB/GB                                     | Permitted; observed B1 destination and bidirectional media                |
| B outbound through OB and explicit trunk permission            | Permitted; approved local sink and bidirectional media                    |
| Actual cross-tenant inbound/outbound attempt                   | Denied; never reaches the other tenant's destination                      |
| Unallocated, unknown or ambiguous source                       | Denied; cannot infer ownership from a number/header                       |
| Stale source/claim/permission provenance                       | Denied; old proof cannot authorize current traffic                        |
| Bound path with permission removed                             | Denied after the reviewed corresponding runtime change; no fallback trunk |
| Ordinary draft traffic outside the controlled nonce/grant path | Denied even while a verification grant exists                             |

Use only cases the deployment owner prepared for each negative condition. Do not
fabricate raw headers in the browser or dial ordinary real numbers to simulate them.
Actual ambiguity/stale-source/ordinary-draft attempts are also in the native suite.
SIP transport timeout is **unknown**, not evidence of authorization denial.

**Expected:** current successful positive and required negative evidence can yield
**Ready** for both voice-enabled tenants while both stay draft. “Passed” for an
expected-denied test means observed denial, not a successful connected call.
A failed expectation remains failed even if a SIP call connected. An unexpected
permitted isolation attempt blocks all voice-enabled tenants on that exact shared
runtime; revoking its grant must not clear the failure. Stop further acceptance
and investigate; do not intentionally create that defect on a retained installation.

Readiness does not prove that every allocated extension was tested. A2/B2 remain
separate unproven allocations unless each has its own inbound and outbound proof.
The U5 evidence port selects only individually proven owned extensions; no staff
assignment UI or assignment authority is delivered here.

## 15. Check expiry, revocation and evidence invalidation — M14

1. Record current readiness/test IDs. Revoke the selected draft grant and reload
   evidence. Try another controlled test using that old grant only if still offered.
2. For admission expiry, choose **10 seconds (expiry verification)**, select the
   grant, wait past its displayed expiry, reload evidence and attempt a controlled
   test under that expired grant. This should reject before dispatch. For actual
   in-flight expiry/revocation SIP proof, use DM06 instead.
3. For dependency invalidation, make a reviewed compatible change to a test binding,
   permission or desired resource. Inspect prior evidence, then capture/apply the
   required new runtime through sections 12–13. Obtain fresh grants/tests afterward.
4. Observe voice-disabled/not-configured states separately using M03; restore the
   intended voice preference and re-review applicable configuration afterward.

**Expected:** expired/revoked grants cannot dispatch new tests or retain ready draft
proof. Old history remains with original timestamps/provenance. New artifact,
semantic ownership/permission change, runtime generation/owner change, drift,
failed apply or dependency unavailability cannot preserve falsely current readiness.
Evidence also has a 24-hour ceiling; a ten-second grant expiry does **not** test
that ceiling independently. Use controlled automated coverage for isolated age/
owner-loss/failed-apply cases rather than changing the server clock or SQL timestamps.
For the retained setup, use DM05's actual **ordinary draft** SIP case and inspect
its draft/unset-credential state. Do not set/reset `controlled-admin` credentials
just for this test. A failed password attempt with unset/invalid credentials does
not establish correct-password lifecycle denial. Successful active-tenant staff
login and activation are outside this checklist.

## 16. Review recovery and unknown outcomes — M15

Exercise a normal explicit known-good recovery only on the approved idle live test
installation: choose **Verified recovery target → Recover selected artifact**.
Record the operation and independently verified target. Then reapply/retest the
reviewed desired artifact if the test plan needs it. Recovery must not rewrite
claim ownership or make old evidence current automatically.

Use these controls **when the corresponding retained/unknown state actually exists**:

| Situation                         | Action                                                       | Expected                                                                        |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Uncertain capture                 | **Recover capture receipt** or **Retry exact capture**       | Same original revision/request; no duplicate capture                            |
| Uncertain apply/recovery response | **Recover operation receipt** / **Retry exact live request** | Original operation recovered; no fresh effect replay                            |
| Unknown runtime/recovery          | **Reconcile to known good** when offered                     | Reviewed fenced recovery; no false candidate success                            |
| Lost grant/test/revoke reply      | **Recover exact verification intent**                        | Same original intent; no extra grant lifetime or redial                         |
| Unknown call                      | **Reconcile call safety**                                    | Actual quiet proof required; history never becomes an invented successful call  |
| Lost retirement reply             | **Recover exact retirement intent**                          | Same original retirement                                                        |
| Unknown retirement                | **Reconcile this retirement after review**                   | Exact reviewed tuple, current native fence, retained pins until safe completion |

Browser Offline mode before submission tests dependency failure; it does **not**
prove that the server committed before a reply was lost. Network toggling cannot
reliably create the required commit/native-boundary failures. Use section 20's
isolated fault coverage for exact COMMIT loss, real owner takeover, executor exit
and in-call interruption. Do not kill ordinary native/database processes or edit
runtime files to manufacture a screenshot. Mark unobserved manual cases accordingly.

## 17. Check access, mounted work and target isolation — M16

1. In a private signed-out window open a saved tenant and its revision URL. Try the
   staff session in its own browser context against the platform route if available.
2. In the platform session stage a nonsecret allocation/authorization selection
   without saving. Switch browser tabs and return; inspect the input.
3. If access naturally expires while the same page stays mounted, restore access
   using the same operator, honor the retry interval, and inspect staged inputs.
   Recover an actual uncertain request only by its exact original control.
4. Confirmed **Sign out** is a separate test: sign out, then sign in as another
   authorized operator if available. Reopen the test tenant and inspect mounted work.
5. Switch tenant and PBX node while a read is loading. Return and reload saved facts.
6. Refresh the document with unsaved input, after recording what was saved.

**Expected:** wrong-plane/anonymous access reveals no protected configuration.
Same-owner mounted recovery may retain nonsecret work, but never submits on its
own. Sign-out/identity/tenant/node changes clear unrelated work and late responses
cannot overwrite the new target. Document reload restores saved facts only; no
refresh-persistent unsaved draft is promised. Logouts are not a substitute for an
expiry-retention test. With only one operator or no controlled expiry, record those
manual cases not exercised and refer to the independent authority/browser suite.

## 18. Check keyboard, layout and passive reads — M17

Repeat representative allocation, binding, revision and verification controls at
1440, 768 and 320 CSS pixels using browser responsive mode:

- Expand/collapse tenant cards with keyboard; confirm visible focus and labels.
- Use Tab/Shift+Tab, Enter and Space for selection, preview, review checkboxes and
  recovery. Ensure dropdowns/long IDs and buttons wrap without page-wide overflow.
- Check loading, empty stock/cases, validation errors, stale conflicts, pending,
  blocked and recovered states when available; errors retain nonsecret input.
- Page/search/reload/focus the same target while watching Network requests. Reads
  must not issue mutation POSTs or place calls. A captured read cannot silently
  swallow an explicit action; it should complete safely or show a truthful result.
- Keep two cards open and one closed, switch tabs and return; same-target disclosure
  choices should remain. A target change clears unrelated selections.

**Expected:** all actions are reachable and readable, focus is visible, and no
mutation occurs from passive refresh. Manual inspection complements the companion
axe checks; it is not a substitute for their automated accessibility assertions.

## 19. Retire installed blockers and transfer an extension — M18

**Live environment required for installed stock.** Use A1 on the dedicated test
installation, never a production or baseline-dependent endpoint. For the retained
7701 A→B→A exercise, follow DM08; discover its current A rule by DID and do not
replay the already removed original rule UUID. Record every
superseded artifact that actually pins it. The initial baseline/current installed/
verified/known-good and required in-flight/recovery-chain targets must remain retained.

1. Before changes, try releasing A1. Installed/desired dependencies must block it.
2. Disable A1 through its desired inventory status. Keep its original ownership.
3. Capture/review/validate/apply a replacement omitting A1's endpoint/material
   dependency. Confirm actual independent verification and record replacement R2.
   Existing inbound definitions can remain denied references at this stage. If
   validation reports another dependency, resolve only supported desired changes
   or an intermediate reviewed deny replacement; do not bypass its blocker.
4. Retry release. Superseded pins and/or desired references must still block it.
5. In **Superseded artifact retirement**, select an eligible **Superseded artifact**
   R1 and **Extension removed from runtime** A1. Confirm the displayed replacement
   is R2, review required recovery targets, tick the review checkbox and choose
   **Request exact artifact retirement** once. Reload retirement/runtime state.
6. Repeat only for other eligible superseded artifacts that actually block A1.
   Current/initial/required recovery targets must not be eligible retirement choices;
   a replacement still containing A1 must reject. Bytes/history are retained.
7. Even after pins clear, verify remaining desired references still block release.
   Revoke IA's tenant inbound binding, remove the test inbound rule, revoke GA's
   group ownership and remove the now-unreferenced test group, in dependency order.
   Remove any other actual references through their supported resource screens.
8. Choose **Release extension <A1 number>** and reload A's released history.
9. On B allocate the same existing extension UUID. Re-enable it if needed, establish
   B-owned graph/permissions, capture/apply the new revision, and obtain fresh B
   inbound/outbound proof under a new approved manifest/grant as necessary.
10. Inspect A's old claim/revision/test history and B's new claim. Run the approved
    stale-old-owner negative case and new-owner positives.

**Expected:** release succeeds only after all actual blockers clear. No ownership
transfer is inferred from unbinding, disabling, retirement submission or missing
call observations. B gets a new claim/proof; A's old events remain attributed to A.
Retired artifacts cannot be restored through recovery. Installed/current/known-good,
initial baseline and required recovery bytes remain available.

An active call must defer retirement/release until natural completion; unknown
call/runtime/retirement safety also blocks. Exercise those timing cases using the
isolated live suite unless the controlled manual session explicitly provides the
bounded call/observation setup. Never force a call down or delete pins/tombstones.
Future U5 assignment writers are not delivered; no manual assignment race is claimed.

## 20. Run or review companion verification — M19

These commands **run tests**, create owned disposable fixtures and may take a long
time. They are not persistent interactive environments. Run them sequentially in
separate completed invocations, with no simultaneous console builds or live checks.
Required provider access can expire: a custody failure is Blocked, not a live pass;
use the documented named-custodian maintenance path, not root recovery or secrets
copied into the browser. Preserve per-run safe logs and exit status.

| Command from the host repository root            | Coverage                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:tenant-routing --browser` | Integrated actual allocation/binding/revision/tenant-call HTTPS and replica races                                                        |
| `./dev exec pnpm check:tenant-routing --live`    | Actual shared-PBX SIP/RTP, source denials, active calls, owner loss, unknown results, native retirement exit/reconciliation and transfer |
| `./dev exec pnpm check:tenant-allocation`        | Focused allocation/namespace/atomicity/recovery/browser                                                                                  |
| `./dev exec pnpm check:tenant-bindings`          | Focused graphs/permissions/authority/races/browser                                                                                       |
| `./dev exec pnpm check:draft-tenant`             | Tenant/onboarding/voice and draft access preservation                                                                                    |
| `./dev exec pnpm check:extension-inventory`      | Inventory, credentials/provider, observation and browser preservation                                                                    |
| `./dev exec pnpm check:trunk-gateways`           | Trunk/gateway/DID and credential-selection preservation                                                                                  |
| `./dev exec pnpm check:routing`                  | Group/reservation/inbound/outbound dependencies and previews                                                                             |
| `./dev exec pnpm check:pbx-revisions`            | Full existing native/interruption/real-provider/isolation/browser/domain modes                                                           |
| `./dev exec pnpm check:platform-auth --http`     | Current authority/CSRF/rate/replica/logout                                                                                               |
| `./dev exec pnpm check:staff-auth`               | Staff credentials/access and shared-session preservation                                                                                 |
| `./dev check`                                    | Full normal lint/format/types/build/foundation/storage/session graph                                                                     |

`check:tenant-routing` without a flag combines browser and live boundaries. Its
`--api` and `--concurrency` selections currently also invoke integrated real
allocation/binding browser/race checks; they are not headless manual fixture servers.
The final [DEV regression ledger](../status/p4-u2-dev-c-regressions.json) records all
twelve complete passes and retained failed attempts. You can review that evidence
without rerunning an entire long regression for each manual screen.
You need not repeat overlapping commands merely to click every selector. For a
fresh complete regression, retain the required affected/full checks rather than
substituting a reduced revision mode. Inspect results for **actual** calls versus
injected result/acknowledgement faults; setup/formatting/OPTIONS alone is not calling proof.

## 21. Clean up and preserve the environment — M20

1. Record final results before cleanup. Revoke the grants owned by this review.
   Expiry/revocation stops admission but does not prove loaded verification paths
   were removed; apply the reviewed cleanup configuration and prove absence.
2. On the controlled installation, recover its reviewed retained target or apply
   the approved clean replacement through the live workflow. Verify zero activity,
   no pending/unknown operation and exact expected runtime/recovery references.
3. Remove only your desired test references/authorizations in dependency order and
   release only claims with affirmative safety proof. If required runtime/recovery
   pins still block release, retain the claim and record it; do not prune history.
4. Disable or remove test definitions only where the existing UI supports it.
   There is no general tenant/extension database-delete cleanup workflow here.
   Keep a list of remaining labelled drafts/stock; permanent codes/history persist.
5. Confirm acceptance wrappers reported their exact owned fixture cleanup and
   baseline restoration. Leave unrelated stores, custody, credentials and artifacts
   untouched. Never use volume deletion, broad container pruning or manual SQL pin edits.
6. Repeat M01 health/HTTPS checks and the applicable retained-baseline check. Compare
   against the baseline appropriate to that environment: ordinary retained state
   should match when untouched; a deliberately changed controlled test node must
   match its reviewed restored/clean target. Do not expect old pre-test hashes to
   match deliberate manual changes in the ordinary database.

**Expected:** no verification admission is left accidentally active, no unknown
operation is waved away, and unrelated tenants/runtime/recovery data stay intact.
A cleanup blocker stays visible in the report; it is not a passed cleanup.

## 22. Sign-off before P4-U3

Copy this table into your local report. A single failing/blocked required result
keeps your corresponding manual review open. Label companion results separately;
existing implementation acceptance does not fill in your manual result cells.

| Test | Subject                                                      | Manual result / evidence |
| ---- | ------------------------------------------------------------ | ------------------------ |
| M01  | Access, health, retained baseline                            |                          |
| M02  | Dedicated stock/tenants and live prerequisites               |                          |
| M03  | Allocation facts and voice-state separation                  |                          |
| M04  | Reserve/promote/disabled ownership                           |                          |
| M05  | Ranges/search/paging/atomic conflict                         |                          |
| M06  | Two-tenant overlapping save race                             |                          |
| M07  | Shared gateway/exact owned inbound graphs                    |                          |
| M08  | Foreign/cyclic/catch-all/unsafe mutation denial              |                          |
| M09  | Desired-only release and claimed material blockers           |                          |
| M10  | Explicit outbound/shared-trunk permissions and selection     |                          |
| M11  | Immutable capture/diff/validation/staleness                  |                          |
| M12  | Actual reviewed fenced apply and verification                |                          |
| M13  | Both tenants' real positive/negative SIP/RTP proof           |                          |
| M14  | Grant expiry/revocation/evidence/lifecycle separation        |                          |
| M15  | Exact recovery and unknown-state handling                    |                          |
| M16  | Authority and owner/tenant/node-isolated mounted work        |                          |
| M17  | Keyboard, responsive layout and passive reads                |                          |
| M18  | Safe installed retirement/reallocation and old-source denial |                          |
| M19  | Companion commands, failures and injected/actual boundaries  |                          |
| M20  | Owned cleanup and retained environment                       |                          |

P4-U2-DEV manual sign-off (separate from the original M01–M20 rows):

| Test | Subject                                                                    | Manual result / evidence |
| ---- | -------------------------------------------------------------------------- | ------------------------ |
| DM01 | Actual current profile, exact runtime and preserved recovery history       |                          |
| DM02 | Stopped retained cases, blockers and passive no-effect discovery           |                          |
| DM03 | Reviewed restore/apply, successor plan/publication and explicit start      |                          |
| DM04 | Exact grant subsets and individual A/B inbound/outbound SIP/RTP            |                          |
| DM05 | Prepared cross-tenant/unallocated/unknown/ambiguous/stale/draft negatives  |                          |
| DM06 | Real in-flight expiry/revocation, separate from admission denial           |                          |
| DM07 | Counter-only no-call window, exact lifecycle retry and restart persistence |                          |
| DM08 | Current-rule 7701 A→B→A guarded retirement/transfer and fresh proof        |                          |
| DM09 | Exact observed recovery; separately labelled isolated fault evidence       |                          |
| DM10 | Reviewed loaded cleanup, preservation and stopped reusable discovery       |                          |

Record **Manual**, **Assisted automation**, or **Companion evidence reviewed** for
any mixed procedure. A command running a browser is still automation. For each
call, use a row like this in your private report (all IDs below are placeholders):

```text
Date/time (+08:00): your actual time
Execution: Manual / Assisted automation / Companion evidence reviewed
Tenant: p4-dev-a
Extension: 7701
Case UUID / kind / dialled number: this session's current case / routing / 5557701
Grant UUID / created time / expiry: this session's actual grant and original times
Claim UUID / claim version / extension version: actual current ownership facts
Verified artifact / revision / owner epoch / routing generation: actual current tuple
Test UUID / state / finished time: actual returned result
Expected outcome: permitted
Observed outcome: actual observed value
Expected destination UUID: 5c91cc6b-414e-4b34-b237-4c53e8f1447e
Observed destination UUID: actual returned destination
Independent destination/RTP evidence: safe observer reference and bidirectional result
Manual result: Pass / Fail / Blocked / Not exercised
Notes / screenshot path / cleanup: your observations
```

P4-U2-DEV parent coverage:

| Parent acceptance | Manual review / companion boundary                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| AC-01             | M01, DM01/DM02; actual target/custody/quiet facts                                                               |
| AC-02             | DM01 profile/media comparison plus DM04 actual independent RTP                                                  |
| AC-03             | DM01/DM09 delivered transition/recovery history; isolated profile fault rehearsal, not ordinary fault injection |
| AC-04             | DM02/DM03/DM07 current durable preparation, actual provider custody and persistence                             |
| AC-05             | M03–M12 and DM03 canonical ownership/graphs/exact reviewed apply                                                |
| AC-06             | DM04 individual current inbound/outbound destination and RTP results                                            |
| AC-07             | DM05/DM06/DM07 draft separation, conditions and truthful invalidation; isolated age/authority/drift checks      |
| AC-08             | M15/DM09 exact recovery and DM07 no-call restart; disruptive native/participant loss stays isolated             |
| AC-09             | DM07/DM10 persistence, actual loaded cleanup and reusable stopped cases                                         |
| AC-10             | M18/DM08 guarded installed transfer/return and actual stale-owner denial                                        |
| AC-11             | M16/M17 and DM02/DM04 owner/access/keyboard/reflow; companion authority checks                                  |
| AC-12             | This private report, declared manual/assisted boundaries, DM09 companion ledger and DM10 final state            |

Original P4-U2 parent coverage:

| Parent acceptance | Review references                                            |
| ----------------- | ------------------------------------------------------------ |
| AC-01             | M02–M05                                                      |
| AC-02             | M05–M06; companion deterministic races                       |
| AC-03             | M07–M08                                                      |
| AC-04             | M10, M13                                                     |
| AC-05             | M06, M11, M15–M16; companion COMMIT/rollback/authority cases |
| AC-06             | M11–M12                                                      |
| AC-07             | M13 and actual SIP/RTP observation                           |
| AC-08             | M15, M18; companion owner loss/interruption/outages          |
| AC-09             | M03, M11–M14                                                 |
| AC-10             | M09, M18                                                     |
| AC-11             | M04–M18, especially M15–M17                                  |
| AC-12             | M19–M20 and this report                                      |

Record your review decision, unresolved issues and remaining deployment prerequisites
before proceeding. P4-U3 activation, P4-U5 staff assignment, P5-U3 operational call
ingestion and production rollout are separate work; this review does not implement them.
