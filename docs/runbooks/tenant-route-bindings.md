# Tenant desired route bindings

P4-U2b desired-state acceptance completed on 2026-11-03 (Asia/Manila, +08:00).
See the [verification evidence](../status/p4-u2b-evidence.md) for scope and limits.

Open a saved tenant in the platform console, expand **Tenant route bindings**, and
choose its PBX node. These controls manage existing desired resources. Extension
allocation remains in the preceding card. Creating/editing gateways, DIDs, groups,
rules and trunks remains in the existing PBX consoles linked from this card.

For inbound routing:

1. Configure and enable the existing shared gateway, an exact DID and the desired
   inbound rule. Allocate and enable destination extensions for this tenant.
2. Select **DID ownership**, choose the existing DID, preview its canonical facts,
   and save. Different tenants may own different DIDs on this same gateway.
3. For group destinations, save **Ring group ownership** after reviewing all its
   members/fallbacks. Own fallback groups first. Every reachable extension must be
   enabled and allocated to this tenant. Foreign, missing and cyclic graphs deny.
4. Select **Inbound route binding**, choose the existing exact-DID rule, preview
   and save. Gateway catch-alls are platform-only and cannot bind tenants. Hangup
   is a valid denial destination and never proof of successful inbound calling.

For outbound routing:

1. Classify an existing enabled outbound-capable trunk as **Exclusive to this
   tenant** or **Shared platform trunk**. Classification alone grants no permission.
2. Save **Explicit trunk permission** for this tenant, including when it owns the
   trunk. Shared trunks require separate explicit permissions for each tenant;
   foreign-owned trunks always deny.
3. Save **Outbound route binding** for an existing enabled rule. Tenant advisory
   selection filters to this tenant's bound rules, then uses ordinary priorities.
   A disabled winning bound rule denies; a missing permission or unavailable trunk
   on the winner denies without selecting a lower-ranked route. No match denies.
4. Use **Tenant outbound advisory number** to review desired selection/transforms.
   Ordinary node-wide PBX preview retains its original meaning. Both previews are
   advisory and establish no live readiness.

Saved entries show current desired compatibility separately from pending live
verification. Name/status or other dependency version changes may make saved
reviews stale. Review/save dependent ownership first, then preview/save the route
again. Resource selectors and saved entries have separate bounded pagination.

A conflict preserves the resource selection. Follow dependency links to the exact
existing resource, resolve its blockers, reload and preview again. Structural edits
and removals reject while current authorizations refer to them. Explicitly unbind
routes and remove affected desired references before releasing ownership; group
members/fallbacks cannot be silently retargeted while owned. Ownership release also
requires affirmative desired-only/runtime safety. Installed/in-flight/rollback pins
remain blockers for c's later release workflow.

**Revoke** changes desired authorization only. Revoking a trunk permission may leave
saved route bindings present but incompatible. It cannot silently select another
trunk, clear runtime pins or claim to have removed installed calling access.
Retained history preserves original tenant/resource associations and actor versions.

After an uncertain response, keep the original request. Restore access and use
**Retry original inbound/outbound request** to reconcile its exact outcome. Reload
canonical saved facts before explicitly discarding an attempt. Access restoration
never automatically writes. Same-owner mounted recovery preserves input; changing
operator, tenant or node discards that target's mounted work. A document reload
returns saved configuration; unsaved work has no durable browser storage.

The current live policy remains denied/unbound. Child c owns tenant-aware revision
capture/compiler, verified apply and live tests; later units own activation and staff
assignment. Saving these bindings establishes none of those outcomes.
