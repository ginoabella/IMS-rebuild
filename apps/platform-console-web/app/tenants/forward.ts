import { backendRequest, safeError } from '../auth/server';
import { tenantUuid } from './validation';
export async function forwardTenant(request: Request, tenantId?: string) {
  const url = new URL(request.url);
  const expected = tenantId === undefined ? request.method : 'GET';
  if (
    !['GET', 'POST'].includes(expected) ||
    request.method !== expected ||
    (tenantId !== undefined && !tenantUuid(tenantId))
  )
    return safeError(400);
  const keys = [...url.searchParams.keys()];
  const limit = url.searchParams.get('limit');
  const after = url.searchParams.get('after');
  if (
    tenantId !== undefined || expected === 'POST'
      ? !!url.search
      : keys.some((k) => !['limit', 'after'].includes(k)) ||
        new Set(keys).size !== keys.length ||
        (limit !== null &&
          (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100)) ||
        (after !== null && !tenantUuid(after))
  )
    return safeError(400);
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
      expected === 'POST' &&
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      return safeError(400);
  }
  const upstream = await backendRequest(
    tenantId === undefined
      ? { consumer: 'tenants', query: url.search }
      : { consumer: 'tenant', id: tenantId.toLowerCase() },
    request.headers,
    expected as 'GET' | 'POST',
    body,
  );
  if (![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(upstream.status))
    return safeError(503);
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
  try {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers,
    });
  } catch {
    return safeError(503);
  }
}
