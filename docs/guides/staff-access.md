# Staff browser and mobile access

Use your organization’s staff HTTPS address and exactly **Tenant code**, **Username**,
**Password**. Tenant code identifies the organization; usernames may be shared by
people in different tenants. Preserve password spaces/case. A draft administrator
can finish approved credential setup but ordinary sign-in still returns
`Invalid credentials` until the separate activation workflow permits access.

The command center loads current server authority before presenting its workspace.
Tenant administrators can open **Credential setup and reset**, complete the
verified-person checks and target a qualified staff ID in their tenant. Ordinary
administrator access grants no incident creation or dispatch authority. Follow the
[setup/reset and operator handoff guide](staff-credential-handoff.md); recipients
enter handoff codes on the dedicated `/credentials` screen, never in URLs.

Expired or uncertain access hides unfinished values and protected dialogs. Enter
fresh credentials in the mounted recovery form. The same canonical tenant/staff
owner restores retained nonsecret work; another staff member, even with the same
username in another tenant, clears it. Refresh, crash, closed tabs and process loss
have no recovery guarantee. Incident persistence belongs to P5-U4. Recovery never
automatically submits a form or replays setup, reset or operational writes.

**Sign out** blocks interaction immediately. Only confirmed server revocation
reports completion and clears the browser credential/work. If the response is
unavailable or uncertain, use **Retry sign out** after the displayed retry interval.
Do not assume closing a tab revoked the session. Other devices remain signed in
unless credentials or canonical account/role/tenant authority change.

The responder app currently supplies minimal staff authentication and passive
protected access. Before showing content, it validates its protected stored token
against the current backend owner. Return from background, expiry and unavailable
storage hide authority. Device-authentication prompts must succeed; no plaintext
fallback is available. Failed writes trigger orphan revocation; failed deletion
blocks access until explicit server reconciliation/storage cleanup. Use the
[Android preparation document](../planning/p2-u4c-android-emulator-preparation.md)
for native builds and device acceptance. Device proof is still pending.
