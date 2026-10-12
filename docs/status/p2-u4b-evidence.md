# P2-U4b — Staff authentication HTTP acceptance evidence

Status: complete, 2026-10-12 12:42 +08:00 (Asia/Manila). B-01–09, focused HTTP/HTTPS and
relevant regressions plus final complete Docker checks passed, exit 0.

Requirement: [B-01–09](../../context/feature-specs/p2-u4b-staff-authentication-http-and-transport-boundaries.md).
Contract: [named consumers/DTOs/topology/CSRF/native storage handoff](../architecture/staff-authentication-http.md).
Operations: [staff authentication](../runbooks/staff-authentication.md).
Policy: [approved a G-01–06](../planning/p2-u4a-credential-contract-review.md).

| Criterion | Verification                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01      | Strict three-field DTO; ASCII-qualified normalized lookup, exact approved password policy, named browser/mobile consumers, no-store/errors/source/proxy/CSRF and contracts-only native secure-storage outcomes. Existing canonical authority, grants, verifier, admission and session stores reused.                                                                                                             |
| B-02      | Genuine a setup/reset of active staff under two tenants with identical usernames; exact spaces/case/Unicode tested; generic unknown/user/status/unset/malformed/password denial. Receipt-linked production a draft setup followed by web/mobile sign-in denial is part of the focused probe.                                                                                                                     |
| B-03      | Independent A/B shared 10/qualified identity and 60/source counters before candidate/hash work, no refunds; another tenant remains separate. Invalid source/hostile JSON, dummy hash, verifier busy/internal failure and unavailable canonical reads deny safely. Foundation full-suite checks cover cross-plane counters and bounded registries.                                                                |
| B-04      | Barriers after private read and verified proof race reset, role, account disablement and tenant suspension; stale proof denies. Real Redis limiter/session response loss, PostgreSQL COMMIT-response loss and rejected durable issuance writes return retryable 503 without credentials.                                                                                                                         |
| B-05      | Exact staff browser Origin/proxy/source, expired/pre/session CSRF contexts, live pre-context logout rejection, rotation proof replacement, duplicate/malformed/conflicting/cross-plane channels. Actual HTTPS Chromium acceptance on production Nest A/B passed; capability exchange regressions remain in the full graph.                                                                                       |
| B-06      | Explicit attested native consumer excludes Origin/Fetch Metadata/cookies/browser headers, returns a token only after mobile sign-in, enforces mobile consumer and rejects foreign plane. Actual HTTPS native HTTP fixture proves delivery/use/logout with approved lifetime. Secure-storage outcomes are a c handoff, not device evidence.                                                                       |
| B-07      | A-issued sessions work on B; B logout revokes on A, preserves another device and safely retries absent/revoked state. Real a reset invalidates both web/mobile, including physically restored stale Redis. Renew/revoke race cannot resurrect authority.                                                                                                                                                         |
| B-08      | Passive session reads leave deadlines unchanged. Non-shipping transactional operational mutations revalidate canonical owner before write, renew conditionally, and preserve absolute expiry. Web/mobile idle/absolute expiry and rotation creation/deadline preservation pass with accelerated fixture policy and exact stored-deadline waits. Rejected/lost revocation never clears cookies or claims success. |
| B-09      | Required focused command is established; backend build/lint/types pass. Complete focused HTTP/HTTPS and independent-process diagnostic scans pass, exit 0. Full Docker graph and all five client artifact regressions passed, exit 0; documentation links and whitespace pass.                                                                                                                                   |

## Commands and environment

- `./dev exec pnpm check:staff-auth --http`: isolated real migrated PostgreSQL,
  runtime-role connections, authenticated shared Redis and independent Nest processes;
  shipping HTTP adapters with test-only IPC barriers and owning transaction mutations; complete run passed, exit 0.
- `./dev exec pnpm exec playwright install chromium`: installed the browser required
  by the pinned Playwright package after the fresh workspace lacked its browser cache.
  `docker exec --user root myims-rebuild-dev-workspace-1 pnpm exec playwright install-deps chromium`
  installed its required Linux libraries using the existing browser prerequisites.
  A direct Chromium launch check then passed.
- `./dev check`: required final workspace/config/build/entrypoint and real-service
  foundation/audit/worker/storage/identity/bootstrap/session/platform/draft/credential
  regression graph; final complete run passed, exit 0.

Earlier iterations corrected response headers accidentally reused by the request
helper, aligned staff channel errors to the specified 403, and widened accelerated
expiry fixture margins. Approved production web/mobile lifetimes remain unchanged.
The TLS probe separates the actual `::1` client from the trusted `127.0.0.1`
backend proxy peer; native TLS pins the fixture listener family. The suite uses exact stored deadlines for expiry waits and avoids fixed-window budget
assertions spanning a Redis window boundary. No screenshots/traces contain secrets.

Required full regressions exposed existing browser synchronization and Redis
readiness assumptions. Draft/credential browser probes now settle navigation
requests before submission/fault injection and report only safe creation statuses.
Redis startup and both restart probes wait for successful `PING`, within existing
bounded deadlines, before reading retained records. Runtime recovery policy is unchanged.
Focused `./dev exec pnpm check:staff-auth --lifecycle`,
`./dev exec pnpm check:draft-tenant --browser`,
`./dev exec pnpm check:session-foundation --lifecycle` and `--limits` passed, exit 0.
The final complete `./dev check` passed, including both actual shutdown/restart
probes, staff and existing credential HTTPS acceptance, all relevant regressions,
diagnostic scans and owned fixture cleanup.

## Handoff and limits

b verifies temporary HTTPS ingress -> private shipping Nest A/B. The declared c
browser topology is same-origin HTTPS ingress -> bounded command-center forwarding
-> private backend; native HTTPS ingress supplies the separate attestation header
only after rejecting browser channels. Tested routes and forwarding allowlists are
in the contract/runbook. The platform development ingress is retained and has not
been reconfigured as a staff deployment.

c owns actual command-center/issuer integration, device protected storage,
owner-isolated unfinished work and full parent acceptance. No native storage,
activation, staff management, incidents, dispatch or production HA/traffic completion
is claimed. Parent P2-U4 and Phase 2 remain incomplete.
