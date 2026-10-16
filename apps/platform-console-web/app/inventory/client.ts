import { AccessError, type AccessFailure } from '../auth/client';
import { output, obj, uuid, route } from './validation';
export class InventoryError extends Error {
  constructor(
    public status: number,
    public reason: string,
    public conflicts: string[] = [],
    public fields: Record<string, string> = {},
  ) {
    super(reason);
  }
}
export async function inventoryRequest<T>(
  nodeId: string,
  parts: string[],
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: Record<string, unknown>,
  proof?: string,
  after?: string | null,
): Promise<T> {
  if (!uuid(nodeId) || !route(parts, method) || (after && !uuid(after)))
    throw new InventoryError(400, 'Invalid request');
  let response: Response;
  try {
    response = await fetch(
      `/platform/pbx-nodes/${nodeId}/${parts.join('/')}${method === 'GET' && parts.length === 1 ? `?limit=25${after ? `&after=${after}` : ''}` : ''}`,
      {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
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
  if ([400, 404, 409].includes(response.status)) {
    const value: unknown = await response.json().catch(() => null);
    const v = obj(value) ? value : {};
    throw new InventoryError(
      response.status,
      (typeof v.reason === 'string' ? v.reason : 'Review entered values') +
        (obj(v.conflicts) && v.conflicts.truncated === true
          ? ` (${String(v.conflicts.total)} total conflicts; first 10 shown)`
          : ''),
      obj(v.conflicts) && Array.isArray(v.conflicts.numbers)
        ? v.conflicts.numbers.filter((n): n is string => typeof n === 'string')
        : [],
      obj(v.fieldErrors)
        ? Object.fromEntries(
            Object.keys(v.fieldErrors).map((k) => [
              k,
              'Review this inventory field.',
            ]),
          )
        : {},
    );
  }
  if (![200, 201, 202].includes(response.status))
    throw new AccessError(
      ([401, 403, 429].includes(response.status)
        ? response.status
        : 503) as AccessFailure,
      Math.max(
        1,
        Math.min(900, Number(response.headers.get('retry-after')) || 1),
      ),
    );
  const value: unknown = await response.json().catch(() => null);
  if (!output(parts, method, value)) throw new AccessError(503);
  // Strict route-specific transport validation above establishes the DTO boundary.
  return value as T;
}
