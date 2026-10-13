import type {
  StaffSessionDto,
  StaffSignInDto,
  StaffMobileSignInDto,
} from '@myims/contracts';
export class MobileAccessError extends Error {
  constructor(
    public status: number,
    public retryAfter = 1,
  ) {
    super('Staff access unavailable');
  }
}
export function mobileSession(value: unknown): value is StaffSessionDto {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<StaffSessionDto>;
  const id = (x: unknown) =>
    typeof x === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
  return (
    v.plane === 'tenant' &&
    v.consumer === 'mobile' &&
    id(v.tenantId) &&
    id(v.staffId) &&
    Array.isArray(v.roles) &&
    v.roles.length > 0 &&
    v.roles.every((r) =>
      ['tenant_admin', 'call_taker', 'dispatcher', 'responder'].includes(r),
    ) &&
    Number.isSafeInteger(v.idleExpiresAt) &&
    Number.isSafeInteger(v.absoluteExpiresAt)
  );
}
export interface MobileTransport {
  signIn(input: StaffSignInDto): Promise<StaffMobileSignInDto>;
  session(token: string): Promise<StaffSessionDto>;
  logout(token?: string): Promise<void>;
}
export function mobileTransport(origin: string | undefined): MobileTransport {
  async function request(
    path: 'sign-in' | 'session' | 'logout',
    token?: string,
    body?: StaffSignInDto,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      if (
        !origin ||
        new URL(origin).origin !== origin ||
        new URL(origin).protocol !== 'https:'
      )
        throw new MobileAccessError(503);
      const response = await fetch(`${origin}/staff/auth/mobile/${path}`, {
        method: path === 'session' ? 'GET' : 'POST',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          // Native fetch's cache option appends a query parameter to GET URLs.
          // Keep the exact native route; the ingress also responds with no-store.
          'Cache-Control': 'no-store',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok)
        throw new MobileAccessError(
          [400, 401, 403, 429].includes(response.status)
            ? response.status
            : 503,
          Math.max(
            1,
            Math.min(900, Number(response.headers.get('retry-after')) || 1),
          ),
        );
      const text = await response.text();
      if (text.length > 8192) throw new MobileAccessError(503);
      return JSON.parse(text);
    } catch (error) {
      throw error instanceof MobileAccessError
        ? error
        : new MobileAccessError(503);
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    async signIn(input) {
      const value = await request('sign-in', undefined, input);
      if (
        !mobileSession(value) ||
        !('token' in value) ||
        typeof value.token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(value.token)
      )
        throw new MobileAccessError(503);
      return value as StaffMobileSignInDto;
    },
    async session(token) {
      const value = await request('session', token);
      if (!mobileSession(value)) throw new MobileAccessError(503);
      return value;
    },
    async logout(token) {
      const value = await request('logout', token);
      if (
        !value ||
        typeof value !== 'object' ||
        !('signedOut' in value) ||
        value.signedOut !== true
      )
        throw new MobileAccessError(503);
    },
  };
}
