# Trunk credentials — development setup and replacement

P3-U3b implementation, October 23, 2026 (Asia/Manila +08:00).
Acceptance state is recorded in [the evidence](../status/p3-u3b-evidence.md).
These commands save desired credentials/settings only. They perform no PBX work.

The documented named administrator password is the protected host file
`/home/gino/.openbao-custodian/password`, mode 0600, owned by `gino`.
[Custody provenance](../status/p3-u3a-recovery-execution.md#fresh-password-custody-confirmed-and-operation-executed).
Keep the independently retained owner copy. Never paste credentials into chat.
Override the location with `MYIMS_CUSTODIAN_PASSWORD_FILE` when needed.

## Administrator migration and routine access

Review [the concrete migration](../../scripts/openbao/simple-trunk-access.mjs).
For the existing development installation:

```sh
./dev trunk-setup-access 58adb785-5384-41ce-9c72-ccda6ea554db
```

This command logs in as `platform-owner-custodian` with the protected password,
using existing verified TLS and native userpass authentication. It creates or
updates only `trunk-simple-<installation>` policy and token role when needed, then extends
`trunk-restricted-issuer` with one exact constrained issuance rule for that role.
It preserves all preexisting issuer rules and endpoint identities. Through the
existing fixed `platform-trunk-issuer` role it obtains a temporary issuer, issues
the setup token, and revokes the temporary issuer and human session. It does not
change the human account, auth mounts, endpoint policies, backups or bootstrap.

The setup token can read/create/update only the installation's existing trunk
KV namespace and set retention metadata there. It has no destruction grant.
Its protected file is `.local/trunk-setup/setup-<installation>.token`.
The request uses a nonrenewable 24-hour explicit maximum; lookup verifies the
actual lifetime is at least one hour and at most 24 hours before installation.
A shorter actual lease fails clearly rather than silently accepting mount
truncation. Configure mount limits through existing authorized administration
if necessary; this script does not change shared auth mounts.

Run the **same command** for routine token replacement. It verifies the new token
before replacing the file and revokes the prior known token. Unchanged policy/role
configuration is read and skipped; `configurationUpdates: 0` confirms routine
replacement made no policy changes. This path was verified after the approved
initial migration, with an actual 24-hour issued lifetime. No renewed bootstrap,
root recovery, owner attestation or worker pipeline is involved. Run one access
replacement at a time. The ordinary operator browser never needs this password
or token. Initial migration execution requires approval of these concrete policy
and token changes; the normal command is also available to run directly locally.
For this retained installation, that initial migration was explicitly approved and
applied on October 23, 2026. Imports and routine replacement use the installed
path above; they do not need another initial migration or an application approval
step. The verified replacement reported `configurationUpdates: 0`.

The first migration retains its original trunk issuer policy at
`.local/trunk-setup/issuer-policy-before-<installation>.json`. To roll back access,
revoke the known setup token through `auth/token/revoke-self`, then restore that
exact issuer policy through the same named administrator. Leave material and
metadata intact; no deletion is required. The new role/policy are inert after
revocation and removal of their issuance rule.

If issuance response is lost, the unknown short-lived token expires within the
24-hour explicit maximum; no material is written by access provisioning. A failed
human login is recoverable by correcting the password/path and rerunning. Missing
or expired setup access is corrected using this command. If `.token.new` remains
after an interruption, the helper reconciles that exact token before new issuance.

## Import material through one trusted command

Apply the additive SQL migration with `./dev migrate`. Create two **owner-only**
JSON files outside version control. Use an editor with appropriate custody; the
following examples contain placeholders only. `chmod 600` both files before use.
Generate the credential and operation UUIDs once using `uuidgen` or an equivalent
local UUID generator. Preserve the operation ID until the outcome is confirmed.

Configuration (`.local/trunk-setup/import.json`):

```json
{
  "installationId": "58adb785-5384-41ce-9c72-ccda6ea554db",
  "credentialId": "REPLACE_WITH_STABLE_UUID",
  "label": "Development provider",
  "operationId": "REPLACE_WITH_OPERATION_UUID",
  "expectedVersion": 0,
  "endpoint": "https://endpoint-secrets:8200",
  "caFile": "/trust/ca.crt",
  "tokenFile": "/setup/setup-58adb785-5384-41ce-9c72-ccda6ea554db.token"
}
```

Material (`.local/trunk-setup/material.json`):

```json
{
  "username": "REPLACE_LOCALLY",
  "password": "REPLACE_LOCALLY",
  "realm": "synthetic.invalid"
}
```

```sh
./dev trunk-credentials .local/trunk-setup/import.json .local/trunk-setup/material.json
```

Both inputs are checked through no-follow file descriptors, bounded reads and
owner-only file permissions. Material never enters argv, an environment value,
a PostgreSQL field/hash, normal logs, receipts or a browser response. The trusted
container alone joins the existing private database and provider networks; HTTP
and Next receive neither provider network access nor setup token mounts.
Remove or retain the material input under your established protected custody
after successful import; this command does not print or delete it.

The output confirms a stable ID, label, installation, purpose, actual KV material
version and operation ID. Actual token lifetime and a short-expiry warning are
nonsecret. Failed commands exit nonzero and cannot publish a selectable version.

## Replacement and recovery

For a replacement, keep the stable credential ID and label, supply new material,
choose a new operation UUID and set `expectedVersion` to the last confirmed KV
version. Run the same import command. The KV key is stable across replacements;
CAS rejects stale writes. Per-key retention is confirmed before material writes:
no timed deletion and maximum retained versions set to 2147483647. No cleanup or
destruction is scheduled. Never delete/destroy referenced material administratively.

After uncertain output or an interrupted material write, rerun with the **same
configuration, operation ID and material file**. Setup reads the exact provider
identity first. If the write succeeded, it confirms that version without writing
again. If it did not happen, CAS safely performs it. A conflicting provider
identity/material leaves the import pending; another operation cannot overwrite
it. The failure prints the pending operation ID. Inspect that exact protected
input and provider key using trusted administration before resuming. Never delete
the pending database row to bypass a genuinely uncertain write.

Authentication and pre-write failures are recoverable. No fresh proof, expiring
adoption session, reservation, generation ordinal or cleanup worker is required.
A confirmed old operation can be retried after later versions: it reads its exact
retained KV version. The command retains import receipts; it never retargets old
trunk selections.

## Operator workflow and availability

Open **PBX detail → Manage trunks and gateways → Create/Edit trunk**. Select
**Outbound digest**, then a credential label/version. Registration is optional;
choose **On (desired only)** and enter an explicit registrar host/IP and realm.
Timers are fixed at expiration 3600, retry 60 and forbidden retry 10 seconds.
Inbound-only digest and IP-peer plus registration/credential settings reject.

Reload credential choices after setup. Lists are bounded to 100 versions per
page with **More credentials**. Existing definitions retain their versions until
you select and save another version through a normal expected-version edit.
Missing/inactive/wrong-installation versions reject in the resource transaction.

Availability is administrator metadata: `sip_credentials.available` controls a
whole credential, and `sip_credential_versions.available` controls an exact version.
Existing trusted database administration may set those booleans in a transaction;
HTTP can read and lock both tables; a trigger rejects all runtime metadata updates. This does not destroy material or rewrite
existing selections. Desired enable and subsequent credential edits recheck
availability. Disabling/removing an existing trunk remains possible for recovery.

IP-peer requires no setup and continues to work independently. Desired enable,
digest and registration never mean connected, applied or voice-ready. Live apply,
actual registration, DIDs and tenant readiness belong to their later units.

## Focused real-provider acceptance

After access and schema setup, run the actual import-to-browser journey:

```sh
MYIMS_TRUNK_INSTALLATION_ID=58adb785-5384-41ce-9c72-ccda6ea554db ./dev exec pnpm check:trunk-gateways
```

The trusted launcher alone mounts setup access and read-only provider audit. It
runs the actual deployment command against real OpenBao and the isolated browser
database. The HTTP replicas and Next process receive only published metadata.
Owned synthetic KV versions remain retained. Missing/denied/retained expired
issuer access and provider unavailability fail before publication. A controlled
write-response loss proves exact reconciliation, competing-operation fencing and
retained replacement versions; the real browser selects and explicitly adopts them.
Without the installation variable, the focused browser suite uses SQL metadata
fixtures and a TLS simulator, which alone do not establish real-provider acceptance.
