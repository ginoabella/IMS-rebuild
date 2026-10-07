import { forwardCredential } from '../../../../credentials/server';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  return forwardCredential(request, {
    kind: 'staff',
    operation: 'cancel',
    id: (await params).actionId,
  });
}
