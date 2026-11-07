# P4-U2-DEV-c — Ordinary-console calling and integrated acceptance

**Status:** planned; implementation not started.
**Prepared:** 2026-11-07 (Asia/Manila, +08:00).
**Parent:** [P4-U2-DEV — Persistent tenant calling](p4-u2-dev-persistent-tenant-calling.md).
**Split:** adopted by the user on 2026-11-07; dependent environment decisions remain open.

The parent owns common policy, AC-01–12 and final completion. This child proves
the integrated persistent calling journey in the ordinary development environment.

## Goal and expected result

Through the normal private platform console, an operator completes routing for two
draft tenants on the retained PBX, reviews/applies the exact tenant-aware revision
and runs approved real inbound/outbound tests using persistent participants. Exact
destination/audio evidence, isolation denials, readiness/recovery and safe transfer
work without a disposable fixture runner. The setup stays reusable after the checks.

## Starting state and dependencies

Start after [a](p4-u2-dev-a-retained-pbx-profile-upgrade-and-recovery.md) and
[b](p4-u2-dev-b-persistent-controlled-call-preparation.md) pass their handoffs.
Recheck exact target/profile, custody, approved manifest and DEV-01–03 decisions,
current native ownership/proof, participant availability and known recovery blockers.
Reconcile any unknown work before new apply/call/transfer attempts.

Use the existing [verified-routing contract](../../docs/architecture/tenant-routing-verification.md),
[operator runbook](../../docs/runbooks/tenant-routing-verification.md) and
[manual guide](../../docs/guides/p4-u2-manual-testing.md). Preserve ordinary draft
denial and temporary grant semantics. This child does not implement P4-U3 activation,
P4-U4 staff administration, P4-U5 assignment, P5-U3 ingestion or desktop softphones.

## Scope and required behavior

- Complete approved existing-stock allocation and full owned inbound DID/group/rule
  graphs plus explicit outbound rule/trunk permissions for both tenants through
  canonical platform workflows. Respect profile/credential-before-allocation guards,
  historical pins, number reservations and node-serialized conflicts.
- Capture `tenant-routing-1` / `tenant-review-1`, inspect exact affected resources
  and safe diff, validate and apply through the normal HTTPS console and fenced
  native boundary. Verify actual protected/loaded runtime and fresh independent
  proof. Old policy artifacts retain history and cannot substitute for this proof.
- Select b's approved cases, explicitly grant each draft's permitted subset for at
  most 30 minutes, and trigger one installation-wide call at a time. Require real
  authenticated SIP/ingress, independently observed exact destinations and
  bidirectional RTP. Demonstrate compatibility with the parent's user-tested
  anchored-media/reference settings and record deliberate deviations.
- Exercise required actual negative SIP cases: cross-tenant, unallocated,
  unpermitted, unknown/ambiguous, stale source and ordinary draft traffic. Distinguish
  authorization denial from SIP/media transport uncertainty. Every extension exposed
  as verified needs its own inbound destination/outbound source evidence.
- Preserve exact evidence provenance and existing generation/semantic/authority/
  grant invalidation and 24-hour maximum age. Failed/unknown calls never promote
  readiness. Unexpected permitted isolation blocks the shared runtime as specified;
  revoking a grant cannot erase that failure.
- Exercise exact response-loss recovery, explicit quiet reconciliation, restart
  and owner-loss handling. Never redial from retry, restart, read or health checks.
  Reuse isolated fault rehearsal where unsafe disruption is unsuitable for the
  ordinary PBX; still prove ordinary supported reconciliation/restart behavior and
  clearly label which environment supplied each fault result.
- Demonstrate one approved dedicated installed-resource transfer through replacement
  apply, exact superseded-artifact retirement, desired blocker removal and canonical
  release/new allocation. Preserve initial/current/known-good/recovery targets,
  bytes/history and original provenance. Active/unknown work defers. Obtain fresh
  new-owner calls and actual stale-old-owner denial, without forced hangup or SQL pin edits.
- Revoke owned grants, perform reviewed loaded verification-path removal and prove
  absence. Retain the approved reusable cases/participants and labelled desired
  resources safely for a later explicit session; document how to reapply/regrant
  without promising perpetual readiness. Enumerate blocked/pinned resources rather
  than deleting them to obtain a clean report.
- Update existing console states only as needed for blockers/results/recovery;
  preserve no-store reads, canonical platform authority, Origin/CSRF, bounded DTOs,
  mounted identity/tenant/node isolation, accessible controls and narrow reflow.

## Acceptance criteria

