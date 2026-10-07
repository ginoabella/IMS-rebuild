import { forwardCredentialAction } from '../../../../../../../tenants/credential-forward';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; actionId: string }> },
) {
  const p = await params;
  return forwardCredentialAction(request, p.tenantId, p.actionId);
}
