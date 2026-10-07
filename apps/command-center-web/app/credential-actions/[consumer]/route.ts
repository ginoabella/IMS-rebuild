import { forwardCredential } from '../../credentials/server';
export const dynamic = 'force-dynamic';
async function forward(
  request: Request,
  { params }: { params: Promise<{ consumer: string }> },
) {
  const { consumer } = await params;
  if (consumer !== 'csrf' && consumer !== 'exchange')
    return Response.json(
      { message: 'Access denied' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  return forwardCredential(request, { kind: 'exchange', operation: consumer });
}
export const GET = forward;
export const POST = forward;
