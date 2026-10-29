# Manually test P4-U1b tenant onboarding

Use this guide to test all three implemented parts: registry/name/contacts,
service area/default coordinates, and voice preference/administrator handoff.
The walkthrough uses a dedicated draft tenant on the private development system.
Record pass/fail against each expected result. This guide is a procedure, not a
claim that your manual test has already passed.

## 1. Open the two applications

On the server, check the existing services from the repository root:

```bash
./dev platform-https-status
./dev staff-https-status
```

Both should report `ready`. If a service is stopped, start it using
`./dev platform-https` (keep its terminal running) or `./dev staff-https-start`.
For an existing running installation, no migration, restart or database reset is
needed just to follow this guide. Deployment/rebuild instructions are in the
[platform HTTPS runbook](../runbooks/platform-development-https.md) and
[staff HTTPS runbook](../runbooks/staff-development-https.md).

On your desktop, keep these SSH tunnels open in separate terminals:

```text
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3443:127.0.0.1:3101 gino@203.177.64.131
```

```text
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3444:127.0.0.1:3102 gino@203.177.64.131
```

Use the existing trusted development certificate setup from the runbooks.

| Purpose                       | Desktop address                      |
| ----------------------------- | ------------------------------------ |
| Platform operator             | `https://localhost:3443/sign-in`     |
| Recipient enters handoff code | `https://127.0.0.1:3444/credentials` |
| Ordinary staff sign-in        | `https://localhost:3444/sign-in`     |

The hostname difference is intentional. Keep the platform open in your normal
browser and use a private window for the recipient/staff steps. Sign in with your
existing platform operator account; this guide does not create an operator.

## 2. Create and find a test draft

1. Open **Tenants → Create tenant**.
2. Use a unique code such as `onb-manual-20261029-01`, organization name
   `Naga onboarding test 01`, and administrator username `onb-admin`.
   Change the suffix if the tenant code already exists.
3. Choose **Create draft tenant**. Record the saved code, administrator username
   and detail URL for later steps.
4. Inspect the detail: lifecycle is draft, administrator credentials are unset,
   voice is **Not configured**, geography is not configured and contacts are
   incomplete.
5. Return to **Tenants**. Use **Search code or name**, select the draft lifecycle
   filter and choose **Search tenants**. Search once by the saved code and once
   by part of the organization name. Open the matching **View** action.
6. Refresh the browser and reopen the saved detail URL.

**Expected:** the same tenant and original administrator return. Creation happens
once; the permanent code is unchanged. With no matches, search shows an empty
result. Clear the search/filter to restore the list. If your registry contains
more than 25 matching tenants, also check **Next page** and **Previous page**;
otherwise record pagination as not exercised rather than creating 26 tenants.

## 3. Save organization name and contacts

1. Change **Organization name** to `Naga onboarding test 01 updated`.
   Choose **Save name**, wait for the saved message, then **Reload detail**.
2. Fill the contact fields with test information:

   | Field         | Value                  |
   | ------------- | ---------------------- |
   | Contact name  | Test organization desk |
   | Contact email | desk@example.org       |
   | Contact phone | +63 917 000 0000       |

3. Choose **Save contacts** and wait for confirmation. Reload the browser.
4. Inspect the saved values and **Contact completeness**.
5. Clear just the phone field, save contacts and reload detail. Restore the phone
   and save again when finished.

**Expected:** name/contact values persist; all three contact fields produce
**Complete**, and clearing one produces **Incomplete**. Optional blanks clear
saved fields. The tenant code and linked administrator stay unchanged. Contact
changes send no email/SMS and do not verify the administrator's identity.

## 4. Upload service area and set default coordinates

The browser file picker needs files on your desktop. Copy these existing reference
files from the server into a local test folder, or use your local repository copy:

```text
scp gino@203.177.64.131:/home/gino/projects/IMS-rebuild/reference/map/naga_admin_ADM_ADM_3.json .
scp gino@203.177.64.131:/home/gino/projects/IMS-rebuild/reference/map/naga_brgy_ADM_ADM_3.json .
```

These are test references for the dedicated Naga draft, not approval to configure
another organization's jurisdiction. Keep the original files unchanged.

1. Open **Service area and default intake coordinates**.
2. Upload `naga_admin_ADM_ADM_3.json` through **Administrative boundary file**.
3. Upload `naga_brgy_ADM_ADM_3.json` through **Barangay boundary file**.
   Each accepted file shows its name beside the picker as **Staged administrative
   file** or **Staged barangay file**. The picker resets so you can select the same
   file again; use the staged filename and preview to confirm it was read.
