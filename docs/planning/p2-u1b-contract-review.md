# P2-U1b role and admission contract — review for approval

**Status: sections 1–4 approved with revised creator closure, 2026-10-05 (Asia/Manila, +08:00).**
Prepared: 2026-10-05, Asia/Manila (+08:00).
Decision owner: project owner (user).

This document presents the decisions needed to implement
[P2-U1b](../../context/feature-specs/p2-u1b-role-contracts-and-canonical-tenancy-admission.md).
P2-U1a storage is complete and its PostgreSQL checks passed again. Only its
account/credential storage representation has prior approval. The proposals below
cover D-01 and the eligibility/admission portions of D-05/D-06, providing a scoped
P1-U1 handoff. The user explicitly approved this scoped handoff with the creator-closure change
recorded below. Unrelated P1-U1 decisions remain deferred.

## 1. D-01 — Fixed roles and combinations

Approved fixed staff role codes:

| Code | Role | Main responsibility |
| --- | --- | --- |
| `tenant_admin` | Tenant administrator | Manage own tenant's staff and permitted configuration |
| `call_taker` | Call taker | Intake, incident creation and open-incident editing |
| `dispatcher` | Dispatcher | Dispatch, assignment cancellation and incident closure |
| `responder` | Responder | Work on own assignments and share own availability/location |

Each staff account has one to four distinct roles. Any nonempty combination of
these four is allowed, including administrator plus operational roles. Duplicate,
empty, unknown or platform role grants are invalid. Permissions combine within
that staff account's canonical tenant only. There are no custom roles or editable
permission bundles in this unit.

A tenant administrator has no implicit call-taker, dispatcher or responder
permissions. For example, an administrator who also handles intake needs
`tenant_admin` plus `call_taker`; one who also dispatches or closes other creators' incidents
needs `dispatcher` as well. Closing their own incident requires no extra role.

Platform operators have only `platform_operator` authority in their separate,
tenantless store. It cannot be assigned to staff or become tenant membership.
Platform operators cannot impersonate tenant staff through this contract.

## 2. D-01 — Permission bundles

