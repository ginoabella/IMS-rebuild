# Trunk credential owner — private development

Owner: [P3-U3a-1](../../context/feature-specs/p3-u3a-1-isolated-trunk-credential-lifecycle.md)
and [P3-U3a](../../context/feature-specs/p3-u3a-protected-trunk-and-gateway-definitions.md).
Authority: approved [isolated lifecycle review](../planning/p3-u3a-openbao-trunk-credential-review.md)
and [conditional provisioning/profile approval](../planning/p3-u3a-provisioning-and-provider-profile-review.md).
Status: implementation incomplete, updated 2026-10-20 (Asia/Manila, +08:00).
The [approved completion direction](../planning/p3-u3a-approved-completion-direction.md)
authorizes independent local implementation; retained access/remediation remains
unapproved. Its conditional timing amendment is specified below. Provider provisioning,
verified root retirement/human succession and normal restoration executed once.
Endpoint regressions passed. Security acceptance is blocked by the
[token-lifetime finding](../planning/p3-u3a-token-lifetime-hardening-review.md).
No owner schema, HTTP binding or worker delivery is established yet.

The shared OpenBao server is retained. Separate `myims-trunk` KV-v2, installation
policies, importer/verifier/cleanup identities and custody must be established by
trusted deployment. Ordinary HTTP/Next/workers/observer/Asterisk have no trunk token.
A protected adapter exists in `trunk-openbao.ts`; it is not imported by any runtime
composition. No new listener, provider service or queue is introduced.

Exact material identity includes canonical installation, peer, binding, generation,
operation, positive generation ordinal, material version 1 and explicit purposes.
Each generation uses a derived immutable key, CAS=0 and exact version-1 reads.
Only protected importer memory receives username/password/exact realm. The initial
approved profile is synthetic outbound-request digest, no registration and no
carrier/PBX contact. No arbitrary provider path, wildcard realm, latest-version
selection or endpoint identity can substitute for the exact owner contract.

`TrunkSecretImporter.import` privately compares exact replay and rejects changed
material; uncertain effects require the same reservation/key and explicit resupply
or exact verification. `TrunkSecretVerifier.verify` returns `verified` or `missing`
from exact authorized reads, and finite sanitized errors for denied/unavailable/
invalid material. A 404 alone does not yet establish owner-level absence: pending
or uncertain operations still need canonical lifecycle reconciliation. Runtime
qualification expires after 60 seconds by database time once the owner is delivered.
The adapter does not create canonical attestations, associations or audit receipts.

`provisioning-plan.mjs` generates exact installation policies/token roles without
I/O. `provision-restricted-roles.mjs plan <manifest>` prints only non-secret role
configuration. Its separate `apply` path requires a mounted platform custodian,
rejects endpoint administration, preserves existing endpoint material policy text,
and prepares restricted roles/issuer tokens. It does not remediate/revoke the old
admin or declare isolation. Do not execute it on the retained server until required
custodian access or separately confirmed recovery and full preparation are ready.
The separate manual `recover-custodian.mjs` helper executed once under the explicit
authorization; recovered root was revoked and normal configuration restored.
It requires a recent operation-matched separate confirmation file and owner-only
container tmpfs. It cannot alter listeners/networks, initialize/unseal a server or
run automatically. The surrounding recovery/restoration procedure still requires
the user's explicit execution confirmation, now granted for one reviewed operation
only. The [execution checkpoint](../status/p3-u3a-recovery-execution.md) records the
resolved human-password prerequisite, passed real backup gate and verified
succession/restoration. The one-time authorization is consumed. A failed/uncertain recovery stops;
never rerun generation to conceal an unknown administrative token.

The plan's endpoint roles preserve worker create/read and cleanup read/metadata/
destroy capabilities. Trunk importer gets create/read, verifier gets read, cleanup
gets exact read/metadata/destroy. Writers get no update/patch/list/destroy. Issuers
can call only exact precreated token roles, never policy/role administration or
generic token creation. Real ACL tests must verify these restrictions, especially
forbidden/default policy requests, lifetime escalation and orphan-token behavior.
Pure plan assertions are not provider evidence. `issue-restricted-token.mjs`
uses only exact roles and verifies resulting policy/orphan/lease/max facts. The
endpoint provisioner has a prepared cutover path selected only by a separately
installed `/custody/issuer.token`; current custody now has that verified restricted issuer file. Its fixture
launcher can consume a reviewed fixed installation manifest so the issuer never
needs dynamic policy-editing rights. The acceptance-only one-second token has a
separate exact role with the existing endpoint worker policy and a one-second cap.
The separately authorized operation installed the approved policies/roles/issuers
and retired the exact old administrator policy; endpoint runtime rights were preserved.

