import type { CreateDraftTenantDto, TenantApiErrorDto } from '@myims/contracts';
export const tenantUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function text(value: string, rawBound: number) {
  // eslint-disable-next-line no-control-regex -- same raw control rejection as the API.
  if (value.length > rawBound || /[\u0000-\u001f\u007f-\u009f]/u.test(value))
    return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
export function draftErrors(
  values: Omit<CreateDraftTenantDto, 'requestId'>,
): NonNullable<TenantApiErrorDto['fieldErrors']> {
  const errors: NonNullable<TenantApiErrorDto['fieldErrors']> = {};
  if (
    !text(values.tenantCode, 256) ||
    values.tenantCode.trim().length > 64 ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(values.tenantCode.trim())
  )
    errors.tenantCode =
      'Use 1–64 letters, numbers, dots, underscores or hyphens, starting with a letter or number.';
  if (
    !text(values.displayName, 800) ||
    !values.displayName.trim() ||
    values.displayName.trim().length > 200
  )
    errors.displayName =
      'Enter an organization name of 1–200 characters without control characters.';
  if (
    !text(values.administratorUsername, 512) ||
    values.administratorUsername.trim().length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(values.administratorUsername.trim())
  )
    errors.administratorUsername =
      'Use 1–128 letters, numbers, dots, underscores or hyphens, starting with a letter or number.';
  return errors;
}
