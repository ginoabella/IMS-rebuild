import { fixturePorts } from './storage-access-fixtures.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/workspace/services/backend/package.json');
const {
  GarageStorage,
} = require('./dist/infrastructure/storage/garage-storage.js');
const {
  loadStorageConfig,
} = require('./dist/infrastructure/storage/configuration.js');
const {
  ArtifactAccess,
} = require('./dist/infrastructure/storage/artifact-access.js');
const config = loadStorageConfig({
  ...process.env,
  STORAGE_ENABLED: 'true',
  STORAGE_BUCKET: 'myims-artifacts',
  STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_runtime',
});
// Endpoint override is confined to trusted isolated-provider acceptance tooling.
const storage = new GarageStorage(
  { ...config, endpoint: process.argv[3], referenceEndpoint: process.argv[3] },
  () => {},
);
const bytes = Buffer.from('STORAGE_DEPLOYMENT_CONTENT_SENTINEL');
let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const reference = input
    ? JSON.parse(input)
    : storage.assign(randomUUID(), bytes);
  if (process.argv[2] === 'write')
    await storage.write(reference, bytes, { correlationId: randomUUID() });
  assert.deepEqual(
    await storage.read(reference, { correlationId: randomUUID() }),
    bytes,
  );
  const actor = {
    plane: 'tenant',
    actorId: randomUUID(),
    tenantId: reference.scopeId,
  };
  const artifactId = randomUUID();
  const ports = fixturePorts(
    [{ artifactId, tenantId: reference.scopeId, reference }],
    [actor.actorId],
  );
  const access = new ArtifactAccess(
    ports.ownership,
    ports.permission,
    storage,
    config.maxBytes,
  );
  const signed = await access.reference(actor, artifactId, {
    correlationId: randomUUID(),
  });
  const response = await fetch(signed.url, {
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
  });
  assert.equal(response.status, 200);
  assert.ok(
    Buffer.from(await response.arrayBuffer()).equals(bytes),
    'Restarted provider reference must retrieve exact bytes',
  );
  console.log(JSON.stringify(reference));
} catch {
  console.error('Storage deployment fixture failed');
  process.exitCode = 1;
} finally {
  storage.close();
}
