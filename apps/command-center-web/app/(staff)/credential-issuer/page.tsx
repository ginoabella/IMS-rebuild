import { headers } from 'next/headers';
import { backendRequest, sessionDto } from '../../auth/server';
import { StaffCredentialIssuer } from './form';
export const dynamic = 'force-dynamic';
export default async function Issuer() {
  const r = await backendRequest(
    'session',
    new Headers(await headers()),
    'GET',
  );
  const v: unknown = r.ok ? await r.json().catch(() => null) : null;
  if (!sessionDto(v) || !v.roles.includes('tenant_admin'))
    return <p role="alert">Access denied.</p>;
  return <StaffCredentialIssuer />;
}
