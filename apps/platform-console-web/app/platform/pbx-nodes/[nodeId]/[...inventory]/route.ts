import { forwardRevisions } from '../../../../revisions/forward';
import { forwardRouting } from '../../../../routing/forward';
import { forwardPeers } from '../../../../peers/forward';
import { forwardInventory } from '../../../../inventory/forward';
export const dynamic = 'force-dynamic';
async function handle(
  request: Request,
  context: { params: Promise<{ nodeId: string; inventory: string[] }> },
) {
  const { nodeId, inventory } = await context.params;
  return inventory[0] === 'revisions'
    ? forwardRevisions(request, nodeId, inventory)
    : inventory[0] === 'routing'
      ? forwardRouting(request, nodeId, inventory)
      : inventory[0] === 'peers'
        ? forwardPeers(request, nodeId, inventory)
        : forwardInventory(request, nodeId, inventory);
}
export { handle as GET, handle as POST, handle as PATCH };
