// Explicit read-only reconciliation of one known upload receipt/snapshot.
// File credentials stay inside this backup-network-only helper. No decrypt/key IO.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { boundedFile, digest, directory } from './archive.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;
function fail() {
  throw new Error('Verification refused');
}
function signature(rows) {
  return JSON.stringify(
    rows
      .map((r) => [r.operationId, r.sha256, r.bytes])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

async function main() {
  const [receiptId, repositoryId, captureOperationId, expectedText] =
    process.argv.slice(2);
  if (
    process.argv.length !== 6 ||
    !uuid.test(receiptId) ||
    !sha.test(repositoryId) ||
    !uuid.test(captureOperationId)
  )
    fail();
  const expected = JSON.parse(expectedText);
  if (
    !Array.isArray(expected) ||
    expected.length !== 2 ||
    new Set(expected.map((e) => e.operationId)).size !== 2
  )
    fail();
  for (const e of expected)
    if (
      !uuid.test(e.operationId) ||
      !sha.test(e.sha256) ||
      !Number.isInteger(e.bytes) ||
      e.bytes < 1 ||
      e.bytes > 402653184
    )
      fail();
  for (const p of ['/input', '/receipts', '/run/client']) directory(p);
  const read = (path, max) => {
    const value = boundedFile(path, max);
    if (
      value.stat.uid !== process.getuid() ||
      value.stat.gid !== process.getgid() ||
      value.stat.nlink !== 1 ||
      !value.bytes.length
    )
      fail();
    return value.bytes;
  };
  const receipt = JSON.parse(read('/receipts/' + receiptId + '.json', 16384));
  if (
    receipt.status !== 'passed' ||
    receipt.command !== 'upload' ||
    receipt.operationId !== receiptId ||
    !sha.test(receipt.snapshotId ?? '') ||
    !Array.isArray(receipt.archives) ||
    signature(receipt.archives) !== signature(expected)
  )
    fail();
  const location = read('/run/client/repository.url', 2048).toString().trim();
  const url = new URL(location.replace(/^rest:/, ''));
  if (
    !location.startsWith('rest:https://') ||
    url.hostname !== 'rest-server' ||
    url.port !== '8000' ||
    url.pathname !== '/uploader/' ||
    url.username !== 'uploader' ||
    !url.password ||
    url.search ||
    url.hash
  )
    fail();
  read('/run/client/repository.password', 4096);
  read('/run/client/ca.crt', 65536);
  const args = [
    '--repository-file',
    '/run/client/repository.url',
    '--password-file',
    '/run/client/repository.password',
    '--cacert',
    '/run/client/ca.crt',
    '--no-cache',
    '--no-lock',
    '--json',
  ];
  const env = { PATH: process.env.PATH, HOME: '/tmp' };
  const command = (extra) =>
    execFileSync('restic', [...args, ...extra], {
      env,
      timeout: 60000,
      maxBuffer: 2097152,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  if (JSON.parse(command(['cat', 'config'])).id !== repositoryId) fail();
  const nodes = command(['ls', receipt.snapshotId])
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const wanted = expected
    .flatMap((e) => [
      '/input/' + e.operationId + '.age',
      '/input/' + e.operationId + '.json',
    ])
    .sort();
  const actual = nodes
    .filter((n) => n.type === 'file')
    .map((n) => n.path)
    .sort();
  if (
    JSON.stringify(actual) !== JSON.stringify(wanted) ||
    nodes.some(
      (n) =>
        n.type &&
        n.type !== 'file' &&
        (n.type !== 'dir' || !['/', '/input'].includes(n.path)),
    )
  )
    fail();
  const retrieveHash = (path, bytes, expectedHash) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'restic',
        [...args, 'dump', receipt.snapshotId, path],
        { env, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const hash = createHash('sha256');
      let count = 0,
        refused = false;
      const timer = setTimeout(() => {
        refused = true;
        child.kill('SIGKILL');
      }, 60000);
      child.stdout.on('data', (chunk) => {
        count += chunk.length;
        if (count > bytes) {
          refused = true;
          child.kill('SIGKILL');
        } else hash.update(chunk);
      });
      child.stdout.on('error', () => {
        refused = true;
        child.kill('SIGKILL');
      });
      child.on('error', () => {
        clearTimeout(timer);
        reject(new Error());
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (
          refused ||
          code !== 0 ||
          count !== bytes ||
          hash.digest('hex') !== expectedHash
        )
          reject(new Error());
        else resolve();
      });
    });
  const verified = [],
    kinds = new Set();
  for (const e of expected) {
    const metadata = read('/input/' + e.operationId + '.json', 4096);
    const info = JSON.parse(metadata);
    if (
      info.operationId !== e.operationId ||
      info.archive !== e.operationId + '.age' ||
      info.captureOperationId !== captureOperationId ||
      info.sha256 !== e.sha256 ||
      info.bytes !== e.bytes ||
      !['recovery-capture', 'recovery-audit'].includes(info.kind)
    )
      fail();
    kinds.add(info.kind);
    await retrieveHash('/input/' + e.operationId + '.age', e.bytes, e.sha256);
    await retrieveHash(
      '/input/' + e.operationId + '.json',
      metadata.length,
      digest(metadata),
    );
    verified.push({
      archiveId: e.operationId,
      sha256: e.sha256,
      bytes: e.bytes,
      receiptSha256: digest(metadata),
    });
  }
  if (kinds.size !== 2) fail();
  console.log(
    JSON.stringify({
      status: 'uploaded_ciphertext_retrieval_verified',
      captureOperationId,
      repositoryId,
      uploadReceiptId: receiptId,
      snapshotId: receipt.snapshotId,
      verified,
      exactSnapshotFileCount: wanted.length,
      repositoryWrites: 0,
      providerAccessed: false,
      decryptionPerformed: false,
      plaintextPrinted: false,
    }),
  );
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: 'uploaded_ciphertext_verification_unconfirmed',
      automaticUploadRetry: false,
    }),
  );
  process.exitCode = 1;
});
