import 'server-only';
import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import { input, output, route, uuid } from './validation';
async function boundedResponse(
  response: Response,
  limit: number,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('Response limit');
    }
    chunks.push(part.value);
  }
  return JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
  ) as unknown;
}
export async function forwardRevisions(
  request: Request,
  nodeId: string,
  parts: string[],
) {
  const url = new URL(request.url),
    method = request.method,
    keys = [...url.searchParams.keys()];
  if (
    !uuid(nodeId) ||
    !route(parts, method) ||
    new Set(keys).size !== keys.length ||
    keys.some(
      (k) =>
        !(
          parts[1] === 'live'
            ? []
            : method === 'GET' && parts.length === 1
              ? ['after', 'limit']
              : method === 'GET' && parts.length === 2
                ? ['baselineId']
                : []
        ).includes(k),
    ) ||
    (url.searchParams.has('baselineId') &&
      !uuid(url.searchParams.get('baselineId'))) ||
    ['after', 'limit'].some(
      (k) =>
        url.searchParams.has(k) && !/^\d{1,10}$/.test(url.searchParams.get(k)!),
    )
  )
    return safeError(400);
  let body: string | undefined;
  if (method === 'POST') {
    try {
      body = await boundedJsonBody(request);
      if (!input(parts, JSON.parse(body))) return safeError(400);
    } catch {
      return safeError(400);
    }
  }
  const upstream = await backendRequest(
    { consumer: 'revisions', nodeId, parts, query: url.search },
    request.headers,
    method as 'GET' | 'POST',
    body,
  );
  if (
    ![200, 201, 202, 400, 401, 403, 404, 409, 429, 503].includes(
      upstream.status,
    )
  )
    return safeError(503);
  if (upstream.status >= 400) {
    let reason: unknown;
    try {
      const v = await boundedResponse(upstream, 4096);
      if (v && typeof v === 'object' && 'reason' in v) reason = v.reason;
    } catch {
      /* finite error below */
    }
    return Response.json(
      {
        statusCode: upstream.status,
        message:
          upstream.status === 409
            ? 'Reload and review the revision conflict.'
            : upstream.status === 404
              ? 'Revision or receipt not found.'
              : 'Revision request unavailable.',
        ...(typeof reason === 'string' &&
        [
          'snapshot_limit',
          'request_conflict',
          'intent_expired',
          'verified_baseline_required',
          'operation_unresolved',
          'stale_baseline',
          'reconciliation_target_required',
          'stale_review',
          'known_good_target_required',
        ].includes(reason)
          ? { reason }
          : {}),
      },
      {
        status: upstream.status,
        headers: {
          'Cache-Control': 'no-store',
          ...(/^\d+$/.test(upstream.headers.get('retry-after') ?? '')
            ? {
                'Retry-After': String(
                  Math.max(
                    1,
                    Math.min(900, Number(upstream.headers.get('retry-after'))),
                  ),
                ),
              }
            : upstream.status === 503
              ? { 'Retry-After': '1' }
              : {}),
        },
      },
    );
  }
  try {
    const v = await boundedResponse(
      upstream,
      parts[1] === 'live' ? 1048576 : 32 * 1024 * 1024,
    );
    if (!output(parts, method, v)) return safeError(503);
    return Response.json(v, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return safeError(503);
  }
}
