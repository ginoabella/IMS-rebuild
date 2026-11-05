# Manually test P4-U2 allocation and verified tenant routing

Use this guide to review **all of P4-U2a/b/c before starting P4-U3**. It covers the
operator workflow, two-tenant isolation, live evidence, recovery, and safe transfer.
Implementation acceptance is recorded in the [final evidence](../status/p4-u2c-evidence.md).
Your manual results are separate: this document does not mark your review passed.

## 1. Choose the test environment and record results

There are two parts to this review:

| Part                          | Where to run it                                                                                                  | What it establishes                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Desired-state manual review   | Ordinary private platform console, dedicated test tenants/resources                                              | Allocation, bindings, conflicts, review, access, and browser behavior                                                 |
| Controlled live manual review | A separately prepared, approved private test installation with native capabilities and controlled case manifests | Actual apply, calls, readiness, recovery, retirement, and transfer                                                    |
| Companion verification        | Existing Docker acceptance commands                                                                              | Repeatable real-service, live, concurrency, interruption, and provider checks; these are automated, not manual passes |

**Current limitation:** the shipped live/browser acceptance commands create isolated
fixtures and remove them when finished. They do not offer a supported persistent
manual-session or “keep fixtures” option. Running `--live` will not populate your
ordinary tenant detail with reusable cases. The ordinary retained PBX also has a
historical static module profile; do not assume it supports new tenant artifacts.

You can perform sections 4–11 and 17–18 on dedicated ordinary desired resources.
Sections 12–16 and the installed-resource portion of section 19 require the live
prerequisites in section 3. If those prerequisites are absent, record **Blocked —
controlled live environment not prepared**, run/review the companion commands if
wanted, and keep your _manual_ live sign-off open. A fully interactive end-to-end
live session requires deployment preparation; this guide does not invent a UI
manifest editor, fixture credentials, or a provisioning command that does not exist.

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

Use your existing operator account. Keep a second browser profile/private window
for access-isolation tests, and two ordinary tabs for stale/concurrent edits.
No migration, database reset or service recreation is needed merely to read this
guide or test the already deployed desired-state screens.

## 3. Prepare test resources — M02

Use new, unmistakably labelled test resources on a node approved for this review.
Record their UUIDs as well as their display numbers. The following are **example
unused inventory numbers**, not real dial destinations. Substitute if occupied;
never borrow another tenant's stock.

| Reference        | Example                              | Intended use                                                         |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Tenant A         | Unique code `p4u2-manual-a-<suffix>` | Draft, voice enabled                                                 |
| Tenant B         | Unique code `p4u2-manual-b-<suffix>` | Draft, voice enabled                                                 |
| A1 / A2          | `7300`, `7301`                       | A's enabled extensions                                               |
| B1 / B2          | `7310`, `7311`                       | B's enabled extensions                                               |
| D                | `7320`                               | Desired-disabled allocation test                                     |
| U                | `7321`                               | Unallocated negative control                                         |
| S1 / S2 / S3     | `7330`, `7331`, `7332`               | Never-installed range/race/release stock                             |
| Missing number   | `7333`                               | Deliberately absent inventory                                        |
| GA / GB          | Free, distinct group numbers         | One enabled member A1/B1, hangup fallback                            |
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

For **live sections**, the deployment owner must additionally identify:

- The approved test node/installation and its exact current/initial/known-good
  artifacts, with a verified idle runtime and retained recovery targets.
- Working native/telephony ownership, exact material custody and compatible
  tenant-aware modules. New prepared/disposable profiles include the prerequisites
  documented in the [verification runbook](../runbooks/tenant-routing-verification.md).
  Missing modules must reject before selection. Do not rewrite retained `.conf`
  bytes, expose extra RTP ports, or silently rebaseline an older installation.
- Deployment-owned immutable controlled cases for both actual tenant UUIDs and
  this installation, including positive and required negative cases. The UI selects
  these cases; it cannot create hosts, destinations or credentials.
- Approved local ingress/destination sinks and independent destination/RTP
  observation. The current adapter supports isolated Docker identities: ingress
  `127.0.0.2`, trunk sink `127.0.0.4:20000–20100`, one extension or one-member group,
  at most two call legs and a 30-second dispatch deadline. These addresses belong
  inside the controlled environment, not your desktop softphone configuration.

No public trunk, PSTN, emergency/service destination or arbitrary manual SIP sender
is part of this procedure. Existing deployment/custody prerequisites are not
established by a new PBX database row or a green desired-state preview.

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
   the draft; this is not a passed positive call. Then select a **Verification
   lifetime** adequate for the positive matrix (up to
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
2. Create a new **5 minutes** grant, select it, wait past its displayed expiry,
   reload evidence and attempt a controlled test under the expired grant.
3. For dependency invalidation, make a reviewed compatible change to a test binding,
   permission or desired resource. Inspect prior evidence, then capture/apply the
   required new runtime through sections 12–13. Obtain fresh grants/tests afterward.
4. Observe voice-disabled/not-configured states separately using M03; restore the
   intended voice preference and re-review applicable configuration afterward.

**Expected:** expired/revoked grants cannot dispatch new tests or retain ready draft
proof. Old history remains with original timestamps/provenance. New artifact,
semantic ownership/permission change, runtime generation/owner change, drift,
failed apply or dependency unavailability cannot preserve falsely current readiness.
Evidence also has a 24-hour ceiling; a five-minute grant expiry does **not** test
that ceiling independently. Use controlled automated coverage for isolated age/
owner-loss/failed-apply cases rather than changing the server clock or SQL timestamps.
Ordinary staff login with this draft's correctly established administrator credentials
must still deny; follow the [credential handoff guide](staff-credential-handoff.md)
if those credentials have not been established. Invalid credentials alone do not
prove lifecycle denial. An approved existing active test tenant uses no draft grant;
do not activate a draft through SQL to manufacture that test.

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
installation, never a production or baseline-dependent endpoint. Record every
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

Parent coverage:

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
