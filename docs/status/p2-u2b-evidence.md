# P2-U2b canonical HTTP authority evidence

Completed: 2026-10-06 09:48 +08:00 (Asia/Manila). Status: complete; B-01–07 passed.
Requirement: [B-01–07](../../context/feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md).
Contract: [canonical HTTP authority](../architecture/canonical-http-authority.md).

## Implementation and acceptance mapping

| ID   | Implementation and evidence                                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Canonical HTTP contract defines primary reads/version matching, discriminated principals, approved grants, explicit routes, generic errors, conditional activity and transaction boundaries.                                                                                                                                                                      |
| B-02 | Separate Nest listeners in two independent child processes share actual Redis/PostgreSQL; private IPC issuance on A is accepted on B with identical principal/actor. Same-named two-tenant staff, hostile inputs and opposite planes checked.                                                                                                                     |
| B-03 | Real owner adapters mutate/audit staff roles, status and unset/replaced credentials, operator status/credentials and draft/suspended/retired tenant states. Old tokens deny on both replicas even after restoration. Isolated canonical connection outage produces 503 without write or renewal.                                                                  |
| B-04 | Global explicit metadata rejects unclassified handlers, requires approved plane/grants, preserves public health and maps canonical audit actors. Owning fixture service rejects foreign resource tenants independently of guard permission.                                                                                                                       |
| B-05 | IPC barrier before owner locks proves changed expected version rejects without write. Barrier after locks proves a tenant mutation waits on PostgreSQL lock until sensitive write/audit commit. Successful operational renewal, passive/denied/failed activity, late revocation and post-handler renewal outage checks exercise HTTP timing.                      |
| B-06 | Actual pre-change Redis records restored after role/account/credential and tenant state restoration deny through monotonic canonical versions. Revoked pre-request record restoration denies through a's durable fence on both HTTP replicas; a's physical Redis restart/restore regressions also run.                                                            |
| B-07 | Authority selection includes a regressions; full Docker includes the default combined selection and five-client sentinel scans. Captured process diagnostics/audit and every HTTP result exclude private token/hash/credential sentinels. Fixtures exist only in scripts and cleanup only their unique database/Redis container. Final full check passed, exit 0. |

## Commands and observed results

- `./dev exec pnpm --filter @myims/backend typecheck`: passed, exit 0.
- Initial `./dev exec pnpm check:session-foundation --authority`: passed, exit 0,
  B-02–06 real HTTP checks plus A-01–07 lifecycle/recovery regressions.
- Initial `./dev check`: lint passed; stopped at formatting in the subsequently
  expanded authority verification script. Formatting corrected before the final run.
- Final `./dev check`: passed, exit 0. Includes workspace lint/format/typecheck,
  all web/mobile/backend builds, independent production entrypoint/outage startup,
  configuration, foundation, audit/outbox, worker recovery, storage, identity and
  bootstrap, five-client sentinel scans, isolated provider deployment and final
  combined authority/lifecycle checks. The final HTTP suite also verifies Redis
  loss after handler success returns retryable 503 without renewal.
- Final backend lint/startup formatting checks passed after tightening bounded
  Redis capacity validation before exposing the HTTP lifecycle; final builds and
  production/foundation entrypoint checks consume that implementation.
- Documentation consistency/relative links, formatting, `bash -n dev` and
  `git diff --check`: passed.

The authority harness uses actual deployment migrations/runtime grants, independent
canonical pools and isolated real TCP dependency failures. Trusted fixture
administration is limited to the current unique database and container. Sensitive
writes use existing `Transaction`, owning lock ports and append-only audit.

## Limits and consumer handoff

b establishes protected bearer **fixture** HTTP authority, not sign-in, public
session issuance, cookie/CSRF, mobile storage, administrative routes, sockets,
production ingress/HA, distributed limits or parent completion. c receives global
guards, principals, safe authentication outcomes, post-success activity,
transaction authority ports and the two-replica fixtures. U3/U4 receive the explicit
credential-channel and expired-work reauthentication preservation requirements.

An authorized request may be in flight when authority changes. The sensitive-write
fixture serializes relevant canonical changes through transaction locks; completed
work is not canceled. A committed write can be followed by renewal failure, so
consumers must reconcile canonical state and honor their owning duplicate-request
contract. Automatic Redis reconnection/comprehensive recovery and 429 integration
remain c. See the [verification runbook](../runbooks/canonical-http-authority.md).