| ID   | Observable result                                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Both tenants have exclusive eligible stock, complete canonical owned inbound graphs and explicit outbound permissions. Normal console capture/review/validate/apply establishes an exact current tenant-aware runtime; stale/foreign/invalid configuration rejects.                                            |
| C-02 | Actual ordinary-console inbound/outbound SIP calls succeed for both tenants using b's persistent setup, with independent exact destination and bidirectional RTP proof. Every exposed verified extension has individual current evidence; reference/media compatibility is recorded.                           |
| C-03 | Required actual negative SIP cases deny, including ordinary draft calls. Draft sign-in remains denied. No grant or voice preference activates a tenant; transport failure cannot count as denial. Isolation failures block the shared runtime under the existing contract.                                     |
| C-04 | Grant expiry/revocation, semantic/generation/authority changes, stale evidence, drift and dependency loss show truthful blockers. Restart creates no calls, extends no grant/evidence age and requires fresh proof before admission.                                                                           |
| C-05 | Lost responses and owner/participant/native interruption retain exact intent and truthful unknown state. Exact recovery never redials; explicit reconciliation requires actual quiet proof and does not invent success. Ordinary recovery/profile compatibility remains intact.                                |
| C-06 | Dedicated installed-resource retirement/transfer succeeds only after actual runtime/desired blockers clear. Calls/unknown state defer, required recovery targets/bytes/history remain usable, new owner obtains fresh SIP/RTP proof and stale old-owner traffic denies.                                        |
| C-07 | Reviewed cleanup proves loaded-path removal and preserves unrelated data, reference bytes and approved reusable setup. After completed checks and a normal restart, the console can still discover the cases and show truthful preparation/readiness state without a disposable runner.                        |
| C-08 | Actual normal HTTPS authorization/CSRF/bounds/secret isolation and keyboard/reflow/owner-bound recovery checks pass. Focused/affected/full regressions, safe ordinary preservation evidence, runbooks and all parent AC-01–12 reconciliation pass with declared real/injected and manual/automated boundaries. |

Parent mapping: C-01 → AC-05; C-02 → AC-06 and AC-02 media closure;
C-03/C-04 → AC-07; C-05 → AC-08; C-06 → AC-10;
C-07 → AC-09; C-08 → AC-11/12 and integrated review of a/b's AC-01–04 evidence.
Recheck earlier acceptance against the final installed profile and persistent setup;
historical disposable passes alone cannot close these parent requirements.

## Required verification

Implement and document the parent's explicit ordinary deployment/acceptance mode,
separate from read-only preflight and isolated rehearsal. Its command does not yet
exist. An acceptance run must identify its actual environment and use persistent
participants; it must not silently switch to fixture credentials or a disposable PBX.

Run existing commands sequentially:

- `./dev exec pnpm check:tenant-routing --live`
- `./dev exec pnpm check:tenant-routing --browser`
- `./dev exec pnpm check:tenant-allocation`
- `./dev exec pnpm check:tenant-bindings`
- `./dev exec pnpm check:draft-tenant`
- `./dev exec pnpm check:extension-inventory`
- `./dev exec pnpm check:trunk-gateways`
- `./dev exec pnpm check:routing`
- `./dev exec pnpm check:pbx-revisions` with full native/interruption/provider/isolation coverage
- `./dev exec pnpm check:platform-auth --http`
- `./dev exec pnpm check:staff-auth`
- `./dev check`

These regressions supplement actual ordinary-console two-tenant evidence. Review
the full manual guide against the delivered persistent environment and record actual
manual results separately from automated browser proof. Do not fill the user's
manual sign-off cells from prior automated passes.

Before/after checks must preserve exact unrelated data and old immutable artifacts,
enumerate approved intended changes, verify provider custody without exposing it,
check `./dev health`, platform/staff HTTPS and profile-aware `./dev pbx-live-check`,
and confirm quiet state/no unknown operation. Isolated faults and disposable cleanup
must have exact ownership boundaries; reusable ordinary resources remain declared.

## Completion and downstream handoff

Complete c after C-01–08 pass in the approved ordinary environment with a/b intact.
Complete the parent only after every AC-01–12 maps to actual required evidence.
Publish a sanitized command/provenance/result ledger and final operator walkthrough
in `docs/status` and the existing runbooks/manual guide; update tracker and affected
architecture contracts. Record failures/blocked manual work honestly.

U3 receives current readiness and explicit voice preference for separate activation
gates. U5 receives individually verified owned extension/claim/permission versions
and exact inbound/outbound test IDs; no assignment writer is delivered here.
P5-U3 retains operational ingress/provenance ownership. The ordinary environment
is ready for repeatable controlled verification; ordinary staff calling and the
Phase 4/production gates remain separate.
