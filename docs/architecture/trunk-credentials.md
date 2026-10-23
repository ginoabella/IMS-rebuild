# Simple trunk credentials

P3-U3b follows the [replacement contract](../../context/feature-specs/p3-u3b-simple-trunk-credentials.md).
See [acceptance state](../status/p3-u3b-evidence.md) and
[commands/custody/recovery](../runbooks/trunk-credentials.md).

The trusted deployment `trunk-credentials` command stores material in existing
OpenBao KV v2 at `myims-trunk/data/installations/<installation>/bindings/<id>/generations/<id>`.
This stable key uses actual KV versioning. The repeated UUID is a namespace segment,
not an application generation ordinal. Existing endpoint/trunk material is preserved.

PostgreSQL owns `sip_credentials` (stable installation-qualified ID/label/purpose
and administrative availability), `sip_credential_versions` (confirmed actual KV
version and availability) and `sip_credential_imports` (operation ID, expected
version and pending/confirmed outcome). Pending imports do not join selectable
versions. No material or material hash is persisted outside OpenBao and protected
local input files. The private trusted command uses deployment database credentials;
HTTP can only read/lock credential/version metadata and cannot read imports or material. Protected identity-column grants allow row locks; triggers reject every actual runtime metadata update.

A credential-scoped PostgreSQL session lock serializes trusted imports. Setup checks
provider access and retention before durable material intent. Before provider CAS
it commits the exact operation ID/expected version. The provider envelope includes
that identity. Setup confirms exact provider identity, material and actual version
before atomically publishing version metadata/confirming the import. Response loss
leaves a durable fence that resumes through the same command and operation ID.
Definite pre-write failures are recoverable; no new import can overwrite a genuinely
uncertain earlier one. Old operation retries read their exact retained version.

The existing peer API gains passive protected
`GET /platform/pbx-nodes/:nodeId/peers/trunks/credentials/selections`, with at most
100 safe versions and a composite `after=<credential UUID>:<version>` cursor.
Only that node's installation is returned. The Next boundary strictly checks safe
metadata shapes. HTTP/Next gain no provider adapter, token, mount or material access.

`PeerSettings.authentication` supports `ip-peer` or `outbound-digest`. Digest requires
`credential: {id, version}` and outbound/both direction. Optional desired registration
requires explicit registrar/realm and fixed 3600/60/10 timers. IP-peer JSON remains
compatible and excludes credential/registration. SQL checks reject incompatible
shapes; a database trigger plus normal repository transaction verifies installation,
purpose and credential/version availability. Metadata locks serialize administration
with resource selection. Desired enable also rechecks current availability.

Normal expected-version edits adopt replacements; creates retain ordinary
idempotency receipts. Other definitions and old KV versions stay unchanged. Per-key
retention excludes timed deletion and automatic pruning within the integer version
range. There is no destructive worker, owner attestation or separate adoption flow.
Resource writes retain existing actor audit and cause no DNS, PBX or registration
activity. The existing unfinished lifecycle tables/workers remain inactive and intact.

The concrete native administrator migration creates a scoped `trunk-simple-*`
service role and extends only the retained trunk issuer's exact-role issuance ACL.
Routine replacement uses the named password login and that same command. It requests
24 hours and verifies actual issued lifetime against the effective provider limits;
no token renewal certification is required. Shared auth mounts, endpoint roles,
backups and the human account are preserved. Execution requires approval of the
concrete initial policy/token changes; production readiness remains separate.
