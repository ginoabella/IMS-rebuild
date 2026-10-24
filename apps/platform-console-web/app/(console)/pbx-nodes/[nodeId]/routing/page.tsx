import { RoutingBrowser } from '../../../../routing/browser';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  return <RoutingBrowser nodeId={(await params).nodeId} />;
}
