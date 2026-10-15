import { PbxDetail } from '../../../pbx/registry';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  return <PbxDetail id={(await params).nodeId} />;
}
