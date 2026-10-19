// Offline integrity validation only; never restores a snapshot or contacts OpenBao.
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function verifyRecoverySnapshot(compressed) {
  const tar = gunzipSync(compressed, { maxOutputLength: 268435456 });
  const entries = new Map();
  let end = 0;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) {
      end = offset;
      break;
    }
    const str = (from, size) =>
      header
        .subarray(from, from + size)
        .toString('utf8')
        .split('\0')[0];
    const name = str(0, 100);
    const size = Number.parseInt(str(124, 12).trim(), 8);
    const checksum = Number.parseInt(str(148, 8).trim(), 8);
    const actual = header.reduce(
      (sum, b, index) => sum + (index >= 148 && index < 156 ? 32 : b),
      0,
    );
    if (
      !['meta.json', 'state.bin', 'SHA256SUMS', 'SHA256SUMS.sealed'].includes(
        name,
      ) ||
      entries.has(name) ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      checksum !== actual ||
      ![0, 48].includes(header[156]) ||
      str(345, 155) ||
      offset + 512 + size > tar.length
    )
      throw new Error('Snapshot archive integrity failed');
    entries.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!end || entries.size !== 4 || tar.subarray(end).some((b) => b !== 0))
    throw new Error('Snapshot archive incomplete');
  const sums = entries.get('SHA256SUMS').toString('utf8').trim().split('\n');
  const checked = new Set();
  for (const line of sums) {
    const match = /^([a-f0-9]{64})\s+\*?(meta\.json|state\.bin)$/.exec(line);
    if (
      !match ||
      checked.has(match[2]) ||
      createHash('sha256').update(entries.get(match[2])).digest('hex') !==
        match[1]
    )
      throw new Error('Snapshot checksum failed');
    checked.add(match[2]);
  }
  const meta = JSON.parse(entries.get('meta.json').toString('utf8'));
  if (
    checked.size !== 2 ||
    !Number.isSafeInteger(meta.Index) ||
    meta.Index < 1 ||
    !Number.isSafeInteger(meta.Term) ||
    meta.Term < 1
  )
    throw new Error('Snapshot metadata invalid');
  return {
    snapshotSha256: createHash('sha256').update(compressed).digest('hex'),
    index: meta.Index,
    term: meta.Term,
    sealedChecksumPresent: true,
    restorationNotPerformed: true,
  };
}
