import type { PlatformSessionDto } from '@myims/contracts';
export type AccessFailure = 401 | 403 | 429 | 503;
export class AccessError extends Error {
  constructor(
    public status: AccessFailure,
    public retryAfter = 1,
  ) {
    super('Platform access unavailable');
  }
}
export async function authRequest(
  path: 'csrf' | 'session' | 'sign-in' | 'logout',
  body?: unknown,
  proof?: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/platform/auth/${path}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      method: path === 'csrf' || path === 'session' ? 'GET' : 'POST',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        ...(proof ? { 'X-Platform-CSRF': proof } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AccessError(503);
  }
  if (!response.ok) {
    const retry = Number(response.headers.get('retry-after'));
    throw new AccessError(
      response.status === 400
        ? 401
        : [401, 403, 429].includes(response.status)
          ? (response.status as AccessFailure)
          : 503,
      Number.isFinite(retry) ? Math.max(1, Math.min(900, retry)) : 1,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new AccessError(503);
  }
}
export function csrfProof(value: unknown): string {
  if (
    !value ||
    typeof value !== 'object' ||
    !('proof' in value) ||
    typeof value.proof !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.proof)
  )
    throw new AccessError(503);
  return value.proof;
}
export async function currentSession(): Promise<PlatformSessionDto> {
  const value = await authRequest('session');
  if (!value || typeof value !== 'object') throw new AccessError(503);
  const v = value as Partial<PlatformSessionDto>;
  if (
    v.plane !== 'platform' ||
    typeof v.operatorId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(v.operatorId) ||
    !Number.isSafeInteger(v.idleExpiresAt) ||
    !Number.isSafeInteger(v.absoluteExpiresAt)
  )
    throw new AccessError(503);
  csrfProof(v);
  return v as PlatformSessionDto;
}
export function failureMessage(error: unknown, signingIn = false): string {
  if (!(error instanceof AccessError))
    return 'Service unavailable. Retry when the service recovers.';
  switch (error.status) {
    case 401:
      return signingIn
        ? 'Invalid credentials. Try again.'
        : 'Your session ended. Sign in to continue.';
    case 403:
      return 'Access denied. Platform operator access is required.';
    case 429:
      return `Too many requests. Retry after ${error.retryAfter} seconds.`;
    case 503:
      return 'Service unavailable or response uncertain. Retry explicitly; success is not confirmed.';
  }
}
export function signalAccessChange(
  signal: 'invalidate' | 'logout' = 'invalidate',
) {
  const channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('myims-platform-access');
  channel?.postMessage(signal);
  channel?.close();
}
