import { createHash, randomUUID } from 'node:crypto';

export type StorageOutcome =
  | 'invalid_input'
  | 'missing'
  | 'forbidden'
  | 'timeout'
  | 'unavailable'
  | 'cancelled'
  | 'busy'
  | 'conflict';
export class StorageError extends Error {
  constructor(
    readonly code: StorageOutcome,
    readonly writeMayHaveSucceeded = false,
  ) {
    super(`Storage operation failed: ${code}`);
    this.name = 'StorageError';
  }
}
export interface ObjectReference {
  readonly scopeId: string;
  readonly objectId: string;
  readonly sha256: string;
  readonly size: number;
}
export interface StorageCall {
  signal?: AbortSignal;
  correlationId: string;
}
export interface ExpiringReadReference {
  readonly url: string;
  readonly expiresAt: string;
}
export interface SharedStorage {
  assign(scopeId: string, bytes: Uint8Array): ObjectReference;
  write(
    reference: ObjectReference,
    bytes: Uint8Array,
    call: StorageCall,
  ): Promise<void>;
  read(reference: ObjectReference, call: StorageCall): Promise<Uint8Array>;
  reference(
    reference: ObjectReference,
    call: StorageCall,
    lifetimeSeconds?: number,
  ): Promise<ExpiringReadReference>;
  inspect(call: StorageCall): Promise<void>;
  close(): void;
}
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function digest(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}
export function objectKey(
  reference: ObjectReference,
  maxBytes: number,
): string {
  if (
    !reference ||
    typeof reference !== 'object' ||
    Array.isArray(reference) ||
    typeof reference.scopeId !== 'string' ||
    typeof reference.objectId !== 'string' ||
    typeof reference.sha256 !== 'string' ||
    !uuid.test(reference.scopeId) ||
    !uuid.test(reference.objectId) ||
    !/^[a-f0-9]{64}$/.test(reference.sha256) ||
    !Number.isSafeInteger(reference.size) ||
    reference.size < 1 ||
    reference.size > maxBytes ||
    Object.keys(reference).some(
      (key) => !['scopeId', 'objectId', 'sha256', 'size'].includes(key),
    )
  )
    throw new StorageError('invalid_input');
  return `scopes/${reference.scopeId}/${reference.objectId}/${reference.sha256}`;
}
export function assignObject(
  scopeId: string,
  bytes: Uint8Array,
  maxBytes: number,
): ObjectReference {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 1 ||
    bytes.byteLength > maxBytes
  )
    throw new StorageError('invalid_input');
  const reference = Object.freeze({
    scopeId,
    objectId: randomUUID(),
    sha256: digest(bytes),
    size: bytes.byteLength,
  });
  objectKey(reference, maxBytes);
  return reference;
}
