// Inactive bounded archive and audit helpers. No OpenBao credentials or provider I/O.
import {
  constants,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';

export const LIMIT = 134217728;
const SPOOL_LIMIT = 1073741824; // Candidate 1 GiB cap; changes need measured review.
export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
function fail() {
  throw new Error('Backup boundary validation failed');
}
export function directory(path) {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || s.mode & 0o077) fail();
}
export function boundedFile(path, limit = LIMIT, privateMode = true) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (
      !before.isFile() ||
      before.size > limit ||
      (privateMode && before.mode & 0o077)
    )
      fail();
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (
      bytes.length !== before.size ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      fail();
    return { bytes, stat: after };
  } finally {
    closeSync(fd);
  }
}
export function durable(path, bytes) {
  const fd = openSync(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function syncDirectory(path) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function jsonLines(bytes) {
  if (!Buffer.from(bytes.toString('utf8')).equals(bytes)) fail();
  for (const line of bytes.toString('utf8').split('\n').filter(Boolean)) {
    const value = JSON.parse(line);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  }
}
export function encryptSet(output, recipientFile, files, details = {}) {
  directory(output);
  const lock = join(output, '.spool.lock');
  mkdirSync(lock, { mode: 0o700 });
  try {
    return encryptLocked(output, recipientFile, files, details);
  } finally {
    rmSync(lock, { recursive: true });
  }
}
function encryptLocked(output, recipientFile, files, details) {
  const recipient = boundedFile(recipientFile, 1024, false)
    .bytes.toString('utf8')
    .trim();
  if (!/^age1[0-9a-z]{58}$/.test(recipient)) fail();
  let used = 0;
  for (const name of readdirSync(output).filter((n) => n !== '.spool.lock')) {
    const s = lstatSync(join(output, name));
    if (!s.isFile() || s.isSymbolicLink()) fail();
    used += s.size;
  }
  if (
    used >= SPOOL_LIMIT ||
    Object.values(files).reduce((n, b) => n + b.length, 0) > LIMIT * 2
  )
    fail();
  const id = randomUUID();
  const work = mkdtempSync(join(tmpdir(), 'myims-archive-'));
  const partial = join(output, id + '.partial');
  let committed = false;
  try {
    const manifest = {};
    for (const [name, bytes] of Object.entries(files)) {
      if (!/^[a-z][a-z0-9.-]{0,63}$/.test(name)) fail();
      durable(join(work, name), bytes);
      manifest[name] = { bytes: bytes.length, sha256: digest(bytes) };
    }
    durable(
      join(work, 'manifest.json'),
      JSON.stringify({
        format: 1,
        operationId: id,
        files: manifest,
        ...details,
      }),
    );
    execFileSync(
      'tar',
      [
        '-czf',
        join(work, 'bundle.tar.gz'),
        '-C',
        work,
        ...Object.keys(files),
        'manifest.json',
      ],
      { timeout: 30000, stdio: 'pipe' },
    );
    execFileSync(
      'age',
      ['-r', recipient, '-o', partial, join(work, 'bundle.tar.gz')],
      { timeout: 30000, stdio: 'pipe' },
    );
    const ciphertext = boundedFile(partial, LIMIT * 3).bytes;
    if (
      used + ciphertext.length > SPOOL_LIMIT ||
      !ciphertext.subarray(0, 22).toString().startsWith('age-encryption.org/v1')
    )
      fail();
    // fsync output before rename, then fsync containing directory before receipt.
    const fd = openSync(partial, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(partial, join(output, id + '.age'));
    syncDirectory(output);
    durable(
      join(output, id + '.json'),
      JSON.stringify({
        format: 1,
        operationId: id,
        archive: id + '.age',
        bytes: ciphertext.length,
        sha256: digest(ciphertext),
        capturedAt: new Date().toISOString(),
        kind: details.kind ?? 'snapshot',
        ...([
          'recovery-capture',
          'recovery-audit',
          'bootstrap-post-install',
        ].includes(details.kind)
          ? { captureOperationId: details.captureOperationId }
          : {}),
      }),
    );
    syncDirectory(output);
    committed = true;
    return id;
  } finally {
    // Cleartext exists only in helper tmpfs, never spool/application volumes.
    rmSync(work, { recursive: true, force: true });
    if (!committed) rmSync(partial, { force: true });
  }
}
export function archive(input, output, recipient) {
  directory(input);
  if (
    readdirSync(input).sort().join(',') !==
    'audit.jsonl,recovery.json,snapshot.snap'
  )
    fail();
  const files = {};
  for (const name of readdirSync(input))
    files[name] = boundedFile(join(input, name)).bytes;
  verifyRecoverySnapshot(files['snapshot.snap']);
  if (!files['audit.jsonl'].length || files['audit.jsonl'].at(-1) !== 10)
    fail();
  jsonLines(files['audit.jsonl']);
  const recovery = JSON.parse(files['recovery.json']);
  // Non-secret coordination references, not a claim that PostgreSQL recovery passed.
  if (
    Object.keys(recovery).sort().join(',') !==
      'configurationRevision,postgresRecoveryReference' ||
    !Object.values(recovery).every(
      (v) =>
        typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(v),
    )
  )
    fail();
  return encryptSet(output, recipient, files, { kind: 'snapshot' });
}
export function collectAudit(source, state, output, recipient) {
  directory(state);
  const lock = join(state, 'collect.lock');
  mkdirSync(lock, { mode: 0o700 }); // A crashed/uncertain holder requires reviewed reconciliation.
  try {
    const list = JSON.parse(
      boundedFile(join(source, 'segments.json'), 16384, false).bytes,
    );
    if (
      !Array.isArray(list) ||
      !list.length ||
      list.length > 100 ||
      new Set(list).size !== list.length ||
      !list.every(
        (n) =>
          typeof n === 'string' &&
          /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(n) &&
          n !== 'segments.json',
      )
    )
      fail();
    const cursorPath = join(state, 'cursor.json');
    let previous;
    if (readdirSync(state).includes('cursor.json'))
      previous = JSON.parse(boundedFile(cursorPath, 65536).bytes);
    const chunks = [],
      segments = [];
    let started = !previous,
      next;
    for (const name of list) {
      const { bytes, stat } = boundedFile(join(source, name), LIMIT, false);
      let start = 0;
      if (!started) {
        if (previous.device !== stat.dev || previous.inode !== stat.ino)
          continue;
        if (
          !Number.isSafeInteger(previous.offset) ||
          previous.offset < 0 ||
          previous.offset > bytes.length ||
          digest(bytes.subarray(0, previous.offset)) !== previous.prefixSha256
        )
          fail();
        start = previous.offset;
        started = true;
      }
      const end = bytes.lastIndexOf(10) + 1;
      if (end < start || (name !== list.at(-1) && end !== bytes.length)) fail();
      const chunk = bytes.subarray(start, end);
      jsonLines(chunk);
      if (chunk.length) {
        chunks.push(chunk);
        segments.push({
          name,
          device: stat.dev,
          inode: stat.ino,
          start,
          end,
          sha256: digest(chunk),
        });
      }
      next = {
        device: stat.dev,
        inode: stat.ino,
        offset: end,
        prefixSha256: digest(bytes.subarray(0, end)),
      };
    }
    if (!started || !next) fail(); // Never silently accept a missing rotated inode.
    if (!chunks.length) return null;
    const previousCheckpointSha256 = previous
      ? digest(Buffer.from(JSON.stringify(previous)))
      : null;
    const id = encryptSet(
      output,
      recipient,
      { 'audit.jsonl': Buffer.concat(chunks) },
      { kind: 'audit', segments, previousCheckpointSha256 },
    );
    // Cursor can advance only after durable ciphertext+receipt. Spool is never deleted here.
    const temporary = join(state, 'cursor-' + id + '.tmp');
    durable(temporary, JSON.stringify({ ...next, operationId: id }));
    renameSync(temporary, cursorPath);
    syncDirectory(state);
    return id;
  } finally {
    rmSync(lock, { recursive: true });
  }
}
