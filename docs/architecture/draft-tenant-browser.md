# Protected draft tenant browser contract

P4-U1a-2 extends the existing `ConsoleAccess` and named Next boundary. Backend
[registry authority/DTO/receipt rules](draft-tenant-registry-api.md) remain unchanged.

Delivered local paths are `/tenants`, `/tenants/create`, and `/tenants/<UUID>`.
Safe returns accept these literal paths, `/` and the existing `/ui-preview`;
queries, fragments, encoded paths, path traversal, foreign URLs and sign-in loops
are rejected. Detail references follow the API's case-insensitive UUID grammar.

The only forwarding consumers are POST/GET `/platform/tenants` and GET
`/platform/tenants/<UUID>`. Next bounds the 4096-byte UTF-8 JSON body, stream time,
query keys, duplicate parameters, 1–100 page limit and UUID cursor/reference.
Backend strictly validates the exact DTO and authorizes every request. The server
transport forwards only configured trusted proxy proof, ingress-derived client
source, canonical cookie channel, exact Origin and session-bound mutation CSRF.
No arbitrary destination, actor/role header or bearer override is forwarded.
Responses/server composition/client reads use `no-store`; 429/503 Retry-After is
bounded to 1–900 seconds. Field/conflict/missing outcomes remain distinct from
access loss. List/detail use passive activity and never renew through polling.

The protected server layout establishes initial composition. Client named reads
reload on resource change, explicit reload or restored canonical access; each read
also passes the backend guard. Client DTO validation fails closed. Protected data
is hidden/inert on access rejection, and overlays use the existing scope.

`useOperatorWork()` minimally adds typed draft values and an unresolved attempt,
held by the existing canonical-owner `RetainedWork` mechanism. Capture supplies
an owner/epoch/access predicate and current CSRF only for immediate transport;
CSRF is never recorded in draft work. Before mutation the presentation flow
reauthorizes, then the protected consumer enforces backend authority. A logical
submission captures a UUID and its input once. The attempt is recoverable as soon
as transport begins. Pending state synchronously locks repeated submissions.

Definitive 400/409 clears the unfinished attempt while preserving editable values.
Unavailable/lost outcomes retain its UUID/input; editing cannot replace it.
Explicit original retry sends the exact original DTO. Only 201/new or 200/replay
with a valid canonical detail releases finished work and navigates. There is no
automatic write replay. A late result must still satisfy its captured canonical
owner, access epoch and mounted-work predicate; old results cannot navigate,
reject the new session or repopulate its values. Same-owner reauthentication
preserves work; another owner/logout clears it and remounts the shell.

Unfinished recovery lasts only as long as mounted memory survives. Saved drafts
and receipts remain canonical. No database/session store exists in Next and no
browser storage holds form values or credentials. Tenant-qualified administrator
IDs are shown/read only through authenticated detail contracts; credential setup,
activation, edit/onboarding configuration and PBX remain downstream.

## Verification selectors

- `./dev exec pnpm check:draft-tenant --api`: child 1 A-01–08 and diagnostic checks.
- `./dev exec pnpm check:draft-tenant --browser`: production Next/HTTPS journey,
  real credentials, two Nest processes, PostgreSQL/runtime grants and session Redis;
  tenant acceptance plus existing platform browser regressions.
- `./dev exec pnpm check:draft-tenant`: both boundaries in one disposable fixture.
- `./dev check`: owning full graph, including combined session checks, tenant API
  and browser coverage, identity/audit regressions and all five client scans.

The launcher drops only its owned disposable database/Redis container/config,
processes and sockets; production browser verification output is retained under
ignored `.local`, separate from the normal shipping build. TLS/response-loss,
Redis pause and delayed delivery controls establish this local boundary, not
production hosting/HA or usable staff credentials.

## P4-U1b-1 editing extension

The named `saveTenantSection` client and POST
`/platform/tenants/<UUID>/configuration` Next consumer extend the protected boundary.
Next rejects queries, malformed/extra fields and oversized bodies before forwarding;
backend owns canonical field validation, authority and transaction eligibility.
Search/filter criteria reset UUID cursors; resource and canonical-owner captures
fence old responses, including before effect cleanup. Search is explicitly submitted.

Name and contacts each have an explicit save, captured row/authority versions and
request UUID. Their nonsecret mounted state is keyed by tenant UUID inside the
canonical-owner shell, surviving same-owner reauthentication while the component
remains mounted. Navigation to another target discards that component and fences
callbacks; owner replacement remounts the shell. Refresh restores committed data.
Access loss hides/inerts work using existing ConsoleAccess and clears credential
code disclosure using the existing issuer component. No browser storage is used.

Validation/conflict preserves input. Original uncertain attempts block replacement
submissions until an explicit original retry resolves them. Reads never replay a
mutation. The response's original outcome versions are shown separately from fresh
canonical detail, so replay does not restore historical contact values. Explicit
reload preserves unsaved section input; a separate discard action adopts the
loaded canonical version. Clean sections follow canonical refresh versions.
Contacts remain informational and partially completed contacts are visibly incomplete.
The immutable code, administrator linkage and issuer panel remain in detail.

Focused selectors are `./dev exec pnpm check:draft-tenant --onboarding-api` and
`./dev exec pnpm check:draft-tenant --onboarding-browser`; these extend the existing
registry API/browser fixture and preserve `--api`, `--browser` and no-flag behavior.

Current API/HTTPS browser, affected credential/session regressions, full normal
graph and ordinary HTTPS preservation passed; [P4-U1b-1 evidence](../status/p4-u1b-1-evidence.md).
