# PBX registry operations

Owner: platform/telephony maintainers. Scope: approved local desired registry;
[contract](../architecture/pbx-registry.md), [approval](../planning/p3-u1a-connectivity-contract-review.md),
[evidence](../status/p3-u1a-evidence.md). Live observation, TLS listener provisioning,
permissions/registration/freshness and ownership recovery remain P3-U1b.

## Provision and start

Use the existing Docker workspace and retained local services. `./dev up` starts
shared services, prepares the approved non-secret catalog, builds and applies
trusted migrations before starting HTTP. Never execute migrations from HTTP.
Existing AMI/ARI bootstrap stays disabled during a; desired registration does not
require live management access or successful secret resolution.

`./dev pbx-catalog-prepare` inspects only the named controlled Compose service's
labels/address and writes ignored `.local/pbx-catalog/catalog.json`. It creates
`.local/pbx-catalog/installation-id` once and preserves it on refresh/restart.
Preserve that identity file with the installation's protected deployment records;
losing it requires explicit identity reconciliation, not silently registering the
same installation as a different PBX. The alias local-pbx maps to local-asterisk.
Only the current service's exact private IP is approved, never its entire subnet.
This catalog includes the approved local-asterisk-observer alias without storing
any material. The runtime backend mounts the catalog directory read-only and
has no Docker socket or PBX credential mount.

Run `./dev exec node scripts/probe-pbx-destination.mjs` for the read-only local
DNS/address check. It emits only a fixed outcome and never opens a management
connection or reads credentials.

If the controlled service's address changes, refresh the catalog through trusted
deployment and restart consuming processes before reconnecting. The catalog is
loaded at startup; mismatched DNS answers fail closed. For another deployment,
supply its approved catalog via PBX_CATALOG_FILE and a read-only mount. Preserve
installation UUIDs across endpoint and credential changes. Avoid assigning two
UUIDs to the same installation or reusing one UUID for independent installations.

Protected credentials belong outside the catalog directory, source, DTOs, database,
audit and diagnostic output. In b, provision a separate runtime-UID-owned mode-0600
file containing only username/password, map its approved alias only in the
telephony process, and mount only that provider/trust configuration there. The
provider supports reread after protected atomic file replacement; b must establish
reconnect behavior and actual read-only account permissions before live acceptance.
Missing files are a safe resolver outcome, not grounds for deleting desired state.

## Register, inspect and edit

Use the existing secure platform cookie, trusted private proxy, exact Origin and
session CSRF boundary. The backend endpoints are `/platform/pbx-nodes`; browser
forwarding/screens will be delivered in c. Submit a UUID requestId, displayName,
management `{targetAlias:'local-asterisk',transport:'ami-tls',port:5039}`, and
credentialAlias local-asterisk-observer. Never include a password or provider path.
GET list/detail are passive and return b’s freshness-qualified observations when available, otherwise observation not_available. Saving settings
establishes desired state only. No tenant/LGU association is created; the future
explicit contract can associate several tenants with one shared PBX.

Retain the request ID and exact canonical input for explicit retry after an
uncertain create response. A same-intent replay returns the original safe creation
result; GET detail obtains the current version after subsequent edits. Another
payload under that key conflicts. Retry window is 30 days; after expiry use
canonical reload rather than another submission of that attempt.

PATCH requires expectedVersion and desired fields. A stale version requires
explicit reload; an ambiguous response may already have committed and also
requires reload. Credential alias changes keep record/installation identity,
advance version and invalidate observation through the transaction-bound b port.
No automatic mutation replay or live-connect claim is allowed.

## Verify and clean fixtures

Run `./dev exec pnpm check:pbx-nodes --registry`. It uses an exact uniquely named
`myims_session_*` disposable PostgreSQL database with fresh/rerun deployment,
real myims_runtime grants, a fixture-owned authenticated Redis container and
independent production HTTP A/B processes. It creates isolated operators/staff,
42 synthetic installation profiles and protected temporary provider files.
Barrier-controlled database locks prove concurrent retries/collisions and stale
edits; a PostgreSQL proxy drops a real committed acknowledgment. Contract-only
projection/outbox fixtures prove atomic handoff/rollback. Address fixtures perform
no arbitrary remote scans and establish no live Asterisk authentication.

The harness closes processes/pools, deletes its tracked session keys and temporary
files, closes proxies and drops its exact disposable database. The trusted launcher
removes only its generated myims-session-check-* Redis container and temporary
configuration directory. Existing tenants, platform sessions, PBX settings and
Asterisk SIP/routes are not acceptance fixtures and must not be cleared.
If interrupted, identify the exact logged fixture database/container/process and
remove only that fixture with trusted deployment tools; never disable history
protection or purge shared sessions/audit as general cleanup.

Run affected platform/session authority and durable foundation regressions, and
`./dev check`, before claiming completion. Commands/outcomes/limits belong in the
linked evidence; a full graph includes the registry matrix through session checks.

## Retention and recovery

Runtime cannot delete receipts or desired nodes. A trusted maintainer may prune
expired receipts with a bounded deployment query by created_at after 30 days;
SQL denies earlier deletion or mutation. Use an operator-reviewed deployment
maintenance window, namespace the connection to the intended database and record
row counts without result payloads. No automatic production scheduler or history
cleanup is installed. No node deletion, restore-by-replay, live apply or rollback
workflow is included. Back up installation identity/catalog with deployment
configuration and PostgreSQL desired state/receipts under future production
recovery policy.

For the conditionally approved local observer, protected provisioning, runtime start, freshness and recovery checks, see [PBX observation operations](pbx-observation.md). Registry saves remain separate from observation health; browser delivery is P3-U1c.
