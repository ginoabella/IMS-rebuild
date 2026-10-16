# P3-U2c implementation and acceptance evidence

Status: completed within conditionally approved private development, 2026-10-16 15:33 +08:00
(Asia/Manila). C-01–07 and parent AC-01–11 passed; P3-U2c and parent P3-U2
are complete within this scope. Earlier attempts below are historical and do not
override final results. Scope follows the user's conditional G-03 approval in the
[runtime review](../planning/p3-u2c-observation-mapping-contract-review.md).

Implemented: protected inventory/profile/credential browser, narrow no-store
forwarding, operator/workflow-bound mounted intents and explicit recovery, exact
passive composition, controlled baseline/lock/recovery launcher and combined
inventory command. See [contract](../architecture/extension-inventory-browser.md)
and [operator/recovery runbook](../runbooks/extension-inventory-browser.md).

## Implementation checkpoints and earlier attempts

- `./dev exec pnpm build:backend`: passed, exit 0.
- `./dev exec pnpm --filter @myims/platform-console-web typecheck`: passed, exit 0.
- Focused ESLint over scripts, console app and changed telephony source: passed,
  exit 0 at the checkpoint before subsequent acceptance refinements.
- `./dev exec node scripts/check-inventory-composition.mjs`: passed, exit 0.
  These are injected pure composition checks: exact canonical/persisted identity,
  foreign installation/node/auth/AOR rejection, number-only/unmanaged exclusion,
  covered presence/absence and stale/historical/ownership/version/coverage states.
  They do not establish actual Asterisk registration.
- First browser attempt: isolated production Next build and existing draft-tenant
  browser regression passed. Inventory stopped on a test selector that omitted
  the shared Field's required suffix. No PBX fixture was installed. Run
  `9bac7aed-f9bf-45af-80f4-1f0dc8ca2bca` verified exact original PBX baseline,
  fixture absence, original running state and released lock during cleanup.
  The failure was corrected; this is not an inventory acceptance pass.

- Second browser attempt passed individual SIP/WebRTC creation, bulk preview/commit
  and collision preservation, profile version/adoption, desired enable/disable and
  real-provider credential setup. The reset lost-response recovery test clicked
  retry before its one-second Retry-After boundary; corrected the test to honor it.
  Run `9f78bb98-3dbd-442e-bdf1-3e90acb01e42` destroyed its one prepared provider
  generation and verified original PBX baseline/running state, fixture absence and
  released lock. No live PBX fixture was installed; acceptance was incomplete at that checkpoint.

- Third attempt passed real-provider setup/reset and same-intent response-loss
  recovery. The consecutive expiry fixture raced an in-flight sign-in because
  its assertion checked a retained value before the form was visible. The fixture
  now waits for completed visible authority restoration before expiring the new
  session. Run `d4e5b9c9-9cab-4315-9d15-d79694d0837c` destroyed both exact provider
  generations, revoked/removed both fixture access tokens and verified original
  PBX baseline/running state and released lock. No PBX fixture was installed.

- Fourth attempt exposed a test helper invoking explicit review twice before its
  first asynchronous reload completed. The helper now waits for review completion.
  Run `a909282f-a2a5-4908-9359-68f0b2e33e46` verified baseline restoration, no PBX
  fixtures, revoked/removed provider fixture tokens and released lock.

- Fifth attempt was deliberately stopped before PBX fixture installation after
  installed CLI format strings showed precision-limited identity columns. Exact
  anchored `pjsip show ... like ^<key>$` filters now establish owned identity
  presence/absence; namespace-prefix filters establish collision absence. Only
  the test-owned Next child was stopped; ordinary HTTPS processes were retained.
  Run `240d1971-fbf1-49d9-a2da-8db70b3f6637` destroyed both prepared generations,
  revoked/removed both access tokens, verified the original PBX baseline/state
  and released the lock. This interruption is not an acceptance pass.

- Sixth attempt exposed an implementation race: a delayed selected-extension read
  copied its older form snapshot over newer permitted input. The callback now
  merges only canonical detail into the current workflow, and credential-status
  callbacks are additionally resource/generation fenced. This is a product fix;
  recovery acceptance must rerun. Run `94550ca9-49d9-472f-82b5-e364d7c02bc2`
  destroyed both exact generations, revoked/removed access tokens and verified
  original PBX baseline/running state and lock release; no PBX fixture installed.

