import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import { tenantUuid } from './validation';
export async function forwardCredentialAction(
  request: Request,
  tenantId: string,
  actionId?: string,
) {
  if (
    !tenantUuid(tenantId) ||
    (actionId !== undefined && !tenantUuid(actionId)) ||
    new URL(request.url).search ||
    !['GET', 'POST'].includes(request.method) ||
    (actionId && request.method !== 'POST')
  )
    return safeError(400);
  let body: string | undefined;
  if (request.method === 'POST')
    try {
      body = await boundedJsonBody(request);
    } catch {
      return safeError(400);
    }
  const upstream = await backendRequest(
    { consumer: 'credential-actions', id: tenantId, actionId },
    request.headers,
    request.method as 'GET' | 'POST',
    body,
  );
  if (![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(upstream.status))
    return safeError(503);
  try {
    const text = await boundedJsonBody(upstream);
    const retry = upstream.headers.get('retry-after');
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(retry && /^\d{1,3}$/.test(retry) ? { 'Retry-After': retry } : {}),
      },
    });
  } catch {
    return safeError(503);
  }
}
