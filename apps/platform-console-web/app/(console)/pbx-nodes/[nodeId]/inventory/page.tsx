import { InventoryBrowser } from '../../../../inventory/browser';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  return <InventoryBrowser nodeId={(await params).nodeId} />;
}
