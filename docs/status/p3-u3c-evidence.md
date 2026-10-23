# P3-U3c DID inventory and P3-U3 integration evidence

Status: completed within approved private development, October 24, 2026,
00:09 +08:00 (Asia/Manila). C-01–05 and parent DEV-01–07 passed. All a/b/c are
complete within this boundary; parent P3-U3 is complete.

Requirements: [P3-U3c](../../context/feature-specs/p3-u3c-did-inventory-and-integration.md)
and the [replacement parent](../../context/feature-specs/p3-u3-development-resource-management.md).
[Operator workflow](../runbooks/did-inventory.md) and
[resource/reference contract](../architecture/trunks-and-gateways.md) provide the
P3-U4/P3-U5/P4 handoff. Desired definitions and credential selections establish no
live connectivity, applied configuration or tenant voice readiness.

## Acceptance reconciliation

| Criterion | Verified result                                                                                                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Real PostgreSQL/API/browser DID create/read/edit/status/removal. Exact normalization, canonical display/help, plus/leading-zero distinctions, disabled reservation, same-installation links, number/name collision and independent SQL constraints passed.                                                                                                 |
| C-02      | A/B duplicate-request, equivalent-number and reference-versus-removal races passed. Atomic audit/receipt rollback, no-op/version behavior, retained UUID/audit, foreign/removed links, gateway structural/removal blockers and existing trunk blockers passed. Removing/relinking eligible DIDs permits later gateway/trunk removal.                       |
| C-03      | Actual HTTPS trunk → gateway → DID creation, inspection, edits, status and dependency-ordered removal passed. Digest/desired registration selection and explicit version adoption passed. Validation/collision retention, focus, stale review, exact lost-create retry, actionable blocker navigation, keyboard, 320/390/768/1440px reflow and axe passed. |
| C-04      | Actual platform authentication/session/channel/CSRF checks, staff/unauthorized denial and cross-installation/resource rejection passed. Real provider and browser output checks remain secret-free. Offline `.invalid` PBX saves require no PBX adapter and make no live changes.                                                                          |
| C-05      | Integrated real-service/browser command, affected a/b checks, inventory/adoption regressions and final full `./dev check` passed, exit 0. Ordinary HTTPS refresh/transport checks passed, console ready and backend live/ready 200. Operator and future-consumer contracts published.                                                                      |

| Parent criterion | Final evidence                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEV-01           | Fresh a IP-peer trunk/gateway PostgreSQL/API/browser CRUD, strict settings, ownership, sources, versions, audit, idempotency and races passed in the integrated command.                                                                                                                                |
| DEV-02           | Real trusted OpenBao imports published actual versions 1/2 directly into the isolated browser database. Availability/purpose/installation/version checks, digest/registration selection, explicit adoption, old-version retention and exact uncertain-write recovery passed. IP-peer needs no material. |
| DEV-03           | New DID canonicalization, collisions, ingress edits, soft removal, audit and A/B races passed.                                                                                                                                                                                                          |
| DEV-04           | Actual protected platform/API/browser and shared-session recovery passed. Wrong-plane/unauthorized changes reject; stale and lost responses have explicit canonical/exact-request recovery.                                                                                                             |
| DEV-05           | Actual three-resource console and digest selection/adoption passed, including meaningful validation/blocker feedback, keyboard and responsive behavior.                                                                                                                                                 |
| DEV-06           | Unreachable PBX fixture targets, no telephony process or PBX adapter in the resource journey, no DNS/probe/provider/PBX call on desired saves, and explicit desired-only UI. No live registration/reload/apply/call/readiness claim.                                                                    |
| DEV-07           | Focused real-service/browser, affected a/b/inventory/adoption and full normal graph passed. Shared multi-replica authority, transactions, session loss/outage/limits, credential recovery and PBX registry regressions passed.                                                                          |

## Delivered implementation

Additive migration `20261023020000_did_inventory` creates `sip_dids` with immutable
UUID/node/installation ownership, composite same-owner gateway foreign key, typed
canonical number, partial number/name uniqueness, desired enabled flag, version,
actor/timestamps and retained soft removal. It reuses the existing identity/version
trigger and narrow runtime grants. Existing schema/data and credentials are retained.

The existing `peers/:kind` DTO/domain/repository/application/controller and named
Next forwarder now accept `dids`. Bounded passive reads, strict inputs/outputs,
platform authority, node serialization, atomic audit and operator/request-ID receipts
remain shared. Disabled DIDs reserve canonical numbers. Removed names/numbers can
be reused only under a new UUID; retained references never retarget.

Actual nonremoved DID references block gateway removal and changes to kind, trunk
or source addresses, including disabled DIDs. Compatible labels/desired flags remain
editable. Existing gateway-to-trunk blockers remain effective. No cascade, tenant
allocation, speculative active-call check or missing routing consumer is invented.

