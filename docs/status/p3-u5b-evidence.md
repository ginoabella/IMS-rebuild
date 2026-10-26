# P3-U5b acceptance evidence

**Completed: B-01–08 passed within approved private development.** Verified
2026-10-26 05:47 +08:00 (Asia/Manila). Parent P3-U5, c and the Phase 3 gate remain
incomplete. Scope is the owner's approved U5-01–05 private-development policies and
scoped nftables/NET_ADMIN addendum, recorded in the
[policy review](../planning/p3-u5b-live-policy-review.md).

## Acceptance boundary

| ID   | Observed result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Real PostgreSQL/shared Redis/two HTTP replicas prove atomic intent, audit, pins and outbox; rollback has zero effects, exact receipts survive response loss, stale review/baseline reject and operations serialize per node. Runtime grants cannot promote health or release pins.                                                                                                                                                                                                                                                                |
| B-02 | Actual native kernel flock and durable ordered journal reject stale epochs, duplicates and out-of-order mutation. Real SQL lease expiry during a paused dispatched reload plus helper SIGKILL excludes the successor until actual CLI completion; it then reconciles without candidate replay. Atomic complete-set selection preserves unmanaged configuration.                                                                                                                                                                                   |
| B-03 | Actual pinned Asterisk validates isolated complete sets with validator-UID egress denial, reloads only fixed commands and independently proves provenance, loaded endpoint/trunk codec/profile/AOR/auth and dialplan. Exact/wrong OPTIONS digest and controlled positive/negative route probes pass. Ordinary unbound/unallocated ingress remains denied.                                                                                                                                                                                         |
| B-04 | Actual malformed parser input rejects before selection. Actual filesystem selection conflict and selected-file/runtime drift preserve or restore the verified baseline. Explicit recovery passes. Failed/uncertain recovery retains barrier and both sets/pins, blocks conflicts, and resolves only through audited predecessor reconciliation. Candidate validation/install/verification remain distinct from passed recovery.                                                                                                                   |
| B-05 | Real natural call drain, zero-check/admission race, stale/unknown activity and bounded quiet-window deadline pass for apply/recovery. Unknown recovery keeps denial; no hangup occurs.                                                                                                                                                                                                                                                                                                                                                            |
| B-06 | Exact retained provider versions 1/2 pass through the protected GET-only consumer and actual renewed owner/private native socket; missing version, foreign installation and bounded refused transport deny. Loaded auth proves both applies, old/new pins survive replacement, and rollback uses retained version 1 without provider resolution. Actual known-good removal/structural edits block. Owner completes with ordinary worker stopped; late delivery has no repeat effect. Canonical account revocation after drain prevents selection. |
| B-07 | Actual HTTPS review → lost apply response → same-operator reauthentication/receipt → native verification → keyboard recovery passes, with two-replica status, stale-baseline/raw-command/CSRF denial, axe and reflow.                                                                                                                                                                                                                                                                                                                             |
| B-08 | Command/access/activity/recovery/material procedures are published. Focused, affected and final normal checks, ordinary refresh/transport/health, independent retained preservation and exact owned cleanup passed.                                                                                                                                                                                                                                                                                                                               |

Fixtures use at most nine sequential bounded synthetic Local calls in the native
run, with at most two simultaneous private peer legs; each call stays within ten
seconds and the probe run within five minutes. Approved ceilings are 20 calls,
two concurrent and ten seconds per call. No public, emergency, paid or tenant
destination is used. Other provider/native tests originate no calls or registration.
Reload acknowledgment or registration alone cannot promote known-good.

## Reproducible checks

All final commands passed, exit 0, using the Docker workspace and Node 22.23.3:

- `./dev exec pnpm check:pbx-revisions`: actual native parser/activity/probes/AMI/fencing, integrated SQL/native ownership/recovery/startup, exact real-provider versions 1/2 and rollback, isolation, real HTTPS/two-replica workflow and all 16 compiler/protection/boundary contracts (zero skipped).
- `./dev exec pnpm check:routing`
- `./dev exec pnpm check:trunk-gateways`
- `./dev exec pnpm check:pbx-nodes`
- `./dev exec pnpm check:platform-auth`
- `./dev exec pnpm check:durability`
- `./dev exec pnpm check:extension-inventory`: full API/provider/lifecycle/browser suite.
- `./dev check`: final complete lint/format/type/production-build/entrypoint/configuration/foundation/durable/storage/identity/client-exclusion/isolated-deployment/session graph on the final source.
- Nine existing issuer-preflight/custodian contracts, actual capability/custody checks, ordinary `./dev platform-https-check`, `./dev staff-https-check` and `./dev health`.

