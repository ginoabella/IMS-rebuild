# P2-U1c — Secure operator bootstrap and foundation handoff

## Status and purpose

- **Status:** planned; implementation has not started.
- **Prepared:** 2026-10-05, Asia/Manila (+08:00).
- **Requirement:** [P2-U1 parent scope and acceptance matrix](p2-u1-canonical-identities-and-tenancy-admission.md).
- **Goal:** securely provision one initial tenantless operator and verify the
  complete canonical identity foundation for later authentication.
- **Completion boundary:** the actual trusted command creates one eligible
  operator, reruns/concurrent runs preserve it, failure recovery uses durable
  state, and all parent identity-foundation checks pass.

The user adopted the three-spec split. The parent owns shared scope, exclusions
and AC-01–11. This spec owns protected credential input, bootstrap and integrated
verification. Creating the split does not approve pending product decisions or
start runtime implementation.

## Starting state and dependencies

Require verified [a](p2-u1a-canonical-identity-stores-and-ownership-constraints.md)
and [b](p2-u1b-role-contracts-and-canonical-tenancy-admission.md), including their
schema/grants, operator/credential/provenance storage, normalization, approved
eligibility, canonical snapshots and atomic version/audit contract. Recheck their
evidence before extending the trusted deployment entry point.

Resolve D-05's bootstrap password policy and relevant initial account/credential
eligibility. Record the P1-U1 partial handoff and approved D-01/D-06 portions
inherited from b. Exact password-hashing implementation/parameters are routine
technical choices to document and verify; they do not approve credential delivery,
recovery, reset or last-administrator policies for later units.

## Scope and ownership

Allowed changes: platform bootstrap application use case, private password adapter,
existing deployment command dispatch/launcher, protected input and necessary typed
settings, provenance constraints/grants if needed, integrated real-database checks,
bootstrap runbook, identity contract and evidence/tracker updates.

No new service or listener. Do not start workers/PBX observation, create fixture
tenants in production, implement sign-in/sessions, deliver setup/reset tokens,
reactivate accounts, recover operators, or provision production organizations/PBX
resources. Password hashing primitives may be shared privately with later staff
verification without merging authority stores or adding a public contract.

## Protected input and password storage

Extend deployment with an explicitly selected bootstrap command. Document the final
Docker launcher and approved input modes during implementation. Running migrations,
HTTP startup or general deployment startup never bootstraps an operator implicitly.
Verify required schema/settings before writing; failures exit nonzero with a safe
fixed outcome. The command exits after bounded work and closes database resources.

Normalize the username through a's identifier contract. Receive password bytes
through hidden interactive input or a protected secret input for automation;
neither passwords nor hashes appear in argv, shell history, committed settings,
default credentials, examples, logs, audit, diagnostics or client bundles. Do not
silently trim/lowercase passwords. Bound input size, validate the approved policy
and avoid secret echo. Clean up transient secret files/buffers where practical;
never persist a plaintext credential or claim guaranteed memory erasure.

Use an appropriate salted password-hashing algorithm and encoded parameters with
bounded cost/concurrency. Document selected parameters and verification behavior;
verify correct/incorrect passwords using synthetic fixtures. Finish expensive
hashing before opening the creation transaction. Hash output is private credential
data, not part of a general operator/authority DTO. No password generator, default
password or delivery service is introduced implicitly.

## Atomic creation, rerun and recovery

Use a database-backed serialization lock and constraints covering the single
initial-bootstrap result. Under the lock, inspect durable provenance and canonical
operator state before deciding whether creation is allowed. Username uniqueness
alone is insufficient to prevent two different concurrent initial operators.
Lock ownership and the result must survive process boundaries through PostgreSQL;
no replica-local lock, receipt or file is authoritative.

On first creation, persist the tenantless operator, eligible account state, ready
credential/hash, initial positive versions and bootstrap provenance together with
the audit event in one transaction. Construct a trusted system actor naming the
command and bounded reason; do not pretend the new operator authenticated the
action. Use P1-U5's explicit handle and safe metadata allowlist. Keep initiating
actor, target and correlation distinct from secret/username input.

A matching rerun resolves the existing initial operator and returns a safe
already-created outcome. It does not overwrite hash, status, roles or versions,
create a second operator, or append another creation event. A newly supplied
password cannot reset the existing account; define the input validation flow
clearly and prove the original credential remains valid after rerun.

