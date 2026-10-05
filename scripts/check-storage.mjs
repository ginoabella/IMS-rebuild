import { checkStorageStartup } from './storage-configuration-checks.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(`${root}services/backend/package.json`);
const {
  GarageStorage,
} = require('./dist/infrastructure/storage/garage-storage.js');
const {
  loadStorageConfig,
} = require('./dist/infrastructure/storage/configuration.js');
const { objectKey } = require('./dist/infrastructure/storage/port.js');
const { parseStorageConfig, ConfigurationError } = require('@myims/config');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const env = {
  ...process.env,
  STORAGE_ENABLED: 'true',
  STORAGE_BUCKET: 'myims-storage-fixtures',
  STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_fixture',
  STORAGE_TIMEOUT_MS: '1500',
  STORAGE_ATTEMPTS: '2',
};
const config = loadStorageConfig(env);
const captured = [];
const storage = new GarageStorage(config, (line) => captured.push(line));
const bytes = Buffer.from(`STORAGE_CONTENT_SENTINEL_${randomUUID()}`);
const scope = randomUUID();
const reference = storage.assign(scope, bytes);
const call = () => ({ correlationId: randomUUID() });
const references = [reference];
const directories = [];
const children = new Set();
const clients = new Set([storage]);
const sdk = new S3Client({
  ...config,
  forcePathStyle: true,
  maxAttempts: 1,
  requestChecksumCalculation: 'WHEN_REQUIRED',
});
async function failure(work, code) {
  await assert.rejects(
    work,
    (error) =>
      error.code === code &&
      error.message === `Storage operation failed: ${code}`,
  );
}
async function processOperation(operation) {
  const directory = await mkdtemp(join(tmpdir(), 'myims-storage-'));
  directories.push(directory);
  const child = fork(`${root}scripts/storage-fixture.mjs`, [], {
    cwd: directory,
    env,
    silent: true,
  });
  children.add(child);
  child.stdout.on('data', (data) => captured.push(data.toString()));
  child.stderr.on('data', (data) => captured.push(data.toString()));
  const exited = once(child, 'exit');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  try {
    const received = once(child, 'message');
    child.send({
      operation,
      reference,
      ...(operation === 'write' ? { bytes: bytes.toString('base64') } : {}),
      call: call(),
    });
    const [result] = await Promise.race([
      received,
      exited.then(() => {
        throw new Error('Storage fixture exited before its result');
      }),
    ]);
    const [code] = await exited;
    assert.equal(code, 0);
    assert.deepEqual(await readdir(directory), []);
    assert.deepEqual(result, {
      state: 'complete',
      sha256: reference.sha256,
      size: bytes.length,
    });
  } finally {
    clearTimeout(timer);
    child.kill();
    children.delete(child);
  }
}

