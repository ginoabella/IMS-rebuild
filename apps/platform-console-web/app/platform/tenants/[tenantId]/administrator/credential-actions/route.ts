import { forwardCredentialAction } from '../../../../../tenants/credential-forward';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  return forwardCredentialAction(request, (await params).tenantId);
}
export const POST = GET;
