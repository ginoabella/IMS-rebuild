import { backendRequest, safeError } from '../../../auth/server';
export const dynamic = 'force-dynamic';

async function handle(
  request: Request,
  context: { params: Promise<{ consumer: string }> },
) {
  const { consumer } = await context.params;
  if (!['csrf', 'sign-in', 'session', 'logout'].includes(consumer))
    return safeError(403);
  const expected =
    consumer === 'csrf' || consumer === 'session' ? 'GET' : 'POST';
  if (request.method !== expected || new URL(request.url).search)
    return safeError(403);
  let body: string | undefined;
  if (expected === 'POST') {
    const length = request.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096))
      return safeError(400);
    const declared = length === null ? null : Number(length);
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Request body deadline')),
        4000,
      );
    });
    try {
      if (reader && declared !== 0) {
        for (;;) {
          const part = await Promise.race([reader.read(), deadline]);
          if (part.done) break;
          size += part.value.length;
          if (size > 4096 || (declared !== null && size > declared)) {
            void reader.cancel().catch(() => {});
            return safeError(400);
          }
          chunks.push(part.value);
          // HTTP framing already bounds Content-Length; do not await a redundant stream close.
          if (declared !== null && size === declared) break;
        }
      }
      if (declared !== null && size !== declared) return safeError(400);
      try {
        body = new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.concat(chunks),
        );
      } catch {
        return safeError(400);
      }
    } catch {
      if (reader) void reader.cancel().catch(() => {});
      return safeError(503);
    } finally {
      clearTimeout(timer);
    }
    if (
      consumer === 'sign-in' &&
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      return safeError(400);
  }
  const upstream = await backendRequest(
    consumer as 'csrf' | 'session' | 'sign-in' | 'logout',
    request.headers,
    expected,
    body,
  );
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  });
  const retry = upstream.headers.get('retry-after');
  if (retry && /^\d+$/.test(retry))
    headers.set(
      'Retry-After',
      String(Math.max(1, Math.min(900, Number(retry)))),
    );
  for (const cookie of upstream.headers.getSetCookie()) {
    // Backend emits only these host-only cookies; do not propagate arbitrary cookies.
    if (
      /^__Host-myims-platform(?:-csrf)?=/.test(cookie) &&
      /; Secure/i.test(cookie) &&
      /; HttpOnly/i.test(cookie) &&
      /; SameSite=Lax/i.test(cookie) &&
      /; Path=\/(?:;|$)/i.test(cookie) &&
      !/; Domain=/i.test(cookie)
    )
      headers.append('Set-Cookie', cookie);
  }
  if (![200, 201, 400, 401, 403, 429, 503].includes(upstream.status))
    return safeError(503);
  // Fixed backend DTOs only; arbitrary upstream response headers are never forwarded.
  let payload: string;
  try {
    payload = await upstream.text();
  } catch {
    return safeError(503);
  }
  return new Response(payload, {
    status: upstream.status,
    headers,
  });
}
export const GET = handle;
export const POST = handle;
