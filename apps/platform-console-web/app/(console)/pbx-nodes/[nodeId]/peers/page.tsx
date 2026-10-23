import { PeerBrowser } from '../../../../peers/browser';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  return <PeerBrowser nodeId={(await params).nodeId} />;
}
