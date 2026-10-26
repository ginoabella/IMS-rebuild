# Review, apply and recover PBX revisions

P3-U5b is complete within approved private development. The private live profile
is active with an independently verified initial baseline; focused, affected and
normal checks, refresh and owned cleanup passed. A new installation must pass
the same mandatory gates before activation. This establishes no tenant calling readiness.
See the [approved policies](../planning/p3-u5b-live-policy-review.md).

## Capture and review

Open **PBX nodes → PBX detail → Configuration revisions**. Capture desired state
and inspect its immutable source versions, affected resources, exact credential
references and semantic changes. Historical comparison and comparison against the
actual verified runtime are separate. Desired edits require a fresh capture.

Select **Validate offline**. Passing establishes structural validity only; live
validation, exact material, eligibility and independent runtime verification remain
separate gates. Unbound/unallocated stock and ordinary ingress remain denied.

For a lost capture response, use **Recover capture receipt** and, if necessary,
**Retry exact capture**. Keep the same request and comparison baseline until its
outcome is resolved. Same-operator reauthentication restores retained mounted work;
a full refresh recovers canonical revision history rather than browser memory.

## Apply and observe

When the protected executor has a fresh heartbeat and verified initial baseline,
review the runtime comparison and explicitly confirm that exact baseline before
applying. Acceptance commits the operation, actor audit, dependency pins and durable
intent together. The current fenced telephony owner executes it independently of
the browser session. Closing the page does not cancel accepted work.

Read validation, installation, verification and recovery separately. Installed or
reload-acknowledged does not mean verified. Known-good changes only after exact
artifact provenance, loaded resources/profile/auth/dialplan and approved probes
pass. Passive status refresh does not renew the login or authorize another write.
A stale baseline requires a new canonical review; the console never substitutes it.

A lost apply response retains the exact request and operation identity. Recover
its receipt, reauthenticate as the same operator if prompted, and reload canonical
status before retrying. Another identity cannot inherit that retained request.
Finite blockers identify stale review, missing material, lost authority, activity,
missing executor or recovery uncertainty without disclosing material or paths.

## Calls, failures and recovery

The whole node is affected. Complete channel counts must be at most two seconds
old. A busy node waits up to 120 seconds with admission open. The native barrier
then closes ordinary signaling, rechecks activity, and remains closed through
selection, verification and any restoration. A call racing the final zero check
reopens the untouched barrier and retries the quiet window. Unknown activity denies
mutation. No forced hangup is part of this workflow.

Pre-install rejection leaves runtime untouched. Failure after selection restores
the previous verified complete set, runs the same fixed reloads, and independently
verifies recovery. Desired edits and immutable history remain available. An explicit
operator recovery targets a retained known-good artifact under the same fences and
activity policy.

Unknown/failed recovery retains the barrier, predecessor, both artifact sets and
resource/material pins, denies readiness and blocks conflicting work. Restore
connectivity and use the explicit audited reconciliation control for that exact
predecessor. The native boundary inspects installed and runtime facts before any
retry; it never blindly replays a candidate reload. A new SQL owner cannot cross a
still-running old command's physical lock. Do not restart Asterisk, remove the
journal/barrier, delete artifacts or release pins to clear an unknown state.

## Protected installation and access

The approved physical operations are complete managed include validation, atomic
set selection, `module reload res_pjsip.so`, `dialplan reload` and bounded passive
inventory/dialplan/channel queries. No browser or worker accepts command strings,
paths or secret-bearing artifacts. Unmanaged configuration is preserved.

`./dev pbx-live-prepare INSTALLATION_UUID` performs trusted, explicit preparation
for the existing catalog node: scoped SQL executor configuration, exact read-only
provider consumer access, protected includes and management configuration. It does
not activate the live profile. The provider token lives in the private
`pbx-live-consumer` Docker volume, mounted only into telephony. Native Asterisk gets
scoped SQL credentials and exact staged material, never a provider token. Next,
HTTP and ordinary workers receive neither consumer custody nor the provider network.
The runtime has no Docker socket or host networking.

