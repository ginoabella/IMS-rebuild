# P3-U1c browser and integrated acceptance evidence

Verified 2026-10-15 09:24 +08:00 (Asia/Manila). **C-01–07 and parent
AC-01–11 passed within the approved development registry/observation scope.**
Combined acceptance, affected regressions, full `./dev check`, all 12 shared UI
tests and the final PBX browser selection exited 0. Service-restoration and final
documentation checkpoints are recorded below.

Requirements: [C-01–07](../../context/feature-specs/p3-u1c-operator-pbx-browser-journey-and-integrated-handoff.md)
and [parent AC-01–11](../../context/feature-specs/p3-u1-register-pbx-nodes-and-observe-health.md).
Dependencies: [a evidence](p3-u1a-evidence.md), [b evidence](p3-u1b-evidence.md).
Contracts: [browser](../architecture/pbx-browser.md),
[registry](../architecture/pbx-registry.md), [observation](../architecture/pbx-observation.md).
Operations: [operator guide](../runbooks/pbx-operator-guide.md),
[observer runbook](../runbooks/pbx-observation.md).

## Environment, settings and limits

Docker Node 22.23.3, production Next 16.3.8, Playwright Chromium, actual protected
HTTPS ingress, real PostgreSQL with restricted runtime grants and isolated
session Redis. Positive journeys sign in through the actual username/password
form against provisioned canonical operator records; no fixture session issuer
or mocked API success substitutes for that journey. Two independent production
HTTP processes share canonical authority; independent telephony processes use
the shipping engine/adapter and controlled Asterisk 22.10.1 AMI-TLS.

The ephemeral browser TLS certificate uses `ignoreHTTPSErrors`; HTTPS and
Secure/HttpOnly/host-only cookie behavior are tested, workstation CA trust is not
claimed by this harness. AMI verifies the actual pinned service name/development
CA. Only telephony processes receive protected material through private fixture
IPC/files. HTTP/Next receive the safe catalog only. The account has broader AMI
`system` permissions than the application allowlist and is not strictly read-only
at the PBX. Production deployment/enforcement remain unapproved.

Approved b settings remain unchanged: freshness 30s, snapshot cadence 5s, lease
15s, renewal 3s, database/DNS/connect/login/query bounds 2s, snapshot deadline 8s,
four concurrent node sessions, retry ceiling 10s, drain 5s and forced credential
reconnect 60s; frame 16KiB, snapshot 1MiB, 1,000 endpoints/4,000 contacts. Browser
reads serialize every five seconds without session renewal or observer startup;
elapsed display age can demote old successes at the approved 30-second threshold.
List pages hold 25 nodes; forwarding accepts the existing 1–100 limit contract,
4096-byte writes and a 32MiB validated observation-response ceiling.

Actual AMI/SIP registration, PBX stop/start, credential rejection/recovery,
independent owner recovery and elapsed freshness are live integration evidence.
Response truncation/delay and trusted session-expiry controls are injected around
real operations. b separately labels its database expiry/barrier/protocol/engine
faults. The unavailable second target is synthetic: node isolation and database
ownership evidence, not live multi-PBX HA/capacity. No configuration apply,
external write-fencing, tenant allocation/activation or voice readiness is claimed.

## Acceptance reconciliation

