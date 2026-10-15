# Controlled-development inventory operations

Use the [inventory API/transaction contract](../architecture/extension-inventory.md)
and [conditional approval](../planning/p3-u2a-inventory-contract-review.md).
Only P3-U2a desired inventory is covered. No production deployment, credentials,
PBX apply, browser journey, tenant allocation or calling readiness is authorized.
Existing unmanaged endpoints/trunks/numbering and reference files stay unchanged.

## Deployment and capability declaration

Run `./dev migrate` through the existing deployment owner. HTTP never migrates.
The inventory migration is additive and empty; no profiles or extensions are seeded.
Runtime can neither perform DDL nor delete/release inventory or profile history.
Rollback before use may be a reviewed deployment migration; after use retain rows
and fix forward to preserve identities, number reservations, audit and receipts.

Create a reviewed non-secret JSON file in the workspace with the following shape.
Use the canonical installation UUID from the existing controlled catalog
`.local/pbx-catalog/catalog.json`; do not create another installation identity.
For the approved controlled Asterisk 22.10.1 installation the declaration is:

```json
[
  {
    "installationId": "<canonical-installation-uuid>",
    "revision": 1,
    "kinds": ["sip", "webrtc"],
    "signaling": ["udp", "wss"],
    "codecs": ["opus", "ulaw", "alaw"],
    "media": ["none", "dtls-srtp"]
  }
]
```

The file contains desired-format capabilities only, no credentials, addresses,
certificate paths or raw PBX configuration. Other installations need their own
approved declaration. Deploy the reviewed file:

```sh
./dev exec pnpm --filter @myims/backend exec node dist/entrypoints/deployment/main.js declare-endpoint-capabilities /workspace/.local/pbx-catalog/endpoint-capabilities.json
```

The trusted command uses the existing deployment database owner; it strictly
validates at most 64 declarations/32 KiB, updates atomically, and requires increasing
revision for changes. Exact identical deployment replay is harmless. Output is
count/state only. It performs no PBX network access. Keep the reviewed file under
deployment control; application startup does not import it or create editable data.

## API use and recovery

Use the existing trusted platform channel/session/Origin/CSRF contract; do not
publish raw private backend listeners or create a new authentication bypass.
The concrete DTOs are in `packages/contracts/src/extension-inventory.ts`.
GET profiles supplies node version and safe capability revision. Explicitly POST a
node-scoped `sip-basic`/`webrtc-basic` profile; then select its exact committed
version and current head for individual create or advisory bulk preview/commit.
Every retriable creation/version operation needs a fresh UUID intent, retained
unchanged with canonical payload for explicit uncertainty recovery.

New inventory is disabled/unallocated with credentials unset. Desired enablement
or profile adoption cannot install endpoints or grant calling readiness. Disabled
stock retains its number. Profile edits create a new immutable version and do not
change old selections. Reload after stale/dependency conflicts and review before
submitting another request. After an uncertain create, retry only the same intent
and payload. After an uncertain edit, reload/review canonical detail first.

403/401 requires current authorized platform sign-in; 429 observes existing
admission delay. 503 safely denies work and includes Retry-After 1; database/Redis
recovery and canonical inspection precede retry. A missing capability declaration
requires reviewed deployment configuration; PBX outage alone must not prevent
inventory management. Never infer absence of a committed mutation from a 503.

## Verification and retention

```sh
./dev exec pnpm check:extension-inventory --inventory
./dev exec pnpm check:pbx-nodes --registry
./dev exec pnpm check:session-foundation --authority
./dev exec pnpm check:durability
./dev check
```

The focused launcher uses a newly named disposable PostgreSQL database with real
runtime grants, isolated authenticated shared Redis and independent production
Nest HTTP A/B graphs. Synthetic node/capability declarations prove desired
compatibility and namespace only. Barriers and controlled audit/receipt constraints
prove races and rollback; a PostgreSQL protocol proxy drops an actual committed
acknowledgment. HTTP response loss is separately injected after a real response.
One-second fixture admission windows remain within approved configuration bounds;
production defaults remain unchanged. It never changes PBX/reference configuration.

The harness removes its exact database, Redis container/volume, session keys and
temporary catalog directory in finally paths. It must not remove other databases
or shared catalog/material. See [evidence](../status/p3-u2a-evidence.md) for actual
runs, regressions, fixture cleanup and remaining b/c/P3-U5 boundaries.

Receipts retain original safe results for 30 days. Runtime cannot update/delete
receipts. Deployment may delete only expired rows, in a bounded reviewed operation;
no scheduler or cleanup worker is introduced. Retain audit, extension identities,
number reservations and immutable profile history. Pruning ends same-key replay
guarantees and requires canonical reload/review; never treat it as number release.
Contact expiry/reconnection/device replacement, production media/transport and
live readiness require separate verification/approval under their owning units.
