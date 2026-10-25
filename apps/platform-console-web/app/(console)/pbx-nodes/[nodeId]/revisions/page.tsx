import { RevisionsBrowser } from '../../../../revisions/browser';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  return <RevisionsBrowser key={nodeId} nodeId={nodeId} />;
}
