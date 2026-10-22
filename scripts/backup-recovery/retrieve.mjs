// Exact snapshot export. Repository client is read-only, keys absent, no decrypt.
import { execFileSync, spawn } from 'node:child_process';
import {
  constants,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import {
  boundedFile,
  directory,
  durable,
  syncDirectory,
} from '../backup/archive.mjs';
import { validateRequest, digest, sha } from './request.mjs';

function check(value) {
  if (!value) throw new Error('Retrieval unconfirmed');
}
async function main() {
  process.umask(0o077);
  const [expectedHash] = process.argv.slice(2);
  check(process.argv.length === 3 && sha.test(expectedHash));
  const requestBytes = boundedFile('/request.json', 16384, false).bytes;
  check(digest(requestBytes) === expectedHash);
  const request = validateRequest(JSON.parse(requestBytes));
  for (const path of ['/run/client', '/output']) directory(path);
  check(readdirSync('/output').length === 0);
  const location = boundedFile('/run/client/repository.url', 2048)
    .bytes.toString()
    .trim();
  const url = new URL(location.replace(/^rest:/, ''));
  check(
    location.startsWith('rest:https://') &&
      url.hostname === 'rest-server' &&
      url.port === '8000' &&
      url.pathname === '/uploader/' &&
      url.username === 'uploader' &&
      url.password &&
      !url.search &&
      !url.hash,
  );
  boundedFile('/run/client/repository.password', 4096);
  boundedFile('/run/client/ca.crt', 65536);
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
  check(JSON.parse(command(['cat', 'config'])).id === request.repositoryId);
  const nodes = command(['ls', request.snapshotId])
    .toString()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const wanted = request.archives
    .flatMap((a) => [
      '/input/' + a.archiveId + '.age',
      '/input/' + a.archiveId + '.json',
    ])
    .sort();
  check(
    nodes
      .filter((n) => n.type === 'file')
      .map((n) => n.path)
      .sort()
      .join(',') === wanted.join(',') &&
      !nodes.some(
        (n) =>
          n.type &&
          n.type !== 'file' &&
          (n.type !== 'dir' || !['/', '/input'].includes(n.path)),
      ),
  );
  const retrieve = (name, maximum, expectedSha, exactBytes) =>
    new Promise((resolve, reject) => {
      const fd = openSync(
        '/output/' + name,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      const child = spawn(
        'restic',
        [...args, 'dump', request.snapshotId, '/input/' + name],
        { env, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const hash = createHash('sha256');
      let count = 0,
        failed = false;
      const timer = setTimeout(() => {
        failed = true;
        child.kill('SIGKILL');
      }, 60000);
      const fail = () => {
        failed = true;
        child.kill('SIGKILL');
      };
      child.stdout.on('data', (chunk) => {
        try {
          count += chunk.length;
          if (count > maximum) {
            fail();
            return;
          }
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            const wrote = writeSync(fd, chunk, offset, chunk.length - offset);
            check(wrote > 0);
            offset += wrote;
          }
        } catch {
          fail();
        }
      });
      child.stdout.on('error', fail);
      child.on('error', fail);
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          check(
            !failed &&
              code === 0 &&
              count > 0 &&
              (exactBytes === undefined || count === exactBytes) &&
              hash.digest('hex') === expectedSha,
          );
          fsyncSync(fd);
          resolve();
        } catch {
          reject(new Error('Retrieval unconfirmed'));
        } finally {
          closeSync(fd);
        }
      });
    });
  for (const a of request.archives) {
    await retrieve(a.archiveId + '.age', a.bytes, a.sha256, a.bytes);
    await retrieve(a.archiveId + '.json', 4096, a.receiptSha256);
    const receipt = JSON.parse(
      boundedFile('/output/' + a.archiveId + '.json', 4096).bytes,
    );
    check(
      receipt.operationId === a.archiveId &&
        receipt.archive === a.archiveId + '.age' &&
        receipt.kind === a.kind &&
        receipt.captureOperationId === request.captureOperationId &&
        receipt.sha256 === a.sha256 &&
        receipt.bytes === a.bytes,
    );
  }
  durable('/output/verification-request.json', requestBytes);
  syncDirectory('/output');
  console.log(
    JSON.stringify({
      status: 'verification-bundle-retrieved',
      repositoryId: request.repositoryId,
      snapshotId: request.snapshotId,
      requestSha256: expectedHash,
      files: 5,
      repositoryWrites: 0,
      providerAccessed: false,
      decryptionPerformed: false,
      plaintextWritten: false,
    }),
  );
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: 'verification-bundle-retrieval-unconfirmed',
      repositoryWrites: 0,
      plaintextWritten: false,
      automaticRetry: false,
    }),
  );
  process.exitCode = 1;
});
