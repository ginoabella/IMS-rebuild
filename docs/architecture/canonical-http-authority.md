# Canonical HTTP authority

P2-U2b implements [B-01–07](../../context/feature-specs/p2-u2b-canonical-authority-validation-and-http-guards.md)
using the approved [role/admission grants](canonical-authority-admission.md) and
[shared lifecycle/fencing policy](shared-session-lifecycle.md).

## Request validation and principals

`IdentityHttpModule.register` installs a global `AuthorityGuard` and
`ActivityInterceptor`. Every handler must declare `HttpAccess`: explicit public,
or protected with explicit credential channel, plane, nonempty permissions and
passive/operational activity.
An unclassified route receives generic 403 before its handler runs. Foundation
and health routes are explicitly public. Method policy overrides class policy;
review such overrides as part of the route's owning module.

The guard reads the shared Redis session through a's lifecycle and durable
PostgreSQL recovery fence, then reads current primary canonical authority on
**every protected request**. Platform lookup uses operator ID. Staff lookup uses
both session tenant ID and staff ID through typed owner ports. Eligible facts
require active account, coherent ready credential, approved roles/authority,
positive matching authentication version and, for staff, active tenant and
matching tenant authority version. Unknown/malformed facts and version mismatches
reject. Restore, reenable and reactivation cannot restore old token authority.
Canonical read failures remain unavailable; they are never missing accounts.
There is no cross-request principal or role cache.

The frozen discriminated principal carries platform operator ID and fixed
`platform_operator` grant, or tenant-qualified staff ID, current approved roles
and permission union, plus canonical versions. Platform authority is the existing
fixed operator bundle, not a new staff permission. `requestPrincipal(request)`
reads backend state from a WeakMap; headers, body, URL fields and arbitrary request
properties cannot populate it. `principalActor` maps it to existing platform or
staff audit actor conventions. A route tenant is a resource selector: the owning
application service must enforce canonical ownership and domain restrictions.
Plane mismatch and missing required grants receive 403.

## HTTP outcomes and activity

| Outcome                                                                  | HTTP                                            | Protected work / renewal        |
| ------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------- |
| Missing, malformed, expired, revoked, stale or ineligible authentication | 401, `Authentication required`                  | No handler work / no renewal    |
| Valid wrong plane, insufficient grants, missing route policy             | 403, `Access denied`                            | No handler work / no renewal    |
| Redis, recovery fence or canonical database unavailable                  | 503, `Service unavailable`, `Retry-After: 1`    | No handler work / no renewal    |
| Authorized passive request                                               | Owning handler result                           | Handler work / no renewal       |
| Authorized operational request succeeds with 2xx                         | Owning handler result after conditional renewal | Handler work / atomic a renewal |
| Handler throws or returns non-2xx                                        | Owning safe failure                             | No renewal                      |

Protected responses have `Cache-Control: no-store`. Authentication responses are
bounded and disclose no token, username, hash, credential or exception details.
A renewal which detects invalidation returns generic 401; conditional conflict or
unavailable/uncertain renewal returns retryable 503. It cannot falsely claim a
successful renewal. An operational write may already have committed before that
response: consumers must reconcile canonical state and use their owning duplicate
request contract rather than assuming a rollback. Renewal never recreates a
revoked key and keeps the original absolute deadline. Polling, health, heartbeats
and merely open applications must declare passive activity. Owning controllers
must throw/map unsuccessful application results before operational success.

HTTP starts even when session Redis cannot connect, so public health remains
available. Protected access fails closed. The existing bounded Redis adapter
closes broken connections; a later new operation establishes a bounded fresh
authenticated/capacity-validated connection. c adds
[distributed admission and integrated recovery](distributed-admission.md), without
ambiguous write replay or memory-session fallback.

## Sensitive transaction boundary

Request authorization establishes authority at a request boundary. An already
validated request can remain in flight during an authority change. It does not
promise cancellation of completed work or a PostgreSQL/Redis distributed transaction.

Sensitive owning use cases call `TransactionAuthority.validate(tx, principal)`
inside their existing `Transaction`, before writing. Typed owner adapters lock
canonical rows `FOR SHARE`, first tenant then qualified staff, or operator for
platform. They reconstruct eligible facts and compare expected authentication and
tenant authority versions. The caller must abort the transaction when validation
returns false; SQL failures must propagate and poison/roll back the transaction.
The locks remain held through the same transaction's sensitive write and audit.
Canonical owner mutations acquire conflicting `FOR UPDATE` locks. Multi-row
consumers must follow tenant then staff lock order; deadlock/timeout is a failed
transaction, never permission to proceed. This serializes the relevant change
against the write or rejects a previously changed expected version. A second
unsynchronized read is insufficient.

The representative fixture use case checks resource tenant ownership, revalidates
versions under locks, inserts its disposable write and appends canonical actor
audit on the same runtime connection/transaction. Its controls use trusted IPC
barriers before and after lock acquisition. Fixture tables/controllers/issuance
are defined only in `scripts/`, absent from production HTTP module imports.

## Transport and consumer handoff

Bearer consumers explicitly declare `channel: 'bearer'` and accept exactly one
well-formed Authorization header. They reject cookies and malformed/duplicate
bearers. Cookie consumers explicitly declare `channel: 'platform-cookie'`, and
must use a platform policy. The [platform auth contract](platform-authentication-http.md)
defines origin/proxy/source checks, Secure cookies and context-bound CSRF.
No credential is accepted from body/URL or silently selected from conflicting
channels. Missing route or channel classification denies. Cookie support proves
the backend transport only; actual platform UI/proxy and reauthentication remain
P2-U3b. U4 owns mobile transport/protected device storage. Preserve unfinished
incident work with identity/tenant isolation during reauthentication.

c receives reusable guards, principals, safe HTTP errors, activity integration,
transaction ports and two-replica protected fixtures. c integrates approved shared 429
limits before protected work; b has no local limiter. Sign-in/logout, admin routes, sockets,
tenant lifecycle effects and production ingress remain their owning units.
