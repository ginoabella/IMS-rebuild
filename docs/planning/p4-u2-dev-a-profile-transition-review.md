# P4-U2-DEV-a retained profile transition review

Prepared 2026-11-07 (Asia/Manila, +08:00). **DEV-01 strategy and conditional maintenance effects approved by the user in this session.**
The implemented commands provide passive inspection, isolated compatibility and
durable transition/restart/reconciliation. Integrated isolated verification is in
progress; the transition is not deployed. Approval permits ordinary maintenance
effects only after the remaining durable-transition and recovery rehearsals pass.
No retained effects have occurred.

## Exact observed target and comparison

The [preflight ledger](../status/p4-u2-dev-a-preflight.json) and
[expected identities](../status/p4-u2-dev-a-expectations.json) identify the retained
node/installation, initial baseline, current artifact, compiler/policy and unmanaged
digest. These are review inputs, never constants in business logic. Reinspect them
before any later deployment. Native/canonical/runtime epoch was `11`, routing
generation `1`, with zero channels and no pending revision, retirement or test.
Both required artifacts have protected bytes and compatible current profile;
20 unreleased pins remain, with no material-bearing credential pins.

| Behavior         | User-tested reference                                           | Current retained                                                        | Proposed transition                                                 |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Module policy    | Autoload enabled; native RTP bridge excluded                    | Explicit allowlist, autoload disabled                                   | Keep allowlist; add six explicit modules below                      |
| Media            | `direct_media=no`; native bridge excluded                       | Native bridge absent; renderer anchors media                            | Preserve anchored media; no native RTP bridge load                  |
| RTP              | 10000–10100; strict RTP disabled                                | 10020–10039; no explicit strict RTP override                            | Keep range and strict RTP behavior; retain existing publication     |
| SIP              | UDP and WS                                                      | UDP                                                                     | Preserve UDP; WebRTC remains outside this unit                      |
| External address | Placeholder settings in reference                               | No external address configured                                          | Preserve current topology; copy no placeholders or addresses        |
| NAT              | Symmetric RTP/rport; contact rewriting varies by endpoint/trunk | Generated endpoint/trunk policy, independently checked by native driver | Preserve endpoint/trunk differences; no global rewrite rule         |
| Routes/accounts  | Reference has local/gateway/public paths and credentials        | Generated deny-unbound runtime                                          | Copy none; later tenant paths require canonical ownership/admission |

Add only `bridge_simple`, `res_speech`, `res_agi`, `func_channel`,
`res_pjsip_header_funcs` and `res_pjsip_endpoint_identifier_ip`. Preserve every
other `.conf` byte. These are the missing explicit loads on the exact observed
profile, not a policy to turn on arbitrary missing modules on another profile.
The reference remains unchanged, with its nine-file digest manifest in the ledger.
The tested isolated new unmanaged digest is
`f3b7d794d9507250c7a532b3d06fc373c378cc864023f92cb8ad106874ebeca8`.
This digest is a compatibility-copy result, not an installed canonical artifact.

## Compatibility result and its limit

`./dev pbx-profile rehearse-compatibility docs/status/p4-u2-dev-a-expectations.json`
uses a private Docker copy, `--network none`, no published ports, no database or
provider mount, and no retained writable volumes. Exact configuration/control/
managed bytes move through an in-memory tar stream, never a workspace archive.
Asterisk starts four times: original pair, changed modules, new rendered artifact,
and restored original pair. Actual loaded module checks and independent native
protected/loaded verification passed. The old artifact rejects under the changed
static digest, as required. The original baseline, baseline proof, native journal
and historical plan bytes remain identical. All copied material and anonymous
volumes are removed with the disposable container.

This proves static/module and artifact-pair compatibility for the current
material-free retained snapshot. It **does not** prove a durable transition,
canonical acknowledgement, interruption handling, provider custody, active-call
fencing/races, or tenant SIP/RTP readiness. The fixture refuses snapshots requiring
endpoint/trunk material. The existing revision regression suite's process-loss
proofs apply to revision operations; they cannot substitute for profile-transition
interruption acceptance.

## Adopted durable mechanism

Preserve the canonical node/installation and all immutable artifacts, original
baseline facts, pins and credential generations. Add protected, immutable complete
static profiles in the existing native data volume, addressed by their exact
unmanaged digest. Preserve original static bytes under the old digest before any
selection. Store separate append-only profile/artifact compatibility associations;
never rewrite an old artifact's plan, digest, compiler or policy. A new compatible
artifact needs a new identity and provenance, even when desired semantics match.