4. Review the proposed preview, **Municipality: Naga City**, the 27 uploaded
   barangays, and the selected tenant name/code. Saved geography should still be
   unconfigured until you save.
5. Enter **Default intake longitude** `123.19` and **Default intake latitude**
   `13.62`. These are separate longitude/latitude fields, in decimal degrees.
6. Try **Save geography** before ticking the ownership confirmation.
7. Confirm that the uploaded boundaries belong to this test tenant, then choose
   **Save geography** again. Wait for the saved message and reload the browser.

**Expected:** the first save asks for confirmation. The confirmed save persists
service area, 27 barangays and the exact default pair. The saved preview and
geographic configuration summary reflect this. Uploading a boundary alone never
invents a default point. Lifecycle remains draft; credentials stay unset.

## 5. Save explicit voice preference

1. In **Voice preference**, verify the initial choice is not configured.
2. Select **Voice enabled**, choose **Save voice**, wait for confirmation and
   reload the browser. Inspect both the selector and saved detail summary.
3. Select **Voice disabled**, save and reload again.
4. Inspect contacts, geography, tenant code and administrator linkage.

**Expected:** each explicit choice persists distinctly from not configured. Other
saved sections remain intact. Neither choice activates the draft, allocates PBX
inventory, applies routing or grants staff access. There is no activation or live
calling test in this unit.

## 6. Check independent unsaved work

1. With the tenant detail open, change the organization name to
   `UNSAVED name check` without saving it.
2. Change default longitude to `123.20` without saving geography.
3. Toggle voice preference and save **only voice**.
4. Choose **Reload detail**, without refreshing the browser page.

**Expected:** the saved voice summary updates, while the unsaved name and longitude
remain in their mounted forms. Saved geography still has longitude `123.19`.
Because sections share a tenant version, saving older unsaved work can correctly
produce a conflict; it must not silently overwrite newer configuration.

Leave these unsaved edits mounted for the credential test. **Reload detail** reads
current state while preserving unrelated mounted edits; a browser refresh,
navigation or tab closure can discard unsaved work.

## 7. Complete the administrator handoff

1. In **Administrator credentials**, verify the tenant code and original linked
   administrator. Choose **Check credential status**; it should be unset.
2. Verify the test recipient against established organization records using
   **In person** or **Live call to established contact**. Tick **I verified this
   person and will use the approved secure handoff.**
3. Choose **Issue setup code**. Confirm a one-time code is displayed and the
   verification acknowledgment resets. Give the code directly to the verified
   recipient through the approved handoff; provide the clean recipient URL
   separately.
4. Before the recipient exchanges the code, change and save voice once more.
   Choose **Check credential status**. Its outstanding action should remain
   pending; the configuration save must not cancel/reissue it. A detail reload
   can hide the displayed code, so complete the approved handoff first.
5. In a private window, open `https://127.0.0.1:3444/credentials`. The recipient
   enters **Handoff code**, chooses **New password**, repeats it in **Confirm
   password**, and chooses **Set credentials**. Use a private password of 15–128
   Unicode characters, at most 512 UTF-8 bytes, with no line breaks or NUL.
6. Back in the platform, choose **Check credential status**, then **Reload detail**.
7. Inspect the unsaved name/longitude from step 6, saved contacts/geography/voice,
   original code and linked administrator.

**Expected:** recipient success clears the secret fields and creates no ordinary
session. Platform status becomes ready and the action is consumed. Configuration
and unrelated unsaved edits remain; reload clears the operator's one-time code.
The operator never chooses or receives the recipient's password. Each later
issue/reissue requires fresh verification; ready-draft recovery uses the existing
recovery path rather than initial setup.

Do not include handoff codes or passwords in screenshots, URLs or your test report.

## 8. Prove that setup did not activate the tenant

In the private window, open `https://localhost:3444/sign-in`. Enter the test tenant
code, its administrator username and the newly chosen password, then sign in.

**Expected:** **Invalid credentials**, with no ordinary staff session, because the
tenant is still draft. Confirm draft lifecycle in the platform. Credential setup,
configured geography and either voice choice do not grant operational admission.

## 9. Try validation, conflict and clearing paths

Use the same dedicated test draft. Reload/discard a section's old mounted work
before starting a new independent test. After rejection, saved values should remain
intact and feedback should identify the affected section.

