# P2-U1a verification evidence

Completed 2026-10-05 14:07 +08:00 (Asia/Manila). A-01–07 passed. The user approved
D-05 account/credential representation and associated storage rules for this unit.
See [specification](../../context/feature-specs/p2-u1a-canonical-identity-stores-and-ownership-constraints.md)
and [storage contract/scoped P1-U1 handoff](../architecture/canonical-identity-storage.md).

## Commands and environment

Existing Docker workspace, Node 22.23.3, pnpm 10.12.1, real PostgreSQL/PostGIS,
existing runtime and deployment credentials. No new dependencies or service
containers are required. Commands:

- `./dev exec pnpm --filter @myims/backend typecheck` — passed.
- `./dev exec pnpm exec eslint scripts/check-identity-foundation.mjs scripts/check-storage-clients.mjs services/backend/src/modules/identity services/backend/src/modules/tenancy services/backend/src/modules/platform` — passed.
- `./dev exec pnpm check:identity-foundation --storage` — passed.
- `./dev exec node scripts/check-identity-foundation.mjs --storage` — passed after
  final migration version guards and additional SQL assertions.
- `./dev check` — passed, exit 0: lint/format/types, all web/mobile/backend
  builds, entry-point/configuration checks, foundation/audit/worker/recovery,
  Garage storage/access/expiry, integrated identity storage, all five client
  credential scans and fresh provider provisioning/restart checks.
- `./dev exec pnpm db:migrate` — passed on the local development database.
- `./dev health` — live/ready HTTP 200, all dependencies up.
- Trusted read-only verification — local canonical stores/provenance contain zero
  seed records; no `myims_identity_*` fixture databases remain.
- Changed-document relative-file links and `git diff --check` — passed.

The focused command builds the backend and runs the storage selection; omitting
`--storage` currently selects the same implemented suite. Unknown selections fail.
`check:foundation` includes it, so existing Docker checks and CI inherit it.
The suite creates a unique `myims_identity_<random>` disposable database and runs
the real deployment entry point twice. The trusted owner administers fixtures;
runtime credentials perform constraints, privileges and repository checks. An
independent observer proves records/audit invisible before commit. Each collision
uses separate runtime connections and proves the contender waiting on a PostgreSQL
lock before committing the winner. All clients close and the suite drops only its
own database. It opens no public fixture endpoint.

## Acceptance coverage

| ID   | Verified evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Approved account/credential vocabulary and scoped P1-U1 handoff recorded; ASCII/Unicode, bounds/C collation, versions and grants documented; role schema remains for b.                                                                                                                                                                                                                                                                                                   |
| A-02 | Fresh deployment/rerun records five migrations with zero identity seeds; all tenant statuses, invalid codes, global collisions/retired-code reuse, runtime and owner code immutability; display-name change preserves identity.                                                                                                                                                                                                                                           |
| A-03 | Two tenants share a normalized username; inactive/active namespace collisions, non-null/restrictive tenant FK, missing tenant, foreign-qualified reads/writes and reparenting rejected; tenant and staff insert races settle one winner.                                                                                                                                                                                                                                  |
| A-04 | Operator table has no tenant column; same-named staff/operator records are distinct. Even identical UUIDs in the two stores need explicit planes. Wrong-plane and wrong-store lookups fail. Runtime operator creation/provenance writes are denied.                                                                                                                                                                                                                       |
| A-05 | Creation/lookup normalize case/outer whitespace consistently; repeat normalization is idempotent; whitespace, Unicode/compatibility characters and overlength canonical values rejected. Actual UTF8 database/C collations and boundary SQL values checked. Credential hash bytes preserved without identifier normalization; a introduces no password-input path.                                                                                                        |
| A-06 | Direct runtime SQL cannot alter ownership/IDs/schema/trigger protections, delete/truncate identities or rewrite audit; positive counters and regressions rejected. Credential states/hash/timestamp coherence and absent state defaults checked. Trusted fixture deletion preserves its audit. General staff/operator DTOs omit usernames/hashes; diagnostic/audit sentinels absent. All five built-client scans passed credential access/import/hash sentinel exclusion. |
| A-07 | Focused database checks and full Docker regression passed. Storage contract documents commands, isolation, grants, repository transaction rules and b/c handoff.                                                                                                                                                                                                                                                                                                          |

Application writes share the existing transaction and append bounded, enum-only
`identity.storage.changed` audit metadata. Tests prove stale and canonical no-op
renames preserve versions/audit, real query failure returns `unavailable`, and
forced audit INSERT failure rolls back both creation and rename versions. Authority
versions increment for staff username changes; tenant display edits change only row
version. The database rejects version regressions. b owns full role/status/
credential/lifecycle version rules and coherent admission snapshots.

## Fixture corrections and limits

An early failure constraint attempted to validate existing audit rows; changed the
update-failure injection to `NOT VALID`, preserving history while rejecting new
inserts. A deliberate connection termination initially lacked the fixture's
checked-out-client error listener and ended the process. Removed exactly its one
interrupted database after verifying the generated name and this suite's three
fixture markers. Added fixture connection-event handling; later runs cleanly tear
down. The identical-UUID fixture also required selecting a different absent
operator ID for its wrong-store assertion. Corrected assertions; final focused
runs pass without weakening the constraints.

This unit proves persistence/ownership only. No role grants/admission decisions,
authentication/password policy/hash verification, sessions, setup/reset tokens,
bootstrap execution/rerun workflow, UI or production HA acceptance is claimed.
Synthetic ready hashes are storage fixtures, not usable approved credentials.
Operator/provenance production migrations create no records. Trusted operator
creation, safe rerun/concurrency/interruption behavior and password hashing remain
c, after b's verified foundation. Hosted CI execution is unverified locally.