PBX navigation completes all three resource tabs. DID forms show canonical help and
preview, canonical saved values, safe validation retention, exact unknown-create
retry and canonical stale/uncertain review. Blocker buttons open the actual referring
resource; an unresolved target draft retains its recovery state.

## Executed commands and results

All builds/checks used the Docker workspace and real services. Commands returned
exit 0 unless explicitly described as a retained running service:

```sh
./dev exec pnpm build:backend
./dev exec pnpm typecheck
./dev exec pnpm db:migrate
MYIMS_TRUNK_INSTALLATION_ID=58adb785-5384-41ce-9c72-ccda6ea554db ./dev exec pnpm check:trunk-gateways
./dev exec pnpm check:extension-inventory --inventory
./dev exec node scripts/check-peer-adoption.mjs
./dev check
./dev platform-https-stop
./dev platform-https
./dev platform-https-check
./dev health
./dev platform-https-status
```

The ordinary HTTPS start remains running and reported ready. Its refresh followed
the normal production builds while independent foundation checks continued; no
application source changed afterward. Transport/browser checks verified trusted TLS,
CSRF/origin/PATCH handling, private listeners, sign-in presentation and preserved
identities/migration history/shared credentials. Live/ready returned HTTP 200 with
PostgreSQL, session Redis and realtime Redis up. This does not claim a new manual
authenticated workstation result; authenticated resource acceptance used the isolated
real HTTPS operator browser.

The final full `./dev check` completed successfully with exit 0. Lint, formatting,
types, web/mobile/backend builds, entrypoint/configuration checks, foundation,
durability, storage/client/deployment, identity, platform/staff/API/browser,
credential lifecycle, distributed limits, shared-session real write/COMMIT response
loss and PBX registry checks passed. The existing zero-ms Redis expiry and supported
lost-response assertions remain intact. Final documentation formatting/whitespace
checks also passed.

Final integrated credential `61512e59-d62e-456d-b804-0dfe52731b33`, versions 1/2,
was imported into the disposable browser database using the real trusted OpenBao
command. Earlier runs also retained their owned synthetic credentials
`2be7df97-92f5-4684-977f-9f70a66c1a4b` and
`6ab3fbd3-df2e-4dca-896d-833af4ad83ff`, versions 1/2. Exact PostgreSQL/Redis fixtures
were removed. Provider versions remain retained; no material destruction occurs.

Host-local diagnostic logs: `/tmp/u3c-integrated-final.log`,
`/tmp/u3c-inventory.log`, `/tmp/u3c-adoption.log`, `/tmp/u3c-check-final.log`,
`/tmp/u3c-migrate.log`, `/tmp/u3c-refresh.log`, `/tmp/u3c-https-check.log`,
`/tmp/u3c-health-final.log` and `/tmp/u3c-https-status.log`.

## Fault fixtures and corrections

The real PostgreSQL/A/B API/HTTPS Chromium suite includes independent SQL constraints,
forced audit-insert rejection and rollback, exact duplicate/create/number and
reference/removal races, actual stale-version interference and suppressed completed
HTTPS write responses. Provider checks combine actual OpenBao storage/reconciliation
with command/PostgreSQL/verified-TLS simulator denial/interruption fixtures. These
fixtures have no production control endpoints. `.invalid` PBX targets demonstrate
PBX-independent desired saves, not live-call interoperability.

The first browser run stopped at a fixture locator that omitted the shared Field
label's required suffix. The corrected run exposed a real focus bug: validation
focused the field while the submission fieldset was still disabled. Focus now runs
after submission settles. The focused-field assertion remains required and passed
in the final full integrated run. Safe values remained retained throughout.

An earlier normal run passed lint/format/types but was deliberately stopped during
builds to restart against the focus correction. It is not used as a full-graph pass.
The final unchanged-source normal run completed with exit 0. No required assertions
were removed or weakened.

## Preservation, limits and handoff

Existing endpoints, provider state, identities, backups and pending backup operation
are preserved. Backup repair/scheduling is separate and was not resumed. No tenant
allocation, number purchase, route destination, inbound routing, live registration,
call test, PBX apply or production readiness is delivered.

P3-U4 must deliberately resolve alternate-number forms and register real routing
references. P3-U5 must register actual applied-use dependencies and own coexistence,
compilation/apply/recovery. P4 must add allocation ownership and voice-readiness
checks. Those consumers must take the node lock before reference changes and must
not cascade or retarget retained IDs.

Mounted browser work does not survive refresh. Accessibility evidence is automated
axe/basic keyboard/reflow, not production certification. Single-host A/B development
checks do not establish multi-host availability, production capacity or joint-store
backup/recovery readiness. Retained a/b acceptance boundaries remain in their
[a evidence](p3-u3a-evidence.md) and [b evidence](p3-u3b-evidence.md).
