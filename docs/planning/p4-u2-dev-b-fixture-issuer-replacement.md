# Existing fixture issuer replacement

2026-11-08 (Asia/Manila, +08:00). **Approved by the user: “Approving the issuer replacement”.** This is
separate from the approved dedicated ordinary preparation.

The required full extension-inventory command passed its inventory checks and
stopped at provider fixture provisioning. Named-custodian read-only inspection
found the ordinary installation's worker/cleanup policy documents and worker,
cleanup and expiring-worker role settings match the existing provisioning plan.
The installed restricted issuer also contains the preexisting fixture installation
`fff38aad-2e3c-4149-aa3f-88f715d1b488`. A manifest containing only the ordinary
installation correctly failed the exact issuer-policy preflight.
An independent GET-only lookup of the old protected issuer returned HTTP 403;
that access is unusable. This lookup issued or revoked no token.

The prepared replacement uses the existing `platform-owner-custodian`, its
protected host password and verified provider TLS. It runs the existing
`human-custodian-session.mjs` and `issue-lifecycle-issuer.mjs` contracts with:

```json
{
  "version": 1,
  "installations": [
    "58adb785-5384-41ce-9c72-ccda6ea554db",
    "fff38aad-2e3c-4149-aa3f-88f715d1b488"
  ]
}
```

The exact preflight also includes the already installed live-read issuance rule
for `58adb785-5384-41ce-9c72-ccda6ea554db`. It must verify the existing policies,
roles and fixed issuer contract before issuance; missing or differing definitions
remain blockers. The fixed role issues one orphan, nonrenewable restricted issuer
with a maximum lifetime of 24 hours. The replacement verifies the previous token
is invalid, installs the protected token/accessor files for UID/GID 1003 with mode
600, verifies the new identity/scope/lifetime and revokes its temporary custodian
session. Protected staging remains available for exact reconciliation on failure.

Policy/role updates, root recovery and retained endpoint-material rotation are
outside this action. The existing failed inventory receipt is preserved in private
verification custody and records zero created bindings. Required fixture cleanup
continues to use exact run-owned operations and generations.

Automatic approval review rejected executing this prepared replacement because
the earlier dedicated-setup approval did not explicitly include the second
installation scope. The command did not execute. The user has been asked to
approve this exact existing-scope replacement. The user subsequently approved it
explicitly; execution and acceptance results are recorded in the evidence ledger.
