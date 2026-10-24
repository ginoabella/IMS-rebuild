# Manage desired outbound rules

Open PBX detail → Routing → Outbound rules. Create an outbound rule, enter its
name, choose Exact number or Bounded digit prefix and lengths, set Priority
(lower wins), select an outbound-capable trunk, and optionally strip leading
digits/add a digit prefix. Save creates a disabled, unbound desired rule.
Trunk choices show desired status; use More trunks to load further choices.

Only ASCII digits are accepted, with total input and output lengths 1–15.
For example, prefix `9`, lengths 3–5, strip `1`, add `00` transforms `9123` to
`00123`. All possible matching inputs must be safe. Reserved original or
transformed domains reject, including for disabled rules. No emergency/service
exception or international/service permission is inferred.

Equal-priority overlaps reject. Different priorities may overlap; the lowest
number wins. A disabled winner denies rather than falling through. No match
denies. Inspect shows saved fields, version, desired status and trunk dependency.
Enable/Disable changes desired state only. Disabled dependencies remain unavailable
for eventual apply. Unbound rules grant neither tenant ownership nor calling rights.

Enter a Sample outbound number and choose Preview outbound match in Create,
Edit or Inspect. Preview evaluates saved rules and explains the winner, priority,
transformed number or denial and evaluated versions. Save form changes first to
preview them. No call, registration, credential access or live change occurs.

Remove requires confirmation and retains history. Current outbound rules,
including disabled ones, block trunk removal or incompatible structural/direction
edits. Change/remove the rules first; resource blockers link back to routing.
Compatible credential adoption and desired name/status changes remain available.

Validation retains inputs and focuses the affected field. For stale/unknown
outcomes, Reload canonical state, review and Use current version before saving.
For uncertain creation, Retry exact create request recovers the same intent.
Mounted recovery belongs to the same operator; drafts do not survive refresh.
Reauthenticate with the same operator when prompted.

Routing navigation also provides Ring groups, Inbound rules and Reserved numbers.
Create desired groups before inbound references. Remove inbound references before
groups/ingress, and outbound references before trunks. Reservations protect both
namespace claims and outbound domains; remove conflicts before reserving a range.

Verify from the host through the Docker workspace:

```sh
./dev exec pnpm check:routing
./dev exec pnpm check:extension-inventory --inventory
./dev exec pnpm check:extension-inventory --browser
./dev exec pnpm check:trunk-gateways
./dev exec pnpm check:pbx-nodes --registry
./dev exec pnpm check:pbx-nodes --observation
./dev exec pnpm check:pbx-nodes --browser
./dev check
```

Apply the additive migration with `./dev migrate`, then refresh the ordinary
backend/HTTPS console using the development runbook. Preserve existing stores,
secrets, migration history and PBX configuration. There is no destructive down
migration. See the [routing contract](../architecture/outbound-routing.md) for
P3-U5/P4-U2/P5-U3 integration requirements and explicit fixture limits.
