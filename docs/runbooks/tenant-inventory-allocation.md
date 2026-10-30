# Reserve and allocate tenant extension capacity

P4-U2a covers desired ownership for saved draft and active tenants, including
capacity expansion. It preserves lifecycle, credentials, staff assignments and
calling eligibility. The [canonical contract](../architecture/tenant-inventory-allocation.md)
and [approved policy](../planning/p4-u2a-allocation-policy-review.md) define the
backend boundaries. Acceptance results are recorded in the feature evidence.

## Operator workflow

1. Sign in to the platform console, open Tenants and select the saved organization.
   Open Extension allocation and choose its PBX node. A tenant can own separate
   batches on multiple nodes; each batch contains one node only.
2. Review saved reserved/allocated counts, disabled stock and existing claims.
   Counts cover the selected tenant/node, including claims on other pages.
   Use More claims to page through ownership or include released history.
3. Select existing extensions individually (across stock pages) or choose Number
   range and enter first/last numbers. Ranges are inclusive, ascending and bounded
   to 50 numbers. Individual selections contain at most 50 distinct UUIDs.
   Canonical numbers are 1000–899999, without leading zeros.
4. Choose Reserve capacity or Allocate capacity, then Preview selection. Review
   every entry, including desired-disabled stock, missing numbers and existing
   owners. Missing/conflicting stock rejects the entire batch; use the inventory
   workflow to create any required stock separately, then preview again.
5. Save the reviewed reservation/allocation. Save rechecks tenant eligibility,
   versions and every selected extension under canonical locks. A conflict retains
   inputs: reload saved ownership and preview current stock before a new save.
   Refresh or another HTTP replica restores canonical claims.
6. Promote a reservation with Allocate extension. There is no automatic expiry,
   demotion, transfer or future-stock capture. A suspended/retired tenant cannot
   mutate claims; status is rechecked when saving.

Desired-disabled stock can be reserved/allocated and retains ownership when
enabled or disabled later. Ownership is separate from staff assignment and calling
verification. Profile adoption and credential setup/rotation reject claimed stock;
creating an immutable profile version does not adopt it into existing extensions.
No allocation action changes an active tenant's existing calling paths.

## Release and blockers

Release extension is available only for a current, provably unreferenced
desired-only claim. The backend checks actual group/member/fallback/inbound
references and retained runtime pins under the same node lock. Unknown/pending
runtime or prior committed live intent blocks release. Stock predating the initial
verified runtime baseline also blocks release until installed-resource review can
prove its exact initial dependencies. Unavailable dependencies
also deny it. Review the displayed dependency instead of deleting records or pins.

Installed/in-flight/rollback stock cannot be released or transferred through this
unit. Artifact retirement and the final safe-transfer/live-call scenario remain
with P4-U2c. Release ends current ownership and retains its identity/version/actor
history; it does not delete an extension or rewrite old associations.

## Access and uncertain results

Same-operator mounted reauthentication preserves nonsecret selection inputs and
original uncertain attempts. Honor the existing access retry cooldown, restore
access, then explicitly Retry original
allocation request to recover its original result. This does not automatically
resubmit on session restoration. A recovered historical result can be older than
current saved ownership; the saved list is reloaded separately.

Alternatively, reload and review canonical ownership before explicitly discarding
an uncertain attempt. Preview current stock before making a new request. Do not
invent a new request ID to reconcile a lost response. Changed intent under an old
ID conflicts; exact receipts are recoverable for 30 days, and expired IDs remain
unavailable for new intent. Changing operator, tenant or node clears mounted work;
late responses cannot populate the new target. Refresh restores saved data only.

## Verification and downstream handoff

Run `./dev exec pnpm check:tenant-allocation` for disposable real PostgreSQL,
shared Redis, two production HTTP replicas and private HTTPS browser coverage.
Fixtures own their database/Redis and preserve normal tenants and PBX artifacts.
The suite does not establish active-call safety or enable tenant routing.

P4-U2b consumes immutable claim UUIDs, tenant/node/extension identity, state/version,
reference guards and locking/replay contracts. P4-U2c owns tenant-aware revision
capture/compiler and runtime verification plus final installed-resource release.
P4-U5 must add real assignment blockers under this same lock contract before
introducing assignment writes. P4-U3 retains lifecycle/activation ownership.
