# P3-U3b — simple trunk credentials

October 23, 2026, 22:34 +08:00 (Asia/Manila). **Complete within approved private development: B-01–05 passed.** Parent P3-U3 remains incomplete.
[Requirements B-01–05](../../context/feature-specs/p3-u3b-simple-trunk-credentials.md).

| Requirement | Observed result                                                                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B-01        | Real trusted command stores owned synthetic material in retained OpenBao and publishes matching actual versions. Missing, denied, retained expired issuer and unavailable-provider cases fail recoverably without selectable versions.                                                                       |
| B-02        | Real command publishes directly into the isolated PostgreSQL browser database. Real A/B API and HTTPS Next select digest credentials and desired registration; installation/purpose/availability/version and incompatible settings reject.                                                                   |
| B-03        | Confirmed versions 1/2, explicit expected-version adoption and retained old selections. Real write-response suppression leaves no selectable result, fences competitors and reconciles the exact operation without another write. A separate real process interruption recovered through the normal command. |
| B-04        | Synthetic sentinels absent from command output, provider audit and ordinary audit/receipts. Strict resource/browser metadata boundaries contain no material. HTTP/Next gain no provider credentials or network access; no PBX/live registration work occurs.                                                 |
| B-05        | Full real-provider/PostgreSQL/API/HTTPS browser command, standalone extension inventory and clean unchanged `./dev check` pass, exit 0. Ordinary backend/HTTPS refresh and `./dev platform-https-check` pass; live/ready return HTTP 200.                                                                    |

## Working commands and access

The user explicitly approved the concrete migration and synthetic checks after the
initial automatic-review rejection. The documented protected named-custodian
password remains at `/home/gino/.openbao-custodian/password`; no value is recorded.

`./dev trunk-setup-access 58adb785-5384-41ce-9c72-ccda6ea554db` succeeded. Actual
issued TTL was 86,399–86,400 seconds with an 86,400-second explicit maximum. Repeated
routine replacement verified actual nonrenewable state, exactly the scoped policy
and `configurationUpdates: 0`. It skips unchanged policy/role configuration. No root
recovery, consumed bootstrap, owner attestation or renewal certification is needed.
Public CA copying preserves original provider file permissions. Actual OpenBao
requires create/read/update on the installation-scoped KV metadata path.
[Exact custody, configuration, commands and recovery](../runbooks/trunk-credentials.md).

## Verified execution

- `MYIMS_TRUNK_INSTALLATION_ID=58adb785-5384-41ce-9c72-ccda6ea554db ./dev exec pnpm check:trunk-gateways`
  passed, exit 0. Owned real credential `0e131237-c4f1-4047-ba62-c1664c1472b1`
  versions 1/2 were imported directly into the isolated browser database. Real API
  validation, HTTPS digest/desired registration selection and explicit version
  adoption passed. IP-peer CRUD/races/audit/idempotency, linked gateway adoption,
  canonical review, keyboard/320px/axe and shared-session response-loss/logout/outage
  and canonical-owner recovery passed. Exact PostgreSQL/Redis fixtures were removed.
- Standalone real OpenBao checks passed with owned credentials
  `def5129d-d4f5-48cf-95bf-09ba8aa29661` and
  `79549c3a-986f-443b-b211-850fa9b8789f`. Actual retained versions match the protected
  material, response loss reconciles without another write, competitors remain
  fenced, old version retries work, expired access rejects and audit scans exclude
  both material sentinels. Those synthetic provider versions remain retained.
- A separate interrupted command was recovered with the same command/protected
  inputs: owned credential `fc04bade-c339-4b6a-9f24-c9d895b03c53`, version 1.
- The focused suite additionally runs actual command/PostgreSQL/verified-TLS
  simulator fault checks. Definite write denial leaves no uncertainty fence;
  interrupted writes publish nothing, exact retries reconcile, competing work is
  fenced and stale versions reject. These complement the real-provider run.
- `./dev exec pnpm check:extension-inventory --inventory` passed, exit 0.
- `./dev exec node scripts/check-peer-adoption.mjs` passed. Authentication,
  credential version and desired registration edits preserve referencing gateways;
  connection changes/removal still reject.
- Additive ordinary `./dev migrate` passed. Backend build, focused ESLint,
  JavaScript/shell syntax and whitespace checks passed. The main normal lint,
  formatting, types, production builds, entrypoint and configuration stages passed;
  all durability/storage/identity/session stages also passed, including final real
  Redis lost-response assertions and PBX regressions. The wrapper then exited 2
  because its help text was edited while its shell still read that file. Current
  `sh -n dev` passes. The earlier interrupted clean rerun stopped after app builds
  without an exit result; it is not used as a full-graph pass. A final unchanged
  `./dev check` rerun completed successfully with exit 0 on resumption. All lint,
  formatting, types, production builds, entrypoint/configuration, foundation,
  durability, storage/deployment, identity, platform/staff/browser, distributed
  limits, credential, shared-session lost-response and PBX regression stages
  passed. Log: `/tmp/p3-u3b-check-resumed.log` (host-local diagnostic evidence).
- Ordinary `./dev platform-https` completed after the check, avoiding concurrent
  build contention. `./dev platform-https-status` reports ready;
  `./dev platform-https-check` passed, exit 0, including private listener isolation,
  trusted TLS, CSRF/origin/PATCH handling, browser sign-in presentation and preserved
  identities/migration history/shared credentials. `./dev health` returned live/ready
  HTTP 200 with database/session Redis/realtime Redis up. Host-local logs:
  `/tmp/p3-u3b-https-resumed.log` and `/tmp/p3-u3b-https-check-resumed.log`.
  Existing operator credentials remain private; no new manual authenticated
  workstation result is claimed.

## Corrections established by checks

PostgreSQL FOR SHARE needs an UPDATE-column grant. The migration uses protected
identity-column grants for row locks; triggers reject every actual runtime
metadata update, including no-ops. Real SQL verifies both locking and denial.

Inspect now blocks resource actions until canonical detail resolves. A held real
GET verifies removal stays disabled; a late detail response can no longer clear a
removal confirmation started against the previous rendering. The provider fixture
signals full completion through PostgreSQL before browser adversarial fixtures
mutate the same metadata. Failed fixture checks preserve overall failure while
allowing normal process/database teardown.

An extension regression exposed the existing zero-ms Redis limiter expiry boundary.
A deterministic real Redis regression failed before the fix and passed after the
initial correction. Lua now expires the boundary hash atomically and recomputes its
window before allocating counters; missing expiry/policy drift remain unavailable
and positive-TTL exhausted windows remain limited. The final normal boundary regression also
passed with admitted counters retaining a future expiry. No admission budgets changed.
The Redis lost-response fixture uses the supported production command timeout,
matching its COMMIT-loss companion, so the fast 200ms fixture cannot preempt the
actual injected fault. Dropped-frame and durable-write assertions remain required;
fast expiry fixtures remain intact.

## Preservation and limits

Existing endpoint material, retained provider state, backups, auth mounts and the
human account are preserved. Only the approved scoped trunk role/policy/issuance
rule and owned synthetic KV keys were added. Referenced and old material versions
are retained. No calls, live registration, PBX reload or application occurred.
Parent P3-U3 and c remain incomplete; production readiness is outside this unit.
