# Draft tenant registry API — P4-U1a-1

Implementation contract (2026-10-07, Asia/Manila, +08:00).

| Named consumer    | Route                                         | Activity    | Success             |
| ----------------- | --------------------------------------------- | ----------- | ------------------- |
| createDraftTenant | POST `/platform/tenants`                      | operational | 201 new, 200 replay |
| listTenants       | GET `/platform/tenants?limit=25&after=<UUID>` | passive     | 200                 |
| tenantDetail      | GET `/platform/tenants/:tenantId`             | passive     | 200                 |

All require `platform-cookie`, plane `platform`, permission `platform_operator`,
the delivered trusted proxy/exact Origin boundary and shared protected admission.
POST additionally requires session-bound CSRF. Reads are passive, including
navigation and background refresh; create alone qualifies for renewal and cannot
extend the original absolute deadline. All responses use `Cache-Control: no-store`.

Create accepts exactly `requestId`, `tenantCode`, `displayName`,
`administratorUsername`. Backend raw text limits are 256/800/512 UTF-16 units
respectively; controls and malformed surrogate text are rejected before trim.
Canonical identifiers reuse owner normalization (64/128); name is trimmed, 1–200
UTF-16 units. UUID request IDs are case-normalized. Body limit is the delivered
4096 bytes. Unknown fields are rejected. Validation returns 400 with declared
field keys and fixed messages, never echoes input.

List accepts only `limit` (decimal integer 1–100, default 25) and `after` (UUID).
Ascending tenant UUID ordering uses the primary-key index and keyset pagination.
DTO: `{items: [{id,tenantCode,displayName,status}], nextCursor: string|null}`.
Detail/create DTO: `{tenant: {id,tenantCode,displayName,status,version,
authorityVersion,createdAt,updatedAt}, administrator: {kind:'available',id,
tenantId,username,roles,status,credentialState}|{kind:'unavailable'}}`.
Timestamps are ISO strings. Detail with valid missing ID returns 404; malformed ID
returns 400. A canonical tenant with no creation receipt has unavailable
administrator provenance. Reads use one primary repeatable-read snapshot across
owner ports and never infer linkage.

Failures: 400 validation (`fieldErrors`); 401 absent/expired session; 403 plane,
permission, source/Origin/CSRF or stale mutation authority; 409 with
`reason:'tenant_code_conflict'|'request_conflict'`; 429 shared admission; 503
retryable unavailable or unknown commit outcome. 429/503 reuse bounded Retry-After.
Explicit retry must retain the same request ID and canonical input; no automatic
write replay. Another operator's UUID cannot recover its receipt.

The platform-owned immutable receipt stores operator/request uniqueness, SHA-256
canonical-input fingerprint, original tenant/staff IDs, creation correlation and
timestamp. A unique tenant linkage and composite staff/tenant FK enforce qualified
provenance. SELECT/INSERT runtime grants only; no cleanup. An operator/request
transaction advisory lock serializes inspection/creation across replicas. Server
statement/lock/connection timeouts bound waits. Canonical code uniqueness selects
a winner across distinct attempts. Both canonical creations, existing owner audit
facts and receipt commit on one connection under the operator SHARE authority
lock. Success requires outer commit acknowledgment.

`Transaction.withStaffCreationTarget` is a scoped child handle for a root platform
actor targeting a UUID tenant. It validates UUID staff reference and canonical
existence of the root tenant before exposing a staff target in that tenant. Actor
and correlation are copied from the frozen root. Both handles share connection
and required-failure poison; the child expires on callback return. An unfinished scope prevents outer commit, and outer completion invalidates every child handle. Original
transaction consumers remain unchanged. Only backend-generated IDs reach this
method; no request-provided target or identity may be forwarded.

Tenancy supplies a narrow fixed-draft creation capability plus canonical list/detail; only its tenant-code constraint maps to a code conflict. Required audit or UUID uniqueness failures map to unavailable, while existing registry consumers retain their original outcomes. Identity supplies a narrow
first-administrator create/read port that explicitly selects username and safe
state, never private verifier material. Platform SQL owns receipts only.
Tenant-qualified `{tenantId, administrator.id}` is the P2-U4 handoff. Credentials,
staff sign-in, activation and PBX remain subsequent
units. Backend acceptance and required regressions are complete; linked evidence records the exact commands and limits.

