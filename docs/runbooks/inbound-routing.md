# Manage desired inbound rules

Open PBX detail → Routing → Inbound rules at
`/pbx-nodes/<node UUID>/routing`. Create an inbound rule, name it, select the
trusted gateway and one associated DID or Explicit gateway catch-all, then choose
Hang up, Extension or Ring group. Resource choices show desired availability;
load more choices when needed. Save creates a disabled, unbound definition.
Inspect shows ingress associations, destination, saved version and desired status.

Exact DID wins over a gateway catch-all. Leading zeros and `+` are significant.
Disabled rules retain their claims; a disabled exact rule does not fall through.
Duplicate selectors reject even when their existing owner is disabled.

In Create, Edit or Inspect, enter a Sample dialled number and choose Preview
inbound match. Preview evaluates saved rules for that trusted gateway and explains
the winner or rejection, precedence, resource versions and unavailable dependencies.
Unsaved form changes are not previewed as saved rules. A number alone establishes
neither trusted ingress nor tenant ownership. No PBX connection or call occurs.

Use Edit inbound rule, Enable/Disable inbound rule, or Remove inbound rule.
Removal requires confirmation and retains identity/history. Referenced DIDs,
gateway structure and destination groups are protected, including disabled rules.
Remove or edit referencing rules first; blocker UUIDs/names identify the dependency.
Routing blockers can open the referencing group or inbound rule.

Validation preserves safe inputs. For a stale or uncertain edit, Reload canonical
state, review it and Use current version before saving. For an uncertain create,
Retry exact create request recovers the original operation. Mounted recovery is
bound to the same operator; drafts do not survive refresh. Reauthenticate with the
same operator when the console requests it.

From the host repository root:

```sh
./dev exec pnpm check:routing
./dev exec pnpm check:extension-inventory --inventory
./dev exec pnpm check:trunk-gateways
./dev exec pnpm check:pbx-nodes
./dev check
```

Deployment applies the additive migration using `./dev migrate`, then refreshes
the ordinary backend/HTTPS console through the existing development runbook.
Retain existing stores, secrets, migration history and PBX configuration. Rolling
back consumers retains schema/history; there is no destructive down migration.

The [internal identity/dependency contract](../architecture/inbound-routing.md)
describes downstream integration. Unallocated/unbound resources remain calling-
ineligible. Actual tenant allocation/binding, compiled/applied configuration and
trusted live event attribution are separate P4-U2/P3-U5/P5-U3 work.