| Test                    | Action                                                                                                    | Expected result                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required name           | Empty the organization name and choose Save name.                                                         | Validation; no saved name change.                                                                                                                    |
| Email                   | Enter `not-an-email` and save contacts.                                                                   | Validation; input retained for correction.                                                                                                           |
| Missing coordinate      | Supply longitude but leave latitude empty; save geography.                                                | Pair validation; no saved geography change.                                                                                                          |
| Out-of-range coordinate | Set latitude to `91` and save geography.                                                                  | Rejected.                                                                                                                                            |
| Outside service area    | Set longitude/latitude to `0`, `0` with the Naga area configured.                                         | Rejected as outside the area, not because zero is inherently invalid.                                                                                |
| Invalid upload          | Upload a separate `.json` file containing `{}`.                                                           | Rejected with feedback; previous staged configuration retained.                                                                                      |
| Clear barangays         | Choose Clear barangays, then Save geography.                                                              | Barangays clear; service area/default pair remain.                                                                                                   |
| Clear defaults          | Choose Clear default coordinates, then Save geography.                                                    | Both defaults clear; no point is inferred.                                                                                                           |
| Clear area              | Choose Clear service area and barangays, then Save geography.                                             | Both boundary layers clear after save. Reupload/reconfirm if restoring them.                                                                         |
| Concurrent edit         | Open the same detail in tabs A/B. Edit name in A without saving. Save a different name in B, then save A. | A reports conflict and retains its proposed text. Reload detail in A, then explicitly Discard name changes and use loaded detail to adopt B's value. |
| Keyboard                | Use Tab/Shift+Tab, arrow keys for voice, Space for checkboxes and Enter for saves.                        | Visible focus and operable controls; errors/status readable without color alone.                                                                     |
| Narrow screen           | Resize to 320px wide or use browser device emulation; also inspect normal desktop width and zoom.         | Forms, feedback and actions remain usable without obscured controls.                                                                                 |

Upload limits are 4 MiB per file, 8 MiB combined, 4,096 combined closing positions
and 1,000 barangay features. Geometry validation also checks topology, containment,
overlap, metadata and coordinate precision. Use the automated suite below for the
full malformed/forged-input and exact-boundary matrix.

For an observed **uncertain** configuration result, keep the original tab, restore
access as the same operator and use **Retry original … save**. Do not replace the
attempt or assume nothing committed. Lost credential issuance instead requires
safe status plus an explicitly verified reissue; it never rediscloses a code.
A casual network disconnect cannot reliably prove a lost-commit case; use the
controlled automated checks for those races and outages.

## 10. Record results and finish

Record the date, browser, test tenant code, pass/fail/not-exercised for steps 2–9,
and nonsecret errors or screenshots. Include the failed step and expected versus
actual behavior. For the integrated final result, verify:

- Saved name/contact/geography/voice survive a fresh browser load.
- Tenant code and original administrator are unchanged.
- Credential state is ready, lifecycle is draft and ordinary staff sign-in denies.
- Reload detail preserves unrelated mounted edits; browser refresh can discard them.

Leave the dedicated tenant visibly named as a test draft. No tenant deletion or
activation flow is delivered here. Discard unwanted mounted edits explicitly and
hide any remaining disclosure; do not delete records with SQL to clean up this test.

## Optional automated regression checks

Run from the server repository root, sequentially. These checks create and clean
up their own isolated fixtures; manual test tenants above remain ordinary records.

```bash
./dev exec pnpm check:draft-tenant --onboarding-api
./dev exec pnpm check:draft-tenant --onboarding-browser
./dev exec pnpm check:draft-tenant
./dev exec pnpm check:staff-auth --lifecycle
./dev check
```

The combined draft-tenant command includes the focused API/browser matrices; you
can run it directly instead of separately repeating both focused commands. The full
check is the repository quality/regression graph. These controlled checks cover
A/B replicas, audit/receipt rollback, lost HTTP/COMMIT acknowledgment, authority and
status races, owner/target isolation and dependency failures that manual clicking
cannot conclusively prove. They do not establish live calls or tenant activation.

For prior implementation results and parent AC-01–11 mapping, see the
[final integrated evidence](../status/p4-u1b-3-evidence.md). For operating recovery,
see the [configuration procedure](../runbooks/tenant-configuration.md) and
[credential handoff guide](staff-credential-handoff.md).
