# P3-U3a — Existing retained backup and maintenance authority verification

Prepared: 2026-10-20 (Asia/Manila, +08:00). **Completed under two separately
approved limited sessions.** The first stopped before capabilities and was
revoked/403. After corrected parsing/display-name validation and complete
native disposable workflow testing, the separately approved second session
passed all identity and ten-path capability comparisons and was revoked/403.
Owner accepted and closed the named checkpoint as successfully completed.
Both authorizations are consumed; no additional login is authorized.
[Current sanitized findings](../../../../../status/p3-u3a-retained-capability-session-2.md).
Retained remediation, backup capture and inventory access remain unapproved.
Separate backup/maintenance availability remains unknown. No custody discovery.
The [consolidated backup/maintenance design](p3-u3a-sustainable-openbao-administration-design.md)
is prepared for separate review only. The exact original requested scope follows
for traceability.

## Requested decision

Approve one attended capability-verification session for the existing named human
`platform-owner-custodian`, using the documented `platform-custodian` userpass
mechanism and its exact already documented protected password handoff. No search
of directories, mounts, backups, credentials or other accounts is permitted. If
that exact handoff is unavailable, stop and ask the owner to identify the existing
mechanism; do not discover a substitute. Do not request secret contents in chat.

Permit one login (therefore one newly issued existing-policy human session, at
most 900 seconds), self lookup, one capability-query batch, and self revocation
with a final self-lookup denial check. No renewal, replacement login, child token,
issuer access or privileged ticket is included. A failed/uncertain login stops;
do not retry issuance. Use the existing protected session helper/custody pattern,
verified TLS and private provider path, with no secrets in argv, environment,
source, application mounts or safe evidence.

## Exact observation scope

- Login only at `auth/platform-custodian/login/platform-owner-custodian`.
- `auth/token/lookup-self`: validate expected identity/policies, no unexpected
  identity policies/period, and bounded session attributes; retain sanitized facts.
- `sys/capabilities-self`, solely for the exact paths below. This POST inspects
  the current session's capabilities; it grants no authority and performs none
  of the operations being queried:
  - `sys/storage/raft/snapshot`;
  - `sys/policies/acl/platform-deployment-maintainer`;
  - `sys/policies/acl/endpoint-restricted-issuer`;
  - `sys/policies/acl/trunk-restricted-issuer`;
  - `sys/policies/acl`, `auth/token/roles`, `sys/auth`;
  - `identity/entity/id`, `identity/group/id`, `auth/token/accessors`.
- `auth/token/revoke-self`, followed by `auth/token/lookup-self` to verify denial.
  A denial alone without acknowledged revocation is recorded as uncertain cleanup.

Do not fetch the snapshot, policy bodies, identity/group/auth/role/accessor
inventories, secret material or audit contents under this request. Querying
capabilities does not prove effective policy composition or a complete server
inventory. Do not test writes or use unexpected extra privileges. Any unexpected
identity/authority, uncertainty or TLS mismatch stops observation and permits
only the owned session's cleanup; report the discrepancy for review.

## Existing backup route, supplied by owner

Alongside this request, ask the owner to identify any existing backup job/operator
or snapshot reader by **non-secret** principal/job name, responsible custodian,
authorized access mechanism, snapshot scope, audit preservation, destination
protection and latest success/restore evidence. The owner may supply that metadata
without granting access. No broad custody discovery or conclusion of absence is
allowed. Current known custodian source lacks snapshot/full-inventory capability;
this request only revalidates its current capabilities.

An owner-identified other reader/job is not covered by the named session above.
Prepare its exact named access/read scope for approval before using it. If the
owner supplies no route, record **availability unknown**; if an identified route
is insufficient, record the exact gap rather than asserting all routes absent.
A denied capability check never authorizes creating a new privilege.

## Result and next gate

Return only principal/mechanism names, expected versus observed capability facts,
owner-supplied route metadata, verification limits and session cleanup status.
No secrets/accessors or sensitive configuration enter committed evidence.
This establishes a bounded availability report, not backup durability, restoration,
current whole-server authority or security acceptance.

A usable named route leads to a concrete execution package covering independently
authorized inventory, fresh native backup plus separate audit, recovery
prerequisites, exact policy hardening and validation/cleanup. Missing scope leads
to one explicit lasting-capability proposal for separate approval. This request
allows no policy/role/auth change, backup capture, token issuance beyond the one
human login, ordinary lease revocation, restart, root recovery, restoration,
SIP/PBX activation or deployment. Local implementation continues independently.
