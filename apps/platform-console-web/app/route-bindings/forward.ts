import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import {
  bindingRoute,
  bindingInput,
  bindingOutput,
  uuid,
  obj,
} from './validation';
export async function forwardBindings(
  request: Request,
  tenantId: string,
  nodeId: string,
  parts: string[],
) {
  const url = new URL(request.url),
    method = request.method,
    keys = [...url.searchParams.keys()];
  if (
    !uuid(tenantId) ||
    !uuid(nodeId) ||
    !bindingRoute(parts, method) ||
    new Set(keys).size !== keys.length ||
    keys.some(
      (k) =>
        ![
          'limit',
          'after',
          ...(parts.length === 0 ? ['history'] : []),
          ...(parts.length === 1 && parts[0] === 'selection' ? ['kind'] : []),
        ].includes(k),
    ) ||
    ((method !== 'GET' || (parts.length === 1 && uuid(parts[0]))) &&
      keys.length) ||
    (url.searchParams.has('limit') &&
      !/^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('limit')!)) ||
    (url.searchParams.has('after') && !uuid(url.searchParams.get('after'))) ||
    (parts[0] === 'selection' &&
      ![
        'dids',
        'groups',
        'inbound',
        'outbound',
        'trunks',
        'permission',
      ].includes(url.searchParams.get('kind') ?? '')) ||
    (url.searchParams.has('history') &&
      url.searchParams.get('history') !== 'true')
  )
    return safeError(400);
  let body: string | undefined;
  if (method === 'POST')
    try {
      body = await boundedJsonBody(request);
      if (!bindingInput(parts, JSON.parse(body))) return safeError(400);
    } catch {
      return safeError(400);
    }
  const r = await backendRequest(
    { consumer: 'route-bindings', tenantId, nodeId, parts, query: url.search },
    request.headers,
    method as 'GET' | 'POST',
    body,
  );
  if (![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(r.status))
    return safeError(503);
  try {
    const reader = r.body?.getReader();
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
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (r.status < 300) {
      if (!bindingOutput(parts, method, value, tenantId, nodeId))
        return safeError(503);
      return Response.json(value, {
        status: r.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const v = obj(value) ? value : {};
    const reasons = [
      'stale_version',
      'tenant_ineligible',
      'ownership_conflict',
      'incompatible',
      'graph_limit',
      'request_conflict',
      'intent_expired',
      'referenced',
      'invalid_transition',
    ];
    return Response.json(
      {
        statusCode: r.status,
        message:
          r.status === 409
            ? 'Reload and review the route binding conflict.'
            : r.status === 400
              ? 'Review the entered fields.'
              : r.status === 404
                ? 'Resource not found.'
                : r.status === 401
                  ? 'Authentication required'
                  : r.status === 403
                    ? 'Access denied'
                    : r.status === 429
                      ? 'Too many requests'
                      : 'Service unavailable',
        ...(reasons.includes(String(v.reason)) ? { reason: v.reason } : {}),
        ...(Array.isArray(v.blockers)
          ? {
              blockers: v.blockers
                .slice(0, 10)
                .filter(
                  (b) =>
                    obj(b) &&
                    uuid(b.id) &&
                    typeof b.name === 'string' &&
                    b.name.length <= 320,
                )
                .map((b) => ({
                  id: b.id,
                  name: b.name,
                  ...(b.tenantId === null || uuid(b.tenantId)
                    ? { tenantId: b.tenantId }
                    : {}),
                  kind: [
                    'dids',
                    'groups',
                    'inbound',
                    'outbound',
                    'trunks',
                    'permission',
                    'binding',
                    'extensions',
                    'gateways',
                  ].includes(String(b.kind))
                    ? b.kind
                    : 'binding',
                })),
            }
          : {}),
      },
      {
        status: r.status,
        headers: {
          'Cache-Control': 'no-store',
          ...(r.status === 503 ? { 'Retry-After': '1' } : {}),
        },
      },
    );
  } catch {
    return safeError(503);
  }
}
