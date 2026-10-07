# Set or replace staff credentials

Policy: [approved credential review](../planning/p2-u4a-credential-contract-review.md).
This journey sets credentials; tenant activation is separate. A draft tenant cannot
sign in as ordinary staff even after its administrator sets a password.

## Issuer

Sign in to the platform console, open **Tenants**, and open the organization's
saved detail. Confirm tenant code and the receipt-linked administrator username.
Select the verification method and acknowledge the approved handoff procedure.
Choose **Issue setup code** for unset credentials. A ready linked draft admin can
receive recovery; an active linked admin can receive platform recovery only when
it is the sole active credential-ready administrator. Other active-tenant staff
use another tenant administrator for setup/reset. Disabled, suspended and retired
targets deny. This release does not recover unlinked last administrators.

Verify the person in person or by calling a previously established organization
contact. Confirm organizational authorization against established records. Hand
the code directly in person or using the organization's existing approved
encrypted private channel. Use in-person handoff if no approved channel exists.
Do not send codes by ordinary email/SMS or put them in URLs/support reports.

A new code is displayed once. Supply the clean HTTPS `/credentials` address
separately; the recipient enters the code there. Hide the code after handoff.
Setup expires after 24 hours, reset/recovery after 30 minutes. Protected status
never rediscloses it. One outstanding action is allowed per person. **Reissue
code** cancels any earlier action and requires fresh verification; **Cancel code**
makes an outstanding code unusable. These actions preserve current credentials
and sessions. A successful recipient exchange invalidates every earlier session.

If issuance fails or its response is lost, its outcome can be uncertain. Restore
access, explicitly **Check credential status**, and explicitly reissue if another
code is needed. Do not automatically submit again. If a recipient's exchange
response is lost, check committed action/credential status. Verify the person
again and explicitly reissue under the current state when replacement is needed.
Ready draft administrators can use the narrow reset path; setup cannot overwrite
ready credentials. Rate limits give a bounded retry period; outages do not grant
fallback access. No recovery action activates a tenant.

The tenant-admin surface is `/credential-issuer` in the command-center app. It
requires an existing active tenant-admin staff session and a same-tenant qualified
staff ID from its owning record, with no self-reset. P2-U4a verifies this UI using
controlled existing sessions. Ordinary staff sign-in/logout and integrated
command-center access belong to b/c; this surface does not mint fixture sessions
or provide a staff directory. Staff status controls apply to a known action ID.
If a lost issuance response supplies no action ID, restore administrator access
and explicitly reissue for the verified qualified target; the old code cannot be
redisclosed.

## Recipient

Open the clean HTTPS `/credentials` page supplied separately by the issuer. Use
a private browser window if already signed into a MyIMS workspace. Enter
**Handoff code**, **New password**, and **Confirm password**, then choose **Set
credentials**. Use 15–128 Unicode characters and at most 512 UTF-8 bytes. Spaces
and Unicode are allowed; case, spaces and Unicode form are preserved exactly.
NUL and line breaks are invalid. Both password fields must match exactly.

Only a confirmed response says credentials were set. Success clears the inputs
and issues no session. Earlier sessions are invalid; fresh sign-in with the new
password is delivered by b/c, subject to ordinary active-tenant admission.

An invalid capability can mean expired, cancelled, consumed or stale authority;
the public form does not disclose the account. Ask the authorized issuer to check
status and explicitly reissue after verifying you. If the response is uncertain,
secrets are cleared and no password write is automatically replayed. Check with
the issuer before a new submission. Keep passwords private from the issuer.

Codes/passwords are not saved for refresh or reauthentication. Owner loss hides
issuer work and clears the code; same-owner access restoration can retain mounted
nonsecret work, while foreign-owner access clears it. Refresh/process loss can
lose unfinished mounted values. The form supports keyboard operation and narrow
screens; status feedback is announced without relying on color.
