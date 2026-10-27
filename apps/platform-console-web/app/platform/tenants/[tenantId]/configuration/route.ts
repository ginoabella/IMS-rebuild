import { forwardTenant } from '../../../../tenants/forward';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  return forwardTenant(request, (await params).tenantId, true);
}