- Seventh attempt passed mounted idle/absolute/foreign/logout recovery and actual
  Asterisk exact SIP REGISTER/expiry-zero/presence/absence/unmanaged checks. The
  controlled start failed because `docker exec` cannot read a lock while its
  container is stopped. The launcher now verifies that exact owner through a
  bounded Docker-copy archive, validates that path before fixture installation,
  and rechecks ownership/include after starting. Run
  `a0ea2d2b-5683-4664-8abf-7a21169d8936` restored exact PBX baseline/running state,
  removed owned fixtures/lock, destroyed both generations and revoked/removed
  fixture tokens. Process inspection found no acceptance children; the exact
  disposable database was absent. Outage/integrated acceptance was incomplete at that checkpoint.

- Eighth attempt passed actual SIP mapping and real PBX-only stop/start, desired
  profile creation during the outage and fresh reconciliation. Its isolated
  projection fixture attempted to reuse a released epoch; the database correctly
  rejected that invalid fixture. The fixture now advances ownership legally,
  captures the qualifying live snapshot before release and tests each fault from
  a fresh injected baseline. Run `f90fcc8d-f348-4297-9931-97be8dc6f1cd` verified
  exact PBX restoration/fixture absence/lock release and both-generation/token
  cleanup. No epoch protection was disabled.

- Ninth attempt passed live mapping/outage/reconciliation, isolated projection
  faults and actual responsive/axe/keyboard checks. A direct-backend forged bearer
  assertion expected the proxy's 403, while the existing backend cookie guard
  correctly returns 401. The test now checks the established backend status;
  proxy denial remains 403. Run `64b7cd81-5918-4c5f-89d6-4b679793cff1` verified
  exact baseline/fixture/lock restoration and both-generation/token cleanup.

- Tenth attempt passed the complete inventory browser, live SIP/PBX outage,
  injected projection, responsive/axe/keyboard, actual Redis outage and canonical
  revocation checks. The following generic auth regression/cleanup failed because
  its non-shipping inspection Redis client intentionally disables reconnect. The
  fixture now reconnects that inspection client explicitly after the real service
  recovers. Actual HTTP adapters had already recovered correctly. Run
  `21f33eba-af24-441f-809a-4b34e650b331` verified exact PBX restoration, owned
  fixture/lock removal and both-generation/token cleanup; integrated exit remains 1.

- Integrated browser command passed, exit 0, run
  `a4486cd1-b84d-4348-b6bf-20bd7f296ab0`, node
  `19844a56-b131-47a0-9add-ac34f5a77fca` on the retained installation.
  All inventory/credential/recovery/live/injected/accessibility checks and the
  following generic auth/session regressions passed. Both exact generations were
  destroyed, both access tokens revoked/removed, and exact PBX baseline/state,
  owned-object absence and lock release verified. Final source adds readable
  canonical result summaries; the required combined rerun includes that change.
- Full required-check ledger started at
  `.local/p3-u2c-verification/41abdcaa-54dd-4a13-9762-7360c744b36f/manifest.json`.
  The first batch runner was rejected by automatic approval review because its
  restoration step was external to the script; no actions from that runner ran.
  The approved revised runner restores original private HTTPS services in finally
  and verifies loopback/private ports, readiness, HTTPS and backend health.

## Final integrated acceptance reconciliation

The final combined command passed on 2026-10-16, exit 0, including the readable
canonical-result UI. Verification ledger:
`.local/p3-u2c-verification/41abdcaa-54dd-4a13-9762-7360c744b36f/manifest.json`.
Controlled c run `df0555b9-ea78-49a9-b017-f2e94040561c` used disposable node
`20138c7d-dc62-46a5-93c5-23ba7506fb8c`; original installation remained unchanged.

