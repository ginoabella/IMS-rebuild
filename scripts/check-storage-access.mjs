import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fixturePorts } from './storage-access-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(`${root}services/backend/package.json`);
const {
  ArtifactAccess,
} = require('./dist/infrastructure/storage/artifact-access.js');
const {
  GarageStorage,
} = require('./dist/infrastructure/storage/garage-storage.js');
const {
  loadStorageConfig,
} = require('./dist/infrastructure/storage/configuration.js');
const { digest, objectKey } = require('./dist/infrastructure/storage/port.js');
const {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const env = {
  ...process.env,
  STORAGE_ENABLED: 'true',
  STORAGE_BUCKET: 'myims-storage-fixtures',
  STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_fixture',
  STORAGE_REFERENCE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  STORAGE_TIMEOUT_MS: '800',
  STORAGE_ATTEMPTS: '2',
};
const config = loadStorageConfig(env);
let checkpoint = 'configuration';
const captured = [];
const references = [];
const sensitive = [];
const clients = [];
const children = new Set();
const directories = [];
const storage = new GarageStorage(config, (line) => captured.push(line));
clients.push(storage);
const sdk = new S3Client({ ...config, forcePathStyle: true, maxAttempts: 1 });
const call = () => ({ correlationId: randomUUID() });
async function failure(work, code) {
  await assert.rejects(
    work,
    (error) => {
      captured.push(error.message);
      return (
        error.code === code &&
        error.message === `Storage operation failed: ${code}`
      );
    },
    'Expected safe storage failure',
  );
}
async function retrieve(url, method = 'GET') {
  try {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    return {
      status: response.status,
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  } catch {
    throw new Error('Reference retrieval failed safely');
  }
}
function retain(reference) {
  sensitive.push(
    reference.url,
    new URL(reference.url).searchParams.get('X-Amz-Signature'),
  );
  return reference;
}
const bytes = Buffer.from(`STORAGE_ACCESS_CONTENT_SENTINEL_${randomUUID()}`);
const actors = [0, 1].map(() => ({
  plane: 'tenant',
  actorId: randomUUID(),
  tenantId: randomUUID(),
}));
const records = actors.map((actor) => ({
  artifactId: randomUUID(),
  tenantId: actor.tenantId,
  reference: storage.assign(actor.tenantId, bytes),
}));
references.push(...records.map((record) => record.reference));
const ports = fixturePorts(
  records,
  actors.map((actor) => actor.actorId),
);
const access = new ArtifactAccess(
  ports.ownership,
  ports.permission,
  storage,
  config.maxBytes,
);

// This run's proxy preserves the signed Host header and never retains URLs/headers.
let mode = 'pass';
let reached = () => {};
let requestCount = 0;
const sockets = new Set();
const upstreams = new Set();
const proxy = createServer((incoming, outgoing) => {
  requestCount++;
  if (mode === 'outage') {
    outgoing.writeHead(503, { 'Content-Type': 'application/xml' });
    outgoing.end('<Error><Code>ServiceUnavailable</Code></Error>');
    reached();
    return;
  }
  const upstream = request(
    new URL(incoming.url, config.endpoint),
    { method: incoming.method, headers: incoming.headers },
    (response) => {
      if (mode === 'stall') {
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
  upstreams.add(upstream);
  upstream.on('close', () => upstreams.delete(upstream));
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
const endpoint = `http://127.0.0.1:${proxy.address().port}`;
const forwarded = new GarageStorage(
  { ...config, endpoint, referenceEndpoint: endpoint, concurrency: 1 },
  (line) => captured.push(line),
);
clients.push(forwarded);
const forwardedAccess = new ArtifactAccess(
  ports.ownership,
  ports.permission,
  forwarded,
  config.maxBytes,
);
async function barrier(next, work, interrupted = async () => {}) {
  mode = next;
  let release;
  const accepted = new Promise((resolve) => {
    release = resolve;
  });
  reached = release;
  const pending = work();
  await Promise.race([
    accepted,
    delay(3000).then(() => {
      throw new Error('Access interruption barrier timed out');
    }),
  ]);
  await interrupted();
  await pending;
}
async function processAccess() {
  const directory = await mkdtemp(join(tmpdir(), 'myims-storage-access-'));
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
    const result = once(child, 'message');
    child.send({
      operation: 'access',
      actor: actors[0],
      artifactId: records[0].artifactId,
      records,
      allowedActorIds: actors.map((actor) => actor.actorId),
      call: call(),
    });
    const [value] = await Promise.race([
      result,
      exited.then(() => {
        throw new Error('Access fixture exited early');
      }),
    ]);
    const [code] = await exited;
    assert.equal(code, 0, 'Access fixture must exit successfully');
    assert.deepEqual(
      value,
      { state: 'complete', sha256: digest(bytes), size: bytes.length },
      'Independent reference reader verifies exact bytes',
    );
    assert.deepEqual(
      await readdir(directory),
      [],
      'No replica-local file fallback',
    );
  } finally {
    clearTimeout(timer);
    child.kill();
    children.delete(child);
  }
}
try {
  // Test doubles prove ordering/error sanitization, never provider protocol support.
  const events = [];
  const double = {
    read: async () => {
      events.push('read');
      return bytes;
    },
    reference: async () => {
      events.push('reference');
      return {};
    },
  };
  const ordering = new ArtifactAccess(
    {
      resolve: async (id) => {
        events.push('ownership');
        return ports.ownership.resolve(id);
      },
    },
    {
      permits: async (actor, id) => {
        events.push('permission');
        return ports.permission.permits(actor, id);
      },
    },
    double,
    config.maxBytes,
  );
  for (const operation of ['read', 'reference']) {
    for (const [actor, id, expected] of [
      [actors[0], records[1].artifactId, ['ownership']],
      [actors[1], records[0].artifactId, ['ownership']],
      [actors[0], randomUUID(), ['ownership']],
      [actors[0], '../arbitrary/key', []],
      [
        { ...actors[0], actorId: randomUUID() },
        records[0].artifactId,
        ['ownership', 'permission'],
      ],
      [{ plane: 'platform', actorId: randomUUID() }, records[0].artifactId, []],
      [{ ...actors[0], tenantId: '../tenant' }, records[0].artifactId, []],
      [null, records[0].artifactId, []],
    ]) {
      events.length = 0;
      await failure(() => ordering[operation](actor, id, call()), 'forbidden');
      assert.deepEqual(
        events,
        expected,
        'Denied access must precede provider operations',
      );
    }
    events.length = 0;
    await ordering[operation](actors[0], records[0].artifactId, call());
    assert.deepEqual(
      events,
      ['ownership', 'permission', operation],
      'Ownership and permission precede provider',
    );
  }
  for (const bad of [
    {
      tenantId: actors[0].tenantId,
      reference: { ...records[0].reference, objectId: '../key' },
    },
    { tenantId: actors[0].tenantId, reference: records[1].reference },
    { tenantId: actors[0].tenantId },
  ]) {
    const denied = new ArtifactAccess(
      { resolve: async () => bad },
      ports.permission,
      double,
      config.maxBytes,
    );
    events.length = 0;
    await failure(
      () => denied.reference(actors[0], records[0].artifactId, call()),
      'forbidden',
    );
    assert.equal(
      events.length,
      0,
      'Invalid canonical reference never reaches provider',
    );
  }
  for (const port of ['ownership', 'permission']) {
    const secretError = () => {
      throw new Error('RAW_ACCESS_SECRET_SENTINEL');
    };
    const denied = new ArtifactAccess(
      port === 'ownership' ? { resolve: secretError } : ports.ownership,
      port === 'permission' ? { permits: secretError } : ports.permission,
      double,
      config.maxBytes,
    );
    await failure(
      () => denied.reference(actors[0], records[0].artifactId, call()),
      'unavailable',
    );
  }
  console.log(
    'PASS: two trusted tenant scopes, unresolved/malformed ownership, platform and permission denials precede all provider reads/signing; raw port errors are safe',
  );

  checkpoint = 'fixture writes';
  for (const record of records)
    await storage.write(record.reference, bytes, call());
  for (let index = 0; index < actors.length; index++) {
    assert.ok(
      Buffer.from(
        await access.read(actors[index], records[index].artifactId, call()),
      ).equals(bytes),
      'Tenant read must match exact bytes',
    );
    checkpoint = 'authorized issuance';
    const signed = retain(
      await access.reference(actors[index], records[index].artifactId, call()),
    );
    const url = new URL(signed.url);
    assert.equal(
      url.searchParams.get('X-Amz-Expires'),
      '120',
      'Default lifetime is 120 seconds',
    );
    assert.ok(
      Number.isFinite(Date.parse(signed.expiresAt)),
      'Reference contains expiration',
    );
    checkpoint = 'authorized GET';
    const result = await retrieve(signed.url);
    if (result.status !== 200)
      console.error(
        JSON.stringify({
          event: 'storage_access_check',
          checkpoint,
          status: result.status,
        }),
      );
    assert.equal(result.status, 200, 'Authorized reference must retrieve');
    assert.ok(
      result.bytes.equals(bytes),
      'Reference must retrieve exact intended bytes',
    );
    // A forwarded bearer works without the issuance actor's session/context.
    assert.equal(
      (await retrieve(signed.url)).status,
      200,
      'Bearer forwarding works until expiry',
    );
    for (const field of ['object', 'X-Amz-Signature', 'X-Amz-Expires']) {
      checkpoint = `tamper ${field}`;
      const changed = new URL(signed.url);
      if (field === 'object')
        changed.pathname = changed.pathname.replace(
          records[index].reference.objectId,
          randomUUID(),
        );
      else
        changed.searchParams.set(
          field,
          field === 'X-Amz-Expires' ? '300' : '0'.repeat(64),
        );
      assert.equal(
        (await retrieve(changed.href)).status,
        403,
        'Tampered reference must fail',
      );
    }
    checkpoint = 'GET-only method enforcement';
    const writeAttempt = await retrieve(signed.url, 'PUT');
    assert.ok(
      [400, 403].includes(writeAttempt.status),
      'GET reference rejects write requests',
    );
    assert.ok(
      Buffer.from(
        await access.read(actors[index], records[index].artifactId, call()),
      ).equals(bytes),
      'Rejected write preserves object bytes',
    );
    const anonymous = `${config.endpoint}/${config.bucket}/${objectKey(records[index].reference, config.maxBytes)}`;
    assert.equal(
      (await retrieve(anonymous)).status,
      403,
      'Private object denies anonymous direct access',
    );
  }
  checkpoint = 'lifetime bounds';
  const maximum = retain(
    await access.reference(actors[0], records[0].artifactId, call(), 300),
  );
  assert.equal(new URL(maximum.url).searchParams.get('X-Amz-Expires'), '300');
  const before = requestCount;
  for (const lifetime of [0, -1, 301, 1.5, NaN, Infinity, '120', null])
    await failure(
      () =>
        forwardedAccess.reference(
          actors[0],
          records[0].artifactId,
          call(),
          lifetime,
        ),
      'invalid_input',
    );
  assert.equal(requestCount, before, 'Invalid lifetimes never reach provider');
  checkpoint = 'actual expiry';
  const expiring = retain(
    await access.reference(actors[0], records[0].artifactId, call(), 3),
  );
  assert.equal(
    (await retrieve(expiring.url)).status,
    200,
    'Short reference works before expiry',
  );
  await delay(Math.max(0, Date.parse(expiring.expiresAt) - Date.now()) + 1100);
  const expired = await retrieve(expiring.url);
  console.log(
    JSON.stringify({
      event: 'storage_expiry_check',
      status: expired.status,
      pastExpiry: Date.now() > Date.parse(expiring.expiresAt),
    }),
  );
  assert.ok(
    [400, 403].includes(expired.status),
    'New request after actual provider expiry fails',
  );
  console.log(
    'PASS: Garage GET references retrieve exact bytes; 120-second default, hard 300-second ceiling, forwarding, tampering and actual expiry verified',
  );

  checkpoint = 'missing and interrupted access';
  const missing = {
    artifactId: randomUUID(),
    tenantId: actors[0].tenantId,
    reference: storage.assign(actors[0].tenantId, bytes),
  };
  const missingPorts = fixturePorts([missing], [actors[0].actorId]);
  const missingAccess = new ArtifactAccess(
    missingPorts.ownership,
    missingPorts.permission,
    storage,
    config.maxBytes,
  );
  await failure(
    () => missingAccess.reference(actors[0], missing.artifactId, call()),
    'missing',
  );
  const consumerHost = new GarageStorage(
    { ...config, referenceEndpoint: endpoint },
    (line) => captured.push(line),
  );
  clients.push(consumerHost);
  const separateHost = retain(
    await consumerHost.reference(records[0].reference, call()),
  );
  assert.equal(
    new URL(separateHost.url).origin,
    endpoint,
    'Consumer endpoint is distinct from backend endpoint',
  );
  assert.ok(
    (await retrieve(separateHost.url)).bytes.equals(bytes),
    'Separate signing host reaches the intended provider',
  );
  const signed = retain(
    await forwardedAccess.reference(actors[0], records[0].artifactId, call()),
  );
  await barrier('outage', () =>
    failure(
      () => forwardedAccess.reference(actors[0], records[0].artifactId, call()),
      'unavailable',
    ),
  );
  assert.equal(
    (await retrieve(signed.url)).status,
    503,
    'Previously signed reference does not imply availability',
  );
  await barrier(
    'stall',
    () =>
      failure(
        () =>
          forwardedAccess.reference(actors[0], records[0].artifactId, call()),
        'timeout',
      ),
    () =>
      failure(
        () =>
          forwardedAccess.reference(actors[0], records[0].artifactId, call()),
        'busy',
      ),
  );
  await barrier('stall', async () => {
    try {
      await fetch(signed.url, { signal: AbortSignal.timeout(800) }).then(
        (response) => response.arrayBuffer(),
      );
      throw new Error('Interrupted reference falsely succeeded');
    } catch (error) {
      assert.ok(
        error.name === 'TimeoutError' || error.name === 'AbortError',
        'Interrupted reference request is bounded',
      );
    }
  });
  mode = 'pass';
  const recovered = retain(
    await forwardedAccess.reference(actors[0], records[0].artifactId, call()),
  );
  assert.ok(
    (await retrieve(recovered.url)).bytes.equals(bytes),
    'Recovered reference retrieves same bytes',
  );
  assert.ok(
    (await retrieve(signed.url)).bytes.equals(bytes),
    'Existing reference recovers at same identity',
  );
  const controller = new globalThis.AbortController();
  controller.abort();
  const count = requestCount;
  await failure(
    () =>
      forwardedAccess.reference(actors[0], records[0].artifactId, {
        ...call(),
        signal: controller.signal,
      }),
    'cancelled',
  );
  assert.equal(
    requestCount,
    count,
    'Cancelled issuance never reaches provider',
  );
  checkpoint = 'independent reference processes';
  for (let index = 0; index < 2; index++) await processAccess();
  for (const actor of actors) {
    const listed = await sdk.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: `scopes/${actor.tenantId}/`,
      }),
    );
    assert.equal(
      listed.Contents.length,
      1,
      'Recovery creates no duplicate artifacts',
    );
  }
  console.log(
    'PASS: missing, unavailable and timeout remain distinct; reference interruption/recovery and fresh independent processes preserve identity/bytes without disk fallback',
  );

  checkpoint = 'access configuration and output sentinels';
  for (const change of [
    { STORAGE_REFERENCE_ENDPOINT: '' },
    { STORAGE_REFERENCE_ENDPOINT: 'http://external.example' },
    {
      STORAGE_REFERENCE_ENDPOINT:
        'https://user:REFERENCE_SECRET_SENTINEL@example.test',
    },
    {
      STORAGE_REFERENCE_ENDPOINT:
        'https://example.test/path?REFERENCE_SECRET_SENTINEL',
    },
    { STORAGE_REFERENCE_DEFAULT_SECONDS: '301' },
    { STORAGE_REFERENCE_DEFAULT_SECONDS: '0' },
    { STORAGE_REFERENCE_DEFAULT_SECONDS: '1.5' },
  ])
    assert.throws(
      () => loadStorageConfig({ ...env, ...change }),
      (error) => {
        captured.push(error.message);
        return !error.message.includes('REFERENCE_SECRET_SENTINEL');
      },
    );
  assert.equal(config.referenceDefaultSeconds, 120);
  const noHost = new GarageStorage(
    { ...config, referenceEndpoint: undefined },
    (line) => captured.push(line),
  );
  clients.push(noHost);
  await failure(
    () => noHost.reference(records[0].reference, call()),
    'invalid_input',
  );
  const output = captured.join('\n');
  for (const sentinel of [
    bytes.toString(),
    config.credentials.accessKeyId,
    config.credentials.secretAccessKey,
    'RAW_ACCESS_SECRET_SENTINEL',
    'REFERENCE_SECRET_SENTINEL',
    'X-Amz-Signature',
    ...sensitive,
  ])
    assert.ok(
      !output.includes(sentinel),
      'Captured outputs exclude content, credentials, references and raw error sentinels',
    );
  console.log(
    'PASS: invalid/missing access settings and errors fail safely; captured logs omit signed-reference, credential and content sentinels',
  );
} catch {
  // Assertions and fetch/SDK exceptions may contain protected material: never dump.
  console.error(`Storage access verification failed safely at ${checkpoint}`);
  process.exitCode = 1;
} finally {
  for (const child of children) child.kill('SIGKILL');
  for (const client of clients) client.close();
  for (const socket of sockets) socket.destroy();
  for (const upstream of upstreams) upstream.destroy();
  await new Promise((resolve) => proxy.close(resolve));
  try {
    for (const reference of references)
      await sdk.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: objectKey(reference, config.maxBytes),
        }),
      );
  } catch {
    console.error('Storage access fixture teardown failed safely');
    process.exitCode = 1;
  }
  sdk.destroy();
  for (const directory of directories)
    await rm(directory, { recursive: true, force: true });
}
