import { forwardAllocation } from '../../../../../../allocations/forward';
export const dynamic = 'force-dynamic';
async function handle(
  request: Request,
  context: {
    params: Promise<{ tenantId: string; nodeId: string; action?: string[] }>;
  },
) {
  const { tenantId, nodeId, action } = await context.params;
  return forwardAllocation(request, tenantId, nodeId, action ?? []);
}
export { handle as GET, handle as POST };