Apply the deployment-owned schema with `./dev migrate` before starting updated
HTTP replicas; HTTP never migrates. Run `./dev exec pnpm check:draft-tenant --api`
for the focused backend matrix. The required `./dev check` graph also runs that
matrix through its complete session check, including existing authentication,
authority, audit, identity and recovery regressions. See
[acceptance evidence](../status/p4-u1a-1-evidence.md) for exact results and limits.

The [browser contract](draft-tenant-browser.md) defines the delivered protected
forwarding/screens and mounted owner-bound recovery. Final integrated verification
is recorded in [child 2 evidence](../status/p4-u1a-2-evidence.md).

## P4-U1b-1 extension contract

`listTenants` additionally accepts `search` (at most 800 raw UTF-16 units,
trimmed to at most 200; controls/unpaired surrogates rejected) and exact `status`
(`draft|active|suspended|retired`). Blank search is unfiltered. Search is literal,
case-insensitive substring matching over code/name with escaped SQL wildcards.
UUID keysets and 25 default/100 maximum remain. Trigram name/code and status/UUID
indexes support selection; existing 2-second statement timeout bounds execution.

`saveTenantSection`: POST `/platform/tenants/:tenantId/configuration`, operational,
platform-cookie/permission/source/Origin/CSRF/shared admission and no-store as above.
Body is at most 4096 UTF-8 bytes, exactly `requestId` UUID, `expectedVersion`,
`expectedAuthorityVersion` (integers 1–2147483646), `section` (`name|contacts`),
and `values`. Name values accept exactly required `displayName` using creation
validation. Contact values accept only `name`, `email`, `phone`, with at least one
key; approved ONB-01/03 semantics are in the parent spec. Raw bounds before trim
are 800/1016/200 units respectively. Email accepts an ASCII mailbox local part
and DNS-style domain with at least one dot (no display names or whitespace).
No lifecycle, code, administrator, credential, geography or voice fields accepted.

Success 200 is `{outcome:{requestId,tenantId,section,version,authorityVersion},
replayed:boolean,current:TenantDetailDto}`. Outcome contains only references,
section and original committed versions; `current` is a separate fresh canonical
read and can be newer. Detail adds `contacts:{name,email,phone}` with nullable
strings. 400 has fixed field errors; 409 reasons add `version_conflict`,
`eligibility_conflict`, `request_conflict`. Missing target is 404. Failure/unknown
commit is 503; no automatic replay. An exact explicit original retry recovers its
original outcome, including when later edits/status changes exist, under current
operator authority. Changed input or foreign adoption conflicts.

Lock order is operator SHARE, globally unique attempt advisory lock, tenant UPDATE.
Tenancy owns contact writes; platform owns immutable separate edit receipts with
request UUID primary key, operator/target/section, SHA-256 canonical-input digest,
committed versions/correlation/time, and SELECT/INSERT-only runtime grants.
Receipt, section update/version and required canonical-actor audit commit together.
Ordinary edits preserve authority versions and unrelated fields. No outbox or job.
Contact values never enter audit, receipt, or logs. Receipts have no cleanup policy.

Owner ports: `DraftTenantRegistry.list(snapshot, limit, after, search?, status?)`
and `byId(snapshot,id)` retain their original optional/unfiltered calls.
`TenantConfigurationOwner.configure(tx,id,SaveTenantSectionDto)` supplies the
exclusive target lock, draft eligibility, both expected-version checks and owner
writes/audit; `TenantRepository.rename` remains compatible with existing callers.
`TenantEditReceipts.inspect(tx,requestId)` serializes exact attempts and
`save(tx,receipt)` writes the immutable safe outcome. `DraftTenants.save` coordinates
these ports after `TransactionAuthority.validate` holds canonical operator authority.
No-op section saves also advance the configuration version and audit once.

P4-U1b-1 A-01–07 and the full normal graph passed within approved private
development on 2026-10-27 (+08:00); [final evidence](../status/p4-u1b-1-evidence.md).
