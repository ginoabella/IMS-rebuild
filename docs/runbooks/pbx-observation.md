# Local PBX observation operations

Scope: [contract](../architecture/pbx-observation.md),
[conditional development approval](../planning/p3-u1b-observation-contract-review.md),
[P3-U1b requirement](../../context/feature-specs/p3-u1b-fenced-asterisk-observation-and-recovery.md).
Production observation is not approved. The upstream observer `system` account
is broader than the application's read-only allowlist.

## Provision and start

Run from the repository host with the existing Docker workspace/shared services:

```sh
./dev pbx-observation-prepare
./dev telephony-up 2
```

The trusted preparer creates ignored `.local/pbx-observation/server` and `runtime`
material with protected ownership/modes. It generates a private development CA,
service-name leaf and dedicated observer account; preserves existing material
unless rotation is requested; creates the `enabled` marker; activates the explicit
local Compose overlay; recreates only controlled Asterisk and refreshes approved
catalog addresses without changing installation identity. No management port is
published. Plaintext AMI binds only inside the Asterisk container's loopback and
HTTP/ARI stays disabled. Its scoped development logger retains warnings/errors and excludes AMI notice messages that contain authentication identifiers; production monitoring needs separate review. Never reveal the protected files in logs or chat.

After first provisioning, apply the workspace credential mask by recreating its
container. This stops processes running inside that development workspace; restart
any previously running development HTTPS supervisor using its own runbook.
The ordinary backend container remains separate. The preparer performs
this mask application before any observation check or runtime start.

`telephony-up` builds through the trusted workspace, applies deployment migrations
and starts independent telephony containers with the host's non-root UID/GID.
They receive runtime PostgreSQL access and only the observer credential/CA;
HTTP and ordinary workers receive neither. Registry records must already exist
through the protected registry API. Observers discover committed records; saving
one does not itself connect from HTTP. No UI is delivered by b.

```sh
./dev telephony-down
```

SIGTERM cancels I/O, conditionally releases matching generations and drains for
5 seconds (container grace 6 seconds). Leases expire by database time if a process
cannot release. Restart creates a new process incarnation/epoch and reconciles.
Never delete/reset ownership epoch rows to recover.

## Rotation and destination changes

```sh
./dev pbx-observation-prepare --rotate
```

Trusted provisioning replaces the observer credential atomically, updates the
controlled account and recreates Asterisk to activate its protected file mount.
Connected observers cancel/reconnect and require a complete new snapshot. Each
connect rereads provider material; the normal reconnect ceiling is 60 seconds.
Installation UUID stays stable. Refresh `./dev pbx-catalog-prepare` after trusted
address changes; old addresses fail closed until process/catalog refresh.
Restart telephony after changing catalog/trust configuration. Do not widen
address permissions or management exposure as a recovery shortcut.

## Verification

```sh
./dev exec pnpm check:pbx-nodes --observation
./dev exec pnpm check:pbx-nodes --registry
./dev exec pnpm check:pbx-nodes --browser
./dev exec pnpm check:pbx-nodes
./dev exec pnpm check:durability
./dev exec pnpm check:entrypoints
./dev check
```

Observation uses the trusted deployment launcher, disposable PostgreSQL/runtime
grants and isolated session Redis, protected HTTP, independent telephony child
processes, and the actual controlled Asterisk installation. It installs only a
uniquely named no-call PJSIP endpoint/auth/AOR through the exact temporary file
`/tmp/myims-pbx-fixture.conf`, uses private SIP REGISTER/expiry-zero clients and
removes the exact fixture. It temporarily rotates only the controlled observer
account and restores its provisioned credential. It never calls the observer
adapter with a mutating action. Trusted fixture reload/restart/account operations
are distinct from the shipped application action allowlist.

The launcher restores the controlled credential, clears/reloads/removes its exact
fixture file, removes its exact named Redis container/volume and host temporary
directory. The database harness closes children/proxies and drops its uniquely
named database. Each observer fixture closes sessions and removes its private
`/tmp/myims-observer-process-*` directory. Production-installed development
trust/observer files, catalog UUID and persistent shared-service volumes remain.

Failures must retain their exact fixture names for cleanup; never use broad
container/volume/database deletion. Check the linked evidence for actual names
and cleanup results. Synthetic second targets prove only ownership/isolation;
one controlled installation does not establish live multi-PBX HA/capacity.
Ordering/response-loss/failure controls are explicitly injected evidence.

## Diagnostics and recovery

Inspect finite startup states and safe transaction/observation diagnostics through
container logs. The protected API separates saved desired version from current,
stale, historical and unknown observations; registration coverage never means
ready for calling. Passive HTTP reads do not renew user sessions.

For secret failures, restore protected provider access through trusted provisioning.
For destination/TLS failures, verify approved catalog/trust and address refresh.
For lease/database loss, restore backing access and allow reacquisition/reconciliation;
do not restore old process memory or reuse epochs. Complete empty snapshots remove
obsolete facts; partial/errors remain historical. No external apply/reload/control
recovery command exists in the application. c owns browser presentation; P3-U5
owns live apply/revision ordering and PBX-side stale-owner enforcement.

The c browser selection reuses this trusted launcher with real secure platform
sign-in, independent HTTP/telephony processes and precise no-call fixtures. See
the [operator guide](pbx-operator-guide.md) and [browser evidence](../status/p3-u1c-evidence.md).
