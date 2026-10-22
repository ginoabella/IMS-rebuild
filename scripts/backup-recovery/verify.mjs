// Owner-run, offline verification. age writes plaintext only to this process's
// memory; archive paths are never extracted and there are no network imports.
import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  readdirSync,
  lstatSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';
import { digest, sha, uuid, validateRequest } from './request.mjs';

function check(value) {
  if (!value) throw new Error('Archive verification refused');
}
export function regularFile(path, maximum) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = fstatSync(fd);
    check(
      before.isFile() &&
        before.nlink === 1 &&
        before.size > 0 &&
        before.size <= maximum,
    );
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    check(
      bytes.length === before.size &&
        before.size === after.size &&
        before.mtimeMs === after.mtimeMs &&
        before.ctimeMs === after.ctimeMs,
    );
    return bytes;
  } finally {
    closeSync(fd);
  }
}

/** Strict flat regular-file tar reader. No extraction, links, PAX, duplicate or
 * traversal entries, size suffixes, nonzero padding or missing end blocks. */
export function archiveEntries(compressed, allowed) {
  const tar = gunzipSync(compressed, { maxOutputLength: 268500992 });
  try {
    const entries = new Map();
    let offset = 0;
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every((b) => b === 0)) {
        check(
          tar.length - offset >= 1024 &&
            tar.subarray(offset).every((b) => b === 0) &&
            entries.size === allowed.length,
        );
        return entries;
      }
      const field = (from, size) =>
        header
          .subarray(from, from + size)
          .toString('utf8')
          .split('\0')[0];
      const name = field(0, 100),
        sizeText = field(124, 12).trim(),
        sumText = field(148, 8).trim();
      check(
        allowed.includes(name) &&
          !entries.has(name) &&
          !field(345, 155) &&
          !field(157, 100) &&
          [0, 48].includes(header[156]) &&
          /^[0-7]+$/.test(sizeText) &&
          /^[0-7]+$/.test(sumText),
      );
      const size = Number.parseInt(sizeText, 8),
        sum = Number.parseInt(sumText, 8);
      check(
        Number.isSafeInteger(size) &&
          size > 0 &&
          size <= 134217728 &&
          sum ===
            header.reduce((n, b, i) => n + (i >= 148 && i < 156 ? 32 : b), 0),
      );
      const next = offset + 512 + Math.ceil(size / 512) * 512;
      check(
        next <= tar.length &&
          tar.subarray(offset + 512 + size, next).every((b) => b === 0),
      );
      entries.set(
        name,
        Buffer.from(tar.subarray(offset + 512, offset + 512 + size)),
      );
      offset = next;
    }
    throw new Error('Archive incomplete');
  } finally {
    tar.fill(0);
  }
}

const json = (bytes) => {
  check(Buffer.from(bytes.toString('utf8')).equals(bytes));
  const value = JSON.parse(bytes.toString('utf8'));
  check(value && typeof value === 'object' && !Array.isArray(value));
  return value;
};

export function verifyArchive(compressed, receipt, expected, request) {
  const names =
    expected.kind === 'bootstrap-post-install'
      ? ['manifest.json', 'snapshot.snap', 'snapshot-receipt.json']
      : ['manifest.json', 'audit.jsonl'];
  const entries = archiveEntries(compressed, names);
  try {
    const manifest = json(entries.get('manifest.json'));
    const files = names.filter((n) => n !== 'manifest.json');
    check(
      manifest.format === 1 &&
        manifest.operationId === expected.archiveId &&
        manifest.kind === expected.kind &&
        manifest.captureOperationId === request.captureOperationId &&
        manifest.files &&
        Object.keys(manifest.files).sort().join(',') === files.sort().join(','),
    );
    for (const name of files) {
      const bytes = entries.get(name),
        entry = manifest.files[name];
      check(
        entry?.bytes === bytes.length &&
          sha.test(entry.sha256) &&
          entry.sha256 === digest(bytes),
      );
    }
    if (expected.kind === 'bootstrap-post-install') {
      check(manifest.jointPostgresRecoveryEstablished === false);
      const info = json(entries.get('snapshot-receipt.json'));
      const integrity = verifyRecoverySnapshot(entries.get('snapshot.snap'));
      check(
        uuid.test(info.operationId) &&
          info.tokenCleanupConfirmed === true &&
          Number.isFinite(Date.parse(info.capturedAt)) &&
          Date.parse(info.capturedAt) <= Date.parse(receipt.capturedAt) &&
          Object.entries(integrity).every(([k, v]) => info[k] === v),
      );
      return {
        kind: expected.kind,
        archiveId: expected.archiveId,
        nativeSnapshotIntegrityVerified: true,
        snapshotSha256: integrity.snapshotSha256,
        index: integrity.index,
        term: integrity.term,
        sealedChecksumCryptographicallyVerified: false,
      };
    }
    const audit = entries.get('audit.jsonl');
    check(
      manifest.fullAuditCopy === true &&
        manifest.rotationContinuityVerified === false &&
        manifest.auditSha256 === digest(audit) &&
        audit.at(-1) === 10 &&
        Buffer.from(audit.toString('utf8')).equals(audit),
    );
    let records = 0;
    for (const line of audit.toString('utf8').split('\n')) {
      if (line.length) {
        json(Buffer.from(line));
        records++;
      }
    }
    check(records > 0);
    return {
      kind: expected.kind,
      archiveId: expected.archiveId,
      auditJsonIntegrityVerified: true,
      records,
      auditContinuityEstablished: false,
    };
  } finally {
    for (const bytes of entries.values()) bytes.fill(0);
  }
}