Approved [D-01 matrix](p1-u1-product-contracts.md#1-d-01--permissions),
shown here so the decision can be reviewed in one place. “Own tenant” always
requires canonical ownership and applicable use-case checks. Roles establish
permission bundles; later units implement the listed workflows and safeguards.

| Action | Platform operator | Tenant admin | Call taker | Dispatcher | Responder |
| --- | --- | --- | --- | --- | --- |
| Shared PBX infrastructure and tenant registry/lifecycle | Yes | No | No | No | No |
| Staff/roles, categories, responder profiles, tenant extensions | No | Own tenant | No | No | No |
| Operational incident queues/details/timeline | No | Requires operational role | Own tenant | Own tenant | Assigned incident's operational subset |
| Own intake drafts; create incident | No | Requires call-taker role | Yes | No | No |
| Edit open incident and correct saved location | No | Requires call-taker or dispatcher role | Yes | Yes | No |
| Dispatch, cancel assignment | No | Requires dispatcher role | No | Yes | No |
| Close incident | No | Creator, or with dispatcher role | Creator | Own tenant | Creator |
| Accept/progress/complete assignment | No | Requires responder role | No | No | Own assignment |
| Set own availability/share own foreground position | No | Requires responder role | No | No | Yes |
| Set another responder's availability | No | Yes, audited reason | No | Yes, audited reason | No |

**Approved closure decision:** the staff user who created the incident may close
that incident without also holding the dispatcher role solely for closure.
Dispatchers retain own-tenant closure permission. Both paths remain subject to
closure-state, outstanding-work, audit and other safeguards in the owning
D-02/D-03 units. Creator permission must use the canonical creator relationship;
it does not grant closure of another user's incidents or cross-tenant access.

A responder role provides the assigned incident's required operational subset,
not a full tenant incident directory or unrestricted reporter/audit access.
Exact mobile fields remain a P6-U1 decision. Evidence, recording and recovery
permissions remain separate later decisions.

## 3. D-05 — Account and credential eligibility

Retain the approved storage states: account `active`/`disabled` and credential
`unset`/`ready`. Approved eligibility meaning for both planes:

| Account | Credential | Account/credential eligibility |
| --- | --- | --- |
| active | ready | Passes this part of eligibility |
| active | unset | Denied |
| disabled | ready | Denied |
| disabled | unset | Denied |

`ready` must have coherent canonical credential metadata as required by a's
storage contract. Unknown or malformed states, invalid versions and invalid
authority deny eligibility. General authority snapshots contain no password hash;
credential verification uses a private port.

Eligibility does not verify a password, authenticate a user or admit a request.
Password policy, usable hashing/bootstrap, sign-in and session enforcement belong
to c and subsequent units.

## 4. D-06 — Ordinary tenant admission

Approved ordinary staff eligibility only when all required canonical facts pass:
active tenant, active account, ready credential, valid approved roles and positive
valid versions.

| Canonical tenant status | Ordinary staff eligibility, assuming all other checks pass |
| --- | --- |
| draft | Denied |
| active | Eligible |
| suspended | Denied |
| retired | Denied |

Platform eligibility checks its own active account, ready credential, valid
platform authority and versions independently of tenant lifecycle. It grants no
tenant authority.

Missing identities, foreign tenant-qualified staff IDs, wrong-plane inputs and
malformed authority yield no usable authority. PostgreSQL loading failures return
`unavailable`, distinct from denial, with no authority or fixture/cache fallback.
Client-selected roles or tenant IDs cannot create canonical authority.

A draft setup token may eventually permit initial credential setup under P2-U4;
it never makes a draft staff identity operationally eligible in b. No draft setup
exception is approved by this review.

## 5. Implementation authorized after this decision

The original request already authorizes implementing b. Approval of sections 1–4
resolves its product gate so implementation can continue under the feature spec:

- Persist approved roles and preserve a's ownership/credential constraints.
- Supply private, separate staff/platform eligible/denied/unavailable snapshots
  from coherent, bounded primary PostgreSQL reads.
- Coordinate role/status/credential and tenant-status mutations with expected row
  versions, monotonic authority versions and event-specific audit in one transaction.
- Preserve no-op versions; roll back stale/failed writes; prove concurrent reads,
  conflicts, audit failure and suspend/reactivate version behavior.
- Run B-01–07, a regressions and `./dev check`, then record evidence and completion.

These are implementation commitments from the spec, not evidence of completed
behavior. b adds no login routes, sessions, guards, tokens, role-management UI,
general lifecycle/admin APIs or PBX coordination.

## 6. What remains deferred

This is a partial P1-U1 handoff, not completion of P1-U1 or parent P2-U1.
The following remain with their existing decision gates and owning units:

| Deferred contract | Owner/unit |
| --- | --- |
| Password policy and usable operator bootstrap credentials | User decision; P2-U1c |
| Setup/reset delivery, token lifetimes, recovery and last-admin safeguards | D-05; P2-U4/P4 |
| Session lifetimes, authentication, revocation and socket enforcement | P2-U2–U4 and later integrations |
| Allowed lifecycle transitions, activation prerequisites, active work/call drain and routing effects | D-06; P4-U3 and telephony owners |
| Incident/assignment transitions, closure safeguards and dispatch eligibility | D-02/D-03; P5–P6 |
| Exact responder mobile disclosure and evidence/recording/recovery grants | P6-U1 and later permission gates |

## 7. Review response

The user approved sections 1–4 and instructed implementation to continue, with
the revised creator-closure rule above. The original review response was:

> Approve the P2-U1b role and admission contract in sections 1–4, including the
> scoped P1-U1 handoff. Continue implementing P2-U1b.

To change it, name the section and desired rule, for example:
“Section 2: allow call takers to close incidents without a dispatcher role.”
Approval is recorded in the authoritative product contracts and tracker. Later
changes should identify the affected section and desired rule.
