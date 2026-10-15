import { forwardPbx } from '../../../pbx/forward';
export const dynamic = 'force-dynamic';
async function forward(
  request: Request,
  context: { params: Promise<{ nodeId: string }> },
) {
  return forwardPbx(request, (await context.params).nodeId);
}
export const GET = forward;
export const PATCH = forward;
