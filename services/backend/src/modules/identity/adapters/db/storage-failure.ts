import type { StorageResult } from '../../domain/storage';
export function storageFailure(error: unknown): StorageResult<never> {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  if (code === '23505') return { kind: 'duplicate' };
  if (code === '23503') return { kind: 'missing' };
  if (code === '23514' || code === '23502' || code === '22P02')
    return { kind: 'invalid' };
  return { kind: 'unavailable' };
}