Use the existing trusted deployment entry point, canonical audit transaction,
node/observation/ownership/runtime lock order and native physical serial queue.
A committed profile intent must exclude apply, recovery and retirement acceptance,
and all those paths must check the same durable pending profile barrier. A SQL
lease or host Docker operation alone is insufficient physical fencing.

The fixed supervisor must select a complete protected configuration directory and
its compatible managed artifact, then perform an authorized quiet restart. The
existing individual read-only `.conf` mounts cannot be edited as the selection
mechanism. Moving to directory selection therefore needs an explicit reviewed
bootstrap step. A derived launcher configuration may locate the selected directory;
it must not change the bytes hashed as an old static profile. Native verification
must inspect the actual selected directory and actual process configuration,
never assume `/etc/asterisk` still represents the loaded profile.

Before effects: close admission, wait naturally for quiet, check actual channel and
pending/unknown state, recheck owner/authority/expected profile and custody, then
persist uncertainty. Defer active or unknown calls; never hang up calls, clear pins,
rotate credentials or prune history. Selection and restart must run under the same
physical owner/guardian contract as existing effects. Restart cannot release the
fence or let startup mark a pending operation verified.

| Durable boundary                             | Required successor behavior                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Intent committed; no selection               | Inspect exact operation and selected old pair; no automatic candidate replay                                                                    |
| Selection persisted; restart unknown         | Inspect process/configuration and both protected pairs; retain unknown unless independently proved                                              |
| Restart completed; proof missing             | Independently check exact selected bytes, loaded modules/resources and admission barrier                                                        |
| Native proof saved; SQL acknowledgement lost | Finish the exact canonical operation from its protected receipt, without another selection/restart                                              |
| Explicit rollback accepted                   | Restore the old static directory **and** old artifact; restart only after fresh quiet/authority proof; verify original baseline facts unchanged |

Ordinary console recovery of a historical artifact must select its compatible
static profile too. Merely restoring includes under the new modules is not profile
rollback. Restart/takeover and transition acceptance/completion invalidate routing
evidence through canonical generation rules. Unknown work stays visible in current
projections and blocks new work; HTTP/Next gain no control transport.

## Maintenance and remaining review conditions

Recommend one operator-attended private-development maintenance window, with the
same installation and no tenant/resource repurposing. Expect an Asterisk restart
and temporary SIP/AMI/observation unavailability. Start only with affirmative quiet
proof. Stop the window if a required old target cannot be restored exactly; retain
all uncertainty and present a replacement/migration decision rather than silently
rebaselining. No ordinary draft calls, traffic destinations or extra ports are
included in DEV-01; DEV-02/03 remain separate.

Before an ordinary deployment can be requested, implement the durable mechanism,
fully rehearse it with actual PostgreSQL/Asterisk, actual process loss at selection,
restart, native proof and acknowledgement boundaries, separately labelled injected
SQL/response faults, and owner/apply/recovery/retirement/active-call races. Verify
both historical targets at every durable stage. Complete all required regressions
and publish actual upgrade/reconcile/rollback commands. The implemented commands
are documented in the [development runbook](../runbooks/development-container.md#retained-pbx-profile-transition-and-recovery);
the [evidence ledger](../status/p4-u2-dev-a-evidence.md) tracks the deployment gates.

## Recorded DEV-01 decision

On 2026-11-07 (Asia/Manila, +08:00), the user answered “Approve this strategy
and conditional maintenance effects” to the exact proposal to preserve the same
node, installation and original baseline, retain exact old/new static profiles
with compatible artifacts, and allow a quiet maintenance restart only after the
remaining durable-transition and recovery rehearsals pass. This resolves DEV-01
conditionally; implementation/rehearsal completion is still required before effects.
DEV-02/03 and ordinary call destinations remain unapproved by this decision.

## Implemented outcome

A-01–06 passed and the approved conditional maintenance effects completed on
2026-11-07 (Asia/Manila, +08:00), after 23 distinct isolated scenarios and all
required sequential regressions. The same installation/original baseline and both
old recovery targets remain exact; one quiet retained restart selected the verified
new compatible pair. [Final evidence](../status/p4-u2-dev-a-evidence.md) records
identities, before/after proof, preservation and b/c limitations. DEV-02/03 remain
separate. Earlier future-tense review conditions above are preserved as the
approved proposal, not a request for renewed approval.
