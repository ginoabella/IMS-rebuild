// Attended, operation-bound development initialization. No OpenBao access.
import { request } from 'node:https';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedFile, directory, durable, syncDirectory } from './archive.mjs';

export async function initializeRepository(operationId, ports) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId))
    throw new Error();
  // Any previous intent, including an uncertain result, prohibits another init.
  if (ports.prior()) throw new Error();
  if (
    (await ports.get('/uploader/config', true)) !== 404 ||
    (await ports.get('/uploader/config', false)) !== 401 ||
    (await ports.get('/other/config', true)) !== 401
  )
    throw new Error();
  ports.save('started', { operationId, startedAt: new Date().toISOString() });
  ports.restic(['init', '--repository-version', '2']);
  if ((await ports.get('/uploader/config', true)) !== 200) throw new Error();
  const config = JSON.parse(ports.restic(['cat', 'config']).toString());
  if (config.version !== 2 || !/^[a-f0-9]{64}$/.test(config.id ?? ''))
    throw new Error();
  if (
    JSON.stringify(JSON.parse(ports.restic(['snapshots']).toString())) !== '[]'
  )
    throw new Error();
  const receipt = {
    status: 'repository_initialized',
    operationId,
    repositoryId: config.id,
    version: config.version,
    verifiedEmpty: true,
    completedAt: new Date().toISOString(),
    automaticRetry: false,
  };
  ports.save('complete', receipt);
  return receipt;
}

async function main() {
  process.umask(0o077);
  const [operationId] = process.argv.slice(2);
  if (process.argv.length !== 3) throw new Error();
  const client = '/run/client',
    receipts = '/receipts';
  directory(client);
  directory(receipts);
  const read = (name, limit) => {
    const value = boundedFile(join(client, name), limit);
    if (
      value.stat.uid !== process.getuid() ||
      value.stat.nlink !== 1 ||
      !value.bytes.length
    )
      throw new Error();
    return value.bytes;
  };
  const location = read('repository.url', 2048).toString().trim();
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
    throw new Error();
  read('repository.password', 4096);
  const ca = read('ca.crt', 65536);
  const get = (path, authenticated) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: 'rest-server',
          port: 8000,
          path,
          ca,
          method: 'GET',
          ...(authenticated
            ? { auth: 'uploader:' + decodeURIComponent(url.password) }
            : {}),
        },
        (res) => {
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > 1048576) req.destroy();
          });
          res.on('error', reject);
          res.on('end', () => resolve(res.statusCode));
        },
      );
      const timer = setTimeout(() => req.destroy(new Error()), 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
  const file = (suffix) => join(receipts, `init-${operationId}-${suffix}.json`);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? ''))
    throw new Error();
  const lock = join(receipts, 'repository.lock');
  mkdirSync(lock, { mode: 0o700 });
  let started = false,
    complete = false;
  try {
    const receipt = await initializeRepository(operationId, {
      prior: () => existsSync(file('started')) || existsSync(file('complete')),
      get,
      save: (suffix, value) => {
        if (suffix === 'started') started = true;
        durable(file(suffix), JSON.stringify(value));
        syncDirectory(receipts);
      },
      restic: (args) =>
        execFileSync(
          'restic',
          [
            '--repository-file',
            join(client, 'repository.url'),
            '--password-file',
            join(client, 'repository.password'),
            '--cacert',
            join(client, 'ca.crt'),
            '--no-cache',
            '--json',
            '--retry-lock=0s',
            ...args,
          ],
          {
            env: { PATH: process.env.PATH, HOME: '/tmp' },
            timeout: 60000,
            maxBuffer: 1048576,
            stdio: 'pipe',
          },
        ),
    });
    complete = true;
    console.log(JSON.stringify(receipt));
  } finally {
    // Unknown initialization leaves both intent and shared fence for attended review.
    if (!started || complete) {
      rmdirSync(lock);
      syncDirectory(receipts);
    }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      JSON.stringify({
        status: 'repository_initialization_unconfirmed',
        automaticRetry: false,
      }),
    );
    process.exitCode = 1;
  });
