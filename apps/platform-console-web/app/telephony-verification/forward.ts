import { backendRequest, safeError } from '../auth/server';
import { boundedJsonBody } from '../auth/bounded-body';
import {
  verificationRoute,
  verificationInput,
  verificationOutput,
  retirementInput,
  retirementOutput,
  uuid,
  obj,
} from './validation';
export async function forwardTelephony(
  request: Request,
  nodeId: string,
  tenantId: string | null,
  parts: string[],
) {
  const method = request.method,
    url = new URL(request.url),
    retirement = tenantId === null;
  if (
    !uuid(nodeId) ||
    (tenantId !== null && !uuid(tenantId)) ||
    url.search ||
    !(retirement
      ? parts.length === 0 && ['GET', 'POST'].includes(method)
      : verificationRoute(parts, method))
  )
    return safeError(400);
  let body: string | undefined;
  if (method === 'POST')
    try {
      body = await boundedJsonBody(request);
      const v: unknown = JSON.parse(body);
      if (!(retirement ? retirementInput(v) : verificationInput(parts, v)))
        return safeError(400);
    } catch {
      return safeError(400);
    }
  const r = await backendRequest(
    retirement
      ? { consumer: 'artifact-retirements', nodeId }
      : { consumer: 'tenant-telephony', nodeId, tenantId: tenantId!, parts },
    request.headers,
    method as 'GET' | 'POST',
    body,
  );
  if (![200, 201, 202, 400, 401, 403, 404, 409, 429, 503].includes(r.status))
    return safeError(503);
  try {
    const reader = r.body?.getReader();
    if (!reader) return safeError(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > (r.ok ? 65536 : 4096)) {
        await reader.cancel();
        return safeError(503);
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    const v: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (r.ok) {
      if (
        !(retirement
          ? retirementOutput(method, v)
          : verificationOutput(parts, method, v))
      )
        return safeError(503);
      return Response.json(v, {
        status: r.status,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (!obj(v)) return safeError(503);
    return Response.json(
      {
        statusCode: r.status,
        message: 'Telephony request unavailable',
        ...(typeof v.reason === 'string' && /^[a-z_]{1,80}$/.test(v.reason)
          ? { reason: v.reason }
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
