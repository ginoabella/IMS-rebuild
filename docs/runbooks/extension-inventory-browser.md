# Inventory browser and controlled acceptance

Open the private secure platform console, choose **PBX nodes**, inspect the
canonical node and select **Manage extension inventory**. Create compatible
node-scoped SIP/WebRTC profiles, select their explicit versions, then create an
individual number or preview/commit up to 50 canonical bulk numbers. New stock
is available/unallocated and desired disabled. Desired enablement, profile
adoption and credential setup/reset neither install endpoints nor activate calls.

Inspect an extension to compare immutable number/node identity, selected profile
version, desired status/version, safe credentials, ownership and independent
registration/freshness. Versioning a shared profile leaves existing extensions
pinned. Explicit adoption submits the reviewed extension/dependency versions.
Reload and compare after conflicts; preserved input never authorizes overwriting
newer canonical state. Bulk preview is advisory; commit revalidates the entire set.

An uncertain create/profile/bulk/credential result locks its exact intent. Restore
access and explicitly retry the same intent, or inspect canonical list/detail and
all relevant pages before releasing it. An uncertain edit requires canonical
reload/review. Credential status is safe metadata only; queued work is not
configured material, and configured desired material awaits future live apply.
Old runtime passwords and registered phones remain unaffected by desired reset
or disable. Queued work requires the approved dedicated credential worker; HTTP
and the browser cannot resolve material. Escalate provider access, material-health
or compatibility failures to the deployment owner using the
[credential worker runbook](endpoint-credentials.md); do not create a replacement
intent to bypass an uncertain operation. Same-operator sign-in restores mounted non-secret work; foreign login,
confirmed logout and full refresh discard it. No durable drafts are promised.

## Commands and target safety

```sh
./dev exec pnpm check:extension-inventory --browser
./dev exec pnpm check:extension-inventory
```

The browser selection uses the existing approved private Asterisk installation,
disposable PostgreSQL/runtime grants, isolated shared-session Redis, independent
production HTTP A/B, actual secure Next browser and b's isolated credential worker.
The combined command runs inventory, real-provider credentials and browser checks
sequentially. Required owner regressions and full `./dev check` remain required
separately; command existence alone is not an acceptance pass.

Before any reload/stop/start, the trusted launcher verifies the target's original
running state, no conflicting fixture container, an absent fixture include, an
exclusive target lock and zero active calls/channels. It captures safe object
identities, configuration/routing digests and runtime version in an owner-only
`.local/p3-u2c-runs/<runId>/recovery.json`. The no-call context must have no dialplan.
Generated-namespace collisions stop dependent acceptance without adoption/removal.
The launcher's exact owned fixture keys derive from disposable API inventory
identities on the retained canonical installation. Saving is checked before
fixture installation. Temporary independent random SIP authentication is isolated
from HTTP, browser and provider material. Fixture `remove_existing=no` does not
change the selected desired profile. No dialplan entries or calls are created.

Actual REGISTER/expiry-zero observations and one bounded real stop/start are
reported separately from injected database projection/response-loss faults.
Fixtures prove dynamic-contact mapping only. They prove no production provisioning,
WebRTC signaling/media, desired credential application or tenant readiness.

## Recovery and cleanup

On normal/failure exit, unregister owned contacts and stop observer/test processes;
verify the owned include hash before changing it, remove only owned sections,
reload, remove the owned empty include, then compare exact object identities and
configuration/routing digests against the baseline. Verify the original running
state before releasing the lock. A failed comparison retains the protected
manifest and lock and stops dependent acceptance. Do not delete unknown objects.

If interrupted, read the exact run manifest through trusted deployment access.
Confirm exclusive access and zero calls again. Restore the prior running state,
inspect lock ownership and the include against the recorded owned key set, remove
only proven owned fixture sections, reload PJSIP and verify baseline digests and
owned-object absence. If ownership or restoration is uncertain, preserve all
recovery information and escalate to the deployment owner. Never force a passing
result by replacing existing configuration or choosing new identities.

Provider fixtures use the established b worker/generation teardown. Private
`.local/endpoint-fixtures/` manifests retain exact safe generation accounting.
All acceptance fixture access tokens are revoked and local token files removed; scoped
policy definitions and destroyed-generation metadata are retained as recovery
history under b's existing retention boundary, without usable tokens/material.
No policy deletion permission is added. Disposable databases, Redis containers/
volumes, children and private temporary files belong solely to the acceptance run.
Verify ordinary backend/HTTPS health after cleanup. Published evidence contains
safe identities, commands and finite outcomes only.

Required PBX `--observation`/`--browser` regressions now use the same exclusive
baseline/include/restoration guard. Under the latest preservation condition,
observation authentication recovery uses wrong/missing private fixture credentials
then the unchanged existing account; it does not overwrite `manager.conf` or
repeat account rotation. Earlier actual rotation evidence remains with P3-U1b.
This changes trusted regression controls only; observer/HTTP permissions and
product behavior are unchanged.
