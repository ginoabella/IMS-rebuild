# P2-U3a platform authentication HTTP boundary evidence

Completed 2026-10-06 14:02 +08:00 (Asia/Manila). A-01–09 passed.
Final focused and full Docker checks passed, exit 0. b and parent remain incomplete.

Requirement: [a specification](../../context/feature-specs/p2-u3a-platform-authentication-http-boundary.md).
Parent/browser ownership: [parent](../../context/feature-specs/p2-u3-platform-operator-sign-in.md)
and [b](../../context/feature-specs/p2-u3b-platform-browser-access-and-isolated-reauthentication.md).
Implementation contract: [HTTP transport](../architecture/platform-authentication-http.md).
Deployment/retry/check procedures: [runbook](../runbooks/platform-authentication.md).
Prerequisite evidence rechecked before implementation: [operator/bootstrap](p2-u1c-evidence.md)
and [combined sessions](p2-u2c-evidence.md).

## Environment and reproducible checks

Existing Docker workspace, pinned Node/pnpm, real PostgreSQL migration/runtime
grants and a dedicated bounded Redis container with AOF/noeviction. Uniquely named
fixture database, independent HTTP processes, actual production auth use case,
controllers/guards and a separate actual HttpModule registration check. Trusted
fixture issuance stays private IPC for foreign-plane/lifecycle regressions.
The HTTPS Chromium probe uses an ephemeral localhost certificate and an explicit
certificate validation exception; it checks actual Secure-cookie acceptance and
secure context without disabling Secure/HttpOnly/SameSite. No fixture session
issuer, account, mutation route or TLS proxy ships in the application graph.

