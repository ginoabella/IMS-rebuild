import type {
  CreateDraftTenantDto,
  TenantApiErrorDto,
  TenantInputField,
} from '@myims/contracts';
import {
  normalizeTenantCode,
  normalizeUsername,
  onlyFields,
  uuid,
} from '../../identity/domain/storage';
export type FieldErrors = NonNullable<TenantApiErrorDto['fieldErrors']>;
export type Parsed<T> =
  { kind: 'valid'; value: T } | { kind: 'invalid'; fieldErrors: FieldErrors };
function text(input: unknown, bound: number): input is string {
  if (
    typeof input !== 'string' ||
    input.length > bound ||
    // eslint-disable-next-line no-control-regex -- reject control text before normalization.
    /[\u0000-\u001f\u007f-\u009f]/u.test(input)
  )
    return false;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
export function draftTenantInput(input: unknown): Parsed<CreateDraftTenantDto> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, [
      'requestId',
      'tenantCode',
      'displayName',
      'administratorUsername',
    ])
  )
    return { kind: 'invalid', fieldErrors: { body: 'Invalid fields' } };
  const data = input as Record<string, unknown>;
  const fieldErrors: FieldErrors = {};
  const tenantCode = text(data.tenantCode, 256)
    ? normalizeTenantCode(data.tenantCode)
    : null;
  const administratorUsername = text(data.administratorUsername, 512)
    ? normalizeUsername(data.administratorUsername)
    : null;
  const displayName = text(data.displayName, 800)
    ? data.displayName.trim()
    : '';
  if (!uuid(data.requestId))
    fieldErrors.requestId = 'Invalid request identifier';
  if (!tenantCode) fieldErrors.tenantCode = 'Invalid tenant code';
  if (!administratorUsername)
    fieldErrors.administratorUsername = 'Invalid administrator username';
  if (!displayName || displayName.length > 200)
    fieldErrors.displayName = 'Invalid organization name';
  if (
    Object.keys(fieldErrors).length ||
    !tenantCode ||
    !administratorUsername ||
    !uuid(data.requestId)
  )
    return { kind: 'invalid', fieldErrors };
  return {
    kind: 'valid',
    value: {
      requestId: data.requestId.toLowerCase(),
      tenantCode,
      displayName,
      administratorUsername,
    },
  };
}
export function tenantListInput(
  input: unknown,
): Parsed<{ limit: number; after: string | null }> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !onlyFields(input, ['limit', 'after'])
  )
    return { kind: 'invalid', fieldErrors: { body: 'Invalid query' } };
  const data = input as Record<string, unknown>;
  const limit =
    data.limit === undefined
      ? 25
      : typeof data.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(data.limit)
        ? Number(data.limit)
        : 0;
  if (limit < 1 || limit > 100)
    return { kind: 'invalid', fieldErrors: { limit: 'Invalid page limit' } };
  if (data.after !== undefined && !uuid(data.after))
    return { kind: 'invalid', fieldErrors: { after: 'Invalid cursor' } };
  return {
    kind: 'valid',
    value: {
      limit,
      after: typeof data.after === 'string' ? data.after.toLowerCase() : null,
    },
  };
}
export function invalidReference(field: TenantInputField): {
  kind: 'invalid';
  fieldErrors: FieldErrors;
} {
  return { kind: 'invalid', fieldErrors: { [field]: 'Invalid identifier' } };
}
