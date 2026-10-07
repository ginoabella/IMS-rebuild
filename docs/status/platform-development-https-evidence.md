# Private development Platform Console HTTPS evidence

Status: implementation and automated verification complete on
2026-10-07 10:20 +08:00 (Asia/Manila). The user subsequently confirmed working
Windows access/sign-in on 2026-10-07. macOS workstation verification and explicit
refresh/logout checklist confirmation remain pending.
Approved scope: [private development access decision](../planning/platform-development-https-access.md).
Operations: [exact server, Windows and macOS instructions](../runbooks/platform-development-https.md).

## Implemented boundary

The host launcher validates the running workspace's loopback-only port 3101 and
the existing backend's loopback-only publication. Internal Next/Nest ports must
be unpublished. The Docker workspace supervisor starts normal application
processes on loopback 3003/4001 and terminates TLS on container port 3001. It does
not recreate containers, change root environment/shared-service credentials, run
migrations, bootstrap an operator or create a disposable authentication store.

Private material is persistent and owner-only; the public CA export is atomic.
Three distinct authentication secrets are supplied only to their owning runtime
processes. Next receives no database/Redis/deployment credentials. Startup builds
normal production output with verification build flags removed. Readiness and
shutdown are bounded; shutdown targets only owned process groups. Occupied ports
are rejected instead of reclaiming unrelated processes.

## Automated checks

Final `./dev platform-https-check` passed, exit 0, after the final restart.
The host loopback HTTPS probe returned 200. The separate preservation comparison
passed for the original operator/shared credentials and every CA/TLS/auth secret
file across restart. Owned-listener shutdown passed, the foreground launcher
exited 0, and all seven existing development containers were retained with shared
services healthy. Scoped ESLint, shell syntax, formatting, Compose configuration,
relative documentation links and whitespace checks passed.

`./dev platform-https-check` runs on the existing development services and checks:

| Area                      | Observable verification                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network isolation         | Another existing container cannot connect to workspace Next/Nest loopback listeners; host publication guard checks live Docker mappings                 |
| Client output             | Actual private secrets, private-key markers, server auth settings and verification form labels are absent from normal client assets                     |
| TLS                       | Actual development CA validates chain and localhost hostname; untrusted CA and foreign hostname fail                                                    |
| CSRF                      | Real Next/Nest endpoint returns proof and host-only Secure/HttpOnly/SameSite=Lax/Path=/ pre-auth cookie with no-store                                   |
| Protected access          | Missing session returns 401; the console redirects to sign-in                                                                                           |
| Request boundaries        | Foreign Host, missing/foreign/ambiguous Origin, unsafe/ambiguous fetch metadata, bearer headers, unknown auth consumers and query variants are rejected |
| Forwarding                | Forged ingress/source/path/proxy headers are stripped; the accepted socket supplies attribution                                                         |
| Direct listener rejection | Direct Next without ingress proof returns 503; direct Nest without proxy proof returns 403                                                              |
| Sign-in boundary          | Missing CSRF is rejected before credentials; an oversized request is bounded without an account lookup                                                  |
| Logout boundary           | Fresh pre-auth proof confirms logout for an absent session and leaves session access denied; no authenticated operator session is used                  |
| Browser presentation      | Normal HTTPS sign-in page, secure context, accessible fields and hydrated controls work through a local TCP tunnel to the real ingress                  |
| Data/configuration        | Read-only before/after identity and migration snapshots match; shared-service credential hashes match                                                   |

The actual host loopback path was also checked with `curl --cacert` and
`--connect-to localhost:3443:127.0.0.1:3101`, retaining the declared Host/origin;
the CSRF endpoint returned 200 without disabling certificate verification.

Startup idempotence and prepare reruns were exercised, followed by owned-process
stop and restart. A private read-only baseline recorded before the first launch
was compared after verification: the original operator record and database/Redis
credential files were unchanged. TLS/key/authentication-file digests are compared
across the final restart and matched. No identifying record or secret digest is printed.

Initial verification found duplicate cache-control response headers from mixed
header casing; ingress now overwrites the lowercase header once. The browser
test's exact `Password` label did not match the existing shared `Password
(required)` label; the selector now follows the shared primitive and existing
acceptance tests. The complete targeted suite passed after those corrections;
final verification passed with subsequent publication/header refinements.

Script ESLint, shell syntax, normal backend/UI/Next production builds, formatting,
Compose configuration, documentation links and whitespace are checked. The full
deployment/authentication fixture suite is intentionally not run for this setup:
the approved scope prohibits a disposable authentication environment and this
increment changes launch/infrastructure tooling, not authentication business code.

## Workstation confirmation and remaining checklist

The user reported that Windows access/sign-in is working after completing the
certificate and tunnel procedure on 2026-10-07. The runbook includes the resolved
command-order and missing-download issues. This is user-reported confirmation; no
credentials or browser captures were requested. Refresh, confirmed logout and
renewed access denial were not separately reported and remain checklist items.

macOS download, fingerprint verification, login-keychain trust and SSH tunnel
instructions are documented using Apple's Keychain Access guidance; they have not
been tested on an actual Mac. Linux Chromium presentation uses a narrowly pinned
verified leaf key; independent Node probes validate CA/hostname normally. Those
automated checks do not establish workstation trust or knowledge of the user's
password.

The console was stopped after automated verification so the user can follow
the foreground server startup instructions. Shared-service containers, volumes,
the original operator and private TLS/authentication files remain retained.
Production deployment, public ingress, staff access and administration screens
remain outside this increment.
