# Verification provider access recovery proposal

Both existing accesses returned HTTP 403 over verified TLS on 2026-11-03:
the endpoint fixture issuer and the read-only live consumer for installation
`58adb785-5384-41ce-9c72-ccda6ea554db`. The owner explicitly approved this scoped replacement in chat on 2026-11-03; replacement and verification passed, with zero configuration updates and temporary session/staging cleanup.

Requested owner authorization is limited to replacing these two existing accesses
through the existing named custodian and fixed issuance roles. Use the protected
custodian password file without displaying or copying its contents. Open a
900-second tmpfs custodian session, run exact read-only policy/role preflight,
and stop on drift. Do not create or update policies, roles, mounts or permissions.

Stage and validate the endpoint issuer with `issue-lifecycle-issuer.mjs endpoint`
and the existing manifest, including `--live-installation` for the installation
above. Install the validated 24-hour nonrenewable issuer in existing UID 1003
custody, preserving exact accessor reconciliation and revoking prior access if
still present. Replace the installation-scoped read-only consumer through the
existing `pbx-live-prepare` procedure only with zero policy changes. Verify its
24-hour nonrenewable lifetime and UID 1002 custody. Close and revoke the temporary
custodian session and remove only operation-owned temporary files.

This authorizes access replacement for required verification only. Preserve
stored credential versions, PBX configuration, baseline, artifacts and pins.
No tenant activation or new live routing behavior is included.

The existing scripts explicitly reserve this operation for human maintenance:
`scripts/openbao/human-custodian-session.mjs` says “Explicit human maintenance
only”; `scripts/openbao/issue-lifecycle-issuer.mjs` says “replacement through fixed
issuer roles.” The routine replacement procedure is documented in
`docs/runbooks/pbx-revisions.md`.
