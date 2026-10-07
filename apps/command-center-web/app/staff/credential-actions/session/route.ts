import { forwardCredential } from '../../../credentials/server';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return forwardCredential(request, { kind: 'staff', operation: 'session' });
}
