import type {
  CreatePbxNodeRequest,
  EditPbxNodeRequest,
  PbxConflict,
  PbxInputField,
} from '@myims/contracts';
import { AccessError, type AccessFailure } from '../auth/client';
import { conflicts, detail, inputFields, list, uuid } from './validation';
export class PbxError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    public reason?: PbxConflict,
    public fields: Partial<Record<PbxInputField, string>> = {},
  ) {
    super('PBX request failed');
  }
}
async function request(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: CreatePbxNodeRequest | EditPbxNodeRequest,
  proof?: string,
) {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        ...(proof ? { 'X-Platform-CSRF': proof } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AccessError(503);
  }
  if ([400, 404, 409].includes(response.status)) {
    const value: unknown = await response.json().catch(() => null),
      fields: Partial<Record<PbxInputField, string>> = {};
    const v =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    if (v.fieldErrors && typeof v.fieldErrors === 'object')
      for (const f of inputFields)
        if (Object.hasOwn(v.fieldErrors, f))
          fields[f] = 'Review this PBX field.';
    throw new PbxError(
      response.status as 400 | 404 | 409,
      conflicts.find((c) => c === v.reason),
      fields,
    );
  }
  if (![200, 201].includes(response.status))
    throw new AccessError(
      [401, 403, 429].includes(response.status)
        ? (response.status as AccessFailure)
        : 503,
      Math.max(
        1,
        Math.min(900, Number(response.headers.get('retry-after')) || 1),
      ),
    );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AccessError(503);
  }
}
export async function listPbx(after: string | null) {
  const v = await request(
    `/platform/pbx-nodes?limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`,
    'GET',
  );
  if (!list(v, 25)) throw new AccessError(503);
  return v;
}
export async function getPbx(id: string) {
  if (!uuid(id)) throw new PbxError(400);
  const v = await request(`/platform/pbx-nodes/${id}`, 'GET');
  if (!detail(v) || v.node.id !== id.toLowerCase()) throw new AccessError(503);
  return v.node;
}
export async function savePbx(
  body: CreatePbxNodeRequest | EditPbxNodeRequest,
  proof: string,
  id?: string,
) {
  const v = await request(
    id ? `/platform/pbx-nodes/${id}` : '/platform/pbx-nodes',
    id ? 'PATCH' : 'POST',
    body,
    proof,
  );
  if (!detail(v) || (id && v.node.id !== id.toLowerCase()))
    throw new AccessError(503);
  return v.node;
}
