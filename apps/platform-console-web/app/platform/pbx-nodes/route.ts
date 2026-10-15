import { forwardPbx } from '../../pbx/forward';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return forwardPbx(request);
}
export async function POST(request: Request) {
  return forwardPbx(request);
}
