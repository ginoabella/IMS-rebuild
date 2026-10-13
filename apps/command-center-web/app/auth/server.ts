import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { StaffBrowserSessionDto } from '@myims/contracts';

export function transportConfig() {
  const origin = process.env.STAFF_ISSUER_ORIGIN;
  const backend = process.env.STAFF_ISSUER_BACKEND_URL;
  const proxySecret = process.env.STAFF_ISSUER_PROXY_SECRET;
  const ingressSecret = process.env.STAFF_ISSUER_INGRESS_SECRET;
  if (!origin || !backend || !proxySecret || !ingressSecret) return null;
  try {
    const publicUrl = new URL(origin),
      privateUrl = new URL(backend);
    if (
      publicUrl.protocol !== 'https:' ||
      publicUrl.origin !== origin ||
      !['http:', 'https:'].includes(privateUrl.protocol) ||
      privateUrl.origin !== backend ||
      !/^[a-f0-9]{64}$/.test(proxySecret) ||
      !/^[a-f0-9]{64}$/.test(ingressSecret) ||
      ingressSecret === proxySecret
    )
      return null;
    return { origin, backend, proxySecret, ingressSecret };
  } catch {
    return null;
  }
}

// The private Next listener accepts only an ingress that overwrites both headers.
export function ingressSource(headers: Headers): string | null {
  const config = transportConfig();
  const proof = headers.get('x-myims-ingress') ?? '';
  const source = headers.get('x-myims-client-ip') ?? '';
  if (!config || !/^[a-f0-9]{64}$/.test(proof) || !isIP(source)) return null;
  return timingSafeEqual(Buffer.from(proof), Buffer.from(config.ingressSecret))
    ? source
    : null;
}

export function sessionDto(value: unknown): value is StaffBrowserSessionDto {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const id = (x: unknown) =>
    typeof x === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
  return (
    v.plane === 'tenant' &&
    v.consumer === 'web' &&
    id(v.tenantId) &&
    id(v.staffId) &&
    Array.isArray(v.roles) &&
    v.roles.length > 0 &&
    v.roles.every((r) =>
      ['tenant_admin', 'call_taker', 'dispatcher', 'responder'].includes(r),
    ) &&
    typeof v.proof === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(v.proof) &&
    Number.isSafeInteger(v.idleExpiresAt) &&
    Number.isSafeInteger(v.absoluteExpiresAt) &&
    (v.idleExpiresAt as number) > Date.now() &&
    (v.absoluteExpiresAt as number) > Date.now()
  );
}

export async function backendRequest(
  path: 'csrf' | 'sign-in' | 'session' | 'logout',
  headers: Headers,
  method: 'GET' | 'POST',
  body?: string,
): Promise<Response> {
  const config = transportConfig(),
    source = ingressSource(headers);
  if (!config || !source) return safeError(503);
  const origin = headers.get('origin');
  if (method === 'POST' && origin !== config.origin) return safeError(403);
  const site = headers.get('sec-fetch-site');
  if (method === 'GET' && site !== 'same-origin' && site !== 'none')
    return safeError(403);
  // Authorization is never silently converted to the cookie channel.
  if (headers.has('authorization')) return safeError(403);
  const cookie = headers.get('cookie');
  const proof = headers.get('x-staff-csrf') ?? '';
  if ((cookie !== null && cookie.length > 8192) || proof.length > 1024)
    return safeError(403);
  try {
    return await fetch(`${config.backend}/staff/auth/browser/${path}`, {
      method,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        origin: method === 'GET' ? config.origin : origin!,
        'x-staff-proxy': config.proxySecret,
        'x-forwarded-for': source,
        ...(cookie === null ? {} : { cookie }),
        ...(proof ? { 'x-staff-csrf': proof } : {}),
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    return safeError(503);
  }
}

export function safeError(status: 400 | 401 | 403 | 429 | 503) {
  const messages = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    429: 'Too many requests',
    503: 'Service unavailable',
  };
  return Response.json(
    { statusCode: status, message: messages[status] },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(status === 503 ? { 'Retry-After': '1' } : {}),
      },
    },
  );
}
