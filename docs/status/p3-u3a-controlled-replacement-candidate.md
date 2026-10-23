# P3-U3a — Inactive controlled replacement candidate

Local checkpoint: 2026-10-20 (Asia/Manila, +08:00), under the
[approved completion direction](../archive/p3-u3/2026-10-23/docs/planning/p3-u3a-approved-completion-direction.md).
This is a synthetic candidate within checkpoint 1; runtime activation, full
checkpoint acceptance and P3-U3a completion remain outstanding.

Added a separate investigation-only replacement coordinator using the existing
conservative deadline candidate. The caller stages an already recorded replacement
identity. Before switching, it validates the exact expected installation-scoped
policy, no identity-policy/period overlap, service/orphan/renewable attributes,
configured maximum, observed TTL, distinct accessor and a later issuance origin.
The replacement's local lease is capped by both observed expiry and TTL; neither
the prior nor replacement token gains a new issuance origin through switching.
Old authority must remain valid before staging and cover the cleanup budget.

The coordinator pauses consumption from staging until the prior token's exact
revocation and independent HTTP 403 confirmation both succeed within the overlap
budget. It rejects replacement while work is outstanding, while another candidate
is staged or while cleanup runs. An uncertain consumption call also prevents
replacement: ignoring an abort cannot make the prior generation appear idle.
New authority is checked again after cleanup before consumption resumes.

The experimental overlap budget defaults to 30 seconds, refuses more than 60
seconds and starts at the replacement's reported issuance time. This bounds
admission to the switching workflow, **not guaranteed physical token overlap**:
an unavailable provider can prevent revocation. Such failure is reported as
`cleanup_required`, with the prior token explicitly unconfirmed, and consumption
stays paused. Late results cannot activate the replacement; there is no automatic
retry, fallback to old consumption or additional issuance.

Safe status contains only state and counters for the current token, a staged
candidate requiring review, and prior tokens whose revocation is unconfirmed.
An invalid staged candidate stays accounted for even if it cannot be validated as
a distinct token. Raw tokens/accessors, identity fields and provider bodies are
never returned or serialized. The class holds no bearer token and issues none.
Exact prior-token cleanup callbacks must be supplied by a trusted composition.

Verification:

- Docker command:
  `./dev exec node --test scripts/openbao/token-replacement.test.mjs scripts/openbao/authorization-deadline.test.mjs scripts/openbao/authorization-reconciliation.test.mjs`.
  Exit 0: 25 synthetic test groups, including ten replacement groups.
- Replacement coverage: successful validate/switch/revoke-confirm order; wrong
  policy, maximum, effective identity policy, period/type/orphan/TTL and original
  issuance; duplicate accessor/future issuance; expired old authority; bad clock;
  stale candidate and insufficient overlap budget; revocation failure, live or
  malformed prior lookup; timeout/abort and late success; confirmed cleanup after
  the overlap limit; concurrency; narrowed replacement lease; and an old request
  that ignores abort.
- Scoped Docker ESLint, Prettier and `git diff --check` passed.

This checkpoint uses synthetic clocks and callbacks only. It performs no real
provider request and does not prove real issuance, protected custody, callback
binding, durable accounting/swap, process interruption/restart recovery or real
concurrent consumers. The caller must durably record each issued candidate before
staging; durable records and operator cleanup/recovery are not implemented here.
There is no import from an application or retained helper, and no integration with
provider issuance, storage, workers or business finalization.

The parent retained-verification track and its evidence are independent. No
retained access, token issuance, backup/maintenance implementation, restart,
production or SIP/PBX operation occurred in this checkpoint. Earlier native
HTTP 500/expiry-overrun evidence and unresolved browser recovery findings remain
unchanged. Runtime use still requires accepted clock/restart/custody assumptions,
durable token accounting and real provider/process/failure acceptance; canonical
owner/grants/API and transaction-timing work remain outstanding.