| Criterion | Result and reproducible coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01      | Pass: actual list/register/detail/edit, named bounded GET/POST/PATCH forwarding, current server-layout/backend authority, direct/deep links, no-store, staff denial, forged fields/channel/CSRF/Origin rejection and private-ingress denial; integrated platform A/B authority checks and fresh a regressions.                                                                                                                                                                                               |
| C-02      | Pass: real operator create and canonical inspection; keyboard submit with duplicate-click suppression; bounded local/backend validation and installation collision preserve values/focus; original create key/payload replay after injected committed response loss produces one node/business audit. Version conflict preserves input; explicit canonical reload/review precedes uncertain edit retry. a repeats transaction/receipt/audit rollback and concurrent target/version races.                    |
| C-03      | Pass: saved desired version/connection separate from observation; unknown before first observation differs from real successful empty, registered and removed dynamic contacts. Real disconnect/reconnect, independent owner recovery and actual 30-second expiry display last-known/stale data. Approved reference edits, missing provider material, actual invalid AMI authentication/recovery and target edits never retain an unqualified current-health claim. No inventory/tenant readiness inference. |
| C-04      | Pass: same canonical operator explicitly resumes hidden work after injected expiry; another operator and confirmed logout clear it. No write replay occurs after authentication/access restoration. A real committed PATCH response held across identity replacement cannot overwrite replacement-operator input; a delayed detail read cannot overwrite a newly navigated list. Passive PBX reads leave the real Redis activity record unchanged; browser storage stays empty.                              |
| C-05      | Pass: actual protected API response-loss/unavailability uses the existing hidden retryable access state; finite PBX/secret/auth/destination failures remain HTTP-200 node observations. The healthy controlled node remains inspectable beside an unavailable synthetic target, with restored passive reads and no browser-created observer. Full platform suite repeats real HTTP outage/restoration.                                                                                                       |
| C-06      | Pass: actual keyboard submission, labels, actionable focus and shared announcement primitives; axe reports no violations. List/register/detail and maximum 200-character name views reflow at 1440/768/390/320 widths. Normal built-client and browser scans exclude provider credentials, authentication names, private transport/session/configuration sentinels and unsafe errors from protected output, URLs, storage, bundles and diagnostics. Screenshots contain only permitted non-secret metadata.  |
| C-07      | Pass: combined a/b/c matrix, final browser selection, affected authority/owner recovery, durable/process regressions, full Docker graph, shared UI tests, guide/contracts/index/tracker, parent command map and precise fixture cleanup. P3-U2/U5 obligations remain separated below.                                                                                                                                                                                                                        |

## Commands and results

Executed through the existing Docker workspace:

- `./dev exec pnpm check:pbx-nodes` — exit 0; fresh registry A-01–07,
  real observation/ownership B-01–08 and integrated browser/platform recovery.
- `./dev exec pnpm check:durability` — exit 0; actual transactions/audit/outbox,
  independent worker interruption/restart and bounded recovery/drain.
- `./dev exec pnpm check:entrypoints` — exit 0; isolated HTTP/deployment startup
  and finite unconfigured worker/telephony failure without listeners.
- `./dev check` — exit 0; lint, formatting, strict types, all web/mobile/backend
  builds, configuration, foundation/database/durability/storage/identity/bootstrap,
  built-client exclusions, storage deployment, session/authority/admission,
  platform/draft/staff/credential HTTP/browser and PBX registry regressions.
- `./dev exec pnpm check:ui` — exit 0, 12 tests; includes delivered PBX literal
  return-path allowlisting and shared keyboard/overlay/theme/reflow checks.
- `./dev exec pnpm check:pbx-nodes --browser` — final exit 0 after the full graph;
  includes maximum-name list/detail reflow and announcement cleanup on final source.
- Focused platform/script lint and typechecks — exit 0.
- Local documentation links, C-01–07/AC-01–11 coverage, consistency, formatting
  and `git diff --check` — final reconciliation below.

Intermediate acceptance findings were corrected before passing results: an
incorrect sign-in heading/root-versus-UI-preview assertion, navigation before
confirmed sign-in, method-unqualified response loss consumed by passive GET,
redundant session reads that exceeded real protected admission, and aggregate
sign-ins across scenarios. Tests now wait for actual readiness, scope faults by
method/path, poll at a bounded cadence and use independent real PBX operator
fixtures. No admission budget, authentication guard or timeout was weakened.
Implementation review also preserved mounted detail forms across authority checks,
fenced pre-save reads, bounded safe DTO forwarding, wrapped long links and reused
Feedback's single live region. Only the final passing outcomes establish delivery.

