# P3-U3a — Recommended provisioning and test provider profile

Prepared 2026-10-19 (Asia/Manila, +08:00).
**Conditionally approved by the user on 2026-10-19 (Asia/Manila, +08:00).
Non-disruptive preparation/implementation may proceed. The user subsequently
approved the custodian succession design and explicitly authorized one isolated
recovery operation, subject to all safeguards. The single operation executed after fresh custody and backup checks; a subsequent
token-lifetime finding blocks acceptance at the
[execution checkpoint](../status/p3-u3a-recovery-execution.md).**

The user's conditions take precedence over the suggested approval wording below:
use an existing valid authorized custodian first; preserve endpoint permissions,
leases, material and functionality; protect all secret inputs; document token
renewal/reprovisioning and failure handling; provide real provider/ACL/token,
PostgreSQL/Redis/HTTP A-B/race/cleanup and endpoint regression evidence. No live
SIP/registration/PBX/carrier/call/production operation is approved.

The original conditional design approval alone did **not** authorize steps 2–8.
The later explicit single-operation authorization covers the reviewed procedure
subject to its mandatory custody, backup, deadline, succession and restoration
gates. Earlier pending-approval wording below is preparation history, not a
request to repeat the authorization or permission to bypass unmet prerequisites.

The user has approved the [definition contract](p3-u3a-definition-contract-review.md)
and [isolated trunk credential design](p3-u3a-openbao-trunk-credential-review.md).
This document addresses their remaining concrete profile and provisioning prerequisites.
It does not replace those approvals or report completed implementation.

## What I recommend

Use the existing private OpenBao server, with separate trunk permissions and
custody. First prove the implementation with synthetic SIP account credentials
and a fixed test provider profile. Use no real carrier account for this acceptance.

If a valid platform custodian identity is available, use it to provision the
restricted roles. If none is available, approve the one-time isolated recovery
procedure below. The current endpoint administrator cannot substitute for that
identity: its self-editing policy and unrestricted token issuance are precisely
what the approved design requires us to remove.

| Decision | Recommendation | Practical effect |
| --- | --- | --- |
| Test provider | Synthetic account, outbound digest, registration disabled | Proves storage and exact binding without contacting a carrier |
| Storage | Separate `myims-trunk` KV-v2 mount on retained OpenBao | Reuses infrastructure while separating runtime permissions |
| Routine access | Exact installation-scoped issuer roles and separate importer/verifier/cleanup tokens | No routine policy editing or unrestricted token creation |
| Custody | New trunk UID/GID 1004 and `.local/trunk-credentials/` | Keeps trunk tokens separate from endpoint UID/GID 1003 |
| Bootstrap access | Existing authorized platform custodian, otherwise separately approved recovery | Establishes new roles without misusing endpoint administration |
| Acceptance | Real OpenBao, PostgreSQL, Redis and two HTTP replicas | A design approval alone cannot complete P3-U3a |

## Why another approval is needed

The approved OpenBao review explicitly says:

> Approval of this design does not authorize temporarily weakening it or executing
> root recovery.