| Criterion | Evidence/result                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01      | Passed actual HTTPS browser: SIP/WebRTC inventory, list/detail, individual and explicit/range bulk preview/commit, collision/race preservation, immutable profile version/adoption, desired edits/disable/re-enable and stale-edit review.                                                                             |
| C-02      | Passed real OpenBao setup/reset through browser and worker; held HTTP response and explicit same-intent retry resolve the canonical generation. No material delivery or live revocation claim.                                                                                                                         |
| C-03      | Passed actual SIP REGISTER/expiry-zero, covered empty/present/absent and unmanaged number-only exclusion, PBX stop/start and desired save during outage. Injected coverage/staleness/version/epoch/disconnect faults independently remain unknown.                                                                     |
| C-04      | Passed actual HTTP A/B authority, staff/anonymous/bearer/forged/expired/revoked denial, proxy CSRF/origin/channel, no-store, passive Redis-record equality, real isolated session-Redis outage/recovery and PBX-only outage. Canonical revocation is an injected database transition checked through real A/B/browser. |
| C-05      | Passed actual mounted idle/absolute expiry, same-owner retention, foreign-owner and logout clearing, delayed detail-read input retention, explicit bulk/reset lost-response retry, changed-intent rejection, no automatic replay/storage and actual-password scans across HTTP/DOM/bundles/URLs/metadata/diagnostics.  |
| C-06      | Passed actual 1440/768/390/320-pixel screens, 200% CSS zoom, keyboard/focus/labels, axe WCAG checks, distinct desired/credential/readiness/registration states and loading/error/retry announcements.                                                                                                                  |
| C-07      | Passed combined inventory and final real-credential rerun, all required regressions, full Docker graph, 12 shared UI checks, verified cleanup/restoration and final documentation reconciliation.                                                                                                                      |

| Parent criterion | Reconciled owner evidence                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01            | Approved G-01/G-02/G-03 contracts, canonical generated namespace, number/profile rules and explicit future handoffs; [a evidence](p3-u2a-evidence.md), [b evidence](p3-u2b-evidence.md) and c architecture/runbook.                  |
| AC-02            | Combined inventory selection reruns real PostgreSQL/runtime-grant uniqueness, cross-kind/node/alias/race/version/validation checks; actual c creation/edit/profile workflows pass.                                                   |
| AC-03            | Combined inventory reruns atomic bulk bounds/collisions/audit/races/replay; actual c browser previews, lost committed response, exact same intent and changed-intent rejection pass.                                                 |
| AC-04            | Combined inventory immutable profile and safe-combination constraints plus actual browser v2 creation and explicit adoption pass. Profile removal is not exposed.                                                                    |
| AC-05            | Combined real credential selection reruns B-01–07 setup/reset/concurrency/rollback/interruption/material-health and recovery; actual browser setup/reset/uncertainty pass.                                                           |
| AC-06            | Combined inventory/credential A/B route matrices and c real browser/proxy/session-outage checks pass.                                                                                                                                |
| AC-07            | Existing inventory eligibility/default-deny checks rerun; actual saves leave generated endpoints/routes absent before trusted fixtures. Unallocated/disabled stock remains unavailable; live tenant enforcement belongs to P3-U5/P4. |
| AC-08            | Actual controlled Asterisk exact SIP/coverage/coexistence/outage/save checks plus separately injected projection faults pass.                                                                                                        |
| AC-09            | Combined credential scans/process ACLs and c actual-password scans across browser/client/server/persisted surfaces pass. Fixture credentials remain separate from desired provider material.                                         |
| AC-10            | Actual browser individual/bulk/profile/edit/credential/disable/recovery/reflow/accessibility and passive-session checks pass.                                                                                                        |
| AC-11            | Passed integrated a/b/c reconciliation, all required regressions, full Docker graph, shared UI, cleanup/restoration and documented later-owner handoffs.                                                                             |

The combined real credential regression destroyed 25 exact generations and verified
one already absent (26 accounted for). Its process had loaded the earlier launcher
before the all-selections token cleanup update; exact run-owned installation
`df0be940-bbc8-4427-86f5-5fb1626eecd9`, database
`myims_session_69a626fb43bb`, was checked against the retained teardown manifest,
then worker/cleanup tokens were revoked and all three temporary token files
verified absent. This is a cleanup correction, not a change to ordinary access.
Safe policy definitions and destroyed-version metadata remain under b's existing
retention contract. The final focused credential rerun passed, exit 0, database
`myims_session_a12e409a9fe0`, installation
`b7b2d036-9083-4edb-b841-a1c6acb163c0`, fixture run
`2c8ec5ad-dd35-4f3d-abfb-5a83c419a6fa`. It automatically accounted for 26 generations
(25 destroyed, one absent), revoked fixture access and removed token files.
Final manifest/access flags, token-file absence, exact disposable-database absence
and fixture-container absence were independently verified. No cleanup issue remains.

