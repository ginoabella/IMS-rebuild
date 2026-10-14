# P3-U1a connectivity contract review

Prepared 2026-10-14 (Asia/Manila, +08:00). **Section 1 approved 2026-10-14 (Asia/Manila, +08:00).**
Requirement: [P3-U1a](../../context/feature-specs/p3-u1a-protected-pbx-registry-and-connectivity-contracts.md).
Decision owner: scoped [D-09](p1-u1-review-draft.md#decisions-to-record-before-dependent-implementation),
[P3-U1 gates G-01/G-02](../../context/feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md#decision-and-environment-gates).
Section 1 is approved with the clarifications below. Sections 2–4 prepare
implementation; they are not delivered API or acceptance evidence.

User clarifications: support multiple independent PBX installations; keep registry
separate from future tenant/LGU associations, including multiple tenants sharing
one PBX; preserve permanent installation identity through credential rotation;
treat Asterisk version, TLS port, Docker aliases and local file provider as this
development profile, not universal deployment constraints. The catalog therefore
maps many installations/profiles independently; credentials and endpoints are
replaceable connectivity attributes. No tenant ownership columns or allocation
semantics are introduced by a.

## 1. Approved connectivity policy

The user approved the local development target and protected configuration below,
with the architectural clarifications recorded above. This authorizes registry
implementation and its isolated tests. Actual authenticated Asterisk
access and observation settings remain prerequisites for b; a does not need a
reachable PBX to save valid desired state.

| Decision | Recommended local development contract |
| --- | --- |
| Controlled target | The existing Compose `asterisk` service, pinned in `infra/docker/compose.yaml` to Asterisk 22.10.1. Deployment assigns one immutable managed-target UUID to this installation. Rebuilding/restarting the same installation preserves that identity. A different installation needs a separately established identity. |
| Management interface | AMI over certificate-verified TLS, proposed private TCP port 5039 and certificate name `asterisk`. No host publication of management access. The hostname is an approved endpoint, never evidence of physical uniqueness. HTTP/ARI and plaintext AMI are excluded from this profile. |
| Permitted destination | Only the existing controlled service's explicitly deployment-approved addresses on the private Compose network. No blanket approval of private networks, loopback, link-local or metadata endpoints. Deployment supplies the address set; runtime has no Docker socket. Address changes require trusted configuration refresh before connection resumes. |
| Target aliases | Initial proposed alias `local-asterisk`. A bounded deployment-owned catalog maps any approved equivalent alias to the same immutable target UUID and connection profile. Operators cannot submit the UUID, invent profiles or declare that two hosts are distinct PBXs. |
| Credential aliases/provider | Initial proposed opaque alias `local-asterisk-observer`. Use protected local runtime files through a server-only alias resolver, following the existing secret-file provisioning pattern. The catalog approves this alias for this target and interface; no arbitrary path/provider URL is accepted. |
| Process access | HTTP can read only the non-secret target/alias catalog. The telephony runtime can additionally read the exact protected credential file and TLS trust configuration. Ordinary workers and web apps receive no PBX credential material. Trusted deployment provisions files outside source and database; diagnostics never print their contents. |
| Create receipt window | Explicit same-intent replay for 30 days by database time; expired retained attempts reject and require canonical reload. Trusted deployment alone may prune expired receipts. After pruning the replay guarantee has ended, so clients must reload expired attempts. Node/audit history is retained. |
| Runtime access purpose | A dedicated observation credential and a code-owned allowlist of non-mutating management actions. Exact Asterisk permission classes and denied-action probes must be verified in b before claiming read-only authenticated access. No CLI command, originate, configuration update/reload or apply capability is approved here. |

The recorded approval resolves the registry portions of these gates because a's spec says:
“Resolve G-01's management descriptor, approved target identity/network and
permitted transport, plus G-02's alias/resolver/access contract, before dependent
validation or resolution work.” The workflow also says: “Do not invent product
behavior that is not defined by the project context.” Neither the bootstrap nor
the user-requested a/b/c split establishes those approvals.

AMI supports TLS and separately configures permissions for actions and events;
its setting named `write` concerns action authorization, so setting it to none
cannot be assumed to permit snapshot queries. See the official
[AMI specification](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/)
and [AMI action/event permission explanation](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/The-Asterisk-Manager-TCP-IP-API/).
The recommendation is to verify the pinned version's actual permissions and
allowed actions in b; this document does not assert that AMI has a universal
read-only account flag or approve broad action classes.

Approval can be recorded as: **“Approve section 1 for the existing local Compose
Asterisk target; proceed with P3-U1a.”** If using another PBX, supply its non-secret
managed identity, authorized endpoint/transport/port, exact network destinations,
TLS trust requirements, alias vocabulary and provider/access choice. Supply
credential material only through protected provisioning, never in this document
or chat.

## 2. Verified starting state

Repository inspection, not fresh runtime acceptance:

- `infra/asterisk/bootstrap/manager.conf` and `http.conf` both set `enabled = no`.
  Compose publishes SIP/RTP only; no approved management listener, observer
  credential or PBX alias resolver is configured in tracked source.
- `services/backend/src/entrypoints/telephony/main.ts` is an isolated skeleton
  advertising `capabilities: pending`; there is no delivered registry/observer.
- Existing `Transaction.run`, `Transaction.required`, `AuditWrite`,
  `OutboxRepository`, `TransactionAuthority.validate` and `SnapshotDatabase`
  supply transaction, attribution, failure poison, locked canonical authority
  and primary snapshot boundaries. Reuse these owner interfaces.
- Platform tenant controller/runtime patterns demonstrate explicit
  `platform-cookie` authority, passive reads, operational writes, safe failures
  and bounded pools; PBX data and receipts belong to telephony, not those stores.
- [P2-U3b evidence](../status/p2-u3b-evidence.md) and
  [P1-U5c evidence](../status/p1-u5c-evidence.md) record delivered dependencies.
  Their checks have not been rerun during this documentation checkpoint.
- `check:pbx-nodes` does not exist. It must be implemented and run before a is
  complete; no proposed command below is a recorded pass.

## 3. Registry implementation contracts

These routine technical choices prepare A-01 and are subordinate to the approved
section 1 profile. They do not authorize unresolved environment policy.

### Named transport and validation

| Consumer / DTO | Proposed route and result |
| --- | --- |
| `createPbxNode` / `CreatePbxNodeRequest` | POST `/platform/pbx-nodes`; 201 new, 200 same-intent replay |
| `listPbxNodes` / `PbxNodeListDto` | GET `/platform/pbx-nodes?limit=25&after=<UUID>`; 200 |
| `getPbxNode` / `PbxNodeDetailDto` | GET `/platform/pbx-nodes/:nodeId`; 200 |
| `editPbxNode` / `EditPbxNodeRequest` | PATCH `/platform/pbx-nodes/:nodeId`; 200 with committed desired version |

Create accepts exactly `requestId` (UUID), `displayName`, `management`
(`targetAlias`, `transport`, `port`) and `credentialAlias`. Edit accepts exactly
`expectedVersion` and the same desired fields, with no create request ID.
The proposed approved profile accepts `ami-tls` and port 5039 only. Deployment
resolves the alias to the safe host/profile and canonical managed-target UUID;
no client host, address, username, password, URL, provider path, role, tenant,
actor or ownership key is accepted.

Reuse the existing 4096-byte JSON body limit. Bound names to 800 raw and 200
trimmed UTF-16 units; reject controls and malformed surrogate text. Aliases are
at most 128 raw units, trimmed/lowercased ASCII identifiers of 1–64 characters
matching `[a-z0-9][a-z0-9-]*`; catalog membership and target/credential compatibility
are mandatory. UUIDs normalize to lowercase. Version is a positive safe integer;
port is an integer matching the approved profile. Reject unknown keys at every
object level, repeated/unknown queries and malformed IDs. Fixed field errors never
echo submitted values. List uses UUID keyset order, default 25, maximum 100, and
fetches at most limit + 1 rows.

Desired DTOs contain immutable node ID, display name, safe normalized descriptor,
approved opaque credential alias, version, ISO timestamps and canonical actor
references. List returns `{items, nextCursor}`; detail/create/edit return `{node}`.
Every node has `observation: {kind: 'not_available'}` until b. No reachable/healthy
claim follows from save, catalog validation or resolver fixtures. Clients never
receive catalog provider locations, credential material or TLS private keys.

### Transaction, retry and errors

Telephony owns `pbx_nodes` and immutable create receipts. A real unique constraint
on the deployment-resolved target UUID enforces equivalent-alias collisions.
Identity does not depend on DNS spelling, DNS address equality or display name.
Unknown/unresolved catalog identities reject before mutation. The catalog must
not assign different UUIDs to the same controlled installation; that trusted
provisioning assertion is explicit, not something DNS or the client can prove.

Create acquires canonical operator authority through the existing owner lock,
then serializes receipt inspection on operator + operation + request ID. Use
SHA-256 over a bounded ordered canonical payload including normalized display
name, canonical target/profile and canonical credential alias. Equivalent target
aliases map to the same canonical profile. Receipt/node/business audit commit on
one `Transaction`; a required audit/receipt failure poisons and rolls back it.
A changed connectivity record also records its business audit in that transaction.
All logs use the existing `SafeLogger`; audit metadata is limited to version and
fixed change enums, not names, paths or raw input.

Same operator/key/canonical payload within the receipt window returns the original
safe creation result without another node or business audit. Store the original
safe result in the receipt so subsequent edits cannot change replay semantics;
explicit detail reload obtains current desired state. Conflicting payload returns
`request_conflict`; another key for an existing canonical target returns
`target_conflict`. Other operators cannot recover each other's receipts.

Proposed receipt retry window: 30 days by database time. Expired retained receipts
return `intent_expired`, requiring canonical reload. Trusted deployment owns any
pruning of expired receipts; HTTP cannot delete them. After physical pruning,
the same-key replay guarantee has ended, so callers must reload rather than resubmit
an expired attempt. No node/audit/outbox retention cleanup is included. Document
and verify this window and deployment cleanup boundary in the delivered contract;
there is no silent automatic resubmission after uncertainty or expiry.

No observation/reconciliation outbox handler exists in a. Durable reconciliation
intent becomes required when b wires its consumer; do not enqueue unknown work
that the existing worker would classify `invalid_work`. The integration port below
allows b's required intent to share the edit transaction. a's handoff fixtures
prove intent failure rollback using the existing outbox owner, without shipping a
speculative observer handler or observation tables.

All endpoints declare current platform authority and existing cookie/proxy/Origin
policy. Reads remain passive; writes require CSRF and transactional authority
revalidation, and only confirmed successful operational writes qualify for
conditional activity renewal. Reuse no-store and existing 401/403/429/503 behavior.
Validation returns 400 with fixed field keys; valid missing node ID returns 404;
conflicts return 409 with fixed reason codes `target_conflict`, `request_conflict`,
`stale_version` or `intent_expired`. Dependency/unknown COMMIT outcomes return safe
503 with `Retry-After: 1`. Explicit same-intent retry or canonical reload recovers
create ambiguity; changed data never reuses that attempt. Ambiguous edits require
reload before a new versioned edit.

### Atomic edit handoff to b

Edits lock the desired node and check expected version even for unchanged input.
A successful changed desired record increments version once; unchanged canonical
input returns current desired state without mutation/audit. Name-only changes
advance the record version; b must preserve or requalify its matching observation
within the same transaction without unnecessarily replacing ownership. Changes
to canonical target/profile or credential alias invalidate observation and replace
ownership generation; a failed handoff rolls back version, desired state and audit.

The telephony application owns `PbxDesiredChangePort.onChange(transaction,
{nodeId, previousVersion, nextVersion, connectivityChanged})`. Invoke it through
`transaction.required` and await it before commit for every changed record.
In a, the adapter explicitly represents observation not yet installed and performs
no external I/O. Its isolated real-database contract fixture writes/invalidates a
fixture projection and durable intent on that same handle, including forced
invalidation/intent failure. b replaces the adapter with its owned observation/
lease invalidation and reconciliation intent, using the same node lock order.
There are no production observation or lease tables in a. b cannot mark an old
version current or leave old connectivity ownership valid after the edit commit.

### Secret and destination ports

Separate `ApprovedPbxCatalog` (non-secret validation/canonical identity),
`PbxCredentialResolver` (runtime-only material) and `PbxDestinationPolicy`
(actual resolved addresses immediately before connection). HTTP uses only catalog
validation; missing/inaccessible runtime secret material does not undo a valid save.
Resolver failures use fixed `secret_missing`/`secret_unavailable` categories and
never carry provider exception text into diagnostics.

The connection policy rejects unapproved address families/addresses, mapped-address
bypasses, metadata/local targets and unsupported transport/port. Resolve with bounds,
validate the complete answer set and pin the chosen approved address for that
connection; do not validate DNS and then perform an uncontrolled second resolution.
TLS still verifies the approved service name/trust. Safe DNS/address and credential
fixtures test these ports in a; real authenticated PBX observation belongs to b.
No arbitrary remote scanning or precommit network/credential resolution occurs.

## 4. Resume and verification

After section 1 approval, record the decision in the tracker, synchronize the
implementation contract and provision the non-secret catalog before dependent
coding. Provision protected fixture secret material without including it in source
or evidence. Actual live credentials/AMI enablement can wait for b; a must verify
its real provider boundary using controlled protected files and its destination
boundary using declared safe fixtures.

Implement `./dev exec pnpm check:pbx-nodes --registry` against disposable PostgreSQL
with real runtime grants, shared Redis and independent HTTP A/B processes. Prove
canonical-target races, concurrent same-intent replay, conflicting reuse, forced
required-write rollback, stale edits, handoff failure and real suppressed COMMIT
response. Use isolated canonical operators/staff and precisely clean fixture-owned
nodes/databases/sessions/files/processes. Capture secret-sentinel absence across
DTOs, receipts, audit/outbox, safe logs/exceptions and client contract output.

Run affected platform HTTP/session authority, audit/outbox and durable delivery
regressions plus `./dev check`. Record actual commands, outcomes and fixture limits
in a's evidence, runbook, documentation index and tracker. Complete only when
A-01–07 pass. Then hand b the registry/version/invalidation and approved provider/
destination ports, and c the protected DTO/error/forwarding contracts.

G-03 freshness, lease timing, observation/reconciliation settings, live registration
fixtures, secret rotation/reconnect behavior and real authenticated access remain
with b. Routing, apply and active-call policies remain with their later owners.
