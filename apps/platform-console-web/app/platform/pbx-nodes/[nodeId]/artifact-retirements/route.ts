import { forwardTelephony } from '../../../../telephony-verification/forward';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ nodeId: string }> };
async function forward(request: Request, context: Context) {
  const p = await context.params;
  return forwardTelephony(request, p.nodeId, null, []);
}
export const GET = forward;
export const POST = forward;
