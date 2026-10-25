# P3-U5a revision capture, diff and validation evidence

Status: **complete within the offline boundary**; A-01–06 passed October 25, 2026
at 07:50 +08:00 (Asia/Manila). Final focused, affected regressions and full normal
Docker checks passed, exit 0. Ordinary migration/backend/HTTPS refresh, platform
and staff transport/preservation checks and protected revision-route probes passed.
Parent P3-U5 and the Phase 3 live gate remain incomplete.

## Delivered boundary

Immutable, node-serialized primary PostgreSQL capture with a single bounded SQL
source snapshot; atomic revision/audit/operator receipt; server identity/sequence,
parent/baseline and compiler/policy provenance; exact safe credential references.
Typed nonmaterialized compilation, redacted before/after semantic diff, affected
resources, explicit unknown runtime/drift, separately attributed offline validation
and live-policy/eligibility blockers. The console provides capture → inspect →
compare → validate, paginated history/baselines and same-owner mounted uncertainty
recovery. There is no live Apply endpoint or material consumer.

## Acceptance mapping

| Criterion | Passed checks and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01      | Isolated real PostgreSQL: concurrent desired edit/capture across two HTTP replicas yields one complete group version and its matching ordered membership; immutable update/delete rejection; exact concurrent duplicate capture recovers one UUID/sequence; changed fingerprint rejects; actor audit once; audit and receipt fault injection roll back revision/receipt; source limit rejects without receipt.                                                                                                                                                                                  |
| A-02      | Deterministic typed compiler contracts: SIP/WebRTC profiles, generated endpoint/route identities, exact generation/material-version references, group member order/strategy/timeouts/fallbacks, exact-before-catch-all and explicit outbound priorities, disabled-winner deny defaults, original/transformed reservations, injection/unsupported properties, missing references/cycles/work limits, deny eligibility and late structural failure despite diagnostic truncation. Existing routing regression also passed its actual matching/transform/reservation and integrated browser cases. |
| A-03      | Redacted addition/removal/edit and before/after field diff, exact credential-reference changes, affected-resource links and captured-baseline provenance. Browser DTO assertions exclude endpoint and route runtime keys. No verified runtime is distinct from empty review baseline; drift stays unknown. No material or raw credential-bearing configuration enters capture, DTO, audit or log.                                                                                                                                                                                               |
| A-04      | Validation records exact revision/compiler/policy, evaluated dependency UUIDs/versions/digest and actor/time. A real desired edit leaves captured bytes/digest unchanged and invalidates both source-current and prior validation applicability; validating that old revision reports stale dependencies. Local structural success remains separate from unavailable live coverage and eligibility blockers.                                                                                                                                                                                    |
| A-05      | Actual production Next HTTPS workflow with isolated PostgreSQL/shared Redis/two production HTTP graphs: PBX detail navigation, capture/detail/diff/validate, actual history pagination, receipt recovery after dropped response and same-owner reauthentication, preserved baseline, CSRF/foreign-origin/staff/unknown-input rejection, keyboard, axe and 320/768/1440px reflow. Revision-specific assertions passed; the complete final wrapper also passed, including cold-entry redirects and delayed-authorization navigation fences for capture/validation.                                |
| A-06      | [Operator guide](../runbooks/pbx-revisions.md) and [snapshot/compiler/b handoff](../architecture/pbx-revisions.md) published. Additive ordinary development migration passed. All focused/affected checks and full `./dev check` passed, exit 0. Ordinary migration/backend/HTTPS refresh, live/ready 200, platform/staff HTTPS preservation and protected revision-route probes passed. No parent/live completion claimed.                                                                                                                                                                     |

## Commands and execution state

- `./dev exec pnpm check:pbx-revisions`: five deterministic tests and the complete serial API/browser/shared-auth wrapper passed, exit 0. The first run exposed a fixture assertion
  calling Playwright's `status` method incorrectly; corrected to `status()`. A
  later full-wrapper auth tail returned 503 instead of 401 while concurrent checks
  were running; the backend trace contained 401. The final serial rerun passed, including the shared auth tail.
- `./dev exec pnpm check:routing`: passed, including real API/browser/integrated
  routing, shared auth tail and owned fixture cleanup.
- `./dev exec pnpm check:trunk-gateways`: passed, including resource API/browser,
  digest/registration metadata/version adoption, shared auth and owned cleanup.
- `./dev exec pnpm check:extension-inventory`: passed, including real provider
  lifecycle/fault recovery, actual controlled Asterisk observation, HTTPS browser,
  restored baseline and exact temporary material/token cleanup.
- `./dev exec pnpm check:pbx-nodes`: passed registry, controlled observation and
  HTTPS browser checks; observer credentials preserved and baseline/running state
  restored with exact fixture cleanup.
- `./dev exec pnpm check:durability`: passed audit/outbox, process restart,
  PostgreSQL interruption and uncertain-effect recovery.
- `./dev exec pnpm check:platform-auth`: passed HTTP/browser/session guards,
  cross-replica recovery, real limiter behavior and owned fixture cleanup.
- Existing return-path tests: all three passed with a temporary web-server-free
  Playwright configuration, including the new literal revisions path and denied
  encoded/query variants.
- `./dev check`: passed, exit 0, including lint, formatting, workspace typecheck, all builds, entrypoint/configuration checks, fresh/rerun migrations and the complete audit/worker/storage/identity/session recovery graph.
- Final feature/script ESLint and Prettier passed; the full normal graph included
  the final transport, return-path and pre-dispatch mount/owner guards.
- `./dev exec pnpm db:migrate`: passed; additive revision tables applied to the
  ordinary development database. A read-only ordinary snapshot SQL diagnostic also
  passed without material or PBX access.

- Ordinary backend restarted; `/health/live` and `/health/ready` returned 200 with
  PostgreSQL, session Redis and realtime Redis up. The console supervisor reports
  ready at `https://localhost:3443` using its existing development CA/material.
- `./dev platform-https-check` and `./dev staff-https-check`: passed, preserving
  existing identities, credential actions, shared credentials and migration history;
  direct private listeners and foreign channel/origin/host requests deny.
- Anonymous ordinary new-route probes: revision API 401 with no-store; revision
  page 307 with exact sign-in return path preserved. These probes perform no sign-in
  or write; authenticated review is proven by the isolated actual HTTPS journey.

## Evidence limits and later work

The fixture PBX and provider hosts are deliberately unreachable `.invalid` targets;
revision capture/review/validation never starts a telephony or provider consumer.
Credential reference tests use safe metadata/contracts, not secret retrieval.
Existing resource regression metadata fixtures do not newly establish provider
setup or live credential consumption. Broader inventory/PBX regressions retain
and report their own controlled external-integration boundaries.

A passed local validation is not readiness. U5-01 (live command/access policy),
U5-04 (protected materialization) and U5-05 (live fixture eligibility) remain
blockers; U5-02/03 remain with dependent apply/verification work. B owns acceptance
revalidation, actual installed/in-flight/recovery pins, external fencing, initial
verified baseline, materialization, install/reload/probes and verified recovery.
No tenant allocation/binding, shared-trunk permission, call or production acceptance
is introduced. Mounted recovery does not persist across a full page refresh.
