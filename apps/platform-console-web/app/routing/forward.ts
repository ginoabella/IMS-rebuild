import 'server-only';
import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import { input, obj, output, route, uuid } from './validation';
const reasons = [
  'stale_version',
  'name_conflict',
  'number_conflict',
  'invalid_extension',
  'invalid_group',
  'referenced',
  'request_conflict',
  'intent_expired',
  'graph_limit',
];
export async function forwardRouting(
  request: Request,
  nodeId: string,
  parts: string[],
) {
  const method = request.method,
    url = new URL(request.url),
    keys = [...url.searchParams.keys()];
  if (
    !uuid(nodeId) ||
    !route(parts, method) ||
    keys.some((k) => !['limit', 'after'].includes(k)) ||
    new Set(keys).size !== keys.length ||
    (keys.length && !(method === 'GET' && parts.length === 2)) ||
    (url.searchParams.has('after') && !uuid(url.searchParams.get('after'))) ||
    (url.searchParams.has('limit') &&
      !/^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit')!))
  )
    return safeError(400);
  let body: string | undefined;
  if (method !== 'GET') {
    try {
      body = await boundedJsonBody(request);
      if (!input(parts, method, JSON.parse(body))) return safeError(400);
    } catch {
      return safeError(400);
    }
  }
  const upstream = await backendRequest(
    { consumer: 'routing', nodeId, parts, query: url.search },
    request.headers,
    method as 'GET' | 'POST' | 'PATCH',
    body,
  );
  const status = upstream.status;
  if (![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(status))
    return safeError(503);
  try {
    const reader = upstream.body?.getReader();
    if (!reader) return safeError(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.length;
      if (size > 65536) {
        await reader.cancel();
        return safeError(503);
      }
      chunks.push(p.value);
    }
    const v: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (status < 300) {
      if (!output(parts, method, v)) return safeError(503);
      return Response.json(v, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const data = obj(v) ? v : {};
    const fieldErrors: Record<string, string> = {};
    if (obj(data.fieldErrors))
      for (const k of [
        'body',
        'name',
        'number',
        'memberIds',
        'strategy',
        'timeout',
        'fallback',
        'purpose',
        'pattern',
        'expectedVersion',
        'requestId',
      ])
        if (Object.hasOwn(data.fieldErrors, k))
          fieldErrors[k] =
            k === 'number'
              ? 'Use a number 1000–899999 or leave empty.'
              : k === 'timeout'
                ? 'Use 5–120 seconds per attempt.'
                : k === 'memberIds'
                  ? 'Select 1–32 distinct inventory extensions.'
                  : k === 'fallback'
                    ? 'Review the fallback destination; cycles are not permitted.'
                    : k === 'pattern'
                      ? 'Use ASCII digits and total lengths 1–15.'
                      : 'Review this field.';
    return Response.json(
      {
        statusCode: status,
        message:
          status === 400
            ? 'Review the entered fields.'
            : status === 409
              ? 'Reload and review the resource conflict.'
              : status === 404
                ? 'Resource not found.'
                : status === 401
                  ? 'Authentication required'
                  : status === 403
                    ? 'Access denied'
                    : status === 429
                      ? 'Too many requests'
                      : 'Service unavailable',
        ...(reasons.includes(String(data.reason))
          ? { reason: data.reason }
          : {}),
        fieldErrors,
        ...(Array.isArray(data.blockers) &&
        data.blockers.length <= 10 &&
        data.blockers.every(
          (b) =>
            obj(b) &&
            uuid(b.id) &&
            typeof b.name === 'string' &&
            b.name.length <= 320,
        )
          ? { blockers: data.blockers.map((b) => ({ id: b.id, name: b.name })) }
          : {}),
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          ...(upstream.headers.get('retry-after') &&
          /^\d+$/.test(upstream.headers.get('retry-after')!)
            ? {
                'Retry-After': String(
                  Math.max(
                    1,
                    Math.min(900, Number(upstream.headers.get('retry-after'))),
                  ),
                ),
              }
            : status === 503
              ? { 'Retry-After': '1' }
              : {}),
        },
      },
    );
  } catch {
    return safeError(503);
  }
}
