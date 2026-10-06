import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const prefix = '$scrypt$v=1$N=131072,r=8,p=1$';
const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
let busy = false;
export class PasswordInputError extends Error {
  constructor() {
    super('Invalid protected bootstrap input');
  }
}
export function validatePassword(bytes: Buffer): void {
  if (bytes.length > 512) throw new PasswordInputError();
  let value: string;
  try {
    value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new PasswordInputError();
  }
  const length = [...value].length;
  if (length < 15 || length > 128 || /[\0\r\n\u0085\u2028\u2029]/u.test(value))
    throw new PasswordInputError();
}
function derive(password: Buffer, salt: Buffer): Promise<Buffer> {
  // Reject parallel work instead of retaining an unbounded queue of passwords.
  if (busy) return Promise.reject(new PasswordInputError());
  busy = true;
  return new Promise((resolve, reject) => {
    try {
      scrypt(password, salt, 32, options, (error, key) => {
        busy = false;
        if (error) reject(new PasswordInputError());
        else resolve(key);
      });
    } catch {
      busy = false;
      reject(new PasswordInputError());
    }
  });
}
export function supportedHash(encoded: unknown): encoded is string {
  return (
    typeof encoded === 'string' &&
    encoded.startsWith(prefix) &&
    /^[0-9a-f]{32}\$[0-9a-f]{64}$/.test(encoded.slice(prefix.length))
  );
}
export async function hashPassword(password: Buffer): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  try {
    return `${prefix}${salt.toString('hex')}$${key.toString('hex')}`;
  } finally {
    key.fill(0);
  }
}
export async function verifyPassword(
  password: Buffer,
  encoded: unknown,
): Promise<boolean> {
  try {
    validatePassword(password);
    if (!supportedHash(encoded)) return false;
    const [salt, expected] = encoded.slice(prefix.length).split('$');
    if (!salt || !expected) return false;
    const key = await derive(password, Buffer.from(salt, 'hex'));
    try {
      return timingSafeEqual(key, Buffer.from(expected, 'hex'));
    } finally {
      key.fill(0);
    }
  } catch {
    return false;
  }
}

export type PasswordVerification =
  { kind: 'match' } | { kind: 'mismatch' } | { kind: 'unavailable' };
// Valid supported work even for unknown/ineligible/malformed candidates.
const dummyHash = `${prefix}${'00'.repeat(16)}$${'00'.repeat(32)}`;
export async function verifyPasswordOutcome(
  password: Buffer,
  encoded: unknown,
): Promise<PasswordVerification> {
  try {
    validatePassword(password);
  } catch {
    return { kind: 'mismatch' };
  }
  const supported = supportedHash(encoded);
  const value = supported ? encoded : dummyHash;
  const [salt, expected] = value.slice(prefix.length).split('$');
  if (!salt || !expected) return { kind: 'unavailable' };
  try {
    const key = await derive(password, Buffer.from(salt, 'hex'));
    const expectedKey = Buffer.from(expected, 'hex');
    try {
      return {
        kind:
          timingSafeEqual(key, expectedKey) && supported ? 'match' : 'mismatch',
      };
    } finally {
      key.fill(0);
      expectedKey.fill(0);
    }
  } catch {
    return { kind: 'unavailable' };
  }
}
