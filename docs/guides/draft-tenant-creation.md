# Create and revisit a draft tenant

Start the approved HTTPS console with `./dev platform-https`, establish the SSH
tunnel and trust its certificate using the [development HTTPS runbook](../runbooks/platform-development-https.md).
Open `https://localhost:3443/sign-in` with your provisioned operator credentials.
After a source update, stop/start the supervisor to rebuild its production console:
`./dev platform-https-stop`, then `./dev platform-https`.

1. Choose **Tenants**, then **Create tenant**.
2. Enter **Tenant code**, **Organization name**, and **Administrator username**.
   Codes and usernames trim outer whitespace and save ASCII letters in lowercase.
   Identifiers start with a letter or number and accept letters, numbers, dots,
   underscores and hyphens. Codes allow 64 characters; usernames allow 128.
   Names allow 200 UTF-16 units after trimming. The code is permanent.
3. Choose **Create draft tenant**. Only a confirmed save opens its canonical detail.
   The tenant is a draft; its first administrator has the tenant administrator
   role, active account and **Credentials not set**. Ordinary staff sign-in is
   unavailable. This screen has no credential setup, edit, activation or voice action.
4. Revisit **Tenants** or open the saved detail URL. Refresh and **Reload detail**
   read current backend state. Use **Next page**/**Previous page** for the registry.
   A read failure is distinct from an empty registry or a missing tenant.

Validation and code conflicts preserve editable values. If creation is uncertain,
recover access first, then choose **Retry original submission**. The original
submitted values remain visible and recoverable even if you edit the fields.
Resolve that original submission before creating with changed values; a confirmed
retry opens the original saved organization. Writes never resume automatically
on reconnection, reauthentication, tab focus or mounting.

On expiry/outage the workspace hides and blocks actions. Reauthenticate as the
same canonical operator to restore mounted values and attempt context. Another
operator or confirmed logout clears them. These values live only in mounted
memory: refresh, tab closure or browser/process loss can discard unfinished work.
Saved tenants remain in the registry. No cross-refresh input recovery is promised.
Wait for the displayed Retry-After interval before retrying access.

The detail contract provides the canonical tenant ID/code and the linked,
tenant-qualified administrator ID/username. P2-U4 owns later credential delivery,
expiry/recovery and draft setup access; P4-U1b owns the later onboarding UI.
Credential setup alone does not activate a tenant. P4-U3 owns activation/readiness,
including explicit voice-disabled readiness. PBX administration is separate.
