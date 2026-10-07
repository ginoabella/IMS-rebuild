import { forwardCredential } from '../../credentials/server';
export const dynamic = 'force-dynamic';
export function POST(request: Request) {
  return forwardCredential(request, { kind: 'staff', operation: 'issue' });
}