Controlled c cleanup verified fixture absence, exact configuration/routing baseline,
original running state and lock release. Both c provider generations were destroyed;
fixture access `b8322e0a-6c0f-48bf-ac7f-6c7796549700` was revoked and token files
removed. PBX regression runs `4d2497cb-3174-4c90-b751-0265e4712f0d` and
`8635b04e-fe88-4b46-b4c6-a4bae9f8d992` independently verified the same restoration.
The legacy regression preserves manager configuration and uses temporary wrong or
missing client credentials; historical real account-rotation evidence remains in
P3-U1b. No existing PBX configuration was rewritten to satisfy acceptance.

## Required command ledger

All commands run through the existing private Docker development workspace.

| Command                                                                  | Result                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `./dev exec pnpm check:extension-inventory --browser`                    | Exit 0, initial successful full c run `a4486cd1-b84d-4348-b6bf-20bd7f296ab0`.                                 |
| `./dev exec pnpm check:extension-inventory`                              | Exit 0, final sequential inventory, real credentials and browser selections.                                  |
| `./dev exec pnpm check:pbx-nodes --registry`                             | Exit 0.                                                                                                       |
| `./dev exec pnpm check:pbx-nodes --observation`                          | Exit 0, preserved existing configuration.                                                                     |
| `./dev exec pnpm check:pbx-nodes --browser`                              | Exit 0, controlled restoration verified.                                                                      |
| `./dev exec pnpm check:platform-auth`                                    | Exit 0.                                                                                                       |
| `./dev exec pnpm check:durability`                                       | Exit 0.                                                                                                       |
| `./dev check`                                                            | Exit 0, complete lint/format/type/build/entrypoint/configuration/foundation/storage/deployment/session graph. |
| `./dev exec pnpm check:ui`                                               | Exit 0, all 12 shared UI checks passed.                                                                       |
| `./dev exec pnpm check:extension-inventory --credentials`                | Exit 0, final automatic-access-cleanup rerun; exact generation/token/database/container cleanup verified.     |
| Original platform/staff HTTPS restoration, health and backend live/ready | Exit 0 for both HTTPS checks and backend live/ready 200; original loopback/private publications verified.     |

## Controlled target and baseline

The existing deployment catalog resolves the retained installation UUID
`58adb785-5384-41ce-9c72-ccda6ea554db` on private development Asterisk 22.10.1.
Each disposable database registers its own test node for that installation;
the ordinary canonical database, identities and catalog are preserved. The
launcher records each exact test node, generated owned keys and run IDs safely.

Preflight observed zero operational calls/channels, no PJSIP endpoint/auth/AOR
objects and no fixture include/lock. Original configuration digest:
`b81e503c91284e75fd8f4ec84fdb26fa23c01aee71a1c999fa1adc68b79e91fe`;
routing digest:
`38e5735825dc995d7299762b4d3a5bc55c855caed52332739bcc7dd26d4610b3`.
Private owner-only recovery manifests live under `.local/p3-u2c-runs/`.
Configuration contents, private addresses and usable material are excluded here.
Final read-only ordinary-database inspection retained node
`bcb9d21c-96cd-4975-bd68-314b588a23a9`, the same installation and version 1,
with zero profiles and zero extensions. Direct final Asterisk inspection found
zero calls/channels and no temporary include/lock; no acceptance containers remained after the final focused credential rerun. Both
ordinary HTTPS services remained ready. Exact original Asterisk configuration and
routing digests, empty object baseline, no calls and fixture/lock absence were
independently reverified after that rerun.

Actual SIP dynamic contacts, real PostgreSQL/Redis/provider/HTTP/browser checks,
injected projection/response-loss faults and future-owner boundaries are
distinguished above. No production, live profile/credential application,
WebRTC functionality, routing activation, allocation or calling readiness is
claimed. Reference files were verified unchanged with `git diff --exit-code -- reference/asterisk_config`. Any ownership/cleanup/restoration
issue stops dependent acceptance and retains recovery information.

## Completion and handoff

A-01–07 and B-01–07 were rerun by the combined command; C-01–07 and all parent
AC-01–11 reconcile above. Operator/API/recovery guides and docs index are updated.
Final documentation formatting, local links and whitespace checks passed.
No deviations require separate approval. Completion establishes inventory
management, safe desired credential lifecycle and passive PBX observation only.
P3-U4 owns routing/group semantics; P3-U5 owns default-deny rendering, exact
profile/credential deployment, fencing, verification, rollback and live revocation;
P4 owns allocation/tenant isolation/readiness; P8-U8 owns any browser calling client
and recipient access. Production and the Phase 3 gate remain outside this result.
