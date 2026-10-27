# Draft tenant configuration

In the platform console, open **Tenants**, search a saved organization's code or
name, optionally select a lifecycle filter, and open **View**. Search treats `%`,
`_` and backslashes literally; blank search lists all records. Pages have 25 rows.
Changing search/filter starts at the first page. Reload restores committed values.

While the tenant is draft, edit **Organization name** or **Organizational contact**
and use that section's Save button. The permanent code and original administrator
remain unchanged. Other lifecycle statuses are readable. Name is required, trimmed
and bounded to 200 UTF-16 units. Contact name/email/phone are independently optional;
blank clears. Partial contacts show incomplete. Contacts are informational and do
not verify identity or authorize delivery. Geography/voice remain later work.

A conflict preserves your input. Reload detail to see the current version, then
explicitly discard the affected section to adopt it and make your changes again.
An uncertain outcome retains the original request; restore access and choose
**Retry original name/contacts save**. It recovers the original outcome and loads
current values, which may include later edits. Do not assume failure means nothing
committed. Writes never replay automatically. Unsent work survives same-owner
reauthentication in the mounted page; refresh/navigation discards it. Sign-out or
another operator clears work. Keep using the original administrator credential
panel and its required person-verification process; setup does not activate a draft.

Deploy the additive migration through `./dev migrate` before updated HTTP code.
Receipts are immutable and have no runtime cleanup. No jobs or external effects
are created. Architecture, bounds and ports are in the
[registry contract](../architecture/draft-tenant-registry-api.md).

Run `./dev exec pnpm check:draft-tenant --onboarding-api` and `--onboarding-browser`
for focused real-service checks, `./dev exec pnpm check:draft-tenant` for the combined
registry regression, affected credential checks, then `./dev check`. The fixtures
own and drop disposable stores and processes; they do not mutate ordinary tenant
records or establish production acceptance.
