import { forwardTenant } from '../../../tenants/forward';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string }> },
) {
  return forwardTenant(request, (await context.params).tenantId);
}