## Parent criterion command map

Every selection below was rerun on real services; final browser checks cover the
last responsive/accessibility refinements without changing backend contracts.

| Parent | Reproducible selection and owning evidence                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| AC-01  | `check:pbx-nodes --registry`, `--observation`, `--browser`; delivered a/b/c contracts and isolated compositions              |
| AC-02  | Registry A-02–05 and browser committed create/edit response-loss, original replay, audit and version-conflict journey        |
| AC-03  | Registry A-05 plus actual browser/server-layout/current-authority and integrated platform A/B recovery checks                |
| AC-04  | Registry A-06–07, observation B-07, browser credential/auth-name/HTML/DTO/URL/storage/bundle/diagnostic exclusions           |
| AC-05  | Observation B-02 and browser real AMI/SIP empty/registered/removed and safe failure states                                   |
| AC-06  | Observation B-03 real PostgreSQL/independent processes, distinct synthetic-node ownership and monotonic epochs               |
| AC-07  | Observation B-04–05 stale publication/consumer/callback/cancellation and no mutating adapter matrix                          |
| AC-08  | Observation B-06 plus browser real disconnect/reconnect, owner recovery, target/reference invalidation and elapsed freshness |
| AC-09  | Observation B-08, process/durable checks and browser isolated node failure/restored protected reads                          |
| AC-10  | Final browser register/inspect/edit/recovery, keyboard/focus/axe and maximum-name responsive matrix                          |
| AC-11  | Combined command, full Docker graph, shared UI, final browser, documents and exact cleanup/restoration                       |

## Cleanup and normal development restoration

The final combined observation run used database `myims_session_8433c0f074da`,
Redis `myims-session-check-a9aa96819818` and endpoint/auth/AOR
`myims-observation-1de8f121`; its browser used `myims_session_8b6db810ab1e`,
`myims-session-check-af10ce6714a6` and `myims-observation-ee59d8e4`.
Final post-graph browser: `myims_session_42e490b195ed`,
`myims-session-check-6809f168fe14` and `myims-observation-c80fbf1f`.

Each trusted launcher restored the controlled observer credential and removed only
its exact SIP fixture/file, Redis container/volume and temporary directories.
Children/proxies/pools close before exact disposable database teardown. Independent
post-checks found zero task-recorded databases, no Redis fixture containers,
`No objects found` for Asterisk endpoints/contacts and absence of the exact
`/tmp/myims-pbx-fixture.conf`. No fixture processes remained. Existing installation
identity, catalog, protected development material, shared-service volumes and
tenant routes were retained.

A read-only namespace scan found older database `myims_session_426486cb1209`.
Its audits date to 2026-10-07 and it has no PBX schema; it predates this work and
was preserved. No broad database/container/volume cleanup was performed.

Normal platform and staff HTTPS supervisors were ready before verification and
stopped according to the development runbook because ordinary builds share their
Next output. Both were restored after the successful verification chain. At the closing
checkpoint both reported ready, platform/staff network checks passed, and backend
live/ready returned HTTP 200. Normal PBX APIs also rejected absent sessions with
no-store 401 and all delivered deep links redirected to sign-in.

## Handoff and completion boundary

P3-U2 receives canonical node/installation identity, safe registry/observation
consumers, expected versions and freshness/coverage semantics. Registration remains
unmapped and creates no extension inventory, allocation or usable tenant voice.

P3-U5 receives b's ownership port and same-transaction fencing contract. External
stale-epoch enforcement, ordered configuration revisions and live apply/recovery
remain unfulfilled; a pre-call database check cannot revoke an issued PBX command.
Only P3-U1 registry/observation and browser handoff are complete, not Phase 3,
production HA/deployment, configuration apply or tenant activation/readiness.

Closing checkpoint: **2026-10-15 09:32 +08:00 (Asia/Manila)**. Documentation links, criterion coverage,
consistency and whitespace reconciled; tracker cleared and c/parent marked complete.
