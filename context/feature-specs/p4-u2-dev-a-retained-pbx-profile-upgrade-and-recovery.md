# P4-U2-DEV-a — Retained PBX profile upgrade and recovery

**Status:** complete; A-01–06 passed, including approved retained deployment and preserved exact historical recovery. [Final evidence](../../docs/status/p4-u2-dev-a-evidence.md).
**Prepared:** 2026-11-07 (Asia/Manila, +08:00).
**Parent:** [P4-U2-DEV — Persistent tenant calling](p4-u2-dev-persistent-tenant-calling.md).
**Split:** adopted by the user on 2026-11-07. Creating this child does not resolve
the parent's DEV-01–03 environment decisions or authorize retained runtime effects.

The parent owns common scope, policy decisions, AC-01–12 and final completion.
This child owns the static-profile transition and its recovery proof.

## Goal and expected result

The existing retained development PBX gains the module/profile capabilities needed
for tenant-aware calling through an explicit, recoverable transition. The operator
can inspect the current profile and safely reconcile or restore an interrupted
transition. Required old artifacts remain recoverable with their original static
profile, compiler/policy, unmanaged digest and material references.

This establishes compatible infrastructure; it does not configure tenant routes,
install persistent call cases or establish tenant calling readiness.

## Starting state and dependencies

Recheck the parent's observed target and current runtime before work. Reuse the
[revision/recovery contract](../../docs/architecture/pbx-revisions.md), native
physical fence, canonical ownership and protected artifact custody. Read the
[user-tested configuration requirements](p4-u2-dev-persistent-tenant-calling.md#user-tested-asterisk-configuration-reference)
and preserve [`reference/asterisk_config/`](../../reference/asterisk_config/) bytes.

DEV-01 must be resolved before retained static configuration/module/restart effects.
Prepare the concrete transition, compatibility mapping, maintenance effects and
isolated rehearsal evidence for review first. Existing approvals remain effective
within their scope; a silent rebaseline is not an upgrade strategy. DEV-02/03 remain
with the persistent environment/resource work. No new ordinary-environment calls
are authorized by this child or required merely to perform a passive preflight.

## Scope and required behavior

- Add a read-only preflight through trusted deployment tooling. Check canonical
  installation/node, expected versions, profile bytes/digest, actual loaded
  capabilities, baseline/current/known-good artifacts and ancestry, pins, custody,
  native epoch, calls and pending/unknown work. Report sanitized finite blockers.
- Record a sanitized reference/current/proposed profile comparison covering modules,
  anchored media, RTP range/publication, NAT and external-address placeholders.
  Preserve the managed profile's explicit capability policy. Do not copy autoload,
  reference credentials, public/WebRTC routes or unrestricted local-user paths.
- Define durable transition identity and exact old/new profile selection with
  protected bytes and artifact compatibility. Reuse existing transaction/audit and
  native ownership boundaries; extend their contracts only as required for this
  transition. Historical artifact bytes/digests and the original baseline stay intact.
- Serialize transition, apply/recovery and retirement under canonical/native
  fencing. Prove quiet state again at effects; active calls/unknown safety defer.
  No forced hangup, pin clearing, destructive pruning or credential rotation.
- Prove recovery across interruption before/after profile selection, required
  restart, independent native verification and final SQL acknowledgement. Retain
  uncertain work and reconcile the exact operation; never blindly replay effects.
  Rollback must restore a compatible static-profile/artifact pair, not only includes.
- Rehearse on an isolated copy before approved ordinary deployment. Required
  recovery targets must remain usable at each durable stage. If the design cannot
  achieve this, stop that deployment branch and present the parent's explicit
  replacement/migration decision rather than replacing the baseline implicitly.
- Preserve existing console review/apply/recovery. Show unsupported/unavailable
  runtime facts truthfully through existing projections where needed. HTTP/Next
  receive no new PBX control/provider transport. A general profile editor is excluded.

## Acceptance criteria

| ID   | Observable result                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-01 | Read-only preflight reports exact target, profile/artifact compatibility, capabilities, custody and safety. Wrong target/version/digest, drift, missing recovery/custody or unavailable dependencies blocks effects; passive status does not mutate or place calls.                        |
| A-02 | Sanitized reference/current/proposed comparison accounts for module/media/NAT behavior. The approved profile has the required actual loaded capabilities, and reference bytes, credentials and unrelated configuration remain preserved.                                                   |
| A-03 | Isolated rehearsal and then approved retained deployment select a coherent new profile/runtime. Independent protected/loaded verification passes; original baseline/history and required recovery targets retain their exact original meaning.                                             |
| A-04 | Actual process interruption and labelled SQL/acknowledgement faults at transition boundaries retain truthful uncertain state. Exact reconciliation and rollback prove a compatible old or new profile/artifact pair without blind replay or false verification.                            |
| A-05 | Active-call/unknown-state and competing owner/apply/recovery/retirement scenarios defer or fence safely. No forced call termination, pin deletion or silent rebaseline occurs; restart cannot promote stale proof.                                                                         |
| A-06 | Normal console review/apply/recovery or its truthful preparation blockers remain usable with existing authority/recovery behavior. Health/HTTPS pass, unrelated data and recovery custody are preserved, and deployment/status/reconcile/rollback instructions and evidence are published. |

Parent coverage: AC-01–03, profile/recovery portions of AC-08/09/11/12. A-02/A-03
prove profile compatibility; parent AC-02's actual SIP/audio compatibility is closed
only by c. Passing a alone does not satisfy parent live calling acceptance.

## Required verification

Implement documented Docker entry points separating read-only preflight/status,
isolated rehearsal and explicit approved upgrade/reconcile/rollback. No such profile
transition commands existed at specification preparation; actual implemented names/arguments
are published in the [development runbook](../../docs/runbooks/development-container.md#retained-pbx-profile-transition-and-recovery).
Keep mutating commands out of passive health/status and ordinary startup.

Use actual Asterisk and PostgreSQL for isolated upgrade/restore and process-loss
proof, plus controlled active-call deferral and owner/apply/recovery races under the
applicable approved isolated policy. Label injected SQL/response faults separately.
Then verify the reviewed ordinary transition and required historical recovery
compatibility with exact protected/loaded bytes. Do not deliberately fault the
ordinary retained PBX merely to repeat isolated interruption coverage.

Required existing checks: `./dev exec pnpm check:pbx-revisions` with its full native,
interruption/provider/isolation/browser coverage; `./dev exec pnpm check:tenant-routing --live`;
affected `./dev exec pnpm check:platform-auth --http` and staff authority regressions;
and `./dev check`. Run sequentially; broaden affected checks when the implementation
changes their boundary. Check `./dev health`, `./dev platform-https-check`,
`./dev staff-https-check` and `./dev pbx-live-check` using the approved profile-aware
contract. Never weaken exact baseline checking to make the upgrade pass.

## Completion and handoff

Complete a only after A-01–06 pass, DEV-01 is recorded, ordinary upgrade is verified
and its recovery remains demonstrably usable. Record commands, safe identities,
before/after changes, fault boundaries and cleanup in `docs/status`; update the
tracker, revision/recovery contract and development runbook. No runtime pass is
claimed by this specification.

Hand [b](p4-u2-dev-b-persistent-controlled-call-preparation.md) the exact profile,
artifact compatibility, native capabilities, preserved recovery/custody and known
blockers. Hand [c](p4-u2-dev-c-ordinary-console-calling-and-integrated-acceptance.md)
the same recovery evidence for final integrated calling acceptance.
