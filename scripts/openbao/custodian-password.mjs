import { protectedFile } from './protected-client.mjs';

// The approved handoff is one password, optionally terminated by one LF/CRLF.
// Parse that file framing only; never trim whitespace or rewrite credential bytes.
export function parseCustodianPassword(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 130)
    throw new Error('Invalid protected input');
  let end = bytes.length;
  if (bytes[end - 1] === 10) {
    end--;
    if (bytes[end - 1] === 13) end--;
  }
  const value = bytes.subarray(0, end);
  if (
    value.length < 43 ||
    value.length > 128 ||
    !value.every(
      (b) =>
        (b >= 65 && b <= 90) ||
        (b >= 97 && b <= 122) ||
        (b >= 48 && b <= 57) ||
        b === 95 ||
        b === 45,
    )
  )
    throw new Error('Invalid protected input');
  return value.toString('ascii');
}

export function readCustodianPassword() {
  return parseCustodianPassword(protectedFile('/human/password', 130));
}
