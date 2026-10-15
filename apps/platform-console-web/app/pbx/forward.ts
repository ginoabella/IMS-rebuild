import 'server-only';
import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import {
  conflicts,
  detail,
  inputFields,
  list,
  uuid,
  write,
} from './validation';
export async function forwardPbx(request: Request, id?: string) {
  const url = new URL(request.url),
    method = request.method;
  if (
    !(id ? ['GET', 'PATCH'] : ['GET', 'POST']).includes(method) ||
    (id !== undefined && !uuid(id))
  )
    return safeError(400);
  const fields = [...url.searchParams.keys()],
    limit = url.searchParams.get('limit'),
    after = url.searchParams.get('after');
  if (
    id !== undefined || method !== 'GET'
      ? !!url.search
      : fields.some((k) => !['limit', 'after'].includes(k)) ||
        new Set(fields).size !== fields.length ||
        (limit !== null &&
          (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100)) ||
        (after !== null && !uuid(after))
  )
    return safeError(400);
  let body: string | undefined;
  if (method !== 'GET') {
    try {
      body = await boundedJsonBody(request);
      if (!write(JSON.parse(body), method === 'PATCH')) return safeError(400);
    } catch {
      return safeError(400);
    }
  }
  const upstream = await backendRequest(
    id === undefined
      ? { consumer: 'pbx-nodes', query: url.search }
      : { consumer: 'pbx-node', id: id.toLowerCase() },
    request.headers,
    method as 'GET' | 'POST' | 'PATCH',
    body,
  );
  const status = upstream.status;
  if (![200, 201, 400, 401, 403, 404, 409, 429, 503].includes(status))
    return safeError(503);
  try {
    // Bound observation lists independently of the much smaller mutation body.
    const reader = upstream.body?.getReader();
    if (!reader) return safeError(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 32 * 1024 * 1024) {
        await reader.cancel();
        return safeError(503);
      }
      chunks.push(part.value);
    }
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    );
    let output: unknown;
    if (status === 200 || status === 201) {
      if (
        !(id === undefined && method === 'GET'
          ? list(value, Number(limit ?? 25))
          : detail(value))
      )
        return safeError(503);
      output = value;
    } else {
      const v =
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)
          : {};
      const fieldErrors: Record<string, string> = {};
      if (v.fieldErrors && typeof v.fieldErrors === 'object')
        for (const field of inputFields)
          if (Object.hasOwn(v.fieldErrors, field))
            fieldErrors[field] = 'Invalid PBX field';
      output = {
        statusCode: status,
        message:
          status === 401
            ? 'Authentication required'
            : status === 403
              ? 'Access denied'
              : status === 404
                ? 'PBX node not found'
                : status === 409
                  ? 'PBX conflict'
                  : status === 400
                    ? 'Invalid request'
                    : status === 429
                      ? 'Too many requests'
                      : 'Service unavailable',
        ...(conflicts.some((c) => c === v.reason) ? { reason: v.reason } : {}),
        ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
      };
    }
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const retry = upstream.headers.get('retry-after');
    if (retry && /^\d+$/.test(retry))
      headers.set(
        'Retry-After',
        String(Math.max(1, Math.min(900, Number(retry)))),
      );
    return Response.json(output, { status, headers });
  } catch {
    return safeError(503);
  }
}