The approved [custodian succession design](../planning/p3-u3a-custodian-succession-review.md)
prepares a named human `userpass` account, 15-minute maintenance sessions and two
fixed issuer-replacement roles. The user accepted personal custody of
`platform-owner-custodian`. Exact plan, gated setup and explicit human-session
helpers exist; native auth is installed and independently verified after root
revocation. The two restricted issuers and reviewed roles are installed.
Restricted lifecycle issuers still cannot maintain policies or installations.
Privileged configuration preflight now compares all expected policies/roles before
writes, preserves matches and rejects unexpected/unknown fields for separate
review. Whole-server privileged inventory, independent human/issuer identity and bounded
runtime issuance/forbidden-operation proofs passed; real trunk owner/import/HTTP
and cleanup-race acceptance remain outstanding. The detached deadline guard also protected the actual 27.04-second recovery
window and was cancelled after restoration; normal startup does not arm it.

The required 24-hour explicit maximum is not yet an accepted provider-enforced
guarantee: a caller override produced a 48-hour explicit maximum (24-hour initial
TTL). The exact test token was revoked. Complete-array constraints passed
disposable validation and are the approved hardening candidate; they remain
unapplied on the retained server. Retained changes require separate authorization.

Remaining local work, independently authorized: canonical owner schema/grants/functions, operation/intent history,
protected reserve/import commands, dedicated verifier, ordinary/endpoint queue
exclusion of trunk work, claim/adoption ports, explicit retirement/cleanup and all
real external acceptance. The common lock order, 60-second proof, 30-day results,
retained tombstones and never-associated cleanup bounds remain exactly as approved.
No endpoint tables/grants or runtime processes were changed by this preparation.

## Approved lifecycle direction — 2026-10-20

Keep 3,600-second initial runtime leases and the 86,400-second configured explicit
maximum. Policy generation and exact-body fixed-issuer preflight must agree on the
complete-array candidate; unknown bodies/authority still reject. Effective token,
entity/group, auth and issuance authority must be independently checked before
retained remediation. No trusted-administrator-proof server-wide cap is claimed.

Develop bounded same-token reconciliation and controlled replacement before maximum
expiry. Pause consumption on failed/uncertain renewal; HTTP 500 is never success
and never advances the local lease. Resume only with independently validated
remaining authority for the same token inside its original conservative deadline.
Reject expired/revoked/invalid authority. Replacement is validated before switching,
with bounded overlap and exact prior-token accounting. Retained issuance is gated.

Prove conservative pre/post-provider-call controls using immutable original issuance,
current lease, monotonic elapsed time, defensible clock bounds/margins and restart
revalidation. Clock uncertainty pauses the consumer. Prototype numerical settings
remain experimental. Provider 500 and measured expiry overruns remain documented
failures; conditional timing acceptance needs real consumer evidence and explicit
disposition. No control may authorize expired-token consumption.

### Conditional attestation timing — not accepted for runtime use

The owner approved in principle a completed, authorized provider verification
producing an attestation usable within its original 60-second freshness interval
even if that provider token subsequently expires. Expiry never restarts or extends
the attestation interval. It authorizes no further provider call. At database
transaction finalization independently revalidate current business authority, exact
owner, installation, credential generation, expected versions/epoch, eligibility,
replay protection and freshness against database time. Preserve the approved lock
order and atomic association/history/audit. Failed, late or uncertain verification
cannot establish proof; unknown/expired/invalidated proof fails closed.

This amendment is conditional pending implementation and real transaction/failure
acceptance, including verification-before-expiry/finalization-after-expiry within
freshness, stale proof, authority invalidation, wrong identity/generation, replay,
response loss and rollback. No runtime activation is authorized by this text.
The [completion plan](../planning/p3-u3a-approved-completion-direction.md) defines
the matrix and separate local/retained/end-to-end/production boundaries.