export function verifyBundle({
  requestPath,
  expectedRequestSha256,
  bundle,
  identity,
  decrypt,
}) {
  check(sha.test(expectedRequestSha256));
  const requestBytes = regularFile(requestPath, 16384);
  check(digest(requestBytes) === expectedRequestSha256);
  const request = validateRequest(json(requestBytes));
  const expectedNames = [
    'verification-request.json',
    ...request.archives.flatMap((a) => [
      a.archiveId + '.age',
      a.archiveId + '.json',
    ]),
  ].sort();
  const directory = lstatSync(bundle);
  check(
    directory.isDirectory() &&
      !directory.isSymbolicLink() &&
      readdirSync(bundle).sort().join(',') === expectedNames.join(','),
  );
  check(
    regularFile(join(bundle, 'verification-request.json'), 16384).equals(
      requestBytes,
    ),
  );
  const verified = [];
  for (const expected of request.archives) {
    const ciphertextPath = join(bundle, expected.archiveId + '.age');
    const cipher = regularFile(ciphertextPath, 402653184);
    check(
      cipher.length === expected.bytes &&
        digest(cipher) === expected.sha256 &&
        cipher.subarray(0, 22).toString().startsWith('age-encryption.org/v1'),
    );
    const metadata = regularFile(
      join(bundle, expected.archiveId + '.json'),
      4096,
    );
    check(digest(metadata) === expected.receiptSha256);
    const receipt = json(metadata);
    check(
      receipt.format === 1 &&
        receipt.operationId === expected.archiveId &&
        receipt.archive === expected.archiveId + '.age' &&
        receipt.sha256 === expected.sha256 &&
        receipt.bytes === expected.bytes &&
        receipt.kind === expected.kind &&
        receipt.captureOperationId === request.captureOperationId &&
        Number.isFinite(Date.parse(receipt.capturedAt)) &&
        Date.parse(receipt.capturedAt) <= Date.parse(request.sourceCompletedAt),
    );
    // Decrypt these exact verified bytes, not a path that could be replaced.
    const encrypted = cipher;
    let plain;
    try {
      plain = decrypt
        ? decrypt(encrypted)
        : execFileSync('age', ['--decrypt', '--identity', resolve(identity)], {
            input: encrypted,
            timeout: 60000,
            maxBuffer: 402653184,
            stdio: ['pipe', 'pipe', 'ignore'],
          });
      check(
        Buffer.isBuffer(plain) && plain.length > 0 && plain.length <= 402653184,
      );
      verified.push(verifyArchive(plain, receipt, expected, request));
    } finally {
      encrypted.fill(0);
      if (plain) plain.fill(0);
    }
  }
  return {
    status: 'independent-archive-integrity-verified',
    captureOperationId: request.captureOperationId,
    repositoryId: request.repositoryId,
    snapshotId: request.snapshotId,
    requestSha256: expectedRequestSha256,
    archives: verified,
    verifiedAt: new Date().toISOString(),
    plaintextWritten: false,
    secretsPrinted: false,
    providerAccessed: false,
    repositoryAccessed: false,
    nativeRestorePerformed: false,
    jointPostgresRecoveryEstablished: false,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: {
        request: { type: 'string' },
        'request-sha256': { type: 'string' },
        bundle: { type: 'string' },
        identity: { type: 'string' },
      },
    });
    check(
      Object.keys(values).length === 4 &&
        Object.values(values).every((v) => typeof v === 'string' && v.length),
    );
    const identity = lstatSync(resolve(values.identity));
    check(
      identity.isFile() &&
        !identity.isSymbolicLink() &&
        identity.nlink === 1 &&
        identity.size > 0 &&
        identity.size <= 16384,
    );
    if (process.platform !== 'win32')
      check(identity.uid === process.getuid() && !(identity.mode & 0o077));
    console.log(
      JSON.stringify(
        verifyBundle({
          requestPath: resolve(values.request),
          expectedRequestSha256: values['request-sha256'],
          bundle: resolve(values.bundle),
          identity: values.identity,
        }),
      ),
    );
  } catch {
    console.error(
      JSON.stringify({
        status: 'independent-archive-verification-unconfirmed',
        plaintextWritten: false,
        secretsPrinted: false,
        automaticRetry: false,
      }),
    );
    process.exitCode = 1;
  }
}
