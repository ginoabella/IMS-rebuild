import { TenantDetail } from '../../../tenants/registry';
export const dynamic = 'force-dynamic';
export default async function DetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  return <TenantDetail id={(await params).tenantId} />;
}