See [section 2](p3-u3a-openbao-trunk-credential-review.md#2-storage-and-ownership-boundary).
The normal listener currently disables root-generation endpoints in
[server.hcl](../../infra/openbao/server.hcl). The existing bootstrap command
revokes its root token and removes its bootstrap file after setup. Source review
therefore does not establish an available, valid platform custodian token today.
No private token value has been read or tested for this document.

Two choices remain: supply an already authorized platform custodian through
protected deployment custody, or authorize the exact recovery below. I recommend
recovery only if the first choice is unavailable. Approval of this document would
cover that conditional procedure; it would not permit routine root recovery.

## Proposed non-secret provider profile

This profile is an acceptance fixture, not a working carrier or deployment default.
Its reserved address and `.invalid` identity must never be contacted. Production
or real carrier support requires a separate concrete provider declaration.

| Field | Proposed exact value or rule |
| --- | --- |
| Profile identity | `synthetic-trunk-outbound-v1`, immutable revision 1 |
| Installation | Disposable acceptance installation UUID, generated and recorded before provisioning |
| Peer and connection IDs | Server/deployment-generated UUIDs recorded in the same immutable fixture manifest |
| Trunk kind and direction | `sip-peer`, `outbound` |
| Authentication | `outbound-digest`; exact purpose `outbound-request` |
| Registration | `none`; no registrar or registration account selection |
| Signaling destination | Documentation address `192.0.2.60`, UDP port 5060; desired data only |
| Media | RTP; ordered codecs `[ulaw, alaw]`; direct media false, symmetric RTP true, force rport true |
| Exact authentication realm | `trunk.fixture.invalid`; no wildcard or inferred realm |
| Desired digest algorithm | SHA-256 only; no automatic fallback |
| Material | Locally generated synthetic username/password within the approved import bounds, supplied only to the protected importer |
| Initial resource state | Disabled, version 1; no tenant allocation or route |
| Credential reference | Exact owner-issued binding/generation UUIDs, generation ordinal, material version 1 and expected owner revision |
| Qualification | Owner verification valid for at most 60 seconds by database time; association never asserts carrier acceptance |
| Ingress | No source claim or gateway required for this outbound fixture |

The SHA-256 choice is a proposed desired profile constraint, not a claim that the
pinned Asterisk/PJSIP build has been verified to support it. Exact module/algorithm
compatibility must be established before any P3-U5 apply. Failure to establish it
blocks that later apply; it does not authorize downgrade. This foundation never
sends an authentication exchange.

Use separate IP-peer fixtures for standalone/linked gateway and source-conflict
acceptance. Their exact deployment declarations and disjoint documentation IPs
must be recorded in the fixture manifest; no live ingress changes follow.

Optional outbound registration remains approved in principle by the earlier
review, but this profile does not enable it. A concrete registrar, protected
registration identity and compatible profile are still required before accepting
that mode. It must not be advertised as implemented from the digest-only fixture.

## Proposed credential files and roles

These are recommended future locations, not credentials already available here.
The user does not need to paste a token, password or unseal key into chat.

| Protected location | Owner and use |
| --- | --- |
| `.local/trunk-credentials/issuer.token` | UID/GID 1004, mode 0600; trusted launcher only, exact precreated trunk token roles |
| `.local/trunk-credentials/importer-<installationUuid>.token` | Protected importer; exact installation create/read, immutable CAS=0 keys |
| `.local/trunk-credentials/verifier-<installationUuid>.token` | Dedicated verifier; exact installation read only |
| `.local/trunk-credentials/cleanup-<installationUuid>.token` | Explicit cleanup only; exact read/metadata/destroy under approved lifecycle checks |
| `.local/trunk-credentials/ca.crt` | Verified provider TLS trust; mount only with required runtime files |
| `.local/trunk-credentials/owner-db-password` | Dedicated attestation DB role; importer/verifier only as required, never ordinary HTTP |

Keep the directory mode 0700. Check that UID/GID 1004 is unused before assigning
it; if occupied, stop and record a different distinct ID before provisioning.
Mount individual runtime files, never the whole custody directory into a worker.
Do not copy endpoint material, seal custody or the endpoint administrator token
into it. Issuer and cleanup tokens never enter the verifier container.

The shared platform custodian remains a privileged deployment owner. It creates
mounts, policies and exact token roles during explicit administration, then leaves
routine issuance to restricted issuers. Endpoint and trunk issuers cannot edit
policies/roles, select extra policies, issue root/default-policy tokens or invoke
generic token creation. Runtime tokens retain the approved one-hour TTL and
24-hour maximum; renewal cannot bypass that maximum. At expiry, use trusted
reprovisioning. Do not add unattended root recovery to make tests or workers run.

Update endpoint provisioning and acceptance launchers to use precreated exact
roles before retiring the old administrator. Existing endpoint worker/cleanup
policies and material access stay intact. New acceptance installations require
explicit custodian-created roles; an issuer cannot invent installation scope.
The [token API](https://openbao.org/api-docs/auth/token/) documents token-role
controls; actual restriction and orphan-token behavior require real ACL tests.

## Subsequent October 19 readiness review

The user explicitly withheld execution authorization. The updated
[pre-execution report](../status/p3-u3a-provisioning-preexecution.md) records the
required disposable deadline demonstration, full-graph rerun, exact restoration
baseline and tested/unverified safeguards. Unexpected privileged ACL/token/lease/
policy findings stop the procedure for separate review; this later condition
supersedes any interpretation allowing automatic remediation of additional issuers.
Only the exact old administrator and expected policy in the reviewed operation
manifest may be remediated after explicit execution authorization. The final report owns the refined handoff order: verify successors, revoke the
known recovered root, prove successor independence, then let the human custodian
retire only the exact reviewed old administrator. The new
[custodian succession proposal](p3-u3a-custodian-succession-review.md) makes future
administration concrete; its auth setup is not installed and requires explicit
inclusion in the final execution authorization.

## Conditional one-time recovery procedure requested for approval

This procedure applies only to the retained private development OpenBao instance.
It reuses the existing seal custody and retained Raft/audit volumes. It must not
initialize a new server, delete volumes, publish a port or disable verified TLS.

1. **Prepare before touching the service.** Build and review the restricted-role
   provisioning changes, endpoint launcher changes, recovery helper and cleanup
   path. Record the exact installation/policy/token-role manifest, original
   provider configuration and network attachments, and current endpoint baseline.
   Confirm existing recovery custody is available without printing it. If an
   already authorized custodian suffices, skip recovery entirely.
2. **Isolate and pause provider work.** Pause endpoint/trunk credential processing
   and trusted provisioning. Quiesce active provider operations and record pending
   intents for reconciliation. Temporarily isolate OpenBao and the recovery helper
   on a dedicated internal recovery network with no published ports and no
   application/ordinary-worker/endpoint-worker access. Preserve its verified TLS
   identity. Keep the original network manifest for exact restoration.
3. **Enable recovery only in that isolated window.** Use a temporary deployment
   configuration with `disable_unauthed_generate_root_endpoints = false`, restart
   the retained service and manually unseal through protected custody. Keep the
   committed normal configuration set to `true`. No other listener or TLS setting
   changes. Start a maximum 15-minute recovery window; on timeout restore the
   protected listener, and keep workers paused pending review.
4. **Recover the administrative token privately.** Use the existing development
   seal-key quorum through the isolated helper. Hold OTP, quorum material and
   recovered root token in protected process memory or owner-only container tmpfs;
   never command arguments, environment variables, application output, chat or
   source files. The existing one-share development custody remains a limitation.
5. **Install only the reviewed changes.** Create `myims-trunk`, exact installation
   policies and fixed token roles; issue bounded orphan endpoint/trunk restricted
   issuer credentials into their separate custody so recovered-root revocation
   does not revoke the replacements. Replace endpoint provisioning's
   generic issuance and policy editing. Remove self-editing/unrestricted issuance
   from the old endpoint administration policy and revoke its token and any known
   equivalent issuer. Check for other active principals with equivalent routine
   privilege; incomplete coverage prevents declaring administrative isolation.
   Preserve existing orphan endpoint worker/cleanup leases and permissions.
6. **End root authority.** Revoke the recovered root token, cancel any unfinished
   root-generation attempt, and remove transient recovery material. A failed or
   uncertain revocation is a recovery failure, not a successful handoff. Retain
   protected access only for resolving that exact uncertainty; do not resume work.
7. **Restore the normal protected service.** Remove the temporary override, restart
   with `disable_unauthed_generate_root_endpoints = true`, manually unseal, verify
   anonymous root-generation denial and verified TLS, then restore exact normal
   network attachments and remove the recovery network/helper. Check that provider
   ports remain unpublished and audit/raw-value logging settings are preserved.
8. **Verify before resuming.** Prove exact restricted issuance and escalation denial,
   old-admin denial, reciprocal endpoint/trunk and cross-installation ACL denial,
   unchanged endpoint runtime rights, process/custody isolation and token bounds.
   Resume credential processing only after restoration checks pass. Reconcile
   recorded uncertain operations and run affected acceptance/regressions.

Temporary endpoint unavailability is expected during restart/seal/isolation.
The console and unrelated services need no restart for this recovery; credential
actions must report unavailable while their owner is paused. This is a shared
provider maintenance window and affects both lifecycles. No PBX reload, SIP
registration or call forms part of recovery.

If any step fails, prioritize restoring the protected listener and isolating the
provider, preserve retained volumes/custody and the safe operation manifest, and
report the exact incomplete step. Never destroy retained data, broaden routine
permissions or restart acceptance with a new intent to conceal uncertainty.
Successful recovery does not imply successful trunk lifecycle acceptance.

The [OpenBao TCP listener reference](https://openbao.org/docs/configuration/listener/tcp/)
documents the recovery-endpoint switch. The [root-generation API](https://openbao.org/api-docs/system/generate-root/)
describes the quorum process. The repository's [previous recovery record](../runbooks/endpoint-credentials.md#provisioning-checkpoint-and-recovery-gate--2026-10-16)
is precedent and evidence of the old event; its approval does not approve this new window.

## What completion will mean

The [focused lifecycle child](../../context/feature-specs/p3-u3a-1-isolated-trunk-credential-lifecycle.md)
requires real provider import, exact verification, authority fencing, recovery,
cleanup races and process/ACL checks. P3-U3a additionally needs real database/runtime
grants, protected HTTP A/B creation/adoption/version/status behavior, source and
relationship races, audit rollback, bounded passive reads and full required checks.

The operator selects opaque references. HTTP and browsers never receive SIP
passwords or provider tokens. A successful result means the exact desired
association was committed with a recent owner attestation. It does not mean the
carrier accepted it, Asterisk used it, registration worked or old material was revoked.

## Suggested approval wording

> Approve this document's synthetic outbound-digest profile for controlled private
> development acceptance, with registration disabled and no carrier/PBX contact.
> Approve the separate trunk custody and restricted-role provisioning described
> here. Use an existing authorized platform custodian if available; otherwise
> approve the conditional one-time isolated OpenBao recovery procedure in this
> document, including the temporary recovery-endpoint setting, restarts/manual
> unseal, private quorum recovery, endpoint administration remediation, root
> revocation and exact protected-service restoration. Require the stated checks
> and cleanup before declaring success. This approval covers this development
> recovery window only; future recovery, real carrier profiles, registration,
> delivery/live apply/calls and production remain separately gated.

## Current evidence

This document is based on repository source/runbook review, the official OpenBao
references above and a read-only running-container listing on 2026-10-19. The
retained OpenBao, PostgreSQL, Redis and application containers were running.
No token validity, root recovery, provider mutation, material import, schema
migration or service restart was performed for this document. Proposed commands,
roles and profile are not yet verified implementations.
