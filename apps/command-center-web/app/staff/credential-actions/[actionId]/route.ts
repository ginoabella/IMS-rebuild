import { forwardCredential } from '../../../credentials/server';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  return forwardCredential(request, {
    kind: 'staff',
    operation: 'status',
    id: (await params).actionId,
  });
}
