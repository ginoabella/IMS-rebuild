# P1-U6b — Tenant-checked references and recovery verification

## Status and purpose

- **Status:** planned; depends on P1-U6a and access/expiry approval.
- **Prepared:** 2026-10-05 (Asia/Manila).
- **Requirement:** [P1-U6 parent scope and acceptance matrix](p1-u6-shared-file-storage-access.md).
- **Goal:** issue expiring artifact references only after tenant ownership and
  consumer permission checks, and prove the complete foundation recovery path.
- **Completion boundary:** an authorized fixture retrieves its artifact through an
  expiring reference; foreign/expired access fails and provider outage/recovery
  preserves correct outcomes across independent processes.

The parent owns shared scope and AC-01–09. This spec owns the access contract and
combined verification. The adopted split does not approve a provider, access policy
or runtime implementation. Acceptance below describes intended behavior.

## Starting state and dependencies

Require verified [P1-U6a](p1-u6a-shared-storage-adapter-and-configuration.md), including
its approved private provider setup, object-identity/reconciliation contract, typed
port, safe outcomes and reproducible integration checks. Reuse that adapter rather
than creating another storage path.

Require D-10 access approval: reference mechanism, consumer-accessible signing host,
maximum lifetime, expiry enforcement and expectations after logout, role change or
suspension. Do not infer approval from provider approval or this specification.

P2 identity/session enforcement and P8 evidence metadata are not implemented. Use
trusted fixture contexts and a fixture ownership resolver; add no business tables or
public access routes. These checks prove the port boundary, not real authentication
or tenant foreign keys. If the approved mechanism requires an authenticated gateway
or P2 machinery, record that dependency and resume condition. Required enforcement
must exist before the dependent criterion or parent is marked complete.

## Scope and ownership

Allowed changes: backend access service and small caller-owned ownership/permission
ports, necessary provider signing operation, typed access configuration, trusted
fixture resolver, expiry/security/recovery checks, existing focused command/CI,
storage ADR/runbook and final evidence/tracker updates.

The owning feature remains responsible for canonical artifact metadata, role/session
policy and lifecycle. No HTTP gateway or upload/download route, client screen,
attachment schema, recording synchronization, retention schedule or production
recovery implementation is introduced. Keep all parent exclusions in force.

## Access contract

Accept a trusted actor/scope context and opaque artifact ID. An owning-module port
resolves canonical tenant ownership and the internal object reference; a small
permission boundary determines whether the consumer permits the requested read.
Check both before retrieval or signing. User-supplied tenant IDs, arbitrary object
keys and possession of an artifact ID confer no authority. Platform identity alone
does not grant tenant evidence access.

Reject malformed, foreign, unresolved-ownership and denied-permission requests
without provider reads/signing. Avoid responses that reveal another tenant's object
existence. Document safe missing/denied outcomes and test call ordering. Fixtures
must include two tenant scopes and explicit platform/denied cases, not a resolver
that trusts its request's tenant ID.

References permit only the resolved object/read operation and have explicit
expiration information bounded by the approved maximum. Reject or bound invalid
requested lifetimes according to the recorded contract. Keep resources private;
anonymous direct access remains denied. Never persist signed URLs as canonical
artifact metadata or treat successful signing as proof of object availability.

The ADR records bearer-reference forwarding and revocation behavior where applicable.
Checking ownership at issuance does not revalidate subsequent bearer downloads.
Do not promise immediate revocation unless the approved implementation supports and
verifies it. If a gateway is required, its real enforcement is a dependency rather
than a fixture substitute. Expiry means a new request after expiry fails; it does
not withdraw downloaded bytes or guarantee cancellation of an established stream.

Keep credentials, signed URL query strings, authorization headers and artifact
bytes out of logs, audit, metrics, raw errors and retained evidence. Only safe
correlation/outcome fields are emitted. No attachment audit catalog is introduced.

## Recovery and integration contract

Use a's timeout/retry/cancellation and ambiguous-write reconciliation rules. Exercise
read and access-reference failures as well as writing; provider interruption yields
bounded safe failure, never success or replica-local fallback. Restore access and
verify the same assigned object identity and correct bytes. Missing objects remain
distinct from provider unavailability, including when a signer can produce a URL
without reaching the provider.

Keep trusted provisioning separate from runtime access. Extend the ADR with approved
reference/expiry decisions and retain deferred file, retention and production
recovery gates. Extend a's runbook with issuance, expiry, safe diagnostics, provider
interruption/recovery and isolated teardown. Do not alter the established health
policy without documenting and verifying the necessary change.

## Acceptance and verification

| ID | Required result and check | Parent coverage |
| --- | --- | --- |
| B-01 | ADR records approved mechanism, signing-host reachability, maximum lifetime, expiry/revocation semantics, remaining decisions and any actual enforcement dependencies. | AC-01 access portion; integrated AC-01 |
| B-02 | Two trusted tenant fixtures read only their own artifacts. Foreign, malformed, unresolved ownership, platform-without-grant and denied-permission attempts fail before provider reads/signing; anonymous direct reads remain denied. | AC-03 |
| B-03 | Authorized reference retrieves exact intended bytes before expiry; new request after expiry fails. Object/signature/expiry tampering fails and lifetime bounds are enforced. Approved revocation guarantees are verified where applicable. | AC-04 |
| B-04 | Missing artifacts, provider outage and timeout have distinct documented safe outcomes. Signing does not imply existence/retrievability. Interrupted write/read/reference access recovers without false success, duplicate artifacts or disk fallback. | Integrated AC-05–06 |
| B-05 | Invalid access settings fail safely; captured outputs omit credential, content and signed-reference sentinels, including provider/error paths. | Integrated AC-07 |
| B-06 | Fresh/rerun provisioning, service/process restart, runtime privilege limits, entry-point isolation and health policy pass with the access service integrated. Independent processes still retrieve the same artifact. | Integrated AC-02 and AC-08 |
| B-07 | Full parent AC-01–09 matrix, focused storage command and required Docker checks pass. Runbook/evidence/tracker reflect guarantees and limitations without claiming real identity/evidence or production readiness. | AC-09 and parent completion review |

Run signing/retrieval/expiry checks against the approved provider or approved local
protocol implementation, using client-reachable endpoints. Test doubles prove access
ordering/error mapping only. Use independent OS processes and isolated directories,
unique tenant/artifact fixture namespaces, bounded polling and explicit interruption
barriers. Remove only the run's fixtures. Do not retain signed URLs as evidence.

Extend `./dev exec pnpm check:storage` (provisional until implemented) to cover the
complete parent matrix, and finish appropriate foundation/CI integration. Run that
command plus `./dev check`, recording commands, environment, outcomes and limits.
No hosted-provider, production HA, authenticated HTTP authorization or backup/restore
claim follows from local fixture success. Documentation preparation requires
consistency, link and whitespace review rather than runtime checks.

## Completion and handoff

Complete b and parent P1-U6 only when a remains verified, B-01–07 pass, every parent
criterion has evidence and no required access decision/dependency remains unmet.
Record the actual check command, adapter/access contracts, safe recovery procedure
and remaining feature/production boundaries for P8 consumers. P8-U1 must supply
canonical ownership and real role/session authorization; this foundation fixture
does not satisfy those later requirements.
