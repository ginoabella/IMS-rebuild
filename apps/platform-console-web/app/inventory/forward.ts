import 'server-only';
import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import { input, output, route, uuid, obj } from './validation';
export async function forwardInventory(
  request: Request,
  nodeId: string,
  parts: string[],
) {
  const method = request.method;
  if (!uuid(nodeId) || !route(parts, method)) return safeError(400);
  const url = new URL(request.url),
    keys = [...url.searchParams.keys()];
  const paged = method === 'GET' && parts.length === 1;
  if (
    (!paged && keys.length) ||
    keys.some((k) => !['limit', 'after'].includes(k)) ||
    new Set(keys).size !== keys.length ||
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
    { consumer: 'inventory', nodeId, parts, query: url.search },
    request.headers,
    method as 'GET' | 'POST' | 'PATCH',
    body,
  );
  const status = upstream.status;
  if (![200, 201, 202, 400, 401, 403, 404, 409, 429, 503].includes(status))
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
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    );
    let result: unknown;
    if (status < 300) {
      if (!output(parts, method, value)) return safeError(503);
      result = value;
    } else {
      const v = obj(value) ? value : {};
      const reasons = [
        'number_conflict',
        'request_conflict',
        'stale_version',
        'dependency_changed',
        'profile_name_conflict',
        'inventory_ineligible',
        'intent_expired',
        'credential_state_conflict',
        'credential_operation_pending',
      ];
      const fieldErrors: Record<string, string> = {};
      if (obj(v.fieldErrors))
        for (const key of [
          'number',
          'numbers',
          'kind',
          'settings',
          'name',
          'dependencies',
          'expectedVersion',
          'body',
        ])
          if (Object.hasOwn(v.fieldErrors, key))
            fieldErrors[key] = 'Review this inventory field.';
      result = {
        ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
        statusCode: status,
        message:
          status === 409
            ? 'Inventory conflict. Reload and review current versions.'
            : status === 400
              ? 'Invalid inventory request. Review the entered values.'
              : status === 404
                ? 'Inventory resource not found.'
                : status === 401
                  ? 'Authentication required'
                  : status === 403
                    ? 'Access denied'
                    : status === 429
                      ? 'Too many requests'
                      : 'Service unavailable',
        ...(reasons.includes(String(v.reason)) ? { reason: v.reason } : {}),
        ...(obj(v.conflicts) &&
        Array.isArray(v.conflicts.numbers) &&
        v.conflicts.numbers.length <= 10 &&
        Number.isSafeInteger(v.conflicts.total) &&
        Number(v.conflicts.total) >= 1 &&
        Number(v.conflicts.total) <= 50 &&
        typeof v.conflicts.truncated === 'boolean' &&
        v.conflicts.numbers.every(
          (n) => typeof n === 'string' && /^[1-9][0-9]{3,5}$/.test(n),
        )
          ? {
              conflicts: {
                numbers: v.conflicts.numbers,
                total: v.conflicts.total,
                truncated: v.conflicts.truncated,
              },
            }
          : {}),
      };
    }
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const retry = upstream.headers.get('retry-after');
    if (retry && /^\d+$/.test(retry))
      headers.set(
        'Retry-After',
        String(Math.max(1, Math.min(900, Number(retry)))),
      );
    return Response.json(result, { status, headers });
  } catch {
    return safeError(503);
  }
}
