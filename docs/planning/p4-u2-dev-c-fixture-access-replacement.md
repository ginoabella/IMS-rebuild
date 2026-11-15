# P4-U2-DEV-c fixture access replacement

Status: explicitly approved by the owner in the current conversation on 2026-11-15
(Asia/Manila). The approved fixed-role replacement passed: old issuer access is
invalid, new access has the existing exact policy and 24-hour maximum, no policies
or roles changed, and the temporary custodian session was revoked. The earlier
automatic approval rejection occurred before execution; that attempt changed no
protected files or provider access. The full inventory regression passed under this approval, including real provider
and HTTPS/browser coverage. All 28 test-owned generations were cleaned up and all
fixture tokens revoked/removed. Native baseline restoration passed. The original
expired worker was restored with its exact SHA-256, UID/GID 1003, mode 0600 and
original modification time, and remains HTTP 403.

The initial full inventory attempt passed its inventory API checks, then
stopped before credential-fixture tests. Independent GET-only inspection found:

- Existing fixture issuer lookup: HTTP 403.
- Pre-existing worker access lookup: HTTP 403, original file dated 2026-11-08,
  UID/GID 1003, mode 0600. No cleanup/expiring token or pending issuer swap exists.
- Failed fixture receipt records zero created bindings and uncertain provisioning;
  preserve that receipt. The existing expired worker file was never adopted/revoked.

The concrete replacement is the existing reviewed
[fixed-role procedure](p4-u2-dev-b-fixture-issuer-replacement.md), using
`platform-owner-custodian`, its protected host password, verified provider TLS,
`human-custodian-session.mjs` and `issue-lifecycle-issuer.mjs endpoint` with the
explicit existing live-read rule. Its unchanged exact manifest is:

```json
{
  "version": 1,
  "installations": [
    "58adb785-5384-41ce-9c72-ccda6ea554db",
    "fff38aad-2e3c-4149-aa3f-88f715d1b488"
  ]
}
```

The existing `platform-endpoint-issuer` role issues one orphan/nonrenewable
`endpoint-restricted-issuer` token, maximum 24 hours. Exact policy/role preflight
must pass without modification. Verify old access invalid, install the protected
token/accessor at UID/GID 1003 and mode 0600, verify scope/lifetime, and revoke the
temporary custodian session. Retain protected staging for exact reconciliation.

Before fixture tests, recheck the expired pre-existing worker token is still 403
and matches the recorded hash. Move that exact expired file to a protected,
exclusive preservation name. Do not adopt/revoke/delete it. The test launcher may
then create its own bounded worker/cleanup access and clean only run-owned
fixture operations/generations. After the provider-dependent checks finish,
verify their tokens removed/revoked, then restore the original expired file with
its exact bytes, UID/GID, mode and modification time. Stop on mismatched/active
custody rather than overwrite it.

This grants powerful existing fixture issuance access for the listed installations;
misuse could affect endpoint secrets, so the wrappers retain exact operation/
generation ownership guards. There are no policy/role changes, root recovery,
ordinary endpoint-material rotations, live consumer replacement or credential
values in reports. Original ordinary generations, resources, runtime/profile and
artifact history remain protected by before/after checks.