Reject a different requested initial identity, conflicting provenance, an unrelated
preexisting username or an ineligible existing bootstrap account with a safe
conflict/nonzero outcome. Do not adopt another existing account implicitly or use
bootstrap as reactivation/reset/recovery. Explain the conflict and later recovery
boundary without leaking credential material.

Concurrent matching runs converge on one creation and one existing result;
concurrent different identities cannot create two initial operators. Failure before
commit leaves no partial account/credential/provenance or success audit. Forced
audit failure rolls back creation. If connection loss makes commit outcome
ambiguous, report uncertainty safely and inspect canonical provenance on rerun;
do not blindly recreate or rotate credentials. Recovery never interprets failed
transport as proof that the database rolled back.

Use trusted deployment privileges for bootstrap. Actual runtime credentials cannot
perform that operation or bypass its provenance protections. No public endpoint
wraps the command. Production migrations/bootstrap create no test tenants/staff;
fixtures use disposable databases and their own trusted administration.

## Integrated verification and operational handoff

Retain a/b focused checks and add actual command invocations from independent OS
processes. Capture only sanitized outcomes/correlation references; synthetic
password/hash/identity-input sentinels must be absent from logs, errors, audit
metadata, published evidence and client bundles. Secrets are not printed to make
the absence checks easier to debug.

The runbook must explain prerequisites, protected input, first creation, matching
rerun, conflicting/ineligible existing results, process/database interruption and
safe diagnostics. State that bootstrap is provisioning, not sign-in or recovery.
Document fixture teardown separately from operational commands; teardown can
remove only uniquely identified disposable databases/resources.

Keep parent acceptance evidence centralized and map all AC-01–11 to exact a/b/c
checks and results. Record fresh/rerun migration, SQL grants, namespace ownership,
admission/version matrix, actual bootstrap and interruption outcomes. Fixtures
do not demonstrate two-replica session enforcement, native mobile login, production
provisioning or the Phase 2 gate.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| C-01 | Identity/credential contract records approved bootstrap policy, relevant P1-U1 handoff, hashing/input decisions and all remaining later gates. a/b decisions are reconciled with authoritative context. | AC-01 final integration |
| C-02 | Actual listener-free command creates one eligible tenantless operator with a verifiable salted hash, durable provenance and trusted system audit. Correct/incorrect password verification works; password bytes are preserved. | AC-08 creation portion |
| C-03 | Matching rerun preserves account/hash/roles/versions and adds no creation event. Conflicting identity, unrelated username, conflicting provenance and ineligible existing account fail safely. | AC-08 rerun portion |
| C-04 | Independent concurrent command processes converge on one initial operator/event; different-identity races cannot bootstrap two accounts. | AC-08 concurrency portion |
| C-05 | Precommit interruption, forced audit failure and ambiguous commit-response loss have safe outcomes. Restart/rerun resolves durable state without partial records, duplicate creation or password rotation. | AC-09 recovery portion |
| C-06 | Production migration and startup do not create fixture/default identities. Actual runtime credentials/public surfaces cannot bootstrap; command starts no HTTP, worker or PBX process. | AC-04 final isolation; AC-09 provisioning portion |
| C-07 | Protected input/secret cleanup and bounded hash handling pass; synthetic secret/hash/identity-input sentinels are absent from diagnostics, audit metadata, evidence and client bundles. Existing audit/ownership/grant checks still pass. | AC-10 final integration |
| C-08 | Combined a/b/c identity command and existing Docker checks pass; runbook/evidence cover every parent criterion with exact procedures, results and limitations. | AC-11 final integration |

Run actual PostgreSQL with deployment credentials only for trusted bootstrap and
isolated administration. Use process/barrier-driven concurrent commands and
controlled test-only interruption, including commit-response ambiguity; mocks alone
do not prove process restart or durable provenance. a/b regressions remain required.

Complete the provisional `./dev exec pnpm check:identity-foundation` command and
wire reproducible checks into the foundation/CI sequence. Run it plus `./dev check`
and document the actual launcher and results. No provisional command or runtime
acceptance has been verified at specification preparation. Documentation preparation
requires consistency, link, coverage and whitespace checks only.

## Completion and downstream boundary

Complete c only when C-01–08 pass. Complete parent P2-U1 only after a/b/c and
AC-01–11 pass with evidence and synchronized tracker/contracts/runbook. Hand
P2-U2 separate canonical identity ports, eligibility/status/version rules and the
secure initial operator foundation. Sessions/guards and cross-replica revocation
remain P2-U2; platform/staff sign-in remain P2-U3/U4. No Phase 2 authentication
or production readiness is inferred from bootstrap success.