// Isolated forwarding barrier: the real Garage accepts requests; only this run's
// network path is interrupted. No shared service outage is required here.
let mode = 'pass';
let requests = 0;
let accepted;
let reached = () => {};
const sockets = new Set();
const upstreamRequests = new Set();
const proxy = createServer((incoming, outgoing) => {
  requests++;
  if (mode === 'outage') {
    outgoing.writeHead(503, { 'Content-Type': 'application/xml' });
    outgoing.end('<Error><Code>ServiceUnavailable</Code></Error>');
    return;
  }
  const upstream = request(
    new URL(incoming.url, config.endpoint),
    { method: incoming.method, headers: incoming.headers },
    (response) => {
      const dropWriteAck = mode === 'write-ack' && incoming.method === 'PUT';
      if (dropWriteAck) {
        response.resume();
        response.on('end', () => {
          assert.equal(response.statusCode, 200);
          reached();
        });
        return;
      }
      if (mode === 'read-stall' && incoming.method === 'GET') {
        outgoing.writeHead(response.statusCode, response.headers);
        outgoing.flushHeaders();
        response.resume();
        response.on('end', () => reached());
        return;
      }
      outgoing.writeHead(response.statusCode, response.headers);
      response.pipe(outgoing);
    },
  );
  upstreamRequests.add(upstream);
  upstream.on('close', () => upstreamRequests.delete(upstream));
  upstream.on('error', () => outgoing.destroy());
  incoming.on('aborted', () => upstream.destroy());
  outgoing.on('close', () => upstream.destroy());
  incoming.pipe(upstream);
});
proxy.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const forwarded = new GarageStorage(
  {
    ...config,
    endpoint: `http://127.0.0.1:${proxy.address().port}`,
    concurrency: 1,
    timeoutMs: 600,
  },
  (line) => captured.push(line),
);
clients.add(forwarded);
function barrier(next) {
  mode = next;
  accepted = new Promise((resolve) => {
    reached = resolve;
  });
  return accepted;
}
try {
  await storage.inspect(call());
  await processOperation('write');
  await processOperation('read');
  await processOperation('write');
  await processOperation('read');
  assert.equal(new Set(directories).size, 4);
  console.log(
    'PASS: independent OS writer/reader processes and restarted writer retrieve identical bytes from isolated application directories',
  );

  const before = requests;
  for (const invalid of [
    { ...reference, scopeId: '../foreign' },
    { ...reference, scopeId: [scope] },
    { ...reference, objectId: 'https://untrusted' },
    { ...reference, key: '../escape' },
    { ...reference, size: config.maxBytes + 1 },
    { ...reference, sha256: 'bad' },
  ])
    await failure(() => forwarded.read(invalid, call()), 'invalid_input');
  await failure(
    () => forwarded.write(reference, Buffer.from('different'), call()),
    'invalid_input',
  );
  assert.throws(
    () => storage.assign(scope, Buffer.alloc(config.maxBytes + 1)),
    (error) => error.code === 'invalid_input',
  );
  await failure(
    () => forwarded.read(reference, { ...call(), Bucket: 'untrusted' }),
    'invalid_input',
  );
  await failure(
    () => forwarded.read(reference, { ...call(), signal: { aborted: false } }),
    'invalid_input',
  );
  assert.equal(requests, before);
  const anonymous = await fetch(
    `${config.endpoint}/${config.bucket}/${objectKey(reference, config.maxBytes)}`,
    { signal: AbortSignal.timeout(3000) },
  );
  assert.equal(anonymous.status, 403);
  await anonymous.arrayBuffer();
  await failure(
    () => storage.read(storage.assign(scope, Buffer.from('missing')), call()),
    'missing',
  );
  const denied = new GarageStorage(
    loadStorageConfig({
      ...env,
      STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_denied',
    }),
    (line) => captured.push(line),
  );
  clients.add(denied);
  await failure(() => denied.read(reference, call()), 'forbidden');
  console.log(
    'PASS: invalid object references fail before provider calls; real anonymous/credential-denied reads fail; missing is distinct',
  );

  const writeReference = storage.assign(scope, bytes);
  references.push(writeReference);
  const writeAccepted = barrier('write-ack');
  const write = failure(
    () => forwarded.write(writeReference, bytes, call()),
    'timeout',
  );
  await Promise.race([
    writeAccepted,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Write barrier timed out')), 3000),
    ),
  ]);
  await write;
  mode = 'pass';
  assert.deepEqual(await forwarded.read(writeReference, call()), bytes);
  await forwarded.write(writeReference, bytes, call());
  console.log(
    'PASS: provider accepted write with lost acknowledgement times out; same-identity reconciliation/retry retrieves exact bytes',
  );

  const readReached = barrier('read-stall');
  const read = failure(() => forwarded.read(reference, call()), 'timeout');
  await Promise.race([
    readReached,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Read barrier timed out')), 3000),
    ),
  ]);
  await failure(() => forwarded.inspect(call()), 'busy');
  await read;
  mode = 'outage';
  await failure(() => forwarded.read(reference, call()), 'unavailable');
  await failure(
    () => forwarded.write(writeReference, bytes, call()),
    'unavailable',
  );
  await checkStorageStartup(
    root,
    env,
    captured,
    `http://127.0.0.1:${proxy.address().port}`,
  );
  mode = 'pass';
  await forwarded.write(writeReference, bytes, call());
  assert.deepEqual(await forwarded.read(reference, call()), bytes);
  const controller = new globalThis.AbortController();
  controller.abort();
  const count = requests;
  await failure(
    () => forwarded.read(reference, { ...call(), signal: controller.signal }),
    'cancelled',
  );
  assert.equal(requests, count);
  console.log(
    'PASS: interrupted stream, bounded concurrency, provider outage, cancellation and restored access preserve bytes without false success',
  );

  const disconnected = new GarageStorage(
    { ...config, endpoint: 'http://127.0.0.1:1' },
    (line) => captured.push(line),
  );
  clients.add(disconnected);
  await failure(() => disconnected.read(reference, call()), 'unavailable');
  const corrupted = Buffer.from(bytes);
  corrupted[0] ^= 1;
  await sdk.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey(reference, config.maxBytes),
      Body: corrupted,
    }),
  );
  await failure(() => storage.read(reference, call()), 'conflict');
  await storage.write(reference, bytes, call());
  assert.deepEqual(await storage.read(reference, call()), bytes);
  console.log(
    'PASS: actual refused provider connection is unavailable; privileged content replacement is a safe conflict and same-reference recovery restores verified bytes',
  );

  const objects = await sdk.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: `scopes/${scope}/`,
    }),
  );
  assert.equal(objects.Contents.length, 2);
  assert.deepEqual(
    new Set(objects.Contents.map((object) => object.Key)),
    new Set(references.map((ref) => objectKey(ref, config.maxBytes))),
  );
  const runtime = loadStorageConfig({
    ...env,
    STORAGE_BUCKET: 'myims-artifacts',
    STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_runtime',
  });
  const runtimeSdk = new S3Client({
    ...runtime,
    forcePathStyle: true,
    maxAttempts: 1,
  });
  try {
    for (const command of [
      new CreateBucketCommand({ Bucket: `myims-denied-${randomUUID()}` }),
      new DeleteBucketCommand({ Bucket: runtime.bucket }),
    ])
      await assert.rejects(
        runtimeSdk.send(command),
        (error) => error.$metadata?.httpStatusCode === 403,
      );
    await assert.rejects(
      runtimeSdk.send(new ListObjectsV2Command({ Bucket: config.bucket })),
      (error) => error.$metadata?.httpStatusCode === 403,
    );
  } finally {
    runtimeSdk.destroy();
  }
  console.log(
    'PASS: retries create no extra artifacts; runtime cannot provision/delete buckets or access fixture storage',
  );

  assert.equal(parseStorageConfig({ STORAGE_ENABLED: 'false' }), undefined);
  for (const change of [
    { STORAGE_ENABLED: 'yes' },
    { STORAGE_ENDPOINT: '' },
    { STORAGE_ENDPOINT: 'http://public.example' },
    { STORAGE_ENDPOINT: 'https://user:CONFIG_SECRET_SENTINEL@example.test' },
    { STORAGE_BUCKET: '../bucket' },
    { STORAGE_REGION: '' },
    { STORAGE_CREDENTIALS_FILE: '' },
    { STORAGE_TIMEOUT_MS: '0' },
    { STORAGE_ATTEMPTS: '4' },
    { STORAGE_MAX_BYTES: '999999999' },
    { STORAGE_CONCURRENCY: '17' },
  ]) {
    assert.throws(
      () => loadStorageConfig({ ...env, ...change }),
      (error) => {
        captured.push(error.message);
        return (
          error instanceof ConfigurationError &&
          !error.message.includes('CONFIG_SECRET_SENTINEL')
        );
      },
    );
  }
  assert.throws(
    () =>
      loadStorageConfig({
        ...env,
        STORAGE_CREDENTIALS_FILE: '/missing-secret-sentinel',
      }),
    (error) => {
      captured.push(error.message);
      return error instanceof ConfigurationError;
    },
  );
  const output = captured.join('\n');
  for (const sentinel of [
    bytes.toString(),
    config.credentials.accessKeyId,
    config.credentials.secretAccessKey,
    'CONFIG_SECRET_SENTINEL',
    'missing-secret-sentinel',
  ])
    assert.ok(!output.includes(sentinel));
  const credentials = JSON.parse(
    await readFile('/run/secrets/storage_runtime', 'utf8'),
  );
  assert.ok(!output.includes(credentials.secretAccessKey));
  console.log(
    'PASS: enabled configuration fails safely; captured process logs/errors exclude credential and content sentinels',
  );
} finally {
  for (const child of children) child.kill('SIGKILL');
  for (const client of clients) client.close();
  for (const socket of sockets) socket.destroy();
  for (const request of upstreamRequests) request.destroy();
  await new Promise((resolve) => proxy.close(resolve));
  // Only exact assigned object keys in this run's fixture scope may be deleted.
  for (const ref of references)
    await sdk.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(ref, config.maxBytes),
      }),
    );
  sdk.destroy();
  for (const directory of directories)
    await rm(directory, { recursive: true, force: true });
}
