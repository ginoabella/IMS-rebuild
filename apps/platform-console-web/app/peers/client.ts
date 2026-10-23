import type { PeerErrorDto } from '@myims/contracts';
import { AccessError } from '../auth/client';
import { output } from './validation';
export class PeerError extends Error {
  constructor(
    readonly status: number,
    readonly detail: PeerErrorDto,
  ) {
    super(detail.reason ?? detail.message);
  }
}
export async function peerRequest<T>(
  nodeId: string,
  parts: string[],
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: Record<string, unknown>,
  proof?: string,
  after?: string | null,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch(
      `/platform/pbx-nodes/${nodeId}/${parts.join('/')}${after ? `?after=${after}` : ''}`,
      {
        method,
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
  const value: unknown = await r.json().catch(() => null);
  if ([400, 404, 409].includes(r.status))
    throw new PeerError(r.status, value as PeerErrorDto);
  if (![200, 201].includes(r.status))
    throw new AccessError(
      r.status === 401
        ? 401
        : r.status === 403
          ? 403
          : r.status === 429
            ? 429
            : 503,
      Math.max(1, Math.min(900, Number(r.headers.get('retry-after')) || 1)),
    );
  if (!output(parts, method, value)) throw new AccessError(503);
  return value as T;
}
