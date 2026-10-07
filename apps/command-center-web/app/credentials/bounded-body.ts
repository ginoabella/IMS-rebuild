import 'server-only';
export async function boundedJsonBody(request: Request | Response) {
  let body: string | undefined;
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096))
    throw new Error('Invalid request body');
  const declared = length === null ? null : Number(length);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request body deadline')), 4000);
  });
  try {
    if (reader && declared !== 0) {
      for (;;) {
        const part = await Promise.race([reader.read(), deadline]);
        if (part.done) break;
        size += part.value.length;
        if (size > 4096 || (declared !== null && size > declared)) {
          void reader.cancel().catch(() => {});
          throw new Error('Invalid request body');
        }
        chunks.push(part.value);
        // HTTP framing already bounds Content-Length; do not await a redundant stream close.
        if (declared !== null && size === declared) break;
      }
    }
    if (declared !== null && size !== declared)
      throw new Error('Invalid request body');
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.concat(chunks),
      );
    } catch {
      throw new Error('Invalid request body');
    }
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    throw new Error('Unavailable request body');
  } finally {
    clearTimeout(timer);
  }

  if (
    !request.headers.get('content-type')?.startsWith('application/json') ||
    body === undefined
  )
    throw new Error('Invalid request body');
  return body;
}