The opt-in [Compose override](../../infra/docker/compose.pbx-live.yaml) adds
nftables/NET_ADMIN only within the existing private Asterisk network namespace.
The native helper owns a process-lifetime file lock; every dispatched reload
inherits its guardian lock until actual CLI completion, even after helper death.
Helper restart preserves the PBX process. A read-only TLS AMI gateway permits only
Login/Logoff/Ping/PJSIPShowEndpoints/PJSIPShowContacts; direct management is loopback
only, with Asterisk TLS/web management disabled.

After preparation and the supported focused checks pass, run the read-only
`check-pbx-live-preflight.mjs` through the trusted setup launcher. Stop if activity,
resources, permissions or preservation facts are unknown. For this approved existing
installation, activate the override by creating the owner-only
`.local/pbx-live/enabled` marker, then recreate only Asterisk and the two telephony
replicas with the base, observation and live Compose files. Set `MYIMS_PBX_UID` and
`MYIMS_PBX_GID` to the actual consumer identity (1000:1000 here); retain the existing
replica count and private networks. Do not recreate databases, consumer/artifact
volumes or credentials. Recheck capabilities, custody, the independently verified
initial baseline and complete observation before accepting apply. This activation
step affects the whole PBX and requires the approved zero-call maintenance window.

Routine read-only provider access replacement uses the same installation-scoped
`./dev pbx-live-prepare INSTALLATION_UUID` path and existing custodian. Check its
24-hour nonrenewable lifetime and zero policy updates; verify custody afterward.
When replacing the separate endpoint fixture issuer, pass
`--live-installation INSTALLATION_UUID` to `issue-lifecycle-issuer.mjs endpoint
/manifest.json` so its exact preflight includes this approved issuance rule. It
still rejects unrelated grants and performs no policy changes.
Expired access denies new material resolution. Retained verified artifacts permit
recovery without resolving a newer provider version. Never copy the token into the
workspace or Asterisk to work around an outage.

Initial baseline capture requires actual zero managed resources and default-deny
facts. Existing managed resources or uncertain facts fail closed. Retain baseline,
known-good sets and exact credential versions while referenced. Desired replacement
does not release an older runtime dependency. Structural/removal paths use the same
node lock and typed runtime dependency guard. Credential destruction and phone
delivery are outside this approval.

## Reproduce checks and clean up

Run `./dev exec pnpm check:pbx-revisions` for compiler/protected-boundary contracts,
disposable real Asterisk, PostgreSQL ownership/worker/native socket and failure
checks, actual HTTPS/two-replica browser acceptance and custody isolation. Fixtures
use private namespaces and synthetic destinations, with at most 20 calls per run,
two concurrent calls, ten seconds per call and five minutes total. They never dial
public, paid, emergency or tenant destinations. Disposable fixtures require root/NET_ADMIN plus Docker orchestration and SQL
fixture administration. The retained native helper has the approved root/NET_ADMIN
and scoped executor role; HTTP/Next/ordinary workers receive none of those grants.

The retained-version provider fixture reuses existing confirmed canonical versions
1/2 through the private GET-only consumer and disposable SQL/native services. It
makes no provider writes, access issuance or policy changes; old/new pins and
rollback are checked against actual loaded auth. It removes only owned SQL,
containers and socket/directory fixtures. The separate existing inventory credential
regression creates/resets synthetic material and destroys run-owned disposable
records, so it requires separate authorization under U5-04. Never use test cleanup
to remove retained artifact/consumer volumes or another run's resources.

Run the affected routing, trunk/gateway, inventory, PBX, auth/durable suites and
`./dev check` before completion. Acceptance evidence must distinguish disposable
fixture results from retained-profile activation and production readiness. See the
[dependency/compiler contract](../architecture/pbx-revisions.md) and
[required B-01–08 results](../../context/feature-specs/p3-u5b-fenced-live-apply-and-verified-recovery.md).
