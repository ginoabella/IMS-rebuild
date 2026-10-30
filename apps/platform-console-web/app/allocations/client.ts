import { AccessError, type AccessFailure } from '../auth/client';
import { allocationOutput, allocationTarget, obj } from './validation';
export class AllocationError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    readonly blockers: { id: string; name: string }[] = [],
  ) {
    super('Allocation request failed');
  }
}
export async function allocationRequest<T>(
  tenantId: string,
  nodeId: string,
  parts: string[],
  proof?: string,
  body?: unknown,
  query = '',
): Promise<T> {
  let r: Response;
  try {
    r = await fetch(
      `/platform/tenants/${tenantId}/allocations/${nodeId}${parts.length ? '/' + parts.join('/') : ''}${query}`,
      {
        method: body ? 'POST' : 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(7000),
        headers: {
          'Content-Type': 'application/json',
          ...(proof ? { 'X-Platform-CSRF': proof } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  } catch {
    throw new AccessError(503);
  }
  const v: unknown = await r.json().catch(() => null);
  if ([400, 404, 409].includes(r.status))
    throw new AllocationError(
      r.status,
      obj(v) ? String(v.reason ?? 'invalid_request') : 'invalid_request',
      obj(v) && Array.isArray(v.blockers) ? v.blockers : [],
    );
  if (![200, 201].includes(r.status))
    throw new AccessError(
      ([401, 403, 429].includes(r.status) ? r.status : 503) as AccessFailure,
    );
  if (
    !allocationOutput(parts, body ? 'POST' : 'GET', v) ||
    !allocationTarget(v, tenantId, nodeId, parts, body ? 'POST' : 'GET')
  )
    throw new AccessError(503);
  return v as T;
}
