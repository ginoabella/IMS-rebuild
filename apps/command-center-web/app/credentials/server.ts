import 'server-only';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import { boundedJsonBody } from './bounded-body';
type Consumer =
  | { kind: 'exchange'; operation: 'csrf' | 'exchange' }
  | {
      kind: 'staff';
      operation: 'issue' | 'status' | 'cancel' | 'session';
      id?: string;
    };
export async function forwardCredential(request: Request, consumer: Consumer) {
  const prefix =
    consumer.kind === 'exchange' ? 'CREDENTIAL_EXCHANGE' : 'STAFF_ISSUER';
  const origin = process.env[`${prefix}_ORIGIN`],
    backend = process.env[`${prefix}_BACKEND_URL`],
    proxy = process.env[`${prefix}_PROXY_SECRET`],
    ingress = process.env[`${prefix}_INGRESS_SECRET`];
  const fail = (status: number) =>
    Response.json(
      {
        statusCode: status,
        message:
          status === 403
            ? 'Access denied'
            : status === 400
              ? 'Invalid request'
              : 'Service unavailable',
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          ...(status === 503 ? { 'Retry-After': '1' } : {}),
        },
      },
    );
  try {
    if (
      !origin ||
      !backend ||
      !proxy ||
      !ingress ||
      new URL(origin).origin !== origin ||
      new URL(origin).protocol !== 'https:' ||
      new URL(backend).origin !== backend ||
      !['http:', 'https:'].includes(new URL(backend).protocol) ||
      !/^[a-f0-9]{64}$/.test(proxy) ||
      !/^[a-f0-9]{64}$/.test(ingress) ||
      proxy === ingress
    )
      return fail(503);
    const source = request.headers.get('x-myims-client-ip') ?? '',
      proof = request.headers.get('x-myims-ingress') ?? '';
    if (
      !isIP(source) ||
      !/^[a-f0-9]{64}$/.test(proof) ||
      !timingSafeEqual(Buffer.from(proof), Buffer.from(ingress))
    )
      return fail(403);
    if (
      new URL(request.url).search ||
      request.headers.has('authorization') ||
      (request.headers.get('cookie')?.length ?? 0) > 8192
    )
      return fail(403);
    const mutation = ['exchange', 'issue', 'cancel'].includes(
      consumer.operation,
    );
    if (
      request.method !== (mutation ? 'POST' : 'GET') ||
      (mutation
        ? request.headers.get('origin') !== origin
        : !['same-origin', 'none'].includes(
            request.headers.get('sec-fetch-site') ?? '',
          ))
    )
      return fail(403);
    const name = consumer.kind === 'exchange' ? 'credential' : 'staff';
    const csrf = request.headers.get(`x-${name}-csrf`);
    if (csrf && !/^[A-Za-z0-9_-]{43}$/.test(csrf)) return fail(403);
    let body: string | undefined;
    if (mutation)
      try {
        body = await boundedJsonBody(request);
      } catch {
        return fail(400);
      }
    if (
      consumer.kind === 'staff' &&
      consumer.id &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        consumer.id,
      )
    )
      return fail(400);
    const path =
      consumer.kind === 'exchange'
        ? `/credential-actions/${consumer.operation}`
        : consumer.operation === 'issue'
          ? '/staff/credential-actions'
          : consumer.operation === 'session'
            ? '/staff/credential-actions/session'
            : `/staff/credential-actions/${consumer.id}${consumer.operation === 'cancel' ? '/cancel' : ''}`;
    const upstream = await fetch(`${backend}${path}`, {
      method: request.method,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        origin,
        'x-forwarded-for': source,
        [`x-${name}-proxy`]: proxy,
        ...(request.headers.get('cookie')
          ? { cookie: request.headers.get('cookie')! }
          : {}),
        ...(csrf ? { [`x-${name}-csrf`]: csrf } : {}),
        'content-type': 'application/json',
      },
      ...(body ? { body } : {}),
    });
    if (
      ![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(upstream.status)
    )
      return fail(503);
    const text = await boundedJsonBody(upstream);
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (
        consumer.kind !== 'exchange' ||
        consumer.operation !== 'csrf' ||
        !cookie.startsWith('__Host-myims-exchange-csrf=') ||
        !cookie.includes('Secure; HttpOnly; SameSite=Lax')
      )
        return fail(503);
      headers.append('Set-Cookie', cookie);
    }
    const retry = upstream.headers.get('retry-after');
    if (retry && /^\d{1,3}$/.test(retry)) headers.set('Retry-After', retry);
    return new Response(text, { status: upstream.status, headers });
  } catch {
    return fail(503);
  }
}
