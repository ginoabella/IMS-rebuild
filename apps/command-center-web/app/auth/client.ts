import type { StaffBrowserSessionDto } from '@myims/contracts';
export type AccessFailure = 401 | 403 | 429 | 503;
export class AccessError extends Error {
  constructor(
    public status: AccessFailure,
    public retryAfter = 1,
  ) {
    super('Staff access unavailable');
  }
}
export async function authRequest(
  path: 'csrf' | 'session' | 'sign-in' | 'logout',
  body?: unknown,
  proof?: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/staff/auth/browser/${path}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      method: path === 'csrf' || path === 'session' ? 'GET' : 'POST',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        ...(proof ? { 'X-Staff-CSRF': proof } : {}),
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
export async function currentSession(): Promise<StaffBrowserSessionDto> {
  const value = await authRequest('session');
  if (!value || typeof value !== 'object') throw new AccessError(503);
  const v = value as Partial<StaffBrowserSessionDto>;
  if (
    v.plane !== 'tenant' ||
    v.consumer !== 'web' ||
    typeof v.tenantId !== 'string' ||
    typeof v.staffId !== 'string' ||
    !Array.isArray(v.roles) ||
    !v.roles.length ||
    !v.roles.every((r) =>
      ['tenant_admin', 'call_taker', 'dispatcher', 'responder'].includes(r),
    ) ||
    !/^[a-f0-9-]{36}$/.test(v.tenantId) ||
    !/^[a-f0-9-]{36}$/.test(v.staffId) ||
    !Number.isSafeInteger(v.idleExpiresAt) ||
    !Number.isSafeInteger(v.absoluteExpiresAt)
  )
    throw new AccessError(503);
  if (Math.min(v.idleExpiresAt!, v.absoluteExpiresAt!) <= Date.now())
    throw new AccessError(401);
  csrfProof(v);
  return v as StaffBrowserSessionDto;
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
      return 'Access denied. Staff access is required.';
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
      : new BroadcastChannel('myims-staff-access');
  channel?.postMessage(signal);
  channel?.close();
}