| Command                                                                             | Final result                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:platform-auth --http`                                        | Passed, exit 0; actual A/B auth, production module wiring, HTTPS Chromium and complete a/b session regressions                  |
| `./dev exec pnpm check`                                                             | Passed, exit 0; workspace lint/format/typecheck, all five clients/backend builds, entrypoint checks and configuration tests     |
| `./dev check`                                                                       | Passed, exit 0; includes identity/bootstrap, complete session/admission/recovery/auth, client scans and isolated storage checks |
| Focused lint/format, changed-document links, launcher syntax and `git diff --check` | Passed; final docs/launcher/whitespace and relative links verified                                                              |
| `./dev health`                                                                      | Live and ready HTTP 200; all three declared health dependencies up                                                              |

The budget phase aligns to a real Redis fixed window when fewer than four minutes
remain, with a bounded wait, so epoch resets cannot invalidate the A/B allowance
proof. The default session check now includes auth acceptance; full Docker check and CI
inherit it. CI installs pinned Chromium/system libraries before that suite.
The launcher owns a unique Redis container and database teardown, certificate
files stay in its private temporary directory, and checks never seed operational
accounts. Final inventory confirmed zero session fixture databases, Redis fixture
containers and platform browser certificate directories remain. Browser installation is a documented workspace prerequisite, not a
public HTTP fallback. Hosted CI and production deployment are not claimed.

## Acceptance mapping

| ID   | Concrete check and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01 | Named method/path, cookie/proof/input/error DTOs and origin/proxy/source contract written before runtime changes. Validated optional server-only configuration rejects partial, foreign/HTTP/noncanonical origins, untrusted/duplicate/CIDR peer settings, shared/invalid secrets and secret-bearing errors. b receives exact endpoints/proof/retry/configuration requirements.                                                                                                                                                                                                                                                                                                                                                                        |
| A-02 | Actual HTTP normalized mixed-case/spaced username with exact decomposed-Unicode/outer-space password. Helper regressions prove case/trim/NFC changes mismatch. Unknown, wrong, disabled, unset and malformed material return identical denial; fixture verifier counters prove all perform bounded work. One admitted verification reservation and one real hash slot reject overlap; injected synchronous crypto failure maps HTTP 503 and releases capacity for the next operation. Bootstrap boolean compatibility remains covered by identity regressions.                                                                                                                                                                                         |
| A-03 | Real A/B sign-in consumes 10 unknown identity attempts across independent sources; 10 successful real credential logins also exhaust one identity budget; admitted internal crypto errors exhaust another. A/B 60 distinct identities exhaust a shared source. Next request is 429 with bounded retry timing and unchanged verifier count. Unknown fields, malformed password/source, all-trusted or duplicate forwarding chains fail before candidate/hash work. Existing c verifies atomic windows, cardinality, namespaces, spoofed chains and real admission write failures.                                                                                                                                                                       |
| A-04 | HTTPS Chromium accepts host-only Secure/HttpOnly/SameSite=Lax Path=/ cookie, exact expiry cap, no document.cookie/localStorage/sessionStorage token, and no token JSON. A-issued cookie works through B. Duplicate/malformed cookies, conflicting bearer/cookie and undeclared channels deny. Real staff token in cookie cannot read platform session or log out its foreign lineage; platform bearer cannot read staff resource. Existing bearer route regression passes. All five built-client scans include auth server config/import/password sentinels.                                                                                                                                                                                           |
| A-05 | Login/logout/protected mutation reject missing/wrong/foreign/duplicate Origin, proxy proof or CSRF, and proofs from another pre-auth/session context. Replacement/rotation cannot accept the predecessor proof. Safe reads compare unchanged Redis deadlines; direct access without proxy proof denies. Probe preserves actual browser Origin on mutations and uses its actual configured HTTPS origin. b still must implement/test its actual proxy and Server Actions.                                                                                                                                                                                                                                                                               |
| A-06 | Disable/reenable and credential versions invalidate current cookies on A/B. Trusted barriers after private credential read and before issuance race actual owner mutations; stale password proof yields 401 without issued cookie. Sensitive cookie mutation rechecks canonical authority in its existing PostgreSQL transaction and emits canonical audit; a concurrent disable before its lock returns 401 with no write. Parent/b regressions retain shared-row lock serialization and hostile role/tenant/ownership tests.                                                                                                                                                                                                                         |
| A-07 | B logout makes A reject, preserves another session of the same operator and another operator/device, and rejects actual restored pre-revocation bytes. Repeated old-cookie logout and cleared-cookie/fresh-pre-auth retry are idempotent. Foreign-plane logout denies without revocation. Barrier-controlled operational write/logout race cannot renew or revive the revoked record; real stale restore remains rejected on A/B. Full c additionally restores actual records and restarts Redis behind canonical versions/fences.                                                                                                                                                                                                                     |
| A-08 | Passive current-session record equality, real short web idle deadline, successful cookie mutation renewal, fixed absolute expiry through rotation and old proof invalidation. Existing a covers authoritative retained-record absolute/idle boundaries and physical TTLs. Real canonical database network failure, Redis admission/issuance response loss and PostgreSQL durable issuance/revocation COMMIT response loss return 503 with no cookie/false logout. Audit rejection rolls back revocation and retains the cookie/live session. Fresh sign-in and explicit logout retries use shared authority without reconstruction/replay. Full a/b/c retains actual outage/ACL/OOM, renewal, restart/restore and interrupted-primary recovery checks. |
| A-09 | Final focused/default/full commands, actual browser transport and identity/bootstrap regressions, safe logs/audit/client scans and precise fixture cleanup passed. Contract/runbook/this evidence/tracker record the backend boundary and b handoff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Corrections and limits

A strict Chromium check caught HTTP-Date rounding compensation extending the
browser's interpreted Expires fractionally beyond the canonical deadline.
The server now reserves one second before absolute expiry; the strict browser
assertion remains unchanged. Canonical idle/absolute deadlines remain authoritative.

An inherited real-COMMIT-loss check used the 200ms fast-expiry fixture deadline
while workspace builds competed for CPU. It returned unavailable before reaching
the required injected COMMIT drop. That fault setup now uses the approved bounded
2-second production timeout; dropped-frame, durable-write and unavailable assertions
remain strict. The final sequential full Docker run passed, including the required real dropped
COMMIT frame and durable-write assertions.

The backend is configurable but its local operational deployment stays disabled
until the same-origin proxy/origin/secret/TLS settings are provisioned. a's HTTPS
probe is a non-shipping transport fixture; it does not establish the console UI,
actual Next.js proxy/Server Actions, unfinished-work isolation or parent completion.
b must rerun parent AC-01–11. Production origin/ingress/HA/TLS, realistic traffic/
combined session/hash memory capacity and account recovery remain their declared
prerequisites. No authentication/identity schema, lifecycle policy, permissions,
new session store or account setup/reset feature was added.
