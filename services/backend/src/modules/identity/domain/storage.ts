export type AccountStatus = 'active' | 'disabled';
export type CredentialState = 'unset' | 'ready';
export type StorageResult<T> =
  | { kind: 'found'; value: T }
  | { kind: 'invalid' | 'duplicate' | 'missing' | 'stale' | 'unavailable' };
export function normalizeIdentifier(
  input: unknown,
  limit: number,
): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  // Reject unsupported Unicode before case conversion; no compatibility folding.
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(trimmed)) return null;
  if (trimmed.length > limit) return null;
  return trimmed.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
export const normalizeTenantCode = (input: unknown) =>
  normalizeIdentifier(input, 64);
export const normalizeUsername = (input: unknown) =>
  normalizeIdentifier(input, 128);
export function uuid(input: unknown): input is string {
  return (
    typeof input === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input,
    )
  );
}
export function positiveVersion(input: unknown): input is number {
  return (
    Number.isInteger(input) &&
    typeof input === 'number' &&
    input > 0 &&
    input < 2147483647
  );
}

export function onlyFields(input: object, fields: readonly string[]): boolean {
  return Object.keys(input).every((key) => fields.includes(key));
}
