import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { encryptSet, digest } from '../backup/archive.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';
import { requestFromEvidence } from './request.mjs';
import {
  archiveEntries,
  verifyArchive,
  verifyBundle,
  regularFile,
} from './verify.mjs';

const operation = '11111111-1111-4111-8111-111111111111';
process.umask(0o077);
const capture = '22222222-2222-4222-8222-222222222222';
function tar(rows) {
  const blocks = [];
  for (const [name, bytes, type = '0'] of rows) {
    const data = Buffer.from(bytes);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write('0000600\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    header.fill(32, 148, 156);
    header[156] = type.charCodeAt(0);
    header.write(
      header
        .reduce((n, b) => n + b, 0)
        .toString(8)
        .padStart(6, '0') + '\0 ',
      148,
    );
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}
const bundleTar = (files, manifest) =>
  gzipSync(
    tar([
      ...Object.entries(files),
      ['manifest.json', JSON.stringify(manifest)],
    ]),
  );
function snapshot() {
  const files = {
    'meta.json': Buffer.from('{"Index":3,"Term":2}'),
    'state.bin': Buffer.from('sensitive-state-sentinel'),
  };
  return gzipSync(
    tar([
      ...Object.entries(files),
      [
        'SHA256SUMS',
        Object.entries(files)
          .map(([n, b]) => digest(b) + '  ' + n)
          .join('\n') + '\n',
      ],
      ['SHA256SUMS.sealed', 'synthetic-seal'],
    ]),
  );
}
function fixture() {
  const root = mkdtempSync(tmpdir() + '/archive-verifier-');
  for (const p of ['snapshot', 'audit', 'bundle'])
    mkdirSync(root + '/' + p, { mode: 0o700 });
  const key = root + '/identity';
  execFileSync('age-keygen', ['-o', key], { stdio: 'pipe' });
  writeFileSync(root + '/recipient', execFileSync('age-keygen', ['-y', key]), {
    mode: 0o600,
  });
  const snap = snapshot();
  const info = {
    operationId: capture,
    ...verifyRecoverySnapshot(snap),
    tokenCleanupConfirmed: true,
    capturedAt: new Date().toISOString(),
  };
  const id1 = encryptSet(
    root + '/snapshot',
    root + '/recipient',
    {
      'snapshot.snap': snap,
      'snapshot-receipt.json': Buffer.from(JSON.stringify(info)),
    },
    {
      kind: 'bootstrap-post-install',
      captureOperationId: operation,
      jointPostgresRecoveryEstablished: false,
    },
  );
  const audit = Buffer.from(
    '{"type":"request","sentinel":"sensitive-audit-sentinel"}\n',
  );
  const id2 = encryptSet(
    root + '/audit',
    root + '/recipient',
    { 'audit.jsonl': audit },
    {
      kind: 'recovery-audit',
      captureOperationId: operation,
      auditSha256: digest(audit),
      fullAuditCopy: true,
      rotationContinuityVerified: false,
    },
  );
  const verified = [];
  for (const [dir, id] of [
    ['snapshot', id1],
    ['audit', id2],
  ]) {
    const metadata = readFileSync(root + '/' + dir + '/' + id + '.json'),
      receipt = JSON.parse(metadata);
    for (const ext of ['.age', '.json'])
      writeFileSync(
        root + '/bundle/' + id + ext,
        readFileSync(root + '/' + dir + '/' + id + ext),
        { mode: 0o600 },
      );
    verified.push({
      archiveId: id,
      sha256: receipt.sha256,
      bytes: receipt.bytes,
      receiptSha256: digest(metadata),
    });
  }
  const evidence = {
    status: 'installed-and-both-backups-retrieved',
    operationId: operation,
    rootRevocationVerified: true,
    normalRestorationVerified: true,
    deadlineCancelled: true,
    events: [{ phase: 'bootstrap_complete', at: new Date().toISOString() }],
    postinstallBackup: {
      status: 'uploaded_ciphertext_retrieval_verified',
      stage: 'postinstall',
      captureOperationId: operation,
      repositoryId: 'a'.repeat(64),
      snapshotId: 'b'.repeat(64),
      exactSnapshotFileCount: 4,
      repositoryWrites: 0,
      decryptionPerformed: false,
      verified,
    },
  };
  const request = requestFromEvidence(Buffer.from(JSON.stringify(evidence)));
  const bytes = Buffer.from(JSON.stringify(request));
  const requestPath = root + '/bundle/verification-request.json';
  writeFileSync(requestPath, bytes, { mode: 0o600 });
  return {
    root,
    key,
    request,
    options: {
      requestPath,
      expectedRequestSha256: digest(bytes),
      bundle: root + '/bundle',
      identity: key,
    },
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('real age decryption verifies both archives in memory without extraction or secret output', () => {
  const f = fixture();
  try {
    const before = readdirSync(f.options.bundle);
    const result = verifyBundle(f.options);
    assert.equal(result.status, 'independent-archive-integrity-verified');
    assert.equal(result.archives.length, 2);
    assert.equal(result.archives[0].index, 3);
    assert.equal(
      result.archives[0].sealedChecksumCryptographicallyVerified,
      false,
    );
    assert.equal(result.archives[1].records, 1);
    assert.equal(result.plaintextWritten, false);
    assert.equal(result.nativeRestorePerformed, false);
    assert.deepEqual(readdirSync(f.options.bundle), before);
    assert.equal(JSON.stringify(result).includes('sensitive-'), false);
  } finally {
    f.close();
  }
});
test('wrong public request digest refuses before decryption', () => {
  const f = fixture();
  try {
    assert.throws(() =>
      verifyBundle({
        ...f.options,
        expectedRequestSha256: 'f'.repeat(64),
        decrypt: () => assert.fail('key used'),
      }),
    );
  } finally {
    f.close();
  }
});
test('modified ciphertext and receipt refuse before decrypt', () => {
  for (const ext of ['.age', '.json']) {
    const f = fixture();
    try {
      writeFileSync(
        f.options.bundle + '/' + f.request.archives[0].archiveId + ext,
        'changed',
      );
      assert.throws(() =>
        verifyBundle({ ...f.options, decrypt: () => assert.fail('key used') }),
      );
    } finally {
      f.close();
    }
  }
});
test('wrong owner key fails real age decryption', () => {
  const f = fixture();
  try {
    const other = f.root + '/other-key';
    execFileSync('age-keygen', ['-o', other], { stdio: 'pipe' });
    assert.throws(() => verifyBundle({ ...f.options, identity: other }));
  } finally {
    f.close();
  }
});
test('extra bundle member and symlink input refuse', () => {
  const f = fixture();
  try {
    writeFileSync(f.options.bundle + '/unexpected', 'x');
    assert.throws(() => verifyBundle(f.options));
    symlinkSync(f.key, f.root + '/key-link');
    assert.throws(() => regularFile(f.root + '/key-link', 16384));
  } finally {
    f.close();
  }
});
test('strict tar parser rejects traversal, links, duplicates, excess members, truncation and bad checksums', () => {
  for (const rows of [
    [['../manifest.json', 'x']],
    [['manifest.json', 'x', '2']],
    [
      ['manifest.json', 'x'],
      ['manifest.json', 'y'],
    ],
    [
      ['manifest.json', 'x'],
      ['extra', 'y'],
    ],
  ])
    assert.throws(() => archiveEntries(gzipSync(tar(rows)), ['manifest.json']));
  const good = tar([['manifest.json', 'x']]);
  assert.throws(() =>
    archiveEntries(gzipSync(good.subarray(0, 1024)), ['manifest.json']),
  );
  const bad = Buffer.from(good);
  bad[0] ^= 1;
  assert.throws(() => archiveEntries(gzipSync(bad), ['manifest.json']));
  assert.throws(() =>
    archiveEntries(gzipSync(Buffer.concat([good, Buffer.from('nonzero')])), [
      'manifest.json',
    ]),
  );
});
test('inner manifest hash, snapshot cleanup and audit schema failures reject', () => {
  const f = fixture();
  try {
    for (const [i, changes] of [
      [0, 'hash'],
      [0, 'cleanup'],
      [1, 'audit'],
    ]) {
      const a = f.request.archives[i];
      const receipt = JSON.parse(
        readFileSync(f.options.bundle + '/' + a.archiveId + '.json'),
      );
      let files;
      if (i === 0) {
        const snap = snapshot();
        files = {
          'snapshot.snap': snap,
          'snapshot-receipt.json': Buffer.from(
            JSON.stringify({
              operationId: capture,
              ...verifyRecoverySnapshot(snap),
              tokenCleanupConfirmed: changes !== 'cleanup',
              capturedAt: '2000-01-01T00:00:00Z',
            }),
          ),
        };
      } else files = { 'audit.jsonl': Buffer.from('[]\n') };
      const manifest = {
        format: 1,
        operationId: a.archiveId,
        kind: a.kind,
        captureOperationId: operation,
        jointPostgresRecoveryEstablished: false,
        fullAuditCopy: true,
        rotationContinuityVerified: false,
        auditSha256: digest(files['audit.jsonl'] ?? Buffer.alloc(0)),
        files: Object.fromEntries(
          Object.entries(files).map(([n, b]) => [
            n,
            {
              bytes: b.length,
              sha256: changes === 'hash' ? '0'.repeat(64) : digest(b),
            },
          ]),
        ),
      };
      assert.throws(() =>
        verifyArchive(bundleTar(files, manifest), receipt, a, f.request),
      );
    }
  } finally {
    f.close();
  }
});
test('failed or mismatched execution evidence cannot generate a verification request', () => {
  assert.throws(() => requestFromEvidence(Buffer.from('{}')));
  assert.throws(() => requestFromEvidence(Buffer.from('{"status":"failed"}')));
});
