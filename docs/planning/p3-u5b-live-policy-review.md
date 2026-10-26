# P3-U5b live policy review

Prepared October 25, 2026 (Asia/Manila, +08:00). **Approved for controlled private development.**
The owner explicitly approved all five recommended policies in chat on October 25,
2026 (Asia/Manila, +08:00) and requested implementation to continue. This approves
the scoped access/setup described below; it establishes no B-01–08 acceptance result.
The [parent decisions U5-01–05](../../context/feature-specs/p3-u5-configuration-revisions-apply-and-recovery.md#decisions-required-before-dependent-implementation)
remain authoritative; the approval is recorded there.

## Existing boundary

The current Compose Asterisk is `myims-rebuild-dev-asterisk-1`, pinned to
Asterisk 22.10.1, running as `asterisk`, with read-only `/etc/asterisk` bootstrap
configuration and loopback-published SIP/RTP ports. The existing telephony process
uses UID/GID 1002 by default; it has an observation adapter, not a mutation adapter.
The deployment catalog identifies the canonical installation/node; acceptance
must resolve and cross-check that mapping rather than infer it from a container name.

The bootstrap contains no tenant endpoints or trunks, defaults to hangup, and has
an isolated PJSIP fixture include at `/tmp/myims-pbx-fixture.conf`. Prior acceptance
uses trusted Docker execution and `module reload res_pjsip.so`; it is not a runtime
control grant or proof of mutation-boundary fencing. The module allowlist also
needs validation against the proposed live routing/probe requirements.

Sources: [Compose](../../infra/docker/compose.yaml),
[bootstrap](../../infra/asterisk/bootstrap/pjsip.conf),
[existing fixture](../../scripts/inventory-pbx-acceptance.mjs),
[ownership limitation](../architecture/pbx-observation.md#p3-u5-and-c-handoff).

## Approved owner decisions

| Decision | Recommended private-development scope |
| --- | --- |
| U5-01 — installation and commands | Use only the existing controlled development installation. Permit deployment setup of a dedicated protected managed include directory and fixed PJSIP/dialplan includes, preserving unmanaged files. Permit complete-set staging, isolated validation using the pinned Asterisk image, atomic selection, fixed `module reload res_pjsip.so` and `dialplan reload`, and the same operations for recovery. Permit bounded passive runtime inventory, dialplan and channel queries. No arbitrary shell/CLI/AMI input, broad `core reload`, restart as routine recovery, or runtime Docker socket. |
| U5-02 — activity | Treat the entire node as affected. Wait at most 120 seconds for a quiet window; activity observations must be complete and at most two seconds old. Unknown/stale state defers and expiry blocks. Require an enforced admission barrier before the final zero-call check and retain it through installation, reload and verification/recovery. No forced hangup. Failed or uncertain recovery retains the barrier and pins until audited reconciliation; the operator sees the interruption explicitly. |
| U5-03 — probes | Permit disposable synthetic SIP peers and local test contexts only, on the private development network, with exact generated identities and an explicit per-run allowlist. At most 20 synthetic calls per acceptance run, at most two concurrent, at most ten seconds each, and a five-minute run deadline. No public/emergency/paid-trunk destination or tenant traffic. Preserve existing fixtures and remove only run-owned fixtures after verified restoration. Passive queries originate no traffic; synthetic route probes do. |
| U5-04 — material | Permit a separate read-only installation-scoped exact-version consumer in the telephony execution boundary. It may read only canonical referenced endpoint generations and actual trunk KV versions from existing mounts; no create/update/delete/destroy/list or custody access. Issue its access separately from existing endpoint writers and trunk administration. Keep provider tokens out of Asterisk and HTTP/Next/ordinary workers. Retain all referenced material and protected recovery sets; exclude phone delivery and credential destruction. |
| U5-05 — eligibility | Deploy deny-by-default infrastructure only. Unallocated inventory and unbound routes remain calling-ineligible. Permit separately identified disposable fixtures to demonstrate actual endpoint authentication and inbound/outbound/group/reservation behavior, including negative probes, without synthesizing production tenant bindings, readiness or operational attribution. |

The owner approved the timing and budgets above together with U5-01–05. Any concrete provider ACL/token issuance must remain within the approved
read-only scope and existing protected administration/custody path.

## Mandatory implementation gates after a decision

Approval of the scope above does not prove the mechanisms work. Before enabling
live apply, implementation and acceptance must establish all of the following:

1. A protected mutation boundary authenticates canonical node, monotonic owner
   epoch and exact operation/revision identity. It serializes takeover with already
   dispatched/executing commands and rejects stale, duplicate and out-of-order
   commands. A SQL pre-check, fixture lock or cancellation token alone fails this gate.
2. The admission barrier excludes new affected calls, including check-to-effect
   races and every supported ingress/origination path. Synthetic probes have their
   own bounded allowance while ordinary admission remains denied. If this cannot
   be enforced within approved permissions, keep live apply unavailable and report
   the concrete missing permission before expanding access.
3. Capture and independently verify the initial recoverable baseline: complete
   protected artifacts, unmanaged-file preservation, runtime objects/dialplan,
   deny behavior and canonical installation identity. Do not classify an arbitrary
   filesystem capture or successful reload as verified.
4. Prove validation of the entire staged artifact set before selection using the
   pinned parser/runtime with isolated network and material protection. Unsupported
   modules/settings fail explicitly. No successful validation may mutate the live set.
5. Verify exact artifact/runtime provenance and controlled positive/negative route
   results before promotion. Exercise automatic and operator recovery, including
   failed/unknown recovery with retained dependencies and blocked conflicting work.
6. Publish the actual fixed execution/access profile, exact provider ACLs, runtime
   file ownership/modes, baseline/recovery procedure and scoped evidence. Validate
   file permissions against the actual container identities rather than assuming
   that numeric IDs match across containers.

## Approval and implementation state

At approval, only repository inspection/preparation had occurred; no acceptance
was implied. Implementation has since added and verified the scoped native/SQL/
HTTPS paths recorded in the progress tracker. The dedicated read-only provider
policy/token, private consumer volume and additive schema are prepared. Retained
PBX activation passed the mandatory mechanism gates on October 25 (+08:00), with
an independently verified initial baseline. Final B-01–08 regression/refresh
acceptance passed on October 26 (+08:00); a new activation must pass the same gates.

## Approved admission capability addendum

On October 25, 2026 (Asia/Manila, +08:00), the read-only retained-PBX preflight
reported `networkAdministration: false`, `nftAvailable: false`, and netfilter read
errno `-1` (EPERM). The owner explicitly approved “Approve scoped nftables +
NET_ADMIN” in response to the prepared opt-in Dockerfile/Compose patch. This
authorizes nftables and NET_ADMIN in the existing private-development Asterisk
container only; host networking and Docker socket access remain excluded.
Live apply still requires actual fencing, admission and recovery proof.

## Real-provider acceptance resolution

The retained desired node had no associated endpoint generation or trunk reference.
An initial proposal would have created two synthetic material versions; automatic
approval review rejected those provider writes as outside the read-only consumer
approval. That proposal was not executed and its unused writer/access scripts were
removed. No approval for it is needed to proceed.

A metadata-only primary query found existing confirmed, available canonical versions
1 and 2. The replacement fixture copies only their safe identity/version/import
metadata into a new owned SQL database and creates immutable desired references.
The approved GET-only consumer read both exact versions, rejected a missing version
and foreign installation, and then used the actual renewed owner/private socket to
apply both to disposable Asterisk. Loaded auth was independently checked; both pins
survived replacement and explicit rollback verified retained version 1 without
another provider resolution. This passed with no provider writes, token issuance,
policy changes, token in Asterisk, registration or calls. Owned SQL/container/socket
fixtures were removed. See the [retained-version fixture](../../scripts/pbx-live-retained-provider-fixture.mjs).

The parent-required existing inventory credential regression needed a separate
approval: its established synthetic lifecycle tests create/reset material and destroy
only run-owned disposable records. U5-04 excludes destruction without separate
permission. The owner explicitly approved that existing synthetic regression and cleanup on
October 26, 2026 (Asia/Manila, +08:00). It may now run within those existing test
roles and run-owned records. The new live implementation does not gain material-write/destruction permissions.

The owner also approved the earlier isolated two-version writer proposal on
October 26, 2026 (+08:00). That proposal had already been superseded by successful
retained-version consumption; its unused scripts remain removed and it will not
be recreated or executed merely because permission is now available. These test
approvals do not grant material writes or destruction to the live consumer.