An initial inventory run passed API checks, then stopped before credential work
because the fixture issuer returned verified-TLS identity 403. Its preserved
manifest has no database/material bindings; exact fixture-token absence was checked.
Routine named-custodian/fixed-role replacement initially stopped safely at preflight
because U5b adds its approved live-consumer issuance rule. The helper now accepts
that exact addition only with `--live-installation UUID`, retaining exact rejection
of unrelated policy drift. Replacement passed with a nonrenewable actual TTL of
86,399 seconds, 24-hour explicit maximum, prior issuer still invalid, zero
configuration updates and temporary human session revoked. No root recovery,
policy changes or stored material changes occurred during access maintenance.
The full inventory retry then passed, including its authorized owned cleanup.

## Retained deployment and custody

The additive primary migration and scoped executor login are installed. Only the
existing private Asterisk and two telephony replicas use the opt-in profile.
Telephony runs as actual UID/GID 1000:1000. NET_ADMIN/nftables/netfilter read and
active-profile isolation passed. No host networking or runtime Docker socket exists.
Native mutation uses its scoped SQL role and physical lock; HTTP/Next/ordinary
workers have no consumer volume, token, provider network or native control socket.

The GET-only installation consumer is in a private Docker volume mounted read-only
only into telephony. A permission-only check found initial legacy host staging
readable by the workspace UID; it was immediately protected root-only, then replaced
and the old token revoked. Actual isolation checks confirm workspace cannot read
legacy token staging or native SQL custody. Trusted setup now uses exact input/output
mounts; no credential bytes appear here, in clients, audit, jobs or test output.
The consumer has a 24-hour nonrenewable maximum. Asterisk receives exact staged
material and scoped SQL custody, never a provider token.

Initial baseline `add6bfc1-ee2f-42a7-a68a-5cdba67b95d7` was independently verified
at `2026-10-25T14:44:30.603Z` (October 25, 22:44 +08:00). Final installed,
verified and known-good IDs match, runtime is verified and no operation is active.
Executor heartbeat is fresh; verified-TLS observation is reachable/complete without
failure. No desired revision or call was applied to the retained node by U5b.

Ordinary backend recreation and fixture-free HTTPS console refresh passed. Platform
and staff transport checks passed; backend liveness/readiness returned 200 with
PostgreSQL and both Redis services up. The final graceful native helper refresh
preserved the actual Asterisk process, checked by PID and process start time.
The separately authorized inventory regression restored its controlled PBX using
its existing fixture procedure. Independent post-regression comparison matched the
retained unmanaged configuration hashes, exact loaded endpoint/auth/AOR facts and
default-deny dialplan; final active channels and managed resources are zero.

## Fixture cleanup and limits

Launchers removed their owned databases, containers, socket volumes and fixture
directories. Final checks found no live-fixture containers/socket volumes/directories
or known owned SQL databases. Full credential teardown covered 26 owned generations
(25 destroyed, one already absent), plus two browser-owned generations destroyed;
both runs revoked and removed their exact fixture tokens. PBX cleanup confirmed
fixtures absent, exact baseline and original running state restored, and exclusive
lock released. Unrelated credentials, versions, identities and retained volumes
remain preserved.

The provider/native fixture selects only existing canonical
`Owned acceptance <id-prefix>` versions. It performs no provider write, access
issuance or policy change and preserves those versions. An earlier new-key writer
was rejected and never ran; the retained-version proof superseded it. The owner
later approved it, but unused writer/access scripts remain removed. Destruction
belongs only to the separately authorized existing synthetic inventory regression;
the live consumer has no material-write/destruction permission.

Disposable fixtures use root/NET_ADMIN, Docker orchestration and owned database
administration. The retained native helper actually has the approved root/NET_ADMIN,
protected artifact/control volumes and scoped SQL executor role; it has no provider
token, Docker socket or host networking. The telephony owner has only its existing
SQL ownership/runtime grants, private socket and GET-only provider consumer.
HTTP/Next/ordinary workers receive neither native grants nor material/provider access.

This delivers no tenant bindings/calling readiness, phone delivery, operational call
attribution, production HA, general credential pruning or joint backup readiness.
P3-U5c still owns the broader adversarial matrix and integrated parent/Phase 3
handoff. See the [operator guide](../runbooks/pbx-revisions.md) and
[execution/dependency contract](../architecture/pbx-revisions.md).
