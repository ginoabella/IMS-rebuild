import { forwardTenant } from '../../tenants/forward';
export const dynamic = 'force-dynamic';
export const GET = forwardTenantList;
export const POST = forwardTenantList;
function forwardTenantList(request: Request) {
  return forwardTenant(request);
}
