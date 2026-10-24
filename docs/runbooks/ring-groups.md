# Manage desired ring groups and number protection

Open a PBX detail in the platform console, then **Routing: groups and reservations**.
Desired saves and previews work with an offline PBX. They never allocate inventory,
contact Asterisk, apply/reload configuration or enable tenant calling.

1. Provision inventory through the existing extension workflow.
2. Choose **Create group**, give it a name and optional number 1000–899999.
   Select 1–32 distinct members and add each. Move members up to set sequential
   order. Disabled/unallocated members are allowed for planning; their availability
   labels do not establish readiness.
3. Choose simultaneous or ordered sequential and 5–120 seconds per attempt
   (default 20). Simultaneous has one attempt, sequential one per member. Busy,
   unavailable or unanswered attempts advance. Set explicit hangup, extension or
   group fallback. Direct/indirect fallback cycles reject.
4. **Preview group** explains attempts, this group's maximum ring duration and
   evaluated dependency versions. Fallback groups use their own attempts. Preview
   is advisory; Save validates again. Groups start disabled. Enable/disable changes
   desired status only; disabled groups keep their number claims.
5. In **Reserved numbers**, create a named purpose and an exact number or bounded
   digit prefix. Prefix lengths mean total digits, including the prefix, from
   1–15. Exact numbers preserve leading zeros. Reservations are always enforced;
   there is no enable switch. Existing extension/group claims and intersecting
   reservations reject, including disabled definitions. The initial list is empty
   unless an operator has created protection; no legacy/emergency defaults are seeded.
6. Inspect/edit/status/remove through each definition's detail. Referencing groups
   block group removal; open the listed group and change/remove its fallback first.
   Namespace conflicts list existing IDs/names; inspect extension claims in inventory
   or reservation claims in Reserved numbers. Removal retains history and releases
   only eligible number claims. Reusing a number creates a new UUID.

Validation keeps entered values. A stale or uncertain edit requires **Reload
canonical state**, review the saved detail and **Use current version** before
saving retained inputs. An unknown create can **Retry exact create request** with
its original request ID. Do not substitute a new request while its outcome is
unknown. Mounted work belongs to the signed-in operator and is cleared on sign-out
or identity change; it is not a refresh-persistent draft.

## Deployment and checks

The additive migration is `20261024000000_ring_groups`; use the existing trusted
migration path, never HTTP schema changes. It adds `btree_gist`, telephony tables,
restrictive identity/reference constraints and a backfilled namespace exclusion
index without modifying runtime PBX files, endpoint credentials or backup state.
Existing extension claims remain reserved. Stopping new consumers retains data;
there is no destructive down migration.

Focused command (trusted host launcher; it creates/removes isolated fixture stores):

```sh
./dev exec pnpm check:routing
```

It uses real PostgreSQL/shared Redis, independent production Nest HTTP A/B and the
actual HTTPS Next console. PBX destinations are unreachable fixture names; no
telephony process/call is started. Trusted ownership fixtures are not allocations.
Affected regression and normal checks:

```sh
./dev exec pnpm check:extension-inventory --inventory
./dev exec pnpm check:extension-inventory --browser
./dev exec pnpm check:trunk-gateways
./dev exec pnpm check:pbx-nodes
./dev check
```

Use the existing development HTTPS refresh workflow after applying/building changes.
See the [contract and downstream handoff](../architecture/ring-groups.md) and
[feature evidence](../status/p3-u4a-evidence.md) for actual results and limits.
P3-U4b receives verified group IDs/fallback/namespace/dependency/recovery conventions;
c extends the shared matcher for outbound intersections. Parent routing, tenant
bindings, live PBX routing/apply and production readiness remain separate work.
